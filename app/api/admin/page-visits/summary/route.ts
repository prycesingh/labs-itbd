import { gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { pageVisits } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { resolveBreadcrumbTrail, LAB_CATALOG } from "@/lib/dashboard-nav-data";

/**
 * GET /api/admin/page-visits/summary
 * Aggregates raw page_visits rows into "which tabs get used most" — grouped
 * by the same section/subgroup/link labels the dashboard nav already uses
 * (via resolveBreadcrumbTrail), not raw paths, so dynamic routes (e.g. each
 * simulator's own URL) roll up under one meaningful label instead of
 * fragmenting the count. Aggregation happens in-process rather than in SQL
 * since the label resolution logic (breadcrumb trail matching) only exists
 * in TS — the row volume here is modest enough (bounded by DB pool/query
 * cost, not by this loop) that pulling paths + reducing client-side is the
 * simplest correct option.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const since = new Date();
  since.setDate(since.getDate() - (Number.isFinite(days) && days > 0 ? days : 30));

  const rows = await db
    .select({ path: pageVisits.path, userId: pageVisits.userId })
    .from(pageVisits)
    .where(gte(pageVisits.visitedAt, since.toISOString().slice(0, 19).replace("T", " ")));

  const byLabel = new Map<
    string,
    { label: string; section: string | null; visits: number; users: Set<string> }
  >();

  for (const row of rows) {
    const trail =
      row.path === LAB_CATALOG.href
        ? { section: null, subgroup: null, link: LAB_CATALOG }
        : resolveBreadcrumbTrail(row.path);

    const label = trail?.link.label ?? row.path;
    const section = trail?.section?.label ?? null;
    const key = `${section ?? ""}::${label}`;

    const existing = byLabel.get(key);
    if (existing) {
      existing.visits += 1;
      existing.users.add(row.userId);
    } else {
      byLabel.set(key, {
        label,
        section,
        visits: 1,
        users: new Set([row.userId]),
      });
    }
  }

  const summary = Array.from(byLabel.values())
    .map((entry) => ({
      label: entry.label,
      section: entry.section,
      visits: entry.visits,
      uniqueUsers: entry.users.size,
    }))
    .sort((a, b) => b.visits - a.visits);

  return NextResponse.json({ summary, days, totalVisits: rows.length });
}
