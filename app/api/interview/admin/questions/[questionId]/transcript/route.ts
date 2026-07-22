import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewQuestions } from "@/DB/interviewSchema";
import { transcribeAudio } from "@/lib/interview/aiServices";
import { isAdminRole, type Role } from "@/lib/rbac";
import { extractId, resolveAbsolutePath } from "@/lib/uploads";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { z } from "zod";

const paramsSchema = z.object({
  questionId: z.string().uuid(),
});

export async function POST(
  _request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role as Role | undefined)) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const params = await context.params;
    const parsed = paramsSchema.safeParse(params);

    if (!parsed.success) {
      return Response.json({ error: "Invalid questionId" }, { status: 400 });
    }

    const { questionId } = parsed.data;

    const [question] = await db
      .select({
        id: interviewQuestions.id,
        promptAudioPath: interviewQuestions.promptAudioPath,
      })
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, questionId))
      .limit(1);

    if (!question) {
      return Response.json({ error: "Question not found" }, { status: 404 });
    }

    if (!question.promptAudioPath) {
      return Response.json(
        { error: "Question prompt audio is required for transcription" },
        { status: 400 },
      );
    }

    const uploadId = extractId(question.promptAudioPath);
    if (!uploadId) {
      return Response.json(
        { error: "Unable to resolve prompt audio file" },
        { status: 400 },
      );
    }

    const absolutePath = resolveAbsolutePath(uploadId);
    const audioBuffer = await fs.readFile(absolutePath);

    const result = await transcribeAudio(audioBuffer, `question-${questionId}`);

    await db
      .update(interviewQuestions)
      .set({
        promptTranscript: result.text,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(interviewQuestions.id, questionId));

    return Response.json(
      {
        questionId,
        transcript: result.text,
        language: result.language,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "POST /api/interview/admin/questions/[questionId]/transcript",
      error,
    );
    return Response.json(
      { error: "Failed to generate transcript" },
      { status: 500 },
    );
  }
}
