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
