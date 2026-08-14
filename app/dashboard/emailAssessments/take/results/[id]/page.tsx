import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/DB/drizzle";
import { emailAssessmentAssessments as assessments } from "@/DB/emailAssessmentSchema";
import { ScoreRadar } from "@/components/emailAssessment/score-radar";
import { cn } from "@/lib/utils";
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
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Email Assessment <span className="text-itbd-blue">Results</span>
      </h1>

      <ItbdCard>
        <div className="flex flex-wrap items-center gap-2">
          <ItbdBadge>{session.statusLabel}</ItbdBadge>
          <ItbdBadge>{session.totalScenarios} scenarios</ItbdBadge>
        </div>
        <h2 className="mt-3 text-lg font-bold text-white">Session results</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ResultMetric
            label="Total score"
            value={session.totalScore != null ? `${session.totalScore.toFixed(2)} / 10` : "Pending"}
            hint={session.totalGrade ? `Grade ${session.totalGrade}` : "Waiting for all scenario evaluations"}
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
        </div>
        {session.hasAutoSubmittedScenarios ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Auto-submission occurred: {session.autoSubmittedScenarioCount} of{" "}
            {session.totalScenarios} scenario{session.autoSubmittedScenarioCount === 1 ? "" : "s"}{" "}
            were auto-submitted (switching tabs, minimizing, or navigating away during the session
            ends it early) and scored as 0 toward the total above.
          </p>
        ) : null}
      </ItbdCard>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ItbdCard className="h-fit">
          <h2 className="text-lg font-bold text-white">Scenario breakdown</h2>
          <p className="mt-1 text-sm text-white/60">
            Review the weighted contribution of each scenario in this session.
          </p>
          <div className="mt-4 space-y-3">
            {session.scenarios.map((scenario) => (
              <Link
                key={scenario.assessmentId}
                href={`${TAKE_BASE}/results/${scenario.assessmentId}`}
                className={cn(
                  "block rounded-xl border p-4 transition-colors",
                  scenario.assessmentId === selectedScenario.assessmentId
                    ? "border-itbd-blue bg-itbd-blue/10"
                    : "border-white/10 bg-white/5 hover:border-itbd-blue/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ItbdBadge>{scenario.scenarioDifficulty}</ItbdBadge>
                  <ItbdBadge>{scenario.scenarioCategory}</ItbdBadge>
                  <ItbdBadge>Max {scenario.scenarioMaxScore}</ItbdBadge>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="font-medium text-white">{scenario.scenarioTitle}</p>
                  <p className="text-sm text-white/60">
                    Subject: {scenario.subject?.trim() ? scenario.subject : "No subject line submitted"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/50">
                  <span>
                    Score:{" "}
                    {(() => {
                      const value = scenario.manualWeightedScore ?? scenario.aiWeightedScore;
                      if (value != null) return `${value.toFixed(2)} / ${scenario.scenarioMaxScore}`;
                      if (
                        scenario.evaluationStatus == null &&
                        (scenario.assessmentStatus === "expired" ||
                          scenario.assessmentStatus === "failed")
                      ) {
                        return `0 / ${scenario.scenarioMaxScore} (auto-submitted)`;
                      }
                      return "Pending";
                    })()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </ItbdCard>

        <div className="space-y-6">
          <ItbdCard>
            <div className="flex flex-wrap items-center gap-2">
              <ItbdBadge>{selectedScenario.scenarioDifficulty}</ItbdBadge>
              <ItbdBadge>{selectedScenario.scenarioCategory}</ItbdBadge>
              <ItbdBadge>Max {selectedScenario.scenarioMaxScore}</ItbdBadge>
            </div>
            <h2 className="mt-3 text-lg font-bold text-white">
              {selectedScenario.scenarioTitle}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {selectedScenario.scenarioPrompt}
            </p>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/50">Subject line</p>
                <p className="mt-2 text-base font-medium text-white">
                  {selectedScenario.subject?.trim() ? selectedScenario.subject : "No subject line submitted"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white/50">Email response</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/80">
                  {selectedScenario.content?.trim() ? selectedScenario.content : "No response submitted."}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(() => {
                  const scenarioScore =
                    selectedScenario.manualWeightedScore ?? selectedScenario.aiWeightedScore;
                  const isAutoScoredZero =
                    selectedScenario.evaluationStatus == null &&
                    (selectedScenario.assessmentStatus === "expired" ||
                      selectedScenario.assessmentStatus === "failed");

                  return (
                    <ResultMetric
                      label="Score"
                      value={
                        scenarioScore != null
                          ? `${scenarioScore.toFixed(2)} / ${selectedScenario.scenarioMaxScore}`
                          : isAutoScoredZero
                            ? `0 / ${selectedScenario.scenarioMaxScore}`
                            : "Pending"
                      }
                      hint={isAutoScoredZero ? "Auto-submitted, scored as 0" : undefined}
                    />
                  );
                })()}
                <ResultMetric
                  label="Submitted"
                  value={selectedScenario.submittedAt ? "Yes" : "No"}
                  hint={
                    selectedScenario.submittedAt
                      ? selectedScenario.submittedAt.toLocaleString()
                      : undefined
                  }
                />
              </div>
            </div>
          </ItbdCard>

          {selectedScenario.evaluationStatus !== "completed" ? (
            <ItbdCard>
              <h2 className="text-lg font-bold text-white">Evaluation pending</h2>
              <p className="mt-1 text-sm text-white/60">
                AI feedback for this scenario will appear as soon as the evaluation finishes.
              </p>
            </ItbdCard>
          ) : null}

          {selectedScenario.manualSummary ? (
            <ItbdCard>
              <h2 className="text-lg font-bold text-white">Assessor feedback</h2>
              <p className="mt-1 text-sm text-white/60">Latest manual review for this scenario.</p>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-white/60">{selectedScenario.manualSummary}</p>
                {selectedScenario.manualImprovementAreas.length > 0 ? (
                  <FeedbackList title="Manual improvements" items={selectedScenario.manualImprovementAreas} />
                ) : null}
              </div>
            </ItbdCard>
          ) : null}
        </div>
      </div>

      {selectedScenario.evaluationStatus === "completed" ? (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <ItbdCard className="h-fit">
            <h2 className="text-lg font-bold text-white">Rubric view</h2>
            <p className="mt-1 text-sm text-white/60">
              The rubric percentages stay the same and then roll into the weighted session total.
            </p>
            <div className="mt-4">
              {selectedScenario.categoryScores ? (
                <ScoreRadar scores={selectedScenario.categoryScores} />
              ) : (
                <p className="text-sm text-white/50">
                  No rubric breakdown is available yet.
                </p>
              )}
            </div>
          </ItbdCard>
          <ItbdCard>
            <h2 className="text-lg font-bold text-white">Feedback</h2>
            <p className="mt-1 text-sm text-white/60">{selectedScenario.evaluationVerdict}</p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeedbackList title="Strengths" items={selectedScenario.strengths} />
              <FeedbackList title="Weaknesses" items={selectedScenario.weaknesses} />
              <FeedbackList title="Improvements" items={selectedScenario.improvements} />
            </div>
          </ItbdCard>
        </div>
      ) : null}
    </main>
  );
}

/** Shared glow-border/blur card surface matching the rest of the app's brand. */
function ItbdCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10">{children}</div>
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

function ResultMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-white/50">{hint}</p> : null}
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <h3 className="mb-3 font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/50">No notes yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 font-semibold text-white">{title}</h3>
      <ul className="space-y-2 text-sm text-white/70">
        {items.map((item) => (
          <li key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
