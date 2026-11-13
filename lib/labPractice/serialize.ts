import type { ProgressionMode } from "@/DB/labPracticeSchema";
import type { EnrollmentView } from "@/lib/labPractice/practice";
import {
  activeTree,
  canUnmark,
  type Rollup,
  type StepStatus,
} from "@/lib/labPractice/progression";
import type { VisibilitySource } from "@/lib/labPractice/visibility";

/**
 * Plain JSON shape of an enrollment's progress — safe to pass from server
 * components to client components and to return from API routes. Only ACTIVE
 * curriculum is included (matching what the progression engine counts).
 */

export type FileDTO = { id: number; originalName: string; url: string };
export type StepDTO = {
  id: number;
  title: string;
  instructions: string | null;
  requiresPhoto: boolean;
  status: StepStatus;
  canUnmark: boolean;
  completion: { id: number; completedAt: string; practiceDate: string | null; files: FileDTO[] } | null;
  rejections: { reason: string; rejectedAt: string }[];
};
/** `completedAt` on task / lab / module = when its LAST active step was
 *  completed (ISO instant), or null while incomplete. Derived, never stored,
 *  so it stays right when steps are rejected or new steps are added. */
export type TaskDTO = {
  id: number;
  title: string;
  description: string | null;
  rollup: Rollup;
  completedAt: string | null;
  steps: StepDTO[];
};
export type LabDTO = {
  id: number;
  /** 1-based position among the module's active labs (stable whether or not
   *  earlier labs are hidden, so trainer and trainee both say "Lab 3"). */
  number: number;
  title: string;
  description: string;
  scenario: string | null;
  rollup: Rollup;
  completedAt: string | null;
  tasks: TaskDTO[];
  /** Can the trainee see this lab? (Trainee DTOs only ever contain visible labs.) */
  visible: boolean;
  visibilitySource: VisibilitySource;
  /** Visibility without the individual override (batch / default). */
  baseVisible: boolean;
};
export type SessionDTO = {
  id: number;
  practiceDate: string;
  comment: string | null;
  completedStepIds: number[];
};
export type EnrollmentDTO = {
  enrollmentId: number;
  isActive: boolean;
  module: {
    id: number;
    title: string;
    info: string | null;
    progressionMode: ProgressionMode;
    isActive: boolean;
    rollup: Rollup;
    completedAt: string | null;
  };
  labs: LabDTO[];
  /** Active labs the trainee can't see yet (count only — never their content). */
  hiddenLabCount: number;
  batch: { id: number; name: string } | null;
  sessions: SessionDTO[];
};

const EMPTY: Rollup = { done: 0, total: 0, percent: 0, complete: false };

/** Latest ISO instant (ISO strings sort chronologically), or null. */
function latest(values: (string | null | undefined)[]): string | null {
  return values.reduce<string | null>((max, v) => (v && (!max || v > max) ? v : max), null);
}

export function fileUrl(fileId: number) {
  return `/api/lab-practice/files/${fileId}`;
}

/**
 * `includeHidden` (trainer / oversight views) adds the labs hidden from the
 * trainee, flagged `visible: false`. Hidden labs aren't in the progression
 * engine, so their steps show "done" if completed and "locked" otherwise, and
 * their rollups are plain completed/total counts.
 */
export function serializeEnrollment(
  enrollment: { id: number; isActive: boolean },
  view: EnrollmentView,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): EnrollmentDTO {
  const { fullTree, visibility, progress, completions, files, rejections, sessions } = view;
  const completedIds = completions.map((c) => c.stepId);
  const completedSet = new Set(completedIds);
  const sessionDate = new Map(sessions.map((s) => [s.id, s.practiceDate]));
  const completionByStep = new Map(completions.map((c) => [c.stepId, c]));
  const visOf = new Map(visibility.map((v) => [v.labId, v]));
  const plainRollup = (stepIds: number[]): Rollup => {
    const done = stepIds.filter((id) => completedSet.has(id)).length;
    const total = stepIds.length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
  };

  const allActive = activeTree(fullTree.labs);
  const numberOf = new Map(allActive.map((l, i) => [l.id, i + 1]));
  const shownLabs = allActive.filter((l) => includeHidden || visOf.get(l.id)?.visible);
  const labs: LabDTO[] = shownLabs.map((lab) => {
    const fullLab = fullTree.labs.find((l) => l.id === lab.id)!;
    const vis = visOf.get(lab.id);
    const hidden = !vis?.visible;
    const tasks: TaskDTO[] = lab.tasks.map((task) => {
      const fullTask = fullLab.tasks.find((t) => t.id === task.id)!;
      const steps: StepDTO[] = task.steps.map((s) => {
        const step = fullTask.steps.find((x) => x.id === s.id)!;
        const c = completionByStep.get(step.id);
        return {
          id: step.id,
          title: step.title,
          instructions: step.instructions,
          requiresPhoto: step.requiresPhoto,
          status: progress.stepStatus.get(step.id) ?? (c ? "done" : "locked"),
          canUnmark: c && !hidden ? canUnmark(progress, step.id, completedIds) : false,
          completion: c
            ? {
                id: c.id,
                completedAt: c.completedAt.toISOString(),
                practiceDate: sessionDate.get(c.sessionId) ?? null,
                files: files
                  .filter((f) => f.stepCompletionId === c.id)
                  .map((f) => ({ id: f.id, originalName: f.originalName, url: fileUrl(f.id) })),
              }
            : null,
          rejections: rejections
            .filter((r) => r.stepId === step.id)
            .map((r) => ({ reason: r.reason, rejectedAt: r.rejectedAt.toISOString() })),
        };
      });
      const rollup = hidden
        ? plainRollup(task.steps.map((x) => x.id))
        : (progress.taskRollup.get(task.id) ?? EMPTY);
      return {
        id: task.id,
        title: fullTask.title,
        description: fullTask.description,
        rollup,
        completedAt: rollup.complete ? latest(steps.map((s) => s.completion?.completedAt)) : null,
        steps,
      };
    });
    const rollup = hidden
      ? plainRollup(lab.tasks.flatMap((t) => t.steps.map((x) => x.id)))
      : (progress.labRollup.get(lab.id) ?? EMPTY);
    return {
      id: lab.id,
      number: numberOf.get(lab.id) ?? 0,
      title: fullLab.title,
      description: fullLab.description,
      scenario: fullLab.scenario,
      rollup,
      completedAt: rollup.complete ? latest(tasks.map((t) => t.completedAt)) : null,
      tasks,
      visible: !hidden,
      visibilitySource: vis?.source ?? "default",
      baseVisible: vis?.baseVisible ?? false,
    };
  });
  const visibleLabs = labs.filter((l) => l.visible);

  return {
    enrollmentId: enrollment.id,
    isActive: enrollment.isActive,
    module: {
      id: fullTree.id,
      title: fullTree.title,
      info: fullTree.info,
      progressionMode: fullTree.progressionMode,
      isActive: fullTree.isActive,
      rollup: progress.module,
      completedAt: progress.module.complete ? latest(visibleLabs.map((l) => l.completedAt)) : null,
    },
    labs,
    hiddenLabCount: visibility.filter((v) => !v.visible).length,
    batch: view.batch,
    sessions: sessions.map((s) => ({
      id: s.id,
      practiceDate: s.practiceDate,
      comment: s.additionalComments,
      completedStepIds: completions.filter((c) => c.sessionId === s.id).map((c) => c.stepId),
    })),
  };
}
