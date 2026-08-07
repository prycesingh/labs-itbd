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

const promptCreateSchema = z.object({
  version: z.string().min(1).max(64),
  systemPrompt: z.string().min(20),
  evaluationPrompt: z.string().min(20),
  model: z.string().min(3),
  weights: categoryScoreSchema,
});

type PromptCreateValues = z.infer<typeof promptCreateSchema>;

const defaultWeights: PromptCreateValues["weights"] = {
  professionalTone: 20,
  grammarLanguage: 20,
  clarityEmpathyRespect: 30,
  structure: 15,
  completeness: 15,
};

export function PromptCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<PromptCreateValues>({
    resolver: zodResolver(promptCreateSchema),
    defaultValues: {
      version: "",
      systemPrompt: "",
      evaluationPrompt: "",
      model: "gpt-4o-mini",
      weights: defaultWeights,
    },
  });

  async function onSubmit(values: PromptCreateValues) {
    setSubmitting(true);
    const response = await fetch(`${API_BASE}/admin/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to create prompt version.");
      return;
    }

    toast.success("Prompt version created and activated.");
    form.reset({ ...form.getValues(), version: "", systemPrompt: "", evaluationPrompt: "" });
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="version" className="text-white/70">
            Version name
          </Label>
          <Input id="version" placeholder="v1.1" {...form.register("version")} />
        </div>
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
          className="min-h-32"
          {...form.register("systemPrompt")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="evaluationPrompt" className="text-white/70">
          Evaluation prompt
        </Label>
        <Textarea
          id="evaluationPrompt"
          className="min-h-32"
          {...form.register("evaluationPrompt")}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-white/70">Rubric weights</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreInput label="Professional tone" name="professionalTone" register={form.register} />
          <ScoreInput label="Grammar / language" name="grammarLanguage" register={form.register} />
          <ScoreInput
            label="Clarity / empathy / respect"
            name="clarityEmpathyRespect"
            register={form.register}
          />
          <ScoreInput label="Structure" name="structure" register={form.register} />
          <ScoreInput label="Completeness" name="completeness" register={form.register} />
        </div>
      </div>
      <DefaultButton type="submit" loading={submitting}>
        Create prompt version
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
  name: keyof PromptCreateValues["weights"];
  register: ReturnType<typeof useForm<PromptCreateValues>>["register"];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white/70">{label}</Label>
      <Input
        type="number"
        min={0}
        max={100}
        {...register(`weights.${name}` as const, { valueAsNumber: true })}
      />
    </div>
  );
}
