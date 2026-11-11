"use client";

import { InterviewSession } from "@/components/interview/user/InterviewSession";
import { ModuleSelector } from "@/components/interview/user/ModuleSelector";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface PracticalLearningPageProps {
  /** interview_type to auto-start (e.g. "customer-service", "technical-QnA").
   *  When omitted, the module picker is shown. */
  moduleType?: string;
}

export default function PracticalLearningPage({
  moduleType,
}: PracticalLearningPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [startingSession, setStartingSession] = useState(false);
  const [resuming, setResuming] = useState(false);
  // True while resolving `moduleType` to a module — keeps the picker from
  // flashing before the deep-linked module starts. Falls back to the picker
  // if no active module matches.
  const [autoStarting, setAutoStarting] = useState(Boolean(moduleType));
  const autoStartAttempted = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleModuleSelected = useCallback(async (
    moduleId: string,
    questionDisplayCount: number,
  ) => {
    if (!session?.user?.id) {
      toast.error("Unable to start interview", {
        description: "User session is missing candidate identifier.",
      });
      return;
    }

    setSelectedModule(moduleId);
    setStartingSession(true);

    try {
      const response = await fetch("/api/interview/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: session.user.id,
          moduleId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to start interview session");
      }

      setSessionId(payload.sessionId);
      setTotalQuestions(
        Math.min(questionDisplayCount, Number(payload.totalQuestions ?? 0)),
      );
      setResuming(Boolean(payload.resumed));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start session";
      toast.error("Unable to start interview", { description: message });
      setSelectedModule(null);
      setSessionId(null);
      setTotalQuestions(0);
      setResuming(false);
    } finally {
      setStartingSession(false);
    }
  }, [session]);

  // Deep link: resolve `moduleType` to the active module of that type and
  // start it directly. Runs once — a failed start drops back to the picker
  // rather than retrying.
  useEffect(() => {
    if (!moduleType || status !== "authenticated") return;
    if (autoStartAttempted.current) return;
    autoStartAttempted.current = true;

    const autoStart = async () => {
      try {
        const response = await fetch("/api/interview/modules?active=true");
        if (!response.ok) throw new Error("Failed to load interview modules");
        const modules: Array<{
          id: string;
          interviewType: string;
          questionDisplayCount: number;
        }> = await response.json();

        const match = modules.find((m) => m.interviewType === moduleType);
        if (!match) {
          toast.error("Module unavailable", {
            description: "That module isn't active right now — pick another.",
          });
          return;
        }
        await handleModuleSelected(match.id, match.questionDisplayCount);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start module";
        toast.error("Unable to start interview", { description: message });
      } finally {
        setAutoStarting(false);
      }
    };

    void autoStart();
  }, [moduleType, status, handleModuleSelected]);

  if (status === "loading") return null;
  if (!session?.user) return null;

  return (
    <main className="flex flex-col w-full gap-2">
      {autoStarting && !selectedModule ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : !selectedModule ? (
        <ModuleSelector onModuleSelected={handleModuleSelected} />
      ) : startingSession || !sessionId || totalQuestions <= 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : (
        <InterviewSession sessionId={sessionId} resuming={resuming} />
      )}
    </main>
  );
}
