import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { AdminNav } from "@/components/admin/admin-nav";
import { DashboardHeader } from "@/components/app_componentes/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isAdminRole, isSuperAdmin, type Role } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

/**
 * Admin panel shell + server-side guard (defense in depth alongside proxy.ts).
 *
 * - Requires an authenticated admin-role user; others are bounced.
 * - Enforces the forced-password-change: if the user was given a temporary
 *   password (mustChangePassword), they are redirected to /admin/password until
 *   they change it. The DB is the source of truth so this can't be bypassed by
 *   a stale session.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user?.role ?? null) as Role | null;

  if (!userId) redirect("/");
  if (!isAdminRole(role)) redirect("/dashboard?denied=1");

  const rows = await db
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const mustChange = Boolean(rows[0]?.mustChangePassword);

  return (
    <SidebarProvider className="flex h-screen min-h-0 flex-col overflow-hidden">
      <DashboardHeader
        user={{
          name: session.user.name,
          email: session.user.email,
          role: role ?? undefined,
        }}
      />
      <div className="flex min-h-0 flex-1">
        <AdminNav
          user={{
            name: session.user.name,
            email: session.user.email,
            role: role ?? undefined,
          }}
          isSuperAdmin={isSuperAdmin(role)}
          mustChangePassword={mustChange}
        />
        <SidebarInset className="overflow-y-auto p-6">{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
