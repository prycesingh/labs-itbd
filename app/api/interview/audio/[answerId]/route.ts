import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { candidateInterviewAnswers } from "@/DB/interviewSchema";
import { getAudioStorageProvider } from "@/lib/interview/audioStorage";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const answerIdSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ answerId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedAnswerId = answerIdSchema.safeParse(params.answerId);
  if (!parsedAnswerId.success) {
    return NextResponse.json({ error: "Invalid answerId" }, { status: 400 });
  }

  try {
    const [answer] = await db
      .select({
        id: candidateInterviewAnswers.id,
        sessionId: candidateInterviewAnswers.sessionId,
        audioStoragePath: candidateInterviewAnswers.audioStoragePath,
      })
      .from(candidateInterviewAnswers)
      .where(eq(candidateInterviewAnswers.id, parsedAnswerId.data))
      .limit(1);

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    const storage = getAudioStorageProvider();
    const audioUrl = await storage.getSignedUrl(answer.audioStoragePath, 1);

    return NextResponse.json(
      {
        answerId: answer.id,
        sessionId: answer.sessionId,
        audioUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to fetch audio url", error);
    return NextResponse.json(
      { error: "Failed to fetch audio url" },
      { status: 500 },
    );
  }
}
