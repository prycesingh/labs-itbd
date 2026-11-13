import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { setBatchLabs } from "@/lib/labPractice/batches";
import { batchLabsSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** PUT { labIds } — replace which labs the batch's trainees can see. */
export async function PUT(request: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchLabsSchema);
  if (bad) return bad;
  try {
    await setBatchLabs(batch, data.labIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
