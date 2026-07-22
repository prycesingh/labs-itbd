import type { AdoRunStage, AdoRunStageStatus } from "./types";

// ===== Pipeline run state-machine engine =====
//
// This module is the "real engine" for Azure DevOps pipeline runs: it turns a YAML
// pipeline definition into a stage list, seeds a run's per-stage state, and advances
// that state one stage at a time using a deterministic (seeded, non-Math.random())
// outcome — so the same run, replayed with the same call count, always produces the
// same sequence of stage outcomes.
//
// ---- Call pattern the UI must use ----
// 1. When a user starts a run, call `createStageRuns(parseStagesFromYaml(pipeline.yaml))`
//    once to get the initial `stageRuns` array (stage 0 already "Running").
// 2. While `run.status === "Running"`, the page should run a real wall-clock timer
//    (e.g. `setInterval(() => dispatch({ type: "ADVANCE_PIPELINE_RUN", runId }), 2500)`,
//    somewhere in the 2-4 second range) so the run visually progresses stage-by-stage.
//    Each tick calls `advanceStageRuns` exactly once via the reducer.
// 3. Stop the timer once the reducer reports the run's `status` is no longer
//    "Running" (i.e. "Succeeded", "Failed", or "Canceled") — advancing a terminal run
//    is a no-op (see below) but the UI should still clear its interval to avoid
//    dispatching forever.

/**
 * Ported faithfully from ado-pipelines.js `parseStagesFromYaml(yaml)`.
 * Extracts explicit `- stage: X` declarations (underscores become spaces for display,
 * e.g. `Deploy_Dev` -> `Deploy Dev`). If no explicit stages are found, falls back to
 * keyword-sniffing the YAML body for `test` / `publish|artifact` / `deploy` and always
 * includes at least a `Build` stage.
 */
export function parseStagesFromYaml(yaml: string): string[] {
  let stages: string[] = [];
  const lines = (yaml || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s*stage:\s*([A-Za-z0-9_.-]+)/);
    if (m) stages.push(m[1].replace(/_/g, " "));
  }
  if (!stages.length) {
    // No multi-stage YAML — derive a single Build stage.
    stages = ["Build"];
    if (/test/i.test(yaml)) stages.push("Test");
    if (/publish|artifact/i.test(yaml)) stages.push("Package");
    if (/deploy|webapp|azureapp|kubernetes/i.test(yaml)) stages.push("Deploy");
  }
  return stages;
}

/**
 * Initializes a fresh `AdoRunStage[]` for a newly-started pipeline run: every stage
 * starts "Pending" with null timestamps/duration, except the first stage which starts
 * "Running" with `startedAt` stamped to now.
 */
export function createStageRuns(stageNames: string[]): AdoRunStage[] {
  const names = stageNames.length ? stageNames : ["Build"];
  const now = new Date().toISOString();
  return names.map((name, i) => ({
    name,
    status: (i === 0 ? "Running" : "Pending") as AdoRunStageStatus,
    startedAt: i === 0 ? now : null,
    finishedAt: null,
    durationSec: null,
  }));
}

// Deterministic seeded PRNG (Lehmer/Park-Miller LCG) — same LCG family used across
// every ported simulator's seed data in this app, reused here so stage-outcome rolls
// stay reproducible per (run, call-count) pair without touching Math.random(). Runs
// several warm-up iterations before reading a value: a single LCG step on small,
// consecutive integer seeds (as ADVANCE_PIPELINE_RUN produces) stays clustered near 0
// because `seed * 16807` hasn't wrapped the modulus yet, so a handful of extra rounds
// are needed to properly scramble the low seed space.
function seededFraction(seed: number): number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = 0; i < 5; i++) {
    s = (s * 16807) % 2147483647;
  }
  return (s - 1) / 2147483646;
}

// Believable stage duration in seconds — deterministic per seed, in the 20-90s range.
function seededDurationSec(seed: number): number {
  const frac = seededFraction(seed * 31 + 7);
  return 20 + Math.floor(frac * 70); // 20-89 inclusive
}

export type AdvanceStageRunsResult = {
  stageRuns: AdoRunStage[];
  runStatus: "Running" | "Succeeded" | "Failed";
};

/**
 * THE CORE STATE-MACHINE STEP. Finds the current "Running" stage and resolves it:
 *  - ~15% of the time (deterministic on `seed`) the stage "Fails": all remaining
 *    ("Pending") stages become "Skipped" and the overall run status becomes "Failed".
 *  - Otherwise the stage "Succeeds": if there is a next stage, it becomes "Running"
 *    with a fresh `startedAt` and the run stays "Running"; if there is no next stage,
 *    the run becomes "Succeeded".
 *
 * If no stage is currently "Running" (run already reached a terminal state, or was
 * never started), this is a no-op that returns the input unchanged with the run
 * status inferred from the stages as they stand.
 *
 * Call this once per timer tick from the UI (see module-level doc comment above) —
 * it does not schedule anything itself, it just performs a single state transition.
 */
export function advanceStageRuns(stageRuns: AdoRunStage[], seed: number): AdvanceStageRunsResult {
  const runningIdx = stageRuns.findIndex((s) => s.status === "Running");

  if (runningIdx === -1) {
    // Nothing running: report the terminal status implied by current stage state.
    const anyFailed = stageRuns.some((s) => s.status === "Failed");
    const allSucceeded = stageRuns.every((s) => s.status === "Succeeded");
    return {
      stageRuns,
      runStatus: anyFailed ? "Failed" : allSucceeded ? "Succeeded" : "Running",
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const current = stageRuns[runningIdx];
  const startedAtMs = current.startedAt ? new Date(current.startedAt).getTime() : now.getTime();
  const durationSec = Math.max(1, Math.round((now.getTime() - startedAtMs) / 1000)) || seededDurationSec(seed);

  // ~15% deterministic failure chance based on the seed.
  const roll = seededFraction(seed);
  const failed = roll < 0.15;

  const nextStageRuns = stageRuns.map((s, i): AdoRunStage => {
    if (i === runningIdx) {
      return {
        ...s,
        status: failed ? "Failed" : "Succeeded",
        finishedAt: nowIso,
        durationSec: current.durationSec ?? seededDurationSec(seed + i),
      };
    }
    return s;
  });

  if (failed) {
    // All remaining (still-Pending) stages become Skipped; run is Failed.
    const finalStageRuns = nextStageRuns.map((s, i) => (i > runningIdx && s.status === "Pending" ? { ...s, status: "Skipped" as AdoRunStageStatus } : s));
    return { stageRuns: finalStageRuns, runStatus: "Failed" };
  }

  const nextIdx = runningIdx + 1;
  if (nextIdx < nextStageRuns.length) {
    const finalStageRuns = nextStageRuns.map((s, i) => (i === nextIdx ? { ...s, status: "Running" as AdoRunStageStatus, startedAt: nowIso } : s));
    return { stageRuns: finalStageRuns, runStatus: "Running" };
  }

  // No next stage — the run has succeeded end-to-end.
  return { stageRuns: nextStageRuns, runStatus: "Succeeded" };
}

/**
 * Sums `durationSec` across finished stages and formats as "Xm Ys" for display.
 * Real derived data (not a hardcoded string) — matches the "Xm Ys" shape already used
 * throughout the seeded run data (e.g. "6m 40s").
 */
export function computeRunDuration(stageRuns: AdoRunStage[]): string {
  const totalSec = stageRuns.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}m ${seconds}s`;
}
