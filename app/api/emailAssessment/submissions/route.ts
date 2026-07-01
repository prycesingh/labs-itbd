import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { evaluateSubmission } from "@/lib/emailAssessment/evaluation";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";
import { wordCount } from "@/lib/emailAssessment/retakes";
import { enforceRateLimit, rateLimitResponse } from "@/lib/emailAssessment/rate-limit";

const submissionSchema = z.object({
  assessmentId: z.string().uuid(),
  subject: z.string().trim().min(1).max(500).optional(),
  content: z.string().trim().min(50).max(10_000),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser(["candidate", "admin"]);

  if (response) return response;

  const rateLimit = await enforceRateLimit(`submission:${user!.id}`, 10, 60 * 60);
  const isBypass =
    process.env.NODE_ENV === "development" || process.env.BYPASS_RATE_LIMIT === "true";
  if (!rateLimit.allowed && !isBypass) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const body = await request.json().catch(() => null);
  const parsed = submissionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      "Submission must include an assessment ID, a subject line, and at least 50 characters."
    );
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
    return jsonError("This assessment is no longer accepting submissions.", 409);
  }

  if (assessment.dueAt < new Date()) {
    await db.update(assessments).set({ status: "expired" }).where(eq(assessments.id, assessment.id));
    return jsonError("The assessment timer has expired.", 409);
  }

  const submissionId = randomUUID();

  await db.insert(submissions).values({
    id: submissionId,
    assessmentId: assessment.id,
    candidateId: user!.id,
    scenarioId: assessment.scenarioId,
    subject: parsed.data.subject ?? null,
    content: parsed.data.content,
    wordCount: wordCount(parsed.data.content),
    ipAddress: requestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  await db
    .update(assessments)
    .set({
      status: "evaluating",
      submittedAt: new Date(),
    })
    .where(eq(assessments.id, assessment.id));

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: "submission_created",
    entityType: "submission",
    entityId: submissionId,
    metadata: {
      assessmentId: assessment.id,
      scenarioId: assessment.scenarioId,
    },
    ipAddress: requestIp(request),
  });

  const evaluation = await evaluateSubmission(submissionId);

  return NextResponse.json({
    submissionId,
    assessmentId: assessment.id,
    evaluationStatus: evaluation.status,
  });
}
