import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsQuizQuestions as quizQuestions } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";

const patchQuizQuestionSchema = z.object({
  question: z.string().trim().min(1).optional(),
  options: z.array(z.string().trim().min(1)).min(2).optional(),
  correctIndexes: z.array(z.number().int().nonnegative()).min(1).optional(),
  explanation: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { questionId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchQuizQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid question update.");
  }

  const [existing] = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);

  if (!existing) {
    return jsonError("Question not found.", 404);
  }

  const nextOptions = parsed.data.options ?? parseJsonColumn<string[]>(existing.options);
  const nextCorrectIndexes =
    parsed.data.correctIndexes ?? parseJsonColumn<number[]>(existing.correctIndexes);

  if (!nextCorrectIndexes.every((i) => i < nextOptions.length)) {
    return jsonError("correctIndexes must reference valid option indexes.");
  }

  await db
    .update(quizQuestions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(quizQuestions.id, questionId));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { questionId } = await params;

  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));

  return NextResponse.json({ success: true });
}
