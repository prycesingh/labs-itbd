"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useInterviewSSE } from "@/hooks/useInterviewSSE";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface ProcessingProgressProps {
  sessionId: string;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function estimateRemaining(
  total: number,
  done: number,
  elapsedSeconds: number,
) {
  if (done <= 0 || total <= 0) {
    return null;
  }

  const completionRatio = done / total;
  if (completionRatio <= 0) {
    return null;
  }

  const estimatedTotal = elapsedSeconds / completionRatio;
  const remaining = Math.max(0, Math.round(estimatedTotal - elapsedSeconds));
  return remaining;
}

export function ProcessingProgress({ sessionId }: ProcessingProgressProps) {
  const router = useRouter();
  const stream = useInterviewSSE(sessionId, true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!stream.completed) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      router.replace(`/dashboard/interview/${sessionId}/results`);
    }, 1200);

    return () => window.clearTimeout(redirectTimer);
  }, [router, sessionId, stream.completed]);

  const overallProgress = useMemo(() => {
    if (stream.totalAnswers <= 0) {
      return stream.completed ? 100 : 0;
    }

    const completedPieces =
      stream.transcriptedAnswers + stream.evaluatedAnswers;
    const totalPieces = Math.max(stream.totalAnswers * 2, 1);
    return Math.min(100, Math.round((completedPieces / totalPieces) * 100));
  }, [
    stream.completed,
    stream.evaluatedAnswers,
    stream.totalAnswers,
    stream.transcriptedAnswers,
  ]);

  const remaining = estimateRemaining(
    stream.totalAnswers,
    Math.max(stream.transcriptedAnswers, stream.evaluatedAnswers),
    elapsedSeconds,
  );

  const statusLabel =
    stream.status === "transcribing"
      ? "Transcribing answers"
      : stream.status === "evaluating"
        ? "Evaluating responses"
        : stream.status === "summarizing"
          ? "Building summary"
          : stream.completed
            ? "Processing complete"
            : stream.failed
              ? "Processing failed"
              : "Waiting to start";

  const statusTone = stream.failed
    ? "text-red-300"
    : stream.completed
      ? "text-emerald-300"
      : "text-sky-300";

  const retryFailedJobs = async () => {
    setRetrying(true);
    try {
      const answerIds = Array.from(
        new Set(
          (stream.errors ?? [])
            .map((item) => item.answerId)
            .filter(
              (id) => id && id.length === 36 && !id.startsWith("interview-"),
            ),
        ),
      );

      const res = await fetch("/api/interview/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "retry",
          sessionId,
          answerIds: answerIds.length > 0 ? answerIds : undefined,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to queue retry");
      }

      toast.success("Retry queued. Reconnecting to processing stream...");
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to retry processing";
      toast.error("Retry failed", { description: message });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(22,173,217,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(126,221,250,0.1),transparent_34%)]" />
      <Card className="relative border-0 bg-transparent shadow-none">
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-sky-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Real-time processing
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl text-white">
                  Interview Processing
                </h1>
                <p className={`mt-2 text-sm md:text-base ${statusTone}`}>
                  {statusLabel}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-300">
                Elapsed
              </div>
              <div className="mt-1 text-3xl text-white">
                {formatElapsed(elapsedSeconds)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {remaining !== null
                  ? `~${formatElapsed(remaining)} remaining`
                  : "Estimating..."}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Overall progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3 bg-white/10" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Transcribed"
              value={`${stream.transcriptedAnswers}/${stream.totalAnswers}`}
              detail="Speech to text jobs"
            />
            <StatCard
              label="Evaluated"
              value={`${stream.evaluatedAnswers}/${stream.totalAnswers}`}
              detail="AI scoring jobs"
            />
            <StatCard
              label="Connection"
              value={
                stream.connected ? "Live" : stream.completed ? "Closed" : "Idle"
              }
              detail={stream.lastMessage ?? "Awaiting updates"}
            />
          </div>

          <Separator className="bg-white/10" />

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <Clock3 className="h-4 w-4 text-sky-300" />
                Current step
              </div>
              <div className="text-2xl text-white">
                {stream.currentStep ??
                  (stream.completed ? "summarizing" : "pending")}
              </div>
              <p className="text-sm leading-6 text-slate-300">
                This screen stays aligned with the existing app style while the
                background workers finish transcribing and evaluating your
                answers.
              </p>

              {stream.errors.length > 0 && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Processing issues detected
                  </div>
                  <ul className="space-y-1 text-sm">
                    {stream.errors.slice(0, 3).map((error, idx) => (
                      <li
                        key={`${error.answerId}-${error.step}-${idx}`}
                        className="list-disc pl-4"
                      >
                        {error.step}: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                {stream.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                )}
                Next action
              </div>

              <p className="text-sm leading-6 text-slate-300">
                {stream.completed
                  ? "Your analysis is done. Redirecting to the results page now."
                  : stream.failed
                    ? "Processing stopped because one or more jobs failed. You can retry from the interview flow if needed."
                    : "Please keep this tab open while the processing pipeline finishes."}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => router.refresh()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                {stream.completed && (
                  <Button
                    className="bg-sky-500 text-white hover:bg-sky-400"
                    onClick={() =>
                      router.push(`/dashboard/interview/${sessionId}/results`)
                    }
                  >
                    View results
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                )}

                {stream.failed && (
                  <Button
                    className="bg-amber-500 text-black hover:bg-amber-400"
                    disabled={retrying}
                    onClick={() => {
                      void retryFailedJobs();
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {retrying ? "Retrying..." : "Retry Failed Jobs"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-3xl text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{detail}</div>
    </div>
  );
}
