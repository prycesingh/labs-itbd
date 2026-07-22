"use client";

import type { AvdState } from "@/lib/labs/simulators/avd/types";

import styles from "./avd-console.module.css";
import { PropPair } from "./avd-ui";
import type { AvdPage } from "./avd-shell";

export function HomePage({ state, onNavigate }: { state: AvdState; onNavigate: (page: AvdPage) => void }) {
  const totalHosts = state.sessionHosts.length;
  const availableHosts = state.sessionHosts.filter((h) => h.status === "Available").length;
  const totalSessions = state.sessionHosts.reduce((sum, h) => sum + h.sessions, 0);
  const enabledPlans = state.scalingPlans.filter((p) => p.enabled).length;

  const tiles: { label: string; value: string | number; page: AvdPage }[] = [
    { label: "Host pools", value: state.hostPools.length, page: "host-pools" },
    { label: "Session hosts", value: `${availableHosts}/${totalHosts} available`, page: "session-hosts" },
    { label: "Active sessions", value: totalSessions, page: "session-hosts" },
    { label: "Application groups", value: state.applicationGroups.length, page: "application-groups" },
    { label: "Workspaces", value: state.workspaces.length, page: "workspaces" },
    { label: "Scaling plans", value: `${enabledPlans}/${state.scalingPlans.length} enabled`, page: "scaling-plans" },
    { label: "MSIX packages", value: state.msixPackages.length, page: "msix-packages" },
    { label: "FSLogix configs", value: state.fslogixConfigs.length, page: "fslogix" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Azure Virtual Desktop</h1>
      <p className={styles.help} style={{ marginBottom: 20 }}>
        Subscription: {state.subscription.name} ({state.subscription.tenantName})
      </p>

      <div className={styles.sectionCard}>
        <h3>Overview</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {tiles.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => onNavigate(t.page)}
              className={styles.card}
              style={{ padding: 16, textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{t.value}</div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3>Recent activity</h3>
        {state.activityLog.length === 0 ? (
          <p className={styles.help}>No activity yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Operation</th>
                <th>Resource</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.activityLog.slice(0, 8).map((entry, i) => (
                <tr key={i}>
                  <td>{new Date(entry.time).toLocaleString()}</td>
                  <td>{entry.operation}</td>
                  <td>{entry.resource}</td>
                  <td>{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.sectionCard}>
        <h3>Subscription details</h3>
        <PropPair label="Subscription ID" value={state.subscription.id} />
        <PropPair label="Tenant" value={state.subscription.tenantName} />
        <PropPair label="Tenant ID" value={state.subscription.tenantId} />
      </div>
    </div>
  );
}
