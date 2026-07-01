import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { emailAssessmentAssessments as assessments } from "@/DB/emailAssessmentSchema";
import { jsonError, requireApiUser } from "@/lib/emailAssessment/auth";

const endSchema = z.object({
  assessmentId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser(["candidate", "admin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = endSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid assessment end request.");
  }

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, parsed.data.assessmentId))
    .limit(1);

  if (!assessment || assessment.candidateId !== user!.id) {
    return jsonError("Assessment not found.", 404);
  }

  if (assessment.status !== "in_progress") {
    return NextResponse.json({ ok: true });
  }

  await db.update(assessments).set({ status: "expired" }).where(eq(assessments.id, assessment.id));

  return NextResponse.json({ ok: true });
}
