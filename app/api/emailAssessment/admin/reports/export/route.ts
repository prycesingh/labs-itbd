import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import {
  emailAssessmentAuditLogs as auditLogs,
  emailAssessmentEvaluations as evaluations,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { jsonError, requestIp, requireApiUser } from "@/lib/emailAssessment/auth";
import { createSimplePdf } from "@/lib/emailAssessment/pdf";

export async function GET(request: Request) {
  const { user, response } = await requireApiUser(["admin", "assessor"]);

  if (response) return response;

  const url = new URL(request.url);
  const submissionId = url.searchParams.get("submissionId");

  if (!submissionId) {
    return jsonError("submissionId is required.");
  }

  const [record] = await db
    .select({
      submission: submissions,
      candidate: {
        name: users.name,
        email: users.email,
      },
      scenario: {
        title: scenarios.title,
        category: scenarios.category,
        difficulty: scenarios.difficulty,
      },
      evaluation: evaluations,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.candidateId, users.id))
    .innerJoin(scenarios, eq(submissions.scenarioId, scenarios.id))
    .leftJoin(evaluations, eq(submissions.id, evaluations.submissionId))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!record) {
    return jsonError("Submission not found.", 404);
  }

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: user!.id,
    action: "report_exported",
    entityType: "submission",
    entityId: submissionId,
    metadata: { format: "pdf" },
    ipAddress: requestIp(request),
  });

  const pdf = createSimplePdf("Email Assessment Report", [
    `Candidate: ${record.candidate.name ?? ""} <${record.candidate.email}>`,
    `Scenario: ${record.scenario.title}`,
    `Difficulty: ${record.scenario.difficulty}`,
    `Category: ${record.scenario.category}`,
    `Submitted: ${record.submission.submittedAt.toISOString()}`,
    `AI Status: ${record.evaluation?.status ?? "not evaluated"}`,
    `AI Score: ${record.evaluation?.overallScore ?? "pending"}`,
    `AI Grade: ${record.evaluation?.grade ?? "pending"}`,
    "",
    "Summary:",
    record.evaluation?.verdict ?? "Evaluation is not complete.",
    "",
    "Improvement Areas:",
    ...(record.evaluation?.improvements ?? ["Evaluation is not complete."]),
  ]);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="assessment-${submissionId}.pdf"`,
    },
  });
}
