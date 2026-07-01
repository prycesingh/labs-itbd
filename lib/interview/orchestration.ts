/**
 * Interview Session Orchestration Layer
 *
 * High-level coordination of interview session processing:
 * - Job correlation tracking
 * - Child job spawning (transcription + evaluation)
 * - Processing status monitoring
 * - Partial failure recovery
 */

import { db } from "@/DB/drizzle";
import {
  candidateInterviewAnswers,
  candidateInterviewSessions,
} from "@/DB/interviewSchema";
import { backgroundJobs } from "@/DB/schema";
import { ProcessingProgress, SessionProcessingStatus } from "@/types/interview";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { OrchestrationError, SessionError } from "./errors";
import {
  INTERVIEW_EVALUATION_JOB,
  INTERVIEW_SESSION_ORCHESTRATION_JOB,
  INTERVIEW_TRANSCRIPTION_JOB,
  generateCorrelationId,
} from "./jobConstants";

// ─────────────────────────────────────────────
// ORCHESTRATION: SESSION PROCESSING
// ─────────────────────────────────────────────

/**
 * Initiate batch processing for a completed session
 * Creates orchestration job + spawns child transcription jobs
 *
 * Flow:
 * 1. Validate session state (must be RECORDED)
 * 2. Fetch all answers with uploaded audio
 * 3. Create orchestration job (parent)
 * 4. Queue transcription jobs for all answers
 * 5. Return orchestration job ID for polling
 */
export async function initiateSessionProcessing(
  sessionId: string,
  requestedByUserId: string,
): Promise<{
  orchestrationJobId: string;
  correlationId: string;
  childJobs: {
    transcriptionJobIds: string[];
    evaluationJobIds: string[];
  };
}> {
  try {
    // 1. Fetch session + validate state
    const session = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!session || session.length === 0) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    const currentSession = session[0];

    if (currentSession.status !== "recorded") {
      throw new SessionError(
        `Session not in RECORDED state. Current: ${currentSession.status}`,
        "SESSION_INVALID_STATE",
      );
    }

    // 2. Fetch all uploaded answers
    const answers = await db
      .select()
      .from(candidateInterviewAnswers)
      .where(
        and(
          eq(candidateInterviewAnswers.sessionId, sessionId),
          isNotNull(candidateInterviewAnswers.audioStoragePath),
        ),
      );

    if (answers.length === 0) {
      throw new SessionError(
        `No uploaded answers found for session: ${sessionId}`,
      );
    }

    // 3. Generate correlation ID for tracing
    const correlationId = generateCorrelationId(sessionId);

    // 4. Update session status to PROCESSING
    await db
      .update(candidateInterviewSessions)
      .set({
        status: "processing",
        processingStartedAt: sql`CURRENT_TIMESTAMP`,
        sessionState: sql`JSON_SET(session_state, '$.processingStartedAt', NOW())`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(candidateInterviewSessions.id, sessionId));

    // 5. Create orchestration job (parent)
    const orchestrationJobId = `${INTERVIEW_SESSION_ORCHESTRATION_JOB}_${sessionId}_${Date.now()}`;

    await db.insert(backgroundJobs).values({
      id: orchestrationJobId,
      name: INTERVIEW_SESSION_ORCHESTRATION_JOB,
      status: "queued",
      correlationId,
      userId: requestedByUserId,
      maxExecutionTimeMs: 10 * 60 * 1000,
      maxAttempts: 1,
      result: {
        sessionId,
        correlationId,
        type: "orchestration",
      },
      error: null,
      createdAt: sql`CURRENT_TIMESTAMP`,
    });

    // 6. Create transcription jobs for all answers
    const transcriptionJobIds: string[] = [];

    for (const answer of answers) {
      // Skip if already transcribed
      if (answer.transcriptStatus === "completed") {
        continue;
      }

      // Create transcription job
      const jobId = `${INTERVIEW_TRANSCRIPTION_JOB}_${sessionId}_${answer.questionIndex}_${Date.now()}`;

      await db.insert(backgroundJobs).values({
        id: jobId,
        name: INTERVIEW_TRANSCRIPTION_JOB,
        status: "queued",
        correlationId, // Link to orchestration
        parentJobId: orchestrationJobId,
        userId: requestedByUserId,
        maxExecutionTimeMs: 5 * 60 * 1000, // 5 min
        maxAttempts: 3,
        result: {
          sessionId,
          answerId: answer.id,
          audioStoragePath: answer.audioStoragePath,
          ...(answer.transcriptDetectedLanguage
            ? { detectedLanguage: answer.transcriptDetectedLanguage }
            : {}),
          type: "transcription",
        },
        error: null,
        createdAt: sql`CURRENT_TIMESTAMP`,
      });

      transcriptionJobIds.push(jobId);

      // Link job ID to answer
      await db
        .update(candidateInterviewAnswers)
        .set({
          transcriptJobId: jobId,
          transcriptStatus: "pending",
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(candidateInterviewAnswers.id, answer.id));
    }

    await db
      .update(backgroundJobs)
      .set({
        result: {
          sessionId,
          correlationId,
          type: "orchestration",
          transcriptionJobIds,
          evaluationJobIds: [],
        },
      })
      .where(eq(backgroundJobs.id, orchestrationJobId));

    return {
      orchestrationJobId,
      correlationId,
      childJobs: {
        transcriptionJobIds,
        evaluationJobIds: [],
      },
    };
  } catch (error) {
    if (error instanceof SessionError) throw error;
    throw new OrchestrationError(
      `Failed to initiate session processing: ${error instanceof Error ? error.message : "Unknown error"}`,
      true,
      { sessionId },
    );
  }
}

// ─────────────────────────────────────────────
// PROGRESS MONITORING
// ─────────────────────────────────────────────

/**
 * Get real-time processing status for a session
 * Used for SSE progress streaming
 */
export async function getSessionProcessingStatus(
  sessionId: string,
): Promise<SessionProcessingStatus> {
  try {
    // Fetch session
    const session = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!session || session.length === 0) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    const currentSession = session[0];

    // Find orchestration job for this session
    const [orchestrationJob] = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.name, INTERVIEW_SESSION_ORCHESTRATION_JOB),
          sql`JSON_EXTRACT(result, '$.sessionId') = ${sessionId}`,
        ),
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1);

    if (!orchestrationJob) {
      throw new OrchestrationError(
        `Orchestration job not found for session: ${sessionId}`,
      );
    }

    // Count transcription progress
    const transcriptionJobs = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.name, INTERVIEW_TRANSCRIPTION_JOB),
          eq(
            backgroundJobs.correlationId,
            orchestrationJob.correlationId || "",
          ),
        ),
      );

    const transcriptionCompleted = transcriptionJobs.filter(
      (j) => j.status === "completed",
    ).length;

    // Count evaluation progress
    const evaluationJobs = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.name, INTERVIEW_EVALUATION_JOB),
          eq(
            backgroundJobs.correlationId,
            orchestrationJob.correlationId || "",
          ),
        ),
      );

    const evaluationCompleted = evaluationJobs.filter(
      (j) => j.status === "completed",
    ).length;

    // Calculate progress
    const totalAnswers = currentSession.totalQuestions;
    const progress: ProcessingProgress = {
      transcriptedAnswers: transcriptionCompleted,
      evaluatedAnswers: evaluationCompleted,
      totalAnswers,
      status: determineStatus(
        orchestrationJob.status,
        transcriptionCompleted,
        evaluationCompleted,
        totalAnswers,
      ),
      currentStep:
        transcriptionCompleted < totalAnswers
          ? "transcribing"
          : evaluationCompleted < totalAnswers
            ? "evaluating"
            : "summarizing",
    };

    // Collect errors from failed jobs
    const failedJobs = [
      ...transcriptionJobs.filter((j) => j.status === "failed"),
      ...evaluationJobs.filter((j) => j.status === "failed"),
    ];

    const errors = failedJobs.map((job) => ({
      answerId:
        (job.result as { answerId?: string } | null | undefined)?.answerId ??
        job.id,
      step: job.name.includes("transcription") ? "transcription" : "evaluation",
      error: job.error || "Unknown error",
      attempt: job.attempts || 0,
    }));

    return {
      orchestrationJobId: orchestrationJob.id,
      status: progress.status,
      progress,
      errors,
    };
  } catch (error) {
    if (error instanceof SessionError || error instanceof OrchestrationError) {
      throw error;
    }
    throw new OrchestrationError(
      `Failed to get processing status: ${error instanceof Error ? error.message : "Unknown error"}`,
      false,
      { sessionId },
    );
  }
}

// ─────────────────────────────────────────────
// PARTIAL RECOVERY
// ─────────────────────────────────────────────

/**
 * Retry failed processing for specific answers
 * Idempotent: checks if already processed, skips if done
 */
export async function retryFailedProcessing(
  sessionId: string,
  answerIds?: string[],
  requestedByUserId?: string,
): Promise<{ retryJobIds: string[] }> {
  try {
    const session = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!session || session.length === 0) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    // Fetch failed answers
    let failedAnswers;

    if (answerIds && answerIds.length > 0) {
      failedAnswers = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(
          and(
            eq(candidateInterviewAnswers.sessionId, sessionId),
            inArray(candidateInterviewAnswers.id, answerIds),
          ),
        );
    } else {
      failedAnswers = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(eq(candidateInterviewAnswers.sessionId, sessionId));
      failedAnswers = failedAnswers.filter(
        (row) =>
          row.transcriptStatus === "failed" ||
          row.evaluationStatus === "failed",
      );
    }

    const correlationId = generateCorrelationId(sessionId);
    const retryJobIds: string[] = [];

    const retryParentJobId = `${INTERVIEW_SESSION_ORCHESTRATION_JOB}_${sessionId}_retry_${Date.now()}`;
    await db.insert(backgroundJobs).values({
      id: retryParentJobId,
      name: INTERVIEW_SESSION_ORCHESTRATION_JOB,
      status: "queued",
      correlationId,
      userId: requestedByUserId ?? session[0].candidateId,
      maxExecutionTimeMs: 10 * 60 * 1000,
      maxAttempts: 1,
      result: {
        sessionId,
        correlationId,
        type: "orchestration-retry",
      },
      error: null,
      createdAt: sql`CURRENT_TIMESTAMP`,
    });

    for (const answer of failedAnswers) {
      // Retry transcription if failed
      if (answer.transcriptStatus === "failed") {
        const jobId = `${INTERVIEW_TRANSCRIPTION_JOB}_${sessionId}_${answer.questionIndex}_retry_${Date.now()}`;

        await db.insert(backgroundJobs).values({
          id: jobId,
          name: INTERVIEW_TRANSCRIPTION_JOB,
          status: "queued",
          correlationId,
          parentJobId: retryParentJobId,
          userId: requestedByUserId ?? session[0].candidateId,
          maxExecutionTimeMs: 5 * 60 * 1000,
          maxAttempts: 3,
          result: {
            sessionId,
            answerId: answer.id,
            audioStoragePath: answer.audioStoragePath,
            type: "transcription-retry",
          },
          error: null,
          createdAt: sql`CURRENT_TIMESTAMP`,
        });

        retryJobIds.push(jobId);

        await db
          .update(candidateInterviewAnswers)
          .set({
            transcriptJobId: jobId,
            transcriptStatus: "pending",
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(candidateInterviewAnswers.id, answer.id));
      }

      // Retry evaluation if failed
      if (answer.evaluationStatus === "failed") {
        const jobId = `${INTERVIEW_EVALUATION_JOB}_${sessionId}_${answer.questionIndex}_retry_${Date.now()}`;

        await db.insert(backgroundJobs).values({
          id: jobId,
          name: INTERVIEW_EVALUATION_JOB,
          status: "queued",
          correlationId,
          parentJobId: retryParentJobId,
          userId: requestedByUserId ?? session[0].candidateId,
          maxExecutionTimeMs: 3 * 60 * 1000,
          maxAttempts: 2,
          result: {
            sessionId,
            answerId: answer.id,
            transcript: answer.transcriptedText,
            questionId: answer.questionId,
            type: "evaluation-retry",
          },
          error: null,
          createdAt: sql`CURRENT_TIMESTAMP`,
        });

        retryJobIds.push(jobId);

        await db
          .update(candidateInterviewAnswers)
          .set({
            evaluationJobId: jobId,
            evaluationStatus: "pending",
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(candidateInterviewAnswers.id, answer.id));
      }
    }

    return { retryJobIds };
  } catch (error) {
    if (error instanceof SessionError || error instanceof OrchestrationError) {
      throw error;
    }
    throw new OrchestrationError(
      `Failed to retry processing: ${error instanceof Error ? error.message : "Unknown error"}`,
      true,
      { sessionId, answerIds },
    );
  }
}

/**
 * Force re-evaluation for a processed session.
 * Queues evaluation jobs even for answers previously marked completed.
 */
export async function reEvaluateSessionProcessing(
  sessionId: string,
  answerIds?: string[],
  requestedByUserId?: string,
): Promise<{ reEvaluationJobIds: string[] }> {
  try {
    const session = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!session || session.length === 0) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    let targetAnswers;

    if (answerIds && answerIds.length > 0) {
      targetAnswers = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(
          and(
            eq(candidateInterviewAnswers.sessionId, sessionId),
            inArray(candidateInterviewAnswers.id, answerIds),
          ),
        );
    } else {
      targetAnswers = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(eq(candidateInterviewAnswers.sessionId, sessionId));
    }

    const answersWithTranscript = targetAnswers.filter(
      (row) =>
        typeof row.transcriptedText === "string" &&
        row.transcriptedText.trim().length > 0,
    );

    if (answersWithTranscript.length === 0) {
      throw new SessionError(
        "No answers with transcripts are available for reevaluation",
      );
    }

    const correlationId = generateCorrelationId(sessionId);
    const reEvaluationJobIds: string[] = [];

    const parentJobId = `${INTERVIEW_SESSION_ORCHESTRATION_JOB}_${sessionId}_reevaluate_${Date.now()}`;
    await db.insert(backgroundJobs).values({
      id: parentJobId,
      name: INTERVIEW_SESSION_ORCHESTRATION_JOB,
      status: "queued",
      correlationId,
      userId: requestedByUserId ?? session[0].candidateId,
      maxExecutionTimeMs: 10 * 60 * 1000,
      maxAttempts: 1,
      result: {
        sessionId,
        correlationId,
        type: "orchestration-reevaluate",
      },
      error: null,
      createdAt: sql`CURRENT_TIMESTAMP`,
    });

    for (const answer of answersWithTranscript) {
      const jobId = `${INTERVIEW_EVALUATION_JOB}_${sessionId}_${answer.questionIndex}_reevaluate_${Date.now()}`;

      await db.insert(backgroundJobs).values({
        id: jobId,
        name: INTERVIEW_EVALUATION_JOB,
        status: "queued",
        correlationId,
        parentJobId,
        userId: requestedByUserId ?? session[0].candidateId,
        maxExecutionTimeMs: 3 * 60 * 1000,
        maxAttempts: 2,
        result: {
          sessionId,
          answerId: answer.id,
          transcript: answer.transcriptedText,
          questionId: answer.questionId,
          type: "evaluation-reevaluate",
          forceReevaluate: true,
        },
        error: null,
        createdAt: sql`CURRENT_TIMESTAMP`,
      });

      reEvaluationJobIds.push(jobId);

      await db
        .update(candidateInterviewAnswers)
        .set({
          evaluationJobId: jobId,
          evaluationStatus: "pending",
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(candidateInterviewAnswers.id, answer.id));
    }

    return { reEvaluationJobIds };
  } catch (error) {
    if (error instanceof SessionError || error instanceof OrchestrationError) {
      throw error;
    }
    throw new OrchestrationError(
      `Failed to re-evaluate session: ${error instanceof Error ? error.message : "Unknown error"}`,
      true,
      { sessionId, answerIds },
    );
  }
}

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Determine overall processing status
 */
function determineStatus(
  orchestrationStatus: string,
  transcriptionCompleted: number,
  evaluationCompleted: number,
  totalAnswers: number,
): SessionProcessingStatus["status"] {
  if (orchestrationStatus === "failed") {
    return "failed";
  }

  if (
    orchestrationStatus === "completed" &&
    evaluationCompleted === totalAnswers
  ) {
    return "completed";
  }

  if (transcriptionCompleted < totalAnswers) {
    return "transcribing";
  }

  if (evaluationCompleted < totalAnswers) {
    return "evaluating";
  }

  return "summarizing";
}
