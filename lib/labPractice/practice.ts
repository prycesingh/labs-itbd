import { and, asc, desc, eq, inArray } from "drizzle-orm";
import path from "path";

import { db } from "@/DB/drizzle";
import {
  labPracticeSessions,
  labPracticeStepCompletionFiles,
  labPracticeStepCompletions,
  labPracticeStepRejections,
} from "@/DB/labPracticeSchema";
import { loadModuleTree, type ModuleTree } from "@/lib/labPractice/curriculum";
import { isValidPracticeDate } from "@/lib/labPractice/dates";
import type { Enrollment, Trainer } from "@/lib/labPractice/identity";
import {
  canUnmark,
  computeProgress,
  laterCompletedInChain,
  type Progress,
} from "@/lib/labPractice/progression";
import { deleteManagedUpload, saveUpload } from "@/lib/uploads";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_FILES,
  PHOTO_MIME_TYPES,
} from "@/lib/validation/labPractice";

/**
 * Trainee practice flow + trainer rejection.
 *
 * Every write re-loads the module tree and current completions and runs the
 * shared progression engine, so the server never trusts the client's idea of
 * what is unlocked. Business-rule failures throw PracticeError(message, status)
 * which route handlers turn into JSON responses.
 */

export class PracticeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type CompletionRow = typeof labPracticeStepCompletions.$inferSelect;
export type CompletionFileRow = typeof labPracticeStepCompletionFiles.$inferSelect;
export type RejectionRow = typeof labPracticeStepRejections.$inferSelect;
export type SessionRow = typeof labPracticeSessions.$inferSelect;

async function completionsFor(enrollmentId: number): Promise<CompletionRow[]> {
  return db
    .select()
    .from(labPracticeStepCompletions)
    .where(eq(labPracticeStepCompletions.enrollmentId, enrollmentId));
}

async function treeAndProgress(enrollment: Enrollment) {
  const tree = await loadModuleTree(enrollment.moduleId);
  if (!tree) throw new PracticeError("Module not found.", 404);
  const completions = await completionsFor(enrollment.id);
  const completedIds = completions.map((c) => c.stepId);
  const progress = computeProgress(tree.labs, completedIds, tree.progressionMode);
  return { tree, completions, completedIds, progress };
}

/** Everything the trainee / trainer views need for one enrollment. */
export type EnrollmentView = {
  tree: ModuleTree;
  progress: Progress;
  completions: CompletionRow[];
  files: CompletionFileRow[];
  rejections: RejectionRow[];
  sessions: SessionRow[];
};

export async function getEnrollmentView(enrollment: Enrollment): Promise<EnrollmentView> {
  const { tree, completions, progress } = await treeAndProgress(enrollment);
  const completionIds = completions.map((c) => c.id);

  const [files, rejections, sessions] = await Promise.all([
    completionIds.length
      ? db
          .select()
          .from(labPracticeStepCompletionFiles)
          .where(inArray(labPracticeStepCompletionFiles.stepCompletionId, completionIds))
          .orderBy(asc(labPracticeStepCompletionFiles.id))
      : Promise.resolve([] as CompletionFileRow[]),
    db
      .select()
      .from(labPracticeStepRejections)
      .where(eq(labPracticeStepRejections.enrollmentId, enrollment.id))
      .orderBy(desc(labPracticeStepRejections.rejectedAt)),
    db
      .select()
      .from(labPracticeSessions)
      .where(eq(labPracticeSessions.enrollmentId, enrollment.id))
      .orderBy(desc(labPracticeSessions.practiceDate)),
  ]);

  return { tree, progress, completions, files, rejections, sessions };
}

// ─────────────────────────────────────────────
// Guards
// ─────────────────────────────────────────────

function assertWritable(enrollment: Enrollment, tree: ModuleTree) {
  if (!enrollment.isActive) throw new PracticeError("This enrollment has been closed.", 403);
  if (!tree.isActive) throw new PracticeError("This module is no longer active.", 403);
}

function assertDate(practiceDate: unknown): string {
  if (!isValidPracticeDate(practiceDate)) {
    throw new PracticeError("Practice date must be today (your local date).");
  }
  return practiceDate;
}

// ─────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** One session per enrollment per day — insert-if-missing, then read. */
async function getOrCreateSession(tx: Tx, enrollmentId: number, practiceDate: string) {
  await tx
    .insert(labPracticeSessions)
    .values({ enrollmentId, practiceDate })
    .onDuplicateKeyUpdate({ set: { enrollmentId } }); // no-op on conflict
  const [row] = await tx
    .select()
    .from(labPracticeSessions)
    .where(
      and(
        eq(labPracticeSessions.enrollmentId, enrollmentId),
        eq(labPracticeSessions.practiceDate, practiceDate),
      ),
    )
    .limit(1);
  return row;
}

export async function saveComment(enrollment: Enrollment, practiceDate: string, comment: string) {
  const tree = await loadModuleTree(enrollment.moduleId);
  if (!tree) throw new PracticeError("Module not found.", 404);
  assertWritable(enrollment, tree);
  const date = assertDate(practiceDate);

  return db.transaction(async (tx) => {
    const session = await getOrCreateSession(tx, enrollment.id, date);
    await tx
      .update(labPracticeSessions)
      .set({ additionalComments: comment || null })
      .where(eq(labPracticeSessions.id, session.id));
    return { ...session, additionalComments: comment || null };
  });
}

// ─────────────────────────────────────────────
// Photo validation
// ─────────────────────────────────────────────

/** Check magic bytes so a renamed non-image can't be stored as image/png. */
function sniffImageType(buf: Uint8Array): (typeof PHOTO_MIME_TYPES)[number] | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

async function validatePhotos(files: File[]) {
  if (files.length > PHOTO_MAX_FILES) {
    throw new PracticeError(`At most ${PHOTO_MAX_FILES} photos per step.`);
  }
  const out: { file: File; mimeType: string }[] = [];
  for (const file of files) {
    if (file.size > PHOTO_MAX_BYTES) throw new PracticeError(`"${file.name}" is larger than 10 MB.`);
    if (file.size === 0) throw new PracticeError(`"${file.name}" is empty.`);
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mimeType = sniffImageType(head);
    if (!mimeType) throw new PracticeError(`"${file.name}" is not a PNG, JPEG or WebP image.`);
    out.push({ file, mimeType });
  }
  return out;
}

// ─────────────────────────────────────────────
// Complete / un-mark
// ─────────────────────────────────────────────

export async function completeStep(
  enrollment: Enrollment,
  stepId: number,
  practiceDate: string,
  photos: File[],
) {
  const { tree, progress } = await treeAndProgress(enrollment);
  assertWritable(enrollment, tree);
  const date = assertDate(practiceDate);

  const step = tree.labs.flatMap((l) => l.tasks.flatMap((t) => t.steps)).find((s) => s.id === stepId);
  // Belongs-to-module check: the step must be in THIS enrollment's module.
  if (!step) throw new PracticeError("Step not found in this module.", 404);

  const status = progress.stepStatus.get(stepId);
  if (!status) throw new PracticeError("This step is not active.", 409);
  if (status === "done") throw new PracticeError("Step is already complete.", 409);
  if (status === "locked") throw new PracticeError("Finish the earlier steps first.", 409);

  if (step.requiresPhoto && photos.length === 0) {
    throw new PracticeError("This step needs at least one photo.");
  }
  const validPhotos = await validatePhotos(photos);

  // Write files first (outside the transaction); roll them back on DB failure.
  const now = new Date();
  const category = `lab-practice/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const saved: { id: string; original: string; mimeType: string; size: number }[] = [];
  try {
    for (const { file, mimeType } of validPhotos) {
      const s = await saveUpload(file, category);
      saved.push({ id: s.id, original: file.name || "photo", mimeType, size: s.size });
    }

    return await db.transaction(async (tx) => {
      const session = await getOrCreateSession(tx, enrollment.id, date);
      const [res] = await tx.insert(labPracticeStepCompletions).values({
        enrollmentId: enrollment.id,
        sessionId: session.id,
        stepId,
      });
      const completionId = res.insertId;
      if (saved.length) {
        await tx.insert(labPracticeStepCompletionFiles).values(
          saved.map((f) => ({
            stepCompletionId: completionId,
            storedName: path.posix.basename(f.id),
            filePath: f.id,
            originalName: f.original.slice(0, 255),
            mimeType: f.mimeType,
            sizeBytes: f.size,
          })),
        );
      }
      return { completionId, sessionId: session.id };
    });
  } catch (err) {
    await Promise.all(saved.map((f) => deleteManagedUpload(f.id).catch(() => undefined)));
    const code = (err as { code?: string; cause?: { code?: string } })?.cause?.code ??
      (err as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") throw new PracticeError("Step is already complete.", 409);
    throw err;
  }
}

/** Delete completions + their files (rows cascade; disk files removed here). */
async function deleteCompletions(tx: Tx, completionIds: number[]) {
  if (!completionIds.length) return [] as string[];
  const files = await tx
    .select({ filePath: labPracticeStepCompletionFiles.filePath })
    .from(labPracticeStepCompletionFiles)
    .where(inArray(labPracticeStepCompletionFiles.stepCompletionId, completionIds));
  await tx
    .delete(labPracticeStepCompletions)
    .where(inArray(labPracticeStepCompletions.id, completionIds));
  return files.map((f) => f.filePath);
}

async function removeFiles(paths: string[]) {
  await Promise.all(
    paths.map((p) =>
      deleteManagedUpload(p).catch((err) =>
        console.warn("[lab-practice] could not delete file", p, (err as Error).message),
      ),
    ),
  );
}

export async function unmarkStep(enrollment: Enrollment, stepId: number) {
  const { tree, completions, completedIds, progress } = await treeAndProgress(enrollment);
  assertWritable(enrollment, tree);

  const completion = completions.find((c) => c.stepId === stepId);
  if (!completion) throw new PracticeError("Step is not complete.", 404);
  if (!canUnmark(progress, stepId, completedIds)) {
    throw new PracticeError("Un-mark the later completed steps first.", 409);
  }

  const paths = await db.transaction((tx) => deleteCompletions(tx, [completion.id]));
  await removeFiles(paths);
}

// ─────────────────────────────────────────────
// Trainer rejection
// ─────────────────────────────────────────────

/** Steps that would also be reset if `stepId` is rejected (sequential modes). */
export async function previewRejection(enrollment: Enrollment, stepId: number) {
  const { completedIds, progress } = await treeAndProgress(enrollment);
  if (!completedIds.includes(stepId)) throw new PracticeError("Step is not complete.", 404);
  return laterCompletedInChain(progress, stepId, completedIds);
}

/**
 * Reject a completion: delete it AND every later completed step in its chain
 * (otherwise the chain would contain completed work after an undone step).
 * One rejection row is written per removed step so the trainee sees why.
 */
export async function rejectStep(
  trainer: Trainer,
  enrollment: Enrollment,
  stepId: number,
  reason: string,
) {
  const { tree, completions, completedIds, progress } = await treeAndProgress(enrollment);
  if (!enrollment.isActive) throw new PracticeError("This enrollment has been closed.", 403);

  const target = completions.find((c) => c.stepId === stepId);
  if (!target) throw new PracticeError("Step is not complete.", 404);

  const laterIds = laterCompletedInChain(progress, stepId, completedIds);
  const toRemove = [target, ...completions.filter((c) => laterIds.includes(c.stepId))];
  const titleOf = new Map(
    tree.labs.flatMap((l) => l.tasks.flatMap((t) => t.steps)).map((s) => [s.id, s.title]),
  );

  const paths = await db.transaction(async (tx) => {
    await tx.insert(labPracticeStepRejections).values(
      toRemove.map((c) => ({
        enrollmentId: enrollment.id,
        stepId: c.stepId,
        rejectedBy: trainer.id,
        reason:
          c.stepId === stepId
            ? reason
            : `Reset because an earlier step ("${titleOf.get(stepId) ?? "step"}") was rejected: ${reason}`,
        originalCompletedAt: c.completedAt,
      })),
    );
    return deleteCompletions(
      tx,
      toRemove.map((c) => c.id),
    );
  });
  await removeFiles(paths);

  return { removedStepIds: toRemove.map((c) => c.stepId) };
}
