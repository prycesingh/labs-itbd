import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { DashboardNav } from "@/components/app_componentes/dashboard-nav";
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
    <div className="flex h-screen overflow-hidden">
      <DashboardNav user={session.user} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
