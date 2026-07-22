import { auth } from "@/auth";
import { isAdminRole, isSuperAdmin, type Role } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export type GuardResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; response: NextResponse };

async function guard(kind: "admin" | "superadmin"): Promise<GuardResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user?.role ?? null) as Role | null;

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const allowed = kind === "superadmin" ? isSuperAdmin(role) : isAdminRole(role);
  if (!allowed || !role) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            kind === "superadmin"
              ? "Only superadmins may manage users."
              : "Administrator access required.",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId, role };
}

/** API guard: caller must be any admin role. Defense in depth alongside the proxy. */
export const requireAdmin = () => guard("admin");

/** API guard: caller must be a superadmin (may manage other users). */
export const requireSuperAdmin = () => guard("superadmin");

/**
 * Server-component page guard. Redirects unauthenticated users to login and
 * non-admins to the dashboard. Defense in depth: the proxy already blocks
 * navigation, but pages must not render admin content if that layer is ever
 * bypassed (e.g. server-action edge cases). Call at the top of an admin page:
 *   await requireAdminPage();
 */
export async function requireAdminPage(): Promise<{ userId: string; role: Role }> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user?.role ?? null) as Role | null;

  if (!userId) redirect("/");
  if (!isAdminRole(role) || !role) redirect("/dashboard?denied=1");

  return { userId, role };
}
