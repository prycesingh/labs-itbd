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

const API_BASE = "/api/emailAssessment";

const scenarioFormSchema = z.object({
  title: z.string().min(3),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  category: z.string().min(2),
  prompt: z.string().min(20),
  scoringNotes: z.string().optional(),
});

type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;

export function ScenarioForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: {
      title: "",
      difficulty: "beginner",
      category: "",
      prompt: "",
      scoringNotes: "",
    },
  });

  async function onSubmit(values: ScenarioFormValues) {
    setSubmitting(true);
    const response = await fetch(`${API_BASE}/admin/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to create scenario.");
      return;
    }

    toast.success("Scenario created.");
    form.reset();
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title" className="text-white/70">
            Title
          </Label>
          <Input id="title" {...form.register("title")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty" className="text-white/70">
            Difficulty
          </Label>
          <select
            id="difficulty"
            className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-itbd-blue focus:outline-none"
            {...form.register("difficulty")}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="category" className="text-white/70">
          Category
        </Label>
        <Input id="category" {...form.register("category")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-white/70">
          Prompt
        </Label>
        <Textarea id="prompt" className="min-h-32" {...form.register("prompt")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scoringNotes" className="text-white/70">
          Scoring notes
        </Label>
        <Textarea id="scoringNotes" {...form.register("scoringNotes")} />
      </div>
      <DefaultButton loading={submitting}>Create scenario</DefaultButton>
    </form>
  );
}
