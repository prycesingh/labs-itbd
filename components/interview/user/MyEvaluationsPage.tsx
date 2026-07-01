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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { totalScoreToPercentage } from "@/lib/interview/evaluationMetrics";
import { Download, Eye, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UserSession {
  id: string;
  moduleName: string;
  moduleId: string;
  totalQuestions: number;
  completedAt: Date;
  status:
    | "draft"
    | "recording"
    | "recorded"
    | "processing"
    | "completed"
    | "failed";
  evaluation?: {
    overallAiScore: number;
    overallAdminScore?: number;
    aiStrengths?: string;
    aiImprovementAreas?: string;
  };
}

interface SessionAnswerDetail {
  id: string;
  questionIndex: number;
  questionText: string | null;
  transcript: string | null;
  aiScore: number | null;
  adminScore: number | null;
}

interface SessionDetailPayload {
  session: { id: string };
  answers: SessionAnswerDetail[];
}

function formatPercentageScore(value: number | null | undefined): string {
  const normalized = totalScoreToPercentage(value);
  return typeof normalized === "number" ? normalized.toFixed(2) : "N/A";
}

export default function MyEvaluationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailAnswers, setDetailAnswers] = useState<SessionAnswerDetail[]>([]);

  const statusClassMap: Record<UserSession["status"], string> = {
    draft: "bg-slate-600/80",
    recording: "bg-amber-600/80",
    recorded: "bg-orange-600/80",
    processing: "bg-yellow-600/80",
    completed: "bg-green-600/80",
    failed: "bg-red-600/80",
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!session?.user?.id) {
      router.push("/");
    }
  }, [session, router]);

  const fetchUserSessions = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const res = await fetch(
        `/api/interview/sessions?userId=${session.user.id}`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to fetch sessions");
      }

      const data = await res.json();
      setSessions(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load your evaluations";
      toast.error("Failed to load your evaluations", { description: message });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchUserSessions();
  }, [fetchUserSessions]);

  const downloadResults = (sess: UserSession) => {
    const data = JSON.stringify(sess, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sess.moduleName}_${sess.id}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const openSessionDetails = async (sess: UserSession) => {
    setSelectedSession(sess);
    setIsDetailOpen(true);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/interview/sessions?sessionId=${sess.id}`);
      const payload = (await res
        .json()
        .catch(() => null)) as SessionDetailPayload | null;

      if (!res.ok || !payload) {
        throw new Error("Failed to load session details");
      }

      setDetailAnswers(payload.answers ?? []);
    } catch (error) {
      setDetailAnswers([]);
      const message =
        error instanceof Error ? error.message : "Failed to load details";
      toast.error("Failed to load session details", { description: message });
    } finally {
      setDetailLoading(false);
    }
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
        <h1 className="text-3xl font-bold">My Evaluations</h1>
        <p className="text-sm text-muted-foreground">
          View your completed interview modules and AI evaluation scores.
        </p>
      </header>

      <Separator className="bg-white" />

      {sessions.length === 0 ? (
        <Card className="border-cyan-500/20 bg-black/20">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No completed interviews yet. Start practicing to see your
              evaluations here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {sessions.length} completed interview(s)
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((sess) => (
              <Card
                key={sess.id}
                className="border-cyan-500/20 bg-black/20 hover:border-cyan-500/40 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {sess.moduleName}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {new Date(sess.completedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        sess.status === "completed" ? "default" : "secondary"
                      }
                      className={statusClassMap[sess.status]}
                    >
                      {sess.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">
                      Questions: {sess.totalQuestions}
                    </p>
                  </div>

                  {sess.evaluation && (
                    <div className="space-y-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                      <div className="text-xs font-medium text-blue-400">
                        AI Score (%)
                      </div>
                      <div className="text-2xl font-bold text-blue-400">
                        {formatPercentageScore(sess.evaluation.overallAiScore)}{" "}
                        / 100
                      </div>
                      {sess.evaluation.overallAdminScore !== undefined && (
                        <div className="text-xs mt-2 pt-2 border-t border-blue-500/20">
                          <div className="text-green-400 font-medium">
                            Admin Score:{" "}
                            {formatPercentageScore(
                              sess.evaluation.overallAdminScore,
                            )}{" "}
                            / 100
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator className="bg-white/10" />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        void openSessionDetails(sess);
                      }}
                      className="flex-1 gap-1 bg-cyan-600 hover:bg-cyan-700"
                    >
                      <Eye className="h-3 w-3" />
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadResults(sess)}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSession && selectedSession.moduleName}
            </DialogTitle>
            <DialogDescription>
              {selectedSession &&
                new Date(selectedSession.completedAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && selectedSession.evaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="text-xs font-medium text-muted-foreground">
                    AI Score (%)
                  </div>
                  <div className="text-2xl font-bold text-blue-400 mt-1">
                    {formatPercentageScore(
                      selectedSession.evaluation.overallAiScore,
                    )}{" "}
                    / 100
                  </div>
                </div>

                {selectedSession.evaluation.overallAdminScore !== undefined && (
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                    <div className="text-xs font-medium text-muted-foreground">
                      Admin Score (%)
                    </div>
                    <div className="text-2xl font-bold text-green-400 mt-1">
                      {formatPercentageScore(
                        selectedSession.evaluation.overallAdminScore,
                      )}{" "}
                      / 100
                    </div>
                  </div>
                )}
              </div>

              {selectedSession.evaluation.aiStrengths && (
                <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <div className="text-xs font-medium mb-1">Strengths</div>
                  <p className="text-sm text-gray-300">
                    {selectedSession.evaluation.aiStrengths}
                  </p>
                </div>
              )}

              {selectedSession.evaluation.aiImprovementAreas && (
                <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-xs font-medium mb-1">
                    Areas for Improvement
                  </div>
                  <p className="text-sm text-gray-300">
                    {selectedSession.evaluation.aiImprovementAreas}
                  </p>
                </div>
              )}

              <div className="rounded-md border border-white/10 bg-black/30 p-3">
                <div className="text-xs font-medium mb-3">Answer Breakdown</div>

                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading answer details...
                  </div>
                ) : detailAnswers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No answer details available for this session yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detailAnswers.map((answer) => (
                      <div
                        key={answer.id}
                        className="rounded-md border border-white/10 bg-black/25 p-3"
                      >
                        <div className="text-sm font-medium">
                          Q{answer.questionIndex + 1}:{" "}
                          {answer.questionText || "Question"}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          AI Score: {formatPercentageScore(answer.aiScore)} /
                          100 | Admin Score:{" "}
                          {formatPercentageScore(answer.adminScore)} / 100
                        </div>
                        <p className="mt-2 text-sm text-gray-300">
                          {answer.transcript || "Transcript unavailable"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
