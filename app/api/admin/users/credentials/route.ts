import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { isAdminRole } from "@/lib/rbac";
import { provisionCredentialsSchema } from "@/lib/validation/admin";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const BCRYPT_COST = 12;

/** Generate a strong temp password: 16 URL-safe chars, guaranteed to satisfy
 *  the letter+number policy. */
function generateTempPassword(): string {
  const raw = randomBytes(24)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 14);
  // Guarantee at least one letter and one digit.
  return `${raw}a7`;
}

/**
 * POST /api/admin/users/credentials — provision (or reset) a temporary
 * credential password for a target user. Superadmin only.
 *
 * "Creds imply admin": the target MUST already hold an admin role, otherwise we
 * refuse (the superadmin should grant a role first via PATCH /api/admin/users).
 * Sets mustChangePassword = 1 so the user is forced to change the temp password
 * on first credential login. The plaintext temp password is returned ONCE.
 */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = provisionCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { userId } = parsed.data;

  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const target = rows[0];
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (!isAdminRole(target.role)) {
    return NextResponse.json(
      {
        error:
          "Credentials can only be provisioned for admins. Grant an admin role first.",
      },
      { status: 400 },
    );
  }

  const tempPassword = parsed.data.password ?? generateTempPassword();
  const hashed = await hash(tempPassword, BCRYPT_COST);

  await db
    .update(users)
    .set({ password: hashed, mustChangePassword: 1 })
    .where(eq(users.id, userId));

  return NextResponse.json({
    success: true,
    message: "Temporary password set. Share it securely; shown only once.",
    email: target.email,
    // Returned once so the superadmin can hand it to the user. If a password was
    // supplied by the caller we echo it back too for confirmation.
    tempPassword,
  });
}

/**
 * DELETE /api/admin/users/credentials?userId=... — revoke credential login for
 * a user (clears the hash). They can still use SSO. Superadmin only.
 */
export async function DELETE(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "userId query param is required." },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ password: null, mustChangePassword: 0 })
    .where(eq(users.id, userId));

  return NextResponse.json({
    success: true,
    message: "Credential access revoked. User can still sign in with SSO.",
  });
}
