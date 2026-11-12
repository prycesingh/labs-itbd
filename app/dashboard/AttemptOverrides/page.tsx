import AttemptOverridesPage from "@/components/admin/AttemptOverridesPage";
import { requirePermissionPage } from "@/lib/admin/guard";

export default async function Page() {
  await requirePermissionPage("content.view");
  return (
    <main className="flex flex-col w-full">
      <AttemptOverridesPage />
    </main>
  );
}
