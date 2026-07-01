import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewModules,
  interviewQuestionBank,
  interviewQuestionStandardResponses,
} from "@/DB/interviewSchema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const DB_RETRY_ATTEMPTS = 2;
const DB_RETRY_BASE_DELAY_MS = 150;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableDbError = (error: unknown) => {
  const visited = new Set<object>();
  const queue: unknown[] = [error];
  const codes = new Set<string>();
  const messages: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const candidate = current as {
      code?: string;
      errno?: number;
      message?: string;
      cause?: unknown;
      err?: unknown;
    };

    if (candidate.code) {
      codes.add(candidate.code);
    }
    if (candidate.errno !== undefined) {
      codes.add(String(candidate.errno));
    }
    if (candidate.message) {
      messages.push(candidate.message);
    }
    if (candidate.cause) {
      queue.push(candidate.cause);
    }
    if (candidate.err) {
      queue.push(candidate.err);
    }
  }

  if (
    codes.has("ECONNRESET") ||
    codes.has("ETIMEDOUT") ||
    codes.has("EPIPE") ||
    codes.has("PROTOCOL_CONNECTION_LOST") ||
    codes.has("UND_ERR_CONNECT_TIMEOUT")
  ) {
    return true;
  }

  return /econnreset|timed out|timeout|connection lost|socket hang up|read econnreset/i.test(
    messages.join(" "),
  );
};

const withDbRetry = async <T>(label: string, operation: () => Promise<T>) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry =
        attempt < DB_RETRY_ATTEMPTS && isRetryableDbError(error);

      if (!shouldRetry) {
        throw error;
      }

      const delay = DB_RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[db][modules] ${label} failed with transient DB error; retrying in ${delay}ms (${attempt + 1}/${DB_RETRY_ATTEMPTS}).`,
      );
      await wait(delay);
    }
  }
};

// Validation schema for creating/updating modules
const createModuleSchema = z.object({
  name: z.string().min(1).max(255),
  questionDisplayCount: z.number().int().positive(),
  description: z.string().max(1000).optional(),
});

const toggleModuleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

const DEFAULT_INTERVIEW_TYPE = "customer-service" as const;

/**
 * POST /api/interview/admin/modules
 * Create a new interview module (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    // Check admin authorization
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createModuleSchema.parse(body);

    const moduleId = randomUUID();
    const now = new Date().toISOString();

    await withDbRetry("create-module", () =>
      db.insert(interviewModules).values({
        id: moduleId,
        name: validated.name,
        interviewType: DEFAULT_INTERVIEW_TYPE,
        questionDisplayCount: validated.questionDisplayCount,
        description: validated.description || null,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const [module] = await withDbRetry("create-module-readback", () =>
      db
        .select()
        .from(interviewModules)
        .where(eq(interviewModules.id, moduleId))
        .limit(1),
    );

    return Response.json(module, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    console.error("POST /api/interview/admin/modules:", error);
    return Response.json({ error: "Failed to create module" }, { status: 500 });
  }
}

/**
 * GET /api/interview/admin/modules
 * List all interview modules (admin only)
 */
export async function GET() {
  try {
    const session = await auth();

    // Check admin authorization
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const modules = await withDbRetry("list-modules", () =>
      db
        .select()
        .from(interviewModules)
        .orderBy(desc(interviewModules.createdAt)),
    );

    if (modules.length === 0) {
      return Response.json(modules, { status: 200 });
    }

    const moduleIds = modules.map((module) => module.id);
    const questionCounts = await withDbRetry("module-question-counts", () =>
      db
        .select({
          moduleId: interviewModuleQuestionAssignments.moduleId,
          questionCount: sql<number>`count(*)`,
        })
        .from(interviewModuleQuestionAssignments)
        .where(inArray(interviewModuleQuestionAssignments.moduleId, moduleIds))
        .groupBy(interviewModuleQuestionAssignments.moduleId),
    );

    const countMap = new Map<string, number>(
      questionCounts.map((item) => [
        String(item.moduleId),
        Number(item.questionCount),
      ]),
    );

    const modulesWithCounts = modules.map((module) => ({
      ...module,
      _count: { questions: countMap.get(module.id) ?? 0 },
    }));

    return Response.json(modulesWithCounts, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/admin/modules:", error);
    return Response.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}

/**
 * PATCH /api/interview/admin/modules
 * Activate/deactivate a module (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validated = toggleModuleSchema.parse(body);

    const [module] = await withDbRetry("load-module-for-toggle", () =>
      db
        .select({
          id: interviewModules.id,
          questionDisplayCount: interviewModules.questionDisplayCount,
        })
        .from(interviewModules)
        .where(eq(interviewModules.id, validated.id))
        .limit(1),
    );

    if (!module) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    if (validated.isActive) {
      const questions = await withDbRetry("load-active-questions", () =>
        db
          .select({ id: interviewQuestionBank.id })
          .from(interviewModuleQuestionAssignments)
          .innerJoin(
            interviewQuestionBank,
            eq(
              interviewQuestionBank.id,
              interviewModuleQuestionAssignments.questionId,
            ),
          )
          .where(
            and(
              eq(interviewModuleQuestionAssignments.moduleId, validated.id),
              eq(interviewModuleQuestionAssignments.isActive, true),
              eq(interviewQuestionBank.isActive, true),
            ),
          ),
      );

      const fullQuestions = await withDbRetry("load-question-readiness", () =>
        db
          .select({
            id: interviewQuestionBank.id,
            promptAudioPath: interviewQuestionBank.promptAudioPath,
            promptTranscript: interviewQuestionBank.promptTranscript,
          })
          .from(interviewModuleQuestionAssignments)
          .innerJoin(
            interviewQuestionBank,
            eq(
              interviewQuestionBank.id,
              interviewModuleQuestionAssignments.questionId,
            ),
          )
          .where(
            and(
              eq(interviewModuleQuestionAssignments.moduleId, validated.id),
              eq(interviewModuleQuestionAssignments.isActive, true),
              eq(interviewQuestionBank.isActive, true),
            ),
          ),
      );

      if (questions.length < module.questionDisplayCount) {
        return Response.json(
          {
            error: "Module is not ready for activation",
            details: {
              reason:
                "Add more active questions before activation. Each module must have at least the configured display count.",
              questionDisplayCount: module.questionDisplayCount,
              activeQuestionCount: questions.length,
            },
          },
          { status: 400 },
        );
      }

      const questionIds = questions.map((question) => question.id);

      const missingPromptAudioCount = fullQuestions.filter(
        (question) =>
          !question.promptAudioPath ||
          question.promptAudioPath.trim().length === 0,
      ).length;

      if (missingPromptAudioCount > 0) {
        return Response.json(
          {
            error: "Module is not ready for activation",
            details: {
              reason:
                "Every active question must have uploaded prompt audio before activation.",
              questionsMissingPromptAudio: missingPromptAudioCount,
            },
          },
          { status: 400 },
        );
      }

      const missingPromptTranscriptCount = fullQuestions.filter(
        (question) =>
          !question.promptTranscript ||
          question.promptTranscript.trim().length === 0,
      ).length;

      if (missingPromptTranscriptCount > 0) {
        return Response.json(
          {
            error: "Module is not ready for activation",
            details: {
              reason:
                "Every active question must have a generated transcript before activation.",
              questionsMissingPromptTranscript: missingPromptTranscriptCount,
            },
          },
          { status: 400 },
        );
      }

      const responseCounts = await withDbRetry("load-response-counts", () =>
        db
          .select({
            questionId: interviewQuestionStandardResponses.questionId,
            total: sql<number>`count(*)`,
          })
          .from(interviewQuestionStandardResponses)
          .where(
            inArray(interviewQuestionStandardResponses.questionId, questionIds),
          )
          .groupBy(interviewQuestionStandardResponses.questionId),
      );

      const coveredQuestionIds = new Set(
        responseCounts
          .filter((item) => Number(item.total) > 0)
          .map((item) => String(item.questionId)),
      );

      const missingResponseCount = questionIds.filter(
        (id) => !coveredQuestionIds.has(id),
      ).length;

      if (missingResponseCount > 0) {
        return Response.json(
          {
            error: "Module is not ready for activation",
            details: {
              reason:
                "Every active question must have at least one standard response before activation.",
              questionsMissingStandardResponses: missingResponseCount,
            },
          },
          { status: 400 },
        );
      }
    }

    await withDbRetry("toggle-module-status", () =>
      db
        .update(interviewModules)
        .set({
          isActive: validated.isActive,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(interviewModules.id, validated.id)),
    );

    const [updatedModule] = await withDbRetry("toggle-module-readback", () =>
      db
        .select()
        .from(interviewModules)
        .where(eq(interviewModules.id, validated.id))
        .limit(1),
    );

    return Response.json(updatedModule, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("PATCH /api/interview/admin/modules:", error);
    return Response.json({ error: "Failed to update module" }, { status: 500 });
  }
}
