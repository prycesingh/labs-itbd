import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { ActivityLogPage } from "@/components/admin/ActivityLogPage";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function AdminActivityPage() {
  await requireAdminPage();

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .orderBy(asc(users.email));

  return (
    <main className="flex h-full w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Activity <span className="text-itbd-blue">Log</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Pages visited by each user across the dashboard and admin panel.
        </p>
      </div>
      <ActivityLogPage users={rows} />
    </main>
  );
}
