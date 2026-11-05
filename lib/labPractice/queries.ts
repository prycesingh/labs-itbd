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
    })
    .from(labPracticeStepCompletions)
    .where(inArray(labPracticeStepCompletions.enrollmentId, rows.map((r) => r.id)));
  const doneBy = new Map<number, number[]>();
  for (const c of completions) {
    const list = doneBy.get(c.enrollmentId) ?? [];
    list.push(c.stepId);
    doneBy.set(c.enrollmentId, list);
  }

  return rows.map((r) => {
    const tree = trees.get(r.moduleId);
    const m = tree
      ? computeProgress(tree.labs, doneBy.get(r.id) ?? [], tree.progressionMode).module
      : { percent: 0, done: 0, total: 0 };
    return { ...r, percent: m.percent, done: m.done, total: m.total };
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
