import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { setCurrentDay } from "@/lib/labPractice/schedules";
import { batchDaySchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** PUT { day } | { step: 1 | -1 } — move the batch's day pointer: days
 *  1..day are open. `step` opens the next day / closes the latest one. */
export async function PUT(request: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchDaySchema);
  if (bad) return bad;
  try {
    const target = data.day ?? batch.currentDay + (data.step ?? 0);
    return NextResponse.json({ currentDay: await setCurrentDay(batch, target) });
  } catch (err) {
    return handleError(err);
  }
}
