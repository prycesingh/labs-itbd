import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewQuestionStandardResponses } from "@/DB/interviewSchema";
import { isAdminRole, type Role } from "@/lib/rbac";
import { updateStandardResponseSchema } from "@/lib/validation/interview";
import { eq } from "drizzle-orm";
import { z } from "zod";

const paramsSchema = z.object({
  responseId: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ responseId: string }> },
) {
  try {
    const session = await auth();

    if (!isAdminRole(session?.user?.role as Role | undefined)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid response id",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await db
      .delete(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.id, parsed.data.responseId));

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(
      "DELETE /api/interview/admin/standard-responses/{responseId}:",
      error,
    );
    return Response.json(
      { error: "Failed to delete standard response" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/interview/admin/standard-responses/{responseId}
 * Edit responseText and/or responseOrder of a standard response.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ responseId: string }> },
) {
  try {
    const session = await auth();
    if (!isAdminRole(session?.user?.role as Role | undefined)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid response ID",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { responseId } = parsed.data;

    const [existing] = await db
      .select({ id: interviewQuestionStandardResponses.id })
      .from(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.id, responseId))
      .limit(1);

    if (!existing) {
      return Response.json(
        { error: "Standard response not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validated = updateStandardResponseSchema.safeParse(body);
    if (!validated.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (validated.data.responseText !== undefined)
      updates.responseText = validated.data.responseText;
    if (validated.data.responseOrder !== undefined)
      updates.responseOrder = validated.data.responseOrder;

    await db
      .update(interviewQuestionStandardResponses)
      .set(updates)
      .where(eq(interviewQuestionStandardResponses.id, responseId));

    const [updated] = await db
      .select()
      .from(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.id, responseId))
      .limit(1);

    return Response.json(updated, { status: 200 });
  } catch (error) {
    console.error(
      "PATCH /api/interview/admin/standard-responses/{responseId}:",
      error,
    );
    return Response.json(
      { error: "Failed to update standard response" },
      { status: 500 },
    );
  }
}
