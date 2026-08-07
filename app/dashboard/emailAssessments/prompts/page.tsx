import { and, desc, eq } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentPromptVersions as promptVersions,
  emailAssessmentRubrics as rubrics,
} from "@/DB/emailAssessmentSchema";
import { PromptCreateForm } from "@/components/emailAssessment/prompt-create-form";
import { PromptEditor } from "@/components/emailAssessment/prompt-editor";
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
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Evaluation <span className="text-itbd-blue">Prompts</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <ItbdCard>
          <h2 className="text-lg font-bold text-white">
            Create prompt version
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Adds a new prompt + rubric and activates it immediately.
          </p>
          <div className="mt-4">
            <PromptCreateForm />
          </div>
        </ItbdCard>

        {!activePrompt ? (
          <ItbdCard>
            <h2 className="text-lg font-bold text-white">
              No active prompt version
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Create a prompt version and rubric before managing evaluator
              settings.
            </p>
          </ItbdCard>
        ) : (
          <PromptEditor
            promptVersion={activePrompt.promptVersion}
            rubric={activePrompt.rubric}
          />
        )}
      </div>
    </main>
  );
}

/** Shared glow-border/blur card surface matching the rest of the app's brand. */
function ItbdCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
