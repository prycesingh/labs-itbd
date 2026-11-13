import type { NextResponse } from "next/server";

import { parseId } from "@/lib/labPractice/api";
import { jsonError, requireApiTrainer, type TrainerActor } from "@/lib/labPractice/identity";
import { getSchedule, requireDay, type Schedule, type ScheduleDay } from "@/lib/labPractice/schedules";
import { PracticeError } from "@/lib/labPractice/practice";

/** Schedules are shared curriculum: any trainer (guidedLabs.train) may edit. */
export async function loadSchedule(
  rawId: string,
): Promise<{ actor: TrainerActor; schedule: Schedule; response: null } | { actor: null; schedule: null; response: NextResponse }> {
  const { actor, response } = await requireApiTrainer();
  if (response) return { actor: null, schedule: null, response };
  const id = parseId(rawId);
  const schedule = id ? await getSchedule(id) : null;
  if (!schedule) return { actor: null, schedule: null, response: jsonError("Schedule not found.", 404) };
  return { actor, schedule, response: null };
}

export async function loadDay(
  rawId: string,
): Promise<{ day: ScheduleDay; response: null } | { day: null; response: NextResponse }> {
  const { response } = await requireApiTrainer();
  if (response) return { day: null, response };
  const id = parseId(rawId);
  if (!id) return { day: null, response: jsonError("Day not found.", 404) };
  try {
    return { day: await requireDay(id), response: null };
  } catch (err) {
    if (err instanceof PracticeError) return { day: null, response: jsonError(err.message, err.status) };
    throw err;
  }
}
