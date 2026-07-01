import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { emailAssessmentSessionManualScores as sessionManualScores } from "@/DB/emailAssessmentSchema";
import { jsonError, requireApiUser } from "@/lib/emailAssessment/auth";

const scoreSchema = z.object({
  score: z.number().int().min(0).max(10),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { user, response } = await requireApiUser(["admin", "assessor"]);
  if (response) return response;

  const { sessionId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = scoreSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Score must be an integer between 0 and 10.");
  }

  await db
    .insert(sessionManualScores)
    .values({
      sessionId,
      score: parsed.data.score,
      notes: parsed.data.notes ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        score: parsed.data.score,
        notes: parsed.data.notes ?? null,
        updatedAt: new Date(),
      },
    });

  console.log(`Admin ${user!.id} set manual score ${parsed.data.score} for session ${sessionId}`);

  return NextResponse.json({ ok: true, sessionId, score: parsed.data.score });
}
