"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { lpRequest } from "@/components/labPractice/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Create a batch
// ─────────────────────────────────────────────
type Source = "schedule" | "module";

/**
 * Every batch follows a day schedule. "Teach one module" builds (or reuses) a
 * schedule from that module's labs, so single-module teaching and multi-module
 * bootcamps work the same way afterwards.
 */
export function CreateBatchForm({
  schedules,
  modules,
}: {
  schedules: { id: number; name: string; dayCount: number }[];
  modules: { id: number; title: string }[];
}) {
  const router = useRouter();
  const [source, setSource] = useState<Source>(schedules.length ? "schedule" : "module");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || !target) return;
    setBusy(true);
    const res =
      source === "schedule"
        ? await lpRequest<{ id: number }>(`/api/lab-practice/schedules/${target}/batches`, {
            method: "POST",
            json: { name: name.trim() },
          }).then((r) => (r ? { batchId: r.id, createdSchedule: false } : null))
        : await lpRequest<{ batchId: number; createdSchedule: boolean }>(`/api/lab-practice/modules/${target}/batches`, {
            method: "POST",
            json: { name: name.trim() },
          });
    setBusy(false);
    if (!res) return;
    if (res.createdSchedule) toast.success("Built a day schedule from the module's labs.");
    router.push(`/dashboard/guided-labs/trainer/batches/${res.batchId}`);
  }

  const options = source === "schedule" ? schedules.map((s) => ({ id: s.id, label: `${s.name} · ${s.dayCount} days` })) : modules.map((m) => ({ id: m.id, label: m.title }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <div role="radiogroup" aria-label="Batch follows" className="grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1">
        {(
          [
            ["schedule", "A day schedule"],
            ["module", "One module"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={source === value}
            onClick={() => {
              setSource(value);
              setTarget("");
            }}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              source === value ? "bg-itbd-blue text-black" : "text-white/60 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-white/60">{source === "schedule" ? "Schedule" : "Module"}</Label>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-full" aria-label={source === "schedule" ? "Schedule" : "Module"}>
            <SelectValue placeholder={source === "schedule" ? "Pick a schedule…" : "Pick a module…"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {source === "module" && (
          <p className="text-[11px] text-white/40">Uses the module&rsquo;s own day plan — built from its lab titles the first time.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-batch-name" className="text-xs text-white/60">
          Batch name
        </Label>
        <Input
          id="new-batch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nov 2026 cohort"
          maxLength={120}
        />
      </div>
      <DefaultButton type="submit" className="w-full" loading={busy} disabled={!name.trim() || !target}>
        <Plus className="size-4" /> Create batch
      </DefaultButton>
    </form>
  );
}

// ─────────────────────────────────────────────
// Module page → batches that use this module
// ─────────────────────────────────────────────
export type ModuleBatchRow = {
  id: number;
  name: string;
  isActive: boolean;
  scheduleName: string | null;
  trainerName: string;
  memberCount: number;
  currentDay: number;
  totalDays: number;
  legacy: boolean;
};

export function ModuleBatchesPanel({
  moduleId,
  moduleActive,
  batches,
}: {
  moduleId: number;
  moduleActive: boolean;
  batches: ModuleBatchRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await lpRequest<{ batchId: number; createdSchedule: boolean }>(`/api/lab-practice/modules/${moduleId}/batches`, {
      method: "POST",
      json: { name: name.trim() },
    });
    setBusy(false);
    if (!res) return;
    if (res.createdSchedule) toast.success("Built a day schedule from this module's labs.");
    router.push(`/dashboard/guided-labs/trainer/batches/${res.batchId}`);
  }

  return (
    <div className="space-y-3">
      {batches.length === 0 ? (
        <p className="text-sm text-white/50">No batch uses this module yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {batches.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/guided-labs/trainer/batches/${b.id}`}
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-medium", b.isActive ? "text-white" : "text-white/50")}>
                    {b.name}
                  </span>
                  <span className="block truncate text-xs text-white/50">
                    {b.legacy ? "Module batch (convert)" : `${b.currentDay ? `Day ${b.currentDay}/${b.totalDays}` : "Not started"} · ${b.scheduleName}`}
                    {" · "}
                    {b.memberCount} · {b.trainerName}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {moduleActive && (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Label htmlFor="teach-module-batch" className="text-xs text-white/60">
            Teach this module to a new batch
          </Label>
          <div className="flex gap-2">
            <Input
              id="teach-module-batch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Batch name"
              maxLength={120}
              className="h-8"
            />
            <DefaultButton type="submit" size="sm" loading={busy} disabled={!name.trim()}>
              <Plus className="size-4" /> Create
            </DefaultButton>
          </div>
          <p className="text-[11px] text-white/40">
            Follows this module&rsquo;s day schedule. For a multi-module plan, create the batch from a schedule on the
            Batches tab.
          </p>
        </form>
      )}
    </div>
  );
}

