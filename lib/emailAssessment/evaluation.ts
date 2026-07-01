import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAiRequests as aiRequests,
  emailAssessmentAiResponses as aiResponses,
  emailAssessmentAssessments as assessments,
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentEvaluations as evaluations,
  emailAssessmentPromptVersions as promptVersions,
  emailAssessmentRubrics as rubrics,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import {
  calculateCopyPenalty,
  evaluationJsonSchema,
  normalizeEvaluation,
} from "@/lib/emailAssessment/rubric";

const MAX_EVALUATION_ATTEMPTS = 2;

const AI_DETECTION_INSTRUCTIONS = `AI DETECTION INSTRUCTIONS:
You MUST set "aiDetected" to true if the candidate's response exhibits any of the following characteristics of AI-generated text:
- Overly formal, generic, or templated language with no natural variation
- Suspiciously perfect grammar and sentence structure throughout
- Repeated use of filler phrases like "I hope this email finds you well", "Please do not hesitate", "I trust this message", "looking forward to hearing from you" in formulaic combinations
- Lack of specific, concrete details that a human with genuine understanding would typically include
- Unnaturally balanced paragraph lengths and a textbook-style structure that feels robotic
- Absence of any personal voice, imperfections, or minor stylistic quirks typical of human writing
Set "aiDetected" to false if the response reads naturally and shows genuine human understanding of the scenario.`;

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown evaluation error";
}

function estimateCostUsdCents(inputTokens?: number | null, outputTokens?: number | null) {
  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_1M_TOKENS_CENTS);
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_1M_TOKENS_CENTS);

  if (!inputTokens || !outputTokens || !inputRate || !outputRate) {
    return null;
  }

  return Math.round((inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate);
}

async function getActivePrompt() {
  const [record] = await db
    .select({
      promptVersion: promptVersions,
      rubric: rubrics,
    })
    .from(promptVersions)
    .innerJoin(rubrics, eq(promptVersions.rubricId, rubrics.id))
    .where(and(eq(promptVersions.active, true), eq(rubrics.active, true)))
    .orderBy(desc(promptVersions.createdAt))
    .limit(1);

  if (!record) {
    throw new Error("No active prompt version and rubric found.");
  }

  return record;
}

async function markEvaluationStatus(
  submissionId: string,
  status: "pending_retry" | "failed_validation" | "failed"
) {
  await db
    .insert(evaluations)
    .values({ id: randomUUID(), submissionId, status })
    .onDuplicateKeyUpdate({
      set: {
        status,
        updatedAt: new Date(),
      },
    });
}

export async function evaluateSubmission(submissionId: string) {
  const [submissionContext] = await db
    .select({
      submissionId: submissions.id,
      assessmentId: submissions.assessmentId,
      candidateId: submissions.candidateId,
      subject: submissions.subject,
      content: submissions.content,
      difficulty: scenarios.difficulty,
      scenarioTitle: scenarios.title,
      scenarioPrompt: scenarios.prompt,
      scoringNotes: scenarios.scoringNotes,
      modelAnswer: scenarios.modelAnswer,
    })
    .from(submissions)
    .innerJoin(scenarios, eq(submissions.scenarioId, scenarios.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submissionContext) {
    throw new Error("Submission not found.");
  }

  const { promptVersion, rubric } = await getActivePrompt();
  // The active prompt version stores a preferred model; AI_FAST_MODEL / the
  // explicit OPENAI_EVALUATION_MODEL override it to match WMS conventions.
  const model =
    process.env.OPENAI_EVALUATION_MODEL ?? process.env.AI_FAST_MODEL ?? promptVersion.model;
  const requestPayload = {
    model,
    scenario: {
      title: submissionContext.scenarioTitle,
      prompt: submissionContext.scenarioPrompt,
      scoringNotes: submissionContext.scoringNotes,
    },
    rubric: rubric.weights,
    candidateResponse: submissionContext.content,
  };

  if (!process.env.OPENAI_API_KEY) {
    await markEvaluationStatus(submissionId, "pending_retry");
    await db.insert(aiRequests).values({
      id: randomUUID(),
      submissionId,
      promptVersionId: promptVersion.id,
      model,
      status: "failed",
      requestPayload,
      errorMessage: "OPENAI_API_KEY is not configured.",
    });

    return { status: "pending_retry" as const };
  }

  const candidateSubject = submissionContext.subject ?? "(no subject line provided)";

  const systemPrompt = `${promptVersion.systemPrompt}\n\n${AI_DETECTION_INSTRUCTIONS}`;
  const userPrompt = `${promptVersion.evaluationPrompt}

Scenario Title:
${submissionContext.scenarioTitle}

Scenario Prompt:
${submissionContext.scenarioPrompt}

Scenario Difficulty: ${submissionContext.difficulty}
Scenario Scoring Notes:
${submissionContext.scoringNotes ?? "None provided."}

Candidate Email Subject:
${candidateSubject}

Candidate Email Body:
${submissionContext.content}`;

  for (let attempt = 1; attempt <= MAX_EVALUATION_ATTEMPTS; attempt += 1) {
    const aiRequestId = randomUUID();

    await db.insert(aiRequests).values({
      id: aiRequestId,
      submissionId,
      promptVersionId: promptVersion.id,
      model,
      status: "pending",
      requestPayload: {
        ...requestPayload,
        attempt,
      },
    });

    try {
      const result = await generateObject({
        model: openai(model),
        schema: evaluationJsonSchema,
        schemaName: "email_assessment_evaluation",
        temperature: 0.1,
        system: systemPrompt,
        prompt: userPrompt,
      });

      // generateObject already validates against the Zod schema, so result.object
      // is well-formed. Persist the raw provider response for auditing.
      const rawResponse = JSON.parse(JSON.stringify(result.response ?? {}));

      await db.insert(aiResponses).values({
        id: randomUUID(),
        aiRequestId,
        rawResponse,
        validationErrors: null,
      });

      const normalized = normalizeEvaluation(result.object);
      const inputTokens = result.usage?.inputTokens ?? null;
      const outputTokens = result.usage?.outputTokens ?? null;
      const evaluationId = randomUUID();

      // Calculate plagiarism/copy penalty against model answer
      const copyPenaltyAmount = calculateCopyPenalty(
        submissionContext.content,
        submissionContext.modelAnswer
      );

      // Save copy penalty to the submission record
      if (copyPenaltyAmount > 0) {
        await db
          .update(submissions)
          .set({ copyPenalty: Math.round(copyPenaltyAmount * 100) }) // stored as integer cents (x100)
          .where(eq(submissions.id, submissionId));
      }

      await db
        .insert(evaluations)
        .values({
          id: evaluationId,
          submissionId,
          promptVersionId: promptVersion.id,
          rubricId: rubric.id,
          status: "completed",
          overallScore: normalized.overallScore,
          grade: normalized.grade,
          categoryScores: normalized.categoryScores,
          strengths: normalized.strengths,
          weaknesses: normalized.weaknesses,
          improvements: normalized.improvements,
          detailedFeedback: normalized.detailedFeedback,
          verdict: normalized.verdict,
          aiDetected: normalized.aiDetected,
        })
        .onDuplicateKeyUpdate({
          set: {
            promptVersionId: promptVersion.id,
            rubricId: rubric.id,
            status: "completed",
            overallScore: normalized.overallScore,
            grade: normalized.grade,
            categoryScores: normalized.categoryScores,
            strengths: normalized.strengths,
            weaknesses: normalized.weaknesses,
            improvements: normalized.improvements,
            detailedFeedback: normalized.detailedFeedback,
            verdict: normalized.verdict,
            aiDetected: normalized.aiDetected,
            updatedAt: new Date(),
          },
        });

      await db
        .update(aiRequests)
        .set({
          status: "completed",
          inputTokens,
          outputTokens,
          costUsdCents: estimateCostUsdCents(inputTokens, outputTokens),
          completedAt: new Date(),
        })
        .where(eq(aiRequests.id, aiRequestId));

      await db
        .update(assessments)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(assessments.id, submissionContext.assessmentId));

      await db.insert(auditLogs).values({
        id: randomUUID(),
        actorId: submissionContext.candidateId,
        action: "evaluation_completed",
        entityType: "submission",
        entityId: submissionId,
        metadata: {
          evaluationId,
          promptVersionId: promptVersion.id,
          model,
          aiDetected: normalized.aiDetected,
          copyPenalty: copyPenaltyAmount,
        },
        ipAddress: null,
      });

      return { status: "completed" as const, evaluation: normalized };
    } catch (error) {
      await db
        .update(aiRequests)
        .set({
          status: attempt === MAX_EVALUATION_ATTEMPTS ? "failed" : "retrying",
          errorMessage: safeErrorMessage(error),
          completedAt: new Date(),
        })
        .where(eq(aiRequests.id, aiRequestId));

      if (attempt === MAX_EVALUATION_ATTEMPTS) {
        await markEvaluationStatus(submissionId, "pending_retry");
        return { status: "pending_retry" as const };
      }
    }
  }

  await markEvaluationStatus(submissionId, "failed");
  return { status: "failed" as const };
}
