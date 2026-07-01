import { ProcessingProgress } from "@/components/interview/user/ProcessingProgress";

export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="flex flex-col w-full gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Processing in Progress</h1>
        <p className="text-sm text-muted-foreground">
          Please keep this page open while your interview answers are being
          transcribed, evaluated, and summarized.
        </p>
      </header>

      <ProcessingProgress sessionId={sessionId} />
    </main>
  );
}
