/**
 * Interview Module Schema — MySQL/MariaDB Compatible
 *
 * Tables:
 * - candidateInterviewSessions: Session metadata + state
 * - candidateInterviewAnswers: Q&A pairs + audio + processing status
 * - aiInterviewEvaluations: OpenAI structured evaluation output
 * - adminInterviewEvaluations: Admin overrides + comparison metrics
 * - interviewSessionSummaries: Aggregated session-level results
 * - interviewModuleCapabilities: per-module feature registry (delivery
 *   scoring, grounded grading, follow-ups, evaluation depth) — admin-editable
 *   at runtime so modules (e.g. Customer Centricity vs Interview Coach) can
 *   have different evaluation behavior without code changes
 * - interviewDeliveryMetrics: per-answer acoustic delivery scoring, written
 *   only for modules with the delivery_scoring capability enabled
 *
 * Enhancements to existing backgroundJobs:
 * - correlationId: Links parent to child jobs
 * - parentJobId: Job hierarchy tracking
 * - nextRetryAt: Scheduled retry time
 * - heartbeatAt: Last progress ping
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  decimal,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

/**
 * MariaDB reports its `JSON` type as `LONGTEXT` (JSON is a LONGTEXT alias with
 * a CHECK constraint, not a native binary type like MySQL's). Drizzle's
 * mysql2 driver decides whether to auto-parse a column based on the type the
 * driver reports, so `json()` silently returns raw strings on MariaDB instead
 * of parsed objects. This custom type parses/stringifies explicitly so reads
 * always yield the declared TS shape regardless of driver auto-parsing.
 */
function jsonText<T>(name: string) {
  return customType<{ data: T; driverData: string }>({
    dataType() {
      return "longtext";
    },
    toDriver(value: T): string {
      return JSON.stringify(value);
    },
    fromDriver(value: string): T {
      return JSON.parse(value) as T;
    },
  })(name);
}

// ─────────────────────────────────────────────
// INTERVIEW CONFIG TABLES
// ─────────────────────────────────────────────

/**
 * Interview modules own interview questions and are independent from QA module.
 */
export const interviewModules = mysqlTable(
  "interview_modules",
  {
    id: varchar({ length: 36 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    questionDisplayCount: int("question_display_count").notNull().default(5),
    description: text("description"),
    interviewType: mysqlEnum("interview_type", [
      "hris-qa",
      "product-qa",
      "customer-service",
      "technical-qa",
    ]).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "interview_modules_id" }),
    unique("interview_modules_id_unique").on(table.id),
    index("interview_modules_type_active_idx").on(
      table.interviewType,
      table.isActive,
    ),
    index("interview_modules_created_idx").on(table.createdAt),
  ],
);

/**
 * One interview question can define multiple standard textual responses.
 */
export const interviewQuestionStandardResponses = mysqlTable(
  "interview_question_standard_responses",
  {
    id: varchar({ length: 36 }).notNull(),
    questionId: varchar("question_id", { length: 36 })
      .notNull()
      .references(() => interviewQuestionBank.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    responseText: text("response_text").notNull(),
    responseAudioPath: varchar("response_audio_path", { length: 500 }),
    responseOrder: int("response_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: "interview_standard_responses_id",
    }),
    unique("interview_standard_responses_id_unique").on(table.id),
    index("interview_standard_responses_question_idx").on(table.questionId),
    index("interview_standard_responses_question_order_idx").on(
      table.questionId,
      table.responseOrder,
    ),
  ],
);

// ─────────────────────────────────────────────
// QUESTION BANK (v2)
// ─────────────────────────────────────────────

/**
 * Standalone question bank — questions exist independently of any module.
 * Modules reference questions via interview_module_question_assignments.
 * Existing interview_questions rows are migrated here (same UUIDs preserved).
 */
export const interviewQuestionBank = mysqlTable(
  "interview_question_bank",
  {
    id: varchar({ length: 36 }).notNull(),
    promptText: text("prompt_text").notNull(),
    promptAudioPath: varchar("prompt_audio_path", { length: 500 }),
    promptTranscript: text("prompt_transcript"),
    isActive: boolean("is_active").notNull().default(true),
    // Which module authored/owns this question — used only as the default
    // scope filter in each module's "browse bank" admin UI. Does NOT restrict
    // assignment: interviewModuleQuestionAssignments already allows any
    // module to assign any question regardless of ownership, so cross-module
    // borrowing needs no further schema support.
    primaryModuleId: varchar("primary_module_id", { length: 36 }),
    // Source-grounded answer-key data (ported from interview-coach-main's
    // question_bank.json answer_key). Null/"none" for questions with no
    // grounded key — evaluateAnswer() falls back to inferring ideal points.
    groundedIdealPoints: jsonText<string[]>("grounded_ideal_points"),
    groundedAcceptanceCriteria: jsonText<string[]>(
      "grounded_acceptance_criteria",
    ),
    groundedSources: jsonText<string[]>("grounded_sources"),
    groundedCoverage: mysqlEnum("grounded_coverage", [
      "full",
      "partial",
      "none",
    ]),
    // Original identifier from interview-coach-main's data files (Python
    // topic_id / mined-question id) — used only to make the one-time
    // migration script idempotent on re-run. Null for questions not migrated
    // from that source.
    sourceId: varchar("source_id", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "iqb_id" }),
    unique("iqb_id_unique").on(table.id),
    index("iqb_active_idx").on(table.isActive),
    index("iqb_created_idx").on(table.createdAt),
    index("iqb_primary_module_idx").on(table.primaryModuleId),
    index("iqb_source_idx").on(table.sourceId),
    foreignKey({
      columns: [table.primaryModuleId],
      foreignColumns: [interviewModules.id],
      name: "iqb_primary_module_fk",
    })
      .onDelete("set null")
      .onUpdate("cascade"),
  ],
);

/**
 * Junction table: links bank questions to modules (M:M).
 * Deleting a module cascades to remove its assignments only — bank question survives.
 * Deleting a bank question is blocked (RESTRICT) if it still has assignments.
 */
export const interviewModuleQuestionAssignments = mysqlTable(
  "interview_module_question_assignments",
  {
    id: varchar({ length: 36 }).notNull(),
    moduleId: varchar("module_id", { length: 36 })
      .notNull()
      .references(() => interviewModules.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    questionId: varchar("question_id", { length: 36 })
      .notNull()
      .references(() => interviewQuestionBank.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    questionOrder: int("question_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "imqa_id" }),
    unique("imqa_id_unique").on(table.id),
    unique("imqa_module_question_unique").on(table.moduleId, table.questionId),
    unique("imqa_module_order_unique").on(table.moduleId, table.questionOrder),
    index("imqa_module_active_idx").on(table.moduleId, table.isActive),
    index("imqa_question_idx").on(table.questionId),
  ],
);

// ─────────────────────────────────────────────
// INTERVIEW SESSIONS
// ─────────────────────────────────────────────

/**
 * Candidate interview session: tracks recording + processing state
 * Status flow: draft → recording → recorded → processing → completed/failed
 * Resumability: RECORDING state can be paused and resumed
 */
export const candidateInterviewSessions = mysqlTable(
  "candidate_interview_sessions",
  {
    id: varchar({ length: 36 }).notNull(), // UUID
    candidateId: varchar("candidate_id", { length: 255 }).notNull(),
    moduleId: varchar("module_id", { length: 255 }).notNull(),
    interviewType: mysqlEnum("interview_type", [
      "hris-qa",
      "product-qa",
      "customer-service",
      "technical-qa",
    ]).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "recording",
      "recorded",
      "processing",
      "completed",
      "failed",
    ])
      .notNull()
      .default("draft"),
    sessionState: json("session_state").notNull().default({}), // { currentQuestionIndex, recordedCount, processedCount, errors[] }
    assignedQuestionIds: jsonText<string[]>("assigned_question_ids").notNull(), // ordered bank question IDs picked for this session; fixed at creation, reused on resume
    audioStorageMode: mysqlEnum("audio_storage_mode", ["filesystem", "s3"])
      .notNull()
      .default("filesystem"),
    totalQuestions: int().notNull(),
    recordedCount: int().notNull().default(0),
    processedCount: int().notNull().default(0),
    startedAt: timestamp("started_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    recordingCompletedAt: timestamp("recording_completed_at", {
      mode: "string",
    }),
    processingStartedAt: timestamp("processing_started_at", { mode: "string" }),
    completedAt: timestamp("completed_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "interview_sessions_id" }),
    unique("interview_sessions_id_unique").on(table.id),
    index("interview_sessions_candidate_idx").on(
      table.candidateId,
      table.status,
    ),
    index("interview_sessions_module_idx").on(table.moduleId, table.status),
    index("interview_sessions_created_idx").on(table.createdAt),
    index("interview_sessions_candidate_module_created_idx").on(
      table.candidateId,
      table.moduleId,
      table.createdAt,
    ),
  ],
);

/**
 * Per-user, per-module override of the default daily practice-attempt limit
 * (default is 1/day, enforced in code). One row per (userId, moduleId) pair;
 * deleting the row reverts that user to the default limit for that module.
 * lockoutThreshold optionally overrides the default 3-failed-attempts lockout
 * for that same (userId, moduleId) pair; null means "use the default of 3".
 */
export const interviewPracticeAttemptOverrides = mysqlTable(
  "interview_practice_attempt_overrides",
  {
    id: varchar({ length: 36 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    moduleId: varchar("module_id", { length: 36 }).notNull(),
    dailyLimit: int("daily_limit").notNull(),
    lockoutThreshold: int("lockout_threshold"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "ipao_id" }),
    unique("ipao_id_unique").on(table.id),
    unique("ipao_user_module_unique").on(table.userId, table.moduleId),
    index("ipao_user_idx").on(table.userId),
    index("ipao_module_idx").on(table.moduleId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "ipao_user_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.moduleId],
      foreignColumns: [interviewModules.id],
      name: "ipao_module_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// ─────────────────────────────────────────────
// INTERVIEW ANSWERS
// ─────────────────────────────────────────────

/**
 * Individual Q&A for a session
 * Tracks: audio upload, transcription job, evaluation job
 * Links both AI and admin evaluations
 */
export const candidateInterviewAnswers = mysqlTable(
  "candidate_interview_answers",
  {
    id: varchar({ length: 36 }).notNull(), // UUID
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => candidateInterviewSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    questionId: varchar("question_id", { length: 255 }).notNull(),
    questionIndex: int().notNull(), // 0-based sequence
    // Follow-up linkage: set only for modules with the follow_ups capability
    // enabled. isFollowUp marks this answer as a response to an adaptively
    // generated follow-up question rather than a fixed bank question;
    // followUpOfAnswerId points back to the answer that triggered it. Both
    // stay null/false for every module without follow_ups enabled.
    isFollowUp: boolean("is_follow_up").notNull().default(false),
    followUpOfAnswerId: varchar("follow_up_of_answer_id", { length: 36 }),
    audioStoragePath: varchar("audio_storage_path", { length: 500 }).notNull(), // /uploads/interview-audio/{sessionId}/{questionIndex}-{timestamp}.wav
    audioMimeType: varchar("audio_mime_type", { length: 50 }).notNull(), // audio/wav, audio/mp3, etc.
    audioSizeBytes: int().notNull(), // For analytics
    audioDurationMs: int().notNull(), // Duration in ms
    uploadedAt: timestamp("uploaded_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    uploadRetries: int().notNull().default(0),
    // Transcription fields
    transcriptStatus: mysqlEnum("transcript_status", [
      "pending",
      "transcribing",
      "completed",
      "failed",
    ])
      .notNull()
      .default("pending"),
    transcriptJobId: varchar("transcript_job_id", { length: 255 }), // FK to backgroundJobs, nullable
    transcriptedText: text("transcripted_text"), // Raw transcript
    transcriptProvider: varchar("transcript_provider", { length: 50 }).default(
      "openai",
    ), // openai, future: other providers
    transcriptDetectedLanguage: varchar("transcript_detected_language", {
      length: 10,
    }), // en, hi, en-US
    transcriptConfidence: decimal("transcript_confidence", {
      precision: 5,
      scale: 4,
    }), // 0.0-1.0 if available
    transcriptRawResponse: json("transcript_raw_response"), // Full OpenAI response for audit
    transcriptProcessingTimeMs: int("transcript_processing_time_ms"),
    // Evaluation fields
    evaluationStatus: mysqlEnum("evaluation_status", [
      "pending",
      "evaluating",
      "completed",
      "failed",
    ])
      .notNull()
      .default("pending"),
    evaluationJobId: varchar("evaluation_job_id", { length: 255 }), // FK to backgroundJobs
    aiEvaluationId: varchar("ai_evaluation_id", { length: 36 }), // FK to ai_interview_evaluations
    adminEvaluationId: varchar("admin_evaluation_id", { length: 36 }), // FK to admin_interview_evaluations
    // Delivery/acoustic scoring outcome — only ever meaningful for modules
    // with the delivery_scoring capability enabled; every other module's
    // answers stay at the "not_applicable" default. Tracked here (not just
    // inferred from a missing interview_delivery_metrics row) because
    // scoreAndPersistDelivery only ever gets one attempt, chained off
    // transcription completing, and previously swallowed its own failures
    // into console.warn with zero trace — a session could show no Delivery
    // Score anywhere with no way to tell "never attempted" from "attempted
    // and failed" apart, or to retry it.
    deliveryStatus: mysqlEnum("delivery_status", [
      "not_applicable",
      "pending",
      "completed",
      "failed",
    ])
      .notNull()
      .default("not_applicable"),
    deliveryError: text("delivery_error"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "interview_answers_id" }),
    unique("interview_answers_id_unique").on(table.id),
    unique("interview_answers_session_question_idx").on(
      table.sessionId,
      table.questionId,
    ),
    index("interview_answers_transcript_status_idx").on(
      table.transcriptStatus,
      table.evaluationStatus,
    ),
    index("interview_answers_transcript_job_idx").on(table.transcriptJobId),
    index("interview_answers_evaluation_job_idx").on(table.evaluationJobId),
    index("interview_answers_created_idx").on(table.createdAt),
    index("interview_answers_follow_up_of_idx").on(table.followUpOfAnswerId),
    foreignKey({
      columns: [table.followUpOfAnswerId],
      foreignColumns: [table.id],
      name: "interview_answers_follow_up_of_fk",
    }).onDelete("set null"),
  ],
);

// ─────────────────────────────────────────────
// AI INTERVIEW EVALUATIONS
// ─────────────────────────────────────────────

/**
 * OpenAI evaluation output: structured scoring + dimensions
 * Stored separately from admin evaluation for comparison analytics
 */
export const aiInterviewEvaluations = mysqlTable(
  "ai_interview_evaluations",
  {
    id: varchar({ length: 36 }).notNull(), // UUID
    answerId: varchar("answer_id", { length: 36 })
      .notNull()
      .unique()
      .references(() => candidateInterviewAnswers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => candidateInterviewSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    modelUsed: varchar("model_used", { length: 50 })
      .notNull()
      .default("gpt-4-turbo"), // gpt-4o, gpt-4-turbo
    promptVersion: varchar("prompt_version", { length: 20 })
      .notNull()
      .default("1.0"), // For model updates
    evaluationJsonStructured: json("evaluation_json_structured").notNull(), // Full structured output
    // Structure:
    // {
    //   total_score: 0-1 normalized,
    //   dimensions: {
    //     courtesy: { score: 0-10, reason: string },
    //     empathy: { score: 0-10, reason: string },
    //     professionalism_and_tone: { score: 0-10, reason: string },
    //     communication_clarity: { score: 0-10, reason: string },
    //     engagement_and_problem_handling: { score: 0-10, reason: string }
    //   },
    //   strengths: string[],
    //   improvement_areas: string[],
    //   final_summary: string
    // }
    tokensUsed: json("tokens_used").notNull(), // { prompt, completion, total }
    processingTimeMs: int("processing_time_ms"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "ai_interview_evaluations_id" }),
    unique("ai_interview_evaluations_id_unique").on(table.id),
    index("ai_interview_evaluations_session_idx").on(table.sessionId),
    index("ai_interview_evaluations_created_idx").on(table.createdAt),
  ],
);

// ─────────────────────────────────────────────
// ADMIN INTERVIEW EVALUATIONS
// ─────────────────────────────────────────────

/**
 * Admin override evaluations: stored separately for model training
 * Includes comparison metrics (AI vs Admin) for continuous improvement
 */
export const adminInterviewEvaluations = mysqlTable(
  "admin_interview_evaluations",
  {
    id: varchar({ length: 36 }).notNull(), // UUID
    answerId: varchar("answer_id", { length: 36 })
      .notNull()
      .unique()
      .references(() => candidateInterviewAnswers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => candidateInterviewSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    adminUserId: varchar("admin_user_id", { length: 255 })
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    totalScoreOverride: int().notNull(), // 0-100 manual override
    dimensionOverrides: json("dimension_overrides"), // { courtesy: {score, reason}, ... }
    adminNotes: text("admin_notes"), // Session-specific admin notes
    comparisonToAi: json("comparison_to_ai").notNull(), // { score_diff, dimension_diffs, agreement_pct }
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "admin_interview_evaluations_id" }),
    unique("admin_interview_evaluations_id_unique").on(table.id),
    index("admin_interview_evaluations_admin_idx").on(table.adminUserId),
    index("admin_interview_evaluations_session_idx").on(table.sessionId),
    index("admin_interview_evaluations_updated_idx").on(table.updatedAt),
  ],
);

// ─────────────────────────────────────────────
// INTERVIEW SESSION SUMMARIES
// ─────────────────────────────────────────────

/**
 * Aggregated session-level summary: average scores + top strengths/improvement areas
 * Generated after all evaluations complete
 */
export const interviewSessionSummaries = mysqlTable(
  "interview_session_summaries",
  {
    id: varchar({ length: 36 }).notNull(), // UUID
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .unique()
      .references(() => candidateInterviewSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    candidateId: varchar("candidate_id", { length: 255 }).notNull(),
    moduleId: varchar("module_id", { length: 255 }).notNull(),
    overallAiScore: decimal("overall_ai_score", { precision: 5, scale: 2 }), // 0-100, average of all Q scores
    overallAdminScore: decimal("overall_admin_score", {
      precision: 5,
      scale: 2,
    }), // 0-100, average of admin overrides
    aiStrengths: json("ai_strengths").notNull().default("[]"), // string[]
    aiImprovementAreas: json("ai_improvement_areas").notNull().default("[]"), // string[]
    adminNotes: text("admin_notes"), // Session-level admin notes
    generatedAt: timestamp("generated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    summaryGenerationJobId: varchar("summary_generation_job_id", {
      length: 255,
    }), // FK to backgroundJobs
  },
  (table) => [
    primaryKey({
      columns: [table.id],
      name: "interview_session_summaries_id",
    }),
    unique("interview_session_summaries_id_unique").on(table.id),
    index("interview_session_summaries_candidate_idx").on(table.candidateId),
    index("interview_session_summaries_module_idx").on(table.moduleId),
  ],
);

// ─────────────────────────────────────────────
// FOLLOW-UP QUESTIONS (adaptive, capability-gated)
// ─────────────────────────────────────────────

/**
 * Adaptively-generated follow-up questions, created only when a per-answer
 * evaluation (immediate-processing path, see upload-audio route) flags
 * follow_up_recommended for a module with the follow_ups capability
 * enabled. Not a bank question — scoped to one session, one parent answer.
 * `status` tracks whether the candidate still needs to record it.
 */
export const interviewFollowupQuestions = mysqlTable(
  "interview_followup_questions",
  {
    id: varchar({ length: 36 }).notNull(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    parentAnswerId: varchar("parent_answer_id", { length: 36 }).notNull(),
    questionText: text("question_text").notNull(),
    idealPoints: jsonText<string[]>("ideal_points"),
    status: mysqlEnum("status", ["pending", "answered", "skipped"])
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "ifq_id" }),
    unique("ifq_id_unique").on(table.id),
    index("ifq_session_idx").on(table.sessionId, table.status),
    index("ifq_parent_answer_idx").on(table.parentAnswerId),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [candidateInterviewSessions.id],
      name: "ifq_session_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.parentAnswerId],
      foreignColumns: [candidateInterviewAnswers.id],
      name: "ifq_parent_answer_fk",
    }).onDelete("cascade"),
  ],
);

// ─────────────────────────────────────────────
// MODULE CAPABILITIES (admin-editable feature registry)
// ─────────────────────────────────────────────

/**
 * Generic, extensible per-module capability registry — one row per
 * (module, capabilityKey). Replaces hardcoded per-module booleans so that
 * what a module evaluates (delivery scoring, grounded grading, follow-ups,
 * evaluation depth) is admin-configurable at runtime instead of baked into
 * code. Adding a future capability is a data change (new capabilityKey) plus
 * a code path that reads it via getModuleCapability() — no schema migration
 * for the flag itself.
 *
 * `enabled` is the on/off switch for boolean-style capabilities
 * (delivery_scoring, grounded_grading, follow_ups); it is unused/ignored for
 * config-only capabilities like evaluation_depth. `config` carries
 * capability-specific settings, e.g.:
 *   delivery_scoring: { calibrationMode: "static" | "population-relative" }
 *   evaluation_depth: { depth: "full-rubric" | "content-only" | "delivery-only" }
 *
 * If a (moduleId, capabilityKey) row does not exist, getModuleCapability()
 * defaults to disabled / content-only — never to an enabled/expansive
 * default — so an unconfigured module never silently inherits expensive or
 * unexpected behavior.
 */
export const interviewModuleCapabilities = mysqlTable(
  "interview_module_capabilities",
  {
    id: varchar({ length: 36 }).notNull(),
    moduleId: varchar("module_id", { length: 36 })
      .notNull()
      .references(() => interviewModules.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    capabilityKey: varchar("capability_key", { length: 100 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    config: jsonText<Record<string, unknown>>("config"),
    updatedBy: varchar("updated_by", { length: 255 })
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .onUpdateNow()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "imc_id" }),
    unique("imc_id_unique").on(table.id),
    unique("imc_module_capability_unique").on(
      table.moduleId,
      table.capabilityKey,
    ),
    index("imc_module_idx").on(table.moduleId),
  ],
);

// ─────────────────────────────────────────────
// DELIVERY METRICS (acoustic scoring — capability-gated)
// ─────────────────────────────────────────────

/**
 * Per-answer acoustic delivery scoring (pace, pauses, fillers, pitch,
 * loudness) — written ONLY for answers belonging to a session whose module
 * has the delivery_scoring capability enabled. Ported from
 * interview-coach-main's audio_analysis.py/llm.py delivery rubric, computed
 * in Node via Deepgram word-timestamps (pace/pause/filler) plus
 * pitchy/pitchfinder/meyda (pitch/loudness) instead of faster-whisper/
 * praat-parselmouth.
 */
export const interviewDeliveryMetrics = mysqlTable(
  "interview_delivery_metrics",
  {
    id: varchar({ length: 36 }).notNull(),
    answerId: varchar("answer_id", { length: 36 }).notNull().unique(),
    wpm: decimal("wpm", { precision: 6, scale: 2 }),
    pauseCount: int("pause_count"),
    totalPauseS: decimal("total_pause_s", { precision: 6, scale: 2 }),
    longestPauseS: decimal("longest_pause_s", { precision: 6, scale: 2 }),
    pauseRatio: decimal("pause_ratio", { precision: 5, scale: 3 }),
    fillerCount: int("filler_count"),
    fillersPerMin: decimal("fillers_per_min", { precision: 6, scale: 2 }),
    pitchMeanHz: decimal("pitch_mean_hz", { precision: 7, scale: 2 }),
    pitchDynamismSt: decimal("pitch_dynamism_st", { precision: 6, scale: 3 }),
    pitchRangeSt: decimal("pitch_range_st", { precision: 6, scale: 3 }),
    loudnessDbMean: decimal("loudness_db_mean", { precision: 6, scale: 2 }),
    loudnessVariationDb: decimal("loudness_variation_db", {
      precision: 6,
      scale: 3,
    }),
    // { pace, pausing, fluency, expressiveness } — each banded 1-5
    deliveryScores: jsonText<{
      pace: number;
      pausing: number;
      fluency: number;
      expressiveness: number;
    }>("delivery_scores").notNull(),
    deliveryOverall: decimal("delivery_overall", { precision: 3, scale: 1 }),
    // Which calibration mode produced these bands — stamped at scoring time
    // so switching the admin toggle later doesn't retroactively
    // misrepresent already-scored answers.
    calibrationMode: mysqlEnum("calibration_mode", [
      "static",
      "population-relative",
    ])
      .notNull()
      .default("static"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "idm_id" }),
    unique("idm_id_unique").on(table.id),
    index("idm_created_idx").on(table.createdAt),
    foreignKey({
      columns: [table.answerId],
      foreignColumns: [candidateInterviewAnswers.id],
      name: "idm_answer_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// ─────────────────────────────────────────────
// BACKGROUND JOB ENHANCEMENTS (in main schema.ts)
// ─────────────────────────────────────────────
// Add these fields to backgroundJobs table:
// - correlationId (varchar 255) — Links parent to child jobs
// - parentJobId (varchar 255) FK → backgroundJobs.id — Job hierarchy
// - nextRetryAt (timestamp) — Scheduled retry time
// - heartbeatAt (timestamp) — Last progress ping for monitoring
