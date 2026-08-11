import { db } from "@/DB/drizzle";
import { candidateInterviewSessions, interviewModules } from "@/DB/interviewSchema";
import { users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { startOfToday } from "@/lib/labs/date";
import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const FAILURE_LOCKOUT_THRESHOLD = 3;

/**
 * GET /api/interview/admin/practice-overrides/lockouts
 * Users currently locked out of a module today due to 3+ failed attempts.
 * Purely derived from candidateInterviewSessions — no stored flag, so the
 * lockout self-clears once a new calendar day starts.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const today = startOfToday().toISOString();

  const rows = await db
    .select({
      userId: candidateInterviewSessions.candidateId,
      userName: users.name,
      userEmail: users.email,
      moduleId: candidateInterviewSessions.moduleId,
      moduleName: interviewModules.name,
      failedCount: sql<number>`count(*)`,
      lastFailureAt: sql<string>`max(${candidateInterviewSessions.createdAt})`,
    })
    .from(candidateInterviewSessions)
    .innerJoin(users, eq(users.id, candidateInterviewSessions.candidateId))
    .innerJoin(
      interviewModules,
      eq(interviewModules.id, candidateInterviewSessions.moduleId),
    )
    .where(
      and(
        eq(candidateInterviewSessions.status, "failed"),
        gte(candidateInterviewSessions.createdAt, today),
      ),
    )
    .groupBy(
      candidateInterviewSessions.candidateId,
      users.name,
      users.email,
      candidateInterviewSessions.moduleId,
      interviewModules.name,
    )
    .having(sql`count(*) >= ${FAILURE_LOCKOUT_THRESHOLD}`);

  return NextResponse.json(rows, { status: 200 });
}
