import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentScenarios as scenarios,
} from "@/DB/emailAssessmentSchema";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";

const scenarioSchema = z.object({
  title: z.string().trim().min(3).max(220),
  prompt: z.string().trim().min(20),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  category: z.string().trim().min(2).max(120),
  active: z.boolean().default(true),
  modelAnswer: z.string().trim().optional(),
  scoringNotes: z.string().trim().optional(),
});

export async function GET() {
  const { response } = await requireApiUser(["admin"]);

  if (response) return response;

  const records = await db.select().from(scenarios).orderBy(desc(scenarios.createdAt));
  return NextResponse.json({ scenarios: records });
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser(["admin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = scenarioSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid scenario details.");
  }

  const scenarioId = randomUUID();
  const scenario = {
    id: scenarioId,
    title: parsed.data.title,
    prompt: parsed.data.prompt,
    difficulty: parsed.data.difficulty,
    category: parsed.data.category,
    active: parsed.data.active,
    modelAnswer: parsed.data.modelAnswer || null,
    scoringNotes: parsed.data.scoringNotes || null,
    createdById: user!.id,
    source: "Admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(scenarios).values({
    id: scenario.id,
    title: scenario.title,
    prompt: scenario.prompt,
    difficulty: scenario.difficulty,
    category: scenario.category,
    active: scenario.active,
    modelAnswer: scenario.modelAnswer,
    scoringNotes: scenario.scoringNotes,
    createdById: scenario.createdById,
    source: scenario.source,
  });

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: "scenario_created",
    entityType: "scenario",
    entityId: scenario.id,
    metadata: { title: scenario.title },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ scenario }, { status: 201 });
}
