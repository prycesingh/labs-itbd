import { and, asc, eq, inArray, type SQL } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeModules,
  labPracticeStepCompletions,
} from "@/DB/labPracticeSchema";
import { loadModuleTree, type ModuleTree } from "@/lib/labPractice/curriculum";
import { computeProgress } from "@/lib/labPractice/progression";
import { epochOf, fromEpoch } from "@/lib/labPractice/sqlTime";

/**
 * List queries for dashboard pages: enrollments joined with module + trainee,
 * plus computed progress. Each module tree is loaded once and completions are
 * fetched in a single query, so cost scales with modules, not enrollments.
 */

export type EnrollmentSummary = {
  id: number;
  isActive: boolean;
  moduleId: number;
  moduleTitle: string;
  moduleInfo: string | null;
  moduleActive: boolean;
  traineeId: number;
  traineeName: string;
  traineeEmail: string;
  percent: number;
  done: number;
  total: number;
  /** ISO instants (display in ET). */
  enrolledAt: string;
  /** Latest step completion, or null if nothing done yet. */
  lastActivityAt: string | null;
  /** When the module's last active step was completed; null until 100%. */
  completedAt: string | null;
};

async function summarize(where: SQL | undefined): Promise<EnrollmentSummary[]> {
  const rows = await db
    .select({
      id: labPracticeEnrollments.id,
      isActive: labPracticeEnrollments.isActive,
      moduleId: labPracticeModules.id,
      moduleTitle: labPracticeModules.title,
      moduleInfo: labPracticeModules.info,
      moduleActive: labPracticeModules.isActive,
      traineeId: labPracticeEmployees.id,
      traineeName: labPracticeEmployees.fullName,
      traineeEmail: labPracticeEmployees.email,
      enrolledAtEpoch: epochOf(labPracticeEnrollments.assignedAt),
    })
    .from(labPracticeEnrollments)
    .innerJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeEnrollments.moduleId))
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeEnrollments.traineeId))
    .where(where)
    .orderBy(asc(labPracticeModules.title), asc(labPracticeEmployees.fullName));
  if (!rows.length) return [];

  const moduleIds = [...new Set(rows.map((r) => r.moduleId))];
  const trees = new Map<number, ModuleTree | null>(
    await Promise.all(moduleIds.map(async (id) => [id, await loadModuleTree(id)] as const)),
  );

  const completions = await db
    .select({
      enrollmentId: labPracticeStepCompletions.enrollmentId,
      stepId: labPracticeStepCompletions.stepId,
      completedAtEpoch: epochOf(labPracticeStepCompletions.completedAt),
    })
    .from(labPracticeStepCompletions)
    .where(inArray(labPracticeStepCompletions.enrollmentId, rows.map((r) => r.id)));
  const doneBy = new Map<number, { stepId: number; at: number }[]>();
  for (const c of completions) {
    const list = doneBy.get(c.enrollmentId) ?? [];
    list.push({ stepId: c.stepId, at: Number(c.completedAtEpoch ?? 0) });
    doneBy.set(c.enrollmentId, list);
  }
  const iso = (epoch: number) => (epoch > 0 ? fromEpoch(epoch).toISOString() : null);

  return rows.map(({ enrolledAtEpoch, ...r }) => {
    const tree = trees.get(r.moduleId);
    const done = doneBy.get(r.id) ?? [];
    const progress = tree
      ? computeProgress(tree.labs, done.map((d) => d.stepId), tree.progressionMode)
      : null;
    const m = progress?.module ?? { percent: 0, done: 0, total: 0, complete: false };
    // Module completion = latest completion among ACTIVE steps (the ones the
    // progression engine tracks); retired steps don't count.
    const activeDone = progress ? done.filter((d) => progress.stepStatus.has(d.stepId)) : [];
    return {
      ...r,
      percent: m.percent,
      done: m.done,
      total: m.total,
      enrolledAt: fromEpoch(enrolledAtEpoch ?? 0).toISOString(),
      lastActivityAt: iso(Math.max(0, ...done.map((d) => d.at))),
      completedAt: m.complete ? iso(Math.max(0, ...activeDone.map((d) => d.at))) : null,
    };
  });
}

export function listTraineeEnrollments(employeeId: number) {
  return summarize(eq(labPracticeEnrollments.traineeId, employeeId));
}

export function listTrainerEnrollments(trainerId: number, moduleId?: number) {
  return summarize(
    and(
      eq(labPracticeEnrollments.trainerId, trainerId),
      moduleId ? eq(labPracticeEnrollments.moduleId, moduleId) : undefined,
    ),
  );
}
