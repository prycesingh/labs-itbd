"use client";

import { useViewportHeightVar } from "@/hooks/useViewportHeightVar";

/** Renders nothing — just keeps `--vh100` in sync. See the hook for why. */
export function ViewportHeightFix() {
  useViewportHeightVar();
  return null;
}
