import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import { db } from "@/DB/drizzle";
import {
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeModules,
  labPracticeStepCompletions,
  labPracticeTrainers,
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
  trainerId: number;
  trainerName: string;
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

/** The trainer's employee row (the trainee join already uses the base table). */
const trainerEmployee = alias(labPracticeEmployees, "trainer_employee");

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
      trainerId: labPracticeEnrollments.trainerId,
      trainerName: trainerEmployee.fullName,
      enrolledAtEpoch: epochOf(labPracticeEnrollments.assignedAt),
    })
    .from(labPracticeEnrollments)
    .innerJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeEnrollments.moduleId))
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeEnrollments.traineeId))
    .innerJoin(labPracticeTrainers, eq(labPracticeTrainers.id, labPracticeEnrollments.trainerId))
    .innerJoin(trainerEmployee, eq(trainerEmployee.id, labPracticeTrainers.employeeId))
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

/** Every enrollment across all trainers (oversight: guidedLabs.viewAll). */
export function listAllEnrollments() {
  return summarize(undefined);
}

export type TrainerOption = {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  /** Distinct trainees this trainer owns (any enrollment state). */
  traineeCount: number;
};

/** Every trainer identity that owns at least one enrollment, plus active
 *  trainers with none yet — so an oversight viewer can pick any of them. */
export async function listTrainers(): Promise<TrainerOption[]> {
  const rows = await db
    .select({
      id: labPracticeTrainers.id,
      fullName: labPracticeEmployees.fullName,
      email: labPracticeEmployees.email,
      isActive: labPracticeTrainers.isActive,
      traineeCount: sql<number>`count(distinct ${labPracticeEnrollments.traineeId})`,
    })
    .from(labPracticeTrainers)
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeTrainers.employeeId))
    .leftJoin(labPracticeEnrollments, eq(labPracticeEnrollments.trainerId, labPracticeTrainers.id))
    .groupBy(
      labPracticeTrainers.id,
      labPracticeEmployees.fullName,
      labPracticeEmployees.email,
      labPracticeTrainers.isActive,
    )
    .orderBy(asc(labPracticeEmployees.fullName));
  return rows
    .map((r) => ({ ...r, traineeCount: Number(r.traineeCount) }))
    .filter((r) => r.isActive || r.traineeCount > 0);
}

export type TraineeGroup = {
  /** trainerId:traineeId — a trainee can be owned by several trainers. */
  key: string;
  traineeId: number;
  traineeName: string;
  traineeEmail: string;
  trainerId: number;
  trainerName: string;
  enrollments: EnrollmentSummary[];
  /** Step-weighted progress across the trainee's assigned modules. */
  percent: number;
  done: number;
  total: number;
  lastActivityAt: string | null;
};

/** One card per trainee (per owning trainer) instead of one per enrollment. */
export function groupByTrainee(rows: EnrollmentSummary[]): TraineeGroup[] {
  const groups = new Map<string, TraineeGroup>();
  for (const r of rows) {
    const key = `${r.trainerId}:${r.traineeId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        traineeId: r.traineeId,
        traineeName: r.traineeName,
        traineeEmail: r.traineeEmail,
        trainerId: r.trainerId,
        trainerName: r.trainerName,
        enrollments: [],
        percent: 0,
        done: 0,
        total: 0,
        lastActivityAt: null,
      };
      groups.set(key, g);
    }
    g.enrollments.push(r);
    g.done += r.done;
    g.total += r.total;
    if (r.lastActivityAt && (!g.lastActivityAt || r.lastActivityAt > g.lastActivityAt)) {
      g.lastActivityAt = r.lastActivityAt;
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, percent: g.total ? Math.round((g.done / g.total) * 100) : 0 }))
    .sort((a, b) => a.traineeName.localeCompare(b.traineeName));
}
