import { randomUUID } from "crypto";
import Link from "next/link";

import { DashCard } from "@/components/dashboard/dashCards";
import { StartAssessmentButton } from "@/components/emailAssessment/start-assessment-button";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";

export default async function EmailAssessmentTakePage() {
  const user = await requireRole(["candidate", "admin"]);
  const sessions = await getSessionSummaries({ candidateId: user.id });
  const completedSessions = sessions.filter(
    (session) => session.aiWeightedTotal != null,
  );
  const averageScore =
    completedSessions.length > 0
      ? Number(
          (
            completedSessions.reduce(
              (total, session) => total + (session.aiWeightedTotal ?? 0),
              0,
            ) / completedSessions.length
          ).toFixed(2),
        )
      : 0;
  const bestScore =
    completedSessions.length > 0
      ? Number(
          Math.max(
            ...completedSessions.map((session) => session.aiWeightedTotal ?? 0),
          ).toFixed(2),
        )
      : 0;

  const preGeneratedSessionId = randomUUID();

  return (
    <main className="flex w-full flex-col gap-6 my-5">
      <section className="grid gap-4 md:grid-cols-3">
        <DashCard number={sessions.length} name="Sessions" />
        <DashCard
          number={averageScore}
          name="Average session score"
          subString="/ 10"
        />
        <DashCard
          number={bestScore}
          name="Best session score"
          subString="/ 10"
        />
      </section>

      <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white uppercase">
                Ready for your next assessment?
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Each assessment session includes 5 scenarios and lasts 30 minutes
                total. Retakes unlock after a 3-day cooldown.
              </p>
            </div>
            <Link
              href="/dashboard/emailAssessments/my-evaluations"
              className="text-sm font-medium text-itbd-blue hover:underline"
            >
              View my evaluations &rarr;
            </Link>
          </div>
          <StartAssessmentButton
            preGeneratedSessionId={preGeneratedSessionId}
          />
        </div>
      </div>
    </main>
  );
}
