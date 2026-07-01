import { eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentScenarios as scenarios,
} from "@/DB/emailAssessmentSchema";
import { AssessmentEditor } from "@/components/emailAssessment/assessment-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";

const TAKE_BASE = "/dashboard/emailAssessments/take";

type AssessmentWithScenario = {
  assessment: typeof assessments.$inferSelect;
  scenario: typeof scenarios.$inferSelect;
};

export default async function EmailAssessmentTakeAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const user = await requireRole(["candidate", "admin"]);
  const { id } = await params;
  const { sessionId } = await searchParams;

  const [record] = await db
    .select({
      assessment: assessments,
      scenario: scenarios,
    })
    .from(assessments)
    .innerJoin(scenarios, eq(assessments.scenarioId, scenarios.id))
    .where(eq(assessments.id, id))
    .limit(1);

  if (!record || record.assessment.candidateId !== user.id) {
    notFound();
  }

  if (record.assessment.status !== "in_progress") {
    redirect(`${TAKE_BASE}/results/${record.assessment.id}`);
  }

  // Load sibling assessments in the same session for navigation
  let sessionAssessments: AssessmentWithScenario[] = [];
  const effSessionId = sessionId ?? record.assessment.sessionId;

  if (effSessionId) {
    const rows = await db
      .select({
        assessment: assessments,
        scenario: scenarios,
      })
      .from(assessments)
      .innerJoin(scenarios, eq(assessments.scenarioId, scenarios.id))
      .where(
        sql`${assessments.sessionId} = ${effSessionId} AND ${assessments.candidateId} = ${user.id}`
      )
      .orderBy(assessments.sessionIndex);

    sessionAssessments = rows;
  }

  const currentIndex = sessionAssessments.findIndex((a) => a.assessment.id === id);
  const totalInSession = sessionAssessments.length > 0 ? sessionAssessments.length : 0;
  const nextAssessment =
    currentIndex >= 0 && currentIndex < sessionAssessments.length - 1
      ? sessionAssessments[currentIndex + 1]
      : null;

  return (
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <div className="mt-5 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit">
        <CardHeader>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>{record.scenario.difficulty}</Badge>
            <Badge>{record.scenario.category}</Badge>
            {totalInSession > 1 && (
              <span className="ml-auto text-xs text-muted-foreground">
                Scenario {currentIndex + 1} of {totalInSession}
              </span>
            )}
          </div>
          <CardTitle>{record.scenario.title}</CardTitle>
          <CardDescription>
            Write a professional email response including a subject line.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="leading-7 text-muted-foreground">{record.scenario.prompt}</p>
        </CardContent>
        {totalInSession > 1 && (
          <CardContent className="border-t pt-4">
            <div className="flex items-center gap-2">
              {sessionAssessments.map((a, i) => (
                <div
                  key={a.assessment.id}
                  className={`h-2 flex-1 rounded-full ${
                    i < currentIndex
                      ? "bg-primary"
                      : i === currentIndex
                        ? "bg-primary/60"
                        : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
      <AssessmentEditor
        assessmentId={record.assessment.id}
        sessionId={effSessionId ?? undefined}
        dueAt={record.assessment.dueAt.toISOString()}
        nextAssessmentId={nextAssessment?.assessment.id ?? null}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        totalScenarios={totalInSession}
        remainingAssessmentIds={sessionAssessments
          .slice(currentIndex >= 0 ? currentIndex : 0)
          .map((a) => a.assessment.id)}
      />
      </div>
    </main>
  );
}
