"use client";

import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  EyeOff,
  ImagePlus,
  Lock,
  MessageSquareWarning,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import {
  lpRequest,
  MODE_HELP,
  MODE_LABELS,
  ProgressBar,
  TreeCommandProvider,
  TreeExpandControls,
  useTreeCommand,
  useTreeOpen,
} from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEt, formatPlainDate, localIsoDate } from "@/lib/labPractice/dates";
import type { EnrollmentDTO, StepDTO } from "@/lib/labPractice/serialize";
import { cn } from "@/lib/utils";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_FILES,
  PHOTO_MIME_TYPES,
} from "@/lib/labPractice/constants";

export type ViewerRole = "trainee" | "trainer" | "admin";

const noopSubscribe = () => () => {};

/** Today's ET date. Null during SSR (avoids a hydration mismatch right
 *  at midnight), the ET date in the browser after hydration. */
function useToday() {
  return useSyncExternalStore(noopSubscribe, () => localIsoDate(), () => null);
}

// ─────────────────────────────────────────────
// Complete dialog (trainee)
// ─────────────────────────────────────────────
function CompleteDialog({
  enrollmentId,
  step,
  open,
  onOpenChange,
}: {
  enrollmentId: number;
  step: StepDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!(PHOTO_MIME_TYPES as readonly string[]).includes(f.type)) {
        toast.error(`"${f.name}" must be PNG, JPEG or WebP.`);
        continue;
      }
      if (f.size > PHOTO_MAX_BYTES) {
        toast.error(`"${f.name}" is larger than 10 MB.`);
        continue;
      }
      if (next.length >= PHOTO_MAX_FILES) {
        toast.error(`At most ${PHOTO_MAX_FILES} photos.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  }

  async function submit() {
    const form = new FormData();
    form.set("practiceDate", localIsoDate());
    files.forEach((f) => form.append("photos", f));
    setBusy(true);
    const ok = await lpRequest(`/api/lab-practice/enrollments/${enrollmentId}/steps/${step.id}`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (ok) {
      toast.success("Step completed.");
      setFiles([]);
      onOpenChange(false);
      router.refresh();
    }
  }

  const needsPhoto = step.requiresPhoto && files.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete “{step.title}”</DialogTitle>
          <DialogDescription>
            {step.requiresPhoto
              ? "This step needs at least one photo as proof."
              : "Photos are optional for this step."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 p-4 text-sm text-white/70 hover:border-itbd-blue hover:text-white">
            <ImagePlus className="size-4" /> Add photos (PNG, JPEG, WebP · max 10 MB each)
            <input
              type="file"
              accept={PHOTO_MIME_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={previews[i]} alt={f.name} className="aspect-square w-full rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <DefaultButton size="sm" onClick={submit} loading={busy} disabled={needsPhoto}>
            Mark complete
          </DefaultButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Reject dialog (trainer)
// ─────────────────────────────────────────────
function RejectDialog({
  enrollmentId,
  step,
  titleOf,
  open,
  onOpenChange,
}: {
  enrollmentId: number;
  step: StepDTO;
  titleOf: Map<number, string>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [alsoReset, setAlsoReset] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/lab-practice/enrollments/${enrollmentId}/steps/${step.id}/reject`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    lpRequest<{ alsoResetStepIds: number[] }>(base).then((res) => {
      if (!cancelled) setAlsoReset(res?.alsoResetStepIds ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, base]);

  async function reject() {
    setBusy(true);
    const ok = await lpRequest(base, { method: "POST", json: { reason } });
    setBusy(false);
    if (ok) {
      toast.success("Completion rejected.");
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject “{step.title}”</DialogTitle>
          <DialogDescription>
            The step goes back to not done and the trainee sees your reason. Its photos are deleted.
          </DialogDescription>
        </DialogHeader>
        {alsoReset && alsoReset.length > 0 && (
          <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
            <p className="font-medium text-white">These later steps will also be reset:</p>
            <ul className="mt-1 list-disc pl-5">
              {alsoReset.map((id) => (
                <li key={id}>{titleOf.get(id) ?? `Step ${id}`}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="What needs to be redone?"
          />
        </div>
        <DialogFooter>
          <DefaultButton
            size="sm"
            onClick={reject}
            loading={busy}
            disabled={reason.trim().length < 3 || alsoReset === null}
          >
            Reject
          </DefaultButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Step row
// ─────────────────────────────────────────────
const STATUS_ICON = {
  done: <CheckCircle2 className="size-4 text-itbd-blue" aria-label="Done" />,
  available: <Circle className="size-4 text-white/60" aria-label="Available" />,
  locked: <Lock className="size-4 text-white/30" aria-label="Locked" />,
};

export function StepRow({
  step,
  index,
  role,
  writable,
  enrollmentId,
  titleOf,
  defaultOpen = false,
  highlight = false,
}: {
  step: StepDTO;
  index: number;
  role: ViewerRole;
  writable: boolean;
  enrollmentId: number;
  titleOf: Map<number, string>;
  /** Start with instructions showing. */
  defaultOpen?: boolean;
  /** The trainee's "up next" step — gets the accent treatment. */
  highlight?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useTreeOpen(defaultOpen);
  const [completing, setCompleting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const latestRejection = step.status !== "done" ? step.rejections[0] : undefined;

  async function undo() {
    setUndoing(true);
    const ok = await lpRequest(`/api/lab-practice/enrollments/${enrollmentId}/steps/${step.id}`, {
      method: "DELETE",
    });
    setUndoing(false);
    if (ok) router.refresh();
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-2",
          step.status === "locked" ? "opacity-60" : "hover:bg-white/5",
          highlight && "bg-itbd-blue/8 ring-1 ring-itbd-blue/40 hover:bg-itbd-blue/10",
        )}
      >
        {STATUS_ICON[step.status]}
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left">
            {highlight && (
              <span className="mr-1 shrink-0 rounded bg-itbd-blue/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-itbd-blue uppercase">
                Up next
              </span>
            )}
            <span className={cn("truncate text-sm", step.status === "done" ? "text-white/60" : "text-white")}>
              <span className="mr-1 text-white/40">{index + 1}.</span>
              {step.title}
            </span>
            {step.requiresPhoto && <Camera className="size-3.5 shrink-0 text-itbd-blue" aria-label="Photo required" />}
            {latestRejection && (
              <MessageSquareWarning className="size-3.5 shrink-0 text-white/70" aria-label="Rejected by trainer" />
            )}
            {step.completion && (
              <span className="ml-2 hidden shrink-0 text-xs text-white/40 sm:inline">
                {formatEt(step.completion.completedAt)}
              </span>
            )}
            <ChevronRight className={cn("ml-auto size-4 shrink-0 text-white/40 transition-transform", open && "rotate-90")} />
          </button>
        </CollapsibleTrigger>
        <div className="flex shrink-0 items-center gap-1">
          {role === "trainee" && writable && step.status === "available" && (
            <DefaultButton size="xs" onClick={() => setCompleting(true)}>
              Complete
            </DefaultButton>
          )}
          {role === "trainee" && writable && step.status === "done" && step.canUnmark && (
            <Button variant="ghost" size="icon-sm" onClick={undo} disabled={undoing} aria-label="Undo completion">
              <Undo2 />
            </Button>
          )}
          {role === "trainer" && step.status === "done" && (
            <Button variant="outline" size="xs" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
        </div>
      </div>
      <CollapsibleContent className={cn("ml-8 space-y-3 pb-3 text-sm", highlight && "pt-2")}>
        {step.instructions ? (
          <p className="whitespace-pre-wrap text-white/70">{step.instructions}</p>
        ) : (
          <p className="text-white/40">No instructions.</p>
        )}
        {latestRejection && (
          <div className="rounded-lg border border-white/15 bg-white/5 p-3">
            <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">Trainer feedback</p>
            <p className="mt-1 whitespace-pre-wrap text-white">{latestRejection.reason}</p>
            <p className="mt-1 text-xs text-white/40">{formatEt(latestRejection.rejectedAt)}</p>
          </div>
        )}
        {step.completion && (
          <div className="space-y-2">
            <p className="text-xs text-white/50">
              Completed {formatEt(step.completion.completedAt)}
            </p>
            {step.completion.files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {step.completion.files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- access-checked API image */}
                    <img
                      src={f.url}
                      alt={f.originalName}
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover ring-1 ring-white/10 hover:ring-itbd-blue"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
      {completing && (
        <CompleteDialog enrollmentId={enrollmentId} step={step} open={completing} onOpenChange={setCompleting} />
      )}
      {rejecting && (
        <RejectDialog
          enrollmentId={enrollmentId}
          step={step}
          titleOf={titleOf}
          open={rejecting}
          onOpenChange={setRejecting}
        />
      )}
    </Collapsible>
  );
}

// ─────────────────────────────────────────────
// Today panel (trainee comment)
// ─────────────────────────────────────────────
function TodayPanel({ data }: { data: EnrollmentDTO }) {
  const today = useToday();
  const session = today ? data.sessions.find((s) => s.practiceDate === today) : undefined;
  const [comment, setComment] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = comment ?? session?.comment ?? "";

  async function save() {
    if (!today) return;
    setSaving(true);
    const ok = await lpRequest(`/api/lab-practice/enrollments/${data.enrollmentId}/comment`, {
      method: "PUT",
      json: { practiceDate: today, comment: value },
    });
    setSaving(false);
    if (ok) toast.success("Comment saved.");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-white">Today</h2>
        <span className="text-sm text-white/50">{today ? `${formatPlainDate(today)} (ET)` : ""}</span>
      </div>
      <p className="text-sm text-white/60">
        {session ? `${session.completedStepIds.length} step(s) completed today.` : "No practice logged yet today."}
      </p>
      <div className="space-y-2">
        <Label htmlFor="today-comment" className="text-white/70">Comment for today</Label>
        <Textarea
          id="today-comment"
          value={value}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="What did you practice? Anything you got stuck on?"
        />
      </div>
      <DefaultButton size="sm" onClick={save} loading={saving} disabled={!today}>
        Save comment
      </DefaultButton>
    </div>
  );
}

// ─────────────────────────────────────────────
// Session history
// ─────────────────────────────────────────────
export function SessionHistory({ data }: { data: EnrollmentDTO }) {
  const titleOf = useStepTitles(data);
  const completedAtOf = new Map(
    data.labs.flatMap((l) =>
      l.tasks.flatMap((t) => t.steps.map((s) => [s.id, s.completion?.completedAt ?? null] as const)),
    ),
  );
  if (data.sessions.length === 0) return <p className="text-sm text-white/50">No practice sessions yet.</p>;
  return (
    <ol className="space-y-3">
      {data.sessions.map((s) => (
        <li key={s.id} className="rounded-lg border border-white/10 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-white">{formatPlainDate(s.practiceDate)}</p>
            <p className="text-xs text-white/50">{s.completedStepIds.length} step(s)</p>
          </div>
          {s.completedStepIds.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-white/60">
              {s.completedStepIds.map((id) => (
                <li key={id}>
                  {titleOf.get(id) ?? `Step ${id}`}
                  {completedAtOf.get(id) && (
                    <span className="text-white/40"> · {formatEt(completedAtOf.get(id))}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {s.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{s.comment}</p>}
        </li>
      ))}
    </ol>
  );
}

export function useStepTitles(data: EnrollmentDTO) {
  return useMemo(
    () =>
      new Map(
        data.labs.flatMap((l) => l.tasks.flatMap((t) => t.steps.map((s) => [s.id, s.title] as const))),
      ),
    [data],
  );
}

// ─────────────────────────────────────────────
// Main tree
// ─────────────────────────────────────────────
type LabDTO = EnrollmentDTO["labs"][number];

function LabSection({
  lab,
  index,
  role,
  writable,
  enrollmentId,
  titleOf,
}: {
  lab: LabDTO;
  index: number;
  role: ViewerRole;
  writable: boolean;
  enrollmentId: number;
  titleOf: Map<number, string>;
}) {
  // Finished and hidden labs start collapsed so the page opens on what's left.
  const [open, setOpen] = useTreeOpen(lab.visible && !lab.rollup.complete);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
            lab.visible ? "bg-white/5" : "border border-dashed border-white/15 opacity-70",
          )}
        >
          <ChevronRight className="size-4 text-white/50 transition-transform group-data-[state=open]:rotate-90" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold text-white">
                <span className="mr-1 text-white/40">Lab {lab.number || index + 1}.</span>
                {lab.title}
              </span>
              {!lab.visible && (
                <Badge variant="outline" className="shrink-0 gap-1 px-1.5 py-0 text-[10px] text-white/60">
                  <EyeOff className="size-3" /> Hidden from trainee
                </Badge>
              )}
            </span>
            <ProgressBar percent={lab.rollup.percent} label={`${lab.title} progress`} className="mt-1.5 h-1.5" />
            {lab.completedAt && (
              <span className="mt-1 block text-xs text-itbd-blue">Lab completed {formatEt(lab.completedAt)}</span>
            )}
          </span>
          <span className="shrink-0 text-right text-xs text-white/50 tabular-nums">
            <span className="block font-medium text-white">{lab.rollup.percent}%</span>
            {lab.rollup.done}/{lab.rollup.total} steps
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2 pl-4">
        {lab.description && <p className="text-sm whitespace-pre-wrap text-white/60">{lab.description}</p>}
        {lab.scenario && (
          <div className="rounded-lg bg-itbd-blue/8 px-3 py-2 ring-1 ring-itbd-blue/20">
            <p className="text-xs font-semibold tracking-wide text-itbd-blue uppercase">Scenario</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-white/70">{lab.scenario}</p>
          </div>
        )}
        {lab.tasks.map((task, ti) => (
          <div key={task.id} className="border-l border-white/10 pl-3">
            <div className="flex items-baseline justify-between gap-2 py-1">
              <p className="text-sm font-medium text-white">
                <span className="mr-1 text-white/40">Task {ti + 1}.</span>
                {task.title}
                {task.rollup.complete && (
                  <CheckCircle2 className="ml-1.5 inline size-3.5 text-itbd-blue" aria-label="Task complete" />
                )}
              </p>
              <span className="shrink-0 text-xs text-white/50 tabular-nums">
                {task.rollup.done}/{task.rollup.total} · {task.rollup.percent}%
              </span>
            </div>
            <ProgressBar
              percent={task.rollup.percent}
              label={`${task.title} progress`}
              className="mb-1.5 h-1 bg-white/5"
            />
            {task.completedAt && (
              <p className="pb-1 text-xs text-itbd-blue/90">Task completed {formatEt(task.completedAt)}</p>
            )}
            {task.description && <p className="pb-1 text-xs whitespace-pre-wrap text-white/50">{task.description}</p>}
            {task.steps.map((step, si) => (
              <StepRow
                key={step.id}
                step={step}
                index={si}
                role={role}
                writable={writable}
                enrollmentId={enrollmentId}
                titleOf={titleOf}
              />
            ))}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PracticeTree({ data, role }: { data: EnrollmentDTO; role: ViewerRole }) {
  const titleOf = useStepTitles(data);
  const writable = data.isActive && data.module.isActive;
  const tree = useTreeCommand();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-itbd-blue/50 text-itbd-blue">
            {MODE_LABELS[data.module.progressionMode]}
          </Badge>
          {!writable && (
            <Badge variant="outline" className="text-white/60">
              Read only
            </Badge>
          )}
          <span className="text-xs text-white/50">{MODE_HELP[data.module.progressionMode]}</span>
        </div>
        <ProgressBar percent={data.module.rollup.percent} label="Module progress" className="h-2.5" />
        <p className="text-sm text-white/60">
          {data.module.rollup.done}/{data.module.rollup.total} steps · {data.module.rollup.percent}%
          {data.module.completedAt && (
            <span className="text-itbd-blue"> · Module completed {formatEt(data.module.completedAt)}</span>
          )}
        </p>
      </div>

      {data.labs.length === 0 ? (
        <p className="text-sm text-white/50">This module has no labs yet.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <p className="text-xs text-white/50">
            {data.labs.length} {data.labs.length === 1 ? "lab" : "labs"}
            {role === "trainee"
              ? data.hiddenLabCount > 0 &&
                ` · ${data.hiddenLabCount} more will be unlocked by your trainer`
              : data.hiddenLabCount > 0 && ` · ${data.hiddenLabCount} hidden from the trainee`}
          </p>
          <TreeExpandControls onExpand={tree.expandAll} onCollapse={tree.collapseAll} />
        </div>
      )}

      <TreeCommandProvider value={tree.cmd}>
        <div className="space-y-4">
          {data.labs.map((lab, li) => (
            <LabSection
              key={lab.id}
              lab={lab}
              index={li}
              role={role}
              writable={writable}
              enrollmentId={data.enrollmentId}
              titleOf={titleOf}
            />
          ))}
        </div>
      </TreeCommandProvider>
    </div>
  );
}

export { TodayPanel };
