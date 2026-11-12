import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";

// The panel has no dedicated dashboard yet — send admins to the most relevant
// landing page: the user list for roles that may see it, else their password page.
export default async function AdminIndexPage() {
  const session = await auth();
  redirect(can(session?.user?.role, "adminPanel.view") ? "/admin/users" : "/admin/password");
}
