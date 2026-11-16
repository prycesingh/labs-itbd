import { and, asc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeBatchMembers,
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeLabs,
  labPracticeModules,
  labPracticeSessions,
  labPracticeStepCompletionFiles,
  labPracticeStepCompletions,
  labPracticeSteps,
  labPracticeTasks,
} from "@/DB/labPracticeSchema";
import type { TrainerActor } from "@/lib/labPractice/identity";
import { PracticeError } from "@/lib/labPractice/practice";
import { epochOf, fromEpoch } from "@/lib/labPractice/sqlTime";
import { loadVisibilityInputs } from "@/lib/labPractice/visibilityData";

/**
 * Trainer review queue.
 *
 * What needs review: step completions with photo proof (the step requires a
 * photo, or the trainee attached one) that the trainer hasn't marked
 * reviewed, plus daily practice comments the trainer hasn't read. Plain
 * checkbox steps never enter the queue.
 *
 * Review is NON-blocking: trainees progress the moment they complete a step.
 * "Approve" only records reviewed_at; "Reject" is the existing rejection flow
 * (deletes the completion, writes a reason), which also drops it from here.
 */

export type ReviewScope = {
  /** Owning trainer, or null for every trainer (oversight). */
  trainerId: number | null;
  /** Only members of this batch. */
  batchId?: number | null;
};

const MAX_ROWS = 5000;

const hasPhoto = sql`exists (select 1 from ${labPracticeStepCompletionFiles} f where f.step_completion_id = ${labPracticeStepCompletions.id})`;

function scopeWhere(scope: ReviewScope): SQL | undefined {
  return and(
    eq(labPracticeEnrollments.isActive, true),
    scope.trainerId != null ? eq(labPracticeEnrollments.trainerId, scope.trainerId) : undefined,
    scope.batchId
      ? inArray(
          labPracticeEnrollments.traineeId,
          db
            .select({ id: labPracticeBatchMembers.traineeId })
            .from(labPracticeBatchMembers)
            .where(eq(labPracticeBatchMembers.batchId, scope.batchId)),
        )
      : undefined,
  );
}

const pendingCompletion = and(
  isNull(labPracticeStepCompletions.reviewedAt),
  or(eq(labPracticeSteps.requiresPhoto, true), hasPhoto),
);
const pendingComment = and(
  isNull(labPracticeSessions.commentReviewedAt),
  sql`${labPracticeSessions.additionalComments} is not null`,
  ne(labPracticeSessions.additionalComments, ""),
);

/** Total items waiting (for the nav badge). */
export async function countPending(scope: ReviewScope): Promise<number> {
  const [[c], [s]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(labPracticeStepCompletions)
      .innerJoin(labPracticeEnrollments, eq(labPracticeEnrollments.id, labPracticeStepCompletions.enrollmentId))
      .innerJoin(labPracticeSteps, eq(labPracticeSteps.id, labPracticeStepCompletions.stepId))
      .where(and(scopeWhere(scope), pendingCompletion)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(labPracticeSessions)
      .innerJoin(labPracticeEnrollments, eq(labPracticeEnrollments.id, labPracticeSessions.enrollmentId))
      .where(and(scopeWhere(scope), pendingComment)),
  ]);
  return Number(c?.n ?? 0) + Number(s?.n ?? 0);
}

export type ReviewTrainee = {
  traineeId: number;
  name: string;
  email: string;
  pendingSteps: number;
  pendingComments: number;
  /** ISO — the oldest waiting item (queue is ordered oldest-first). */
  oldestAt: string;
  newestAt: string;
};

export type ReviewPhoto = { id: number; name: string };

export type ReviewStepItem = {
  completionId: number;
  enrollmentId: number;
  stepId: number;
  stepTitle: string;
  instructions: string | null;
  requiresPhoto: boolean;
  taskTitle: string;
  completedAt: string;
  practiceDate: string;
  photos: ReviewPhoto[];
};

export type ReviewLabGroup = {
  key: string;
  enrollmentId: number;
  moduleTitle: string;
  labId: number;
  labTitle: string;
  labNumber: number;
  day: number | null;
  steps: ReviewStepItem[];
};

export type ReviewComment = {
  sessionId: number;
  enrollmentId: number;
  moduleTitle: string;
  practiceDate: string;
  comment: string;
};

export type ReviewQueue = {
  trainees: ReviewTrainee[];
  selected: {
    traineeId: number;
    name: string;
    email: string;
    canAct: boolean;
    labs: ReviewLabGroup[];
    comments: ReviewComment[];
  } | null;
  total: number;
  truncated: boolean;
};

/**
 * The queue: one row per trainee (oldest waiting first), and the full detail
 * (photos, grouped by module → lab) for `selectedTraineeId` — or the first
 * trainee when none is given.
 */
export async function loadReviewQueue(
  scope: ReviewScope,
  selectedTraineeId: number | null,
  actor: TrainerActor,
): Promise<ReviewQueue> {
  const [steps, comments] = await Promise.all([
    db
      .select({
        completionId: labPracticeStepCompletions.id,
        enrollmentId: labPracticeEnrollments.id,
        trainerId: labPracticeEnrollments.trainerId,
        batchId: labPracticeEnrollments.batchId,
        traineeId: labPracticeEmployees.id,
        traineeName: labPracticeEmployees.fullName,
        traineeEmail: labPracticeEmployees.email,
        moduleId: labPracticeModules.id,
        moduleTitle: labPracticeModules.title,
        labId: labPracticeLabs.id,
        labTitle: labPracticeLabs.title,
        labSeq: labPracticeLabs.sequenceNo,
        taskTitle: labPracticeTasks.title,
        taskSeq: labPracticeTasks.sequenceNo,
        stepId: labPracticeSteps.id,
        stepTitle: labPracticeSteps.title,
        stepSeq: labPracticeSteps.sequenceNo,
        instructions: labPracticeSteps.instructions,
        requiresPhoto: labPracticeSteps.requiresPhoto,
        practiceDate: labPracticeSessions.practiceDate,
        completedAtEpoch: epochOf(labPracticeStepCompletions.completedAt),
      })
      .from(labPracticeStepCompletions)
      .innerJoin(labPracticeEnrollments, eq(labPracticeEnrollments.id, labPracticeStepCompletions.enrollmentId))
      .innerJoin(labPracticeSessions, eq(labPracticeSessions.id, labPracticeStepCompletions.sessionId))
      .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeEnrollments.traineeId))
      .innerJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeEnrollments.moduleId))
      .innerJoin(labPracticeSteps, eq(labPracticeSteps.id, labPracticeStepCompletions.stepId))
      .innerJoin(labPracticeTasks, eq(labPracticeTasks.id, labPracticeSteps.taskId))
      .innerJoin(labPracticeLabs, eq(labPracticeLabs.id, labPracticeTasks.labId))
      .where(and(scopeWhere(scope), pendingCompletion))
      .orderBy(asc(labPracticeStepCompletions.completedAt))
      .limit(MAX_ROWS),
    db
      .select({
        sessionId: labPracticeSessions.id,
        enrollmentId: labPracticeEnrollments.id,
        trainerId: labPracticeEnrollments.trainerId,
        traineeId: labPracticeEmployees.id,
        traineeName: labPracticeEmployees.fullName,
        traineeEmail: labPracticeEmployees.email,
        moduleTitle: labPracticeModules.title,
        practiceDate: labPracticeSessions.practiceDate,
        comment: labPracticeSessions.additionalComments,
        updatedEpoch: sql<number | null>`UNIX_TIMESTAMP(coalesce(${labPracticeSessions.updatedAt}, ${labPracticeSessions.createdAt}))`,
      })
      .from(labPracticeSessions)
      .innerJoin(labPracticeEnrollments, eq(labPracticeEnrollments.id, labPracticeSessions.enrollmentId))
      .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeEnrollments.traineeId))
      .innerJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeEnrollments.moduleId))
      .where(and(scopeWhere(scope), pendingComment))
      .orderBy(asc(labPracticeSessions.practiceDate))
      .limit(MAX_ROWS),
  ]);

  const iso = (epoch: number | null | undefined) => fromEpoch(Number(epoch ?? 0)).toISOString();

  // ── Per-trainee summary ──
  const byTrainee = new Map<number, ReviewTrainee>();
  const touch = (id: number, name: string, email: string, at: string) => {
    let t = byTrainee.get(id);
    if (!t) {
      t = { traineeId: id, name, email, pendingSteps: 0, pendingComments: 0, oldestAt: at, newestAt: at };
      byTrainee.set(id, t);
    }
    if (at < t.oldestAt) t.oldestAt = at;
    if (at > t.newestAt) t.newestAt = at;
    return t;
  };
  for (const r of steps) touch(r.traineeId, r.traineeName, r.traineeEmail, iso(r.completedAtEpoch)).pendingSteps++;
  for (const r of comments) touch(r.traineeId, r.traineeName, r.traineeEmail, iso(r.updatedEpoch)).pendingComments++;
  const trainees = [...byTrainee.values()].sort((a, b) => a.oldestAt.localeCompare(b.oldestAt));

  const pick =
    (selectedTraineeId != null && byTrainee.get(selectedTraineeId)) || trainees[0] || null;

  const result: ReviewQueue = {
    trainees,
    selected: null,
    total: steps.length + comments.length,
    truncated: steps.length >= MAX_ROWS || comments.length >= MAX_ROWS,
  };
  if (!pick) return result;

  // ── Detail for the selected trainee ──
  const mySteps = steps.filter((r) => r.traineeId === pick.traineeId);
  const myComments = comments.filter((r) => r.traineeId === pick.traineeId);
  const enrollmentTrainers = new Map<number, number>();
  for (const r of [...mySteps, ...myComments]) enrollmentTrainers.set(r.enrollmentId, r.trainerId);
  const canAct =
    actor.canManageAll || [...enrollmentTrainers.values()].every((t) => t === actor.trainer.id);

  const [files, vis] = await Promise.all([
    mySteps.length
      ? db
          .select({
            id: labPracticeStepCompletionFiles.id,
            completionId: labPracticeStepCompletionFiles.stepCompletionId,
            name: labPracticeStepCompletionFiles.originalName,
          })
          .from(labPracticeStepCompletionFiles)
          .where(inArray(labPracticeStepCompletionFiles.stepCompletionId, mySteps.map((s) => s.completionId)))
          .orderBy(asc(labPracticeStepCompletionFiles.id))
      : Promise.resolve([]),
    loadVisibilityInputs(
      [...new Map(mySteps.map((s) => [s.enrollmentId, { id: s.enrollmentId, batchId: s.batchId }])).values()],
    ),
  ]);
  const photosOf = new Map<number, ReviewPhoto[]>();
  for (const f of files) photosOf.set(f.completionId, [...(photosOf.get(f.completionId) ?? []), { id: f.id, name: f.name }]);

  // Lab number = position among the module's labs (sequence order).
  const labNumbers = new Map<number, number>();
  const moduleIds = [...new Set(mySteps.map((s) => s.moduleId))];
  if (moduleIds.length) {
    const labs = await db
      .select({ id: labPracticeLabs.id, moduleId: labPracticeLabs.moduleId })
      .from(labPracticeLabs)
      .where(inArray(labPracticeLabs.moduleId, moduleIds))
      .orderBy(asc(labPracticeLabs.moduleId), asc(labPracticeLabs.sequenceNo));
    const counter = new Map<number, number>();
    for (const l of labs) {
      const n = (counter.get(l.moduleId) ?? 0) + 1;
      counter.set(l.moduleId, n);
      labNumbers.set(l.id, n);
    }
  }

  type Building = Omit<ReviewLabGroup, "steps"> & {
    sortKey: [number, number, number];
    steps: { item: ReviewStepItem; seq: [number, number] }[];
  };
  const groups = new Map<string, Building>();
  for (const r of mySteps) {
    const key = `${r.enrollmentId}:${r.labId}`;
    let g = groups.get(key);
    if (!g) {
      const day = vis.get(r.enrollmentId)?.dayOfLab.get(r.labId)?.no ?? null;
      g = {
        key,
        enrollmentId: r.enrollmentId,
        moduleTitle: r.moduleTitle,
        labId: r.labId,
        labTitle: r.labTitle,
        labNumber: labNumbers.get(r.labId) ?? r.labSeq,
        day,
        steps: [],
        sortKey: [day ?? Number.MAX_SAFE_INTEGER, r.moduleId, r.labSeq],
      };
      groups.set(key, g);
    }
    g.steps.push({
      seq: [r.taskSeq, r.stepSeq],
      item: {
        completionId: r.completionId,
        enrollmentId: r.enrollmentId,
        stepId: r.stepId,
        stepTitle: r.stepTitle,
        instructions: r.instructions,
        requiresPhoto: Boolean(r.requiresPhoto),
        taskTitle: r.taskTitle,
        completedAt: iso(r.completedAtEpoch),
        practiceDate: String(r.practiceDate),
        photos: photosOf.get(r.completionId) ?? [],
      },
    });
  }
  // Calendar order: by day (when paced by a schedule), then module, then lab;
  // steps in curriculum order inside each lab.
  const labs: ReviewLabGroup[] = [...groups.values()]
    .sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1] || a.sortKey[2] - b.sortKey[2])
    .map((g) => ({
      key: g.key,
      enrollmentId: g.enrollmentId,
      moduleTitle: g.moduleTitle,
      labId: g.labId,
      labTitle: g.labTitle,
      labNumber: g.labNumber,
      day: g.day,
      steps: g.steps.sort((a, b) => a.seq[0] - b.seq[0] || a.seq[1] - b.seq[1]).map((s) => s.item),
    }));

  result.selected = {
    traineeId: pick.traineeId,
    name: pick.name,
    email: pick.email,
    canAct,
    labs,
    comments: myComments.map((c) => ({
      sessionId: c.sessionId,
      enrollmentId: c.enrollmentId,
      moduleTitle: c.moduleTitle,
      practiceDate: String(c.practiceDate),
      comment: c.comment ?? "",
    })),
  };
  return result;
}

/**
 * Mark completions / comments reviewed. Every item must belong to an
 * enrollment the actor owns (or the actor holds guidedLabs.manageAll).
 */
export async function markReviewed(
  actor: TrainerActor,
  completionIds: number[],
  sessionIds: number[],
): Promise<{ steps: number; comments: number }> {
  const cIds = [...new Set(completionIds)];
  const sIds = [...new Set(sessionIds)];
  const [cRows, sRows] = await Promise.all([
    cIds.length
      ? db
          .select({ id: labPracticeStepCompletions.id, trainerId: labPracticeEnrollments.trainerId })
          .from(labPracticeStepCompletions)
          .innerJoin(labPracticeEnrollments, eq(labPracticeEnrollments.id, labPracticeStepCompletions.enrollmentId))
          .where(inArray(labPracticeStepCompletions.id, cIds))
      : Promise.resolve([]),
    sIds.length
      ? db
          .select({ id: labPracticeSessions.id, trainerId: labPracticeEnrollments.trainerId })
          .from(labPracticeSessions)
          .innerJoin(labPracticeEnrollments, eq(labPracticeEnrollments.id, labPracticeSessions.enrollmentId))
          .where(inArray(labPracticeSessions.id, sIds))
      : Promise.resolve([]),
  ]);
  const allowed = (t: number) => actor.canManageAll || t === actor.trainer.id;
  if ([...cRows, ...sRows].some((r) => !allowed(r.trainerId))) {
    throw new PracticeError("You can only review your own trainees.", 403);
  }
  // Items that vanished (e.g. the trainee un-marked a step) are simply skipped.
  await db.transaction(async (tx) => {
    if (cRows.length) {
      await tx
        .update(labPracticeStepCompletions)
        .set({ reviewedAt: sql`now()`, reviewedBy: actor.trainer.id })
        .where(and(inArray(labPracticeStepCompletions.id, cRows.map((r) => r.id)), isNull(labPracticeStepCompletions.reviewedAt)));
    }
    if (sRows.length) {
      await tx
        .update(labPracticeSessions)
        .set({ commentReviewedAt: sql`now()` })
        .where(inArray(labPracticeSessions.id, sRows.map((r) => r.id)));
    }
  });
  return { steps: cRows.length, comments: sRows.length };
}
