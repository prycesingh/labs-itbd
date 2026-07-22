"use client";

// Shared UI primitives for the Microsoft Defender XDR simulator, following the
// Intune/AVD `*-ui.tsx` pattern: small, presentation-only components that
// wrap defender-console.module.css classes so page-building agents never
// hand-write `df-*`-equivalent class names. Only minor one-off inline
// `style={{}}` (widths, computed bar fills) is used, matching the light
// touch in avd-ui.tsx / intune-ui.tsx — all real visual styling lives in the
// CSS module.

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { DefenderSeverity } from "@/lib/labs/simulators/defender/types";
import styles from "./defender-console.module.css";

// ===== Flyout =====
// Slide-in right panel, matching source's Incident/Device/Identity/Role
// detail views. Optional `tabs` renders a tab bar directly under the header
// (pass a <TabBar/> or <SubTabBar/>); optional `footer` renders an action bar.
export function Flyout({ title, subtitle, onClose, tabs, footer, children }: { title: string; subtitle?: ReactNode; onClose: () => void; tabs?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div className={styles.flyoutMask} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={onClose} />
      <motion.div
        className={styles.flyout}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
      </motion.div>
    </AnimatePresence>
  );
}

// ===== Modal =====
// Centered dialog, matching source's Onboard / Add-member / Create-role-wizard
// / Confirm flows. `steps` renders a wizard step bar (use <WizStep/>) under
// the header when the modal is a multi-step wizard.
export function Modal({ title, onClose, width, steps, footer, children }: { title: string; onClose: () => void; width?: string; steps?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div className={styles.modalMask} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={onClose}>
        <motion.div
          className={styles.modal}
          style={width ? { width } : undefined}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2>{title}</h2>
            <button type="button" className={styles.flyoutClose} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          {steps ? <div className={styles.wizSteps}>{steps}</div> : null}
          <div className={styles.modalBody}>{children}</div>
          {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function WizStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return <div className={`${styles.wizStep} ${active ? styles.wizStepActive : ""} ${done ? styles.wizStepDone : ""}`}>{label}</div>;
}

// ===== Tab bars =====
// `TabBar` — page-level section switcher (underline style, matches source's
// `.df-tabs`/`.df-tab`). `SubTabBar` — compact pill-style switcher for flyout
// internal tabs or secondary in-page switches (matches `.df-tabs` variant
// used inside flyouts and `.df-subtab` styling ported as `subTab*`).
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
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
  informational: styles.sevInformational,
};

export function SeverityBadge({ severity }: { severity: DefenderSeverity | string }) {
  const cls = SEVERITY_CLASS[severity.toLowerCase()] ?? styles.sevInformational;
  return (
    <span className={`${styles.sev} ${cls}`}>
      <span className={styles.sevDot} />
      {severity}
    </span>
  );
}

export type StatusTone = "ok" | "warn" | "err" | "info" | "muted";

// Generic status pill for Active/Resolved/Pending/etc — complements
// SeverityBadge for non-severity statuses (incident status, action status,
// role type, connector state...). Caller picks the tone; common defaults are
// exported via `statusTone()` below for the most frequent status strings.
export function StatusPill({ tone = "muted", children }: { tone?: StatusTone; children: ReactNode }) {
  const toneClass = tone === "warn" ? styles.pillWarn : tone === "err" ? styles.pillErr : tone === "info" ? styles.pillInfo : tone === "muted" ? styles.pillMuted : "";
  return <span className={`${styles.pill} ${toneClass}`}>{children}</span>;
}

// Best-effort tone lookup for common status vocabulary seen across
// DefenderState (Active/Resolved/Pending/Healthy/Approved/Rejected/etc).
// Page components may still pass an explicit tone to StatusPill when this
// heuristic doesn't fit.
export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("resolved") || s.includes("healthy") || s.includes("approved") || s.includes("achieved") || s.includes("completed") || s.includes("connected") || s.includes("sanctioned")) return "ok";
  if (s.includes("pending") || s.includes("progress") || s.includes("advisory") || s.includes("monitor") || s.includes("report-only")) return "warn";
  if (s.includes("rejected") || s.includes("block") || s.includes("fail") || s.includes("disabled") || s.includes("unsanctioned")) return "err";
  if (s.includes("new") || s.includes("info")) return "info";
  return "muted";
}

// ===== Stat tile =====
// Label + big number — used on Home dashboard and various summary rows.
// Distinct from StatRow (Intune-style grid wrapper) so pages can lay out
// individual tiles freely; `StatRow` below wraps a list of them in the grid.
export function StatTile({ label, value, trend }: { label: string; value: string | number; trend?: "up" | "down" }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statVal}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {trend ? (
        <div className={`${styles.statTrend} ${trend === "down" ? styles.statTrendDown : ""}`}>
          {trend === "down" ? "▼" : "▲"} last 7 days
        </div>
      ) : null}
    </div>
  );
}

export function StatRow({ stats }: { stats: { label: string; value: string | number; trend?: "up" | "down" }[] }) {
  return (
    <div className={styles.statRow}>
      {stats.map((s) => (
        <StatTile key={s.label} label={s.label} value={s.value} trend={s.trend} />
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

// Alias kept for parity with the Intune/AVD naming convention referenced in
// the task spec (`Field`/`FormGroup` are the same primitive).
export const FormGroup = Field;

export function NativeSelect({ value, onChange, options, ...rest }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
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
// Generic table wrapper matching AVD/Intune's convention: caller supplies
// column defs + rows, this handles the wrap/table/thead/tbody chrome and
// empty state. `onRowClick` matches source's row-is-clickable pattern.
export type DataTableColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; width?: string };

export function DataTable<T>({ columns, rows, getRowKey, onRowClick, emptyMessage = "No results." }: { columns: DataTableColumn<T>[]; rows: T[]; getRowKey: (row: T) => string; onRowClick?: (row: T) => void; emptyMessage?: string }) {
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
// Blob-based CSV export, matching source's CSV export pattern used in
// Permissions / Devices.
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
