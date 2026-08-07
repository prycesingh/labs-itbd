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
      className="itbd-glow-border relative grid gap-6 overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      <div className="relative z-10 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Active evaluator</h2>
          <p className="text-sm text-white/60">
            Version {promptVersion.version} &middot; rubric {rubric.name}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model" className="text-white/70">
              OpenAI model
            </Label>
            <Input id="model" {...form.register("model")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="systemPrompt" className="text-white/70">
            System prompt
          </Label>
          <Textarea
            id="systemPrompt"
            className="min-h-40"
            {...form.register("systemPrompt")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="evaluationPrompt" className="text-white/70">
            Evaluation prompt
          </Label>
          <Textarea
            id="evaluationPrompt"
            className="min-h-40"
            {...form.register("evaluationPrompt")}
          />
        </div>
      </div>

      <div className="relative z-10 space-y-4 border-t border-white/10 pt-6">
        <div>
          <h2 className="text-lg font-bold text-white">Rubric weights</h2>
          <p className="text-sm text-white/60">
            Update how the AI distribution assigns the candidate score.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ScoreInput
            label="Professional tone"
            name="professionalTone"
            register={form.register}
            defaultValue={rubric.weights.professionalTone}
          />
          <ScoreInput
            label="Grammar / language"
            name="grammarLanguage"
            register={form.register}
            defaultValue={rubric.weights.grammarLanguage}
          />
          <ScoreInput
            label="Clarity / empathy / respect"
            name="clarityEmpathyRespect"
            register={form.register}
            defaultValue={rubric.weights.clarityEmpathyRespect}
          />
          <ScoreInput
            label="Structure"
            name="structure"
            register={form.register}
            defaultValue={rubric.weights.structure}
          />
          <ScoreInput
            label="Completeness"
            name="completeness"
            register={form.register}
            defaultValue={rubric.weights.completeness}
          />
        </div>
      </div>

      <DefaultButton type="submit" loading={submitting} className="relative z-10">
        Save prompt settings
      </DefaultButton>
    </form>
  );
}

function ScoreInput({
  label,
  name,
  register,
  defaultValue,
}: {
  label: string;
  name: keyof PromptEditorValues["weights"];
  register: ReturnType<typeof useForm<PromptEditorValues>>["register"];
  defaultValue: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white/70">{label}</Label>
      <Input
        type="number"
        min={0}
        max={100}
        defaultValue={defaultValue}
        {...register(`weights.${name}` as const, { valueAsNumber: true })}
      />
    </div>
  );
}
