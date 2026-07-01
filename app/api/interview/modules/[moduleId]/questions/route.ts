import { db } from "@/DB/drizzle";
import { interviewQuestions } from "@/DB/interviewSchema";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const moduleIdSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  try {
    const params = await context.params;
    const parsed = moduleIdSchema.safeParse(params.moduleId);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid moduleId" }, { status: 400 });
    }

    const questions = await db
      .select({
        id: interviewQuestions.id,
        moduleId: interviewQuestions.moduleId,
        promptText: interviewQuestions.promptText,
        promptAudioPath: interviewQuestions.promptAudioPath,
        promptTranscript: interviewQuestions.promptTranscript,
        questionOrder: interviewQuestions.questionOrder,
        isActive: interviewQuestions.isActive,
        createdAt: interviewQuestions.createdAt,
        updatedAt: interviewQuestions.updatedAt,
      })
      .from(interviewQuestions)
      .where(
        and(
          eq(interviewQuestions.moduleId, parsed.data),
          eq(interviewQuestions.isActive, true),
        ),
      )
      .orderBy(asc(interviewQuestions.questionOrder));

    return NextResponse.json(questions, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/modules/{moduleId}/questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 },
    );
  }
}
