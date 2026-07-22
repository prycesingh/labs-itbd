"use client";

import { useState } from "react";

import type { IntuneState } from "@/lib/labs/simulators/intune/types";
import { Pill } from "./intune-ui";
import styles from "./intune-console.module.css";

const TABS = ["Security baselines", "Antivirus", "Disk encryption", "Firewall", "Attack surface reduction", "Account protection"] as const;
type Tab = (typeof TABS)[number];

const BASELINES = [
  { name: "Microsoft Defender for Endpoint Baseline", version: "6.2025.10.A", state: "Deployed", assigned: 247 },
  { name: "Windows 365 Baseline", version: "2025.10.A", state: "Deployed", assigned: 48 },
  { name: "Microsoft Edge Baseline", version: "128", state: "Not deployed", assigned: 0 },
  { name: "Windows Security Baseline", version: "24H2-October-2025", state: "Deployed", assigned: 195 },
];

const ANTIVIRUS_POLICIES = [
  { name: "AV-Standard-Windows", platform: "Windows", assigned: 195, compliance: "191 / 195" },
  { name: "AV-Strict-Servers", platform: "Windows", assigned: 8, compliance: "8 / 8" },
  { name: "AV-macOS", platform: "macOS", assigned: 12, compliance: "10 / 12" },
];

const BITLOCKER = {
  policy: { name: "BitLocker-Standard", assigned: 195, compliance: "187 / 195 (8 pending TPM)" },
  settings: [
    ["Operating system drive", "XTS-AES 256-bit, TPM + PIN required"],
    ["Fixed data drives", "XTS-AES 256-bit, auto-unlock"],
    ["Removable drives (BitLocker To Go)", "AES 128 when explicitly enabled"],
    ["Recovery key backup", "Microsoft Entra ID + AD DS"],
    ["Silent enablement", "Enabled"],
  ],
};

const FIREWALL_RULES = [
  { name: "Allow inbound RDP from MgmtSubnet", direction: "Inbound", protocol: "TCP", port: "3389", action: "Allow" },
  { name: "Block SMB from internet", direction: "Inbound", protocol: "TCP", port: "445", action: "Block" },
  { name: "Allow outbound DNS", direction: "Outbound", protocol: "UDP", port: "53", action: "Allow" },
];

const ASR_RULES: { name: string; state: "Block" | "Audit" }[] = [
  { name: "Block executable content from email client and webmail", state: "Block" },
  { name: "Block all Office applications from creating child processes", state: "Block" },
  { name: "Block Office applications from creating executable content", state: "Block" },
  { name: "Block Office applications from injecting code into other processes", state: "Block" },
  { name: "Block JavaScript or VBScript from launching downloaded executable", state: "Block" },
  { name: "Block execution of potentially obfuscated scripts", state: "Block" },
  { name: "Block Win32 API calls from Office macros", state: "Block" },
  { name: "Block executables unless they meet a prevalence/age/trusted list", state: "Audit" },
  { name: "Use advanced protection against ransomware", state: "Block" },
  { name: "Block credential stealing from LSASS", state: "Block" },
];

const HELLO_SETTINGS = [
  ["Use a hardware security device (TPM)", "Required"],
  ["Minimum PIN length", "8"],
  ["Maximum PIN length", "127"],
  ["PIN expiration", "180 days"],
  ["PIN history", "5 (prevent reuse)"],
  ["Enable enhanced anti-spoofing", "Yes (camera with PAD)"],
  ["Use biometrics", "Yes (fingerprint + face)"],
];

export function EndpointSecurityPage({ state }: { state: IntuneState }) {
  const [tab, setTab] = useState<Tab>("Security baselines");
  const windowsDevices = state.devices.filter((d) => d.platform === "Windows").length;

  return (
    <div>
      <h1 className={styles.pageH1}>Endpoint security</h1>
      <p className={styles.pageSub}>Security baselines, antivirus, disk encryption, firewall, attack surface reduction and account protection for {windowsDevices} Windows device(s).</p>

      <div className={styles.subtabs}>
        {TABS.map((t) => (
          <button key={t} type="button" className={`${styles.subtab} ${tab === t ? styles.subtabActive : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Security baselines" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>State</th>
                <th>Assignments</th>
              </tr>
            </thead>
            <tbody>
              {BASELINES.map((b) => (
                <tr key={b.name}>
                  <td>{b.name}</td>
                  <td>{b.version}</td>
                  <td>
                    <Pill tone={b.state === "Deployed" ? "ok" : "muted"}>{b.state}</Pill>
                  </td>
                  <td>{b.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Antivirus" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Platform</th>
                <th>Assignments</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {ANTIVIRUS_POLICIES.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.platform}</td>
                  <td>{p.assigned}</td>
                  <td>{p.compliance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Disk encryption" && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Assignments</th>
                  <th>Compliance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{BITLOCKER.policy.name}</td>
                  <td>{BITLOCKER.policy.assigned}</td>
                  <td>{BITLOCKER.policy.compliance}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.h3}>Encryption settings</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {BITLOCKER.settings.map(([k, v]) => (
                  <tr key={k}>
                    <td className={styles.muted}>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "Firewall" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Direction</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {FIREWALL_RULES.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.direction}</td>
                  <td>{r.protocol}</td>
                  <td>{r.port}</td>
                  <td>
                    <Pill tone={r.action === "Allow" ? "ok" : "err"}>{r.action}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Attack surface reduction" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rule</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {ASR_RULES.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>
                    <Pill tone={r.state === "Block" ? "ok" : "warn"}>{r.state}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Account protection" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              {HELLO_SETTINGS.map(([k, v]) => (
                <tr key={k}>
                  <td className={styles.muted}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
