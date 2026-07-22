import { auth } from "@/auth";
import { isSuperAdmin, type Role } from "@/lib/rbac";
import { redirect } from "next/navigation";

// The panel has no dedicated dashboard yet — send admins to the most relevant
// landing page (user management for superadmins, else their password page).
export default async function AdminIndexPage() {
  const session = await auth();
  const role = (session?.user?.role ?? null) as Role | null;
  redirect(isSuperAdmin(role) ? "/admin/users" : "/admin/password");
}
