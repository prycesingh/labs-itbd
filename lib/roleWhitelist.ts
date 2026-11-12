import type { Role } from "@/lib/rbac";

/**
 * Email whitelists that seed roles at sign-in (auth.config.ts). Extendable via
 * DEVADMIN_WHITELIST_EMAILS / EXECUTIVE_WHITELIST_EMAILS (comma-separated).
 *
 *  - devAdmin whitelist = a FLOOR: these people are devAdmin on every sign-in
 *    and the panel refuses to change their role. This is the break-glass that
 *    guarantees someone can always manage roles.
 *  - executive whitelist = BOOTSTRAP only: applied while the person is still a
 *    plain "user"; once a devAdmin assigns any role in the panel, that wins.
 */

const DEFAULT_DEVADMIN_WHITELIST_EMAILS = [
  "kkaila@itbd.net",
  "sunny.kaila@itbd.net",
  "rkaila@itbd.net",
  "rhayre@itbd.net",
  "pryce.singh@itbd.net",
  "preston.choudhary@itbd.net",
  "gagan.sandhu@itbd.net",
  "ssaini@itbd.net",
  "jkhan@itbd.net",
];

const DEFAULT_EXECUTIVE_WHITELIST_EMAILS = [
  "Lee.Cavellier@itbd.net",
  "Amit.Dubey@itbd.net",
  "GKaur@itbd.net",
  "anamika.rathore@itbd.net",
  "Andrea.Canlas@itbd.net",
  "Banmeet.Kour@itbd.net",
  "PritamK@itbd.net",
  "Suhrid.Rana@itbd.net",
  "kpatel@itbd.net",
  "vikram.kanitkar@itbd.net",
  "ankur.kumar@itbd.net",
  "manu.sharma@itbd.net",
  "Natalie.McKenzie@itbd.net",
  "Akshay.Julka@itbd.net",
];

export const normalizeEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const parseEmailList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);

const devAdminEmails = new Set([
  ...DEFAULT_DEVADMIN_WHITELIST_EMAILS.map(normalizeEmail),
  ...parseEmailList(process.env.DEVADMIN_WHITELIST_EMAILS),
]);

const executiveEmails = new Set([
  ...DEFAULT_EXECUTIVE_WHITELIST_EMAILS.map(normalizeEmail),
  ...parseEmailList(process.env.EXECUTIVE_WHITELIST_EMAILS),
]);

export const isWhitelistedDevAdminEmail = (email: string | null | undefined) =>
  devAdminEmails.has(normalizeEmail(email));

export const isWhitelistedExecutiveEmail = (email: string | null | undefined) =>
  executiveEmails.has(normalizeEmail(email));

/**
 * The role a person should have at sign-in, given their stored role.
 * Returns null when the stored role should be kept as-is.
 */
export function whitelistRoleFor(
  email: string | null | undefined,
  storedRole: string | null | undefined,
): Role | null {
  if (isWhitelistedDevAdminEmail(email)) return storedRole === "devAdmin" ? null : "devAdmin";
  const isPlainUser = !storedRole || storedRole === "user";
  if (isPlainUser && isWhitelistedExecutiveEmail(email)) return "executive";
  return null;
}
