"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertGlossaryTermSchema, type UpsertGlossaryTermInput } from "@/lib/validation/labs";

export function GlossaryTermForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<UpsertGlossaryTermInput>({
    resolver: zodResolver(upsertGlossaryTermSchema),
    defaultValues: { term: "", category: "", definition: "", example: "" },
  });

  async function onSubmit(values: UpsertGlossaryTermInput) {
    setSubmitting(true);
    const response = await fetch("/api/labs/admin/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to create term.");
      return;
    }

    toast.success("Term added.");
    form.reset();
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="term" className="text-white/70">Term</Label>
          <Input id="term" {...form.register("term")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category" className="text-white/70">Category</Label>
          <Input id="category" placeholder="Identity, Azure, Security..." {...form.register("category")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="definition" className="text-white/70">Definition</Label>
        <Textarea id="definition" className="min-h-24" {...form.register("definition")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="example" className="text-white/70">Example (optional)</Label>
        <Textarea id="example" {...form.register("example")} />
      </div>
      <DefaultButton type="submit" loading={submitting}>Add term</DefaultButton>
    </form>
  );
}
