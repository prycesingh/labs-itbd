import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadSchedule } from "@/lib/labPractice/scheduleRoutes";
import { addDay } from "@/lib/labPractice/schedules";
import { dayCreateSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ scheduleId: string }> };

/** POST { title? } — append the next day. */
export async function POST(request: Request, context: Ctx) {
  const { schedule, response } = await loadSchedule((await context.params).scheduleId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, dayCreateSchema);
  if (bad) return bad;
  try {
    return NextResponse.json({ id: await addDay(schedule.id, data.title || null) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
