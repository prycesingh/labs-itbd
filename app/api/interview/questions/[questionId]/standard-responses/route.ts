import { db } from "@/DB/drizzle";
import { interviewQuestionStandardResponses } from "@/DB/interviewSchema";
import { eq } from "drizzle-orm";

/**
 * GET /api/interview/questions/{questionId}/standard-responses
 * List standard responses for a question (public - for user display)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const { questionId } = await params;

    const responses = await db
      .select()
      .from(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.questionId, questionId))
      .orderBy(interviewQuestionStandardResponses.responseOrder);

    return Response.json(responses, { status: 200 });
  } catch (error) {
    console.error(
      "GET /api/interview/questions/{questionId}/standard-responses:",
      error,
    );
    return Response.json(
      { error: "Failed to fetch standard responses" },
      { status: 500 },
    );
  }
}
