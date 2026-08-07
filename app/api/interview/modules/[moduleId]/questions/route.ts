import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
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
        id: interviewQuestionBank.id,
        moduleId: interviewModuleQuestionAssignments.moduleId,
        promptText: interviewQuestionBank.promptText,
        promptAudioPath: interviewQuestionBank.promptAudioPath,
        promptTranscript: interviewQuestionBank.promptTranscript,
        questionOrder: interviewModuleQuestionAssignments.questionOrder,
        isActive: interviewQuestionBank.isActive,
        createdAt: interviewQuestionBank.createdAt,
        updatedAt: interviewQuestionBank.updatedAt,
      })
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
          eq(interviewModuleQuestionAssignments.moduleId, parsed.data),
          eq(interviewModuleQuestionAssignments.isActive, true),
          eq(interviewQuestionBank.isActive, true),
        ),
      )
      .orderBy(asc(interviewModuleQuestionAssignments.questionOrder));

    return NextResponse.json(questions, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/modules/{moduleId}/questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 },
    );
  }
}
