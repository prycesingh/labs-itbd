import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsSimulatorSessions as sessions } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

/**
 * Idempotent start/extend upsert for simulator time-tracking. The client
 * calls this on mount (no sessionId) and every ~45s while the tab stays
 * visible + focused (with the sessionId echoed back from the prior call).
 * Each call adds the elapsed time since the last heartbeat, clamped to
 * STALE_CEILING_SECONDS, so a gap (backgrounded tab, missed tick) can never
 * inflate accumulatedSeconds beyond what was actually observed.
 */

const SIMULATOR_KEY_PATTERN = /^[a-z0-9-]{1,60}$/;
const STALE_CEILING_SECONDS = 90;

const heartbeatSchema = z.object({
  simulatorKey: z.string(),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) return jsonError("A simulatorKey is required.");
  if (!SIMULATOR_KEY_PATTERN.test(parsed.data.simulatorKey)) {
    return jsonError("Invalid simulator key.");
  }

  const now = new Date();

  if (parsed.data.sessionId) {
    const [existing] = await db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.id, parsed.data.sessionId), eq(sessions.userId, user!.id)),
      )
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
        })
        .where(eq(sessions.id, existing.id));

      return NextResponse.json({ sessionId: existing.id });
    }
  }

  const sessionId = randomUUID();
  await db.insert(sessions).values({
    id: sessionId,
    userId: user!.id,
    simulatorKey: parsed.data.simulatorKey,
    startedAt: now,
    lastHeartbeatAt: now,
  });

  return NextResponse.json({ sessionId });
}
