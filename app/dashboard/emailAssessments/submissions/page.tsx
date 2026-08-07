import { desc, eq } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import {
  emailAssessmentEvaluations as evaluations,
  emailAssessmentManualScores as manualScores,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import DefaultButton from "@/components/app_componentes/customButtons";
import { ManualScoreForm } from "@/components/emailAssessment/manual-score-form";
import { requireRole } from "@/lib/emailAssessment/auth";

export default async function EmailAssessmentsSubmissionsPage() {
  await requireRole(["admin", "assessor"]);

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
  const scoreCountBySubmission = new Map<string, number>();
  scoreRecords.forEach((score) => {
    scoreCountBySubmission.set(
      score.submissionId,
      (scoreCountBySubmission.get(score.submissionId) ?? 0) + 1
    );
  });

  return (
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Email Assessment <span className="text-itbd-blue">Submissions</span>
      </h1>

      <div className="flex flex-col gap-4">
        {records.map((record) => (
          <div
            key={record.submission.id}
            className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
            />
            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {record.candidate.name ?? record.candidate.email}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    {record.candidate.email} &middot; {record.scenario.title}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ItbdBadge>{record.evaluation?.overallScore ?? "pending"} AI</ItbdBadge>
                  <ItbdBadge>{scoreCountBySubmission.get(record.submission.id) ?? 0} manual</ItbdBadge>
                </div>
              </div>

              <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/80">
                {record.submission.content}
              </p>

              <div className="flex justify-end">
                <DefaultButton size="sm" asChild>
                  <a href={`/api/emailAssessment/admin/reports/export?submissionId=${record.submission.id}`}>
                    Export PDF
                  </a>
                </DefaultButton>
              </div>

              <ManualScoreForm submissionId={record.submission.id} />
            </div>
          </div>
        ))}

        {records.length === 0 ? (
          <div className="itbd-glow-border rounded-2xl bg-black/40 p-6 text-center backdrop-blur-md">
            <h2 className="text-lg font-bold text-white">No submissions yet</h2>
            <p className="mt-1 text-sm text-white/60">
              Candidate submissions will appear here.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ItbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-2.5 py-0.5 text-xs font-semibold text-itbd-blue">
      {children}
    </span>
  );
}
