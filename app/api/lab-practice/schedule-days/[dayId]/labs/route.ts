import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadDay } from "@/lib/labPractice/scheduleRoutes";
import { addLabsToDay, setDayLabs, unscheduleLab } from "@/lib/labPractice/schedules";
import { dayLabsSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ dayId: string }> };

/** PUT { labIds? | add? | remove? } — replace the day's labs, append labs
 *  (moved here from other days if needed), or take labs out of the schedule. */
export async function PUT(request: Request, context: Ctx) {
  const { day, response } = await loadDay((await context.params).dayId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, dayLabsSchema);
  if (bad) return bad;
  try {
    if (data.labIds) await setDayLabs(day, data.labIds);
    if (data.add?.length) await addLabsToDay(day, data.add);
    for (const labId of data.remove ?? []) await unscheduleLab(day.scheduleId, labId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
