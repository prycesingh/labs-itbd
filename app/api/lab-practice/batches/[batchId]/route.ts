import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeBatches } from "@/DB/labPracticeSchema";
import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { deleteBatch } from "@/lib/labPractice/batches";
import { batchUpdateSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** PATCH { name?, isActive? } — rename / archive a batch. */
export async function PATCH(request: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchUpdateSchema);
  if (bad) return bad;
  try {
    await db.update(labPracticeBatches).set(data).where(eq(labPracticeBatches.id, batch.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "A batch with that name already exists for this module.");
  }
}

/** DELETE — remove the batch; its trainees keep their enrollments and progress. */
export async function DELETE(_req: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  await deleteBatch(batch);
  return NextResponse.json({ ok: true });
}
