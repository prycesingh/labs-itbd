import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewFollowupQuestions,
  interviewModuleQuestionAssignments,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
import { backgroundJobs } from "@/DB/schema";
import { getJobQueue } from "@/lib/backgroundJobs";
import { initializeBackgroundJobs } from "@/lib/backgroundJobHandlers";
import { getAudioStorageProvider } from "@/lib/interview/audioStorage";
import { generateCorrelationId, INTERVIEW_TRANSCRIPTION_JOB } from "@/lib/interview/jobConstants";
import {
  CAPABILITY_KEYS,
  getModuleCapability,
} from "@/lib/interview/moduleCapabilities";
import {
  uploadAudioSchema,
  validateAudioMetadata,
} from "@/lib/validation/interview";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

// Allow up to 60 s for the upload + storage write (relevant for serverless targets).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // This route can be the very first interview API call in a fresh server
  // process (a candidate's first answer upload, before any admin/processing
  // page has ever run) — without this, the immediate-processing transcription
  // job queued below via getJobQueue().triggerJob() can fire against a queue
  // with zero registered handlers, failing instantly with "No handler
  // registered for job type: interview-transcription" and silently stranding
  // that answer at transcriptStatus "pending" forever. Every other route that
  // queues/triggers an interview job already does this; this one was missed.
  initializeBackgroundJobs();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const audioFile = formData.get("audio");
    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "audio file is required" },
        { status: 400 },
      );
    }

    const rawSessionId = formData.get("sessionId");
    const rawQuestionId = formData.get("questionId");
    const rawFollowUpId = formData.get("followUpId");
    const rawQuestionIndex = formData.get("questionIndex");
    const rawAudioDuration = formData.get("audioDuration");
    const rawAudioMimeType = formData.get("audioMimeType");

    const parsed = uploadAudioSchema.safeParse({
      sessionId: String(rawSessionId ?? ""),
      ...(typeof rawQuestionId === "string" && rawQuestionId.length > 0
        ? { questionId: rawQuestionId }
        : {}),
      ...(typeof rawFollowUpId === "string" && rawFollowUpId.length > 0
        ? { followUpId: rawFollowUpId }
        : {}),
      questionIndex: Number(rawQuestionIndex),
      audioDuration: Number(rawAudioDuration),
      audioMimeType:
        typeof rawAudioMimeType === "string" && rawAudioMimeType.length > 0
          ? rawAudioMimeType
          : audioFile.type,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid upload payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      sessionId,
      questionId,
      followUpId,
      questionIndex,
      audioDuration,
      audioMimeType,
    } = parsed.data;

    const metadataValidation = validateAudioMetadata(
      audioFile.size,
      audioDuration,
      audioMimeType,
    );

    if (!metadataValidation.valid) {
      return NextResponse.json(
        { error: metadataValidation.error ?? "Invalid audio metadata" },
        { status: 400 },
      );
    }

    const [sessionRow] = await db
      .select()
      .from(candidateInterviewSessions)
      .where(eq(candidateInterviewSessions.id, sessionId))
      .limit(1);

    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (
      sessionRow.status === "processing" ||
      sessionRow.status === "completed"
    ) {
      return NextResponse.json(
        { error: `Cannot upload audio while session is ${sessionRow.status}` },
        { status: 409 },
      );
    }

    let resolvedQuestionId: string;
    let followUpRow: { id: string; parentAnswerId: string } | null = null;

    if (followUpId) {
      const [row] = await db
        .select({
          id: interviewFollowupQuestions.id,
          sessionId: interviewFollowupQuestions.sessionId,
          parentAnswerId: interviewFollowupQuestions.parentAnswerId,
          status: interviewFollowupQuestions.status,
        })
        .from(interviewFollowupQuestions)
        .where(eq(interviewFollowupQuestions.id, followUpId))
        .limit(1);

      if (!row || row.sessionId !== sessionId) {
        return NextResponse.json(
          { error: "Follow-up question not found for this session" },
          { status: 404 },
        );
      }
      if (row.status !== "pending") {
        return NextResponse.json(
          { error: "This follow-up question has already been answered" },
          { status: 409 },
        );
      }

      followUpRow = { id: row.id, parentAnswerId: row.parentAnswerId };
      // Follow-up answers aren't tied to a bank question; use the follow-up's
      // own ID as the answer's questionId so it still satisfies the
      // candidateInterviewAnswers schema without a real bank-question FK.
      resolvedQuestionId = row.id;
    } else {
      const [question] = await db
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
            eq(interviewQuestionBank.id, questionId!),
            eq(
              interviewModuleQuestionAssignments.moduleId,
              sessionRow.moduleId,
            ),
            eq(interviewModuleQuestionAssignments.isActive, true),
            eq(interviewQuestionBank.isActive, true),
          ),
        )
        .limit(1);

      if (!question) {
        return NextResponse.json(
          { error: "Question not found in selected module" },
          { status: 400 },
        );
      }
      resolvedQuestionId = question.id;
    }

    const audioStorage = getAudioStorageProvider();
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    const storageResult = await audioStorage.uploadAudio(
      audioBuffer,
      sessionId,
      questionIndex,
      audioMimeType,
      audioDuration,
    );

    const [existingAnswer] = await db
      .select({ id: candidateInterviewAnswers.id })
      .from(candidateInterviewAnswers)
      .where(
        and(
          eq(candidateInterviewAnswers.sessionId, sessionId),
          eq(candidateInterviewAnswers.questionId, resolvedQuestionId),
        ),
      )
      .limit(1);

    if (existingAnswer) {
      return NextResponse.json(
        {
          error:
            "Answer already submitted for this question. Additional attempts are not allowed.",
        },
        { status: 409 },
      );
    }

    const answerId = randomUUID();

    await db.insert(candidateInterviewAnswers).values({
      id: answerId,
      sessionId,
      questionId: resolvedQuestionId,
      questionIndex,
      isFollowUp: Boolean(followUpRow),
      followUpOfAnswerId: followUpRow?.parentAnswerId ?? null,
      audioStoragePath: storageResult.storagePath,
      audioMimeType: storageResult.mimeType,
      audioSizeBytes: storageResult.sizeBytes,
      audioDurationMs: storageResult.durationMs,
    });

    if (followUpRow) {
      await db
        .update(interviewFollowupQuestions)
        .set({ status: "answered" })
        .where(eq(interviewFollowupQuestions.id, followUpRow.id));
    }

    const [recordedStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.sessionId, sessionId));

    const recordedCount = Number(recordedStats?.count ?? 0);

    // Preserve ownerUserId from sessionState, or use current user's ID if missing
    const existingOwnerUserId =
      sessionRow.sessionState &&
      typeof sessionRow.sessionState === "object" &&
      "ownerUserId" in sessionRow.sessionState
        ? (sessionRow.sessionState as Record<string, unknown>).ownerUserId
        : session.user.id;

    await db
      .update(candidateInterviewSessions)
      .set({
        recordedCount,
        status: "recording",
        sessionState: {
          ownerUserId: existingOwnerUserId,
          currentQuestionIndex: questionIndex,
          recordedCount,
          processedCount: sessionRow.processedCount,
          errors: [],
        },
      })
      .where(eq(candidateInterviewSessions.id, sessionId));

    // Immediate per-answer processing: only for modules with follow_ups
    // enabled (Interview Coach today). This lets the UI show a brief
    // "checking..." state and surface an adaptive follow-up before the
    // candidate advances, instead of waiting for full-session submission —
    // see moduleCapabilities.ts. Every other module (Customer Centricity)
    // keeps its existing batch-at-submission flow untouched: this capability
    // check is the only new code path, and it's false by default.
    const followUpsCapability = await getModuleCapability(
      sessionRow.moduleId,
      CAPABILITY_KEYS.FOLLOW_UPS,
    );
    let immediateProcessingJobId: string | null = null;

    if (followUpsCapability.enabled) {
      const correlationId = generateCorrelationId(sessionId);
      const jobId = `${INTERVIEW_TRANSCRIPTION_JOB}_${sessionId}_${questionIndex}_${Date.now()}`;

      await db.insert(backgroundJobs).values({
        id: jobId,
        name: INTERVIEW_TRANSCRIPTION_JOB,
        status: "queued",
        correlationId,
        userId: session.user.id,
        maxExecutionTimeMs: 5 * 60 * 1000,
        maxAttempts: 3,
        result: {
          sessionId,
          answerId,
          audioStoragePath: storageResult.storagePath,
          type: "transcription-immediate",
        },
        error: null,
        createdAt: sql`CURRENT_TIMESTAMP`,
      });

      await db
        .update(candidateInterviewAnswers)
        .set({ transcriptJobId: jobId, transcriptStatus: "pending" })
        .where(eq(candidateInterviewAnswers.id, answerId));

      getJobQueue().triggerJob(jobId);
      immediateProcessingJobId = jobId;
    }

    return NextResponse.json(
      {
        answerId,
        sessionId,
        questionIndex,
        storagePath: storageResult.storagePath,
        mimeType: storageResult.mimeType,
        sizeBytes: storageResult.sizeBytes,
        durationMs: storageResult.durationMs,
        immediateProcessing: followUpsCapability.enabled,
        ...(immediateProcessingJobId
          ? { transcriptionJobId: immediateProcessingJobId }
          : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to upload interview audio", error);
    return NextResponse.json(
      { error: "Failed to upload interview audio" },
      { status: 500 },
    );
  }
}
