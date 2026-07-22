import type { CiscoCanonicalSwitch, CiscoNatTranslation, CiscoSyslogEntry, CiscoAaaEvent, CiscoRoutingEvent, CiscoDhcpBinding, CiscoState } from "./types";

// Note: source's seeded generators below (syslog/routing-events/AAA-events/NAT
// translations/DHCP bindings) are all pure index-driven formulas — no randomness,
// seeded or otherwise, was needed to reproduce them exactly (ported 1:1 from
// cisco-data.js). The shared LCG convention (see routing-engine.ts and reducer.ts)
// is used wherever this port introduces genuinely random-ish behavior (tickCounters,
// ping/traceroute), consistent with every other port in this app.

// All timestamps are derived from a single fixed "now" baseline rather than
// Date.now()/new Date() at module scope (per the no-wall-clock-in-seed-files rule),
// matching source's `defaults()` snapshot which itself embeds a fixed systemTime.
const NOW_MS = Date.UTC(2026, 4, 14, 9, 42, 18); // 2026-05-14 09:42:18 UTC (matches device.systemTime)

function isoAt(offsetMs: number): string {
  return new Date(NOW_MS - offsetMs).toISOString().replace("T", " ").slice(0, 19);
}

function sevNum(sev: string): number {
  const table: Record<string, number> = {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7,
  };
  return table[sev] ?? 6;
}

// ===================================================================
// CloudLab Inc. shared roster convention — same fictional continuity used across
// every prior port (Meraki/Power Platform/Azure DevOps/etc). Source's
// `applyCanonical()` reads `CloudLabInfra.INFRA.networkDevices` (filtered
// `vendor === 'Cisco'`), `CloudLabInfra.SITES`, and `CloudLabInfra.TENANT` from a
// shared cloudlab-infra.js this Next.js app does not have; we replicate the EFFECT
// by hardcoding an equivalent roster inline here rather than a separate
// merge-after-load step, since this is a fresh TS port with no localStorage legacy
// state to reconcile against.
// ===================================================================

const TENANT_COMPANY = "CloudLab Inc.";
const TENANT_DOMAIN = "cloudlab.in";

const CANONICAL_SWITCHES: CiscoCanonicalSwitch[] = [
  { hostname: "SW-CORE-MUM-01", vendor: "Cisco", mgmtIp: "10.10.0.1", site: "Mumbai HQ", role: "core" },
  { hostname: "SW-DIST-MUM-01", vendor: "Cisco", mgmtIp: "10.10.1.1", site: "Mumbai HQ", role: "distribution" },
  { hostname: "SW-CORE-BLR-01", vendor: "Cisco", mgmtIp: "10.20.0.1", site: "Bengaluru", role: "core" },
  { hostname: "FW-EDGE-BLR-01", vendor: "Cisco", mgmtIp: "203.0.113.10", site: "Bengaluru", role: "edge-firewall" },
  { hostname: "SW-DIST-HYD-01", vendor: "Cisco", mgmtIp: "10.30.0.1", site: "Hyderabad", role: "distribution" },
  { hostname: "SW-CORE-SIN-01", vendor: "Cisco", mgmtIp: "10.40.0.1", site: "Singapore-DR", role: "core" },
  { hostname: "SW-ACC-PUN-01", vendor: "Cisco", mgmtIp: "10.50.0.1", site: "Pune", role: "access" },
];

const CANONICAL_SITES = [
  { name: "Mumbai HQ", region: "APAC", tier: "primary" },
  { name: "Bengaluru", region: "APAC", tier: "primary" },
  { name: "Hyderabad", region: "APAC", tier: "secondary" },
  { name: "Singapore-DR", region: "APAC", tier: "dr" },
  { name: "Pune", region: "APAC", tier: "secondary" },
];

// ---------- seeded log/data generators (ported 1:1 from cisco-data.js formulas) ----------

function seedSyslog(): CiscoSyslogEntry[] {
  const msgs = [
    { fac: "LINEPROTO", sev: "notice", mn: "UPDOWN", text: "Line protocol on Interface GigabitEthernet0/0/1, changed state to up" },
    { fac: "LINK", sev: "warning", mn: "CHANGED", text: "Interface GigabitEthernet0/0/3, changed state to administratively down" },
    { fac: "OSPF", sev: "notice", mn: "ADJCHG", text: "Process 1, Nbr 2.2.2.2 on GigabitEthernet0/0/1 from LOADING to FULL, Loading Done" },
    { fac: "OSPF", sev: "notice", mn: "ADJCHG", text: "Process 1, Nbr 3.3.3.3 on GigabitEthernet0/0/1 from EXSTART to EXCHANGE, Negotiation Done" },
    { fac: "DUAL", sev: "notice", mn: "NBRCHANGE", text: "EIGRP-IPv4 100: Neighbor 10.10.0.2 (GigabitEthernet0/0/1) is up: new adjacency" },
    { fac: "BGP", sev: "notice", mn: "ADJCHANGE", text: "neighbor 203.0.113.1 Up" },
    { fac: "SEC", sev: "warning", mn: "IPACCESSLOG", text: "list 100 denied tcp 45.155.205.233(54213) -> 203.0.113.10(22), 1 packet" },
    { fac: "SEC", sev: "warning", mn: "IPACCESSLOG", text: "list 100 denied tcp 185.220.101.4(40221) -> 203.0.113.10(3389), 1 packet" },
    { fac: "SEC", sev: "warning", mn: "IPACCESSLOG", text: "list 110 denied udp 10.10.0.45(54221) -> 8.8.8.8(53) facebook.com lookup" },
    { fac: "SYS", sev: "info", mn: "CONFIG_I", text: "Configured from console by admin on vty0 (10.99.0.50)" },
    { fac: "SYS", sev: "info", mn: "LOGGINGHOST_STARTSTOP", text: "Logging to host 10.10.0.50 started - reconnection" },
    { fac: "PARSER", sev: "info", mn: "CFGLOG_LOGGEDCMD", text: "User:admin  logged command:interface GigabitEthernet0/0/1" },
    { fac: "TACACS", sev: "notice", mn: "AUTH", text: "User admin authentication succeeded - server 10.10.0.5" },
    { fac: "TACACS", sev: "warning", mn: "AUTHFAIL", text: "User unknown authentication failed - server 10.10.0.5" },
    { fac: "DHCPD", sev: "info", mn: "ASSIGN", text: "DHCP assigned IP 10.10.0.142 to client mac 00aa.bbcc.0102 on Gi0/0/1" },
    { fac: "DHCPD", sev: "warning", mn: "CONFLICT", text: "DHCP address conflict for 10.10.0.55 (declined)" },
    { fac: "CRYPTO", sev: "notice", mn: "ISAKMP_AUTH_SUCCESS", text: "IPsec SA established peer 198.51.100.1" },
    { fac: "CRYPTO", sev: "warning", mn: "IKEV2_PROTO", text: "IKEv2 peer 198.51.100.99 not responding - retry 3/5" },
    { fac: "NTP", sev: "info", mn: "SYNC_LOST", text: "NTP synchronization lost - master 10.10.0.6" },
    { fac: "NTP", sev: "info", mn: "SYNC", text: "NTP synchronized to master 10.10.0.6 stratum 2" },
    { fac: "CDP", sev: "info", mn: "DUPLEX_MISMATCH", text: "duplex mismatch discovered on GigabitEthernet0/0/0 (half-duplex), with SwitchA Gi1/0/24 (full-duplex)" },
    { fac: "STP", sev: "notice", mn: "TOPOTRAP", text: "Topology change occurred in vlan 10" },
    { fac: "HWIDB", sev: "info", mn: "LINEPROTO_UP", text: "Line protocol on Interface Loopback0 changed state to up" },
    { fac: "SYS", sev: "notice", mn: "PRIV_AUTH_PASS", text: "Privilege level set to 15 by admin on vty0" },
    { fac: "PLATFORM", sev: "info", mn: "BOOT", text: "System booted normally - bootreason: Reload requested by admin" },
  ] as const;
  const out: CiscoSyslogEntry[] = [];
  for (let i = 0; i < 50; i++) {
    const m = msgs[i % msgs.length];
    out.push({
      ts: isoAt(i * 168000),
      seq: 100000 + (50 - i),
      facility: m.fac,
      severity: m.sev,
      mnemonic: m.mn,
      message: `%${m.fac}-${sevNum(m.sev)}-${m.mn}: ${m.text}`,
    });
  }
  return out;
}

function seedRoutingEvents(): CiscoRoutingEvent[] {
  const rows = [
    { proto: "OSPF", event: "ADJCHG", detail: "Process 1, Nbr 2.2.2.2 on Gi0/0/1 from FULL to DOWN, Dead timer expired" },
    { proto: "OSPF", event: "ADJCHG", detail: "Process 1, Nbr 2.2.2.2 on Gi0/0/1 from DOWN to FULL, Loading Done" },
    { proto: "EIGRP", event: "NBRCHANGE", detail: "AS 100: Neighbor 10.10.0.2 (Gi0/0/1) is up: new adjacency" },
    { proto: "EIGRP", event: "NBRCHANGE", detail: "AS 100: Neighbor 10.10.0.3 (Gi0/0/1) resync: peer graceful-restart" },
    { proto: "BGP", event: "ADJCHANGE", detail: "neighbor 203.0.113.1 Up" },
    { proto: "BGP", event: "ADJCHANGE", detail: "neighbor 198.51.100.1 Down: Notification received - hold timer expired" },
    { proto: "BGP", event: "PREFIX", detail: "Maximum prefix limit 5000 reached for 203.0.113.1 (4218/5000)" },
    { proto: "OSPF", event: "AUTHFAIL", detail: "Authentication failure from 10.10.0.4 on Gi0/0/1" },
    { proto: "EIGRP", event: "AUTHFAIL", detail: "Authentication failure with 10.10.0.9 on Gi0/0/1 - key-id mismatch" },
  ] as const;
  const out: CiscoRoutingEvent[] = [];
  for (let i = 0; i < 30; i++) {
    const r = rows[i % rows.length];
    out.push({ ts: isoAt(i * 442000), proto: r.proto, event: r.event, detail: r.detail });
  }
  return out;
}

function seedAaaEvents(): CiscoAaaEvent[] {
  const users = ["admin", "netops", "audit", "contractor", "svc-monitor", "unknown"];
  const sources = ["10.99.0.50", "10.10.0.55", "10.10.0.108", "45.155.205.233", "185.220.101.4", "10.10.0.108"];
  const methods = ["ssh", "https", "console", "telnet"];
  const out: CiscoAaaEvent[] = [];
  for (let i = 0; i < 25; i++) {
    const fail = i % 5 === 0 || users[i % users.length] === "unknown";
    out.push({
      ts: isoAt(i * 280000),
      user: users[i % users.length],
      source: sources[i % sources.length],
      method: methods[i % methods.length],
      server: i % 2 === 0 ? "10.10.0.5 (TACACS+)" : "local",
      result: fail ? "FAILED" : "SUCCESS",
      reason: fail ? "Bad password" : "Authenticated",
    });
  }
  return out;
}

function seedNatTranslations(): CiscoNatTranslation[] {
  const rows: CiscoNatTranslation[] = [];
  for (let i = 0; i < 12; i++) {
    rows.push({
      proto: i % 4 === 0 ? "udp" : "tcp",
      insideLocal: `10.10.0.${45 + i}:${51000 + i * 17}`,
      insideGlobal: `203.0.113.10:${51000 + i * 17}`,
      outsideLocal: `142.250.80.${40 + i}:443`,
      outsideGlobal: `142.250.80.${40 + i}:443`,
    });
  }
  return rows;
}

function seedDhcpBindings(): CiscoDhcpBinding[] {
  const rows: CiscoDhcpBinding[] = [];
  for (let i = 0; i < 14; i++) {
    const hex = (i + 16).toString(16).padStart(4, "0").toUpperCase();
    rows.push({
      ip: `10.10.0.${10 + i}`,
      mac: `00AA.BBCC.${hex}`,
      lease: "2026-05-21 10:42:18",
      type: "Automatic",
      hostname: `host-${10 + i}`,
    });
  }
  return rows;
}

/**
 * Builds a brand-new CiscoState. Ports source's `defaults()` faithfully (every
 * field, exact seed values) and additionally seeds `canonicalSwitches` /
 * `canonicalSites` / `tenant` directly (source's separate `applyCanonical()`
 * merge-after-load step has no equivalent here since there's no localStorage legacy
 * state to reconcile against — a fresh TS port just seeds these correctly from the
 * start) and `diagHistory: []` (new field, not in source — starts empty and is
 * populated by RUN_PING/RUN_TRACEROUTE reducer actions).
 */
export function freshCiscoState(): CiscoState {
  return {
    device: {
      hostname: "Router-Core-01",
      model: "ISR-4451-X",
      iosVersion: "17.12.4",
      iosImage: "isr4400v-universalk9.17.12.04.SPA.bin",
      serial: "FCH2342G0XX",
      uptime: "25 days, 4 hours, 12 minutes",
      location: "Bangalore-DC-Rack-3",
      contact: "noc@cloudlab.local",
      bootReason: "Reload requested by admin",
      configRegister: "0x2102",
      systemTime: "2026-05-14 09:42:18 UTC",
      timezone: "IST +05:30",
      adminUser: "admin",
      privilegeLevel: 15,
      cpu5sec: 18,
      cpu1min: 22,
      cpu5min: 24,
      memTotal: 4194304,
      memUsed: 1932810,
      tempSystem: "OK (44C)",
      tempCpu: "OK (52C)",
      fanStatus: "Normal",
      powerSupply: "PS1 OK, PS2 OK (redundant)",
      bannerMotd: "Authorized access only. All activity is logged.",
      domainName: "cloudlab.local",
      dnsServers: ["8.8.8.8", "1.1.1.1"],
      ntpServers: ["10.10.0.6", "time.google.com"],
    },
    interfaces: [
      {
        name: "GigabitEthernet0/0/0",
        alias: "WAN",
        role: "wan",
        ip: "203.0.113.10",
        mask: "255.255.255.0",
        mtu: 1500,
        duplex: "full",
        speed: "1000Mb/s",
        adminUp: true,
        lineUp: true,
        description: "WAN uplink to ISP",
        encap: "ARPA",
        mac: "00:50:56:8a:c1:00",
        natRole: "outside",
        inputErrors: 12,
        crcErrors: 4,
        frameErrors: 1,
        overrun: 0,
        ignored: 0,
        outputDrops: 22,
        lateCollisions: 0,
        deferred: 0,
        inputPackets: 84212105,
        outputPackets: 79122388,
        bytesIn: 92408123456,
        bytesOut: 74221984765,
        loadIn: 38,
        loadOut: 19,
        inputRate: 8400000,
        outputRate: 4200000,
      },
      {
        name: "GigabitEthernet0/0/1",
        alias: "LAN",
        role: "lan",
        ip: "10.10.0.1",
        mask: "255.255.255.0",
        mtu: 1500,
        duplex: "full",
        speed: "1000Mb/s",
        adminUp: true,
        lineUp: true,
        description: "Corporate LAN core",
        encap: "ARPA",
        mac: "00:50:56:8a:c1:01",
        natRole: "inside",
        inputErrors: 0,
        crcErrors: 0,
        frameErrors: 0,
        overrun: 0,
        ignored: 0,
        outputDrops: 0,
        lateCollisions: 0,
        deferred: 0,
        inputPackets: 158234982,
        outputPackets: 164822005,
        bytesIn: 162033484920,
        bytesOut: 178223490012,
        loadIn: 24,
        loadOut: 31,
        inputRate: 5200000,
        outputRate: 6100000,
      },
      {
        name: "GigabitEthernet0/0/2",
        alias: "DMZ",
        role: "dmz",
        ip: "10.20.0.1",
        mask: "255.255.255.0",
        mtu: 1500,
        duplex: "full",
        speed: "1000Mb/s",
        adminUp: true,
        lineUp: true,
        description: "DMZ segment for public servers",
        encap: "ARPA",
        mac: "00:50:56:8a:c1:02",
        natRole: "inside",
        inputErrors: 0,
        crcErrors: 0,
        frameErrors: 0,
        overrun: 0,
        ignored: 0,
        outputDrops: 0,
        lateCollisions: 0,
        deferred: 0,
        inputPackets: 22102311,
        outputPackets: 24891022,
        bytesIn: 18221984000,
        bytesOut: 21442108880,
        loadIn: 12,
        loadOut: 14,
        inputRate: 2200000,
        outputRate: 2800000,
      },
      {
        name: "GigabitEthernet0/0/3",
        alias: "",
        role: "unused",
        ip: "",
        mask: "",
        mtu: 1500,
        duplex: "auto",
        speed: "auto",
        adminUp: false,
        lineUp: false,
        description: "Unused - shut",
        encap: "ARPA",
        mac: "00:50:56:8a:c1:03",
        natRole: "",
        inputErrors: 0,
        crcErrors: 0,
        frameErrors: 0,
        overrun: 0,
        ignored: 0,
        outputDrops: 0,
        lateCollisions: 0,
        deferred: 0,
        inputPackets: 0,
        outputPackets: 0,
        bytesIn: 0,
        bytesOut: 0,
        loadIn: 0,
        loadOut: 0,
        inputRate: 0,
        outputRate: 0,
      },
      {
        name: "Loopback0",
        alias: "RID",
        role: "loopback",
        ip: "1.1.1.1",
        mask: "255.255.255.255",
        mtu: 1500,
        duplex: "-",
        speed: "-",
        adminUp: true,
        lineUp: true,
        description: "Router-ID / management loopback",
        encap: "LOOPBACK",
        mac: "",
        natRole: "",
        inputErrors: 0,
        crcErrors: 0,
        frameErrors: 0,
        overrun: 0,
        ignored: 0,
        outputDrops: 0,
        lateCollisions: 0,
        deferred: 0,
        inputPackets: 1822,
        outputPackets: 1822,
        bytesIn: 184500,
        bytesOut: 184500,
        loadIn: 0,
        loadOut: 0,
        inputRate: 0,
        outputRate: 0,
      },
    ],
    vlans: [
      { id: 10, name: "Engineering", state: "active", ports: "Gi1/0/1-12", members: 12, gateway: "10.10.0.1" },
      { id: 20, name: "Sales", state: "active", ports: "Gi1/0/13-20", members: 8, gateway: "10.20.0.1" },
      { id: 30, name: "Guest", state: "active", ports: "Gi1/0/21-24", members: 4, gateway: "10.30.0.1" },
      { id: 99, name: "Management", state: "active", ports: "Gi1/0/48", members: 1, gateway: "10.99.0.1" },
    ],
    vtp: {
      domain: "CLOUDLAB",
      mode: "Server",
      version: 3,
      revision: 8,
      pruning: false,
      password: "********",
    },
    spanningTree: {
      mode: "rapid-pvst",
      priority: 24576,
      rootBridge: "10:00:11:22:33:44 (this switch)",
      helloTime: 2,
      forwardDelay: 15,
      maxAge: 20,
    },
    etherChannels: [
      { group: 1, protocol: "LACP", members: "Gi0/1, Gi0/2", mode: "active", load: "src-dst-ip", status: "up" },
      { group: 2, protocol: "PAgP", members: "Gi0/3, Gi0/4", mode: "desirable", load: "src-mac", status: "up" },
    ],
    staticRoutes: [
      { dst: "0.0.0.0", mask: "0.0.0.0", nextHop: "203.0.113.1", iface: "GigabitEthernet0/0/0", distance: 1, tag: "", comment: "Default to ISP" },
      { dst: "10.50.0.0", mask: "255.255.0.0", nextHop: "10.10.0.254", iface: "", distance: 10, tag: "", comment: "Branch summary via core" },
      { dst: "192.168.100.0", mask: "255.255.255.0", nextHop: "10.10.0.2", iface: "", distance: 5, tag: "", comment: "Lab segment" },
    ],
    ripConfig: {
      enabled: false,
      version: 2,
      networks: ["10.0.0.0"],
      passiveInterfaces: ["GigabitEthernet0/0/0"],
      autoSummary: false,
    },
    eigrpConfig: {
      enabled: true,
      asn: 100,
      routerId: "1.1.1.1",
      networks: [
        { network: "10.10.0.0", wildcard: "0.0.0.255" },
        { network: "10.20.0.0", wildcard: "0.0.0.255" },
      ],
      passiveInterfaces: ["GigabitEthernet0/0/0"],
      authMode: "md5",
      authKey: "********",
    },
    eigrpNeighbors: [
      { neighbor: "10.10.0.2", iface: "Gi0/0/1", holdTime: 13, uptime: "6d 04:12:18", srtt: 12, rto: 200, q: 0, seq: 982 },
      { neighbor: "10.10.0.3", iface: "Gi0/0/1", holdTime: 11, uptime: "4d 22:08:01", srtt: 8, rto: 200, q: 0, seq: 651 },
    ],
    ospfConfig: {
      enabled: true,
      processId: 1,
      routerId: "1.1.1.1",
      areas: [{ area: 0, type: "standard", networks: ["10.10.0.0/24", "10.20.0.0/24", "1.1.1.1/32"] }],
      referenceBandwidth: 10000,
      passiveInterfaces: ["GigabitEthernet0/0/0"],
      authMode: "message-digest",
      authKey: "********",
    },
    ospfNeighbors: [
      { neighbor: "2.2.2.2", iface: "Gi0/0/1", priority: 1, state: "FULL/BDR", deadTime: "00:00:38", address: "10.10.0.2" },
      { neighbor: "3.3.3.3", iface: "Gi0/0/1", priority: 1, state: "FULL/DROTHER", deadTime: "00:00:35", address: "10.10.0.3" },
    ],
    bgpConfig: {
      enabled: true,
      asn: 65001,
      routerId: "1.1.1.1",
      neighbors: [
        { peer: "203.0.113.1", remoteAs: 64500, description: "ISP-A", state: "Established", uptime: "12d 03:14:55", prefixesIn: 4218, prefixesOut: 12 },
        { peer: "198.51.100.1", remoteAs: 65010, description: "Partner", state: "Established", uptime: "4d 18:02:11", prefixesIn: 22, prefixesOut: 8 },
      ],
      networks: ["203.0.113.0/24"],
    },
    acls: [
      {
        number: 100,
        name: "",
        type: "extended",
        bound: "Gi0/0/1 in",
        rules: [
          { seq: 10, action: "permit", proto: "tcp", src: "10.10.0.0", srcWc: "0.0.0.255", dst: "any", dstWc: "", op: "eq", port: "80", log: false, hits: 482311 },
          { seq: 20, action: "permit", proto: "tcp", src: "10.10.0.0", srcWc: "0.0.0.255", dst: "any", dstWc: "", op: "eq", port: "443", log: false, hits: 1822480 },
          { seq: 30, action: "permit", proto: "udp", src: "10.10.0.0", srcWc: "0.0.0.255", dst: "any", dstWc: "", op: "eq", port: "53", log: false, hits: 224120 },
          { seq: 40, action: "permit", proto: "icmp", src: "10.10.0.0", srcWc: "0.0.0.255", dst: "any", dstWc: "", op: "", port: "", log: false, hits: 12 },
          { seq: 50, action: "deny", proto: "ip", src: "any", srcWc: "", dst: "any", dstWc: "", op: "", port: "", log: true, hits: 0 },
        ],
      },
      {
        number: 101,
        name: "",
        type: "extended",
        bound: "",
        rules: [
          { seq: 10, action: "deny", proto: "tcp", src: "any", srcWc: "", dst: "any", dstWc: "", op: "eq", port: "6881", log: true, hits: 12041 },
          { seq: 20, action: "deny", proto: "tcp", src: "any", srcWc: "", dst: "any", dstWc: "", op: "eq", port: "4662", log: true, hits: 0 },
          { seq: 30, action: "permit", proto: "ip", src: "any", srcWc: "", dst: "any", dstWc: "", op: "", port: "", log: false, hits: 8224990 },
        ],
      },
      {
        number: 10,
        name: "MGMT-IN",
        type: "standard",
        bound: "vty 0 4 in",
        rules: [
          { seq: 10, action: "permit", proto: "", src: "10.99.0.0", srcWc: "0.0.0.255", dst: "", dstWc: "", op: "", port: "", log: false, hits: 412 },
          { seq: 20, action: "permit", proto: "", src: "10.10.0.50", srcWc: "0.0.0.0", dst: "", dstWc: "", op: "", port: "", log: false, hits: 88 },
          { seq: 30, action: "deny", proto: "", src: "any", srcWc: "", dst: "", dstWc: "", op: "", port: "", log: true, hits: 4 },
        ],
      },
      {
        number: 110,
        name: "",
        type: "extended",
        bound: "",
        rules: [
          {
            seq: 10,
            action: "deny",
            proto: "udp",
            src: "any",
            srcWc: "",
            dst: "any",
            dstWc: "",
            op: "eq",
            port: "53",
            log: true,
            remark: "Block social media DNS",
            hits: 8200,
          },
          { seq: 20, action: "permit", proto: "ip", src: "any", srcWc: "", dst: "any", dstWc: "", op: "", port: "", log: false, hits: 92312 },
        ],
      },
    ],
    nat: {
      overload: true,
      outsideInterface: "GigabitEthernet0/0/0",
      insideInterfaces: ["GigabitEthernet0/0/1", "GigabitEthernet0/0/2"],
      aclRef: 1,
      staticEntries: [
        { type: "static-tcp", insideLocal: "10.20.0.5", port: 80, insideGlobal: "203.0.113.10", globalPort: 80, comment: "Public web server" },
        { type: "static-tcp", insideLocal: "10.20.0.6", port: 443, insideGlobal: "203.0.113.10", globalPort: 443, comment: "Public HTTPS" },
        { type: "static", insideLocal: "10.20.0.7", port: "", insideGlobal: "203.0.113.11", globalPort: "", comment: "1:1 mail server" },
      ],
      translations: seedNatTranslations(),
    },
    aaa: {
      enabled: true,
      model: "new-model",
      methods: {
        login: ["group tacacs+", "local"],
        enable: ["group tacacs+", "enable"],
        exec: ["group tacacs+", "local"],
        commands: { "15": ["group tacacs+", "local"] },
      },
      tacacsServers: [{ name: "TACACS-Primary", address: "10.10.0.5", port: 49, key: "**********", timeout: 5, singleConn: true, status: "reachable" }],
      radiusServers: [{ name: "RADIUS-Primary", address: "10.10.0.6", port: 1812, key: "**********", timeout: 5, status: "reachable" }],
      accounting: "tacacs+",
    },
    localUsers: [
      { username: "admin", privilege: 15, secret: "cisco", encryption: "type-9", comment: "Default admin" },
      { username: "netops", privilege: 7, secret: "cisco", encryption: "type-9", comment: "Operator" },
      { username: "audit", privilege: 1, secret: "cisco", encryption: "type-9", comment: "Read-only" },
    ],
    dhcpPools: [
      {
        name: "LAN-POOL",
        network: "10.10.0.0",
        mask: "255.255.255.0",
        gateway: "10.10.0.1",
        dns: "10.10.0.2,8.8.8.8",
        excluded: "10.10.0.1-10.10.0.9",
        leaseDays: 7,
        domain: "cloudlab.local",
        active: 142,
        free: 98,
        options: [
          { code: 150, type: "ip", value: "10.10.0.20", name: "TFTP Server" },
          { code: 66, type: "string", value: "10.10.0.20", name: "Boot Server" },
        ],
      },
      {
        name: "DMZ-POOL",
        network: "10.20.0.0",
        mask: "255.255.255.0",
        gateway: "10.20.0.1",
        dns: "10.10.0.2",
        excluded: "10.20.0.1-10.20.0.9",
        leaseDays: 14,
        domain: "cloudlab.local",
        active: 28,
        free: 218,
        options: [],
      },
    ],
    dhcpBindings: seedDhcpBindings(),
    snmp: {
      communities: [
        { string: "public", access: "RO", acl: "10" },
        { string: "lab-rw", access: "RW", acl: "10" },
      ],
      trapHosts: [{ host: "10.10.0.50", community: "public", version: "2c", traps: ["snmp", "interface", "syslog", "config"] }],
      contact: "noc@cloudlab.local",
      location: "Bangalore-DC-Rack-3",
    },
    syslog: {
      bufferSize: 8192,
      bufferLevel: "informational",
      consoleLevel: "critical",
      monitorLevel: "debugging",
      trapLevel: "informational",
      servers: [{ host: "10.10.0.50", vrf: "", source: "Loopback0" }],
      entries: seedSyslog(),
    },
    httpsServer: {
      http: true,
      https: true,
      port: 443,
      sslPort: 443,
      aaaAuthList: "default",
      acl: "10",
    },
    sshConfig: {
      enabled: true,
      version: 2,
      timeout: 60,
      retries: 3,
      acl: "10",
      cryptoKeyBits: 2048,
    },
    telnetConfig: { enabled: false },
    vtyLines: { range: "0 4", transport: "ssh", execTimeout: "15 0", accessClass: "MGMT-IN in" },
    ntpAssociations: [
      { server: "10.10.0.6", stratum: 2, when: 47, poll: 1024, reach: 377, delay: 0.8, offset: -1.2, disp: 0.4, sync: true },
      { server: "time.google.com", stratum: 1, when: 12, poll: 1024, reach: 377, delay: 14.2, offset: 0.5, disp: 1.1, sync: false },
    ],
    certificates: [
      { name: "Router-SSC", type: "Self-Signed", usage: "HTTPS/SSH", valid: "2026-01-01 to 2031-01-01", status: "valid" },
      { name: "CA-CloudLab", type: "Trust-Point CA", usage: "IPsec", valid: "2024-01-01 to 2034-01-01", status: "valid" },
    ],
    ipsecTunnels: [
      {
        name: "VPN-HQ",
        peer: "198.51.100.1",
        auth: "PSK",
        ike: "IKEv2",
        enc: "AES-256",
        hash: "SHA-256",
        dh: 14,
        localNet: "10.10.0.0/24",
        remoteNet: "198.51.100.0/24",
        state: "UP-ACTIVE",
        pkts: 8214901,
        kBytes: 192834,
        uptime: "12d 04:18:11",
      },
      {
        name: "VPN-Branch",
        peer: "198.51.100.50",
        auth: "PKI",
        ike: "IKEv2",
        enc: "AES-256",
        hash: "SHA-256",
        dh: 14,
        localNet: "10.10.0.0/24",
        remoteNet: "10.50.0.0/16",
        state: "UP-IDLE",
        pkts: 220411,
        kBytes: 8204,
        uptime: "3d 12:04:02",
      },
      {
        name: "VPN-DR",
        peer: "198.51.100.99",
        auth: "PSK",
        ike: "IKEv1",
        enc: "AES-128",
        hash: "SHA-1",
        dh: 5,
        localNet: "10.10.0.0/24",
        remoteNet: "172.16.0.0/16",
        state: "DOWN-NEGO",
        pkts: 0,
        kBytes: 0,
        uptime: "-",
      },
    ],
    sslVpn: {
      gateways: [{ name: "SSLGW1", listenIf: "GigabitEthernet0/0/0", port: 443, idle: 1800, cert: "Router-SSC", activeSessions: 14, peakSessions: 38 }],
    },
    ips: {
      enabled: true,
      signatures: 5842,
      action: "alert,drop",
      lastUpdate: "2026-05-10",
      blockedRecently: 184,
    },
    qos: {
      wizardApplied: true,
      classMaps: [
        { name: "VOICE", match: "dscp ef", hits: 8224912 },
        { name: "VIDEO", match: "dscp af41", hits: 1822480 },
        { name: "CRITICAL", match: "dscp cs6", hits: 1241 },
        { name: "BULK", match: "dscp af11", hits: 4221008 },
        { name: "DEFAULT", match: "class-default", hits: 92223441 },
      ],
      policyMaps: [
        {
          name: "WAN-EGRESS",
          applied: "Gi0/0/0 output",
          classes: [
            { class: "VOICE", bw: "20%", shape: "", queue: "priority", drop: 0 },
            { class: "VIDEO", bw: "15%", shape: "", queue: "cbwfq", drop: 22 },
            { class: "CRITICAL", bw: "5%", shape: "", queue: "cbwfq", drop: 0 },
            { class: "BULK", bw: "10%", shape: "", queue: "cbwfq", drop: 188 },
            { class: "DEFAULT", bw: "50%", shape: "", queue: "fair-queue", drop: 4220 },
          ],
        },
      ],
    },
    voiceConfig: {
      callManager: "CUCM-CLOUDLAB",
      dialPeers: 12,
      phones: 42,
      gateway: "enabled",
    },
    wirelessConfig: {
      country: "IN",
      radios: [
        { id: 0, band: "2.4 GHz", channel: 6, power: 17, status: "enabled" },
        { id: 1, band: "5 GHz", channel: 36, power: 20, status: "enabled" },
      ],
      ssids: [
        { name: "CLOUDLAB-CORP", vlan: 10, security: "WPA3-Enterprise", clients: 18 },
        { name: "CLOUDLAB-GUEST", vlan: 30, security: "WPA2-PSK", clients: 7 },
      ],
    },
    firewallStats: {
      activeSessions: 4218,
      halfOpen: 142,
      droppedPkts: 18420,
      policy: "inspect ICMP, TCP, UDP, HTTP",
    },
    files: [
      { name: "isr4400v-universalk9.17.12.04.SPA.bin", size: 712418304, type: "image", date: "2026-01-12" },
      { name: "startup-config", size: 18420, type: "config", date: "2026-05-13" },
      { name: "running-config", size: 21380, type: "config", date: "2026-05-14" },
      { name: "vlan.dat", size: 1024, type: "dat", date: "2026-04-02" },
      { name: "crashinfo_20260301", size: 2421022, type: "crash", date: "2026-03-01" },
    ],
    aaaEvents: seedAaaEvents(),
    routingEvents: seedRoutingEvents(),
    topTalkers: [
      { src: "10.10.0.45", app: "HTTPS", pkts: 18420112, bytes: "14.2 GB", pct: 18 },
      { src: "10.10.0.108", app: "Microsoft.365", pkts: 12224010, bytes: "9.8 GB", pct: 13 },
      { src: "10.20.0.5", app: "HTTPS", pkts: 9824011, bytes: "7.4 GB", pct: 9 },
      { src: "10.10.0.211", app: "YouTube", pkts: 6224108, bytes: "5.6 GB", pct: 7 },
      { src: "10.10.0.55", app: "SSH", pkts: 240120, bytes: "0.4 GB", pct: 2 },
    ],
    diagHistory: [],
    canonicalSwitches: CANONICAL_SWITCHES,
    canonicalSites: CANONICAL_SITES,
    tenant: { name: TENANT_COMPANY, domain: TENANT_DOMAIN },
  };
}
