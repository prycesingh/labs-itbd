/**
 * Labs Module Schema — MySQL/MariaDB Compatible
 *
 * Phase 1: reference content (glossary, quiz banks) ported from the standalone
 * "ITBD Technical Lab" static site, plus the user-generated quiz attempt data
 * that content produces.
 *
 * Phase 2: per-user simulator save state (`labsSimulatorStates`) — see that
 * table's comment for the persistence model.
 *
 * Phase 5 (Bucket A): structured reference content ported from the remaining
 * itbd-lab standalone pages that share glossary/quiz's flat-array-of-short-
 * fields shape (services catalog, cloud comparison, gotchas, cert roadmap,
 * production checklists, KQL playground, troubleshoot flowcharts). Each gets
 * its own table (not one shared table) since their fields genuinely differ.
 *
 * All tables are prefixed `labs_` to avoid colliding with other modules.
 * Candidate/author foreign keys reference the shared WMS `users` table
 * (DB/schema.ts) — there is no separate Labs user/auth model.
 */

import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./schema";

// ─────────────────────────────────────────────
// Enum helpers (MySQL ENUM type)
// ─────────────────────────────────────────────
export const labsQuizAttemptStatusEnum = (name: string) =>
  mysqlEnum(name, ["in_progress", "completed"]);

// ─────────────────────────────────────────────
// Glossary
// ─────────────────────────────────────────────
export const labsGlossaryTerms = mysqlTable(
  "labs_glossary_terms",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    term: varchar("term", { length: 160 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    definition: text("definition").notNull(),
    example: text("example"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    termIdx: uniqueIndex("labs_glossary_term_idx").on(table.term),
    categoryIdx: index("labs_glossary_category_idx").on(table.category),
  })
);

// ─────────────────────────────────────────────
// Services catalog
// ─────────────────────────────────────────────
export const labsServicesCatalog = mysqlTable(
  "labs_services_catalog",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    category: varchar("category", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    icon: varchar("icon", { length: 16 }),
    description: text("description").notNull(),
    whenToUse: text("when_to_use"),
    alternative: varchar("alternative", { length: 160 }),
    pricing: text("pricing"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("labs_services_catalog_name_idx").on(table.name),
    categoryIdx: index("labs_services_catalog_category_idx").on(table.category),
  })
);

// ─────────────────────────────────────────────
// Cloud comparison (Azure vs AWS vs GCP)
// ─────────────────────────────────────────────
export const labsCloudComparisons = mysqlTable(
  "labs_cloud_comparisons",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    category: varchar("category", { length: 80 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    azureEquivalent: varchar("azure_equivalent", { length: 200 }),
    awsEquivalent: varchar("aws_equivalent", { length: 200 }),
    gcpEquivalent: varchar("gcp_equivalent", { length: 200 }),
    note: text("note"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    labelIdx: uniqueIndex("labs_cloud_comparisons_label_idx").on(table.label),
    categoryIdx: index("labs_cloud_comparisons_category_idx").on(table.category),
  })
);

// ─────────────────────────────────────────────
// Gotchas (symptom -> cause -> fix)
// ─────────────────────────────────────────────
export const labsGotchas = mysqlTable(
  "labs_gotchas",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    category: varchar("category", { length: 80 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    symptom: text("symptom").notNull(),
    cause: text("cause").notNull(),
    fix: text("fix").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    titleIdx: uniqueIndex("labs_gotchas_title_idx").on(table.title),
    categoryIdx: index("labs_gotchas_category_idx").on(table.category),
  })
);

// ─────────────────────────────────────────────
// Certification roadmap
// ─────────────────────────────────────────────
export const labsCertRoadmapEntries = mysqlTable(
  "labs_cert_roadmap_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    certCode: varchar("cert_code", { length: 20 }).notNull(),
    certName: varchar("cert_name", { length: 160 }).notNull(),
    level: varchar("level", { length: 40 }).notNull(),
    track: varchar("track", { length: 60 }).notNull(),
    description: text("description").notNull(),
    studyTime: varchar("study_time", { length: 80 }),
    examFormat: varchar("exam_format", { length: 120 }),
    passingScore: varchar("passing_score", { length: 40 }),
    pricing: varchar("pricing", { length: 80 }),
    relatedSims: varchar("related_sims", { length: 200 }),
    skills: json("skills").$type<string[]>().notNull().default([]),
    tips: text("tips"),
    relatedSimulatorKeys: json("related_simulator_keys").$type<string[]>().notNull().default([]),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    certCodeIdx: uniqueIndex("labs_cert_roadmap_code_idx").on(table.certCode),
    trackIdx: index("labs_cert_roadmap_track_idx").on(table.track),
  })
);

// ─────────────────────────────────────────────
// Production checklists (checklist -> category -> item)
// ─────────────────────────────────────────────
export const labsProductionChecklistItems = mysqlTable(
  "labs_production_checklist_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    checklistName: varchar("checklist_name", { length: 120 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    item: text("item").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    checklistIdx: index("labs_production_checklist_name_idx").on(table.checklistName),
  })
);

// ─────────────────────────────────────────────
// KQL playground queries
// ─────────────────────────────────────────────
export const labsKqlPlaygroundQueries = mysqlTable(
  "labs_kql_playground_queries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    level: varchar("level", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    kqlQuery: text("kql_query").notNull(),
    explanation: text("explanation"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    titleIdx: uniqueIndex("labs_kql_playground_title_idx").on(table.title),
    levelIdx: index("labs_kql_playground_level_idx").on(table.level),
  })
);

// ─────────────────────────────────────────────
// Troubleshoot flowcharts (flow -> ordered steps)
// ─────────────────────────────────────────────
/**
 * One row per step within a named flow. Source models each flow as a
 * LINEAR, top-to-bottom numbered runbook (not a branching {q, yes, no}
 * decision tree like the network simulator's own troubleshoot.js) — every
 * step is colour-coded by `stepType` (question/action/success/failure) and
 * walked strictly in `stepIndex` order, with no yes/no branch targets.
 */
export const labsTroubleshootFlowchartSteps = mysqlTable(
  "labs_troubleshoot_flowchart_steps",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    flowName: varchar("flow_name", { length: 160 }).notNull(),
    stepIndex: int("step_index").notNull(),
    stepType: varchar("step_type", { length: 20 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    flowIdx: index("labs_troubleshoot_flowchart_flow_idx").on(table.flowName),
  })
);

// ─────────────────────────────────────────────
// Articles (Phase 5, Bucket B): long-form prose/cheat-sheet/playbook pages
// ported from the remaining itbd-lab standalone pages, stored as a single
// markdown body rather than atomic fields — there is no cross-page query or
// filter requirement that would justify a bespoke schema per page.
// ─────────────────────────────────────────────
export const labsArticles = mysqlTable(
  "labs_articles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    sourcePage: varchar("source_page", { length: 120 }).notNull(),
    summary: text("summary"),
    bodyMarkdown: text("body_markdown").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("labs_articles_slug_idx").on(table.slug),
    categoryIdx: index("labs_articles_category_idx").on(table.category),
  })
);

// ─────────────────────────────────────────────
// Quiz certs + question bank (admin-authored reference content)
// ─────────────────────────────────────────────
export const labsQuizCerts = mysqlTable(
  "labs_quiz_certs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex("labs_quiz_certs_code_idx").on(table.code),
    activeIdx: index("labs_quiz_certs_active_idx").on(table.active),
  })
);

/**
 * `options` is the ordered list of choice strings. `correctIndexes` holds one
 * or more indexes into `options` — most questions are single-answer (one
 * index) but the source bank includes "select all that apply" questions with
 * multiple correct indexes, so this is always an array.
 */
export const labsQuizQuestions = mysqlTable(
  "labs_quiz_questions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    certId: varchar("cert_id", { length: 36 })
      .notNull()
      .references(() => labsQuizCerts.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: json("options").$type<string[]>().notNull(),
    correctIndexes: json("correct_indexes").$type<number[]>().notNull(),
    explanation: text("explanation").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    certIdx: index("labs_quiz_questions_cert_idx").on(table.certId),
    activeIdx: index("labs_quiz_questions_active_idx").on(table.active),
  })
);

// ─────────────────────────────────────────────
// Quiz attempts + answers (user-generated)
// ─────────────────────────────────────────────
export const labsQuizAttempts = mysqlTable(
  "labs_quiz_attempts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    certId: varchar("cert_id", { length: 36 })
      .notNull()
      .references(() => labsQuizCerts.id, { onDelete: "cascade" }),
    status: labsQuizAttemptStatusEnum("status").notNull().default("in_progress"),
    totalQuestions: int("total_questions").notNull(),
    correctCount: int("correct_count"),
    scorePercent: int("score_percent"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userIdx: index("labs_quiz_attempts_user_idx").on(table.userId),
    certIdx: index("labs_quiz_attempts_cert_idx").on(table.certId),
    statusIdx: index("labs_quiz_attempts_status_idx").on(table.status),
  })
);

export const labsQuizAnswers = mysqlTable(
  "labs_quiz_answers",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    attemptId: varchar("attempt_id", { length: 36 })
      .notNull()
      .references(() => labsQuizAttempts.id, { onDelete: "cascade" }),
    questionId: varchar("question_id", { length: 36 })
      .notNull()
      .references(() => labsQuizQuestions.id, { onDelete: "cascade" }),
    selectedIndexes: json("selected_indexes").$type<number[]>().notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
  },
  (table) => ({
    attemptIdx: index("labs_quiz_answers_attempt_idx").on(table.attemptId),
    questionIdx: index("labs_quiz_answers_question_idx").on(table.questionId),
  })
);

// ─────────────────────────────────────────────
// Simulator save state (per-user, per-simulator)
// ─────────────────────────────────────────────
/**
 * One row per (user, simulator). `stateJson` holds that simulator's entire
 * working state (e.g. the Azure sim's resources + activity log) as an
 * opaque blob — same shape as the source static site's per-simulator
 * localStorage key, just scoped to one user instead of one browser.
 *
 * This is a save-slot, not an audit trail: it's overwritten wholesale on
 * each save (debounced client-side), not appended to. Simulated resource
 * churn lost between saves is acceptable; the durable value is that a
 * learner's simulator progress survives logout/return and is never shared
 * across concurrent users of the same simulator.
 */
export const labsSimulatorStates = mysqlTable(
  "labs_simulator_states",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    simulatorKey: varchar("simulator_key", { length: 60 }).notNull(),
    stateJson: json("state_json").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.simulatorKey] }),
  })
);
