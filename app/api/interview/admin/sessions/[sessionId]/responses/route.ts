import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { candidateInterviewSessions } from "@/DB/interviewSchema";
import { deleteSessionResponses } from "@/lib/interview/moduleCleanup";
import { eq } from "drizzle-orm";
import { z } from "zod";

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const session = await auth();

    if (!["devAdmin"].includes(session?.user?.role ?? "user")) {
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

    const { sessionId } = parsed.data;

    const [existingSession] = await db
      .select({
        id: candidateInterviewSessions.id,
        moduleId: candidateInterviewSessions.moduleId,
      })
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const cleanup = await db.transaction(async (tx) =>
      deleteSessionResponses(tx, sessionId),
    );

    return Response.json(
      {
        success: true,
        sessionId,
        moduleId: existingSession.moduleId,
        deleted: cleanup,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "DELETE /api/interview/admin/sessions/{sessionId}/responses:",
      error,
    );
    return Response.json(
      { error: "Failed to delete session responses" },
      { status: 500 },
    );
  }
}
