import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewModuleQuestionAssignments,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
import { getAudioStorageProvider } from "@/lib/interview/audioStorage";
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
    const rawQuestionIndex = formData.get("questionIndex");
    const rawAudioDuration = formData.get("audioDuration");
    const rawAudioMimeType = formData.get("audioMimeType");

    const parsed = uploadAudioSchema.safeParse({
      sessionId: String(rawSessionId ?? ""),
      questionId: String(rawQuestionId ?? ""),
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
          eq(interviewQuestionBank.id, questionId),
          eq(interviewModuleQuestionAssignments.moduleId, sessionRow.moduleId),
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
          eq(candidateInterviewAnswers.questionId, questionId),
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
      questionId,
      questionIndex,
      audioStoragePath: storageResult.storagePath,
      audioMimeType: storageResult.mimeType,
      audioSizeBytes: storageResult.sizeBytes,
      audioDurationMs: storageResult.durationMs,
    });

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

    return NextResponse.json(
      {
        answerId,
        sessionId,
        questionIndex,
        storagePath: storageResult.storagePath,
        mimeType: storageResult.mimeType,
        sizeBytes: storageResult.sizeBytes,
        durationMs: storageResult.durationMs,
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
