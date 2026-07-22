import type {
  PaloAcc,
  PaloAddress,
  PaloAddressGroup,
  PaloAdministrator,
  PaloApplication,
  PaloApplicationFilter,
  PaloApplicationGroup,
  PaloAsProfile,
  PaloAuthPolicy,
  PaloAuthProfile,
  PaloAuthSequence,
  PaloAvProfile,
  PaloCanonicalDevice,
  PaloCertificate,
  PaloConfigLogEntry,
  PaloDataProfile,
  PaloDecryptionPolicy,
  PaloDevice,
  PaloFileProfile,
  PaloGlobalProtect,
  PaloHighAvailability,
  PaloIkeCrypto,
  PaloIkeGateway,
  PaloInterface,
  PaloIpsecCrypto,
  PaloIpsecTunnel,
  PaloLocalUser,
  PaloLogForwardingProfile,
  PaloNatPolicy,
  PaloProfileGroup,
  PaloSecurityPolicy,
  PaloServerProfiles,
  PaloService,
  PaloServiceGroup,
  PaloState,
  PaloSystemLogEntry,
  PaloTag,
  PaloTenant,
  PaloThreatLogEntry,
  PaloTrafficLogEntry,
  PaloUrlLogEntry,
  PaloUrlProfile,
  PaloUserGroup,
  PaloVirtualRouter,
  PaloVlan,
  PaloVpnUser,
  PaloVpProfile,
  PaloWildfireEntry,
  PaloWildfireProfile,
  PaloZone,
} from "./types";

// Note: source (paloalto-data.js) uses randomness in exactly ONE place —
// `seedWildfire()`'s cosmetic fake SHA-256 hex hashes via `Math.random()`. Every other
// seed generator (seedTrafficLogs/seedThreatLogs/seedUrlLogs/seedSystemLogs/
// seedConfigLogs) is a pure index-driven formula, ported verbatim below. Per the
// no-Math.random() convention shared by every prior port, the WildFire hash is instead
// derived from the shared seeded LCG, keyed off each entry's index so the output stays
// fully deterministic; verdicts/actions/names/sizes/etc. remain the same fixed
// lookup-array formulas as source.

function rng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// All timestamps are derived from a single fixed "now" baseline rather than
// Date.now()/new Date() at module scope (per the no-wall-clock-in-seed-files rule),
// matching source's embedded static `device.systemTime` value and the convention
// established in the Cisco/FortiGate ports' seedData.ts.
const NOW_MS = Date.UTC(2026, 4, 14, 9, 42, 18); // 2026-05-14 09:42:18 UTC (matches device.systemTime)

function isoAt(offsetMs: number): string {
  return new Date(NOW_MS - offsetMs).toISOString().replace("T", " ").slice(0, 19);
}

// ===================================================================
// CloudLab Inc. shared roster convention — same fictional continuity used across every
// prior port (Cisco/FortiGate/etc). Source's `applyCanonical()` reads
// `CloudLabInfra.INFRA.networkDevices` (filtered `vendor === 'Palo Alto'`),
// `CloudLabInfra.SITES`, `CloudLabInfra.TENANT.{companyName, publicDomain}`, and
// `CloudLabInfra.USERS` filtered by `id` NOT starting with `'svc-'` AND
// `accountEnabled`, mapped to `{upn, displayName, group: 'GP-AllowedUsers', dept}`
// from a shared cloudlab-infra.js this Next.js app does not have; we replicate the
// EFFECT by hardcoding an equivalent roster inline here rather than a separate
// merge-after-load step, since this is a fresh TS port with no localStorage legacy
// state to reconcile against. Source also overwrites `state.device.hostname` with the
// first canonical Palo Alto device's name in `applyCanonical()` — replicated here by
// seeding `device.hostname` directly with that name, following the FortiGate port's
// `FW-EDGE-BLR-01` edge-firewall naming scheme (`PA-EDGE-BLR-01`, for continuity across
// ports as the Palo Alto edge-firewall role for the same Bengaluru site).
// ===================================================================

const TENANT_COMPANY = "CloudLab Inc.";
const TENANT_DOMAIN = "cloudlab.in";

const CANONICAL_PALOS: PaloCanonicalDevice[] = [
  { name: "PA-EDGE-BLR-01", vendor: "Palo Alto", mgmtIp: "203.0.113.10", site: "Bengaluru" },
];

const CANONICAL_SITES = [
  { name: "Mumbai HQ", region: "APAC", tier: "primary" },
  { name: "Bengaluru", region: "APAC", tier: "primary" },
  { name: "Hyderabad", region: "APAC", tier: "secondary" },
  { name: "Singapore-DR", region: "APAC", tier: "dr" },
  { name: "Pune", region: "APAC", tier: "secondary" },
];

const TENANT: PaloTenant = { name: TENANT_COMPANY, domain: TENANT_DOMAIN };

// Roster filtered by source to `id` NOT starting with `'svc-'` AND `accountEnabled`,
// mapped to `{upn, displayName, group: 'GP-AllowedUsers', dept}`. Reuses names already
// established across prior ports' CloudLab roster (ankit/rohit/vivek/priya/naveen/
// jaya/sneha/vikram/rahul/arjun/kiran/amit/pooja/kavita/manish/meera/sunita/aarti/
// sandeep/karthik/preeti/ravi) to build a small GlobalProtect-allowed-users roster.
const VPN_USERS: PaloVpnUser[] = [
  { upn: "rohit@cloudlab.in", displayName: "Rohit Verma", group: "GP-AllowedUsers", dept: "Engineering" },
  { upn: "priya@cloudlab.in", displayName: "Priya Nair", group: "GP-AllowedUsers", dept: "Finance" },
  { upn: "vikram@cloudlab.in", displayName: "Vikram Rao", group: "GP-AllowedUsers", dept: "IT" },
  { upn: "sneha@cloudlab.in", displayName: "Sneha Kulkarni", group: "GP-AllowedUsers", dept: "Sales" },
  { upn: "arjun@cloudlab.in", displayName: "Arjun Mehta", group: "GP-AllowedUsers", dept: "Engineering" },
];

// ---------- seeded log generators (ported 1:1 from paloalto-data.js formulas) ----------

function seedTrafficLogs(): PaloTrafficLogEntry[] {
  const actions = ["allow", "allow", "allow", "allow", "deny", "drop"];
  const apps = [
    "ssl",
    "web-browsing",
    "microsoft-365",
    "ms-teams",
    "dns",
    "ssh",
    "ms-rdp",
    "salesforce",
    "github",
    "smtp",
    "custom-finapp",
  ];
  const srcs = ["10.1.0.45", "10.1.0.108", "10.1.0.211", "10.10.10.55", "10.2.0.5", "10.1.0.77", "10.1.0.150"];
  const dsts = [
    "8.8.8.8",
    "1.1.1.1",
    "142.250.80.46",
    "13.107.42.14",
    "198.51.100.20",
    "52.96.0.10",
    "10.1.0.1",
    "203.0.113.50",
  ];
  const rules = [
    "allow-internal-to-internet",
    "external-to-dmz-web",
    "dmz-to-internal-restricted",
    "internal-to-office365",
    "allow-guest-internet",
    "block-tor-exit",
    "block-c2",
    "default-interzone-deny",
  ];
  const sevs = ["informational", "informational", "informational", "low", "medium", "high"];
  const samples: PaloTrafficLogEntry[] = [];
  for (let i = 0; i < 200; i++) {
    const action = actions[i % actions.length];
    samples.push({
      time: isoAt(i * 17000),
      srcZone: i % 4 === 0 ? "untrust" : "trust",
      dstZone: i % 4 === 0 ? "dmz" : "untrust",
      src: srcs[i % srcs.length],
      dst: dsts[i % dsts.length],
      srcPort: 1024 + ((i * 31) % 60000),
      dstPort: [80, 443, 53, 22, 3389, 25, 8443][i % 7],
      proto: i % 3 === 0 ? "udp" : "tcp",
      app: apps[i % apps.length],
      rule: rules[i % rules.length],
      action,
      severity: sevs[i % sevs.length],
      bytes: 450 + (i % 30) * 1284,
      packets: 4 + (i % 18),
    });
  }
  return samples;
}

function seedThreatLogs(): PaloThreatLogEntry[] {
  const cats: { type: string; sev: string; name: string }[] = [
    { type: "spyware", sev: "high", name: "Generic-Spyware.Trojan.Behav" },
    { type: "spyware", sev: "medium", name: "Suspicious-DNS.Beaconing" },
    { type: "virus", sev: "critical", name: "PE.Backdoor.Agent.Gen" },
    { type: "virus", sev: "high", name: "JS/Coinhive.A" },
    { type: "vulnerability", sev: "critical", name: "Apache.Struts.OGNL.Injection" },
    { type: "vulnerability", sev: "high", name: "Log4j.JNDI.Lookup.Remote.Exec" },
    { type: "command-and-control", sev: "critical", name: "Trickbot.C2.Beacon" },
  ];
  const srcs = ["203.0.113.99", "185.220.100.45", "45.155.205.233", "198.51.100.99", "10.1.0.211", "10.1.0.108"];
  const dsts = ["10.2.0.5", "10.1.0.45", "10.1.0.108", "10.10.10.55", "203.0.113.10"];
  const samples: PaloThreatLogEntry[] = [];
  for (let i = 0; i < 30; i++) {
    const c = cats[i % cats.length];
    samples.push({
      time: isoAt(i * 412000),
      type: c.type,
      severity: c.sev,
      name: c.name,
      src: srcs[i % srcs.length],
      dst: dsts[i % dsts.length],
      app: c.type === "virus" ? "web-browsing" : c.type === "spyware" ? "dns" : "ssl",
      action: c.sev === "critical" || c.sev === "high" ? "reset-both" : "alert",
      rule: "allow-internal-to-internet",
    });
  }
  return samples;
}

function seedUrlLogs(): PaloUrlLogEntry[] {
  const urls: { url: string; cat: string; action: string }[] = [
    { url: "facebook.com/login", cat: "social-networking", action: "block" },
    { url: "twitter.com", cat: "social-networking", action: "block" },
    { url: "youtube.com/watch", cat: "streaming-media", action: "alert" },
    { url: "github.com/repo", cat: "computer-and-internet-info", action: "allow" },
    { url: "evil-malware.com", cat: "malware", action: "block" },
    { url: "phishing-bank.tk", cat: "phishing", action: "block" },
    { url: "bet365.com", cat: "gambling", action: "block" },
    { url: "salesforce.com/login", cat: "business-and-economy", action: "allow" },
  ];
  const samples: PaloUrlLogEntry[] = [];
  for (let i = 0; i < 40; i++) {
    const u = urls[i % urls.length];
    samples.push({
      time: isoAt(i * 38000),
      src: "10.1.0." + (45 + (i % 80)),
      url: u.url,
      cat: u.cat,
      action: u.action,
      rule: u.action === "block" ? "block-social-media-workhours" : "allow-internal-to-internet",
    });
  }
  return samples;
}

function seedWildfire(): PaloWildfireEntry[] {
  const verdicts = ["benign", "grayware", "malware", "benign", "phishing", "malware", "benign", "grayware", "benign", "malware"];
  const names = [
    "invoice.pdf",
    "update.exe",
    "installer.msi",
    "report.docx",
    "setup.bat",
    "meeting.zip",
    "image.png",
    "archive.7z",
    "presentation.pptx",
    "code.tar.gz",
  ];
  const samples: PaloWildfireEntry[] = [];
  for (let i = 0; i < 10; i++) {
    // Source uses Math.random() here only (cosmetic fake SHA-256 hex); replaced with
    // the seeded LCG, keyed off the entry index, per the no-Math.random() convention.
    const rand = rng(1000 + i);
    const hexPart = (len: number) => {
      let out = "";
      while (out.length < len) {
        out += Math.floor(rand() * 16).toString(16);
      }
      return out.slice(0, len);
    };
    const verdict = verdicts[i];
    samples.push({
      time: isoAt(i * 720000),
      file: names[i],
      sha256: "a" + hexPart(16) + "b" + hexPart(16),
      size: 12 + i * 4 + " KB",
      src: "10.1.0." + (45 + i),
      dst: "203.0.113." + (40 + i),
      app: i % 2 === 0 ? "web-browsing" : "smtp",
      verdict,
      action: verdict === "malware" || verdict === "phishing" ? "reset-both" : "alert",
    });
  }
  return samples;
}

function seedSystemLogs(): PaloSystemLogEntry[] {
  const rows: { sev: string; msg: string }[] = [
    { sev: "informational", msg: "User admin logged in via Web from 192.168.1.50" },
    { sev: "informational", msg: "commit succeeded, 3 changes applied by admin" },
    { sev: "informational", msg: "Dynamic update content version 8842-8580 installed" },
    { sev: "medium", msg: "BGP peer 203.0.113.1 (AS 64512) state changed to Established" },
    { sev: "informational", msg: "IPsec tunnel to-HQ phase-1 negotiation success" },
    { sev: "informational", msg: "IPsec tunnel to-HQ phase-2 negotiation success" },
    { sev: "medium", msg: "WildFire cloud connection re-established (us cloud)" },
    { sev: "high", msg: "HA peer link is down (running standalone)" },
    { sev: "informational", msg: "GlobalProtect user gp-user-1 connected from 198.51.100.42" },
    { sev: "informational", msg: "PAN-DB connection established to updates.paloaltonetworks.com" },
    { sev: "informational", msg: "syslog forwarding to 10.1.0.51 UDP/514 healthy" },
    { sev: "medium", msg: "CPU usage on data-plane crossed 75% threshold (recovered)" },
  ];
  const subtypes = ["general", "config", "ha", "vpn", "dnsproxy", "wildfire", "globalprotect"];
  const out: PaloSystemLogEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    out.push({
      time: isoAt(i * 412000),
      severity: rows[i].sev,
      subtype: subtypes[i % subtypes.length],
      msg: rows[i].msg,
    });
  }
  return out;
}

function seedConfigLogs(): PaloConfigLogEntry[] {
  // Source's rows are `{ user, cmd }`; types.ts's PaloConfigLogEntry additionally
  // carries a `result` field (not present in source) — every source config-log row is
  // a completed, successful admin action (including the trailing `commit`), so each
  // entry is seeded with `result: 'success'` to satisfy the type without inventing
  // failure scenarios source never modeled.
  const rows: { user: string; cmd: string }[] = [
    { user: "admin", cmd: "set rulebase security rules allow-internal-to-internet description ..." },
    { user: "admin", cmd: "set network interface ethernet ethernet1/1 layer3 ip 203.0.113.10/24" },
    { user: "netops", cmd: "set zone-protection profile dmz-protect" },
    { user: "admin", cmd: "commit" },
  ];
  const samples: PaloConfigLogEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    samples.push({
      time: isoAt(i * 280000),
      admin: rows[i].user,
      cmd: rows[i].cmd,
      result: "success",
    });
  }
  return samples;
}

// ---------- PAN-DB URL Filtering category catalogue (static, exported standalone) ----------

export const URL_CATEGORIES: string[] = [
  "abortion",
  "abused-drugs",
  "adult",
  "alcohol-and-tobacco",
  "auctions",
  "business-and-economy",
  "command-and-control",
  "computer-and-internet-info",
  "computer-and-internet-security",
  "content-delivery-networks",
  "copyright-infringement",
  "cryptocurrency",
  "dating",
  "dynamic-dns",
  "educational-institutions",
  "entertainment-and-arts",
  "extremism",
  "financial-services",
  "gambling",
  "games",
  "government",
  "grayware",
  "hacking",
  "health-and-medicine",
  "high-risk",
  "home-and-garden",
  "hunting-and-fishing",
  "insufficient-content",
  "internet-communications-and-telephony",
  "internet-portals",
  "job-search",
  "legal",
  "low-risk",
  "malware",
  "medium-risk",
  "military",
  "motor-vehicles",
  "music",
  "newly-registered-domain",
  "news",
  "not-resolved",
  "nudity",
  "online-storage-and-backup",
  "parked",
  "peer-to-peer",
  "personal-sites-and-blogs",
  "philosophy-and-political-advocacy",
  "phishing",
  "private-ip-addresses",
  "proxy-avoidance-and-anonymizers",
  "questionable",
  "real-estate",
  "recreation-and-hobbies",
  "reference-and-research",
  "religion",
  "remote-access",
  "search-engines",
  "sex-education",
  "shareware-and-freeware",
  "shopping",
  "social-networking",
  "society",
  "sports",
  "stock-advice-and-tools",
  "streaming-media",
  "swimsuits-and-intimate-apparel",
  "training-and-tools",
  "translation",
  "travel",
  "unknown",
  "weapons",
  "web-advertisements",
  "web-based-email",
  "web-hosting",
  "webmail",
];

/**
 * Builds a brand-new PaloState. Ports source's `defaults()` faithfully (every field,
 * exact seed values) and additionally seeds `canonicalPalos` / `canonicalSites` /
 * `tenant` / `vpnUsers` directly (source's separate `applyCanonical()` merge-after-load
 * step has no equivalent here since there's no localStorage legacy state to reconcile
 * against — a fresh TS port just seeds these correctly from the start), including
 * overwriting `device.hostname` with the canonical Palo Alto device's name up front
 * (source does this inside `applyCanonical()`).
 *
 * Source has no tick/random-walk telemetry function anywhere (confirmed via full-file
 * review) — `device` counters (cpuMgmt/cpuDp/memory/sessions/etc.) and the ACC
 * dashboard caches are static seed values, not live-computed, matching source exactly.
 */
export function freshPaloState(): PaloState {
  const device: PaloDevice = {
    hostname: CANONICAL_PALOS[0].name, // "PA-EDGE-BLR-01" — overwritten from canonical roster, replicating applyCanonical()
    model: "PA-VM-300",
    panOS: "11.1.4-h3",
    appContent: "8842-8580",
    threatContent: "8842-8580",
    antivirus: "4621-5142",
    wildfire: "821623-825188",
    urlDb: "PAN-DB 20260514.0001",
    globalProtectClient: "6.3.2",
    serial: "008701083712",
    uptime: "47d 11h 22m",
    license: "Premium (Threat Prevention, WildFire, URL Filtering, DNS Security, GlobalProtect, SD-WAN)",
    mgmtIp: "192.168.1.1/24",
    mgmtMac: "00:1b:17:00:01:01",
    family: "vm",
    operationalMode: "Normal",
    multiVsys: "Off",
    cpuMgmt: 12,
    cpuDp: 34,
    memory: 47,
    sessions: 18420,
    sessionUtil: 9,
    packetsPerSec: 9420,
    throughputMbps: 612,
    adminUser: "admin",
    adminRole: "superuser",
    timezone: "UTC",
    systemTime: "2026-05-14 09:42:18 UTC",
    ha: "Standalone",
    wildfireRegion: "us",
    logRetentionDays: 90,
    pendingChanges: 3,
  };

  const interfaces: PaloInterface[] = [
    {
      name: "ethernet1/1",
      type: "Layer3",
      ip: "203.0.113.10/24",
      zone: "untrust",
      vr: "default",
      mgmtProfile: "allow-ping",
      comment: "Internet uplink",
      link: "up",
      speed: "1Gbps/full",
      mtu: 1500,
      mac: "00:1b:17:00:11:01",
    },
    {
      name: "ethernet1/2",
      type: "Layer3",
      ip: "10.1.0.1/24",
      zone: "trust",
      vr: "default",
      mgmtProfile: "allow-mgmt",
      comment: "Corporate LAN",
      link: "up",
      speed: "1Gbps/full",
      mtu: 1500,
      mac: "00:1b:17:00:11:02",
    },
    {
      name: "ethernet1/3",
      type: "Layer3",
      ip: "10.2.0.1/24",
      zone: "dmz",
      vr: "default",
      mgmtProfile: "allow-ping",
      comment: "DMZ subnet",
      link: "up",
      speed: "1Gbps/full",
      mtu: 1500,
      mac: "00:1b:17:00:11:03",
    },
    {
      name: "ethernet1/4",
      type: "Layer3",
      ip: "192.168.1.1/24",
      zone: "management",
      vr: "default",
      mgmtProfile: "allow-mgmt",
      comment: "OOB management",
      link: "up",
      speed: "1Gbps/full",
      mtu: 1500,
      mac: "00:1b:17:00:11:04",
    },
    {
      name: "ethernet1/2.10",
      type: "Layer3-Subinterface",
      tag: 10,
      ip: "10.10.10.1/24",
      zone: "trust",
      vr: "default",
      mgmtProfile: "",
      comment: "VLAN10 - Guest WiFi",
      link: "up",
      speed: "inherit",
      mtu: 1500,
      parent: "ethernet1/2",
    },
    {
      name: "tunnel.1",
      type: "Tunnel",
      ip: "",
      zone: "untrust",
      vr: "default",
      mgmtProfile: "",
      comment: "IPsec to-HQ",
      link: "up",
      speed: "n/a",
      mtu: 1380,
      mac: "",
    },
    {
      name: "tunnel.2",
      type: "Tunnel",
      ip: "",
      zone: "untrust",
      vr: "default",
      mgmtProfile: "",
      comment: "IPsec to-branch-1",
      link: "up",
      speed: "n/a",
      mtu: 1380,
      mac: "",
    },
  ];

  const zones: PaloZone[] = [
    { name: "untrust", type: "Layer3", interfaces: "ethernet1/1, tunnel.1, tunnel.2", userIdent: false, pktBufferProt: true, comment: "External / Internet facing" },
    { name: "trust", type: "Layer3", interfaces: "ethernet1/2, ethernet1/2.10", userIdent: true, pktBufferProt: false, comment: "Internal corporate" },
    { name: "dmz", type: "Layer3", interfaces: "ethernet1/3", userIdent: false, pktBufferProt: true, comment: "DMZ / public-facing servers" },
    { name: "management", type: "Layer3", interfaces: "ethernet1/4", userIdent: false, pktBufferProt: false, comment: "OOB administration only" },
  ];

  const virtualRouters: PaloVirtualRouter[] = [
    {
      name: "default",
      interfaces: "ethernet1/1, ethernet1/2, ethernet1/3, ethernet1/4, tunnel.1, tunnel.2",
      staticRoutes: [
        { name: "default", dst: "0.0.0.0/0", nextHop: "203.0.113.1", iface: "ethernet1/1", metric: 10, admin: 10 },
        { name: "to-hq", dst: "198.51.100.0/24", nextHop: "tunnel.1", iface: "tunnel.1", metric: 10, admin: 10 },
        { name: "to-branch-1", dst: "10.50.0.0/16", nextHop: "tunnel.2", iface: "tunnel.2", metric: 10, admin: 10 },
      ],
      ospf: { enabled: true, routerId: "10.1.0.1", area: "0.0.0.0", interfaces: ["ethernet1/2"] },
      bgp: {
        enabled: true,
        routerId: "10.1.0.1",
        asn: 65001,
        peers: [{ name: "ISP-A", peerIp: "203.0.113.1", remoteAs: 64512, status: "Established" }],
      },
      rip: { enabled: false },
      multicast: { enabled: false },
    },
  ];

  const vlans: PaloVlan[] = [{ name: "vlan10", interfaces: "ethernet1/2.10", vifs: "", comment: "Guest WiFi VLAN" }];

  const addresses: PaloAddress[] = [
    { name: "HQ-Mumbai-LAN", type: "IP Netmask", value: "10.10.0.0/16", tags: "site-HQ-Mumbai, env-prod", description: "Mumbai HQ user + server VLAN" },
    { name: "BR-Bengaluru-LAN", type: "IP Netmask", value: "10.20.0.0/16", tags: "site-BR-Bengaluru, env-prod", description: "Bengaluru branch subnet" },
    { name: "BR-Hyderabad-LAN", type: "IP Netmask", value: "10.30.0.0/16", tags: "site-BR-Hyderabad, env-prod", description: "Hyderabad branch subnet" },
    { name: "DR-Singapore-LAN", type: "IP Netmask", value: "10.40.0.0/16", tags: "site-DR-Singapore, env-dr", description: "Singapore DR subnet" },
    { name: "RM-Pune-VPN", type: "IP Netmask", value: "10.50.0.0/16", tags: "site-RM-Pune, env-prod", description: "Pune remote VPN pool" },
    { name: "DC01", type: "IP Netmask", value: "10.10.0.10/32", tags: "tier-0, criticality-high", description: "DC01.corp.cloudlab.local — PDC Emulator" },
    { name: "DC02", type: "IP Netmask", value: "10.10.0.11/32", tags: "tier-0, criticality-high", description: "DC02.corp.cloudlab.local — Schema Master" },
    { name: "DC03", type: "IP Netmask", value: "10.20.0.10/32", tags: "tier-0, criticality-high", description: "DC03.corp.cloudlab.local — BLR replica" },
    { name: "FS01-FS02", type: "IP Range", value: "10.10.0.20-10.20.0.20", tags: "tier-1", description: "DFS-N file servers" },
    { name: "AADC-servers", type: "IP Range", value: "10.10.0.50-10.20.0.50", tags: "tier-1, hybrid-identity", description: "Entra Connect (primary + staging)" },
    { name: "cl-azure-vnet", type: "IP Netmask", value: "10.100.0.0/16", tags: "env-prod, cloud", description: "Azure prod VNet (centralindia)" },
    { name: "cl-azure-dr-vnet", type: "IP Netmask", value: "10.140.0.0/16", tags: "env-dr, cloud", description: "Azure DR VNet (southeastasia)" },
    { name: "internal-net", type: "Static", value: "", members: "HQ-Mumbai-LAN, BR-Bengaluru-LAN, BR-Hyderabad-LAN", tags: "env-prod", description: "Alias for all corporate LANs (legacy)" },
    { name: "dmz-net", type: "IP Netmask", value: "10.2.0.0/24", tags: "env-prod", description: "DMZ subnet" },
    { name: "web-servers", type: "IP Netmask", value: "10.2.0.5/32", tags: "criticality-high", description: "DMZ web server" },
    { name: "mail-servers", type: "IP Netmask", value: "10.2.0.6/32", tags: "criticality-high", description: "DMZ SMTP server" },
    { name: "guest-net", type: "IP Netmask", value: "10.10.10.0/24", tags: "env-dev", description: "Guest WiFi VLAN" },
    { name: "AzureCloud", type: "FQDN", value: "*.azure.com", tags: "", description: "Azure endpoints" },
    { name: "MS-365", type: "FQDN", value: "*.office.com", tags: "", description: "Microsoft 365 SaaS" },
    { name: "cloudlab-sharepoint", type: "FQDN", value: "cloudlabinc.sharepoint.com", tags: "", description: "Tenant SharePoint Online" },
    { name: "Office365-IPs", type: "IP Range", value: "13.107.6.152-13.107.6.167", tags: "", description: "Office 365 IP block" },
    { name: "RFC1918", type: "IP Netmask", value: "10.0.0.0/8", tags: "", description: "RFC1918 private range" },
    { name: "HQ-peer", type: "IP Netmask", value: "198.51.100.0/24", tags: "", description: "Remote HQ peer subnet" },
    { name: "tor-exit-nodes", type: "IP Range", value: "171.25.193.20-171.25.193.250", tags: "criticality-high", description: "Known Tor exit nodes" },
    { name: "C2-botnet-IPs", type: "IP Netmask", value: "185.220.100.0/24", tags: "criticality-high", description: "Known C2 IP block" },
  ];

  const addressGroups: PaloAddressGroup[] = [
    { name: "internal-all", type: "Static", members: "internal-net, guest-net, dmz-net", filter: "", tags: "environment-prod", description: "All internal networks" },
    { name: "partner-networks", type: "Static", members: "HQ-peer", filter: "", tags: "", description: "Partner / branch peer subnets" },
    { name: "blacklist-IPs", type: "Dynamic", members: "", filter: "'criticality-high' and 'malicious'", tags: "criticality-high", description: "Dynamic membership (tag-based)" },
  ];

  const services: PaloService[] = [
    { name: "service-http", protocol: "TCP", dstPort: "80", srcPort: "any", tags: "", description: "HTTP" },
    { name: "service-https", protocol: "TCP", dstPort: "443", srcPort: "any", tags: "", description: "HTTPS" },
    { name: "service-ssh", protocol: "TCP", dstPort: "22", srcPort: "any", tags: "", description: "SSH" },
    { name: "service-rdp", protocol: "TCP", dstPort: "3389", srcPort: "any", tags: "", description: "RDP" },
    { name: "service-dns-tcp", protocol: "TCP", dstPort: "53", srcPort: "any", tags: "", description: "DNS TCP" },
    { name: "service-dns-udp", protocol: "UDP", dstPort: "53", srcPort: "any", tags: "", description: "DNS UDP" },
    { name: "service-smtp", protocol: "TCP", dstPort: "25", srcPort: "any", tags: "", description: "SMTP" },
    { name: "service-imaps", protocol: "TCP", dstPort: "993", srcPort: "any", tags: "", description: "IMAPS" },
    { name: "service-pop3s", protocol: "TCP", dstPort: "995", srcPort: "any", tags: "", description: "POP3S" },
    { name: "service-mssql", protocol: "TCP", dstPort: "1433", srcPort: "any", tags: "", description: "MS SQL" },
    { name: "service-mysql", protocol: "TCP", dstPort: "3306", srcPort: "any", tags: "", description: "MySQL" },
    { name: "service-ntp", protocol: "UDP", dstPort: "123", srcPort: "any", tags: "", description: "NTP" },
    { name: "service-snmp", protocol: "UDP", dstPort: "161", srcPort: "any", tags: "", description: "SNMP" },
    { name: "service-ldap", protocol: "TCP", dstPort: "389", srcPort: "any", tags: "", description: "LDAP" },
    { name: "custom-app-tcp-8443", protocol: "TCP", dstPort: "8443", srcPort: "any", tags: "", description: "Custom application TCP 8443" },
    { name: "custom-app-udp-9999", protocol: "UDP", dstPort: "9999", srcPort: "any", tags: "", description: "Custom application UDP 9999" },
  ];

  const serviceGroups: PaloServiceGroup[] = [
    { name: "web-services", members: "service-http, service-https", tags: "", description: "Standard web traffic" },
    { name: "db-services", members: "service-mssql, service-mysql", tags: "", description: "Database traffic" },
  ];

  const applications: PaloApplication[] = [
    { name: "web-browsing", category: "general-internet", subcategory: "internet-utility", technology: "browser-based", risk: 4, ports: "tcp/80", tags: "", description: "Generic HTTP" },
    { name: "ssl", category: "networking", subcategory: "encrypted-tunnel", technology: "browser-based", risk: 4, ports: "tcp/443", tags: "", description: "SSL/TLS encrypted traffic" },
    { name: "dns", category: "networking", subcategory: "infrastructure", technology: "network-protocol", risk: 3, ports: "udp/53,tcp/53", tags: "", description: "Domain Name System" },
    { name: "ssh", category: "networking", subcategory: "remote-access", technology: "client-server", risk: 4, ports: "tcp/22", tags: "", description: "Secure Shell" },
    { name: "ms-rdp", category: "networking", subcategory: "remote-access", technology: "client-server", risk: 4, ports: "tcp/3389", tags: "", description: "Microsoft Remote Desktop" },
    { name: "ms-teams", category: "collaboration", subcategory: "voip-video", technology: "client-server", risk: 1, ports: "tcp/443", tags: "", description: "Microsoft Teams" },
    { name: "microsoft-365", category: "business-systems", subcategory: "office-programs", technology: "browser-based", risk: 1, ports: "tcp/443", tags: "", description: "Microsoft 365 suite" },
    { name: "salesforce", category: "business-systems", subcategory: "office-programs", technology: "browser-based", risk: 1, ports: "tcp/443", tags: "", description: "Salesforce CRM" },
    { name: "github", category: "collaboration", subcategory: "social-networking", technology: "browser-based", risk: 2, ports: "tcp/443", tags: "", description: "GitHub code hosting" },
    { name: "custom-finapp", category: "business-systems", subcategory: "office-programs", technology: "client-server", risk: 2, ports: "tcp/8443", tags: "owner-IT", description: "In-house finance application" },
  ];

  const applicationGroups: PaloApplicationGroup[] = [
    { name: "sanctioned-saas", members: "microsoft-365, salesforce, ms-teams", tags: "", description: "IT-approved SaaS" },
  ];

  const applicationFilters: PaloApplicationFilter[] = [
    { name: "high-risk-apps", category: "any", subcategory: "any", risk: "4,5", tags: "", description: "Risk 4 or 5 applications" },
  ];

  const tags: PaloTag[] = [
    { name: "environment-prod", color: "orange", comment: "Production assets" },
    { name: "environment-dev", color: "green", comment: "Dev / lab assets" },
    { name: "owner-IT", color: "blue", comment: "Owned by IT team" },
    { name: "criticality-high", color: "red", comment: "Business critical" },
    { name: "malicious", color: "red-dark", comment: "Known malicious (auto)" },
  ];

  // ---- Security Profiles ----
  const avProfiles: PaloAvProfile[] = [
    { name: "default", decoders: ["http", "smtp", "imap", "pop3", "ftp", "smb"], action: "default", wildfireAction: "default", packetCapture: false, description: "Default antivirus profile" },
    { name: "strict-AV", decoders: ["http", "https", "smtp", "imap", "pop3", "ftp", "smb", "ssh"], action: "reset-both", wildfireAction: "reset-both", packetCapture: true, description: "Strict - clones default + blocks more file types" },
  ];

  const asProfiles: PaloAsProfile[] = [
    { name: "default", rules: [{ severity: "critical,high", action: "reset-both" }, { severity: "medium", action: "alert" }], dnsSinkhole: "sinkhole.paloaltonetworks.com", description: "Default anti-spyware" },
    { name: "strict-AS", rules: [{ severity: "critical,high,medium", action: "reset-both" }], dnsSinkhole: "sinkhole.paloaltonetworks.com", description: "Strict anti-spyware" },
    { name: "paranoid-AS", rules: [{ severity: "critical,high,medium,low,informational", action: "reset-both" }], dnsSinkhole: "sinkhole.paloaltonetworks.com", description: "Block all spyware severities" },
  ];

  const vpProfiles: PaloVpProfile[] = [
    { name: "default", rules: [{ severity: "critical,high", action: "reset-both" }, { severity: "medium", action: "alert" }], packetCapture: "disable", description: "Default vulnerability protection" },
    { name: "strict-VP", rules: [{ severity: "critical,high,medium", action: "reset-both" }], packetCapture: "single-packet", description: "Strict vulnerability protection" },
  ];

  const urlProfiles: PaloUrlProfile[] = [
    { name: "default", categories: { malware: "block", phishing: "block", "command-and-control": "block" }, credentialDetection: "disabled", description: "Default URL filtering" },
    { name: "no-social-media", categories: { "social-networking": "block", malware: "block", phishing: "block", "command-and-control": "block" }, credentialDetection: "log", description: "Blocks social networking" },
    { name: "no-gambling", categories: { gambling: "block", malware: "block", phishing: "block" }, credentialDetection: "disabled", description: "Blocks gambling" },
  ];

  const fileProfiles: PaloFileProfile[] = [
    { name: "basic-file-blocking", rules: [{ apps: "any", filetypes: "PE,encrypted-rar", direction: "both", action: "block" }], description: "Block executables / encrypted archives" },
    { name: "strict-file-blocking", rules: [{ apps: "any", filetypes: "PE,7z,encrypted-rar,encrypted-zip,Multi-Level-Encoding", direction: "both", action: "block" }], description: "Strict file blocking" },
    { name: "default", rules: [{ apps: "any", filetypes: "any", direction: "both", action: "alert" }], description: "Alert only" },
  ];

  const wildfireProfiles: PaloWildfireProfile[] = [
    { name: "default", rules: [{ apps: "any", filetypes: "any", direction: "both", analysis: "public-cloud" }], description: "Default WildFire" },
    { name: "all-files", rules: [{ apps: "any", filetypes: "any", direction: "both", analysis: "public-cloud" }], description: "Submit all files" },
  ];

  const dataProfiles: PaloDataProfile[] = [
    { name: "default", patterns: ["credit-card", "ssn"], rules: [{ apps: "any", filetypes: "any", direction: "both", action: "block" }], description: "Block CC/SSN exfil" },
  ];

  const profileGroups: PaloProfileGroup[] = [
    { name: "default-group", av: "default", as: "default", vp: "default", url: "default", file: "default", wildfire: "default", data: "", description: "Standard profile group" },
    { name: "strict-group", av: "strict-AV", as: "strict-AS", vp: "strict-VP", url: "no-social-media", file: "strict-file-blocking", wildfire: "all-files", data: "default", description: "Strict profile group" },
  ];

  // ---- Policies ----
  const securityPolicies: PaloSecurityPolicy[] = [
    { id: 1, name: "allow-internal-to-internet", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-net", dstAddr: "any", users: "any", app: "any", service: "application-default", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "default-group", tag: "environment-prod", description: "Default outbound with content inspection", hitCount: 14820345, disabled: false },
    { id: 2, name: "block-social-media-workhours", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-net", dstAddr: "any", users: "any", app: "web-browsing, ssl", service: "application-default", urlCat: "social-networking", action: "deny", logStart: false, logEnd: true, profileGroup: "", tag: "environment-prod", description: "Block social media during work hours", hitCount: 88210, disabled: false },
    { id: 3, name: "dmz-to-internal-restricted", srcZone: "dmz", dstZone: "trust", srcAddr: "web-servers", dstAddr: "internal-net", users: "any", app: "mysql, mssql, ssh", service: "application-default", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "strict-group", tag: "criticality-high", description: "DMZ servers reach DB tier only", hitCount: 12420, disabled: false },
    { id: 4, name: "external-to-dmz-web", srcZone: "untrust", dstZone: "dmz", srcAddr: "any", dstAddr: "web-servers", users: "any", app: "web-browsing, ssl", service: "application-default", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "strict-group", tag: "criticality-high", description: "Public ingress to web (WildFire enabled)", hitCount: 9842123, disabled: false },
    { id: 5, name: "external-to-dmz-mail", srcZone: "untrust", dstZone: "dmz", srcAddr: "any", dstAddr: "mail-servers", users: "any", app: "smtp", service: "service-smtp", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "strict-group", tag: "criticality-high", description: "Inbound SMTP to mail server", hitCount: 421023, disabled: false },
    { id: 6, name: "internal-to-office365", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-net", dstAddr: "MS-365", users: "any", app: "microsoft-365, ms-teams", service: "application-default", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "default-group", tag: "environment-prod", description: "Office 365 (decryption bypass)", hitCount: 3320190, disabled: false },
    { id: 7, name: "allow-guest-internet", srcZone: "trust", dstZone: "untrust", srcAddr: "guest-net", dstAddr: "any", users: "any", app: "web-browsing, ssl, dns", service: "application-default", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "strict-group", tag: "environment-dev", description: "Guest WiFi outbound", hitCount: 188210, disabled: false },
    { id: 8, name: "allow-vpn-to-hq", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-net", dstAddr: "HQ-peer", users: "any", app: "any", service: "any", urlCat: "any", action: "allow", logStart: false, logEnd: true, profileGroup: "default-group", tag: "", description: "Site-to-site to HQ", hitCount: 280112, disabled: false },
    { id: 9, name: "allow-admin-ssh", srcZone: "management", dstZone: "trust", srcAddr: "any", dstAddr: "internal-net", users: "any", app: "ssh", service: "service-ssh", urlCat: "any", action: "allow", logStart: true, logEnd: true, profileGroup: "strict-group", tag: "owner-IT", description: "Admin SSH from mgmt", hitCount: 4218, disabled: false },
    { id: 10, name: "block-tor-exit", srcZone: "trust", dstZone: "untrust", srcAddr: "any", dstAddr: "tor-exit-nodes", users: "any", app: "any", service: "any", urlCat: "any", action: "deny", logStart: true, logEnd: true, profileGroup: "", tag: "criticality-high", description: "Block known Tor exits", hitCount: 1882, disabled: false },
    { id: 11, name: "block-c2", srcZone: "trust", dstZone: "untrust", srcAddr: "any", dstAddr: "C2-botnet-IPs", users: "any", app: "any", service: "any", urlCat: "any", action: "deny", logStart: true, logEnd: true, profileGroup: "", tag: "criticality-high", description: "Block known C2", hitCount: 421, disabled: false },
    { id: 12, name: "default-interzone-deny", srcZone: "any", dstZone: "any", srcAddr: "any", dstAddr: "any", users: "any", app: "any", service: "any", urlCat: "any", action: "deny", logStart: false, logEnd: true, profileGroup: "", tag: "", description: "Implicit cleanup deny-all", hitCount: 88312, disabled: false },
  ];

  const natPolicies: PaloNatPolicy[] = [
    { id: 1, name: "outbound-source-nat", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-all", dstAddr: "any", service: "any", type: "ipv4", natType: "source", sourceTranslation: "dynamic-ip-and-port", interfaceAddr: "ethernet1/1", translatedAddr: "", destTranslation: "", description: "PAT to WAN interface", disabled: false },
    { id: 2, name: "inbound-web-dnat", srcZone: "untrust", dstZone: "untrust", srcAddr: "any", dstAddr: "203.0.113.10", service: "service-https", type: "ipv4", natType: "destination", sourceTranslation: "none", interfaceAddr: "", translatedAddr: "10.2.0.5", destPort: "443", description: "DNAT public 443 to DMZ web", disabled: false },
    { id: 3, name: "inbound-mail-dnat", srcZone: "untrust", dstZone: "untrust", srcAddr: "any", dstAddr: "203.0.113.11", service: "service-smtp", type: "ipv4", natType: "destination", sourceTranslation: "none", interfaceAddr: "", translatedAddr: "10.2.0.6", destPort: "25", description: "DNAT public 25 to DMZ mail", disabled: false },
    { id: 4, name: "static-nat-mail", srcZone: "dmz", dstZone: "untrust", srcAddr: "mail-servers", dstAddr: "any", service: "any", type: "ipv4", natType: "source", sourceTranslation: "static-ip", interfaceAddr: "", translatedAddr: "203.0.113.11", destTranslation: "", description: "Static SNAT for mail outbound", disabled: false },
  ];

  const decryptionPolicies: PaloDecryptionPolicy[] = [
    { id: 1, name: "decrypt-all-https", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-net", dstAddr: "any", service: "service-https", urlCat: "any", action: "decrypt", type: "ssl-forward-proxy", profile: "default-decrypt", description: "Decrypt outbound HTTPS" },
    { id: 2, name: "bypass-financial", srcZone: "trust", dstZone: "untrust", srcAddr: "any", dstAddr: "any", service: "service-https", urlCat: "financial-services", action: "no-decrypt", type: "ssl-forward-proxy", profile: "", description: "Bypass financial sites" },
    { id: 3, name: "inbound-inspect-web", srcZone: "untrust", dstZone: "dmz", srcAddr: "any", dstAddr: "web-servers", service: "service-https", urlCat: "any", action: "decrypt", type: "ssl-inbound-inspection", profile: "default-decrypt", description: "SSL inbound inspection to web server" },
  ];

  const authPolicies: PaloAuthPolicy[] = [
    { id: 1, name: "require-auth-internet", srcZone: "trust", dstZone: "untrust", srcAddr: "internal-net", dstAddr: "any", service: "any", urlCat: "any", authProfile: "ldap-corp", timeout: 60, description: "Captive portal for outbound" },
  ];

  // ---- VPN / GP ----
  const ipsecTunnels: PaloIpsecTunnel[] = [
    { name: "to-HQ", gateway: "HQ-gw", peerIp: "198.51.100.1", ikeProfile: "default", ipsecProfile: "default", tunnelInterface: "tunnel.1", psk: "**********", proxyIds: [{ name: "pi-1", local: "10.1.0.0/24", remote: "198.51.100.0/24", proto: "any" }], status: "up", uptime: "14d 3h", bytesIn: "12.4 GB", bytesOut: "6.2 GB" },
    { name: "to-branch-1", gateway: "Branch-gw", peerIp: "198.51.100.50", ikeProfile: "default", ipsecProfile: "default", tunnelInterface: "tunnel.2", psk: "**********", proxyIds: [{ name: "pi-1", local: "10.1.0.0/24", remote: "10.50.0.0/16", proto: "any" }], status: "up", uptime: "6d 11h", bytesIn: "4.2 GB", bytesOut: "2.8 GB" },
  ];

  const ikeGateways: PaloIkeGateway[] = [
    { name: "HQ-gw", version: "IKEv2", peerIp: "198.51.100.1", localIp: "203.0.113.10", authType: "pre-shared-key", psk: "**********", localId: "@pa-edge-blr-01.cloudlab", peerId: "@hq-fw.cloudlab", cryptoProfile: "default" },
    { name: "Branch-gw", version: "IKEv2", peerIp: "198.51.100.50", localIp: "203.0.113.10", authType: "pre-shared-key", psk: "**********", localId: "@pa-edge-blr-01.cloudlab", peerId: "@br1-fw.cloudlab", cryptoProfile: "default" },
  ];

  const ikeCrypto: PaloIkeCrypto[] = [{ name: "default", dhGroup: "group14", auth: "sha256", encryption: "aes-256-cbc", lifetime: "8 hours" }];

  const ipsecCrypto: PaloIpsecCrypto[] = [{ name: "default", esp: true, dhGroup: "group14", auth: "sha256", encryption: "aes-256-cbc", lifetime: "1 hour" }];

  const globalProtect: PaloGlobalProtect = {
    portals: [
      { name: "gp-portal", iface: "ethernet1/1", ip: "203.0.113.10", cert: "GP-Portal-Cert", authProfile: "ldap-corp", clientCfg: "default-client", agentVersion: "6.3.2", description: "Primary GlobalProtect portal" },
    ],
    gateways: [
      { name: "gp-gateway", iface: "ethernet1/1", ip: "203.0.113.10", cert: "GP-Gateway-Cert", authProfile: "ldap-corp", tunnelInterface: "tunnel.3", ipPool: "172.16.99.0/24", description: "Primary gateway" },
    ],
  };

  // ---- Auth / Users ----
  const authProfiles: PaloAuthProfile[] = [
    { name: "local-users", method: "local-database", userDomain: "", allowList: "all", factors: ["password"], description: "Local database auth" },
    { name: "ldap-corp", method: "LDAP", userDomain: "corp", allowList: "corp\\domain users", factors: ["password"], description: "LDAP to AD" },
  ];

  const authSequence: PaloAuthSequence[] = [
    { name: "corp-seq", profiles: ["ldap-corp", "local-users"], description: "LDAP first, fall back to local" },
  ];

  const localUsers: PaloLocalUser[] = [
    { name: "admin", pwdSet: true, disabled: false, group: "Administrators" },
    { name: "gp-user-1", pwdSet: true, disabled: false, group: "GP-Users" },
    { name: "auditor", pwdSet: true, disabled: false, group: "Auditors" },
  ];

  const userGroups: PaloUserGroup[] = [
    { name: "Administrators", members: "admin" },
    { name: "GP-Users", members: "gp-user-1" },
    { name: "Auditors", members: "auditor" },
  ];

  // ---- Device ----
  const administrators: PaloAdministrator[] = [
    { name: "admin", role: "superuser", auth: "Local", publicKey: "no", client: "web/CLI" },
    { name: "netops", role: "deviceadmin", auth: "LDAP", publicKey: "yes", client: "web/CLI" },
    { name: "auditor", role: "audit-admin", auth: "Local", publicKey: "no", client: "web" },
  ];

  const certificates: PaloCertificate[] = [
    { name: "GP-Portal-Cert", cn: "gp.cloudlab.in", issuer: "CloudLab Internal CA", notAfter: "2027-04-12", usage: "GlobalProtect Portal", status: "valid" },
    { name: "GP-Gateway-Cert", cn: "gp.cloudlab.in", issuer: "CloudLab Internal CA", notAfter: "2027-04-12", usage: "GlobalProtect Gateway", status: "valid" },
    { name: "Forward-Trust", cn: "pa-edge-blr-01-fwd", issuer: "CloudLab Internal CA", notAfter: "2030-01-01", usage: "SSL Forward Proxy (trust)", status: "valid" },
    { name: "Forward-Untrust", cn: "pa-edge-blr-01-untrust", issuer: "Self-signed", notAfter: "2030-01-01", usage: "SSL Forward Proxy (untrust)", status: "valid" },
  ];

  const serverProfiles: PaloServerProfiles = {
    snmp: [{ name: "snmp-trap-1", server: "10.1.0.50", version: "v2c", community: "cloudlab" }],
    syslog: [{ name: "syslog-corp", server: "10.1.0.51", transport: "UDP", port: 514, format: "BSD" }],
    email: [{ name: "smtp-relay", server: "10.2.0.6", from: "pa-edge-blr-01@cloudlab.in", to: "soc@cloudlab.in" }],
    radius: [{ name: "radius-corp", server: "10.1.0.50", port: 1812, secret: "**********" }],
    ldap: [{ name: "ldap-corp", server: "dc01.corp.cloudlab.local", port: 389, baseDn: "dc=corp,dc=cloudlab,dc=local", bindDn: "cn=palo,ou=service,dc=corp,dc=cloudlab,dc=local", ssl: false }],
  };

  const logForwarding: PaloLogForwardingProfile[] = [
    { name: "default-fwd", traffic: "syslog-corp", threat: "syslog-corp", url: "syslog-corp", wildfire: "syslog-corp", system: "syslog-corp", description: "Forward everything to corp syslog" },
  ];

  const highAvailability: PaloHighAvailability = { enabled: false, mode: "active/passive", peerIp: "", priority: 100, preempt: false };

  const acc: PaloAcc = {
    topApps: [
      { name: "ssl", sessions: 821203, bytes: "184.2 GB", risk: 4 },
      { name: "web-browsing", sessions: 612084, bytes: "92.4 GB", risk: 4 },
      { name: "microsoft-365", sessions: 332019, bytes: "48.7 GB", risk: 1 },
      { name: "ms-teams", sessions: 184210, bytes: "34.8 GB", risk: 1 },
      { name: "dns", sessions: 188210, bytes: "2.4 GB", risk: 3 },
      { name: "salesforce", sessions: 88321, bytes: "12.3 GB", risk: 1 },
      { name: "github", sessions: 41023, bytes: "8.1 GB", risk: 2 },
      { name: "ssh", sessions: 12018, bytes: "0.4 GB", risk: 4 },
      { name: "ms-rdp", sessions: 4218, bytes: "0.2 GB", risk: 4 },
      { name: "custom-finapp", sessions: 2820, bytes: "0.3 GB", risk: 2 },
    ],
    topSources: [
      { ip: "10.1.0.45", sessions: 184210, bytes: "12.4 GB" },
      { ip: "10.1.0.108", sessions: 122019, bytes: "9.4 GB" },
      { ip: "10.1.0.211", sessions: 88012, bytes: "6.8 GB" },
      { ip: "10.10.10.55", sessions: 44210, bytes: "3.1 GB" },
      { ip: "10.2.0.5", sessions: 28201, bytes: "1.4 GB" },
    ],
    topDestinations: [
      { ip: "13.107.42.14", sessions: 421023, bytes: "48.7 GB", country: "US" },
      { ip: "142.250.80.46", sessions: 188210, bytes: "32.1 GB", country: "US" },
      { ip: "52.96.0.10", sessions: 132018, bytes: "21.4 GB", country: "US" },
      { ip: "8.8.8.8", sessions: 88012, bytes: "0.4 GB", country: "US" },
      { ip: "1.1.1.1", sessions: 44210, bytes: "0.2 GB", country: "US" },
    ],
    threatsByCategory: [
      { cat: "spyware", count: 412 },
      { cat: "vulnerability", count: 188 },
      { cat: "virus", count: 92 },
      { cat: "command-and-control", count: 42 },
      { cat: "phishing", count: 18 },
    ],
    topUrlBlocked: [
      { cat: "social-networking", count: 188210 },
      { cat: "malware", count: 412 },
      { cat: "phishing", count: 188 },
      { cat: "gambling", count: 92 },
      { cat: "questionable", count: 42 },
    ],
  };

  return {
    device,
    interfaces,
    zones,
    virtualRouters,
    vlans,

    addresses,
    addressGroups,
    services,
    serviceGroups,
    applications,
    applicationGroups,
    applicationFilters,
    tags,

    avProfiles,
    asProfiles,
    vpProfiles,
    urlProfiles,
    fileProfiles,
    wildfireProfiles,
    dataProfiles,
    profileGroups,

    securityPolicies,
    natPolicies,
    decryptionPolicies,
    authPolicies,

    ipsecTunnels,
    ikeGateways,
    ikeCrypto,
    ipsecCrypto,
    globalProtect,

    authProfiles,
    authSequence,
    localUsers,
    userGroups,

    administrators,
    certificates,
    serverProfiles,
    logForwarding,
    highAvailability,

    trafficLogs: seedTrafficLogs(),
    threatLogs: seedThreatLogs(),
    urlLogs: seedUrlLogs(),
    wildfireSubmissions: seedWildfire(),
    systemLogs: seedSystemLogs(),
    configLogs: seedConfigLogs(),

    acc,

    canonicalPalos: CANONICAL_PALOS,
    canonicalSites: CANONICAL_SITES,
    tenant: TENANT,
    vpnUsers: VPN_USERS,
  };
}
