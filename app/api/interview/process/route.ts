import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { candidateInterviewSessions } from "@/DB/interviewSchema";
import { initializeBackgroundJobs } from "@/lib/backgroundJobHandlers";
import {
  getSessionProcessingStatus,
  initiateSessionProcessing,
  reEvaluateSessionProcessing,
  retryFailedProcessing,
} from "@/lib/interview/orchestration";
import { triggerProcessingSchema } from "@/lib/validation/interview";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const sessionIdSchema = z.string().uuid();
const retryProcessingSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.literal("retry"),
  answerIds: z.array(z.string().uuid()).optional(),
});

const reEvaluateProcessingSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.literal("reevaluate"),
  answerIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initializeBackgroundJobs();

  try {
    const body = await request.json().catch(() => null);
    const retryParsed = retryProcessingSchema.safeParse(body);

    if (retryParsed.success) {
      const [sessionRow] = await db
        .select({
          id: candidateInterviewSessions.id,
          candidateId: candidateInterviewSessions.candidateId,
        })
        .from(candidateInterviewSessions)
        .where(eq(candidateInterviewSessions.id, retryParsed.data.sessionId))
        .limit(1);

      if (!sessionRow) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      }

      const role = session.user.role ?? "user";
      const isAdmin = ["devAdmin", "adminTeam", "executive"].includes(role);
      const isOwner = sessionRow.candidateId === session.user.id;

      if (!isAdmin && !isOwner) {
        return NextResponse.json(
          { error: "Access denied: cannot retry another user's session" },
          { status: 403 },
        );
      }

      const result = await retryFailedProcessing(
        retryParsed.data.sessionId,
        retryParsed.data.answerIds,
        session.user.id,
      );

      return NextResponse.json(
        {
          message: "Retry processing started",
          retryJobIds: result.retryJobIds,
        },
        { status: 202 },
      );
    }

    const reEvaluateParsed = reEvaluateProcessingSchema.safeParse(body);

    if (reEvaluateParsed.success) {
      const [sessionRow] = await db
        .select({
          id: candidateInterviewSessions.id,
          candidateId: candidateInterviewSessions.candidateId,
        })
        .from(candidateInterviewSessions)
        .where(
          eq(candidateInterviewSessions.id, reEvaluateParsed.data.sessionId),
        )
        .limit(1);

      if (!sessionRow) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      }

      const role = session.user.role ?? "user";
      const isAdmin = ["devAdmin", "adminTeam", "executive"].includes(role);
      const isOwner = sessionRow.candidateId === session.user.id;

      if (!isAdmin && !isOwner) {
        return NextResponse.json(
          { error: "Access denied: cannot re-evaluate another user's session" },
          { status: 403 },
        );
      }

      const result = await reEvaluateSessionProcessing(
        reEvaluateParsed.data.sessionId,
        reEvaluateParsed.data.answerIds,
        session.user.id,
      );

      return NextResponse.json(
        {
          message: "Re-evaluation started",
          reEvaluationJobIds: result.reEvaluationJobIds,
        },
        { status: 202 },
      );
    }

    const parsed = triggerProcessingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid processing payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await initiateSessionProcessing(
      parsed.data.sessionId,
      session.user.id,
    );

    return NextResponse.json(
      {
        message: "Interview processing started",
        orchestrationJobId: result.orchestrationJobId,
        correlationId: result.correlationId,
        childJobs: result.childJobs,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Failed to trigger interview processing", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: "Failed to trigger interview processing", message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !sessionIdSchema.safeParse(sessionId).success) {
    return NextResponse.json(
      { error: "Valid sessionId query param is required" },
      { status: 400 },
    );
  }

  try {
    const status = await getSessionProcessingStatus(sessionId);
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch processing status", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: "Failed to fetch processing status", message },
      { status: 500 },
    );
  }
}
