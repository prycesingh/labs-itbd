"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = "/api/emailAssessment";

const manualScoreSchema = z.object({
  professionalTone: z.coerce.number().int().min(0).max(20),
  grammarLanguage: z.coerce.number().int().min(0).max(20),
  clarityEmpathyRespect: z.coerce.number().int().min(0).max(30),
  structure: z.coerce.number().int().min(0).max(15),
  completeness: z.coerce.number().int().min(0).max(15),
  summary: z.string().min(10),
  improvementAreas: z.string().min(2),
  notes: z.string().optional(),
});

type ManualScoreFormValues = z.infer<typeof manualScoreSchema>;

export function ManualScoreForm({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ManualScoreFormValues>({
    resolver: zodResolver(manualScoreSchema) as unknown as Resolver<ManualScoreFormValues>,
    defaultValues: {
      professionalTone: 0,
      grammarLanguage: 0,
      clarityEmpathyRespect: 0,
      structure: 0,
      completeness: 0,
      summary: "",
      improvementAreas: "",
      notes: "",
    },
  });

  async function onSubmit(values: ManualScoreFormValues) {
    const categoryScores = {
      professionalTone: values.professionalTone,
      grammarLanguage: values.grammarLanguage,
      clarityEmpathyRespect: values.clarityEmpathyRespect,
      structure: values.structure,
      completeness: values.completeness,
    };
    const overallScore = Object.values(categoryScores).reduce((sum, value) => sum + value, 0);
    setSubmitting(true);
    const response = await fetch(`${API_BASE}/admin/manual-scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        overallScore,
        categoryScores,
        summary: values.summary,
        improvementAreas: values.improvementAreas
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        notes: values.notes,
      }),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to save manual score.");
      return;
    }

    toast.success("Manual score saved.");
    form.reset();
    router.refresh();
  }

  return (
    <form
      className="space-y-4 rounded-2xl border bg-muted/30 p-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-3 md:grid-cols-5">
        <ScoreInput label="Tone /20" name="professionalTone" register={form.register} />
        <ScoreInput label="Grammar /20" name="grammarLanguage" register={form.register} />
        <ScoreInput label="Clarity /30" name="clarityEmpathyRespect" register={form.register} />
        <ScoreInput label="Structure /15" name="structure" register={form.register} />
        <ScoreInput label="Complete /15" name="completeness" register={form.register} />
      </div>
      <div className="space-y-2">
        <Label>Summary</Label>
        <Textarea {...form.register("summary")} />
      </div>
      <div className="space-y-2">
        <Label>Improvement areas, one per line</Label>
        <Textarea {...form.register("improvementAreas")} />
      </div>
      <div className="space-y-2">
        <Label>Private notes</Label>
        <Textarea {...form.register("notes")} />
      </div>
      <Button disabled={submitting}>{submitting ? "Saving..." : "Save manual score"}</Button>
    </form>
  );
}

function ScoreInput({
  label,
  name,
  register,
}: {
  label: string;
  name: keyof Pick<
    ManualScoreFormValues,
    "professionalTone" | "grammarLanguage" | "clarityEmpathyRespect" | "structure" | "completeness"
  >;
  register: ReturnType<typeof useForm<ManualScoreFormValues>>["register"];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} {...register(name)} />
    </div>
  );
}
