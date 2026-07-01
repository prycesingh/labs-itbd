/**
 * Background Job Handlers — Interview module
 *
 * These functions are executed asynchronously by the in-process background job
 * queue (see lib/backgroundJobs.ts). They handle transcription, evaluation,
 * session orchestration, summary generation, and audio retention cleanup
 * without blocking the API.
 *
 * Handlers are registered lazily via initializeBackgroundJobs(), which the
 * interview API routes call on first use.
 */

import { db } from "@/DB/drizzle";
import {
  aiInterviewEvaluations,
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewModules,
  interviewQuestions,
  interviewQuestionStandardResponses,
  interviewSessionSummaries,
} from "@/DB/interviewSchema";
import { backgroundJobs } from "@/DB/schema";
import { getJobQueue } from "@/lib/backgroundJobs";
import {
  evaluateAnswer,
  generateSessionSummary,
  transcribeAudio,
} from "@/lib/interview/aiServices";
import {
  cleanupOldAudioFiles,
  getAudioStorageProvider,
} from "@/lib/interview/audioStorage";
import {
  normalizeDimensionMap,
  normalizeTotalScore,
} from "@/lib/interview/evaluationMetrics";
import {
  INTERVIEW_AUDIO_RETENTION_CLEANUP_JOB,
  INTERVIEW_EVALUATION_JOB,
  INTERVIEW_SESSION_ORCHESTRATION_JOB,
  INTERVIEW_SESSION_SUMMARY_JOB,
  INTERVIEW_TRANSCRIPTION_JOB,
} from "@/lib/interview/jobConstants";
import type { AIEvaluationStructured } from "@/types/interview";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

type InterviewJobPayload = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseInterviewPayloadSource(value: unknown): InterviewJobPayload {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? (parsed as InterviewJobPayload) : {};
    } catch {
      return {};
    }
  }

  if (!isRecord(value)) {
    return {};
  }

  const payloadCandidate =
    isRecord(value.payload) && Object.keys(value.payload).length > 0
      ? value.payload
      : isRecord(value.data) && Object.keys(value.data).length > 0
        ? value.data
        : isRecord(value.jobData) && Object.keys(value.jobData).length > 0
          ? value.jobData
          : value;

  return payloadCandidate as InterviewJobPayload;
}

function normalizeEvaluationValue(
  value: unknown,
): AIEvaluationStructured | null {
  if (typeof value === "string") {
    try {
      return normalizeEvaluationValue(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  const totalScore = normalizeTotalScore(value.total_score);

  if (totalScore === undefined) {
    return null;
  }

  const dimensions = normalizeDimensionMap(
    isRecord(value.dimensions) ? value.dimensions : {},
  );

  if (Object.keys(dimensions).length === 0) {
    return null;
  }

  return {
    total_score: totalScore,
    dimensions: {
      courtesy: normalizeDimension(dimensions.courtesy),
      empathy: normalizeDimension(dimensions.empathy),
      professionalism_and_tone: normalizeDimension(
        dimensions.professionalism_and_tone,
      ),
      communication_clarity: normalizeDimension(
        dimensions.communication_clarity,
      ),
      engagement_and_problem_handling: normalizeDimension(
        dimensions.engagement_and_problem_handling,
      ),
    },
    strengths: Array.isArray(value.strengths)
      ? value.strengths.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    improvement_areas: Array.isArray(value.improvement_areas)
      ? value.improvement_areas.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    final_summary:
      typeof value.final_summary === "string" ? value.final_summary : "",
  };
}

function normalizeDimension(value: unknown) {
  if (!isRecord(value)) {
    return { score: 0, reason: "" };
  }

  const score =
    typeof value.score === "number" ? value.score : Number(value.score);

  return {
    score: Number.isFinite(score) ? score : 0,
    reason: typeof value.reason === "string" ? value.reason : "",
  };
}

let handlersInitialized = false;

const parseJobPayload = (value: unknown): InterviewJobPayload => {
  return parseInterviewPayloadSource(value);
};

async function getInterviewAnswerByJobId(
  jobId: string | undefined,
  jobColumn: "transcriptJobId" | "evaluationJobId",
) {
  if (!jobId) {
    return null;
  }

  const [answer] = await db
    .select({
      id: candidateInterviewAnswers.id,
      sessionId: candidateInterviewAnswers.sessionId,
      questionId: candidateInterviewAnswers.questionId,
      questionIndex: candidateInterviewAnswers.questionIndex,
      audioStoragePath: candidateInterviewAnswers.audioStoragePath,
      transcriptedText: candidateInterviewAnswers.transcriptedText,
    })
    .from(candidateInterviewAnswers)
    .where(eq(candidateInterviewAnswers[jobColumn], jobId))
    .limit(1);

  return answer ?? null;
}

async function getBackgroundJobById(jobId?: string) {
  if (!jobId) {
    return null;
  }

  const [job] = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.id, jobId))
    .limit(1);

  return job ?? null;
}

async function getInterviewPayload(jobId?: string) {
  const job = await getBackgroundJobById(jobId);
  if (!job) {
    return {
      payload: {} as InterviewJobPayload,
      userId: null as string | null,
      correlationId: null as string | null,
      parentJobId: null as string | null,
    };
  }

  const payload = parseJobPayload(job.result);
  const payloadCorrelationId =
    typeof payload.correlationId === "string" &&
    payload.correlationId.length > 0
      ? payload.correlationId
      : null;

  return {
    payload,
    userId: job.userId,
    correlationId: job.correlationId ?? payloadCorrelationId,
    parentJobId: job.parentJobId ?? null,
  };
}

async function handleInterviewSessionOrchestration(
  callbacks: {
    updateProgress: (progress: number) => void;
    updateResult?: (result: unknown) => void;
  },
  jobId?: string,
) {
  const { payload, userId, correlationId } = await getInterviewPayload(jobId);
  const sessionId =
    typeof payload.sessionId === "string" ? payload.sessionId : null;

  if (!sessionId || !jobId || !correlationId || !userId) {
    throw new Error("Invalid orchestration job payload");
  }

  const [session] = await db
    .select()
    .from(candidateInterviewSessions)
    .where(eq(candidateInterviewSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Interview session not found: ${sessionId}`);
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < 9 * 60 * 1000) {
    const answers = await db
      .select()
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, sessionId));

    const totalAnswers = answers.length;
    if (totalAnswers === 0) {
      throw new Error("No interview answers found for orchestration");
    }

    const transcriptionCompleted = answers.filter(
      (answer) => answer.transcriptStatus === "completed",
    ).length;
    const transcriptionFailed = answers.filter(
      (answer) => answer.transcriptStatus === "failed",
    ).length;
    const evaluationCompleted = answers.filter(
      (answer) => answer.evaluationStatus === "completed",
    ).length;
    const evaluationFailed = answers.filter(
      (answer) => answer.evaluationStatus === "failed",
    ).length;

    await db
      .update(candidateInterviewSessions)
      .set({ processedCount: evaluationCompleted })
      .where(eq(candidateInterviewSessions.id, sessionId));

    const hasFailedJobs = transcriptionFailed > 0 || evaluationFailed > 0;
    const hasActiveTranscription = answers.some(
      (answer) =>
        answer.transcriptStatus === "pending" ||
        answer.transcriptStatus === "transcribing",
    );
    const hasActiveEvaluation = answers.some(
      (answer) =>
        answer.evaluationStatus === "pending" ||
        answer.evaluationStatus === "evaluating",
    );

    if (hasFailedJobs && !hasActiveTranscription && !hasActiveEvaluation) {
      await db
        .update(candidateInterviewSessions)
        .set({
          status: "failed",
          completedAt: new Date().toISOString(),
        })
        .where(eq(candidateInterviewSessions.id, sessionId));

      throw new Error("Interview processing failed for one or more answers");
    }

    if (transcriptionCompleted + transcriptionFailed === totalAnswers) {
      for (const answer of answers) {
        if (
          answer.transcriptStatus !== "completed" ||
          answer.evaluationStatus !== "pending"
        ) {
          continue;
        }

        const existingEvaluationJobId = answer.evaluationJobId;
        if (existingEvaluationJobId) {
          continue;
        }

        const evaluationJobId = `${INTERVIEW_EVALUATION_JOB}_${sessionId}_${answer.questionIndex}_${Date.now()}`;

        await db.insert(backgroundJobs).values({
          id: evaluationJobId,
          name: INTERVIEW_EVALUATION_JOB,
          status: "queued",
          correlationId,
          parentJobId: jobId,
          userId,
          maxAttempts: 2,
          maxExecutionTimeMs: 3 * 60 * 1000,
          result: {
            sessionId,
            answerId: answer.id,
            transcript: answer.transcriptedText,
            questionId: answer.questionId,
            type: "evaluation",
          },
          error: null,
          createdAt: sql`CURRENT_TIMESTAMP`,
        });

        await db
          .update(candidateInterviewAnswers)
          .set({
            evaluationJobId: evaluationJobId,
            evaluationStatus: "pending",
          })
          .where(eq(candidateInterviewAnswers.id, answer.id));

        // Trigger the evaluation job — it was inserted directly into the DB
        // so the queue won't pick it up automatically without this call.
        getJobQueue().triggerJob(evaluationJobId);
      }
    }

    const latestAnswers = await db
      .select()
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, sessionId));

    const latestEvalCompleted = latestAnswers.filter(
      (answer) => answer.evaluationStatus === "completed",
    ).length;
    const latestEvalFailed = latestAnswers.filter(
      (answer) => answer.evaluationStatus === "failed",
    ).length;

    const progress = Math.min(
      99,
      Math.round(
        (transcriptionCompleted / totalAnswers) * 50 +
          (latestEvalCompleted / totalAnswers) * 50,
      ),
    );

    callbacks.updateProgress(progress);
    callbacks.updateResult?.({
      sessionId,
      totalAnswers,
      transcriptionCompleted,
      transcriptionFailed,
      evaluationCompleted: latestEvalCompleted,
      evaluationFailed: latestEvalFailed,
    });

    if (latestEvalCompleted + latestEvalFailed === totalAnswers) {
      const [summaryJob] = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.name, INTERVIEW_SESSION_SUMMARY_JOB),
            eq(backgroundJobs.correlationId, correlationId),
          ),
        )
        .limit(1);

      if (!summaryJob) {
        const summaryJobId = `${INTERVIEW_SESSION_SUMMARY_JOB}_${sessionId}_${Date.now()}`;

        await db.insert(backgroundJobs).values({
          id: summaryJobId,
          name: INTERVIEW_SESSION_SUMMARY_JOB,
          status: "queued",
          correlationId,
          parentJobId: jobId,
          userId,
          maxAttempts: 1,
          maxExecutionTimeMs: 2 * 60 * 1000,
          result: {
            sessionId,
            correlationId,
            type: "summary",
          },
          error: null,
          createdAt: sql`CURRENT_TIMESTAMP`,
        });

        // Trigger the summary job immediately
        getJobQueue().triggerJob(summaryJobId);
      } else if (summaryJob.status === "completed") {
        callbacks.updateProgress(100);
        return {
          success: true,
          sessionId,
          totalAnswers,
          evaluationCompleted: latestEvalCompleted,
        };
      } else if (summaryJob.status === "failed") {
        throw new Error(summaryJob.error || "Summary job failed");
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
  }

  throw new Error("Orchestration timed out waiting for child jobs");
}

async function handleInterviewTranscription(
  callbacks: {
    updateProgress: (progress: number) => void;
    updateResult?: (result: unknown) => void;
  },
  jobId?: string,
) {
  const { payload } = await getInterviewPayload(jobId);

  let answerId = typeof payload.answerId === "string" ? payload.answerId : null;
  let sessionId =
    typeof payload.sessionId === "string" ? payload.sessionId : null;
  let audioStoragePath =
    typeof payload.audioStoragePath === "string"
      ? payload.audioStoragePath
      : null;
  const requestedLanguage =
    typeof payload.detectedLanguage === "string" &&
    payload.detectedLanguage.trim().length > 0
      ? payload.detectedLanguage.trim().toLowerCase()
      : undefined;

  if (!answerId && jobId) {
    const answerByJobId = await getInterviewAnswerByJobId(
      jobId,
      "transcriptJobId",
    );
    answerId = answerByJobId?.id ?? null;
    sessionId = sessionId ?? answerByJobId?.sessionId ?? null;
    audioStoragePath =
      audioStoragePath ?? answerByJobId?.audioStoragePath ?? null;
  }

  if (answerId && !audioStoragePath) {
    const [answerForAudio] = await db
      .select({
        sessionId: candidateInterviewAnswers.sessionId,
        audioStoragePath: candidateInterviewAnswers.audioStoragePath,
      })
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.id, answerId))
      .limit(1);
    sessionId = sessionId ?? answerForAudio?.sessionId ?? null;
    audioStoragePath = answerForAudio?.audioStoragePath ?? null;
  }

  if (!answerId || !sessionId || !audioStoragePath) {
    throw new Error("Invalid transcription payload");
  }

  const [answer] = await db
    .select()
    .from(candidateInterviewAnswers)
    .where(eq(candidateInterviewAnswers.id, answerId))
    .limit(1);

  if (!answer) {
    throw new Error(`Answer not found: ${answerId}`);
  }

  if (answer.transcriptStatus === "completed" && answer.transcriptedText) {
    callbacks.updateProgress(100);
    return {
      success: true,
      skipped: true,
      answerId,
      transcriptLength: answer.transcriptedText.length,
    };
  }

  await db
    .update(candidateInterviewAnswers)
    .set({ transcriptStatus: "transcribing" })
    .where(eq(candidateInterviewAnswers.id, answerId));

  callbacks.updateProgress(20);

  const startedAt = Date.now();
  const storage = getAudioStorageProvider();
  const audioBuffer = await storage.getAudio(audioStoragePath);
  const transcriptResult = await transcribeAudio(
    audioBuffer,
    answerId,
    requestedLanguage,
  );

  callbacks.updateProgress(80);

  await db
    .update(candidateInterviewAnswers)
    .set({
      transcriptStatus: "completed",
      transcriptedText: transcriptResult.text,
      transcriptProvider: transcriptResult.provider,
      transcriptDetectedLanguage: transcriptResult.language,
      transcriptConfidence: transcriptResult.confidence
        ? transcriptResult.confidence.toString()
        : null,
      transcriptRawResponse: transcriptResult.rawResponse,
      transcriptProcessingTimeMs: Date.now() - startedAt,
    })
    .where(eq(candidateInterviewAnswers.id, answerId));

  callbacks.updateProgress(100);
  callbacks.updateResult?.({
    answerId,
    transcriptLength: transcriptResult.text.length,
    language: transcriptResult.language,
  });

  return {
    success: true,
    answerId,
    transcriptLength: transcriptResult.text.length,
  };
}

async function handleInterviewEvaluation(
  callbacks: {
    updateProgress: (progress: number) => void;
    updateResult?: (result: unknown) => void;
  },
  jobId?: string,
) {
  const { payload } = await getInterviewPayload(jobId);
  const forceReevaluate = Boolean(
    payload.forceReevaluate || payload.type === "evaluation-reevaluate",
  );

  const answerId =
    typeof payload.answerId === "string" ? payload.answerId : null;
  const sessionId =
    typeof payload.sessionId === "string" ? payload.sessionId : null;

  const answerFromJob =
    !answerId && jobId
      ? await getInterviewAnswerByJobId(jobId, "evaluationJobId")
      : null;

  const resolvedAnswerId = answerId ?? answerFromJob?.id ?? null;
  const resolvedSessionId = sessionId ?? answerFromJob?.sessionId ?? null;

  if (!resolvedAnswerId || !resolvedSessionId) {
    throw new Error("Invalid evaluation payload");
  }

  const [answer] = await db
    .select()
    .from(candidateInterviewAnswers)
    .where(eq(candidateInterviewAnswers.id, resolvedAnswerId))
    .limit(1);

  if (!answer) {
    throw new Error(`Answer not found: ${resolvedAnswerId}`);
  }

  if (
    !forceReevaluate &&
    answer.evaluationStatus === "completed" &&
    answer.aiEvaluationId
  ) {
    callbacks.updateProgress(100);
    return {
      success: true,
      skipped: true,
      answerId: resolvedAnswerId,
      aiEvaluationId: answer.aiEvaluationId,
    };
  }

  if (!answer.transcriptedText) {
    throw new Error(
      `Cannot evaluate answer without transcript: ${resolvedAnswerId}`,
    );
  }

  await db
    .update(candidateInterviewAnswers)
    .set({ evaluationStatus: "evaluating" })
    .where(eq(candidateInterviewAnswers.id, resolvedAnswerId));

  callbacks.updateProgress(20);

  const [question] = await db
    .select({
      questionText: interviewQuestions.promptText,
      moduleTitle: interviewModules.name,
    })
    .from(interviewQuestions)
    .leftJoin(
      interviewModules,
      eq(interviewModules.id, interviewQuestions.moduleId),
    )
    .where(eq(interviewQuestions.id, answer.questionId))
    .limit(1);

  const standardResponseRows = await db
    .select({
      responseText: interviewQuestionStandardResponses.responseText,
      responseOrder: interviewQuestionStandardResponses.responseOrder,
    })
    .from(interviewQuestionStandardResponses)
    .where(
      eq(interviewQuestionStandardResponses.questionId, answer.questionId),
    );

  const questionText = question?.questionText ?? "Interview question";
  const standardResponses = [...standardResponseRows]
    .sort((left, right) => left.responseOrder - right.responseOrder)
    .map((item) => item.responseText)
    .filter((item) => item.trim().length > 0);
  const startedAt = Date.now();

  const evaluationResult = await evaluateAnswer(
    answer.transcriptedText,
    questionText,
    resolvedAnswerId,
    {
      moduleTitle: question?.moduleTitle ?? undefined,
      standardResponses,
    },
  );

  callbacks.updateProgress(75);

  const evaluationId = answer.aiEvaluationId ?? randomUUID();

  if (answer.aiEvaluationId) {
    await db
      .update(aiInterviewEvaluations)
      .set({
        modelUsed: evaluationResult.modelUsed,
        promptVersion: "2.0",
        evaluationJsonStructured: evaluationResult.evaluation,
        tokensUsed: evaluationResult.tokensUsed,
        processingTimeMs: Date.now() - startedAt,
      })
      .where(eq(aiInterviewEvaluations.id, answer.aiEvaluationId));
  } else {
    await db.insert(aiInterviewEvaluations).values({
      id: evaluationId,
      answerId: resolvedAnswerId,
      sessionId: resolvedSessionId,
      modelUsed: evaluationResult.modelUsed,
      promptVersion: "2.0",
      evaluationJsonStructured: evaluationResult.evaluation,
      tokensUsed: evaluationResult.tokensUsed,
      processingTimeMs: Date.now() - startedAt,
    });
  }

  await db
    .update(candidateInterviewAnswers)
    .set({
      evaluationStatus: "completed",
      aiEvaluationId: evaluationId,
    })
    .where(eq(candidateInterviewAnswers.id, resolvedAnswerId));

  callbacks.updateProgress(100);
  callbacks.updateResult?.({
    answerId: resolvedAnswerId,
    aiEvaluationId: evaluationId,
    totalScore: evaluationResult.evaluation.total_score,
  });

  return {
    success: true,
    answerId: resolvedAnswerId,
    aiEvaluationId: evaluationId,
    totalScore: evaluationResult.evaluation.total_score,
  };
}

async function handleInterviewSessionSummary(
  callbacks: {
    updateProgress: (progress: number) => void;
    updateResult?: (result: unknown) => void;
  },
  jobId?: string,
) {
  const { payload } = await getInterviewPayload(jobId);
  const sessionId =
    typeof payload.sessionId === "string" ? payload.sessionId : null;

  if (!sessionId) {
    throw new Error("Invalid summary payload");
  }

  callbacks.updateProgress(10);

  const [session] = await db
    .select()
    .from(candidateInterviewSessions)
    .where(eq(candidateInterviewSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error(`Session not found for summary: ${sessionId}`);
  }

  const aiRows = await db
    .select()
    .from(aiInterviewEvaluations)
    .where(eq(aiInterviewEvaluations.sessionId, sessionId));

  const evaluations = aiRows
    .map((row) => normalizeEvaluationValue(row.evaluationJsonStructured))
    .filter((value): value is AIEvaluationStructured => value !== null);

  if (evaluations.length === 0) {
    if (aiRows.length === 0) {
      throw new Error("No AI evaluations available for summary generation");
    }

    const fallbackSummary =
      "Session completed, but stored AI evaluations could not be normalized for aggregate summary generation. Review individual answers manually.";

    const [existingSummary] = await db
      .select({ id: interviewSessionSummaries.id })
      .from(interviewSessionSummaries)
      .where(eq(interviewSessionSummaries.sessionId, sessionId))
      .limit(1);

    if (existingSummary) {
      await db
        .update(interviewSessionSummaries)
        .set({
          overallAiScore: "0.00",
          aiStrengths: [],
          aiImprovementAreas: [],
          adminNotes: fallbackSummary,
        })
        .where(eq(interviewSessionSummaries.id, existingSummary.id));
    } else {
      await db.insert(interviewSessionSummaries).values({
        id: randomUUID(),
        sessionId,
        candidateId: session.candidateId,
        moduleId: session.moduleId,
        overallAiScore: "0.00",
        aiStrengths: [],
        aiImprovementAreas: [],
        adminNotes: fallbackSummary,
        summaryGenerationJobId: jobId ?? null,
      });
    }

    await db
      .update(candidateInterviewSessions)
      .set({
        status: "completed",
        processedCount: aiRows.length,
        completedAt: new Date().toISOString(),
      })
      .where(eq(candidateInterviewSessions.id, sessionId));

    callbacks.updateProgress(100);
    callbacks.updateResult?.({
      sessionId,
      summaryGenerated: true,
      fallback: true,
      evaluationsCount: aiRows.length,
    });

    return {
      success: true,
      sessionId,
      summaryGenerated: true,
      fallback: true,
    };
  }

  callbacks.updateProgress(50);

  const summary = await generateSessionSummary(evaluations, sessionId);
  const averageScore =
    evaluations.reduce((sum, item) => sum + item.total_score, 0) /
    evaluations.length;

  const [existingSummary] = await db
    .select({ id: interviewSessionSummaries.id })
    .from(interviewSessionSummaries)
    .where(eq(interviewSessionSummaries.sessionId, sessionId))
    .limit(1);

  if (existingSummary) {
    await db
      .update(interviewSessionSummaries)
      .set({
        overallAiScore: (averageScore * 100).toFixed(2),
        aiStrengths: summary.strengths,
        aiImprovementAreas: summary.improvementAreas,
        adminNotes: summary.summary,
      })
      .where(eq(interviewSessionSummaries.id, existingSummary.id));
  } else {
    await db.insert(interviewSessionSummaries).values({
      id: randomUUID(),
      sessionId,
      candidateId: session.candidateId,
      moduleId: session.moduleId,
      overallAiScore: (averageScore * 100).toFixed(2),
      aiStrengths: summary.strengths,
      aiImprovementAreas: summary.improvementAreas,
      adminNotes: summary.summary,
      summaryGenerationJobId: jobId ?? null,
    });
  }

  await db
    .update(candidateInterviewSessions)
    .set({
      status: "completed",
      processedCount: evaluations.length,
      completedAt: new Date().toISOString(),
    })
    .where(eq(candidateInterviewSessions.id, sessionId));

  callbacks.updateProgress(100);
  callbacks.updateResult?.({
    sessionId,
    averageScore,
    strengths: summary.strengths,
    improvementAreas: summary.improvementAreas,
  });

  return {
    success: true,
    sessionId,
    averageScore,
  };
}

async function handleInterviewAudioRetentionCleanup(callbacks: {
  updateProgress: (progress: number) => void;
  updateResult?: (result: unknown) => void;
}) {
  callbacks.updateProgress(25);
  const cleanup = await cleanupOldAudioFiles();
  callbacks.updateProgress(100);
  callbacks.updateResult?.(cleanup);
  return {
    success: true,
    ...cleanup,
  };
}

export function initializeBackgroundJobs() {
  const queue = getJobQueue();

  // Re-registering handlers is intentional. It is idempotent in-memory and it
  // re-triggers queued job resumption for jobs created after initial startup.
  queue.registerHandler(
    INTERVIEW_SESSION_ORCHESTRATION_JOB,
    handleInterviewSessionOrchestration,
  );
  queue.registerHandler(
    INTERVIEW_TRANSCRIPTION_JOB,
    handleInterviewTranscription,
  );
  queue.registerHandler(INTERVIEW_EVALUATION_JOB, handleInterviewEvaluation);
  queue.registerHandler(
    INTERVIEW_SESSION_SUMMARY_JOB,
    handleInterviewSessionSummary,
  );
  queue.registerHandler(
    INTERVIEW_AUDIO_RETENTION_CLEANUP_JOB,
    handleInterviewAudioRetentionCleanup,
  );

  if (!handlersInitialized) {
    handlersInitialized = true;
    console.log("✅ Interview background job handlers registered");
  }
}
