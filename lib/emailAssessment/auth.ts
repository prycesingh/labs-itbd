import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { can } from "@/lib/rbac";

/**
 * Email-assessment roles, derived from app permissions (lib/rbac.ts). A user
 * holds EVERY role their permissions allow:
 *   - "candidate"     — everyone signed in (takes assessments, sees own results)
 *   - "contentViewer" — content.view    (sees scenarios / prompts)
 *   - "admin"         — content.edit    (creates / edits scenarios / prompts)
 *   - "resultsViewer" — results.view    (sees everyone's sessions / submissions)
 *   - "assessor"      — scores.override (sets manual scores over the AI score)
 */
export const roleNames = ["candidate", "contentViewer", "admin", "resultsViewer", "assessor"] as const;
export type EmailAssessmentRole = (typeof roleNames)[number];

export type EmailAssessmentUser = {
  id: string;
  name: string;
  email: string;
  /** Every email-assessment role this user holds. */
  roles: EmailAssessmentRole[];
};

function effectiveRoles(appRole: string | undefined | null): EmailAssessmentRole[] {
  const held: EmailAssessmentRole[] = ["candidate"];
  if (can(appRole, "content.view")) held.push("contentViewer");
  if (can(appRole, "content.edit")) held.push("admin");
  if (can(appRole, "results.view")) held.push("resultsViewer");
  if (can(appRole, "scores.override")) held.push("assessor");
  return held;
}

function toEmailAssessmentUser(sessionUser: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string;
}): EmailAssessmentUser {
  return {
    id: sessionUser.id ?? "",
    name: sessionUser.name ?? sessionUser.email ?? "",
    email: sessionUser.email ?? "",
    roles: effectiveRoles(sessionUser.role),
  };
}

/**
 * API guard. Returns { user, response: null } when authenticated and allowed,
 * or { user: null, response } when not.
 * Usage: const { user, response } = await requireApiUser(["admin"]); if (response) return response;
 */
export async function requireApiUser(allowedRoles?: EmailAssessmentRole[]) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      user: null as EmailAssessmentUser | null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const held = effectiveRoles(session.user.role);

  if (allowedRoles && !allowedRoles.some((role) => held.includes(role))) {
    return {
      user: null as EmailAssessmentUser | null,
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }),
    };
  }

  return { user: toEmailAssessmentUser(session.user), response: null };
}

/**
 * Server-component guard. Redirects unauthenticated users to sign in and
 * users without an allowed role to the dashboard.
 */
export async function requireUser(): Promise<EmailAssessmentUser> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  return toEmailAssessmentUser(session.user);
}

export async function requireRole(allowedRoles: EmailAssessmentRole[]): Promise<EmailAssessmentUser> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const held = effectiveRoles(session.user.role);

  if (!allowedRoles.some((role) => held.includes(role))) {
    redirect("/dashboard");
  }

  return toEmailAssessmentUser(session.user);
}

export function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
