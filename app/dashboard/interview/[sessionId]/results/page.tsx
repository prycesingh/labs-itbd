import { ResultsSummary } from "@/components/interview/user/ResultsSummary";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="flex flex-col w-full gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Interview Results</h1>
        <p className="text-sm text-muted-foreground">
          Your interview has been evaluated. Review your AI-generated scores and
          feedback below.
        </p>
      </header>

      <ResultsSummary sessionId={sessionId} />
    </main>
  );
}
