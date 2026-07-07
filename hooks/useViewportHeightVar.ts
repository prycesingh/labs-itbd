"use client";

import { useLayoutEffect } from "react";

/**
 * Keeps a `--vh100` CSS custom property in sync with the actual viewport
 * height in pixels.
 *
 * Chromium can fail to recompute `100dvh` when a window is dragged between
 * two displays with different DPI/scale factors — the layout stays pinned to
 * the old viewport size until something else forces a reflow (e.g. a manual
 * resize or reload). `resize` and `visualViewport.resize` fire reliably in
 * that scenario even when the `dvh` unit doesn't repaint, so recomputing the
 * var on those events is a robust fallback for any element sized with it.
 */
export function useViewportHeightVar() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const set = () => {
      root.style.setProperty("--vh100", `${window.innerHeight}px`);
    };
    set();

    window.addEventListener("resize", set);
    window.visualViewport?.addEventListener("resize", set);
    return () => {
      window.removeEventListener("resize", set);
      window.visualViewport?.removeEventListener("resize", set);
    };
  }, []);
}
