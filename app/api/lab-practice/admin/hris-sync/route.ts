import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeEmployees } from "@/DB/labPracticeSchema";
import { handleError } from "@/lib/labPractice/api";
import { lastSyncedAt, syncEmployees } from "@/lib/labPractice/hris";
import { requireApiAdmin } from "@/lib/labPractice/identity";

export const runtime = "nodejs";

/** GET — cache status. */
export async function GET() {
  const { response } = await requireApiAdmin();
  if (response) return response;

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
  const { response } = await requireApiAdmin();
  if (response) return response;

  try {
    return NextResponse.json(await syncEmployees());
  } catch (err) {
    return handleError(err);
  }
}
