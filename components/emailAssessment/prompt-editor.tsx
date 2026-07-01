"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import DefaultButton from "@/components/app_componentes/customButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { categoryScoreSchema } from "@/lib/emailAssessment/rubric";

const API_BASE = "/api/emailAssessment";

const promptEditorSchema = z.object({
  systemPrompt: z.string().min(20),
  evaluationPrompt: z.string().min(20),
  model: z.string().min(3),
  weights: categoryScoreSchema,
});

type PromptEditorValues = z.infer<typeof promptEditorSchema>;

type PromptEditorProps = {
  promptVersion: {
    id: string;
    version: string;
    systemPrompt: string;
    evaluationPrompt: string;
    model: string;
  };
  rubric: {
    id: string;
    version: string;
    name: string;
    weights: PromptEditorValues["weights"];
  };
};

export function PromptEditor({ promptVersion, rubric }: PromptEditorProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<PromptEditorValues>({
    resolver: zodResolver(promptEditorSchema),
    defaultValues: {
      systemPrompt: promptVersion.systemPrompt,
      evaluationPrompt: promptVersion.evaluationPrompt,
      model: promptVersion.model,
      weights: rubric.weights,
    },
  });

  async function onSubmit(values: PromptEditorValues) {
    setSubmitting(true);
    const response = await fetch(`${API_BASE}/admin/prompts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to update prompt settings.");
      return;
    }

    toast.success("Prompt settings saved.");
    router.refresh();
  }

  return (
    <form
      className="grid border rounded-2xl p-6 gap-6 mt-5"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg">Active evaluator</h2>
            <p className="text-sm text-muted-foreground">
              Version {promptVersion.version} · rubric {rubric.name}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">OpenAI model</Label>
              <Input id="model" {...form.register("model")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System prompt</Label>
            <Textarea
              id="systemPrompt"
              className="min-h-40"
              {...form.register("systemPrompt")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evaluationPrompt">Evaluation prompt</Label>
            <Textarea
              id="evaluationPrompt"
              className="min-h-40"
              {...form.register("evaluationPrompt")}
            />
          </div>
        </div>
      </div>

      <div className="">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg">Rubric weights</h2>
            <p className="text-sm text-muted-foreground">
              Update how the AI distribution assigns the candidate score.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ScoreInput
              label="Professional tone"
              name="professionalTone"
              register={form.register}
            />
            <ScoreInput
              label="Grammar / language"
              name="grammarLanguage"
              register={form.register}
            />
            <ScoreInput
              label="Clarity / empathy / respect"
              name="clarityEmpathyRespect"
              register={form.register}
            />
            <ScoreInput
              label="Structure"
              name="structure"
              register={form.register}
            />
            <ScoreInput
              label="Completeness"
              name="completeness"
              register={form.register}
            />
          </div>
        </div>
      </div>

      <DefaultButton type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Save prompt settings"}
      </DefaultButton>
    </form>
  );
}

function ScoreInput({
  label,
  name,
  register,
}: {
  label: string;
  name: keyof PromptEditorValues["weights"];
  register: ReturnType<typeof useForm<PromptEditorValues>>["register"];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        max={100}
        {...register(`weights.${name}` as const)}
      />
    </div>
  );
}
