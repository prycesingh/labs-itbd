"use client";

import { CalendarCheck2, CalendarMinus, CalendarPlus, Eye, EyeOff, ListChecks, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { lpRequest } from "@/components/labPractice/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Batch pacing UI. A batch's open days = Days 1..pointer, plus single days
 * opened early, minus single days closed (lib/labPractice/pacing.ts).
 *   DayPointerPanel — the batch page's Pacing card
 *   usePacing       — shared "change pacing" call (also used on the schedule page)
 */

export type PacingChange = { step: 1 | -1 } | { through: number } | { dayId: number; open: boolean };

export function usePacing(batchId: number) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function change(json: PacingChange, success: string) {
    setBusy(true);
    const res = await lpRequest<{ currentDay: number }>(`/api/lab-practice/batches/${batchId}/days`, { method: "PUT", json });
    setBusy(false);
    if (!res) return false;
    toast.success(success);
    router.refresh();
    return true;
  }
  return { busy, change };
}

export type PointerDay = {
  id: number;
  dayNo: number;
  title: string | null;
  labCount: number;
  /** Switched on in the schedule. */
  isActive: boolean;
  open: boolean;
  exception: "early" | "closed" | null;
};

/** "1, 2, 4–6, 23" */
function ranges(nos: number[]) {
  const out: string[] = [];
  for (let i = 0; i < nos.length; i++) {
    let j = i;
    while (j + 1 < nos.length && nos[j + 1] === nos[j] + 1) j++;
    out.push(j > i ? `${nos[i]}–${nos[j]}` : `${nos[i]}`);
    i = j;
  }
  return out.join(", ");
}

export function DayPointerPanel({
  batchId,
  currentDay,
  days,
  writable,
}: {
  batchId: number;
  currentDay: number;
  days: PointerDay[];
  writable: boolean;
}) {
  const { busy, change } = usePacing(batchId);
  const total = days.length;
  const current = days.find((d) => d.dayNo === currentDay);
  const next = days.filter((d) => d.isActive && d.dayNo > currentDay).sort((a, b) => a.dayNo - b.dayNo)[0];
  const openDays = days.filter((d) => d.open);
  const openLabs = openDays.reduce((n, d) => n + d.labCount, 0);
  const early = days.filter((d) => d.exception === "early").map((d) => d.dayNo);
  const closed = days.filter((d) => d.exception === "closed").map((d) => d.dayNo);

  if (total === 0) {
    return <p className="text-sm text-white/50">This schedule has no days yet. Build them on the schedule page.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-3xl font-bold text-white tabular-nums">
          {currentDay === 0 ? "Not started" : `Day ${currentDay}`}
          <span className="ml-2 text-sm font-normal text-white/50">of {total}</span>
        </p>
        <p className="mt-0.5 text-xs text-white/50">
          {current?.title ? `${current.title} · ` : ""}
          {openLabs} {openLabs === 1 ? "lab" : "labs"} open
          {openDays.length > 0 && ` · Days ${ranges(openDays.map((d) => d.dayNo))}`}
        </p>
        {(early.length > 0 || closed.length > 0) && (
          <p className="mt-1 text-[11px] text-white/45">
            {early.length > 0 && <span className="text-itbd-blue">Opened early: Day {ranges(early)}</span>}
            {early.length > 0 && closed.length > 0 && " · "}
            {closed.length > 0 && <span>Closed: Day {ranges(closed)}</span>}
          </p>
        )}
      </div>

      {writable && (
        <div className="flex gap-2">
          <DefaultButton
            className="flex-1"
            onClick={() => next && change({ step: 1 }, `Day ${next.dayNo} is open.`)}
            loading={busy}
            disabled={!next}
          >
            {next ? <CalendarPlus className="size-4" /> : <CalendarCheck2 className="size-4" />}
            {next ? `Open Day ${next.dayNo}` : "All days open"}
          </DefaultButton>
          <Button
            variant="outline"
            size="icon"
            onClick={() => change({ step: -1 }, `Day ${currentDay} is closed.`)}
            disabled={busy || currentDay === 0}
            aria-label={currentDay ? `Close Day ${currentDay}` : "Nothing to close"}
            title={currentDay ? `Close Day ${currentDay}` : undefined}
          >
            <CalendarMinus />
          </Button>
        </div>
      )}
      {next && (
        <p className="text-xs text-white/50">
          Next: Day {next.dayNo}
          {next.title ? ` — ${next.title}` : ""} · {next.labCount} {next.labCount === 1 ? "lab" : "labs"}
        </p>
      )}

      <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const label = `Day ${d.dayNo}${d.title ? ` — ${d.title}` : ""} · ${d.labCount} labs · ${
            !d.isActive ? "switched off in the schedule" : d.open ? (d.exception === "early" ? "opened early" : "open") : d.exception === "closed" ? "closed on purpose" : "closed"
          }`;
          const cell = (
            <button
              type="button"
              disabled={!writable || busy}
              aria-label={label}
              title={label}
              aria-current={d.dayNo === currentDay ? "step" : undefined}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default",
                d.open ? "bg-itbd-blue/80 text-black" : "bg-white/5 text-white/45 ring-1 ring-white/10",
                d.dayNo === currentDay && d.open && "bg-itbd-blue ring-2 ring-white/70",
                d.dayNo === currentDay && !d.open && "ring-2 ring-white/40",
                d.exception === "early" && "ring-2 ring-itbd-blue ring-offset-1 ring-offset-black",
                d.exception === "closed" && "text-white/60 ring-0 outline-1 outline-itbd-blue/60 outline-dashed",
                !d.isActive && "line-through opacity-40",
                writable && !d.open && d.isActive && "hover:bg-white/10 hover:text-white",
              )}
            >
              {d.dayNo}
            </button>
          );
          if (!writable) return <div key={d.id}>{cell}</div>;
          return (
            <DropdownMenu key={d.id}>
              <DropdownMenuTrigger asChild>{cell}</DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel className="truncate">
                  Day {d.dayNo}
                  {d.title ? ` — ${d.title}` : ""}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!d.isActive ? (
                  <DropdownMenuItem disabled>Switched off in the schedule</DropdownMenuItem>
                ) : d.open ? (
                  <DropdownMenuItem onSelect={() => change({ dayId: d.id, open: false }, `Day ${d.dayNo} is closed.`)}>
                    <EyeOff /> Close only Day {d.dayNo}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => change({ dayId: d.id, open: true }, `Day ${d.dayNo} is open.`)}>
                    <Eye /> Open only Day {d.dayNo}
                  </DropdownMenuItem>
                )}
                {d.isActive && (d.dayNo !== currentDay || closed.some((n) => n <= d.dayNo)) && (
                  <DropdownMenuItem
                    onSelect={() => change({ through: d.dayNo }, `Days 1–${d.dayNo} are open.`)}
                  >
                    <ListChecks /> {d.dayNo > currentDay ? `Open Days 1–${d.dayNo}` : `Set batch to Day ${d.dayNo}`}
                  </DropdownMenuItem>
                )}
                {d.dayNo <= currentDay && (
                  <DropdownMenuItem
                    onSelect={() =>
                      change({ through: d.dayNo - 1 }, d.dayNo > 1 ? `Batch is back on Day ${d.dayNo - 1}.` : "Every day is closed.")
                    }
                  >
                    <Undo2 /> Close Day {d.dayNo} onward
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
      <div className="space-y-1 text-[11px] text-white/40">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-itbd-blue/80" /> Open
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm ring-2 ring-itbd-blue" /> Opened early
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-white/5 ring-1 ring-white/20" /> Closed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm outline-1 outline-itbd-blue/60 outline-dashed" /> Closed on purpose
          </span>
          <span className="inline-flex items-center gap-1 line-through opacity-70">Off</span>
        </p>
        <p>Click a day to open or close just that day, or to move the whole batch there.</p>
      </div>
    </div>
  );
}
