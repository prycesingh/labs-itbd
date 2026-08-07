import { ProcessingProgress } from "@/components/interview/user/ProcessingProgress";

export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="flex flex-col w-full gap-6">
      <ProcessingProgress sessionId={sessionId} />
    </main>
  );
}
