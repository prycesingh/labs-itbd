"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 45_000;
// Randomize both the first heartbeat and the recurring interval so that a
// cohort of users who all open the same simulator within the same few
// seconds (e.g. a scheduled training session) don't end up phase-locked,
// sending synchronized bursts of DB writes every 45s indefinitely. +/-20%.
const JITTER_RATIO = 0.2;

function withJitter(baseMs: number): number {
  const jitter = baseMs * JITTER_RATIO;
  return baseMs + (Math.random() * 2 - 1) * jitter;
}

/**
 * Mounted once per simulator page. Sends a heartbeat immediately, then every
 * ~45s (jittered) while the tab is visible, so the dashboard's "time spent"
 * stats only accrue while the learner has the simulator tab open. Hiding the
 * tab closes the current session outright rather than pausing it — becoming
 * visible again simply starts a fresh one via the same heartbeat endpoint.
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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Visibility alone (not focus) gates whether time accrues — see
    // SiteSessionTracker for why `document.hasFocus()` is deliberately
    // excluded (window blur fires for reasons that don't mean the user left
    // the simulator tab, and was closing real sessions after 10-20s).
    const isActive = () => document.visibilityState === "visible";

    const scheduleNextHeartbeat = () => {
      if (cancelled) return;
      timeoutId = setTimeout(sendHeartbeat, withJitter(HEARTBEAT_INTERVAL_MS));
    };

    const sendHeartbeat = async () => {
      if (!isActive()) {
        scheduleNextHeartbeat();
        return;
      }
      try {
        const res = await fetch("/api/labs/simulator-sessions/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulatorKey,
            sessionId: sessionIdRef.current ?? undefined,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          sessionIdRef.current = data.sessionId ?? sessionIdRef.current;
        }
      } catch {
        // Best-effort; a missed heartbeat just under-counts this tick.
      }
      scheduleNextHeartbeat();
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
        if (timeoutId) clearTimeout(timeoutId);
        sendClose();
      } else if (isActive()) {
        if (timeoutId) clearTimeout(timeoutId);
        void sendHeartbeat();
      }
    };

    // Stagger the very first heartbeat too, so a burst of users mounting the
    // tracker within the same instant doesn't itself become a synchronized
    // spike (0 to +20% of one interval, since a negative initial delay makes
    // no sense).
    timeoutId = setTimeout(
      sendHeartbeat,
      Math.random() * HEARTBEAT_INTERVAL_MS * JITTER_RATIO,
    );
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", sendClose);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", sendClose);
      sendClose();
    };
  }, [simulatorKey]);

  return null;
}
