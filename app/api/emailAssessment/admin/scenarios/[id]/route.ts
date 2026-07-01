import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentScenarios as scenarios,
} from "@/DB/emailAssessmentSchema";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";

const patchScenarioSchema = z.object({
  title: z.string().trim().min(3).max(220).optional(),
  prompt: z.string().trim().min(20).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  category: z.string().trim().min(2).max(120).optional(),
  active: z.boolean().optional(),
  modelAnswer: z.string().trim().nullable().optional(),
  scoringNotes: z.string().trim().nullable().optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["admin"]);

  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchScenarioSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid scenario update.");
  }

  const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);

  if (!scenario) {
    return jsonError("Scenario not found.", 404);
  }

  const updatedData = {
    title: parsed.data.title,
    prompt: parsed.data.prompt,
    difficulty: parsed.data.difficulty,
    category: parsed.data.category,
    active: parsed.data.archive ? false : parsed.data.active,
    modelAnswer: parsed.data.modelAnswer,
    scoringNotes: parsed.data.scoringNotes,
    archivedAt: parsed.data.archive ? new Date() : undefined,
    updatedAt: new Date(),
  };

  await db.update(scenarios).set(updatedData).where(eq(scenarios.id, id));

  const updatedTitle = parsed.data.title ?? scenario.title;

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: parsed.data.archive ? "scenario_archived" : "scenario_updated",
    entityType: "scenario",
    entityId: scenario.id,
    metadata: { title: updatedTitle },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({
    scenario: {
      ...scenario,
      ...updatedData,
    },
  });
}
