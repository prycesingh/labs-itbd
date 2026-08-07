"use client";

import { InterviewSession } from "@/components/interview/user/InterviewSession";
import { ModuleSelector } from "@/components/interview/user/ModuleSelector";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PracticalLearningPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [startingSession, setStartingSession] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleModuleSelected = async (
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
  };

  if (status === "loading") return null;
  if (!session?.user) return null;

  return (
    <main className="flex flex-col w-full gap-2">
      {!selectedModule ? (
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
