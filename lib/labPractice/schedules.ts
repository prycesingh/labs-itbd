import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeBatchDays,
  labPracticeBatches,
  labPracticeEmployees,
  labPracticeEnrollmentLabOverrides,
  labPracticeEnrollments,
  labPracticeLabs,
  labPracticeModules,
  labPracticeScheduleDayLabs,
  labPracticeScheduleDays,
  labPracticeSchedules,
  labPracticeTrainers,
} from "@/DB/labPracticeSchema";
import type { Batch } from "@/lib/labPractice/batches";
import { PracticeError } from "@/lib/labPractice/practice";
import { planFromTitles, planPerDay, type GenLab } from "@/lib/labPractice/scheduleGenerator";

/**
 * Day schedules: Day 1..n, each holding labs from ANY module (a lab sits in at
 * most one day per schedule). Schedule batches switch days on/off; a day being
 * on makes its labs visible to the batch (see lib/labPractice/visibility.ts).
 *
 * Schedules are shared curriculum (any trainer edits them); batches keep their
 * owner rules (lib/labPractice/batches.ts).
 */

export type Schedule = typeof labPracticeSchedules.$inferSelect;
export type ScheduleDay = typeof labPracticeScheduleDays.$inferSelect;

export async function getSchedule(id: number): Promise<Schedule | null> {
  const [row] = await db.select().from(labPracticeSchedules).where(eq(labPracticeSchedules.id, id)).limit(1);
  return row ?? null;
}

async function getDay(dayId: number): Promise<ScheduleDay | null> {
  const [row] = await db.select().from(labPracticeScheduleDays).where(eq(labPracticeScheduleDays.id, dayId)).limit(1);
  return row ?? null;
}

export async function requireDay(dayId: number) {
  const day = await getDay(dayId);
  if (!day) throw new PracticeError("Day not found.", 404);
  return day;
}

// ─────────────────────────────────────────────
// Read models
// ─────────────────────────────────────────────

export type ScheduleListItem = {
  id: number;
  name: string;
  isActive: boolean;
  dayCount: number;
  labCount: number;
  batchCount: number;
};

export async function listSchedules(): Promise<ScheduleListItem[]> {
  const rows = await db
    .select({
      id: labPracticeSchedules.id,
      name: labPracticeSchedules.name,
      isActive: labPracticeSchedules.isActive,
      dayCount: sql<number>`(select count(*) from ${labPracticeScheduleDays} where ${labPracticeScheduleDays.scheduleId} = ${labPracticeSchedules.id})`,
      labCount: sql<number>`(select count(*) from ${labPracticeScheduleDayLabs} where ${labPracticeScheduleDayLabs.scheduleId} = ${labPracticeSchedules.id})`,
      batchCount: sql<number>`(select count(*) from ${labPracticeBatches} where ${labPracticeBatches.scheduleId} = ${labPracticeSchedules.id})`,
    })
    .from(labPracticeSchedules)
    .orderBy(asc(labPracticeSchedules.name));
  return rows.map((r) => ({
    ...r,
    dayCount: Number(r.dayCount),
    labCount: Number(r.labCount),
    batchCount: Number(r.batchCount),
  }));
}

export type ScheduleLab = {
  labId: number;
  title: string;
  moduleId: number;
  moduleTitle: string;
  isActive: boolean;
};

export type ScheduleDetail = {
  schedule: Schedule;
  days: (ScheduleDay & { labs: ScheduleLab[] })[];
  /** Active labs of active modules that aren't in any day yet, by module. */
  unscheduled: { moduleId: number; moduleTitle: string; labs: ScheduleLab[] }[];
  modules: { id: number; title: string; labCount: number }[];
};

export async function getScheduleDetail(scheduleId: number): Promise<ScheduleDetail | null> {
  const schedule = await getSchedule(scheduleId);
  if (!schedule) return null;

  const [days, placed, allLabs] = await Promise.all([
    db
      .select()
      .from(labPracticeScheduleDays)
      .where(eq(labPracticeScheduleDays.scheduleId, scheduleId))
      .orderBy(asc(labPracticeScheduleDays.dayNo)),
    db
      .select()
      .from(labPracticeScheduleDayLabs)
      .where(eq(labPracticeScheduleDayLabs.scheduleId, scheduleId))
      .orderBy(asc(labPracticeScheduleDayLabs.sequenceNo)),
    db
      .select({
        labId: labPracticeLabs.id,
        title: labPracticeLabs.title,
        sequenceNo: labPracticeLabs.sequenceNo,
        isActive: labPracticeLabs.isActive,
        moduleId: labPracticeModules.id,
        moduleTitle: labPracticeModules.title,
        moduleActive: labPracticeModules.isActive,
      })
      .from(labPracticeLabs)
      .innerJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeLabs.moduleId))
      .orderBy(asc(labPracticeModules.title), asc(labPracticeLabs.sequenceNo)),
  ]);

  const labById = new Map(allLabs.map((l) => [l.labId, l]));
  const toLab = (l: (typeof allLabs)[number]): ScheduleLab => ({
    labId: l.labId,
    title: l.title,
    moduleId: l.moduleId,
    moduleTitle: l.moduleTitle,
    isActive: l.isActive && l.moduleActive,
  });

  const placedIds = new Set(placed.map((p) => p.labId));
  const unscheduledMap = new Map<number, ScheduleDetail["unscheduled"][number]>();
  const moduleCounts = new Map<number, { id: number; title: string; labCount: number }>();
  for (const l of allLabs) {
    if (!l.moduleActive) continue;
    if (l.isActive) {
      const mc = moduleCounts.get(l.moduleId) ?? { id: l.moduleId, title: l.moduleTitle, labCount: 0 };
      mc.labCount++;
      moduleCounts.set(l.moduleId, mc);
    }
    if (!l.isActive || placedIds.has(l.labId)) continue;
    const g = unscheduledMap.get(l.moduleId) ?? { moduleId: l.moduleId, moduleTitle: l.moduleTitle, labs: [] };
    g.labs.push(toLab(l));
    unscheduledMap.set(l.moduleId, g);
  }

  return {
    schedule,
    days: days.map((d) => ({
      ...d,
      labs: placed
        .filter((p) => p.dayId === d.id)
        .map((p) => labById.get(p.labId))
        .filter((l): l is (typeof allLabs)[number] => !!l)
        .map(toLab),
    })),
    unscheduled: [...unscheduledMap.values()],
    modules: [...moduleCounts.values()],
  };
}

// ─────────────────────────────────────────────
// Schedule + day writes
// ─────────────────────────────────────────────

export async function createSchedule(trainerId: number, name: string) {
  const [res] = await db.insert(labPracticeSchedules).values({ name, createdBy: trainerId });
  return res.insertId;
}

/**
 * Delete a schedule — never blocked. Batches that follow it go with it (a
 * schedule batch means nothing without its days); their trainees stay
 * enrolled with all progress and fall back to the first lab of each module
 * plus any individual changes. Days, day labs and batch days cascade.
 */
export async function deleteSchedule(schedule: Schedule) {
  await db.transaction(async (tx) => {
    const batchIds = (
      await tx
        .select({ id: labPracticeBatches.id })
        .from(labPracticeBatches)
        .where(eq(labPracticeBatches.scheduleId, schedule.id))
    ).map((b) => b.id);
    if (batchIds.length) {
      await tx
        .update(labPracticeEnrollments)
        .set({ batchId: null })
        .where(inArray(labPracticeEnrollments.batchId, batchIds));
      await tx.delete(labPracticeBatches).where(inArray(labPracticeBatches.id, batchIds));
    }
    await tx.delete(labPracticeSchedules).where(eq(labPracticeSchedules.id, schedule.id));
  });
}

async function maxDayNo(scheduleId: number) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${labPracticeScheduleDays.dayNo}), 0)` })
    .from(labPracticeScheduleDays)
    .where(eq(labPracticeScheduleDays.scheduleId, scheduleId));
  return Number(row?.max ?? 0);
}

export async function addDay(scheduleId: number, title: string | null) {
  const dayNo = (await maxDayNo(scheduleId)) + 1;
  const [res] = await db.insert(labPracticeScheduleDays).values({ scheduleId, dayNo, title });
  return res.insertId;
}

export async function renameDay(dayId: number, title: string | null) {
  await db.update(labPracticeScheduleDays).set({ title }).where(eq(labPracticeScheduleDays.id, dayId));
}

/** Delete a day (its labs become unscheduled) and close the numbering gap. */
export async function deleteDay(day: ScheduleDay) {
  await db.transaction(async (tx) => {
    await tx.delete(labPracticeScheduleDays).where(eq(labPracticeScheduleDays.id, day.id));
    // ORDER BY ascending so each decrement lands in the slot just freed
    // (day_no is unique per schedule).
    await tx.execute(
      sql`update ${labPracticeScheduleDays} set ${labPracticeScheduleDays.dayNo} = ${labPracticeScheduleDays.dayNo} - 1 where ${labPracticeScheduleDays.scheduleId} = ${day.scheduleId} and ${labPracticeScheduleDays.dayNo} > ${day.dayNo} order by ${labPracticeScheduleDays.dayNo} asc`,
    );
  });
}

/** Swap a day with its neighbour (-1 = earlier, 1 = later). */
export async function moveDay(day: ScheduleDay, dir: -1 | 1) {
  const [other] = await db
    .select()
    .from(labPracticeScheduleDays)
    .where(
      and(
        eq(labPracticeScheduleDays.scheduleId, day.scheduleId),
        eq(labPracticeScheduleDays.dayNo, day.dayNo + dir),
      ),
    )
    .limit(1);
  if (!other) return;
  await db.transaction(async (tx) => {
    await tx.update(labPracticeScheduleDays).set({ dayNo: -1 }).where(eq(labPracticeScheduleDays.id, day.id));
    await tx.update(labPracticeScheduleDays).set({ dayNo: day.dayNo }).where(eq(labPracticeScheduleDays.id, other.id));
    await tx.update(labPracticeScheduleDays).set({ dayNo: other.dayNo }).where(eq(labPracticeScheduleDays.id, day.id));
  });
}

async function assertLabsExist(labIds: number[]) {
  if (!labIds.length) return;
  const found = await db.select({ id: labPracticeLabs.id }).from(labPracticeLabs).where(inArray(labPracticeLabs.id, labIds));
  if (found.length !== new Set(labIds).size) throw new PracticeError("Some labs no longer exist.", 404);
}

/** Replace a day's labs (in this order). Labs coming from another day of the
 *  same schedule are MOVED here. */
export async function setDayLabs(day: ScheduleDay, rawLabIds: number[]) {
  const labIds = [...new Set(rawLabIds)];
  await assertLabsExist(labIds);
  await db.transaction(async (tx) => {
    await tx.delete(labPracticeScheduleDayLabs).where(eq(labPracticeScheduleDayLabs.dayId, day.id));
    if (!labIds.length) return;
    await tx
      .delete(labPracticeScheduleDayLabs)
      .where(
        and(
          eq(labPracticeScheduleDayLabs.scheduleId, day.scheduleId),
          inArray(labPracticeScheduleDayLabs.labId, labIds),
        ),
      );
    await tx.insert(labPracticeScheduleDayLabs).values(
      labIds.map((labId, i) => ({ scheduleId: day.scheduleId, dayId: day.id, labId, sequenceNo: i + 1 })),
    );
  });
}

/** Append labs to a day (moving them from other days if needed). */
export async function addLabsToDay(day: ScheduleDay, labIds: number[]) {
  const current = await db
    .select({ labId: labPracticeScheduleDayLabs.labId })
    .from(labPracticeScheduleDayLabs)
    .where(eq(labPracticeScheduleDayLabs.dayId, day.id))
    .orderBy(asc(labPracticeScheduleDayLabs.sequenceNo));
  const ids = current.map((c) => c.labId);
  await setDayLabs(day, [...ids, ...labIds.filter((id) => !ids.includes(id))]);
}

export async function unscheduleLab(scheduleId: number, labId: number) {
  await db
    .delete(labPracticeScheduleDayLabs)
    .where(and(eq(labPracticeScheduleDayLabs.scheduleId, scheduleId), eq(labPracticeScheduleDayLabs.labId, labId)));
}

// ─────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────

export type GenerateOptions = {
  moduleIds: number[];
  strategy: "fromTitles" | "perDay";
  perDay?: number;
  /** true: wipe every day first. false: only place labs not yet scheduled. */
  replace: boolean;
  dryRun: boolean;
};

export type GeneratePreview = {
  days: { dayNo: number; labCount: number; isNew: boolean }[];
  placed: number;
  unplaced: number;
  totalDays: number;
};

export async function generateDays(scheduleId: number, opts: GenerateOptions): Promise<GeneratePreview> {
  if (!opts.moduleIds.length) throw new PracticeError("Pick at least one module.");
  const [labs, existingDays, placed] = await Promise.all([
    db
      .select({
        id: labPracticeLabs.id,
        moduleId: labPracticeLabs.moduleId,
        title: labPracticeLabs.title,
        sequenceNo: labPracticeLabs.sequenceNo,
      })
      .from(labPracticeLabs)
      .where(and(inArray(labPracticeLabs.moduleId, opts.moduleIds), eq(labPracticeLabs.isActive, true))),
    db.select().from(labPracticeScheduleDays).where(eq(labPracticeScheduleDays.scheduleId, scheduleId)),
    db
      .select({ labId: labPracticeScheduleDayLabs.labId })
      .from(labPracticeScheduleDayLabs)
      .where(eq(labPracticeScheduleDayLabs.scheduleId, scheduleId)),
  ]);

  const placedIds = new Set(placed.map((p) => p.labId));
  const candidates: GenLab[] = opts.replace ? labs : labs.filter((l) => !placedIds.has(l.id));
  const keptDays = opts.replace ? [] : existingDays;
  const lastDay = keptDays.reduce((m, d) => Math.max(m, d.dayNo), 0);

  const plan =
    opts.strategy === "fromTitles"
      ? planFromTitles(candidates, opts.moduleIds)
      : planPerDay(candidates, opts.moduleIds, opts.perDay ?? 5, lastDay + 1);

  const existingNos = new Set(keptDays.map((d) => d.dayNo));
  // fromTitles may leave gaps (e.g. days 1-17 then 28): fill so numbering stays 1..n.
  const maxNo = Math.max(lastDay, ...plan.days.keys());
  const preview: GeneratePreview = {
    days: [...plan.days.entries()].map(([dayNo, ids]) => ({ dayNo, labCount: ids.length, isNew: !existingNos.has(dayNo) })),
    placed: [...plan.days.values()].reduce((n, ids) => n + ids.length, 0),
    unplaced: plan.unplaced.length,
    totalDays: maxNo,
  };
  if (opts.dryRun) return preview;

  await db.transaction(async (tx) => {
    if (opts.replace) {
      await tx.delete(labPracticeScheduleDays).where(eq(labPracticeScheduleDays.scheduleId, scheduleId));
    }
    const dayIdByNo = new Map(keptDays.map((d) => [d.dayNo, d.id]));
    for (let no = 1; no <= maxNo; no++) {
      if (dayIdByNo.has(no)) continue;
      const [res] = await tx.insert(labPracticeScheduleDays).values({ scheduleId, dayNo: no });
      dayIdByNo.set(no, res.insertId);
    }
    const nextSeq = new Map<number, number>();
    if (!opts.replace) {
      const seqs = await tx
        .select({ dayId: labPracticeScheduleDayLabs.dayId, max: sql<number>`max(${labPracticeScheduleDayLabs.sequenceNo})` })
        .from(labPracticeScheduleDayLabs)
        .where(eq(labPracticeScheduleDayLabs.scheduleId, scheduleId))
        .groupBy(labPracticeScheduleDayLabs.dayId);
      for (const s of seqs) nextSeq.set(s.dayId, Number(s.max ?? 0));
    }
    const rows: (typeof labPracticeScheduleDayLabs.$inferInsert)[] = [];
    for (const [dayNo, ids] of plan.days) {
      const dayId = dayIdByNo.get(dayNo)!;
      let seq = nextSeq.get(dayId) ?? 0;
      for (const labId of ids) rows.push({ scheduleId, dayId, labId, sequenceNo: ++seq });
    }
    for (let i = 0; i < rows.length; i += 200) {
      await tx.insert(labPracticeScheduleDayLabs).values(rows.slice(i, i + 200));
    }
  });
  return preview;
}

// ─────────────────────────────────────────────
// Schedule batches: active days + individual day overrides
// ─────────────────────────────────────────────

export async function createScheduleBatch(trainerId: number, scheduleId: number, name: string) {
  const [res] = await db.insert(labPracticeBatches).values({ scheduleId, trainerId, name, moduleId: null });
  return res.insertId;
}

function assertScheduleBatch(batch: Batch): number {
  if (batch.scheduleId == null) throw new PracticeError("This batch doesn't follow a day schedule.", 409);
  return batch.scheduleId;
}

export async function setBatchDays(batch: Batch, rawDayIds: number[]) {
  const scheduleId = assertScheduleBatch(batch);
  const dayIds = [...new Set(rawDayIds)];
  if (dayIds.length) {
    const found = await db
      .select({ id: labPracticeScheduleDays.id })
      .from(labPracticeScheduleDays)
      .where(and(eq(labPracticeScheduleDays.scheduleId, scheduleId), inArray(labPracticeScheduleDays.id, dayIds)));
    if (found.length !== dayIds.length) throw new PracticeError("Some days aren't in this schedule.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(labPracticeBatchDays).where(eq(labPracticeBatchDays.batchId, batch.id));
    if (dayIds.length) await tx.insert(labPracticeBatchDays).values(dayIds.map((dayId) => ({ batchId: batch.id, dayId })));
  });
}

/** Switch on the earliest day that's still off. Returns its day number, or null. */
export async function activateNextDay(batch: Batch): Promise<number | null> {
  const scheduleId = assertScheduleBatch(batch);
  const [days, active] = await Promise.all([
    db
      .select()
      .from(labPracticeScheduleDays)
      .where(eq(labPracticeScheduleDays.scheduleId, scheduleId))
      .orderBy(asc(labPracticeScheduleDays.dayNo)),
    db.select().from(labPracticeBatchDays).where(eq(labPracticeBatchDays.batchId, batch.id)),
  ]);
  const on = new Set(active.map((a) => a.dayId));
  const next = days.find((d) => !on.has(d.id));
  if (!next) return null;
  await db.insert(labPracticeBatchDays).values({ batchId: batch.id, dayId: next.id }).onDuplicateKeyUpdate({
    set: { dayId: next.id },
  });
  return next.dayNo;
}

/**
 * Individual Show / Hide / reset of one day for one trainee in a schedule
 * batch — written as per-lab overrides on each of the trainee's enrollments
 * that hold that day's labs.
 */
export async function setTraineeDay(batch: Batch, traineeId: number, day: ScheduleDay, visible: boolean | null) {
  const scheduleId = assertScheduleBatch(batch);
  if (day.scheduleId !== scheduleId) throw new PracticeError("That day isn't in this batch's schedule.");
  const [enrollments, dayLabs] = await Promise.all([
    db
      .select({ id: labPracticeEnrollments.id, moduleId: labPracticeEnrollments.moduleId })
      .from(labPracticeEnrollments)
      .where(and(eq(labPracticeEnrollments.batchId, batch.id), eq(labPracticeEnrollments.traineeId, traineeId))),
    db
      .select({ labId: labPracticeLabs.id, moduleId: labPracticeLabs.moduleId })
      .from(labPracticeScheduleDayLabs)
      .innerJoin(labPracticeLabs, eq(labPracticeLabs.id, labPracticeScheduleDayLabs.labId))
      .where(eq(labPracticeScheduleDayLabs.dayId, day.id)),
  ]);
  if (!enrollments.length) throw new PracticeError("That trainee isn't in this batch.", 404);

  const pairs = enrollments.flatMap((e) =>
    dayLabs.filter((l) => l.moduleId === e.moduleId).map((l) => ({ enrollmentId: e.id, labId: l.labId })),
  );
  if (!pairs.length) return;

  await db.transaction(async (tx) => {
    for (const p of pairs) {
      if (visible === null) {
        await tx
          .delete(labPracticeEnrollmentLabOverrides)
          .where(
            and(
              eq(labPracticeEnrollmentLabOverrides.enrollmentId, p.enrollmentId),
              eq(labPracticeEnrollmentLabOverrides.labId, p.labId),
            ),
          );
      } else {
        await tx
          .insert(labPracticeEnrollmentLabOverrides)
          .values({ ...p, visible })
          .onDuplicateKeyUpdate({ set: { visible } });
      }
    }
  });
}

// ─────────────────────────────────────────────
// Read models for schedule batches
// ─────────────────────────────────────────────

export type ScheduleBatchRow = {
  id: number;
  name: string;
  isActive: boolean;
  trainerId: number;
  trainerName: string;
  memberCount: number;
  activeDays: number;
  lastActiveDay: number | null;
};

/** Batches following a schedule (optionally only one trainer's). */
export async function listScheduleBatches(scheduleId: number, trainerId?: number): Promise<ScheduleBatchRow[]> {
  const rows = await db
    .select({
      id: labPracticeBatches.id,
      name: labPracticeBatches.name,
      isActive: labPracticeBatches.isActive,
      trainerId: labPracticeBatches.trainerId,
      trainerName: labPracticeEmployees.fullName,
      memberCount: sql<number>`(select count(distinct ${labPracticeEnrollments.traineeId}) from ${labPracticeEnrollments} where ${labPracticeEnrollments.batchId} = ${labPracticeBatches.id})`,
      activeDays: sql<number>`(select count(*) from ${labPracticeBatchDays} where ${labPracticeBatchDays.batchId} = ${labPracticeBatches.id})`,
      lastActiveDay: sql<number | null>`(select max(${labPracticeScheduleDays.dayNo}) from ${labPracticeBatchDays} join ${labPracticeScheduleDays} on ${labPracticeScheduleDays.id} = ${labPracticeBatchDays.dayId} where ${labPracticeBatchDays.batchId} = ${labPracticeBatches.id})`,
    })
    .from(labPracticeBatches)
    .innerJoin(labPracticeTrainers, eq(labPracticeTrainers.id, labPracticeBatches.trainerId))
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeTrainers.employeeId))
    .where(
      and(
        eq(labPracticeBatches.scheduleId, scheduleId),
        trainerId ? eq(labPracticeBatches.trainerId, trainerId) : undefined,
      ),
    )
    .orderBy(asc(labPracticeBatches.name));
  return rows.map((r) => ({
    ...r,
    memberCount: Number(r.memberCount),
    activeDays: Number(r.activeDays),
    lastActiveDay: r.lastActiveDay == null ? null : Number(r.lastActiveDay),
  }));
}

export async function activeDayIds(batchId: number): Promise<Set<number>> {
  const rows = await db.select().from(labPracticeBatchDays).where(eq(labPracticeBatchDays.batchId, batchId));
  return new Set(rows.map((r) => r.dayId));
}

/** Lab ids that carry an individual override, per enrollment. */
export async function overriddenLabsByEnrollment(enrollmentIds: number[]): Promise<Map<number, Set<number>>> {
  const out = new Map<number, Set<number>>();
  if (!enrollmentIds.length) return out;
  const rows = await db
    .select({
      enrollmentId: labPracticeEnrollmentLabOverrides.enrollmentId,
      labId: labPracticeEnrollmentLabOverrides.labId,
    })
    .from(labPracticeEnrollmentLabOverrides)
    .where(inArray(labPracticeEnrollmentLabOverrides.enrollmentId, enrollmentIds));
  for (const r of rows) out.set(r.enrollmentId, (out.get(r.enrollmentId) ?? new Set()).add(r.labId));
  return out;
}
