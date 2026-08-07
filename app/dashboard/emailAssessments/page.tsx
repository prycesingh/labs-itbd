import { DashCard } from "@/components/dashboard/dashCards";
import { AdminSessionDashboard } from "@/components/emailAssessment/admin-session-dashboard";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";

export default async function EmailAssessmentsAdminDashboardPage() {
  await requireRole(["admin"]);

  const sessions = await getSessionSummaries();
  const completedSessions = sessions.filter(
    (session) => session.aiWeightedTotal != null,
  );
  const pendingSessions = sessions.filter(
    (session) => session.statusLabel !== "Completed",
  );
  const averageSessionScore =
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

  return (
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Email Assessments <span className="text-itbd-blue">Admin</span>
      </h1>

      <section className="grid gap-4 md:grid-cols-4">
        <DashCard number={sessions.length} name="Session records" />
        <DashCard number={completedSessions.length} name="Completed sessions" />
        <DashCard number={pendingSessions.length} name="Awaiting review" />
        <DashCard
          number={averageSessionScore}
          name="Average session score"
          subString="/ 10"
        />
      </section>

      <div>
        <AdminSessionDashboard
          sessions={sessions.map((session) => ({
            sessionIdentifier: session.sessionIdentifier,
            displayId: session.displayId,
            displayName: session.displayName,
            candidateEmail: session.candidateEmail,
            statusLabel: session.statusLabel,
            startedAt: session.startedAt.toLocaleString(),
            lastSubmittedAt: session.lastSubmittedAt?.toLocaleString() ?? null,
            submittedScenarios: session.submittedScenarios,
            totalScenarios: session.totalScenarios,
            aiWeightedTotal: session.aiWeightedTotal,
            aiGrade: session.aiGrade,
            manualWeightedTotal: session.manualWeightedTotal,
            manualGrade: session.manualGrade,
            evaluatorScore: session.evaluatorScore,
          }))}
        />
      </div>
    </main>
  );
}
