import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  adminInterviewEvaluations,
  aiInterviewEvaluations,
  candidateInterviewAnswers,
  interviewSessionSummaries,
} from "@/DB/interviewSchema";
import {
  averageTotalScores,
  calculateWeightedTotalScore,
  EVALUATION_DIMENSION_ORDER,
  mergeDimensionMaps,
  normalizeDimensionMap,
  normalizeScore,
  normalizeTotalScore,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import { adminEvaluationSchema } from "@/lib/validation/interview";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type DimensionValue = {
  score?: number;
  reason?: string;
};

type AiStructured = {
  total_score?: number;
  dimensions?: Record<string, DimensionValue>;
  strengths?: string[] | string;
  improvement_areas?: string[] | string;
  final_summary?: string;
};

type AdminStructured = {
  totalScoreOverride?: number;
  dimensionOverrides?: Record<string, DimensionValue>;
  comparisonToAi?: {
    score_diff?: number;
    agreement_pct?: number;
    dimension_diffs?: Record<string, number>;
  };
  adminNotes?: string | null;
};

const uuidSchema = z.string().uuid();
const adminRoles = new Set(["devAdmin", "adminTeam", "executive"]);

function hasCompleteDimensionScores(
  dimensions: ReturnType<typeof normalizeDimensionMap>,
) {
  return EVALUATION_DIMENSION_ORDER.every(
    (key) => typeof dimensions[key]?.score === "number",
  );
}

function calculateAgreementPct(diff: number) {
  const normalized = Math.max(0, 100 - Math.abs(diff));
  return Number(normalized.toFixed(2));
}

function toAiStructured(value: unknown): AiStructured {
  if (typeof value === "string") {
    try {
      return toAiStructured(JSON.parse(value));
    } catch {
      return {};
    }
  }

  if (!value || typeof value !== "object") {
    return {};
  }

  return value as AiStructured;
}

function toAdminStructured(value: unknown): AdminStructured {
  if (typeof value === "string") {
    try {
      return toAdminStructured(JSON.parse(value));
    } catch {
      return {};
    }
  }

  if (!value || typeof value !== "object") {
    return {};
  }

  return value as AdminStructured;
}

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/;|\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function normalizeAiEvaluation(value: unknown) {
  const structured = toAiStructured(value);
  const dimensions = normalizeDimensionMap(structured.dimensions);
  const computedTotal = calculateWeightedTotalScore(dimensions);
  const modelTotal = normalizeTotalScore(structured.total_score);
  const normalizedTotal = hasCompleteDimensionScores(dimensions)
    ? (computedTotal ?? modelTotal ?? 0)
    : (modelTotal ?? computedTotal ?? 0);

  return {
    total_score: totalScoreToPercentage(normalizedTotal) ?? 0,
    dimensions,
    strengths: normalizeTextList(structured.strengths),
    improvement_areas: normalizeTextList(structured.improvement_areas),
    final_summary:
      typeof structured.final_summary === "string"
        ? structured.final_summary
        : undefined,
  };
}

function normalizeAdminEvaluation(
  adminEvaluation:
    | {
        totalScoreOverride?: unknown;
        dimensionOverrides?: unknown;
        comparisonToAi?: unknown;
        adminNotes?: string | null;
      }
    | null
    | undefined,
  aiDimensions: ReturnType<typeof normalizeDimensionMap>,
) {
  if (!adminEvaluation) {
    return null;
  }

  const overrideDimensions = normalizeDimensionMap(
    adminEvaluation.dimensionOverrides,
  );
  const mergedDimensions = mergeDimensionMaps(aiDimensions, overrideDimensions);
  const computedTotal = calculateWeightedTotalScore(mergedDimensions);
  const comparison = toAdminStructured(
    adminEvaluation.comparisonToAi,
  ).comparisonToAi;
  const normalizedTotal =
    normalizeTotalScore(adminEvaluation.totalScoreOverride) ??
    computedTotal ??
    0;

  return {
    total_score: totalScoreToPercentage(normalizedTotal) ?? 0,
    dimensions: mergedDimensions,
    dimensionOverrides: overrideDimensions,
    comparisonToAi: comparison ?? null,
    adminNotes: adminEvaluation.adminNotes ?? null,
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const answerId = request.nextUrl.searchParams.get("answerId");
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!answerId && !sessionId) {
    return NextResponse.json(
      { error: "Either answerId or sessionId query param is required" },
      { status: 400 },
    );
  }

  if (answerId && !uuidSchema.safeParse(answerId).success) {
    return NextResponse.json({ error: "Invalid answerId" }, { status: 400 });
  }

  if (sessionId && !uuidSchema.safeParse(sessionId).success) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  try {
    if (answerId) {
      const [answer] = await db
        .select()
        .from(candidateInterviewAnswers)
        .where(eq(candidateInterviewAnswers.id, answerId))
        .limit(1);

      if (!answer) {
        return NextResponse.json(
          { error: "Answer not found" },
          { status: 404 },
        );
      }

      const [aiEvaluation] = answer.aiEvaluationId
        ? await db
            .select()
            .from(aiInterviewEvaluations)
            .where(eq(aiInterviewEvaluations.id, answer.aiEvaluationId))
            .limit(1)
        : [];

      const [adminEvaluation] = answer.adminEvaluationId
        ? await db
            .select()
            .from(adminInterviewEvaluations)
            .where(eq(adminInterviewEvaluations.id, answer.adminEvaluationId))
            .limit(1)
        : [];

      return NextResponse.json(
        {
          answerId,
          sessionId: answer.sessionId,
          aiEvaluation: aiEvaluation
            ? normalizeAiEvaluation(aiEvaluation.evaluationJsonStructured)
            : null,
          adminEvaluation: normalizeAdminEvaluation(
            adminEvaluation,
            normalizeAiEvaluation(aiEvaluation?.evaluationJsonStructured)
              .dimensions,
          ),
        },
        { status: 200 },
      );
    }

    const answers = await db
      .select()
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, sessionId!));

    if (answers.length === 0) {
      return NextResponse.json(
        {
          sessionId,
          count: 0,
          evaluations: [],
        },
        { status: 200 },
      );
    }

    const aiEvaluationIds = answers
      .map((answer) => answer.aiEvaluationId)
      .filter((id): id is string => Boolean(id));
    const adminEvaluationIds = answers
      .map((answer) => answer.adminEvaluationId)
      .filter((id): id is string => Boolean(id));

    const aiEvaluations =
      aiEvaluationIds.length > 0
        ? await db
            .select()
            .from(aiInterviewEvaluations)
            .where(inArray(aiInterviewEvaluations.id, aiEvaluationIds))
        : [];

    const adminEvaluations =
      adminEvaluationIds.length > 0
        ? await db
            .select()
            .from(adminInterviewEvaluations)
            .where(inArray(adminInterviewEvaluations.id, adminEvaluationIds))
        : [];

    const aiById = new Map(
      aiEvaluations.map((evaluation) => [evaluation.id, evaluation]),
    );
    const adminById = new Map(
      adminEvaluations.map((evaluation) => [evaluation.id, evaluation]),
    );

    const evaluations = answers.map((answer) => {
      const rawAi = answer.aiEvaluationId
        ? (aiById.get(answer.aiEvaluationId) ?? null)
        : null;
      const normalizedAi = rawAi
        ? normalizeAiEvaluation(rawAi.evaluationJsonStructured)
        : null;
      const rawAdmin = answer.adminEvaluationId
        ? (adminById.get(answer.adminEvaluationId) ?? null)
        : null;

      return {
        answerId: answer.id,
        questionId: answer.questionId,
        questionIndex: answer.questionIndex,
        transcriptStatus: answer.transcriptStatus,
        evaluationStatus: answer.evaluationStatus,
        aiEvaluation: normalizedAi,
        adminEvaluation: normalizeAdminEvaluation(
          rawAdmin,
          normalizedAi?.dimensions ?? {},
        ),
      };
    });

    return NextResponse.json(
      {
        sessionId,
        count: evaluations.length,
        evaluations,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch interview evaluations", error);
    return NextResponse.json(
      { error: "Failed to fetch interview evaluations" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!adminRoles.has(session.user.role ?? "user")) {
    return NextResponse.json(
      { error: "Access denied: admin role required" },
      { status: 403 },
    );
  }

  const adminUserId = session.user.id;

  try {
    const body = await request.json().catch(() => null);
    const parsed = adminEvaluationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid admin evaluation payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { answerId, totalScoreOverride, dimensionOverrides, adminNotes } =
      parsed.data;

    const [answer] = await db
      .select()
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.id, answerId))
      .limit(1);

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    const [aiEvaluation] = answer.aiEvaluationId
      ? await db
          .select()
          .from(aiInterviewEvaluations)
          .where(eq(aiInterviewEvaluations.id, answer.aiEvaluationId))
          .limit(1)
      : [];

    if (!aiEvaluation) {
      return NextResponse.json(
        {
          error:
            "AI evaluation is not available for this answer. Process the session before admin override.",
        },
        { status: 409 },
      );
    }

    const aiStructured = toAiStructured(aiEvaluation.evaluationJsonStructured);
    const aiDimensions = normalizeDimensionMap(aiStructured.dimensions);
    const computedAiTotal = calculateWeightedTotalScore(aiDimensions);
    const modelAiTotal = normalizeTotalScore(aiStructured.total_score);
    const aiTotalScore = hasCompleteDimensionScores(aiDimensions)
      ? (computedAiTotal ?? modelAiTotal ?? 0)
      : (modelAiTotal ?? computedAiTotal ?? 0);

    const normalizedOverrides = normalizeDimensionMap(dimensionOverrides);
    const mergedDimensions = mergeDimensionMaps(
      aiDimensions,
      normalizedOverrides,
    );
    const normalizedTotal =
      Object.keys(normalizedOverrides).length > 0
        ? (calculateWeightedTotalScore(mergedDimensions) ?? aiTotalScore)
        : (normalizeTotalScore(totalScoreOverride) ?? aiTotalScore);

    const aiTotalPct = totalScoreToPercentage(aiTotalScore) ?? 0;
    const normalizedTotalPct = totalScoreToPercentage(normalizedTotal) ?? 0;

    const dimensionDiffs: Record<string, number> = {};

    if (Object.keys(normalizedOverrides).length > 0) {
      for (const [key, value] of Object.entries(normalizedOverrides)) {
        const overrideScore = value?.score;
        const aiScore =
          aiDimensions[key as keyof typeof aiDimensions]?.score ?? 0;

        if (typeof overrideScore === "number") {
          dimensionDiffs[key] = Number((overrideScore - aiScore).toFixed(2));
        }
      }
    }

    const scoreDiff = Number((normalizedTotalPct - aiTotalPct).toFixed(2));

    const comparisonToAi = {
      score_diff: scoreDiff,
      dimension_diffs: dimensionDiffs,
      agreement_pct: calculateAgreementPct(scoreDiff),
    };

    const currentAdminId = answer.adminEvaluationId;

    if (currentAdminId) {
      await db
        .update(adminInterviewEvaluations)
        .set({
          totalScoreOverride: normalizedTotal,
          dimensionOverrides:
            Object.keys(normalizedOverrides).length > 0
              ? normalizedOverrides
              : null,
          adminNotes: adminNotes ?? null,
          comparisonToAi,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(adminInterviewEvaluations.id, currentAdminId));

      return NextResponse.json(
        {
          answerId,
          adminEvaluationId: currentAdminId,
          comparisonToAi,
        },
        { status: 200 },
      );
    }

    const adminEvaluationId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(adminInterviewEvaluations).values({
        id: adminEvaluationId,
        answerId,
        sessionId: answer.sessionId,
        adminUserId,
        totalScoreOverride: normalizedTotal,
        dimensionOverrides:
          Object.keys(normalizedOverrides).length > 0
            ? normalizedOverrides
            : null,
        adminNotes: adminNotes ?? null,
        comparisonToAi,
      });

      await tx
        .update(candidateInterviewAnswers)
        .set({ adminEvaluationId })
        .where(
          and(
            eq(candidateInterviewAnswers.id, answerId),
            eq(candidateInterviewAnswers.sessionId, answer.sessionId),
          ),
        );
    });

    const sessionAnswers = await db
      .select({
        adminEvaluationId: candidateInterviewAnswers.adminEvaluationId,
        aiEvaluationId: candidateInterviewAnswers.aiEvaluationId,
      })
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, answer.sessionId));

    const sessionAdminIds = sessionAnswers
      .map((item) => item.adminEvaluationId)
      .filter((id): id is string => Boolean(id));

    const sessionAdminRows =
      sessionAdminIds.length > 0
        ? await db
            .select({
              totalScoreOverride: adminInterviewEvaluations.totalScoreOverride,
            })
            .from(adminInterviewEvaluations)
            .where(inArray(adminInterviewEvaluations.id, sessionAdminIds))
        : [];

    const overallAdminScore = averageTotalScores(
      sessionAdminRows.map((row) => normalizeScore(row.totalScoreOverride)),
    );

    const [existingSummary] = await db
      .select({ id: interviewSessionSummaries.id })
      .from(interviewSessionSummaries)
      .where(eq(interviewSessionSummaries.sessionId, answer.sessionId))
      .limit(1);

    if (existingSummary) {
      await db
        .update(interviewSessionSummaries)
        .set({
          overallAdminScore:
            typeof overallAdminScore === "number"
              ? (totalScoreToPercentage(overallAdminScore) ?? 0).toFixed(2)
              : null,
        })
        .where(eq(interviewSessionSummaries.id, existingSummary.id));
    }

    return NextResponse.json(
      {
        answerId,
        adminEvaluationId,
        totalScoreOverride: normalizedTotal,
        comparisonToAi,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to save admin evaluation", error);
    return NextResponse.json(
      { error: "Failed to save admin evaluation" },
      { status: 500 },
    );
  }
}
