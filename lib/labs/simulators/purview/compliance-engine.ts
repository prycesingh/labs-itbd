import type { PurviewAssessment, PurviewComplianceScore, PurviewImprovementAction } from "./types";

/**
 * Computes a REAL compliance score by summing control/action points, replacing
 * source's (purview-compliance-mgr.js) static hardcoded 67%/72% score.
 *
 * achievedPoints = sum of every control's `points` across ALL assessments where
 * `control.status === "Implemented"`, PLUS every action's `points` where
 * `action.status === "Completed"`.
 *
 * possiblePoints = sum of ALL controls' points (any status) + ALL actions' points
 * (any status) — i.e. the maximum achievable if everything were Implemented/
 * Completed.
 *
 * percentage = Math.round((achievedPoints / possiblePoints) * 100), or 0 when there
 * are no points possible (guards against a NaN/division-by-zero on an empty seed).
 *
 * The UI is expected to call this live (e.g. from a selector/hook) rather than read
 * a stored score field — PurviewState intentionally has no such field beyond the
 * legacy display-only `tenant.complianceScore` reference value.
 */
export function computeComplianceScore(assessments: PurviewAssessment[], actions: PurviewImprovementAction[]): PurviewComplianceScore {
  let achievedPoints = 0;
  let possiblePoints = 0;

  for (const assessment of assessments) {
    for (const control of assessment.controls) {
      possiblePoints += control.points;
      if (control.status === "Implemented") achievedPoints += control.points;
    }
  }

  for (const action of actions) {
    possiblePoints += action.points;
    if (action.status === "Completed") achievedPoints += action.points;
  }

  const percentage = possiblePoints > 0 ? Math.round((achievedPoints / possiblePoints) * 100) : 0;

  return { achievedPoints, possiblePoints, percentage };
}
