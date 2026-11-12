"use client";

import { ArrowRight, CheckCircle2, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ProgressBar,
  TreeCommandProvider,
  TreeExpandControls,
  useTreeCommand,
  useTreeOpen,
} from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { formatEt } from "@/lib/labPractice/dates";
import type { TraineeGroup } from "@/lib/labPractice/queries";
import { cn } from "@/lib/utils";

/**
 * Trainee roster for the trainer workspace: a dense, searchable list with ONE
 * row per trainee. A row expands to the modules they're enrolled in; each
 * module row links to that enrollment's review page. Rows have a fixed height
 * when collapsed, so the list stays scannable however many modules a trainee
 * carries.
 */

/** Desktop column template, shared by the header and every trainee row. */
const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_5.5rem_12rem_10rem] md:items-center md:gap-4";

function ModuleRow({ e }: { e: TraineeGroup["enrollments"][number] }) {
  const closed = !e.isActive || !e.moduleActive;
  return (
    <li>
      <Link
        href={`/dashboard/guided-labs/trainer/trainees/${e.id}`}
        className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-sm", closed ? "text-white/60" : "text-white")}>{e.moduleTitle}</span>
            {e.completedAt && (
              <CheckCircle2 className="size-3.5 shrink-0 text-itbd-blue" aria-label="Module completed" />
            )}
            {!e.isActive && (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] text-white/60">
                Unassigned
              </Badge>
            )}
          </span>
          <span className="block text-xs text-white/40">
            {e.completedAt ? (
              <span className="text-itbd-blue">Completed {formatEt(e.completedAt)}</span>
            ) : (
              <>Enrolled {formatEt(e.enrolledAt)}</>
            )}
          </span>
        </span>
        <span className="hidden w-40 shrink-0 sm:block">
          <ProgressBar percent={e.percent} label={`${e.moduleTitle} progress`} className="h-1.5" />
        </span>
        <span className="w-28 shrink-0 text-right text-xs text-white/50 tabular-nums">
          {e.done}/{e.total} · <span className="text-white/80">{e.percent}%</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-white/30 transition-colors group-hover:text-itbd-blue" />
      </Link>
    </li>
  );
}

function TraineeRow({ group }: { group: TraineeGroup }) {
  const [open, setOpen] = useTreeOpen(false);
  const count = group.enrollments.length;
  return (
    <li className="border-b border-white/10 last:border-b-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              COLS,
              open && "bg-white/[0.03]",
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <ChevronRight
                className={cn("size-4 shrink-0 text-white/40 transition-transform", open && "rotate-90 text-itbd-blue")}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">{group.traineeName}</span>
                <span className="block truncate text-xs text-white/50">{group.traineeEmail}</span>
              </span>
            </span>
            <span className="text-xs text-white/50 tabular-nums md:text-right">
              {count} {count === 1 ? "module" : "modules"}
            </span>
            <span className="flex w-full items-center gap-2 pl-6.5 md:w-auto md:pl-0">
              <ProgressBar percent={group.percent} label={`${group.traineeName} overall progress`} className="h-1.5" />
              <span className="w-9 shrink-0 text-right text-xs font-medium text-white tabular-nums">
                {group.percent}%
              </span>
            </span>
            <span className="hidden truncate text-xs text-white/50 md:block md:text-right">
              {group.lastActivityAt ? formatEt(group.lastActivityAt) : "No activity yet"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="ml-6 border-l border-white/10 py-1 pr-1 pl-2 md:ml-8">
            {group.enrollments.map((e) => (
              <ModuleRow key={e.id} e={e} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function matches(g: TraineeGroup, q: string) {
  return (
    g.traineeName.toLowerCase().includes(q) ||
    g.traineeEmail.toLowerCase().includes(q) ||
    g.trainerName.toLowerCase().includes(q) ||
    g.enrollments.some((e) => e.moduleTitle.toLowerCase().includes(q))
  );
}

export function TraineeRoster({ groups, byTrainer }: { groups: TraineeGroup[]; byTrainer: boolean }) {
  const [query, setQuery] = useState("");
  const tree = useTreeCommand();
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? groups.filter((g) => matches(g, q)) : groups), [groups, q]);

  // "All trainers": sections per trainer, in name order.
  const sections = useMemo(() => {
    if (!byTrainer) return [{ trainerId: 0, name: "", rows: visible }];
    const map = new Map<number, { trainerId: number; name: string; rows: TraineeGroup[] }>();
    for (const g of visible) {
      const s = map.get(g.trainerId) ?? { trainerId: g.trainerId, name: g.trainerName, rows: [] };
      s.rows.push(g);
      map.set(g.trainerId, s);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [visible, byTrainer]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={byTrainer ? "Search trainee, email, module or trainer…" : "Search trainee, email or module…"}
            aria-label="Search trainees"
            className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-white/50 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <TreeExpandControls onExpand={tree.expandAll} onCollapse={tree.collapseAll} />
      </div>

      {q && (
        <p className="text-xs text-white/50" aria-live="polite">
          {visible.length} of {groups.length} trainees match &ldquo;{query.trim()}&rdquo;
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center">
          <p className="text-sm text-white/70">No trainees match &ldquo;{query.trim()}&rdquo;.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-1 text-sm text-itbd-blue underline-offset-4 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <TreeCommandProvider value={tree.cmd}>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div
              aria-hidden
              className={cn(
                "hidden border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium tracking-wide text-white/40 uppercase",
                COLS,
              )}
            >
              <span className="pl-6.5">Trainee</span>
              <span className="text-right">Modules</span>
              <span>Overall progress</span>
              <span className="text-right">Last activity</span>
            </div>
            {sections.map((s) => (
              <section key={s.trainerId} aria-label={byTrainer ? `${s.name}'s trainees` : undefined}>
                {byTrainer && (
                  <h3 className="flex items-baseline gap-2 border-b border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-itbd-blue">
                    {s.name}
                    <span className="font-normal text-white/40 tabular-nums">
                      {s.rows.length} {s.rows.length === 1 ? "trainee" : "trainees"}
                    </span>
                  </h3>
                )}
                <ul>
                  {s.rows.map((g) => (
                    <TraineeRow key={g.key} group={g} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </TreeCommandProvider>
      )}
    </div>
  );
}
