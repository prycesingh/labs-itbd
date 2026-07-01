import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { candidateInterviewSessions } from "@/DB/interviewSchema";
import { initializeBackgroundJobs } from "@/lib/backgroundJobHandlers";
import { initiateSessionProcessing } from "@/lib/interview/orchestration";
import { eq } from "drizzle-orm";

/**
 * POST /api/interview/sessions/{sessionId}/record
 * Mark a session as "recorded" (user ready for processing)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
    initializeBackgroundJobs();

    const [interviewSession] = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!interviewSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const ownerUserId =
      interviewSession.sessionState &&
      typeof interviewSession.sessionState === "object" &&
      "ownerUserId" in interviewSession.sessionState
        ? String(
            (interviewSession.sessionState as Record<string, unknown>)
              .ownerUserId ?? "",
          )
        : "";

    console.log(
      `[Interview Auth] SessionId: ${sessionId}, OwnerUserId: ${ownerUserId || "EMPTY"}, Current user: ${session.user.id}, CandidateId: ${interviewSession.candidateId}`,
    );

    if (ownerUserId) {
      if (ownerUserId !== session.user.id) {
        console.error(
          `[Interview Auth] Session owner mismatch. Stored: ${ownerUserId}, Current user: ${session.user.id}`,
        );
        return Response.json(
          { error: "Access denied: not session owner" },
          { status: 403 },
        );
      }
    } else {
      // Session missing ownerUserId - use candidateId as fallback
      if (interviewSession.candidateId !== session.user.id) {
        console.error(
          `[Interview Auth] CandidateId mismatch. Stored candidateId: ${interviewSession.candidateId}, Current user: ${session.user.id}`,
        );
        return Response.json(
          {
            error: "Access denied: you are not the session candidate",
          },
          { status: 403 },
        );
      }
    }

    if (interviewSession.status !== "recording") {
      return Response.json(
        { error: "Session must be in 'recording' status to mark as recorded" },
        { status: 400 },
      );
    }

    await db
      .update(candidateInterviewSessions)
      .set({
        status: "recorded",
        recordingCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(candidateInterviewSessions.id, sessionId));

    const [recordedSession] = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    // Initiate background processing for this session
    try {
      await initiateSessionProcessing(sessionId, session.user.id);
    } catch (orchestrationError) {
      console.error(
        `[Interview] Failed to initiate processing for session ${sessionId}:`,
        orchestrationError,
      );
      // Don't fail the endpoint - the user can retry from the processing page
    }

    return Response.json(recordedSession ?? null, { status: 200 });
  } catch (error) {
    console.error("POST /api/interview/sessions/{sessionId}/record:", error);
    return Response.json(
      { error: "Failed to mark session as recorded" },
      { status: 500 },
    );
  }
}
