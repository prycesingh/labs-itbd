import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsSimulatorStates as simulatorStates } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";

/**
 * Generic per-user save slot shared by every simulator suite — the row is
 * keyed by (userId, simulatorKey), so this one route serves all of them.
 * `state` is an opaque blob; the caller's simulator component owns its shape.
 */

const SIMULATOR_KEY_PATTERN = /^[a-z0-9-]{1,60}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ simulatorKey: string }> },
) {
  const { user, response } = await requireApiUser();

  if (response) return response;

  const { simulatorKey } = await params;

  if (!SIMULATOR_KEY_PATTERN.test(simulatorKey)) {
    return jsonError("Invalid simulator key.");
  }

  const [row] = await db
    .select()
    .from(simulatorStates)
    .where(
      and(eq(simulatorStates.userId, user!.id), eq(simulatorStates.simulatorKey, simulatorKey)),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ state: null });
  }

  return NextResponse.json({ state: parseJsonColumn(row.stateJson), updatedAt: row.updatedAt });
}

const saveStateSchema = z.object({
  state: z.unknown(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ simulatorKey: string }> },
) {
  const { user, response } = await requireApiUser();

  if (response) return response;

  const { simulatorKey } = await params;

  if (!SIMULATOR_KEY_PATTERN.test(simulatorKey)) {
    return jsonError("Invalid simulator key.");
  }

  const body = await request.json().catch(() => null);
  const parsed = saveStateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("A state payload is required.");
  }

  await db
    .insert(simulatorStates)
    .values({
      userId: user!.id,
      simulatorKey,
      stateJson: parsed.data.state,
    })
    .onDuplicateKeyUpdate({
      set: { stateJson: parsed.data.state, updatedAt: new Date() },
    });

  return NextResponse.json({ success: true });
}
