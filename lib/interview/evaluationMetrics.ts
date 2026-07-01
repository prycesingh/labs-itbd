export const EVALUATION_DIMENSION_ORDER = [
  "courtesy",
  "empathy",
  "professionalism_and_tone",
  "communication_clarity",
  "engagement_and_problem_handling",
] as const;

export type EvaluationDimensionKey =
  (typeof EVALUATION_DIMENSION_ORDER)[number];

export type DimensionScore = {
  score?: number;
  reason?: string;
};

export type DimensionScoreMap = Partial<
  Record<EvaluationDimensionKey, DimensionScore>
>;

export const EVALUATION_DIMENSION_LABELS: Record<
  EvaluationDimensionKey,
  string
> = {
  courtesy: "Courtesy",
  empathy: "Empathy",
  professionalism_and_tone: "Professionalism & Tone",
  communication_clarity: "Communication Clarity",
  engagement_and_problem_handling: "Engagement & Problem Handling",
};

export const EVALUATION_SCORING_WEIGHTS: Record<
  EvaluationDimensionKey,
  number
> = {
  courtesy: 0.2,
  empathy: 0.2,
  professionalism_and_tone: 0.2,
  communication_clarity: 0.2,
  engagement_and_problem_handling: 0.2,
};

const LEGACY_DIMENSION_ALIASES: Record<EvaluationDimensionKey, string[]> = {
  courtesy: ["courtesy"],
  empathy: ["empathy"],
  professionalism_and_tone: ["professionalism_and_tone", "respect", "tone"],
  communication_clarity: ["communication_clarity", "communicationclarity"],
  engagement_and_problem_handling: [
    "engagement_and_problem_handling",
    "engagement",
    "problem_handling",
    "problem_handling_approach",
  ],
};

function clampDimensionScore(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function combineReasons(reasons: string[]): string | undefined {
  const uniqueReasons = Array.from(
    new Set(
      reasons.map((item) => item.trim()).filter((item) => item.length > 0),
    ),
  );

  if (uniqueReasons.length === 0) {
    return undefined;
  }

  return uniqueReasons.join(" ");
}

function normalizeDimensionEntry(value: unknown): DimensionScore | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const score = normalizeScore(record.score);
  const reason =
    typeof record.reason === "string" && record.reason.trim().length > 0
      ? record.reason.trim()
      : undefined;

  if (score === undefined && reason === undefined) {
    return undefined;
  }

  return { score, reason };
}

export function normalizeTotalScore(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (parsed >= 0 && parsed <= 1) {
    return Number(parsed.toFixed(4));
  }

  if (parsed >= 0 && parsed <= 100) {
    return Number((parsed / 100).toFixed(4));
  }

  return undefined;
}

export function totalScoreToPercentage(value: unknown): number | undefined {
  const normalized = normalizeTotalScore(value);

  if (normalized === undefined) {
    return undefined;
  }

  return Number((normalized * 100).toFixed(2));
}

export function normalizeScore(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? clampDimensionScore(value) : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? clampDimensionScore(parsed) : undefined;
  }

  return undefined;
}

export function normalizeDimensionMap(value: unknown): DimensionScoreMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value as Record<string, unknown>;
  const normalized: DimensionScoreMap = {};

  for (const key of EVALUATION_DIMENSION_ORDER) {
    const candidates = LEGACY_DIMENSION_ALIASES[key]
      .map((alias) => normalizeDimensionEntry(source[alias]))
      .filter((item): item is DimensionScore => Boolean(item));

    if (candidates.length === 0) {
      continue;
    }

    const scores = candidates
      .map((item) => item.score)
      .filter((score): score is number => typeof score === "number");
    const combinedReason = combineReasons(
      candidates
        .map((item) => item.reason)
        .filter((reason): reason is string => typeof reason === "string"),
    );

    if (scores.length > 0 || combinedReason !== undefined) {
      normalized[key] = {
        score:
          scores.length > 0
            ? Number(
                (
                  scores.reduce((sum, score) => sum + score, 0) / scores.length
                ).toFixed(2),
              )
            : undefined,
        reason: combinedReason,
      };
    }
  }

  return normalized;
}

export function mergeDimensionMaps(
  base: DimensionScoreMap,
  overrides: DimensionScoreMap,
): DimensionScoreMap {
  const merged: DimensionScoreMap = {};

  for (const key of EVALUATION_DIMENSION_ORDER) {
    const override = overrides[key];
    const baseValue = base[key];
    merged[key] = {
      score: override?.score ?? baseValue?.score,
      reason: override?.reason ?? baseValue?.reason,
    };
  }

  return merged;
}

export function calculateWeightedTotalScore(
  dimensions: DimensionScoreMap,
): number | undefined {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const key of EVALUATION_DIMENSION_ORDER) {
    const weight = EVALUATION_SCORING_WEIGHTS[key];
    if (weight <= 0) {
      continue;
    }

    const score = dimensions[key]?.score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      continue;
    }

    weightedScore += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return undefined;
  }

  return Number((weightedScore / totalWeight / 10).toFixed(4));
}

export function averageDimensionMaps(
  dimensionsList: DimensionScoreMap[],
): DimensionScoreMap {
  const aggregated: DimensionScoreMap = {};

  for (const key of EVALUATION_DIMENSION_ORDER) {
    const scores = dimensionsList
      .map((item) => item[key]?.score)
      .filter((score): score is number => typeof score === "number");

    if (scores.length === 0) {
      continue;
    }

    aggregated[key] = {
      score: Number(
        (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(
          2,
        ),
      ),
    };
  }

  return aggregated;
}

export function averageTotalScores(
  scores: Array<number | undefined>,
): number | undefined {
  const validScores = scores
    .map((score) => normalizeTotalScore(score))
    .filter((score): score is number => typeof score === "number");

  if (validScores.length === 0) {
    return undefined;
  }

  return Number(
    (
      validScores.reduce((sum, score) => sum + score, 0) / validScores.length
    ).toFixed(4),
  );
}
