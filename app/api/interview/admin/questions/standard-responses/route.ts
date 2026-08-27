import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewQuestionStandardResponses } from "@/DB/interviewSchema";
import { isAdminRole, type Role } from "@/lib/rbac";
import { count, inArray } from "drizzle-orm";
import { z } from "zod";

const MAX_QUESTION_IDS = 200;

const querySchema = z.object({
  questionIds: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(MAX_QUESTION_IDS)),
});

/**
 * GET /api/interview/admin/questions/standard-responses?questionIds=id1,id2,...
 *
 * Batch standard-response COUNT lookup — returns { questionId, count } per
 * requested id, never full response text. Exists so a list of many
 * questions (e.g. a module-management page rendering a page of collapsed
 * question rows) can show a "N responses" badge per row with one request
 * instead of one GET .../{questionId}/standard-responses per row. Question
 * ids with zero responses are included with count: 0, not omitted, so the
 * caller doesn't have to special-case "missing from the response."
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdminRole(session?.user?.role as Role | undefined)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      questionIds: searchParams.get("questionIds") ?? "",
    });

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { questionIds } = parsed.data;

    const rows = await db
      .select({
        questionId: interviewQuestionStandardResponses.questionId,
        count: count(),
      })
      .from(interviewQuestionStandardResponses)
      .where(inArray(interviewQuestionStandardResponses.questionId, questionIds))
      .groupBy(interviewQuestionStandardResponses.questionId);

    const countByQuestionId = new Map(
      rows.map((row) => [row.questionId, Number(row.count)]),
    );

    const result = questionIds.map((questionId) => ({
      questionId,
      count: countByQuestionId.get(questionId) ?? 0,
    }));

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/admin/questions/standard-responses:", error);
    return Response.json(
      { error: "Failed to fetch standard response counts" },
      { status: 500 },
    );
  }
}
