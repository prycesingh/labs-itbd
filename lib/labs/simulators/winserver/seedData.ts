import type { WinServerState, WsDhcpLease, WsWsusComputer } from "./types";

function pad(n: number, w: number): string {
  let s = String(n);
  while (s.length < w) s = "0" + s;
  return s;
}
function macOf(a: number, b: number, c: number, d: number, e: number, f: number): string {
  const h = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  return [a, b, c, d, e, f].map(h).join("-");
}
function futureIso(addDays: number, addHours: number): string {
  const d = new Date(2026, 4, 14, 7, 0, 0);
  d.setDate(d.getDate() + addDays);
  d.setHours(d.getHours() + addHours);
  return d.toISOString();
}

function seedLeases(): WsDhcpLease[] {
  const leases: WsDhcpLease[] = [];
  for (let i = 100; i < 160; i++) {
    leases.push({
      scopeId: "sc-1",
      ip: `10.10.0.${i}`,
      mac: macOf(0x00, 0x15, 0x5d, 0x11, 0x00, i),
      name: `WK-LAN-${pad(i, 3)}.corp.cloudlab.local`,
      lease: "Active",
      expires: futureIso((i % 8) + 1, 0),
      vendor: "MSFT 5.0",
      userClass: "Default User Class",
    });
  }
  for (let j = 60; j < 75; j++) {
    leases.push({
      scopeId: "sc-2",
      ip: `10.20.0.${j}`,
      mac: macOf(0x00, 0x15, 0x5d, 0x22, 0x00, j),
      name: `WEB-DMZ-${pad(j, 3)}.dmz.cloudlab.local`,
      lease: "Active",
      expires: futureIso(0, 3),
      vendor: "MSFT 5.0",
      userClass: "Default User Class",
    });
  }
  for (let k = 20; k < 25; k++) {
    leases.push({
      scopeId: "sc-3",
      ip: `10.30.0.${k}`,
      mac: macOf(0x00, 0x1a, 0x2b, 0x33, 0x00, k),
      name: `guest-device-${pad(k, 3)}`,
      lease: "Active",
      expires: futureIso(0, 1),
      vendor: "Apple Inc.",
      userClass: "Default User Class",
    });
  }
  return leases;
}

function seedWsusComputers(): WsWsusComputer[] {
  const oss = ["Windows Server 2022 Datacenter", "Windows Server 2022 Standard", "Windows Server 2019 Standard", "Windows 11 Pro 23H2", "Windows 10 Enterprise 22H2"];
  const groups = ["Servers", "Servers", "Servers", "Workstations", "Workstations"];
  const statuses = ["Installed/Not Applicable", "Installed/Not Applicable", "Needed", "Failed", "Needed", "Installed/Not Applicable", "No Status"];
  const rows: WsWsusComputer[] = [];
  for (let i = 1; i <= 22; i++) {
    const idx = i % 5;
    const nm = (idx < 3 ? "SVR-" : "WK-") + pad(i, 3);
    rows.push({
      name: `${nm}.corp.cloudlab.local`,
      ip: `10.10.0.${100 + i}`,
      os: oss[idx],
      lastReport: `2026-04-${pad(8 + (i % 4), 2)}T${pad((i * 3) % 24, 2)}:22:00Z`,
      group: groups[idx],
      status: statuses[i % statuses.length],
      installedPct: 60 + (i % 35),
      neededPct: 20 - (i % 12),
      failedPct: i % 5 === 0 ? 5 : 0,
    });
  }
  return rows;
}

function seedUpdates() {
  const titles: { t: string; c: string; prod: string; sev: string }[] = [
    { t: "2026-04 Cumulative Update for Windows Server 2022 (KB5036909)", c: "Security Updates", prod: "Windows Server 2022", sev: "Critical" },
    { t: "2026-04 Cumulative Update for Windows 11 23H2 (KB5036893)", c: "Security Updates", prod: "Windows 11", sev: "Critical" },
    { t: "2026-04 Servicing Stack Update for Windows Server 2022 (KB5037053)", c: "Servicing Stack Updates", prod: "Windows Server 2022", sev: "Important" },
    { t: "2026-04 .NET Framework 4.8 Update (KB5036620)", c: "Security Updates", prod: "Windows Server 2022", sev: "Important" },
    { t: "Microsoft Defender Antivirus definition update - KB2267602", c: "Definition Updates", prod: "Windows Server 2022", sev: "Critical" },
    { t: "Update for Microsoft Edge Stable Channel Version 124.0.2478.51", c: "Critical Updates", prod: "Microsoft Edge", sev: "Critical" },
    { t: "2026-04 Update for Microsoft 365 Apps (16.0.17531.20120)", c: "Updates", prod: "Microsoft 365 Apps", sev: "Important" },
    { t: "SQL Server 2022 Cumulative Update 13 (KB5036432)", c: "Updates", prod: "SQL Server 2022", sev: "Important" },
    { t: "2026-03 Cumulative Update for Windows Server 2022 (KB5035857)", c: "Security Updates", prod: "Windows Server 2022", sev: "Critical" },
    { t: "2026-03 Cumulative Update for Windows 11 23H2 (KB5035853)", c: "Security Updates", prod: "Windows 11", sev: "Critical" },
  ];
  return titles.map((row, i) => ({
    id: `upd-${i + 1}`,
    title: row.t,
    classification: row.c,
    product: row.prod,
    severity: row.sev,
    released: i < 6 ? "2026-04-09" : "2026-03-12",
    approval: i < 8 ? "Approved (Install)" : "Not approved",
    groups: i < 8 ? ["All Computers"] : [],
    installedPct: i < 8 ? 70 + i : 0,
    neededPct: i < 8 ? 30 - i : 0,
    failedPct: 0,
    size: `${40 + i * 30} MB`,
    msrcSeverity: row.sev,
    supersedes: i > 4 ? "KB5031234" : "",
    kbArticles: [`KB${5035000 + i * 100}`],
  }));
}

const CERT_TEMPLATE_NAMES = [
  "Administrator", "Basic EFS", "Domain Controller", "EFS Recovery Agent", "Kerberos Authentication",
  "Computer", "User", "Web Server", "Code Signing", "Subordinate Certification Authority",
  "IPSec", "Smartcard Logon", "Smartcard User", "Enrollment Agent", "Router (Offline request)",
  "Trust List Signing", "CEP Encryption", "Exchange Enrollment Agent (Offline request)", "Key Recovery Agent",
  "OCSP Response Signing", "RAS and IAS Server", "WHfB Authentication", "Workstation Authentication",
  "Domain Controller Authentication", "Directory Email Replication", "User Signature Only", "Authenticated Session",
  "CA Exchange", "Cross Certification Authority", "Enrollment Agent (Computer)", "Exchange Signature Only", "Exchange User",
];

function seedCertTemplates() {
  return CERT_TEMPLATE_NAMES.map((name, i) => ({
    name,
    schemaVersion: i % 3 === 0 ? 4 : i % 3 === 1 ? 2 : 1,
    validityDays: name.includes("CA") || name.includes("Certification") ? 1825 : 365,
    renewalDays: 42,
    publishToAd: !name.includes("Web") && !name.includes("Code Signing"),
    managerApproval: name === "Enrollment Agent" || name === "Code Signing",
    minKeySize: name.includes("CA") ? 4096 : 2048,
  }));
}

function seedCerts() {
  const requesters = [
    "CORP\\jdoe", "CORP\\ksmith", "CORP\\asharma", "CORP\\admin", "CORP\\msingh",
    "CORP\\DC01$", "CORP\\DC02$", "CORP\\SRV-FILE-01$", "CORP\\WK-001$", "CORP\\WK-002$",
    "CORP\\svc-web", "CORP\\svc-sql", "CORP\\svc-backup", "CORP\\LAPTOP-001$", "CORP\\WK-003$",
  ];
  const templates = ["Computer", "User", "Web Server", "Domain Controller", "Workstation Authentication"];
  const issued = Array.from({ length: 50 }, (_, i) => ({
    reqId: 1000 + i,
    requester: requesters[i % requesters.length],
    certHash: Array.from({ length: 20 }, () => Math.floor((i * 37 + 13) % 256).toString(16).padStart(2, "0")).join(" "),
    template: templates[i % templates.length],
    effective: "2025-06-01",
    expiration: "2026-06-01",
    cn: requesters[i % requesters.length].split("\\")[1],
    email: `${requesters[i % requesters.length].split("\\")[1].replace("$", "")}@corp.cloudlab.local`,
    serial: (100000 + i * 7).toString(16).toUpperCase(),
    dn: `CN=${requesters[i % requesters.length].split("\\")[1]}, DC=corp, DC=cloudlab, DC=local`,
    status: "Issued" as const,
  }));
  const revoked = Array.from({ length: 8 }, (_, i) => ({
    ...issued[i],
    reqId: 900 + i,
    status: "Revoked" as const,
    revokeReason: ["Superseded", "Cessation of Operation", "Key Compromise", "Affiliation Changed"][i % 4],
  }));
  const pending = Array.from({ length: 3 }, (_, i) => ({
    ...issued[i],
    reqId: 1100 + i,
    status: "Pending" as const,
  }));
  const failed = Array.from({ length: 4 }, (_, i) => ({
    ...issued[i],
    reqId: 1200 + i,
    status: "Failed" as const,
  }));
  return [...issued, ...revoked, ...pending, ...failed];
}

export function freshWinServerState(): WinServerState {
  return {
    server: {
      name: "FS-FILE-01",
      fqdn: "FS-FILE-01.corp.cloudlab.local",
      os: "Windows Server 2022 Datacenter",
      build: "20348.2402",
      domain: "corp.cloudlab.local",
      workgroup: "(Domain joined)",
      ip: "10.10.0.5",
      gateway: "10.10.0.1",
      dns: ["10.10.0.5", "10.10.0.6"],
      roles: ["File Server", "DHCP Server", "WSUS", "Hyper-V", "DNS Server"],
      features: ["BitLocker", "Failover Clustering", "Windows Admin Center", "Data Deduplication"],
      memoryGB: 64,
      cpu: "Intel Xeon Gold 6248R @ 3.00GHz (2 sockets, 24 cores)",
      uptime: "17d 4h 21m",
      firewall: { domain: "On", private: "On", public: "On" },
      rdp: "Enabled",
      remoteMgmt: "Enabled",
      timezone: "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi",
      lastUpdated: "2026-04-12",
      ieEsc: "On",
      customerExperience: "Not participating",
    },
    hyperv: {
      host: {
        name: "FS-FILE-01",
        defaultVmFolder: "F:\\Hyper-V\\Virtual Machines",
        defaultVhdFolder: "F:\\Hyper-V\\Virtual Hard Disks",
        liveMigrationEnabled: true,
        maxLiveMigrations: 2,
        storageMigrations: 2,
        numaSpanning: true,
        enhancedSession: true,
        replicationEnabled: true,
      },
      vms: [
        {
          id: "vm-1", name: "WK-DEV-01", os: "Windows 11 Pro 23H2", generation: 2,
          state: "Running", cpuUsage: "4%", memoryAssigned: 4096, memoryStartup: 4096,
          memoryDynamic: true, memoryMin: 1024, memoryMax: 8192, memoryWeight: "Medium",
          vCpus: 2, uptime: "3d 11h", status: "Operating normally",
          secureBoot: true, tpmEnabled: true, integrationServices: "Up to date",
          checkpoints: [
            { id: "cp-1", name: "Before VS install", created: "2026-04-08T11:20:00Z", parent: null },
            { id: "cp-2", name: "Pre-update", created: "2026-04-11T08:05:00Z", parent: "cp-1" },
          ],
          checkpointType: "Production",
          disks: [{ ctrl: "SCSI 0", lun: 0, path: "F:\\Hyper-V\\Virtual Hard Disks\\WK-DEV-01.vhdx", sizeGB: 80 }],
          network: { switch: "External-Production", vlan: 0, macSpoofing: false, macAddress: "00-15-5D-01-0A-01" },
          dvd: { path: "" },
          replication: { enabled: false },
          autoStart: "Always start automatically", autoStop: "Save state",
          smartPaging: "F:\\Hyper-V\\SmartPaging",
          notes: "Developer workstation - Visual Studio 2022",
        },
        {
          id: "vm-2", name: "SVR-WEB-01", os: "Windows Server 2022 Standard", generation: 2,
          state: "Running", cpuUsage: "12%", memoryAssigned: 8192, memoryStartup: 8192,
          memoryDynamic: false, memoryMin: 4096, memoryMax: 16384, memoryWeight: "High",
          vCpus: 4, uptime: "11d 6h", status: "Operating normally",
          secureBoot: true, tpmEnabled: false, integrationServices: "Up to date",
          checkpoints: [], checkpointType: "Standard",
          disks: [
            { ctrl: "SCSI 0", lun: 0, path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-WEB-01-OS.vhdx", sizeGB: 100 },
            { ctrl: "SCSI 0", lun: 1, path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-WEB-01-Data.vhdx", sizeGB: 250 },
          ],
          network: { switch: "External-Production", vlan: 0, macSpoofing: false, macAddress: "00-15-5D-01-0A-02" },
          dvd: { path: "" },
          replication: { enabled: false },
          autoStart: "Always start automatically", autoStop: "Shut down",
          smartPaging: "F:\\Hyper-V\\SmartPaging",
          notes: "IIS 10 + .NET 8 web front end",
        },
        {
          id: "vm-3", name: "SVR-DB-01", os: "Windows Server 2022 Datacenter", generation: 2,
          state: "Running", cpuUsage: "23%", memoryAssigned: 16384, memoryStartup: 16384,
          memoryDynamic: false, memoryMin: 8192, memoryMax: 32768, memoryWeight: "High",
          vCpus: 8, uptime: "21d 2h", status: "Operating normally",
          secureBoot: true, tpmEnabled: true, integrationServices: "Up to date",
          checkpoints: [{ id: "cp-3", name: "Pre SQL CU upgrade", created: "2026-03-29T14:00:00Z", parent: null }],
          checkpointType: "Production",
          disks: [
            { ctrl: "SCSI 0", lun: 0, path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-DB-01-OS.vhdx", sizeGB: 120 },
            { ctrl: "SCSI 0", lun: 1, path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-DB-01-Data.vhdx", sizeGB: 1024 },
            { ctrl: "SCSI 0", lun: 2, path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-DB-01-Logs.vhdx", sizeGB: 256 },
          ],
          network: { switch: "External-Production", vlan: 0, macSpoofing: false, macAddress: "00-15-5D-01-0A-03" },
          dvd: { path: "" },
          replication: { enabled: true, replicaServer: "FS-FILE-02", frequencySec: 300, healthState: "Normal" },
          autoStart: "Always start automatically", autoStop: "Shut down",
          smartPaging: "F:\\Hyper-V\\SmartPaging",
          notes: "SQL Server 2022 Enterprise - production database",
        },
        {
          id: "vm-4", name: "LINUX-APP-01", os: "Ubuntu 22.04 LTS", generation: 2,
          state: "Off", cpuUsage: "0%", memoryAssigned: 4096, memoryStartup: 4096,
          memoryDynamic: true, memoryMin: 1024, memoryMax: 8192, memoryWeight: "Medium",
          vCpus: 2, uptime: "-", status: "Saved state",
          secureBoot: false, tpmEnabled: false, integrationServices: "linux-tools-virtual",
          checkpoints: [], checkpointType: "Standard",
          disks: [{ ctrl: "SCSI 0", lun: 0, path: "F:\\Hyper-V\\Virtual Hard Disks\\LINUX-APP-01.vhdx", sizeGB: 60 }],
          network: { switch: "Internal-Test", vlan: 100, macSpoofing: true, macAddress: "00-15-5D-01-0A-04" },
          dvd: { path: "" },
          replication: { enabled: false },
          autoStart: "Nothing", autoStop: "Save state",
          smartPaging: "F:\\Hyper-V\\SmartPaging",
          notes: "Application server (Node.js + nginx)",
        },
        {
          id: "vm-5", name: "WK-TEST-01", os: "Windows 10 Enterprise 22H2", generation: 1,
          state: "Paused", cpuUsage: "0%", memoryAssigned: 4096, memoryStartup: 4096,
          memoryDynamic: false, memoryMin: 4096, memoryMax: 4096, memoryWeight: "Medium",
          vCpus: 2, uptime: "0d 1h", status: "Paused",
          secureBoot: false, tpmEnabled: false, integrationServices: "Up to date",
          checkpoints: [], checkpointType: "Standard",
          disks: [{ ctrl: "IDE 0", lun: 0, path: "F:\\Hyper-V\\Virtual Hard Disks\\WK-TEST-01.vhdx", sizeGB: 80 }],
          network: { switch: "Private-Lab", vlan: 0, macSpoofing: false, macAddress: "00-15-5D-01-0A-05" },
          dvd: { path: "" },
          replication: { enabled: false },
          autoStart: "Nothing", autoStop: "Shut down",
          smartPaging: "F:\\Hyper-V\\SmartPaging",
          notes: "Application compatibility testing",
        },
      ],
      switches: [
        { name: "External-Production", type: "External", nic: "Intel I350 Gigabit", shareMgmtOs: true, vlanId: 0 },
        { name: "Internal-Test", type: "Internal", vlanId: 100 },
        { name: "Private-Lab", type: "Private", vlanId: 0 },
      ],
      vhds: [
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\WK-DEV-01.vhdx", format: "VHDX", type: "Dynamic", sizeGB: 80, used: 42 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-WEB-01-OS.vhdx", format: "VHDX", type: "Fixed", sizeGB: 100, used: 64 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-WEB-01-Data.vhdx", format: "VHDX", type: "Dynamic", sizeGB: 250, used: 88 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-DB-01-OS.vhdx", format: "VHDX", type: "Fixed", sizeGB: 120, used: 80 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-DB-01-Data.vhdx", format: "VHDX", type: "Fixed", sizeGB: 1024, used: 612 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\SVR-DB-01-Logs.vhdx", format: "VHDX", type: "Dynamic", sizeGB: 256, used: 92 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\LINUX-APP-01.vhdx", format: "VHDX", type: "Dynamic", sizeGB: 60, used: 22 },
        { path: "F:\\Hyper-V\\Virtual Hard Disks\\WK-TEST-01.vhdx", format: "VHDX", type: "Dynamic", sizeGB: 80, used: 36 },
      ],
      isoLibrary: [
        "D:\\ISO\\en-us_windows_server_2022.iso",
        "D:\\ISO\\en-us_windows_11_23h2.iso",
        "D:\\ISO\\ubuntu-22.04.4-live-server-amd64.iso",
        "D:\\ISO\\SQLServer2022-x64.iso",
      ],
    },
    fileshare: {
      volumes: [
        { letter: "C:", label: "System", capacityGB: 200, freeGB: 78, fileSystem: "NTFS", dedup: false, allocationKB: 4 },
        { letter: "D:", label: "Data", capacityGB: 4096, freeGB: 1822, fileSystem: "NTFS", dedup: true, allocationKB: 64 },
        { letter: "E:", label: "Backup", capacityGB: 8192, freeGB: 5210, fileSystem: "ReFS", dedup: false, allocationKB: 64 },
        { letter: "F:", label: "Hyper-V", capacityGB: 2048, freeGB: 612, fileSystem: "NTFS", dedup: false, allocationKB: 64 },
      ],
      disks: [
        { num: 0, status: "Online", capacityGB: 240, partitions: 1, bus: "SATA", model: "Samsung SSD 870 240GB", mbr: "GPT" },
        { num: 1, status: "Online", capacityGB: 4096, partitions: 1, bus: "SAS", model: "Seagate Exos X16", mbr: "GPT" },
        { num: 2, status: "Online", capacityGB: 8192, partitions: 1, bus: "SAS", model: "Seagate Exos X18", mbr: "GPT" },
        { num: 3, status: "Online", capacityGB: 2048, partitions: 1, bus: "NVMe", model: "Intel P4610 NVMe SSD", mbr: "GPT" },
      ],
      shares: [
        { name: "Public", path: "D:\\Shares\\Public", type: "SMB", remote: "\\\\FS-FILE-01\\Public", perms: [{ principal: "Everyone", access: "Read" }], abe: false, caching: true, encrypt: false, ca: false, quotaGB: 0, sizeGB: 18 },
        { name: "Engineering", path: "D:\\Shares\\Engineering", type: "SMB", remote: "\\\\FS-FILE-01\\Engineering", perms: [{ principal: "Eng-Team", access: "Modify" }, { principal: "IT-Admins", access: "Full Control" }], abe: true, caching: true, encrypt: true, ca: false, quotaGB: 500, sizeGB: 312 },
        { name: "Finance$", path: "D:\\Shares\\Finance", type: "SMB", remote: "\\\\FS-FILE-01\\Finance$", perms: [{ principal: "Finance-Mgrs", access: "Modify" }, { principal: "IT-Admins", access: "Full Control" }], abe: true, caching: false, encrypt: true, ca: false, quotaGB: 200, sizeGB: 88 },
        { name: "Sales", path: "D:\\Shares\\Sales", type: "SMB", remote: "\\\\FS-FILE-01\\Sales", perms: [{ principal: "Sales-Team", access: "Modify" }, { principal: "IT-Admins", access: "Full Control" }], abe: true, caching: true, encrypt: false, ca: false, quotaGB: 300, sizeGB: 142 },
        { name: "IT", path: "D:\\Shares\\IT", type: "SMB", remote: "\\\\FS-FILE-01\\IT", perms: [{ principal: "IT-Admins", access: "Full Control" }], abe: false, caching: true, encrypt: true, ca: false, quotaGB: 0, sizeGB: 56 },
        { name: "Profiles$", path: "D:\\Profiles", type: "SMB", remote: "\\\\FS-FILE-01\\Profiles$", perms: [{ principal: "Domain Users", access: "Modify" }], abe: true, caching: false, encrypt: false, ca: false, quotaGB: 0, sizeGB: 220 },
        { name: "RedirectedFolders$", path: "D:\\RedirectedFolders", type: "SMB", remote: "\\\\FS-FILE-01\\RedirectedFolders$", perms: [{ principal: "Domain Users", access: "Modify" }], abe: true, caching: false, encrypt: false, ca: false, quotaGB: 0, sizeGB: 410 },
      ],
      iscsiTargets: [
        { name: "iqn.1991-05.com.microsoft:fs-file-01-target-01", status: "Connected", initiators: ["iqn.1991-05.com.microsoft:hv-host-01"], luns: 2 },
        { name: "iqn.1991-05.com.microsoft:fs-file-01-backup-target", status: "Idle", initiators: [], luns: 1 },
      ],
      storagePools: [
        {
          name: "Storage-Pool-1", status: "OK", physicalDisks: 12, capacityTB: 96, freeTB: 38,
          virtualDisks: [
            { name: "VD-Mirror", resiliency: "Mirror", sizeTB: 16, used: "Allocated", status: "OK" },
            { name: "VD-Parity", resiliency: "Parity", sizeTB: 24, used: "Allocated", status: "OK" },
            { name: "VD-Simple", resiliency: "Simple", sizeTB: 18, used: "Allocated", status: "OK" },
          ],
        },
      ],
      quotas: [
        { path: "D:\\Shares\\Engineering", sizeGB: 500, kind: "Hard", used: 312, notify: [85, 95, 100] },
        { path: "D:\\Shares\\Finance", sizeGB: 200, kind: "Hard", used: 88, notify: [85, 95, 100] },
        { path: "D:\\Shares\\Sales", sizeGB: 300, kind: "Soft", used: 142, notify: [85, 95, 100] },
      ],
      fileScreens: [
        { path: "D:\\Shares\\Engineering", screen: "Block Audio and Video", extensions: [".mp3", ".mp4", ".mov", ".avi"], type: "Active" },
        { path: "D:\\Shares\\Sales", screen: "Block Executable", extensions: [".exe", ".bat", ".cmd"], type: "Passive" },
        { path: "D:\\Shares\\Public", screen: "Block Torrents", extensions: [".torrent"], type: "Active" },
      ],
    },
    dhcp: {
      serverFqdn: "FS-FILE-01.corp.cloudlab.local",
      authorized: true,
      scopes: [
        {
          id: "sc-1", name: "LAN", subnet: "10.10.0.0", mask: "255.255.255.0", cidr: 24,
          startIp: "10.10.0.50", endIp: "10.10.0.200",
          exclusions: [{ start: "10.10.0.1", end: "10.10.0.49" }],
          leaseDays: 8, leaseHours: 0, leaseMinutes: 0, active: true, description: "Corporate LAN",
          options: {
            "003 Router": "10.10.0.1",
            "006 DNS Servers": "10.10.0.5, 10.10.0.6",
            "015 DNS Domain Name": "corp.cloudlab.local",
            "044 WINS/NBNS Servers": "",
            "046 WINS/NBT Node Type": "0x8 (H-node)",
          },
        },
        {
          id: "sc-2", name: "DMZ", subnet: "10.20.0.0", mask: "255.255.255.0", cidr: 24,
          startIp: "10.20.0.50", endIp: "10.20.0.100",
          exclusions: [{ start: "10.20.0.1", end: "10.20.0.49" }],
          leaseDays: 0, leaseHours: 4, leaseMinutes: 0, active: true, description: "DMZ network",
          options: { "003 Router": "10.20.0.1", "006 DNS Servers": "10.20.0.5", "015 DNS Domain Name": "dmz.cloudlab.local" },
        },
        {
          id: "sc-3", name: "Guest-WiFi", subnet: "10.30.0.0", mask: "255.255.255.0", cidr: 24,
          startIp: "10.30.0.10", endIp: "10.30.0.250",
          exclusions: [],
          leaseDays: 0, leaseHours: 2, leaseMinutes: 0, active: true, description: "Guest Wi-Fi network",
          options: { "003 Router": "10.30.0.1", "006 DNS Servers": "8.8.8.8, 1.1.1.1", "015 DNS Domain Name": "guest.cloudlab.local" },
        },
      ],
      serverOptions: { "015 DNS Domain Name": "corp.cloudlab.local", "006 DNS Servers": "10.10.0.5, 10.10.0.6", "060 PXEClient": "PXEClient" },
      leases: seedLeases(),
      reservations: [
        { scopeId: "sc-1", ip: "10.10.0.51", mac: "00-1B-78-AC-12-01", name: "PRN-FLOOR1.corp.cloudlab.local", description: "HP LaserJet floor 1", type: "Both" },
        { scopeId: "sc-1", ip: "10.10.0.52", mac: "00-1B-78-AC-12-02", name: "PRN-FLOOR2.corp.cloudlab.local", description: "HP LaserJet floor 2", type: "Both" },
        { scopeId: "sc-1", ip: "10.10.0.53", mac: "00-1B-78-AC-12-03", name: "PRN-FINANCE.corp.cloudlab.local", description: "Finance printer", type: "Both" },
        { scopeId: "sc-1", ip: "10.10.0.54", mac: "00-15-5D-22-11-11", name: "CONF-ROOM-A.corp.cloudlab.local", description: "Conf room A display", type: "Both" },
        { scopeId: "sc-1", ip: "10.10.0.60", mac: "00-15-5D-22-11-22", name: "PRN-SCANNER.corp.cloudlab.local", description: "Multifunction scanner", type: "Both" },
        { scopeId: "sc-2", ip: "10.20.0.51", mac: "00-15-5D-33-11-01", name: "WEB-EDGE-01.dmz.cloudlab.local", description: "Edge web server", type: "Both" },
        { scopeId: "sc-2", ip: "10.20.0.52", mac: "00-15-5D-33-11-02", name: "WEB-EDGE-02.dmz.cloudlab.local", description: "Edge web server", type: "Both" },
        { scopeId: "sc-3", ip: "10.30.0.11", mac: "00-15-5D-44-11-01", name: "GUEST-DISPLAY-LOBBY.cloudlab.local", description: "Lobby kiosk", type: "Both" },
      ],
      policies: [
        {
          name: "VoIP-Phones", scopeId: "sc-1",
          conditions: [{ type: "Vendor Class", op: "Equals", value: "Cisco-Phone" }],
          actions: { ipRange: "10.10.0.180-10.10.0.200", options: { "003 Router": "10.10.0.1", "042 NTP Servers": "10.10.0.5" } },
          enabled: true,
        },
      ],
      filters: { allow: [], deny: [{ mac: "00-AA-BB-CC-DD-EE", description: "Blocked legacy device" }] },
    },
    wsus: {
      server: "FS-FILE-01",
      version: "10.0.20348.169",
      lastSync: "2026-04-12T02:00:00Z",
      nextSync: "2026-04-13T02:00:00Z",
      syncSchedule: { mode: "Daily", time: "02:00", perDay: 1 },
      updateSource: { mode: "Microsoft Update", upstreamServer: "", useSsl: false },
      proxyServer: { enabled: false, host: "", port: 80 },
      products: [
        { name: "Windows Server 2022", selected: true, parent: "Windows" },
        { name: "Windows Server 2019", selected: true, parent: "Windows" },
        { name: "Windows 11", selected: true, parent: "Windows" },
        { name: "Windows 10", selected: true, parent: "Windows" },
        { name: "Microsoft Edge", selected: true, parent: "Browsers" },
        { name: "Office 2021", selected: true, parent: "Office" },
        { name: "Microsoft 365 Apps", selected: true, parent: "Office" },
        { name: "SQL Server 2022", selected: true, parent: "SQL Server" },
        { name: "SQL Server 2019", selected: false, parent: "SQL Server" },
        { name: "Visual Studio 2022", selected: false, parent: "Developer Tools" },
      ],
      classifications: [
        { name: "Critical Updates", selected: true },
        { name: "Security Updates", selected: true },
        { name: "Definition Updates", selected: true },
        { name: "Cumulative Updates", selected: true },
        { name: "Servicing Stack Updates", selected: true },
        { name: "Update Rollups", selected: true },
        { name: "Updates", selected: true },
        { name: "Drivers", selected: false },
        { name: "Feature Packs", selected: false },
        { name: "Service Packs", selected: false },
        { name: "Tools", selected: false },
        { name: "Upgrades", selected: false },
      ],
      computerGroups: [
        { name: "All Computers", protected: true },
        { name: "Unassigned Computers", protected: true },
        { name: "Domain Controllers", protected: false },
        { name: "Servers - Tier 1", protected: false },
        { name: "Servers - Tier 0 (PAW + DCs)", protected: false },
        { name: "Workstations - Pilot Ring", protected: false },
        { name: "Workstations - Ring 2", protected: false },
        { name: "Workstations - Broad", protected: false },
        { name: "Executives - delayed ring", protected: false },
        { name: "Branch - Bengaluru", protected: false },
        { name: "Branch - Hyderabad", protected: false },
      ],
      updates: seedUpdates(),
      computers: seedWsusComputers(),
      syncHistory: [
        { started: "2026-04-12T02:00:00Z", finished: "2026-04-12T02:14:11Z", result: "Succeeded", newUpdates: 12 },
        { started: "2026-04-11T02:00:00Z", finished: "2026-04-11T02:11:32Z", result: "Succeeded", newUpdates: 8 },
        { started: "2026-04-10T02:00:00Z", finished: "2026-04-10T02:13:09Z", result: "Succeeded", newUpdates: 5 },
      ],
      emailNotifications: { enabled: false, smtpHost: "", smtpPort: 25, recipients: "" },
      updateFiles: { storeLocally: true, expressInstallation: false, languagesAll: false, languages: ["English"] },
      autoApprove: [{ rule: "Critical & Security updates", classifications: ["Critical Updates", "Security Updates", "Definition Updates"], groups: ["Workstations"], enabled: true }],
    },
    adcs: {
      caName: "CORP-FS-FILE-01-CA",
      caFqdn: "FS-FILE-01.corp.cloudlab.local",
      serviceStatus: "Running",
      certs: seedCerts(),
      templates: seedCertTemplates(),
      enrollmentAgents: ["CORP\\asharma", "CORP\\admin"],
      crl: { lastBasePublish: "2026-04-10T06:00:00Z", lastDeltaPublish: "2026-04-13T06:00:00Z", intervalHours: 168 },
    },
    failover: {
      clusterName: "CLUSTER-PROD",
      clusterFqdn: "cluster-prod.corp.cloudlab.local",
      quorumType: "Node Majority with Witness (File Share Witness)",
      roles: [
        { name: "FileServer-Role", status: "Running", type: "File Server", ownerNode: "NODE01", priority: "High", autoStart: true },
        { name: "SOFS-Role", status: "Running", type: "Scale-Out File Server", ownerNode: "NODE02", priority: "High", autoStart: true },
        { name: "SQL-VM-01", status: "Running", type: "Virtual Machine", ownerNode: "NODE01", priority: "Medium", autoStart: true },
        { name: "Web-VM-01", status: "Running", type: "Virtual Machine", ownerNode: "NODE03", priority: "Medium", autoStart: true },
        { name: "DHCP-Role", status: "Running", type: "DHCP Server", ownerNode: "NODE02", priority: "Medium", autoStart: true },
        { name: "MSDTC-Role", status: "Stopped", type: "Distributed Transaction Coordinator", ownerNode: "NODE01", priority: "Low", autoStart: false },
      ],
      nodes: [
        { name: "NODE01", status: "Up", site: "HQ", uptime: "42d 6h", os: "Windows Server 2022 Datacenter" },
        { name: "NODE02", status: "Up", site: "HQ", uptime: "42d 6h", os: "Windows Server 2022 Datacenter" },
        { name: "NODE03", status: "Up", site: "DR-Singapore", uptime: "18d 2h", os: "Windows Server 2022 Datacenter" },
      ],
      disks: [
        { name: "Cluster Disk 1", status: "Online", owner: "NODE01", capacityGB: 100, freeGB: 40, pool: "Storage-Pool-1", role: "Quorum" },
        { name: "Cluster Disk 2", status: "Online", owner: "NODE02", capacityGB: 2048, freeGB: 900, pool: "Storage-Pool-1", role: "CSV-Volume-1" },
        { name: "Cluster Disk 3", status: "Online", owner: "NODE03", capacityGB: 2048, freeGB: 1100, pool: "Storage-Pool-1", role: "CSV-Volume-2" },
      ],
      pools: [{ name: "Storage-Pool-1", disks: 8, capacityTB: 20 }],
      networks: [
        { name: "Cluster Network 1", subnets: ["10.10.5.0/24"], role: "Cluster and Client", state: "Up" },
        { name: "Cluster Network 2", subnets: ["10.10.6.0/24"], role: "Cluster Only", state: "Up" },
        { name: "Cluster Network 3 (iSCSI)", subnets: ["10.10.7.0/24"], role: "Disabled", state: "Up" },
      ],
      events: [
        { level: "Information", time: "2026-04-13T02:00:00Z", id: "1641", source: "Microsoft-Windows-FailoverClustering", summary: "Cluster service started successfully." },
        { level: "Warning", time: "2026-04-12T22:15:00Z", id: "1177", source: "Microsoft-Windows-FailoverClustering", summary: "Node NODE03 lost communication with cluster; attempting to reconnect." },
        { level: "Critical", time: "2026-04-12T22:16:00Z", id: "1135", source: "Microsoft-Windows-FailoverClustering", summary: "Node NODE03 was removed from the active failover cluster membership." },
        { level: "Information", time: "2026-04-12T22:20:00Z", id: "1657", source: "Microsoft-Windows-FailoverClustering", summary: "Node NODE03 rejoined the cluster." },
        { level: "Information", time: "2026-04-12T22:21:00Z", id: "1205", source: "Microsoft-Windows-FailoverClustering", summary: "Roles previously owned by NODE03 were failed back." },
        { level: "Information", time: "2026-04-13T06:00:00Z", id: "1230", source: "Microsoft-Windows-FailoverClustering", summary: "Cluster validation completed with no errors." },
      ],
    },
    rras: {
      enabled: true,
      interfaces: [
        { name: "Internal", type: "Internal", status: "Up", ip: "10.10.0.5", mask: "255.255.255.0", description: "RRAS internal loopback interface" },
        { name: "Internet", type: "LAN", status: "Up", ip: "203.0.113.5", mask: "255.255.255.0", description: "Internet-facing NIC" },
        { name: "Loopback", type: "LAN", status: "Up", ip: "127.0.0.1", mask: "255.0.0.0", description: "Loopback Pseudo-Interface" },
        { name: "Branch-VPN-Tunnel", type: "Demand-dial", status: "Connected", ip: "10.50.0.1", mask: "255.255.255.252", description: "Site-to-site VPN to Branch office" },
      ],
      routesV4: [
        { destination: "0.0.0.0", mask: "0.0.0.0", gateway: "203.0.113.1", interfaceName: "Internet", metric: 1 },
        { destination: "10.50.0.0", mask: "255.255.0.0", gateway: "10.50.0.1", interfaceName: "Branch-VPN-Tunnel", metric: 5 },
      ],
      routesV6: [],
      nat: {
        enabled: true,
        publicInterface: "Internet",
        privateInterface: "Internal",
        addressPool: "203.0.113.10 - 203.0.113.20",
        mappings: [
          { protocol: "TCP", publicPort: 443, privateAddr: "10.10.0.5", privatePort: 443, description: "HTTPS to web server" },
          { protocol: "TCP", publicPort: 3389, privateAddr: "10.10.0.20", privatePort: 3389, description: "RDP to jump box" },
        ],
      },
      dhcpRelay: { serverIps: ["10.10.0.5", "10.10.0.6"], interfaces: ["Internal"], bootThreshold: 4, maxHops: 4 },
      logging: { localFile: true, path: "C:\\Windows\\System32\\LogFiles\\RRAS", mode: "Windows Accounting" },
      vpnClients: [
        { user: "CORP\\jdoe", ip: "10.50.1.20", protocol: "IKEv2", duration: "1h 12m", bytesIn: 452000, bytesOut: 118000, connectedAt: "2026-04-13T06:30:00Z" },
        { user: "CORP\\ksmith", ip: "10.50.1.21", protocol: "SSTP", duration: "0h 34m", bytesIn: 88000, bytesOut: 22000, connectedAt: "2026-04-13T07:08:00Z" },
        { user: "CORP\\asharma", ip: "10.50.1.22", protocol: "IKEv2", duration: "3h 02m", bytesIn: 1240000, bytesOut: 340000, connectedAt: "2026-04-13T04:40:00Z" },
      ],
    },
    printserver: {
      printers: [
        { name: "PRN-FLOOR1", status: "Ready", jobsCount: 0, driver: "HP Universal Printing PCL 6", port: "IP_10.10.0.51", shareName: "PRN-FLOOR1", location: "Floor 1", comments: "HP LaserJet M507", color: false, jobs: [] },
        { name: "PRN-FLOOR2", status: "Printing", jobsCount: 2, driver: "HP Universal Printing PCL 6", port: "IP_10.10.0.52", shareName: "PRN-FLOOR2", location: "Floor 2", comments: "HP LaserJet M507", color: false, jobs: [
          { id: "j-1", document: "Q1-Report.docx", pages: 12, sizeKB: 820, status: "Printing", owner: "CORP\\ksmith", submitted: "2026-04-13T07:40:00Z" },
          { id: "j-2", document: "Invoice-4521.pdf", pages: 2, sizeKB: 140, status: "Spooling", owner: "CORP\\suresh", submitted: "2026-04-13T07:41:00Z" },
        ] },
        { name: "PRN-FINANCE", status: "Toner Low", jobsCount: 0, driver: "Konica Minolta Universal PCL", port: "IP_10.10.0.53", shareName: "PRN-FINANCE", location: "Finance Dept", comments: "Konica Minolta bizhub C300i", color: true, jobs: [] },
        { name: "PRN-COLOR-01", status: "Ready", jobsCount: 0, driver: "Xerox Global Print Driver PS", port: "IP_10.10.0.55", shareName: "PRN-COLOR-01", location: "Marketing", comments: "Xerox VersaLink C405", color: true, jobs: [] },
        { name: "PRN-SCANNER", status: "Ready", jobsCount: 0, driver: "Canon Generic Plus PCL6", port: "IP_10.10.0.60", shareName: "PRN-SCANNER", location: "Floor 1", comments: "Canon imageRUNNER ADVANCE", color: false, jobs: [] },
        { name: "PRN-WAREHOUSE", status: "Offline", jobsCount: 1, driver: "Lexmark Universal v2", port: "IP_10.10.0.61", shareName: "PRN-WAREHOUSE", location: "Warehouse", comments: "Lexmark MS621dn", color: false, jobs: [
          { id: "j-3", document: "Shipping-Labels.pdf", pages: 40, sizeKB: 300, status: "Error - Printer offline", owner: "CORP\\karan", submitted: "2026-04-13T06:00:00Z" },
        ] },
        { name: "PRN-EXEC", status: "Ready", jobsCount: 0, driver: "Microsoft PS Class Driver", port: "IP_10.10.0.62", shareName: "PRN-EXEC", location: "Executive Suite", comments: "HP Color LaserJet Enterprise M555", color: true, jobs: [] },
        { name: "PRN-HR", status: "Out of Paper", jobsCount: 0, driver: "HP Universal Printing PCL 6", port: "IP_10.10.0.63", shareName: "PRN-HR", location: "HR Dept", comments: "HP LaserJet M507", color: false, jobs: [] },
      ],
      drivers: [
        { provider: "HP", name: "HP Universal Printing PCL 6", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\hpcu270u.inf" },
        { provider: "Konica Minolta", name: "Konica Minolta Universal PCL", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\kmuniv.inf" },
        { provider: "Xerox", name: "Xerox Global Print Driver PS", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\xrxgpdps.inf" },
        { provider: "Canon", name: "Canon Generic Plus PCL6", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\cnpp6m.inf" },
        { provider: "Lexmark", name: "Lexmark Universal v2", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\lexuniv2.inf" },
        { provider: "Microsoft", name: "Microsoft PS Class Driver", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\mspsdrv.inf" },
        { provider: "HP", name: "HP Universal Printing PS", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\hpcups.inf" },
        { provider: "Brother", name: "Brother Universal Printer Driver", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\bruniv.inf" },
        { provider: "Epson", name: "Epson Universal Print Driver", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\epuniv.inf" },
        { provider: "Ricoh", name: "Ricoh PCL6 UniversalDriver", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\ricpcl6.inf" },
        { provider: "Kyocera", name: "Kyocera TASKalfa Universal", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\kytask.inf" },
        { provider: "Microsoft", name: "Microsoft IPP Class Driver", environment: "Windows x64", infPath: "C:\\Windows\\System32\\DriverStore\\mxdwdrv.inf" },
      ],
      forms: [
        { name: "Letter", widthMm: 215.9, heightMm: 279.4, builtIn: true },
        { name: "Legal", widthMm: 215.9, heightMm: 355.6, builtIn: true },
        { name: "A4", widthMm: 210.0, heightMm: 297.0, builtIn: true },
        { name: "A3", widthMm: 297.0, heightMm: 420.0, builtIn: true },
        { name: "Envelope #10", widthMm: 104.8, heightMm: 241.3, builtIn: true },
        { name: "Shipping Label 4x6", widthMm: 101.6, heightMm: 152.4, builtIn: false },
        { name: "Finance Cheque", widthMm: 216.0, heightMm: 92.0, builtIn: false },
      ],
      ports: [
        { name: "IP_10.10.0.51", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.52", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.53", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.55", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.60", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.61", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.62", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "IP_10.10.0.63", description: "Standard TCP/IP Port", type: "TCP/IP" },
        { name: "WSD-a1b2c3", description: "WSD Port", type: "WSD" },
        { name: "LPT1:", description: "Printer Port", type: "Local" },
        { name: "FILE:", description: "Print to File", type: "Local" },
        { name: "LPR_192.168.100.5", description: "LPR Port", type: "LPR" },
      ],
    },
    activity: [],
  };
}
