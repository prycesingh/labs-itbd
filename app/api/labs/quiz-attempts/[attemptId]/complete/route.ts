import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsQuizAnswers as quizAnswers, labsQuizAttempts as quizAttempts } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { user, response } = await requireApiUser();

  if (response) return response;

  const { attemptId } = await params;

  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.userId !== user!.id) {
    return jsonError("Quiz attempt not found.", 404);
  }

  if (attempt.status === "completed") {
    return NextResponse.json({
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      scorePercent: attempt.scorePercent,
    });
  }

  const answers = await db
    .select({ isCorrect: quizAnswers.isCorrect })
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attemptId));

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const scorePercent = Math.round((correctCount / attempt.totalQuestions) * 100);

  await db
    .update(quizAttempts)
    .set({
      status: "completed",
      correctCount,
      scorePercent,
      completedAt: new Date(),
    })
    .where(eq(quizAttempts.id, attemptId));

  return NextResponse.json({
    correctCount,
    totalQuestions: attempt.totalQuestions,
    scorePercent,
  });
}
