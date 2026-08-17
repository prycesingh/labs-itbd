// ─────────────────────────────────────────────────────────────────────────
// Central RBAC policy — the single source of truth for "which roles may reach
// which routes". Consumed by `proxy.ts` (coarse gate at the network boundary)
// and can be reused by server-component / API guards for defense in depth.
//
// FUTUREPROOFING: the role vocabulary mirrors `APP_USER_ROLES` in DB/schema.ts.
// To add a role (e.g. "trainer"), add it to APP_USER_ROLES and, if it needs
// special route access, add/adjust a rule below. No proxy logic changes are
// needed — the proxy just evaluates this table top-to-bottom.
// ─────────────────────────────────────────────────────────────────────────

import { APP_USER_ROLES, type AppUserRole } from "@/DB/schema";

export { APP_USER_ROLES };
export type Role = AppUserRole;

/**
 * A route-access rule. `prefix` is matched against the pathname with a
 * path-segment-aware startsWith (so "/dashboard/labs/admin" matches
 * "/dashboard/labs/admin" and "/dashboard/labs/admin/x" but NOT
 * "/dashboard/labs/administrators"). Rules are evaluated in array order and the
 * FIRST matching rule wins — so list the most specific prefixes first.
 *
 * `allow` lists the roles permitted on that prefix. An empty/omitted `allow`
 * means "any authenticated user" (still requires login).
 */
export type RouteRule = {
  prefix: string;
  allow?: readonly Role[];
  /** Human note for maintainers; not used at runtime. */
  note?: string;
};

// ── Role groups ──────────────────────────────────────────────────────────
// Semantic groupings so route rules and guards never hardcode a concrete role
// like "devAdmin". To make a new role administrative (e.g. a future "admin" or
// "trainer" with admin rights), add it to ADMIN_ROLES here — every rule and
// every `isAdminRole()` caller picks it up automatically. This is the ONE place
// the notion of "who is an admin" lives.
export const ADMIN_ROLES = [
  "devAdmin",
  "executive",
] as const satisfies readonly Role[];

/** True when the role is part of the administrative group. Prefer this over
 *  comparing against "devAdmin" directly anywhere in the app. */
export function isAdminRole(role: Role | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly Role[]).includes(role);
}

// Superuser roles — may manage OTHER users (grant/revoke roles, provision
// credentials). A strict subset of ADMIN_ROLES. Kept separate so "can log in as
// admin" (ADMIN_ROLES) and "can administer users" (SUPERADMIN_ROLES) are
// independent, futureproof knobs. To let a future role manage users, add it
// here — no literal `devAdmin` checks anywhere else in the app.
export const SUPERADMIN_ROLES = [
  "devAdmin",
] as const satisfies readonly Role[];

/** True when the role may manage other users. Prefer over `=== "devAdmin"`. */
export function isSuperAdmin(role: Role | null | undefined): boolean {
  return !!role && (SUPERADMIN_ROLES as readonly Role[]).includes(role);
}

/** Roles a superadmin is allowed to assign to others. Everything except the
 *  superuser tier itself is grantable via the panel (a superadmin promoting
 *  another superadmin should be a deliberate, code-level/whitelist action, not
 *  a click). Adjust freely as the role model grows. */
export const GRANTABLE_ROLES = APP_USER_ROLES.filter(
  (r) => !(SUPERADMIN_ROLES as readonly Role[]).includes(r),
) as readonly Role[];

/**
 * Ordered, most-specific-first. Anything under /dashboard that does not match a
 * more specific rule falls through to the catch-all at the bottom (any
 * authenticated user). Public routes (login page, auth endpoints, static
 * assets) are handled by the matcher in proxy.ts and never reach these rules.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  // Top-level admin panel. User management lives at /admin/users and is
  // superadmin-only; the rest of /admin is open to any admin role. (Most
  // specific first.)
  {
    prefix: "/admin/users",
    allow: SUPERADMIN_ROLES,
    note: "User/role/credential management — superadmin only",
  },
  {
    prefix: "/admin",
    allow: ADMIN_ROLES,
    note: "Admin panel (profile, own password) — any admin role",
  },

  // ── Module admin surfaces — administrative roles only. These MUST match the
  // real route paths (there is no shared /admin sub-segment). Keep this list in
  // sync with the `adminOnly` links in components/app_componentes/dashboard-nav.
  // Most-specific first so e.g. /dashboard/emailAssessments/take (a learner
  // route) is NOT caught by the /dashboard/emailAssessments (Sessions) rule.

  // Labs admin
  {
    prefix: "/dashboard/labs/admin",
    allow: ADMIN_ROLES,
    note: "Labs content administration (glossary, seed/import)",
  },

  // Interview admin
  {
    prefix: "/dashboard/interview/Module",
    allow: ADMIN_ROLES,
    note: "Interview modules admin",
  },
  {
    prefix: "/dashboard/interview/results",
    allow: ADMIN_ROLES,
    note: "Interview results admin",
  },
  // Email-assessment admin. NOTE: /dashboard/emailAssessments/take is the
  // learner route and must stay open — it is excluded by listing the specific
  // admin sub-paths and the base index rule below (which uses an exact/segment
  // match, so it won't swallow /take).
  {
    prefix: "/dashboard/emailAssessments/scenarios",
    allow: ADMIN_ROLES,
    note: "Email-assessment scenarios admin",
  },
  {
    prefix: "/dashboard/emailAssessments/prompts",
    allow: ADMIN_ROLES,
    note: "Email-assessment prompts admin",
  },
  {
    prefix: "/dashboard/emailAssessments/sessions",
    allow: ADMIN_ROLES,
    note: "Email-assessment sessions admin (detail routes)",
  },
  {
    prefix: "/dashboard/emailAssessments/take",
    allow: undefined,
    note: "Learner route — any authenticated user (must precede the base rule)",
  },
  {
    prefix: "/dashboard/emailAssessments/my-evaluations",
    allow: undefined,
    note: "Candidate's own past results — any authenticated user (must precede the base rule)",
  },
  {
    prefix: "/dashboard/emailAssessments",
    allow: ADMIN_ROLES,
    note: "Email-assessment Sessions index (admin landing)",
  },

  // Shared cross-module admin surface (covers both Interview and
  // Email Assessment practice-attempt overrides).
  {
    prefix: "/dashboard/AttemptOverrides",
    allow: ADMIN_ROLES,
    note: "Per-user practice attempt overrides admin (Interview + Email Assessment)",
  },

  // Catch-all: any authenticated user may reach the rest of the dashboard.
  { prefix: "/dashboard", allow: undefined, note: "Authenticated area" },
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
  | { kind: "forbidden"; requiredRoles: readonly Role[] }; // logged in, wrong role

/**
 * Evaluate the RBAC policy for a pathname + the requester's role (or null when
 * unauthenticated). Pure and dependency-free so it can run anywhere (proxy,
 * server components, unit tests).
 */
export function evaluateAccess(
  pathname: string,
  role: Role | null,
): AccessDecision {
  const rule = ROUTE_RULES.find((r) => pathHasPrefix(pathname, r.prefix));
  if (!rule) return { kind: "public" };

  if (!role) return { kind: "needsAuth" };

  // No `allow` list → any authenticated user is fine.
  if (!rule.allow || rule.allow.length === 0) return { kind: "allow" };

  return rule.allow.includes(role)
    ? { kind: "allow" }
    : { kind: "forbidden", requiredRoles: rule.allow };
}
