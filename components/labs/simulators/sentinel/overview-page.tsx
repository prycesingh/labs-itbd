"use client";

// Overview dashboard — ported from sentinel-portal.js renderOverview(). Stat
// tiles and bar charts are genuine derived numbers computed over live state
// (connectors/incidents/rules), not hardcoded, matching the source's
// live-data convention for those two charts. Source additionally rendered
// two decorative sparklines (`lineSpark(24, ...)` / `lineSpark(90, ...)`)
// built from `Math.sin(...) + Math.random(...)` noise with no backing data —
// this port replaces both with real derived trends instead of carrying
// Math.random() forward:
//   - "Incidents created, last 7 days" buckets state.incidents[].created by
//     calendar day (real counts, not noise).
//   - "Activity volume, last 24 hours" buckets state.activityLog[].timestamp
//     by hour (real counts, not noise).
// Both are deterministic functions of state — re-rendering with the same
// state always draws the same line.

import type { SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelPage } from "./sentinel-shell";
import { StatRow } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

const SEVERITY_ORDER = ["High", "Medium", "Low", "Informational"] as const;
const SEVERITY_COLOR: Record<(typeof SEVERITY_ORDER)[number], string> = {
  High: "#cf2030",
  Medium: "#d97900",
  Low: "#f7b500",
  Informational: "#707070",
};

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barRowLbl}>{label}</span>
      <span className={styles.barRowBar}>
        <span className={styles.barRowFill} style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
      </span>
      <span className={styles.barRowVal}>{formatNum(value)}</span>
    </div>
  );
}

// Real (non-random) sparkline: renders a deterministic polyline from a series
// of counts. Used for both the incidents-per-day and activity-per-hour
// trends below.
function Sparkline({ series, color }: { series: number[]; color: string }) {
  const w = 360;
  const h = 90;
  const max = Math.max(...series, 1);
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const points = series.map((v, i) => ({ x: i * step, y: h - (v / max) * h }));
  const poly = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${poly} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={120} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth={2} points={poly} />
      <polyline fill={color} fillOpacity={0.12} stroke="none" points={area} />
    </svg>
  );
}

// Buckets incident `created` timestamps into the last 7 calendar days
// (oldest -> newest), real counts derived from state.incidents.
function incidentsPerDay(state: SentinelState): number[] {
  const days = 7;
  const buckets = new Array<number>(days).fill(0);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const incident of state.incidents) {
    const t = Date.parse(incident.created);
    if (Number.isNaN(t)) continue;
    const dayIndex = days - 1 - Math.floor((startOfToday - new Date(t).setHours(0, 0, 0, 0)) / DAY_MS);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex] += 1;
  }
  return buckets;
}

// Buckets activity log timestamps into the last 24 hours (oldest -> newest),
// real counts derived from state.activityLog.
function activityPerHour(state: SentinelState): number[] {
  const hours = 24;
  const buckets = new Array<number>(hours).fill(0);
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;
  for (const entry of state.activityLog) {
    const t = Date.parse(entry.timestamp);
    if (Number.isNaN(t)) continue;
    const hoursAgo = Math.floor((now - t) / HOUR_MS);
    const bucketIndex = hours - 1 - hoursAgo;
    if (bucketIndex >= 0 && bucketIndex < hours) buckets[bucketIndex] += 1;
  }
  return buckets;
}

export function OverviewPage({ state, onNavigate }: { state: SentinelState; onNavigate: (page: SentinelPage) => void }) {
  const totalEvents = state.connectors.reduce((sum, c) => sum + (c.recordsLast24h || 0), 0);
  const newIncidents = state.incidents.filter((i) => i.status === "New").length;
  const activeIncidents = state.incidents.filter((i) => i.status === "Active").length;
  const enabledRules = state.rules.filter((r) => r.enabled).length;
  const connectedConnectors = state.connectors.filter((c) => c.status === "Connected").length;

  const severityCounts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, sev) => {
    acc[sev] = 0;
    return acc;
  }, {});
  for (const incident of state.incidents) {
    severityCounts[incident.severity] = (severityCounts[incident.severity] || 0) + 1;
  }
  const severityMax = Math.max(...SEVERITY_ORDER.map((s) => severityCounts[s]), 1);

  const ingestionData = state.connectors
    .filter((c) => c.recordsLast24h > 0)
    .sort((a, b) => b.recordsLast24h - a.recordsLast24h)
    .slice(0, 8);
  const ingestionMax = Math.max(...ingestionData.map((c) => c.recordsLast24h), 1);

  return (
    <div>
      <StatRow
        stats={[
          { label: "Events ingested (24h)", value: formatNum(totalEvents), onClick: () => onNavigate("data-connectors") },
          { label: "Total incidents", value: state.incidents.length, onClick: () => onNavigate("incidents") },
          { label: "New incidents", value: newIncidents, onClick: () => onNavigate("incidents") },
          { label: "Active incidents", value: activeIncidents, onClick: () => onNavigate("incidents") },
          { label: "Active analytics rules", value: `${enabledRules} / ${state.rules.length}`, onClick: () => onNavigate("rules") },
          { label: "Data connectors", value: `${connectedConnectors} / ${state.connectors.length}`, onClick: () => onNavigate("data-connectors") },
        ]}
      />

      <div className={styles.h2}>Threat management</div>
      <div className={styles.row}>
        <div className={styles.chart}>
          <h4>Incidents by severity</h4>
          {SEVERITY_ORDER.map((sev) => (
            <BarRow key={sev} label={sev} value={severityCounts[sev]} max={severityMax} color={SEVERITY_COLOR[sev]} />
          ))}
        </div>
        <div className={styles.chart}>
          <h4>Incidents created, last 7 days</h4>
          <Sparkline series={incidentsPerDay(state)} color="#0078d4" />
        </div>
      </div>

      <div className={styles.h2}>Data ingestion</div>
      <div className={styles.row}>
        <div className={styles.chart}>
          <h4>Events per source (last 24h)</h4>
          {ingestionData.map((c) => (
            <BarRow key={c.id} label={c.name} value={c.recordsLast24h} max={ingestionMax} />
          ))}
        </div>
        <div className={styles.chart}>
          <h4>Activity volume, last 24 hours</h4>
          <Sparkline series={activityPerHour(state)} color="#107c10" />
        </div>
      </div>
    </div>
  );
}
