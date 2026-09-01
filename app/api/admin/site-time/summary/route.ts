import { desc, eq, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsSiteSessions } from "@/DB/labsSchema";
import { users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";

const TOP_USERS_LIMIT = 20;

/**
 * GET /api/admin/site-time/summary
 * Aggregates labs_site_sessions into "how much time is being spent on the
 * site overall, and by whom" — total seconds across all users, plus a
 * per-user ranked breakdown (most active first). Query param: days (default
 * 30) filters sessions to those started within that window.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const since = new Date();
  since.setDate(since.getDate() - (Number.isFinite(days) && days > 0 ? days : 30));

  const [totals, byUser] = await Promise.all([
    db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${labsSiteSessions.accumulatedSeconds}), 0)`,
        activeUserCount: sql<number>`count(distinct ${labsSiteSessions.userId})`,
      })
      .from(labsSiteSessions)
      .where(gte(labsSiteSessions.startedAt, since)),
    db
      .select({
        userId: labsSiteSessions.userId,
        userName: users.name,
        userEmail: users.email,
        totalSeconds: sql<number>`coalesce(sum(${labsSiteSessions.accumulatedSeconds}), 0)`,
        sessionCount: sql<number>`count(*)`,
      })
      .from(labsSiteSessions)
      .innerJoin(users, eq(users.id, labsSiteSessions.userId))
      .where(gte(labsSiteSessions.startedAt, since))
      .groupBy(labsSiteSessions.userId, users.name, users.email)
      .orderBy(desc(sql`coalesce(sum(${labsSiteSessions.accumulatedSeconds}), 0)`))
      .limit(TOP_USERS_LIMIT),
  ]);

  return NextResponse.json({
    days,
    totalSeconds: Number(totals[0]?.totalSeconds ?? 0),
    activeUserCount: Number(totals[0]?.activeUserCount ?? 0),
    topUsers: byUser.map((row) => ({
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      totalSeconds: Number(row.totalSeconds),
      sessionCount: Number(row.sessionCount),
    })),
  });
}
