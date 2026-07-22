import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsQuizQuestions as quizQuestions } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";
import { upsertQuizQuestionSchema } from "@/lib/validation/labs";

export async function GET(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const certId = new URL(request.url).searchParams.get("certId");

  if (!certId) {
    return jsonError("A certId query parameter is required.");
  }

  const rawQuestions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.certId, certId))
    .orderBy(asc(quizQuestions.sortOrder));

  const questions = rawQuestions.map((q) => ({
    ...q,
    options: parseJsonColumn<string[]>(q.options),
    correctIndexes: parseJsonColumn<number[]>(q.correctIndexes),
  }));

  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertQuizQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid question details.");
  }

  const question = {
    id: randomUUID(),
    certId: parsed.data.certId,
    question: parsed.data.question,
    options: parsed.data.options,
    correctIndexes: parsed.data.correctIndexes,
    explanation: parsed.data.explanation,
    sortOrder: parsed.data.sortOrder ?? 0,
    active: parsed.data.active ?? true,
  };

  await db.insert(quizQuestions).values(question);

  return NextResponse.json({ question }, { status: 201 });
}
