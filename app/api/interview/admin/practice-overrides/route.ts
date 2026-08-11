import { db } from "@/DB/drizzle";
import {
  interviewModules,
  interviewPracticeAttemptOverrides,
} from "@/DB/interviewSchema";
import { users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { createPracticeOverrideSchema } from "@/lib/validation/interview";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * GET /api/interview/admin/practice-overrides
 * List all per-user practice-attempt overrides, joined to user + module for display.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: interviewPracticeAttemptOverrides.id,
      userId: interviewPracticeAttemptOverrides.userId,
      userName: users.name,
      userEmail: users.email,
      moduleId: interviewPracticeAttemptOverrides.moduleId,
      moduleName: interviewModules.name,
      dailyLimit: interviewPracticeAttemptOverrides.dailyLimit,
      createdBy: interviewPracticeAttemptOverrides.createdBy,
      createdAt: interviewPracticeAttemptOverrides.createdAt,
      updatedAt: interviewPracticeAttemptOverrides.updatedAt,
    })
    .from(interviewPracticeAttemptOverrides)
    .innerJoin(users, eq(users.id, interviewPracticeAttemptOverrides.userId))
    .innerJoin(
      interviewModules,
      eq(interviewModules.id, interviewPracticeAttemptOverrides.moduleId),
    )
    .orderBy(desc(interviewPracticeAttemptOverrides.updatedAt));

  return NextResponse.json(rows, { status: 200 });
}

/**
 * POST /api/interview/admin/practice-overrides
 * Create or update the daily practice-attempt limit for a (user, module) pair.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createPracticeOverrideSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { userId, moduleId, dailyLimit } = parsed.data;

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [module] = await db
    .select({ id: interviewModules.id })
    .from(interviewModules)
    .where(eq(interviewModules.id, moduleId))
    .limit(1);

  if (!module) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: interviewPracticeAttemptOverrides.id })
    .from(interviewPracticeAttemptOverrides)
    .where(
      and(
        eq(interviewPracticeAttemptOverrides.userId, userId),
        eq(interviewPracticeAttemptOverrides.moduleId, moduleId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(interviewPracticeAttemptOverrides)
      .set({ dailyLimit, createdBy: guard.userId })
      .where(eq(interviewPracticeAttemptOverrides.id, existing.id));
  } else {
    await db.insert(interviewPracticeAttemptOverrides).values({
      id: randomUUID(),
      userId,
      moduleId,
      dailyLimit,
      createdBy: guard.userId,
    });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
