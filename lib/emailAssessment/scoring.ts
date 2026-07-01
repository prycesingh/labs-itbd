import { gradeFromScore } from "@/lib/emailAssessment/rubric";

export type ScenarioDifficulty = "beginner" | "intermediate" | "advanced";

export const SESSION_TIME_MINUTES = 30;

export const SESSION_SCENARIO_DISTRIBUTION = {
  beginner: 2,
  intermediate: 2,
  advanced: 1,
} as const satisfies Record<ScenarioDifficulty, number>;

export const SCENARIO_MAX_SCORES = {
  beginner: 1.5,
  intermediate: 2,
  advanced: 3,
} as const satisfies Record<ScenarioDifficulty, number>;

export const SESSION_MAX_SCORE = 10;

export function scenarioMaxScore(difficulty: ScenarioDifficulty) {
  return SCENARIO_MAX_SCORES[difficulty];
}

export function weightedScoreFromPercent(
  score: number | null | undefined,
  difficulty: ScenarioDifficulty
) {
  if (score == null) {
    return null;
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const weighted = (boundedScore / 100) * scenarioMaxScore(difficulty);
  return Math.round(weighted * 100) / 100;
}

export function sessionPercentFromScore(weightedScore: number) {
  return Math.round((weightedScore / SESSION_MAX_SCORE) * 100);
}

export function sessionGradeFromScore(weightedScore: number) {
  return gradeFromScore(sessionPercentFromScore(weightedScore));
}
