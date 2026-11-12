import { db } from "@/DB/drizzle";
import { interviewModules } from "@/DB/interviewSchema";
import { backgroundJobs } from "@/DB/schema";
import { requirePermission } from "@/lib/admin/guard";
import { getJobQueue } from "@/lib/backgroundJobs";
import { initializeBackgroundJobs } from "@/lib/backgroundJobHandlers";
import { INTERVIEW_PROMPT_AUDIO_JOB } from "@/lib/interview/jobConstants";
import { getModulePromptAudioStatus } from "@/lib/interview/promptAudio";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";

const moduleIdSchema = z.string().uuid();

async function findModule(moduleId: string) {
  const [row] = await db
    .select({ id: interviewModules.id })
    .from(interviewModules)
    .where(eq(interviewModules.id, moduleId))
    .limit(1);
  return row ?? null;
}

/** A queued/running prompt-audio job for this module, if any. */
async function findActiveJob(moduleId: string) {
  const [row] = await db
    .select({ id: backgroundJobs.id, progress: backgroundJobs.progress })
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.name, INTERVIEW_PROMPT_AUDIO_JOB),
        inArray(backgroundJobs.status, ["queued", "running"]),
        sql`JSON_EXTRACT(result, '$.moduleId') = ${moduleId}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * GET /api/interview/admin/modules/{moduleId}/prompt-audio
 * How many of the module's active questions have no playable audio on this
 * server, and whether a regeneration job is already running.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const guard = await requirePermission("content.view");
  if (!guard.ok) return guard.response;

  const { moduleId } = await params;
  if (!moduleIdSchema.safeParse(moduleId).success) {
    return Response.json({ error: "Invalid module ID" }, { status: 400 });
  }

  try {
    if (!(await findModule(moduleId))) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }
    const [{ total, missing }, activeJob] = await Promise.all([
      getModulePromptAudioStatus(moduleId),
      findActiveJob(moduleId),
    ]);
    return Response.json({
      total,
      missingCount: missing.length,
      activeJob,
    });
  } catch (error) {
    console.error("GET prompt-audio status:", error);
    return Response.json(
      { error: "Failed to check question audio" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/interview/admin/modules/{moduleId}/prompt-audio
 * Queues a background job that generates text-to-speech audio for every
 * active question missing it. Idempotent: returns the running job instead
 * of starting a second one.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const guard = await requirePermission("content.edit");
  if (!guard.ok) return guard.response;

  const { moduleId } = await params;
  if (!moduleIdSchema.safeParse(moduleId).success) {
    return Response.json({ error: "Invalid module ID" }, { status: 400 });
  }

  initializeBackgroundJobs();

  try {
    if (!(await findModule(moduleId))) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    const existing = await findActiveJob(moduleId);
    if (existing) {
      return Response.json({ jobId: existing.id, alreadyRunning: true });
    }

    const { missing } = await getModulePromptAudioStatus(moduleId);
    if (missing.length === 0) {
      return Response.json({ jobId: null, queued: 0 });
    }

    const jobId = `${INTERVIEW_PROMPT_AUDIO_JOB}_${moduleId}_${randomUUID()}`;
    await db.insert(backgroundJobs).values({
      id: jobId,
      name: INTERVIEW_PROMPT_AUDIO_JOB,
      status: "queued",
      userId: guard.userId,
      maxAttempts: 1,
      // ~2–3 s per TTS call; 211 questions fit comfortably in 20 minutes.
      maxExecutionTimeMs: 20 * 60 * 1000,
      result: { moduleId, type: "prompt-audio" },
      error: null,
      createdAt: sql`CURRENT_TIMESTAMP`,
    });
    getJobQueue().triggerJob(jobId);

    return Response.json(
      { jobId, queued: missing.length },
      { status: 202 },
    );
  } catch (error) {
    console.error("POST prompt-audio:", error);
    return Response.json(
      { error: "Failed to start audio generation" },
      { status: 500 },
    );
  }
}
