import ModuleCapabilitiesPage from "@/components/interview/admin/ModuleCapabilitiesPage";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function Page() {
  await requireAdminPage();
  return (
    <main className="flex flex-col w-full">
      <ModuleCapabilitiesPage />
    </main>
  );
}
