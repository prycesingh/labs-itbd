"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateWeightedTotalScore,
  EVALUATION_DIMENSION_LABELS,
  EVALUATION_DIMENSION_ORDER,
  mergeDimensionMaps,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { isAdminRole, type Role } from "@/lib/rbac";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface SessionResult {
  id: string;
  candidateName?: string;
  candidateId: string;
  moduleName: string;
  moduleId: string;
  totalQuestions: number;
  status: string;
  createdAt: Date;
  answers: AnswerDetail[];
  evaluation?: EvaluationDetail;
}

interface AnswerDetail {
  id: string;
  questionText: string;
  questionAudioPath?: string;
  standardResponses?: string[];
  audioPath?: string;
  transcript?: string;
  transcriptStatus?: "pending" | "transcribing" | "completed" | "failed";
  evaluationStatus?: "pending" | "evaluating" | "completed" | "failed";
  aiEvaluation?: {
    total_score: number;
    dimensions?: Record<string, { score?: number; reason?: string }>;
    strengths?: string;
    improvementAreas?: string;
    finalSummary?: string;
    evaluation_source?: "ai" | "fallback";
    validation_status?: "valid" | "invalid_json" | "invalid_structure";
  };
  adminEvaluation?: {
    total_score?: number;
    dimensions?: Record<string, { score?: number; reason?: string }>;
    dimensionOverrides?: Record<string, { score?: number; reason?: string }>;
    comparisonToAi?: {
      score_diff?: number;
      agreement_pct?: number;
      dimension_diffs?: Record<string, number>;
    };
    adminNotes?: string;
  };
  adminScore?: number;
  adminNotes?: string;
}

interface EvaluationDetail {
  overallAiScore: number;
  overallAdminScore?: number;
  aiStrengths?: string;
  aiImprovementAreas?: string;
  adminOverallNotes?: string;
  aiDimensions?: Record<string, { score?: number; reason?: string }>;
  finalDimensions?: Record<string, { score?: number; reason?: string }>;
}

const REEVALUATION_POLL_INTERVAL_MS = 2000;
const REEVALUATION_TIMEOUT_MS = 2 * 60 * 1000;

export default function ResultsEvaluationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionResult | null>(
    null,
  );
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(
    new Set(),
  );
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [adminDimensionScores, setAdminDimensionScores] = useState<
    Record<string, Record<string, string>>
  >({});
  const [retryingAnswerIds, setRetryingAnswerIds] = useState<Set<string>>(
    new Set(),
  );
  const [retryingSession, setRetryingSession] = useState(false);
  const [reEvaluatingSession, setReEvaluatingSession] = useState(false);
  const [deletingResults, setDeletingResults] = useState(false);
  const [isDeleteResultsOpen, setIsDeleteResultsOpen] = useState(false);

  const readErrorMessage = async (res: Response) => {
    try {
      const payload = await res.json();
      return payload?.error || payload?.details?.reason || "Request failed";
    } catch {
      return "Request failed";
    }
  };

  // Redirect non-admins. Only act once the session is fully resolved
  // (authenticated + role present) to avoid a false denial while role is
  // briefly undefined. Server-side proxy + requireAdminPage() are the real
  // gate; this is UX. isAdminRole → executive and future admin roles allowed.
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = session?.user?.role;
    if (role && !isAdminRole(role as Role)) {
      router.push("/dashboard");
      toast.error("Access denied. Administrator role required.");
    }
  }, [session, status, router]);

  const fetchSessions = useCallback(async () => {
    if (
      status !== "authenticated" ||
      !isAdminRole((session?.user?.role ?? null) as Role | null)
    ) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/interview/admin/sessions");

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to fetch sessions");
      }

      const data = await res.json();
      setSessions(data);

      setSelectedSession((prev) => {
        if (!prev) return null;
        return data.find((item: SessionResult) => item.id === prev.id) ?? null;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load sessions";
      toast.error("Failed to load sessions", { description: message });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.role, status]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    void fetchSessions();
  }, [fetchSessions, status]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    setAdminNotes(
      Object.fromEntries(
        selectedSession.answers.map((answer) => [
          answer.id,
          answer.adminEvaluation?.adminNotes ?? answer.adminNotes ?? "",
        ]),
      ),
    );

    setAdminDimensionScores(
      Object.fromEntries(
        selectedSession.answers.map((answer) => [
          answer.id,
          Object.fromEntries(
            EVALUATION_DIMENSION_ORDER.map((key) => [
              key,
              answer.adminEvaluation?.dimensionOverrides?.[key]?.score !==
              undefined
                ? String(
                    answer.adminEvaluation?.dimensionOverrides?.[key]?.score,
                  )
                : "",
            ]),
          ),
        ]),
      ),
    );
  }, [selectedSession]);

  const toggleAnswerExpanded = (answerId: string) => {
    setExpandedAnswers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(answerId)) {
        newSet.delete(answerId);
      } else {
        newSet.add(answerId);
      }
      return newSet;
    });
  };

  const toggleAudioPlayback = (audioId: string) => {
    if (playingAudioId === audioId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(audioId);
    }
  };

  const saveEvaluation = async (answerId: string) => {
    try {
      const notes = adminNotes[answerId];
      const answer = selectedSession?.answers.find(
        (item) => item.id === answerId,
      );
      const dimensionOverrides = Object.fromEntries(
        EVALUATION_DIMENSION_ORDER.map((key) => {
          const rawScore = adminDimensionScores[answerId]?.[key];
          const score =
            rawScore !== undefined && rawScore !== ""
              ? Number(rawScore)
              : undefined;

          return [
            key,
            score !== undefined && Number.isFinite(score)
              ? { score }
              : undefined,
          ];
        }).filter((entry) => Boolean(entry[1])),
      );
      const computedTotal = calculateWeightedTotalScore(
        mergeDimensionMaps(
          answer?.aiEvaluation?.dimensions ?? {},
          dimensionOverrides,
        ),
      );

      const res = await fetch("/api/interview/evaluations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId,
          totalScoreOverride: computedTotal,
          dimensionOverrides:
            Object.keys(dimensionOverrides).length > 0
              ? dimensionOverrides
              : undefined,
          adminNotes: notes,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to save evaluation");
      }

      toast.success("Re-evaluation saved successfully");
      await fetchSessions();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save evaluation";
      toast.error("Failed to save evaluation", { description: message });
      console.error(error);
    }
  };

  const retryProcessing = async (answerId?: string) => {
    if (!selectedSession?.id) {
      return;
    }

    const answerIds = answerId ? [answerId] : undefined;

    if (answerId) {
      setRetryingAnswerIds((prev) => new Set([...prev, answerId]));
    } else {
      setRetryingSession(true);
    }

    try {
      const res = await fetch("/api/interview/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "retry",
          sessionId: selectedSession.id,
          answerIds,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to retry processing");
      }

      toast.success(
        answerId
          ? "Retry queued for this answer"
          : "Retry queued for failed session jobs",
      );
      await fetchSessions();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to retry processing";
      toast.error("Retry failed", { description: message });
    } finally {
      if (answerId) {
        setRetryingAnswerIds((prev) => {
          const next = new Set(prev);
          next.delete(answerId);
          return next;
        });
      } else {
        setRetryingSession(false);
      }
    }
  };

  const reEvaluateSession = async () => {
    if (!selectedSession?.id) {
      return;
    }

    const previousScores = new Map(
      selectedSession.answers.map((answer) => [
        answer.id,
        answer.aiEvaluation?.total_score,
      ]),
    );
    const targetSessionId = selectedSession.id;

    setReEvaluatingSession(true);

    try {
      const res = await fetch("/api/interview/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reevaluate",
          sessionId: selectedSession.id,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to start re-evaluation");
      }

      toast.success("Re-evaluation queued", {
        description:
          "All answers in this session have been queued for fresh AI evaluation.",
      });

      const startedAt = Date.now();
      let finalSnapshot: SessionResult | null = null;

      while (Date.now() - startedAt < REEVALUATION_TIMEOUT_MS) {
        const statusRes = await fetch("/api/interview/admin/sessions", {
          cache: "no-store",
        });

        if (!statusRes.ok) {
          throw new Error(await readErrorMessage(statusRes));
        }

        const sessionsData = (await statusRes.json()) as SessionResult[];
        setSessions(sessionsData);

        const matched =
          sessionsData.find((item) => item.id === targetSessionId) ?? null;

        if (!matched) {
          break;
        }

        setSelectedSession((prev) => {
          if (!prev || prev.id !== targetSessionId) {
            return prev;
          }
          return matched;
        });

        const hasActiveEvaluation = matched.answers.some(
          (answer) =>
            answer.evaluationStatus === "pending" ||
            answer.evaluationStatus === "evaluating",
        );

        if (!hasActiveEvaluation) {
          finalSnapshot = matched;
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, REEVALUATION_POLL_INTERVAL_MS);
        });
      }

      if (!finalSnapshot) {
        toast.message("Re-evaluation is still running", {
          description:
            "Jobs are still in progress. Keep this page open or refresh shortly for final results.",
        });
        return;
      }

      const failedCount = finalSnapshot.answers.filter(
        (answer) => answer.evaluationStatus === "failed",
      ).length;

      let changedCount = 0;
      let unchangedCount = 0;

      for (const answer of finalSnapshot.answers) {
        if (answer.evaluationStatus !== "completed") {
          continue;
        }

        const previousScore = previousScores.get(answer.id);
        const currentScore = answer.aiEvaluation?.total_score;

        if (typeof currentScore !== "number") {
          continue;
        }

        if (typeof previousScore === "number") {
          if (Math.abs(previousScore - currentScore) < 0.0001) {
            unchangedCount += 1;
          } else {
            changedCount += 1;
          }
        } else {
          changedCount += 1;
        }
      }

      toast.success("Re-evaluation completed", {
        description: `Scores changed: ${changedCount}. Unchanged: ${unchangedCount}. Failed: ${failedCount}.`,
      });

      await fetchSessions();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start re-evaluation";
      toast.error("Re-evaluation failed", { description: message });
    } finally {
      setReEvaluatingSession(false);
    }
  };

  const deleteSelectedResults = async () => {
    if (!selectedSession?.moduleId) {
      return;
    }

    setDeletingResults(true);

    try {
      const res = await fetch(
        `/api/interview/admin/sessions/${selectedSession.id}/responses`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }

      const payload = await res.json().catch(() => null);

      toast.success("Session results deleted", {
        description: payload?.deleted
          ? `${payload.deleted.sessionsDeleted ?? 0} sessions, ${payload.deleted.answersDeleted ?? 0} answers, and related evaluations were removed.`
          : "All results for this session were removed.",
      });

      setIsDeleteResultsOpen(false);
      setSelectedSession(null);
      await fetchSessions();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete results";
      toast.error("Failed to delete module results", {
        description: message,
      });
      console.error(error);
    } finally {
      setDeletingResults(false);
    }
  };

  const sessionStatusClass = (value: string) => {
    if (value === "completed") return "bg-green-600/80";
    if (value === "failed") return "bg-red-600/80";
    if (value === "processing") return "bg-yellow-600/80";
    return "bg-slate-600/80";
  };

  const answerStatusClass = (value?: string) => {
    if (value === "completed") return "bg-green-600/70";
    if (value === "failed") return "bg-red-600/70";
    if (
      value === "pending" ||
      value === "transcribing" ||
      value === "evaluating"
    ) {
      return "bg-yellow-600/70";
    }
    return "bg-slate-600/70";
  };

  const getPreviewTotal = (answer: AnswerDetail) => {
    const overrides = Object.fromEntries(
      EVALUATION_DIMENSION_ORDER.map((key) => {
        const rawScore = adminDimensionScores[answer.id]?.[key];
        const score =
          rawScore !== undefined && rawScore !== ""
            ? Number(rawScore)
            : undefined;

        return [
          key,
          score !== undefined && Number.isFinite(score) ? { score } : undefined,
        ];
      }).filter((entry) => Boolean(entry[1])),
    );

    return (
      totalScoreToPercentage(
        calculateWeightedTotalScore(
          mergeDimensionMaps(answer.aiEvaluation?.dimensions ?? {}, overrides),
        ),
      ) ??
      answer.adminEvaluation?.total_score ??
      answer.aiEvaluation?.total_score
    );
  };

  const formatScoreAsPercentage = (value: number | null | undefined) => {
    const normalized = totalScoreToPercentage(value);
    return typeof normalized === "number" ? normalized.toFixed(2) : "N/A";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <main className="flex flex-col w-full gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">User Responses & Evaluations</h1>
        <p className="text-sm text-muted-foreground">
          Review user responses and provide manual evaluations alongside AI
          scores.
        </p>
      </header>

      <Separator className="bg-white" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sessions List */}
        <Card className="border-cyan-500/20 bg-black/20 lg:col-span-1">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              {sessions.length} completed session(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed sessions yet.
              </p>
            ) : (
              sessions.map((sess) => (
                <button
                  key={sess.id}
                  onClick={() => setSelectedSession(sess)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedSession?.id === sess.id
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                  }`}
                >
                  <div className="text-sm font-medium">{sess.moduleName}</div>
                  <div className="text-xs text-muted-foreground">
                    {sess.candidateName || "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(sess.createdAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2">
                    <Badge className={sessionStatusClass(sess.status)}>
                      {sess.status}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Session Details */}
        <Card className="border-cyan-500/20 bg-black/20 lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedSession ? (
                <div>
                  <div>{selectedSession.moduleName}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Candidate: {selectedSession.candidateName || "Unknown"}
                  </div>
                  <div className="mt-2">
                    <Badge
                      className={sessionStatusClass(selectedSession.status)}
                    >
                      {selectedSession.status}
                    </Badge>
                  </div>
                </div>
              ) : (
                "Select a session"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <p className="text-center text-muted-foreground py-8">
                Select a session from the list to view details.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Session Summary */}
                <div className="grid gap-2 mb-4 p-3 rounded-md border border-cyan-500/20 bg-cyan-500/5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">AI Score:</span>
                    <Badge className="bg-blue-600">
                      {formatScoreAsPercentage(
                        selectedSession.evaluation?.overallAiScore,
                      )}
                      / 100
                    </Badge>
                  </div>
                  {selectedSession.evaluation?.overallAdminScore !==
                    undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Final Score:</span>
                      <Badge className="bg-green-600">
                        {formatScoreAsPercentage(
                          selectedSession.evaluation.overallAdminScore,
                        )}
                        / 100
                      </Badge>
                    </div>
                  )}

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {EVALUATION_DIMENSION_ORDER.map((key) => (
                      <div
                        key={key}
                        className="rounded-md border border-cyan-500/20 bg-black/20 p-2"
                      >
                        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          {EVALUATION_DIMENSION_LABELS[key]}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span>AI</span>
                          <span className="text-blue-400">
                            {selectedSession.evaluation?.aiDimensions?.[key]
                              ?.score ?? "-"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span>Final</span>
                          <span className="text-green-400">
                            {selectedSession.evaluation?.finalDimensions?.[key]
                              ?.score ??
                              selectedSession.evaluation?.aiDimensions?.[key]
                                ?.score ??
                              "-"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedSession.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      disabled={retryingSession}
                      onClick={() => {
                        void retryProcessing();
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {retryingSession ? "Retrying..." : "Retry Failed Jobs"}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    disabled={reEvaluatingSession}
                    onClick={() => {
                      void reEvaluateSession();
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {reEvaluatingSession ? "Re-evaluating..." : "Re-Evaluate"}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-fit"
                    onClick={() => setIsDeleteResultsOpen(true)}
                  >
                    Delete Results
                  </Button>
                </div>

                {/* Answers List */}
                <div className="space-y-2">
                  {selectedSession.answers.map((answer) => (
                    <div
                      key={answer.id}
                      className="border border-cyan-500/20 rounded-md overflow-hidden bg-black/20"
                    >
                      <button
                        onClick={() => toggleAnswerExpanded(answer.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-cyan-500/5 transition-colors text-left"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {answer.questionText}
                          </div>
                          {answer.aiEvaluation?.total_score !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              AI Score:{" "}
                              <span className="text-blue-400">
                                {answer.aiEvaluation.total_score}
                              </span>
                              <span className="ml-3">
                                Final:{" "}
                                <span className="text-green-400">
                                  {getPreviewTotal(answer) ?? "-"}
                                </span>
                              </span>
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge
                              className={answerStatusClass(
                                answer.transcriptStatus,
                              )}
                            >
                              Transcript: {answer.transcriptStatus || "n/a"}
                            </Badge>
                            <Badge
                              className={answerStatusClass(
                                answer.evaluationStatus,
                              )}
                            >
                              Evaluation: {answer.evaluationStatus || "n/a"}
                            </Badge>
                            <Badge
                              className={
                                answer.aiEvaluation?.evaluation_source ===
                                "fallback"
                                  ? "bg-amber-600/80"
                                  : "bg-cyan-600/80"
                              }
                            >
                              {answer.aiEvaluation?.evaluation_source ===
                              "fallback"
                                ? "AI Source: fallback"
                                : "AI Source: structured"}
                            </Badge>
                          </div>
                        </div>
                        {expandedAnswers.has(answer.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {expandedAnswers.has(answer.id) && (
                        <div className="border-t border-cyan-500/20 p-3 space-y-3">
                          {/* Question prompt audio */}
                          {answer.questionAudioPath && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Question Audio
                              </div>
                              <audio
                                controls
                                className="w-full"
                                src={answer.questionAudioPath}
                              />
                            </div>
                          )}

                          {/* Standard responses */}
                          {Array.isArray(answer.standardResponses) &&
                            answer.standardResponses.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">
                                  Standard Responses
                                </div>
                                <div className="space-y-1">
                                  {answer.standardResponses.map(
                                    (response, idx) => (
                                      <p
                                        key={`${answer.id}-std-${idx}`}
                                        className="text-sm bg-black/40 p-2 rounded text-gray-300"
                                      >
                                        {idx + 1}. {response}
                                      </p>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Audio Playback */}
                          {answer.audioPath && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Audio Response
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleAudioPlayback(answer.id)}
                                  className="gap-1"
                                >
                                  {playingAudioId === answer.id ? (
                                    <>
                                      <Pause className="h-3 w-3" />
                                      Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3 w-3" />
                                      Play
                                    </>
                                  )}
                                </Button>
                                <audio
                                  controls
                                  className="flex-1 h-8"
                                  src={answer.audioPath}
                                />
                              </div>
                            </div>
                          )}

                          {/* Transcript */}
                          {answer.transcript && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Transcript
                              </div>
                              <p className="text-sm bg-black/40 p-2 rounded text-gray-300">
                                {answer.transcript}
                              </p>
                            </div>
                          )}

                          {/* AI Evaluation */}
                          {answer.aiEvaluation && (
                            <div className="space-y-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                              <div className="text-xs font-medium">
                                AI Evaluation
                              </div>
                              {answer.aiEvaluation.evaluation_source ===
                                "fallback" && (
                                <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                                  This evaluation was generated from a fallback
                                  path because the AI response did not pass JSON
                                  validation. The score is usable for
                                  continuity, but it is not a verified
                                  structured AI result.
                                </div>
                              )}
                              <div className="text-xs space-y-1">
                                <div>
                                  Score:{" "}
                                  <span className="text-blue-400 font-bold">
                                    {answer.aiEvaluation.total_score}
                                  </span>
                                </div>
                                <div className="grid gap-2 pt-1 md:grid-cols-2 xl:grid-cols-3">
                                  {EVALUATION_DIMENSION_ORDER.map((key) => (
                                    <div
                                      key={`${answer.id}-ai-${key}`}
                                      className="rounded bg-black/20 px-2 py-1"
                                    >
                                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        {EVALUATION_DIMENSION_LABELS[key]}
                                      </div>
                                      <div className="text-sm text-blue-300">
                                        {answer.aiEvaluation?.dimensions?.[key]
                                          ?.score ?? "-"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {answer.aiEvaluation.strengths && (
                                  <div>
                                    Strengths: {answer.aiEvaluation.strengths}
                                  </div>
                                )}
                                {answer.aiEvaluation.improvementAreas && (
                                  <div>
                                    Improvement Areas:{" "}
                                    {answer.aiEvaluation.improvementAreas}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(answer.transcriptStatus === "failed" ||
                            answer.evaluationStatus === "failed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={retryingAnswerIds.has(answer.id)}
                              onClick={() => {
                                void retryProcessing(answer.id);
                              }}
                              className="w-full"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              {retryingAnswerIds.has(answer.id)
                                ? "Retrying..."
                                : "Retry Processing"}
                            </Button>
                          )}

                          {/* Admin Evaluation */}
                          <div className="space-y-2 p-2 bg-green-500/10 rounded border border-green-500/20">
                            <div className="text-xs font-medium">
                              Manual Evaluation
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                  Final score preview
                                </label>
                                <div className="rounded-md border border-green-500/20 bg-black/30 px-3 py-2 text-sm text-green-300">
                                  {getPreviewTotal(answer)?.toFixed(2) ??
                                    "Pending"}{" "}
                                  / 100
                                </div>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {EVALUATION_DIMENSION_ORDER.map((key) => (
                                  <div key={`${answer.id}-override-${key}`}>
                                    <label className="text-xs text-muted-foreground block mb-1">
                                      {EVALUATION_DIMENSION_LABELS[key]}
                                    </label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      placeholder={
                                        answer.aiEvaluation?.dimensions?.[key]
                                          ?.score !== undefined
                                          ? String(
                                              answer.aiEvaluation?.dimensions?.[
                                                key
                                              ]?.score,
                                            )
                                          : "0-10"
                                      }
                                      value={
                                        adminDimensionScores[answer.id]?.[
                                          key
                                        ] ?? ""
                                      }
                                      onChange={(e) =>
                                        setAdminDimensionScores((prev) => ({
                                          ...prev,
                                          [answer.id]: {
                                            ...(prev[answer.id] ?? {}),
                                            [key]: e.target.value,
                                          },
                                        }))
                                      }
                                      className="text-xs h-8"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                  Notes
                                </label>
                                <Textarea
                                  placeholder="Add evaluation notes..."
                                  value={adminNotes[answer.id] || ""}
                                  onChange={(e) =>
                                    setAdminNotes((prev) => ({
                                      ...prev,
                                      [answer.id]: e.target.value,
                                    }))
                                  }
                                  className="text-xs min-h-16"
                                />
                              </div>
                              <Button
                                size="sm"
                                onClick={() => saveEvaluation(answer.id)}
                                className="w-full bg-green-600 hover:bg-green-700"
                              >
                                Save review
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDeleteResultsOpen} onOpenChange={setIsDeleteResultsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Module Results</DialogTitle>
            <DialogDescription>
              {selectedSession
                ? `This will permanently remove all user responses, AI evaluations, admin evaluations, and session summaries for the selected session in "${selectedSession.moduleName}". The module and questions will remain.`
                : "This will permanently remove all user responses, AI evaluations, admin evaluations, and session summaries for the selected session."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteResultsOpen(false)}
              disabled={deletingResults}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void deleteSelectedResults();
              }}
              disabled={!selectedSession?.moduleId || deletingResults}
            >
              {deletingResults ? "Deleting..." : "Delete Results"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
