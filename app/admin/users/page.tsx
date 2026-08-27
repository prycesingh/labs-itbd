import { db } from "@/DB/drizzle";
import { pageVisits, users } from "@/DB/schema";
import { auth } from "@/auth";
import { UsersStatsRow } from "@/components/admin/UsersStatsRow";
import { UsersTable } from "@/components/admin/users-table";
import {
  GRANTABLE_ROLES,
  isAdminRole,
  isSuperAdmin,
  type Role,
} from "@/lib/rbac";
import { asc, countDistinct, eq, gte } from "drizzle-orm";
import { redirect } from "next/navigation";

const RECENTLY_ACTIVE_DAYS = 7;

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

  const since = new Date();
  since.setDate(since.getDate() - RECENTLY_ACTIVE_DAYS);
  const sinceSql = since.toISOString().slice(0, 19).replace("T", " ");

  const [rows, [activeCount]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        password: users.password,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .orderBy(asc(users.email)),
    db
      .select({ count: countDistinct(pageVisits.userId) })
      .from(pageVisits)
      .where(gte(pageVisits.visitedAt, sinceSql)),
  ]);

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

  const totalUsers = list.length;
  const superAdminCount = list.filter((u) => u.isSuperAdmin).length;
  const adminCount = list.filter((u) => u.isAdmin && !u.isSuperAdmin).length;
  const credentialsCount = list.filter((u) => u.hasCredentials).length;
  const pendingPasswordChangeCount = list.filter(
    (u) => u.mustChangePassword,
  ).length;

  const roleBreakdown = Array.from(
    list.reduce((acc, u) => {
      acc.set(u.role, (acc.get(u.role) ?? 0) + 1);
      return acc;
    }, new Map<Role, number>()),
  )
    .map(([roleName, count]) => ({ role: roleName, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <main className="flex h-full w-full flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
            User <span className="text-itbd-blue">Management</span>
          </h1>
          <p className="mt-1 text-sm text-justify text-gray-400/60 xl:max-w-md">
            Grant or revoke roles and provision credential (password) access.
            Credentials are admin-only - grant an admin role before provisioning
            a password.
          </p>
        </div>

        <UsersStatsRow
          totalUsers={totalUsers}
          activeUsers={Number(activeCount?.count ?? 0)}
          activeDays={RECENTLY_ACTIVE_DAYS}
          superAdminCount={superAdminCount}
          adminCount={adminCount}
          credentialsCount={credentialsCount}
          pendingPasswordChangeCount={pendingPasswordChangeCount}
          roleBreakdown={roleBreakdown}
        />
      </div>

      <UsersTable
        users={list}
        currentUserId={currentUserId}
        grantableRoles={[...GRANTABLE_ROLES]}
      />
    </main>
  );
}
