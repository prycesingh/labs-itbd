import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeLabs,
  labPracticeModules,
  labPracticeSteps,
  labPracticeTasks,
} from "@/DB/labPracticeSchema";

/**
 * Curriculum data access: Module -> Lab -> Task -> Step.
 *
 * Curriculum is shared across trainers (any active trainer may edit any
 * module); `created_by` records authorship only. Items are retired with
 * `is_active`, never deleted (FKs are `restrict`).
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

/** MySQL duplicate-key (unique title / sequence) detection. */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}
