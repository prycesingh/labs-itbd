import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { requirePermission } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/rbac";
import { isWhitelistedDevAdminEmail } from "@/lib/roleWhitelist";
import { setUserRoleSchema } from "@/lib/validation/admin";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users — list all users for the management table.
 * Any admin-panel role (read-only unless users.manage). Never returns the
 * password hash; exposes only whether a credential password exists.
 */
export async function GET() {
  const guard = await requirePermission("adminPanel.view");
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      password: users.password,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .orderBy(asc(users.email));

  const list = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    canUseCredentials: can(u.role, "credentials.login"),
    isProtected: isWhitelistedDevAdminEmail(u.email),
    hasCredentials: Boolean(u.password),
    mustChangePassword: Boolean(u.mustChangePassword),
  }));

  return NextResponse.json({ users: list });
}

/**
 * PATCH /api/admin/users — set a user's role (any role, devAdmin included).
 * Requires users.manage (devAdmin). Guardrails (ABAC):
 *  - cannot change your own role (prevents self-lockout / self-demotion)
 *  - cannot change a whitelisted devAdmin (lib/roleWhitelist.ts) — they are
 *    the break-glass floor and would be re-promoted at their next sign-in
 *  - if the new role lacks credentials.login, their credential password is
 *    cleared (a non-admin must not retain a password).
 * The change reaches the user's session within the JWT role-refresh interval.
 */
export async function PATCH(request: Request) {
  const guard = await requirePermission("users.manage");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = setUserRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { userId, role } = parsed.data;

  if (userId === guard.userId) {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (isWhitelistedDevAdminEmail(existing[0].email)) {
    return NextResponse.json(
      {
        error:
          "This devAdmin is on the protected whitelist; remove them from DEVADMIN_WHITELIST_EMAILS / lib/roleWhitelist.ts first.",
      },
      { status: 400 },
    );
  }

  // If the new role can't use credential login, strip any password.
  const losesAdmin = !can(role, "credentials.login");

  await db
    .update(users)
    .set({
      role: role as Role,
      ...(losesAdmin ? { password: null, mustChangePassword: 0 } : {}),
    })
    .where(eq(users.id, userId));

  return NextResponse.json({
    success: true,
    message: losesAdmin
      ? "Role updated. Credential access removed (non-admins use SSO)."
      : "Role updated.",
    clearedCredentials: losesAdmin,
  });
}
