"use client";

import { Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import {
  EmployeeSearch,
  EnrollmentTimes,
  lpRequest,
  MODE_HELP,
  MODE_LABELS,
  ProgressBar,
  type EmployeeOption,
} from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/**
 * Oversight trainer picker (guidedLabs.viewAll): "all" | "me" | a trainer id,
 * kept in the `?trainer=` search param so the server page filters the roster.
 */
export function TrainerPicker({
  value,
  trainers,
  myTrainerId,
}: {
  value: string;
  trainers: { id: number; fullName: string; traineeCount: number }[];
  myTrainerId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const others = trainers.filter((t) => t.id !== myTrainerId);
  const mine = trainers.find((t) => t.id === myTrainerId);

  return (
    <Select
      value={value}
      onValueChange={(v) =>
        startTransition(() => router.replace(v === "all" ? pathname : `${pathname}?trainer=${v}`, { scroll: false }))
      }
    >
      <SelectTrigger
        className={pending ? "w-full opacity-60 sm:w-64" : "w-full sm:w-64"}
        aria-label="Show trainees of"
        aria-busy={pending}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All trainers</SelectItem>
        <SelectItem value="me">My trainees{mine ? ` (${mine.traineeCount})` : ""}</SelectItem>
        {others.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            {t.fullName} ({t.traineeCount})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
      router.push(`/dashboard/guided-labs/trainer/modules/${res.id}`);
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

/**
 * Permanently delete an enrollment (e.g. the wrong person was enrolled).
 * Unlike unassigning, this also deletes their progress, photos and practice
 * log, so the dialog spells out what will be lost.
 */
export function RemoveEnrollmentButton({
  enrollmentId,
  traineeName,
  moduleTitle,
  footprint,
  redirectTo,
  variant = "button",
}: {
  enrollmentId: number;
  traineeName: string;
  moduleTitle: string;
  footprint?: { completedSteps: number; photos: number; practiceDays: number };
  /** Where to go after removal (the current page no longer exists). */
  redirectTo?: string;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasHistory = footprint
    ? footprint.completedSteps + footprint.photos + footprint.practiceDays > 0
    : true;

  async function remove() {
    setBusy(true);
    const ok = await lpRequest(`/api/lab-practice/enrollments/${enrollmentId}`, { method: "DELETE" });
    setBusy(false);
    if (!ok) return;
    toast.success(`Removed ${traineeName} from ${moduleTitle}.`);
    setOpen(false);
    if (redirectTo) router.replace(redirectTo);
    router.refresh();
  }

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-white/40 hover:text-destructive"
          onClick={() => setOpen(true)}
          aria-label={`Remove ${traineeName}'s enrollment`}
          title="Remove enrollment"
        >
          <Trash2 />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 /> Remove enrollment
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove enrollment</DialogTitle>
            <DialogDescription>
              Remove {traineeName} from &ldquo;{moduleTitle}&rdquo;? They&rsquo;ll lose access and disappear from your
              trainee list. To pause them but keep their history, unassign instead.
            </DialogDescription>
          </DialogHeader>
          {hasHistory && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-white/80">
              {footprint ? (
                <>
                  This permanently deletes{" "}
                  <span className="font-medium text-white tabular-nums">
                    {footprint.completedSteps} completed {footprint.completedSteps === 1 ? "step" : "steps"},{" "}
                    {footprint.photos} {footprint.photos === 1 ? "photo" : "photos"} and {footprint.practiceDays}{" "}
                    practice {footprint.practiceDays === 1 ? "day" : "days"}
                  </span>
                  . This can&rsquo;t be undone.
                </>
              ) : (
                "This permanently deletes their completed steps, photos and practice log. This can't be undone."
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
              {busy ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  enrolledAt: string;
  lastActivityAt: string | null;
  completedAt: string | null;
  batchName: string | null;
  visibleLabs: number;
  totalLabs: number;
};

/** Enroll trainees in a module + list this trainer's enrollments for it. */
export function EnrollmentPanel({
  moduleId,
  moduleTitle,
  moduleActive,
  enrollments,
}: {
  moduleId: number;
  moduleTitle: string;
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
                href={`/dashboard/guided-labs/trainer/trainees/${e.id}`}
                className="min-w-0 flex-1 space-y-1.5 hover:opacity-90"
              >
                <p className="truncate text-sm font-medium text-white">
                  {e.traineeName}
                  {!e.isActive && (
                    <Badge variant="outline" className="ml-2 text-white/60">
                      Unassigned
                    </Badge>
                  )}
                  {e.batchName && (
                    <Badge variant="outline" className="ml-2 border-itbd-blue/40 text-itbd-blue">
                      {e.batchName}
                    </Badge>
                  )}
                </p>
                <ProgressBar percent={e.percent} label={`${e.traineeName} progress`} />
                <p className="text-xs text-white/50 tabular-nums">
                  {e.done}/{e.total} steps · {e.percent}% · {e.visibleLabs}/{e.totalLabs} labs visible
                </p>
                <EnrollmentTimes
                  enrolledAt={e.enrolledAt}
                  lastActivityAt={e.lastActivityAt}
                  completedAt={e.completedAt}
                />
              </Link>
              <Switch
                checked={e.isActive}
                disabled={toggling === e.id}
                onCheckedChange={(v) => toggle(e, v)}
                aria-label={`${e.traineeName} assigned`}
                title={e.isActive ? "Unassign (keeps history)" : "Re-assign"}
              />
              <RemoveEnrollmentButton
                variant="icon"
                enrollmentId={e.id}
                traineeName={e.traineeName}
                moduleTitle={moduleTitle}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
