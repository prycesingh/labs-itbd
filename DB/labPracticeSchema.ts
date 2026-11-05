/**
 * Lab Practice Tracker Schema — MySQL/MariaDB Compatible (DBML v3)
 *
 * Curriculum hierarchy: Module -> Lab -> Task -> Step.
 * Completion rolls up steps -> task -> lab -> module and is ALWAYS computed
 * (see lib/labPractice/progression.ts) — no rollup or "unlocked" state is
 * stored, so adding/deactivating curriculum never leaves stale progress rows.
 *
 * All tables are prefixed `lab_practice_` (`labs_` is already used by the
 * Technical Lab reference content in DB/labsSchema.ts).
 *
 * Identity: people come from the external HRIS REST API and are cached in
 * `lab_practice_employees` (synced by lib/labPractice/hris.ts). A signed-in
 * SSO user maps to an employee by email (users.email = employees.email). The
 * shared `users` table is NOT referenced by FK here because a trainee can be
 * enrolled before they have ever signed in.
 *
 * FK names are given explicitly: Drizzle's generated names would exceed
 * MySQL's 64-char identifier limit for these long table names.
 *
 * Deletes are `restrict` almost everywhere — curriculum and enrollments are
 * retired with `is_active` instead, so history is never lost. The single
 * cascade is completion -> files (un-marking a step removes its photos).
 */

import {
  boolean,
  date,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// Enums (values live in a client-safe module so UI code can import them
// without pulling drizzle into the browser bundle)
// ─────────────────────────────────────────────
import { PROGRESSION_MODES, type ProgressionMode } from "../lib/labPractice/constants";

export { PROGRESSION_MODES };
export type { ProgressionMode };

// ─────────────────────────────────────────────
// People
// ─────────────────────────────────────────────

/** Local cache of HRIS employees. Owned by the HRIS sync — do not hand-edit
 *  in production (dev seeding is fine). Missing-from-HRIS rows are
 *  deactivated, never deleted, because enrollments reference them. */
export const labPracticeEmployees = mysqlTable(
  "lab_practice_employees",
  {
    id: int("id").autoincrement().primaryKey(),
    empId: varchar("emp_id", { length: 20 }).notNull(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lp_emp_emp_id_uq").on(t.empId),
    uniqueIndex("lp_emp_email_uq").on(t.email),
  ],
);

/** Trainer registry — the ONLY source of trainer authority (no app role). */
export const labPracticeTrainers = mysqlTable(
  "lab_practice_trainers",
  {
    id: int("id").autoincrement().primaryKey(),
    employeeId: int("employee_id").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    registeredAt: timestamp("registered_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lp_trainer_employee_uq").on(t.employeeId),
    foreignKey({
      name: "lp_trainer_employee_fk",
      columns: [t.employeeId],
      foreignColumns: [labPracticeEmployees.id],
    }).onDelete("restrict"),
  ],
);

// ─────────────────────────────────────────────
// Curriculum
// ─────────────────────────────────────────────
export const labPracticeModules = mysqlTable(
  "lab_practice_modules",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    info: text("info"),
    progressionMode: mysqlEnum("progression_mode", PROGRESSION_MODES)
      .notNull()
      .default("fully_sequential"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: int("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => [
    uniqueIndex("lp_module_title_uq").on(t.title),
    foreignKey({
      name: "lp_module_created_by_fk",
      columns: [t.createdBy],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);

export const labPracticeLabs = mysqlTable(
  "lab_practice_labs",
  {
    id: int("id").autoincrement().primaryKey(),
    moduleId: int("module_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    details: text("details"),
    sequenceNo: int("sequence_no").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: int("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => [
    uniqueIndex("lp_lab_module_title_uq").on(t.moduleId, t.title),
    uniqueIndex("lp_lab_module_seq_uq").on(t.moduleId, t.sequenceNo),
    foreignKey({
      name: "lp_lab_module_fk",
      columns: [t.moduleId],
      foreignColumns: [labPracticeModules.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_lab_created_by_fk",
      columns: [t.createdBy],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);

export const labPracticeTasks = mysqlTable(
  "lab_practice_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    labId: int("lab_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    sequenceNo: int("sequence_no").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: int("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => [
    uniqueIndex("lp_task_lab_title_uq").on(t.labId, t.title),
    uniqueIndex("lp_task_lab_seq_uq").on(t.labId, t.sequenceNo),
    foreignKey({
      name: "lp_task_lab_fk",
      columns: [t.labId],
      foreignColumns: [labPracticeLabs.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_task_created_by_fk",
      columns: [t.createdBy],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);

export const labPracticeSteps = mysqlTable(
  "lab_practice_steps",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("task_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    instructions: text("instructions"),
    sequenceNo: int("sequence_no").notNull(),
    // When true, at least 1 image is needed to mark the step complete.
    requiresPhoto: boolean("requires_photo").notNull().default(false),
    // Inactive steps are excluded from completion counts and unlock logic.
    isActive: boolean("is_active").notNull().default(true),
    createdBy: int("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => [
    uniqueIndex("lp_step_task_title_uq").on(t.taskId, t.title),
    uniqueIndex("lp_step_task_seq_uq").on(t.taskId, t.sequenceNo),
    foreignKey({
      name: "lp_step_task_fk",
      columns: [t.taskId],
      foreignColumns: [labPracticeTasks.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_step_created_by_fk",
      columns: [t.createdBy],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);

// ─────────────────────────────────────────────
// Assignment
// ─────────────────────────────────────────────
export const labPracticeEnrollments = mysqlTable(
  "lab_practice_module_enrollments",
  {
    id: int("id").autoincrement().primaryKey(),
    moduleId: int("module_id").notNull(),
    traineeId: int("trainee_id").notNull(), // lab_practice_employees.id
    trainerId: int("trainer_id").notNull(), // trainer who assigned + owns this trainee
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    // Unassign without losing history; inactive = read-only for the trainee.
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("uq_trainee_once_per_module").on(t.moduleId, t.traineeId),
    index("lp_enroll_trainer_idx").on(t.trainerId),
    index("lp_enroll_trainee_idx").on(t.traineeId),
    foreignKey({
      name: "lp_enroll_module_fk",
      columns: [t.moduleId],
      foreignColumns: [labPracticeModules.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_enroll_trainee_fk",
      columns: [t.traineeId],
      foreignColumns: [labPracticeEmployees.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_enroll_trainer_fk",
      columns: [t.trainerId],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);

// ─────────────────────────────────────────────
// Daily practice log
// ─────────────────────────────────────────────
export const labPracticeSessions = mysqlTable(
  "lab_practice_practice_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    enrollmentId: int("enrollment_id").notNull(),
    // Calendar date practiced, computed server-side in LAB_PRACTICE_TZ.
    practiceDate: date("practice_date", { mode: "string" }).notNull(),
    additionalComments: text("additional_comments"), // one comment per day
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => [
    uniqueIndex("uq_one_session_per_day").on(t.enrollmentId, t.practiceDate),
    // Target for the composite FK from step_completions — guarantees a
    // completion's session belongs to the SAME enrollment.
    uniqueIndex("uq_session_enrollment_pair").on(t.id, t.enrollmentId),
    foreignKey({
      name: "lp_session_enrollment_fk",
      columns: [t.enrollmentId],
      foreignColumns: [labPracticeEnrollments.id],
    }).onDelete("restrict"),
  ],
);

// ─────────────────────────────────────────────
// Step completion
// ─────────────────────────────────────────────

/** Self-marked by the trainee. Un-marking (or trainer rejection) deletes the
 *  row; its file rows cascade, and the files on disk are removed by the API.
 *  "Step belongs to the enrollment's module" is enforced in
 *  lib/labPractice/practice.ts (the repo uses no DB triggers). */
export const labPracticeStepCompletions = mysqlTable(
  "lab_practice_step_completions",
  {
    id: int("id").autoincrement().primaryKey(),
    enrollmentId: int("enrollment_id").notNull(),
    sessionId: int("session_id").notNull(), // which day it was done
    stepId: int("step_id").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_step_once_per_enrollment").on(t.enrollmentId, t.stepId),
    index("lp_completion_session_idx").on(t.sessionId),
    index("lp_completion_step_idx").on(t.stepId),
    foreignKey({
      name: "lp_completion_session_pair_fk",
      columns: [t.sessionId, t.enrollmentId],
      foreignColumns: [labPracticeSessions.id, labPracticeSessions.enrollmentId],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_completion_step_fk",
      columns: [t.stepId],
      foreignColumns: [labPracticeSteps.id],
    }).onDelete("restrict"),
  ],
);

/** Photo proof. Max 10 per completion, png/jpeg/webp, <= 10 MB — enforced in
 *  the API. `file_path` is the lib/uploads.ts id (relative to UPLOADS_ROOT)
 *  and is only ever served through the access-checked
 *  /api/lab-practice/files/[fileId] route, never /api/uploads. */
export const labPracticeStepCompletionFiles = mysqlTable(
  "lab_practice_step_completion_files",
  {
    id: int("id").autoincrement().primaryKey(),
    stepCompletionId: int("step_completion_id").notNull(),
    storedName: varchar("stored_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 50 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lp_file_stored_name_uq").on(t.storedName),
    index("lp_file_completion_idx").on(t.stepCompletionId),
    foreignKey({
      name: "lp_file_completion_fk",
      columns: [t.stepCompletionId],
      foreignColumns: [labPracticeStepCompletions.id],
    }).onDelete("cascade"),
  ],
);

/** Audit trail for trainer rejections. The completion row itself is deleted
 *  (so the step reverts to not-done); this row tells the trainee why. */
export const labPracticeStepRejections = mysqlTable(
  "lab_practice_step_rejections",
  {
    id: int("id").autoincrement().primaryKey(),
    enrollmentId: int("enrollment_id").notNull(),
    stepId: int("step_id").notNull(),
    rejectedBy: int("rejected_by").notNull(),
    reason: text("reason").notNull(),
    originalCompletedAt: timestamp("original_completed_at").notNull(),
    rejectedAt: timestamp("rejected_at").notNull().defaultNow(),
  },
  (t) => [
    index("lp_reject_enroll_step_idx").on(t.enrollmentId, t.stepId),
    foreignKey({
      name: "lp_reject_enrollment_fk",
      columns: [t.enrollmentId],
      foreignColumns: [labPracticeEnrollments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_reject_step_fk",
      columns: [t.stepId],
      foreignColumns: [labPracticeSteps.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_reject_trainer_fk",
      columns: [t.rejectedBy],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);
