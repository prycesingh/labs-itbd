import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Email-assessment roles (the standalone app's role vocabulary). The WMS user
 * model is the source of truth; we translate WMS roles into these:
 *   - WMS "devAdmin"            -> "admin" AND "assessor"
 *   - WMS "user" (default role) -> "candidate"
 *
 * All ported routes/pages were written against this vocabulary, so this mapping
 * lets them run unchanged on top of WMS auth.
 */
export const roleNames = ["candidate", "admin", "assessor"] as const;
export type EmailAssessmentRole = (typeof roleNames)[number];

export type EmailAssessmentUser = {
  id: string;
  name: string;
  email: string;
  /** WMS role mapped to the primary email-assessment role. */
  role: EmailAssessmentRole;
};

function mapWmsRoleToEmailAssessmentRole(wmsRole: string | undefined | null): EmailAssessmentRole {
  return wmsRole === "devAdmin" ? "admin" : "candidate";
}

/**
 * The set of email-assessment roles a WMS user effectively holds. devAdmin
 * acts as BOTH admin and assessor; everyone else is a candidate.
 */
function effectiveRoles(wmsRole: string | undefined | null): EmailAssessmentRole[] {
  if (wmsRole === "devAdmin") {
    return ["admin", "assessor"];
  }
  return ["candidate"];
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
    role: mapWmsRoleToEmailAssessmentRole(sessionUser.role),
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
