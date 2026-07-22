import type { PpApp, PpConnector, PpConnectorClass, PpFlow, PpPolicy, PpState } from "./types";

// ===== DLP enforcement / classification-conflict checker =====
//
// This module is the "real engine" behind Power Platform's Data Loss Prevention (DLP)
// story: given the tenant's policies, it determines which apps/flows violate at least
// one IN-SCOPE, ENABLED policy by mixing connector classifications (or touching a
// blocked connector) — the actual mechanic DLP polices in the real product.
//
// Call `applyDlpFlags(state)` any time policies (or app/flow connector lists) change;
// it returns a brand-new `PpState` with every app's/flow's `dlpFlagged`/`dlpFlagReason`
// recomputed from scratch (never trusts stale flags left over from a prior state).

/**
 * Real scope resolution — mirrors how DLP policy scope works in the actual product:
 *  - "Everyone"                  → always applies, regardless of environment.
 *  - "Specific environments"     → applies only if `envId` is in `policy.envIds`.
 *  - "All except specific"       → applies unless `envId` is in `policy.exceptionEnvs`.
 */
function policyAppliesToEnv(policy: PpPolicy, envId: string): boolean {
  switch (policy.scope) {
    case "Everyone":
      return true;
    case "Specific environments":
      return policy.envIds.includes(envId);
    case "All except specific":
      return !policy.exceptionEnvs.includes(envId);
    default:
      return false;
  }
}

/**
 * Classifies a single connector under a specific policy: checks explicit membership in
 * `policy.business` / `policy.nonBusiness` / `policy.blocked` first; if the connector
 * isn't explicitly bucketed by this policy, falls back to the connector's own `def`
 * (its catalog default classification) so every connector always resolves to *some*
 * class under any given policy.
 */
function classifyConnectorUnderPolicy(connectorId: string, policy: PpPolicy, connectors: PpConnector[]): PpConnectorClass {
  if (policy.blocked.includes(connectorId)) return "Blocked";
  if (policy.business.includes(connectorId)) return "Business";
  if (policy.nonBusiness.includes(connectorId)) return "Non-business";

  const catalogEntry = connectors.find((c) => c.id === connectorId);
  return catalogEntry ? catalogEntry.def : "Business";
}

/**
 * Evaluates one policy against one connector list. Returns a human-readable conflict
 * reason string if the policy flags this combination, or `null` if it passes.
 * Flags when the connector list either:
 *  (a) spans MORE THAN ONE of the three classes (e.g. mixes Business + Non-business), or
 *  (b) includes any connector classified `Blocked` under this policy.
 */
function evaluatePolicyAgainstConnectors(connectorIds: string[], policy: PpPolicy, connectors: PpConnector[]): string | null {
  if (connectorIds.length === 0) return null;

  const classified = connectorIds.map((id) => ({ id, cls: classifyConnectorUnderPolicy(id, policy, connectors) }));

  const blockedHit = classified.find((c) => c.cls === "Blocked");
  if (blockedHit) {
    const name = connectors.find((c) => c.id === blockedHit.id)?.name ?? blockedHit.id;
    return `Uses a Blocked connector ('${name}') under policy '${policy.name}'`;
  }

  const distinctClasses = new Set(classified.map((c) => c.cls));
  if (distinctClasses.size > 1) {
    return `Mixes Business and Non-business connectors under policy '${policy.name}'`;
  }

  return null;
}

/**
 * Runs every "On" policy in scope for `envId` against `connectorIds`, returning the
 * first conflict reason found (policies are checked in array order — first match wins,
 * same as source's implicit precedence when multiple policies could apply).
 */
function findDlpConflict(envId: string, connectorIds: string[], policies: PpPolicy[], connectors: PpConnector[]): string | null {
  for (const policy of policies) {
    if (policy.status !== "On") continue;
    if (!policyAppliesToEnv(policy, envId)) continue;
    const reason = evaluatePolicyAgainstConnectors(connectorIds, policy, connectors);
    if (reason) return reason;
  }
  return null;
}

export type DlpFlagResult = {
  flaggedApps: Map<string, string>;
  flaggedFlows: Map<string, string>;
};

/**
 * THE REAL MECHANIC. For each app/flow, walks the tenant's "On" policies that are in
 * scope for its environment and classifies its connector list under each — flagging
 * the app/flow (with a real reason string) on the first policy that finds a conflict.
 * Returns plain `Map<id, reason>` results (documented shape) rather than mutating
 * anything — callers apply the result to state themselves (see `applyDlpFlags` below).
 */
export function computeDlpFlags(apps: PpApp[], flows: PpFlow[], policies: PpPolicy[], connectors: PpConnector[]): DlpFlagResult {
  const flaggedApps = new Map<string, string>();
  const flaggedFlows = new Map<string, string>();

  for (const app of apps) {
    const reason = findDlpConflict(app.envId, app.connectors, policies, connectors);
    if (reason) flaggedApps.set(app.id, reason);
  }

  for (const flow of flows) {
    const reason = findDlpConflict(flow.envId, flow.connectors, policies, connectors);
    if (reason) flaggedFlows.set(flow.id, reason);
  }

  return { flaggedApps, flaggedFlows };
}

/**
 * Runs `computeDlpFlags` against the given state and returns a NEW `PpState` with
 * every app's/flow's `dlpFlagged`/`dlpFlagReason` fields updated to match — flags are
 * cleared (not just left stale) for anything no longer in conflict. This is what the
 * `RECOMPUTE_DLP_FLAGS` reducer case (and the automatic recompute baked into every
 * policy CRUD case) calls.
 */
export function applyDlpFlags(state: PpState): PpState {
  const { flaggedApps, flaggedFlows } = computeDlpFlags(state.apps, state.flows, state.policies, state.connectors);

  return {
    ...state,
    apps: state.apps.map((app) => {
      const reason = flaggedApps.get(app.id);
      return { ...app, dlpFlagged: Boolean(reason), dlpFlagReason: reason };
    }),
    flows: state.flows.map((flow) => {
      const reason = flaggedFlows.get(flow.id);
      return { ...flow, dlpFlagged: Boolean(reason), dlpFlagReason: reason };
    }),
  };
}
