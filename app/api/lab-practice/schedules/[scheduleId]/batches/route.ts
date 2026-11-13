import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadSchedule } from "@/lib/labPractice/scheduleRoutes";
import { createScheduleBatch } from "@/lib/labPractice/schedules";
import { batchSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ scheduleId: string }> };

/** POST { name } — create a batch that follows this schedule, owned by the caller. */
export async function POST(request: Request, context: Ctx) {
  const { actor, schedule, response } = await loadSchedule((await context.params).scheduleId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, batchSchema);
  if (bad) return bad;
  try {
    const id = await createScheduleBatch(actor.trainer.id, schedule.id, data.name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
