import { desc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { emailAssessmentScenarios as scenarios } from "@/DB/emailAssessmentSchema";
import { ScenarioForm } from "@/components/emailAssessment/scenario-form";
import { ScenarioEditCard } from "@/components/emailAssessment/scenario-edit-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";

export default async function EmailAssessmentsScenariosPage() {
  await requireRole(["admin"]);
  const records = await db.select().from(scenarios).orderBy(desc(scenarios.createdAt));
  const activeCount = records.filter((scenario) => scenario.active).length;

  return (
    <main className="flex h-full w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment Scenarios</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <div className="mt-5 grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Create scenario</CardTitle>
            <CardDescription>Add custom assessment prompts through the admin UI.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScenarioForm />
          </CardContent>
        </Card>
        <Card className="flex max-h-[78vh] min-h-0 flex-col lg:h-full">
          <CardHeader>
            <CardTitle>Scenario bank</CardTitle>
            <CardDescription>
              {records.length} scenarios Â· {activeCount} active
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {records.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
