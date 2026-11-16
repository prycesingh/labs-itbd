import { NextResponse } from "next/server";

import { parseId } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { releaseMember } from "@/lib/labPractice/batches";
import { jsonError } from "@/lib/labPractice/identity";

type Ctx = { params: Promise<{ batchId: string; traineeId: string }> };

/** DELETE — take a trainee out of the batch (all their module enrollments
 *  stay, with progress; they just stop following the batch's days). */
export async function DELETE(_req: Request, context: Ctx) {
  const params = await context.params;
  const { batch, response } = await loadManagedBatch(params.batchId);
  if (response) return response;
  const traineeId = parseId(params.traineeId);
  if (!traineeId) return jsonError("Not found.", 404);
  await releaseMember(batch.id, traineeId);
  return NextResponse.json({ ok: true });
}
