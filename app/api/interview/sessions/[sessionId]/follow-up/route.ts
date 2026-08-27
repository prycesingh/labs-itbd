import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewFollowupQuestions,
} from "@/DB/interviewSchema";
import { and, desc, eq } from "drizzle-orm";

/**
 * GET /api/interview/sessions/{sessionId}/follow-up?afterAnswerId=...
 *
 * Polling endpoint for the immediate-processing "checking..." UX (Phase 6):
 * given the answer the candidate just submitted, reports whether that
 * answer has finished transcription+evaluation yet, and if so, whether a
 * follow-up question is pending. Only meaningful for modules with the
 * follow_ups capability enabled — for any other module, the parent answer
 * will simply never carry an evaluationStatus this route needs to resolve
 * quickly, since immediate processing was never triggered for it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
    const url = new URL(request.url);
    const afterAnswerId = url.searchParams.get("afterAnswerId");

    const [sessionRow] = await db
      .select({
        id: candidateInterviewSessions.id,
        candidateId: candidateInterviewSessions.candidateId,
      })
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (sessionRow.candidateId !== session.user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    let answerStatus: {
      transcriptStatus: string;
      evaluationStatus: string;
    } | null = null;

    if (afterAnswerId) {
      const [answer] = await db
        .select({
          transcriptStatus: candidateInterviewAnswers.transcriptStatus,
          evaluationStatus: candidateInterviewAnswers.evaluationStatus,
        })
        .from(candidateInterviewAnswers)
        .where(
          and(
            eq(candidateInterviewAnswers.id, afterAnswerId),
            eq(candidateInterviewAnswers.sessionId, sessionId),
          ),
        )
        .limit(1);
      answerStatus = answer ?? null;
    }

    const [pendingFollowUp] = await db
      .select({
        id: interviewFollowupQuestions.id,
        questionText: interviewFollowupQuestions.questionText,
        idealPoints: interviewFollowupQuestions.idealPoints,
        parentAnswerId: interviewFollowupQuestions.parentAnswerId,
        createdAt: interviewFollowupQuestions.createdAt,
      })
      .from(interviewFollowupQuestions)
      .where(
        and(
          eq(interviewFollowupQuestions.sessionId, sessionId),
          eq(interviewFollowupQuestions.status, "pending"),
        ),
      )
      .orderBy(desc(interviewFollowupQuestions.createdAt))
      .limit(1);

    return Response.json(
      {
        processing:
          answerStatus !== null &&
          (answerStatus.transcriptStatus === "pending" ||
            answerStatus.transcriptStatus === "transcribing" ||
            answerStatus.evaluationStatus === "pending" ||
            answerStatus.evaluationStatus === "evaluating"),
        answerStatus,
        followUp: pendingFollowUp ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "GET /api/interview/sessions/{sessionId}/follow-up:",
      error,
    );
    return Response.json(
      { error: "Failed to fetch follow-up status" },
      { status: 500 },
    );
  }
}
