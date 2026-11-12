import ResultsEvaluationPage from "@/components/interview/admin/ResultsEvaluationPage";
import { requirePermissionPage } from "@/lib/admin/guard";

export default async function Page() {
  await requirePermissionPage("results.view");
  return (
    <main className="flex flex-col w-full">
      <ResultsEvaluationPage />
    </main>
  );
}
