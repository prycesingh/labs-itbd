import { NextResponse } from "next/server";

import { handleError, parseBody, parseId } from "@/lib/labPractice/api";
import { loadManagedBatch } from "@/lib/labPractice/batchRoutes";
import { jsonError } from "@/lib/labPractice/identity";
import { requireDay, setTraineeDay } from "@/lib/labPractice/schedules";
import { traineeDaySchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ batchId: string; traineeId: string; dayId: string }> };

/** PUT { visible: true | false | null } — show / hide one day for ONE trainee
 *  in a schedule batch (null resets them to the batch's days). */
export async function PUT(request: Request, context: Ctx) {
  const params = await context.params;
  const { batch, response } = await loadManagedBatch(params.batchId);
  if (response) return response;
  const traineeId = parseId(params.traineeId);
  const dayId = parseId(params.dayId);
  if (!traineeId || !dayId) return jsonError("Not found.", 404);
  const { data, response: bad } = await parseBody(request, traineeDaySchema);
  if (bad) return bad;
  try {
    await setTraineeDay(batch, traineeId, await requireDay(dayId), data.visible);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
