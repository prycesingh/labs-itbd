import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  labsQuizAttempts as quizAttempts,
  labsQuizCerts as quizCerts,
  labsQuizQuestions as quizQuestions,
} from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";
import { startQuizAttemptSchema } from "@/lib/validation/labs";

/**
 * Starts a new attempt and returns its question set with the answer key
 * stripped — `correctIndexes` must never reach the client before the learner
 * answers, or the quiz would be trivially cheatable via devtools.
 */
export async function POST(request: Request) {
  const { user, response } = await requireApiUser();

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = startQuizAttemptSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("A quiz cert ID is required.");
  }

  const [cert] = await db
    .select()
    .from(quizCerts)
    .where(eq(quizCerts.id, parsed.data.certId))
    .limit(1);

  if (!cert || !cert.active) {
    return jsonError("Quiz not found.", 404);
  }

  const rawQuestions = await db
    .select({
      id: quizQuestions.id,
      question: quizQuestions.question,
      options: quizQuestions.options,
      sortOrder: quizQuestions.sortOrder,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.certId, cert.id))
    .orderBy(asc(quizQuestions.sortOrder));

  if (rawQuestions.length === 0) {
    return jsonError("This quiz has no questions yet.", 409);
  }

  const questions = rawQuestions.map((q) => ({
    ...q,
    options: parseJsonColumn<string[]>(q.options),
  }));

  const attemptId = randomUUID();

  await db.insert(quizAttempts).values({
    id: attemptId,
    userId: user!.id,
    certId: cert.id,
    totalQuestions: questions.length,
  });

  return NextResponse.json({
    attemptId,
    cert: { id: cert.id, code: cert.code, name: cert.name },
    questions,
  });
}
