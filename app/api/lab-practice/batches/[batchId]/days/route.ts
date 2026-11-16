import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { changePacing } from "@/lib/labPractice/pacing";
import { batchDaySchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** PUT — change which days the batch has open:
 *    { step: 1 | -1 }        open the next day / close the current one
 *    { through: N }          open Days 1..N (moves the pointer)
 *    { dayId, open }         open / close one day without moving the pointer
 *  Returns { currentDay }. */
export async function PUT(request: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchDaySchema);
  if (bad) return bad;
  try {
    return NextResponse.json(await changePacing(batch, data));
  } catch (err) {
    return handleError(err);
  }
}
