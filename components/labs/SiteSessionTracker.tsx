"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 45_000;
// Randomize both the first heartbeat and the recurring interval so that a
// cohort of users who all land on the dashboard within the same few seconds
// (e.g. a scheduled training session) don't end up phase-locked, sending
// synchronized bursts of DB writes every 45s indefinitely. +/-20% spread.
const JITTER_RATIO = 0.2;

function withJitter(baseMs: number): number {
  const jitter = baseMs * JITTER_RATIO;
  return baseMs + (Math.random() * 2 - 1) * jitter;
}

/**
 * Mounted once in the dashboard layout. Sends a heartbeat immediately, then
 * every ~45s (jittered) while the tab is visible + focused, so the dashboard
 * home's "time spent" stats only accrue while the learner is actually
 * looking at the site (any dashboard page), not just while a simulator is
 * open. Hiding/blurring closes the current session outright rather than
 * pausing it — refocusing simply starts a fresh one via the same heartbeat
 * endpoint. Renders nothing.
 */
export function SiteSessionTracker() {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const isActive = () =>
      document.visibilityState === "visible" && document.hasFocus();

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
        const res = await fetch("/api/labs/site-sessions/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
        "/api/labs/site-sessions/close",
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
    window.addEventListener("blur", sendClose);
    window.addEventListener("beforeunload", sendClose);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", sendClose);
      window.removeEventListener("beforeunload", sendClose);
      sendClose();
    };
  }, []);

  return null;
}
