import { auth } from "@/auth";
import { DashboardBreadcrumb } from "@/components/app_componentes/dashboard-breadcrumb";
import { DashboardHeader } from "@/components/app_componentes/dashboard-header";
import { DashboardNav } from "@/components/app_componentes/dashboard-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  // If the user signed in with a temporary password, force them to the change-
  // password page before they can use the app.
  const self = await db
    .select({ mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (self[0]?.mustChangePassword) {
    redirect("/admin/password");
  }

  return (
    <SidebarProvider className="flex h-screen min-h-0 flex-col overflow-hidden">
      <DashboardHeader user={session.user} />
      <div className="flex min-h-0 flex-1">
        <DashboardNav user={session.user} />
        <SidebarInset className="overflow-y-auto">
          <div className="px-6 py-2">
            <DashboardBreadcrumb />
          </div>
          <div className="px-6">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
