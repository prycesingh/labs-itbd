import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  aiInterviewEvaluations,
  adminInterviewEvaluations,
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewDeliveryMetrics,
  interviewModules,
  interviewQuestionBank,
  interviewSessionSummaries,
} from "@/DB/interviewSchema";
import { users } from "@/DB/schema";
import {
  averageDimensionMaps,
  averageTotalScores,
  calculateWeightedTotalScore,
  DEFAULT_DIMENSION_SET,
  DIMENSION_SETS,
  mergeDimensionMaps,
  normalizeDimensionMap,
  normalizeTotalScore,
  totalScoreToPercentage,
  type DimensionScoreMap,
  type DimensionSetName,
} from "@/lib/interview/evaluationMetrics";
import { renderResultsPdf, type ResultsPdfAnswer } from "@/lib/interview/resultsPdf";
import { isAdminRole, type Role } from "@/lib/rbac";
import { asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const paramsSchema = z.object({ sessionId: z.string().uuid() });

function hasCompleteDimensionScores(
  dimensions: DimensionScoreMap,
  dimensionSet: DimensionSetName = DEFAULT_DIMENSION_SET,
) {
  return DIMENSION_SETS[dimensionSet].every(
    (key) => typeof dimensions[key]?.score === "number",
  );
}

function parseAiStructured(
  value: unknown,
): {
  total_score?: number;
  dimensions?: unknown;
  dimensionSet?: DimensionSetName;
  final_summary?: string;
} | null {
  if (typeof value === "string") {
    try {
      return parseAiStructured(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return value as {
    total_score?: number;
    dimensions?: unknown;
    dimensionSet?: DimensionSetName;
    final_summary?: string;
  };
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        );
      }
    } catch {
      // fall through
    }
    return trimmed
      .split(/;|\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }
  const { sessionId } = parsed.data;

  try {
    const [sessionRow] = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isAdmin = isAdminRole(session.user.role as Role | undefined);
    if (!isAdmin && sessionRow.candidateId !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied: cannot export another user's results" },
        { status: 403 },
      );
    }

    const [candidate] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, sessionRow.candidateId))
      .limit(1);

    const [module] = await db
      .select({ name: interviewModules.name })
      .from(interviewModules)
      .where(eq(interviewModules.id, sessionRow.moduleId))
      .limit(1);

    const answers = await db
      .select()
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, sessionId))
      .orderBy(asc(candidateInterviewAnswers.questionIndex));

    const questionIds = answers.map((answer) => answer.questionId);
    const aiEvalIds = answers
      .map((answer) => answer.aiEvaluationId)
      .filter((id): id is string => Boolean(id));
    const adminEvalIds = answers
      .map((answer) => answer.adminEvaluationId)
      .filter((id): id is string => Boolean(id));

    const questionRows =
      questionIds.length > 0
        ? await db
            .select({
              id: interviewQuestionBank.id,
              promptText: interviewQuestionBank.promptText,
            })
            .from(interviewQuestionBank)
            .where(inArray(interviewQuestionBank.id, questionIds))
        : [];

    const aiRows =
      aiEvalIds.length > 0
        ? await db
            .select({
              id: aiInterviewEvaluations.id,
              structured: aiInterviewEvaluations.evaluationJsonStructured,
            })
            .from(aiInterviewEvaluations)
            .where(inArray(aiInterviewEvaluations.id, aiEvalIds))
        : [];

    const adminRows =
      adminEvalIds.length > 0
        ? await db
            .select({
              id: adminInterviewEvaluations.id,
              totalScoreOverride: adminInterviewEvaluations.totalScoreOverride,
              dimensionOverrides: adminInterviewEvaluations.dimensionOverrides,
            })
            .from(adminInterviewEvaluations)
            .where(inArray(adminInterviewEvaluations.id, adminEvalIds))
        : [];

    // Delivery scoring (Interview Coach only — Customer Cetricity answers
    // never have a row here, which is correct, not a gap).
    const answerIds = answers.map((answer) => answer.id);
    const deliveryRows =
      answerIds.length > 0
        ? await db
            .select({
              answerId: interviewDeliveryMetrics.answerId,
              deliveryScores: interviewDeliveryMetrics.deliveryScores,
              deliveryOverall: interviewDeliveryMetrics.deliveryOverall,
            })
            .from(interviewDeliveryMetrics)
            .where(inArray(interviewDeliveryMetrics.answerId, answerIds))
        : [];

    const questionById = new Map(questionRows.map((q) => [q.id, q]));
    const aiById = new Map(aiRows.map((item) => [item.id, item]));
    const adminById = new Map(adminRows.map((item) => [item.id, item]));
    const deliveryByAnswerId = new Map(
      deliveryRows.map((row) => [row.answerId, row]),
    );

    const [summary] = await db
      .select()
      .from(interviewSessionSummaries)
      .where(eq(interviewSessionSummaries.sessionId, sessionId))
      .limit(1);

    const pdfAnswers: ResultsPdfAnswer[] = [];
    const perAnswerAiTotals: Array<number | undefined> = [];
    const perAnswerFinalTotals: Array<number | undefined> = [];
    const perAnswerAiDimensions: DimensionScoreMap[] = [];
    const perAnswerFinalDimensions: DimensionScoreMap[] = [];
    const perAnswerDeliveryOverall: number[] = [];
    const perAnswerDeliveryScores: Array<{
      pace?: number;
      pausing?: number;
      fluency?: number;
      expressiveness?: number;
    }> = [];

    // All answers in a session share one module, so one dimension set —
    // derived from the first answer that has one, same pattern as the admin
    // route, rather than assuming DEFAULT_DIMENSION_SET.
    let sessionDimensionSet: DimensionSetName = DEFAULT_DIMENSION_SET;
    for (const answer of answers) {
      const ai = answer.aiEvaluationId
        ? aiById.get(answer.aiEvaluationId)
        : undefined;
      const dimensionSet = parseAiStructured(ai?.structured)?.dimensionSet;
      if (dimensionSet) {
        sessionDimensionSet = dimensionSet;
        break;
      }
    }

    for (const answer of answers) {
      const question = questionById.get(answer.questionId);
      const ai = answer.aiEvaluationId
        ? aiById.get(answer.aiEvaluationId)
        : undefined;
      const admin = answer.adminEvaluationId
        ? adminById.get(answer.adminEvaluationId)
        : undefined;
      const delivery = deliveryByAnswerId.get(answer.id);

      const aiStructured = parseAiStructured(ai?.structured);
      const aiDimensions = normalizeDimensionMap(
        aiStructured?.dimensions ?? {},
        sessionDimensionSet,
      );
      const computedAiTotal = calculateWeightedTotalScore(
        aiDimensions,
        sessionDimensionSet,
      );
      const modelAiTotal = normalizeTotalScore(aiStructured?.total_score);
      const normalizedAiTotal = hasCompleteDimensionScores(
        aiDimensions,
        sessionDimensionSet,
      )
        ? (computedAiTotal ?? modelAiTotal)
        : (modelAiTotal ?? computedAiTotal);

      const adminOverrides = normalizeDimensionMap(
        admin?.dimensionOverrides,
        sessionDimensionSet,
      );
      const finalDimensions = mergeDimensionMaps(
        aiDimensions,
        adminOverrides,
        sessionDimensionSet,
      );
      const normalizedFinalTotal = admin
        ? (normalizeTotalScore(admin.totalScoreOverride) ??
          calculateWeightedTotalScore(finalDimensions, sessionDimensionSet) ??
          normalizedAiTotal)
        : normalizedAiTotal;

      perAnswerAiTotals.push(normalizedAiTotal);
      perAnswerFinalTotals.push(normalizedFinalTotal);
      perAnswerAiDimensions.push(aiDimensions);
      perAnswerFinalDimensions.push(finalDimensions);

      const deliveryOverall = delivery
        ? Number(delivery.deliveryOverall)
        : undefined;
      const deliveryScores =
        delivery && typeof delivery.deliveryScores === "object"
          ? (delivery.deliveryScores as {
              pace?: number;
              pausing?: number;
              fluency?: number;
              expressiveness?: number;
            })
          : undefined;

      if (typeof deliveryOverall === "number" && Number.isFinite(deliveryOverall)) {
        perAnswerDeliveryOverall.push(deliveryOverall);
      }
      if (deliveryScores) {
        perAnswerDeliveryScores.push(deliveryScores);
      }

      pdfAnswers.push({
        questionIndex: answer.questionIndex,
        questionText: question?.promptText ?? "Question",
        aiScore: totalScoreToPercentage(normalizedAiTotal) ?? null,
        finalScore: totalScoreToPercentage(normalizedFinalTotal) ?? null,
        aiDimensions,
        finalDimensions,
        transcript: answer.transcriptedText,
        deliveryOverall:
          typeof deliveryOverall === "number" && Number.isFinite(deliveryOverall)
            ? deliveryOverall
            : null,
        deliveryScores: deliveryScores ?? null,
      });
    }

    const overallAiScore = averageTotalScores(perAnswerAiTotals);
    const overallFinalScore = averageTotalScores(perAnswerFinalTotals);
    const overallAiDimensions = averageDimensionMaps(
      perAnswerAiDimensions,
      sessionDimensionSet,
    );
    const overallFinalDimensions = averageDimensionMaps(
      perAnswerFinalDimensions,
      sessionDimensionSet,
    );

    const overallDeliveryScore =
      perAnswerDeliveryOverall.length > 0
        ? Number(
            (
              perAnswerDeliveryOverall.reduce((sum, v) => sum + v, 0) /
              perAnswerDeliveryOverall.length
            ).toFixed(2),
          )
        : undefined;

    const DELIVERY_KEYS = ["pace", "pausing", "fluency", "expressiveness"] as const;
    const overallDeliveryScores: {
      pace?: number;
      pausing?: number;
      fluency?: number;
      expressiveness?: number;
    } = {};
    for (const key of DELIVERY_KEYS) {
      const values = perAnswerDeliveryScores
        .map((item) => item[key])
        .filter((value): value is number => typeof value === "number");
      if (values.length > 0) {
        overallDeliveryScores[key] = Number(
          (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2),
        );
      }
    }

    const summaryText =
      pdfAnswers
        .map((_, index) => {
          const ai = aiById.get(answers[index]?.aiEvaluationId ?? "");
          return parseAiStructured(ai?.structured)?.final_summary?.trim();
        })
        .find((value): value is string => Boolean(value)) ??
      "The interview summary is not available yet.";

    const pdfBuffer = await renderResultsPdf({
      candidateName: candidate?.name || candidate?.email || "Candidate",
      moduleName: module?.name ?? "Interview Module",
      completedAt: new Date(
        sessionRow.completedAt ?? sessionRow.createdAt,
      ).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      aiScore: totalScoreToPercentage(overallAiScore) ?? null,
      finalScore:
        totalScoreToPercentage(overallFinalScore) ??
        totalScoreToPercentage(overallAiScore) ??
        null,
      dimensionSet: sessionDimensionSet,
      aiDimensions: overallAiDimensions,
      finalDimensions: overallFinalDimensions,
      strengths: asStringList(summary?.aiStrengths),
      improvementAreas: asStringList(summary?.aiImprovementAreas),
      summary: summaryText,
      answers: pdfAnswers,
      deliveryOverall: overallDeliveryScore ?? null,
      deliveryScores: overallDeliveryScores,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(module?.name ?? "interview-results").replace(/[^a-z0-9]+/gi, "-")}-results.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate interview results PDF", error);
    return NextResponse.json(
      { error: "Failed to generate results PDF" },
      { status: 500 },
    );
  }
}
