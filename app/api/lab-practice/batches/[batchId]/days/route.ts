import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { activateNextDay, setBatchDays } from "@/lib/labPractice/schedules";
import { batchDaysSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string }> };

/** PUT { dayIds } — set which days are switched on for this schedule batch. */
export async function PUT(request: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchDaysSchema);
  if (bad) return bad;
  try {
    await setBatchDays(batch, data.dayIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

/** POST — switch on the next day that's still off. */
export async function POST(_req: Request, context: Ctx) {
  const { batch, response } = await loadManagedBatch((await context.params).batchId);
  if (response) return response;
  try {
    return NextResponse.json({ dayNo: await activateNextDay(batch) });
  } catch (err) {
    return handleError(err);
  }
}
