import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentEvaluations as evaluations,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { requireApiUser } from "@/lib/emailAssessment/auth";

export async function GET() {
  const { response } = await requireApiUser(["admin", "assessor"]);

  if (response) return response;

  const [totals] = await db
    .select({
      users: sql<number>`count(distinct ${users.id})`,
      assessments: sql<number>`count(distinct ${assessments.id})`,
      submissions: sql<number>`count(distinct ${submissions.id})`,
      averageScore: sql<number>`coalesce(avg(${evaluations.overallScore}), 0)`,
    })
    .from(users)
    .leftJoin(assessments, sql`${assessments.candidateId} = ${users.id}`)
    .leftJoin(submissions, sql`${submissions.candidateId} = ${users.id}`)
    .leftJoin(evaluations, sql`${evaluations.submissionId} = ${submissions.id}`);

  const gradeDistribution = await db
    .select({
      grade: evaluations.grade,
      count: sql<number>`count(*)`,
    })
    .from(evaluations)
    .groupBy(evaluations.grade);

  const scenarioPerformance = await db
    .select({
      scenarioId: scenarios.id,
      title: scenarios.title,
      attempts: sql<number>`count(${submissions.id})`,
      averageScore: sql<number>`coalesce(avg(${evaluations.overallScore}), 0)`,
    })
    .from(scenarios)
    .leftJoin(submissions, sql`${submissions.scenarioId} = ${scenarios.id}`)
    .leftJoin(evaluations, sql`${evaluations.submissionId} = ${submissions.id}`)
    .groupBy(scenarios.id)
    .orderBy(sql`count(${submissions.id}) desc`);

  return NextResponse.json({
    totals,
    gradeDistribution,
    scenarioPerformance,
  });
}
