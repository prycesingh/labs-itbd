import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { requireApiTrainer } from "@/lib/labPractice/identity";
import { createSchedule, listSchedules } from "@/lib/labPractice/schedules";
import { scheduleSchema } from "@/lib/validation/labPractice";

/** GET — every schedule (shared across trainers). */
export async function GET() {
  const { response } = await requireApiTrainer();
  if (response) return response;
  return NextResponse.json({ schedules: await listSchedules() });
}

/** POST { name } — create an empty schedule. */
export async function POST(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const { data, response: bad } = await parseBody(request, scheduleSchema);
  if (bad) return bad;
  try {
    return NextResponse.json({ id: await createSchedule(actor.trainer.id, data.name) }, { status: 201 });
  } catch (err) {
    return handleError(err, "A schedule with that name already exists.");
  }
}
