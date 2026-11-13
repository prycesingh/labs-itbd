import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { loadDay } from "@/lib/labPractice/scheduleRoutes";
import { deleteDay, moveDay, renameDay } from "@/lib/labPractice/schedules";
import { dayUpdateSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ dayId: string }> };

/** PATCH { title?, move? } — rename and/or move one place earlier/later. */
export async function PATCH(request: Request, context: Ctx) {
  const { day, response } = await loadDay((await context.params).dayId);
  if (response) return response;
  const { data, response: bad } = await parseBody(request, dayUpdateSchema);
  if (bad) return bad;
  try {
    if (data.title !== undefined) await renameDay(day.id, data.title || null);
    if (data.move) await moveDay(day, data.move);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE — remove the day; its labs become unscheduled, later days renumber. */
export async function DELETE(_req: Request, context: Ctx) {
  const { day, response } = await loadDay((await context.params).dayId);
  if (response) return response;
  try {
    await deleteDay(day);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
