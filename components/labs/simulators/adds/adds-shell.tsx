"use client";

import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import type { AddsState } from "@/lib/labs/simulators/adds/types";
import styles from "./adds-console.module.css";

export type AddsTool =
  | "server-mgr"
  | "aduc"
  | "gpo"
  | "dns"
  | "fsmo"
  | "replication"
  | "sites"
  | "topology"
  | "nps"
  | "extra"
  | "eventviewer"
  | "troubleshoot"
  | "recycle-bin"
  | "pso"
  | "adsi"
  | "adcs"
  | "adfs"
  | "trusts"
  | "kerberos"
  | "aadconnect"
  | "dhcp"
  | "services"
  | "taskscheduler"
  | "firewall"
  | "bitlocker"
  | "rras";

export const TOOL_TITLES: Record<AddsTool, string> = {
  "server-mgr": "Server Manager",
  aduc: "Active Directory Users and Computers",
  gpo: "Group Policy Management",
  dns: "DNS Manager",
  fsmo: "FSMO Role Management",
  replication: "Active Directory Replication",
  sites: "Active Directory Sites and Services",
  topology: "Replication Topology (Architect)",
  nps: "Network Policy Server (RADIUS)",
  extra: "LAPS / ADCS / DFS-N / PSO / Recycle Bin",
  eventviewer: "Event Viewer",
  troubleshoot: "AD Health Check",
  "recycle-bin": "Active Directory Recycle Bin",
  pso: "Fine-Grained Password Policies",
  adsi: "ADSI Edit",
  adcs: "Active Directory Certificate Services",
  adfs: "Active Directory Federation Services",
  trusts: "Active Directory Domains and Trusts",
  kerberos: "Kerberos / SPN / Delegation",
  aadconnect: "Microsoft Entra Connect",
  dhcp: "DHCP Manager",
  services: "Services (Local)",
  taskscheduler: "Task Scheduler",
  firewall: "Windows Firewall with Advanced Security",
  bitlocker: "BitLocker Recovery Key Vault",
  rras: "Routing and Remote Access",
};

const TOOL_ICONS: Record<AddsTool, string> = {
  "server-mgr": "SM",
  aduc: "AU",
  gpo: "GP",
  dns: "DN",
  fsmo: "FS",
  replication: "RP",
  sites: "SS",
  topology: "TP",
  nps: "NP",
  extra: "EX",
  eventviewer: "EV",
  troubleshoot: "HC",
  "recycle-bin": "RB",
  pso: "PS",
  adsi: "AE",
  adcs: "CA",
  adfs: "FD",
  trusts: "TR",
  kerberos: "KB",
  aadconnect: "AC",
  dhcp: "DH",
  services: "SV",
  taskscheduler: "TS",
  firewall: "FW",
  bitlocker: "BL",
  rras: "RR",
};

const QUICK_SWITCH: AddsTool[] = ["server-mgr", "aduc", "gpo", "dns", "fsmo", "replication", "sites", "topology", "nps", "eventviewer", "troubleshoot"];

const ALL_TOOLS: AddsTool[] = [
  "server-mgr",
  "aduc",
  "gpo",
  "dns",
  "fsmo",
  "replication",
  "sites",
  "topology",
  "nps",
  "extra",
  "eventviewer",
  "troubleshoot",
  "recycle-bin",
  "pso",
  "adsi",
  "adcs",
  "adfs",
  "trusts",
  "kerberos",
  "aadconnect",
  "dhcp",
  "services",
  "taskscheduler",
  "firewall",
  "bitlocker",
  "rras",
];

export function AddsShell({
  current,
  onSwitch,
  domain,
  domainControllers,
  userCount,
  groupCount,
  computerCount,
  onExport,
  children,
}: {
  current: AddsTool;
  onSwitch: (tool: AddsTool) => void;
  domain: AddsState["domain"];
  domainControllers: AddsState["domainControllers"];
  userCount: number;
  groupCount: number;
  computerCount: number;
  onExport: () => void;
  children: ReactNode;
}) {
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  return (
    <div className={styles.consoleRoot}>
      <div className={styles.winTitle}>
        <span className={styles.wtIcon}>{TOOL_ICONS[current]}</span>
        <span className={styles.wtTitleText}>
          {TOOL_TITLES[current]} - [{domain.fqdn}]
        </span>
        <div className={styles.wtControls}>
          <button type="button" title="Minimize" onClick={() => toast.info("Minimize is decorative in this simulator.")}>
            _
          </button>
          <button type="button" title="Maximize" onClick={() => toast.info("Maximize is decorative in this simulator.")}>
            ▢
          </button>
        </div>
      </div>

      <div className={styles.menuBar}>
        {["File", "Action", "View", "Help"].map((m) => (
          <span key={m} className={styles.menuItem} onClick={() => toast.info(`${m} menu isn't wired up in this simulator.`)}>
            {m}
          </span>
        ))}
      </div>

      <div className={styles.toolbar}>
        <button type="button" disabled title="Back">
          ←
        </button>
        <button type="button" disabled title="Forward">
          →
        </button>
        <button type="button" disabled title="Up">
          ↑
        </button>
        <span className={styles.toolbarSep} />
        <button type="button" title="Refresh" onClick={() => toast.success("Refreshed")}>
          ⟲ Refresh
        </button>
        <button type="button" title="Export list" onClick={onExport}>
          ⬇ Export
        </button>
        <span className={styles.toolbarSep} />
        {QUICK_SWITCH.map((tool) => (
          <button key={tool} type="button" title={TOOL_TITLES[tool]} onClick={() => onSwitch(tool)}>
            {TOOL_ICONS[tool]}
          </button>
        ))}
        <span className={styles.toolbarSep} />
        <button type="button" onClick={() => setToolsMenuOpen((v) => !v)}>
          Tools ▾
        </button>
        <button type="button" title="Help" onClick={() => toast.info("This is a training simulator modeled on Windows Server admin consoles.")}>
          Help
        </button>

        {toolsMenuOpen ? (
          <div className={styles.toolsMenu} onMouseLeave={() => setToolsMenuOpen(false)}>
            {ALL_TOOLS.map((tool) => (
              <div
                key={tool}
                className={styles.toolItem}
                onClick={() => {
                  onSwitch(tool);
                  setToolsMenuOpen(false);
                }}
              >
                {TOOL_TITLES[tool]}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.body}>{children}</div>

      <div className={styles.statusBar}>
        <div className={styles.sbSection}>{domain.fqdn}</div>
        <div className={styles.sbSection}>Forest: {domain.forestFunctionalLevel}</div>
        <div className={styles.sbSection}>{domainControllers.length} DCs</div>
        <div className={styles.sbSection}>{userCount} users</div>
        <div className={styles.sbSection}>{groupCount} groups</div>
        <div className={styles.sbSection}>{computerCount} computers</div>
      </div>
    </div>
  );
}
