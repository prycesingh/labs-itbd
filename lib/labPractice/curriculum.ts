import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeEnrollments,
  labPracticeLabs,
  labPracticeModules,
  labPracticeStepCompletions,
  labPracticeStepRejections,
  labPracticeSteps,
  labPracticeTasks,
} from "@/DB/labPracticeSchema";

/**
 * Curriculum data access: Module -> Lab -> Task -> Step.
 *
 * Curriculum is shared across trainers (any active trainer may edit any
 * module); `created_by` records authorship only. Items with trainee history
 * are retired with `is_active`; only history-free items may be hard-deleted
 * (see deleteCurriculumItem — FKs are `restrict`).
 */

export type ModuleRow = typeof labPracticeModules.$inferSelect;
export type LabRow = typeof labPracticeLabs.$inferSelect;
export type TaskRow = typeof labPracticeTasks.$inferSelect;
export type StepRow = typeof labPracticeSteps.$inferSelect;

export type ModuleTree = ModuleRow & {
  labs: (LabRow & { tasks: (TaskRow & { steps: StepRow[] })[] })[];
};

/** Full module tree INCLUDING inactive items (callers filter as needed —
 *  the progression engine ignores inactive ones itself). */
export async function loadModuleTree(moduleId: number): Promise<ModuleTree | null> {
  const [mod] = await db
    .select()
    .from(labPracticeModules)
    .where(eq(labPracticeModules.id, moduleId))
    .limit(1);
  if (!mod) return null;

  const labs = await db
    .select()
    .from(labPracticeLabs)
    .where(eq(labPracticeLabs.moduleId, moduleId))
    .orderBy(asc(labPracticeLabs.sequenceNo));
  const labIds = labs.map((l) => l.id);

  const tasks = labIds.length
    ? await db
        .select()
        .from(labPracticeTasks)
        .where(inArray(labPracticeTasks.labId, labIds))
        .orderBy(asc(labPracticeTasks.sequenceNo))
    : [];
  const taskIds = tasks.map((t) => t.id);

  const steps = taskIds.length
    ? await db
        .select()
        .from(labPracticeSteps)
        .where(inArray(labPracticeSteps.taskId, taskIds))
        .orderBy(asc(labPracticeSteps.sequenceNo))
    : [];

  return {
    ...mod,
    labs: labs.map((l) => ({
      ...l,
      tasks: tasks
        .filter((t) => t.labId === l.id)
        .map((t) => ({ ...t, steps: steps.filter((s) => s.taskId === t.id) })),
    })),
  };
}

/** Which module a step belongs to (any active state), or null. */
export async function moduleIdForStep(stepId: number): Promise<number | null> {
  const [row] = await db
    .select({ moduleId: labPracticeLabs.moduleId })
    .from(labPracticeSteps)
    .innerJoin(labPracticeTasks, eq(labPracticeTasks.id, labPracticeSteps.taskId))
    .innerJoin(labPracticeLabs, eq(labPracticeLabs.id, labPracticeTasks.labId))
    .where(eq(labPracticeSteps.id, stepId))
    .limit(1);
  return row?.moduleId ?? null;
}

// ─────────────────────────────────────────────
// Sequencing
// ─────────────────────────────────────────────

type SeqTable = typeof labPracticeLabs | typeof labPracticeTasks | typeof labPracticeSteps;

function parentColumn(table: SeqTable) {
  if (table === labPracticeLabs) return labPracticeLabs.moduleId;
  if (table === labPracticeTasks) return labPracticeTasks.labId;
  return labPracticeSteps.taskId;
}

export async function nextSequenceNo(table: SeqTable, parentId: number): Promise<number> {
  const [row] = await db
    .select({ maxSeq: sql<number | null>`max(${table.sequenceNo})` })
    .from(table)
    .where(eq(parentColumn(table), parentId));
  return Number(row?.maxSeq ?? 0) + 1;
}

export class ReorderError extends Error {}

/**
 * Re-sequence ALL children of a parent to match `orderedIds` (1..n).
 * `(parent, sequence_no)` is unique, so a direct swap would collide: first
 * park every row on a negative number (unique per row: -id), then assign the
 * final positions — both inside one transaction.
 */
export async function reorderChildren(
  table: SeqTable,
  parentId: number,
  orderedIds: number[],
): Promise<void> {
  const parentCol = parentColumn(table);
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: table.id })
      .from(table)
      .where(eq(parentCol, parentId));
    const currentIds = new Set(current.map((r) => r.id));
    if (
      currentIds.size !== orderedIds.length ||
      new Set(orderedIds).size !== orderedIds.length ||
      orderedIds.some((id) => !currentIds.has(id))
    ) {
      throw new ReorderError("Order must list every item under this parent exactly once.");
    }

    await tx
      .update(table)
      .set({ sequenceNo: sql`-${table.id}` })
      .where(eq(parentCol, parentId));

    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(table)
        .set({ sequenceNo: i + 1 })
        .where(eq(table.id, orderedIds[i]));
    }
  });
}

// ─────────────────────────────────────────────
// Deletion
// ─────────────────────────────────────────────

export class CurriculumDeleteError extends Error {}

export type CurriculumLevel = "module" | "lab" | "task" | "step";

/**
 * Hard-delete a curriculum item and everything beneath it (FKs are
 * `restrict`, so children are removed bottom-up in one transaction).
 *
 * Only allowed while it holds NO trainee history: a module with any
 * enrollment, or any item whose steps have completions or rejections, is
 * refused — those are retired with `is_active` so progress is never lost.
 * Sibling sequence gaps are harmless (ordering is by sequence_no and
 * nextSequenceNo uses max+1; the next reorder renumbers 1..n).
 */
export async function deleteCurriculumItem(level: CurriculumLevel, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    let labIds: number[] = [];
    let taskIds: number[] = [];
    let stepIds: number[] = [];

    if (level === "module") {
      const [mod] = await tx
        .select({ id: labPracticeModules.id })
        .from(labPracticeModules)
        .where(eq(labPracticeModules.id, id))
        .limit(1);
      if (!mod) return false;
      const [enrolled] = await tx
        .select({ id: labPracticeEnrollments.id })
        .from(labPracticeEnrollments)
        .where(eq(labPracticeEnrollments.moduleId, id))
        .limit(1);
      if (enrolled) {
        throw new CurriculumDeleteError(
          "This module has trainees assigned, so it can't be deleted. Deactivate it instead.",
        );
      }
      labIds = (
        await tx.select({ id: labPracticeLabs.id }).from(labPracticeLabs).where(eq(labPracticeLabs.moduleId, id))
      ).map((r) => r.id);
    } else if (level === "lab") {
      labIds = (
        await tx.select({ id: labPracticeLabs.id }).from(labPracticeLabs).where(eq(labPracticeLabs.id, id))
      ).map((r) => r.id);
      if (!labIds.length) return false;
    } else if (level === "task") {
      taskIds = (
        await tx.select({ id: labPracticeTasks.id }).from(labPracticeTasks).where(eq(labPracticeTasks.id, id))
      ).map((r) => r.id);
      if (!taskIds.length) return false;
    } else {
      stepIds = (
        await tx.select({ id: labPracticeSteps.id }).from(labPracticeSteps).where(eq(labPracticeSteps.id, id))
      ).map((r) => r.id);
      if (!stepIds.length) return false;
    }

    if (labIds.length) {
      taskIds = (
        await tx
          .select({ id: labPracticeTasks.id })
          .from(labPracticeTasks)
          .where(inArray(labPracticeTasks.labId, labIds))
      ).map((r) => r.id);
    }
    if (taskIds.length && level !== "step") {
      stepIds = (
        await tx
          .select({ id: labPracticeSteps.id })
          .from(labPracticeSteps)
          .where(inArray(labPracticeSteps.taskId, taskIds))
      ).map((r) => r.id);
    }

    if (stepIds.length) {
      const [completed] = await tx
        .select({ id: labPracticeStepCompletions.id })
        .from(labPracticeStepCompletions)
        .where(inArray(labPracticeStepCompletions.stepId, stepIds))
        .limit(1);
      const [rejected] = completed
        ? [completed]
        : await tx
            .select({ id: labPracticeStepRejections.id })
            .from(labPracticeStepRejections)
            .where(inArray(labPracticeStepRejections.stepId, stepIds))
            .limit(1);
      if (completed || rejected) {
        throw new CurriculumDeleteError(
          `Trainees have progress on this ${level}, so it can't be deleted. Deactivate it instead.`,
        );
      }
      await tx.delete(labPracticeSteps).where(inArray(labPracticeSteps.id, stepIds));
    }
    if (level !== "step" && taskIds.length) {
      await tx.delete(labPracticeTasks).where(inArray(labPracticeTasks.id, taskIds));
    }
    if ((level === "module" || level === "lab") && labIds.length) {
      await tx.delete(labPracticeLabs).where(inArray(labPracticeLabs.id, labIds));
    }
    if (level === "module") {
      await tx.delete(labPracticeModules).where(eq(labPracticeModules.id, id));
    }
    return true;
  });
}

/** MySQL duplicate-key (unique title / sequence) detection. */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}
