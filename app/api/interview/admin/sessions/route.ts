import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { isAdminRole, type Role } from "@/lib/rbac";
import {
  adminInterviewEvaluations,
  aiInterviewEvaluations,
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewDeliveryMetrics,
  interviewFollowupQuestions,
  interviewModules,
  interviewQuestionBank,
  interviewQuestionStandardResponses,
  interviewSessionSummaries,
} from "@/DB/interviewSchema";
import { users } from "@/DB/schema";
import {
  averageDimensionMaps,
  averageTotalScores,
  calculateWeightedTotalScore,
  DEFAULT_DIMENSION_SET,
  DIMENSION_SETS,
  type DimensionSetName,
  mergeDimensionMaps,
  normalizeDimensionMap,
  normalizeTotalScore,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import { getDimensionSet } from "@/lib/interview/moduleCapabilities";
import { getSessionProcessingStatus } from "@/lib/interview/orchestration";
import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

type AiStructuredEvaluation = {
  total_score?: number;
  dimensions?: Record<string, { score?: number }>;
  // Which of the two fixed dimension sets `dimensions` uses (see
  // evaluationMetrics.ts). Absent on rows written before this concept
  // existed — every reader below falls back to "customer-service", the
  // only shape that ever existed before now.
  dimensionSet?: DimensionSetName;
  strengths?: string[] | string;
  improvement_areas?: string[] | string;
  final_summary?: string;
};


function hasCompleteDimensionScores(
  dimensions: ReturnType<typeof normalizeDimensionMap>,
  dimensionSet: DimensionSetName = DEFAULT_DIMENSION_SET,
) {
  return DIMENSION_SETS[dimensionSet].every(
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

  if (!isAdminRole(session.user.role as Role | undefined)) {
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

    // Self-heal any session still shown as "processing" whose background
    // work has actually died (e.g. a job crashed before its handler ever
    // ran, so the answer rows were never updated to reflect it — see
    // getSessionProcessingStatus's own comments). That function already
    // detects this and corrects the stored status as a side effect; this
    // route only ever read the stored column directly, so without calling
    // it here a dead session would show "processing" indefinitely on this
    // admin page even though the candidate's own processing page (which
    // does poll getSessionProcessingStatus via SSE) would have already
    // shown it as failed.
    const processingSessionIds = sessionRows
      .filter((row) => row.status === "processing")
      .map((row) => row.id);
    if (processingSessionIds.length > 0) {
      const correctedStatusById = new Map<string, string>();
      await Promise.all(
        processingSessionIds.map(async (id) => {
          try {
            const result = await getSessionProcessingStatus(id);
            correctedStatusById.set(id, result.status);
          } catch {
            // Leave the stored status as-is if the check itself fails
            // (e.g. no orchestration job row at all yet) — not this
            // route's job to diagnose further, just to avoid crashing the
            // whole session list over one session's stale state.
          }
        }),
      );
      for (const row of sessionRows) {
        const corrected = correctedStatusById.get(row.id);
        if (corrected === "failed" || corrected === "completed") {
          row.status = corrected;
        }
      }
    }

    // Per-module default dimensionSet (courtesy/empathy/... vs
    // correctness/relevance/...), resolved from the capability registry.
    // Used whenever a stored evaluation has no dimensionSet stamped on it
    // yet (rows written before this concept existed) — and critically, for
    // sessions/answers that haven't been evaluated at all (still
    // "processing"), where there's no evaluation payload to read a
    // dimensionSet from in the first place. Without this, those cases
    // silently fell back to the hardcoded DEFAULT_DIMENSION_SET
    // ("customer-service"), showing Interview Coach sessions with
    // Courtesy/Empathy/... labels before their first evaluation completed.
    const uniqueModuleIds = Array.from(
      new Set(sessionRows.map((row) => row.moduleId).filter(Boolean)),
    );
    const moduleDimensionSetEntries = await Promise.all(
      uniqueModuleIds.map(
        async (moduleId) =>
          [moduleId, await getDimensionSet(moduleId)] as const,
      ),
    );
    const dimensionSetByModuleId = new Map(moduleDimensionSetEntries);

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
      isFollowUp: boolean;
      followUpOfAnswerId: string | null;
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
          isFollowUp: candidateInterviewAnswers.isFollowUp,
          followUpOfAnswerId: candidateInterviewAnswers.followUpOfAnswerId,
        })
        .from(candidateInterviewAnswers)
        .where(inArray(candidateInterviewAnswers.sessionId, sessionIds));
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load answer enrichment, returning sessions only",
        error,
      );
    }

    // Delivery/acoustic scoring (Interview Coach only — Customer Cetricity
    // answers will never have a row here, which is correct, not a gap).
    // Keyed by answerId so it can be attached per-answer below without a
    // second join in the per-session mapping loop.
    let deliveryMetricsRows: Array<{
      answerId: string;
      wpm: string | null;
      pauseCount: number | null;
      totalPauseS: string | null;
      longestPauseS: string | null;
      pauseRatio: string | null;
      fillerCount: number | null;
      fillersPerMin: string | null;
      pitchMeanHz: string | null;
      pitchDynamismSt: string | null;
      pitchRangeSt: string | null;
      loudnessDbMean: string | null;
      loudnessVariationDb: string | null;
      deliveryScores: unknown;
      deliveryOverall: string | null;
      calibrationMode: string;
    }> = [];

    try {
      const answerIds = answerRows.map((a) => a.id);
      deliveryMetricsRows =
        answerIds.length > 0
          ? await db
              .select({
                answerId: interviewDeliveryMetrics.answerId,
                wpm: interviewDeliveryMetrics.wpm,
                pauseCount: interviewDeliveryMetrics.pauseCount,
                totalPauseS: interviewDeliveryMetrics.totalPauseS,
                longestPauseS: interviewDeliveryMetrics.longestPauseS,
                pauseRatio: interviewDeliveryMetrics.pauseRatio,
                fillerCount: interviewDeliveryMetrics.fillerCount,
                fillersPerMin: interviewDeliveryMetrics.fillersPerMin,
                pitchMeanHz: interviewDeliveryMetrics.pitchMeanHz,
                pitchDynamismSt: interviewDeliveryMetrics.pitchDynamismSt,
                pitchRangeSt: interviewDeliveryMetrics.pitchRangeSt,
                loudnessDbMean: interviewDeliveryMetrics.loudnessDbMean,
                loudnessVariationDb:
                  interviewDeliveryMetrics.loudnessVariationDb,
                deliveryScores: interviewDeliveryMetrics.deliveryScores,
                deliveryOverall: interviewDeliveryMetrics.deliveryOverall,
                calibrationMode: interviewDeliveryMetrics.calibrationMode,
              })
              .from(interviewDeliveryMetrics)
              .where(inArray(interviewDeliveryMetrics.answerId, answerIds))
          : [];
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load delivery metrics",
        error,
      );
    }

    // Adaptive follow-up questions (Interview Coach only). Grouped by
    // sessionId so each session's payload can carry its own follow-up list.
    let followUpRows: Array<{
      id: string;
      sessionId: string;
      parentAnswerId: string;
      questionText: string;
      status: string;
    }> = [];

    try {
      followUpRows = await db
        .select({
          id: interviewFollowupQuestions.id,
          sessionId: interviewFollowupQuestions.sessionId,
          parentAnswerId: interviewFollowupQuestions.parentAnswerId,
          questionText: interviewFollowupQuestions.questionText,
          status: interviewFollowupQuestions.status,
        })
        .from(interviewFollowupQuestions)
        .where(inArray(interviewFollowupQuestions.sessionId, sessionIds));
    } catch (error) {
      console.warn(
        "GET /api/interview/admin/sessions: failed to load follow-up questions",
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
                id: interviewQuestionBank.id,
                promptText: interviewQuestionBank.promptText,
                promptAudioPath: interviewQuestionBank.promptAudioPath,
              })
              .from(interviewQuestionBank)
              .where(inArray(interviewQuestionBank.id, questionIds))
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
    const deliveryMetricsByAnswerId = new Map(
      deliveryMetricsRows.map((row) => [row.answerId, row]),
    );
    const followUpsBySessionId = new Map<string, typeof followUpRows>();
    for (const followUp of followUpRows) {
      const existing = followUpsBySessionId.get(followUp.sessionId) ?? [];
      existing.push(followUp);
      followUpsBySessionId.set(followUp.sessionId, existing);
    }

    const answersBySessionId = new Map<string, typeof answerRows>();
    for (const answer of answerRows) {
      const existing = answersBySessionId.get(answer.sessionId) ?? [];
      existing.push(answer);
      answersBySessionId.set(answer.sessionId, existing);
    }

    const payload = sessionRows.map((row) => {
      const moduleDefaultDimensionSet =
        dimensionSetByModuleId.get(row.moduleId) ?? DEFAULT_DIMENSION_SET;
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
          const dimensionSet: DimensionSetName =
            aiStructured.dimensionSet ?? moduleDefaultDimensionSet;
          const aiDimensions = normalizeDimensionMap(
            aiStructured.dimensions,
            dimensionSet,
          );
          const adminOverrides = normalizeDimensionMap(
            admin?.dimensionOverrides,
            dimensionSet,
          );
          const mergedAdminDimensions = mergeDimensionMaps(
            aiDimensions,
            adminOverrides,
            dimensionSet,
          );
          const computedAiTotal = calculateWeightedTotalScore(
            aiDimensions,
            dimensionSet,
          );
          const modelAiTotal = normalizeTotalScore(aiStructured.total_score);
          const aiTotalScore = hasCompleteDimensionScores(
            aiDimensions,
            dimensionSet,
          )
            ? (computedAiTotal ?? modelAiTotal ?? 0)
            : (modelAiTotal ?? computedAiTotal ?? 0);
          const adminTotalScore = admin
            ? (normalizeTotalScore(admin.totalScoreOverride) ??
              calculateWeightedTotalScore(mergedAdminDimensions, dimensionSet) ??
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
                  dimensionSet,
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
            isFollowUp: answer.isFollowUp,
            followUpOfAnswerId: answer.followUpOfAnswerId ?? undefined,
            deliveryMetrics: (() => {
              const metrics = deliveryMetricsByAnswerId.get(answer.id);
              if (!metrics) return undefined;
              const scores = parseUnknownObject<{
                pace?: number;
                pausing?: number;
                fluency?: number;
                expressiveness?: number;
              }>(metrics.deliveryScores);
              return {
                scores: scores ?? {},
                overall: toNumberOrUndefined(metrics.deliveryOverall),
                calibrationMode: metrics.calibrationMode,
                wpm: toNumberOrUndefined(metrics.wpm),
                pauseCount: metrics.pauseCount ?? undefined,
                totalPauseS: toNumberOrUndefined(metrics.totalPauseS),
                longestPauseS: toNumberOrUndefined(metrics.longestPauseS),
                pauseRatio: toNumberOrUndefined(metrics.pauseRatio),
                fillerCount: metrics.fillerCount ?? undefined,
                fillersPerMin: toNumberOrUndefined(metrics.fillersPerMin),
                pitchMeanHz: toNumberOrUndefined(metrics.pitchMeanHz),
                pitchDynamismSt: toNumberOrUndefined(metrics.pitchDynamismSt),
                pitchRangeSt: toNumberOrUndefined(metrics.pitchRangeSt),
                loudnessDbMean: toNumberOrUndefined(metrics.loudnessDbMean),
                loudnessVariationDb: toNumberOrUndefined(
                  metrics.loudnessVariationDb,
                ),
              };
            })(),
          };
        });

      const summary = summaryBySessionId.get(row.id);
      // All answers in one session belong to the same module, so they all
      // share the same dimensionSet — derive it from the first answer that
      // has one rather than assuming DEFAULT_DIMENSION_SET, so a session's
      // averaged dimension grid uses the right key set even if the session
      // summary row itself predates this concept.
      const sessionDimensionSet: DimensionSetName =
        sessionAnswers.find((answer) => answer.aiEvaluation?.dimensionSet)
          ?.aiEvaluation?.dimensionSet ?? moduleDefaultDimensionSet;
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
        sessionDimensionSet,
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
        sessionDimensionSet,
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
        followUps: followUpsBySessionId.get(row.id) ?? undefined,
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
              dimensionSet: sessionDimensionSet,
            }
          : {
              overallAiScore: totalScoreToPercentage(overallAiScore) ?? 0,
              overallAdminScore: totalScoreToPercentage(overallAdminScore),
              aiDimensions: aiDimensionAverages,
              finalDimensions: adminDimensionAverages,
              dimensionSet: sessionDimensionSet,
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
