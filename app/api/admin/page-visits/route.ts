import { desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { pageVisits, users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";

const PAGE_SIZE = 50;

/**
 * GET /api/admin/page-visits
 * Lists recent page visits (newest first), optionally filtered to one user.
 * Query params: userId (optional), page (1-based, default 1).
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const userId = request.nextUrl.searchParams.get("userId") || undefined;
  const pageParam = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const whereClause = userId ? eq(pageVisits.userId, userId) : undefined;

  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select({
        id: pageVisits.id,
        userId: pageVisits.userId,
        userName: users.name,
        userEmail: users.email,
        path: pageVisits.path,
        visitedAt: pageVisits.visitedAt,
      })
      .from(pageVisits)
      .innerJoin(users, eq(users.id, pageVisits.userId))
      .where(whereClause)
      .orderBy(desc(pageVisits.visitedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(pageVisits)
      .where(whereClause),
  ]);

  return NextResponse.json({
    rows,
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / PAGE_SIZE)),
  });
}
