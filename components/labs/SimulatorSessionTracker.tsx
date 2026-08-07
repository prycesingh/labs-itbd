"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 45_000;

/**
 * Mounted once per simulator page. Sends a heartbeat immediately, then every
 * ~45s while the tab is visible + focused, so the dashboard's "time spent"
 * stats only accrue while the learner is actually looking at the simulator.
 * Hiding/blurring closes the current session outright rather than pausing it
 * — refocusing simply starts a fresh one via the same heartbeat endpoint.
 * Renders nothing.
 */
export function SimulatorSessionTracker({
  simulatorKey,
}: {
  simulatorKey: string;
}) {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const isActive = () =>
      document.visibilityState === "visible" && document.hasFocus();

    const sendHeartbeat = async () => {
      if (!isActive()) return;
      try {
        const res = await fetch("/api/labs/simulator-sessions/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulatorKey,
            sessionId: sessionIdRef.current ?? undefined,
          }),
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        sessionIdRef.current = data.sessionId ?? sessionIdRef.current;
      } catch {
        // Best-effort; a missed heartbeat just under-counts this tick.
      }
    };

    const sendClose = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const payload = JSON.stringify({ sessionId });
      navigator.sendBeacon?.(
        "/api/labs/simulator-sessions/close",
        new Blob([payload], { type: "application/json" }),
      );
      sessionIdRef.current = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendClose();
      } else if (isActive()) {
        void sendHeartbeat();
      }
    };

    void sendHeartbeat();
    intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", sendClose);
    window.addEventListener("beforeunload", sendClose);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", sendClose);
      window.removeEventListener("beforeunload", sendClose);
      sendClose();
    };
  }, [simulatorKey]);

  return null;
}
