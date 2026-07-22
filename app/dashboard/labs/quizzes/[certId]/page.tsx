import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/DB/drizzle";
import { labsQuizCerts as quizCerts } from "@/DB/labsSchema";
import { QuizRunner } from "@/components/labs/quiz-runner";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsQuizTakePage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  await requireUser();

  const { certId } = await params;
  const [cert] = await db.select().from(quizCerts).where(eq(quizCerts.id, certId)).limit(1);

  if (!cert || !cert.active) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{cert.code}</h1>
        <p className="text-muted-foreground">{cert.name}</p>
      </div>
      <QuizRunner certId={cert.id} />
    </div>
  );
}
