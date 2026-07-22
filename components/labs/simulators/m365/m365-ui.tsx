"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import styles from "./m365-console.module.css";

export function Flyout({ title, onClose, tabs, footer, children }: { title: string; onClose: () => void; tabs?: ReactNode; footer?: ReactNode; children: ReactNode }) {
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
          <h2>{title}</h2>
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

export function FormGroup({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>
      {children}
      {help ? <div className={styles.formHelp}>{help}</div> : null}
    </div>
  );
}

export function Pill({ tone = "ok", children }: { tone?: "ok" | "warn" | "err" | "info" | "muted"; children: ReactNode }) {
  const toneClass = tone === "warn" ? styles.pillWarn : tone === "err" ? styles.pillErr : tone === "info" ? styles.pillInfo : tone === "muted" ? styles.pillMuted : "";
  return <span className={`${styles.pill} ${toneClass}`}>{children}</span>;
}

export function StatRow({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <div className={styles.statRow}>
      {stats.map((s) => (
        <div key={s.label} className={styles.stat}>
          <div className={styles.statVal}>{s.value}</div>
          <div className={styles.statLabel}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const level = pct >= 90 ? styles.barHigh : pct >= 70 ? styles.barMed : "";
  return (
    <div className={styles.licUsageCell}>
      <div className={`${styles.bar} ${level}`}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.licUsageNums}>
        {used} / {total}
      </div>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return <span className={styles.avatarSm}>{initials}</span>;
}

export function ChartCard({ title, series, labels }: { title: string; series: number[]; labels?: string[]; secondary?: number[] }) {
  const max = Math.max(...series, 1);
  return (
    <div className={styles.chartCard}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.chartBars}>
        {series.map((v, i) => (
          <div key={i} className={styles.chartBar} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} title={labels?.[i]} />
        ))}
      </div>
    </div>
  );
}

export function BarListCard({ title, rows }: { title: string; rows: { label: string; value: number; max?: number }[] }) {
  const max = Math.max(...rows.map((r) => r.max ?? r.value), 1);
  return (
    <div className={styles.chartCard}>
      <div className={styles.cardTitle}>{title}</div>
      {rows.map((r) => (
        <div key={r.label} className={styles.barListRow}>
          <div className={styles.barListLabel}>{r.label}</div>
          <div className={styles.barListTrack}>
            <div className={styles.barListFill} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div>{r.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

export function CircularGauge({ current, max, size = 120, label }: { current: number; max: number; size?: number; label?: string }) {
  const pct = max > 0 ? current / max : 0;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  return (
    <div className={styles.gaugeWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#edebe9" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2564cf"
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={size / 5} fontWeight={600} fill="#201f1e">
          {current}
        </text>
      </svg>
      {label ? (
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#201f1e" }}>
            {current} / {max}
          </div>
          <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
        </div>
      ) : null}
    </div>
  );
}

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
