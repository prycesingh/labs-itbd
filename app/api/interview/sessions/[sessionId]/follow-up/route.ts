import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewFollowupQuestions,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

const skipFollowUpSchema = z.object({
  followUpId: z.string().uuid("Invalid follow-up ID"),
});

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
        // The base question this follow-up is probing a gap in — shown to
        // the candidate so a follow-up never looks like an indistinguishable
        // "next question" (matches interview-coach-main's web UI, which
        // tags follow-ups and references the answer that prompted them).
        parentQuestionText: interviewQuestionBank.promptText,
        // Lets the client label the follow-up with the question it actually
        // belongs to, rather than whichever question index happens to be on
        // screen when follow-ups surface (always the last one, at submit).
        parentQuestionId: candidateInterviewAnswers.questionId,
      })
      .from(interviewFollowupQuestions)
      .innerJoin(
        candidateInterviewAnswers,
        eq(
          candidateInterviewAnswers.id,
          interviewFollowupQuestions.parentAnswerId,
        ),
      )
      .innerJoin(
        interviewQuestionBank,
        eq(interviewQuestionBank.id, candidateInterviewAnswers.questionId),
      )
      .where(
        and(
          eq(interviewFollowupQuestions.sessionId, sessionId),
          eq(interviewFollowupQuestions.status, "pending"),
          // Inline per-question check: only the follow-up for THIS answer,
          // so an older straggler can't be presented as this answer's probe.
          afterAnswerId
            ? eq(interviewFollowupQuestions.parentAnswerId, afterAnswerId)
            : undefined,
        ),
      )
      .orderBy(asc(interviewFollowupQuestions.createdAt))
      .limit(1);

    return Response.json(
      {
        // A failed transcription leaves evaluationStatus at "pending"
        // forever — count it as settled so the inline check doesn't wait out
        // its full timeout on an answer that will never be evaluated.
        processing:
          answerStatus !== null &&
          answerStatus.transcriptStatus !== "failed" &&
          answerStatus.evaluationStatus !== "failed" &&
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

/**
 * POST /api/interview/sessions/{sessionId}/follow-up  { followUpId }
 *
 * Marks a pending follow-up as "skipped". Without this, "Skip follow-up"
 * only cleared client state: the row stayed "pending", so the submit gate's
 * GET above returned the very same follow-up again and the candidate could
 * never reach final submission.
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
    const parsed = skipFollowUpSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const [sessionRow] = await db
      .select({ candidateId: candidateInterviewSessions.candidateId })
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    if (sessionRow.candidateId !== session.user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    // Scoped to this session and to "pending" so an already-answered
    // follow-up can't be flipped back, and the call is idempotent.
    await db
      .update(interviewFollowupQuestions)
      .set({ status: "skipped" })
      .where(
        and(
          eq(interviewFollowupQuestions.id, parsed.data.followUpId),
          eq(interviewFollowupQuestions.sessionId, sessionId),
          eq(interviewFollowupQuestions.status, "pending"),
        ),
      );

    return Response.json({ skipped: true }, { status: 200 });
  } catch (error) {
    console.error(
      "POST /api/interview/sessions/{sessionId}/follow-up:",
      error,
    );
    return Response.json(
      { error: "Failed to skip follow-up" },
      { status: 500 },
    );
  }
}
