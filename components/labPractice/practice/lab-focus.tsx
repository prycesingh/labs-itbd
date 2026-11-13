"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Lock,
  Sparkles,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import DefaultButton from "@/components/app_componentes/customButtons";
import { StepRow, useStepTitles } from "@/components/labPractice/practice/practice-view";
import { MODE_HELP, ProgressBar } from "@/components/labPractice/shared";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatEt } from "@/lib/labPractice/dates";
import type { EnrollmentDTO, LabDTO, StepDTO, TaskDTO } from "@/lib/labPractice/serialize";
import { cn } from "@/lib/utils";

/**
 * Trainee "focus" view: ONE lab at a time.
 *
 * The full tree (every lab → task → step with all their prose) reads like a
 * wall of work even though each step is one click. Here the trainee sees:
 *   - a lab stepper (where am I, what's done, what's coming)
 *   - the current lab only: title, a shortened brief, its tasks
 *   - the task holding the "up next" step open, with that step's
 *     instructions showing; finished and future tasks fold to one line
 *   - Prev / Next, with a clear "continue" moment when a lab is done
 * Trainers keep the full tree (PracticeTree) for reviewing.
 */

type LabState = "complete" | "locked" | "current";

function labState(lab: LabDTO): LabState {
  if (lab.rollup.complete) return "complete";
  const steps = lab.tasks.flatMap((t) => t.steps);
  if (steps.length > 0 && steps.every((s) => s.status === "locked")) return "locked";
  return "current";
}

/** First step the trainee can do next in this lab (in order), if any. */
function upNextStep(lab: LabDTO): StepDTO | undefined {
  return lab.tasks.flatMap((t) => t.steps).find((s) => s.status === "available");
}

/** Show the first ~3 lines of long prose with a "Read more" toggle. */
function Brief({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220 || text.split("\n").length > 3;
  return (
    <div className={className}>
      <p className={cn("text-sm whitespace-pre-wrap text-white/70", long && !open && "line-clamp-3")}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs font-medium text-itbd-blue underline-offset-4 hover:underline"
          aria-expanded={open}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────
function LabStepper({
  labs,
  currentId,
  hiddenCount,
  onPick,
}: {
  labs: LabDTO[];
  currentId: number;
  hiddenCount: number;
  onPick: (lab: LabDTO) => void;
}) {
  const tab = (lab: LabDTO) => {
    const state = labState(lab);
    const current = lab.id === currentId;
    return (
      <li key={lab.id} className="min-w-14 flex-1">
        <button
          type="button"
          onClick={() => onPick(lab)}
          aria-current={current ? "step" : undefined}
          aria-label={`${lab.day ? `Day ${lab.day.no}, ` : ""}Lab ${lab.number}: ${lab.title} — ${
            state === "complete" ? "complete" : state === "locked" ? "locked" : `${lab.rollup.percent}% done`
          }`}
          title={lab.title}
          className={cn(
            "group flex w-full flex-col gap-1.5 rounded-lg px-2 pt-1.5 pb-2 text-left transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            current ? "bg-itbd-blue/10 ring-1 ring-itbd-blue/50" : "hover:bg-white/5",
          )}
        >
          <span className="flex items-center gap-1 text-xs font-semibold tabular-nums">
            {state === "complete" ? (
              <CheckCircle2 className="size-3.5 text-itbd-blue" aria-hidden />
            ) : state === "locked" ? (
              <Lock className="size-3 text-white/30" aria-hidden />
            ) : null}
            <span className={cn(current ? "text-white" : state === "locked" ? "text-white/40" : "text-white/70")}>
              Lab {lab.number}
            </span>
          </span>
          <ProgressBar
            percent={lab.rollup.percent}
            label={`Lab ${lab.number} progress`}
            className={cn("h-1", !current && "opacity-70")}
          />
        </button>
      </li>
    );
  };

  const more =
    hiddenCount > 0 ? (
      <li className="min-w-14 flex-1">
        <div
          className="flex h-full flex-col justify-center rounded-lg border border-dashed border-white/15 px-2 py-1.5 text-xs text-white/40"
          title="Your trainer will unlock more labs as you go"
        >
          +{hiddenCount} more
        </div>
      </li>
    ) : null;

  // Day schedule: consecutive labs of the same day sit under a "Day N" label.
  if (labs.some((l) => l.day)) {
    const groups: { key: string; day: LabDTO["day"]; labs: LabDTO[] }[] = [];
    for (const lab of labs) {
      const key = lab.day ? `d${lab.day.no}` : "none";
      const last = groups.at(-1);
      if (last && last.key === key) last.labs.push(lab);
      else groups.push({ key, day: lab.day, labs: [lab] });
    }
    return (
      <nav aria-label="Labs by day" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max gap-4 sm:min-w-0 sm:flex-wrap">
          {groups.map((g) => {
            const hasCurrent = g.labs.some((l) => l.id === currentId);
            return (
              <li key={g.key} className="min-w-0 flex-1 space-y-1">
                <p
                  className={cn(
                    "truncate px-1 text-[11px] font-semibold tracking-wide uppercase",
                    hasCurrent ? "text-itbd-blue" : "text-white/40",
                  )}
                  title={g.day?.title ?? undefined}
                >
                  {g.day ? `Day ${g.day.no}` : "Extra"}
                  {g.day?.title && <span className="font-normal normal-case"> · {g.day.title}</span>}
                </p>
                <ol className="flex gap-1.5">{g.labs.map(tab)}</ol>
              </li>
            );
          })}
          {more && <li className="self-end"><ol className="flex">{more}</ol></li>}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Labs" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max gap-1.5 sm:min-w-0">
        {labs.map(tab)}
        {more}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────────────
// Task block
// ─────────────────────────────────────────────
function TaskBlock({
  task,
  index,
  upNextId,
  writable,
  enrollmentId,
  titleOf,
}: {
  task: TaskDTO;
  index: number;
  upNextId: number | undefined;
  writable: boolean;
  enrollmentId: number;
  titleOf: Map<number, string>;
}) {
  const holdsUpNext = task.steps.some((s) => s.id === upNextId);
  const locked = !task.rollup.complete && task.steps.length > 0 && task.steps.every((s) => s.status === "locked");
  const [open, setOpen] = useState(holdsUpNext);
  // Follow the trainee: when the up-next step moves into this task, open it.
  const [wasHolding, setWasHolding] = useState(holdsUpNext);
  if (wasHolding !== holdsUpNext) {
    setWasHolding(holdsUpNext);
    if (holdsUpNext) setOpen(true);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-xl border transition-colors",
        holdsUpNext ? "border-itbd-blue/30 bg-white/3" : "border-white/10",
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {task.rollup.complete ? (
            <CheckCircle2 className="size-4 shrink-0 text-itbd-blue" aria-label="Task complete" />
          ) : locked ? (
            <Lock className="size-4 shrink-0 text-white/30" aria-label="Locked" />
          ) : (
            <Circle
              className={cn("size-4 shrink-0", holdsUpNext ? "fill-itbd-blue/30 text-itbd-blue" : "text-white/50")}
              aria-hidden
            />
          )}
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-sm font-medium",
                task.rollup.complete || locked ? "text-white/60" : "text-white",
              )}
            >
              <span className="mr-1 text-white/40">Task {index + 1}.</span>
              {task.title}
            </span>
          </span>
          <span className="shrink-0 text-xs text-white/50 tabular-nums">
            {task.rollup.done}/{task.rollup.total}
          </span>
          <ChevronRight
            className={cn("size-4 shrink-0 text-white/40 transition-transform", open && "rotate-90")}
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 px-2 pb-2">
        {task.description && <Brief text={task.description} className="px-2 pb-1 [&_p]:text-xs [&_p]:text-white/55" />}
        {task.steps.map((step, si) => {
          const isNext = step.id === upNextId;
          return (
            <StepRow
              // Remount when a step becomes "up next" so it opens itself.
              key={`${step.id}-${isNext ? "next" : "rest"}`}
              step={step}
              index={si}
              role="trainee"
              writable={writable}
              enrollmentId={enrollmentId}
              titleOf={titleOf}
              highlight={isNext && writable}
              defaultOpen={isNext && writable}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────
// Focus view
// ─────────────────────────────────────────────
export function LabFocus({ data }: { data: EnrollmentDTO }) {
  const titleOf = useStepTitles(data);
  const writable = data.isActive && data.module.isActive;
  const labs = data.labs;
  const topRef = useRef<HTMLDivElement>(null);

  // Land on the first unfinished lab (or the last one when everything's done).
  const [currentId, setCurrentId] = useState<number | null>(
    () => (labs.find((l) => !l.rollup.complete) ?? labs[labs.length - 1])?.id ?? null,
  );
  const [direction, setDirection] = useState<1 | -1>(1);

  const index = Math.max(
    0,
    labs.findIndex((l) => l.id === currentId),
  );
  const lab = labs[index];
  const prev = labs[index - 1];
  const next = labs[index + 1];
  const upNext = useMemo(() => (lab ? upNextStep(lab) : undefined), [lab]);

  if (!lab) {
    return <p className="text-sm text-white/50">No labs are open for you yet. Your trainer will unlock them.</p>;
  }

  const state = labState(lab);
  const stepCount = lab.tasks.reduce((n, t) => n + t.steps.length, 0);
  const allShownDone = labs.every((l) => l.rollup.complete);

  function go(target: LabDTO | undefined) {
    if (!target) return;
    setDirection(labs.indexOf(target) > index ? 1 : -1);
    setCurrentId(target.id);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-5">
      {/* Where am I */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-white/50">
          <span>
            {labs.length > 1 ? `${labs.length} labs open` : "1 lab open"}
            {data.hiddenLabCount > 0 && ` · ${data.hiddenLabCount} more coming`}
          </span>
          <span className="tabular-nums">
            Overall <span className="font-medium text-white">{data.module.rollup.percent}%</span> ·{" "}
            {data.module.rollup.done}/{data.module.rollup.total} steps
          </span>
        </div>
        {labs.length > 1 || data.hiddenLabCount > 0 ? (
          <LabStepper labs={labs} currentId={lab.id} hiddenCount={data.hiddenLabCount} onPick={go} />
        ) : (
          <ProgressBar percent={data.module.rollup.percent} label="Overall progress" className="h-1.5" />
        )}
      </div>

      {/* The current lab */}
      <section
        key={lab.id}
        aria-labelledby={`lab-${lab.id}-title`}
        className={cn(
          "space-y-4 duration-300 animate-in fade-in-0 motion-reduce:animate-none",
          direction === 1 ? "slide-in-from-right-3" : "slide-in-from-left-3",
        )}
      >
        <header className="space-y-2">
          <p className="text-xs font-medium text-itbd-blue tabular-nums">
            {lab.day && (
              <>
                Day {lab.day.no}
                {lab.day.title ? ` — ${lab.day.title}` : ""}
                {" · "}
              </>
            )}
            Lab {lab.number}
            {labs.length > 1 && <span className="text-white/40"> · {index + 1} of {labs.length} open</span>}
          </p>
          <h2 id={`lab-${lab.id}-title`} className="text-xl font-bold text-balance text-white sm:text-2xl">
            {lab.title}
          </h2>
          <div className="flex items-center gap-3">
            <ProgressBar percent={lab.rollup.percent} label={`${lab.title} progress`} className="h-1.5" />
            <span className="shrink-0 text-xs text-white/60 tabular-nums">
              {lab.rollup.done}/{stepCount} steps
            </span>
          </div>
        </header>

        {state === "complete" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-itbd-blue/10 px-4 py-3 ring-1 ring-itbd-blue/30">
            <CheckCircle2 className="size-5 shrink-0 text-itbd-blue" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-white">
              <span className="font-semibold">Lab complete.</span>{" "}
              <span className="text-white/60">
                {lab.completedAt ? `Finished ${formatEt(lab.completedAt)}.` : ""}
                {!next &&
                  (allShownDone && data.hiddenLabCount > 0
                    ? " Your trainer will unlock the next lab."
                    : allShownDone
                      ? " That's every lab in this module."
                      : "")}
              </span>
            </p>
            {next && (
              <DefaultButton size="sm" onClick={() => go(next)}>
                Continue to Lab {next.number} <ArrowRight className="size-4" />
              </DefaultButton>
            )}
          </div>
        )}

        {state === "locked" && (
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-white/70">
            <Lock className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden />
            <p>
              {prev ? `Finish Lab ${prev.number} first — this lab unlocks after it.` : "This lab is locked for now."}{" "}
              <span className="text-white/45">{MODE_HELP[data.module.progressionMode]}</span>
            </p>
          </div>
        )}

        {(lab.description || lab.scenario) && (
          <div className="space-y-3">
            {lab.description && <Brief text={lab.description} />}
            {lab.scenario && (
              <div className="rounded-xl bg-itbd-blue/8 px-4 py-3 ring-1 ring-itbd-blue/20">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-itbd-blue uppercase">
                  <Sparkles className="size-3.5" aria-hidden /> Scenario
                </p>
                <Brief text={lab.scenario} className="mt-1" />
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {lab.tasks.map((task, ti) => (
            <TaskBlock
              key={task.id}
              task={task}
              index={ti}
              upNextId={upNext?.id}
              writable={writable}
              enrollmentId={data.enrollmentId}
              titleOf={titleOf}
            />
          ))}
          {lab.tasks.length === 0 && <p className="text-sm text-white/50">This lab has no tasks yet.</p>}
        </div>
      </section>

      {/* Prev / next */}
      {labs.length > 1 && (
        <nav aria-label="Lab navigation" className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => go(prev)}
            disabled={!prev}
            className="max-w-[45%] justify-start text-white/70 hover:text-white"
          >
            <ArrowLeft />
            <span className="truncate">{prev ? `Lab ${prev.number}` : "Previous"}</span>
          </Button>
          {next &&
            (state === "complete" ? (
              <DefaultButton size="sm" onClick={() => go(next)} className="max-w-[55%]">
                <span className="truncate">Lab {next.number}: {next.title}</span>
                <ArrowRight className="size-4 shrink-0" />
              </DefaultButton>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => go(next)}
                className="max-w-[55%] text-white/80"
              >
                <span className="truncate">Lab {next.number}</span>
                <ArrowRight />
              </Button>
            ))}
        </nav>
      )}
    </div>
  );
}
