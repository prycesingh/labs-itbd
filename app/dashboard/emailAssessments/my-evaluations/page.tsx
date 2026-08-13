import Link from "next/link";

import { StartAssessmentButton } from "@/components/emailAssessment/start-assessment-button";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";
import { randomUUID } from "crypto";

const TAKE_BASE = "/dashboard/emailAssessments/take";

// Candidate-facing history list. Deliberately omits `evaluatorScore` /
// `evaluatorNotes` (the admin-only override score) and `copyPenalty` — those
// stay admin/assessor-only per the module's score-visibility rules.
export default async function MyEvaluationsPage() {
  const user = await requireRole(["candidate", "admin"]);
  const sessions = await getSessionSummaries({ candidateId: user.id });

  return (
    <main className="flex w-full flex-col gap-6 my-5">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        My <span className="text-itbd-blue">Evaluations</span>
      </h1>

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {sessions.map((session, index) => (
            <Link
              key={session.sessionIdentifier}
              href={`${TAKE_BASE}/results/${session.scenarios[0].assessmentId}`}
              className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md transition-colors hover:border-itbd-blue/40"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
              />
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ItbdBadge>Assessment {sessions.length - index}</ItbdBadge>
                  <ItbdBadge>{session.statusLabel}</ItbdBadge>
                </div>

                <p className="text-sm text-white/60">
                  {session.lastSubmittedAt
                    ? `Last submitted ${session.lastSubmittedAt.toLocaleString()}`
                    : `Started ${session.startedAt.toLocaleString()}`}
                </p>

                <ScoreMetric
                  label="Total score"
                  value={
                    session.totalScore != null
                      ? `${session.totalScore.toFixed(2)} / 10`
                      : "Pending"
                  }
                  hint={session.totalGrade ? `Grade ${session.totalGrade}` : undefined}
                />

                {session.hasAutoSubmittedScenarios ? (
                  <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                    Auto-submission occurred: {session.autoSubmittedScenarioCount} of{" "}
                    {session.totalScenarios} scenario
                    {session.autoSubmittedScenarioCount === 1 ? "" : "s"} were auto-submitted
                    (switching tabs, minimizing, or navigating away during the session ends it
                    early) and scored as 0.
                  </p>
                ) : null}

                <p className="text-sm text-white/50">
                  {session.submittedScenarios} / {session.totalScenarios} scenarios submitted
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  const preGeneratedSessionId = randomUUID();

  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10 space-y-4 text-center">
        <div>
          <h2 className="text-lg font-bold text-white">No evaluations yet</h2>
          <p className="mt-1 text-sm text-white/60">
            You haven&apos;t taken an email assessment session yet. Start one to see
            your results here.
          </p>
        </div>
        <div className="flex justify-center">
          <StartAssessmentButton preGeneratedSessionId={preGeneratedSessionId} />
        </div>
      </div>
    </div>
  );
}

function ItbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-2.5 py-0.5 text-xs font-semibold text-itbd-blue capitalize">
      {children}
    </span>
  );
}

function ScoreMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/50">{hint}</p> : null}
    </div>
  );
}
