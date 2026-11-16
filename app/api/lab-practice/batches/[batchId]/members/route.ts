import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { addBatchMembers } from "@/lib/labPractice/batches";
import { batchMembersSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** POST { traineeIds, move? } — add trainees (employee ids) and enroll them in
 *  every module the batch's schedule uses. Trainees already in another batch
 *  come back as `batchConflicts`; resend with `move: true` to move them. */
export async function POST(request: Request, context: Ctx) {
  const { batch, actor, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchMembersSchema);
  if (bad) return bad;
  try {
    return NextResponse.json(await addBatchMembers(actor, batch, data.traineeIds, data.move), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
