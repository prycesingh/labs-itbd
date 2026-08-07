import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsSimulatorSessions as sessions } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

const STALE_CEILING_SECONDS = 90;

const closeSchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Best-effort session close, called via navigator.sendBeacon from
 * beforeunload/visibilitychange-hidden. Always resolves 200 — a missed or
 * late close call should never surface as an error to the caller, since the
 * next heartbeat simply starts a fresh session either way.
 */
export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: true });
  }

  const now = new Date();

  const [existing] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, parsed.data.sessionId), eq(sessions.userId, user!.id)))
    .limit(1);

  if (existing && existing.status === "active") {
    const elapsed = Math.max(
      0,
      Math.min(
        Math.floor((now.getTime() - existing.lastHeartbeatAt.getTime()) / 1000),
        STALE_CEILING_SECONDS,
      ),
    );

    await db
      .update(sessions)
      .set({
        accumulatedSeconds: existing.accumulatedSeconds + elapsed,
        lastHeartbeatAt: now,
        status: "ended",
        endedAt: now,
      })
      .where(eq(sessions.id, existing.id));
  }

  return NextResponse.json({ success: true });
}
