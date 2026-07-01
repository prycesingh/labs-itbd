import { z } from "zod";

import type { CategoryScores } from "@/DB/emailAssessmentSchema";

export const categoryScoreSchema = z.object({
  professionalTone: z.number().int().min(0).max(20),
  grammarLanguage: z.number().int().min(0).max(20),
  clarityEmpathyRespect: z.number().int().min(0).max(30),
  structure: z.number().int().min(0).max(15),
  completeness: z.number().int().min(0).max(15),
});

export const evaluationJsonSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  grade: z.enum(["A", "B", "C", "D", "E"]),
  categoryScores: categoryScoreSchema,
  strengths: z.array(z.string().min(1)).max(8),
  weaknesses: z.array(z.string().min(1)).max(8),
  improvements: z.array(z.string().min(1)).max(8),
  detailedFeedback: z.string().min(1),
  verdict: z.string().min(1),
  aiDetected: z.boolean(),
});

export type EvaluationJson = z.infer<typeof evaluationJsonSchema>;

export function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "E" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "E";
}

export function categoryTotal(categoryScores: CategoryScores) {
  return Object.values(categoryScores).reduce((sum, value) => sum + value, 0);
}

export function normalizeEvaluation(evaluation: EvaluationJson): EvaluationJson {
  const computedScore = Math.max(0, Math.min(100, Math.round(categoryTotal(evaluation.categoryScores))));

  // Apply 10% penalty for AI-detected content
  const penalizedScore = evaluation.aiDetected
    ? Math.max(0, Math.round(computedScore * 0.9))
    : computedScore;

  return {
    ...evaluation,
    overallScore: penalizedScore,
    grade: gradeFromScore(penalizedScore),
  };
}

/**
 * Tokenizes text into lowercase words, stripping punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Calculates how many matching groups of 3+ consecutive words the candidate
 * text shares with the model answer, then returns the penalty amount.
 * Penalty: -0.5 marks for every group of 3 consecutive matching words.
 */
export function calculateCopyPenalty(
  candidateText: string,
  modelAnswer: string | null | undefined
): number {
  if (!modelAnswer) return 0;

  const candidateTokens = tokenize(candidateText);
  const modelSet = new Set(tokenize(modelAnswer));

  if (candidateTokens.length < 3) return 0;

  // Build a sliding window of size 3+ to detect runs of matching words
  let matchingWordCount = 0;
  let inMatchRun = false;

  for (let i = 0; i < candidateTokens.length; i++) {
    // Check if a trigram starting here is all in the model
    if (
      i + 2 < candidateTokens.length &&
      modelSet.has(candidateTokens[i]) &&
      modelSet.has(candidateTokens[i + 1]) &&
      modelSet.has(candidateTokens[i + 2])
    ) {
      if (!inMatchRun) {
        // Start of a new matching run – count this trigram
        matchingWordCount += 3;
        inMatchRun = true;
      } else {
        // Extend the current run by 1
        matchingWordCount += 1;
      }
      i += 2; // advance past the trigram
    } else {
      inMatchRun = false;
    }
  }

  // -0.5 per group of 3 matching words
  const penaltyGroups = Math.floor(matchingWordCount / 3);
  return penaltyGroups * 0.5;
}
