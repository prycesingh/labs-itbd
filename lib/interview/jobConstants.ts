/**
 * Interview Module Background Job Constants
 *
 * Defines job types, timeouts, and retry configurations
 */

export const INTERVIEW_SESSION_ORCHESTRATION_JOB =
  "interview-session-orchestration";
export const INTERVIEW_TRANSCRIPTION_JOB = "interview-transcription";
export const INTERVIEW_EVALUATION_JOB = "interview-evaluation";
export const INTERVIEW_SESSION_SUMMARY_JOB = "interview-session-summary";
export const INTERVIEW_AUDIO_RETENTION_CLEANUP_JOB =
  "interview-audio-retention-cleanup";

// Job execution timeouts (in milliseconds)
export const JOB_TIMEOUTS = {
  [INTERVIEW_SESSION_ORCHESTRATION_JOB]: 10 * 60 * 1000, // 10 minutes
  [INTERVIEW_TRANSCRIPTION_JOB]: 5 * 60 * 1000, // 5 minutes per transcription
  [INTERVIEW_EVALUATION_JOB]: 3 * 60 * 1000, // 3 minutes per evaluation
  [INTERVIEW_SESSION_SUMMARY_JOB]: 2 * 60 * 1000, // 2 minutes
  [INTERVIEW_AUDIO_RETENTION_CLEANUP_JOB]: 30 * 60 * 1000, // 30 minutes
};

// Job retry configuration
export const JOB_RETRY_CONFIG = {
  [INTERVIEW_SESSION_ORCHESTRATION_JOB]: { maxAttempts: 1 }, // No retry for orchestration
  [INTERVIEW_TRANSCRIPTION_JOB]: { maxAttempts: 3 }, // 3 retries for transcription (often fails due to API issues)
  [INTERVIEW_EVALUATION_JOB]: { maxAttempts: 2 }, // 2 retries for evaluation
  [INTERVIEW_SESSION_SUMMARY_JOB]: { maxAttempts: 1 }, // No retry for summary
  [INTERVIEW_AUDIO_RETENTION_CLEANUP_JOB]: { maxAttempts: 1 }, // No retry for cleanup
};

// Interview configuration
export const INTERVIEW_CONFIG = {
  AUDIO_RETENTION_DAYS: parseInt(
    process.env.INTERVIEW_AUDIO_RETENTION_DAYS || "30",
  ),
  AUDIO_STORAGE_ROOT:
    process.env.INTERVIEW_AUDIO_ROOT || "/uploads/interview-audio",
  MAX_CONCURRENT_TRANSCRIPTION_JOBS: 5,
  MAX_CONCURRENT_EVALUATION_JOBS: 10,
  OPENAI_TRANSCRIPTION_MODEL: "whisper-1",
  OPENAI_EVALUATION_MODEL:
    process.env.INTERVIEW_EVALUATION_MODEL || "gpt-4o-mini",
  OPENAI_EVALUATION_TIMEOUT_MS: parseInt(
    process.env.INTERVIEW_EVALUATION_TIMEOUT_MS || "110000",
  ),
  OPENAI_EVALUATION_MAX_TOKENS: parseInt(
    process.env.INTERVIEW_EVALUATION_MAX_TOKENS || "500",
  ),
  EVALUATION_INTERNAL_MAX_ATTEMPTS: Math.max(
    1,
    parseInt(process.env.INTERVIEW_EVALUATION_INTERNAL_MAX_ATTEMPTS || "1"),
  ),
  OPENAI_SUMMARY_MODEL: "gpt-4o-mini",
  EVALUATION_TEMPERATURE: 0, // Deterministic scoring
};

/**
 * Get job configuration by type
 */
export function getJobConfig(jobType: string) {
  return {
    maxAttempts:
      JOB_RETRY_CONFIG[jobType as keyof typeof JOB_RETRY_CONFIG]?.maxAttempts ||
      1,
    maxExecutionTimeMs:
      JOB_TIMEOUTS[jobType as keyof typeof JOB_TIMEOUTS] || 5 * 60 * 1000,
  };
}

/**
 * Generate correlation ID for job tracing
 */
export function generateCorrelationId(sessionId: string): string {
  return `session_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Job status constants
 */
export const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

/**
 * Interview-specific error codes for classification
 */
export const INTERVIEW_ERROR_CODES = {
  AUDIO_UPLOAD_TIMEOUT: "AUDIO_UPLOAD_TIMEOUT",
  AUDIO_INVALID_FORMAT: "AUDIO_INVALID_FORMAT",
  AUDIO_TOO_LARGE: "AUDIO_TOO_LARGE",
  AUDIO_TOO_SHORT: "AUDIO_TOO_SHORT",
  TRANSCRIPTION_API_ERROR: "TRANSCRIPTION_API_ERROR",
  TRANSCRIPTION_EMPTY: "TRANSCRIPTION_EMPTY",
  TRANSCRIPTION_TIMEOUT: "TRANSCRIPTION_TIMEOUT",
  EVALUATION_API_ERROR: "EVALUATION_API_ERROR",
  EVALUATION_INVALID_RESPONSE: "EVALUATION_INVALID_RESPONSE",
  EVALUATION_TIMEOUT: "EVALUATION_TIMEOUT",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_INVALID_STATE: "SESSION_INVALID_STATE",
  ORCHESTRATION_FAILED: "ORCHESTRATION_FAILED",
  DATABASE_ERROR: "DATABASE_ERROR",
} as const;
