/**
 * Email Assessment Background Job Constants
 */

export const EMAIL_ASSESSMENT_EVALUATION_JOB = "email-assessment-evaluation";

export const EMAIL_ASSESSMENT_EVALUATION_JOB_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
export const EMAIL_ASSESSMENT_EVALUATION_JOB_MAX_ATTEMPTS = 1; // evaluateSubmission already retries internally
