import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeBatchDays,
  labPracticeBatches,
  labPracticeBatchLabs,
  labPracticeEnrollmentLabOverrides,
  labPracticeScheduleDayLabs,
  labPracticeScheduleDays,
} from "@/DB/labPracticeSchema";
import type { VisibilityBase } from "@/lib/labPractice/visibility";

/**
 * Loads the inputs of the pure visibility rule (lib/labPractice/visibility.ts)
 * for many enrollments at once — a fixed number of queries regardless of how
 * many enrollments are passed. An INACTIVE batch is treated as no batch.
 */

export type DayInfo = { id: number; no: number; title: string | null; active: boolean };

export type VisibilityInputs = {
  batch: { id: number; name: string; kind: "module" | "schedule"; scheduleId: number | null } | null;
  base: VisibilityBase;
  overrides: Map<number, boolean>;
  /** Schedule batches only: the day each scheduled lab sits in. */
  dayOfLab: Map<number, DayInfo>;
};

export async function loadVisibilityInputs(
  enrollments: { id: number; batchId: number | null }[],
): Promise<Map<number, VisibilityInputs>> {
  const enrollmentIds = enrollments.map((e) => e.id);
  const batchIds = [...new Set(enrollments.map((e) => e.batchId).filter((b): b is number => b != null))];

  const [batches, overrides] = await Promise.all([
    batchIds.length
      ? db
          .select({
            id: labPracticeBatches.id,
            name: labPracticeBatches.name,
            moduleId: labPracticeBatches.moduleId,
            scheduleId: labPracticeBatches.scheduleId,
          })
          .from(labPracticeBatches)
          .where(and(inArray(labPracticeBatches.id, batchIds), eq(labPracticeBatches.isActive, true)))
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

  const moduleBatchIds = batches.filter((b) => b.scheduleId == null).map((b) => b.id);
  const scheduleBatchIds = batches.filter((b) => b.scheduleId != null).map((b) => b.id);
  const scheduleIds = [...new Set(batches.map((b) => b.scheduleId).filter((s): s is number => s != null))];

  const [batchLabs, activeDays, scheduleLabs] = await Promise.all([
    moduleBatchIds.length
      ? db.select().from(labPracticeBatchLabs).where(inArray(labPracticeBatchLabs.batchId, moduleBatchIds))
      : Promise.resolve([]),
    scheduleBatchIds.length
      ? db.select().from(labPracticeBatchDays).where(inArray(labPracticeBatchDays.batchId, scheduleBatchIds))
      : Promise.resolve([]),
    scheduleIds.length
      ? db
          .select({
            scheduleId: labPracticeScheduleDayLabs.scheduleId,
            labId: labPracticeScheduleDayLabs.labId,
            dayId: labPracticeScheduleDays.id,
            dayNo: labPracticeScheduleDays.dayNo,
            title: labPracticeScheduleDays.title,
          })
          .from(labPracticeScheduleDayLabs)
          .innerJoin(labPracticeScheduleDays, eq(labPracticeScheduleDays.id, labPracticeScheduleDayLabs.dayId))
          .where(inArray(labPracticeScheduleDayLabs.scheduleId, scheduleIds))
      : Promise.resolve([]),
  ]);

  const labsByBatch = new Map<number, number[]>();
  for (const r of batchLabs) labsByBatch.set(r.batchId, [...(labsByBatch.get(r.batchId) ?? []), r.labId]);
  const activeDaysByBatch = new Map<number, Set<number>>();
  for (const r of activeDays) {
    const set = activeDaysByBatch.get(r.batchId) ?? new Set<number>();
    set.add(r.dayId);
    activeDaysByBatch.set(r.batchId, set);
  }
  const labsBySchedule = new Map<number, typeof scheduleLabs>();
  for (const r of scheduleLabs) labsBySchedule.set(r.scheduleId, [...(labsBySchedule.get(r.scheduleId) ?? []), r]);

  const batchById = new Map(batches.map((b) => [b.id, b]));
  const overridesByEnrollment = new Map<number, Map<number, boolean>>();
  for (const o of overrides) {
    const m = overridesByEnrollment.get(o.enrollmentId) ?? new Map<number, boolean>();
    m.set(o.labId, Boolean(o.visible));
    overridesByEnrollment.set(o.enrollmentId, m);
  }

  return new Map(
    enrollments.map((e) => {
      const b = e.batchId != null ? batchById.get(e.batchId) : undefined;
      let base: VisibilityBase = { kind: "default" };
      const dayOfLab = new Map<number, DayInfo>();
      if (b?.scheduleId != null) {
        const active = activeDaysByBatch.get(b.id) ?? new Set<number>();
        const rows = labsBySchedule.get(b.scheduleId) ?? [];
        for (const r of rows) {
          dayOfLab.set(r.labId, { id: r.dayId, no: r.dayNo, title: r.title, active: active.has(r.dayId) });
        }
        base = { kind: "days", labIds: rows.filter((r) => active.has(r.dayId)).map((r) => r.labId) };
      } else if (b) {
        base = { kind: "batch", labIds: labsByBatch.get(b.id) ?? [] };
      }
      return [
        e.id,
        {
          batch: b
            ? { id: b.id, name: b.name, kind: b.scheduleId != null ? "schedule" : "module", scheduleId: b.scheduleId }
            : null,
          base,
          overrides: overridesByEnrollment.get(e.id) ?? new Map(),
          dayOfLab,
        },
      ] as const;
    }),
  );
}

export async function loadVisibilityInput(enrollment: { id: number; batchId: number | null }) {
  return (await loadVisibilityInputs([enrollment])).get(enrollment.id)!;
}
