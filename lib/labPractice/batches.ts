import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeBatches,
  labPracticeBatchLabs,
  labPracticeEmployees,
  labPracticeEnrollmentLabOverrides,
  labPracticeEnrollments,
  labPracticeLabs,
  labPracticeScheduleDayLabs,
  labPracticeTrainers,
} from "@/DB/labPracticeSchema";
import { enrollTrainees, type EnrollResult } from "@/lib/labPractice/enroll";
import type { Enrollment, PracticeActor } from "@/lib/labPractice/identity";
import { PracticeError } from "@/lib/labPractice/practice";

/**
 * Pacing batches (one module each) and per-trainee lab overrides.
 *
 * Authority mirrors enrollments: the batch's owning trainer manages it;
 * guidedLabs.manageAll may manage any batch; guidedLabs.viewAll may only read.
 */

export type Batch = typeof labPracticeBatches.$inferSelect;

export async function getBatch(batchId: number): Promise<Batch | null> {
  const [row] = await db.select().from(labPracticeBatches).where(eq(labPracticeBatches.id, batchId)).limit(1);
  return row ?? null;
}

export function canManageBatch(actor: PracticeActor, batch: Batch) {
  return (actor.trainer && actor.trainer.id === batch.trainerId) || actor.canManageAll;
}

export function canReadBatch(actor: PracticeActor, batch: Batch) {
  return canManageBatch(actor, batch) || actor.canViewAll;
}

export type BatchListItem = {
  id: number;
  name: string;
  isActive: boolean;
  trainerId: number;
  trainerName: string;
  memberCount: number;
  labIds: number[];
};

/** Batches of a module. `trainerId` limits to one trainer's batches. */
export async function listModuleBatches(moduleId: number, trainerId?: number): Promise<BatchListItem[]> {
  const trainerEmp = labPracticeEmployees;
  const rows = await db
    .select({
      id: labPracticeBatches.id,
      name: labPracticeBatches.name,
      isActive: labPracticeBatches.isActive,
      trainerId: labPracticeBatches.trainerId,
      trainerName: trainerEmp.fullName,
      memberCount: sql<number>`(select count(*) from ${labPracticeEnrollments} where ${labPracticeEnrollments.batchId} = ${labPracticeBatches.id} and ${labPracticeEnrollments.isActive} = true)`,
    })
    .from(labPracticeBatches)
    .innerJoin(labPracticeTrainers, eq(labPracticeTrainers.id, labPracticeBatches.trainerId))
    .innerJoin(trainerEmp, eq(trainerEmp.id, labPracticeTrainers.employeeId))
    .where(
      and(
        eq(labPracticeBatches.moduleId, moduleId),
        trainerId ? eq(labPracticeBatches.trainerId, trainerId) : undefined,
      ),
    )
    .orderBy(asc(labPracticeBatches.name));
  if (!rows.length) return [];

  const labs = await db
    .select()
    .from(labPracticeBatchLabs)
    .where(inArray(labPracticeBatchLabs.batchId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    ...r,
    memberCount: Number(r.memberCount),
    labIds: labs.filter((l) => l.batchId === r.id).map((l) => l.labId),
  }));
}

export async function createBatch(trainerId: number, moduleId: number, name: string): Promise<number> {
  const [res] = await db.insert(labPracticeBatches).values({ moduleId, trainerId, name });
  return res.insertId;
}

/** Labs of `moduleId` among `labIds` (throws if any don't belong). */
async function assertModuleLabs(moduleId: number, labIds: number[]) {
  if (!labIds.length) return;
  const found = await db
    .select({ id: labPracticeLabs.id })
    .from(labPracticeLabs)
    .where(and(eq(labPracticeLabs.moduleId, moduleId), inArray(labPracticeLabs.id, labIds)));
  if (found.length !== new Set(labIds).size) throw new PracticeError("Some labs aren't in this module.");
}

/** Replace the batch's visible-lab selection. */
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

/** Add trainees (employee ids) to a batch, enrolling them in the module under
 *  the batch's trainer when needed. Trainees owned by another trainer are
 *  reported as conflicts, never moved. */
export async function addBatchMembers(batch: Batch, traineeIds: number[]) {
  if (!batch.isActive) throw new PracticeError("This batch is archived.", 409);
  if (batch.moduleId != null) return enrollTrainees(batch.trainerId, batch.moduleId, traineeIds, batch.id);
  if (batch.scheduleId == null) throw new PracticeError("This batch has no module or schedule.", 409);

  // Schedule batch: enroll in EVERY active module that has labs in the schedule.
  const moduleIds = await scheduleModuleIds(batch.scheduleId);
  if (!moduleIds.length) throw new PracticeError("Add labs to the schedule's days before adding trainees.", 409);
  const total: EnrollResult = { enrolled: 0, reactivated: 0, unchanged: 0, conflicts: [], invalid: [], enrollmentIds: [] };
  for (const moduleId of moduleIds) {
    const r = await enrollTrainees(batch.trainerId, moduleId, traineeIds, batch.id).catch((err) => {
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

/** Modules (in title order) that have at least one lab in the schedule. */
export async function scheduleModuleIds(scheduleId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ moduleId: labPracticeLabs.moduleId })
    .from(labPracticeScheduleDayLabs)
    .innerJoin(labPracticeLabs, eq(labPracticeLabs.id, labPracticeScheduleDayLabs.labId))
    .where(eq(labPracticeScheduleDayLabs.scheduleId, scheduleId));
  return rows.map((r) => r.moduleId).sort((a, b) => a - b);
}

/** Take a trainee out of a schedule batch (every module enrollment). */
export async function removeScheduleBatchTrainee(batch: Batch, traineeId: number) {
  await db
    .update(labPracticeEnrollments)
    .set({ batchId: null })
    .where(and(eq(labPracticeEnrollments.batchId, batch.id), eq(labPracticeEnrollments.traineeId, traineeId)));
}

/** Take one enrollment out of the batch (back to individual / default). */
export async function removeBatchMember(batch: Batch, enrollmentId: number) {
  await db
    .update(labPracticeEnrollments)
    .set({ batchId: null })
    .where(and(eq(labPracticeEnrollments.id, enrollmentId), eq(labPracticeEnrollments.batchId, batch.id)));
}

/** Delete a batch: members fall back to their overrides / the default. */
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

/** Per-trainee override: true = show, false = hide, null = reset to batch/default. */
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
