"use client";

import type { IntuneState } from "@/lib/labs/simulators/intune/types";
import type { IntunePage } from "./intune-shell";
import { Pill, StatRow } from "./intune-ui";
import styles from "./intune-console.module.css";

export function HomePage({ state, onNavigate }: { state: IntuneState; onNavigate: (page: IntunePage) => void }) {
  const compliant = state.devices.filter((d) => d.compliance === "Compliant").length;
  const notCompliant = state.devices.filter((d) => d.compliance === "Not compliant").length;
  const grace = state.devices.filter((d) => d.compliance === "In grace period").length;

  return (
    <div>
      <h1 className={styles.pageH1}>Home</h1>
      <p className={styles.pageSub}>{state.tenant.name} — {state.tenant.domain}</p>

      <StatRow
        stats={[
          { label: "Devices", value: state.devices.length },
          { label: "Compliant", value: compliant },
          { label: "Not compliant", value: notCompliant },
          { label: "In grace period", value: grace },
          { label: "Apps", value: state.apps.length },
          { label: "Compliance policies", value: state.compliancePolicies.length },
        ]}
      />

      <div className={styles.h2}>Quick actions</div>
      <div className={styles.cardGrid}>
        <div className={styles.tile} onClick={() => onNavigate("devices-all")}>
          <div className={styles.tileTitle}>Manage devices</div>
          <div className={styles.tileSub}>View enrolled devices, run remote actions, check compliance.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("compliance-policies")}>
          <div className={styles.tileTitle}>Compliance policies</div>
          <div className={styles.tileSub}>Create and manage device compliance requirements.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("config-profiles")}>
          <div className={styles.tileTitle}>Configuration profiles</div>
          <div className={styles.tileSub}>Deploy settings across device platforms.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("apps-all")}>
          <div className={styles.tileTitle}>Apps</div>
          <div className={styles.tileSub}>Publish and assign applications.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("conditional-access")}>
          <div className={styles.tileTitle}>Conditional Access</div>
          <div className={styles.tileSub}>Control access based on device and sign-in risk.</div>
        </div>
        <div className={styles.tile} onClick={() => onNavigate("autopilot")}>
          <div className={styles.tileTitle}>Windows Autopilot</div>
          <div className={styles.tileSub}>Zero-touch Windows device provisioning.</div>
        </div>
      </div>

      <div className={styles.h2}>Device compliance by platform</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Devices</th>
              <th>Compliant</th>
              <th>Not compliant</th>
            </tr>
          </thead>
          <tbody>
            {["Windows", "iOS", "iPadOS", "macOS", "Android", "Linux"].map((p) => {
              const devs = state.devices.filter((d) => d.platform === p);
              if (!devs.length) return null;
              return (
                <tr key={p}>
                  <td>{p}</td>
                  <td>{devs.length}</td>
                  <td>
                    <Pill tone="ok">{devs.filter((d) => d.compliance === "Compliant").length}</Pill>
                  </td>
                  <td>
                    <Pill tone="err">{devs.filter((d) => d.compliance === "Not compliant").length}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.h2}>Recent activity</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {state.activityLog.length ? (
              state.activityLog.slice(0, 8).map((a, i) => (
                <tr key={i}>
                  <td>{new Date(a.time).toLocaleString()}</td>
                  <td>{a.action}</td>
                  <td>{a.target}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className={styles.center}>
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
