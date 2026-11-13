import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeBatches,
  labPracticeBatchLabs,
  labPracticeEnrollmentLabOverrides,
} from "@/DB/labPracticeSchema";

/**
 * Loads the inputs of the pure visibility rule (lib/labPractice/visibility.ts)
 * for many enrollments at once: 3 queries total, regardless of how many
 * enrollments are passed. An INACTIVE batch is treated as no batch.
 */

export type VisibilityInputs = {
  batch: { id: number; name: string } | null;
  /** null when not in an (active) batch. */
  batchLabIds: number[] | null;
  overrides: Map<number, boolean>;
};

export async function loadVisibilityInputs(
  enrollments: { id: number; batchId: number | null }[],
): Promise<Map<number, VisibilityInputs>> {
  const enrollmentIds = enrollments.map((e) => e.id);
  const batchIds = [...new Set(enrollments.map((e) => e.batchId).filter((b): b is number => b != null))];

  const [batches, batchLabs, overrides] = await Promise.all([
    batchIds.length
      ? db
          .select({ id: labPracticeBatches.id, name: labPracticeBatches.name })
          .from(labPracticeBatches)
          .where(and(inArray(labPracticeBatches.id, batchIds), eq(labPracticeBatches.isActive, true)))
      : Promise.resolve([]),
    batchIds.length
      ? db.select().from(labPracticeBatchLabs).where(inArray(labPracticeBatchLabs.batchId, batchIds))
      : Promise.resolve([]),
    enrollmentIds.length
      ? db
          .select({
            enrollmentId: labPracticeEnrollmentLabOverrides.enrollmentId,
            labId: labPracticeEnrollmentLabOverrides.labId,
            visible: labPracticeEnrollmentLabOverrides.visible,
          })
          .from(labPracticeEnrollmentLabOverrides)
          .where(inArray(labPracticeEnrollmentLabOverrides.enrollmentId, enrollmentIds))
      : Promise.resolve([]),
  ]);

  const batchById = new Map(batches.map((b) => [b.id, b]));
  const labsByBatch = new Map<number, number[]>();
  for (const r of batchLabs) labsByBatch.set(r.batchId, [...(labsByBatch.get(r.batchId) ?? []), r.labId]);
  const overridesByEnrollment = new Map<number, Map<number, boolean>>();
  for (const o of overrides) {
    const m = overridesByEnrollment.get(o.enrollmentId) ?? new Map<number, boolean>();
    m.set(o.labId, Boolean(o.visible));
    overridesByEnrollment.set(o.enrollmentId, m);
  }

  return new Map(
    enrollments.map((e) => {
      const batch = e.batchId != null ? (batchById.get(e.batchId) ?? null) : null;
      return [
        e.id,
        {
          batch,
          batchLabIds: batch ? (labsByBatch.get(batch.id) ?? []) : null,
          overrides: overridesByEnrollment.get(e.id) ?? new Map(),
        },
      ] as const;
    }),
  );
}

export async function loadVisibilityInput(enrollment: { id: number; batchId: number | null }) {
  return (await loadVisibilityInputs([enrollment])).get(enrollment.id)!;
}
