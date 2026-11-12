import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { can } from "@/lib/rbac";

/**
 * Labs module roles, derived from app permissions (lib/rbac.ts):
 *   - "learner"       — everyone signed in
 *   - "contentViewer" — content.view (sees the content-admin screens)
 *   - "contentAdmin"  — content.edit (creates / edits / deletes content)
 * A user holds every role their permissions allow, so read endpoints ask for
 * "contentViewer" and write endpoints for "contentAdmin".
 */
export const roleNames = ["learner", "contentViewer", "contentAdmin"] as const;
export type LabsRole = (typeof roleNames)[number];

export type LabsUser = {
  id: string;
  name: string;
  email: string;
  /** Highest labs role held. */
  role: LabsRole;
};

function heldRoles(appRole: string | undefined | null): LabsRole[] {
  const held: LabsRole[] = ["learner"];
  if (can(appRole, "content.view")) held.push("contentViewer");
  if (can(appRole, "content.edit")) held.push("contentAdmin");
  return held;
}

function toLabsUser(sessionUser: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string;
}): LabsUser {
  const held = heldRoles(sessionUser.role);
  return {
    id: sessionUser.id ?? "",
    name: sessionUser.name ?? sessionUser.email ?? "",
    email: sessionUser.email ?? "",
    role: held[held.length - 1],
  };
}

/**
 * API guard. Returns { user, response: null } when authenticated and allowed,
 * or { user: null, response } when not.
 * Usage: const { user, response } = await requireApiUser(["contentAdmin"]); if (response) return response;
 */
export async function requireApiUser(allowedRoles?: LabsRole[]) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      user: null as LabsUser | null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const held = heldRoles(session.user.role);

  if (allowedRoles && !allowedRoles.some((r) => held.includes(r))) {
    return {
      user: null as LabsUser | null,
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }),
    };
  }

  return { user: toLabsUser(session.user), response: null };
}

/**
 * Server-component guard. Redirects unauthenticated users to sign in and
 * users without an allowed role to the dashboard.
 */
export async function requireUser(): Promise<LabsUser> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  return toLabsUser(session.user);
}

export async function requireRole(allowedRoles: LabsRole[]): Promise<LabsUser> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const held = heldRoles(session.user.role);

  if (!allowedRoles.some((r) => held.includes(r))) {
    redirect("/dashboard");
  }

  return toLabsUser(session.user);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
