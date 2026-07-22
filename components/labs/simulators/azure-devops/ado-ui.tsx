"use client";

// Shared UI primitives for the Azure DevOps simulator, following the
// Purview/Sentinel/Defender `*-ui.tsx` pattern: small, presentation-only
// components that wrap ado-console.module.css classes so page-building
// agents never hand-write `ado-*`-equivalent class names. Only minor one-off
// inline `style={{}}` (widths, computed bar/progress fills) is used — all
// real visual styling lives in the CSS module.
//
// Source (itbd-lab/simulators/azure-devops/js/ado-portal.js) uses a SINGLE
// centered modal (`ADOPortal.openModal/closeModal`) for everything —
// switchers, confirms, create dialogs — with no flyout/side-panel pattern
// anywhere in this suite. So unlike Purview/Sentinel there is no `Flyout`
// export here; `Modal` is the one overlay primitive.

import { type ReactNode } from "react";

import styles from "./ado-console.module.css";

// ===== Modal =====
// Centered dialog, matching source's `.ado-modal` (org/project switcher,
// confirm dialogs, create work item / new pipeline wizards, etc).
export function Modal({
  title,
  onClose,
  width,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={width ? { width } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ===== Tab bars =====
// `TabBar` — page-level section switcher (underline style, matches source's
// `.ado-tabs`/`.ado-tab`). `SubTabBar` — compact pill-style switcher (no
// direct source class; styled after source's `.saved-q` pill vocabulary) for
// filter rows or secondary in-page switches.
export function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <button key={t.key} type="button" className={`${styles.tab} ${active === t.key ? styles.tabActive : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SubTabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className={styles.subTabs}>
      {tabs.map((t) => (
        <button key={t.key} type="button" className={`${styles.subTab} ${active === t.key ? styles.subTabActive : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ===== Status pill =====
// Generic status badge for work item state / pipeline run status / PR status
// / test outcome etc. Matches source's `.ado-state state-*` vocabulary
// (state-new/active/resolved/done/rejected/default) — `statusTone()` maps the
// broader status vocabulary seen across AdoState (Succeeded/Approved -> done,
// Failed/Rejected -> rejected, Running/Active/Waiting -> active,
// Resolved/Completed -> resolved, everything else -> new/default) onto those
// five tones so callers don't need to hand-pick a tone per page.
export type StatusTone = "new" | "active" | "resolved" | "done" | "rejected" | "default";

export function StatusPill({ tone = "default", children }: { tone?: StatusTone; children: ReactNode }) {
  const toneClass =
    tone === "new" ? styles.stateNew :
    tone === "active" ? styles.stateActive :
    tone === "resolved" ? styles.stateResolved :
    tone === "done" ? styles.stateDone :
    tone === "rejected" ? styles.stateRejected :
    styles.stateDefault;
  return <span className={`${styles.statePill} ${toneClass}`}>{children}</span>;
}

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("fail") || s.includes("reject") || s.includes("abandon") || s.includes("blocked")) return "rejected";
  if (s.includes("succeed") || s.includes("done") || s.includes("closed") || s.includes("approved") || s.includes("passed")) return "done";
  if (s.includes("resolved") || s.includes("completed")) return "resolved";
  if (s.includes("active") || s.includes("running") || s.includes("waiting") || s.includes("pending") || s.includes("in progress")) return "active";
  return "new";
}

// ===== Stat tile =====
// Label + big number, optional colored top border (matches source's
// `statCard(val, label, color)` helper used on the Home dashboard, which sets
// `border-top-color` inline per stat) — used on the Home dashboard and
// various summary rows. `StatRow` wraps a list of them in the responsive
// flex row (matches source's `.ado-stat-row`).
export function StatTile({ label, value, color, onClick }: { label: string; value: string | number; color?: string; onClick?: () => void }) {
  return (
    <div
      className={styles.stat}
      style={{ borderTopColor: color, cursor: onClick ? "pointer" : undefined }}
      onClick={onClick}
    >
      <div className={styles.statVal}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

export function StatRow({ stats }: { stats: { label: string; value: string | number; color?: string; onClick?: () => void }[] }) {
  return (
    <div className={styles.statRow}>
      {stats.map((s) => (
        <StatTile key={s.label} label={s.label} value={s.value} color={s.color} onClick={s.onClick} />
      ))}
    </div>
  );
}

// ===== Form primitives =====
export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className={styles.formRow}>
      <label>{label}</label>
      <div>
        {children}
        {help ? <div style={{ fontSize: 12, color: "#605e5c", marginTop: 4 }}>{help}</div> : null}
      </div>
    </div>
  );
}

// Alias kept for parity with the Purview/Sentinel/Defender/AVD naming convention.
export const FormGroup = Field;

export function NativeSelect({
  value,
  onChange,
  options,
  ...rest
}: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] } & Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
>) {
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.checkboxRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ===== Data table =====
// Generic table wrapper matching the Purview/Sentinel/Defender/AVD
// convention: caller supplies column defs + rows, this handles the
// wrap/table/thead/tbody chrome and empty state. `onRowClick` matches
// source's clickable-row pattern (`.ado-table.clickable tbody tr { cursor:
// pointer }`).
export type DataTableColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; width?: string };

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "No results.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${onRowClick ? styles.tableClickable : ""}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", color: "#605e5c", padding: 20 }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ===== Empty state =====
export function EmptyState({ message }: { message: string }) {
  return <div className={styles.empty}>{message}</div>;
}

// ===== Initials avatar =====
// Small circular avatar showing a person's initials, matching source's
// avatar helper (`.ado-avatar`) used throughout Boards/Repos for
// assignee/reviewer/author display (e.g. work item "Assigned To", PR
// reviewers, commit authors). Derives up to 2 initials from `name.split(' ')`
// — e.g. "Jamie Chen" -> "JC", single-word names fall back to its first
// letter.
export function InitialsAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <span className={styles.avatar} title={name}>
      {initials}
    </span>
  );
}

// ===== CSV export =====
// Blob-based CSV export, matching the Purview/Sentinel/Defender/AVD
// convention for exporting table data. Source's Work Items page genuinely
// uses this pattern (export current query results to CSV).
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
