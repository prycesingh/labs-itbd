import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labPracticeBatchDayOverrides, labPracticeBatches, labPracticeScheduleDays } from "@/DB/labPracticeSchema";
import { PracticeError } from "@/lib/labPractice/practice";

/**
 * Batch pacing = which days of its schedule a batch has open.
 *
 *   open(day) = day.isActive
 *               AND (exception for this batch+day ? exception.isOpen
 *                                                 : day.dayNo <= batch.currentDay)
 *
 *   - current_day is the pointer: "the batch is on Day N" opens 1..N.
 *   - Exceptions (lab_practice_batch_day_overrides) open a single day beyond
 *     the pointer ("open only Day 23") or close one inside it. Rows that agree
 *     with the pointer are pruned after every write, so each row is a real
 *     exception and the UI can show it as one.
 *   - A day switched off in the schedule (schedule_days.is_active = false) is
 *     closed for every batch.
 *   - Per-trainee lab overrides still win over all of this
 *     (lib/labPractice/visibility.ts).
 */

export { dayStates, isDayOpen, type DayState, type PacingDay } from "@/lib/labPractice/pacingRule";

/** Exceptions per batch: batchId → (dayId → isOpen). */
export async function loadDayExceptions(batchIds: number[]): Promise<Map<number, Map<number, boolean>>> {
  const out = new Map<number, Map<number, boolean>>();
  if (!batchIds.length) return out;
  const rows = await db
    .select()
    .from(labPracticeBatchDayOverrides)
    .where(inArray(labPracticeBatchDayOverrides.batchId, batchIds));
  for (const r of rows) {
    const m = out.get(r.batchId) ?? new Map<number, boolean>();
    m.set(r.dayId, Boolean(r.isOpen));
    out.set(r.batchId, m);
  }
  return out;
}

// ─────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────

export type PacingBatch = { id: number; scheduleId: number | null; currentDay: number };

/**
 *   { step: 1 }          open the next day: the pointer moves to the next
 *                        switched-on day (days closed on purpose stay closed).
 *   { step: -1 }         close the pointer day and move back one.
 *   { through: N }       "open Days 1–N": pointer = N and every exception in
 *                        1..N is dropped, so the whole range is open. Days
 *                        opened early beyond N stay open. 0 closes everything.
 *   { day: id, open }    open / close ONE day without moving the pointer.
 */
export type PacingChange =
  | { step: 1 | -1 }
  | { through: number }
  | { dayId: number; open: boolean };

export async function changePacing(batch: PacingBatch, change: PacingChange): Promise<{ currentDay: number }> {
  if (batch.scheduleId == null) throw new PracticeError("This batch doesn't follow a day schedule.", 409);
  const days = await db
    .select({ id: labPracticeScheduleDays.id, dayNo: labPracticeScheduleDays.dayNo, isActive: labPracticeScheduleDays.isActive })
    .from(labPracticeScheduleDays)
    .where(eq(labPracticeScheduleDays.scheduleId, batch.scheduleId));
  const total = days.reduce((m, d) => Math.max(m, d.dayNo), 0);
  const byNo = new Map(days.map((d) => [d.dayNo, d]));
  let pointer = batch.currentDay;

  await db.transaction(async (tx) => {
    const dropException = (dayIds: number[]) =>
      dayIds.length
        ? tx
            .delete(labPracticeBatchDayOverrides)
            .where(and(eq(labPracticeBatchDayOverrides.batchId, batch.id), inArray(labPracticeBatchDayOverrides.dayId, dayIds)))
        : Promise.resolve();

    if ("step" in change && change.step === 1) {
      const next = days
        .filter((d) => d.isActive && d.dayNo > batch.currentDay)
        .reduce<number | null>((m, d) => (m === null || d.dayNo < m ? d.dayNo : m), null);
      if (next === null) throw new PracticeError("Every day is already open.", 409);
      pointer = next;
      await dropException([byNo.get(next)!.id]);
    } else if ("step" in change) {
      if (batch.currentDay <= 0) throw new PracticeError("Nothing is open yet.", 409);
      const old = byNo.get(batch.currentDay);
      pointer = batch.currentDay - 1;
      if (old) await dropException([old.id]);
    } else if ("through" in change) {
      pointer = Math.max(0, Math.min(total, Math.trunc(change.through)));
      await dropException(days.filter((d) => d.dayNo <= pointer || pointer === 0).map((d) => d.id));
    } else {
      const day = days.find((d) => d.id === change.dayId);
      if (!day) throw new PracticeError("That day isn't in this batch's schedule.", 404);
      if (!day.isActive && change.open) {
        throw new PracticeError(`Day ${day.dayNo} is switched off in the schedule. Switch it on there first.`, 409);
      }
      await tx
        .insert(labPracticeBatchDayOverrides)
        .values({ batchId: batch.id, dayId: day.id, isOpen: change.open })
        .onDuplicateKeyUpdate({ set: { isOpen: change.open } });
    }

    if (pointer !== batch.currentDay) {
      await tx.update(labPracticeBatches).set({ currentDay: pointer }).where(eq(labPracticeBatches.id, batch.id));
    }
    // Prune rows that now agree with the pointer, so only real exceptions remain.
    await tx.execute(sql`
      delete o from ${labPracticeBatchDayOverrides} o
      join ${labPracticeScheduleDays} d on d.id = o.day_id
      where o.batch_id = ${batch.id}
        and ((o.is_open = true and d.day_no <= ${pointer}) or (o.is_open = false and d.day_no > ${pointer}))
    `);
  });
  return { currentDay: pointer };
}
