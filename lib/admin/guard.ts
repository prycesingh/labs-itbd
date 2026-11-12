import { auth } from "@/auth";
import { can, type Permission, type Role } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export type GuardResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; response: NextResponse };

/**
 * API guard: caller must hold `permission` (lib/rbac.ts). Defense in depth
 * alongside proxy.ts. Usage:
 *   const guard = await requirePermission("content.edit");
 *   if (!guard.ok) return guard.response;
 */
export async function requirePermission(permission: Permission): Promise<GuardResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user?.role ?? null) as Role | null;

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  if (!role || !can(role, permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }),
    };
  }

  return { ok: true, userId, role };
}

/**
 * Server-component page guard. Redirects unauthenticated users to login and
 * users lacking `permission` to the dashboard. Defense in depth: the proxy
 * already blocks navigation, but pages must not render protected content if
 * that layer is ever bypassed. Call at the top of a page:
 *   await requirePermissionPage("content.view");
 */
export async function requirePermissionPage(
  permission: Permission,
): Promise<{ userId: string; role: Role }> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user?.role ?? null) as Role | null;

  if (!userId) redirect("/");
  if (!role || !can(role, permission)) redirect("/dashboard?denied=1");

  return { userId, role };
}
