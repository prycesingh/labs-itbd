"use client";

// Shared UI primitives for the Microsoft Purview compliance-portal simulator,
// following the Sentinel/Defender `*-ui.tsx` pattern: small, presentation-only
// components that wrap purview-console.module.css classes so page-building
// agents never hand-write `pv-*`-equivalent class names. Only minor one-off
// inline `style={{}}` (widths, computed bar/ring fills) is used — all real
// visual styling lives in the CSS module.

import { type ReactNode } from "react";

import styles from "./purview-console.module.css";

// ===== Flyout =====
// Slide-in right panel from the right edge, matching source's `.pv-flyout`
// (case detail, label detail, policy detail, etc). Optional `tabs` renders a
// tab bar directly under the header (pass a <TabBar/> or <SubTabBar/>);
// optional `footer` renders an action bar.
export function Flyout({
  title,
  subtitle,
  onClose,
  tabs,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  tabs?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className={styles.flyoutMask} onMouseDown={onClose} />
      <aside className={styles.flyout} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.flyoutHeader}>
          <div>
            <h2>{title}</h2>
            {subtitle ? <div style={{ fontSize: 12, color: "#605e5c", marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          <button type="button" className={styles.flyoutClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {tabs ? <div className={styles.flyoutTabs}>{tabs}</div> : null}
        <div className={styles.flyoutBody}>{children}</div>
        {footer ? <div className={styles.flyoutFooter}>{footer}</div> : null}
      </aside>
    </>
  );
}

// ===== Modal =====
// Centered dialog, matching source's `.pv-modal` (create-policy wizards,
// confirm dialogs, admin-unit/adaptive-scope info modals). `steps` renders a
// wizard step bar (use <WizStep/>) under the header when the modal is a
// multi-step wizard.
export function Modal({
  title,
  onClose,
  width,
  steps,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: string;
  steps?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={width ? { width } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.flyoutClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {steps ? <div className={styles.wizSteps}>{steps}</div> : null}
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}

// Wizard step indicator — used for multi-step create flows (e.g. DLP policy
// wizard, eDiscovery export wizard, communication-compliance policy wizard).
export function WizStep({ label, active, done, onClick }: { label: string; active: boolean; done: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.wizStep} ${active ? styles.wizStepActive : ""} ${done ? styles.wizStepDone : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      {done ? "✓ " : null}
      {label}
    </button>
  );
}

// ===== Tab bars =====
// `TabBar` — page-level section switcher (underline style, matches source's
// `.pv-tabs`/`.pv-tab`). `SubTabBar` — compact pill-style switcher (matches
// `.pv-filter-chip` styling) for filter rows or secondary in-page switches.
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

// ===== Severity / status badges =====
const SEVERITY_CLASS: Record<string, string> = {
  high: styles.pillErr,
  medium: styles.pillWarn,
  low: styles.pill, // default (green) pill reused for Low, matching source's untagged `.pv-pill`
};

// Colored badge for High/Medium/Low severities: High=red, Medium=orange(-ish
// warn tone), Low=yellow/green default — matches source's `.pv-pill`/`.pv-pill
// warn`/`.pv-pill err` vocabulary (Purview has no dedicated `.pv-sev-*`
// classes like Sentinel; severities are rendered as colored pills).
export function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_CLASS[severity.toLowerCase()] ?? styles.pillMuted;
  return <span className={`${styles.pill} ${cls}`}>{severity}</span>;
}

export type StatusTone = "ok" | "warn" | "err" | "info" | "muted" | "purple";

// Generic status pill for policy/case/label/scan statuses. Caller picks the
// tone explicitly, or use `statusTone()` for the common status vocabulary
// seen across PurviewState (Active/On/Succeeded -> ok, Disabled/Off/Failed ->
// err, Test/Simulation/Pending -> warn, New/Registered -> info).
export function StatusPill({ tone = "muted", children }: { tone?: StatusTone; children: ReactNode }) {
  const toneClass =
    tone === "ok" ? styles.pill :
    tone === "warn" ? styles.pillWarn :
    tone === "err" ? styles.pillErr :
    tone === "info" ? styles.pillInfo :
    tone === "purple" ? styles.pillPurple :
    styles.pillMuted;
  return <span className={toneClass}>{children}</span>;
}

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("active") || s === "on" || s.includes("succeeded") || s.includes("completed") || s.includes("implemented") || s.includes("resolved") || s.includes("registered") || s.includes("approved")) return "ok";
  if (s.includes("disabled") || s === "off" || s.includes("failed") || s.includes("closed")) return "err";
  if (s.includes("test") || s.includes("simulation") || s.includes("pending") || s.includes("in progress") || s.includes("scanning") || s.includes("running")) return "warn";
  if (s.includes("new") || s === "draft") return "info";
  return "muted";
}

// ===== Stat tile =====
// Label + big number — used on the Home dashboard and various summary rows.
// `StatRow` wraps a list of them in the responsive grid (matches source's
// `.pv-stat-row`). Optional `sub` renders the small third line (matches
// `.pv-stat .stat-sub`).
export function StatTile({ label, value, sub, onClick }: { label: string; value: string | number; sub?: string; onClick?: () => void }) {
  return (
    <div className={styles.stat} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className={styles.statVal}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub ? <div className={styles.statSub}>{sub}</div> : null}
    </div>
  );
}

export function StatRow({ stats }: { stats: { label: string; value: string | number; sub?: string; onClick?: () => void }[] }) {
  return (
    <div className={styles.statRow}>
      {stats.map((s) => (
        <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} onClick={s.onClick} />
      ))}
    </div>
  );
}

// ===== Form primitives =====
export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>
      {children}
      {help ? <div className={styles.formHelp}>{help}</div> : null}
    </div>
  );
}

// Alias kept for parity with the Defender/Sentinel/AVD naming convention.
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
// Generic table wrapper matching the Defender/Sentinel/AVD convention: caller
// supplies column defs + rows, this handles the wrap/table/thead/tbody chrome
// and empty state. `onRowClick` matches source's clickable-row pattern
// (`.pv-table tbody tr { cursor: pointer }`).
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
      <table className={styles.table}>
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

// ===== CSV export =====
// Blob-based CSV export, matching the Defender/Sentinel/AVD convention for
// exporting table data (e.g. audit log search results, eDiscovery search
// hits, DLP policy lists).
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
