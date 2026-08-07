import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentPromptVersions as promptVersions,
  emailAssessmentRubrics as rubrics,
} from "@/DB/emailAssessmentSchema";
import { categoryScoreSchema } from "@/lib/emailAssessment/rubric";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";

const promptSchema = z.object({
  systemPrompt: z.string().trim().min(20),
  evaluationPrompt: z.string().trim().min(20),
  model: z.string().trim().min(3),
  weights: categoryScoreSchema,
});

export async function GET() {
  const { response } = await requireApiUser(["admin"]);
  if (response) return response;

  const [activePrompt] = await db
    .select({ promptVersion: promptVersions, rubric: rubrics })
    .from(promptVersions)
    .innerJoin(rubrics, eq(promptVersions.rubricId, rubrics.id))
    .where(and(eq(promptVersions.active, true), eq(rubrics.active, true)))
    .orderBy(desc(promptVersions.createdAt))
    .limit(1);

  if (!activePrompt) {
    return jsonError("No active prompt version found.", 404);
  }

  return NextResponse.json({ promptVersion: activePrompt.promptVersion, rubric: activePrompt.rubric });
}

const createPromptSchema = z.object({
  version: z.string().trim().min(1).max(64),
  systemPrompt: z.string().trim().min(20),
  evaluationPrompt: z.string().trim().min(20),
  model: z.string().trim().min(3),
  weights: categoryScoreSchema,
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser(["admin"]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = createPromptSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid prompt settings.");
  }

  const [existingVersion] = await db
    .select({ id: promptVersions.id })
    .from(promptVersions)
    .where(eq(promptVersions.version, parsed.data.version))
    .limit(1);

  if (existingVersion) {
    return jsonError("A prompt version with that name already exists.", 409);
  }

  await db.update(rubrics).set({ active: false }).where(eq(rubrics.active, true));
  await db.update(promptVersions).set({ active: false }).where(eq(promptVersions.active, true));

  const rubricId = randomUUID();
  await db.insert(rubrics).values({
    id: rubricId,
    version: parsed.data.version,
    name: `Rubric ${parsed.data.version}`,
    weights: parsed.data.weights,
    active: true,
  });

  const promptVersionId = randomUUID();
  await db.insert(promptVersions).values({
    id: promptVersionId,
    version: parsed.data.version,
    systemPrompt: parsed.data.systemPrompt,
    evaluationPrompt: parsed.data.evaluationPrompt,
    rubricId,
    model: parsed.data.model,
    active: true,
  });

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: "scenario_updated",
    entityType: "prompt_version",
    entityId: promptVersionId,
    metadata: {
      version: parsed.data.version,
      model: parsed.data.model,
    },
    ipAddress: requestIp(request),
  });

  const [promptVersion] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, promptVersionId))
    .limit(1);
  const [rubric] = await db.select().from(rubrics).where(eq(rubrics.id, rubricId)).limit(1);

  return NextResponse.json({ promptVersion, rubric }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, response } = await requireApiUser(["admin"]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = promptSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid prompt settings.");
  }

  const [activePrompt] = await db
    .select({ promptVersion: promptVersions, rubric: rubrics })
    .from(promptVersions)
    .innerJoin(rubrics, eq(promptVersions.rubricId, rubrics.id))
    .where(and(eq(promptVersions.active, true), eq(rubrics.active, true)))
    .orderBy(desc(promptVersions.createdAt))
    .limit(1);

  if (!activePrompt) {
    return jsonError("No active prompt version found.", 404);
  }

  await db
    .update(rubrics)
    .set({ weights: parsed.data.weights })
    .where(eq(rubrics.id, activePrompt.rubric.id));

  await db
    .update(promptVersions)
    .set({
      systemPrompt: parsed.data.systemPrompt,
      evaluationPrompt: parsed.data.evaluationPrompt,
      model: parsed.data.model,
    })
    .where(eq(promptVersions.id, activePrompt.promptVersion.id));

  const updatedRubric = {
    ...activePrompt.rubric,
    weights: parsed.data.weights,
  };

  const updatedPrompt = {
    ...activePrompt.promptVersion,
    systemPrompt: parsed.data.systemPrompt,
    evaluationPrompt: parsed.data.evaluationPrompt,
    model: parsed.data.model,
  };

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: "scenario_updated",
    entityType: "prompt_version",
    entityId: activePrompt.promptVersion.id,
    metadata: {
      model: parsed.data.model,
      rubricVersion: activePrompt.rubric.version,
    },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ promptVersion: updatedPrompt, rubric: updatedRubric });
}
