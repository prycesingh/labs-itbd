import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { emailAssessmentRateLimits as rateLimits } from "@/DB/emailAssessmentSchema";

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  const [record] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

  if (!record || record.windowStart < windowStart) {
    await db
      .insert(rateLimits)
      .values({
        key,
        windowStart: now,
        count: 1,
        updatedAt: now,
      })
      .onDuplicateKeyUpdate({
        set: {
          windowStart: now,
          count: 1,
          updatedAt: now,
        },
      });

    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(
        (record.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000
      ),
    };
  }

  await db
    .update(rateLimits)
    .set({
      count: sql`${rateLimits.count} + 1`,
      updatedAt: now,
    })
    .where(eq(rateLimits.key, key));

  return { allowed: true, remaining: limit - record.count - 1 };
}

export function rateLimitResponse(retryAfterSeconds = 60) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
