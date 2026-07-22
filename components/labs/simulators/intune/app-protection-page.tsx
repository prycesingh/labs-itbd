"use client";

import { useState } from "react";

import type { IntuneState } from "@/lib/labs/simulators/intune/types";
import { Pill } from "./intune-ui";
import styles from "./intune-console.module.css";

type MamPolicy = {
  id: string;
  name: string;
  platform: string;
  apps: number;
  assigned: string;
  dataRelocation: { label: string; value: string }[];
  access: { label: string; value: string }[];
  conditionalLaunch: { condition: string; action: string }[];
};

const POLICIES: MamPolicy[] = [
  {
    id: "app-ios",
    name: "M365 apps - iOS BYOD",
    platform: "iOS / iPadOS",
    apps: 10,
    assigned: "All BYOD Users (8,420 users)",
    dataRelocation: [
      { label: "Backup org data to iTunes/iCloud", value: "Block" },
      { label: "Send org data to other apps", value: "Policy managed apps with paste in" },
      { label: "Save copies of org data", value: "Block" },
      { label: "Save-as allowed services", value: "OneDrive for Business, SharePoint" },
      { label: "Restrict cut, copy, paste", value: "Policy managed apps with paste in" },
      { label: "Print org data", value: "Block" },
    ],
    access: [
      { label: "PIN required", value: "Yes" },
      { label: "PIN type", value: "4-digit numeric or biometric" },
      { label: "Biometric", value: "Allowed (Face ID / Touch ID)" },
      { label: "PIN reset interval", value: "90 days" },
    ],
    conditionalLaunch: [
      { condition: "Max PIN attempts: 5", action: "Reset PIN" },
      { condition: "Offline grace period: 720 min", action: "Block access" },
      { condition: "Offline grace period: 90 days", action: "Wipe data" },
      { condition: "Jailbroken device detected", action: "Block access" },
      { condition: "Min OS version not met (iOS 16.0)", action: "Block access" },
      { condition: "Device threat level: Medium", action: "Wipe data" },
    ],
  },
  {
    id: "app-android",
    name: "M365 apps - Android BYOD",
    platform: "Android (Work Profile + Personal)",
    apps: 11,
    assigned: "All BYOD Users (8,420 users)",
    dataRelocation: [
      { label: "Backup org data", value: "Block" },
      { label: "Send org data to other apps", value: "Policy managed apps with paste in" },
      { label: "Save copies of org data", value: "Block" },
      { label: "Save-as allowed services", value: "OneDrive for Business, SharePoint" },
      { label: "Screen capture", value: "Block" },
      { label: "Print org data", value: "Block" },
    ],
    access: [
      { label: "PIN required", value: "Yes" },
      { label: "PIN type", value: "4-digit numeric or biometric" },
      { label: "Biometric", value: "Allowed (fingerprint, face)" },
      { label: "PIN reset interval", value: "90 days" },
    ],
    conditionalLaunch: [
      { condition: "Max PIN attempts: 5", action: "Reset PIN" },
      { condition: "Offline grace period: 720 min", action: "Block access" },
      { condition: "Offline grace period (wipe): 90 days", action: "Wipe data" },
      { condition: "Rooted device detected", action: "Block access" },
      { condition: "Min OS version not met (Android 11)", action: "Block access" },
      { condition: "Device threat level: Medium", action: "Wipe data" },
    ],
  },
  {
    id: "app-windows",
    name: "Edge for Business - Windows BYOD",
    platform: "Windows",
    apps: 1,
    assigned: "BYOD Windows users (1,240 users)",
    dataRelocation: [
      { label: "Save-as allowed services", value: "OneDrive for Business, SharePoint (local storage blocked)" },
      { label: "Print org data", value: "Block" },
      { label: "Restrict cut, copy, paste", value: "Policy managed apps only" },
      { label: "Screen capture", value: "Block" },
    ],
    access: [{ label: "PIN required", value: "Not configured (browser-based)" }],
    conditionalLaunch: [
      { condition: "Min OS version not met (Windows 10 21H1)", action: "Block access" },
      { condition: "Min Edge version not met (120.0.0.0)", action: "Block access" },
    ],
  },
];

function launchTone(action: string): "err" | "warn" | "info" {
  if (action === "Block access" || action === "Wipe data") return "err";
  if (action === "Reset PIN") return "warn";
  return "info";
}

export function AppProtectionPage({ state }: { state: IntuneState }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = POLICIES.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <h1 className={styles.pageH1}>App protection policies</h1>
      <p className={styles.pageSub}>Protect corporate data inside managed apps on BYOD and unenrolled devices (MAM-WE). {state.apps.length} app(s) in catalog.</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Platform</th>
              <th>Apps</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {POLICIES.map((p) => (
              <tr key={p.id} className={selectedId === p.id ? styles.tableRowSelected : ""} onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>
                <td className={styles.rowLink}>{p.name}</td>
                <td>{p.platform}</td>
                <td>{p.apps}</td>
                <td>{p.assigned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>{selected.name}</div>

          <div className={styles.h3}>Data relocation</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {selected.dataRelocation.map((r) => (
                  <tr key={r.label}>
                    <td className={styles.muted}>{r.label}</td>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.h3}>Access requirements</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {selected.access.map((r) => (
                  <tr key={r.label}>
                    <td className={styles.muted}>{r.label}</td>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.h3}>Conditional launch</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Condition</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {selected.conditionalLaunch.map((c) => (
                  <tr key={c.condition}>
                    <td>{c.condition}</td>
                    <td>
                      <Pill tone={launchTone(c.action)}>{c.action}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>Select a policy to view data relocation, access requirements and conditional launch rules.</div>
      )}
    </div>
  );
}
