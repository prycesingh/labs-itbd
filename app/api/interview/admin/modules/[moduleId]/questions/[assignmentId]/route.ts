import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewModules,
} from "@/DB/interviewSchema";
import { isAdminRole, type Role } from "@/lib/rbac";
import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";

const paramsSchema = z.object({
  moduleId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

/**
 * DELETE /api/interview/admin/modules/{moduleId}/questions/{assignmentId}
 * Unassign a question from a module.
 * Auto-deactivates the module if remaining active question count < questionDisplayCount.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ moduleId: string; assignmentId: string }> },
) {
  try {
    const session = await auth();
    if (!isAdminRole(session?.user?.role as Role | undefined)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid parameters",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { moduleId, assignmentId } = parsed.data;

    const [existing] = await db
      .select({ id: interviewModuleQuestionAssignments.id })
      .from(interviewModuleQuestionAssignments)
      .where(
        sql`${interviewModuleQuestionAssignments.id} = ${assignmentId} AND ${interviewModuleQuestionAssignments.moduleId} = ${moduleId}`,
      )
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }

    const [module] = await db
      .select({
        id: interviewModules.id,
        name: interviewModules.name,
        questionDisplayCount: interviewModules.questionDisplayCount,
        isActive: interviewModules.isActive,
      })
      .from(interviewModules)
      .where(eq(interviewModules.id, moduleId))
      .limit(1);

    if (!module) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    let moduleDeactivated = false;

    await db.transaction(async (tx) => {
      await tx
        .delete(interviewModuleQuestionAssignments)
        .where(eq(interviewModuleQuestionAssignments.id, assignmentId));

      // Count remaining active assignments
      const [{ remaining }] = await tx
        .select({ remaining: count() })
        .from(interviewModuleQuestionAssignments)
        .where(
          sql`${interviewModuleQuestionAssignments.moduleId} = ${moduleId} AND ${interviewModuleQuestionAssignments.isActive} = true`,
        );

      const remainingCount = Number(remaining);

      if (module.isActive && remainingCount < module.questionDisplayCount) {
        await tx
          .update(interviewModules)
          .set({ isActive: false })
          .where(eq(interviewModules.id, moduleId));
        moduleDeactivated = true;
      }
    });

    return Response.json(
      {
        success: true,
        assignmentId,
        moduleId,
        moduleName: module.name,
        moduleDeactivated,
        deactivationReason: moduleDeactivated
          ? `Active question count dropped below required ${module.questionDisplayCount}`
          : null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "DELETE /api/interview/admin/modules/{moduleId}/questions/{assignmentId}:",
      error,
    );
    return Response.json(
      { error: "Failed to unassign question" },
      { status: 500 },
    );
  }
}
