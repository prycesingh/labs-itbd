import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewModules } from "@/DB/interviewSchema";
import {
  deleteModuleQuestionAssignments,
  deleteModuleResponses,
} from "@/lib/interview/moduleCleanup";
import { eq } from "drizzle-orm";
import { z } from "zod";

const paramsSchema = z.object({
  moduleId: z.string().uuid(),
});

/**
 * DELETE /api/interview/admin/modules/{moduleId}
 * Delete a module (admin only)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { moduleId } = parsed.data;

    const [existingModule] = await db
      .select({ id: interviewModules.id })
      .from(interviewModules)
      .where(eq(interviewModules.id, moduleId))
      .limit(1);

    if (!existingModule) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    type ModuleCleanupTx = Parameters<
      typeof deleteModuleQuestionAssignments
    >[0];

    await db.transaction(async (tx: ModuleCleanupTx) => {
      await deleteModuleResponses(tx, moduleId);
      await deleteModuleQuestionAssignments(tx, moduleId);

      await tx
        .delete(interviewModules)
        .where(eq(interviewModules.id, moduleId));
    });

    return Response.json({ success: true, id: moduleId }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/interview/admin/modules/{moduleId}:", error);
    return Response.json({ error: "Failed to delete module" }, { status: 500 });
  }
}
