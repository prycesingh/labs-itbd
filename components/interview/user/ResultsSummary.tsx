"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  averageDimensionMaps,
  averageTotalScores,
  EVALUATION_DIMENSION_LABELS,
  EVALUATION_DIMENSION_ORDER,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type EvaluationItem = {
  answerId: string;
  questionId: string;
  questionIndex: number;
  transcriptStatus: string;
  evaluationStatus: string;
  aiEvaluation: {
    total_score?: number;
    strengths?: string[];
    improvement_areas?: string[];
    final_summary?: string;
    dimensions?: Record<
      string,
      {
        score?: number;
        reason?: string;
      }
    >;
  } | null;
  adminEvaluation: {
    total_score?: number;
    dimensions?: Record<
      string,
      {
        score?: number;
        reason?: string;
      }
    >;
    dimensionOverrides?: Record<
      string,
      {
        score?: number;
        reason?: string;
      }
    >;
    comparisonToAi?: {
      score_diff?: number;
      agreement_pct?: number;
    };
    adminNotes?: string | null;
  } | null;
};

type DimensionMap = Record<
  string,
  {
    score?: number;
    reason?: string;
  }
>;

type SessionAnswer = {
  id: string;
  questionId: string;
  questionIndex: number;
  transcriptStatus: string;
  evaluationStatus: string;
};

type SessionResponse = {
  session: {
    id: string;
    status: string;
    moduleId: string;
    totalQuestions: number;
  };
  answers: SessionAnswer[];
  summary: {
    id: string;
    sessionId: string;
    overallAiScore?: string | number | null;
    overallAdminScore?: string | number | null;
    aiStrengths?: string[] | string | null;
    aiImprovementAreas?: string[] | string | null;
  } | null;
};

type EvaluationsResponse = {
  sessionId: string;
  count: number;
  evaluations: EvaluationItem[];
};

interface ResultsSummaryProps {
  sessionId: string;
}

function asNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        );
      }
    } catch {
      // Fall through to delimiter parsing.
    }

    return trimmed
      .split(/;|\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function getDimensionScore(dimensions: DimensionMap | undefined, key: string) {
  const value = dimensions?.[key]?.score;
  return typeof value === "number" ? value : null;
}

export function ResultsSummary({ sessionId }: ResultsSummaryProps) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/interview/sessions/${sessionId}/pdf`);
      if (!res.ok) {
        throw new Error("Failed to generate results PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "interview-results.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download results";
      toast.error("Download failed", { description: message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [sessionResponse, evaluationsResponse] = await Promise.all([
          fetch(`/api/interview/sessions?sessionId=${sessionId}`, {
            signal: controller.signal,
          }),
          fetch(`/api/interview/evaluations?sessionId=${sessionId}`, {
            signal: controller.signal,
          }),
        ]);

        if (!sessionResponse.ok) {
          throw new Error("Failed to load results");
        }

        if (!evaluationsResponse.ok) {
          throw new Error("Failed to load evaluation details");
        }

        setData((await sessionResponse.json()) as SessionResponse);
        setEvaluations(
          ((await evaluationsResponse.json()) as EvaluationsResponse)
            .evaluations,
        );
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load results",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [sessionId]);

  const totalEvaluated =
    data?.answers.filter((answer) => answer.evaluationStatus === "completed")
      .length ?? 0;
  const mergedAnswers = data
    ? data.answers.map((answer) => ({
        ...answer,
        ...evaluations.find((evaluation) => evaluation.answerId === answer.id),
      }))
    : [];

  const scoreSummary = useMemo(() => {
    const aiOverall = averageTotalScores(
      evaluations.map((item) => item.aiEvaluation?.total_score),
    );
    const finalOverall = averageTotalScores(
      evaluations.map(
        (item) =>
          item.adminEvaluation?.total_score ?? item.aiEvaluation?.total_score,
      ),
    );

    const aiDimensions = averageDimensionMaps(
      evaluations
        .map((item) => item.aiEvaluation?.dimensions ?? {})
        .filter((item) => Object.keys(item).length > 0),
    );
    const finalDimensions = averageDimensionMaps(
      evaluations
        .map(
          (item) =>
            item.adminEvaluation?.dimensions ??
            item.aiEvaluation?.dimensions ??
            {},
        )
        .filter((item) => Object.keys(item).length > 0),
    );

    return {
      aiOverall:
        totalScoreToPercentage(aiOverall) ??
        asNumber(data?.summary?.overallAiScore) ??
        0,
      finalOverall:
        totalScoreToPercentage(finalOverall) ??
        asNumber(data?.summary?.overallAdminScore) ??
        totalScoreToPercentage(aiOverall) ??
        asNumber(data?.summary?.overallAiScore) ??
        0,
      aiDimensions,
      finalDimensions,
    };
  }, [data?.summary, evaluations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        <CardContent className="p-6 text-center text-slate-200">
          <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-300" />
          <p className="text-lg text-white">Unable to load results</p>
          <p className="mt-2 text-sm text-slate-300">
            {error ?? "Please try again later."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const finalScore = scoreSummary.finalOverall;
  const strengths = asStringList(data.summary?.aiStrengths);
  const improvementAreas = asStringList(data.summary?.aiImprovementAreas);
  const summaryText =
    mergedAnswers
      .map((answer) => answer.aiEvaluation?.final_summary?.trim())
      .find((value): value is string => Boolean(value && value.length > 0)) ??
    "The interview summary is not available yet.";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
        <CardContent className="relative p-6 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(22,173,217,0.15),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(190,214,47,0.08),transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Results ready
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl text-white">
                  Interview Results
                </h1>
                <p className="mt-2 text-sm md:text-base text-slate-300">
                  Review your AI score, dimension-by-dimension evaluation, and
                  the final reviewed score.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-1 lg:min-w-90">
              <ScoreCard
                label="Total score"
                value={finalScore}
                accent="sky"
                placeholder="Pending"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DimensionSummaryCard finalDimensions={scoreSummary.finalDimensions} />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2 text-slate-200">
              <Sparkles className="h-4 w-4 text-sky-300" />
              Summary
            </div>

            <p className="text-sm leading-6 text-slate-300">{summaryText}</p>

            <Separator className="bg-white/10" />

            <div className="space-y-4">
              <SectionList
                title="Strengths"
                items={strengths}
                emptyLabel="No strengths available yet."
                accent="emerald"
              />
              <SectionList
                title="Improvement areas"
                items={improvementAreas}
                emptyLabel="No improvement areas available yet."
                accent="sky"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2 text-slate-200">
              <BarChart3 className="h-4 w-4 text-sky-300" />
              Evaluation progress
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Questions evaluated</span>
                <span>
                  {totalEvaluated}/{data.session.totalQuestions}
                </span>
              </div>
              <Progress
                value={Math.round(
                  (totalEvaluated / Math.max(data.session.totalQuestions, 1)) *
                    100,
                )}
                className="h-3 bg-white/10"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Session status
              </div>
              <div className="mt-2 text-xl text-white">
                {data.session.status}
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {mergedAnswers.some((answer) => answer.adminEvaluation)
                  ? "This score reflects the admin-reviewed evaluation."
                  : "This score is AI-evaluated. It may be updated after admin review."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div className="mb-2 text-white">Question breakdown</div>
              <div className="space-y-2 max-h-96 overflow-auto pr-1 no-scrollbar">
                {mergedAnswers.map((answer) => (
                  <div
                    key={answer.answerId}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>Question {answer.questionIndex + 1}</span>
                      <span
                        className={
                          answer.evaluationStatus === "completed"
                            ? "text-emerald-300"
                            : "text-amber-200"
                        }
                      >
                        {answer.evaluationStatus}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                      <span>
                        Score:{" "}
                        {answer.adminEvaluation?.total_score ??
                          answer.aiEvaluation?.total_score ??
                          "n/a"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {EVALUATION_DIMENSION_ORDER.map((key) => {
                        const finalValue = getDimensionScore(
                          answer.adminEvaluation?.dimensions ??
                            answer.aiEvaluation?.dimensions,
                          key,
                        );

                        return (
                          <div
                            key={`${answer.answerId}-${key}`}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                              {EVALUATION_DIMENSION_LABELS[key]}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-sm">
                              <span className="text-slate-300">
                                {finalValue ?? "-"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-itbd-blue text-white hover:brightness-95"
          disabled={downloadingPdf}
          onClick={() => {
            void downloadPdf();
          }}
        >
          {downloadingPdf ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Download PDF
        </Button>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  accent,
  placeholder,
}: {
  label: string;
  value: number | null;
  accent: "sky" | "emerald";
  placeholder?: string;
}) {
  const colorClass = accent === "sky" ? "text-sky-300" : "text-emerald-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
        {label}
      </div>
      <div className={`mt-2 text-4xl ${colorClass}`}>
        {value !== null ? value.toFixed(0) : (placeholder ?? "Pending")}
      </div>
      <div className="mt-2 text-sm text-slate-400">
        {value !== null ? "/ 100" : "Score will appear after processing"}
      </div>
    </div>
  );
}

function DimensionSummaryCard({
  finalDimensions,
}: {
  finalDimensions: DimensionMap;
}) {
  return (
    <Card className="border-white/15 bg-black/25 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] backdrop-blur-lg">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-slate-400">
              Dimension Summary
            </div>
            <div className="mt-1 text-lg text-white">
              Reviewed score breakdown
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {EVALUATION_DIMENSION_ORDER.map((key) => (
            <div
              key={key}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {EVALUATION_DIMENSION_LABELS[key]}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Score</span>
                <span className="text-sky-300">
                  {getDimensionScore(finalDimensions, key)?.toFixed(2) ?? "-"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionList({
  title,
  items,
  emptyLabel,
  accent,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  accent: "sky" | "emerald";
}) {
  const textClass = accent === "sky" ? "text-sky-200" : "text-emerald-200";

  return (
    <div>
      <div className={`text-sm uppercase tracking-[0.25em] ${textClass}`}>
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
