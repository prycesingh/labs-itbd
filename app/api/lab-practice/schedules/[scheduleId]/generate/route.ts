import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadSchedule } from "@/lib/labPractice/scheduleRoutes";
import { generateDays } from "@/lib/labPractice/schedules";
import { generateSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ scheduleId: string }> };

/** POST { moduleIds, strategy, perDay?, replace, dryRun } — preview (dryRun)
 *  or build days from lab titles / N labs per day. */
export async function POST(request: Request, context: Ctx) {
  const { schedule, response } = await loadSchedule((await context.params).scheduleId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, generateSchema);
  if (bad) return bad;
  try {
    return NextResponse.json(await generateDays(schedule.id, data));
  } catch (err) {
    return handleError(err);
  }
}
