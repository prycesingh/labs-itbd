import { db } from "@/DB/drizzle";
import { emailAssessmentAttemptOverrides } from "@/DB/emailAssessmentSchema";
import { requireAdmin } from "@/lib/admin/guard";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const paramsSchema = z.object({ overrideId: z.string().uuid() });

/**
 * DELETE /api/emailAssessment/admin/practice-overrides/{overrideId}
 * Reset a user's daily session-start limit back to the default (1/day).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ overrideId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid override ID" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: emailAssessmentAttemptOverrides.id })
    .from(emailAssessmentAttemptOverrides)
    .where(eq(emailAssessmentAttemptOverrides.id, parsed.data.overrideId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Override not found" }, { status: 404 });
  }

  await db
    .delete(emailAssessmentAttemptOverrides)
    .where(eq(emailAssessmentAttemptOverrides.id, parsed.data.overrideId));

  return NextResponse.json({ success: true }, { status: 200 });
}
