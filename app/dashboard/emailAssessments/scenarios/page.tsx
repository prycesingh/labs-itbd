import { desc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { emailAssessmentScenarios as scenarios } from "@/DB/emailAssessmentSchema";
import { ScenarioEditCard } from "@/components/emailAssessment/scenario-edit-card";
import { ScenarioForm } from "@/components/emailAssessment/scenario-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { requireRole } from "@/lib/emailAssessment/auth";

export default async function EmailAssessmentsScenariosPage() {
  await requireRole(["admin"]);
  const records = await db
    .select()
    .from(scenarios)
    .orderBy(desc(scenarios.createdAt));
  const activeCount = records.filter((scenario) => scenario.active).length;

  return (
    <main className="flex h-full w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Scenario <span className="text-itbd-blue">Bank</span>
      </h1>

      <div className="grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="itbd-glow-border relative h-fit overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-white">Create scenario</h2>
            <p className="mt-1 text-sm text-white/60">
              Add custom assessment prompts through the admin UI.
            </p>
            <div className="mt-4">
              <ScenarioForm />
            </div>
          </div>
        </div>

        <div className="itbd-glow-border relative flex max-h-[78vh] min-h-0 flex-col overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md lg:h-full">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 p-6 pb-0">
            <h2 className="text-lg font-bold text-white">Scenario bank</h2>
            <p className="mt-1 text-sm text-white/60">
              {records.length} scenarios &middot; {activeCount} active
            </p>
          </div>
          <div className="relative z-10 min-h-0 flex-1 overflow-hidden pt-4">
            {records.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-white/50">
                No scenarios yet. Create one to populate the bank.
              </p>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-3 px-6 pb-6">
                  {records.map((scenario) => (
                    <ScenarioEditCard key={scenario.id} scenario={scenario} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
