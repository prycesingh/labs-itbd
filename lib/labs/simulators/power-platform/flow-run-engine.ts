import type { PpConnector, PpFlow, PpRunStep, PpRunStepStatus } from "./types";

// ===== Flow run state-machine engine =====
//
// This module is the "real engine" for Power Automate flow runs — the counterpart to
// azure-devops/pipeline-engine.ts's `createStageRuns`/`advanceStageRuns`. It derives a
// believable step sequence from a flow's trigger + connector list, then advances that
// sequence one step at a time using a deterministic (seeded, non-Math.random())
// outcome — so the same run, replayed with the same call count, always produces the
// same sequence of step outcomes.
//
// ---- Call pattern the UI must use ----
// 1. On "Run now", dispatch `{ type: "START_FLOW_RUN", flowId }`. The reducer calls
//    `deriveRunSteps(flow, connectors)` internally to seed the new run's `steps` (step 0
//    already "Running") and pushes a new `PpFlowRun` with `status: "Running"`.
// 2. While `run.status === "Running"`, the page should run a real wall-clock timer
//    (e.g. `setInterval(() => dispatch({ type: "ADVANCE_FLOW_RUN", runId }), 2500)`,
//    somewhere in the 2-3 second range) so the run visually progresses step-by-step.
//    Each tick calls `advanceFlowRun` exactly once via the reducer.
// 3. Stop the timer once the reducer reports the run's `status` is no longer
//    "Running" (i.e. "Succeeded", "Failed", or "Cancelled") — advancing a terminal run
//    is a no-op but the UI should still clear its interval to avoid dispatching forever.

/**
 * Resolves a connector's display name from the catalog, falling back to the raw id
 * if the connector isn't found (mirrors source's `connectorName()` fallback in
 * pp-data.js — never throws on an unknown id).
 */
function resolveConnectorName(connectorId: string, connectors: PpConnector[]): string {
  const found = connectors.find((c) => c.id === connectorId);
  return found ? found.name : connectorId;
}

/**
 * Synthesizes a representative action name per connector id — ported from pp-flows.js
 * `actionForConnector(cid)`'s hardcoded map, falling back to a generic "<name> - action"
 * label for connectors outside that map (source's `'Run action on ' + cid` fallback).
 */
const ACTION_NAME_MAP: Record<string, string> = {
  sharepointonline: "Update SharePoint item",
  office365outlook: "Send an email (V2)",
  office365users: "Get user profile (V2)",
  teams: "Post message in chat or channel",
  approvals: "Start and wait for an approval",
  sqlserver: "Execute a SQL query",
  dataverse: "Add a new row",
  planner: "Create a task",
  forms: "Get response details",
  docusign: "Send envelope",
  servicenow: "Create a record",
  powerbi: "Refresh a dataset",
  bingmaps: "Get a route",
  onedriveforbusiness: "Create file",
  dynamics365sales: "Update opportunity",
};

function actionStepName(connectorId: string, connectors: PpConnector[]): string {
  const friendlyName = resolveConnectorName(connectorId, connectors);
  const action = ACTION_NAME_MAP[connectorId];
  return action ? `${friendlyName} - ${action}` : `${friendlyName} - action`;
}

/**
 * Builds a believable step sequence for a flow's run: a trigger step (derived from
 * `flow.trigger`, `connectorId: null` since triggers aren't themselves connector
 * actions), followed by one action step per entry in `flow.connectors` (friendly name
 * resolved via the connector catalog). All steps start "Pending" with null
 * timestamps/duration, except the first (trigger) step, which starts "Running" with
 * `startedAt` stamped to now — mirroring azure-devops's `createStageRuns` convention.
 */
export function deriveRunSteps(flow: PpFlow, connectors: PpConnector[]): PpRunStep[] {
  const now = new Date().toISOString();

  const triggerStep: PpRunStep = {
    name: flow.trigger || "Manual trigger",
    connectorId: null,
    status: "Running",
    startedAt: now,
    finishedAt: null,
    durationSec: null,
  };

  const actionSteps: PpRunStep[] = flow.connectors.map((connectorId) => ({
    name: actionStepName(connectorId, connectors),
    connectorId,
    status: "Pending" as PpRunStepStatus,
    startedAt: null,
    finishedAt: null,
    durationSec: null,
  }));

  return [triggerStep, ...actionSteps];
}

// Deterministic seeded PRNG (Lehmer/Park-Miller LCG) — same LCG family used across
// every ported simulator's seed data and engines in this app, reused here so step
// outcome rolls stay reproducible per (run, call-count) pair without touching
// Math.random(). Runs several warm-up iterations before reading a value: a single LCG
// step on small, consecutive integer seeds (as ADVANCE_FLOW_RUN produces) stays
// clustered near 0 because `seed * 16807` hasn't wrapped the modulus yet, so a handful
// of extra rounds are needed to properly scramble the low seed space.
function seededFraction(seed: number): number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = 0; i < 5; i++) {
    s = (s * 16807) % 2147483647;
  }
  return (s - 1) / 2147483646;
}

// Believable step duration in seconds — deterministic per seed, in the 2-90s range
// (matches source generateRuns's `2 + Math.floor(((seedBase * i + 31) % 90))` shape).
function seededDurationSec(seed: number): number {
  const frac = seededFraction(seed * 31 + 7);
  return 2 + Math.floor(frac * 88); // 2-89 inclusive
}

// Clamp a flow's historical fail rate into a believable 2%-40% range, defaulting to
// 5% when the flow has no run history yet (flow.total === 0).
export function clampFailRate(failed: number, total: number): number {
  if (total <= 0) return 0.05;
  const raw = failed / total;
  return Math.min(0.4, Math.max(0.02, raw));
}

export type AdvanceFlowRunResult = {
  steps: PpRunStep[];
  runStatus: "Running" | "Succeeded" | "Failed";
};

/**
 * THE CORE STATE-MACHINE STEP. Finds the current "Running" step and resolves it,
 * weighted by `failRate` (the flow's own historical fail rate, clamped to 2%-40%):
 *  - `failRate` of the time (deterministic on `seed`) the step "Fails": all remaining
 *    ("Pending") steps become "Skipped" and the overall run status becomes "Failed".
 *  - Otherwise the step "Succeeds": if there is a next step, it becomes "Running" with
 *    a fresh `startedAt` and the run stays "Running"; if there is no next step, the
 *    run becomes "Succeeded".
 *
 * If no step is currently "Running" (run already reached a terminal state, or was
 * never started), this is a no-op that returns the input unchanged with the run
 * status inferred from the steps as they stand.
 *
 * Call this once per timer tick from the UI (see module-level doc comment above) — it
 * does not schedule anything itself, it just performs a single state transition.
 */
export function advanceFlowRun(steps: PpRunStep[], failRate: number, seed: number): AdvanceFlowRunResult {
  const runningIdx = steps.findIndex((s) => s.status === "Running");

  if (runningIdx === -1) {
    const anyFailed = steps.some((s) => s.status === "Failed");
    const allSucceeded = steps.every((s) => s.status === "Succeeded");
    return {
      steps,
      runStatus: anyFailed ? "Failed" : allSucceeded ? "Succeeded" : "Running",
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const current = steps[runningIdx];
  const startedAtMs = current.startedAt ? new Date(current.startedAt).getTime() : now.getTime();
  const elapsedSec = Math.max(1, Math.round((now.getTime() - startedAtMs) / 1000));
  const durationSec = elapsedSec > 1 ? elapsedSec : seededDurationSec(seed);

  const clampedFailRate = Math.min(0.4, Math.max(0.02, failRate));
  const roll = seededFraction(seed);
  const failed = roll < clampedFailRate;

  const resolvedSteps = steps.map((s, i): PpRunStep => {
    if (i === runningIdx) {
      return {
        ...s,
        status: failed ? "Failed" : "Succeeded",
        finishedAt: nowIso,
        durationSec: current.durationSec ?? durationSec,
      };
    }
    return s;
  });

  if (failed) {
    const finalSteps = resolvedSteps.map((s, i) => (i > runningIdx && s.status === "Pending" ? { ...s, status: "Skipped" as PpRunStepStatus } : s));
    return { steps: finalSteps, runStatus: "Failed" };
  }

  const nextIdx = runningIdx + 1;
  if (nextIdx < resolvedSteps.length) {
    const finalSteps = resolvedSteps.map((s, i) => (i === nextIdx ? { ...s, status: "Running" as PpRunStepStatus, startedAt: nowIso } : s));
    return { steps: finalSteps, runStatus: "Running" };
  }

  return { steps: resolvedSteps, runStatus: "Succeeded" };
}

/**
 * Sums `durationSec` across finished steps and returns a number in seconds — the
 * caller formats it for display (e.g. as "Xm Ys" the way azure-devops's
 * `computeRunDuration` does as a string, or however the flow-runs UI prefers).
 */
export function computeRunDuration(steps: PpRunStep[]): number {
  return steps.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
}
