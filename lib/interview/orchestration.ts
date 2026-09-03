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
      // Skip if already transcribed, or if an immediate-processing job
      // (see upload-audio/route.ts, follow_ups-enabled modules only) is
      // already queued/running for this answer — otherwise a candidate
      // submitting the full session while the last answer's immediate job
      // is still in flight would get a duplicate transcription job racing
      // against it.
      if (
        answer.transcriptStatus === "completed" ||
        answer.transcriptJobId
      ) {
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

    // Answers whose transcription/evaluation permanently failed. This
    // matters most for Interview Coach: its answers are often already
    // transcribed/evaluated immediately during the interview (see
    // upload-audio/route.ts's immediate-processing path for follow_ups-
    // enabled modules), so initiateSessionProcessing() skips re-queuing a
    // job for them at final submission (it only queues for
    // transcriptStatus !== "completed" && !transcriptJobId). If that
    // earlier immediate job failed, no new job is ever queued to retry or
    // surface it — without this check, evaluationCompleted can never reach
    // totalAnswers and the session sits in "evaluating" indefinitely until
    // the orchestration job's own 10-minute maxExecutionTimeMs eventually
    // times it out, instead of failing promptly with a clear reason.
    const answerRows = await db
      .select({
        id: candidateInterviewAnswers.id,
        transcriptStatus: candidateInterviewAnswers.transcriptStatus,
        evaluationStatus: candidateInterviewAnswers.evaluationStatus,
        transcriptJobId: candidateInterviewAnswers.transcriptJobId,
        evaluationJobId: candidateInterviewAnswers.evaluationJobId,
      })
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, sessionId));

    // An answer's own transcriptStatus/evaluationStatus column only updates
    // when its job handler actually runs. If the underlying job row itself
    // failed before the handler body ran (e.g. "No handler registered for
    // job type" from a hot-reload/restart race — the job was dequeued
    // before initializeBackgroundJobs() finished re-registering handlers),
    // the answer column is left stuck at "pending" forever even though the
    // job is dead. Cross-referencing each answer's transcriptJobId/
    // evaluationJobId against the actual job row's status (regardless of
    // correlationId, unlike the scoped queries below) catches this case too
    // — without it, a session like this sits in "processing" forever
    // instead of surfacing as failed.
    const answerJobIds = answerRows
      .flatMap((row) => [row.transcriptJobId, row.evaluationJobId])
      .filter((id): id is string => Boolean(id));
    const answerJobRows =
      answerJobIds.length > 0
        ? await db
            .select({ id: backgroundJobs.id, status: backgroundJobs.status })
            .from(backgroundJobs)
            .where(inArray(backgroundJobs.id, answerJobIds))
        : [];
    const failedAnswerJobIds = new Set(
      answerJobRows
        .filter((job) => job.status === "failed")
        .map((job) => job.id),
    );

    const failedAnswerRows = answerRows.filter(
      (row) =>
        row.transcriptStatus === "failed" ||
        row.evaluationStatus === "failed" ||
        (row.transcriptJobId && failedAnswerJobIds.has(row.transcriptJobId)) ||
        (row.evaluationJobId && failedAnswerJobIds.has(row.evaluationJobId)),
    );

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
    const computedStatus = determineStatus(
      orchestrationJob.status,
      transcriptionCompleted,
      evaluationCompleted,
      totalAnswers,
      failedAnswerRows.length > 0,
    );
    const progress: ProcessingProgress = {
      transcriptedAnswers: transcriptionCompleted,
      evaluatedAnswers: evaluationCompleted,
      totalAnswers,
      status: computedStatus,
      currentStep:
        transcriptionCompleted < totalAnswers
          ? "transcribing"
          : evaluationCompleted < totalAnswers
            ? "evaluating"
            : "summarizing",
    };

    // Correct the stored session row as soon as anyone observes a failure
    // here (the SSE stream polls this every 500ms while a candidate has the
    // processing page open, and the admin sessions list calls this
    // indirectly too) — otherwise a session whose orchestration job died
    // without reaching its own status-writing branch (see
    // handleInterviewSessionOrchestration in backgroundJobHandlers.ts)
    // stays stuck showing "processing" in the admin panel forever, even
    // though this function has already determined it failed.
    if (
      computedStatus === "failed" &&
      currentSession.status !== "failed" &&
      currentSession.status !== "completed"
    ) {
      await db
        .update(candidateInterviewSessions)
        .set({ status: "failed", completedAt: new Date().toISOString() })
        .where(eq(candidateInterviewSessions.id, sessionId));
    }

    // Collect errors from failed jobs
    const failedJobs = [
      ...transcriptionJobs.filter((j) => j.status === "failed"),
      ...evaluationJobs.filter((j) => j.status === "failed"),
    ];

    const failedJobAnswerIds = new Set(
      failedJobs
        .map(
          (job) =>
            (job.result as { answerId?: string } | null | undefined)
              ?.answerId,
        )
        .filter((id): id is string => Boolean(id)),
    );

    const errors = [
      ...failedJobs.map((job) => ({
        answerId:
          (job.result as { answerId?: string } | null | undefined)
            ?.answerId ?? job.id,
        step: job.name.includes("transcription")
          ? "transcription"
          : "evaluation",
        error: job.error || "Unknown error",
        attempt: job.attempts || 0,
      })),
      // Failed answers with no corresponding background-job row at all —
      // i.e. their only processing attempt was the immediate per-answer job
      // from upload-audio, which isn't re-surfaced here via the
      // correlationId-scoped queries above (it predates the orchestration
      // job's own correlationId).
      ...failedAnswerRows
        .filter((row) => !failedJobAnswerIds.has(row.id))
        .map((row) => ({
          answerId: row.id,
          step:
            row.transcriptStatus === "failed" ? "transcription" : "evaluation",
          error: "Processing failed for this answer",
          attempt: 1,
        })),
    ];

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
    let candidateAnswers;

    if (answerIds && answerIds.length > 0) {
      candidateAnswers = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(
          and(
            eq(candidateInterviewAnswers.sessionId, sessionId),
            inArray(candidateInterviewAnswers.id, answerIds),
          ),
        );
    } else {
      candidateAnswers = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(eq(candidateInterviewAnswers.sessionId, sessionId));
    }

    // An answer's own transcriptStatus/evaluationStatus column only
    // updates when its job handler actually runs. If the underlying job
    // row died before the handler body ran (e.g. "No handler registered
    // for job type" from a hot-reload/restart race), the answer column is
    // left stuck at "pending" forever even though the job is dead —
    // filtering on the column alone (as this used to) finds zero "failed"
    // answers in that case, so retry silently queues nothing and this
    // function returns an empty retryJobIds array without ever failing
    // visibly. Cross-referencing each answer's transcriptJobId/
    // evaluationJobId against the actual background_jobs row status
    // catches this — see the identical fix in getSessionProcessingStatus
    // above and handleInterviewSessionOrchestration in
    // backgroundJobHandlers.ts.
    const candidateJobIds = candidateAnswers
      .flatMap((row) => [row.transcriptJobId, row.evaluationJobId])
      .filter((id): id is string => Boolean(id));
    const candidateJobRows =
      candidateJobIds.length > 0
        ? await db
            .select({ id: backgroundJobs.id, status: backgroundJobs.status })
            .from(backgroundJobs)
            .where(inArray(backgroundJobs.id, candidateJobIds))
        : [];
    const deadJobIds = new Set(
      candidateJobRows
        .filter((job) => job.status === "failed")
        .map((job) => job.id),
    );
    const transcriptDead = (
      row: (typeof candidateAnswers)[number],
    ): boolean =>
      row.transcriptStatus === "failed" ||
      Boolean(row.transcriptJobId && deadJobIds.has(row.transcriptJobId));
    const evaluationDead = (
      row: (typeof candidateAnswers)[number],
    ): boolean =>
      row.evaluationStatus === "failed" ||
      Boolean(row.evaluationJobId && deadJobIds.has(row.evaluationJobId));

    const failedAnswers =
      answerIds && answerIds.length > 0
        ? candidateAnswers
        : candidateAnswers.filter(
            (row) => transcriptDead(row) || evaluationDead(row),
          );

    if (failedAnswers.length === 0) {
      throw new SessionError(
        "No failed answers found to retry for this session.",
        "SESSION_INVALID_STATE",
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
      if (transcriptDead(answer)) {
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

      // Retry evaluation if failed (but not if transcription itself is
      // being retried too — there's no transcript yet to evaluate against
      // until that finishes; the orchestration job picks up evaluation
      // once transcription completes, same as the initial processing
      // flow).
      if (!transcriptDead(answer) && evaluationDead(answer)) {
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
      // Re-evaluation only re-runs AI scoring against an existing
      // transcript — it can't produce one. If every targeted answer is
      // missing a transcript (e.g. its transcription job itself failed),
      // there's nothing here to re-evaluate; the fix is "Retry Failed
      // Jobs" (retryFailedProcessing / initiateSessionProcessing), which
      // re-queues transcription too, not re-evaluation.
      throw new SessionError(
        "None of the selected answers have a transcript yet, so there's nothing to re-evaluate. Use \"Retry Failed Jobs\" instead — it re-runs transcription first.",
        "SESSION_INVALID_STATE",
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
  hasFailedAnswers: boolean,
): SessionProcessingStatus["status"] {
  if (orchestrationStatus === "failed" || hasFailedAnswers) {
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
