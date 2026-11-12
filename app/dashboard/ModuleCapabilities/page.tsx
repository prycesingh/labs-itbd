import ModuleCapabilitiesPage from "@/components/interview/admin/ModuleCapabilitiesPage";
import { requirePermissionPage } from "@/lib/admin/guard";

export default async function Page() {
  await requirePermissionPage("content.view");
  return (
    <main className="flex flex-col w-full">
      <ModuleCapabilitiesPage />
    </main>
  );
}
