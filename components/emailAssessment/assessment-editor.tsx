"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { differenceInSeconds } from "@/lib/emailAssessment/date";

const TAKE_BASE = "/dashboard/emailAssessments/take";
const API_BASE = "/api/emailAssessment";

type Props = {
  assessmentId: string;
  sessionId?: string;
  dueAt: string;
  nextAssessmentId: string | null;
  currentIndex: number;
  totalScenarios: number;
  /** All remaining assessment IDs in this session (including the current one) */
  remainingAssessmentIds?: string[];
};

export function AssessmentEditor({
  assessmentId,
  sessionId,
  dueAt,
  nextAssessmentId,
  currentIndex,
  totalScenarios,
  remainingAssessmentIds = [],
}: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, differenceInSeconds(new Date(dueAt), new Date())),
  );
  const [ending, setEnding] = useState(false);
  const hasSubmittedRef = useRef(false);
  const words = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  );

  // Countdown timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft(
        Math.max(0, differenceInSeconds(new Date(dueAt), new Date())),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [dueAt]);

  // Auto-end when timer expires
  useEffect(() => {
    if (secondsLeft > 0 || hasSubmittedRef.current) return;

    hasSubmittedRef.current = true;
    const body = JSON.stringify({ assessmentId });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API_BASE}/assessments/end`, blob);
    } else {
      fetch(`${API_BASE}/assessments/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => null);
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("candidate-assessment-session");
    }
    router.push(`${TAKE_BASE}/thank-you?reason=timeout`);
    router.refresh();
  }, [assessmentId, secondsLeft, router]);

  // Handle page leave / tab close (beforeunload)
  useEffect(() => {
    function endAssessment() {
      if (hasSubmittedRef.current || ending) return;

      setEnding(true);
      const body = JSON.stringify({ assessmentId });

      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(`${API_BASE}/assessments/end`, blob);
      } else {
        fetch(`${API_BASE}/assessments/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => null);
      }
    }

    window.addEventListener("beforeunload", endAssessment);
    return () => {
      window.removeEventListener("beforeunload", endAssessment);
    };
  }, [assessmentId, ending]);

  // -- SECURITY: Tab-switch auto-submit -----------------------------------
  // When the user switches tabs or minimises the window, we immediately
  // submit the current draft (even if empty) and mark ALL remaining
  // assessments in the session as ended. This prevents candidates from
  // opening reference material in another tab.
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (hasSubmittedRef.current) return;

      hasSubmittedRef.current = true;

      // Submit the CURRENT assessment with whatever the candidate has typed
      // (even if empty, so the server records the attempt). We AWAIT this POST
      // before navigating - using sendBeacon here is unreliable because the
      // submission request also runs the (slow) AI evaluation server-side, and
      // navigating away aborts it before the row is persisted.
      const currentBody = JSON.stringify({
        assessmentId,
        subject:
          subject.trim() || "(no subject - auto-submitted on tab switch)",
        content:
          content.trim() || "(no response - auto-submitted on tab switch)",
      });

      // End all OTHER remaining session assessments. These are lightweight and
      // safe to fire-and-forget via beacon.
      const idsToEnd = remainingAssessmentIds.filter(
        (id) => id !== assessmentId,
      );
      for (const id of idsToEnd) {
        const endBody = JSON.stringify({ assessmentId: id });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            `${API_BASE}/assessments/end`,
            new Blob([endBody], { type: "application/json" }),
          );
        } else {
          fetch(`${API_BASE}/assessments/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: endBody,
            keepalive: true,
          }).catch(() => null);
        }
      }

      try {
        await fetch(`${API_BASE}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: currentBody,
          keepalive: true,
        });
      } catch {
        // ignore - navigate regardless
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("candidate-assessment-session");
      }
      router.push(`${TAKE_BASE}/thank-you?reason=tab-switch`);
      router.refresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [assessmentId, subject, content, remainingAssessmentIds, router]);

  // -- SECURITY: Prevent copy-paste ----------------------------------------
  function blockPaste(event: React.ClipboardEvent) {
    event.preventDefault();
    toast.warning("Copy-pasting is not allowed during the assessment.");
  }

  async function submit() {
    if (!subject.trim()) {
      toast.error("Please enter an email subject line.");
      return;
    }

    if (content.trim().length < 50) {
      toast.error("Please write at least 50 characters before submitting.");
      return;
    }

    hasSubmittedRef.current = true;
    setSubmitting(true);

    const response = await fetch(`${API_BASE}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, subject: subject.trim(), content }),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to submit assessment.");
      hasSubmittedRef.current = false;
      return;
    }

    toast.success("Response submitted.");

    // Navigate to next scenario or results
    if (nextAssessmentId) {
      router.push(
        `${TAKE_BASE}/assessment/${nextAssessmentId}?sessionId=${sessionId}`,
      );
    } else {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("candidate-assessment-session");
      }
      router.push(`${TAKE_BASE}/thank-you`);
    }
    router.refresh();
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      {/* Timer & progress */}
      <div className="itbd-glow-border relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl bg-black/40 p-4 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10">
          <p className="text-sm text-white/50">Time remaining</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              secondsLeft <= 30 ? "text-red-400" : "text-white"
            }`}
          >
            {minutes}:{seconds}
          </p>
        </div>
        <div className="relative z-10 text-right">
          <p className="text-sm text-white/50">Word count</p>
          <p className="text-2xl font-semibold text-white">{words}</p>
        </div>
        {totalScenarios > 1 && (
          <div className="relative z-10 text-right">
            <p className="text-sm text-white/50">Progress</p>
            <p className="text-2xl font-semibold text-itbd-blue">
              {currentIndex + 1}/{totalScenarios}
            </p>
          </div>
        )}
      </div>

      {/* Security notice - orange is the brand's reserved emergency-flag
          color, which fits a security/anti-cheating warning. */}
      <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
        <strong className="text-orange-300">Security notice:</strong>{" "}
        Copy-pasting is disabled. Switching tabs or leaving this page will
        automatically submit your current response and end the remaining
        scenarios.
      </div>

      <div className="itbd-glow-border relative space-y-3 overflow-hidden rounded-2xl bg-black/40 p-4 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white/50">Subject</p>
            <h3 className="text-lg font-bold text-white">
              Email subject line
            </h3>
          </div>
          <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-2.5 py-0.5 text-xs font-semibold text-itbd-blue">
            Required
          </span>
        </div>
        <Input
          id="subject"
          placeholder="Write the email subject here..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onPaste={blockPaste}
          disabled={secondsLeft === 0 || submitting}
          maxLength={498}
          className="relative z-10 h-12 text-base"
        />
        <p className="relative z-10 text-sm text-white/50">
          Add the subject before you draft the main response body.
        </p>
      </div>

      <div className="itbd-glow-border relative space-y-3 overflow-hidden rounded-2xl bg-black/40 p-4 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/50">Email body</p>
          <h3 className="text-lg font-bold text-white">Main response</h3>
        </div>
        <Textarea
          className="relative z-10 min-h-90 resize-y text-base leading-7"
          placeholder="Write your professional email response here..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onPaste={blockPaste}
          disabled={secondsLeft === 0 || submitting}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <DefaultButton
          onClick={submit}
          disabled={secondsLeft === 0 || submitting}
          loading={submitting}
        >
          {nextAssessmentId ? "Submit & continue" : "Submit response"}
        </DefaultButton>
      </div>
    </div>
  );
}
