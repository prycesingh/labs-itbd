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
 * retired with `is_active` instead, so history is never lost. Cascades:
 * completion -> files (un-marking a step removes its photos), and the lab
 * visibility rows (batch labs / per-trainee overrides), which are settings,
 * not history.
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
    // What the lab covers — required. The DB column keeps its original name
    // `details` (migration 0017 is already applied); only the TS key changed.
    description: text("details").notNull(),
    // Optional real-world framing the trainee works through (e.g. "A client
    // reports their VPN drops every hour…").
    scenario: text("scenario"),
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
    // Optional pacing batch (same module). FK is SET NULL: deleting a batch
    // just returns its trainees to individual / default lab visibility.
    // The FK itself is declared in migration 0022 (lab_practice_batches is
    // defined below, so it can't be referenced here without a cycle).
    batchId: int("batch_id"),
  },
  (t) => [
    uniqueIndex("uq_trainee_once_per_module").on(t.moduleId, t.traineeId),
    index("lp_enroll_trainer_idx").on(t.trainerId),
    index("lp_enroll_trainee_idx").on(t.traineeId),
    index("lp_enroll_batch_idx").on(t.batchId),
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
// Lab visibility (pacing)
// ─────────────────────────────────────────────
//
// Which labs of a module a trainee can see. Resolved by the pure rule in
// lib/labPractice/visibility.ts:
//   base      = the batch's selected labs (if the enrollment is in a batch
//               with >= 1 selected lab), else just the FIRST active lab
//   overrides = per-enrollment Show/Hide rows, applied on top (they win)
// Hidden labs are excluded from the trainee's tree, progress and write
// guards exactly like inactive curriculum — completions are kept, not deleted.

// ─────────────────────────────────────────────
// Day schedules (e.g. a 30-day bootcamp) — span modules
// ─────────────────────────────────────────────

/** A day-by-day plan over labs from any modules. Shared across trainers
 *  (like curriculum); `created_by` records authorship only. */
export const labPracticeSchedules = mysqlTable(
  "lab_practice_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: int("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lp_schedule_name_uq").on(t.name),
    foreignKey({
      name: "lp_schedule_created_by_fk",
      columns: [t.createdBy],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
  ],
);

/** Day N of a schedule. `day_no` is kept contiguous (1..n) by the app. */
export const labPracticeScheduleDays = mysqlTable(
  "lab_practice_schedule_days",
  {
    id: int("id").autoincrement().primaryKey(),
    scheduleId: int("schedule_id").notNull(),
    dayNo: int("day_no").notNull(),
    title: varchar("title", { length: 200 }),
  },
  (t) => [
    uniqueIndex("lp_sched_day_no_uq").on(t.scheduleId, t.dayNo),
    foreignKey({
      name: "lp_sched_day_schedule_fk",
      columns: [t.scheduleId],
      foreignColumns: [labPracticeSchedules.id],
    }).onDelete("cascade"),
  ],
);

/** Labs placed in a day. A lab sits in at most ONE day per schedule. */
export const labPracticeScheduleDayLabs = mysqlTable(
  "lab_practice_schedule_day_labs",
  {
    scheduleId: int("schedule_id").notNull(),
    dayId: int("day_id").notNull(),
    labId: int("lab_id").notNull(),
    sequenceNo: int("sequence_no").notNull().default(0),
  },
  (t) => [
    uniqueIndex("lp_sched_lab_uq").on(t.scheduleId, t.labId),
    index("lp_sched_day_lab_day_idx").on(t.dayId),
    index("lp_sched_day_lab_lab_idx").on(t.labId),
    foreignKey({
      name: "lp_sched_day_lab_sched_fk",
      columns: [t.scheduleId],
      foreignColumns: [labPracticeSchedules.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lp_sched_day_lab_day_fk",
      columns: [t.dayId],
      foreignColumns: [labPracticeScheduleDays.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lp_sched_day_lab_lab_fk",
      columns: [t.labId],
      foreignColumns: [labPracticeLabs.id],
    }).onDelete("cascade"),
  ],
);

/**
 * A pacing group of trainees, owned by a trainer. Two kinds:
 *   module batch   — `module_id` set: one module; visible labs = batch_labs.
 *   schedule batch — `schedule_id` set (module_id null): spans every module
 *                    of the schedule; visible labs = labs in its ACTIVE days
 *                    (lab_practice_batch_days).
 */
export const labPracticeBatches = mysqlTable(
  "lab_practice_batches",
  {
    id: int("id").autoincrement().primaryKey(),
    moduleId: int("module_id"),
    scheduleId: int("schedule_id"),
    trainerId: int("trainer_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lp_batch_module_name_uq").on(t.moduleId, t.name),
    index("lp_batch_trainer_idx").on(t.trainerId),
    foreignKey({
      name: "lp_batch_module_fk",
      columns: [t.moduleId],
      foreignColumns: [labPracticeModules.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lp_batch_trainer_fk",
      columns: [t.trainerId],
      foreignColumns: [labPracticeTrainers.id],
    }).onDelete("restrict"),
    index("lp_batch_schedule_idx").on(t.scheduleId),
    foreignKey({
      name: "lp_batch_schedule_fk",
      columns: [t.scheduleId],
      foreignColumns: [labPracticeSchedules.id],
    }).onDelete("restrict"),
  ],
);

/** A schedule batch's ACTIVE days (one row per switched-on day). */
export const labPracticeBatchDays = mysqlTable(
  "lab_practice_batch_days",
  {
    batchId: int("batch_id").notNull(),
    dayId: int("day_id").notNull(),
  },
  (t) => [
    uniqueIndex("lp_batch_day_uq").on(t.batchId, t.dayId),
    index("lp_batch_day_day_idx").on(t.dayId),
    foreignKey({
      name: "lp_batch_day_batch_fk",
      columns: [t.batchId],
      foreignColumns: [labPracticeBatches.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lp_batch_day_day_fk",
      columns: [t.dayId],
      foreignColumns: [labPracticeScheduleDays.id],
    }).onDelete("cascade"),
  ],
);

/** Labs a batch currently shows (one row per visible lab). */
export const labPracticeBatchLabs = mysqlTable(
  "lab_practice_batch_labs",
  {
    batchId: int("batch_id").notNull(),
    labId: int("lab_id").notNull(),
  },
  (t) => [
    uniqueIndex("lp_batch_lab_uq").on(t.batchId, t.labId),
    index("lp_batch_lab_lab_idx").on(t.labId),
    foreignKey({
      name: "lp_batch_lab_batch_fk",
      columns: [t.batchId],
      foreignColumns: [labPracticeBatches.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lp_batch_lab_lab_fk",
      columns: [t.labId],
      foreignColumns: [labPracticeLabs.id],
    }).onDelete("cascade"),
  ],
);

/** Per-trainee Show (visible=true) / Hide (false) override for one lab. */
export const labPracticeEnrollmentLabOverrides = mysqlTable(
  "lab_practice_enrollment_lab_overrides",
  {
    enrollmentId: int("enrollment_id").notNull(),
    labId: int("lab_id").notNull(),
    visible: boolean("visible").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("lp_enroll_lab_ovr_uq").on(t.enrollmentId, t.labId),
    index("lp_enroll_lab_ovr_lab_idx").on(t.labId),
    foreignKey({
      name: "lp_enroll_lab_ovr_enroll_fk",
      columns: [t.enrollmentId],
      foreignColumns: [labPracticeEnrollments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lp_enroll_lab_ovr_lab_fk",
      columns: [t.labId],
      foreignColumns: [labPracticeLabs.id],
    }).onDelete("cascade"),
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
