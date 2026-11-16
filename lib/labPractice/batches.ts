import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeBatches,
  labPracticeBatchLabs,
  labPracticeBatchMembers,
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
import { enrollTrainees, type EnrollResult } from "@/lib/labPractice/enroll";
import type { Enrollment, PracticeActor } from "@/lib/labPractice/identity";
import { PracticeError } from "@/lib/labPractice/practice";

/**
 * Batches: a group of trainees following ONE day schedule.
 *
 *   lab_practice_batch_members  — who is in the batch (source of truth; one
 *                                 batch per trainee, enforced by a unique key)
 *   enrollments.batch_id        — DERIVED link: set on every member enrollment
 *                                 whose module the schedule uses and that the
 *                                 batch's trainer owns. Only this file writes it.
 *   batches.current_day         — pacing: days 1..current_day are open.
 *
 * Because membership is per person (not per module enrollment), one batch can
 * span any number of modules, and adding a trainee to a second batch is an
 * explicit MOVE instead of a silent overwrite.
 *
 * Authority mirrors enrollments: the batch's owning trainer manages it;
 * guidedLabs.manageAll may manage any batch; guidedLabs.viewAll may only read.
 */

export type Batch = typeof labPracticeBatches.$inferSelect;

export async function getBatch(batchId: number): Promise<Batch | null> {
  const [row] = await db.select().from(labPracticeBatches).where(eq(labPracticeBatches.id, batchId)).limit(1);
  return row ?? null;
}

export function canManageBatch(actor: PracticeActor, batch: Pick<Batch, "trainerId">) {
  return Boolean((actor.trainer && actor.trainer.id === batch.trainerId) || actor.canManageAll);
}

export function canReadBatch(actor: PracticeActor, batch: Pick<Batch, "trainerId">) {
  return canManageBatch(actor, batch) || actor.canViewAll;
}

// ─────────────────────────────────────────────
// Read models
// ─────────────────────────────────────────────

export type BatchSummary = {
  id: number;
  name: string;
  isActive: boolean;
  trainerId: number;
  trainerName: string;
  /** null = legacy module batch (not yet converted). */
  scheduleId: number | null;
  scheduleName: string | null;
  moduleId: number | null;
  moduleTitle: string | null;
  memberCount: number;
  currentDay: number;
  totalDays: number;
};

/** Every batch, optionally one trainer's, newest schedule pacing first. */
export async function listBatches(opts: { trainerId?: number; scheduleId?: number } = {}): Promise<BatchSummary[]> {
  const rows = await db
    .select({
      id: labPracticeBatches.id,
      name: labPracticeBatches.name,
      isActive: labPracticeBatches.isActive,
      trainerId: labPracticeBatches.trainerId,
      trainerName: labPracticeEmployees.fullName,
      scheduleId: labPracticeBatches.scheduleId,
      scheduleName: labPracticeSchedules.name,
      moduleId: labPracticeBatches.moduleId,
      moduleTitle: labPracticeModules.title,
      currentDay: labPracticeBatches.currentDay,
      memberCount: sql<number>`(select count(*) from ${labPracticeBatchMembers} where ${labPracticeBatchMembers.batchId} = ${labPracticeBatches.id})`,
      totalDays: sql<number>`(select count(*) from ${labPracticeScheduleDays} where ${labPracticeScheduleDays.scheduleId} = ${labPracticeBatches.scheduleId})`,
    })
    .from(labPracticeBatches)
    .innerJoin(labPracticeTrainers, eq(labPracticeTrainers.id, labPracticeBatches.trainerId))
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeTrainers.employeeId))
    .leftJoin(labPracticeSchedules, eq(labPracticeSchedules.id, labPracticeBatches.scheduleId))
    .leftJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeBatches.moduleId))
    .where(
      and(
        opts.trainerId ? eq(labPracticeBatches.trainerId, opts.trainerId) : undefined,
        opts.scheduleId ? eq(labPracticeBatches.scheduleId, opts.scheduleId) : undefined,
      ),
    )
    .orderBy(asc(labPracticeBatches.name));
  return rows.map((r) => ({
    ...r,
    memberCount: Number(r.memberCount),
    totalDays: Number(r.totalDays),
    currentDay: Number(r.currentDay),
  }));
}

/** Batches whose schedule uses at least one lab of `moduleId` (plus legacy
 *  module batches of that module). */
export async function listBatchesUsingModule(moduleId: number, trainerId?: number) {
  const scheduleIds = (
    await db
      .selectDistinct({ id: labPracticeScheduleDayLabs.scheduleId })
      .from(labPracticeScheduleDayLabs)
      .innerJoin(labPracticeLabs, eq(labPracticeLabs.id, labPracticeScheduleDayLabs.labId))
      .where(eq(labPracticeLabs.moduleId, moduleId))
  ).map((r) => r.id);
  const all = await listBatches({ trainerId });
  return all.filter((b) => b.moduleId === moduleId || (b.scheduleId != null && scheduleIds.includes(b.scheduleId)));
}

export type BatchMemberRow = { traineeId: number; fullName: string; email: string; addedAt: Date };

export async function listMembers(batchId: number): Promise<BatchMemberRow[]> {
  return db
    .select({
      traineeId: labPracticeBatchMembers.traineeId,
      fullName: labPracticeEmployees.fullName,
      email: labPracticeEmployees.email,
      addedAt: labPracticeBatchMembers.addedAt,
    })
    .from(labPracticeBatchMembers)
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeBatchMembers.traineeId))
    .where(eq(labPracticeBatchMembers.batchId, batchId))
    .orderBy(asc(labPracticeEmployees.fullName));
}

/** The batch each trainee belongs to (if any). */
export async function batchOfTrainees(traineeIds: number[]) {
  if (!traineeIds.length) return new Map<number, { batchId: number; name: string; trainerId: number }>();
  const rows = await db
    .select({
      traineeId: labPracticeBatchMembers.traineeId,
      batchId: labPracticeBatches.id,
      name: labPracticeBatches.name,
      trainerId: labPracticeBatches.trainerId,
    })
    .from(labPracticeBatchMembers)
    .innerJoin(labPracticeBatches, eq(labPracticeBatches.id, labPracticeBatchMembers.batchId))
    .where(inArray(labPracticeBatchMembers.traineeId, traineeIds));
  return new Map(rows.map((r) => [r.traineeId, { batchId: r.batchId, name: r.name, trainerId: r.trainerId }]));
}

/** Modules (by id) that have at least one lab in the schedule. */
export async function scheduleModuleIds(scheduleId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ moduleId: labPracticeLabs.moduleId })
    .from(labPracticeScheduleDayLabs)
    .innerJoin(labPracticeLabs, eq(labPracticeLabs.id, labPracticeScheduleDayLabs.labId))
    .where(eq(labPracticeScheduleDayLabs.scheduleId, scheduleId));
  return rows.map((r) => r.moduleId).sort((a, b) => a - b);
}

// ─────────────────────────────────────────────
// Membership
// ─────────────────────────────────────────────

export type MemberConflict = {
  traineeId: number;
  traineeName: string;
  batchId: number;
  batchName: string;
  /** The caller may move this trainee out of their current batch. */
  canMove: boolean;
};

export type AddMembersResult = EnrollResult & {
  added: number;
  moved: number;
  alreadyMember: number;
  /** Trainees already in another batch (not added unless `move` was set). */
  batchConflicts: MemberConflict[];
};

function emptyEnroll(): EnrollResult {
  return { enrolled: 0, reactivated: 0, unchanged: 0, conflicts: [], invalid: [], enrollmentIds: [] };
}

/**
 * Add trainees (employee ids) to a batch. A trainee already in ANOTHER batch
 * is reported in `batchConflicts` and left alone — unless `move` is true and
 * the caller may manage that other batch, in which case they are moved (their
 * progress is untouched; only which batch paces them changes).
 */
export async function addBatchMembers(
  actor: PracticeActor,
  batch: Batch,
  rawTraineeIds: number[],
  move = false,
): Promise<AddMembersResult> {
  if (!batch.isActive) throw new PracticeError("This batch is archived.", 409);
  if (batch.scheduleId == null) {
    throw new PracticeError("Module batches are retired. Run the batch conversion, then use a schedule batch.", 409);
  }
  const ids = [...new Set(rawTraineeIds)];
  const valid = await db
    .select({ id: labPracticeEmployees.id, fullName: labPracticeEmployees.fullName })
    .from(labPracticeEmployees)
    .where(and(inArray(labPracticeEmployees.id, ids), eq(labPracticeEmployees.isActive, true)));
  const nameOf = new Map(valid.map((v) => [v.id, v.fullName]));
  const current = await batchOfTrainees(valid.map((v) => v.id));

  const result: AddMembersResult = { ...emptyEnroll(), added: 0, moved: 0, alreadyMember: 0, batchConflicts: [] };
  result.invalid = ids.filter((id) => !nameOf.has(id));
  const toAdd: number[] = [];
  const toSync: number[] = [];

  for (const { id } of valid) {
    const cur = current.get(id);
    if (cur?.batchId === batch.id) {
      result.alreadyMember++;
      toSync.push(id);
      continue;
    }
    if (cur) {
      const canMove = canManageBatch(actor, cur);
      if (!move || !canMove) {
        result.batchConflicts.push({
          traineeId: id,
          traineeName: nameOf.get(id) ?? "Trainee",
          batchId: cur.batchId,
          batchName: cur.name,
          canMove,
        });
        continue;
      }
      await releaseMember(cur.batchId, id);
      result.moved++;
    }
    toAdd.push(id);
  }

  if (toAdd.length) {
    try {
      await db.insert(labPracticeBatchMembers).values(toAdd.map((traineeId) => ({ batchId: batch.id, traineeId })));
    } catch (err) {
      const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
      if (code === "ER_DUP_ENTRY") throw new PracticeError("Someone else just changed one of these trainees' batch — refresh and try again.", 409);
      throw err;
    }
    result.added = toAdd.length;
    toSync.push(...toAdd);
  }

  const enroll = await syncMemberEnrollments(batch, toSync);
  return { ...result, ...enroll, invalid: [...new Set([...result.invalid, ...enroll.invalid])] };
}

/** Take a trainee out of a batch: membership row gone, enrollments unlinked
 *  (they keep every enrollment and all progress). */
export async function releaseMember(batchId: number, traineeId: number) {
  await db.transaction(async (tx) => {
    await tx
      .delete(labPracticeBatchMembers)
      .where(and(eq(labPracticeBatchMembers.batchId, batchId), eq(labPracticeBatchMembers.traineeId, traineeId)));
    await tx
      .update(labPracticeEnrollments)
      .set({ batchId: null })
      .where(and(eq(labPracticeEnrollments.batchId, batchId), eq(labPracticeEnrollments.traineeId, traineeId)));
  });
}

/**
 * Make members' enrollments match the batch's schedule: enroll each member in
 * every module the schedule uses (under the batch's trainer) and link those
 * enrollments to the batch. Modules where the trainee is already enrolled
 * under ANOTHER trainer are reported in `conflicts` and stay with that trainer.
 * `traineeIds` defaults to every member. Safe to call repeatedly.
 * `reactivate: false` (background re-syncs) skips unassigned enrollments.
 */
export async function syncMemberEnrollments(
  batch: Batch,
  traineeIds?: number[],
  { reactivate = true }: { reactivate?: boolean } = {},
): Promise<EnrollResult> {
  const total = emptyEnroll();
  if (batch.scheduleId == null || !batch.isActive) return total;
  const ids = traineeIds ?? (await listMembers(batch.id)).map((m) => m.traineeId);
  if (!ids.length) return total;
  const moduleIds = await scheduleModuleIds(batch.scheduleId);
  for (const moduleId of moduleIds) {
    const r = await enrollTrainees(batch.trainerId, moduleId, ids, batch.id, { reactivate }).catch((err) => {
      // An inactive module is skipped rather than failing the whole batch.
      if (err instanceof PracticeError && err.status === 404) return null;
      throw err;
    });
    if (!r) continue;
    total.enrolled += r.enrolled;
    total.reactivated += r.reactivated;
    total.unchanged += r.unchanged;
    total.conflicts.push(...r.conflicts);
    total.invalid.push(...r.invalid);
    total.enrollmentIds.push(...r.enrollmentIds);
  }
  total.conflicts = [...new Set(total.conflicts)];
  total.invalid = [...new Set(total.invalid)];
  return total;
}

/** Re-sync every active batch following a schedule (after its days change,
 *  so members get enrolled in modules newly added to the plan). */
export async function syncScheduleBatches(scheduleId: number) {
  const batches = await db
    .select()
    .from(labPracticeBatches)
    .where(and(eq(labPracticeBatches.scheduleId, scheduleId), eq(labPracticeBatches.isActive, true)));
  // Never re-activate an enrollment a trainer unassigned on purpose.
  for (const b of batches) await syncMemberEnrollments(b, undefined, { reactivate: false });
}

/** After an individual enrollment: if the trainee's batch (same trainer)
 *  uses that module, link the enrollment to it so the batch paces it. */
export async function linkEnrollmentsToMemberBatch(enrollmentIds: number[]) {
  if (!enrollmentIds.length) return;
  await db.execute(sql`
    update ${labPracticeEnrollments} e
    join ${labPracticeBatchMembers} m on m.trainee_id = e.trainee_id
    join ${labPracticeBatches} b on b.id = m.batch_id
    set e.batch_id = b.id
    where e.id in (${sql.join(enrollmentIds.map((id) => sql`${id}`), sql`, `)})
      and b.trainer_id = e.trainer_id
      and b.schedule_id is not null
      and exists (
        select 1 from ${labPracticeScheduleDayLabs} sdl
        join ${labPracticeLabs} l on l.id = sdl.lab_id
        where sdl.schedule_id = b.schedule_id and l.module_id = e.module_id
      )`);
}

// ─────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────

/** Delete a batch: members fall back to their overrides / the default.
 *  Membership, day rows and legacy batch labs cascade. */
export async function deleteBatch(batch: Batch) {
  await db.transaction(async (tx) => {
    await tx
      .update(labPracticeEnrollments)
      .set({ batchId: null })
      .where(eq(labPracticeEnrollments.batchId, batch.id));
    await tx.delete(labPracticeBatchLabs).where(eq(labPracticeBatchLabs.batchId, batch.id));
    await tx.delete(labPracticeBatches).where(eq(labPracticeBatches.id, batch.id));
  });
}

// ─────────────────────────────────────────────
// Legacy module batches (read + edit until converted)
// ─────────────────────────────────────────────

/** Labs of `moduleId` among `labIds` (throws if any don't belong). */
async function assertModuleLabs(moduleId: number, labIds: number[]) {
  if (!labIds.length) return;
  const found = await db
    .select({ id: labPracticeLabs.id })
    .from(labPracticeLabs)
    .where(and(eq(labPracticeLabs.moduleId, moduleId), inArray(labPracticeLabs.id, labIds)));
  if (found.length !== new Set(labIds).size) throw new PracticeError("Some labs aren't in this module.");
}

/** LEGACY: a module batch's selected labs. */
export async function batchLabIds(batchId: number): Promise<number[]> {
  const rows = await db.select().from(labPracticeBatchLabs).where(eq(labPracticeBatchLabs.batchId, batchId));
  return rows.map((r) => r.labId);
}

/** LEGACY: replace a module batch's visible-lab selection. */
export async function setBatchLabs(batch: Batch, rawLabIds: number[]) {
  if (batch.moduleId == null) throw new PracticeError("Schedule batches are paced by days, not labs.", 409);
  const labIds = [...new Set(rawLabIds)];
  await assertModuleLabs(batch.moduleId, labIds);
  await db.transaction(async (tx) => {
    await tx.delete(labPracticeBatchLabs).where(eq(labPracticeBatchLabs.batchId, batch.id));
    if (labIds.length) {
      await tx.insert(labPracticeBatchLabs).values(labIds.map((labId) => ({ batchId: batch.id, labId })));
    }
  });
}

/** LEGACY: take one enrollment out of a module batch. */
export async function removeBatchMember(batch: Batch, enrollmentId: number) {
  const [e] = await db
    .select({ traineeId: labPracticeEnrollments.traineeId })
    .from(labPracticeEnrollments)
    .where(and(eq(labPracticeEnrollments.id, enrollmentId), eq(labPracticeEnrollments.batchId, batch.id)))
    .limit(1);
  if (e) await releaseMember(batch.id, e.traineeId);
}

// ─────────────────────────────────────────────
// Per-trainee lab override
// ─────────────────────────────────────────────

/** true = show, false = hide, null = reset to batch/default. */
export async function setLabOverride(enrollment: Enrollment, labId: number, visible: boolean | null) {
  await assertModuleLabs(enrollment.moduleId, [labId]);
  if (visible === null) {
    await db
      .delete(labPracticeEnrollmentLabOverrides)
      .where(
        and(
          eq(labPracticeEnrollmentLabOverrides.enrollmentId, enrollment.id),
          eq(labPracticeEnrollmentLabOverrides.labId, labId),
        ),
      );
    return;
  }
  await db
    .insert(labPracticeEnrollmentLabOverrides)
    .values({ enrollmentId: enrollment.id, labId, visible })
    .onDuplicateKeyUpdate({ set: { visible } });
}
