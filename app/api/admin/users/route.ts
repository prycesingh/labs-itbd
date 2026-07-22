import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { isAdminRole, isSuperAdmin, type Role } from "@/lib/rbac";
import { setUserRoleSchema } from "@/lib/validation/admin";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users — list all users for the management table.
 * Superadmin only. Never returns the password hash; exposes only whether a
 * credential password exists.
 */
export async function GET() {
  const guard = await requireSuperAdmin();
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
    isAdmin: isAdminRole(u.role),
    isSuperAdmin: isSuperAdmin(u.role),
    hasCredentials: Boolean(u.password),
    mustChangePassword: Boolean(u.mustChangePassword),
  }));

  return NextResponse.json({ users: list });
}

/**
 * PATCH /api/admin/users — grant or revoke a role on a target user.
 * Superadmin only. Guardrails:
 *  - cannot change your own role (prevents self-lockout / self-demotion)
 *  - cannot assign a superadmin role from the panel (deliberate code/whitelist
 *    action only)
 *  - if a demotion drops the user out of admin roles, their credential password
 *    is cleared (creds imply admin — a non-admin must not retain a password).
 */
export async function PATCH(request: Request) {
  const guard = await requireSuperAdmin();
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

  if (isSuperAdmin(role as Role)) {
    return NextResponse.json(
      {
        error:
          "Superadmin roles cannot be granted from the panel. Use the email whitelist.",
      },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (isSuperAdmin(existing[0].role)) {
    return NextResponse.json(
      { error: "Cannot modify a superadmin's role from the panel." },
      { status: 400 },
    );
  }

  // If the new role is not an admin role, strip any credential password — a
  // non-admin must never retain credential login.
  const losesAdmin = !isAdminRole(role as Role);

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
