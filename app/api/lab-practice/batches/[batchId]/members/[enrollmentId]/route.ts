import { NextResponse } from "next/server";

import { parseId } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { removeBatchMember } from "@/lib/labPractice/batches";
import { jsonError } from "@/lib/labPractice/identity";

type Ctx = { params: Promise<{ batchId: string; enrollmentId: string }> };

/** DELETE — take a trainee out of the batch (enrollment + progress kept). */
export async function DELETE(_req: Request, context: Ctx) {
  const params = await context.params;
  const { batch, response } = await loadManagedBatch(params.batchId);
  if (response) return response;
  const enrollmentId = parseId(params.enrollmentId);
  if (!enrollmentId) return jsonError("Not found.", 404);
  await removeBatchMember(batch, enrollmentId);
  return NextResponse.json({ ok: true });
}
