import { db } from "@/DB/drizzle";
import { emailAssessmentAttemptOverrides } from "@/DB/emailAssessmentSchema";
import { users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { createEmailAssessmentOverrideSchema } from "@/lib/validation/emailAssessment";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * GET /api/emailAssessment/admin/practice-overrides
 * List all per-user daily session-start-limit overrides, joined to user for display.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: emailAssessmentAttemptOverrides.id,
      userId: emailAssessmentAttemptOverrides.userId,
      userName: users.name,
      userEmail: users.email,
      dailyLimit: emailAssessmentAttemptOverrides.dailyLimit,
      createdBy: emailAssessmentAttemptOverrides.createdBy,
      createdAt: emailAssessmentAttemptOverrides.createdAt,
      updatedAt: emailAssessmentAttemptOverrides.updatedAt,
    })
    .from(emailAssessmentAttemptOverrides)
    .innerJoin(users, eq(users.id, emailAssessmentAttemptOverrides.userId))
    .orderBy(desc(emailAssessmentAttemptOverrides.updatedAt));

  return NextResponse.json(rows, { status: 200 });
}

/**
 * POST /api/emailAssessment/admin/practice-overrides
 * Create or update the daily session-start limit for a user.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createEmailAssessmentOverrideSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { userId, dailyLimit } = parsed.data;

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: emailAssessmentAttemptOverrides.id })
    .from(emailAssessmentAttemptOverrides)
    .where(eq(emailAssessmentAttemptOverrides.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(emailAssessmentAttemptOverrides)
      .set({ dailyLimit, createdBy: guard.userId })
      .where(eq(emailAssessmentAttemptOverrides.id, existing.id));
  } else {
    await db.insert(emailAssessmentAttemptOverrides).values({
      id: randomUUID(),
      userId,
      dailyLimit,
      createdBy: guard.userId,
    });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
