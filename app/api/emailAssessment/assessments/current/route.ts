import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentScenarios as scenarios,
} from "@/DB/emailAssessmentSchema";
import { requireApiUser } from "@/lib/emailAssessment/auth";

export async function GET() {
  const { user, response } = await requireApiUser(["candidate", "admin"]);

  if (response) return response;

  const [record] = await db
    .select({
      assessment: assessments,
      scenario: scenarios,
    })
    .from(assessments)
    .innerJoin(scenarios, eq(assessments.scenarioId, scenarios.id))
    .where(eq(assessments.candidateId, user!.id))
    .orderBy(desc(assessments.startedAt))
    .limit(1);

  return NextResponse.json({ current: record ?? null });
}
