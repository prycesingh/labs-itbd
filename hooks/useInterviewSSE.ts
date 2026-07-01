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

  if (!enabled || !streamUrl) {
    return initialState;
  }

  return state;
}
