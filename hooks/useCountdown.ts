"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseCountdownResult {
  secondsLeft: number;
  isRunning: boolean;
  /** Starts (or restarts) a countdown from `seconds`, calling onComplete once it reaches 0. */
  start: (seconds: number, onComplete?: () => void) => void;
  reset: () => void;
}

/**
 * Simple second-granularity countdown — used by the Interview Coach
 * hands-free flow to give the candidate a beat between the question being
 * read aloud and recording auto-starting (mirrors interview-coach-main's
 * 5-second countdown-then-record UX).
 */
export function useCountdown(): UseCountdownResult {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    setIsRunning(false);
    setSecondsLeft(0);
  }, [clear]);

  const start = useCallback(
    (seconds: number, onComplete?: () => void) => {
      clear();
      onCompleteRef.current = onComplete;
      setSecondsLeft(seconds);
      setIsRunning(true);

      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clear();
            setIsRunning(false);
            onCompleteRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return { secondsLeft, isRunning, start, reset };
}
