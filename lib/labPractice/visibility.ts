/**
 * Lab visibility (pacing) — PURE, like progression.ts, so the trainee page,
 * trainer views, roster summaries and every write guard agree on which labs a
 * trainee can see.
 *
 *   base — depends on the enrollment's batch:
 *     schedule batch → exactly the labs in the batch's ACTIVE days (can be
 *                      none: a Day-1 bootcamp trainee sees nothing of M4 yet)
 *     module batch   → the batch's selected labs; if none, the first lab
 *     no batch       → only the FIRST active lab of the module
 *   overrides — per-enrollment Show (true) / Hide (false), applied on top —
 *               an individual override always beats the batch / day.
 *
 * Only ACTIVE labs can be visible; rows pointing at inactive labs are ignored
 * (never deleted), so re-activating a lab restores the trainer's choice.
 */

export type VisibilitySource = "default" | "batch" | "day" | "override";

export type VisibilityBase =
  | { kind: "default" }
  | { kind: "batch"; labIds: Iterable<number> }
  | { kind: "days"; labIds: Iterable<number> };

export type LabVisibility = {
  labId: number;
  visible: boolean;
  /** What decided `visible`. */
  source: VisibilitySource;
  /** What the lab would be without its override (for "reset"). */
  baseVisible: boolean;
};

type LabLike = { id: number; sequenceNo: number; isActive: boolean };

export function resolveVisibility(
  labs: LabLike[],
  base: VisibilityBase,
  overrides: Map<number, boolean>,
): LabVisibility[] {
  const active = labs.filter((l) => l.isActive).sort((a, b) => a.sequenceNo - b.sequenceNo);
  const set = base.kind === "default" ? null : new Set(base.labIds);

  let baseSource: VisibilitySource;
  let baseOf: (labId: number, index: number) => boolean;
  if (base.kind === "days") {
    baseSource = "day";
    baseOf = (id) => set!.has(id);
  } else if (base.kind === "batch" && active.some((l) => set!.has(l.id))) {
    baseSource = "batch";
    baseOf = (id) => set!.has(id);
  } else {
    baseSource = "default";
    baseOf = (_id, i) => i === 0;
  }

  return active.map((lab, i) => {
    const baseVisible = baseOf(lab.id, i);
    const override = overrides.get(lab.id);
    if (override !== undefined) {
      return { labId: lab.id, visible: override, source: "override", baseVisible };
    }
    return { labId: lab.id, visible: baseVisible, source: baseSource, baseVisible };
  });
}

/** Ids of the labs the trainee can see. */
export function visibleLabIdSet(
  labs: LabLike[],
  base: VisibilityBase,
  overrides: Map<number, boolean>,
): Set<number> {
  return new Set(
    resolveVisibility(labs, base, overrides)
      .filter((v) => v.visible)
      .map((v) => v.labId),
  );
}

/** The tree with hidden labs removed (keeps every other field intact). */
export function filterVisibleLabs<T extends { id: number }>(labs: T[], visible: Set<number>): T[] {
  return labs.filter((l) => visible.has(l.id));
}
