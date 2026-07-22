"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsState } from "@/lib/labs/simulators/adds/types";
import type { AddsTool } from "./adds-shell";
import styles from "./adds-console.module.css";

type SmSection = "dashboard" | "localServer" | "allServers" | "adds" | "dnsRole" | "fileSrv" | "iis" | "hyperv" | "tools" | "rolesFeatures";

const NAV: { key: SmSection; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "localServer", label: "Local Server", icon: "◧" },
  { key: "allServers", label: "All Servers", icon: "◰" },
  { key: "adds", label: "AD DS", icon: "✦" },
  { key: "dnsRole", label: "DNS", icon: "⌘" },
  { key: "fileSrv", label: "File and Storage Services", icon: "▤" },
  { key: "iis", label: "IIS", icon: "◑" },
  { key: "hyperv", label: "Hyper-V", icon: "⊞" },
  { key: "tools", label: "Tools", icon: "⚙" },
  { key: "rolesFeatures", label: "Add Roles and Features", icon: "+" },
];

const QUICK_TOOLS: { key: AddsTool; h: string; d: string }[] = [
  { key: "aduc", h: "Active Directory Users and Computers", d: "Manage users, groups, computers, and OUs in the domain." },
  { key: "gpo", h: "Group Policy Management", d: "Edit, link, and report on Group Policy Objects." },
  { key: "dns", h: "DNS Manager", d: "Manage forward and reverse lookup zones, A, CNAME, SRV records and more." },
  { key: "eventviewer", h: "Event Viewer", d: "Windows logs, Applications and Services logs, custom views, subscriptions." },
  { key: "bitlocker", h: "BitLocker Recovery", d: "Recovery keys, escrow status, TPM owner authorization." },
  { key: "replication", h: "AD Replication Status Tool", d: "repadmin /showrepl, /replsummary, KCC, USN visibility." },
];

const ROLE_ROWS = [
  { name: "AD DS", servers: 2, manage: "Online", events: 0, services: "Running", perf: "Normal", bpa: 0 },
  { name: "DNS", servers: 2, manage: "Online", events: 1, services: "Running", perf: "Normal", bpa: 2 },
  { name: "File and Storage Services", servers: 2, manage: "Online", events: 0, services: "Running", perf: "Normal", bpa: 0 },
  { name: "IIS", servers: 1, manage: "Online", events: 3, services: "Running", perf: "Normal", bpa: 1 },
  { name: "Hyper-V", servers: 1, manage: "Online", events: 0, services: "Running", perf: "Normal", bpa: 0 },
];

const COUNTERS = [
  { label: "CPU", val: "14%", threshold: "Threshold: 85% sustained for 5min" },
  { label: "Memory", val: "62%", threshold: "Threshold: 90%" },
  { label: "Disk (C:)", val: "8%", threshold: "Threshold: 90% used capacity" },
  { label: "Network", val: "12 Mb/s", threshold: "Threshold: 80% of NIC capacity" },
];

const DASH_EVENTS = [
  { sev: "Warning", source: "DNS Server", id: "4015", server: "DC01", time: "2 hours ago", msg: "DNS server has encountered ageing on zone — 142 stale records cleaned." },
  { sev: "Warning", source: "IIS-Default", id: "5189", server: "WEB01", time: "5 hours ago", msg: "Application pool DefaultAppPool stopped due to recycling threshold." },
  { sev: "Error", source: "DCOM", id: "10016", server: "DC02", time: "8 hours ago", msg: "Permission for COM object on NT AUTHORITY\\LOCAL SERVICE — local launch denied." },
  { sev: "Warning", source: "Microsoft-Windows-Time-Service", id: "134", server: "DC02", time: "12 hours ago", msg: "NtpClient was unable to set a manual peer to use as a time source." },
];

const ALL_SERVERS = [
  { name: "DC01", ip: "10.0.0.10", role: "AD DS, DNS", os: "Windows Server 2025 Datacenter", mgmt: "Online", update: "2026-04-10", uptime: "14 days" },
  { name: "DC02", ip: "10.0.0.11", role: "AD DS, DNS", os: "Windows Server 2025 Datacenter", mgmt: "Online", update: "2026-04-10", uptime: "14 days" },
  { name: "FS01", ip: "10.0.0.20", role: "File Server, DFS-N", os: "Windows Server 2025 Standard", mgmt: "Online", update: "2026-04-10", uptime: "28 days" },
  { name: "FS02", ip: "10.0.0.21", role: "File Server replica", os: "Windows Server 2025 Standard", mgmt: "Online", update: "2026-04-10", uptime: "28 days" },
  { name: "WEB01", ip: "10.0.0.30", role: "IIS, Web Server", os: "Windows Server 2025 Standard", mgmt: "Online", update: "2026-04-10", uptime: "7 days" },
  { name: "HV01", ip: "10.0.0.40", role: "Hyper-V host", os: "Windows Server 2025 Datacenter", mgmt: "Online", update: "2026-04-10", uptime: "120 days" },
  { name: "WSUS01", ip: "10.0.0.50", role: "WSUS (legacy — slated for retirement)", os: "Windows Server 2022 Standard", mgmt: "Manageability issue", update: "2026-03-12", uptime: "14 hours" },
  { name: "BACKUP01", ip: "10.0.0.60", role: "Veeam Backup + Replication", os: "Windows Server 2025 Standard", mgmt: "Online", update: "2026-04-10", uptime: "42 days" },
];

const TOOLS_GROUPS: { title: string; tools: { key: AddsTool; name: string; desc: string }[] }[] = [
  {
    title: "Active Directory",
    tools: [
      { key: "aduc", name: "Active Directory Users and Computers (dsa.msc)", desc: "Manage users, groups, computers, OUs" },
      { key: "sites", name: "Active Directory Sites and Services (dssite.msc)", desc: "Sites, subnets, replication topology, KCC" },
      { key: "trusts", name: "Active Directory Domains and Trusts (domain.msc)", desc: "Forest functional level, trusts, UPN suffixes" },
      { key: "fsmo", name: "FSMO role transfer (PowerShell)", desc: "Move-ADDirectoryServerOperationMasterRole" },
    ],
  },
  {
    title: "Group Policy / Identity",
    tools: [
      { key: "gpo", name: "Group Policy Management (gpmc.msc)", desc: "GPO authoring, linking, security filtering, RSoP" },
      { key: "replication", name: "AD Replication Status Tool (repadmin)", desc: "repadmin /showrepl, /replsummary, KCC visibility" },
      { key: "nps", name: "Network Policy Server (nps.msc)", desc: "RADIUS — 802.1X, VPN, WLAN authentication" },
    ],
  },
  {
    title: "DNS / Networking",
    tools: [
      { key: "dns", name: "DNS Manager (dnsmgmt.msc)", desc: "Zones, A / CNAME / SRV / MX records, ageing, scavenging" },
      { key: "dhcp", name: "DHCP Manager (dhcpmgmt.msc)", desc: "Scopes, leases, reservations, options" },
    ],
  },
  {
    title: "Security",
    tools: [
      { key: "bitlocker", name: "BitLocker Drive Encryption (manage-bde.exe)", desc: "Encrypt, suspend, recovery key escrow" },
      { key: "eventviewer", name: "Event Viewer (eventvwr.msc)", desc: "Windows + Application logs, custom views, subscriptions" },
      { key: "firewall", name: "Windows Firewall with Advanced Security (wf.msc)", desc: "Inbound / outbound rules, connection security, IPsec" },
      { key: "troubleshoot", name: "AD Health Check", desc: "Guided diagnosis for common domain issues" },
    ],
  },
  {
    title: "Other",
    tools: [
      { key: "aadconnect", name: "Microsoft Entra Connect (Sync)", desc: "Hybrid identity sync to Entra ID" },
      { key: "adcs", name: "Certification Authority (certsrv.msc)", desc: "AD CS — issue / revoke certs, templates" },
      { key: "rras", name: "Routing and Remote Access (rrasmgmt.msc)", desc: "VPN servers, routing interfaces" },
    ],
  },
];

const WIZARD_STEPS: { num: string; title: string; body: string; complete: boolean }[] = [
  { num: "1", title: "Before you begin", body: "Confirm: Administrator password set, network configuration completed, latest updates installed.", complete: true },
  { num: "2", title: "Installation type", body: "Role-based or feature-based (single server) — DEFAULT · Remote Desktop Services installation (RDS / VDI)", complete: true },
  { num: "3", title: "Server selection", body: "Select from server pool: DC01, DC02, FS01, FS02, WEB01, HV01, BACKUP01, WSUS01 · OR offline VHD", complete: true },
  { num: "4", title: "Server roles", body: "AD DS, AD CS, AD FS, DHCP, DNS, File and Storage Services, Hyper-V, Network Policy Server, Remote Access, Web Server (IIS), Windows Server Update Services, and more.", complete: false },
  { num: "5", title: "Features", body: ".NET Framework, BitLocker, BranchCache, Failover Clustering, Group Policy Management, IPAM, RSAT, Windows Server Backup, and more.", complete: false },
  { num: "6", title: "Confirmation", body: "Review selections, choose: Restart server automatically if required · Export configuration settings", complete: false },
  { num: "7", title: "Results", body: "Live status of feature installation per role. Logs to %SystemRoot%\\Logs\\ServerManager.log.", complete: false },
];

function DashTable({ children }: { children: React.ReactNode }) {
  return <table className={styles.dashTable}>{children}</table>;
}

export function ServerManager({ domain, onLaunch }: { domain: AddsState["domain"]; onLaunch: (tool: AddsTool) => void }) {
  const [section, setSection] = useState<SmSection>("dashboard");
  const dcName = "DC01";

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
              <div className={styles.smWelcomeSub}>Manage your servers, roles, and features for {domain.fqdn}</div>
            </div>
            <div className={styles.smQuick}>
              <div className={styles.smQuickHead}>QUICK START</div>
              <ol className={styles.smQuickList}>
                <li onClick={() => setSection("localServer")}>
                  <span className="num">1</span>Configure this local server
                </li>
                <li onClick={() => setSection("rolesFeatures")}>
                  <span className="num">2</span>Add roles and features
                </li>
                <li onClick={() => setSection("allServers")}>
                  <span className="num">3</span>Add other servers to manage
                </li>
                <li onClick={() => toast.info("Server group: All Servers (default). Right-click in All Servers to create a custom group.")}>
                  <span className="num">4</span>Create a server group
                </li>
                <li onClick={() => toast.info("Azure Arc: server registered 2026-04-10. Status: Connected. Hybrid Benefit: applied.")}>
                  <span className="num">5</span>Connect this server to cloud services (Azure Arc)
                </li>
              </ol>
              <div className={styles.smQuickHead} style={{ marginTop: 14 }}>
                WHAT&apos;S NEW
              </div>
              <ul style={{ fontSize: 12, color: "#444", padding: "8px 12px 12px 30px" }}>
                <li>Microsoft.Update.PowerShell module — replace WSUS workflows</li>
                <li>SMB over QUIC for Windows Server 2025 (no VPN needed for branch file access)</li>
                <li>Hotpatching for Azure-connected servers without reboot</li>
                <li>OpenSSH server on by default</li>
              </ul>
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
                  <div className={styles.roleCardHead}>
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
              PERFORMANCE (last 60 min)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", border: "1px solid #d4d4d4", background: "#fff", borderTop: "none", marginBottom: 12 }}>
              {COUNTERS.map((c) => (
                <div key={c.label} style={{ padding: "10px 14px", borderRight: "1px solid #edebe9" }}>
                  <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase" }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#1d6dad", marginTop: 4 }}>{c.val}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{c.threshold}</div>
                </div>
              ))}
            </div>

            <div className={styles.smQuickHead} style={{ borderTop: "1px solid #d4d4d4" }}>
              EVENTS — Last 24h
            </div>
            <div style={{ background: "#fff", border: "1px solid #d4d4d4", borderTop: "none", fontSize: 12, marginBottom: 12 }}>
              {DASH_EVENTS.map((e, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 200px 60px 60px 110px 1fr", padding: "6px 12px", borderBottom: "1px solid #edebe9" }}>
                  <span style={{ color: e.sev === "Error" ? "#a4262c" : "#d83b01", fontWeight: 600 }}>{e.sev}</span>
                  <span>{e.source}</span>
                  <span>{e.id}</span>
                  <span>{e.server}</span>
                  <span style={{ color: "#666" }}>{e.time}</span>
                  <span style={{ color: "#444" }}>{e.msg}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {section === "localServer" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Properties for {dcName}</h2>
            <DashTable>
              <tbody>
                <tr><th style={{ width: "35%" }}>Computer name</th><td>{dcName}</td></tr>
                <tr><th>Domain</th><td>{domain.fqdn}</td></tr>
                <tr><th>Windows Defender Firewall</th><td>Domain: <b>On</b>, Private: <b>On</b>, Public: <b>On</b></td></tr>
                <tr><th>Remote management</th><td style={{ color: "#107c10" }}><b>Enabled</b></td></tr>
                <tr><th>Remote Desktop</th><td style={{ color: "#107c10" }}><b>Enabled</b> (NLA required)</td></tr>
                <tr><th>Operating system version</th><td>Windows Server 2022 Datacenter</td></tr>
                <tr><th>Hardware information</th><td>Virtual Machine — Hyper-V Gen 2 · 4 vCPU · 16 GB RAM</td></tr>
                <tr><th>Last installed updates</th><td>2026-04-10 (KB5036899)</td></tr>
                <tr><th>Time zone</th><td>(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi</td></tr>
                <tr><th>Azure Arc</th><td style={{ color: "#107c10" }}><b>Connected</b></td></tr>
                <tr><th>Microsoft Defender for Servers</th><td style={{ color: "#107c10" }}><b>Onboarded</b> (Plan 2)</td></tr>
              </tbody>
            </DashTable>
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, color: "#1d6dad" }}>Services on this server (key)</h3>
              <DashTable>
                <thead><tr><th>Name</th><th>Status</th><th>Start type</th></tr></thead>
                <tbody>
                  {["Active Directory Domain Services (NTDS)", "DNS Server (DNS)", "Kerberos Key Distribution Center (Kdc)", "Intersite Messaging (IsmServ)", "DFS Replication (DFSR)", "Windows Time (W32Time)"].map((s) => (
                    <tr key={s}><td><b>{s}</b></td><td style={{ color: "#107c10" }}>Running</td><td>Automatic</td></tr>
                  ))}
                </tbody>
              </DashTable>
            </div>
            <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => toast.info("Starting BPA scan for AD DS, DNS, File Services... approx 90 sec.")}>
              Start BPA Scan
            </button>
          </div>
        ) : null}

        {section === "allServers" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Servers (pooled)</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>All servers manageable from this console.</p>
            <DashTable>
              <thead><tr><th>Server name</th><th>IPv4</th><th>Roles</th><th>OS</th><th>Manageability</th><th>Last update</th><th>Uptime</th></tr></thead>
              <tbody>
                {ALL_SERVERS.map((s) => (
                  <tr key={s.name}>
                    <td><b style={{ color: "#1d6dad" }}>{s.name}</b></td>
                    <td>{s.ip}</td>
                    <td style={{ fontSize: 11 }}>{s.role}</td>
                    <td style={{ fontSize: 11 }}>{s.os}</td>
                    <td style={{ color: s.mgmt === "Online" ? "#107c10" : "#d83b01", fontSize: 11 }}>{s.mgmt}</td>
                    <td>{s.update}</td>
                    <td>{s.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </DashTable>
          </div>
        ) : null}

        {section === "adds" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>AD DS — Active Directory Domain Services</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Servers running this role: 2 · Forest functional level: {domain.forestFunctionalLevel}</p>
            <h3 style={{ fontSize: 14, color: "#1d6dad" }}>Quick launch</h3>
            <p>
              {(["aduc", "fsmo", "sites", "replication"] as AddsTool[]).map((t, i) => (
                <span key={t}>
                  {i > 0 ? " · " : ""}
                  <a style={{ color: "#1d6dad", cursor: "pointer" }} onClick={() => onLaunch(t)}>
                    Open {t === "aduc" ? "Active Directory Users and Computers" : t === "fsmo" ? "FSMO role holders" : t === "sites" ? "AD Sites and Services" : "Replication status"}
                  </a>
                </span>
              ))}
            </p>
          </div>
        ) : null}

        {section === "dnsRole" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>DNS</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>DNS servers: 2 · Forward zones: 2 · Reverse zones: 1</p>
            <p>
              <a style={{ color: "#1d6dad", cursor: "pointer" }} onClick={() => onLaunch("dns")}>
                Open DNS Manager
              </a>
            </p>
          </div>
        ) : null}

        {section === "fileSrv" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>File and Storage Services</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Volumes · Shares · Storage Pools · DFS Namespaces</p>
            <DashTable>
              <thead><tr><th>Share</th><th>Local path</th><th>Protocol</th></tr></thead>
              <tbody>
                <tr><td><b>\\fs01\hr$</b></td><td>D:\Shares\HR</td><td>SMB</td></tr>
                <tr><td><b>\\fs01\public</b></td><td>D:\Shares\Public</td><td>SMB</td></tr>
              </tbody>
            </DashTable>
          </div>
        ) : null}

        {section === "iis" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Internet Information Services (IIS)</h2>
            <p style={{ fontSize: 12, color: "#666" }}>Servers: 1 (WEB01) · Sites: 4 · App pools: 6</p>
          </div>
        ) : null}

        {section === "hyperv" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Hyper-V</h2>
            <p style={{ fontSize: 12, color: "#666" }}>Hosts: 1 (HV01) · VMs: 8 · vSwitches: 3</p>
          </div>
        ) : null}

        {section === "tools" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Tools menu</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>All MMC consoles shipped with Windows Server — sorted by category.</p>
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
          </div>
        ) : null}

        {section === "rolesFeatures" ? (
          <div>
            <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>Add Roles and Features Wizard</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
              Walks you through installing roles on local or remote servers. Pre-requisite engine validates and installs feature dependencies automatically.
            </p>
            <div style={{ border: "1px solid #d4d4d4", background: "#fff" }}>
              <div style={{ background: "#1d6dad", color: "#fff", padding: "8px 14px", fontWeight: 600, fontSize: 13 }}>Wizard steps</div>
              {WIZARD_STEPS.map((s) => (
                <div key={s.num} style={{ display: "grid", gridTemplateColumns: "48px 200px 1fr", borderTop: "1px solid #edebe9", background: s.complete ? "#dff6dd" : "#fff" }}>
                  <div style={{ background: s.complete ? "#107c10" : "#1d6dad", color: "#fff", textAlign: "center", padding: "10px 0", fontWeight: 700, fontSize: 14 }}>{s.num}</div>
                  <div style={{ padding: "10px 12px", fontWeight: 600, fontSize: 13, borderRight: "1px solid #edebe9" }}>{s.title}</div>
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "#444" }}>{s.body}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, background: "#deecf9", padding: "12px 14px", borderLeft: "3px solid #1d6dad", fontSize: 12 }}>
              <b>PowerShell alternative:</b> <code>Install-WindowsFeature -Name AD-Domain-Services,DNS -IncludeManagementTools -Restart</code>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
