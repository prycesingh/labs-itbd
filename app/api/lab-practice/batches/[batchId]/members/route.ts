import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { addBatchMembers } from "@/lib/labPractice/batches";
import { batchMembersSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** POST { traineeIds } — add trainees (employee ids), enrolling them in the
 *  batch's module under the batch's trainer when needed. */
export async function POST(request: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchMembersSchema);
  if (bad) return bad;
  try {
    return NextResponse.json(await addBatchMembers(batch, data.traineeIds), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
