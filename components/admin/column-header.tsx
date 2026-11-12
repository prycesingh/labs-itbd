"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export type FilterOption = { value: string; label: string; count: number };

/**
 * Excel-style table header: clicking the label cycles the sort
 * (none → asc → desc → none); the funnel opens an autofilter menu with
 * sort shortcuts, a value search, "Select all" and a checkbox per distinct
 * value with its row count. `selected` = null means "no filter" (all values).
 */
export function ColumnHeader({
  label,
  sort,
  onSort,
  options,
  selected,
  onFilterChange,
  sortLabels = ["Sort A → Z", "Sort Z → A"],
  className,
}: {
  label: string;
  sort: SortDir | null;
  onSort: (dir: SortDir | null) => void;
  options?: FilterOption[];
  selected?: Set<string> | null;
  onFilterChange?: (next: Set<string> | null) => void;
  sortLabels?: [string, string];
  className?: string;
}) {
  const filtered = selected != null;
  const SortIcon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onSort(sort === null ? "asc" : sort === "asc" ? "desc" : null)}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-white/5 hover:text-white",
          sort ? "text-white" : "text-white/60",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <SortIcon
          className={cn(
            "size-3.5 transition-opacity",
            sort ? "text-itbd-blue" : "opacity-0 group-hover:opacity-60",
          )}
        />
      </button>

      {options && onFilterChange ? (
        <FilterMenu
          label={label}
          options={options}
          selected={selected ?? null}
          onChange={onFilterChange}
          onSort={onSort}
          sortLabels={sortLabels}
          active={filtered}
        />
      ) : null}
    </div>
  );
}

function FilterMenu({
  label,
  options,
  selected,
  onChange,
  onSort,
  sortLabels,
  active,
}: {
  label: string;
  options: FilterOption[];
  selected: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
  onSort: (dir: SortDir | null) => void;
  sortLabels: [string, string];
  active: boolean;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );

  const isChecked = (v: string) => selected == null || selected.has(v);
  const allChecked = options.every((o) => isChecked(o.value));
  const noneChecked = options.every((o) => !isChecked(o.value));

  function toggle(value: string, on: boolean) {
    const next = new Set(selected ?? options.map((o) => o.value));
    if (on) next.add(value);
    else next.delete(value);
    // Everything ticked again = no filter.
    onChange(next.size === options.length ? null : next);
  }

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter ${label}`}
          className={cn(
            "relative inline-flex size-6 items-center justify-center rounded-md transition-colors",
            active
              ? "bg-itbd-blue/15 text-itbd-blue"
              : "text-white/40 hover:bg-white/5 hover:text-white",
          )}
        >
          <Filter className="size-3.5" />
          {active ? (
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-itbd-blue shadow-[0_0_6px_var(--itbd-blue)]" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <div className="border-b border-white/10 p-1">
          <SortItem icon={ArrowDownAZ} label={sortLabels[0]} onClick={() => onSort("asc")} />
          <SortItem icon={ArrowUpAZ} label={sortLabels[1]} onClick={() => onSort("desc")} />
        </div>

        <div className="p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search values"
              className="h-8 pl-7 text-xs"
              aria-label={`Search ${label} values`}
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto px-1 pb-1">
          {!query ? (
            <FilterRow
              label="(Select all)"
              checked={allChecked ? true : noneChecked ? false : "indeterminate"}
              onCheckedChange={(on) => onChange(on ? null : new Set())}
            />
          ) : null}
          {visible.map((o) => (
            <FilterRow
              key={o.value}
              label={o.label}
              count={o.count}
              checked={isChecked(o.value)}
              onCheckedChange={(on) => toggle(o.value, on)}
            />
          ))}
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-white/40">No matching values</p>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-white/10 p-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={!active}
            onClick={() => onChange(null)}
          >
            Clear filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowDownAZ;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5 hover:text-white"
    >
      <Icon className="size-3.5 text-itbd-blue" />
      {label}
    </button>
  );
}

function FilterRow({
  label,
  count,
  checked,
  onCheckedChange,
}: {
  label: string;
  count?: number;
  checked: boolean | "indeterminate";
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-white/80 hover:bg-white/5">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="tabular-nums text-white/40">{count}</span>
      ) : null}
    </label>
  );
}
