import type { ProgressionMode } from "@/DB/labPracticeSchema";

/**
 * Lab Practice progression engine — PURE (no DB, no React), so the trainee UI,
 * trainer views and every write endpoint evaluate the exact same rules.
 *
 * Only ACTIVE labs/tasks/steps participate (an inactive parent hides its
 * children). Completions on inactive items are ignored, never deleted.
 *
 * "Chains" define ordering:
 *   free_order       — no chains; every step is available
 *   steps_in_order   — one chain per task (labs/tasks themselves are free)
 *   fully_sequential — one chain for the whole module, flattened
 *                      lab → task → step by sequence_no. "Each step, task and
 *                      lab unlocks after the previous" is exactly this.
 *
 * A step is AVAILABLE when every EARLIER step in its chain is done. We check
 * all earlier steps (not just the immediate predecessor) so out-of-order data
 * — created by switching modes or inserting a new step mid-chain — can never
 * unlock something whose prerequisites are unmet.
 */

export type TreeStep = { id: number; sequenceNo: number; isActive: boolean; title?: string };
export type TreeTask = { id: number; sequenceNo: number; isActive: boolean; steps: TreeStep[] };
export type TreeLab = { id: number; sequenceNo: number; isActive: boolean; tasks: TreeTask[] };

export type StepStatus = "done" | "available" | "locked";

export type Rollup = { done: number; total: number; percent: number; complete: boolean };

export type Progress = {
  mode: ProgressionMode;
  stepStatus: Map<number, StepStatus>;
  taskRollup: Map<number, Rollup>;
  labRollup: Map<number, Rollup>;
  module: Rollup;
  /** stepId -> ordered list of step ids in its chain (empty in free_order). */
  chainOf: Map<number, number[]>;
};

const bySeq = <T extends { sequenceNo: number }>(a: T, b: T) => a.sequenceNo - b.sequenceNo;

function rollup(done: number, total: number): Rollup {
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
  };
}

/** Active, sorted copy of the tree. */
export function activeTree(labs: TreeLab[]): TreeLab[] {
  return labs
    .filter((l) => l.isActive)
    .sort(bySeq)
    .map((l) => ({
      ...l,
      tasks: l.tasks
        .filter((t) => t.isActive)
        .sort(bySeq)
        .map((t) => ({ ...t, steps: t.steps.filter((s) => s.isActive).sort(bySeq) })),
    }));
}

export function computeProgress(
  labs: TreeLab[],
  completedStepIds: Iterable<number>,
  mode: ProgressionMode,
): Progress {
  const tree = activeTree(labs);
  const completed = new Set(completedStepIds);

  // Build chains.
  const chains: number[][] = [];
  if (mode === "fully_sequential") {
    chains.push(tree.flatMap((l) => l.tasks.flatMap((t) => t.steps.map((s) => s.id))));
  } else if (mode === "steps_in_order") {
    for (const l of tree) for (const t of l.tasks) chains.push(t.steps.map((s) => s.id));
  }

  const chainOf = new Map<number, number[]>();
  const stepStatus = new Map<number, StepStatus>();

  for (const chain of chains) {
    let allEarlierDone = true;
    for (const stepId of chain) {
      chainOf.set(stepId, chain);
      const done = completed.has(stepId);
      stepStatus.set(stepId, done ? "done" : allEarlierDone ? "available" : "locked");
      if (!done) allEarlierDone = false;
    }
  }

  // Free order (or any step not placed in a chain).
  for (const l of tree)
    for (const t of l.tasks)
      for (const s of t.steps)
        if (!stepStatus.has(s.id)) {
          stepStatus.set(s.id, completed.has(s.id) ? "done" : "available");
          chainOf.set(s.id, []);
        }

  // Rollups.
  const taskRollup = new Map<number, Rollup>();
  const labRollup = new Map<number, Rollup>();
  let moduleDone = 0;
  let moduleTotal = 0;

  for (const l of tree) {
    let labDone = 0;
    let labTotal = 0;
    for (const t of l.tasks) {
      const done = t.steps.filter((s) => completed.has(s.id)).length;
      taskRollup.set(t.id, rollup(done, t.steps.length));
      labDone += done;
      labTotal += t.steps.length;
    }
    labRollup.set(l.id, rollup(labDone, labTotal));
    moduleDone += labDone;
    moduleTotal += labTotal;
  }

  return {
    mode,
    stepStatus,
    taskRollup,
    labRollup,
    module: rollup(moduleDone, moduleTotal),
    chainOf,
  };
}

/** Completed steps that come AFTER `stepId` in its chain, in chain order. */
export function laterCompletedInChain(
  progress: Progress,
  stepId: number,
  completedStepIds: Iterable<number>,
): number[] {
  const chain = progress.chainOf.get(stepId) ?? [];
  const idx = chain.indexOf(stepId);
  if (idx < 0) return [];
  const completed = new Set(completedStepIds);
  return chain.slice(idx + 1).filter((id) => completed.has(id));
}

/**
 * Trainee un-mark rule: allowed only when no later step in the same chain is
 * done (so the chain never has a "hole" before completed work). Always
 * allowed in free_order and for steps outside the active tree.
 */
export function canUnmark(
  progress: Progress,
  stepId: number,
  completedStepIds: Iterable<number>,
): boolean {
  return laterCompletedInChain(progress, stepId, completedStepIds).length === 0;
}
