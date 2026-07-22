import { sql } from "drizzle-orm";
import {
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

/**
 * Application user roles. The interview + email-assessment modules only need to
 * distinguish "devAdmin" (full admin/assessor) from everyone else, but we keep
 * the full vocabulary so role data ported from the source app stays valid.
 */
export const APP_USER_ROLES = [
  "devAdmin",
  "executive",
  "adminTeam",
  "sales",
  "taTeam",
  "qateam",
  "hrTeam",
  "serviceDelivery",
  "user",
] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

// ─────────────────────────────────────────────
// NextAuth (Auth.js) adapter tables
// ─────────────────────────────────────────────

export const users = mysqlTable(
  "users",
  {
    id: varchar({ length: 255 }).notNull().primaryKey(),
    name: varchar({ length: 255 }),
    email: varchar({ length: 255 }).notNull(),
    emailVerified: timestamp({ mode: "date" }),
    image: text(),
    role: varchar({ length: 50 })
      .$type<AppUserRole>()
      .default("user")
      .notNull(),
    username: varchar({ length: 50 }),
    // Break-glass credential login: holds a bcrypt hash (60 chars) for admins
    // who need to bypass SSO. Null for the SSO-only majority. Widened from
    // varchar(50) — a bcrypt hash does not fit in 50 chars. Never store
    // plaintext here. See the Credentials provider in auth.config.ts.
    password: varchar({ length: 255 }),
    // When true, the user was given a temporary password by a superadmin and
    // must change it on their next credential login before proceeding.
    mustChangePassword: int().default(0).notNull(),
    // Bumped whenever an admin changes this user's role (or otherwise needs to
    // force re-authentication). The auth jwt callback compares the value baked
    // into the user's cookie against this column and invalidates the session
    // when they differ, so the user is forced to log in again.
    sessionVersion: int().default(0).notNull(),
  },
  (table) => [unique("users_email_unique").on(table.email)],
);

export const accounts = mysqlTable(
  "accounts",
  {
    userId: varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar({ length: 255 }).notNull(),
    provider: varchar({ length: 255 }).notNull(),
    providerAccountId: varchar({ length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar({ length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [
    index("accounts_userId_idx").on(table.userId),
    primaryKey({
      columns: [table.provider, table.providerAccountId],
      name: "accounts_provider_providerAccountId",
    }),
  ],
);

export const sessions = mysqlTable(
  "sessions",
  {
    sessionToken: varchar({ length: 255 }).notNull().primaryKey(),
    userId: varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp({ mode: "date" }).notNull(),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const verificationTokens = mysqlTable(
  "verification_tokens",
  {
    identifier: varchar({ length: 255 }).notNull(),
    token: varchar({ length: 255 }).notNull(),
    expires: timestamp({ mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: "verification_tokens_identifier_token",
    }),
  ],
);

// ─────────────────────────────────────────────
// Background job queue (single-node, DB-authoritative)
// ─────────────────────────────────────────────

export const backgroundJobs = mysqlTable(
  "background_jobs",
  {
    id: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    activeLockKey: varchar("active_lock_key", { length: 100 }),
    status: mysqlEnum("status", [
      "queued",
      "running",
      "completed",
      "failed",
    ]).notNull(),
    progress: int().default(0).notNull(),
    attempts: int().default(0).notNull(),
    maxAttempts: int("max_attempts").default(3).notNull(),
    maxExecutionTimeMs: int("max_execution_time_ms")
      .default(15 * 60 * 1000)
      .notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { mode: "string" }),
    completedAt: timestamp("completed_at", { mode: "string" }),
    executionTimeMs: int("execution_time_ms"),
    error: text("error"),
    result: json("result"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    correlationId: varchar("correlation_id", { length: 255 }), // Links parent to child jobs
    parentJobId: varchar("parent_job_id", { length: 255 }), // Job hierarchy
    nextRetryAt: timestamp("next_retry_at", { mode: "string" }), // Scheduled retry time
    heartbeatAt: timestamp("heartbeat_at", { mode: "string" }), // Last progress ping
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "background_jobs_id" }),
    unique("background_jobs_active_lock_unique").on(table.activeLockKey),
    index("background_jobs_user_idx").on(table.userId),
    index("background_jobs_status_idx").on(table.status),
    index("background_jobs_name_status_idx").on(table.name, table.status),
    index("background_jobs_created_idx").on(table.createdAt),
    index("background_jobs_correlation_idx").on(table.correlationId),
    index("background_jobs_parent_idx").on(table.parentJobId),
    index("background_jobs_retry_idx").on(table.nextRetryAt),
  ],
);
