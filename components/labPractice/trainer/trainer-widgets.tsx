"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import {
  EmployeeSearch,
  lpRequest,
  MODE_HELP,
  MODE_LABELS,
  ProgressBar,
  type EmployeeOption,
} from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ProgressionMode } from "@/DB/labPracticeSchema";

export function CreateModuleForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState("");
  const [mode, setMode] = useState<ProgressionMode>("fully_sequential");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await lpRequest<{ id: number }>("/api/lab-practice/modules", {
      method: "POST",
      json: { title, info: info || null, progressionMode: mode },
    });
    setBusy(false);
    if (res) {
      toast.success("Module created.");
      router.push(`/dashboard/practice/trainer/modules/${res.id}`);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="new-mod-title" className="text-white/70">Title</Label>
        <Input id="new-mod-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-mod-info" className="text-white/70">Info</Label>
        <Textarea id="new-mod-info" value={info} onChange={(e) => setInfo(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label className="text-white/70">Progression mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as ProgressionMode)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as ProgressionMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-white/50">{MODE_HELP[mode]}</p>
      </div>
      <DefaultButton type="submit" size="sm" loading={busy} disabled={!title.trim()}>
        <Plus className="size-4" /> Create module
      </DefaultButton>
    </form>
  );
}

export type EnrollmentListItem = {
  id: number;
  isActive: boolean;
  traineeName: string;
  traineeEmail: string;
  percent: number;
  done: number;
  total: number;
};

/** Enroll trainees in a module + list this trainer's enrollments for it. */
export function EnrollmentPanel({
  moduleId,
  moduleActive,
  enrollments,
}: {
  moduleId: number;
  moduleActive: boolean;
  enrollments: EnrollmentListItem[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<EmployeeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  async function enroll() {
    setBusy(true);
    const res = await lpRequest<{
      enrolled: number;
      reactivated: number;
      unchanged: number;
      conflicts: number[];
    }>("/api/lab-practice/enrollments", {
      method: "POST",
      json: { moduleId, traineeIds: picked.map((p) => p.id) },
    });
    setBusy(false);
    if (!res) return;
    const added = res.enrolled + res.reactivated;
    toast.success(`${added} trainee${added === 1 ? "" : "s"} enrolled.`);
    if (res.conflicts.length) {
      toast.warning(`${res.conflicts.length} already enrolled with another trainer.`);
    }
    setPicked([]);
    router.refresh();
  }

  async function toggle(e: EnrollmentListItem, isActive: boolean) {
    setToggling(e.id);
    const ok = await lpRequest(`/api/lab-practice/enrollments/${e.id}`, {
      method: "PATCH",
      json: { isActive },
    });
    setToggling(null);
    if (ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      {moduleActive ? (
        <div className="space-y-2">
          <EmployeeSearch
            excludeIds={picked.map((p) => p.id)}
            onPick={(e) => setPicked((prev) => [...prev, e])}
          />
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1">
                  {p.fullName}
                  <button
                    type="button"
                    onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.fullName}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <DefaultButton size="sm" onClick={enroll} loading={busy} disabled={picked.length === 0}>
            Enroll {picked.length || ""} trainee{picked.length === 1 ? "" : "s"}
          </DefaultButton>
        </div>
      ) : (
        <p className="text-sm text-white/60">Activate the module to enroll trainees.</p>
      )}

      <div className="divide-y divide-white/10 rounded-lg border border-white/10">
        {enrollments.length === 0 ? (
          <p className="p-4 text-sm text-white/50">You haven&apos;t enrolled anyone in this module.</p>
        ) : (
          enrollments.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3">
              <Link
                href={`/dashboard/practice/trainer/trainees/${e.id}`}
                className="min-w-0 flex-1 space-y-1.5 hover:opacity-90"
              >
                <p className="truncate text-sm font-medium text-white">
                  {e.traineeName}
                  {!e.isActive && (
                    <Badge variant="outline" className="ml-2 text-white/60">
                      Unassigned
                    </Badge>
                  )}
                </p>
                <ProgressBar percent={e.percent} label={`${e.traineeName} progress`} />
                <p className="text-xs text-white/50">
                  {e.done}/{e.total} steps · {e.percent}%
                </p>
              </Link>
              <Switch
                checked={e.isActive}
                disabled={toggling === e.id}
                onCheckedChange={(v) => toggle(e, v)}
                aria-label={`${e.traineeName} assigned`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
