"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProcessingStatus =
  | "pending"
  | "transcribing"
  | "evaluating"
  | "summarizing"
  | "completed"
  | "failed";

type ProgressPayload = {
  transcriptedAnswers?: number;
  evaluatedAnswers?: number;
  totalAnswers?: number;
  status?: ProcessingStatus;
  currentStep?: string;
  errors?: Array<{
    answerId: string;
    step: string;
    error: string;
    attempt: number;
  }>;
};

type CompletePayload = {
  sessionId?: string;
  orchestrationJobId?: string;
  progress?: ProgressPayload;
};

type ErrorPayload = {
  sessionId?: string;
  orchestrationJobId?: string;
  errors?: Array<{
    answerId: string;
    step: string;
    error: string;
    attempt: number;
  }>;
  message?: string;
};

type InterviewSSEState = {
  connected: boolean;
  status: ProcessingStatus;
  transcriptedAnswers: number;
  evaluatedAnswers: number;
  totalAnswers: number;
  currentStep?: string;
  errors: Array<{
    answerId: string;
    step: string;
    error: string;
    attempt: number;
  }>;
  completed: boolean;
  failed: boolean;
  lastMessage?: string;
};

const initialState: InterviewSSEState = {
  connected: false,
  status: "pending",
  transcriptedAnswers: 0,
  evaluatedAnswers: 0,
  totalAnswers: 0,
  currentStep: undefined,
  errors: [],
  completed: false,
  failed: false,
  lastMessage: undefined,
};

const parseData = <T>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

// Enterprise proxies/load balancers commonly kill idle long-lived
// connections after roughly a minute, silently dropping the SSE stream
// without the client ever receiving a clean "error" event — EventSource's
// own auto-reconnect doesn't reliably recover from this in practice, and a
// candidate can be left staring at "Reviewing your answers…" long after the
// backend job has actually finished. This fallback poll is a completely
// independent safety net: a plain fetch against the same status the SSE
// route itself polls internally, run on its own interval regardless of the
// EventSource's health, so completion/failure is always eventually detected
// even if the stream connection is dead the whole time.
const FALLBACK_POLL_INTERVAL_MS = 5_000;

type PlainStatusPayload = {
  status?: ProcessingStatus;
  progress?: {
    transcriptedAnswers?: number;
    evaluatedAnswers?: number;
    totalAnswers?: number;
    currentStep?: string;
  };
  errors?: Array<{
    answerId: string;
    step: string;
    error: string;
    attempt: number;
  }>;
};

export function useInterviewSSE(sessionId: string | null, enabled = true) {
  const [state, setState] = useState<InterviewSSEState>(initialState);
  const sourceRef = useRef<EventSource | null>(null);

  const streamUrl = useMemo(() => {
    if (!sessionId) {
      return null;
    }
    return `/api/interview/process/stream?sessionId=${encodeURIComponent(sessionId)}`;
  }, [sessionId]);

  useEffect(() => {
    if (!enabled || !streamUrl) {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      return;
    }

    const source = new EventSource(streamUrl);
    sourceRef.current = source;

    source.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    const handleProgress = (event: MessageEvent) => {
      const payload = parseData<ProgressPayload>(event.data);
      if (!payload) {
        return;
      }

      setState((prev) => ({
        ...prev,
        connected: true,
        status: payload.status ?? prev.status,
        transcriptedAnswers:
          typeof payload.transcriptedAnswers === "number"
            ? payload.transcriptedAnswers
            : prev.transcriptedAnswers,
        evaluatedAnswers:
          typeof payload.evaluatedAnswers === "number"
            ? payload.evaluatedAnswers
            : prev.evaluatedAnswers,
        totalAnswers:
          typeof payload.totalAnswers === "number"
            ? payload.totalAnswers
            : prev.totalAnswers,
        currentStep: payload.currentStep ?? prev.currentStep,
        errors: payload.errors ?? prev.errors,
        lastMessage: "progress",
      }));
    };

    const handleComplete = (event: MessageEvent) => {
      const payload = parseData<CompletePayload>(event.data);

      setState((prev) => ({
        ...prev,
        connected: false,
        status: "completed",
        completed: true,
        failed: false,
        currentStep: payload?.progress?.currentStep ?? prev.currentStep,
        transcriptedAnswers:
          typeof payload?.progress?.transcriptedAnswers === "number"
            ? payload.progress.transcriptedAnswers
            : prev.transcriptedAnswers,
        evaluatedAnswers:
          typeof payload?.progress?.evaluatedAnswers === "number"
            ? payload.progress.evaluatedAnswers
            : prev.evaluatedAnswers,
        totalAnswers:
          typeof payload?.progress?.totalAnswers === "number"
            ? payload.progress.totalAnswers
            : prev.totalAnswers,
        lastMessage: "complete",
      }));

      source.close();
      sourceRef.current = null;
    };

    const handleServerError = (event: MessageEvent) => {
      const payload = parseData<ErrorPayload>(event.data);

      setState((prev) => ({
        ...prev,
        connected: false,
        status: "failed",
        completed: false,
        failed: true,
        errors: payload?.errors ?? prev.errors,
        lastMessage: payload?.message ?? "error",
      }));

      source.close();
      sourceRef.current = null;
    };

    source.addEventListener("progress", handleProgress as EventListener);
    source.addEventListener("complete", handleComplete as EventListener);
    source.addEventListener("error", handleServerError as EventListener);

    source.onerror = () => {
      setState((prev) => ({
        ...prev,
        connected: false,
        failed: prev.completed ? false : prev.failed,
        lastMessage: prev.completed ? prev.lastMessage : "connection-error",
      }));
    };

    return () => {
      source.removeEventListener("progress", handleProgress as EventListener);
      source.removeEventListener("complete", handleComplete as EventListener);
      source.removeEventListener("error", handleServerError as EventListener);
      source.close();
      sourceRef.current = null;
    };
  }, [enabled, streamUrl]);

  // Independent fallback poll — see FALLBACK_POLL_INTERVAL_MS above. Runs on
  // its own timer the whole time this hook is enabled, regardless of
  // whether the SSE connection is alive, so a silently-dead stream can never
  // strand the candidate once the backend has actually finished.
  useEffect(() => {
    if (!enabled || !sessionId) {
      return;
    }

    let cancelled = false;
    let settled = false;

    const poll = async () => {
      if (settled) {
        return;
      }
      try {
        const res = await fetch(
          `/api/interview/process?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (cancelled || !res.ok) {
          return;
        }

        const payload = (await res.json()) as PlainStatusPayload;
        if (cancelled) {
          return;
        }

        if (payload.status === "completed") {
          settled = true;
          setState((prev) =>
            prev.completed
              ? prev
              : {
                  ...prev,
                  status: "completed",
                  completed: true,
                  failed: false,
                  transcriptedAnswers:
                    payload.progress?.transcriptedAnswers ??
                    prev.transcriptedAnswers,
                  evaluatedAnswers:
                    payload.progress?.evaluatedAnswers ??
                    prev.evaluatedAnswers,
                  totalAnswers:
                    payload.progress?.totalAnswers ?? prev.totalAnswers,
                  lastMessage: "complete-fallback-poll",
                },
          );
          if (sourceRef.current) {
            sourceRef.current.close();
            sourceRef.current = null;
          }
        } else if (payload.status === "failed") {
          settled = true;
          setState((prev) =>
            prev.completed || prev.failed
              ? prev
              : {
                  ...prev,
                  status: "failed",
                  completed: false,
                  failed: true,
                  errors: payload.errors ?? prev.errors,
                  lastMessage: "error-fallback-poll",
                },
          );
          if (sourceRef.current) {
            sourceRef.current.close();
            sourceRef.current = null;
          }
        }
      } catch {
        // Transient network error on the fallback poll itself — the next
        // interval tick will simply try again.
      }
    };

    const interval = window.setInterval(() => {
      if (settled) {
        window.clearInterval(interval);
        return;
      }
      void poll();
    }, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, sessionId]);

  if (!enabled || !streamUrl) {
    return initialState;
  }

  return state;
}
