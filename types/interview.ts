/**
 * Interview Module Types
 *
 * Defines all TypeScript interfaces for the AI-powered interview assessment system
 */

// ─────────────────────────────────────────────
// SESSION TYPES
// ─────────────────────────────────────────────

export enum InterviewStatus {
  DRAFT = "draft",
  RECORDING = "recording",
  RECORDED = "recorded",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum InterviewType {
  HRIS_QA = "hris-qa",
  PRODUCT_QA = "product-qa",
  CUSTOMER_SERVICE = "customer-service",
  TECHNICAL_QA = "technical-qa",
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export interface SessionState {
  currentQuestionIndex: number;
  recordedCount: number;
  processedCount: number;
  errors?: Array<{
    answerId: string;
    step: "upload" | "transcription" | "evaluation";
    error: string;
  }>;
}

export interface CandidateInterviewSession {
  id: string; // UUID
  candidateId: string;
  moduleId: string;
  interviewType: InterviewType;
  status: InterviewStatus;
  sessionState: SessionState;
  audioStorageMode: "filesystem" | "s3";
  totalQuestions: number;
  recordedCount: number;
  processedCount: number;
  startedAt: string;
  recordingCompletedAt?: string;
  processingStartedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewCandidateInterviewSession {
  id: string;
  candidateId: string;
  moduleId: string;
  interviewType: InterviewType;
  totalQuestions: number;
  audioStorageMode?: "filesystem" | "s3";
}

// ─────────────────────────────────────────────
// ANSWER TYPES
// ─────────────────────────────────────────────

export enum TranscriptStatus {
  PENDING = "pending",
  TRANSCRIBING = "transcribing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum EvaluationStatus {
  PENDING = "pending",
  EVALUATING = "evaluating",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface CandidateInterviewAnswer {
  id: string; // UUID
  sessionId: string;
  questionId: string;
  questionIndex: number;
  audioStoragePath: string;
  audioMimeType: string;
  audioSizeBytes: number;
  audioDurationMs: number;
  uploadedAt: string;
  uploadRetries: number;
  transcriptStatus: TranscriptStatus;
  transcriptJobId?: string;
  transcriptedText?: string;
  transcriptProvider: string;
  transcriptDetectedLanguage?: string;
  transcriptConfidence?: number;
  transcriptRawResponse?: JsonObject;
  transcriptProcessingTimeMs?: number;
  evaluationStatus: EvaluationStatus;
  evaluationJobId?: string;
  aiEvaluationId?: string;
  adminEvaluationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewCandidateInterviewAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  questionIndex: number;
  audioStoragePath: string;
  audioMimeType: string;
  audioSizeBytes: number;
  audioDurationMs: number;
}

export interface AnswerUploadInput {
  sessionId: string;
  questionIndex: number;
  audioDuration: number; // ms
  audioMimeType: string;
}

export interface AnswerWithEvaluations extends CandidateInterviewAnswer {
  aiEvaluation?: AiInterviewEvaluation;
  adminEvaluation?: AdminInterviewEvaluation;
}

// ─────────────────────────────────────────────
// EVALUATION TYPES
// ─────────────────────────────────────────────

export interface EvaluationDimension {
  score: number; // 0-10
  reason: string;
}

export interface EvaluationDimensions {
  courtesy: EvaluationDimension;
  empathy: EvaluationDimension;
  professionalism_and_tone: EvaluationDimension;
  communication_clarity: EvaluationDimension;
  engagement_and_problem_handling: EvaluationDimension;
}

export interface AIEvaluationStructured {
  total_score: number; // 0-1 normalized score
  dimensions: EvaluationDimensions;
  strengths: string[];
  improvement_areas: string[];
  final_summary: string;
  evaluation_source?: "ai" | "fallback";
  validation_status?: "valid" | "invalid_json" | "invalid_structure";
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface AiInterviewEvaluation {
  id: string; // UUID
  answerId: string;
  sessionId: string;
  modelUsed: string;
  promptVersion: string;
  evaluationJsonStructured: AIEvaluationStructured;
  tokensUsed: TokenUsage;
  processingTimeMs?: number;
  createdAt: string;
}

export interface NewAiInterviewEvaluation {
  id: string;
  answerId: string;
  sessionId: string;
  modelUsed: string;
  promptVersion: string;
  evaluationJsonStructured: AIEvaluationStructured;
  tokensUsed: TokenUsage;
}

export interface DimensionOverride {
  score: number; // 0-10
  reason?: string;
}

export interface DimensionOverrides {
  courtesy?: DimensionOverride;
  empathy?: DimensionOverride;
  professionalism_and_tone?: DimensionOverride;
  communication_clarity?: DimensionOverride;
  engagement_and_problem_handling?: DimensionOverride;
}

export interface ComparisonToAI {
  score_diff: number; // Admin score - AI score
  dimension_diffs: Record<string, number>; // Per-dimension diff
  agreement_pct: number; // 0-100
}

export interface AdminInterviewEvaluation {
  id: string; // UUID
  answerId: string;
  sessionId: string;
  adminUserId: string;
  totalScoreOverride: number; // 0-100
  dimensionOverrides?: DimensionOverrides;
  adminNotes?: string;
  comparisonToAi: ComparisonToAI;
  createdAt: string;
  updatedAt: string;
}

export interface NewAdminInterviewEvaluation {
  id: string;
  answerId: string;
  sessionId: string;
  adminUserId: string;
  totalScoreOverride: number;
  dimensionOverrides?: DimensionOverrides;
  adminNotes?: string;
}

// ─────────────────────────────────────────────
// SESSION SUMMARY TYPES
// ─────────────────────────────────────────────

export interface InterviewSessionSummary {
  id: string; // UUID
  sessionId: string;
  candidateId: string;
  moduleId: string;
  overallAiScore?: number; // 0-100
  overallAdminScore?: number; // 0-100
  aiStrengths: string[];
  aiImprovementAreas: string[];
  adminNotes?: string;
  generatedAt: string;
  summaryGenerationJobId?: string;
}

export interface NewInterviewSessionSummary {
  id: string;
  sessionId: string;
  candidateId: string;
  moduleId: string;
}

// ─────────────────────────────────────────────
// PROCESSING TYPES
// ─────────────────────────────────────────────

export interface ProcessingProgress {
  transcriptedAnswers: number;
  evaluatedAnswers: number;
  totalAnswers: number;
  status:
    | "pending"
    | "transcribing"
    | "evaluating"
    | "summarizing"
    | "completed"
    | "failed";
  currentStep?: string;
  estimatedTimeRemaining?: number; // seconds
}

export interface SessionProcessingStatus {
  orchestrationJobId: string;
  status:
    | "pending"
    | "transcribing"
    | "evaluating"
    | "summarizing"
    | "completed"
    | "failed";
  progress: ProcessingProgress;
  errors: Array<{
    answerId: string;
    step: string;
    error: string;
    attempt: number;
  }>;
}

// ─────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────

export interface ApiErrorResponse {
  message: string;
  error: string;
  details?: JsonObject;
}

export interface CreateSessionResponse {
  sessionId: string;
  totalQuestions: number;
  status: InterviewStatus;
  questions: Array<{
    id: string;
    index: number;
    text: string;
    audioUrl: string;
  }>;
}

export interface AudioUploadResponse {
  answerId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
}

export interface ProcessingTriggerResponse {
  orchestrationJobId: string;
  correlationId: string;
}

export interface SessionStatusResponse {
  session: CandidateInterviewSession;
  answers: AnswerWithEvaluations[];
  summary?: InterviewSessionSummary;
}

// ─────────────────────────────────────────────
// BACKGROUND JOB TYPES
// ─────────────────────────────────────────────

export interface BackgroundJobContext {
  jobId: string;
  correlationId?: string;
  parentJobId?: string;
  sessionId?: string;
  answerId?: string;
}

export interface JobCallbacks {
  updateProgress: (percent: number) => Promise<void>;
  updateResult: (data: JsonObject) => Promise<void>;
}

export interface TranscriptionJobPayload {
  sessionId: string;
  answerId: string;
  audioStoragePath: string;
  detectedLanguage?: string;
}

export interface EvaluationJobPayload {
  sessionId: string;
  answerId: string;
  transcript: string;
  questionId: string;
}

export interface OrchestrationJobPayload {
  sessionId: string;
  correlationId: string;
}

// ─────────────────────────────────────────────
// FILE STORAGE TYPES
// ─────────────────────────────────────────────

export interface StorageResult {
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
}

export interface AudioUploadValidation {
  isValid: boolean;
  errors: string[];
}

// ─────────────────────────────────────────────
// AUDIO METADATA TYPES
// ─────────────────────────────────────────────

export const SUPPORTED_AUDIO_TYPES = [
  "audio/wav",
  "audio/mp3",
  "audio/webm",
  "audio/m4a",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
] as const;

export type SupportedAudioType = (typeof SUPPORTED_AUDIO_TYPES)[number];

export const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MIN_AUDIO_DURATION_MS = 100; // 100ms
export const MAX_AUDIO_DURATION_MS = 15 * 60 * 1000; // 15min

// ─────────────────────────────────────────────
// EVALUATION RUBRIC TYPES
// ─────────────────────────────────────────────

export interface DimensionRubric {
  weight: number;
  description: string;
  scoreRange: string;
}

export interface EvaluationRubric {
  instructions: string;
  dimensions: Record<string, DimensionRubric>;
}

// ─────────────────────────────────────────────
// ADMIN REVIEW TYPES
// ─────────────────────────────────────────────

export interface AdminEvaluationUpdate {
  answerId: string;
  totalScoreOverride?: number;
  dimensionOverrides?: DimensionOverrides;
  adminNotes?: string;
}

export interface AdminReviewBatch {
  sessionId: string;
  updates: AdminEvaluationUpdate[];
}

// ─────────────────────────────────────────────
// QUESTION BANK TYPES (v2)
// ─────────────────────────────────────────────

export interface BankQuestion {
  id: string;
  promptText: string;
  promptAudioPath: string | null;
  promptTranscript: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assignments: number;
    standardResponses: number;
  };
}

/** A module-question assignment row, optionally includes nested question data. */
export interface ModuleQuestionAssignment {
  id: string;
  moduleId: string;
  questionId: string;
  questionOrder: number;
  isActive: boolean;
  createdAt: string;
  question?: BankQuestion;
}

/** Shape returned in the 409 payload when a bank question is still assigned. */
export interface BankQuestionAssignmentInfo {
  assignmentId: string;
  moduleId: string;
  moduleName: string;
  moduleIsActive: boolean;
  questionDisplayCount: number;
  activeQuestionCount: number;
}
