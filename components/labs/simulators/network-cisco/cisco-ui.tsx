"use client";

// Shared UI primitives for the Cisco IOS WebUI simulator, following the
// Power-Platform/Purview/Sentinel/Defender/Azure-DevOps/Meraki `*-ui.tsx`
// pattern: small, presentation-only components that wrap
// cisco-console.module.css classes so page-building agents never hand-write
// `cs-*`-equivalent class names. Only minor one-off inline `style={{}}`
// (widths, computed bar/gauge/sparkline fills) is used — all real visual
// styling lives in the CSS module.
//
// Source (itbd-lab/simulators/network/js/cisco-ui.js) only used a single
// centered `.cs-modal-back`/`.cs-modal` dialog (openModal()/closeModal()),
// no slide-in panel. This suite adds a `Flyout` anyway (matching the
// Meraki/Power-Platform/Purview/Sentinel/Defender convention) because later
// page-building agents need a place to put per-item detail views (interface
// detail, ACL rule detail, static route detail, IPsec tunnel detail, BGP/OSPF
// neighbor detail) without overloading the centered Modal meant for
// forms/wizards/confirms.

import { type ReactNode } from "react";

import styles from "./cisco-console.module.css";

// ===== Modal =====
// Centered dialog, matching source's `.cs-modal-back`/`.cs-modal` — used for
// forms, wizards, and confirms.
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
          <span className="t">{title}</span>
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
// for interface/ACL/route/tunnel/neighbor detail views. `footer` renders an
// action bar.
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
// `TabBar` — page-level section switcher (underline style, reuses the
// `.subtabs`/`.subtab` chrome at a slightly larger call site since source's
// top-level `.cs-tab` styling is reserved for the shell's own Configure /
// Monitor / Troubleshoot / Maintenance tabs). `SubTabBar` — compact
// pill-style switcher for filter rows / secondary in-page switches within a
// page component (e.g. interface detail tabs, ACL rule tabs).
export function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
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
// Generic status badge covering this portal's status vocabulary: interface
// admin/line state (up/down/admin-down), tunnel state (active/idle), BGP
// neighbor state (established/idle/connect/active/opensent/openconfirm), OSPF
// neighbor state (full/2-way/init/down/exstart/exchange/loading), EIGRP
// neighbor uptime health, certificate validity (valid/expired/pending), VLAN
// state (active/suspended), EtherChannel status (bundled/down/suspended),
// AAA/auth result (success/failed). Matches source's
// `.cs-pill`/`up`/`down`/`warn`/`info`/`muted` vocabulary (H.statusPill(),
// cisco-ui.js) — `statusTone()` maps common status strings onto those tones
// so callers don't need to hand-pick a tone per page.
export type StatusTone = "up" | "down" | "warn" | "info" | "muted";

export function StatusPill({ tone = "muted", children }: { tone?: StatusTone; children: ReactNode }) {
  const toneClass =
    tone === "up" ? styles.pillUp :
    tone === "down" ? styles.pillDown :
    tone === "warn" ? styles.pillWarn :
    tone === "info" ? styles.pillInfo :
    styles.pillMuted;
  return <span className={`${styles.pill} ${toneClass}`}>{children}</span>;
}

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  // interfaces / etherchannel / vlans / certs / general "good" states
  if (
    s === "up" ||
    s === "active" ||
    s === "bundled" ||
    s === "established" ||
    s === "full" ||
    s === "2-way" ||
    s === "valid" ||
    s === "connected" ||
    s === "success" ||
    s === "ok" ||
    s === "enabled" ||
    s === "forwarding"
  )
    return "up";
  // hard-down / failure states
  if (
    s === "down" ||
    s === "failed" ||
    s === "expired" ||
    s === "suspended" ||
    s === "disabled" ||
    s === "blocking" ||
    s === "idle"
  )
    return "down";
  // transitional / attention states
  if (
    s === "admin-down" ||
    s === "warning" ||
    s === "warn" ||
    s === "init" ||
    s === "exstart" ||
    s === "exchange" ||
    s === "loading" ||
    s === "connect" ||
    s === "opensent" ||
    s === "openconfirm" ||
    s === "pending" ||
    s === "listening" ||
    s === "learning" ||
    s === "degraded"
  )
    return "warn";
  if (s === "info" || s === "informational") return "info";
  return "muted";
}

// ===== LED dot =====
// Small colored dot used alongside interface names in tiles/tables, matching
// source's `H.led(status)` helper (`.cs-led`/`up`/`down`/`admin-down`).
export type LedTone = "up" | "down" | "admin-down";

export function Led({ tone }: { tone: LedTone }) {
  const toneClass = tone === "up" ? styles.ledUp : tone === "down" ? styles.ledDown : styles.ledAdminDown;
  return <span className={`${styles.led} ${toneClass}`} />;
}

// ===== Stat tile =====
// Label + big number + optional sub-caption — used on the Overview dashboard
// and various summary rows. Structural addition beyond source's raw
// `.cs-kv`/`.cs-gauge` dashboard cards (see CSS module header), matching
// every other ported suite's Home/Overview page convention.
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
      <label className={styles.formLabel} style={{ display: "block", textAlign: "left", padding: 0 }}>
        {label}
      </label>
      {children}
      {help ? <div className={styles.formHint}>{help}</div> : null}
    </div>
  );
}

// Alias kept for parity with the Meraki/Power-Platform/Purview/Sentinel/
// Defender/Azure-DevOps naming convention.
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
    <label className={styles.checkrow} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ===== Toggle switch =====
// Dedicated on/off switch — structural addition beyond source (which used
// plain checkboxes for SSH/Telnet/HTTPS/AAA enable flags), matching the
// Meraki-suite `.toggle` convention. Several settings pages (SSH, Telnet,
// HTTPS server, IPS, AAA, DHCP pool active) read more naturally as toggles.
export function Toggle({ label, checked, onChange, disabled }: { label?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

// ===== Data table =====
// Generic table wrapper matching the Meraki/Power-Platform/Purview/Sentinel/
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
// Small inline SVG sparkline renderer for interface throughput / CPU history
// — structural addition beyond source (which drew a live-updating SVG donut
// gauge via `drawGauge()`, cisco-ui.js:1270, but no line-history chart),
// matching the Meraki-suite `Sparkline` convention. Real data in, real
// polyline out — no fabrication.
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
      <polyline fill="none" stroke={color || "#1d8ec5"} strokeWidth={1.4} points={points.join(" ")} />
    </svg>
  );
}

// ===== Gauge =====
// SVG donut gauge for CPU/memory utilization — ported visual idea from
// source's `drawGauge(id, value, color)` (cisco-ui.js:1270-1283), rendered as
// JSX/SVG instead of manual DOM/innerHTML manipulation.
export function Gauge({ value, label, color }: { value: number; label?: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c - (c * pct) / 100;
  return (
    <div className={styles.gauge}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} stroke="#e7eaef" strokeWidth={12} fill="none" />
        <circle
          cx={65}
          cy={65}
          r={r}
          stroke={color || "#005073"}
          strokeWidth={12}
          fill="none"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={off.toFixed(2)}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
      </svg>
      <div className={styles.gaugeText}>
        <span className="v">{pct}%</span>
        <span className="l">{label ?? "Used"}</span>
      </div>
    </div>
  );
}

// ===== CSV export =====
// Blob-based CSV export, matching the Meraki/Power-Platform/Purview/Sentinel/
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
