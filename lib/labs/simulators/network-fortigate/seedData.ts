import type {
  FortiAddress,
  FortiAddressGroup,
  FortiAdminProfile,
  FortiAdministrator,
  FortiAppControlProfile,
  FortiAvProfile,
  FortiCanonicalDevice,
  FortiDlpProfile,
  FortiDnsFilterProfile,
  FortiEventLogEntry,
  FortiFileFilterProfile,
  FortiForwardLogEntry,
  FortiGateState,
  FortiInterface,
  FortiIpPool,
  FortiIpsecTunnel,
  FortiIpsProfile,
  FortiLdapServer,
  FortiLocalUser,
  FortiPolicy,
  FortiPolicyRoute,
  FortiRadiusServer,
  FortiSchedule,
  FortiService,
  FortiServiceGroup,
  FortiSslProfile,
  FortiSslVpnPortal,
  FortiStaticRoute,
  FortiSystem,
  FortiTenant,
  FortiUserGroup,
  FortiVip,
  FortiVpnUser,
  FortiWafProfile,
  FortiWebCategoryGroup,
  FortiWebFilterProfile,
  FortiZone,
} from "./types";

// Note: source (fortigate-data.js) uses ZERO randomness anywhere — `defaults()` is a
// fully static seed object, and `seedForwardLogs()`/`seedEventLogs()` are pure
// index-driven formulas (t = now - i*73000 / i*412000, srcPort/dstPort/proto cycling
// through fixed arrays by `i % length`). No LCG/seeded-PRNG convention is needed in
// this file — ported 1:1, verbatim formulas, no Math.random() anywhere.

// All timestamps are derived from a single fixed "now" baseline rather than
// Date.now()/new Date() at module scope (per the no-wall-clock-in-seed-files rule),
// matching source's own embedded static `system.systemTime` value and the convention
// established in the Cisco port's seedData.ts.
const NOW_MS = Date.UTC(2026, 4, 14, 9, 42, 18); // 2026-05-14 09:42:18 UTC (matches system.systemTime)

function isoDate(offsetMs: number): string {
  return new Date(NOW_MS - offsetMs).toISOString().slice(0, 10);
}
function isoTime(offsetMs: number): string {
  return new Date(NOW_MS - offsetMs).toISOString().slice(11, 19);
}

// ===================================================================
// CloudLab Inc. shared roster convention — same fictional continuity used across
// every prior port (Cisco/Meraki/M365/Power Platform/etc). Source's
// `applyCanonical()` reads `CloudLabInfra.INFRA.networkDevices` (filtered
// `vendor === 'Fortinet'`), `CloudLabInfra.SITES`, `CloudLabInfra.TENANT`, and
// `CloudLabInfra.USERS` (filtered to `officeLocation === 'RM-Pune' || id in
// {kiran,pooja,karthik}`) from a shared cloudlab-infra.js this Next.js app does not
// have; we replicate the EFFECT by hardcoding an equivalent roster inline here rather
// than a separate merge-after-load step, since this is a fresh TS port with no
// localStorage legacy state to reconcile against. Source also overwrites
// `state.system.hostname` with the first canonical Fortinet device's name in
// `applyCanonical()` — replicated here by seeding `system.hostname` directly with
// that name (`FW-EDGE-BLR-01`, the same Bengaluru edge-firewall hostname the Cisco
// port's `CANONICAL_SWITCHES` roster already established for the edge-firewall role,
// for continuity across ports).
// ===================================================================

const TENANT_COMPANY = "CloudLab Inc.";
const TENANT_DOMAIN = "cloudlab.in";

const CANONICAL_FORTIGATES: FortiCanonicalDevice[] = [
  { name: "FW-EDGE-BLR-01", vendor: "Fortinet", mgmtIp: "203.0.113.10", site: "Bengaluru" },
];

const CANONICAL_SITES = [
  { name: "Mumbai HQ", region: "APAC", tier: "primary" },
  { name: "Bengaluru", region: "APAC", tier: "primary" },
  { name: "Hyderabad", region: "APAC", tier: "secondary" },
  { name: "Singapore-DR", region: "APAC", tier: "dr" },
  { name: "Pune", region: "APAC", tier: "secondary" },
];

const TENANT: FortiTenant = { name: TENANT_COMPANY, domain: TENANT_DOMAIN };

// Roster filtered by source to `officeLocation === 'RM-Pune' || id in {kiran,pooja,karthik}`
// mapped to `{upn, displayName, group: 'SSL-VPN-Users'}`. kiran/pooja/karthik are the
// canonical CloudLab roster members per the shared convention (see meraki/seedData.ts,
// power-platform/seedData.ts); "RM-Pune" reads as a Pune remote-office site code, so we
// add two more Pune-based roster members alongside the three named ids to replicate the
// effect of a small multi-person SSL-VPN roster.
const VPN_USERS: FortiVpnUser[] = [
  { upn: "kiran@cloudlab.in", displayName: "Kiran Desai", group: "SSL-VPN-Users" },
  { upn: "pooja@cloudlab.in", displayName: "Pooja Gupta", group: "SSL-VPN-Users" },
  { upn: "karthik@cloudlab.in", displayName: "Karthik Iyer", group: "SSL-VPN-Users" },
  { upn: "meera@cloudlab.in", displayName: "Meera Shah", group: "SSL-VPN-Users" },
  { upn: "manish@cloudlab.in", displayName: "Manish Tiwari", group: "SSL-VPN-Users" },
];

// ---------- seeded log generators (ported 1:1 from fortigate-data.js formulas) ----------

function seedForwardLogs(): FortiForwardLogEntry[] {
  const actions: FortiForwardLogEntry["action"][] = ["accept", "deny", "start", "close", "dns"];
  const srcs = ["10.1.0.45", "10.1.0.108", "10.1.0.211", "10.10.10.55", "10.2.0.5", "203.0.113.10"];
  const dsts = ["8.8.8.8", "1.1.1.1", "142.250.80.46", "13.107.42.14", "198.51.100.20", "52.96.0.10", "10.1.0.1"];
  const apps = [
    "HTTPS",
    "HTTP",
    "DNS",
    "SSH",
    "RDP",
    "SMTP",
    "Microsoft.365",
    "Google.Search",
    "YouTube",
    "Facebook",
    "Windows.Update",
  ];
  const policies = [
    "Allow-Internal-Internet",
    "DMZ-to-Internet",
    "Block-Social-Media",
    "SSL-VPN-Users-to-Internal",
    "IPsec-VPN-to-HQ",
  ];
  const dstPorts = [80, 443, 53, 22, 3389, 25];
  const samples: FortiForwardLogEntry[] = [];
  for (let i = 0; i < 50; i++) {
    const offset = i * 73000;
    samples.push({
      date: isoDate(offset),
      time: isoTime(offset),
      src: srcs[i % srcs.length],
      dst: dsts[i % dsts.length],
      srcPort: 1024 + ((i * 37) % 60000),
      dstPort: dstPorts[i % 6],
      proto: i % 3 === 0 ? "UDP" : "TCP",
      app: apps[i % apps.length],
      action: actions[i % actions.length],
      policy: policies[i % policies.length],
      sent: `${(i + 1) * 1450} B`,
      received: `${(i + 1) * 2240} B`,
    });
  }
  return samples;
}

function seedEventLogs(): FortiEventLogEntry[] {
  const rows: { type: string; level: string; msg: string }[] = [
    { type: "system", level: "notice", msg: "Admin admin logged in from 192.168.1.50" },
    { type: "system", level: "info", msg: "Config sync completed" },
    { type: "vpn", level: "notice", msg: "IPsec tunnel VPN-to-HQ phase1 negotiation success" },
    { type: "vpn", level: "notice", msg: "IPsec tunnel VPN-to-HQ phase2 negotiation success" },
    { type: "router", level: "info", msg: "BGP neighbor 198.51.100.1 established" },
    { type: "wad", level: "info", msg: "WAD process started" },
    { type: "ips", level: "warning", msg: "IPS signature SSH.Brute.Force detected from 45.155.205.233" },
    { type: "antivirus", level: "warning", msg: "AV blocked file eicar.com.txt over HTTP" },
    { type: "webfilter", level: "notice", msg: "URL facebook.com blocked by policy Block-Social-Media" },
    { type: "user", level: "notice", msg: "User vpn-user authenticated via SSL-VPN" },
    { type: "system", level: "critical", msg: "High CPU utilization 87% on FPM_OFFLOAD" },
    { type: "system", level: "notice", msg: "Firmware integrity check passed" },
  ];
  const out: FortiEventLogEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const offset = i * 412000;
    out.push({
      date: isoDate(offset),
      time: isoTime(offset),
      type: rows[i].type,
      level: rows[i].level,
      msg: rows[i].msg,
    });
  }
  return out;
}

// ---------- FortiGuard Web Filter category catalogue (static, exported standalone) ----------

export const WEB_CATEGORIES: FortiWebCategoryGroup[] = [
  { group: "Local Categories", items: ["Custom Category 1", "Custom Category 2", "Allowed", "Blocked", "Monitored"] },
  {
    group: "Potentially Liable",
    items: [
      "Drug Abuse",
      "Hacking",
      "Illegal or Unethical",
      "Discrimination",
      "Explicit Violence",
      "Extremist Groups",
      "Proxy Avoidance",
      "Plagiarism",
      "Child Abuse",
    ],
  },
  {
    group: "Adult/Mature Content",
    items: [
      "Alcohol",
      "Dating",
      "Gambling",
      "Marijuana",
      "Nudity and Risque",
      "Pornography",
      "Profanity",
      "Sex Education",
      "Tasteless",
      "Tobacco",
      "Weapons (Sales)",
      "Other Adult Materials",
    ],
  },
  {
    group: "Bandwidth Consuming",
    items: [
      "Advertising",
      "Audio Streaming",
      "Download Sites",
      "File Sharing and Storage",
      "Internet Radio and TV",
      "Internet Telephony",
      "Peer-to-peer File Sharing",
      "Streaming Media",
      "Web-based Email",
    ],
  },
  {
    group: "Security Risk",
    items: ["Malicious Websites", "Phishing", "Spam URLs", "Dynamic DNS", "Newly Observed Domain", "Newly Registered Domain"],
  },
  {
    group: "General Interest - Personal",
    items: [
      "Arts and Culture",
      "Auction",
      "Child Education",
      "Dating",
      "Education",
      "Entertainment",
      "Folklore",
      "Gambling",
      "Games",
      "Global Religion",
      "Health and Wellness",
      "Hobbies",
      "Job Search",
      "Lifestyle",
      "Medicine",
      "News and Media",
      "Personal Vehicles",
      "Personal Websites and Blogs",
      "Politics",
      "Pornography",
      "Real Estate",
      "Reference",
      "Restaurant and Dining",
      "Shopping",
      "Social Networking",
      "Society and Lifestyle",
      "Sports",
      "Streaming Media",
      "Travel",
    ],
  },
  {
    group: "General Interest - Business",
    items: [
      "Advertising",
      "Armed Forces",
      "Business",
      "Charitable Organizations",
      "Content Servers",
      "Domain Parking",
      "Dynamic Content",
      "Finance and Banking",
      "Government and Legal Organizations",
      "Information and Computer Security",
      "Information Technology",
      "Online Meeting",
      "Remote Access",
      "Search Engines and Portals",
      "Secure Websites",
      "Web Analytics",
      "Web Hosting",
      "Web-based Applications",
    ],
  },
  { group: "Unrated", items: ["Unrated"] },
];

/**
 * Builds a brand-new FortiGateState. Ports source's `defaults()` faithfully (every
 * field, exact seed values) and additionally seeds `canonicalFortigates` /
 * `canonicalSites` / `tenant` / `vpnUsers` directly (source's separate
 * `applyCanonical()` merge-after-load step has no equivalent here since there's no
 * localStorage legacy state to reconcile against — a fresh TS port just seeds these
 * correctly from the start), including overwriting `system.hostname` with the
 * canonical Fortinet device's name up front (source does this inside
 * `applyCanonical()`).
 */
export function freshFortiGateState(): FortiGateState {
  const system: FortiSystem = {
    hostname: CANONICAL_FORTIGATES[0].name, // "FW-EDGE-BLR-01" — overwritten from canonical roster, replicating applyCanonical()
    serial: "FGVM01TM23045678",
    firmware: "FortiOS v7.4.4 build 2588",
    license: "Perpetual (VM-Subscription, 8 vCPU)",
    model: "FortiGate-VM64-AZURE",
    uptime: "14d 3h 27m",
    lastRebootReason: "Manual reboot",
    systemTime: "2026-05-14 09:42:18 UTC",
    timezone: "(GMT) Greenwich Mean Time",
    cpu: 18,
    memory: 41,
    sessions: 4823,
    peakSessions: 9120,
    throughputIn: 312,
    throughputOut: 188,
    adminUser: "admin",
    operationMode: "NAT",
    ha: "Standalone",
  };

  const adminProfiles: FortiAdminProfile[] = [
    { name: "super_admin", scope: "VDOM", permissions: "Read-Write (all)" },
    { name: "prof_admin", scope: "VDOM", permissions: "Read-Write" },
    { name: "network_admin", scope: "VDOM", permissions: "Network Read-Write, Policy Read" },
    { name: "security_audit", scope: "VDOM", permissions: "Read-Only" },
  ];

  const administrators: FortiAdministrator[] = [
    { name: "admin", profile: "super_admin", type: "Local", trustedHosts: "0.0.0.0/0", twoFactor: "Disabled" },
    { name: "netops", profile: "network_admin", type: "Local", trustedHosts: "10.1.0.0/24", twoFactor: "FortiToken" },
    { name: "auditor", profile: "security_audit", type: "LDAP", trustedHosts: "10.1.0.0/24", twoFactor: "Email" },
  ];

  const interfaces: FortiInterface[] = [
    {
      name: "port1",
      alias: "WAN",
      type: "Physical",
      members: "",
      role: "wan",
      addrMode: "DHCP",
      ip: "203.0.113.10/24",
      gw: "203.0.113.1",
      admin: "up",
      link: "up",
      mac: "00:50:56:8a:01:01",
      mtu: 1500,
      speed: "1000Mb/s full-duplex",
      access: ["HTTPS", "PING", "SSH"],
      dhcpServer: false,
      comments: "Internet uplink, DHCP from ISP",
    },
    {
      name: "port2",
      alias: "LAN",
      type: "Physical",
      members: "",
      role: "lan",
      addrMode: "Manual",
      ip: "10.1.0.1/24",
      gw: "",
      admin: "up",
      link: "up",
      mac: "00:50:56:8a:01:02",
      mtu: 1500,
      speed: "1000Mb/s full-duplex",
      access: ["HTTPS", "HTTP", "PING", "SSH", "FMG-Access", "FortiTelemetry"],
      dhcpServer: true,
      dhcpRange: "10.1.0.100 - 10.1.0.200",
      comments: "Corporate LAN",
    },
    {
      name: "port3",
      alias: "DMZ",
      type: "Physical",
      members: "",
      role: "dmz",
      addrMode: "Manual",
      ip: "10.2.0.1/24",
      gw: "",
      admin: "up",
      link: "up",
      mac: "00:50:56:8a:01:03",
      mtu: 1500,
      speed: "1000Mb/s full-duplex",
      access: ["PING", "HTTPS"],
      dhcpServer: false,
      comments: "DMZ for public servers",
    },
    {
      name: "port4",
      alias: "MGMT",
      type: "Physical",
      members: "",
      role: "undefined",
      addrMode: "Manual",
      ip: "192.168.1.99/24",
      gw: "",
      admin: "up",
      link: "up",
      mac: "00:50:56:8a:01:04",
      mtu: 1500,
      speed: "1000Mb/s full-duplex",
      access: ["HTTPS", "HTTP", "PING", "SSH", "SNMP"],
      dhcpServer: false,
      comments: "Out-of-band admin",
    },
    {
      name: "VLAN10",
      alias: "GUEST",
      type: "VLAN",
      members: "port2",
      role: "lan",
      addrMode: "Manual",
      ip: "10.10.10.1/24",
      gw: "",
      admin: "up",
      link: "up",
      mac: "00:50:56:8a:01:0a",
      mtu: 1500,
      speed: "-",
      vlanId: 10,
      access: ["PING"],
      dhcpServer: true,
      dhcpRange: "10.10.10.50 - 10.10.10.200",
      comments: "Guest WiFi VLAN",
    },
  ];

  const zones: FortiZone[] = [
    { name: "WAN-Zone", interfaces: "port1", intrazone: "block" },
    { name: "LAN-Zone", interfaces: "port2, VLAN10", intrazone: "allow" },
    { name: "DMZ-Zone", interfaces: "port3", intrazone: "block" },
  ];

  const staticRoutes: FortiStaticRoute[] = [
    { dst: "0.0.0.0/0", gw: "203.0.113.1", device: "port1", distance: 10, priority: 10, status: "enable", comments: "Default to ISP" },
    { dst: "10.50.0.0/16", gw: "10.1.0.254", device: "port2", distance: 20, priority: 0, status: "enable", comments: "Branch via core switch" },
    { dst: "198.51.100.0/24", gw: "203.0.113.1", device: "port1", distance: 15, priority: 0, status: "enable", comments: "HQ peer summary" },
  ];

  const policyRoutes: FortiPolicyRoute[] = [
    { protocol: "TCP", incoming: "port2", src: "10.1.0.0/24", dst: "0.0.0.0/0", service: "HTTPS", action: "forward", gw: "203.0.113.1", outDevice: "port1" },
  ];

  const addresses: FortiAddress[] = [
    { name: "all", type: "subnet", value: "0.0.0.0/0", iface: "any", color: 0, comment: "Wildcard - any address" },
    { name: "internal-net", type: "subnet", value: "10.1.0.0/24", iface: "port2", color: 1, comment: "Corporate LAN subnet" },
    { name: "dmz-net", type: "subnet", value: "10.2.0.0/24", iface: "port3", color: 5, comment: "DMZ subnet" },
    { name: "guest-net", type: "subnet", value: "10.10.10.0/24", iface: "VLAN10", color: 14, comment: "Guest WiFi" },
    { name: "MS-365", type: "fqdn", value: "*.office.com", iface: "any", color: 2, comment: "Microsoft 365" },
    { name: "AzureCloud", type: "fqdn", value: "*.azure.com", iface: "any", color: 2, comment: "Azure endpoints" },
    { name: "AWS-EC2", type: "fqdn", value: "*.amazonaws.com", iface: "any", color: 9, comment: "AWS EC2 endpoints" },
    { name: "Google", type: "fqdn", value: "*.google.com", iface: "any", color: 4, comment: "Google services" },
    { name: "Cloudflare", type: "fqdn", value: "*.cloudflare.com", iface: "any", color: 10, comment: "Cloudflare CDN" },
    { name: "HQ-Peer", type: "subnet", value: "198.51.100.0/24", iface: "any", color: 6, comment: "Remote HQ" },
    { name: "Webserver-DMZ", type: "subnet", value: "10.2.0.5/32", iface: "port3", color: 5, comment: "Public web server" },
  ];

  const addressGroups: FortiAddressGroup[] = [
    { name: "Internal-All", members: "internal-net, guest-net", comment: "All internal nets" },
    { name: "External-Cloud", members: "MS-365, AzureCloud, AWS-EC2, Google, Cloudflare", comment: "Sanctioned SaaS" },
  ];

  const services: FortiService[] = [
    { name: "ALL", protocol: "IP/TCP/UDP/SCTP", port: "any", category: "General" },
    { name: "ALL_TCP", protocol: "TCP", port: "1-65535", category: "General" },
    { name: "ALL_UDP", protocol: "UDP", port: "1-65535", category: "General" },
    { name: "ALL_ICMP", protocol: "ICMP", port: "any", category: "General" },
    { name: "HTTP", protocol: "TCP", port: "80", category: "Web Access" },
    { name: "HTTPS", protocol: "TCP", port: "443", category: "Web Access" },
    { name: "SSH", protocol: "TCP", port: "22", category: "Remote Access" },
    { name: "RDP", protocol: "TCP", port: "3389", category: "Remote Access" },
    { name: "FTP", protocol: "TCP", port: "21", category: "File Access" },
    { name: "SMTP", protocol: "TCP", port: "25", category: "Email" },
    { name: "IMAP", protocol: "TCP", port: "143", category: "Email" },
    { name: "POP3", protocol: "TCP", port: "110", category: "Email" },
    { name: "MS-SQL", protocol: "TCP", port: "1433", category: "Database" },
    { name: "MySQL", protocol: "TCP", port: "3306", category: "Database" },
    { name: "DNS", protocol: "UDP", port: "53", category: "Network Services" },
    { name: "NTP", protocol: "UDP", port: "123", category: "Network Services" },
    { name: "LDAP", protocol: "TCP", port: "389", category: "Authentication" },
    { name: "NTLM", protocol: "TCP", port: "445", category: "Authentication" },
    { name: "Kerberos", protocol: "TCP", port: "88", category: "Authentication" },
    { name: "SNMP", protocol: "UDP", port: "161", category: "Network Services" },
    { name: "SYSLOG", protocol: "UDP", port: "514", category: "Network Services" },
  ];

  const serviceGroups: FortiServiceGroup[] = [
    { name: "Web-services", members: "HTTP, HTTPS", comment: "Standard web" },
    { name: "Email", members: "SMTP, IMAP, POP3", comment: "Mail protocols" },
    { name: "Database", members: "MySQL, MS-SQL", comment: "DB protocols" },
  ];

  const schedules: FortiSchedule[] = [
    { name: "always", type: "Recurring", days: "all", start: "00:00", end: "24:00" },
    { name: "work-hours", type: "Recurring", days: "Mon Tue Wed Thu Fri", start: "09:00", end: "17:00" },
    { name: "maintenance-window", type: "One-time", start: "2026-05-18 22:00", end: "2026-05-19 02:00" },
    { name: "after-hours", type: "Recurring", days: "Mon Tue Wed Thu Fri", start: "18:00", end: "07:00" },
  ];

  const vips: FortiVip[] = [
    { name: "webserver-vip", extIf: "port1", extIp: "203.0.113.10", mappedIp: "10.2.0.5", extPort: "443", mappedPort: "443", protocol: "TCP", portForward: true, comment: "Public HTTPS" },
    { name: "mailserver-vip", extIf: "port1", extIp: "203.0.113.11", mappedIp: "10.2.0.6", extPort: "25", mappedPort: "25", protocol: "TCP", portForward: true, comment: "Public SMTP" },
  ];

  const ipPools: FortiIpPool[] = [
    { name: "NAT-Pool-1", type: "overload", extIp: "203.0.113.20-203.0.113.25", arpReply: true, comment: "" },
  ];

  const policies: FortiPolicy[] = [
    {
      id: 1, name: "Allow-Internal-Internet", from: "port2", to: "port1", src: "internal-net", dst: "all", schedule: "always", service: "ALL",
      action: "accept", nat: true, inspection: "flow", logTraffic: "all",
      av: "default", web: "default", dns: "default", app: "default", ips: "default", file: "", ssl: "certificate-inspection",
      bytes: "184.2 GB", sessions: 12480, status: "enable", comments: "Default internal-out",
    },
    {
      id: 2, name: "Block-Social-Media", from: "port2", to: "port1", src: "internal-net", dst: "all", schedule: "work-hours", service: "ALL",
      action: "deny", nat: false, inspection: "flow", logTraffic: "utm", logViolation: true,
      av: "", web: "no-social-media", dns: "", app: "", ips: "", file: "", ssl: "",
      bytes: "0 B", sessions: 0, status: "enable", comments: "No FB/Twitter/TikTok during work",
    },
    {
      id: 3, name: "DMZ-to-Internet", from: "port3", to: "port1", src: "dmz-net", dst: "all", schedule: "always", service: "Web-services",
      action: "accept", nat: true, inspection: "flow", logTraffic: "all",
      av: "strict", web: "default", dns: "default", app: "", ips: "server-protection", file: "", ssl: "deep-inspection",
      bytes: "8.4 GB", sessions: 2102, status: "enable", comments: "DMZ outbound updates",
    },
    {
      id: 4, name: "Internet-to-Webserver-VIP", from: "port1", to: "port3", src: "all", dst: "webserver-vip", schedule: "always", service: "HTTPS",
      action: "accept", nat: false, inspection: "proxy", logTraffic: "all",
      av: "strict", web: "", dns: "", app: "", ips: "server-protection", file: "default", ssl: "deep-inspection",
      bytes: "42.1 GB", sessions: 9802, status: "enable", comments: "Public website ingress",
    },
    {
      id: 5, name: "Block-Guest-to-Internal", from: "VLAN10", to: "port2", src: "guest-net", dst: "internal-net", schedule: "always", service: "ALL",
      action: "deny", nat: false, inspection: "flow", logTraffic: "utm", logViolation: true,
      av: "", web: "", dns: "", app: "", ips: "", file: "", ssl: "",
      bytes: "0 B", sessions: 0, status: "enable", comments: "Isolate guest WiFi",
    },
    {
      id: 6, name: "Allow-Guest-Internet", from: "VLAN10", to: "port1", src: "guest-net", dst: "all", schedule: "always", service: "Web-services",
      action: "accept", nat: true, inspection: "flow", logTraffic: "all",
      av: "default", web: "strict", dns: "family-safe", app: "default", ips: "", file: "", ssl: "certificate-inspection",
      bytes: "6.8 GB", sessions: 1860, status: "enable", comments: "Guest captive surfing",
    },
    {
      id: 7, name: "IPsec-VPN-to-HQ", from: "port2", to: "VPN-to-HQ", src: "internal-net", dst: "HQ-Peer", schedule: "always", service: "ALL",
      action: "accept", nat: false, inspection: "flow", logTraffic: "all",
      av: "default", web: "", dns: "", app: "", ips: "default", file: "", ssl: "",
      bytes: "18.6 GB", sessions: 432, status: "enable", comments: "Site-to-site to HQ",
    },
    {
      id: 8, name: "SSL-VPN-Users-to-Internal", from: "ssl.root", to: "port2", src: "all", dst: "internal-net", schedule: "always", service: "ALL",
      action: "accept", nat: false, inspection: "flow", logTraffic: "all",
      av: "default", web: "", dns: "", app: "", ips: "default", file: "", ssl: "",
      bytes: "2.1 GB", sessions: 88, status: "enable", comments: "Remote workers",
    },
  ];

  // ---- Security Profiles ----
  const avProfiles: FortiAvProfile[] = [
    {
      name: "default", inspectionMode: "flow-based", protocols: ["HTTP", "SMTP", "POP3", "IMAP", "FTP", "CIFS"],
      treatWinExeAsVirus: true, scanArchives: true, sandbox: false, quarantine: true,
      comment: "Default antivirus scanning profile",
    },
    {
      name: "strict", inspectionMode: "proxy-based", protocols: ["HTTP", "HTTPS", "SMTP", "POP3", "IMAP", "FTP", "CIFS", "SSH"],
      treatWinExeAsVirus: true, scanArchives: true, sandbox: true, quarantine: true,
      comment: "Strict scanning for high-risk segments (DMZ, exposed servers)",
    },
  ];

  const webFilterProfiles: FortiWebFilterProfile[] = [
    { name: "default", mode: "flow-based", overrides: {}, comment: "Default web filter — monitor most categories" },
    {
      name: "no-social-media", mode: "flow-based",
      overrides: { "Social Networking": "block", "Personal Privacy": "monitor" },
      blockedSites: ["facebook.com", "twitter.com", "x.com", "tiktok.com", "snapchat.com", "instagram.com"],
      comment: "Blocks major social networks",
    },
    {
      name: "strict", mode: "proxy-based",
      overrides: { Gambling: "block", "Streaming Media": "block", "Adult/Mature Content": "block", "Audio Streaming": "block" },
      comment: "Strict — blocks gambling, streaming, adult content",
    },
  ];

  const ipsProfiles: FortiIpsProfile[] = [
    { name: "default", sensors: ["Critical", "High"], action: "block", logging: "all", comment: "Default IPS" },
    { name: "server-protection", sensors: ["Critical", "High", "Medium"], action: "block", logging: "all", comment: "Server-side intrusion protection" },
    { name: "wifi-default", sensors: ["Critical"], action: "block", logging: "all", comment: "Lightweight IPS for WiFi clients" },
  ];

  const appControlProfiles: FortiAppControlProfile[] = [
    { name: "default", blocks: ["Botnet", "Proxy"], comment: "Default application control" },
    { name: "no-streaming", blocks: ["Netflix", "YouTube", "Spotify", "Twitch"], schedule: "work-hours", comment: "Blocks video/music streaming during work hours" },
  ];

  const sslProfiles: FortiSslProfile[] = [
    { name: "certificate-inspection", mode: "certificate-inspection", comment: "Inspect SNI/cert only (default)" },
    { name: "deep-inspection", mode: "full-ssl-inspection", comment: "Decrypt and inspect TLS" },
    { name: "no-inspection", mode: "no-inspection", comment: "Bypass inspection (use sparingly)" },
  ];

  const dnsFilterProfiles: FortiDnsFilterProfile[] = [
    { name: "default", fortiguard: true, externalIp: "208.91.112.220", safeSearch: false, comment: "Default DNS filter" },
    {
      name: "family-safe", fortiguard: true, externalIp: "208.91.112.220", safeSearch: true,
      blockedCats: ["Adult", "Gambling", "Drug Abuse"], comment: "Strict family-safe profile",
    },
  ];

  const fileFilterProfiles: FortiFileFilterProfile[] = [
    { name: "default", blockTypes: ["exe", "bat", "cmd", "ps1", "scr"], comment: "Block common executables" },
  ];

  const dlpProfiles: FortiDlpProfile[] = [
    { name: "default", sensors: ["Credit-Card", "SSN"], action: "block", comment: "PCI / PII data loss prevention" },
  ];

  const wafProfiles: FortiWafProfile[] = [
    { name: "default", signatures: "all", extended: false, comment: "Default web app firewall" },
  ];

  // ---- VPN ----
  const ipsecTunnels: FortiIpsecTunnel[] = [
    {
      name: "VPN-to-HQ", remoteGw: "198.51.100.1", auth: "PSK", ike: "IKEv2",
      phase1: { encryption: "AES256", hash: "SHA256", dh: "14", lifetime: 28800 },
      phase2: { encryption: "AES256", hash: "SHA256", pfs: true, lifetime: 3600 },
      localSubnet: "10.1.0.0/24", remoteSubnet: "198.51.100.0/24", status: "up", uptime: "14d 3h", bytesIn: "12.4 GB", bytesOut: "6.2 GB",
    },
    {
      name: "VPN-to-Branch", remoteGw: "198.51.100.50", auth: "PSK", ike: "IKEv2",
      phase1: { encryption: "AES256", hash: "SHA256", dh: "14", lifetime: 28800 },
      phase2: { encryption: "AES256", hash: "SHA256", pfs: true, lifetime: 3600 },
      localSubnet: "10.1.0.0/24", remoteSubnet: "10.50.0.0/16", status: "up", uptime: "6d 11h", bytesIn: "4.2 GB", bytesOut: "2.8 GB",
    },
  ];

  const sslVpnPortals: FortiSslVpnPortal[] = [
    { name: "portal-default", webMode: true, tunnelMode: true, splitTunnel: true, dnsServer: "10.1.0.1", userGroups: "VPN-Users", comment: "Default SSL-VPN portal" },
    { name: "web-only", webMode: true, tunnelMode: false, splitTunnel: false, userGroups: "Contractors", comment: "Browser-only access" },
  ];

  const sslVpnSettings = {
    listenInterface: "port1",
    listenPort: 10443,
    idleTimeout: 300,
    tlsVersion: "TLS1.2/1.3",
    serverCert: "Fortinet_Factory",
    tunnelIpPool: "SSLVPN-Pool (10.212.134.200-10.212.134.250)",
  };

  // ---- User & Auth ----
  const localUsers: FortiLocalUser[] = [
    { name: "admin", enabled: true, twoFactor: "Disabled", email: "", group: "", comment: "Default admin" },
    { name: "guest-user", enabled: true, twoFactor: "Disabled", email: "guest@cloudlab.local", group: "Guests", comment: "Captive portal sample" },
    { name: "vpn-user", enabled: true, twoFactor: "FortiToken", email: "vpn1@cloudlab.local", group: "VPN-Users", comment: "SSL-VPN" },
    { name: "ankit", enabled: true, twoFactor: "Email", email: "alex@itbd.local", group: "Admins", comment: "" },
  ];

  const userGroups: FortiUserGroup[] = [
    { name: "VPN-Users", type: "Firewall", members: "vpn-user", comment: "Allowed to dial SSL-VPN" },
    { name: "Admins", type: "Firewall", members: "admin, ankit", comment: "Full admin" },
    { name: "Guests", type: "Guest", members: "guest-user", comment: "Captive portal" },
    { name: "Contractors", type: "Firewall", members: "", comment: "External contractors (LDAP)" },
  ];

  const ldapServers: FortiLdapServer[] = [
    {
      name: "corp-ldap", server: "dc01.corp.cloudlab.local", port: 389, baseDn: "dc=corp,dc=cloudlab,dc=local",
      bindDn: "cn=fortigate,ou=service,dc=corp,dc=cloudlab,dc=local", secure: "StartTLS", comment: "Primary AD",
    },
  ];

  const radiusServers: FortiRadiusServer[] = [
    { name: "corp-radius", server: "10.1.0.50", port: 1812, secret: "**********", auth: "PAP", comment: "FortiAuth backend" },
  ];

  return {
    system,
    adminProfiles,
    administrators,
    interfaces,
    zones,
    staticRoutes,
    policyRoutes,
    addresses,
    addressGroups,
    services,
    serviceGroups,
    schedules,
    vips,
    ipPools,
    policies,
    avProfiles,
    webFilterProfiles,
    ipsProfiles,
    appControlProfiles,
    sslProfiles,
    dnsFilterProfiles,
    fileFilterProfiles,
    dlpProfiles,
    wafProfiles,
    ipsecTunnels,
    sslVpnPortals,
    sslVpnSettings,
    localUsers,
    userGroups,
    ldapServers,
    radiusServers,
    forwardLogs: seedForwardLogs(),
    eventLogs: seedEventLogs(),
    canonicalFortigates: CANONICAL_FORTIGATES,
    canonicalSites: CANONICAL_SITES,
    tenant: TENANT,
    vpnUsers: VPN_USERS,
  };
}
