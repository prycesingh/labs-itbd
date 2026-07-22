"use client";

import { type ReactNode, useState } from "react";

import type { AvdState } from "@/lib/labs/simulators/avd/types";

import styles from "./avd-console.module.css";
import { DataTable, StatusBadge } from "./avd-ui";

/*
 * Ported from itbd-lab/simulators/avd/js/avd-insights.js (AvdInsights).
 * The source is a pre-built Log Analytics workbook view (utilization,
 * performance, connection diagnostics, input delay, process details,
 * alerts) fed by AvdData.getSessionHosts(). Only the Overview and
 * Utilization tabs derive anything from real state there (active session
 * counts, available host counts, per-host session load) — the rest of the
 * workbook (perf counters, connection error codes, RTT buckets, input-delay
 * samples, process list, alert rules) is fixed sample telemetry in the
 * source with no underlying state to compute from, so those tabs are
 * reproduced as the same representative rows rather than invented metrics.
 */

type InsightsTab =
  | "overview"
  | "utilization"
  | "performance"
  | "connection"
  | "user-input-delay"
  | "process-detail"
  | "alerts";

const TABS: { id: InsightsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "utilization", label: "Utilization" },
  { id: "performance", label: "Host performance" },
  { id: "connection", label: "Connection diagnostics" },
  { id: "user-input-delay", label: "Input delay" },
  { id: "process-detail", label: "Process details" },
  { id: "alerts", label: "Alerts" },
];

type StatTone = "blue" | "green" | "purple" | "red";

const STAT_TONE_COLOR: Record<StatTone, string> = {
  blue: "#0078d4",
  green: "#107c10",
  purple: "#5c2df5",
  red: "#a4262c",
};

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: StatTone }) {
  return (
    <div className={styles.card} style={{ padding: 14, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: "#605e5c", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: STAT_TONE_COLOR[tone], marginTop: 4 }}>{value}</div>
    </div>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function BarChart({ heights, tall }: { heights: number[]; tall?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        height: tall ? 160 : 90,
        padding: "8px 4px",
        background: "#faf9f8",
        border: "1px solid #edebe9",
        borderRadius: 2,
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{ flex: 1, height: `${h}%`, background: "#0078d4", borderRadius: "1px 1px 0 0", minWidth: 2 }}
        />
      ))}
    </div>
  );
}

// Deterministic pseudo-random bar heights so the charts don't reshuffle on every render
// (the source used Math.random() per render, which is fine for a one-shot innerHTML
// repaint but would jitter continuously in React). Seeded from index + a tab-specific
// offset so different charts still look distinct from one another.
function seededHeights(count: number, seed: number, min: number, spread: number): number[] {
  const out: number[] = [];
  let x = seed || 1;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    out.push(min + r * spread);
  }
  return out;
}

function peakHourHeights(): number[] {
  const heights: number[] = [];
  let x = 17;
  for (let i = 0; i < 24; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    let h: number;
    if (i < 8) h = 5 + r * 10;
    else if (i < 10) h = 30 + r * 40;
    else if (i < 12) h = 80 + r * 15;
    else if (i < 15) h = 70 + r * 20;
    else if (i < 18) h = 60 + r * 20;
    else if (i < 21) h = 25 + r * 15;
    else h = 8 + r * 5;
    heights.push(h);
  }
  return heights;
}

export function InsightsPage({ state }: { state: AvdState }) {
  const [tab, setTab] = useState<InsightsTab>("overview");

  return (
    <div>
      <div className={styles.sectionCard} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 4,
            background: "#5c2d91",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          IN
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Azure Virtual Desktop Insights</h1>
          <p className={styles.help} style={{ margin: 0 }}>
            Pre-built workbook. Data from AVDConnectionEvents, Perf, Event, WVDCheckpoints, WVDErrors, WVDFeeds,
            WVDManagement, WVDAgentHealthStatus, WVDHostRegistrations tables in Log Analytics.
          </p>
        </div>
      </div>

      <div className={styles.wizTabs} style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.wizTab} ${tab === t.id ? styles.wizTabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.sectionCard}>
        {tab === "overview" ? <OverviewTab state={state} /> : null}
        {tab === "utilization" ? <UtilizationTab state={state} /> : null}
        {tab === "performance" ? <PerformanceTab /> : null}
        {tab === "connection" ? <ConnectionTab /> : null}
        {tab === "user-input-delay" ? <InputDelayTab /> : null}
        {tab === "process-detail" ? <ProcessesTab /> : null}
        {tab === "alerts" ? <AlertsTab /> : null}
      </div>
    </div>
  );
}

function OverviewTab({ state }: { state: AvdState }) {
  const totalSessions = state.sessionHosts.reduce((sum, h) => sum + h.sessions + h.disconnectedSessions, 0);
  const availableHosts = state.sessionHosts.filter((h) => h.status === "Available").length;

  const hostPoolRows = state.hostPools.map((pool) => {
    const hosts = state.sessionHosts.filter((h) => h.hostPool === pool.id);
    const activeSessions = hosts.reduce((sum, h) => sum + h.sessions, 0);
    return { pool, hosts: hosts.length, activeSessions };
  });

  return (
    <>
      <StatGrid>
        <StatCard label="Active sessions" value={totalSessions} tone="blue" />
        <StatCard label="Available hosts" value={availableHosts} tone="green" />
        <StatCard label="Avg connect time" value="4.2s" tone="blue" />
        <StatCard label="Avg latency" value="38ms" tone="green" />
        <StatCard label="Sessions / hour (24h avg)" value="142" tone="purple" />
        <StatCard label="Unique users (7d)" value="623" tone="purple" />
        <StatCard label="Connection failures (24h)" value="7" tone="red" />
        <StatCard label="User feedback score" value="4.3 / 5" tone="green" />
      </StatGrid>

      <h3>Active sessions (last 24 hours)</h3>
      <BarChart heights={seededHeights(48, 11, 15, 70)} tall />

      <h3 style={{ marginTop: 20 }}>Host pools by usage</h3>
      <DataTable columns={["Host pool", "Type", "Session hosts", "Active sessions", "Max / host", "Region"]}>
        {hostPoolRows.map(({ pool, hosts, activeSessions }) => (
          <tr key={pool.id}>
            <td>{pool.name}</td>
            <td>{pool.type}</td>
            <td>{hosts}</td>
            <td>{activeSessions}</td>
            <td>{pool.maxSessionLimit}</td>
            <td>{pool.region}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}

function UtilizationTab({ state }: { state: AvdState }) {
  return (
    <>
      <h3>Concurrent sessions per host pool</h3>
      <BarChart heights={seededHeights(24, 5, 20, 65)} tall />

      <h3 style={{ marginTop: 20 }}>Session host utilization</h3>
      <DataTable columns={["Host name", "Host pool", "Status", "Active sessions", "Available sessions", "Used %", "Max sessions"]}>
        {state.sessionHosts.map((h) => {
          const pool = state.hostPools.find((p) => p.id === h.hostPool);
          const max = pool?.maxSessionLimit ?? 10;
          const used = Math.min(h.sessions, max);
          const pct = max > 0 ? Math.round((used / max) * 100) : 0;
          return (
            <tr key={h.id}>
              <td>{h.name}</td>
              <td>{h.hostPool}</td>
              <td>
                <StatusBadge status={h.status} />
              </td>
              <td>{h.sessions}</td>
              <td>{Math.max(max - used, 0)}</td>
              <td>{pct}%</td>
              <td>{max}</td>
            </tr>
          );
        })}
      </DataTable>

      <h3 style={{ marginTop: 20 }}>Peak hour analysis</h3>
      <BarChart heights={peakHourHeights()} />
      <p className={styles.help} style={{ marginTop: 6 }}>
        Peak: 10:00-12:00 IST. Trough: 02:00-06:00 IST. Recommended scaling: ramp up at 09:00, ramp down at 19:00.
      </p>
    </>
  );
}

function PerformanceTab() {
  const counters: { counter: string; avg: string; p95: string; max: string; threshold: string; status: string }[] = [
    { counter: "% Processor Time", avg: "42%", p95: "78%", max: "94%", threshold: "Warn > 85%", status: "Available" },
    { counter: "Available MBytes (memory)", avg: "3,847 MB", p95: "1,236 MB", max: "421 MB", threshold: "Warn < 500 MB", status: "Unavailable" },
    { counter: "Avg Disk sec/Read", avg: "4 ms", p95: "12 ms", max: "89 ms", threshold: "Warn > 25 ms", status: "Available" },
    { counter: "Avg Disk sec/Write", avg: "6 ms", p95: "18 ms", max: "112 ms", threshold: "Warn > 25 ms", status: "Available" },
    { counter: "Network Bytes Total/sec", avg: "2.4 MB/s", p95: "14.2 MB/s", max: "87 MB/s", threshold: "-", status: "Available" },
    { counter: "Pages/sec (paging)", avg: "120", p95: "340", max: "1,247", threshold: "Warn > 1000", status: "Unavailable" },
    { counter: "FSLogix Profile Container size", avg: "4.2 GB", p95: "9.8 GB", max: "22.4 GB", threshold: "Default 30 GB", status: "Available" },
  ];
  const processes: { process: string; user: string; cpu: string; memory: string; host: string }[] = [
    { process: "chrome.exe", user: "jdoe@corp.cloudlab.in", cpu: "21%", memory: "1.2 GB", host: "vmss-pool-prod-3" },
    { process: "WINWORD.EXE", user: "ksingh@corp.cloudlab.in", cpu: "14%", memory: "847 MB", host: "vmss-pool-prod-3" },
    { process: "OUTLOOK.EXE", user: "mgarcia@corp.cloudlab.in", cpu: "8%", memory: "624 MB", host: "vmss-pool-prod-5" },
    { process: "powershell.exe", user: "admin", cpu: "4%", memory: "180 MB", host: "vmss-pool-prod-1" },
    { process: "fslogix.exe", user: "SYSTEM", cpu: "3%", memory: "112 MB", host: "vmss-pool-prod-3" },
  ];

  return (
    <>
      <h3>Performance counters (24h, p95)</h3>
      <DataTable columns={["Counter", "Average", "P95", "Max", "Threshold", "Status"]}>
        {counters.map((c) => (
          <tr key={c.counter}>
            <td>{c.counter}</td>
            <td>{c.avg}</td>
            <td>{c.p95}</td>
            <td>{c.max}</td>
            <td>{c.threshold}</td>
            <td>
              <StatusBadge status={c.status === "Available" ? "Available" : "Unavailable"} />
            </td>
          </tr>
        ))}
      </DataTable>

      <h3 style={{ marginTop: 20 }}>Hot processes by CPU (live)</h3>
      <DataTable columns={["Process", "User", "CPU %", "Memory", "Host"]}>
        {processes.map((p) => (
          <tr key={p.process}>
            <td>{p.process}</td>
            <td>{p.user}</td>
            <td>{p.cpu}</td>
            <td>{p.memory}</td>
            <td>{p.host}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}

function ConnectionTab() {
  const errors: { code: string; name: string; count: number; cause: string; fix: string }[] = [
    { code: "0x3000047", name: "RemoteResourceProviderError", count: 9, cause: "Host pool agent not registered", fix: "Restart RDAgent service / re-register host" },
    { code: "0x3000048", name: "ConnectionTokenError", count: 5, cause: "User token expired or app group permission missing", fix: "Re-sign-in / verify user is in app group" },
    { code: "0x4006", name: "DisconnectReasonByOSData", count: 4, cause: "Idle timeout (FSLogix / session policy)", fix: "Adjust idle timeout in host pool RDP properties" },
    { code: "0x3000019", name: "HostNotFound", count: 3, cause: "Stale session host not removed", fix: "Drain mode + remove host from pool" },
    { code: "0x110", name: "UnexpectedNetworkDisconnect", count: 2, cause: "Client network issue", fix: "Verify user network — not an AVD issue" },
  ];
  const rtt: { range: string; sessions: string; pct: string; experience: string }[] = [
    { range: "0-50 ms", sessions: "6,847 (78%)", pct: "78%", experience: "Available" },
    { range: "50-100 ms", sessions: "1,624 (18.6%)", pct: "18.6%", experience: "Available" },
    { range: "100-150 ms", sessions: "198 (2.3%)", pct: "2.3%", experience: "Unavailable" },
    { range: "150-200 ms", sessions: "62 (0.7%)", pct: "0.7%", experience: "Unavailable" },
    { range: "> 200 ms", sessions: "11 (0.1%)", pct: "0.1%", experience: "Unavailable" },
  ];
  const rttLabel: Record<string, string> = {
    "0-50 ms": "Excellent",
    "50-100 ms": "Good",
    "100-150 ms": "Acceptable",
    "150-200 ms": "Poor",
    "> 200 ms": "Unusable",
  };

  return (
    <>
      <h3>Connection diagnostics (24h)</h3>
      <StatGrid>
        <StatCard label="Successful connections" value="8,742" tone="green" />
        <StatCard label="Failed connections" value="23 (0.26%)" tone="red" />
        <StatCard label="Average RTT" value="38ms" tone="blue" />
        <StatCard label="Average bandwidth" value="1.2 Mbps" tone="purple" />
      </StatGrid>

      <h3>Connection error breakdown</h3>
      <DataTable columns={["Error code", "Error name", "Count", "Likely cause", "Recommended fix"]}>
        {errors.map((e) => (
          <tr key={e.code}>
            <td>
              <code>{e.code}</code>
            </td>
            <td>{e.name}</td>
            <td>{e.count}</td>
            <td>{e.cause}</td>
            <td>{e.fix}</td>
          </tr>
        ))}
      </DataTable>

      <h3 style={{ marginTop: 20 }}>Round Trip Time (RTT) distribution</h3>
      <DataTable columns={["RTT range", "Sessions", "% of total", "Experience"]}>
        {rtt.map((r) => (
          <tr key={r.range}>
            <td>{r.range}</td>
            <td>{r.sessions}</td>
            <td>{r.pct}</td>
            <td>
              <span className={`${styles.badge} ${r.experience === "Available" ? styles.badgeRunning : styles.badgeStopped}`}>
                {rttLabel[r.range]}
              </span>
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}

function InputDelayTab() {
  const sessions: { user: string; host: string; avg: string; max: string; cause: string }[] = [
    { user: "jdoe@corp.cloudlab.in", host: "vmss-pool-prod-3", avg: "189 ms", max: "421 ms", cause: "Host CPU > 90% (chrome.exe at 78% by this user)" },
    { user: "ksingh@corp.cloudlab.in", host: "vmss-pool-prod-3", avg: "156 ms", max: "302 ms", cause: "Shared host — co-tenant impact" },
    { user: "mgarcia@corp.cloudlab.in", host: "vmss-pool-prod-5", avg: "172 ms", max: "289 ms", cause: "Network — RTT 145ms from client" },
  ];

  return (
    <>
      <h3>User input delay per session</h3>
      <p className={styles.help}>
        Time from mouse click / keyboard event → app responds. Tracked via &quot;User Input Delay (per session)&quot;
        counter. &gt;150ms = users complain.
      </p>
      <BarChart heights={seededHeights(24, 29, 10, 60)} tall />

      <h3 style={{ marginTop: 20 }}>Sessions with input delay &gt; 150 ms (last hour)</h3>
      <DataTable columns={["User", "Host", "Avg delay", "Max delay", "Likely cause"]}>
        {sessions.map((s) => (
          <tr key={s.user}>
            <td>{s.user}</td>
            <td>{s.host}</td>
            <td>{s.avg}</td>
            <td>{s.max}</td>
            <td>{s.cause}</td>
          </tr>
        ))}
      </DataTable>

      <h3 style={{ marginTop: 20 }}>Recommendations</h3>
      <ul style={{ fontSize: 13, color: "#605e5c", lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Resize host pool to D8s_v5 (was D4s_v5) — CPU pressure relief</li>
        <li>Enable Multimedia Redirection (MMR) for Teams / YouTube — offloads codec to client</li>
        <li>Reduce MaxSessionLimit from 10 → 8 on pooled hosts with frequent input delay</li>
        <li>Add scaling plan to spin up extra hosts before peak hour (10:00 IST)</li>
      </ul>
    </>
  );
}

function ProcessesTab() {
  const processes: { process: string; instances: number; avgCpu: string; peakCpu: string; memory: string }[] = [
    { process: "chrome.exe", instances: 247, avgCpu: "14.2%", peakCpu: "78%", memory: "52.3 GB" },
    { process: "msedge.exe", instances: 89, avgCpu: "9.7%", peakCpu: "62%", memory: "18.4 GB" },
    { process: "WINWORD.EXE", instances: 156, avgCpu: "7.1%", peakCpu: "54%", memory: "21.8 GB" },
    { process: "OUTLOOK.EXE", instances: 198, avgCpu: "5.4%", peakCpu: "38%", memory: "32.1 GB" },
    { process: "Teams.exe", instances: 178, avgCpu: "4.8%", peakCpu: "92%", memory: "27.4 GB" },
    { process: "EXCEL.EXE", instances: 94, avgCpu: "3.2%", peakCpu: "47%", memory: "14.9 GB" },
    { process: "powerpnt.exe", instances: 43, avgCpu: "2.8%", peakCpu: "41%", memory: "8.7 GB" },
    { process: "fslogix.exe", instances: 247, avgCpu: "1.4%", peakCpu: "12%", memory: "3.2 GB" },
    { process: "WmiPrvSE.exe", instances: 247, avgCpu: "0.7%", peakCpu: "8%", memory: "1.8 GB" },
    { process: "powershell.exe", instances: 34, avgCpu: "0.4%", peakCpu: "22%", memory: "2.1 GB" },
  ];

  return (
    <>
      <h3>Top processes by CPU (last hour)</h3>
      <DataTable columns={["Process", "Instances", "Avg CPU %", "Peak CPU %", "Memory total"]}>
        {processes.map((p) => (
          <tr key={p.process}>
            <td>{p.process}</td>
            <td>{p.instances}</td>
            <td>{p.avgCpu}</td>
            <td>{p.peakCpu}</td>
            <td>{p.memory}</td>
          </tr>
        ))}
      </DataTable>
      <p className={styles.help} style={{ marginTop: 6 }}>
        <b>Tip:</b> Chrome + Edge + Teams.exe combined often dominate CPU. Consider Multimedia Redirection (MMR) for
        Teams (Teams 2.0 with VDI optimization) + Edge in Single Sign-On Web mode for less RAM/CPU.
      </p>
    </>
  );
}

function AlertsTab() {
  const rules: { name: string; condition: string; severity: string; enabled: boolean }[] = [
    { name: "AVD: Host pool sessions > 90% capacity", condition: "HostPool concurrent sessions / MaxSessionLimit×hosts > 0.9", severity: "Sev 2 (Warning)", enabled: true },
    { name: "AVD: Session host CPU sustained > 90%", condition: "% Processor Time avg over 15m > 90", severity: "Sev 2 (Warning)", enabled: true },
    { name: "AVD: FSLogix profile container failed to mount", condition: 'WVDErrors where ResourceType=Diagnostics, Error contains "FSLogix"', severity: "Sev 1 (Critical)", enabled: true },
    { name: "AVD: Host pool agent unhealthy", condition: 'WVDAgentHealthStatus where Status != "Healthy"', severity: "Sev 1 (Critical)", enabled: true },
    { name: "AVD: Connection error rate > 5%", condition: "WVDConnectionEvents error / total > 0.05", severity: "Sev 2 (Warning)", enabled: true },
    { name: "AVD: User input delay p95 > 200 ms", condition: 'Perf, where CounterName="User Input Delay per Session"', severity: "Sev 3 (Informational)", enabled: false },
  ];

  return (
    <>
      <h3>Alert rules for AVD (configured in Azure Monitor)</h3>
      <DataTable columns={["Name", "Condition", "Severity", "State"]}>
        {rules.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{r.condition}</td>
            <td>{r.severity}</td>
            <td>
              <span className={`${styles.badge} ${r.enabled ? styles.badgeRunning : styles.badgeStopped}`}>
                {r.enabled ? "Enabled" : "Disabled (noisy)"}
              </span>
            </td>
          </tr>
        ))}
      </DataTable>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        + Add alert rule
      </button>
    </>
  );
}
