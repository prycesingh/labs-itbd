import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isAdminRole, type Role } from "@/lib/rbac";

/**
 * Labs module roles. The WMS user model is the source of truth; we translate
 * WMS roles into these:
 *   - WMS "devAdmin" -> "contentAdmin" (manages quiz banks, glossary, etc.)
 *   - everyone else  -> "learner"
 */
export const roleNames = ["learner", "contentAdmin"] as const;
export type LabsRole = (typeof roleNames)[number];

export type LabsUser = {
  id: string;
  name: string;
  email: string;
  role: LabsRole;
};

function mapWmsRoleToLabsRole(wmsRole: string | undefined | null): LabsRole {
  return isAdminRole((wmsRole ?? null) as Role | null) ? "contentAdmin" : "learner";
}

function toLabsUser(sessionUser: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string;
}): LabsUser {
  return {
    id: sessionUser.id ?? "",
    name: sessionUser.name ?? sessionUser.email ?? "",
    email: sessionUser.email ?? "",
    role: mapWmsRoleToLabsRole(sessionUser.role),
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

  const role = mapWmsRoleToLabsRole(session.user.role);

  if (allowedRoles && !allowedRoles.includes(role)) {
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

  const role = mapWmsRoleToLabsRole(session.user.role);

  if (!allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  return toLabsUser(session.user);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
