import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeSchedules } from "@/DB/labPracticeSchema";
import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadSchedule } from "@/lib/labPractice/scheduleRoutes";
import { deleteSchedule } from "@/lib/labPractice/schedules";
import { scheduleUpdateSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ scheduleId: string }> };

/** PATCH { name?, isActive? } — rename / archive. */
export async function PATCH(request: Request, context: Ctx) {
  const { schedule, response } = await loadSchedule((await context.params).scheduleId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, scheduleUpdateSchema);
  if (bad) return bad;
  try {
    await db.update(labPracticeSchedules).set(data).where(eq(labPracticeSchedules.id, schedule.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err, "A schedule with that name already exists.");
  }
}

/** DELETE — only when no batch follows it (archive otherwise). */
export async function DELETE(_req: Request, context: Ctx) {
  const { schedule, response } = await loadSchedule((await context.params).scheduleId);
  if (response) return response;
  try {
    await deleteSchedule(schedule);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
