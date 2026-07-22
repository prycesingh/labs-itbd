"use client";

import { useState } from "react";

import type { IntuneState } from "@/lib/labs/simulators/intune/types";
import { Pill } from "./intune-ui";
import styles from "./intune-console.module.css";

const TABS = ["Update rings", "Expedited updates", "Driver updates", "M365 Apps channels"] as const;
type Tab = (typeof TABS)[number];

const RINGS = [
  { name: "Ring 0 - Canary (IT pilot)", assigned: "WUfB-Canary (24 devices)", channel: "Windows Insider Beta", qDefer: 0, fDefer: 0 },
  { name: "Ring 1 - Pilot (IT + power users)", assigned: "WUfB-Pilot (180 devices)", channel: "Semi-Annual Channel (GA)", qDefer: 0, fDefer: 14 },
  { name: "Ring 2 - Broad rollout (corporate)", assigned: "All-Corp-Win (12,420 devices)", channel: "Semi-Annual Channel (GA)", qDefer: 7, fDefer: 60 },
  { name: "Ring 3 - Production (regulated)", assigned: "Finance + Healthcare (3,200 devices)", channel: "Semi-Annual Channel (GA)", qDefer: 14, fDefer: 180 },
];

const EXPEDITED = [
  { name: "KB5034441 - Jan 2024 OOB (BitLocker recovery)", target: "All-Corp-Win", deadline: "24 h", status: "Completed" },
  { name: "KB5036896 - CVE-2024-30040 OLE RCE expedited", target: "All-Corp-Win", deadline: "12 h", status: "Completed" },
  { name: "KB5044033 - May 2026 emergency rollup", target: "Pilot + Broad", deadline: "8 h", status: "In progress" },
];

const DRIVER_POLICIES = [
  { name: "Driver - Dell Latitude fleet", approval: "Manual", pending: 12, approved: 87 },
  { name: "Driver - Lenovo ThinkPad fleet", approval: "Automatic", pending: 0, approved: 142 },
  { name: "Firmware - Surface fleet", approval: "Manual", pending: 3, approved: 21 },
];

const M365_CHANNELS = [
  { channel: "Current Channel", cadence: "Monthly (rolling)", defaultFor: "Knowledge workers, latest features" },
  { channel: "Monthly Enterprise Channel", cadence: "2nd Tuesday", defaultFor: "Mainstream corporate baseline" },
  { channel: "Semi-Annual Enterprise Channel", cadence: "Jan + Jul", defaultFor: "Regulated industries" },
  { channel: "Beta Channel", cadence: "Weekly", defaultFor: "IT pilots only" },
];

export function UpdateRingsPage({ state }: { state: IntuneState }) {
  const [tab, setTab] = useState<Tab>("Update rings");
  const windowsDevices = state.devices.filter((d) => d.platform === "Windows").length;

  return (
    <div>
      <h1 className={styles.pageH1}>Windows Update for Business — rings</h1>
      <p className={styles.pageSub}>Deployment rings, expedited updates, driver updates and M365 Apps channels across {windowsDevices} Windows device(s).</p>

      <div className={styles.subtabs}>
        {TABS.map((t) => (
          <button key={t} type="button" className={`${styles.subtab} ${tab === t ? styles.subtabActive : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Update rings" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ring</th>
                <th>Assignment</th>
                <th>Channel</th>
                <th>Quality defer (d)</th>
                <th>Feature defer (d)</th>
              </tr>
            </thead>
            <tbody>
              {RINGS.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.assigned}</td>
                  <td>{r.channel}</td>
                  <td>{r.qDefer}</td>
                  <td>{r.fDefer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Expedited updates" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Update</th>
                <th>Target</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {EXPEDITED.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{e.target}</td>
                  <td>{e.deadline}</td>
                  <td>
                    <Pill tone={e.status === "Completed" ? "ok" : "warn"}>{e.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Driver updates" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Policy</th>
                <th>Approval mode</th>
                <th>Pending</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {DRIVER_POLICIES.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>{d.approval}</td>
                  <td>{d.pending}</td>
                  <td>{d.approved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "M365 Apps channels" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Cadence</th>
                <th>Default for</th>
              </tr>
            </thead>
            <tbody>
              {M365_CHANNELS.map((c) => (
                <tr key={c.channel}>
                  <td>{c.channel}</td>
                  <td>{c.cadence}</td>
                  <td>{c.defaultFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
