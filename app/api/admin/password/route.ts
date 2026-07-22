import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { isAdminRole, type Role } from "@/lib/rbac";
import { changePasswordSchema } from "@/lib/validation/admin";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const BCRYPT_COST = 12;

/**
 * POST /api/admin/password
 *
 * Lets a signed-in admin set (first time) or change their OWN credential
 * password. Defense in depth: even though the /admin route group is gated by
 * the RBAC proxy, this handler independently re-checks the session and role —
 * per the Next.js guidance that server functions/routes must not rely on the
 * proxy alone.
 *
 * - Non-admins are rejected (403) — credential login is admin-only.
 * - If the user already has a password, `currentPassword` is required and must
 *   match. If they have none (SSO-only, provisioning first credential), the
 *   active session is sufficient proof of identity.
 */
export async function POST(request: Request) {
  const session = await auth();

  const userId = session?.user?.id;
  const role = session?.user?.role as Role | undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!isAdminRole(role ?? null)) {
    return NextResponse.json(
      { error: "Credential passwords are restricted to administrators." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const rows = await db
      .select({ id: users.id, password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const account = rows[0];
    if (!account) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const hasExistingPassword = Boolean(account.password);

    if (hasExistingPassword) {
      // Changing an existing password → must supply and match the current one.
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required." },
          { status: 400 },
        );
      }
      const ok = await compare(currentPassword, account.password as string);
      if (!ok) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 },
        );
      }
    }

    const hashed = await hash(newPassword, BCRYPT_COST);
    await db
      .update(users)
      // Clear the forced-change flag: the user has now set their own password.
      .set({ password: hashed, mustChangePassword: 0 })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: hasExistingPassword
        ? "Password changed."
        : "Password set. You can now sign in with credentials.",
      wasFirstTime: !hasExistingPassword,
    });
  } catch (error) {
    console.error("[admin/password] Failed to update password:", error);
    return NextResponse.json(
      { error: "Could not update password. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/password
 * Lightweight status so the UI can render "Set password" vs "Change password".
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role as Role | undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (!isAdminRole(role ?? null)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rows = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return NextResponse.json({ hasPassword: Boolean(rows[0]?.password) });
}
