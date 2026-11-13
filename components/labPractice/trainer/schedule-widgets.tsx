"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import {
  EmployeeSearch,
  lpRequest,
  ProgressBar,
  TreeCommandProvider,
  TreeExpandControls,
  useTreeCommand,
  useTreeOpen,
  type EmployeeOption,
} from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatEt } from "@/lib/labPractice/dates";
import { cn } from "@/lib/utils";

/**
 * Day schedules UI (trainer side):
 *   SchedulesCard      — list / create schedules (trainer workspace)
 *   ScheduleBuilder    — days ⇄ labs editor + generator (schedule page)
 *   ScheduleBatches    — create / list batches following a schedule
 *   BatchDaysPanel     — switch days on/off, "Activate next day" (batch page)
 *   ScheduleBatchRoster— members, trainee × day grid, per-trainee day overrides
 */

/** "M1 · End User Computing … — L1 Junior" → "M1·L1". */
export function moduleShort(title: string) {
  const code = title.split("·")[0]?.trim();
  const level = /—\s*(L\d+)/.exec(title)?.[1];
  if (code && code.length <= 4) return level ? `${code}·${level}` : code;
  return title.length > 14 ? `${title.slice(0, 12)}…` : title;
}

function ModuleChip({ title, className }: { title: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/70 tabular-nums ring-1 ring-white/15",
        className,
      )}
    >
      {moduleShort(title)}
    </span>
  );
}

// ─────────────────────────────────────────────
// Workspace: schedules list
// ─────────────────────────────────────────────
export type ScheduleCardItem = {
  id: number;
  name: string;
  isActive: boolean;
  dayCount: number;
  labCount: number;
  batchCount: number;
};

export function SchedulesCard({ schedules }: { schedules: ScheduleCardItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await lpRequest<{ id: number }>("/api/lab-practice/schedules", {
      method: "POST",
      json: { name: name.trim() },
    });
    setBusy(false);
    if (res) router.push(`/dashboard/guided-labs/trainer/schedules/${res.id}`);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        Group labs from any module into days (Day 1, Day 2…), then switch days on for a batch.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Schedule name, e.g. Bootcamp 3.0"
          maxLength={120}
          aria-label="New schedule name"
          className="h-8"
        />
        <DefaultButton type="submit" size="sm" loading={busy} disabled={!name.trim()}>
          <Plus className="size-4" /> Create
        </DefaultButton>
      </form>
      {schedules.length === 0 ? (
        <p className="text-sm text-white/50">No schedules yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {schedules.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/guided-labs/trainer/schedules/${s.id}`}
                className="group flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <CalendarDays className="size-4 shrink-0 text-itbd-blue" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm font-medium", s.isActive ? "text-white" : "text-white/50")}>
                      {s.name}
                    </span>
                    {!s.isActive && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-white/60">
                        Archived
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-white/50 tabular-nums">
                    {s.dayCount} days · {s.labCount} labs · {s.batchCount} {s.batchCount === 1 ? "batch" : "batches"}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-white/30 transition-colors group-hover:text-itbd-blue" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────
export type BuilderLabItem = { labId: number; title: string; moduleId: number; moduleTitle: string; isActive: boolean };
export type BuilderDay = { id: number; dayNo: number; title: string | null; labs: BuilderLabItem[] };
export type BuilderData = {
  scheduleId: number;
  days: BuilderDay[];
  unscheduled: { moduleId: number; moduleTitle: string; labs: BuilderLabItem[] }[];
  modules: { id: number; title: string; labCount: number }[];
};

function moduleMix(labs: BuilderLabItem[]) {
  const counts = new Map<string, number>();
  for (const l of labs) counts.set(l.moduleTitle, (counts.get(l.moduleTitle) ?? 0) + 1);
  return [...counts.entries()];
}

function DayRow({
  day,
  days,
  isFirst,
  isLast,
  query,
}: {
  day: BuilderDay;
  days: BuilderDay[];
  isFirst: boolean;
  isLast: boolean;
  query: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useTreeOpen(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(day.title ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const labs = query ? day.labs.filter((l) => l.title.toLowerCase().includes(query)) : day.labs;
  const isOpen = open || (!!query && labs.length > 0);

  async function call(url: string, init: Parameters<typeof lpRequest>[1]) {
    setBusy(true);
    const ok = await lpRequest(url, init);
    setBusy(false);
    if (ok) router.refresh();
    return ok;
  }

  return (
    <li className="border-b border-white/10 last:border-b-0">
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-2 py-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-0.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ChevronRight
                className={cn("size-4 shrink-0 text-white/40 transition-transform", isOpen && "rotate-90 text-itbd-blue")}
              />
              <span className="w-14 shrink-0 text-sm font-semibold text-itbd-blue tabular-nums">Day {day.dayNo}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", day.title ? "text-white" : "text-white/40 italic")}>
                  {day.title || "Untitled day"}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {moduleMix(day.labs).map(([mod, n]) => (
                    <span key={mod} className="inline-flex items-center gap-1 text-[11px] text-white/50 tabular-nums">
                      <ModuleChip title={mod} /> ×{n}
                    </span>
                  ))}
                </span>
              </span>
              <span className="shrink-0 text-xs text-white/50 tabular-nums">
                {day.labs.length} {day.labs.length === 1 ? "lab" : "labs"}
              </span>
            </button>
          </CollapsibleTrigger>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy || isFirst}
              onClick={() => call(`/api/lab-practice/schedule-days/${day.id}`, { method: "PATCH", json: { move: -1 } })}
              aria-label={`Move day ${day.dayNo} earlier`}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy || isLast}
              onClick={() => call(`/api/lab-practice/schedule-days/${day.id}`, { method: "PATCH", json: { move: 1 } })}
              aria-label={`Move day ${day.dayNo} later`}
            >
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Rename day ${day.dayNo}`}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white/50 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete day ${day.dayNo}`}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          {labs.length === 0 ? (
            <p className="px-10 pb-3 text-sm text-white/40">
              {query ? "No labs match." : "No labs yet — add some from Unscheduled labs."}
            </p>
          ) : (
            <ul className="ml-9 border-l border-white/10 pb-2 pl-2">
              {labs.map((lab) => (
                <li key={lab.labId} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                  <ModuleChip title={lab.moduleTitle} />
                  <span className={cn("min-w-0 flex-1 truncate text-sm", lab.isActive ? "text-white/85" : "text-white/40 line-through")}>
                    {lab.title}
                  </span>
                  <Select
                    value=""
                    onValueChange={(target) =>
                      call(`/api/lab-practice/schedule-days/${target}/labs`, { method: "PUT", json: { add: [lab.labId] } })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-white/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Move ${lab.title} to another day`}
                    >
                      <SelectValue placeholder="Move to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {days
                        .filter((d) => d.id !== day.id)
                        .map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            Day {d.dayNo}
                            {d.title ? ` — ${d.title}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-white/40 hover:text-white"
                    disabled={busy}
                    onClick={() =>
                      call(`/api/lab-practice/schedule-days/${day.id}/labs`, { method: "PUT", json: { remove: [lab.labId] } })
                    }
                    aria-label={`Remove ${lab.title} from day ${day.dayNo}`}
                    title="Remove from schedule"
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Day {day.dayNo}</DialogTitle>
            <DialogDescription>A short topic helps trainees and trainers, e.g. “Active Directory: DNS”.</DialogDescription>
          </DialogHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Day title" />
          <DialogFooter>
            <DefaultButton
              size="sm"
              loading={busy}
              onClick={async () => {
                if (await call(`/api/lab-practice/schedule-days/${day.id}`, { method: "PATCH", json: { title: title.trim() || null } })) {
                  setEditing(false);
                }
              }}
            >
              Save
            </DefaultButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(v) => !busy && setConfirmDelete(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Day {day.dayNo}</DialogTitle>
            <DialogDescription>
              Its {day.labs.length} labs go back to Unscheduled and later days move up one. Batches that had this day on
              will lose it. Trainee progress isn&rsquo;t touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (await call(`/api/lab-practice/schedule-days/${day.id}`, { method: "DELETE" })) setConfirmDelete(false);
              }}
            >
              Delete day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function UnscheduledPanel({ data }: { data: BuilderData }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<string>(data.days[0] ? String(data.days[0].id) : "");
  const [busy, setBusy] = useState(false);
  const total = data.unscheduled.reduce((n, g) => n + g.labs.length, 0);

  function toggle(ids: number[], on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function add() {
    if (!target || !picked.size) return;
    setBusy(true);
    const ok = await lpRequest(`/api/lab-practice/schedule-days/${target}/labs`, {
      method: "PUT",
      json: { add: [...picked] },
    });
    setBusy(false);
    if (ok) {
      toast.success(`${picked.size} ${picked.size === 1 ? "lab" : "labs"} added.`);
      setPicked(new Set());
      router.refresh();
    }
  }

  if (total === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-white/60">
        <Check className="size-4 text-itbd-blue" /> Every lab is in a day.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger size="sm" className="min-w-36 flex-1" aria-label="Add selected labs to day">
            <SelectValue placeholder={data.days.length ? "Choose a day" : "Add a day first"} />
          </SelectTrigger>
          <SelectContent>
            {data.days.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                Day {d.dayNo}
                {d.title ? ` — ${d.title}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DefaultButton size="sm" onClick={add} loading={busy} disabled={!picked.size || !target}>
          Add {picked.size || ""} to day
        </DefaultButton>
      </div>
      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
        {data.unscheduled.map((g) => {
          const ids = g.labs.map((l) => l.labId);
          const all = ids.every((id) => picked.has(id));
          return (
            <div key={g.moduleId} className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <Checkbox checked={all} onCheckedChange={(v) => toggle(ids, v === true)} aria-label={`Select all from ${g.moduleTitle}`} />
                <ModuleChip title={g.moduleTitle} />
                <span className="truncate">{g.moduleTitle}</span>
                <span className="ml-auto font-normal text-white/40 tabular-nums">{g.labs.length}</span>
              </label>
              <ul className="ml-6 space-y-0.5">
                {g.labs.map((l) => (
                  <li key={l.labId}>
                    <label className="flex items-center gap-2 rounded px-1 py-1 text-sm text-white/80 hover:bg-white/5">
                      <Checkbox checked={picked.has(l.labId)} onCheckedChange={(v) => toggle([l.labId], v === true)} />
                      <span className="truncate">{l.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenerateDaysDialog({ data, open, onOpenChange }: { data: BuilderData; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [moduleIds, setModuleIds] = useState<number[]>(() => data.modules.map((m) => m.id));
  const [strategy, setStrategy] = useState<"fromTitles" | "perDay">("fromTitles");
  const [perDay, setPerDay] = useState(5);
  const [replace, setReplace] = useState(data.days.length === 0);
  const [preview, setPreview] = useState<{ placed: number; unplaced: number; totalDays: number; days: { dayNo: number; labCount: number; isNew: boolean }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const body = { moduleIds, strategy, perDay, replace };

  async function run(dryRun: boolean) {
    setBusy(true);
    const res = await lpRequest<NonNullable<typeof preview>>(`/api/lab-practice/schedules/${data.scheduleId}/generate`, {
      method: "POST",
      json: { ...body, dryRun },
    });
    setBusy(false);
    if (!res) return;
    if (dryRun) {
      setPreview(res);
      return;
    }
    toast.success(`Placed ${res.placed} labs across ${res.totalDays} days.`);
    onOpenChange(false);
    setPreview(null);
    router.refresh();
  }

  function change<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPreview(null);
    };
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate days</DialogTitle>
          <DialogDescription>Build days automatically, then fine-tune them by hand.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Modules (in this order)</Label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
              {data.modules.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-white/80 hover:bg-white/5">
                  <Checkbox
                    checked={moduleIds.includes(m.id)}
                    onCheckedChange={(v) =>
                      change(setModuleIds)(v === true ? [...moduleIds, m.id] : moduleIds.filter((id) => id !== m.id))
                    }
                  />
                  <ModuleChip title={m.title} />
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  <span className="text-xs text-white/40 tabular-nums">{m.labCount}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>How</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["fromTitles", "From lab titles", "“Day 05.2 — …” goes into Day 5."],
                  ["perDay", "Fixed labs per day", "Fill each day in module order."],
                ] as const
              ).map(([value, label, help]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => change(setStrategy)(value)}
                  aria-pressed={strategy === value}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    strategy === value ? "border-itbd-blue/60 bg-itbd-blue/10" : "border-white/10 hover:bg-white/5",
                  )}
                >
                  <span className="block text-sm font-medium text-white">{label}</span>
                  <span className="block text-xs text-white/50">{help}</span>
                </button>
              ))}
            </div>
            {strategy === "perDay" && (
              <label className="flex items-center gap-2 text-sm text-white/70">
                Labs per day
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={perDay}
                  onChange={(e) => change(setPerDay)(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="h-8 w-20"
                />
              </label>
            )}
          </div>

          <label className="flex items-start justify-between gap-3 text-sm text-white/70">
            <span>
              Start over
              <span className="block text-xs text-white/40">
                {replace
                  ? "Deletes the current days first. Batches lose the days they had switched on."
                  : "Keeps current days; only labs that aren't in a day yet are placed."}
              </span>
            </span>
            <Switch checked={replace} onCheckedChange={change(setReplace)} />
          </label>

          {preview && (
            <div className="space-y-2 rounded-lg border border-itbd-blue/30 bg-itbd-blue/5 p-3">
              <p className="text-sm text-white">
                <span className="font-semibold tabular-nums">{preview.placed}</span> labs into{" "}
                <span className="font-semibold tabular-nums">{preview.days.length}</span> days
                {preview.unplaced > 0 && (
                  <span className="text-white/60"> · {preview.unplaced} without a day number stay unscheduled</span>
                )}
              </p>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {preview.days.map((d) => (
                  <span
                    key={d.dayNo}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] tabular-nums",
                      d.isNew ? "bg-itbd-blue/15 text-itbd-blue" : "bg-white/10 text-white/70",
                    )}
                    title={d.isNew ? "New day" : "Added to existing day"}
                  >
                    D{d.dayNo}·{d.labCount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {preview ? (
            <DefaultButton size="sm" loading={busy} onClick={() => run(false)} disabled={preview.placed === 0}>
              Generate {preview.days.length} days
            </DefaultButton>
          ) : (
            <DefaultButton size="sm" loading={busy} onClick={() => run(true)} disabled={!moduleIds.length}>
              Preview
            </DefaultButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleBuilder({ data }: { data: BuilderData }) {
  const router = useRouter();
  const tree = useTreeCommand();
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const query = search.trim().toLowerCase();
  const labCount = data.days.reduce((n, d) => n + d.labs.length, 0);
  const visibleDays = query ? data.days.filter((d) => d.labs.some((l) => l.title.toLowerCase().includes(query))) : data.days;

  async function addDay() {
    setAdding(true);
    const ok = await lpRequest(`/api/lab-practice/schedules/${data.scheduleId}/days`, { method: "POST", json: {} });
    setAdding(false);
    if (ok) router.refresh();
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a lab…"
              aria-label="Find a lab in the schedule"
              className="h-8 pl-9"
            />
          </div>
          <TreeExpandControls onExpand={tree.expandAll} onCollapse={tree.collapseAll} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-white/50 tabular-nums">
            {data.days.length} days · {labCount} labs
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addDay} disabled={adding}>
              <CalendarPlus /> Add day
            </Button>
            <DefaultButton size="sm" onClick={() => setGenerating(true)}>
              <Wand2 className="size-4" /> Generate days
            </DefaultButton>
          </div>
        </div>

        {data.days.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 px-4 py-10 text-center">
            <p className="text-sm text-white/70">No days yet.</p>
            <p className="mt-1 text-xs text-white/50">
              Use <span className="text-itbd-blue">Generate days</span> to build them from lab titles, or add days one by one.
            </p>
          </div>
        ) : visibleDays.length === 0 ? (
          <p className="text-sm text-white/50">No labs match &ldquo;{search.trim()}&rdquo;.</p>
        ) : (
          <TreeCommandProvider value={tree.cmd}>
            <ul className="rounded-lg border border-white/10">
              {visibleDays.map((d) => (
                <DayRow
                  key={d.id}
                  day={d}
                  days={data.days}
                  isFirst={d.dayNo === 1}
                  isLast={d.dayNo === data.days.length}
                  query={query}
                />
              ))}
            </ul>
          </TreeCommandProvider>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Unscheduled labs</h3>
        <UnscheduledPanel data={data} />
      </div>

      {generating && <GenerateDaysDialog data={data} open={generating} onOpenChange={setGenerating} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Schedule → batches
// ─────────────────────────────────────────────
export type ScheduleBatchItem = {
  id: number;
  name: string;
  isActive: boolean;
  trainerName: string;
  memberCount: number;
  activeDays: number;
  lastActiveDay: number | null;
};

export function ScheduleBatches({
  scheduleId,
  totalDays,
  batches,
}: {
  scheduleId: number;
  totalDays: number;
  batches: ScheduleBatchItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await lpRequest<{ id: number }>(`/api/lab-practice/schedules/${scheduleId}/batches`, {
      method: "POST",
      json: { name: name.trim() },
    });
    setBusy(false);
    if (res) router.push(`/dashboard/guided-labs/trainer/batches/${res.id}`);
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Batch name, e.g. Nov 2026 cohort"
          maxLength={120}
          aria-label="New batch name"
          className="h-8"
        />
        <DefaultButton type="submit" size="sm" loading={busy} disabled={!name.trim()}>
          <Plus className="size-4" /> Create
        </DefaultButton>
      </form>
      {batches.length === 0 ? (
        <p className="text-sm text-white/50">No batches follow this schedule yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {batches.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/guided-labs/trainer/batches/${b.id}`}
                className="group flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm font-medium", b.isActive ? "text-white" : "text-white/50")}>{b.name}</span>
                    {!b.isActive && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-white/60">
                        Archived
                      </Badge>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-white/50 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> {b.memberCount}
                    </span>
                    <span>
                      {b.activeDays}/{totalDays} days on{b.lastActiveDay ? ` · up to Day ${b.lastActiveDay}` : ""}
                    </span>
                    <span className="text-white/40">{b.trainerName}</span>
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-white/30 transition-colors group-hover:text-itbd-blue" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Schedule batch → days on/off
// ─────────────────────────────────────────────
export type BatchDayItem = { id: number; dayNo: number; title: string | null; labCount: number; active: boolean };

export function BatchDaysPanel({ batchId, days, writable }: { batchId: number; days: BatchDayItem[]; writable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = days.filter((d) => d.active);
  const openLabs = active.reduce((n, d) => n + d.labCount, 0);
  const nextOff = days.find((d) => !d.active);

  async function setDays(ids: number[]) {
    setBusy(true);
    const ok = await lpRequest(`/api/lab-practice/batches/${batchId}/days`, { method: "PUT", json: { dayIds: ids } });
    setBusy(false);
    if (ok) router.refresh();
  }

  async function activateNext() {
    setBusy(true);
    const res = await lpRequest<{ dayNo: number | null }>(`/api/lab-practice/batches/${batchId}/days`, { method: "POST" });
    setBusy(false);
    if (res) {
      toast.success(res.dayNo ? `Day ${res.dayNo} is now open.` : "Every day is already open.");
      router.refresh();
    }
  }

  function toggle(day: BatchDayItem) {
    const ids = new Set(active.map((d) => d.id));
    if (day.active) ids.delete(day.id);
    else ids.add(day.id);
    setDays([...ids]);
  }

  if (days.length === 0) {
    return <p className="text-sm text-white/50">This schedule has no days yet. Build them on the schedule page.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-white">
          <span className="font-semibold tabular-nums">{active.length}</span>
          <span className="text-white/60"> of {days.length} days open · {openLabs} labs</span>
        </p>
        {nextOff && <p className="text-xs text-white/50">Next up: Day {nextOff.dayNo}{nextOff.title ? ` — ${nextOff.title}` : ""}</p>}
      </div>
      {writable && (
        <DefaultButton size="sm" className="w-full" onClick={activateNext} loading={busy} disabled={!nextOff}>
          <CalendarPlus className="size-4" />
          {nextOff ? `Activate Day ${nextOff.dayNo}` : "All days open"}
        </DefaultButton>
      )}
      <div role="group" aria-label="Days" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 xl:grid-cols-6">
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            disabled={!writable || busy}
            onClick={() => toggle(d)}
            aria-pressed={d.active}
            title={`Day ${d.dayNo}${d.title ? ` — ${d.title}` : ""} · ${d.labCount} labs · ${d.active ? "open (click to close)" : "closed (click to open)"}`}
            className={cn(
              "flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
              d.active
                ? "bg-itbd-blue text-black hover:bg-itbd-blue/85"
                : "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10 hover:text-white",
            )}
          >
            {d.dayNo}
            <span className={cn("text-[9px] font-normal", d.active ? "text-black/60" : "text-white/30")}>{d.labCount}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-white/40">Click a day to open or close it. The small number is its lab count.</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Schedule batch → roster + trainee × day grid
// ─────────────────────────────────────────────
export type RosterDay = { id: number; dayNo: number; title: string | null; batchActive: boolean };
export type RosterTrainee = {
  traineeId: number;
  name: string;
  email: string;
  percent: number;
  lastActivityAt: string | null;
  moduleCount: number;
  /** dayId → this trainee's state for the day. */
  days: Record<number, { visible: boolean; overridden: boolean; percent: number | null }>;
};

function TraineeRow({
  batchId,
  trainee,
  days,
  columns,
  writable,
}: {
  batchId: number;
  trainee: RosterTrainee;
  days: RosterDay[];
  columns: RosterDay[];
  writable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const overrides = Object.values(trainee.days).filter((d) => d.overridden).length;

  async function setDay(day: RosterDay, visible: boolean | null) {
    setBusy(day.id);
    // Matching the batch again just clears the individual change.
    const value = visible !== null && visible === day.batchActive ? null : visible;
    const ok = await lpRequest(`/api/lab-practice/batches/${batchId}/trainees/${trainee.traineeId}/days/${day.id}`, {
      method: "PUT",
      json: { visible: value },
    });
    setBusy(null);
    if (ok) router.refresh();
  }

  async function remove() {
    const ok = await lpRequest(`/api/lab-practice/batches/${batchId}/trainees/${trainee.traineeId}`, { method: "DELETE" });
    if (ok) router.refresh();
  }

  return (
    <>
      <tr className="hover:bg-white/3">
        <td className="max-w-0 px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full min-w-0 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronRight className={cn("size-4 shrink-0 text-white/40 transition-transform", open && "rotate-90 text-itbd-blue")} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-white">{trainee.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <span className="truncate">{trainee.email}</span>
                {overrides > 0 && (
                  <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] text-white/60">
                    Individual
                  </Badge>
                )}
              </span>
            </span>
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <ProgressBar percent={trainee.percent} label={`${trainee.name} progress`} className="h-1.5" />
            <span className="w-9 shrink-0 text-right text-xs text-white tabular-nums">{trainee.percent}%</span>
          </div>
        </td>
        {columns.map((c) => {
          const d = trainee.days[c.id];
          return (
            <td key={c.id} className="px-1 py-2 text-center">
              {!d?.visible || d.percent === null ? (
                <span className="text-xs text-white/20" aria-label="Closed for this trainee">—</span>
              ) : (
                <span
                  className={cn(
                    "inline-block min-w-9 rounded px-1 py-0.5 text-xs tabular-nums",
                    d.percent === 100 ? "bg-itbd-blue/20 text-itbd-blue" : d.percent > 0 ? "bg-white/10 text-white" : "text-white/40",
                    d.overridden && "ring-1 ring-white/30",
                  )}
                  title={`Day ${c.dayNo}: ${d.percent}%${d.overridden ? " (individual)" : ""}`}
                >
                  {d.percent}%
                </span>
              )}
            </td>
          );
        })}
        <td className="px-3 py-2 text-right text-xs whitespace-nowrap text-white/50">
          {trainee.lastActivityAt ? formatEt(trainee.lastActivityAt) : "None yet"}
        </td>
      </tr>
      {open && (
        <tr className="bg-white/2">
          <td colSpan={columns.length + 3} className="px-3 pt-1 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <p className="text-xs text-white/50">
                Open or close days for {trainee.name} only. Outlined days differ from the batch.
              </p>
              {writable && (
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-destructive" onClick={remove}>
                  <X /> Remove from batch
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {days.map((day) => {
                const d = trainee.days[day.id];
                const visible = d?.visible ?? false;
                return (
                  <span key={day.id} className="inline-flex items-center">
                    <button
                      type="button"
                      disabled={!writable || busy === day.id}
                      onClick={() => setDay(day, !visible)}
                      aria-pressed={visible}
                      title={`Day ${day.dayNo}${day.title ? ` — ${day.title}` : ""}: ${visible ? "open" : "closed"} for ${trainee.name}`}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
                        visible ? "bg-itbd-blue/80 text-black" : "bg-white/5 text-white/40 ring-1 ring-white/10",
                        d?.overridden && "ring-2 ring-white/70",
                      )}
                    >
                      {day.dayNo}
                    </button>
                    {writable && d?.overridden && (
                      <button
                        type="button"
                        onClick={() => setDay(day, null)}
                        disabled={busy === day.id}
                        className="ml-0.5 rounded p-0.5 text-white/40 hover:text-white"
                        aria-label={`Reset Day ${day.dayNo} for ${trainee.name} to the batch`}
                        title="Reset to batch"
                      >
                        <RotateCcw className="size-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ScheduleBatchRoster({
  batchId,
  writable,
  batchActive,
  days,
  trainees,
}: {
  batchId: number;
  writable: boolean;
  batchActive: boolean;
  days: RosterDay[];
  trainees: RosterTrainee[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<EmployeeOption[]>([]);
  const [busy, setBusy] = useState(false);

  // Columns: days open for the batch or for anyone individually.
  const columns = useMemo(
    () => days.filter((d) => d.batchActive || trainees.some((t) => t.days[d.id]?.visible)),
    [days, trainees],
  );

  async function add() {
    setBusy(true);
    const res = await lpRequest<{ enrolled: number; reactivated: number; unchanged: number; conflicts: number[] }>(
      `/api/lab-practice/batches/${batchId}/members`,
      { method: "POST", json: { traineeIds: picked.map((p) => p.id) } },
    );
    setBusy(false);
    if (!res) return;
    toast.success(`${picked.length} trainee${picked.length === 1 ? "" : "s"} added — enrolled in the schedule's modules.`);
    if (res.conflicts.length) toast.warning(`${res.conflicts.length} already with another trainer in some modules — skipped there.`);
    setPicked([]);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {writable && batchActive && (
        <div className="space-y-2">
          <EmployeeSearch
            excludeIds={[...picked.map((p) => p.id), ...trainees.map((t) => t.traineeId)]}
            onPick={(e) => setPicked((prev) => [...prev, e])}
            placeholder="Add trainees — search by name, email or employee ID…"
          />
          {picked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {picked.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1">
                  {p.fullName}
                  <button type="button" onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.fullName}`}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <DefaultButton size="sm" onClick={add} loading={busy}>
                Add {picked.length} to batch
              </DefaultButton>
            </div>
          )}
          <p className="text-xs text-white/40">
            Adding a trainee enrolls them in every module this schedule uses. They only see labs from open days.
          </p>
        </div>
      )}

      {trainees.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/50">No trainees in this batch yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-xl text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/3 text-left text-[11px] font-medium tracking-wide text-white/40 uppercase">
                <th scope="col" className="px-3 py-2 font-medium">Trainee</th>
                <th scope="col" className="w-40 px-3 py-2 font-medium">Open labs</th>
                {columns.map((c) => (
                  <th key={c.id} scope="col" className="w-14 px-1 py-2 text-center font-medium" title={c.title ?? undefined}>
                    D{c.dayNo}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {trainees.map((t) => (
                <TraineeRow key={t.traineeId} batchId={batchId} trainee={t} days={days} columns={columns} writable={writable} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Schedule settings
// ─────────────────────────────────────────────
export function ScheduleSettings({
  schedule,
  batchCount,
  traineeCount,
}: {
  schedule: { id: number; name: string; isActive: boolean };
  /** Batches following this schedule — removed with it. */
  batchCount: number;
  traineeCount: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(schedule.name);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function patch(json: Record<string, unknown>) {
    setBusy(true);
    const ok = await lpRequest(`/api/lab-practice/schedules/${schedule.id}`, { method: "PATCH", json });
    setBusy(false);
    if (ok) router.refresh();
  }

  async function remove() {
    setBusy(true);
    const ok = await lpRequest(`/api/lab-practice/schedules/${schedule.id}`, { method: "DELETE" });
    setBusy(false);
    if (ok) {
      toast.success(`Deleted "${schedule.name}".`);
      router.replace("/dashboard/guided-labs/trainer");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== schedule.name) patch({ name: name.trim() });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Schedule name" className="h-8" />
        <DefaultButton type="submit" size="sm" loading={busy} disabled={!name.trim() || name.trim() === schedule.name}>
          Rename
        </DefaultButton>
      </form>
      <label className="flex items-center justify-between gap-3 text-sm text-white/70">
        Active
        <Switch checked={schedule.isActive} disabled={busy} onCheckedChange={(v) => patch({ isActive: v })} />
      </label>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
        <Trash2 /> Delete schedule
      </Button>
      <Dialog open={confirming} onOpenChange={(v) => !busy && setConfirming(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete schedule</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{schedule.name}&rdquo; and its days? Labs and trainee progress aren&rsquo;t touched.
            </DialogDescription>
          </DialogHeader>
          {batchCount > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-white/80">
              <span className="font-medium text-white tabular-nums">
                {batchCount} {batchCount === 1 ? "batch follows" : "batches follow"} this schedule
              </span>{" "}
              and will be removed too. Their {traineeCount} {traineeCount === 1 ? "trainee stays" : "trainees stay"} enrolled
              with all progress, but go back to seeing only the first lab of each module (plus any labs you opened for them
              individually).
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
