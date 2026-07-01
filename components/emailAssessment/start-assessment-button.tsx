"use client";

import { AlertTriangle, CheckCircle, FileText, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const SESSION_KEY = "candidate-assessment-session";
const TAKE_BASE = "/dashboard/emailAssessments/take";
const API_BASE = "/api/emailAssessment";

type SessionData = {
  sessionId: string;
  currentIndex: number;
  totalScenarios: number;
};

function readSession(): SessionData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

function writeSession(data: SessionData) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function StartAssessmentButton({
  preGeneratedSessionId,
}: {
  preGeneratedSessionId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState<SessionData | null>(
    null,
  );

  useEffect(() => {
    // Read browser-only sessionStorage after mount to avoid an SSR/client
    // hydration mismatch (the server cannot know the stored session).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExistingSession(readSession());
  }, []);

  const activeSessionId = existingSession
    ? existingSession.sessionId
    : preGeneratedSessionId;

  async function startAssessment() {
    setLoading(true);

    const body: Record<string, unknown> = {
      sessionId: activeSessionId,
    };

    const response = await fetch(`${API_BASE}/assessments/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setLoading(false);
      console.error(
        "/api/emailAssessment/assessments/start failed",
        response.status,
        result,
      );
      if (result?.nextEligibleAt) {
        toast.error(
          `Retake available after ${new Date(result.nextEligibleAt).toLocaleString()}.`,
        );
      } else {
        toast.error(
          result?.error ?? `Unable to start assessment (${response.status}).`,
        );
      }
      return;
    }

    if (!result?.reused) {
      const session = {
        sessionId: result.sessionId,
        currentIndex: result.sessionIndex,
        totalScenarios: result.totalScenarios,
      };

      writeSession(session);
    }

    router.push(
      `${TAKE_BASE}/assessment/${result.assessmentId}?sessionId=${result.sessionId}`,
    );
    router.refresh();
  }

  function startNewSession() {
    clearSession();
    setExistingSession(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Instructions Panel */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Assessment Instructions</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
              <p>
                <strong>Total Duration:</strong> 30 minutes for the entire
                session.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
              <p>
                <strong>Assessment Pool:</strong> 5 randomized scenarios (2
                Beginner, 2 Intermediate, 1 Advanced).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
              <p>
                <strong>Subject Line:</strong> Ensure you write both a subject
                line and the email body for each scenario.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
              <p>
                <strong>Weighted Scoring:</strong> Marks vary by difficulty:
                Beginner (1.5), Intermediate (2.0), Advanced (3.0).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
              <p>
                <strong>Anti-Cheating Protection:</strong> Copying or pasting
                text into the input fields is completely disabled.
              </p>
            </div>
          </div>
        </div>

        {/* Security Warning Banner */}
        <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Security Protocol Notice</p>
            <p className="leading-relaxed">
              Switching tabs, minimizing the browser window, or navigating away
              will
              <strong> automatically submit</strong> your current response, lock
              all remaining scenarios, apply a <strong>10% penalty</strong> to
              your overall score, and redirect you to the thank you page.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={startAssessment} disabled={loading}>
          {loading
            ? "Preparing scenarios..."
            : existingSession
              ? "Continue Session"
              : "Start Assessment"}
        </Button>
        {existingSession && (
          <Button size="lg" variant="outline" onClick={startNewSession}>
            Start New Session
          </Button>
        )}
      </div>
    </div>
  );
}
