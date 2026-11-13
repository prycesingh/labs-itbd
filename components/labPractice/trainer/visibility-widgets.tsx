"use client";

import { ArrowRight, Eye, EyeOff, Plus, RotateCcw, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { EmployeeSearch, lpRequest, ProgressBar, type EmployeeOption } from "@/components/labPractice/shared";
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
import { Switch } from "@/components/ui/switch";
import { formatEt } from "@/lib/labPractice/dates";
import type { VisibilitySource } from "@/lib/labPractice/visibility";
import { cn } from "@/lib/utils";

/**
 * Lab pacing UI: which labs of a module a trainee can see.
 *   - LabVisibilityPanel  — per-trainee Show/Hide (trainee review page)
 *   - BatchesPanel        — create / list a module's batches (module page)
 *   - BatchLabsEditor     — pick the labs a batch shows (batch page)
 *   - BatchMembersPanel   — add / remove trainees + review grid (batch page)
 *   - BatchSettings       — rename / archive / delete (batch page)
 */

const SOURCE_LABEL: Record<VisibilitySource, string> = {
  default: "Default",
  batch: "Batch",
  day: "Day",
  override: "Individual",
};

function LabNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
        active ? "bg-itbd-blue/15 text-itbd-blue" : "bg-white/5 text-white/40",
      )}
    >
      {n}
    </span>
  );
}

// ─────────────────────────────────────────────
// Per-trainee visibility
// ─────────────────────────────────────────────
export type VisibilityLab = {
  id: number;
  /** 1-based position among the module's active labs. */
  number: number;
  title: string;
  visible: boolean;
  source: VisibilitySource;
  baseVisible: boolean;
  /** Set when the trainee follows a day schedule. */
  day: { id: number; no: number; title: string | null; active: boolean } | null;
};

export function LabVisibilityPanel({
  enrollmentId,
  labs,
  batchName,
  writable,
}: {
  enrollmentId: number;
  labs: VisibilityLab[];
  batchName: string | null;
  writable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const visibleCount = labs.filter((l) => l.visible).length;
  const overrides = labs.filter((l) => l.source === "override").length;

  function put(lab: VisibilityLab, visible: boolean | null) {
    // Toggling back to what the batch/day/default says just removes the override.
    const value = visible !== null && visible === lab.baseVisible ? null : visible;
    return lpRequest(`/api/lab-practice/enrollments/${enrollmentId}/labs/${lab.id}`, {
      method: "PUT",
      json: { visible: value },
    });
  }

  async function set(lab: VisibilityLab, visible: boolean | null) {
    setBusy(lab.id);
    const ok = await put(lab, visible);
    setBusy(null);
    if (ok) router.refresh();
  }

  /** A whole day at once (only labs whose state would change). */
  async function setMany(group: VisibilityLab[], visible: boolean | null) {
    setBusy(-1);
    const targets = group.filter((l) => (visible === null ? l.source === "override" : l.visible !== visible));
    const results = await Promise.all(targets.map((l) => put(l, visible)));
    setBusy(null);
    if (results.some(Boolean)) router.refresh();
  }

  // Schedule trainees: group by day (unscheduled labs last).
  const groups = labs.some((l) => l.day)
    ? (() => {
        const map = new Map<string, { key: string; day: VisibilityLab["day"]; labs: VisibilityLab[] }>();
        for (const l of labs) {
          const key = l.day ? `d${l.day.no}` : "none";
          const g = map.get(key) ?? { key, day: l.day, labs: [] };
          g.labs.push(l);
          map.set(key, g);
        }
        return [...map.values()].sort((a, b) => (a.day?.no ?? Infinity) - (b.day?.no ?? Infinity));
      })()
    : null;
  const baseName = groups ? "day" : batchName ? "batch" : "default";

  const labRow = (lab: VisibilityLab) => (
    <li key={lab.id} className="flex items-center gap-3 px-3 py-2">
      <LabNumber n={lab.number} active={lab.visible} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", lab.visible ? "text-white" : "text-white/50")}>{lab.title}</span>
        <span className="text-[11px] text-white/40">
          {SOURCE_LABEL[lab.source]}
          {lab.source === "override" && (
            <>
              {" · "}
              {baseName} would {lab.baseVisible ? "show" : "hide"} it
            </>
          )}
        </span>
      </span>
      {writable && lab.source === "override" && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => set(lab, null)}
          disabled={busy !== null}
          aria-label={`Reset ${lab.title} to ${baseName}`}
          title={`Reset to ${baseName}`}
        >
          <RotateCcw />
        </Button>
      )}
      <Switch
        checked={lab.visible}
        disabled={!writable || busy !== null}
        onCheckedChange={(v) => set(lab, v)}
        aria-label={`${lab.title} visible to trainee`}
      />
    </li>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-white">Lab visibility</h2>
        <span className="text-xs text-white/50 tabular-nums">
          {visibleCount}/{labs.length} shown
        </span>
      </div>
      <p className="text-xs text-white/50">
        {batchName ? (
          <>
            Follows {groups ? "the day schedule of" : "batch"} <span className="text-itbd-blue">{batchName}</span>.
            Changes here apply to this trainee, in this module only.
          </>
        ) : (
          "Not in a batch — only the first lab is shown unless you reveal more."
        )}
        {overrides > 0 && ` ${overrides} individual ${overrides === 1 ? "change" : "changes"}.`}
      </p>
      {labs.length === 0 ? (
        <p className="text-sm text-white/50">This module has no active labs.</p>
      ) : groups ? (
        <div className="space-y-2">
          {groups.map((g) => {
            const allOn = g.labs.every((l) => l.visible);
            const someOn = g.labs.some((l) => l.visible);
            return (
              <div key={g.key} className="rounded-lg border border-white/10">
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {g.day ? `Day ${g.day.no}` : "Not in a day"}
                      {g.day?.title && <span className="font-normal text-white/60"> — {g.day.title}</span>}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {g.day ? (g.day.active ? "Open for the batch" : "Closed for the batch") : "Opens only individually"}
                      {someOn && !allOn && " · partly shown"}
                    </span>
                  </span>
                  {writable && g.labs.some((l) => l.source === "override") && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setMany(g.labs, null)}
                      disabled={busy !== null}
                      aria-label={`Reset ${g.day ? `Day ${g.day.no}` : "these labs"} to the batch`}
                      title="Reset to batch"
                    >
                      <RotateCcw />
                    </Button>
                  )}
                  <Switch
                    checked={allOn}
                    disabled={!writable || busy !== null}
                    onCheckedChange={(v) => setMany(g.labs, v)}
                    aria-label={`${g.day ? `Day ${g.day.no}` : "Unscheduled labs"} visible to trainee`}
                  />
                </div>
                <ul className="divide-y divide-white/5">{g.labs.map(labRow)}</ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">{labs.map(labRow)}</ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Module → batches
// ─────────────────────────────────────────────
export type BatchRow = {
  id: number;
  name: string;
  isActive: boolean;
  trainerName: string;
  isMine: boolean;
  memberCount: number;
  visibleLabs: number;
  avgPercent: number | null;
  /** Schedule batches (paced by days) link to their own page. */
  scheduleHref?: string;
};

export function BatchesPanel({
  moduleId,
  totalLabs,
  batches,
  canCreate,
}: {
  moduleId: number;
  totalLabs: number;
  batches: BatchRow[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await lpRequest<{ id: number }>(`/api/lab-practice/modules/${moduleId}/batches`, {
      method: "POST",
      json: { name: name.trim() },
    });
    setBusy(false);
    if (res) {
      setName("");
      router.push(`/dashboard/guided-labs/trainer/modules/${moduleId}/batches/${res.id}`);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        Group trainees and reveal labs to them together. Trainees outside a batch see only the first lab until
        you reveal more on their page.
      </p>
      {canCreate && (
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
      )}
      {batches.length === 0 ? (
        <p className="text-sm text-white/50">No batches yet.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {batches.map((b) => (
            <li key={b.id}>
              <Link
                href={b.scheduleHref ?? `/dashboard/guided-labs/trainer/modules/${moduleId}/batches/${b.id}`}
                className="group flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm font-medium", b.isActive ? "text-white" : "text-white/50")}>
                      {b.name}
                    </span>
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
                      {b.scheduleHref
                        ? `Day schedule · ${b.visibleLabs}/${totalLabs} labs open here`
                        : b.visibleLabs > 0
                          ? `${b.visibleLabs}/${totalLabs} labs shown`
                          : "First lab only"}
                    </span>
                    {b.avgPercent !== null && <span>avg {b.avgPercent}%</span>}
                    {!b.isMine && <span className="text-white/40">{b.trainerName}</span>}
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
// Batch → visible labs
// ─────────────────────────────────────────────
export function BatchLabsEditor({
  batchId,
  labs,
  initialSelected,
  writable,
}: {
  batchId: number;
  labs: { id: number; title: string }[];
  initialSelected: number[];
  writable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialSelected));
  const [saving, setSaving] = useState(false);
  const initialKey = [...initialSelected].sort((a, b) => a - b).join(",");
  const dirty = [...selected].sort((a, b) => a - b).join(",") !== initialKey;

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save(ids: Set<number> = selected) {
    setSaving(true);
    const ok = await lpRequest(`/api/lab-practice/batches/${batchId}/labs`, {
      method: "PUT",
      json: { labIds: [...ids] },
    });
    setSaving(false);
    if (ok) {
      toast.success("Batch labs updated.");
      router.refresh();
    }
  }

  /** Reveal the first hidden lab (in order) and save straight away — the
   *  common day-to-day action. An empty selection means "first lab only", so
   *  lab 1 is made explicit before the next one is added. */
  async function revealNext() {
    const next = new Set(selected);
    if (next.size === 0 && labs[0]) next.add(labs[0].id);
    const target = labs.find((l) => !next.has(l.id));
    if (!target) return;
    next.add(target.id);
    setSelected(next);
    await save(next);
  }

  const shownCount = selected.size === 0 ? Math.min(1, labs.length) : selected.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/70 tabular-nums">
          <span className="font-semibold text-white">{shownCount}</span> of {labs.length} labs shown
          {selected.size === 0 && <span className="text-white/50"> (default: first lab only)</span>}
        </p>
        {writable && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={revealNext}
              disabled={saving || dirty || shownCount >= labs.length}
              title={dirty ? "Save or discard your changes first" : undefined}
            >
              <Eye /> Reveal next lab
            </Button>
          </div>
        )}
      </div>
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {labs.map((lab, i) => {
          const on = selected.size === 0 ? i === 0 : selected.has(lab.id);
          return (
            <li key={lab.id} className="flex items-center gap-3 px-3 py-2">
              <LabNumber n={i + 1} active={on} />
              <span className={cn("min-w-0 flex-1 truncate text-sm", on ? "text-white" : "text-white/50")}>
                {lab.title}
              </span>
              {on ? (
                <Eye className="size-3.5 text-itbd-blue" aria-hidden />
              ) : (
                <EyeOff className="size-3.5 text-white/30" aria-hidden />
              )}
              <Switch
                checked={on}
                disabled={!writable || saving}
                onCheckedChange={(v) => {
                  // Turning on a lab from the implicit default keeps lab 1 shown too.
                  if (selected.size === 0 && labs[0] && lab.id !== labs[0].id) toggle(labs[0].id, true);
                  toggle(lab.id, v);
                }}
                aria-label={`Show ${lab.title} to this batch`}
              />
            </li>
          );
        })}
      </ul>
      {writable && dirty && (
        <div className="flex items-center gap-2">
          <DefaultButton size="sm" onClick={() => save()} loading={saving}>
            Save visible labs
          </DefaultButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set(initialSelected))}
            disabled={saving}
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Batch → members + review grid
// ─────────────────────────────────────────────
export type BatchMember = {
  enrollmentId: number;
  traineeId: number;
  traineeName: string;
  traineeEmail: string;
  isActive: boolean;
  percent: number;
  done: number;
  total: number;
  lastActivityAt: string | null;
  hasOverrides: boolean;
  labProgress: { labId: number; percent: number }[];
};

export function BatchMembersPanel({
  batchId,
  writable,
  batchActive,
  labs,
  members,
  candidates,
}: {
  batchId: number;
  writable: boolean;
  batchActive: boolean;
  /** Active labs in order (grid columns show the visible ones). */
  labs: { id: number; title: string }[];
  members: BatchMember[];
  /** This module's enrollments (same trainer) not in this batch. */
  candidates: { traineeId: number; traineeName: string; batchName: string | null }[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<EmployeeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  // Grid columns: every lab visible to at least one member, in module order.
  const columns = useMemo(() => {
    const shown = new Set(members.flatMap((m) => m.labProgress.map((l) => l.labId)));
    return labs.map((l, i) => ({ ...l, n: i + 1 })).filter((l) => shown.has(l.id));
  }, [labs, members]);

  async function add(traineeIds: number[]) {
    setBusy(true);
    const res = await lpRequest<{ enrolled: number; reactivated: number; unchanged: number; conflicts: number[] }>(
      `/api/lab-practice/batches/${batchId}/members`,
      { method: "POST", json: { traineeIds } },
    );
    setBusy(false);
    if (!res) return;
    const added = res.enrolled + res.reactivated + res.unchanged;
    toast.success(`${added} trainee${added === 1 ? "" : "s"} in the batch.`);
    if (res.conflicts.length) {
      toast.warning(`${res.conflicts.length} enrolled with another trainer — not added.`);
    }
    setPicked([]);
    router.refresh();
  }

  async function remove(m: BatchMember) {
    setRemoving(m.enrollmentId);
    const ok = await lpRequest(`/api/lab-practice/batches/${batchId}/members/${m.enrollmentId}`, {
      method: "DELETE",
    });
    setRemoving(null);
    if (ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      {writable && batchActive && (
        <div className="space-y-3">
          <EmployeeSearch
            excludeIds={[...picked.map((p) => p.id), ...members.map((m) => m.traineeId)]}
            onPick={(e) => setPicked((prev) => [...prev, e])}
            placeholder="Add trainees — search by name, email or employee ID…"
          />
          {picked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
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
              <DefaultButton size="sm" onClick={() => add(picked.map((p) => p.id))} loading={busy}>
                Add {picked.length} to batch
              </DefaultButton>
            </div>
          )}
          {candidates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-white/50">Already enrolled in this module:</p>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map((c) => (
                  <button
                    key={c.traineeId}
                    type="button"
                    disabled={busy}
                    onClick={() => add([c.traineeId])}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:border-itbd-blue/50 hover:text-white disabled:opacity-50"
                    title={c.batchName ? `Moves from batch ${c.batchName}` : undefined}
                  >
                    <Plus className="size-3 text-itbd-blue" />
                    {c.traineeName}
                    {c.batchName && <span className="text-white/40">· {c.batchName}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
          No trainees in this batch yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-xl text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/3 text-left text-[11px] font-medium tracking-wide text-white/40 uppercase">
                <th scope="col" className="px-3 py-2 font-medium">Trainee</th>
                <th scope="col" className="w-40 px-3 py-2 font-medium">Progress</th>
                {columns.map((c) => (
                  <th key={c.id} scope="col" className="w-14 px-1 py-2 text-center font-medium" title={c.title}>
                    L{c.n}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">Last activity</th>
                {writable && <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {members.map((m) => {
                const byLab = new Map(m.labProgress.map((l) => [l.labId, l.percent]));
                return (
                  <tr key={m.enrollmentId} className="hover:bg-white/3">
                    <td className="max-w-0 px-3 py-2">
                      <Link
                        href={`/dashboard/guided-labs/trainer/trainees/${m.enrollmentId}`}
                        className="block truncate font-medium text-white hover:text-itbd-blue"
                      >
                        {m.traineeName}
                      </Link>
                      <span className="flex items-center gap-1.5 text-xs text-white/50">
                        <span className="truncate">{m.traineeEmail}</span>
                        {m.hasOverrides && (
                          <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] text-white/60">
                            Individual
                          </Badge>
                        )}
                        {!m.isActive && (
                          <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px] text-white/60">
                            Unassigned
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={m.percent} label={`${m.traineeName} progress`} className="h-1.5" />
                        <span className="w-9 shrink-0 text-right text-xs text-white tabular-nums">{m.percent}%</span>
                      </div>
                    </td>
                    {columns.map((c) => {
                      const p = byLab.get(c.id);
                      return (
                        <td key={c.id} className="px-1 py-2 text-center">
                          {p === undefined ? (
                            <span className="text-xs text-white/20" aria-label="Hidden for this trainee">—</span>
                          ) : (
                            <span
                              className={cn(
                                "inline-block min-w-9 rounded px-1 py-0.5 text-xs tabular-nums",
                                p === 100
                                  ? "bg-itbd-blue/20 text-itbd-blue"
                                  : p > 0
                                    ? "bg-white/10 text-white"
                                    : "text-white/40",
                              )}
                              title={`${c.title}: ${p}%`}
                            >
                              {p}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-xs whitespace-nowrap text-white/50">
                      {m.lastActivityAt ? formatEt(m.lastActivityAt) : "None yet"}
                    </td>
                    {writable && (
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-white/40 hover:text-white"
                          onClick={() => remove(m)}
                          disabled={removing === m.enrollmentId}
                          aria-label={`Remove ${m.traineeName} from batch`}
                          title="Remove from batch (keeps enrollment and progress)"
                        >
                          <X />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Batch settings
// ─────────────────────────────────────────────
export function BatchSettings({
  batch,
  backHref,
}: {
  batch: { id: number; name: string; isActive: boolean };
  /** Where to go after deleting the batch. */
  backHref: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(batch.name);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function patch(json: Record<string, unknown>) {
    setSaving(true);
    const ok = await lpRequest(`/api/lab-practice/batches/${batch.id}`, { method: "PATCH", json });
    setSaving(false);
    if (ok) router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const ok = await lpRequest(`/api/lab-practice/batches/${batch.id}`, { method: "DELETE" });
    setDeleting(false);
    if (ok) {
      toast.success(`Deleted batch "${batch.name}".`);
      router.replace(backHref);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== batch.name) patch({ name: name.trim() });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Batch name" className="h-8" />
        <DefaultButton type="submit" size="sm" loading={saving} disabled={!name.trim() || name.trim() === batch.name}>
          Rename
        </DefaultButton>
      </form>
      <label className="flex items-center justify-between gap-3 text-sm text-white/70">
        <span>
          Active
          <span className="block text-xs text-white/40">
            Archived batches stop applying; members fall back to the first lab plus their individual changes.
          </span>
        </span>
        <Switch checked={batch.isActive} disabled={saving} onCheckedChange={(v) => patch({ isActive: v })} />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 /> Delete batch
      </Button>
      <Dialog open={confirming} onOpenChange={(v) => !deleting && setConfirming(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete batch</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{batch.name}&rdquo;? Its trainees stay enrolled and keep their progress, but go back to
              seeing only the first lab (plus any individual changes).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
