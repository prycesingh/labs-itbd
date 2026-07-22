import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsTroubleshootFlowchartSteps as troubleshootFlowchartSteps } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchTroubleshootFlowchartStepSchema = z.object({
  flowName: z.string().trim().min(1).max(160).optional(),
  stepIndex: z.number().int().nonnegative().optional(),
  stepType: z.enum(["question", "action", "success", "failure"]).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchTroubleshootFlowchartStepSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid troubleshoot flowchart step update.");
  }

  const [existing] = await db
    .select({ id: troubleshootFlowchartSteps.id })
    .from(troubleshootFlowchartSteps)
    .where(eq(troubleshootFlowchartSteps.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Troubleshoot flowchart step not found.", 404);
  }

  await db
    .update(troubleshootFlowchartSteps)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(troubleshootFlowchartSteps.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(troubleshootFlowchartSteps).where(eq(troubleshootFlowchartSteps.id, id));

  return NextResponse.json({ success: true });
}
