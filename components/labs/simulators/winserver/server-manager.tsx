"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerState } from "@/lib/labs/simulators/winserver/types";
import type { WsTool } from "./ws-shell";
import styles from "./winserver-console.module.css";

type SmSection = "dashboard" | "localServer" | "allServers" | "hyperv" | "fileSrv" | "dhcpRole" | "wsusRole";

const NAV: { key: SmSection; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "localServer", label: "Local Server", icon: "◧" },
  { key: "allServers", label: "All Servers", icon: "◰" },
  { key: "fileSrv", label: "File and Storage Services", icon: "▤" },
  { key: "hyperv", label: "Hyper-V", icon: "⊞" },
  { key: "dhcpRole", label: "DHCP", icon: "◈" },
  { key: "wsusRole", label: "WSUS", icon: "⟳" },
];

const QUICK_TOOLS: { key: WsTool; h: string; d: string }[] = [
  { key: "hyperv", h: "Hyper-V Manager", d: "Create and manage virtual machines, checkpoints, and virtual switches." },
  { key: "fileshare", h: "File and Storage Services", d: "Volumes, disks, storage pools, shares, quotas, and file screening." },
  { key: "dhcp", h: "DHCP Manager", d: "Scopes, leases, reservations, and DHCP policies." },
  { key: "wsus", h: "Windows Server Update Services", d: "Approve updates, manage computer groups, view sync history." },
  { key: "wac", h: "Windows Admin Center", d: "Browser-based unified server management." },
  { key: "failover", h: "Failover Cluster Manager", d: "Cluster roles, nodes, storage, and networks." },
];

const ROLE_ROWS = [
  { name: "File and Storage Services", servers: 1, manage: "Online", events: 0, services: "Running", perf: "Normal", bpa: 0 },
  { name: "Hyper-V", servers: 1, manage: "Online", events: 0, services: "Running", perf: "Normal", bpa: 0 },
  { name: "DHCP Server", servers: 1, manage: "Online", events: 1, services: "Running", perf: "Normal", bpa: 1 },
  { name: "WSUS", servers: 1, manage: "Online", events: 2, services: "Running", perf: "Normal", bpa: 0 },
];

const TOOLS_GROUPS: { title: string; tools: { key: WsTool; name: string; desc: string }[] }[] = [
  {
    title: "Virtualization",
    tools: [
      { key: "hyperv", name: "Hyper-V Manager (virtmgmt.msc)", desc: "VM lifecycle, checkpoints, virtual switches" },
      { key: "failover", name: "Failover Cluster Manager (cluadmin.msc)", desc: "Cluster roles, nodes, quorum, validation" },
    ],
  },
  {
    title: "Storage / Files",
    tools: [
      { key: "fileshare", name: "File and Storage Services", desc: "Volumes, disks, pools, shares, quotas" },
      { key: "printserver", name: "Print Management (printmanagement.msc)", desc: "Printers, drivers, ports, forms" },
    ],
  },
  {
    title: "Networking",
    tools: [
      { key: "dhcp", name: "DHCP Manager (dhcpmgmt.msc)", desc: "Scopes, leases, reservations, policies" },
      { key: "rras", name: "Routing and Remote Access (rrasmgmt.msc)", desc: "NAT, VPN, static routes, DHCP relay" },
    ],
  },
  {
    title: "Security / Updates",
    tools: [
      { key: "adcs", name: "Certification Authority (certsrv.msc)", desc: "Issue, revoke, and manage certificates" },
      { key: "wsus", name: "Windows Server Update Services", desc: "Approve updates, manage computer groups" },
    ],
  },
  {
    title: "Other",
    tools: [{ key: "wac", name: "Windows Admin Center", desc: "Browser-based unified server management" }],
  },
];

function DashTable({ children }: { children: React.ReactNode }) {
  return <table className={styles.dashTable}>{children}</table>;
}

export function ServerManagerDashboard({ state, onLaunch }: { state: WinServerState; onLaunch: (tool: WsTool) => void }) {
  const [section, setSection] = useState<SmSection>("dashboard");
  const { server } = state;

  return (
    <div className={styles.smLayout}>
      <div className={styles.smNav}>
        {NAV.map((n) => (
          <div key={n.key} className={`${styles.smNavItem} ${section === n.key ? styles.smNavItemActive : ""}`} onClick={() => setSection(n.key)}>
            <span style={{ display: "inline-block", width: 16, marginRight: 8, color: "#1d6dad" }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </div>
      <div className={styles.smMain}>
        {section === "dashboard" ? (
          <>
            <div className={styles.smWelcome}>
              <h2>WELCOME TO SERVER MANAGER</h2>
              <div className={styles.smWelcomeSub}>Manage roles and features for {server.fqdn}</div>
            </div>
            <div className={styles.smQuick}>
              <div className={styles.smQuickHead}>QUICK START</div>
              <ol className={styles.smQuickList}>
                <li onClick={() => setSection("localServer")}>
                  <span className="num">1</span>Configure this local server
                </li>
                <li onClick={() => toast.info("Add roles and features wizard isn't wired up in this simulator — roles are pre-installed.")}>
                  <span className="num">2</span>Add roles and features
                </li>
                <li onClick={() => setSection("allServers")}>
                  <span className="num">3</span>Add other servers to manage
                </li>
                <li onClick={() => toast.info("Server group: All Servers (default).")}>
                  <span className="num">4</span>Create a server group
                </li>
                <li onClick={() => toast.info("Azure Arc: server registered. Status: Connected.")}>
                  <span className="num">5</span>Connect this server to cloud services (Azure Arc)
                </li>
              </ol>
            </div>

            <div className={styles.smQuickHead} style={{ borderTop: "1px solid #d4d4d4" }}>
              TOOLS — QUICK LAUNCH
            </div>
            <div className={styles.tileGrid} style={{ marginTop: 10 }}>
              {QUICK_TOOLS.map((t) => (
                <div key={t.h} className={styles.tile} onClick={() => onLaunch(t.key)}>
                  <div className={styles.tileHead}>{t.h}</div>
                  <div className={styles.tileDesc}>{t.d}</div>
                </div>
              ))}
            </div>

            <div className={styles.smQuickHead} style={{ borderTop: "1px solid #d4d4d4" }}>
              ROLES AND SERVER GROUPS
            </div>
            <div style={{ marginTop: 10 }}>
              {ROLE_ROWS.map((role) => (
                <div key={role.name} className={styles.roleCard}>
                  <div
                    className={styles.roleCardHead}
                    onClick={() => {
                      if (role.name === "Hyper-V") setSection("hyperv");
                      else if (role.name === "File and Storage Services") setSection("fileSrv");
                      else if (role.name === "DHCP Server") setSection("dhcpRole");
                      else if (role.name === "WSUS") setSection("wsusRole");
                    }}
                  >
                    <span>{role.name}</span>
                    <span>
                      {role.servers} server{role.servers > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className={styles.roleCardBody}>
                    <div className={styles.rcRow}>
                      <span className={styles.rcK}>Manageability</span>
                      <span className={styles.rcV} style={{ color: role.manage === "Online" ? "#107c10" : "#a4262c" }}>
                        {role.manage}
                      </span>
                    </div>
                    <div className={styles.rcRow}>
                      <span className={styles.rcK}>Events</span>
                      <span className={styles.rcV} style={{ color: role.events === 0 ? "#107c10" : "#d83b01" }}>
                        {role.events}
                      </span>
                    </div>
                    <div className={styles.rcRow}>
                      <span className={styles.rcK}>Services</span>
                      <span className={styles.rcV}>{role.services}</span>
                    </div>
                    <div className={styles.rcRow}>
                      <span className={styles.rcK}>Performance</span>
                      <span className={styles.rcV}>{role.perf}</span>
                    </div>
                    <div className={styles.rcRow}>
                      <span className={styles.rcK}>BPA results</span>
                      <span className={styles.rcV} style={{ color: role.bpa === 0 ? "#107c10" : "#d83b01" }}>
                        {role.bpa}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.smQuickHead} style={{ borderTop: "1px solid #d4d4d4" }}>
              TOOLS MENU
            </div>
            {TOOLS_GROUPS.map((g) => (
              <div key={g.title} style={{ marginTop: 12 }}>
                <h3 style={{ fontSize: 13, color: "#1d6dad" }}>{g.title}</h3>
                <div className={styles.tileGrid}>
                  {g.tools.map((t) => (
                    <div key={t.name} className={styles.tile} onClick={() => onLaunch(t.key)}>
                      <div className={styles.tileHead}>{t.name}</div>
                      <div className={styles.tileDesc}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : null}

        {section === "localServer" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Properties for {server.name}</h2>
            <DashTable>
              <tbody>
                <tr><th style={{ width: "35%" }}>Computer name</th><td>{server.name}</td></tr>
                <tr><th>Domain</th><td>{server.domain}</td></tr>
                <tr><th>Windows Defender Firewall</th><td>Domain: <b>{server.firewall.domain}</b>, Private: <b>{server.firewall.private}</b>, Public: <b>{server.firewall.public}</b></td></tr>
                <tr><th>Remote management</th><td style={{ color: "#107c10" }}><b>{server.remoteMgmt}</b></td></tr>
                <tr><th>Remote Desktop</th><td style={{ color: "#107c10" }}><b>{server.rdp}</b></td></tr>
                <tr><th>Operating system version</th><td>{server.os} (Build {server.build})</td></tr>
                <tr><th>Hardware information</th><td>{server.cpu} · {server.memoryGB} GB RAM</td></tr>
                <tr><th>Roles</th><td>{server.roles.join(", ")}</td></tr>
                <tr><th>Features</th><td>{server.features.join(", ")}</td></tr>
                <tr><th>Last installed updates</th><td>{server.lastUpdated}</td></tr>
                <tr><th>Time zone</th><td>{server.timezone}</td></tr>
                <tr><th>Uptime</th><td>{server.uptime}</td></tr>
                <tr><th>IE Enhanced Security Configuration</th><td>{server.ieEsc}</td></tr>
              </tbody>
            </DashTable>
          </div>
        ) : null}

        {section === "allServers" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Servers (pooled)</h2>
            <DashTable>
              <thead><tr><th>Server name</th><th>IPv4</th><th>Roles</th><th>Manageability</th></tr></thead>
              <tbody>
                <tr>
                  <td><b style={{ color: "#1d6dad" }}>{server.name}</b></td>
                  <td>{server.ip}</td>
                  <td style={{ fontSize: 11 }}>{server.roles.join(", ")}</td>
                  <td style={{ color: "#107c10" }}>Online</td>
                </tr>
                <tr>
                  <td><b style={{ color: "#1d6dad" }}>FS-FILE-02</b></td>
                  <td>10.10.0.6</td>
                  <td style={{ fontSize: 11 }}>Hyper-V Replica target</td>
                  <td style={{ color: "#107c10" }}>Online</td>
                </tr>
              </tbody>
            </DashTable>
          </div>
        ) : null}

        {section === "hyperv" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Hyper-V</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>VMs: {state.hyperv.vms.length} · Switches: {state.hyperv.switches.length}</p>
            <p>
              <a style={{ color: "#1d6dad", cursor: "pointer" }} onClick={() => onLaunch("hyperv")}>
                Open Hyper-V Manager
              </a>
            </p>
          </div>
        ) : null}

        {section === "fileSrv" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>File and Storage Services</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Shares: {state.fileshare.shares.length} · Volumes: {state.fileshare.volumes.length}</p>
            <p>
              <a style={{ color: "#1d6dad", cursor: "pointer" }} onClick={() => onLaunch("fileshare")}>
                Open File and Storage Services
              </a>
            </p>
          </div>
        ) : null}

        {section === "dhcpRole" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>DHCP</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Scopes: {state.dhcp.scopes.length}</p>
            <p>
              <a style={{ color: "#1d6dad", cursor: "pointer" }} onClick={() => onLaunch("dhcp")}>
                Open DHCP Manager
              </a>
            </p>
          </div>
        ) : null}

        {section === "wsusRole" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>WSUS</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Updates: {state.wsus.updates.length} · Computers: {state.wsus.computers.length}</p>
            <p>
              <a style={{ color: "#1d6dad", cursor: "pointer" }} onClick={() => onLaunch("wsus")}>
                Open WSUS
              </a>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
