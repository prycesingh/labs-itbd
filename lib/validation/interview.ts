/**
 * Interview Module Zod Validation Schemas
 *
 * Used for:
 * - Request body validation
 * - Response type safety
 * - Form validation (client-side + server-side)
 */

import {
  MAX_AUDIO_DURATION_MS,
  MAX_AUDIO_SIZE_BYTES,
  MIN_AUDIO_DURATION_MS,
  SUPPORTED_AUDIO_TYPES,
} from "@/types/interview";
import { z } from "zod";

const SUPPORTED_AUDIO_TYPE_SET = new Set<string>(SUPPORTED_AUDIO_TYPES);

// ─────────────────────────────────────────────
// SESSION SCHEMAS
// ─────────────────────────────────────────────

export const createSessionSchema = z.object({
  candidateId: z.string().trim().min(1, "Candidate ID is required"),
  moduleId: z.string().min(1, "Module ID is required"),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionStatusSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  status: z.enum([
    "draft",
    "recording",
    "recorded",
    "processing",
    "completed",
    "failed",
  ]),
});

export type UpdateSessionStatusInput = z.infer<
  typeof updateSessionStatusSchema
>;

export const sessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  totalQuestions: z.number().int().positive(),
  recordedCount: z.number().int().nonnegative(),
  processedCount: z.number().int().nonnegative(),
  status: z.enum([
    "draft",
    "recording",
    "recorded",
    "processing",
    "completed",
    "failed",
  ]),
  questions: z.array(
    z.object({
      id: z.string(),
      index: z.number().int().nonnegative(),
      text: z.string().optional(),
      audioUrl: z.string().url().optional(),
    }),
  ),
});

export type SessionResponseType = z.infer<typeof sessionResponseSchema>;

// ─────────────────────────────────────────────
// AUDIO UPLOAD SCHEMAS
// ─────────────────────────────────────────────

export const uploadAudioSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  questionId: z.string().uuid("Invalid question ID"),
  questionIndex: z.number().int().min(0, "Question index must be >= 0"),
  audioDuration: z
    .number()
    .int()
    .min(
      MIN_AUDIO_DURATION_MS,
      `Audio must be at least ${MIN_AUDIO_DURATION_MS}ms`,
    )
    .max(
      MAX_AUDIO_DURATION_MS,
      `Audio must be at most ${MAX_AUDIO_DURATION_MS}ms`,
    ),
  audioMimeType: z.enum([...SUPPORTED_AUDIO_TYPES] as const, {
    message: `Unsupported audio format. Supported: ${SUPPORTED_AUDIO_TYPES.join(", ")}`,
  }),
});

export type UploadAudioInput = z.infer<typeof uploadAudioSchema>;

export const audioUploadResponseSchema = z.object({
  answerId: z.string().uuid(),
  storagePath: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  durationMs: z.number().int().positive(),
});

export type AudioUploadResponseType = z.infer<typeof audioUploadResponseSchema>;

// ─────────────────────────────────────────────
// TRANSCRIPT SCHEMAS
// ─────────────────────────────────────────────

export const transcriptSchema = z.object({
  sessionId: z.string().uuid(),
  answerId: z.string().uuid(),
  text: z
    .string()
    .min(1, "Transcript cannot be empty")
    .max(10000, "Transcript too long"),
  language: z.string().trim().min(2).max(16),
  confidence: z.number().min(0).max(1).optional(),
  provider: z.string().default("openai"),
});

export type TranscriptInput = z.infer<typeof transcriptSchema>;

// ─────────────────────────────────────────────
// EVALUATION SCHEMAS
// ─────────────────────────────────────────────

export const evaluationDimensionSchema = z.object({
  score: z.number().int().min(0).max(10),
  reason: z.string().min(1, "Reason required"),
});

export const evaluationDimensionsSchema = z.object({
  courtesy: evaluationDimensionSchema,
  empathy: evaluationDimensionSchema,
  professionalism_and_tone: evaluationDimensionSchema,
  communication_clarity: evaluationDimensionSchema,
  engagement_and_problem_handling: evaluationDimensionSchema,
});

export const aiEvaluationSchema = z.object({
  answerId: z.string().uuid(),
  total_score: z.number().min(0).max(1),
  dimensions: evaluationDimensionsSchema,
  strengths: z
    .string()
    .array()
    .min(1, "At least one strength required")
    .max(5, "Maximum 5 strengths"),
  improvement_areas: z
    .string()
    .array()
    .min(1, "At least one improvement area required")
    .max(5, "Maximum 5 improvement areas"),
  final_summary: z
    .string()
    .min(10, "Summary too short")
    .max(500, "Summary too long"),
  tokens_used: z.object({
    prompt: z.number().int().nonnegative(),
    completion: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});

export type AIEvaluationInput = z.infer<typeof aiEvaluationSchema>;

export const dimensionOverrideSchema = z.object({
  score: z.number().int().min(0).max(10).optional(),
  reason: z.string().optional(),
});

export const adminEvaluationSchema = z.object({
  answerId: z.string().uuid(),
  totalScoreOverride: z.number().min(0).max(100).optional(),
  dimensionOverrides: z
    .object({
      courtesy: dimensionOverrideSchema.optional(),
      empathy: dimensionOverrideSchema.optional(),
      professionalism_and_tone: dimensionOverrideSchema.optional(),
      communication_clarity: dimensionOverrideSchema.optional(),
      engagement_and_problem_handling: dimensionOverrideSchema.optional(),
    })
    .optional(),
  adminNotes: z.string().max(2000, "Notes too long").optional(),
});

export type AdminEvaluationInput = z.infer<typeof adminEvaluationSchema>;

export const adminEvaluationBatchSchema = z.object({
  sessionId: z.string().uuid(),
  updates: z.array(adminEvaluationSchema),
});

export type AdminEvaluationBatchInput = z.infer<
  typeof adminEvaluationBatchSchema
>;

// ─────────────────────────────────────────────
// PROCESSING SCHEMAS
// ─────────────────────────────────────────────

export const triggerProcessingSchema = z.object({
  sessionId: z.string().uuid(),
});

export type TriggerProcessingInput = z.infer<typeof triggerProcessingSchema>;

export const processingTriggerResponseSchema = z.object({
  orchestrationJobId: z.string(),
  correlationId: z.string(),
});

export type ProcessingTriggerResponseType = z.infer<
  typeof processingTriggerResponseSchema
>;

export const processingProgressSchema = z.object({
  transcriptedAnswers: z.number().int().nonnegative(),
  evaluatedAnswers: z.number().int().nonnegative(),
  totalAnswers: z.number().int().positive(),
  status: z.enum([
    "pending",
    "transcribing",
    "evaluating",
    "summarizing",
    "completed",
    "failed",
  ]),
  currentStep: z.string().optional(),
  estimatedTimeRemaining: z.number().int().nonnegative().optional(),
});

export type ProcessingProgressType = z.infer<typeof processingProgressSchema>;

export const sessionProcessingStatusSchema = z.object({
  orchestrationJobId: z.string(),
  status: z.enum([
    "pending",
    "transcribing",
    "evaluating",
    "summarizing",
    "completed",
    "failed",
  ]),
  progress: processingProgressSchema,
  errors: z.array(
    z.object({
      answerId: z.string().uuid(),
      step: z.enum(["upload", "transcription", "evaluation"]),
      error: z.string(),
      attempt: z.number().int().positive(),
    }),
  ),
});

export type SessionProcessingStatusType = z.infer<
  typeof sessionProcessingStatusSchema
>;

// ─────────────────────────────────────────────
// ERROR SCHEMAS
// ─────────────────────────────────────────────

export const apiErrorResponseSchema = z.object({
  message: z.string(),
  error: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

export type ApiErrorResponseType = z.infer<typeof apiErrorResponseSchema>;

// ─────────────────────────────────────────────
// SUMMARY SCHEMAS
// ─────────────────────────────────────────────

export const sessionSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  candidateId: z.string(),
  moduleId: z.string(),
  overallAiScore: z.number().min(0).max(100).optional(),
  overallAdminScore: z.number().min(0).max(100).optional(),
  aiStrengths: z.string().array(),
  aiImprovementAreas: z.string().array(),
  adminNotes: z.string().optional(),
  generatedAt: z.string().datetime(),
});

export type SessionSummaryResponseType = z.infer<
  typeof sessionSummaryResponseSchema
>;

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Parse and validate form data from multipart request
 */
export function parseFormDataValidation(
  schema: z.ZodSchema,
  data: unknown,
): { success: boolean; data?: unknown; errors?: Record<string, string> } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten().fieldErrors;
      const errorMap: Record<string, string> = {};
      Object.entries(errors).forEach(([key, messages]) => {
        errorMap[key] =
          Array.isArray(messages) && messages.length > 0
            ? messages.join(", ")
            : "Invalid value";
      });
      return { success: false, errors: errorMap };
    }
    return { success: false, errors: { _: "Validation failed" } };
  }
}

/**
 * Validate audio file metadata before upload
 */
export function validateAudioMetadata(
  size: number,
  duration: number,
  mimeType: string,
): { valid: boolean; error?: string } {
  if (!SUPPORTED_AUDIO_TYPE_SET.has(mimeType)) {
    return {
      valid: false,
      error: `Unsupported format: ${mimeType}`,
    };
  }

  if (size > MAX_AUDIO_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${(size / 1024 / 1024).toFixed(2)}MB (max ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB)`,
    };
  }

  if (duration < MIN_AUDIO_DURATION_MS) {
    return {
      valid: false,
      error: `Audio too short: ${duration}ms (min ${MIN_AUDIO_DURATION_MS}ms)`,
    };
  }

  if (duration > MAX_AUDIO_DURATION_MS) {
    return {
      valid: false,
      error: `Audio too long: ${(duration / 1000).toFixed(1)}s (max ${MAX_AUDIO_DURATION_MS / 1000}s)`,
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────
// QUESTION BANK SCHEMAS (v2)
// ─────────────────────────────────────────────

export const createBankQuestionSchema = z.object({
  promptText: z.string().min(1, "Question text is required").max(2000),
  promptAudioPath: z.string().optional(),
});

export type CreateBankQuestionInput = z.infer<typeof createBankQuestionSchema>;

export const updateBankQuestionSchema = z.object({
  promptText: z.string().min(1).max(2000).optional(),
  promptAudioPath: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateBankQuestionInput = z.infer<typeof updateBankQuestionSchema>;

export const assignQuestionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  questionOrder: z.number().int().min(0).optional(),
});

export type AssignQuestionInput = z.infer<typeof assignQuestionSchema>;

export const updateStandardResponseSchema = z.object({
  responseText: z.string().min(1, "Response text is required").max(2000),
  responseOrder: z.number().int().min(0).optional(),
});

export type UpdateStandardResponseInput = z.infer<
  typeof updateStandardResponseSchema
>;

// ─────────────────────────────────────────────
// PRACTICE ATTEMPT OVERRIDE SCHEMAS
// ─────────────────────────────────────────────

export const createPracticeOverrideSchema = z.object({
  userId: z.string().trim().min(1, "User is required"),
  moduleId: z.string().uuid("Invalid module ID"),
  dailyLimit: z.coerce.number().int().min(1).max(365),
});

export type CreatePracticeOverrideInput = z.infer<
  typeof createPracticeOverrideSchema
>;
