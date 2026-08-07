import Link from "next/link";
import { notFound } from "next/navigation";

import { GreenButton } from "@/components/app_componentes/customButtons";
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
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Email Assessment <span className="text-itbd-blue">Session</span>
      </h1>

      <ItbdCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ItbdBadge>{session.displayId}</ItbdBadge>
              <ItbdBadge>{session.statusLabel}</ItbdBadge>
              <ItbdBadge>{session.totalScenarios} scenarios</ItbdBadge>
            </div>
            <h2 className="text-lg font-bold text-white">Session review</h2>

            <div className="grid gap-1 text-sm text-white/60">
              <p>
                <span className="font-medium text-white">Candidate ID:</span>{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/80">{session.candidateId}</code>
              </p>
              <p>
                <span className="font-medium text-white">Session name:</span>{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/80">{session.displayName}</code>
              </p>
              <p>
                <span className="font-medium text-white">Email:</span> {session.candidateEmail}
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
            <GreenButton asChild>
              <Link href={MODULE_BASE}>Back to dashboard</Link>
            </GreenButton>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
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
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-3 text-sm font-medium text-white/70">Set evaluator (admin) session score</p>
          <EvaluatorScoreForm
            sessionId={session.sessionIdentifier}
            initialScore={session.evaluatorScore}
            initialNotes={session.evaluatorNotes}
          />
          {session.evaluatorNotes && (
            <p className="mt-3 text-sm text-white/60">
              <span className="font-medium text-white">Notes:</span> {session.evaluatorNotes}
            </p>
          )}
        </div>
      </ItbdCard>

      <ItbdCard>
        <h2 className="text-lg font-bold text-white">Scenario score table</h2>
        <p className="mt-1 text-sm text-white/60">
          Each scenario keeps its rubric percentage and contributes weighted marks to the 10-point
          total.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.18em] text-white/50">
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
                <tr key={scenario.assessmentId} className="border-t border-white/10 align-top text-white/80">
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{scenario.scenarioTitle}</div>
                    <div className="text-white/50">{scenario.scenarioCategory}</div>
                  </td>
                  <td className="px-4 py-4 capitalize">{scenario.scenarioDifficulty}</td>
                  <td className="px-4 py-4 text-white/50">
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
                      <span className="text-orange-400">&minus;{scenario.copyPenalty.toFixed(1)}</span>
                    ) : (
                      <span className="text-white/40">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {scenario.aiDetected ? (
                      <ItbdBadge tone="warning">Yes</ItbdBadge>
                    ) : (
                      <ItbdBadge tone="success">No</ItbdBadge>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <ItbdBadge>{scenario.assessmentStatus}</ItbdBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ItbdCard>

      <div className="space-y-6">
        {session.scenarios.map((scenario) => (
          <ItbdCard key={scenario.assessmentId}>
            <div className="flex flex-wrap items-center gap-2">
              <ItbdBadge>{scenario.scenarioDifficulty}</ItbdBadge>
              <ItbdBadge>{scenario.scenarioCategory}</ItbdBadge>
              <ItbdBadge>Max {scenario.scenarioMaxScore}</ItbdBadge>
            </div>
            <h2 className="mt-3 text-lg font-bold text-white">{scenario.scenarioTitle}</h2>
            <p className="mt-1 text-sm text-white/60">{scenario.scenarioPrompt}</p>

            <div className="mt-4 space-y-4">
              <AiDetectionBadge detected={scenario.aiDetected} copyPenalty={scenario.copyPenalty} />

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/50">Subject line</p>
                <p className="mt-2 text-base font-medium text-white">
                  {scenario.subject?.trim() ? scenario.subject : "No subject line submitted"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/50">Candidate response</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/80">
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
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white/50">AI verdict</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">{scenario.evaluationVerdict}</p>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-3">
                <FeedbackCard title="Strengths" items={scenario.strengths} />
                <FeedbackCard title="Weaknesses" items={scenario.weaknesses} />
                <FeedbackCard title="Improvements" items={scenario.improvements} />
              </div>
              {scenario.manualSummary ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white/50">Latest manual summary</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">{scenario.manualSummary}</p>
                </div>
              ) : null}
            </div>
          </ItbdCard>
        ))}
      </div>
    </main>
  );
}

/** Shared glow-border/blur card surface matching the rest of the app's brand. */
function ItbdCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function ItbdBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : tone === "warning"
        ? "border-orange-400/40 bg-orange-500/10 text-orange-300"
        : "border-itbd-blue/40 bg-itbd-blue/10 text-itbd-blue";

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${toneClass}`}
    >
      {children}
    </span>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-white/50">{hint}</p> : null}
    </div>
  );
}

function FeedbackCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-medium text-white/50">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/80">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/50">No notes yet.</p>
      )}
    </div>
  );
}
