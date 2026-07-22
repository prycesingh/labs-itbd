"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { WinServerState } from "@/lib/labs/simulators/winserver/types";
import styles from "./winserver-console.module.css";

type WacTab =
  | "Overview"
  | "Hyper-V"
  | "Virtual Machines"
  | "Virtual switches"
  | "Files & file sharing"
  | "Storage"
  | "DHCP"
  | "Updates"
  | "Roles & features"
  | "Services"
  | "Performance Monitor"
  | "PowerShell"
  | "Certificates"
  | "Events"
  | "Firewall"
  | "Local users & groups"
  | "Networks"
  | "Processes"
  | "Registry"
  | "Scheduled tasks"
  | "Security"
  | "Devices"
  | "Backup"
  | "Remote Desktop";

const TABS: WacTab[] = [
  "Overview",
  "Hyper-V",
  "Virtual Machines",
  "Virtual switches",
  "Files & file sharing",
  "Storage",
  "DHCP",
  "Updates",
  "Roles & features",
  "Services",
  "Performance Monitor",
  "PowerShell",
  "Certificates",
  "Events",
  "Firewall",
  "Local users & groups",
  "Networks",
  "Processes",
  "Registry",
  "Scheduled tasks",
  "Security",
  "Devices",
  "Backup",
  "Remote Desktop",
];

type Service = { name: string; display: string; status: string; startup: string };

const SERVICES: Service[] = [
  { name: "DHCPServer", display: "DHCP Server", status: "Running", startup: "Automatic" },
  { name: "DNS", display: "DNS Server", status: "Running", startup: "Automatic" },
  { name: "vmms", display: "Hyper-V Virtual Machine Management", status: "Running", startup: "Automatic" },
  { name: "WsusService", display: "Update Services", status: "Running", startup: "Automatic" },
  { name: "LanmanServer", display: "Server", status: "Running", startup: "Automatic" },
  { name: "LanmanWorkstation", display: "Workstation", status: "Running", startup: "Automatic" },
  { name: "W32Time", display: "Windows Time", status: "Running", startup: "Automatic" },
  { name: "MpsSvc", display: "Windows Defender Firewall", status: "Running", startup: "Automatic" },
  { name: "WinDefend", display: "Microsoft Defender Antivirus Service", status: "Running", startup: "Automatic" },
  { name: "TermService", display: "Remote Desktop Services", status: "Running", startup: "Automatic" },
];

const PROCESSES = [
  { name: "System Idle Process", pid: 0, user: "NT AUTHORITY\\SYSTEM", cpu: "93.2%", mem: "24 KB" },
  { name: "vmms.exe", pid: 1224, user: "NT AUTHORITY\\SYSTEM", cpu: "2.4%", mem: "184 MB" },
  { name: "svchost.exe (DHCPServer)", pid: 1888, user: "NT AUTHORITY\\LocalService", cpu: "0.3%", mem: "24 MB" },
  { name: "svchost.exe (DNS)", pid: 2104, user: "NT AUTHORITY\\NetworkService", cpu: "0.4%", mem: "38 MB" },
  { name: "WsusService.exe", pid: 3024, user: "NT AUTHORITY\\NetworkService", cpu: "1.0%", mem: "156 MB" },
  { name: "MMC.exe", pid: 4422, user: "CORP\\administrator", cpu: "0.1%", mem: "62 MB" },
];

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function mockPs(cmd: string, state: WinServerState): string {
  const c = cmd.trim().toLowerCase();
  if (c.startsWith("get-vm")) {
    return state.hyperv.vms
      .map((v) => pad(v.name, 20) + pad(v.state, 10) + pad(v.cpuUsage, 8) + v.memoryAssigned + " MB")
      .join("\n");
  }
  if (c.startsWith("get-service")) {
    const header = pad("Status", 9) + pad("Name", 19) + "DisplayName\n" + pad("------", 9) + pad("----", 19) + "-----------";
    const rows = SERVICES.map((s) => pad("Running", 9) + pad(s.name, 19) + s.display).join("\n");
    return header + "\n" + rows;
  }
  if (c.startsWith("get-dhcpserverv4scope")) {
    return state.dhcp.scopes.map((s) => pad(s.subnet, 18) + pad(s.name, 20) + (s.active ? "Active" : "Inactive")).join("\n");
  }
  if (c.startsWith("get-smbshare")) {
    return state.fileshare.shares.map((s) => pad(s.name, 22) + pad(s.path, 40) + s.type).join("\n");
  }
  if (c.startsWith("get-windowsupdate")) {
    const pending = state.wsus.updates.filter((u) => u.approval !== "Installed/Not Applicable");
    if (pending.length === 0) return "No updates pending.";
    return pending.map((u) => pad(u.kbArticles.join(","), 14) + pad(u.severity, 12) + u.title).join("\n");
  }
  if (c.startsWith("get-volume")) {
    return state.fileshare.volumes
      .map((v) => pad(v.letter, 6) + pad(v.label, 12) + pad(v.fileSystem, 8) + v.capacityGB + " GB total, " + v.freeGB + " GB free")
      .join("\n");
  }
  if (c.startsWith("hostname")) return state.server.name;
  if (c.startsWith("whoami")) return "corp\\administrator";
  if (c.startsWith("get-date")) return new Date().toString();
  if (c.startsWith("get-process")) {
    const header = pad("Handles", 9) + pad("NPM(K)", 9) + pad("PM(K)", 8) + pad("WS(K)", 8) + pad("CPU(s)", 9) + pad("Id", 7) + "ProcessName";
    const rows = PROCESSES.map((p) => pad("258", 9) + pad("18", 9) + pad("4468", 8) + pad("9024", 8) + pad(p.cpu, 9) + pad(String(p.pid), 7) + p.name).join("\n");
    return header + "\n" + rows;
  }
  return `'${cmd}' is not recognized as the name of a cmdlet, function, script file, or operable program.`;
}

function GaugeCard({ title, value, label }: { title: string; value: string; label: string }) {
  return (
    <div className={styles.wacCard}>
      <div className={styles.wacCardTitle}>{title}</div>
      <div className={styles.wacGauge}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1d6dad" }}>{value}</div>
        <div style={{ color: "#666", fontSize: 11 }}>{label}</div>
      </div>
    </div>
  );
}

function StubCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className={styles.wacCard}>
      <div className={styles.wacCardTitle}>{title}</div>
      {lines.map((l) => (
        <p key={l} style={{ fontSize: 12, color: "#444", marginBottom: 4 }}>
          {l}
        </p>
      ))}
    </div>
  );
}

export function WacConsole({ state }: { state: WinServerState }) {
  const [tab, setTab] = useState<WacTab>("Overview");

  return (
    <div className={styles.wacShell}>
      <div className={styles.wacBreadcrumb}>
        Windows Admin Center &gt; {state.server.fqdn}
      </div>
      <div className={styles.wacTabStrip}>
        {TABS.map((t) => (
          <div
            key={t}
            className={`${styles.wacTab} ${tab === t ? styles.wacTabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </div>
        ))}
      </div>
      <div className={styles.wacBody}>
        {tab === "Overview" ? <OverviewTab state={state} /> : null}
        {tab === "Hyper-V" ? <HyperVTab state={state} /> : null}
        {tab === "Virtual Machines" ? <VmsTab state={state} /> : null}
        {tab === "Virtual switches" ? <SwitchesTab state={state} /> : null}
        {tab === "Files & file sharing" ? <FileshareTab state={state} /> : null}
        {tab === "Storage" ? <StorageTab state={state} /> : null}
        {tab === "DHCP" ? <DhcpTab state={state} /> : null}
        {tab === "Updates" ? <UpdatesTab state={state} /> : null}
        {tab === "Roles & features" ? <RolesTab state={state} /> : null}
        {tab === "Services" ? <ServicesTab /> : null}
        {tab === "Performance Monitor" ? <PerfMonTab /> : null}
        {tab === "PowerShell" ? <PowerShellTab state={state} /> : null}
        {tab === "Certificates" ? <CertificatesTab /> : null}
        {tab === "Events" ? <EventsTab /> : null}
        {tab === "Firewall" ? <FirewallTab state={state} /> : null}
        {tab === "Local users & groups" ? <UsersTab /> : null}
        {tab === "Networks" ? <NetworksTab state={state} /> : null}
        {tab === "Processes" ? <ProcessesTab /> : null}
        {tab === "Registry" ? <RegistryTab /> : null}
        {tab === "Scheduled tasks" ? <ScheduledTasksTab /> : null}
        {tab === "Security" ? <SecurityTab /> : null}
        {tab === "Devices" ? <DevicesTab /> : null}
        {tab === "Backup" ? <BackupTab /> : null}
        {tab === "Remote Desktop" ? <RemoteDesktopTab /> : null}
      </div>
    </div>
  );
}

function OverviewTab({ state }: { state: WinServerState }) {
  const [cpu, setCpu] = useState(14 + Math.floor(Math.random() * 20));
  const [mem, setMem] = useState(22 + Math.floor(Math.random() * 6));
  const [disk, setDisk] = useState(15 + Math.floor(Math.random() * 40));
  const [net, setNet] = useState(4 + Math.random() * 12);

  useEffect(() => {
    const iv = setInterval(() => {
      setCpu(10 + Math.floor(Math.random() * 40));
      setMem(22 + Math.floor(Math.random() * 6));
      setDisk(15 + Math.floor(Math.random() * 50));
      setNet(4 + Math.random() * 12);
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const { server } = state;
  return (
    <div className={styles.wacCardGrid}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Computer name</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Computer name</th><td>{server.name}</td></tr>
            <tr><th>Domain</th><td>{server.domain}</td></tr>
            <tr><th>Operating system</th><td>{server.os} (Build {server.build})</td></tr>
            <tr><th>Uptime</th><td>{server.uptime}</td></tr>
            <tr><th>Manufacturer</th><td>Microsoft Corporation</td></tr>
            <tr><th>Model</th><td>Virtual Machine - Hyper-V</td></tr>
            <tr><th>Installed memory</th><td>{server.memoryGB} GB</td></tr>
          </tbody>
        </table>
      </div>
      <GaugeCard title="CPU" value={`${cpu}%`} label="utilization" />
      <GaugeCard title="Memory" value={`${mem} / ${server.memoryGB} GB`} label="in use" />
      <GaugeCard title="Disk" value={`${disk} MB/s`} label="throughput" />
      <GaugeCard title="Network" value={`${net.toFixed(1)} Mbps`} label="throughput" />
    </div>
  );
}

function HyperVTab({ state }: { state: WinServerState }) {
  const vms = state.hyperv.vms;
  const running = vms.filter((v) => v.state === "Running").length;
  const off = vms.filter((v) => v.state === "Off").length;
  const paused = vms.filter((v) => v.state === "Paused" || v.state === "Saved").length;
  return (
    <div className={styles.wacCardGrid}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Hyper-V</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Virtual machines</th><td>{vms.length}</td></tr>
            <tr><th>Running</th><td>{running}</td></tr>
            <tr><th>Off</th><td>{off}</td></tr>
            <tr><th>Paused / Saved</th><td>{paused}</td></tr>
            <tr><th>Virtual switches</th><td>{state.hyperv.switches.length}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Open Hyper-V Manager for full management.</p>
      </div>
    </div>
  );
}

function VmsTab({ state }: { state: WinServerState }) {
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Virtual Machines</div>
        <table className={styles.itemList}>
          <thead>
            <tr><th>Name</th><th>State</th><th>CPU</th><th>Memory</th><th>Guest OS</th></tr>
          </thead>
          <tbody>
            {state.hyperv.vms.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.state}</td>
                <td>{v.cpuUsage}</td>
                <td>{v.memoryAssigned} MB</td>
                <td>{v.os}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Open Hyper-V Manager for full management.</p>
      </div>
    </div>
  );
}

function SwitchesTab({ state }: { state: WinServerState }) {
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Virtual switches</div>
        <table className={styles.itemList}>
          <thead>
            <tr><th>Name</th><th>Type</th><th>Physical NIC</th><th>VLAN ID</th></tr>
          </thead>
          <tbody>
            {state.hyperv.switches.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td>{s.nic ?? ""}</td>
                <td>{s.vlanId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FileshareTab({ state }: { state: WinServerState }) {
  const shares = state.fileshare.shares;
  const totalSize = shares.reduce((sum, s) => sum + s.sizeGB, 0);
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Files &amp; file sharing</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Shares</th><td>{shares.length}</td></tr>
            <tr><th>Total size</th><td>{totalSize} GB</td></tr>
          </tbody>
        </table>
        <table className={styles.itemList} style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Share</th><th>Path</th><th>Protocol</th><th>Encrypted</th><th>Size</th></tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.path}</td>
                <td>{s.type}</td>
                <td>{s.encrypt ? "Yes" : "No"}</td>
                <td>{s.sizeGB} GB</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Open File and Storage tool for full management.</p>
      </div>
    </div>
  );
}

function StorageTab({ state }: { state: WinServerState }) {
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Storage</div>
        <table className={styles.itemList}>
          <thead>
            <tr><th>Volume</th><th>File System</th><th>Capacity</th><th>Free</th></tr>
          </thead>
          <tbody>
            {state.fileshare.volumes.map((v) => (
              <tr key={v.letter}>
                <td>{v.letter} ({v.label})</td>
                <td>{v.fileSystem}</td>
                <td>{v.capacityGB} GB</td>
                <td>{v.freeGB} GB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DhcpTab({ state }: { state: WinServerState }) {
  const scopes = state.dhcp.scopes;
  const active = scopes.filter((s) => s.active).length;
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>DHCP scopes</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Scopes</th><td>{scopes.length}</td></tr>
            <tr><th>Active</th><td>{active}</td></tr>
            <tr><th>Inactive</th><td>{scopes.length - active}</td></tr>
          </tbody>
        </table>
        <table className={styles.itemList} style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Subnet</th><th>Name</th><th>Range</th><th>State</th><th>Lease</th></tr>
          </thead>
          <tbody>
            {scopes.map((s) => (
              <tr key={s.id}>
                <td>{s.subnet}</td>
                <td>{s.name}</td>
                <td>{s.startIp} - {s.endIp}</td>
                <td>{s.active ? "Active" : "Inactive"}</td>
                <td>{s.leaseDays}d {s.leaseHours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Open DHCP Manager for full management.</p>
      </div>
    </div>
  );
}

function UpdatesTab({ state }: { state: WinServerState }) {
  const updates = state.wsus.updates;
  const approved = updates.filter((u) => u.approval === "Approved (Install)").length;
  const pending = updates.filter((u) => u.approval === "Not approved");
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Updates</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Last check</th><td>{state.wsus.lastSync}</td></tr>
            <tr><th>Approved</th><td>{approved}</td></tr>
            <tr><th>Pending</th><td>{pending.length}</td></tr>
          </tbody>
        </table>
        <table className={styles.itemList} style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Title</th><th>Classification</th><th>Severity</th></tr>
          </thead>
          <tbody>
            {pending.map((u) => (
              <tr key={u.id}>
                <td>{u.title}</td>
                <td>{u.classification}</td>
                <td>{u.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Open Update Services for full management.</p>
      </div>
    </div>
  );
}

function RolesTab({ state }: { state: WinServerState }) {
  return (
    <div className={styles.wacCardGrid}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Roles</div>
        {state.server.roles.map((r) => (
          <p key={r} style={{ fontSize: 12, marginBottom: 4 }}>{r}</p>
        ))}
      </div>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Features</div>
        {state.server.features.map((f) => (
          <p key={f} style={{ fontSize: 12, marginBottom: 4 }}>{f}</p>
        ))}
      </div>
    </div>
  );
}

function ServicesTab() {
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Services</div>
        <table className={styles.itemList}>
          <thead>
            <tr><th>Name</th><th>Display name</th><th>Status</th><th>Startup</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {SERVICES.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.display}</td>
                <td>{s.status}</td>
                <td>{s.startup}</td>
                <td>
                  <button type="button" className={styles.btn} onClick={() => toast.success(`Start ${s.name} requested.`)}>Start</button>{" "}
                  <button type="button" className={styles.btn} onClick={() => toast.success(`Stop ${s.name} requested.`)}>Stop</button>{" "}
                  <button type="button" className={styles.btn} onClick={() => toast.success(`Restart ${s.name} requested.`)}>Restart</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerfMonTab() {
  const [cpu, setCpu] = useState(10 + Math.floor(Math.random() * 40));
  const [mem, setMem] = useState(22 + Math.floor(Math.random() * 6));
  const [diskIops, setDiskIops] = useState(80 + Math.floor(Math.random() * 300));
  const [net, setNet] = useState(4 + Math.random() * 12);
  const [diskThroughput, setDiskThroughput] = useState(15 + Math.floor(Math.random() * 50));
  const [latency, setLatency] = useState(1 + Math.random() * 6);

  useEffect(() => {
    const iv = setInterval(() => {
      setCpu(10 + Math.floor(Math.random() * 40));
      setMem(22 + Math.floor(Math.random() * 6));
      setDiskIops(80 + Math.floor(Math.random() * 300));
      setNet(4 + Math.random() * 12);
      setDiskThroughput(15 + Math.floor(Math.random() * 50));
      setLatency(1 + Math.random() * 6);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div>
      <div className={styles.wacCardGrid}>
        <GaugeCard title="CPU" value={`${cpu}%`} label="utilization" />
        <GaugeCard title="Memory" value={`${mem}/64 GB`} label="in use" />
        <GaugeCard title="Disk IOPS" value={String(diskIops)} label="IOPS" />
        <GaugeCard title="Disk throughput" value={`${diskThroughput} MB/s`} label="read+write" />
        <GaugeCard title="Network" value={`${net.toFixed(1)} Mbps`} label="throughput" />
        <GaugeCard title="Disk latency" value={`${latency.toFixed(1)} ms`} label="average" />
      </div>
      <p style={{ fontSize: 11, color: "#666", marginTop: 10 }}>Live counters refresh every 2 seconds.</p>
    </div>
  );
}

function PowerShellTab({ state }: { state: WinServerState }) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [lines]);

  function run() {
    const cmd = input.trim();
    if (!cmd) return;
    if (cmd.toLowerCase() === "clear" || cmd.toLowerCase() === "cls") {
      setLines([]);
      setInput("");
      return;
    }
    const result = mockPs(cmd, state);
    setLines((prev) => [...prev, `PS C:\\Users\\Administrator> ${cmd}`, result]);
    setInput("");
  }

  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>PowerShell</div>
        <div ref={outRef} className={styles.terminal}>
          {lines.length === 0 ? "PS C:\\Users\\Administrator> " : lines.join("\n") + "\nPS C:\\Users\\Administrator> "}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
            placeholder="Enter a PowerShell command (e.g. Get-VM, Get-Service, Get-DhcpServerv4Scope)"
            style={{ flex: 1, border: "1px solid #adadad", padding: "4px 6px", fontSize: 12, fontFamily: "Consolas, monospace" }}
          />
          <button type="button" className={styles.btnPrimary} onClick={run}>Run</button>
        </div>
      </div>
    </div>
  );
}

function CertificatesTab() {
  const rows = [
    ["CN=FS-FILE-01.corp.cloudlab.local", "Personal", "corp-CORP-CA", "2026-04-08"],
    ["CN=corp-CORP-CA", "Trusted Root", "corp-CORP-CA", "2030-01-15"],
    ["CN=DigiCert Global Root CA", "Trusted Root", "DigiCert", "2031-11-10"],
    ["CN=FS-FILE-01-WAC", "Personal", "corp-CORP-CA", "2026-01-10"],
  ];
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Certificates</div>
        <table className={styles.itemList}>
          <thead><tr><th>Subject</th><th>Store</th><th>Issuer</th><th>Expires</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsTab() {
  const rows = [
    ["System", "Information", "1006", "SMBServer", "The SMB server completed startup tasks."],
    ["Security", "Audit Failure", "4625", "Security-Auditing", "An account failed to log on."],
    ["Application", "Information", "1003", "WSUS", "Synchronization completed successfully."],
    ["System", "Warning", "7045", "Service Control Manager", "A new service was installed: SQLBrowser"],
  ];
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Events</div>
        <table className={styles.itemList}>
          <thead><tr><th>Log</th><th>Level</th><th>Event ID</th><th>Source</th><th>Message</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[2]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FirewallTab({ state }: { state: WinServerState }) {
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Firewall</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Domain profile</th><td>{state.server.firewall.domain}</td></tr>
            <tr><th>Private profile</th><td>{state.server.firewall.private}</td></tr>
            <tr><th>Public profile</th><td>{state.server.firewall.public}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const rows = [
    ["Administrator", "Built-in administrator account", "Administrators", "Enabled"],
    ["Guest", "Built-in guest account", "Guests", "Disabled"],
    ["svc-wsus", "WSUS service account", "Domain Users", "Enabled"],
    ["svc-hyperv", "Hyper-V replication account", "Hyper-V Administrators", "Enabled"],
  ];
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Local users</div>
        <table className={styles.itemList}>
          <thead><tr><th>Name</th><th>Description</th><th>Groups</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NetworksTab({ state }: { state: WinServerState }) {
  const { server } = state;
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Networks</div>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th>Ethernet</th><td>{server.ip} / 24, Gateway {server.gateway}</td></tr>
            <tr><th>DNS</th><td>{server.dns.join(", ")}</td></tr>
            <tr><th>Link speed</th><td>10 Gbps</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProcessesTab() {
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Processes</div>
        <table className={styles.itemList}>
          <thead><tr><th>Name</th><th>PID</th><th>User</th><th>CPU</th><th>Memory</th></tr></thead>
          <tbody>
            {PROCESSES.map((p) => (
              <tr key={p.pid}>
                <td>{p.name}</td>
                <td>{p.pid}</td>
                <td>{p.user}</td>
                <td>{p.cpu}</td>
                <td>{p.mem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegistryTab() {
  return (
    <StubCard
      title="Registry"
      lines={[
        "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
        "ProductName: Windows Server 2022 Datacenter",
        "For safety, only read-only registry browsing is available in this simulator.",
      ]}
    />
  );
}

function ScheduledTasksTab() {
  const rows = [
    ["\\Microsoft\\Windows\\Backup\\Daily", "Ready", "02:00 daily"],
    ["\\Microsoft\\Windows\\WSUS\\Cleanup", "Ready", "02:30 weekly"],
    ["\\Microsoft\\Windows\\Hyper-V\\Checkpoint Cleanup", "Ready", "01:30 daily"],
  ];
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Scheduled tasks</div>
        <table className={styles.itemList}>
          <thead><tr><th>Task</th><th>Status</th><th>Next run</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <StubCard
      title="Security"
      lines={[
        "Microsoft Defender Antivirus: Active, real-time protection on.",
        "BitLocker: Volumes C: and D: encrypted (XTS-AES 256).",
        "Secure Boot: Enabled. Credential Guard: Running.",
      ]}
    />
  );
}

function DevicesTab() {
  const rows = [
    ["Microsoft Hyper-V Network Adapter", "Network adapters", "OK"],
    ["Microsoft Hyper-V SCSI Controller", "Storage controllers", "OK"],
    ["Trusted Platform Module 2.0", "Security devices", "OK"],
  ];
  return (
    <div className={styles.wacCardGrid} style={{ gridTemplateColumns: "1fr" }}>
      <div className={styles.wacCard}>
        <div className={styles.wacCardTitle}>Devices</div>
        <table className={styles.itemList}>
          <thead><tr><th>Name</th><th>Class</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BackupTab() {
  return (
    <StubCard
      title="Backup"
      lines={["Last backup: 2026-04-12 02:00 (Succeeded).", "Target: E:\\Backup\\WindowsImageBackup\\", "Retention: 30 days."]}
    />
  );
}

function RemoteDesktopTab() {
  return (
    <StubCard
      title="Remote Desktop"
      lines={["Status: Enabled. Port 3389.", "Network Level Authentication: Required.", "Allowed users: Administrators, Remote Desktop Users."]}
    />
  );
}
