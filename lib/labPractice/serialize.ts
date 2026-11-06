import type { ProgressionMode } from "@/DB/labPracticeSchema";
import type { EnrollmentView } from "@/lib/labPractice/practice";
import {
  activeTree,
  canUnmark,
  type Rollup,
  type StepStatus,
} from "@/lib/labPractice/progression";

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
  title: string;
  description: string;
  scenario: string | null;
  rollup: Rollup;
  completedAt: string | null;
  tasks: TaskDTO[];
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

export function serializeEnrollment(
  enrollment: { id: number; isActive: boolean },
  view: EnrollmentView,
): EnrollmentDTO {
  const { tree, progress, completions, files, rejections, sessions } = view;
  const completedIds = completions.map((c) => c.stepId);
  const sessionDate = new Map(sessions.map((s) => [s.id, s.practiceDate]));
  const completionByStep = new Map(completions.map((c) => [c.stepId, c]));

  const labs: LabDTO[] = activeTree(tree.labs).map((lab) => {
    const fullLab = tree.labs.find((l) => l.id === lab.id)!;
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
          status: progress.stepStatus.get(step.id) ?? "locked",
          canUnmark: c ? canUnmark(progress, step.id, completedIds) : false,
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
      const rollup = progress.taskRollup.get(task.id) ?? EMPTY;
      return {
        id: task.id,
        title: fullTask.title,
        description: fullTask.description,
        rollup,
        completedAt: rollup.complete ? latest(steps.map((s) => s.completion?.completedAt)) : null,
        steps,
      };
    });
    const rollup = progress.labRollup.get(lab.id) ?? EMPTY;
    return {
      id: lab.id,
      title: fullLab.title,
      description: fullLab.description,
      scenario: fullLab.scenario,
      rollup,
      completedAt: rollup.complete ? latest(tasks.map((t) => t.completedAt)) : null,
      tasks,
    };
  });

  return {
    enrollmentId: enrollment.id,
    isActive: enrollment.isActive,
    module: {
      id: tree.id,
      title: tree.title,
      info: tree.info,
      progressionMode: tree.progressionMode,
      isActive: tree.isActive,
      rollup: progress.module,
      completedAt: progress.module.complete ? latest(labs.map((l) => l.completedAt)) : null,
    },
    labs,
    sessions: sessions.map((s) => ({
      id: s.id,
      practiceDate: s.practiceDate,
      comment: s.additionalComments,
      completedStepIds: completions.filter((c) => c.sessionId === s.id).map((c) => c.stepId),
    })),
  };
}
