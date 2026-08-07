import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { UsersTable } from "@/components/admin/users-table";
import {
  GRANTABLE_ROLES,
  isAdminRole,
  isSuperAdmin,
  type Role,
} from "@/lib/rbac";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const session = await auth();
  const role = (session?.user?.role ?? null) as Role | null;
  const currentUserId = session?.user?.id ?? "";

  if (!session?.user?.id) redirect("/");
  if (!isSuperAdmin(role)) redirect("/admin/password");

  // Forced password change takes precedence over everything else in the panel.
  const self = await db
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, currentUserId))
    .limit(1);
  if (self[0]?.mustChangePassword) redirect("/admin/password");

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
    role: u.role as Role,
    isAdmin: isAdminRole(u.role),
    isSuperAdmin: isSuperAdmin(u.role),
    hasCredentials: Boolean(u.password),
    mustChangePassword: Boolean(u.mustChangePassword),
  }));

  return (
    <main className="flex h-full w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          User <span className="text-itbd-blue">Management</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Grant or revoke roles and provision credential (password) access.
          Credentials are admin-only &mdash; grant an admin role before
          provisioning a password.
        </p>
      </div>
      <UsersTable
        users={list}
        currentUserId={currentUserId}
        grantableRoles={[...GRANTABLE_ROLES]}
      />
    </main>
  );
}
