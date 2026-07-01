import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  adminInterviewEvaluations,
  aiInterviewEvaluations,
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewModules,
  interviewQuestions,
  interviewQuestionStandardResponses,
  interviewSessionSummaries,
} from "@/DB/interviewSchema";
import { users } from "@/DB/schema";
import {
  averageDimensionMaps,
  averageTotalScores,
  calculateWeightedTotalScore,
  EVALUATION_DIMENSION_ORDER,
  mergeDimensionMaps,
  normalizeDimensionMap,
  normalizeTotalScore,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

type AiStructuredEvaluation = {
  total_score?: number;
  dimensions?: Record<string, { score?: number }>;
  strengths?: string[] | string;
  improvement_areas?: string[] | string;
  final_summary?: string;
};

const adminRoles = new Set(["devAdmin", "adminTeam", "executive"]);

function hasCompleteDimensionScores(
  dimensions: ReturnType<typeof normalizeDimensionMap>,
) {
  return EVALUATION_DIMENSION_ORDER.every(
    (key) => typeof dimensions[key]?.score === "number",
  );
}

function normalizeTextList(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned.join("; ") : undefined;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function parseUnknownObject<T>(value: unknown): T | undefined {
  if (typeof value === "string") {
    try {
      return parseUnknownObject<T>(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as T;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!adminRoles.has(session.user.role ?? "user")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const sessionRows = await db
      .select({
        id: candidateInterviewSessions.id,
        candidateId: candidateInterviewSessions.candidateId,
        moduleId: candidateInterviewSessions.moduleId,
        totalQuestions: candidateInterviewSessions.totalQuestions,
        status: candidateInterviewSessions.status,
        createdAt: candidateInterviewSessions.createdAt,
        moduleName: interviewModules.name,
      })
      .from(candidateInterviewSessions)
      .leftJoin(
        interviewModules,
        eq(interviewModules.id, candidateInterviewSessions.moduleId),
      )
      .where(
        inArray(candidateInterviewSessions.status, [
          "recorded",
          "processing",
          "completed",
          "failed",
        ]),
      )
      .orderBy(desc(candidateInterviewSessions.createdAt));

    if (sessionRows.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const sessionIds = sessionRows.map((row) => row.id);
    const candidateIds = Array.from(
      new Set(sessionRows.map((row) => row.candidateId).filter(Boolean)),
    );

    let userRows: Array<{ id: string; name: string | null }> = [];
    try {
      userRows =
        candidateIds.length > 0
          ? await db
              .select({ id: users.id, name: users.name })
              .from(users)
              .where(inArray(users.id, candidateIds))
          : [];
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to resolve candidate names",
        error,
      );
    }

    const candidateNameById = new Map(
      userRows.map((user) => [user.id, user.name]),
    );

    let answerRows: Array<{
      id: string;
      sessionId: string;
      questionId: string;
      questionIndex: number;
      audioPath: string;
      transcript: string | null;
      transcriptStatus: string;
      evaluationStatus: string;
      aiEvaluationId: string | null;
      adminEvaluationId: string | null;
    }> = [];

    try {
      answerRows = await db
        .select({
          id: candidateInterviewAnswers.id,
          sessionId: candidateInterviewAnswers.sessionId,
          questionId: candidateInterviewAnswers.questionId,
          questionIndex: candidateInterviewAnswers.questionIndex,
          audioPath: candidateInterviewAnswers.audioStoragePath,
          transcript: candidateInterviewAnswers.transcriptedText,
          transcriptStatus: candidateInterviewAnswers.transcriptStatus,
          evaluationStatus: candidateInterviewAnswers.evaluationStatus,
          aiEvaluationId: candidateInterviewAnswers.aiEvaluationId,
          adminEvaluationId: candidateInterviewAnswers.adminEvaluationId,
        })
        .from(candidateInterviewAnswers)
        .where(inArray(candidateInterviewAnswers.sessionId, sessionIds));
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load answer enrichment, returning sessions only",
        error,
      );
    }

    const questionIds = Array.from(
      new Set(answerRows.map((a) => a.questionId)),
    );
    const aiEvaluationIds = Array.from(
      new Set(
        answerRows
          .map((a) => a.aiEvaluationId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const adminEvaluationIds = Array.from(
      new Set(
        answerRows
          .map((a) => a.adminEvaluationId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let questionRows: Array<{
      id: string;
      promptText: string;
      promptAudioPath: string | null;
    }> = [];
    let standardResponseRows: Array<{
      questionId: string;
      responseText: string;
      responseOrder: number;
    }> = [];
    let aiRows: Array<{
      id: string;
      evaluationJsonStructured: unknown;
    }> = [];
    let adminRows: Array<{
      id: string;
      totalScoreOverride: number;
      dimensionOverrides: unknown;
      comparisonToAi: unknown;
      adminNotes: string | null;
    }> = [];
    let summaryRows: Array<{
      sessionId: string;
      overallAiScore: unknown;
      overallAdminScore: unknown;
      aiStrengths: unknown;
      aiImprovementAreas: unknown;
      adminOverallNotes: string | null;
    }> = [];

    try {
      questionRows =
        questionIds.length > 0
          ? await db
              .select({
                id: interviewQuestions.id,
                promptText: interviewQuestions.promptText,
                promptAudioPath: interviewQuestions.promptAudioPath,
              })
              .from(interviewQuestions)
              .where(inArray(interviewQuestions.id, questionIds))
          : [];
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load question labels",
        error,
      );
    }

    try {
      standardResponseRows =
        questionIds.length > 0
          ? await db
              .select({
                questionId: interviewQuestionStandardResponses.questionId,
                responseText: interviewQuestionStandardResponses.responseText,
                responseOrder: interviewQuestionStandardResponses.responseOrder,
              })
              .from(interviewQuestionStandardResponses)
              .where(
                inArray(
                  interviewQuestionStandardResponses.questionId,
                  questionIds,
                ),
              )
          : [];
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load standard responses",
        error,
      );
    }

    try {
      aiRows =
        aiEvaluationIds.length > 0
          ? await db
              .select({
                id: aiInterviewEvaluations.id,
                evaluationJsonStructured:
                  aiInterviewEvaluations.evaluationJsonStructured,
              })
              .from(aiInterviewEvaluations)
              .where(inArray(aiInterviewEvaluations.id, aiEvaluationIds))
          : [];
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load AI evaluations",
        error,
      );
    }

    try {
      adminRows =
        adminEvaluationIds.length > 0
          ? await db
              .select({
                id: adminInterviewEvaluations.id,
                totalScoreOverride:
                  adminInterviewEvaluations.totalScoreOverride,
                dimensionOverrides:
                  adminInterviewEvaluations.dimensionOverrides,
                comparisonToAi: adminInterviewEvaluations.comparisonToAi,
                adminNotes: adminInterviewEvaluations.adminNotes,
              })
              .from(adminInterviewEvaluations)
              .where(inArray(adminInterviewEvaluations.id, adminEvaluationIds))
          : [];
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load admin evaluations",
        error,
      );
    }

    try {
      summaryRows = await db
        .select({
          sessionId: interviewSessionSummaries.sessionId,
          overallAiScore: interviewSessionSummaries.overallAiScore,
          overallAdminScore: interviewSessionSummaries.overallAdminScore,
          aiStrengths: interviewSessionSummaries.aiStrengths,
          aiImprovementAreas: interviewSessionSummaries.aiImprovementAreas,
          adminOverallNotes: interviewSessionSummaries.adminNotes,
        })
        .from(interviewSessionSummaries)
        .where(inArray(interviewSessionSummaries.sessionId, sessionIds));
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load session summaries",
        error,
      );
    }

    const questionById = new Map(questionRows.map((row) => [row.id, row]));
    const responsesByQuestionId = new Map<string, string[]>();
    const sortedStandardResponses = [...standardResponseRows].sort(
      (a, b) => a.responseOrder - b.responseOrder,
    );

    for (const item of sortedStandardResponses) {
      const existing = responsesByQuestionId.get(item.questionId) ?? [];
      existing.push(item.responseText);
      responsesByQuestionId.set(item.questionId, existing);
    }
    const aiById = new Map(aiRows.map((row) => [row.id, row]));
    const adminById = new Map(adminRows.map((row) => [row.id, row]));
    const summaryBySessionId = new Map(
      summaryRows.map((row) => [row.sessionId, row]),
    );

    const answersBySessionId = new Map<string, typeof answerRows>();
    for (const answer of answerRows) {
      const existing = answersBySessionId.get(answer.sessionId) ?? [];
      existing.push(answer);
      answersBySessionId.set(answer.sessionId, existing);
    }

    const payload = sessionRows.map((row) => {
      const sessionAnswers = (answersBySessionId.get(row.id) ?? [])
        .sort((a, b) => a.questionIndex - b.questionIndex)
        .map((answer) => {
          const question = questionById.get(answer.questionId);
          const ai = answer.aiEvaluationId
            ? aiById.get(answer.aiEvaluationId)
            : undefined;
          const admin = answer.adminEvaluationId
            ? adminById.get(answer.adminEvaluationId)
            : undefined;

          const aiStructured =
            parseUnknownObject<AiStructuredEvaluation>(
              ai?.evaluationJsonStructured,
            ) ?? {};
          const aiDimensions = normalizeDimensionMap(aiStructured.dimensions);
          const adminOverrides = normalizeDimensionMap(
            admin?.dimensionOverrides,
          );
          const mergedAdminDimensions = mergeDimensionMaps(
            aiDimensions,
            adminOverrides,
          );
          const computedAiTotal = calculateWeightedTotalScore(aiDimensions);
          const modelAiTotal = normalizeTotalScore(aiStructured.total_score);
          const aiTotalScore = hasCompleteDimensionScores(aiDimensions)
            ? (computedAiTotal ?? modelAiTotal ?? 0)
            : (modelAiTotal ?? computedAiTotal ?? 0);
          const adminTotalScore = admin
            ? (normalizeTotalScore(admin.totalScoreOverride) ??
              calculateWeightedTotalScore(mergedAdminDimensions) ??
              aiTotalScore)
            : undefined;

          return {
            id: answer.id,
            questionText: question?.promptText ?? "Question",
            questionAudioPath: question?.promptAudioPath ?? undefined,
            standardResponses:
              responsesByQuestionId.get(answer.questionId) ?? [],
            audioPath: answer.audioPath ?? undefined,
            transcript: answer.transcript ?? undefined,
            transcriptStatus: answer.transcriptStatus,
            evaluationStatus: answer.evaluationStatus,
            aiEvaluation: ai
              ? {
                  total_score: totalScoreToPercentage(aiTotalScore),
                  dimensions: aiDimensions,
                  strengths: normalizeTextList(aiStructured.strengths),
                  improvementAreas: normalizeTextList(
                    aiStructured.improvement_areas,
                  ),
                  finalSummary:
                    typeof aiStructured.final_summary === "string"
                      ? aiStructured.final_summary
                      : undefined,
                }
              : undefined,
            adminEvaluation: admin
              ? {
                  total_score: totalScoreToPercentage(adminTotalScore),
                  dimensions: mergedAdminDimensions,
                  dimensionOverrides: adminOverrides,
                  comparisonToAi: parseUnknownObject(admin.comparisonToAi),
                  adminNotes: admin.adminNotes ?? undefined,
                }
              : undefined,
            adminScore: adminTotalScore,
            adminNotes: admin?.adminNotes ?? undefined,
          };
        });

      const summary = summaryBySessionId.get(row.id);
      const aiDimensionAverages = averageDimensionMaps(
        sessionAnswers
          .map((answer) => answer.aiEvaluation?.dimensions)
          .filter(
            (
              value,
            ): value is NonNullable<
              (typeof sessionAnswers)[number]["aiEvaluation"]
            >["dimensions"] => Boolean(value),
          ),
      );
      const adminDimensionAverages = averageDimensionMaps(
        sessionAnswers
          .map((answer) => answer.adminEvaluation?.dimensions)
          .filter(
            (
              value,
            ): value is NonNullable<
              (typeof sessionAnswers)[number]["adminEvaluation"]
            >["dimensions"] => Boolean(value),
          ),
      );
      const overallAiScore = averageTotalScores(
        sessionAnswers.map((answer) => answer.aiEvaluation?.total_score),
      );
      const overallAdminScore = averageTotalScores(
        sessionAnswers.map(
          (answer) =>
            answer.adminEvaluation?.total_score ??
            answer.aiEvaluation?.total_score,
        ),
      );

      return {
        id: row.id,
        candidateName: candidateNameById.get(row.candidateId) ?? undefined,
        candidateId: row.candidateId,
        moduleName: row.moduleName ?? "Unknown Module",
        moduleId: row.moduleId,
        totalQuestions: row.totalQuestions,
        status: row.status,
        createdAt: row.createdAt,
        answers: sessionAnswers,
        evaluation: summary
          ? {
              overallAiScore:
                totalScoreToPercentage(overallAiScore) ??
                toNumberOrUndefined(summary.overallAiScore) ??
                0,
              overallAdminScore:
                totalScoreToPercentage(overallAdminScore) ??
                toNumberOrUndefined(summary.overallAdminScore) ??
                undefined,
              aiStrengths: normalizeTextList(summary.aiStrengths),
              aiImprovementAreas: normalizeTextList(summary.aiImprovementAreas),
              adminOverallNotes: summary.adminOverallNotes ?? undefined,
              aiDimensions: aiDimensionAverages,
              finalDimensions: adminDimensionAverages,
            }
          : {
              overallAiScore: totalScoreToPercentage(overallAiScore) ?? 0,
              overallAdminScore: totalScoreToPercentage(overallAdminScore),
              aiDimensions: aiDimensionAverages,
              finalDimensions: adminDimensionAverages,
            },
      };
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/admin/sessions failed", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 },
    );
  }
}
