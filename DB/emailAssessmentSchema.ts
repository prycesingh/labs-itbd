/**
 * Email Assessment Module Schema — MySQL/MariaDB Compatible
 *
 * Ported from the standalone "Email Assessment Platform" into WMS as a module.
 * All tables are prefixed `email_assessment_` to avoid colliding with WMS's
 * existing `users`, `sessions`, `accounts`, and `assessments` tables.
 *
 * Source of truth for users/roles/auth is WMS: candidate/assessor/creator
 * foreign keys reference the shared WMS `users` table (DB/schema.ts), and the
 * standalone auth tables (roles/users/accounts/sessions/verificationTokens)
 * are intentionally NOT ported.
 */

import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./schema";

// ─────────────────────────────────────────────
// Enum helpers (MySQL ENUM type)
// ─────────────────────────────────────────────
export const eaScenarioDifficultyEnum = (name: string) =>
  mysqlEnum(name, ["beginner", "intermediate", "advanced"]);
export const eaAssessmentStatusEnum = (name: string) =>
  mysqlEnum(name, ["in_progress", "submitted", "evaluating", "completed", "expired", "failed"]);
export const eaEvaluationStatusEnum = (name: string) =>
  mysqlEnum(name, ["pending", "completed", "failed_validation", "pending_retry", "failed"]);
export const eaAiRequestStatusEnum = (name: string) =>
  mysqlEnum(name, ["pending", "completed", "failed", "retrying"]);
export const eaGradeEnum = (name: string) => mysqlEnum(name, ["A", "B", "C", "D", "E"]);
export const eaAuditActionEnum = (name: string) =>
  mysqlEnum(name, [
    "scenario_created",
    "scenario_updated",
    "scenario_archived",
    "assessment_started",
    "submission_created",
    "evaluation_completed",
    "manual_score_created",
    "report_exported",
  ]);

export type RubricWeights = {
  professionalTone: number;
  grammarLanguage: number;
  clarityEmpathyRespect: number;
  structure: number;
  completeness: number;
};

export type CategoryScores = RubricWeights;

// ─────────────────────────────────────────────
// Rubrics & prompt versions
// ─────────────────────────────────────────────
export const emailAssessmentRubrics = mysqlTable(
  "email_assessment_rubrics",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    version: varchar("version", { length: 64 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    weights: json("weights").$type<RubricWeights>().notNull(),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    versionIdx: uniqueIndex("ea_rubrics_version_idx").on(table.version),
    activeIdx: index("ea_rubrics_active_idx").on(table.active),
  })
);

export const emailAssessmentPromptVersions = mysqlTable(
  "email_assessment_prompt_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    version: varchar("version", { length: 64 }).notNull(),
    systemPrompt: text("system_prompt").notNull(),
    evaluationPrompt: text("evaluation_prompt").notNull(),
    rubricId: varchar("rubric_id", { length: 36 })
      .notNull()
      .references(() => emailAssessmentRubrics.id, { onDelete: "restrict" }),
    model: varchar("model", { length: 120 }).notNull().default("gpt-4o-mini"),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    versionIdx: uniqueIndex("ea_prompt_versions_version_idx").on(table.version),
    activeIdx: index("ea_prompt_versions_active_idx").on(table.active),
  })
);

// ─────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────
export const emailAssessmentScenarios = mysqlTable(
  "email_assessment_scenarios",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 220 }).notNull(),
    prompt: text("prompt").notNull(),
    difficulty: eaScenarioDifficultyEnum("difficulty").notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    active: boolean("active").notNull().default(true),
    modelAnswer: text("model_answer"),
    scoringNotes: text("scoring_notes"),
    source: varchar("source", { length: 160 }).notNull().default("ITBD scenario bank"),
    createdById: varchar("created_by_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    titleIdx: uniqueIndex("ea_scenarios_title_idx").on(table.title),
    activeIdx: index("ea_scenarios_active_idx").on(table.active),
    difficultyIdx: index("ea_scenarios_difficulty_idx").on(table.difficulty),
    categoryIdx: index("ea_scenarios_category_idx").on(table.category),
  })
);

// ─────────────────────────────────────────────
// Assessments
// ─────────────────────────────────────────────
export const emailAssessmentAssessments = mysqlTable(
  "email_assessment_assessments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    candidateId: varchar("candidate_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scenarioId: varchar("scenario_id", { length: 36 })
      .notNull()
      .references(() => emailAssessmentScenarios.id, { onDelete: "restrict" }),
    sessionId: varchar("session_id", { length: 36 }),
    sessionIndex: int("session_index"),
    status: eaAssessmentStatusEnum("status").notNull().default("in_progress"),
    timeLimitMinutes: int("time_limit_minutes").notNull().default(30),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    dueAt: timestamp("due_at").notNull(),
    submittedAt: timestamp("submitted_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    candidateIdx: index("ea_assessments_candidate_idx").on(table.candidateId),
    scenarioIdx: index("ea_assessments_scenario_idx").on(table.scenarioId),
    statusIdx: index("ea_assessments_status_idx").on(table.status),
    sessionIdx: index("ea_assessments_session_idx").on(table.sessionId),
  })
);

// ─────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────
export const emailAssessmentSubmissions = mysqlTable(
  "email_assessment_submissions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    assessmentId: varchar("assessment_id", { length: 36 })
      .notNull()
      .unique()
      .references(() => emailAssessmentAssessments.id, { onDelete: "cascade" }),
    candidateId: varchar("candidate_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scenarioId: varchar("scenario_id", { length: 36 })
      .notNull()
      .references(() => emailAssessmentScenarios.id, { onDelete: "restrict" }),
    subject: varchar("subject", { length: 998 }),
    content: text("content").notNull(),
    wordCount: int("word_count").notNull(),
    copyPenalty: int("copy_penalty").notNull().default(0),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  },
  (table) => ({
    candidateIdx: index("ea_submissions_candidate_idx").on(table.candidateId),
    scenarioIdx: index("ea_submissions_scenario_idx").on(table.scenarioId),
  })
);

// ─────────────────────────────────────────────
// Evaluations
// ─────────────────────────────────────────────
export const emailAssessmentEvaluations = mysqlTable(
  "email_assessment_evaluations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    submissionId: varchar("submission_id", { length: 36 })
      .notNull()
      .unique()
      .references(() => emailAssessmentSubmissions.id, { onDelete: "cascade" }),
    promptVersionId: varchar("prompt_version_id", { length: 36 }).references(
      () => emailAssessmentPromptVersions.id,
      { onDelete: "set null" }
    ),
    rubricId: varchar("rubric_id", { length: 36 }).references(() => emailAssessmentRubrics.id, {
      onDelete: "set null",
    }),
    status: eaEvaluationStatusEnum("status").notNull().default("pending"),
    overallScore: int("overall_score"),
    grade: eaGradeEnum("grade"),
    categoryScores: json("category_scores").$type<CategoryScores>(),
    strengths: json("strengths").$type<string[]>(),
    weaknesses: json("weaknesses").$type<string[]>(),
    improvements: json("improvements").$type<string[]>(),
    detailedFeedback: text("detailed_feedback"),
    verdict: text("verdict"),
    aiDetected: boolean("ai_detected").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    statusIdx: index("ea_evaluations_status_idx").on(table.status),
    gradeIdx: index("ea_evaluations_grade_idx").on(table.grade),
  })
);

// ─────────────────────────────────────────────
// Manual / assessor scores
// ─────────────────────────────────────────────
export const emailAssessmentSessionManualScores = mysqlTable(
  "email_assessment_session_manual_scores",
  {
    sessionId: varchar("session_id", { length: 36 }).primaryKey(),
    score: int("score").notNull(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  }
);

export const emailAssessmentManualScores = mysqlTable(
  "email_assessment_manual_scores",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    submissionId: varchar("submission_id", { length: 36 })
      .notNull()
      .references(() => emailAssessmentSubmissions.id, { onDelete: "cascade" }),
    assessorId: varchar("assessor_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    overallScore: int("overall_score").notNull(),
    grade: eaGradeEnum("grade").notNull(),
    categoryScores: json("category_scores").$type<CategoryScores>().notNull(),
    summary: text("summary").notNull(),
    improvementAreas: json("improvement_areas").$type<string[]>().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    submissionIdx: index("ea_manual_scores_submission_idx").on(table.submissionId),
    assessorIdx: index("ea_manual_scores_assessor_idx").on(table.assessorId),
  })
);

// ─────────────────────────────────────────────
// AI request / response logging
// ─────────────────────────────────────────────
export const emailAssessmentAiRequests = mysqlTable(
  "email_assessment_ai_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    submissionId: varchar("submission_id", { length: 36 })
      .notNull()
      .references(() => emailAssessmentSubmissions.id, { onDelete: "cascade" }),
    promptVersionId: varchar("prompt_version_id", { length: 36 }).references(
      () => emailAssessmentPromptVersions.id,
      { onDelete: "set null" }
    ),
    model: varchar("model", { length: 120 }).notNull(),
    status: eaAiRequestStatusEnum("status").notNull().default("pending"),
    requestPayload: json("request_payload").notNull(),
    inputTokens: int("input_tokens"),
    outputTokens: int("output_tokens"),
    costUsdCents: int("cost_usd_cents"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    submissionIdx: index("ea_ai_requests_submission_idx").on(table.submissionId),
    statusIdx: index("ea_ai_requests_status_idx").on(table.status),
  })
);

export const emailAssessmentAiResponses = mysqlTable("email_assessment_ai_responses", {
  id: varchar("id", { length: 36 }).primaryKey(),
  aiRequestId: varchar("ai_request_id", { length: 36 })
    .notNull()
    .references(() => emailAssessmentAiRequests.id, { onDelete: "cascade" }),
  rawResponse: json("raw_response").notNull(),
  validationErrors: json("validation_errors").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// Audit logs
// ─────────────────────────────────────────────
export const emailAssessmentAuditLogs = mysqlTable(
  "email_assessment_audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    actorId: varchar("actor_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    action: eaAuditActionEnum("action").notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }),
    metadata: json("metadata").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    actorIdx: index("ea_audit_logs_actor_idx").on(table.actorId),
    actionIdx: index("ea_audit_logs_action_idx").on(table.action),
    entityIdx: index("ea_audit_logs_entity_idx").on(table.entityType, table.entityId),
  })
);

// ─────────────────────────────────────────────
// Rate limits
// ─────────────────────────────────────────────
export const emailAssessmentRateLimits = mysqlTable("email_assessment_rate_limits", {
  key: varchar("key", { length: 240 }).primaryKey(),
  windowStart: timestamp("window_start").notNull(),
  count: int("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
