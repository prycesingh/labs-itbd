/**
 * Module Capability Registry
 *
 * Reads/writes interview_module_capabilities — the admin-editable feature
 * registry that decides what a given interview module evaluates (grounded
 * grading, adaptive follow-ups, acoustic delivery scoring, evaluation depth)
 * at runtime, with no code change or deploy required to reconfigure a
 * module. Every capability-gated code path in lib/interview/ must go
 * through getModuleCapability() rather than checking a hardcoded per-module
 * flag, so caching and safe-by-default fallback behavior live in one place.
 *
 * Unconfigured (moduleId, capabilityKey) pairs default to disabled /
 * content-only — never to an enabled/expansive default — so a brand-new
 * module nobody has configured yet behaves like today's plain
 * transcription-only pipeline rather than silently inheriting delivery
 * scoring, grounded grading, or follow-ups.
 */

import { db } from "@/DB/drizzle";
import { interviewModuleCapabilities } from "@/DB/interviewSchema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export const CAPABILITY_KEYS = {
  DELIVERY_SCORING: "delivery_scoring",
  GROUNDED_GRADING: "grounded_grading",
  FOLLOW_UPS: "follow_ups",
  EVALUATION_DEPTH: "evaluation_depth",
  ATTEMPT_CADENCE: "attempt_cadence",
} as const;

export type CapabilityKey =
  (typeof CAPABILITY_KEYS)[keyof typeof CAPABILITY_KEYS];

export type CalibrationMode = "static" | "population-relative";
export type EvaluationDepth = "full-rubric" | "content-only" | "delivery-only";
export type AttemptCadence = "daily" | "weekly";

export interface DeliveryScoringConfig {
  calibrationMode: CalibrationMode;
}

export interface EvaluationDepthConfig {
  depth: EvaluationDepth;
}

export interface AttemptCadenceConfig {
  cadence: AttemptCadence;
}

export interface ModuleCapability {
  enabled: boolean;
  config: Record<string, unknown>;
}

const DEFAULT_CAPABILITY: ModuleCapability = { enabled: false, config: {} };

const DEFAULT_EVALUATION_DEPTH: ModuleCapability = {
  enabled: false,
  config: { depth: "content-only" satisfies EvaluationDepth },
};

// "daily" matches every module's behavior before this capability existed
// (the practice-attempt gate has always been a fixed daily window) — so an
// unconfigured module keeps today's cadence rather than silently loosening
// to weekly. Interview Coach's weekly default is seeded explicitly by the
// migration script, not inherited from this fallback.
const DEFAULT_ATTEMPT_CADENCE: ModuleCapability = {
  enabled: false,
  config: { cadence: "daily" satisfies AttemptCadence },
};

const DEFAULT_DELIVERY_SCORING_CONFIG: DeliveryScoringConfig = {
  calibrationMode: "static",
};

// Short-lived in-process cache: avoids a DB round-trip on every gating check
// within the same request/job invocation, mirroring the ~30s throttle
// pattern used for role/session sync in auth.config.ts. Cleared entries are
// re-fetched lazily; an admin's write goes through setModuleCapability(),
// which invalidates the affected entry immediately so a config change takes
// effect on the very next check.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: ModuleCapability; expiresAt: number }>();

function cacheKey(moduleId: string, capabilityKey: string): string {
  return `${moduleId}:${capabilityKey}`;
}

function defaultFor(capabilityKey: string): ModuleCapability {
  if (capabilityKey === CAPABILITY_KEYS.EVALUATION_DEPTH) {
    return {
      ...DEFAULT_EVALUATION_DEPTH,
      config: { ...DEFAULT_EVALUATION_DEPTH.config },
    };
  }
  if (capabilityKey === CAPABILITY_KEYS.ATTEMPT_CADENCE) {
    return {
      ...DEFAULT_ATTEMPT_CADENCE,
      config: { ...DEFAULT_ATTEMPT_CADENCE.config },
    };
  }
  return { ...DEFAULT_CAPABILITY, config: {} };
}

/**
 * Look up one module's setting for one capability. Always resolves — never
 * throws for a missing row, since "not configured yet" is a valid, safe
 * state (see module defaulting behavior above).
 */
export async function getModuleCapability(
  moduleId: string,
  capabilityKey: CapabilityKey,
): Promise<ModuleCapability> {
  const key = cacheKey(moduleId, capabilityKey);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const [row] = await db
    .select({
      enabled: interviewModuleCapabilities.enabled,
      config: interviewModuleCapabilities.config,
    })
    .from(interviewModuleCapabilities)
    .where(
      and(
        eq(interviewModuleCapabilities.moduleId, moduleId),
        eq(interviewModuleCapabilities.capabilityKey, capabilityKey),
      ),
    )
    .limit(1);

  const value: ModuleCapability = row
    ? { enabled: row.enabled, config: row.config ?? {} }
    : defaultFor(capabilityKey);

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Convenience: resolve the delivery_scoring capability's calibration mode. */
export async function getDeliveryCalibrationMode(
  moduleId: string,
): Promise<CalibrationMode> {
  const { config } = await getModuleCapability(
    moduleId,
    CAPABILITY_KEYS.DELIVERY_SCORING,
  );
  const mode = (config as Partial<DeliveryScoringConfig>).calibrationMode;
  return mode ?? DEFAULT_DELIVERY_SCORING_CONFIG.calibrationMode;
}

/** Convenience: resolve the evaluation_depth capability's depth setting. */
export async function getEvaluationDepth(
  moduleId: string,
): Promise<EvaluationDepth> {
  const { config } = await getModuleCapability(
    moduleId,
    CAPABILITY_KEYS.EVALUATION_DEPTH,
  );
  const depth = (config as Partial<EvaluationDepthConfig>).depth;
  return depth ?? "content-only";
}

/**
 * Convenience: resolve a module's default practice-attempt cadence
 * ("daily" | "weekly"). This is the module-level default only — a per-
 * (user, module) row in interviewPracticeAttemptOverrides, when present,
 * still takes precedence for that specific user (see sessions/route.ts).
 */
export async function getAttemptCadence(
  moduleId: string,
): Promise<AttemptCadence> {
  const { config } = await getModuleCapability(
    moduleId,
    CAPABILITY_KEYS.ATTEMPT_CADENCE,
  );
  const cadence = (config as Partial<AttemptCadenceConfig>).cadence;
  return cadence ?? "daily";
}

/**
 * Admin write path: upsert one (moduleId, capabilityKey) row. Invalidates
 * the in-process cache entry immediately so the change is visible to the
 * very next getModuleCapability() call, without waiting out the TTL.
 */
export async function setModuleCapability(
  moduleId: string,
  capabilityKey: CapabilityKey,
  value: { enabled?: boolean; config?: Record<string, unknown> },
  updatedBy: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: interviewModuleCapabilities.id })
    .from(interviewModuleCapabilities)
    .where(
      and(
        eq(interviewModuleCapabilities.moduleId, moduleId),
        eq(interviewModuleCapabilities.capabilityKey, capabilityKey),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(interviewModuleCapabilities)
      .set({
        ...(value.enabled !== undefined ? { enabled: value.enabled } : {}),
        ...(value.config !== undefined ? { config: value.config } : {}),
        updatedBy,
      })
      .where(eq(interviewModuleCapabilities.id, existing.id));
  } else {
    await db.insert(interviewModuleCapabilities).values({
      id: randomUUID(),
      moduleId,
      capabilityKey,
      enabled: value.enabled ?? false,
      config: value.config ?? {},
      updatedBy,
    });
  }

  cache.delete(cacheKey(moduleId, capabilityKey));
}
