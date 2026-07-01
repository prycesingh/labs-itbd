import { AdminSessionDashboard } from "@/components/emailAssessment/admin-session-dashboard";
import { DashCard } from "@/components/dashboard/dashCards";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";

export default async function EmailAssessmentsAdminDashboardPage() {
  await requireRole(["admin"]);

  const sessions = await getSessionSummaries();
  const completedSessions = sessions.filter((session) => session.aiWeightedTotal != null);
  const pendingSessions = sessions.filter((session) => session.statusLabel !== "Completed");
  const averageSessionScore =
    completedSessions.length > 0
      ? Number(
          (
            completedSessions.reduce((total, session) => total + (session.aiWeightedTotal ?? 0), 0) /
            completedSessions.length
          ).toFixed(2)
        )
      : 0;

  return (
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessments</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <section className="mt-5 grid gap-4 md:grid-cols-4">
        <DashCard number={sessions.length} name="Session records" />
        <DashCard number={completedSessions.length} name="Completed sessions" />
        <DashCard number={pendingSessions.length} name="Awaiting review" />
        <DashCard number={averageSessionScore} name="Average session score" subString="/ 10" />
      </section>

      <div className="mt-6">
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
