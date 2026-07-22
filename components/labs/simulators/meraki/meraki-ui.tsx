"use client";

// Shared UI primitives for the Cisco Meraki dashboard simulator, following
// the Power-Platform/Purview/Sentinel/Defender/Azure-DevOps `*-ui.tsx`
// pattern: small, presentation-only components that wrap
// meraki-console.module.css classes so page-building agents never
// hand-write `mer-*`-equivalent class names. Only minor one-off inline
// `style={{}}` (widths, computed bar/sparkline fills) is used — all real
// visual styling lives in the CSS module.
//
// Source (itbd-lab/simulators/meraki/js/meraki-portal.js) only used a single
// centered `openModal()`/`closeModal()` dialog, no slide-in panel. This suite
// adds a `Flyout` anyway (matching the Power-Platform/Purview/Sentinel/
// Defender convention) because later page-building agents need a place to
// put per-item detail views (client detail, AP detail, switch port detail,
// SSID detail) without overloading the centered Modal meant for
// forms/wizards/confirms.

import { type ReactNode } from "react";

import styles from "./meraki-console.module.css";

// ===== Modal =====
// Centered dialog, matching source's `openModal()`/`closeModal()`
// (`#merModalBack` / `.mer-modal`) — used for search results, confirms, and
// simple forms.
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
    <div className={styles.modalBack} onMouseDown={onClose}>
      <div className={styles.modal} style={width ? { width } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalH}>
          <span>{title}</span>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className={styles.modalB}>{children}</div>
        {footer ? <div className={styles.modalF}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ===== Flyout =====
// Slide-in right panel — structural addition beyond source (see file header)
// for client/AP/port/SSID detail views. `footer` renders an action bar.
export function Flyout({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className={styles.flyoutMask} onMouseDown={onClose} />
      <aside className={styles.flyout} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.flyoutHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className={styles.flyoutBody}>{children}</div>
        {footer ? <div className={styles.flyoutFooter}>{footer}</div> : null}
      </aside>
    </>
  );
}

// ===== Tab bars =====
// `TabBar` — page-level section switcher (underline style, matches source's
// `.mer-tabs`/`.mer-tab`). `SubTabBar` — compact pill-style switcher (matches
// the `.mer-subtabs`/`.mer-subtab` structural addition in the CSS module) for
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
    <div className={styles.subtabs}>
      {tabs.map((t) => (
        <button key={t.key} type="button" className={`${styles.subtab} ${active === t.key ? styles.subtabActive : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ===== Status pill =====
// Generic status badge covering Meraki's richer status vocabulary: device
// status (online/offline/alerting/rebooting/updating), WAN link status
// (active/ready/failed), alert/threat severity (critical/warning/info), and
// threat-event action (blocked/allowed/alerted). Matches source's
// `.mer-pill`/`.ok`/`.warn`/`.crit`/`.info`/`.muted` vocabulary —
// `statusTone()` maps common status strings onto those tones so callers
// don't need to hand-pick a tone per page.
export type StatusTone = "ok" | "warn" | "crit" | "info" | "muted";

export function StatusPill({ tone = "muted", children }: { tone?: StatusTone; children: ReactNode }) {
  const toneClass =
    tone === "ok" ? styles.pillOk :
    tone === "warn" ? styles.pillWarn :
    tone === "crit" ? styles.pillCrit :
    tone === "info" ? styles.pillInfo :
    styles.pillMuted;
  return (
    <span className={`${styles.pill} ${toneClass}`}>
      <span className={styles.dot} />
      {children}
    </span>
  );
}

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  // devices
  if (s === "online" || s === "active" || s === "ready" || s === "ok" || s === "allowed" || s === "connected") return "ok";
  if (s === "offline" || s === "failed" || s === "critical" || s === "crit" || s === "blocked" || s === "disconnected") return "crit";
  if (s === "alerting" || s === "warning" || s === "warn" || s === "rebooting" || s === "updating" || s === "alerted" || s === "degraded") return "warn";
  if (s === "info" || s === "informational") return "info";
  return "muted";
}

// ===== Stat tile =====
// Label + big number + optional sub-caption — used on the Home dashboard and
// various summary rows (matches source's `tile(label, value, sub)` helper,
// meraki-portal.js:576). `StatRow` wraps a list of them in the responsive
// grid (matches source's `.mer-tiles`).
export function StatTile({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <div className={styles.tile} style={onClick ? { cursor: "pointer" } : undefined} onClick={onClick}>
      <div className={styles.tileL}>{label}</div>
      <div className={styles.tileV}>{value}</div>
      {sub ? <div className={styles.tileS}>{sub}</div> : null}
    </div>
  );
}

export function StatRow({ stats }: { stats: { label: string; value: string | number; sub?: string; onClick?: () => void }[] }) {
  return (
    <div className={styles.tiles}>
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

// Alias kept for parity with the Power-Platform/Purview/Sentinel/Defender/
// Azure-DevOps naming convention.
export const FormGroup = Field;

export function NativeSelect({
  value,
  onChange,
  options,
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">) {
  return (
    <select className={`${styles.select} ${className ?? ""}`} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
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
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ appearance: "auto", width: "auto", height: "auto" }} />
      <span>{label}</span>
    </label>
  );
}

// ===== Toggle switch =====
// Dedicated on/off switch matching source's `.mer-toggle` (a LOT of settings
// pages use toggles rather than plain checkboxes — motion detection, RTSP,
// SSID broadcast, firewall rules, etc).
export function Toggle({ label, checked, onChange, disabled }: { label?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

// ===== Data table =====
// Generic table wrapper matching the Power-Platform/Purview/Sentinel/
// Defender/Azure-DevOps convention: caller supplies column defs + rows, this
// handles the wrap/table/thead/tbody chrome and empty state.
export type DataTableColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; width?: string };

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "No results.",
  dense,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  dense?: boolean;
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
              <td colSpan={columns.length} className={styles.textC} style={{ padding: dense ? 14 : 20 }}>
                <span className={styles.small}>{emptyMessage}</span>
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

// ===== Sparkline =====
// Small inline SVG sparkline renderer for client bandwidth series / sensor
// readings, matching source's `spark(series, color)` helper
// (meraki-network.js:16) — visual idea ported 1:1 (deterministic polyline
// from a real numeric series), rendered as JSX/SVG instead of an HTML
// string. Real data in, real polyline out — no fabrication.
export function Sparkline({ data, color }: { data: number[]; color?: string }) {
  const w = 90;
  const h = 22;
  if (!data || data.length === 0) {
    return <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" />;
  }
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color || "#5cb85c"} strokeWidth={1.4} points={points.join(" ")} />
    </svg>
  );
}

// ===== CSV export =====
// Blob-based CSV export, matching the Power-Platform/Purview/Sentinel/
// Defender/Azure-DevOps convention for exporting table data.
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
