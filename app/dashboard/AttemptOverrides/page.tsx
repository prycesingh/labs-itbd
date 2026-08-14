import AttemptOverridesPage from "@/components/admin/AttemptOverridesPage";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function Page() {
  await requireAdminPage();
  return (
    <main className="flex flex-col w-full">
      <AttemptOverridesPage />
    </main>
  );
}
