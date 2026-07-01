import { and, desc, eq } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentPromptVersions as promptVersions,
  emailAssessmentRubrics as rubrics,
} from "@/DB/emailAssessmentSchema";
import { PromptEditor } from "@/components/emailAssessment/prompt-editor";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/emailAssessment/auth";

export default async function EmailAssessmentsPromptsPage() {
  await requireRole(["admin"]);

  const [activePrompt] = await db
    .select({ promptVersion: promptVersions, rubric: rubrics })
    .from(promptVersions)
    .innerJoin(rubrics, eq(promptVersions.rubricId, rubrics.id))
    .where(and(eq(promptVersions.active, true), eq(rubrics.active, true)))
    .orderBy(desc(promptVersions.createdAt))
    .limit(1);

  return (
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment Evaluator</h1>
      </header>
      <Separator className="my-2 bg-white" />
      {!activePrompt ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>No active prompt version</CardTitle>
            <CardDescription>
              Create or seed an active prompt version and rubric before managing
              evaluator settings.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <PromptEditor
          promptVersion={activePrompt.promptVersion}
          rubric={activePrompt.rubric}
        />
      )}
    </main>
  );
}
