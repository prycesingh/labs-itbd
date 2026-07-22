"use client";

// Home dashboard — ported from defender-portal.js renderHome(). Stat tiles are
// genuine derived numbers computed via .filter()/.length over live state
// (incidents/alerts/devices/identities/secureScore), not hardcoded, matching
// the source's live-data convention. Recent incidents table mirrors the
// source's recentIncidentsTable() (top 6 incidents); "what needs attention"
// tiles mirror the source's tile grid and navigate via onNavigate.

import type { DefenderState } from "@/lib/labs/simulators/defender/types";
import type { DefenderPage } from "./defender-shell";
import { DataTable, SeverityBadge, StatRow, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)} sec ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
}

type RecentIncidentRow = DefenderState["incidents"][number];

export function HomePage({ state, onNavigate }: { state: DefenderState; onNavigate: (page: DefenderPage) => void }) {
  // ----- Live derived stats (real .filter()/.length over state, not fake numbers) -----
  const activeIncidents = state.incidents.filter((i) => i.status !== "Resolved").length;
  const highSev = state.incidents.filter((i) => i.severity === "High" && i.status !== "Resolved").length;
  const newAlerts = state.alerts.filter((a) => a.status === "New").length;
  const devicesAtRisk = state.devices.filter((d) => d.riskLevel === "High" || d.riskLevel === "Very High").length;
  const usersAtRisk = state.identities.filter((u) => u.signInRisk === "High" || u.signInRisk === "Medium").length;

  const recentIncidents = state.incidents.slice(0, 6);

  const incidentColumns: DataTableColumn<RecentIncidentRow>[] = [
    { key: "severity", header: "Severity", render: (i) => <SeverityBadge severity={i.severity} /> },
    { key: "title", header: "Title", render: (i) => <span className={styles.rowLink}>{i.title}</span> },
    { key: "status", header: "Status", render: (i) => i.status },
    { key: "alerts", header: "Active alerts", render: (i) => `${i.activeAlerts} / ${i.totalAlerts}` },
    { key: "lastActivity", header: "Last activity", render: (i) => timeAgo(i.lastActivity) },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
      </div>
      <div className={styles.pageH1}>Microsoft Defender</div>
      <div className={styles.pageSub}>
        {state.tenant.name} &middot; Welcome back, Ankit
      </div>

      <StatRow
        stats={[
          { label: "Active incidents", value: activeIncidents },
          { label: "High severity", value: highSev, trend: "down" },
          { label: "New alerts", value: newAlerts },
          { label: "Devices at risk", value: devicesAtRisk },
          { label: "Users at risk", value: usersAtRisk },
          { label: "Secure score", value: `${state.secureScore.percentage}%` },
        ]}
      />

      <div className={styles.h2}>What needs attention</div>
      <div className={styles.tileGrid}>
        <div className={styles.tile} onClick={() => onNavigate("incidents")}>
          <div className={styles.tileTitle}>Active high-severity incidents</div>
          <div className={styles.tileSub}>Review and respond to top threats</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("endpoints-devices")}>
          <div className={styles.tileTitle}>Devices flagged as high risk</div>
          <div className={styles.tileSub}>Take action on risky endpoints</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("identities")}>
          <div className={styles.tileTitle}>Users with risky sign-in</div>
          <div className={styles.tileSub}>Investigate suspicious identity activity</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("threat-analytics")}>
          <div className={styles.tileTitle}>Threat analytics</div>
          <div className={styles.tileSub}>Track latest threat campaigns and CVEs</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("secure-score")}>
          <div className={styles.tileTitle}>Secure score recommendations</div>
          <div className={styles.tileSub}>Improve your score by {100 - state.secureScore.percentage} points</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("email-submissions")}>
          <div className={styles.tileTitle}>Submissions queue</div>
          <div className={styles.tileSub}>Review email reported by users</div>
        </div>
      </div>

      <div className={styles.h2}>Recent incidents</div>
      <DataTable columns={incidentColumns} rows={recentIncidents} getRowKey={(i) => i.id} onRowClick={() => onNavigate("incidents")} emptyMessage="No incidents." />

      <div className={styles.h2}>Recent activity</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.activityLog.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#605e5c", padding: 20 }}>
                  No recent activity.
                </td>
              </tr>
            ) : (
              state.activityLog.slice(0, 8).map((entry, i) => (
                <tr key={`${entry.timestamp}-${i}`}>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                  <td>{entry.actor}</td>
                  <td>{entry.action}</td>
                  <td>{entry.target}</td>
                  <td>{entry.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
