"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateWeightedTotalScore,
  mergeDimensionMaps,
  totalScoreToPercentage,
} from "@/lib/interview/evaluationMetrics";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import { isAdminRole, type Role } from "@/lib/rbac";
import { motion, useReducedMotion } from "motion/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface FollowUpSummary {
  id: string;
  sessionId: string;
  parentAnswerId: string;
  questionText: string;
  status: "pending" | "answered" | "skipped";
}

interface DeliveryMetrics {
  scores: {
    pace?: number;
    pausing?: number;
    fluency?: number;
    expressiveness?: number;
  };
  overall?: number;
  calibrationMode: "static" | "population-relative";
  wpm?: number;
  pauseCount?: number;
  totalPauseS?: number;
  longestPauseS?: number;
  pauseRatio?: number;
  fillerCount?: number;
  fillersPerMin?: number;
  pitchMeanHz?: number;
  pitchDynamismSt?: number;
  pitchRangeSt?: number;
  loudnessDbMean?: number;
  loudnessVariationDb?: number;
}

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
  followUps?: FollowUpSummary[];
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
  isFollowUp?: boolean;
  followUpOfAnswerId?: string;
  deliveryMetrics?: DeliveryMetrics;
  aiEvaluation?: {
    total_score: number;
    dimensions?: Record<string, { score?: number; reason?: string }>;
    // Which of the two fixed dimension sets `dimensions` uses — see
    // lib/interview/evaluationMetrics.ts's DimensionSetName. Absent on rows
    // written before this concept existed; treated as "customer-service".
    dimensionSet?: "customer-service" | "technical-interview";
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
  dimensionSet?: "customer-service" | "technical-interview";
}

const CUSTOMER_SERVICE_DIMENSION_ORDER = [
  "courtesy",
  "empathy",
  "professionalism_and_tone",
  "communication_clarity",
  "engagement_and_problem_handling",
] as const;

const TECHNICAL_INTERVIEW_DIMENSION_ORDER = [
  "correctness",
  "relevance",
  "structure",
  "specificity",
  "completeness",
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  courtesy: "Courtesy",
  empathy: "Empathy",
  professionalism_and_tone: "Professionalism & Tone",
  communication_clarity: "Communication Clarity",
  engagement_and_problem_handling: "Engagement & Problem Handling",
  correctness: "Correctness",
  relevance: "Relevance",
  structure: "Structure",
  specificity: "Specificity",
  completeness: "Completeness",
};

function dimensionOrderFor(
  dimensionSet: "customer-service" | "technical-interview" | undefined,
): readonly string[] {
  return dimensionSet === "technical-interview"
    ? TECHNICAL_INTERVIEW_DIMENSION_ORDER
    : CUSTOMER_SERVICE_DIMENSION_ORDER;
}

const DELIVERY_SCORE_ORDER = [
  ["pace", "Pace"],
  ["pausing", "Pausing"],
  ["fluency", "Fluency"],
  ["expressiveness", "Expressiveness"],
] as const;

/**
 * Session-level delivery average, banded 1-5 same as the per-answer scores —
 * averaged across every answer that has delivery data (Interview Coach only;
 * undefined for Customer Cetricity sessions, which never carry any).
 */
function averageDeliveryForSession(session: SessionResult): {
  overall?: number;
  scores: Partial<Record<(typeof DELIVERY_SCORE_ORDER)[number][0], number>>;
} | null {
  const answersWithDelivery = session.answers.filter(
    (answer) => answer.deliveryMetrics,
  );
  if (answersWithDelivery.length === 0) {
    return null;
  }

  const overallValues = answersWithDelivery
    .map((answer) => answer.deliveryMetrics?.overall)
    .filter((value): value is number => typeof value === "number");
  const overall =
    overallValues.length > 0
      ? Number(
          (
            overallValues.reduce((sum, value) => sum + value, 0) /
            overallValues.length
          ).toFixed(2),
        )
      : undefined;

  const scores: Partial<Record<(typeof DELIVERY_SCORE_ORDER)[number][0], number>> =
    {};
  for (const [key] of DELIVERY_SCORE_ORDER) {
    const values = answersWithDelivery
      .map((answer) => answer.deliveryMetrics?.scores[key])
      .filter((value): value is number => typeof value === "number");
    if (values.length > 0) {
      scores[key] = Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2),
      );
    }
  }

  return { overall, scores };
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
  const reduceMotion = useReducedMotion();

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
            dimensionOrderFor(answer.aiEvaluation?.dimensionSet).map(
              (key) => [
                key,
                answer.adminEvaluation?.dimensionOverrides?.[key]?.score !==
                undefined
                  ? String(
                      answer.adminEvaluation?.dimensionOverrides?.[key]
                        ?.score,
                    )
                  : "",
              ],
            ),
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
      const dimensionSet = answer?.aiEvaluation?.dimensionSet;
      const dimensionOverrides = Object.fromEntries(
        dimensionOrderFor(dimensionSet)
          .map((key) => {
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
          })
          .filter((entry) => Boolean(entry[1])),
      );
      const computedTotal = calculateWeightedTotalScore(
        mergeDimensionMaps(
          answer?.aiEvaluation?.dimensions ?? {},
          dimensionOverrides,
          dimensionSet,
        ),
        dimensionSet,
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
        // Not a real failure — it means every answer already succeeded or
        // has a retry genuinely in flight (e.g. from an earlier click on
        // this same session), so there's nothing left to queue. Surface it
        // as a calm status note instead of an error toast, and refresh so
        // the UI reflects the now-current (likely completed) state.
        if (
          typeof payload?.error === "string" &&
          payload.error.includes("No failed answers found to retry")
        ) {
          toast.info("Nothing to retry", {
            description:
              "Every answer either finished processing or has a retry already in progress.",
          });
          await fetchSessions();
          return;
        }
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
    const dimensionSet = answer.aiEvaluation?.dimensionSet;
    const overrides = Object.fromEntries(
      dimensionOrderFor(dimensionSet)
        .map((key) => {
          const rawScore = adminDimensionScores[answer.id]?.[key];
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
        })
        .filter((entry) => Boolean(entry[1])),
    );

    return (
      totalScoreToPercentage(
        calculateWeightedTotalScore(
          mergeDimensionMaps(
            answer.aiEvaluation?.dimensions ?? {},
            overrides,
            dimensionSet,
          ),
          dimensionSet,
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
        <Loader2 className="h-8 w-8 animate-spin text-itbd-blue" />
      </div>
    );
  }

  const sessionDelivery = selectedSession
    ? averageDeliveryForSession(selectedSession)
    : null;

  return (
    <main className="flex flex-col w-full gap-6">
      <motion.header
        className="space-y-1"
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-3xl font-bold text-white">
          User Responses & Evaluations
        </h1>
        <p className="text-sm text-slate-400">
          Review user responses and provide manual evaluations alongside AI
          scores.
        </p>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sessions List */}
        <motion.div
          className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md lg:col-span-1"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="p-6 pb-3">
            <h2 className="text-lg font-semibold text-white">Sessions</h2>
            <p className="text-sm text-slate-400">
              {sessions.length} completed session(s)
            </p>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto px-4 pb-4">
            {sessions.length === 0 ? (
              <p className="px-2 text-sm text-slate-400">
                No completed sessions yet.
              </p>
            ) : (
              sessions.map((sess) => (
                <button
                  key={sess.id}
                  onClick={() => setSelectedSession(sess)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    selectedSession?.id === sess.id
                      ? "border-itbd-blue/60 bg-itbd-blue/10"
                      : "border-white/10 bg-white/5 hover:border-itbd-blue/30 hover:bg-white/10"
                  }`}
                >
                  <div className="text-sm font-medium text-white">
                    {sess.moduleName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {sess.candidateName || "Unknown"}
                  </div>
                  <div className="text-xs text-slate-400">
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
          </div>
        </motion.div>

        {/* Session Details */}
        <motion.div
          className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md lg:col-span-2"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.05 }}
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="p-6 pb-3">
            {selectedSession ? (
              <div>
                <div className="text-lg font-semibold text-white">
                  {selectedSession.moduleName}
                </div>
                <div className="text-sm text-slate-400">
                  Candidate: {selectedSession.candidateName || "Unknown"}
                </div>
                <div className="mt-2">
                  <Badge className={sessionStatusClass(selectedSession.status)}>
                    {selectedSession.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-lg font-semibold text-white">
                Select a session
              </div>
            )}
          </div>
          <div className="px-6 pb-6">
            {!selectedSession ? (
              <p className="text-center text-slate-400 py-8">
                Select a session from the list to view details.
              </p>
            ) : (
              <motion.div
                key={selectedSession.id}
                className="space-y-4"
                initial={reduceMotion ? false : "hidden"}
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: {
                      staggerChildren: 0.06,
                      delayChildren: 0.04,
                    },
                  },
                }}
              >
                {/* Session Summary */}
                <motion.div
                  className="relative space-y-4 mb-4 p-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,173,218,0.12),transparent_45%)]"
                  />

                  <motion.div
                    className="relative grid gap-3 sm:grid-cols-2"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: 0.06 } },
                    }}
                  >
                    <motion.div
                      className="rounded-xl border border-white/10 bg-black/25 p-3"
                      variants={{
                        hidden: { opacity: 0, y: 10, scale: 0.97 },
                        show: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                        },
                      }}
                    >
                      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        AI Score
                      </div>
                      <div className="mt-1 text-2xl font-bold text-itbd-blue">
                        {formatScoreAsPercentage(
                          selectedSession.evaluation?.overallAiScore,
                        )}
                        <span className="text-sm font-normal text-slate-400">
                          {" "}
                          / 100
                        </span>
                      </div>
                    </motion.div>
                    {selectedSession.evaluation?.overallAdminScore !==
                      undefined && (
                      <motion.div
                        className="rounded-xl border border-white/10 bg-black/25 p-3"
                        variants={{
                          hidden: { opacity: 0, y: 10, scale: 0.97 },
                          show: {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                          },
                        }}
                      >
                        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                          Final Score
                        </div>
                        <div className="mt-1 text-2xl font-bold text-white">
                          {formatScoreAsPercentage(
                            selectedSession.evaluation.overallAdminScore,
                          )}
                          <span className="text-sm font-normal text-slate-400">
                            {" "}
                            / 100
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  <motion.div
                    className="relative grid gap-2 md:grid-cols-2 xl:grid-cols-4"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: 0.04 } },
                    }}
                  >
                    {dimensionOrderFor(selectedSession.evaluation?.dimensionSet).map(
                      (key) => (
                      <motion.div
                        key={key}
                        className="rounded-lg border border-white/10 bg-black/20 p-2"
                        variants={{
                          hidden: { opacity: 0, y: 8 },
                          show: {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                          },
                        }}
                      >
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          {DIMENSION_LABELS[key]}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-slate-400">AI</span>
                          <span className="text-itbd-blue">
                            {selectedSession.evaluation?.aiDimensions?.[key]
                              ?.score ?? "-"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Final</span>
                          <span className="text-white">
                            {selectedSession.evaluation?.finalDimensions?.[key]
                              ?.score ??
                              selectedSession.evaluation?.aiDimensions?.[key]
                                ?.score ??
                              "-"}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Delivery Score — only present for modules with delivery
                      scoring (Interview Coach); silently absent otherwise. */}
                  {sessionDelivery && (
                    <motion.div
                      className="relative space-y-2 rounded-xl border border-white/10 bg-black/25 p-3"
                      variants={{
                        hidden: { opacity: 0, y: 12, scale: 0.98 },
                        show: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                        },
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                          <Mic className="h-3 w-3" />
                          Delivery Score
                        </div>
                        <div className="text-lg font-bold text-white">
                          {sessionDelivery.overall ?? "-"}
                          <span className="text-xs font-normal text-slate-400">
                            {" "}
                            / 5
                          </span>
                        </div>
                      </div>
                      <motion.div
                        className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"
                        variants={{
                          hidden: {},
                          show: { transition: { staggerChildren: 0.04 } },
                        }}
                      >
                        {DELIVERY_SCORE_ORDER.map(([key, label]) => (
                          <motion.div
                            key={key}
                            className="rounded-lg border border-white/10 bg-white/5 p-2"
                            variants={{
                              hidden: { opacity: 0, y: 8 },
                              show: {
                                opacity: 1,
                                y: 0,
                                transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                              },
                            }}
                          >
                            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                              {label}
                            </div>
                            <div className="mt-1 text-sm text-white">
                              {sessionDelivery.scores[key] ?? "-"}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </motion.div>
                  )}

                  {selectedSession.followUps?.some(
                    (f) => f.status === "pending",
                  ) && (
                    <motion.div
                      className="relative rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200"
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: {
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                        },
                      }}
                    >
                      {
                        selectedSession.followUps.filter(
                          (f) => f.status === "pending",
                        ).length
                      }{" "}
                      follow-up question(s) never answered — the candidate may
                      have abandoned the flow mid-interview.
                    </motion.div>
                  )}

                  <motion.div
                    className="relative flex flex-wrap gap-2 pt-1"
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                  >
                    {(selectedSession.status === "failed" ||
                      selectedSession.answers.some(
                        (answer) =>
                          answer.transcriptStatus === "failed" ||
                          answer.evaluationStatus === "failed",
                      )) && (
                      <Button
                        size="sm"
                        variant="outline"
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
                      disabled={
                        reEvaluatingSession ||
                        !selectedSession.answers.some((answer) => answer.transcript)
                      }
                      title={
                        selectedSession.answers.some((answer) => answer.transcript)
                          ? undefined
                          : "No answers have a transcript yet — use Retry Failed Jobs first"
                      }
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
                      onClick={() => setIsDeleteResultsOpen(true)}
                    >
                      Delete Results
                    </Button>
                  </motion.div>
                </motion.div>

                {/* Answers List */}
                <div className="space-y-2">
                  {selectedSession.answers.map((answer, index) => (
                    <motion.div
                      key={answer.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: [0.22, 1, 0.36, 1],
                        delay: reduceMotion ? 0 : Math.min(index * 0.04, 0.4),
                      }}
                    >
                      <button
                        onClick={() => toggleAnswerExpanded(answer.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-white">
                            {answer.isFollowUp && (
                              <Badge className="bg-itbd-blue/20 text-itbd-blue shrink-0">
                                Follow-up
                              </Badge>
                            )}
                            {answer.questionText}
                          </div>
                          {answer.isFollowUp &&
                            answer.followUpOfAnswerId &&
                            (() => {
                              const parent = selectedSession.answers.find(
                                (a) => a.id === answer.followUpOfAnswerId,
                              );
                              return parent ? (
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Follow-up to: {parent.questionText.slice(0, 80)}
                                  {parent.questionText.length > 80 ? "…" : ""}
                                </div>
                              ) : null;
                            })()}
                          {answer.aiEvaluation?.total_score !== undefined && (
                            <div className="text-xs text-slate-400 mt-1">
                              AI Score:{" "}
                              <span className="text-itbd-blue">
                                {answer.aiEvaluation.total_score}
                              </span>
                              <span className="ml-3">
                                Final:{" "}
                                <span className="text-white">
                                  {getPreviewTotal(answer) ?? "-"}
                                </span>
                              </span>
                              {typeof answer.deliveryMetrics?.overall ===
                                "number" && (
                                <span className="ml-3">
                                  Delivery:{" "}
                                  <span className="text-white">
                                    {answer.deliveryMetrics.overall} / 5
                                  </span>
                                </span>
                              )}
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
                                  : "bg-itbd-blue/20 text-itbd-blue"
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
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>

                      {expandedAnswers.has(answer.id) && (
                        <div className="p-3 space-y-3 border-t border-white/10">
                          {/* Question prompt audio */}
                          {answer.questionAudioPath && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-slate-400">
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
                                <div className="text-xs font-medium text-slate-400">
                                  Standard Responses
                                </div>
                                <div className="space-y-1">
                                  {answer.standardResponses.map(
                                    (response, idx) => (
                                      <p
                                        key={`${answer.id}-std-${idx}`}
                                        className="text-sm bg-black/25 p-2 rounded-lg text-slate-300"
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
                              <div className="text-xs font-medium text-slate-400">
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
                              <div className="text-xs font-medium text-slate-400">
                                Transcript
                              </div>
                              <p className="text-sm bg-black/25 p-2 rounded-lg text-slate-300">
                                {answer.transcript}
                              </p>
                            </div>
                          )}

                          {/* AI Evaluation */}
                          {answer.aiEvaluation && (
                            <div className="space-y-2 p-3 rounded-xl border border-itbd-blue/20 bg-itbd-blue/5">
                              <div className="text-xs font-medium text-white">
                                AI Evaluation
                              </div>
                              {answer.aiEvaluation.evaluation_source ===
                                "fallback" && (
                                <div className="rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                                  This evaluation was generated from a fallback
                                  path because the AI response did not pass JSON
                                  validation. The score is usable for
                                  continuity, but it is not a verified
                                  structured AI result.
                                </div>
                              )}
                              <div className="text-xs space-y-1 text-slate-300">
                                <div>
                                  Score:{" "}
                                  <span className="text-itbd-blue font-bold">
                                    {answer.aiEvaluation.total_score}
                                  </span>
                                </div>
                                <div className="grid gap-2 pt-1 md:grid-cols-2 xl:grid-cols-3">
                                  {dimensionOrderFor(answer.aiEvaluation?.dimensionSet).map(
                                    (key) => (
                                    <div
                                      key={`${answer.id}-ai-${key}`}
                                      className="rounded-lg bg-black/25 px-2 py-1"
                                    >
                                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                        {DIMENSION_LABELS[key]}
                                      </div>
                                      <div className="text-sm text-itbd-blue">
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

                          {/* Delivery Scoring — only present for modules with
                              delivery_scoring enabled (Interview Coach);
                              silently absent for Customer Cetricity answers. */}
                          {answer.deliveryMetrics && (
                            <div className="space-y-2 p-3 rounded-xl border border-white/10 bg-white/5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                                  <Mic className="h-3 w-3 text-slate-400" />
                                  Delivery Scoring
                                </div>
                                <Badge className="bg-white/10 text-slate-300 text-[10px]">
                                  {answer.deliveryMetrics.calibrationMode}
                                </Badge>
                              </div>
                              <div className="text-xs space-y-1 text-slate-300">
                                <div>
                                  Overall:{" "}
                                  <span className="text-white font-bold">
                                    {answer.deliveryMetrics.overall ?? "-"} / 5
                                  </span>
                                </div>
                                <div className="grid gap-2 pt-1 md:grid-cols-2 xl:grid-cols-4">
                                  {(
                                    [
                                      ["pace", "Pace"],
                                      ["pausing", "Pausing"],
                                      ["fluency", "Fluency"],
                                      ["expressiveness", "Expressiveness"],
                                    ] as const
                                  ).map(([key, label]) => (
                                    <div
                                      key={`${answer.id}-delivery-${key}`}
                                      className="rounded-lg bg-black/25 px-2 py-1"
                                    >
                                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                        {label}
                                      </div>
                                      <div className="text-sm text-white">
                                        {answer.deliveryMetrics?.scores[key] ??
                                          "-"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-1 text-[11px] text-slate-500">
                                  {answer.deliveryMetrics.wpm !== undefined && (
                                    <>WPM: {answer.deliveryMetrics.wpm} · </>
                                  )}
                                  {answer.deliveryMetrics.pauseCount !==
                                    undefined && (
                                    <>
                                      Pauses: {answer.deliveryMetrics.pauseCount}{" "}
                                      (longest{" "}
                                      {answer.deliveryMetrics.longestPauseS ??
                                        "-"}
                                      s) ·{" "}
                                    </>
                                  )}
                                  {answer.deliveryMetrics.fillerCount !==
                                    undefined && (
                                    <>
                                      Fillers:{" "}
                                      {answer.deliveryMetrics.fillerCount} (
                                      {answer.deliveryMetrics.fillersPerMin ??
                                        "-"}
                                      /min) ·{" "}
                                    </>
                                  )}
                                  {answer.deliveryMetrics.pitchMeanHz !==
                                    undefined && (
                                    <>
                                      Pitch: {answer.deliveryMetrics.pitchMeanHz}
                                      Hz (dynamism{" "}
                                      {answer.deliveryMetrics.pitchDynamismSt ??
                                        "-"}
                                      st) ·{" "}
                                    </>
                                  )}
                                  {answer.deliveryMetrics.loudnessDbMean !==
                                    undefined && (
                                    <>
                                      Loudness:{" "}
                                      {answer.deliveryMetrics.loudnessDbMean}dB
                                      (var{" "}
                                      {answer.deliveryMetrics
                                        .loudnessVariationDb ?? "-"}
                                      )
                                    </>
                                  )}
                                </div>
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
                          <div className="space-y-2 p-3 rounded-xl border border-white/10 bg-black/25">
                            <div className="text-xs font-medium text-white">
                              Manual Evaluation
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">
                                  Final score preview
                                </label>
                                <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-itbd-blue font-medium">
                                  {getPreviewTotal(answer)?.toFixed(2) ??
                                    "Pending"}{" "}
                                  / 100
                                </div>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {dimensionOrderFor(answer.aiEvaluation?.dimensionSet).map(
                                  (key) => (
                                  <div key={`${answer.id}-override-${key}`}>
                                    <label className="text-xs text-slate-400 block mb-1">
                                      {DIMENSION_LABELS[key]}
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
                                <label className="text-xs text-slate-400 block mb-1">
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
                                className="w-full bg-itbd-blue text-white hover:bg-itbd-blue/90"
                              >
                                Save review
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
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
