import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentManualScores as manualScores,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";
import { categoryScoreSchema, gradeFromScore } from "@/lib/emailAssessment/rubric";

const manualScoreSchema = z.object({
  submissionId: z.string().uuid(),
  overallScore: z.number().int().min(0).max(100),
  categoryScores: categoryScoreSchema,
  summary: z.string().trim().min(10),
  improvementAreas: z.array(z.string().trim().min(1)).min(1).max(8),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser(["admin", "assessor"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = manualScoreSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid manual score.");
  }

  const [submission] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.id, parsed.data.submissionId))
    .limit(1);

  if (!submission) {
    return jsonError("Submission not found.", 404);
  }

  const manualScoreId = randomUUID();
  const grade = gradeFromScore(parsed.data.overallScore);
  const manualScore = {
    id: manualScoreId,
    submissionId: parsed.data.submissionId,
    assessorId: user!.id,
    overallScore: parsed.data.overallScore,
    grade,
    categoryScores: parsed.data.categoryScores,
    summary: parsed.data.summary,
    improvementAreas: parsed.data.improvementAreas,
    notes: parsed.data.notes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(manualScores).values({
    id: manualScore.id,
    submissionId: manualScore.submissionId,
    assessorId: manualScore.assessorId,
    overallScore: manualScore.overallScore,
    grade: manualScore.grade,
    categoryScores: manualScore.categoryScores,
    summary: manualScore.summary,
    improvementAreas: manualScore.improvementAreas,
    notes: manualScore.notes,
  });

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: "manual_score_created",
    entityType: "submission",
    entityId: parsed.data.submissionId,
    metadata: {
      manualScoreId: manualScore.id,
      overallScore: manualScore.overallScore,
    },
    ipAddress: requestIp(request),
  });

  return NextResponse.json({ manualScore }, { status: 201 });
}
