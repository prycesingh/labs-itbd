import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewModules,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
import { isAdminRole, type Role } from "@/lib/rbac";
import { assignQuestionSchema } from "@/lib/validation/interview";
import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const paramsSchema = z.object({ moduleId: z.string().uuid() });

/**
 * GET /api/interview/admin/modules/{moduleId}/questions
 * List questions assigned to a module, ordered by questionOrder.
 * Returns joined bank question data.
 *
 * Pagination is OPT-IN via ?page=&limit= (same query-param convention as
 * GET /api/interview/admin/question-bank). Omitting both returns the full,
 * unpaginated array exactly as before — AssignQuestionDialog.tsx depends on
 * that plain-array shape and must keep working unmodified. Only callers
 * that explicitly ask for a page (ModuleManagementPage.tsx, added for
 * modules with hundreds of questions like Interview Coach's 211) get the
 * paginated `{ items, total, page, limit, totalPages }` wrapper.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  try {
    const session = await auth();
    if (!isAdminRole(session?.user?.role as Role | undefined)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid module ID" }, { status: 400 });
    }

    const { moduleId } = parsed.data;

    const { searchParams } = new URL(request.url);
    const hasPaginationParams =
      searchParams.has("page") || searchParams.has("limit");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;

    const baseQuery = () =>
      db
        .select({
          id: interviewModuleQuestionAssignments.id,
          moduleId: interviewModuleQuestionAssignments.moduleId,
          questionId: interviewModuleQuestionAssignments.questionId,
          questionOrder: interviewModuleQuestionAssignments.questionOrder,
          isActive: interviewModuleQuestionAssignments.isActive,
          createdAt: interviewModuleQuestionAssignments.createdAt,
          question: {
            id: interviewQuestionBank.id,
            promptText: interviewQuestionBank.promptText,
            promptAudioPath: interviewQuestionBank.promptAudioPath,
            promptTranscript: interviewQuestionBank.promptTranscript,
            isActive: interviewQuestionBank.isActive,
            createdAt: interviewQuestionBank.createdAt,
            updatedAt: interviewQuestionBank.updatedAt,
          },
        })
        .from(interviewModuleQuestionAssignments)
        .innerJoin(
          interviewQuestionBank,
          eq(
            interviewQuestionBank.id,
            interviewModuleQuestionAssignments.questionId,
          ),
        )
        .where(eq(interviewModuleQuestionAssignments.moduleId, moduleId))
        .orderBy(interviewModuleQuestionAssignments.questionOrder);

    if (!hasPaginationParams) {
      const assignments = await baseQuery();
      return Response.json(assignments, { status: 200 });
    }

    const [items, [{ total }]] = await Promise.all([
      baseQuery().limit(limit).offset(offset),
      db
        .select({ total: count() })
        .from(interviewModuleQuestionAssignments)
        .where(eq(interviewModuleQuestionAssignments.moduleId, moduleId)),
    ]);

    return Response.json(
      {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "GET /api/interview/admin/modules/{moduleId}/questions:",
      error,
    );
    return Response.json(
      { error: "Failed to fetch module questions" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/interview/admin/modules/{moduleId}/questions
 * Assign a bank question to this module.
 * Body: { questionId: string, questionOrder?: number }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  try {
    const session = await auth();
    if (!isAdminRole(session?.user?.role as Role | undefined)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid module ID" }, { status: 400 });
    }

    const { moduleId } = parsed.data;

    const [module] = await db
      .select({ id: interviewModules.id })
      .from(interviewModules)
      .where(eq(interviewModules.id, moduleId))
      .limit(1);

    if (!module) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = assignQuestionSchema.safeParse(body);
    if (!validated.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { questionId, questionOrder: providedOrder } = validated.data;

    // Verify question exists in bank
    const [bankQuestion] = await db
      .select({ id: interviewQuestionBank.id })
      .from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId))
      .limit(1);

    if (!bankQuestion) {
      return Response.json(
        { error: "Bank question not found" },
        { status: 404 },
      );
    }

    // Check not already assigned
    const [existing] = await db
      .select({ id: interviewModuleQuestionAssignments.id })
      .from(interviewModuleQuestionAssignments)
      .where(
        and(
          eq(interviewModuleQuestionAssignments.moduleId, moduleId),
          eq(interviewModuleQuestionAssignments.questionId, questionId),
        ),
      )
      .limit(1);

    if (existing) {
      return Response.json(
        { error: "Question is already assigned to this module" },
        { status: 409 },
      );
    }

    // Auto-increment order if not provided
    let questionOrder = providedOrder;
    if (questionOrder === undefined) {
      const [lastAssignment] = await db
        .select({
          questionOrder: interviewModuleQuestionAssignments.questionOrder,
        })
        .from(interviewModuleQuestionAssignments)
        .where(eq(interviewModuleQuestionAssignments.moduleId, moduleId))
        .orderBy(desc(interviewModuleQuestionAssignments.questionOrder))
        .limit(1);
      questionOrder = lastAssignment ? lastAssignment.questionOrder + 1 : 0;
    }

    const assignmentId = randomUUID();
    const now = new Date().toISOString();

    await db.insert(interviewModuleQuestionAssignments).values({
      id: assignmentId,
      moduleId,
      questionId,
      questionOrder,
      isActive: true,
      createdAt: now,
    });

    const [created] = await db
      .select({
        id: interviewModuleQuestionAssignments.id,
        moduleId: interviewModuleQuestionAssignments.moduleId,
        questionId: interviewModuleQuestionAssignments.questionId,
        questionOrder: interviewModuleQuestionAssignments.questionOrder,
        isActive: interviewModuleQuestionAssignments.isActive,
        createdAt: interviewModuleQuestionAssignments.createdAt,
        question: {
          id: interviewQuestionBank.id,
          promptText: interviewQuestionBank.promptText,
          promptAudioPath: interviewQuestionBank.promptAudioPath,
          promptTranscript: interviewQuestionBank.promptTranscript,
          isActive: interviewQuestionBank.isActive,
        },
      })
      .from(interviewModuleQuestionAssignments)
      .innerJoin(
        interviewQuestionBank,
        eq(
          interviewQuestionBank.id,
          interviewModuleQuestionAssignments.questionId,
        ),
      )
      .where(eq(interviewModuleQuestionAssignments.id, assignmentId))
      .limit(1);

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/interview/admin/modules/{moduleId}/questions:",
      error,
    );
    return Response.json(
      { error: "Failed to assign question" },
      { status: 500 },
    );
  }
}
