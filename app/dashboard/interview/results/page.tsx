import ResultsEvaluationPage from "@/components/interview/admin/ResultsEvaluationPage";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function Page() {
  await requireAdminPage();
  return (
    <main className="flex flex-col w-full">
      <ResultsEvaluationPage />
    </main>
  );
}
