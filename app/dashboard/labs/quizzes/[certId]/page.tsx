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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          <span className="text-itbd-blue">{cert.code}</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">{cert.name}</p>
      </div>
      <QuizRunner certId={cert.id} />
    </div>
  );
}
