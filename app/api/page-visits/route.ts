import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { pageVisits } from "@/DB/schema";

const PATH_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;

const pageVisitSchema = z.object({
  path: z.string().min(1).max(512).regex(PATH_PATTERN),
});

/**
 * Records one page visit for the admin activity log. Called from
 * PageVisitTracker (client) on route change, not from proxy.ts — mysql2's
 * TCP connections are unreliable inside Next's proxy execution context, so
 * the actual write happens here, in the ordinary Node.js API route runtime
 * where the rest of the app's DB access already works.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pageVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid path is required." }, { status: 400 });
  }

  await db.insert(pageVisits).values({
    id: randomUUID(),
    userId: session.user.id,
    path: parsed.data.path,
  });

  return NextResponse.json({ success: true });
}
