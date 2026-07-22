import ModuleManagementPage from "@/components/interview/admin/ModuleManagementPage";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function Page() {
  await requireAdminPage();
  return (
    <main className="flex flex-col w-full">
      <ModuleManagementPage />
    </main>
  );
}
