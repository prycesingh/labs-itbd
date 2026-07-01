/**
 * Database-Authoritative Background Job Queue
 *
 * Single-node worker using MySQL as source of truth.
 * No Redis / external queue infrastructure required.
 *
 * Reliability guarantees:
 * - Crash recovery for in-flight jobs
 * - DB-level lock per job type (single active queued/running)
 * - Retry with maxAttempts
 * - Execution timeout with maxExecutionTimeMs
 * - Durable state transitions with awaited writes
 */

import { db } from "@/DB/drizzle";
import { backgroundJobs } from "@/DB/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type BackgroundJob = {
  id: string;
  name: string;
  status: JobStatus;
  progress: number; // 0-100
  attempts: number;
  maxAttempts: number;
  maxExecutionTimeMs: number;
  executionTimeMs?: number;
  activeLockKey?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
  userId: string;
  createdAt: Date;
};

type JobHandler = (
  callbacks: {
    updateProgress: (progress: number) => void;
    updateResult: (result: unknown) => void;
  },
  jobId?: string,
) => Promise<unknown>;

export class JobConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobConcurrencyError";
  }
}

type EnqueueOptions = {
  maxAttempts?: number;
  maxExecutionTimeMs?: number;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_EXECUTION_MS = 15 * 60 * 1000;
const CRASH_RECOVERY_ERROR = "Server restarted during execution";
const DB_RETRY_ATTEMPTS = 3;
const DB_RETRY_BASE_DELAY_MS = 250;
const CLAIM_LOCK_RETRY_DELAY_MS = 800;

class BackgroundJobQueue {
  private handlers = new Map<string, JobHandler>();
  private writeChain = new Map<string, Promise<void>>();
  private activeExecutions = new Set<string>();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Don't initialize during build - only when actually used
  }

  private ensureInitialized() {
    if (!this.initPromise) {
      this.initPromise = this.initializeWorker();
    }
    return this.initPromise;
  }

  /**
   * Register a job handler (e.g., "sync-skills", "fetch-impact")
   */
  registerHandler(jobType: string, handler: JobHandler) {
    this.handlers.set(jobType, handler);
    void this.ensureInitialized().then(() =>
      this.resumeQueuedJobsForType(jobType),
    );
  }

  /**
   * Enqueue a new job (returns immediately, runs in background)
   */
  async enqueue(
    jobType: string,
    userId: string,
    options?: EnqueueOptions,
  ): Promise<string> {
    await this.ensureInitialized();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const maxAttempts = Math.max(
      1,
      options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    );
    const maxExecutionTimeMs = Math.max(
      1000,
      options?.maxExecutionTimeMs ?? DEFAULT_MAX_EXECUTION_MS,
    );

    try {
      await db.insert(backgroundJobs).values({
        id: jobId,
        name: jobType,
        activeLockKey: null,
        status: "queued",
        progress: 0,
        attempts: 0,
        maxAttempts,
        maxExecutionTimeMs,
        userId,
      });
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new JobConcurrencyError(
          `A ${jobType} job is already queued or running`,
        );
      }
      throw error;
    }

    this.scheduleJobExecution(jobId);
    return jobId;
  }

  /**
   * Get job status by ID (checks memory first, then database)
   */
  async getJob(jobId: string): Promise<BackgroundJob | null> {
    await this.ensureInitialized();
    const dbJob = await this.loadJobFromDB(jobId);
    return dbJob;
  }

  /**
   * Update job progress (called from job handler)
   */
  updateProgress(jobId: string, progress: number) {
    const clamped = Math.min(100, Math.max(0, progress));
    const previous = this.writeChain.get(jobId) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await this.withDbRetry(() =>
          db
            .update(backgroundJobs)
            .set({ progress: clamped })
            .where(
              and(
                eq(backgroundJobs.id, jobId),
                eq(backgroundJobs.status, "running"),
              ),
            ),
        );
      });

    this.writeChain.set(jobId, next);
  }

  updateResult(jobId: string, result: unknown) {
    const previous = this.writeChain.get(jobId) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await this.withDbRetry(() =>
          db
            .update(backgroundJobs)
            .set({ result })
            .where(
              and(
                eq(backgroundJobs.id, jobId),
                eq(backgroundJobs.status, "running"),
              ),
            ),
        );
      });

    this.writeChain.set(jobId, next);
  }

  /**
   * Internal: Execute job handler
   */
  private async executeJob(jobId: string) {
    await this.ensureInitialized();

    const queuedJob = await this.loadJobFromDB(jobId);
    if (!queuedJob || queuedJob.status !== "queued") return;

    let claimResult: unknown;
    try {
      claimResult = await db
        .update(backgroundJobs)
        .set({
          status: "running",
          startedAt: new Date().toISOString(),
          completedAt: null,
          executionTimeMs: null,
          progress: 0,
          error: null,
          activeLockKey: queuedJob.name,
          attempts: sql`${backgroundJobs.attempts} + 1`,
        })
        .where(
          and(
            eq(backgroundJobs.id, jobId),
            eq(backgroundJobs.status, "queued"),
          ),
        );
    } catch (error) {
      if (this.isDuplicateError(error)) {
        this.scheduleJobRetry(jobId, CLAIM_LOCK_RETRY_DELAY_MS);
        return;
      }
      throw error;
    }

    if (
      (claimResult as { rowsAffected?: number } | undefined)?.rowsAffected === 0
    ) {
      return;
    }

    const runningJob = await this.loadJobFromDB(jobId);
    if (!runningJob || runningJob.status !== "running") return;

    const handler = this.handlers.get(runningJob.name);
    if (!handler) {
      await this.failJob(
        runningJob,
        `No handler registered for job type: ${runningJob.name}`,
      );
      return;
    }

    const startedAtMs = Date.now();
    const isInterviewJob = runningJob.name.startsWith("interview-");

    if (isInterviewJob) {
      console.log(
        `[Interview Jobs] START ${runningJob.name} | id=${jobId} | attempt=${runningJob.attempts}/${runningJob.maxAttempts}`,
      );
    }

    try {
      const result = await this.withTimeout(
        handler(
          {
            updateProgress: (progress: number) =>
              this.updateProgress(jobId, progress),
            updateResult: (result: unknown) => this.updateResult(jobId, result),
          },
          jobId,
        ),
        runningJob.maxExecutionTimeMs,
      );

      await this.awaitProgressWrites(jobId);

      await db
        .update(backgroundJobs)
        .set({
          status: "completed",
          progress: 100,
          completedAt: new Date().toISOString(),
          result,
          error: null,
          executionTimeMs: Date.now() - startedAtMs,
          activeLockKey: null,
        })
        .where(
          and(
            eq(backgroundJobs.id, jobId),
            eq(backgroundJobs.status, "running"),
          ),
        );

      if (isInterviewJob) {
        console.log(
          `[Interview Jobs] DONE ${runningJob.name} | id=${jobId} | ms=${Date.now() - startedAtMs}`,
        );
      }
    } catch (error) {
      await this.awaitProgressWrites(jobId);

      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = runningJob.attempts < runningJob.maxAttempts;

      if (isInterviewJob) {
        console.error(
          `[Interview Jobs] FAIL ${runningJob.name} | id=${jobId} | retry=${shouldRetry} | error=${message}`,
        );
      }

      if (shouldRetry) {
        try {
          await db
            .update(backgroundJobs)
            .set({
              status: "queued",
              progress: 0,
              startedAt: null,
              completedAt: null,
              executionTimeMs: null,
              error: message,
              activeLockKey: null,
            })
            .where(eq(backgroundJobs.id, jobId));

          this.scheduleJobRetry(jobId, CLAIM_LOCK_RETRY_DELAY_MS);
        } catch (statusUpdateError) {
          console.error(
            `Failed to re-queue job ${jobId} after error:`,
            statusUpdateError,
          );
          try {
            await this.failJob(
              runningJob,
              `Job crashed and re-queue failed: ${message}`,
              Date.now() - startedAtMs,
            );
          } catch (finalizeError) {
            console.error(
              `Failed to mark job ${jobId} as failed after re-queue error:`,
              finalizeError,
            );
          }
        }
      } else {
        await this.failJob(runningJob, message, Date.now() - startedAtMs);
      }
    } finally {
      this.writeChain.delete(jobId);
    }
  }

  /**
   * Load job from database
   */
  private async loadJobFromDB(jobId: string): Promise<BackgroundJob | null> {
    try {
      const result = await this.withDbRetry(() =>
        db
          .select()
          .from(backgroundJobs)
          .where(eq(backgroundJobs.id, jobId))
          .limit(1),
      );

      if (result.length === 0) return null;

      return this.mapRowToBackgroundJob(result[0]);
    } catch (error) {
      console.error("Error loading job from database:", error);
      throw error;
    }
  }

  /**
   * Get recent jobs for user
   */
  async getRecentJobs(userId: string, limit = 20): Promise<BackgroundJob[]> {
    await this.ensureInitialized();

    try {
      const dbJobs = await this.withDbRetry(() =>
        db
          .select()
          .from(backgroundJobs)
          .where(eq(backgroundJobs.userId, userId))
          .orderBy(desc(backgroundJobs.createdAt))
          .limit(limit),
      );

      return dbJobs.map((row) => this.mapRowToBackgroundJob(row));
    } catch (error) {
      console.error("Error fetching recent jobs from database:", error);
      return [];
    }
  }

  private async initializeWorker() {
    try {
      await this.recoverRunningJobs();
      await this.clearQueuedLockKeys();
    } catch (error) {
      // Skip recovery if database connection fails or table doesn't exist
      console.warn(
        "[BackgroundJobs] Recovery skipped:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async clearQueuedLockKeys() {
    await db
      .update(backgroundJobs)
      .set({ activeLockKey: null })
      .where(eq(backgroundJobs.status, "queued"));
  }

  private async recoverRunningJobs() {
    const runningJobs = await db
      .select({ id: backgroundJobs.id, startedAt: backgroundJobs.startedAt })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.status, "running"));

    const nowIso = new Date().toISOString();

    for (const row of runningJobs) {
      const startedMs = row.startedAt
        ? new Date(row.startedAt).getTime()
        : Date.now();
      const duration = Math.max(0, Date.now() - startedMs);

      await db
        .update(backgroundJobs)
        .set({
          status: "failed",
          error: CRASH_RECOVERY_ERROR,
          completedAt: nowIso,
          executionTimeMs: duration,
          activeLockKey: null,
        })
        .where(eq(backgroundJobs.id, row.id));
    }
  }

  private async resumeQueuedJobsForType(jobType: string) {
    await this.ensureInitialized();

    try {
      const jobs = await db
        .select({ id: backgroundJobs.id })
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.status, "queued"),
            eq(backgroundJobs.name, jobType),
          ),
        )
        .orderBy(backgroundJobs.createdAt)
        .limit(50);

      for (const job of jobs) {
        this.scheduleJobExecution(job.id);
      }
    } catch (error) {
      // Skip if table doesn't exist (build time)
      console.warn(
        `[BackgroundJobs] Resume skipped for ${jobType}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Trigger execution of a specific queued job by ID.
   * Use this when a job is inserted directly into the DB (not via enqueue()).
   */
  triggerJob(jobId: string) {
    this.scheduleJobExecution(jobId);
  }

  private scheduleJobExecution(jobId: string) {
    if (this.activeExecutions.has(jobId)) return;
    this.activeExecutions.add(jobId);

    queueMicrotask(async () => {
      try {
        await this.executeJob(jobId);
      } catch (error) {
        console.error(`Error executing job ${jobId}:`, error);
      } finally {
        this.activeExecutions.delete(jobId);
      }
    });
  }

  private scheduleJobRetry(jobId: string, delayMs: number) {
    setTimeout(
      () => {
        this.scheduleJobExecution(jobId);
      },
      Math.max(100, delayMs),
    );
  }

  private async failJob(
    job: BackgroundJob,
    errorMessage: string,
    executionTimeMs?: number,
  ) {
    await db
      .update(backgroundJobs)
      .set({
        status: "failed",
        error: errorMessage,
        completedAt: new Date().toISOString(),
        executionTimeMs,
        activeLockKey: null,
      })
      .where(eq(backgroundJobs.id, job.id));
  }

  private async awaitProgressWrites(jobId: string) {
    const pending = this.writeChain.get(jobId);
    if (!pending) return;

    try {
      await pending;
    } catch (error) {
      console.error(`Progress write failed for job ${jobId}:`, error);
    }
  }

  private mapRowToBackgroundJob(
    row: typeof backgroundJobs.$inferSelect,
  ): BackgroundJob {
    return {
      id: row.id,
      name: row.name,
      activeLockKey: row.activeLockKey ?? undefined,
      status: row.status as JobStatus,
      progress: row.progress,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      maxExecutionTimeMs: row.maxExecutionTimeMs,
      executionTimeMs: row.executionTimeMs ?? undefined,
      userId: row.userId,
      startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      error: row.error || undefined,
      result: row.result,
      createdAt: new Date(row.createdAt),
    };
  }

  private isDuplicateError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const candidate = error as {
      code?: string;
      errno?: number;
      cause?: { code?: string; errno?: number; message?: string };
      message?: string;
    };

    const code = candidate.code ?? candidate.cause?.code;
    const errno = candidate.errno ?? candidate.cause?.errno;
    const message = candidate.message ?? candidate.cause?.message;

    return (
      code === "ER_DUP_ENTRY" ||
      errno === 1062 ||
      message?.includes("Duplicate entry") === true
    );
  }

  private isTransientDbError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const candidate = error as {
      code?: string;
      errno?: number;
      cause?: { code?: string; errno?: number };
      message?: string;
    };

    const code = candidate.code ?? candidate.cause?.code;
    const errno = candidate.errno ?? candidate.cause?.errno;

    return (
      code === "ECONNRESET" ||
      code === "PROTOCOL_CONNECTION_LOST" ||
      code === "ETIMEDOUT" ||
      code === "ECONNREFUSED" ||
      errno === -4077 ||
      candidate.message?.includes("ECONNRESET") === true
    );
  }

  private async withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < DB_RETRY_ATTEMPTS) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (
          !this.isTransientDbError(error) ||
          attempt === DB_RETRY_ATTEMPTS - 1
        ) {
          break;
        }

        const delay = DB_RETRY_BASE_DELAY_MS * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt += 1;
      }
    }

    throw lastError;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Job timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return (await Promise.race([promise, timeoutPromise])) as T;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

// Singleton instance
const queue = new BackgroundJobQueue();

export function getJobQueue() {
  return queue;
}
