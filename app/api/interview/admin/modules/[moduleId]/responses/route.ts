import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewModules } from "@/DB/interviewSchema";
import { deleteModuleResponses } from "@/lib/interview/moduleCleanup";
import { isAdminRole, type Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import { z } from "zod";

const paramsSchema = z.object({
  moduleId: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ moduleId: string }> },
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
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { moduleId } = parsed.data;

    const [existingModule] = await db
      .select({ id: interviewModules.id, name: interviewModules.name })
      .from(interviewModules)
      .where(eq(interviewModules.id, moduleId))
      .limit(1);

    if (!existingModule) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    const cleanup = await db.transaction(async (tx) =>
      deleteModuleResponses(tx, moduleId),
    );

    return Response.json(
      {
        success: true,
        moduleId,
        moduleName: existingModule.name,
        deleted: cleanup,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "DELETE /api/interview/admin/modules/{moduleId}/responses:",
      error,
    );
    return Response.json(
      { error: "Failed to delete module responses" },
      { status: 500 },
    );
  }
}
