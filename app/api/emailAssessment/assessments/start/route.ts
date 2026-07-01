import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";
import { addMinutes } from "@/lib/emailAssessment/date";
import { canRetake } from "@/lib/emailAssessment/retakes";
import { enforceRateLimit, rateLimitResponse } from "@/lib/emailAssessment/rate-limit";
import { SESSION_SCENARIO_DISTRIBUTION, SESSION_TIME_MINUTES } from "@/lib/emailAssessment/scoring";

const startSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

async function pickRandomScenarios(
  difficulty: "beginner" | "intermediate" | "advanced",
  count: number,
  excludeIds: Set<string>
) {
  const available = await db
    .select()
    .from(scenarios)
    .where(sql`${scenarios.active} = true AND ${scenarios.difficulty} = ${difficulty}`);

  const filtered = available.filter((s) => !excludeIds.has(s.id));
  const shuffled = filtered.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function POST(request: Request) {
  try {
    const { user, response } = await requireApiUser(["candidate", "admin"]);

    if (response) return response;

    const rateLimit = await enforceRateLimit(`assessment-start:${user!.id}`, 5, 60 * 60);
    const isBypass =
      process.env.NODE_ENV === "development" || process.env.BYPASS_RATE_LIMIT === "true";
    if (!rateLimit.allowed && !isBypass) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = startSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid request.");
    }

    const sessionId = parsed.data.sessionId ?? randomUUID();

    // Check if this session was already started (e.g. after page refresh)
    if (parsed.data.sessionId) {
      const existing = await db
        .select()
        .from(assessments)
        .where(
          sql`${assessments.sessionId} = ${sessionId} AND ${assessments.status} = 'in_progress' AND ${assessments.dueAt} > NOW()`
        )
        .orderBy(assessments.sessionIndex)
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({
          assessmentId: existing[0].id,
          sessionId,
          sessionIndex: existing[0].sessionIndex,
          reused: true,
        });
      }
    }

    // Check retake cooldown
    const [latestSubmission] = await db
      .select({ submittedAt: submissions.submittedAt })
      .from(submissions)
      .where(eq(submissions.candidateId, user!.id))
      .orderBy(desc(submissions.submittedAt))
      .limit(1);

    const retake = canRetake(latestSubmission?.submittedAt);

    if (!retake.allowed && !isBypass) {
      return NextResponse.json(
        {
          error: "Retakes are available after the cooldown period.",
          nextEligibleAt: retake.nextEligibleAt,
        },
        { status: 409 }
      );
    }

    // Pick the required scenario mix with no duplicates within the session.
    const usedIds = new Set<string>();
    const beginnerScenarios = await pickRandomScenarios(
      "beginner",
      SESSION_SCENARIO_DISTRIBUTION.beginner,
      usedIds
    );
    beginnerScenarios.forEach((s) => usedIds.add(s.id));
    const intermediateScenarios = await pickRandomScenarios(
      "intermediate",
      SESSION_SCENARIO_DISTRIBUTION.intermediate,
      usedIds
    );
    intermediateScenarios.forEach((s) => usedIds.add(s.id));
    const advancedScenarios = await pickRandomScenarios(
      "advanced",
      SESSION_SCENARIO_DISTRIBUTION.advanced,
      usedIds
    );

    const selectedScenarios = [...beginnerScenarios, ...intermediateScenarios, ...advancedScenarios];

    if (selectedScenarios.length < 5) {
      return jsonError(
        "Not enough active scenarios available. Ensure at least 2 beginner, 2 intermediate, and 1 advanced scenario exist.",
        404
      );
    }

    // Create all 5 assessments that share the same session timer.
    const now = new Date();
    const dueAt = addMinutes(now, SESSION_TIME_MINUTES);
    const assessmentIds: string[] = [];

    for (let i = 0; i < selectedScenarios.length; i++) {
      const assessmentId = randomUUID();
      assessmentIds.push(assessmentId);

      await db.insert(assessments).values({
        id: assessmentId,
        candidateId: user!.id,
        scenarioId: selectedScenarios[i].id,
        sessionId,
        sessionIndex: i,
        timeLimitMinutes: SESSION_TIME_MINUTES,
        dueAt,
        startedAt: now,
      });
    }

    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorId: user!.id,
      action: "assessment_started",
      entityType: "assessment",
      entityId: assessmentIds[0],
      metadata: {
        sessionId,
        scenarioIds: selectedScenarios.map((s) => s.id),
        difficulties: selectedScenarios.map((s) => s.difficulty),
      },
      ipAddress: requestIp(request),
    });

    return NextResponse.json({
      assessmentId: assessmentIds[0],
      sessionId,
      sessionIndex: 0,
      totalScenarios: 5,
    });
  } catch (error) {
    console.error("/api/emailAssessment/assessments/start error", error);
    return jsonError(
      `Failed to start assessment. ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}
