"use client";

import { toast } from "sonner";

import type { M365State } from "@/lib/labs/simulators/m365/types";
import type { M365Page } from "./m365-shell";
import { StatRow } from "./m365-ui";
import styles from "./m365-console.module.css";

const LAUNCH_TILES: { page: M365Page | null; label: string; sq: string; toast?: string }[] = [
  { page: "exchange", label: "Exchange", sq: "sqExchange" },
  { page: "sharepoint", label: "SharePoint", sq: "sqSharepoint" },
  { page: "teams", label: "Teams", sq: "sqTeams" },
  { page: null, label: "Defender", sq: "sqDefender", toast: "Defender admin center opens in new window in real M365 — sim only." },
  { page: null, label: "Compliance", sq: "sqCompliance", toast: "Compliance admin center opens in new window in real M365 — sim only." },
  { page: null, label: "Entra ID", sq: "sqEntra", toast: "Entra ID admin center opens in new window in real M365 — sim only." },
];

export function HomePage({ state, onNavigate }: { state: M365State; onNavigate: (page: M365Page) => void }) {
  const licensesAssigned = state.licenses.reduce((sum, l) => sum + state.users.filter((u) => u.licenses.includes(l.sku)).length, 0);
  const licensesTotal = state.licenses.reduce((sum, l) => sum + l.purchased, 0);

  return (
    <div>
      <h1 className={styles.pageH1}>Home</h1>
      <p className={styles.pageSub}>{state.tenant.name} — {state.tenant.domain}</p>

      <StatRow
        stats={[
          { label: "Total users", value: state.users.length },
          { label: "Active users", value: state.users.filter((u) => u.accountEnabled).length },
          { label: "Groups", value: state.groups.length },
          { label: "Licenses assigned", value: `${licensesAssigned} / ${licensesTotal}` },
          { label: "Teams", value: state.teams.length },
          { label: "SharePoint sites", value: state.sharepointSites.length },
        ]}
      />

      <div className={styles.h2}>Your organization</div>
      <div className={styles.cardGrid}>
        <div className={styles.tile} onClick={() => onNavigate("users-active")}>
          <div className={styles.tileTitle}>Add users</div>
          <div className={styles.tileSub}>Create new user accounts and assign licenses.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("licenses")}>
          <div className={styles.tileTitle}>Buy licenses</div>
          <div className={styles.tileSub}>Purchase additional Microsoft 365 subscriptions.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("teams")}>
          <div className={styles.tileTitle}>Create a team</div>
          <div className={styles.tileSub}>Set up a new Microsoft Teams workspace.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("sharepoint")}>
          <div className={styles.tileTitle}>Create SharePoint site</div>
          <div className={styles.tileSub}>Start a new team or communication site.</div>
        </div>
      </div>

      <div className={styles.h2}>Admin centers</div>
      <div className={styles.launchRow}>
        {LAUNCH_TILES.map((t) => (
          <div
            key={t.label}
            className={styles.launchTile}
            onClick={() => {
              if (t.page) onNavigate(t.page);
              else if (t.toast) toast.info(t.toast);
            }}
          >
            <span className={`${styles.sq} ${styles[t.sq as keyof typeof styles] ?? ""}`}>{t.label.slice(0, 2).toUpperCase()}</span>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.h2}>Recent activity</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {state.activityLog.length ? (
              state.activityLog.slice(0, 8).map((a, i) => (
                <tr key={i}>
                  <td>{new Date(a.time).toLocaleString()}</td>
                  <td>{a.actor}</td>
                  <td>{a.action}</td>
                  <td>{a.target}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className={styles.center}>
                  No recent activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
