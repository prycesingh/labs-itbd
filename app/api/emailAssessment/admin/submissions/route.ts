import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import {
  emailAssessmentEvaluations as evaluations,
  emailAssessmentManualScores as manualScores,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { requireApiUser } from "@/lib/emailAssessment/auth";

export async function GET() {
  const { response } = await requireApiUser(["admin", "assessor"]);

  if (response) return response;

  const records = await db
    .select({
      submission: submissions,
      candidate: {
        name: users.name,
        email: users.email,
      },
      scenario: {
        title: scenarios.title,
        difficulty: scenarios.difficulty,
        category: scenarios.category,
      },
      evaluation: evaluations,
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.candidateId, users.id))
    .innerJoin(scenarios, eq(submissions.scenarioId, scenarios.id))
    .leftJoin(evaluations, eq(evaluations.submissionId, submissions.id))
    .orderBy(desc(submissions.submittedAt));

  const scoreRecords = await db.select().from(manualScores);

  return NextResponse.json({ submissions: records, manualScores: scoreRecords });
}
