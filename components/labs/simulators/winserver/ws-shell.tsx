"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WsServer } from "@/lib/labs/simulators/winserver/types";
import styles from "./winserver-console.module.css";

export type WsTool = "dashboard" | "hyperv" | "fileshare" | "dhcp" | "wsus" | "wac" | "adcs" | "failover" | "rras" | "printserver";

export const TOOL_TITLES: Record<WsTool, string> = {
  dashboard: "Server Manager",
  hyperv: "Hyper-V Manager",
  fileshare: "File and Storage Services",
  dhcp: "DHCP Manager",
  wsus: "Windows Server Update Services",
  wac: "Windows Admin Center",
  adcs: "Certification Authority",
  failover: "Failover Cluster Manager",
  rras: "Routing and Remote Access",
  printserver: "Print Management",
};

const TOOL_ICONS: Record<WsTool, string> = {
  dashboard: "SM",
  hyperv: "HV",
  fileshare: "FS",
  dhcp: "DH",
  wsus: "WU",
  wac: "WAC",
  adcs: "CA",
  failover: "FC",
  rras: "RR",
  printserver: "PM",
};

const ALL_TOOLS: WsTool[] = ["dashboard", "hyperv", "fileshare", "dhcp", "wsus", "wac", "adcs", "failover", "rras", "printserver"];

export function WsShell({
  current,
  onSwitch,
  server,
  vmCount,
  shareCount,
  scopeCount,
  updateCount,
  onExport,
  children,
}: {
  current: WsTool;
  onSwitch: (tool: WsTool) => void;
  server: WsServer;
  vmCount: number;
  shareCount: number;
  scopeCount: number;
  updateCount: number;
  onExport: () => void;
  children: React.ReactNode;
}) {
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  return (
    <div className={styles.consoleRoot}>
      <div className={styles.winTitle}>
        <span className={styles.wtIcon}>{TOOL_ICONS[current]}</span>
        <span className={styles.wtTitleText}>
          {TOOL_TITLES[current]} - {server.name}
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
        <span className={styles.toolbarSep} />
        <button type="button" title="Refresh" onClick={() => toast.success("Refreshed")}>
          ⟲ Refresh
        </button>
        <button type="button" title="Export" onClick={onExport}>
          ⬇ Export
        </button>
        <span className={styles.toolbarSep} />
        {ALL_TOOLS.map((tool) => (
          <button key={tool} type="button" title={TOOL_TITLES[tool]} onClick={() => onSwitch(tool)}>
            {TOOL_ICONS[tool]}
          </button>
        ))}
        <span className={styles.toolbarSep} />
        <button type="button" onClick={() => setToolsMenuOpen((v) => !v)}>
          Tools ▾
        </button>
        <button type="button" title="Help" onClick={() => toast.info("This is a training simulator modeled on Windows Server admin consoles. AD-specific tools (ADUC, DNS, GPO, Event Viewer) live in the Active Directory simulator.")}>
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
            <div className={styles.ctxSep} />
            <div
              className={styles.toolItem}
              onClick={() => {
                toast.info("Active Directory tools (ADUC, DNS, GPO, Event Viewer, Task Scheduler, Services, Firewall) live in the Active Directory simulator.");
                setToolsMenuOpen(false);
              }}
            >
              Active Directory tools…
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.body}>{children}</div>

      <div className={styles.statusBar}>
        <div className={styles.sbSection}>{server.fqdn}</div>
        <div className={styles.sbSection}>{server.domain}</div>
        <div className={styles.sbSection}>{vmCount} VMs</div>
        <div className={styles.sbSection}>{shareCount} shares</div>
        <div className={styles.sbSection}>{scopeCount} DHCP scopes</div>
        <div className={styles.sbSection}>{updateCount} pending updates</div>
      </div>
    </div>
  );
}
