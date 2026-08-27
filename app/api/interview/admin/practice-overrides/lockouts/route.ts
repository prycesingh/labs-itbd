import { db } from "@/DB/drizzle";
import { candidateInterviewSessions, interviewModules } from "@/DB/interviewSchema";
import { users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { getAttemptCadence } from "@/lib/interview/moduleCapabilities";
import { startOfThisWeek, startOfToday } from "@/lib/labs/date";
import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const FAILURE_LOCKOUT_THRESHOLD = 3;

/**
 * GET /api/interview/admin/practice-overrides/lockouts
 * Users currently locked out of a module due to 3+ failed attempts within
 * that MODULE'S cadence window (daily by default; weekly for modules with
 * the attempt_cadence capability set to weekly — see moduleCapabilities.ts
 * and app/api/interview/sessions/route.ts, which enforces the same window
 * when creating sessions). Purely derived from candidateInterviewSessions —
 * no stored flag, so a lockout self-clears once its module's next period
 * starts.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const modules = await db
    .select({ id: interviewModules.id, name: interviewModules.name })
    .from(interviewModules);

  const dailyStart = startOfToday().toISOString();
  const weeklyStart = startOfThisWeek().toISOString();

  const rowsPerModule = await Promise.all(
    modules.map(async (mod) => {
      const cadence = await getAttemptCadence(mod.id);
      const periodStart = cadence === "weekly" ? weeklyStart : dailyStart;

      return db
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
            eq(candidateInterviewSessions.moduleId, mod.id),
            eq(candidateInterviewSessions.status, "failed"),
            gte(candidateInterviewSessions.createdAt, periodStart),
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
    }),
  );

  return NextResponse.json(rowsPerModule.flat(), { status: 200 });
}
