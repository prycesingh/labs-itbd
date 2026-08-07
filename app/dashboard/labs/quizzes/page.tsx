import { asc, eq } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsQuizCerts as quizCerts } from "@/DB/labsSchema";
import { QuizCertGrid } from "@/components/labs/quiz-cert-grid";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsQuizzesPage() {
  await requireUser();

  const certs = await db
    .select()
    .from(quizCerts)
    .where(eq(quizCerts.active, true))
    .orderBy(asc(quizCerts.sortOrder));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Practice <span className="text-itbd-blue">Quizzes</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Exam-style multiple choice with explanations. Pick a certification to begin.
        </p>
      </div>
      {certs.length === 0 ? (
        <p className="text-sm text-white/50">No quizzes are available yet.</p>
      ) : (
        <QuizCertGrid certs={certs.map((c) => ({ id: c.id, code: c.code, name: c.name }))} />
      )}
    </div>
  );
}
