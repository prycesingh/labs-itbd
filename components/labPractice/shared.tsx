"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { formatEt } from "@/lib/labPractice/dates";
import { cn } from "@/lib/utils";

/** Enrolled / last activity / completed times for an enrollment (all ET). */
export function EnrollmentTimes({
  enrolledAt,
  lastActivityAt,
  completedAt,
  className,
}: {
  enrolledAt: string;
  lastActivityAt: string | null;
  completedAt: string | null;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs", className)}>
      {completedAt ? (
        <>
          <dt className="text-itbd-blue">Completed</dt>
          <dd className="text-itbd-blue">{formatEt(completedAt)}</dd>
        </>
      ) : (
        <>
          <dt className="text-white/40">Last activity</dt>
          <dd className="text-white/60">{lastActivityAt ? formatEt(lastActivityAt) : "None yet"}</dd>
        </>
      )}
      <dt className="text-white/40">Enrolled</dt>
      <dd className="text-white/60">{formatEt(enrolledAt)}</dd>
    </dl>
  );
}

/**
 * Small shared building blocks for the Lab Practice UI.
 */

/** fetch wrapper: JSON in/out, toasts the server's `error` on failure. */
export async function lpRequest<T = unknown>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T | null> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    toast.error(body?.error ?? "Request failed.");
    return null;
  }
  return (body ?? {}) as T;
}

/** Blue→green brand gradient progress bar. */
export function ProgressBar({
  percent,
  className,
  label,
}: {
  percent: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-white/10", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className="h-full rounded-full bg-linear-to-r from-itbd-blue to-itbd-green transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export type EmployeeOption = { id: number; empId: string; fullName: string; email: string };

/** Debounced HRIS employee search. Calls onPick for each chosen employee. */
export function EmployeeSearch({
  onPick,
  excludeIds = [],
  placeholder = "Search by name, email or employee ID…",
}: {
  onPick: (e: EmployeeOption) => void;
  excludeIds?: number[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const active = q.trim().length >= 2;

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/lab-practice/employees?q=${encodeURIComponent(q.trim())}`, {
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => null);
        setResults(res.ok ? (body?.employees ?? []) : []);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Stale results from a longer query are hidden (not cleared) once the
  // query drops below 2 chars.
  const visible = active ? results.filter((r) => !excludeIds.includes(r.id)) : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label="Search employees"
        />
      </div>
      {q.trim().length >= 2 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-black/40">
          {loading && visible.length === 0 ? (
            <p className="p-3 text-sm text-white/50">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="p-3 text-sm text-white/50">No matching employees.</p>
          ) : (
            visible.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onPick(e)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-itbd-blue/10"
              >
                <span className="min-w-0">
                  <span className="block truncate text-white">{e.fullName}</span>
                  <span className="block truncate text-xs text-white/50">{e.email}</span>
                </span>
                <span className="shrink-0 text-xs text-white/40">{e.empId}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export const MODE_LABELS = {
  free_order: "Free order",
  steps_in_order: "Steps in order",
  fully_sequential: "Fully sequential",
} as const;

export const MODE_HELP = {
  free_order: "Anything can be done at any time.",
  steps_in_order: "Steps inside a task are sequential; labs and tasks are free.",
  fully_sequential: "Each step, task and lab unlocks only after the previous one is done.",
} as const;

export function PageTitle({ title, accent, sub }: { title: string; accent?: string; sub?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {title} {accent ? <span className="text-itbd-blue">{accent}</span> : null}
      </h1>
      {sub ? <p className="mt-1 text-sm text-white/60">{sub}</p> : null}
    </div>
  );
}
