import { randomUUID } from "crypto";

import { StartAssessmentButton } from "@/components/emailAssessment/start-assessment-button";
import { DashCard } from "@/components/dashboard/dashCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";
import { getSessionSummaries } from "@/lib/emailAssessment/session-results";

export default async function EmailAssessmentTakePage() {
  const user = await requireRole(["candidate", "admin"]);
  const sessions = await getSessionSummaries({ candidateId: user.id });
  const completedSessions = sessions.filter((session) => session.aiWeightedTotal != null);
  const averageScore =
    completedSessions.length > 0
      ? Number(
          (
            completedSessions.reduce((total, session) => total + (session.aiWeightedTotal ?? 0), 0) /
            completedSessions.length
          ).toFixed(2)
        )
      : 0;
  const bestScore =
    completedSessions.length > 0
      ? Number(Math.max(...completedSessions.map((session) => session.aiWeightedTotal ?? 0)).toFixed(2))
      : 0;

  const preGeneratedSessionId = randomUUID();

  return (
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <DashCard number={sessions.length} name="Sessions" />
        <DashCard number={averageScore} name="Average session score" subString="/ 10" />
        <DashCard number={bestScore} name="Best session score" subString="/ 10" />
      </section>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ready for your next assessment?</CardTitle>
          <CardDescription>
            Each assessment session includes 5 scenarios and lasts 30 minutes total. Retakes unlock
            after a 3-day cooldown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StartAssessmentButton preGeneratedSessionId={preGeneratedSessionId} />
        </CardContent>
      </Card>
    </main>
  );
}
