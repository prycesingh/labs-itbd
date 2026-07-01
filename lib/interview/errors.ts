/**
 * Interview Module Error Classes and Utilities
 *
 * Classifies and handles interview-specific errors with retry logic
 */

import { INTERVIEW_ERROR_CODES } from "./jobConstants";

// ─────────────────────────────────────────────
// CUSTOM ERROR CLASSES
// ─────────────────────────────────────────────

export class InterviewError extends Error {
  constructor(
    public code: string,
    public retriable: boolean = false,
    message: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "InterviewError";
  }
}

export class TranscriptionError extends InterviewError {
  constructor(
    public answerId: string,
    public attempt: number,
    message: string,
    retriable: boolean = false,
    context?: Record<string, unknown>,
  ) {
    super(INTERVIEW_ERROR_CODES.TRANSCRIPTION_API_ERROR, retriable, message, {
      answerId,
      attempt,
      ...context,
    });
    this.name = "TranscriptionError";
  }
}

export class EvaluationError extends InterviewError {
  constructor(
    public answerId: string,
    public attempt: number,
    message: string,
    retriable: boolean = false,
    context?: Record<string, unknown>,
  ) {
    super(INTERVIEW_ERROR_CODES.EVALUATION_API_ERROR, retriable, message, {
      answerId,
      attempt,
      ...context,
    });
    this.name = "EvaluationError";
  }
}

export class AudioUploadError extends InterviewError {
  constructor(
    message: string,
    code: string = INTERVIEW_ERROR_CODES.AUDIO_UPLOAD_TIMEOUT,
    retriable: boolean = true,
    context?: Record<string, unknown>,
  ) {
    super(code, retriable, message, context);
    this.name = "AudioUploadError";
  }
}

export class SessionError extends InterviewError {
  constructor(
    message: string,
    code: string = INTERVIEW_ERROR_CODES.SESSION_NOT_FOUND,
    retriable: boolean = false,
    context?: Record<string, unknown>,
  ) {
    super(code, retriable, message, context);
    this.name = "SessionError";
  }
}

export class OrchestrationError extends InterviewError {
  constructor(
    message: string,
    retriable: boolean = true,
    context?: Record<string, unknown>,
  ) {
    super(
      INTERVIEW_ERROR_CODES.ORCHESTRATION_FAILED,
      retriable,
      message,
      context,
    );
    this.name = "OrchestrationError";
  }
}

// ─────────────────────────────────────────────
// ERROR CLASSIFICATION
// ─────────────────────────────────────────────

/**
 * Classify errors for retry logic
 */
export function classifyError(error: unknown): {
  retriable: boolean;
  code: string;
  message: string;
} {
  if (error instanceof InterviewError) {
    return {
      retriable: error.retriable,
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    // OpenAI API errors
    if (error.message.includes("429")) {
      return {
        retriable: true,
        code: "RATE_LIMIT",
        message: "Rate limited by OpenAI API",
      };
    }

    if (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return {
        retriable: true,
        code: "TIMEOUT",
        message: "Request timeout",
      };
    }

    if (error.message.includes("5")) {
      return {
        retriable: true,
        code: "SERVER_ERROR",
        message: "Server error (5xx)",
      };
    }

    if (error.message.includes("ECONNREFUSED")) {
      return {
        retriable: true,
        code: "CONNECTION_ERROR",
        message: "Connection refused",
      };
    }

    // Default: assume non-retriable
    return {
      retriable: false,
      code: "UNKNOWN_ERROR",
      message: error.message,
    };
  }

  return {
    retriable: false,
    code: "UNKNOWN_ERROR",
    message: "Unknown error",
  };
}

/**
 * Determine if an error should trigger a retry
 */
export function shouldRetry(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) return false;

  const { retriable } = classifyError(error);
  return retriable;
}

/**
 * Calculate exponential backoff delay
 * Base: 250ms, then 500ms, then 1000ms
 */
export function calculateBackoffDelay(attempt: number): number {
  const baseDelay = 250; // ms
  return baseDelay * Math.pow(2, attempt);
}

// ─────────────────────────────────────────────
// OPENAI ERROR HANDLERS
// ─────────────────────────────────────────────

/**
 * Parse OpenAI API error responses
 */
export function parseOpenAIError(error: unknown): {
  code: string;
  message: string;
  retriable: boolean;
} {
  const errorObj = (
    typeof error === "object" && error !== null
      ? (error as {
          response?: {
            status?: number;
            data?: {
              error?: {
                message?: string;
              };
            };
          };
          message?: string;
          code?: string;
        })
      : {}
  ) as {
    response?: {
      status?: number;
      data?: {
        error?: {
          message?: string;
        };
      };
    };
    message?: string;
    code?: string;
  };

  const status = errorObj.response?.status;
  const message =
    errorObj.response?.data?.error?.message ||
    errorObj.message ||
    "Unknown OpenAI error";

  // Rate limit
  if (status === 429) {
    return {
      code: "RATE_LIMIT",
      message: "Rate limited. Retrying with backoff.",
      retriable: true,
    };
  }

  // Server errors
  if (status && status >= 500) {
    return {
      code: `SERVER_ERROR_${status}`,
      message: `Server error: ${message}`,
      retriable: true,
    };
  }

  // Authentication errors
  if (status === 401 || status === 403) {
    return {
      code: "AUTH_ERROR",
      message: "Authentication failed",
      retriable: false,
    };
  }

  // Bad request
  if (status === 400) {
    return {
      code: "BAD_REQUEST",
      message: message,
      retriable: false,
    };
  }

  // Timeout
  if (errorObj.code === "ETIMEDOUT" || message.includes("timeout")) {
    return {
      code: "TIMEOUT",
      message: "Request timeout",
      retriable: true,
    };
  }

  // Unknown error
  return {
    code: "UNKNOWN_ERROR",
    message: message,
    retriable: false,
  };
}

// ─────────────────────────────────────────────
// VALIDATION ERRORS
// ─────────────────────────────────────────────

/**
 * Validate transcript quality
 */
export function validateTranscript(text: string): {
  valid: boolean;
  error?: string;
} {
  if (!text || text.trim().length === 0) {
    return {
      valid: false,
      error: "Transcript is empty",
    };
  }

  if (text.length < 10) {
    return {
      valid: false,
      error: "Transcript too short (minimum 10 characters)",
    };
  }

  if (text.length > 10000) {
    return {
      valid: false,
      error: "Transcript too long (maximum 10000 characters)",
    };
  }

  return { valid: true };
}

/**
 * Validate AI evaluation structure
 */
export function validateEvaluationStructure(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const dataRecord =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  // Check required fields
  const totalScore = dataRecord.total_score;
  if (typeof totalScore !== "number" || totalScore < 0 || totalScore > 1) {
    errors.push("total_score must be a number between 0 and 1");
  }

  const dimensions = dataRecord.dimensions;
  if (!dimensions || typeof dimensions !== "object") {
    errors.push("dimensions object is required");
  } else {
    const dimensionsRecord = dimensions as Record<string, unknown>;
    const requiredDimensions = [
      "courtesy",
      "empathy",
      "professionalism_and_tone",
      "communication_clarity",
      "engagement_and_problem_handling",
    ];
    for (const dim of requiredDimensions) {
      const dimension = dimensionsRecord[dim];
      if (!dimension || typeof dimension !== "object") {
        errors.push(`Missing dimension: ${dim}`);
        continue;
      }

      const score = (dimension as { score?: unknown }).score;
      if (typeof score !== "number" || score < 0 || score > 10) {
        errors.push(`${dim}.score must be between 0 and 10`);
      }
    }
  }

  const strengths = dataRecord.strengths;
  if (!Array.isArray(strengths) || strengths.length === 0) {
    errors.push("strengths must be a non-empty array");
  }

  const improvementAreas = dataRecord.improvement_areas;
  if (!Array.isArray(improvementAreas) || improvementAreas.length === 0) {
    errors.push("improvement_areas must be a non-empty array");
  }

  const finalSummary = dataRecord.final_summary;
  if (typeof finalSummary !== "string" || finalSummary.length === 0) {
    errors.push("final_summary is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────
// ERROR LOGGING
// ─────────────────────────────────────────────

/**
 * Log processing error to structured logging service
 */
export async function logProcessingError(
  sessionId: string,
  answerId: string,
  step: "transcription" | "evaluation" | "orchestration",
  error: Error | InterviewError,
  attempt: number,
  maxAttempts: number,
): Promise<void> {
  const { code, message, retriable } = classifyError(error);

  // Log to structured logging (e.g., Axiom, DataDog)
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    module: "interview",
    sessionId,
    answerId,
    step,
    errorCode: code,
    errorMessage: message,
    attempt,
    maxAttempts,
    retriable,
    context: error instanceof InterviewError ? error.context : {},
  };

  // TODO: Send to logging service
  console.error("[InterviewError]", logEntry);

  // Alert if critical
  if (!retriable && attempt === maxAttempts) {
    console.warn(
      "[InterviewError] CRITICAL: Non-retriable error reached max attempts",
      logEntry,
    );
  }
}
