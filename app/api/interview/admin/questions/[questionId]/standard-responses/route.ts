import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewQuestionStandardResponses } from "@/DB/interviewSchema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Validation schema for creating/updating standard responses
const createResponseSchema = z.object({
  responseText: z.string().min(1).max(2000),
  responseOrder: z.number().int().min(0).optional(),
});

/**
 * POST /api/interview/admin/questions/{questionId}/standard-responses
 * Create a standard response for a question (admin only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { questionId } = await params;
    const body = await request.json();
    const validated = createResponseSchema.parse(body);

    const responseId = randomUUID();
    const now = new Date().toISOString();

    // Auto-increment responseOrder if not provided
    let responseOrder = validated.responseOrder;
    if (responseOrder === undefined) {
      const lastResponse = await db
        .select()
        .from(interviewQuestionStandardResponses)
        .where(eq(interviewQuestionStandardResponses.questionId, questionId))
        .orderBy(desc(interviewQuestionStandardResponses.responseOrder))
        .limit(1);
      responseOrder =
        lastResponse.length > 0 ? lastResponse[0].responseOrder + 1 : 0;
    }

    await db.insert(interviewQuestionStandardResponses).values({
      id: responseId,
      questionId: questionId,
      responseText: validated.responseText,
      responseOrder: responseOrder,
      createdAt: now,
      updatedAt: now,
    });

    const [response] = await db
      .select()
      .from(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.id, responseId))
      .limit(1);

    return Response.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    console.error("POST /api/interview/admin/standard-responses:", error);
    return Response.json(
      { error: "Failed to create standard response" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/interview/admin/questions/{questionId}/standard-responses
 * List standard responses for a question (admin only)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { questionId } = await params;

    const responses = await db
      .select()
      .from(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.questionId, questionId))
      .orderBy(interviewQuestionStandardResponses.responseOrder);

    return Response.json(responses, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/admin/standard-responses:", error);
    return Response.json(
      { error: "Failed to fetch standard responses" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/interview/admin/standard-responses
 * Delete a standard response (admin only)
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { responseId } = body as { responseId: string };

    if (!responseId) {
      return Response.json(
        { error: "Missing responseId in request body" },
        { status: 400 },
      );
    }

    await db
      .delete(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.id, responseId));

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/interview/admin/standard-responses:", error);
    return Response.json(
      { error: "Failed to delete standard response" },
      { status: 500 },
    );
  }
}
