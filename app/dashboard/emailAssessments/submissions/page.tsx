import { desc, eq } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import {
  emailAssessmentEvaluations as evaluations,
  emailAssessmentManualScores as manualScores,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSubmissions as submissions,
} from "@/DB/emailAssessmentSchema";
import { ManualScoreForm } from "@/components/emailAssessment/manual-score-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment Submissions</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <div className="mt-5 flex flex-col gap-4">
      {records.map((record) => (
        <Card key={record.submission.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{record.candidate.name ?? record.candidate.email}</CardTitle>
                <CardDescription>
                  {record.candidate.email} Â· {record.scenario.title}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge>{record.evaluation?.overallScore ?? "pending"} AI</Badge>
                <Badge>{scoreCountBySubmission.get(record.submission.id) ?? 0} manual</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border bg-muted/30 p-4 text-sm leading-6">
              {record.submission.content}
            </p>
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/emailAssessment/admin/reports/export?submissionId=${record.submission.id}`}>
                  Export PDF
                </a>
              </Button>
            </div>
            <ManualScoreForm submissionId={record.submission.id} />
          </CardContent>
        </Card>
      ))}
      {records.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No submissions yet</CardTitle>
            <CardDescription>Candidate submissions will appear here.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      </div>
    </main>
  );
}
