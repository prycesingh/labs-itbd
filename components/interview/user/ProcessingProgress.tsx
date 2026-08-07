"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useInterviewSSE } from "@/hooks/useInterviewSSE";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

interface ProcessingProgressProps {
  sessionId: string;
}

export function ProcessingProgress({ sessionId }: ProcessingProgressProps) {
  const router = useRouter();
  const stream = useInterviewSSE(sessionId, true);

  useEffect(() => {
    if (!stream.completed) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      router.replace(`/dashboard/interview/${sessionId}/results`);
    }, 1200);

    return () => window.clearTimeout(redirectTimer);
  }, [router, sessionId, stream.completed]);

  // A friendly, indeterminate-feeling progress value — never shows raw job
  // counts to the candidate, just a sense of forward motion toward 100.
  const displayProgress = useMemo(() => {
    if (stream.completed) return 100;
    if (stream.totalAnswers <= 0) return 15;
    const completedPieces = stream.transcriptedAnswers + stream.evaluatedAnswers;
    const totalPieces = Math.max(stream.totalAnswers * 2, 1);
    return Math.min(92, Math.max(15, Math.round((completedPieces / totalPieces) * 100)));
  }, [
    stream.completed,
    stream.evaluatedAnswers,
    stream.totalAnswers,
    stream.transcriptedAnswers,
  ]);

  if (stream.failed) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        <Card className="relative border-0 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10">
              <AlertTriangle className="h-7 w-7 text-red-300" />
            </div>
            <h2 className="text-2xl text-white">
              We couldn&apos;t finish evaluating your interview
            </h2>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              Something went wrong while processing your answers. Please try
              starting the module again, or contact support if this keeps
              happening.
            </p>
            <Button
              className="mt-2 bg-itbd-blue text-white hover:brightness-95"
              onClick={() =>
                router.push("/dashboard/interview/PracticalLearning")
              }
            >
              Back to Practical Learning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(22,173,217,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(126,221,250,0.1),transparent_34%)]" />
      <Card className="relative border-0 bg-transparent shadow-none">
        <CardContent className="flex flex-col items-center gap-6 p-10 text-center md:p-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-sky-200">
            <Sparkles className="h-3.5 w-3.5" />
            {stream.completed ? "Almost there" : "Evaluating your interview"}
          </div>

          <h1 className="text-3xl text-white md:text-4xl">
            {stream.completed
              ? "Your results are ready"
              : "Reviewing your answers..."}
          </h1>

          <p className="max-w-md text-sm leading-6 text-slate-300">
            {stream.completed
              ? "Redirecting you to your results now."
              : "This usually takes a minute or two. Feel free to keep this tab open — we'll take you to your results as soon as they're ready."}
          </p>

          <div className="w-full max-w-sm space-y-2">
            <Progress value={displayProgress} className="h-2.5 bg-white/10" />
          </div>

          {stream.completed && (
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Processing complete
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
