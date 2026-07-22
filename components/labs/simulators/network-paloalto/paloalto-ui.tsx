"use client";

// Shared UI primitives for the Palo Alto PAN-OS WebUI simulator, following
// the Cisco/FortiGate `*-ui.tsx` pattern: small, presentation-only
// components that wrap paloalto-console.module.css classes so
// page-building agents never hand-write `pa-*`-equivalent class names. Only
// minor one-off inline `style={{}}` (widths, computed bar/gauge/sparkline
// fills, grid spans) is used — all real visual styling lives in the CSS
// module.
//
// Source (itbd-lab/simulators/network/js/paloalto-ui.js) only used a single
// centered `.pa-modal-back`/`.pa-modal` dialog, no slide-in panel. This suite
// adds a `Flyout` anyway (matching the Cisco/FortiGate convention) because
// later page-building agents need a place to put per-item detail views
// (interface detail, security policy detail, IPsec tunnel detail, profile
// detail) without overloading the centered Modal meant for forms/wizards/
// confirms.

import { type ReactNode } from "react";

import styles from "./paloalto-console.module.css";

// ===== Modal =====
// Centered dialog, matching source's `.pa-modal-back`/`.pa-modal` — used for
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
        <div className={styles.modalHead}>
          <span>{title}</span>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ===== Flyout =====
// Slide-in right panel — structural addition beyond source (see file
// header) for interface/policy/tunnel/profile detail views. `footer` renders
// an action bar.
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
// `TabBar` — page-level section switcher; `SubTabBar` — compact pill-style
// switcher for filter rows / secondary in-page switches within a page
// component (e.g. policy detail tabs, profile detail tabs). Both reuse the
// same `.subtabs`/`.subtab` chrome (structural addition beyond source, which
// has no in-page tab strip — every ported suite adds one), matching the
// Cisco/FortiGate-suite convention of two thin named wrappers over one
// visual style.
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
// link state (up/down), security policy action (allow/deny), decryption
// policy action (decrypt/no-decrypt), NAT/auth policy general states, IPsec
// tunnel / IKE gateway / BGP peer status (established/up/down/negotiating),
// GlobalProtect portal/gateway status, admin/certificate status, WildFire
// verdicts (benign/grayware/malware/phishing), license/content-update
// status. Matches source's `.pa-pill`/`up`/`down`/`warn`/`info`/`muted`
// vocabulary (statusPill() helper, paloalto-ui.js) — `statusTone()` maps
// common status strings onto those tones so callers don't need to
// hand-pick a tone per page.
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
  // interfaces / security-policy allow / tunnels / peers / general "good"
  // states / WildFire benign verdict
  if (
    s === "up" ||
    s === "allow" ||
    s === "enable" ||
    s === "enabled" ||
    s === "established" ||
    s === "active" ||
    s === "connected" ||
    s === "registered" ||
    s === "licensed" ||
    s === "reachable" ||
    s === "healthy" ||
    s === "success" ||
    s === "ok" ||
    s === "benign" ||
    s === "decrypt" ||
    s === "valid"
  )
    return "up";
  // hard-down / failure / blocking / critical states / WildFire malicious
  // verdicts
  if (
    s === "down" ||
    s === "deny" ||
    s === "disable" ||
    s === "disabled" ||
    s === "drop" ||
    s === "reset" ||
    s === "reset-client" ||
    s === "reset-server" ||
    s === "reset-both" ||
    s === "block" ||
    s === "blocked" ||
    s === "failed" ||
    s === "expired" ||
    s === "close" ||
    s === "closed" ||
    s === "revoked" ||
    s === "critical" ||
    s === "malware" ||
    s === "phishing"
  )
    return "down";
  // transitional / attention states / WildFire grayware verdict / no-decrypt
  if (
    s === "warn" ||
    s === "warning" ||
    s === "negotiating" ||
    s === "connecting" ||
    s === "pending" ||
    s === "degraded" ||
    s === "start" ||
    s === "grayware" ||
    s === "no-decrypt" ||
    s === "nodecrypt"
  )
    return "warn";
  if (s === "info" || s === "informational" || s === "notice" || s === "dns" || s === "monitor") return "info";
  return "muted";
}

// ===== Led dot =====
// Small colored dot used alongside interface names in tiles/tables — no
// direct source equivalent (source used the `.pa-pill` badge for interface
// link state, paloalto-ui.js), but every ported suite offers a compact LED
// alternative for dense grids/tiles.
export type LedTone = "up" | "down" | "warn";

export function Led({ tone }: { tone: LedTone }) {
  const toneClass = tone === "up" ? styles.pillUp : tone === "down" ? styles.pillDown : styles.pillWarn;
  return <span className={`${styles.colorDot} ${toneClass}`} />;
}

// ===== Stat tile =====
// Label + big number + optional sub-caption — used on the Overview dashboard
// and various summary rows. Structural addition beyond source's raw
// `.pa-kv`/`.pa-donut`/`.pa-bar-row` dashboard widgets (see CSS module
// header), matching every other ported suite's Overview/Home page
// convention.
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
export function Field({ label, help, required, children }: { label: string; help?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className={styles.formField}>
      <label className={`${styles.formLabel} ${required ? styles.formLabelReq : ""}`} style={{ display: "block", textAlign: "left", padding: 0 }}>
        {label}
      </label>
      {children}
      {help ? <div className={styles.hint}>{help}</div> : null}
    </div>
  );
}

// Alias kept for parity with the Cisco/FortiGate naming convention.
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
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5 }}>
      <input className={styles.checkbox} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ===== Toggle switch =====
// Matches source's `.pa-switch` slider toggle (paloalto.css:422-440) — used
// throughout PAN-OS for enable/disable settings (security/NAT/decryption
// policy disable flag, zone user-ID, HA preempt, admin account, etc).
export function Toggle({ label, checked, onChange, disabled }: { label?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label ? <span className={styles.switchLabel}>{label}</span> : null}
    </label>
  );
}

// ===== Data table =====
// Generic table wrapper matching the Cisco/FortiGate convention: caller
// supplies column defs + rows, this handles the wrap/table/thead/tbody
// chrome and empty state.
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
// Small inline SVG sparkline renderer for interface/tunnel throughput
// history — structural addition beyond source (which drew static/randomized
// `.pa-mini-bars`/`.pa-bar-row` divs via `renderMiniBars()`/`renderBars()`,
// paloalto-ui.js, but no polyline history chart), matching the Cisco/
// FortiGate-suite `Sparkline` convention. Real data in, real polyline out —
// no fabrication.
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
      <polyline fill="none" stroke={color || "#fa582d"} strokeWidth={1.4} points={points.join(" ")} />
    </svg>
  );
}

// ===== Gauge =====
// SVG donut gauge for CPU (mgmt/dp)/memory/session utilization — ported
// visual idea from source's dashboard resource widget (raw `dt`/`dd` text,
// paloalto-ui.js `widgetResources()`), rendered here as a proper SVG donut
// gauge matching every other ported suite's Overview page convention.
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
          stroke={color || "#fa582d"}
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
// Blob-based CSV export, matching the Cisco/FortiGate convention for
// exporting table data.
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
