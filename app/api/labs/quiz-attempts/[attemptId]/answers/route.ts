import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  labsQuizAnswers as quizAnswers,
  labsQuizAttempts as quizAttempts,
  labsQuizQuestions as quizQuestions,
} from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";
import { submitQuizAnswerSchema } from "@/lib/validation/labs";

function sameIndexSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((i) => setB.has(i));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { user, response } = await requireApiUser();

  if (response) return response;

  const { attemptId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = submitQuizAnswerSchema.safeParse({ ...body, attemptId });

  if (!parsed.success) {
    return jsonError("Invalid answer submission.");
  }

  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.userId !== user!.id) {
    return jsonError("Quiz attempt not found.", 404);
  }

  if (attempt.status !== "in_progress") {
    return jsonError("This quiz attempt is already complete.", 409);
  }

  const [question] = await db
    .select()
    .from(quizQuestions)
    .where(
      and(eq(quizQuestions.id, parsed.data.questionId), eq(quizQuestions.certId, attempt.certId)),
    )
    .limit(1);

  if (!question) {
    return jsonError("Question not found for this quiz.", 404);
  }

  const correctIndexes = parseJsonColumn<number[]>(question.correctIndexes);
  const isCorrect = sameIndexSet(parsed.data.selectedIndexes, correctIndexes);

  await db.insert(quizAnswers).values({
    id: randomUUID(),
    attemptId,
    questionId: question.id,
    selectedIndexes: parsed.data.selectedIndexes,
    isCorrect,
  });

  return NextResponse.json({
    isCorrect,
    correctIndexes,
    explanation: question.explanation,
  });
}
