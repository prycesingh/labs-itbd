import type { PurviewIrmIndicator } from "./types";

export type PurviewIrmRiskLevel = "Low" | "Medium" | "High" | "Critical";

/**
 * Computes a real insider-risk score by summing the `weight` of every triggered
 * indicator, then maps the sum to a level via fixed thresholds. Weights in
 * seedData.ts range 3-10 (see buildIrmIndicators), so with up to ~6-8 triggered
 * indicators per case the realistic score range is roughly 0-60 — thresholds below
 * are picked so the 6 seeded cases (2-6 triggered indicators each) spread across
 * all four levels:
 *   0-10   Low       (1-2 low-weight indicators)
 *   11-25  Medium    (a handful of mid-weight indicators)
 *   26-45  High      (several high-weight indicators, e.g. USB copy + cloud upload)
 *   46+    Critical  (many/severe indicators, e.g. HR-flagged + repeat + external leak)
 */
export function computeIrmRiskScore(triggeredIndicatorIds: string[], indicators: PurviewIrmIndicator[]): { score: number; level: PurviewIrmRiskLevel } {
  const byId = new Map(indicators.map((i) => [i.id, i]));

  let score = 0;
  for (const id of triggeredIndicatorIds) {
    const indicator = byId.get(id);
    if (indicator) score += indicator.weight;
  }

  let level: PurviewIrmRiskLevel;
  if (score >= 46) level = "Critical";
  else if (score >= 26) level = "High";
  else if (score >= 11) level = "Medium";
  else level = "Low";

  return { score, level };
}

/**
 * Deterministic hash-based pseudonymization, ported verbatim from
 * purview-advanced.js `pseudonym(upn)` — sums character codes of the UPN and takes
 * the last 6 digits of the absolute sum. Also re-exported from seedData.ts (the
 * canonical home of the ported seed logic); kept here too since irm-engine.ts is
 * the natural import site for IRM-related consumers per the task's file layout.
 */
export function pseudonym(upn: string): string {
  const sum = upn.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `User-${Math.abs(sum).toString().slice(-6)}`;
}
