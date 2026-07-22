import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { db } from "@/DB/drizzle";
import { labsQuizCerts as quizCerts } from "@/DB/labsSchema";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsQuizzesPage() {
  await requireUser();

  const certs = await db
    .select()
    .from(quizCerts)
    .where(eq(quizCerts.active, true))
    .orderBy(asc(quizCerts.sortOrder));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Practice Quizzes</h1>
        <p className="text-muted-foreground">
          Exam-style multiple choice with explanations. Pick a certification to begin.
        </p>
      </div>
      {certs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quizzes are available yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((cert) => (
            <Link key={cert.id} href={`/dashboard/labs/quizzes/${cert.id}`}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle>{cert.code}</CardTitle>
                  <CardDescription>{cert.name}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
