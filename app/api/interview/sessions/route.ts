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
import {
  calculateWeightedTotalScore,
  EVALUATION_DIMENSION_ORDER,
  normalizeDimensionMap,
  normalizeTotalScore,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import {
  createSessionSchema,
  updateSessionStatusSchema,
} from "@/lib/validation/interview";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0);
      }
    } catch {
      // Fall back to delimiter-based parsing.
    }

    return trimmed
      .split(/;|\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function parseAiStructured(
  value: unknown,
): { total_score?: number; dimensions?: unknown } | null {
  if (typeof value === "string") {
    try {
      return parseAiStructured(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as { total_score?: number; dimensions?: unknown };
}

function hasCompleteDimensionScores(
  dimensions: ReturnType<typeof normalizeDimensionMap>,
) {
  return EVALUATION_DIMENSION_ORDER.every(
    (key) => typeof dimensions[key]?.score === "number",
  );
}

const sessionIdSchema = z.string().uuid();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { candidateId: candidateIdInput, moduleId } = parsed.data;
    const candidateId = candidateIdInput || session.user.id;

    const [module] = await db
      .select({
        id: interviewModules.id,
        interviewType: interviewModules.interviewType,
      })
      .from(interviewModules)
      .where(
        and(
          eq(interviewModules.id, moduleId),
          eq(interviewModules.isActive, true),
        ),
      )
      .limit(1);

    if (!module) {
      return NextResponse.json(
        { error: "Interview module not found or inactive" },
        { status: 404 },
      );
    }

    const questionRows = await db
      .select({
        id: interviewQuestions.id,
        text: interviewQuestions.promptText,
        order: interviewQuestions.questionOrder,
      })
      .from(interviewQuestions)
      .where(
        and(
          eq(interviewQuestions.moduleId, moduleId),
          eq(interviewQuestions.isActive, true),
        ),
      )
      .orderBy(asc(interviewQuestions.questionOrder));

    if (questionRows.length === 0) {
      return NextResponse.json(
        { error: "No active interview questions configured" },
        { status: 400 },
      );
    }

    const sessionId = randomUUID();

    await db.insert(candidateInterviewSessions).values({
      id: sessionId,
      candidateId,
      moduleId,
      interviewType: module.interviewType,
      totalQuestions: questionRows.length,
      recordedCount: 0,
      processedCount: 0,
      status: "draft",
      sessionState: {
        ownerUserId: session.user.id,
        currentQuestionIndex: 0,
        recordedCount: 0,
        processedCount: 0,
        errors: [],
      },
    });

    return NextResponse.json(
      {
        sessionId,
        totalQuestions: questionRows.length,
        recordedCount: 0,
        processedCount: 0,
        status: "draft",
        questions: questionRows.map((question, index) => ({
          id: String(question.id),
          index,
          text: question.text,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create interview session", error);
    return NextResponse.json(
      { error: "Failed to create interview session" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const userId = request.nextUrl.searchParams.get("userId");

  if (userId) {
    const role = session.user.role ?? "user";
    const isAdmin = ["devAdmin", "adminTeam", "executive"].includes(role);

    if (!isAdmin && userId !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied: cannot read another user's sessions" },
        { status: 403 },
      );
    }

    try {
      const sessionRows = await db
        .select({
          id: candidateInterviewSessions.id,
          moduleId: candidateInterviewSessions.moduleId,
          totalQuestions: candidateInterviewSessions.totalQuestions,
          completedAt: candidateInterviewSessions.completedAt,
          status: candidateInterviewSessions.status,
          createdAt: candidateInterviewSessions.createdAt,
          moduleName: interviewModules.name,
        })
        .from(candidateInterviewSessions)
        .leftJoin(
          interviewModules,
          eq(interviewModules.id, candidateInterviewSessions.moduleId),
        )
        .where(eq(candidateInterviewSessions.candidateId, userId))
        .orderBy(asc(candidateInterviewSessions.createdAt));

      if (sessionRows.length === 0) {
        return NextResponse.json([], { status: 200 });
      }

      const summaries = await db
        .select({
          sessionId: interviewSessionSummaries.sessionId,
          overallAiScore: interviewSessionSummaries.overallAiScore,
          overallAdminScore: interviewSessionSummaries.overallAdminScore,
          aiStrengths: interviewSessionSummaries.aiStrengths,
          aiImprovementAreas: interviewSessionSummaries.aiImprovementAreas,
          adminOverallNotes: interviewSessionSummaries.adminNotes,
        })
        .from(interviewSessionSummaries)
        .where(and(eq(interviewSessionSummaries.candidateId, userId)));

      const summaryBySessionId = new Map(
        summaries.map((summary) => [summary.sessionId, summary]),
      );

      const payload = sessionRows.map((row) => {
        const summary = summaryBySessionId.get(row.id);

        return {
          id: row.id,
          moduleName: row.moduleName ?? "Unknown Module",
          moduleId: row.moduleId,
          totalQuestions: row.totalQuestions,
          completedAt: row.completedAt ?? row.createdAt,
          status: row.status,
          evaluation: summary
            ? {
                overallAiScore: Number(summary.overallAiScore ?? 0),
                overallAdminScore:
                  summary.overallAdminScore !== null
                    ? Number(summary.overallAdminScore)
                    : undefined,
                aiStrengths: Array.isArray(summary.aiStrengths)
                  ? summary.aiStrengths.join("; ")
                  : typeof summary.aiStrengths === "string"
                    ? summary.aiStrengths
                    : undefined,
                aiImprovementAreas: Array.isArray(summary.aiImprovementAreas)
                  ? summary.aiImprovementAreas.join("; ")
                  : typeof summary.aiImprovementAreas === "string"
                    ? summary.aiImprovementAreas
                    : undefined,
              }
            : undefined,
        };
      });

      return NextResponse.json(payload, { status: 200 });
    } catch (error) {
      console.error("Failed to list interview sessions for user", error);
      return NextResponse.json(
        { error: "Failed to fetch interview sessions" },
        { status: 500 },
      );
    }
  }

  if (!sessionId || !sessionIdSchema.safeParse(sessionId).success) {
    return NextResponse.json(
      { error: "Valid sessionId or userId query param is required" },
      { status: 400 },
    );
  }

  try {
    const [sessionRow] = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

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
              id: interviewQuestions.id,
              promptText: interviewQuestions.promptText,
              promptAudioPath: interviewQuestions.promptAudioPath,
            })
            .from(interviewQuestions)
            .where(inArray(interviewQuestions.id, questionIds))
        : [];

    const standardResponseRows =
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
              adminNotes: adminInterviewEvaluations.adminNotes,
            })
            .from(adminInterviewEvaluations)
            .where(inArray(adminInterviewEvaluations.id, adminEvalIds))
        : [];

    const questionById = new Map(questionRows.map((q) => [q.id, q]));
    const aiById = new Map(aiRows.map((item) => [item.id, item]));
    const adminById = new Map(adminRows.map((item) => [item.id, item]));

    const responseByQuestionId = new Map<string, string[]>();
    const sortedStandardResponses = [...standardResponseRows].sort(
      (a, b) => a.responseOrder - b.responseOrder,
    );

    for (const row of sortedStandardResponses) {
      const existing = responseByQuestionId.get(row.questionId) ?? [];
      existing.push(row.responseText);
      responseByQuestionId.set(row.questionId, existing);
    }

    const enrichedAnswers = answers.map((answer) => {
      const question = questionById.get(answer.questionId);
      const ai = answer.aiEvaluationId
        ? aiById.get(answer.aiEvaluationId)
        : undefined;
      const admin = answer.adminEvaluationId
        ? adminById.get(answer.adminEvaluationId)
        : undefined;

      const aiStructured = parseAiStructured(ai?.structured);
      const aiDimensions = normalizeDimensionMap(
        aiStructured?.dimensions ?? {},
      );
      const computedAiTotal = calculateWeightedTotalScore(aiDimensions);
      const modelAiTotal = normalizeTotalScore(aiStructured?.total_score);
      const normalizedAiTotal = hasCompleteDimensionScores(aiDimensions)
        ? (computedAiTotal ?? modelAiTotal)
        : (modelAiTotal ?? computedAiTotal);
      const normalizedAdminTotal = normalizeTotalScore(
        admin?.totalScoreOverride,
      );

      return {
        id: answer.id,
        questionId: answer.questionId,
        questionIndex: answer.questionIndex,
        questionText: question?.promptText ?? null,
        questionAudioPath: question?.promptAudioPath ?? null,
        standardResponses: responseByQuestionId.get(answer.questionId) ?? [],
        audioPath: answer.audioStoragePath,
        transcript: answer.transcriptedText,
        transcriptStatus: answer.transcriptStatus,
        evaluationStatus: answer.evaluationStatus,
        aiScore:
          typeof normalizedAiTotal === "number"
            ? (totalScoreToPercentage(normalizedAiTotal) ?? null)
            : null,
        adminScore:
          typeof normalizedAdminTotal === "number"
            ? (totalScoreToPercentage(normalizedAdminTotal) ?? null)
            : null,
      };
    });

    const [summary] = await db
      .select()
      .from(interviewSessionSummaries)
      .where(eq(interviewSessionSummaries.sessionId, sessionId))
      .limit(1);

    const normalizedSummary = summary
      ? {
          ...summary,
          aiStrengths: normalizeStringList(summary.aiStrengths),
          aiImprovementAreas: normalizeStringList(summary.aiImprovementAreas),
        }
      : null;

    return NextResponse.json(
      {
        session: sessionRow,
        answers: enrichedAnswers,
        summary: normalizedSummary,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch interview session", error);
    return NextResponse.json(
      { error: "Failed to fetch interview session" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = updateSessionStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { sessionId, status } = parsed.data;

    const [existingSession] = await db
      .select({ id: candidateInterviewSessions.id })
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await db
      .update(candidateInterviewSessions)
      .set({
        status,
        recordingCompletedAt:
          status === "recorded" ? new Date().toISOString() : null,
        completedAt:
          status === "completed" || status === "failed"
            ? new Date().toISOString()
            : null,
      })
      .where(and(eq(candidateInterviewSessions.id, sessionId)));

    const [updated] = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    return NextResponse.json({ session: updated }, { status: 200 });
  } catch (error) {
    console.error("Failed to update interview session", error);
    return NextResponse.json(
      { error: "Failed to update interview session" },
      { status: 500 },
    );
  }
}
