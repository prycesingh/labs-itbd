"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Eye, EyeOff, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import DefaultButton from "@/components/app_componentes/customButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_BASE = "/api/emailAssessment";

const scenarioSchema = z.object({
  title: z.string().trim().min(3).max(220),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  category: z.string().trim().min(2).max(120),
  prompt: z.string().trim().min(20),
  scoringNotes: z.string().trim().optional(),
});

type ScenarioFormValues = z.infer<typeof scenarioSchema>;

type ScenarioEditCardProps = {
  scenario: {
    id: string;
    title: string;
    prompt: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    category: string;
    scoringNotes: string | null;
    active: boolean;
  };
};

const DIFFICULTY_STYLES: Record<
  ScenarioEditCardProps["scenario"]["difficulty"],
  string
> = {
  beginner: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  intermediate: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  advanced: "border-rose-400/40 bg-rose-500/10 text-rose-300",
};

export function ScenarioEditCard({ scenario }: ScenarioEditCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(scenario.active);
  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      title: scenario.title,
      difficulty: scenario.difficulty,
      category: scenario.category,
      prompt: scenario.prompt,
      scoringNotes: scenario.scoringNotes ?? "",
    },
  });

  async function onSubmit(values: ScenarioFormValues) {
    setSaving(true);
    const response = await fetch(`${API_BASE}/admin/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to save scenario.");
      return;
    }

    toast.success("Scenario updated.");
    setEditing(false);
    router.refresh();
  }

  async function toggleActive() {
    setSaving(true);
    const response = await fetch(`${API_BASE}/admin/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to update scenario status.");
      return;
    }

    setActive(!active);
    toast.success(active ? "Scenario deactivated." : "Scenario activated.");
    router.refresh();
  }

  async function archiveScenario() {
    if (!window.confirm("Archive this scenario? This will deactivate it.")) {
      return;
    }

    setSaving(true);
    const response = await fetch(`${API_BASE}/admin/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    const body = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to archive scenario.");
      return;
    }

    toast.success("Scenario archived.");
    router.refresh();
  }

  return (
    <div
      className={cn(
        "group rounded-xl bg-white/4 p-4 ring-1 ring-white/10 backdrop-blur-sm transition-all hover:bg-white/6 hover:ring-primary/30",
        !active && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "capitalize",
                DIFFICULTY_STYLES[scenario.difficulty],
              )}
            >
              {scenario.difficulty}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/10 text-muted-foreground"
            >
              {scenario.category}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                active ? "text-emerald-400" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-emerald-400" : "bg-muted-foreground/50",
                )}
              />
              {active ? "Active" : "Inactive"}
            </span>
          </div>
          <h3 className="truncate text-base leading-tight">{scenario.title}</h3>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleActive}
            disabled={saving}
            aria-label={active ? "Deactivate scenario" : "Activate scenario"}
            title={active ? "Deactivate" : "Activate"}
          >
            {active ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing((value) => !value)}
            disabled={saving}
            aria-label={editing ? "Cancel editing" : "Edit scenario"}
            title={editing ? "Cancel" : "Edit"}
          >
            {editing ? (
              <X className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={archiveScenario}
            disabled={saving}
            aria-label="Archive scenario"
            title="Archive"
            className="text-muted-foreground hover:text-rose-400"
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!editing ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {scenario.prompt}
        </p>
      ) : (
        <form
          className="mt-4 space-y-4 border-t border-white/10 pt-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`title-${scenario.id}`}>Title</Label>
              <Input id={`title-${scenario.id}`} {...form.register("title")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`category-${scenario.id}`}>Category</Label>
              <Input
                id={`category-${scenario.id}`}
                {...form.register("category")}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`difficulty-${scenario.id}`}>Difficulty</Label>
              <select
                id={`difficulty-${scenario.id}`}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                {...form.register("difficulty")}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`prompt-${scenario.id}`}>Prompt</Label>
            <Textarea
              id={`prompt-${scenario.id}`}
              className="min-h-28"
              {...form.register("prompt")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`scoringNotes-${scenario.id}`}>Scoring notes</Label>
            <Textarea
              id={`scoringNotes-${scenario.id}`}
              {...form.register("scoringNotes")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <DefaultButton type="submit" size="sm" loading={saving}>
              Save changes
            </DefaultButton>
          </div>
        </form>
      )}
    </div>
  );
}
