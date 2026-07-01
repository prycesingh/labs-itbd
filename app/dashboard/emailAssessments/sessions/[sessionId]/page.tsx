import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";
import {
  AiDetectionBadge,
  CandidateStatsButton,
  EvaluatorScoreForm,
  StandardResponseToggle,
} from "@/components/emailAssessment/session-admin-widgets";

const MODULE_BASE = "/dashboard/emailAssessments";

export default async function EmailAssessmentsSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireRole(["admin", "assessor"]);
  const { sessionId } = await params;
  const [session] = await getSessionSummaries({ sessionIdentifier: sessionId });

  if (!session) {
    notFound();
  }

  // Fetch candidate historical performance across all sessions
  const candidateSessions = await getSessionSummaries({ candidateId: session.candidateId });

  // 1. Grade Distribution (candidate wise)
  const candidateCompletedSessions = candidateSessions.filter((s) => s.aiWeightedTotal != null);
  const gradeDistribution = candidateCompletedSessions.reduce<Record<string, number>>(
    (totals, s) => {
      const key = s.aiGrade ?? "Pending";
      totals[key] = (totals[key] ?? 0) + 1;
      return totals;
    },
    {}
  );

  // 2. Scenario Performance (candidate wise)
  const scenarioPerformance = [
    ...candidateSessions
      .flatMap((s) => s.scenarios)
      .reduce(
        (map, scenario) => {
          if (scenario.aiWeightedScore == null) return map;
          const existing = map.get(scenario.scenarioId) ?? {
            title: scenario.scenarioTitle,
            difficulty: scenario.scenarioDifficulty,
            attempts: 0,
            weightedTotal: 0,
            maxScore: scenario.scenarioMaxScore,
          };

          existing.attempts += 1;
          existing.weightedTotal += scenario.aiWeightedScore;
          map.set(scenario.scenarioId, existing);
          return map;
        },
        new Map<
          string,
          { title: string; difficulty: string; attempts: number; weightedTotal: number; maxScore: number }
        >()
      )
      .values(),
  ].sort((left, right) => right.attempts - left.attempts);

  return (
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment Session</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <div className="mt-5 flex flex-col gap-6">
      {/* â”€â”€ Session header â”€â”€ */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{session.displayId}</Badge>
                <Badge>{session.statusLabel}</Badge>
                <Badge>{session.totalScenarios} scenarios</Badge>
              </div>
              <CardTitle>Session review</CardTitle>

              {/* â”€â”€ Candidate identity block â”€â”€ */}
              <div className="grid gap-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Candidate ID:</span>{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{session.candidateId}</code>
                </p>
                <p>
                  <span className="font-medium text-foreground">Session name:</span>{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{session.displayName}</code>
                </p>
                <p>
                  <span className="font-medium text-foreground">Email:</span> {session.candidateEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CandidateStatsButton
                candidateId={session.candidateId}
                candidateName={session.displayName}
                candidateEmail={session.candidateEmail}
                gradeDistribution={gradeDistribution}
                scenarioPerformance={scenarioPerformance}
              />
              <Button asChild variant="outline">
                <Link href={MODULE_BASE}>Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* â”€â”€ Score metrics â”€â”€ */}
        <CardContent className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="AI total"
            value={session.aiWeightedTotal != null ? `${session.aiWeightedTotal.toFixed(2)} / 10` : "Pending"}
            hint={session.aiGrade ? `Grade ${session.aiGrade}` : "Waiting for completed evaluation"}
          />
          <MetricCard
            label="Manual total (per scenario)"
            value={
              session.manualWeightedTotal != null
                ? `${session.manualWeightedTotal.toFixed(2)} / 10`
                : `${session.manualReviewedScenarios}/${session.totalScenarios} reviewed`
            }
            hint={session.manualGrade ? `Grade ${session.manualGrade}` : "Latest assessor entries"}
          />
          <MetricCard
            label="Evaluator score"
            value={session.evaluatorScore != null ? `${session.evaluatorScore} / 10` : "Not set"}
            hint="Admin override / final score"
          />
          <MetricCard
            label="Submitted"
            value={session.lastSubmittedAt?.toLocaleString() ?? "Pending"}
            hint={`${session.submittedScenarios}/${session.totalScenarios} submitted`}
          />
        </CardContent>

        {/* â”€â”€ Evaluator score editor â”€â”€ */}
        <CardContent className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Set evaluator (admin) session score</p>
          <EvaluatorScoreForm
            sessionId={session.sessionIdentifier}
            initialScore={session.evaluatorScore}
            initialNotes={session.evaluatorNotes}
          />
          {session.evaluatorNotes && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium">Notes:</span> {session.evaluatorNotes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* â”€â”€ Scenario score table â”€â”€ */}
      <Card>
        <CardHeader>
          <CardTitle>Scenario score table</CardTitle>
          <CardDescription>
            Each scenario keeps its rubric percentage and contributes weighted marks to the 10-point
            total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Scenario</th>
                  <th className="px-4 py-3">Difficulty</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">AI %</th>
                  <th className="px-4 py-3">AI weighted</th>
                  <th className="px-4 py-3">Copy penalty</th>
                  <th className="px-4 py-3">AI detected</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {session.scenarios.map((scenario) => (
                  <tr key={scenario.assessmentId} className="border-t align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium">{scenario.scenarioTitle}</div>
                      <div className="text-muted-foreground">{scenario.scenarioCategory}</div>
                    </td>
                    <td className="px-4 py-4">{scenario.scenarioDifficulty}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {scenario.subject?.trim() ? scenario.subject : "No subject submitted"}
                    </td>
                    <td className="px-4 py-4">
                      {scenario.evaluationOverallScore != null
                        ? `${scenario.evaluationOverallScore} / 100`
                        : "Pending"}
                    </td>
                    <td className="px-4 py-4">
                      {scenario.aiWeightedScore != null
                        ? `${scenario.aiWeightedScore.toFixed(2)} / ${scenario.scenarioMaxScore}`
                        : "Pending"}
                    </td>
                    <td className="px-4 py-4">
                      {scenario.copyPenalty > 0 ? (
                        <span className="text-amber-600">âˆ’{scenario.copyPenalty.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground">â€”</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {scenario.aiDetected ? (
                        <Badge className="bg-rose-100 text-rose-700 border-rose-300">Yes</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-green-300">No</Badge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge>{scenario.assessmentStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* â”€â”€ Per-scenario detail cards â”€â”€ */}
      <div className="space-y-6">
        {session.scenarios.map((scenario) => (
          <Card key={scenario.assessmentId}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{scenario.scenarioDifficulty}</Badge>
                <Badge>{scenario.scenarioCategory}</Badge>
                <Badge>Max {scenario.scenarioMaxScore}</Badge>
              </div>
              <CardTitle>{scenario.scenarioTitle}</CardTitle>
              <CardDescription>{scenario.scenarioPrompt}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AiDetectionBadge detected={scenario.aiDetected} copyPenalty={scenario.copyPenalty} />

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-medium text-muted-foreground">Subject line</p>
                <p className="mt-2 text-base font-medium">
                  {scenario.subject?.trim() ? scenario.subject : "No subject line submitted"}
                </p>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-medium text-muted-foreground">Candidate response</p>
                <p className="mt-2 whitespace-pre-wrap leading-7">
                  {scenario.content?.trim() ? scenario.content : "No response submitted."}
                </p>
              </div>

              <StandardResponseToggle modelAnswer={scenario.scenarioModelAnswer} />

              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="AI percentage"
                  value={
                    scenario.evaluationOverallScore != null
                      ? `${scenario.evaluationOverallScore} / 100`
                      : "Pending"
                  }
                />
                <MetricCard
                  label="AI weighted"
                  value={
                    scenario.aiWeightedScore != null
                      ? `${scenario.aiWeightedScore.toFixed(2)} / ${scenario.scenarioMaxScore}`
                      : "Pending"
                  }
                  hint={scenario.evaluationGrade ? `Grade ${scenario.evaluationGrade}` : undefined}
                />
                <MetricCard
                  label="Manual weighted"
                  value={
                    scenario.manualWeightedScore != null
                      ? `${scenario.manualWeightedScore.toFixed(2)} / ${scenario.scenarioMaxScore}`
                      : "Pending"
                  }
                  hint={scenario.manualGrade ? `Grade ${scenario.manualGrade}` : undefined}
                />
              </div>
              {scenario.evaluationVerdict ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">AI verdict</p>
                  <p className="mt-2 text-sm leading-6">{scenario.evaluationVerdict}</p>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-3">
                <FeedbackCard title="Strengths" items={scenario.strengths} />
                <FeedbackCard title="Weaknesses" items={scenario.weaknesses} />
                <FeedbackCard title="Improvements" items={scenario.improvements} />
              </div>
              {scenario.manualSummary ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Latest manual summary</p>
                  <p className="mt-2 text-sm leading-6">{scenario.manualSummary}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FeedbackCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
