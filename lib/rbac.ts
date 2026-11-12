// ─────────────────────────────────────────────────────────────────────────
// Central RBAC policy — the single source of truth for "which role may do
// what". Roles never appear in guards directly: a role maps to a set of
// PERMISSIONS here, and every page/API/nav check asks `can(role, permission)`.
// Consumed by `proxy.ts` (coarse gate at the network boundary) and by the
// server-side guards (lib/admin/guard.ts, lib/labs/auth.ts,
// lib/emailAssessment/auth.ts, lib/labPractice/identity.ts).
//
// Roles (DB/schema.ts APP_USER_ROLES):
//   devAdmin  — super admin: everything, incl. granting roles / credentials
//   admin     — read-only admin panel + logs; edits lab content; Guided Labs trainer
//   executive — sees EVERYTHING (incl. admin panel) but changes NOTHING
//   trainer   — edits Technical + Communication lab content; Guided Labs trainer
//   auditor   — reviews Communication Lab results/audio and overrides AI scores
//   user      — uses labs, simulators, resources, quizzes; sees only their own results
//
// ABAC (attribute) rules live next to the data they protect, on top of these
// permissions: a user sees only their OWN sessions/results; a Guided Labs
// trainer acts only on enrollments THEY own (lib/labPractice/identity.ts);
// nobody changes their own role; whitelisted devAdmins can't be demoted from
// the panel; and READ_ONLY_ROLES are refused every mutating request in
// proxy.ts regardless of permission.
// ─────────────────────────────────────────────────────────────────────────

import { APP_USER_ROLES, type AppUserRole } from "@/DB/schema";

export { APP_USER_ROLES };
export type Role = AppUserRole;

export const PERMISSIONS = [
  /** Enter /admin (own password, activity log, user list). */
  "adminPanel.view",
  /** Grant/revoke roles and provision/revoke credential passwords. */
  "users.manage",
  /** Activity log, page-visit and site-time analytics. */
  "logs.view",
  /** Break-glass password login (in addition to SSO). */
  "credentials.login",
  /** See content-admin screens: Interview modules/question banks, email
   *  scenarios/prompts, Technical Lab content admin, attempt overrides,
   *  module capabilities. */
  "content.view",
  /** Create / edit / delete that content. */
  "content.edit",
  /** See everyone's Communication Lab results, transcripts and audio. */
  "results.view",
  /** Replace an AI score with a manual score. */
  "scores.override",
  /** Act as a Guided Labs trainer (build curriculum, assign + review trainees). */
  "guidedLabs.train",
  /** Read every Guided Labs enrollment (oversight). */
  "guidedLabs.viewAll",
  /** Unassign / re-assign ANY Guided Labs enrollment, not just their own. */
  "guidedLabs.manageAll",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  devAdmin: ALL,
  admin: [
    "adminPanel.view",
    "logs.view",
    "credentials.login",
    "content.view",
    "content.edit",
    "results.view",
    "guidedLabs.train",
    "guidedLabs.viewAll",
    "guidedLabs.manageAll",
  ],
  // Read-only everywhere: every *.view permission, nothing that writes.
  // proxy.ts additionally refuses all its mutating requests (READ_ONLY_ROLES).
  executive: [
    "adminPanel.view",
    "logs.view",
    "credentials.login",
    "content.view",
    "results.view",
    "guidedLabs.viewAll",
  ],
  trainer: ["content.view", "content.edit", "results.view", "guidedLabs.train"],
  auditor: ["results.view", "scores.override"],
  user: [],
};

/** Roles that may never mutate anything (enforced in proxy.ts for every
 *  non-GET request, on top of the per-route permission checks). */
export const READ_ONLY_ROLES: readonly Role[] = ["executive"];

/** Mutations a read-only role may still make: signing in/out, their own
 *  password, and passive telemetry. Prefixes, segment-aware. */
export const READ_ONLY_MUTATION_ALLOWLIST: readonly string[] = [
  "/api/auth",
  "/api/admin/password",
  "/api/admin/page-visits",
  "/api/labs/site-sessions",
  "/api/labs/simulator-sessions",
  "/api/labs/simulator-state", // their own simulator save-state, so simulators work
];

/** Short human description per role (admin panel role picker). */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  devAdmin: "Super admin — full access, manages roles",
  admin: "Read-only admin panel, logs; edits lab content",
  executive: "Sees everything, changes nothing",
  trainer: "Edits lab content, runs Guided Labs",
  auditor: "Reviews audio, overrides AI scores",
  user: "Uses labs, simulators, resources, quizzes",
};

function asRole(role: string | null | undefined): Role | null {
  return role && (APP_USER_ROLES as readonly string[]).includes(role) ? (role as Role) : null;
}

/** THE permission check. Unknown / missing roles have no permissions. */
export function can(role: string | null | undefined, permission: Permission): boolean {
  const r = asRole(role);
  return !!r && ROLE_PERMISSIONS[r].includes(permission);
}

/** Roles holding a permission — for route rules. */
export function rolesWith(permission: Permission): readonly Role[] {
  return APP_USER_ROLES.filter((r) => ROLE_PERMISSIONS[r].includes(permission));
}

export function isReadOnlyRole(role: string | null | undefined): boolean {
  const r = asRole(role);
  return !!r && READ_ONLY_ROLES.includes(r);
}

/** Every role is grantable from the panel by a devAdmin (self-changes and
 *  demoting whitelisted devAdmins are refused by the API). */
export const GRANTABLE_ROLES: readonly Role[] = APP_USER_ROLES;

// ─────────────────────────────────────────────────────────────────────────
// Route rules (proxy.ts)
// ─────────────────────────────────────────────────────────────────────────

/**
 * A route-access rule. `prefix` is matched against the pathname with a
 * path-segment-aware startsWith (so "/dashboard/labs/admin" matches
 * "/dashboard/labs/admin" and "/dashboard/labs/admin/x" but NOT
 * "/dashboard/labs/administrators"). Rules are evaluated in array order and the
 * FIRST matching rule wins — so list the most specific prefixes first.
 *
 * `permission` is required to reach the prefix. Omitted means "any
 * authenticated user" (still requires login).
 */
export type RouteRule = {
  prefix: string;
  permission?: Permission;
  /** Human note for maintainers; not used at runtime. */
  note?: string;
};

/**
 * Ordered, most-specific-first. Anything under /dashboard that does not match a
 * more specific rule falls through to the catch-all at the bottom (any
 * authenticated user). Public routes (login page, auth endpoints, static
 * assets) are handled by the matcher in proxy.ts and never reach these rules.
 * Keep in sync with the `permission` links in lib/dashboard-nav-data.ts.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  // Admin panel. /admin/users is visible to every panel role (read-only for
  // all but users.manage — the page and API enforce that).
  { prefix: "/admin/activity", permission: "logs.view", note: "Activity log" },
  { prefix: "/admin", permission: "adminPanel.view", note: "Admin panel" },

  // Technical Lab content admin
  { prefix: "/dashboard/labs/admin", permission: "content.view", note: "Labs content admin" },

  // Guided Labs trainer workspace (role-based — there is no separate registry)
  { prefix: "/dashboard/guided-labs/trainer", permission: "guidedLabs.train", note: "Trainer workspace" },

  // Interview admin
  { prefix: "/dashboard/interview/Module", permission: "content.view", note: "Interview modules admin" },
  { prefix: "/dashboard/interview/results", permission: "results.view", note: "Interview results / audio audit" },

  // Email-assessment admin. /take and /my-evaluations are learner routes and
  // must precede the base Sessions rule.
  { prefix: "/dashboard/emailAssessments/scenarios", permission: "content.view", note: "Scenarios admin" },
  { prefix: "/dashboard/emailAssessments/prompts", permission: "content.view", note: "Prompts admin" },
  { prefix: "/dashboard/emailAssessments/sessions", permission: "results.view", note: "Session detail / scoring" },
  { prefix: "/dashboard/emailAssessments/take", note: "Learner route" },
  { prefix: "/dashboard/emailAssessments/my-evaluations", note: "Own results" },
  { prefix: "/dashboard/emailAssessments", permission: "results.view", note: "Sessions index" },

  // Cross-module admin config
  { prefix: "/dashboard/AttemptOverrides", permission: "content.view", note: "Practice attempt overrides" },
  { prefix: "/dashboard/ModuleCapabilities", permission: "content.view", note: "Interview module capabilities" },

  // Catch-all: any authenticated user may reach the rest of the dashboard.
  { prefix: "/dashboard", note: "Authenticated area" },
] as const;

/** Segment-aware prefix match: "/a/b" matches "/a/b" and "/a/b/c", not "/a/bc". */
export function pathHasPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  return pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

export type AccessDecision =
  | { kind: "public" } // no rule matched → not a protected path
  | { kind: "allow" }
  | { kind: "needsAuth" } // matched a rule but the user is not logged in
  | { kind: "forbidden"; permission: Permission }; // logged in, lacks permission

/**
 * Evaluate the RBAC policy for a pathname + the requester's role (or null when
 * unauthenticated). Pure and dependency-free so it can run anywhere (proxy,
 * server components, unit tests).
 */
export function evaluateAccess(pathname: string, role: string | null): AccessDecision {
  const rule = ROUTE_RULES.find((r) => pathHasPrefix(pathname, r.prefix));
  if (!rule) return { kind: "public" };
  if (!role) return { kind: "needsAuth" };
  if (!rule.permission || can(role, rule.permission)) return { kind: "allow" };
  return { kind: "forbidden", permission: rule.permission };
}

/** True when a read-only role's mutating request must be refused. */
export function blocksReadOnlyMutation(
  role: string | null,
  method: string,
  pathname: string,
): boolean {
  if (!isReadOnlyRole(role)) return false;
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  return !READ_ONLY_MUTATION_ALLOWLIST.some((p) => pathHasPrefix(pathname, p));
}
