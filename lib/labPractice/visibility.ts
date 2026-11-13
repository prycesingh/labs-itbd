/**
 * Lab visibility (pacing) — PURE, like progression.ts, so the trainee page,
 * trainer views, roster summaries and every write guard agree on which labs a
 * trainee can see.
 *
 *   base      = the batch's selected labs, when the enrollment is in a batch
 *               that has at least one selected (active) lab;
 *               otherwise only the FIRST active lab of the module.
 *   overrides = per-enrollment Show (true) / Hide (false), applied on top —
 *               an individual override always beats the batch.
 *
 * Only ACTIVE labs can be visible; rows pointing at inactive labs are ignored
 * (never deleted), so re-activating a lab restores the trainer's choice.
 */

export type VisibilitySource = "default" | "batch" | "override";

export type LabVisibility = {
  labId: number;
  visible: boolean;
  /** What decided `visible`. */
  source: VisibilitySource;
  /** What the lab would be without its override (for "reset to batch"). */
  baseVisible: boolean;
};

type LabLike = { id: number; sequenceNo: number; isActive: boolean };

export function resolveVisibility(
  labs: LabLike[],
  batchLabIds: Iterable<number> | null,
  overrides: Map<number, boolean>,
): LabVisibility[] {
  const active = labs.filter((l) => l.isActive).sort((a, b) => a.sequenceNo - b.sequenceNo);
  const batchSet = batchLabIds ? new Set(batchLabIds) : null;
  const batchHasLabs = !!batchSet && active.some((l) => batchSet.has(l.id));

  return active.map((lab, i) => {
    const baseVisible = batchHasLabs ? batchSet!.has(lab.id) : i === 0;
    const override = overrides.get(lab.id);
    if (override !== undefined) {
      return { labId: lab.id, visible: override, source: "override", baseVisible };
    }
    return { labId: lab.id, visible: baseVisible, source: batchHasLabs ? "batch" : "default", baseVisible };
  });
}

/** Ids of the labs the trainee can see. */
export function visibleLabIdSet(
  labs: LabLike[],
  batchLabIds: Iterable<number> | null,
  overrides: Map<number, boolean>,
): Set<number> {
  return new Set(
    resolveVisibility(labs, batchLabIds, overrides)
      .filter((v) => v.visible)
      .map((v) => v.labId),
  );
}

/** The tree with hidden labs removed (keeps every other field intact). */
export function filterVisibleLabs<T extends { id: number }>(labs: T[], visible: Set<number>): T[] {
  return labs.filter((l) => visible.has(l.id));
}
