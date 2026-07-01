import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/DB/drizzle";
import { emailAssessmentAssessments as assessments } from "@/DB/emailAssessmentSchema";
import { ScoreRadar } from "@/components/emailAssessment/score-radar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";

const TAKE_BASE = "/dashboard/emailAssessments/take";

export default async function EmailAssessmentResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["candidate", "admin"]);
  const { id } = await params;
  const [assessment] = await db
    .select({ assessment: assessments })
    .from(assessments)
    .where(eq(assessments.id, id))
    .limit(1);

  if (!assessment || assessment.assessment.candidateId !== user.id) {
    notFound();
  }

  const sessionIdentifier = assessment.assessment.sessionId ?? assessment.assessment.id;
  const [session] = await getSessionSummaries({
    candidateId: user.id,
    sessionIdentifier,
  });

  if (!session) {
    notFound();
  }

  const selectedScenario =
    session.scenarios.find((scenario) => scenario.assessmentId === id) ?? session.scenarios[0];

  return (
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment Results</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <div className="mt-5 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{session.displayId}</Badge>
            <Badge>{session.statusLabel}</Badge>
            <Badge>{session.totalScenarios} scenarios</Badge>
          </div>
          <CardTitle>Session results</CardTitle>
          <CardDescription>Session name: {session.displayName}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <ResultMetric
            label="AI total"
            value={session.aiWeightedTotal != null ? `${session.aiWeightedTotal.toFixed(2)} / 10` : "Pending"}
            hint={session.aiGrade ? `Grade ${session.aiGrade}` : "Waiting for all scenario evaluations"}
          />
          <ResultMetric
            label="Manual total"
            value={
              session.manualWeightedTotal != null
                ? `${session.manualWeightedTotal.toFixed(2)} / 10`
                : `${session.manualReviewedScenarios}/${session.totalScenarios} reviewed`
            }
            hint={session.manualGrade ? `Grade ${session.manualGrade}` : "Manual review is optional"}
          />
          <ResultMetric
            label="Submitted"
            value={`${session.submittedScenarios}/${session.totalScenarios}`}
            hint={
              session.lastSubmittedAt
                ? `Last submit ${session.lastSubmittedAt.toLocaleString()}`
                : "Not submitted yet"
            }
          />
          <ResultMetric
            label="Timer"
            value="30 minutes"
            hint={`Started ${session.startedAt.toLocaleString()}`}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scenario breakdown</CardTitle>
            <CardDescription>
              Review the weighted contribution of each scenario in this session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {session.scenarios.map((scenario) => (
              <Link
                key={scenario.assessmentId}
                href={`${TAKE_BASE}/results/${scenario.assessmentId}`}
                className={`block rounded-2xl border p-4 transition ${
                  scenario.assessmentId === selectedScenario.assessmentId
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{scenario.scenarioDifficulty}</Badge>
                  <Badge>{scenario.scenarioCategory}</Badge>
                  <Badge>Max {scenario.scenarioMaxScore}</Badge>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="font-medium">{scenario.scenarioTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    Subject: {scenario.subject?.trim() ? scenario.subject : "No subject line submitted"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    AI:{" "}
                    {scenario.aiWeightedScore != null
                      ? `${scenario.aiWeightedScore.toFixed(2)} / ${scenario.scenarioMaxScore}`
                      : "Pending"}
                  </span>
                  <span>
                    Raw:{" "}
                    {scenario.evaluationOverallScore != null
                      ? `${scenario.evaluationOverallScore} / 100`
                      : "Pending"}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{selectedScenario.scenarioDifficulty}</Badge>
                <Badge>{selectedScenario.scenarioCategory}</Badge>
                <Badge>Max {selectedScenario.scenarioMaxScore}</Badge>
              </div>
              <CardTitle>{selectedScenario.scenarioTitle}</CardTitle>
              <CardDescription>{selectedScenario.scenarioPrompt}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-medium text-muted-foreground">Subject line</p>
                <p className="mt-2 text-base font-medium">
                  {selectedScenario.subject?.trim() ? selectedScenario.subject : "No subject line submitted"}
                </p>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-medium text-muted-foreground">Email response</p>
                <p className="mt-2 whitespace-pre-wrap leading-7">
                  {selectedScenario.content?.trim() ? selectedScenario.content : "No response submitted."}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ResultMetric
                  label="AI percentage"
                  value={
                    selectedScenario.evaluationOverallScore != null
                      ? `${selectedScenario.evaluationOverallScore} / 100`
                      : "Pending"
                  }
                />
                <ResultMetric
                  label="Weighted marks"
                  value={
                    selectedScenario.aiWeightedScore != null
                      ? `${selectedScenario.aiWeightedScore.toFixed(2)} / ${selectedScenario.scenarioMaxScore}`
                      : "Pending"
                  }
                  hint="Converted from the rubric percentage"
                />
                <ResultMetric
                  label="Manual review"
                  value={
                    selectedScenario.manualWeightedScore != null
                      ? `${selectedScenario.manualWeightedScore.toFixed(2)} / ${selectedScenario.scenarioMaxScore}`
                      : "Pending"
                  }
                  hint={
                    selectedScenario.manualOverallScore != null
                      ? `${selectedScenario.manualOverallScore} / 100`
                      : "Latest assessor score"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {selectedScenario.evaluationStatus !== "completed" ? (
            <Card>
              <CardHeader>
                <CardTitle>Evaluation pending</CardTitle>
                <CardDescription>
                  AI feedback for this scenario will appear as soon as the evaluation finishes.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Rubric view</CardTitle>
                  <CardDescription>
                    The rubric percentages stay the same and then roll into the weighted session total.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedScenario.categoryScores ? (
                    <ScoreRadar scores={selectedScenario.categoryScores} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No rubric breakdown is available yet.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Feedback</CardTitle>
                  <CardDescription>{selectedScenario.evaluationVerdict}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3">
                  <FeedbackList title="Strengths" items={selectedScenario.strengths} />
                  <FeedbackList title="Weaknesses" items={selectedScenario.weaknesses} />
                  <FeedbackList title="Improvements" items={selectedScenario.improvements} />
                </CardContent>
              </Card>
            </div>
          )}

          {selectedScenario.manualSummary ? (
            <Card>
              <CardHeader>
                <CardTitle>Assessor feedback</CardTitle>
                <CardDescription>Latest manual review for this scenario.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-medium">
                  {selectedScenario.manualOverallScore}/100
                  {selectedScenario.manualGrade ? ` Â· Grade ${selectedScenario.manualGrade}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">{selectedScenario.manualSummary}</p>
                {selectedScenario.manualImprovementAreas.length > 0 ? (
                  <FeedbackList title="Manual improvements" items={selectedScenario.manualImprovementAreas} />
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      </div>
    </main>
  );
}

function ResultMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <h3 className="mb-3 font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-xl border bg-muted/20 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
