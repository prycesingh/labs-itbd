import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeEmployees } from "@/DB/labPracticeSchema";
import { handleError } from "@/lib/labPractice/api";
import { lastSyncedAt, syncEmployees } from "@/lib/labPractice/hris";
import { requirePermission } from "@/lib/admin/guard";

export const runtime = "nodejs";

/** GET — cache status. Trainers (and above) may check / refresh the HRIS
 *  cache when a new joiner is missing from the enrollment search. */
export async function GET() {
  const guard = await requirePermission("guidedLabs.train");
  if (!guard.ok) return guard.response;

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${labPracticeEmployees.isActive} then 1 else 0 end)`,
    })
    .from(labPracticeEmployees);

  return NextResponse.json({
    total: Number(counts?.total ?? 0),
    active: Number(counts?.active ?? 0),
    lastSyncedAt: await lastSyncedAt(),
    configured: Boolean(process.env.HRIS_API_KEY?.trim()),
  });
}

/** POST — sync now. */
export async function POST() {
  const guard = await requirePermission("guidedLabs.train");
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await syncEmployees());
  } catch (err) {
    return handleError(err);
  }
}
