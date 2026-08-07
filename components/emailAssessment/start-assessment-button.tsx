"use client";

import { AlertTriangle, CheckCircle, FileText, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";

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
      <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md space-y-4">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10 flex items-center gap-2 border-b border-white/10 pb-3">
          <FileText className="h-5 w-5 text-itbd-blue" />
          <h3 className="text-lg font-bold tracking-wide text-white uppercase">
            Assessment Instructions
          </h3>
        </div>
        <div className="relative z-10 grid gap-4 text-sm text-white/80 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-itbd-blue" />
              <p>
                <strong className="text-white">Total Duration:</strong> 30
                minutes for the entire session.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-itbd-blue" />
              <p>
                <strong className="text-white">Assessment Pool:</strong> 5
                randomized scenarios (2 Beginner, 2 Intermediate, 1 Advanced).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-itbd-blue" />
              <p>
                <strong className="text-white">Subject Line:</strong> Ensure
                you write both a subject line and the email body for each
                scenario.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-itbd-blue" />
              <p>
                <strong className="text-white">Weighted Scoring:</strong>{" "}
                Marks vary by difficulty: Beginner (1.5), Intermediate (2.0),
                Advanced (3.0).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-itbd-blue" />
              <p>
                <strong className="text-white">
                  Anti-Cheating Protection:
                </strong>{" "}
                Copying or pasting text into the input fields is completely
                disabled.
              </p>
            </div>
          </div>
        </div>

        {/* Security warning — orange is reserved for emergency-only flags per
            brand guidelines; this is exactly that case. */}
        <div className="relative z-10 flex gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
          <div className="space-y-1">
            <p className="font-semibold text-orange-300">
              Security Protocol Notice
            </p>
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
        <DefaultButton size="lg" onClick={startAssessment} loading={loading}>
          {existingSession ? "Continue Session" : "Start Assessment"}
        </DefaultButton>
        {existingSession && (
          <GreenButton size="lg" onClick={startNewSession}>
            Start New Session
          </GreenButton>
        )}
      </div>
    </div>
  );
}
