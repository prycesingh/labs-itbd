import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeModules,
} from "@/DB/labPracticeSchema";
import { PracticeError } from "@/lib/labPractice/practice";

export type EnrollResult = {
  enrolled: number;
  reactivated: number;
  unchanged: number;
  conflicts: number[];
  invalid: number[];
  /** Enrollment ids now owned by `trainerId` (new, reactivated or unchanged). */
  enrollmentIds: number[];
};

/**
 * Enroll trainees (employee ids) in a module under `trainerId`.
 * - new pair                  -> inserted
 * - inactive enrollment       -> re-activated and moved to this trainer (history kept)
 * - active, same trainer      -> unchanged
 * - active, another trainer   -> reported as a conflict (never taken over)
 * `batchId`, when given, is set on every enrollment this call owns.
 */
export async function enrollTrainees(
  trainerId: number,
  moduleId: number,
  rawTraineeIds: number[],
  batchId: number | null = null,
): Promise<EnrollResult> {
  const [mod] = await db
    .select()
    .from(labPracticeModules)
    .where(eq(labPracticeModules.id, moduleId))
    .limit(1);
  if (!mod || !mod.isActive) throw new PracticeError("Module not found or inactive.", 404);

  const traineeIds = [...new Set(rawTraineeIds)];
  const validTrainees = await db
    .select({ id: labPracticeEmployees.id })
    .from(labPracticeEmployees)
    .where(and(inArray(labPracticeEmployees.id, traineeIds), eq(labPracticeEmployees.isActive, true)));
  const validIds = new Set(validTrainees.map((t) => t.id));

  const existing = await db
    .select()
    .from(labPracticeEnrollments)
    .where(
      and(
        eq(labPracticeEnrollments.moduleId, mod.id),
        inArray(labPracticeEnrollments.traineeId, traineeIds),
      ),
    );
  const byTrainee = new Map(existing.map((e) => [e.traineeId, e]));

  const result: EnrollResult = {
    enrolled: 0,
    reactivated: 0,
    unchanged: 0,
    conflicts: [],
    invalid: [],
    enrollmentIds: [],
  };
  const batchSet = batchId != null ? { batchId } : {};

  for (const traineeId of traineeIds) {
    if (!validIds.has(traineeId)) {
      result.invalid.push(traineeId);
      continue;
    }
    const e = byTrainee.get(traineeId);
    if (!e) {
      const [res] = await db.insert(labPracticeEnrollments).values({
        moduleId: mod.id,
        traineeId,
        trainerId,
        batchId,
      });
      result.enrolled++;
      result.enrollmentIds.push(res.insertId);
    } else if (!e.isActive) {
      await db
        .update(labPracticeEnrollments)
        .set({ isActive: true, trainerId, ...batchSet })
        .where(eq(labPracticeEnrollments.id, e.id));
      result.reactivated++;
      result.enrollmentIds.push(e.id);
    } else if (e.trainerId === trainerId) {
      if (batchId != null && e.batchId !== batchId) {
        await db.update(labPracticeEnrollments).set(batchSet).where(eq(labPracticeEnrollments.id, e.id));
      }
      result.unchanged++;
      result.enrollmentIds.push(e.id);
    } else {
      result.conflicts.push(traineeId);
    }
  }
  return result;
}
