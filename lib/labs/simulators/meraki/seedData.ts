import type {
  MerakiAdminUser,
  MerakiAirMarshalAp,
  MerakiAlert,
  MerakiAlertType,
  MerakiAuditLogEntry,
  MerakiBluetoothClient,
  MerakiCameraEvent,
  MerakiClient,
  MerakiClientStatus,
  MerakiDevice,
  MerakiFirewallL3Rule,
  MerakiFirewallL7Rule,
  MerakiInventoryItem,
  MerakiNetwork,
  MerakiPortForward,
  MerakiProductType,
  MerakiRadiusServerEntry,
  MerakiSensorReading,
  MerakiSsid,
  MerakiState,
  MerakiSwitchPort,
  MerakiVlan,
  MerakiVpnPeer,
  MerakiWanHealthSample,
  MerakiWanLink,
} from "./types";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Same simple LCG used across every ported simulator in this app (Defender/Sentinel/
// Purview/Azure DevOps/Power Platform) so seed data is stable across reloads within a
// session — no Math.random() anywhere in this file.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Hash a string into a positive integer seed — used to derive a per-entity RNG seed
// from a stable key (e.g. device serial + field name) so results are deterministic
// across reloads but not hand-hardcoded.
function seedFromString(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % 2147483647;
  }
  return h <= 0 ? h + 2147483646 : h;
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return Math.floor(rand() * (hi - lo + 1)) + lo;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// All timestamps below are derived from a single fixed "now" baseline rather than
// Date.now()/new Date() at module scope, so the seed file itself has no wall-clock
// dependency baked into its output shape (values are still relative offsets, matching
// source's minutesAgo()/daysAgo() helpers, just anchored to a fixed instant chosen at
// seed-build time).
const NOW_MS = Date.UTC(2026, 6, 13, 9, 0, 0); // 2026-07-13 09:00:00 UTC

function minutesAgo(m: number): string {
  return new Date(NOW_MS - m * 60000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(NOW_MS - d * 86400000).toISOString();
}

function macAddr(rand: () => number, prefix: string): string {
  const hex = "0123456789abcdef";
  let out = prefix;
  for (let i = 0; i < 3; i++) {
    out += `:${hex.charAt(randInt(rand, 0, 15))}${hex.charAt(randInt(rand, 0, 15))}`;
  }
  return out;
}

// ===================================================================
// CloudLab Inc. roster — same fictional continuity roster used across every prior
// port (Sentinel/Purview/Azure DevOps/Power Platform). Source's Meraki simulator reads
// `CloudLabInfra.TENANT.publicDomain`/`.companyName` and `CloudLabInfra.USERS`/
// `.DEVICES` via a shared cloudlab-infra.js this Next.js app does not have; we
// replicate the EFFECT by hardcoding an equivalent roster inline here.
// ===================================================================

const TENANT_DOMAIN = "cloudlab.io";
const TENANT_COMPANY = "CloudLab Inc.";

const ROSTER = [
  "ankit",
  "rohit",
  "vivek",
  "priya",
  "naveen",
  "jaya",
  "sneha",
  "vikram",
  "rahul",
  "arjun",
  "kiran",
  "amit",
  "pooja",
  "kavita",
  "manish",
  "meera",
  "sunita",
  "aarti",
  "sandeep",
  "karthik",
  "preeti",
  "ravi",
] as const;

const ROSTER_DISPLAY: Record<(typeof ROSTER)[number], string> = {
  ankit: "Ankit Sharma",
  rohit: "Rohit Kapoor",
  vivek: "Vivek Nair",
  priya: "Priya Patel",
  naveen: "Naveen Reddy",
  jaya: "Jaya Krishnan",
  sneha: "Sneha Iyer",
  vikram: "Vikram Singh",
  rahul: "Rahul Verma",
  arjun: "Arjun Mehta",
  kiran: "Kiran Desai",
  amit: "Amit Joshi",
  pooja: "Pooja Gupta",
  kavita: "Kavita Rao",
  manish: "Manish Tiwari",
  meera: "Meera Shah",
  sunita: "Sunita Menon",
  aarti: "Aarti Bhatia",
  sandeep: "Sandeep Kumar",
  karthik: "Karthik Iyer",
  preeti: "Preeti Nambiar",
  ravi: "Ravi Chandran",
};

// Non-canonical device names — ported from source's `nonCanonical` array (meraki-data.js
// line 250), spirit preserved (~40 printers/IoT/AV/POS/guest devices).
const NON_CANONICAL_DEVICES = [
  "HP-LaserJet-3rd-Floor",
  "HP-LaserJet-1st-Floor",
  "Canon-Scanner-Sales",
  "Brother-Print-FL2",
  "AppleTV-Boardroom",
  "AppleTV-Cafe",
  "Sonos-Cafe",
  "Sonos-Boardroom",
  "Roku-Lobby",
  "Nest-Thermostat-FL2",
  "Echo-Show-Conf",
  "SmartTV-Lobby",
  "SmartTV-Cafe",
  "Polycom-Conf-Room",
  "iPad-Lobby-Kiosk",
  "iPad-Reception",
  "PoS-Retail-01",
  "PoS-Retail-02",
  "Visitor-Lenovo-01",
  "Visitor-MBA-02",
  "Guest-iPhone-03",
  "Guest-Android-04",
  "Guest-iPad-05",
  "IP-Cam-Lobby",
  "IP-Cam-Lift",
  "IP-Cam-Parking",
  "Zebra-Print-Warehouse",
  "Honeywell-Reader-WH",
  "BarcodeScanner-1",
  "BarcodeScanner-2",
  "iPad-Conf-Room-Mum",
  "iPad-Conf-Room-Blr",
  "EcoBee-FL2",
  "AppleTV-Cafe-2",
  "Sonos-Floor-2",
  "BrotherPrint-HR",
  "Canon-Print-Finance",
  "AndroidTab-Field-1",
  "AndroidTab-Field-2",
  "Cradlepoint-IoT-1",
] as const;

// ===================================================================
// Networks
// ===================================================================

function seedNetworks(): MerakiNetwork[] {
  return [
    {
      id: "net-hq",
      name: "HQ-Main",
      tag: "combined",
      productTypes: ["appliance", "switch", "wireless", "camera", "sensor"],
      tz: "America/New_York",
      region: "NA-East",
      clientsOnline: 62,
      clientsTotal: 72,
      devicesOnline: 14,
      devicesTotal: 15,
      wanUsage: { down: 432, up: 88 },
      status: "online",
    },
    {
      id: "net-branch",
      name: "Branch-Office",
      tag: "combined",
      productTypes: ["appliance", "switch", "wireless"],
      tz: "America/Chicago",
      region: "NA-Central",
      clientsOnline: 11,
      clientsTotal: 15,
      devicesOnline: 4,
      devicesTotal: 4,
      wanUsage: { down: 78, up: 11 },
      status: "online",
    },
    {
      id: "net-retail",
      name: "Retail-Store",
      tag: "retail",
      productTypes: ["appliance", "switch", "wireless", "camera"],
      tz: "America/Los_Angeles",
      region: "NA-West",
      clientsOnline: 7,
      clientsTotal: 9,
      devicesOnline: 3,
      devicesTotal: 4,
      wanUsage: { down: 22, up: 4 },
      status: "degraded",
    },
  ];
}

// ===================================================================
// Switch ports — REAL persisted state (fixes source's ensurePorts()/portsCache bug of
// never persisting port edits). Ported from meraki-switch.js `ensurePorts()`.
// ===================================================================

function buildSwitchPorts(serial: string, portsTotal: number, portsActive: number, poeBudget: number): MerakiSwitchPort[] {
  const rand = rng(seedFromString(`${serial}:ports`));
  const ports: MerakiSwitchPort[] = [];
  for (let p = 1; p <= portsTotal; p++) {
    const isTrunk = p === 1 || p === 2 || p === portsTotal;
    const isActive = p <= portsActive;
    const isUp = isActive;
    const poeMax = poeBudget > 0 ? 30 : 0;
    const poeNow = poeMax > 0 && isUp ? randInt(rand, 0, 30) : 0;
    ports.push({
      portId: `${p}`,
      name: isTrunk ? `Uplink-${p}` : `Access port ${p}`,
      enabled: true,
      vlan: isTrunk ? 1 : p % 5 === 0 ? 20 : p % 7 === 0 ? 40 : 10,
      nativeVlan: isTrunk ? 1 : 1,
      allowedVlans: isTrunk ? "all" : "",
      poe: { enabled: poeMax > 0, used: poeNow, max: poeMax, lldpMed: isUp ? "true" : null },
      stpGuard: "BPDU guard",
      stormControl: true,
      accessPolicy: isTrunk ? "None" : p % 3 === 0 ? "802.1X (Open auth)" : "None",
      taggedCount: randInt(rand, 1000, 90000),
      untaggedCount: randInt(rand, 50000, 900000),
      rxBytes: randInt(rand, 1, 800) * 1024 * 1024,
      txBytes: randInt(rand, 1, 500) * 1024 * 1024,
      errors: randInt(rand, 0, 30),
      linkStatus: isUp ? "connected" : "disconnected",
    });
  }
  return ports;
}

// ===================================================================
// Devices
// ===================================================================

function seedDevices(): MerakiDevice[] {
  const devices: MerakiDevice[] = [];

  // ---------- HQ-Main ----------
  devices.push({
    serial: "Q2KD-MX67-AAAA",
    name: "HQ-MX67-FW",
    model: "MX67",
    type: "appliance",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.0.1",
    mac: macAddr(rng(seedFromString("Q2KD-MX67-AAAA:mac")), "e0:cb:bc"),
    uptimeDays: 142,
    firmware: "MX 18.107.2",
    firmwareLatest: "MX 18.107.4",
    tags: ["hq", "sd-wan"],
    lastReboot: daysAgo(142),
    publicIp: "198.51.100.42",
    wan1: { isp: "AT&T Fiber", plan: "1 Gbps", publicIp: "198.51.100.42", status: "active", loss: 0.1, latency: 9, jitter: 1.2, usage: 432 },
    wan2: { isp: "Comcast Cable", plan: "100 Mbps", publicIp: "203.0.113.18", status: "ready", loss: 0.4, latency: 18, jitter: 3.1, usage: 12 },
    cpuPct: 14,
    memPct: 38,
    sessions: 4218,
  });
  devices.push({
    serial: "Q2HP-MS220-A001",
    name: "HQ-MS220-ACCESS1",
    model: "MS220-24P",
    type: "switch",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.0.2",
    mac: "88:15:44:aa:11:01",
    uptimeDays: 211,
    firmware: "MS 15.21",
    firmwareLatest: "MS 15.22",
    tags: ["stack-master"],
    lastReboot: daysAgo(211),
    poeBudget: 370,
    poeUsed: 184,
    portsTotal: 24,
    portsActive: 21,
    isL3: false,
    ports: buildSwitchPorts("Q2HP-MS220-A001", 24, 21, 370),
  });
  devices.push({
    serial: "Q2HP-MS220-A002",
    name: "HQ-MS220-ACCESS2",
    model: "MS220-24P",
    type: "switch",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.0.3",
    mac: "88:15:44:aa:11:02",
    uptimeDays: 211,
    firmware: "MS 15.21",
    firmwareLatest: "MS 15.22",
    tags: ["stack-member"],
    lastReboot: daysAgo(211),
    poeBudget: 370,
    poeUsed: 156,
    portsTotal: 24,
    portsActive: 19,
    isL3: false,
    ports: buildSwitchPorts("Q2HP-MS220-A002", 24, 19, 370),
  });
  devices.push({
    serial: "Q2HP-MS425-D001",
    name: "HQ-MS425-DIST",
    model: "MS425-32",
    type: "switch",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.0.4",
    mac: "88:15:44:bb:22:01",
    uptimeDays: 308,
    firmware: "MS 15.21",
    firmwareLatest: "MS 15.22",
    tags: ["distribution", "l3"],
    lastReboot: daysAgo(308),
    poeBudget: 0,
    poeUsed: 0,
    portsTotal: 32,
    portsActive: 12,
    isL3: true,
    ports: buildSwitchPorts("Q2HP-MS425-D001", 32, 12, 0),
  });
  devices.push({
    serial: "Q2MR-MR46-A101",
    name: "HQ-AP-Lobby",
    model: "MR46",
    type: "wireless",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.10.11",
    mac: "e0:cb:bc:aa:01:01",
    uptimeDays: 67,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["indoor", "lobby"],
    lastReboot: daysAgo(67),
    clientsCount: 14,
    channel24: 6,
    channel5: 36,
    channelUtil24: 22,
    channelUtil5: 8,
    txPower24: 14,
    txPower5: 17,
  });
  devices.push({
    serial: "Q2MR-MR46-A102",
    name: "HQ-AP-Engineering",
    model: "MR46",
    type: "wireless",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.10.12",
    mac: "e0:cb:bc:aa:01:02",
    uptimeDays: 67,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["indoor", "eng"],
    lastReboot: daysAgo(67),
    clientsCount: 22,
    channel24: 1,
    channel5: 44,
    channelUtil24: 38,
    channelUtil5: 19,
    txPower24: 11,
    txPower5: 14,
  });
  devices.push({
    serial: "Q2MR-MR46-A103",
    name: "HQ-AP-Sales",
    model: "MR46",
    type: "wireless",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.10.13",
    mac: "e0:cb:bc:aa:01:03",
    uptimeDays: 67,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["indoor", "sales"],
    lastReboot: daysAgo(67),
    clientsCount: 9,
    channel24: 11,
    channel5: 149,
    channelUtil24: 17,
    channelUtil5: 6,
    txPower24: 14,
    txPower5: 17,
  });
  devices.push({
    serial: "Q2MR-MR46-A104",
    name: "HQ-AP-Conference",
    model: "MR46",
    type: "wireless",
    networkId: "net-hq",
    status: "alerting",
    lanIp: "10.0.10.14",
    mac: "e0:cb:bc:aa:01:04",
    uptimeDays: 4,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["indoor", "conf"],
    lastReboot: daysAgo(4),
    clientsCount: 5,
    channel24: 6,
    channel5: 100,
    channelUtil24: 48,
    channelUtil5: 31,
    txPower24: 8,
    txPower5: 11,
  });
  devices.push({
    serial: "Q2MR-MR46-A105",
    name: "HQ-AP-Warehouse",
    model: "MR46",
    type: "wireless",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.10.15",
    mac: "e0:cb:bc:aa:01:05",
    uptimeDays: 91,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["indoor", "warehouse"],
    lastReboot: daysAgo(91),
    clientsCount: 6,
    channel24: 11,
    channel5: 165,
    channelUtil24: 12,
    channelUtil5: 5,
    txPower24: 14,
    txPower5: 17,
  });
  devices.push({
    serial: "Q2MR-MR74-O001",
    name: "HQ-AP-Outdoor",
    model: "MR74",
    type: "wireless",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.10.16",
    mac: "e0:cb:bc:aa:02:01",
    uptimeDays: 188,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["outdoor", "patio"],
    lastReboot: daysAgo(188),
    clientsCount: 3,
    channel24: 1,
    channel5: 161,
    channelUtil24: 8,
    channelUtil5: 3,
    txPower24: 19,
    txPower5: 22,
    outdoor: true,
  });
  devices.push({
    serial: "Q2MV-MV12-C001",
    name: "HQ-CAM-Entrance",
    model: "MV12",
    type: "camera",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.20.11",
    mac: "e0:cb:bc:cc:01:01",
    uptimeDays: 122,
    firmware: "MV 4.11",
    firmwareLatest: "MV 4.13",
    tags: ["indoor"],
    lastReboot: daysAgo(122),
    resolution: "1080p",
    retention: "30 days",
    motion: true,
    rtsp: true,
  });
  devices.push({
    serial: "Q2MV-MV12-C002",
    name: "HQ-CAM-Reception",
    model: "MV12",
    type: "camera",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.20.12",
    mac: "e0:cb:bc:cc:01:02",
    uptimeDays: 122,
    firmware: "MV 4.11",
    firmwareLatest: "MV 4.13",
    tags: ["indoor"],
    lastReboot: daysAgo(122),
    resolution: "1080p",
    retention: "30 days",
    motion: true,
    rtsp: true,
  });
  devices.push({
    serial: "Q2MV-MV12-C003",
    name: "HQ-CAM-Server-Room",
    model: "MV12",
    type: "camera",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.20.13",
    mac: "e0:cb:bc:cc:01:03",
    uptimeDays: 122,
    firmware: "MV 4.11",
    firmwareLatest: "MV 4.13",
    tags: ["indoor", "secure"],
    lastReboot: daysAgo(122),
    resolution: "1080p",
    retention: "90 days",
    motion: true,
    rtsp: true,
  });
  devices.push({
    serial: "Q2MV-MV12-C004",
    name: "HQ-CAM-Warehouse",
    model: "MV12",
    type: "camera",
    networkId: "net-hq",
    status: "online",
    lanIp: "10.0.20.14",
    mac: "e0:cb:bc:cc:01:04",
    uptimeDays: 84,
    firmware: "MV 4.11",
    firmwareLatest: "MV 4.13",
    tags: ["indoor"],
    lastReboot: daysAgo(84),
    resolution: "1080p",
    retention: "30 days",
    motion: true,
    rtsp: true,
  });
  devices.push({
    serial: "Q2MT-MT10-S001",
    name: "HQ-TEMP-ServerRoom",
    model: "MT10",
    type: "sensor",
    networkId: "net-hq",
    status: "online",
    lanIp: "",
    mac: "e0:cb:bc:dd:01:01",
    uptimeDays: 60,
    firmware: "MT 1.6",
    firmwareLatest: "MT 1.7",
    tags: ["server-room"],
    lastReboot: daysAgo(60),
    temp: 21.5,
    humidity: 43,
    battery: 92,
    alertThresholds: { tempMax: 27, tempMin: 14 },
  });
  devices.push({
    serial: "Q2MT-MT10-S002",
    name: "HQ-TEMP-DataCenter",
    model: "MT10",
    type: "sensor",
    networkId: "net-hq",
    status: "online",
    lanIp: "",
    mac: "e0:cb:bc:dd:01:02",
    uptimeDays: 60,
    firmware: "MT 1.6",
    firmwareLatest: "MT 1.7",
    tags: ["data-center"],
    lastReboot: daysAgo(60),
    temp: 19.8,
    humidity: 39,
    battery: 88,
    alertThresholds: { tempMax: 24, tempMin: 14 },
  });

  // ---------- Branch-Office ----------
  devices.push({
    serial: "Q2KD-MX67-BBBB",
    name: "BR-MX67-FW",
    model: "MX67",
    type: "appliance",
    networkId: "net-branch",
    status: "online",
    lanIp: "10.10.0.1",
    mac: macAddr(rng(seedFromString("Q2KD-MX67-BBBB:mac")), "e0:cb:bc"),
    uptimeDays: 88,
    firmware: "MX 18.107.2",
    firmwareLatest: "MX 18.107.4",
    tags: ["branch"],
    lastReboot: daysAgo(88),
    publicIp: "198.51.100.55",
    wan1: { isp: "Spectrum Business", plan: "300 Mbps", publicIp: "198.51.100.55", status: "active", loss: 0.2, latency: 14, jitter: 2.0, usage: 78 },
    wan2: { isp: "5G LTE Backup", plan: "50 Mbps", publicIp: "198.51.100.56", status: "ready", loss: 0.8, latency: 38, jitter: 5.4, usage: 0 },
    cpuPct: 9,
    memPct: 32,
    sessions: 612,
  });
  devices.push({
    serial: "Q2HP-MS220-B001",
    name: "BR-MS220-ACCESS",
    model: "MS220-24P",
    type: "switch",
    networkId: "net-branch",
    status: "online",
    lanIp: "10.10.0.2",
    mac: "88:15:44:bb:33:01",
    uptimeDays: 88,
    firmware: "MS 15.21",
    firmwareLatest: "MS 15.22",
    tags: ["branch"],
    lastReboot: daysAgo(88),
    poeBudget: 370,
    poeUsed: 88,
    portsTotal: 24,
    portsActive: 11,
    isL3: false,
    ports: buildSwitchPorts("Q2HP-MS220-B001", 24, 11, 370),
  });
  devices.push({
    serial: "Q2MR-MR46-B001",
    name: "BR-AP-Main",
    model: "MR46",
    type: "wireless",
    networkId: "net-branch",
    status: "online",
    lanIp: "10.10.10.11",
    mac: "e0:cb:bc:bb:01:01",
    uptimeDays: 88,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["branch"],
    lastReboot: daysAgo(88),
    clientsCount: 8,
    channel24: 6,
    channel5: 36,
    channelUtil24: 14,
    channelUtil5: 6,
    txPower24: 14,
    txPower5: 17,
  });
  devices.push({
    serial: "Q2MR-MR46-B002",
    name: "BR-AP-Conf",
    model: "MR46",
    type: "wireless",
    networkId: "net-branch",
    status: "online",
    lanIp: "10.10.10.12",
    mac: "e0:cb:bc:bb:01:02",
    uptimeDays: 88,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["branch"],
    lastReboot: daysAgo(88),
    clientsCount: 3,
    channel24: 11,
    channel5: 149,
    channelUtil24: 9,
    channelUtil5: 4,
    txPower24: 14,
    txPower5: 17,
  });

  // ---------- Retail-Store ----------
  devices.push({
    serial: "Q2KD-MX67-CCCC",
    name: "RT-MX67-FW",
    model: "MX67",
    type: "appliance",
    networkId: "net-retail",
    status: "online",
    lanIp: "10.20.0.1",
    mac: macAddr(rng(seedFromString("Q2KD-MX67-CCCC:mac")), "e0:cb:bc"),
    uptimeDays: 41,
    firmware: "MX 18.107.2",
    firmwareLatest: "MX 18.107.4",
    tags: ["retail"],
    lastReboot: daysAgo(41),
    publicIp: "198.51.100.71",
    wan1: { isp: "Spectrum", plan: "200 Mbps", publicIp: "198.51.100.71", status: "active", loss: 0.3, latency: 18, jitter: 2.4, usage: 22 },
    wan2: { isp: "5G LTE Backup", plan: "50 Mbps", publicIp: "198.51.100.72", status: "failed", loss: 100, latency: 0, jitter: 0, usage: 0 },
    cpuPct: 6,
    memPct: 28,
    sessions: 144,
  });
  devices.push({
    serial: "Q2HP-MS220-R001",
    name: "RT-MS220",
    model: "MS220-24P",
    type: "switch",
    networkId: "net-retail",
    status: "online",
    lanIp: "10.20.0.2",
    mac: "88:15:44:cc:44:01",
    uptimeDays: 41,
    firmware: "MS 15.21",
    firmwareLatest: "MS 15.22",
    tags: ["retail"],
    lastReboot: daysAgo(41),
    poeBudget: 370,
    poeUsed: 42,
    portsTotal: 24,
    portsActive: 6,
    isL3: false,
    ports: buildSwitchPorts("Q2HP-MS220-R001", 24, 6, 370),
  });
  devices.push({
    serial: "Q2MR-MR46-R001",
    name: "RT-AP-Floor",
    model: "MR46",
    type: "wireless",
    networkId: "net-retail",
    status: "online",
    lanIp: "10.20.10.11",
    mac: "e0:cb:bc:cc:01:01",
    uptimeDays: 41,
    firmware: "MR 30.5",
    firmwareLatest: "MR 30.7",
    tags: ["retail"],
    lastReboot: daysAgo(41),
    clientsCount: 5,
    channel24: 1,
    channel5: 36,
    channelUtil24: 7,
    channelUtil5: 3,
    txPower24: 14,
    txPower5: 17,
  });
  devices.push({
    serial: "Q2MV-MV12-R001",
    name: "RT-CAM-POS",
    model: "MV12",
    type: "camera",
    networkId: "net-retail",
    status: "offline",
    lanIp: "10.20.20.11",
    mac: "e0:cb:bc:dd:01:01",
    uptimeDays: 0,
    firmware: "MV 4.11",
    firmwareLatest: "MV 4.13",
    tags: ["retail"],
    lastReboot: daysAgo(9),
    resolution: "1080p",
    retention: "30 days",
    motion: false,
    rtsp: true,
  });

  return devices;
}

// ===================================================================
// Clients (80 across networks) — ported from meraki-data.js buildSeed() client loop.
// ===================================================================

function seedClients(networks: MerakiNetwork[], devices: MerakiDevice[]): MerakiClient[] {
  const canonicalNames = ROSTER.map((r) => `${ROSTER_DISPLAY[r].split(" ")[0]}-${r}-PC`);
  const clientNames = [...canonicalNames, ...NON_CANONICAL_DEVICES];
  const oses = ["macOS 14.4", "Windows 11 23H2", "iOS 17.4", "Android 14", "ChromeOS 122", "Windows 10 22H2", "iPadOS 17.4", "Linux 6.5", "Embedded"];
  const manufacturers = ["Apple", "Dell", "HP", "Lenovo", "Microsoft", "Samsung", "Google", "Sonos", "Roku", "Polycom", "Canon", "Brother", "Zebra"];
  const policies = ["Default", "Corporate", "Guest-Limited", "IoT-Restricted", "Block-Internet", "Quarantine"];
  const ssidList = ["Corporate", "Guest", "IoT", "Hidden-Test"];

  const clients: MerakiClient[] = [];
  for (let i = 0; i < 80; i++) {
    const net = networks[i < 65 ? 0 : i < 75 ? 1 : 2];
    const isWireless = i % 7 !== 0;
    const apList = devices.filter((d) => d.networkId === net.id && d.type === "wireless");
    const swList = devices.filter((d) => d.networkId === net.id && d.type === "switch");
    const connectedTo = isWireless
      ? apList.length
        ? apList[i % apList.length].serial
        : null
      : swList.length
        ? `${swList[i % swList.length].serial}:${1 + (i % 24)}`
        : null;
    const ssid = isWireless ? ssidList[i % ssidList.length] : null;
    const vlan = ssid === "Guest" ? 30 : ssid === "IoT" ? 40 : i % 5 === 0 ? 20 : 10;
    const ipBase = net.id === "net-hq" ? "10.0." : net.id === "net-branch" ? "10.10." : "10.20.";
    const octet = vlan === 30 ? "30." : vlan === 40 ? "40." : vlan === 20 ? "20." : "10.";
    const rand = rng(seedFromString(`cli-${1000 + i}`));
    const status: MerakiClientStatus = i % 11 === 0 ? "offline" : "online";

    const bandwidthSeries: number[] = [];
    for (let k = 0; k < 24; k++) bandwidthSeries.push(randInt(rand, 1, 60));

    clients.push({
      id: `cli-${1000 + i}`,
      description: clientNames[i % clientNames.length] + (i > 50 ? `-${i}` : ""),
      mac: macAddr(rand, i % 2 ? "f8:8f:ca" : "3c:22:fb"),
      ip: `${ipBase}${octet}${10 + i}`,
      vlan,
      connectivity: isWireless ? "Wireless" : "Wired",
      ssid,
      status,
      networkId: net.id,
      connectedTo,
      manufacturer: manufacturers[i % manufacturers.length],
      os: oses[i % oses.length],
      policy: policies[i % policies.length],
      usage24h: { recv: randInt(rand, 2, 980), sent: randInt(rand, 1, 320) },
      lastSeen: minutesAgo(randInt(rand, 0, 480)),
      firstSeen: daysAgo(randInt(rand, 1, 90)),
      signal: isWireless ? -1 * randInt(rand, 38, 78) : null,
      bandwidthSeries,
      roamState: "stable",
      roamTicksRemaining: 0,
    });
  }
  return clients;
}

// ===================================================================
// SSIDs (15 slots per network — 4 configured + 11 unconfigured)
// ===================================================================

function seedSsidsForNetwork(networkId: string): MerakiSsid[] {
  const ssids: MerakiSsid[] = [
    {
      id: `${networkId}-ssid-0`,
      slot: 0,
      name: "Corporate",
      enabled: true,
      networkId,
      authMode: "8021x-radius",
      encryption: "WPA2",
      psk: null,
      radius: { servers: [{ host: "10.0.0.50", port: 1812, secret: "CloudLabRad!" }], accounting: true, attempts: 2 },
      splash: { type: "None", text: "" },
      ipAssignment: "Bridge to LAN",
      vlan: 10,
      bandwidthDown: 0,
      bandwidthUp: 0,
      hidden: false,
      mac80211w: "Required",
      minBitrate: 12,
      mdns: true,
      perClientLimit: 0,
      l3Rules: [{ id: `${networkId}-ssid0-l3-1`, policy: "allow", protocol: "any", srcCidr: "Any", srcPort: "Any", destCidr: "Any", destPort: "Any", comment: "Allow corp users", enabled: true }],
      l7Rules: [{ id: `${networkId}-ssid0-l7-1`, type: "application", value: "BitTorrent", policy: "deny", comment: "Block torrents" }],
      hotspot20: { enabled: false, operatorName: "" },
      concentrator: null,
      clientsCount: 36,
      splashBlockedCountries: [],
    },
    {
      id: `${networkId}-ssid-1`,
      slot: 1,
      name: "Guest",
      enabled: true,
      networkId,
      authMode: "open",
      encryption: "None",
      psk: null,
      radius: { servers: [], accounting: false, attempts: 0 },
      splash: { type: "Click-through", text: `Welcome to ${TENANT_COMPANY} Wi-Fi` },
      ipAssignment: "NAT mode",
      vlan: 30,
      bandwidthDown: 10000,
      bandwidthUp: 5000,
      hidden: false,
      mac80211w: "Disabled",
      minBitrate: 6,
      mdns: false,
      perClientLimit: 5000,
      l3Rules: [
        { id: `${networkId}-ssid1-l3-1`, policy: "deny", protocol: "any", srcCidr: "Any", srcPort: "Any", destCidr: "Local LAN", destPort: "Any", comment: "Isolate from internal", enabled: true },
        { id: `${networkId}-ssid1-l3-2`, policy: "allow", protocol: "any", srcCidr: "Any", srcPort: "Any", destCidr: "Any", destPort: "Any", comment: "Allow internet", enabled: true },
      ],
      l7Rules: [
        { id: `${networkId}-ssid1-l7-1`, type: "application-category", value: "Adult content", policy: "deny", comment: "Content policy" },
        { id: `${networkId}-ssid1-l7-2`, type: "application", value: "BitTorrent", policy: "deny", comment: "Block torrents" },
      ],
      hotspot20: { enabled: false, operatorName: "" },
      concentrator: null,
      clientsCount: 12,
      splashBlockedCountries: ["RU", "CN", "KP", "IR"],
    },
    {
      id: `${networkId}-ssid-2`,
      slot: 2,
      name: "IoT",
      enabled: true,
      networkId,
      authMode: "psk",
      encryption: "WPA2",
      psk: "IoTLabSecret2026!",
      radius: { servers: [], accounting: false, attempts: 0 },
      splash: { type: "None", text: "" },
      ipAssignment: "Bridge to LAN",
      vlan: 40,
      bandwidthDown: 5000,
      bandwidthUp: 2000,
      hidden: false,
      mac80211w: "Disabled",
      minBitrate: 1,
      mdns: true,
      perClientLimit: 2000,
      l3Rules: [
        { id: `${networkId}-ssid2-l3-1`, policy: "deny", protocol: "any", srcCidr: "Any", srcPort: "Any", destCidr: "Local LAN", destPort: "Any", comment: "No lateral movement", enabled: true },
        { id: `${networkId}-ssid2-l3-2`, policy: "allow", protocol: "tcp", srcCidr: "Any", srcPort: "Any", destCidr: "cloud.iot", destPort: "Any", comment: "Allow vendor cloud", enabled: true },
      ],
      l7Rules: [],
      hotspot20: { enabled: false, operatorName: "" },
      concentrator: null,
      clientsCount: 18,
      splashBlockedCountries: [],
    },
    {
      id: `${networkId}-ssid-3`,
      slot: 3,
      name: "Hidden-Test",
      enabled: true,
      networkId,
      authMode: "psk",
      encryption: "WPA2",
      psk: "TestNet!2026",
      radius: { servers: [], accounting: false, attempts: 0 },
      splash: { type: "None", text: "" },
      ipAssignment: "Bridge to LAN",
      vlan: 99,
      bandwidthDown: 0,
      bandwidthUp: 0,
      hidden: true,
      mac80211w: "Optional",
      minBitrate: 6,
      mdns: false,
      perClientLimit: 0,
      l3Rules: [],
      l7Rules: [],
      hotspot20: { enabled: false, operatorName: "" },
      concentrator: null,
      clientsCount: 0,
      splashBlockedCountries: [],
    },
  ];
  for (let s = 4; s < 15; s++) {
    ssids.push({
      id: `${networkId}-ssid-${s}`,
      slot: s,
      name: `Unconfigured SSID ${s + 1}`,
      enabled: false,
      networkId,
      authMode: "open",
      encryption: "None",
      psk: null,
      radius: { servers: [], accounting: false, attempts: 0 },
      splash: { type: "None", text: "" },
      ipAssignment: "NAT mode",
      vlan: 10,
      bandwidthDown: 0,
      bandwidthUp: 0,
      hidden: false,
      mac80211w: "Disabled",
      minBitrate: 6,
      mdns: false,
      perClientLimit: 0,
      l3Rules: [],
      l7Rules: [],
      hotspot20: { enabled: false, operatorName: "" },
      concentrator: null,
      clientsCount: 0,
      splashBlockedCountries: [],
    });
  }
  return ssids;
}

function seedSsids(networks: MerakiNetwork[]): MerakiSsid[] {
  return networks.flatMap((n) => seedSsidsForNetwork(n.id));
}

// ===================================================================
// VLANs — NEW canonical array reconciling source's two divergent tables:
//   meraki-security.js renderVlans(): 10,20,30,40,50,99 (6 rows, includes "Test" 99)
//   meraki-switch.js renderRouting(): 10,20,30,40,50 (5 rows, includes "DMZ" 50, no 99)
// Both tables agree on VLANs 10/20/30/40/50's name+subnet+mxIp. VLAN 99 "Test" only
// appears in the security table; VLAN 50 "DMZ" appears in both (security table's
// groupPolicy 'Default' vs switch table implying static/DHCP-off — we keep DMZ's
// dhcp:"off" from the switch table since that's the more specific of the two). The
// reconciled canonical set below merges all 6 distinct VLANs, scoped per network via
// networkId (Branch/Retail get a smaller subset matching their simpler topologies).
// ===================================================================

function seedVlans(): MerakiVlan[] {
  const hqVlans: MerakiVlan[] = [
    { id: 10, networkId: "net-hq", name: "Corporate", subnet: "10.0.10.0/24", mxIp: "10.0.10.1", groupPolicy: "Corporate", dhcpMode: "Run on MX (10.0.10.20-200)" },
    { id: 20, networkId: "net-hq", name: "Servers", subnet: "10.0.20.0/24", mxIp: "10.0.20.1", groupPolicy: null, dhcpMode: "Relay -> 10.0.0.50" },
    { id: 30, networkId: "net-hq", name: "Guest", subnet: "10.0.30.0/24", mxIp: "10.0.30.1", groupPolicy: "Guest-Limited", dhcpMode: "Run on MX (10.0.30.20-200)" },
    { id: 40, networkId: "net-hq", name: "IoT", subnet: "10.0.40.0/24", mxIp: "10.0.40.1", groupPolicy: "IoT-Restricted", dhcpMode: "Run on MX (10.0.40.20-100)" },
    { id: 50, networkId: "net-hq", name: "DMZ", subnet: "10.0.50.0/24", mxIp: "10.0.50.1", groupPolicy: null, dhcpMode: "off (static)" },
    { id: 99, networkId: "net-hq", name: "Test", subnet: "10.0.99.0/24", mxIp: "10.0.99.1", groupPolicy: "Block-Internet", dhcpMode: "Run on MX" },
  ];
  const branchVlans: MerakiVlan[] = [
    { id: 10, networkId: "net-branch", name: "Corporate", subnet: "10.10.10.0/24", mxIp: "10.10.10.1", groupPolicy: "Corporate", dhcpMode: "Run on MX (10.10.10.20-200)" },
    { id: 30, networkId: "net-branch", name: "Guest", subnet: "10.10.30.0/24", mxIp: "10.10.30.1", groupPolicy: "Guest-Limited", dhcpMode: "Run on MX (10.10.30.20-200)" },
  ];
  const retailVlans: MerakiVlan[] = [
    { id: 10, networkId: "net-retail", name: "Corporate", subnet: "10.20.10.0/24", mxIp: "10.20.10.1", groupPolicy: "Corporate", dhcpMode: "Run on MX (10.20.10.20-200)" },
    { id: 20, networkId: "net-retail", name: "Servers", subnet: "10.20.20.0/24", mxIp: "10.20.20.1", groupPolicy: null, dhcpMode: "Relay -> 10.0.0.50" },
  ];
  return [...hqVlans, ...branchVlans, ...retailVlans];
}

// ===================================================================
// Firewall L3/L7 (HQ) — ported from meraki-security.js state.firewallL3/L7
// ===================================================================

function seedFirewallL3(): MerakiFirewallL3Rule[] {
  return [
    { id: "fw3-1", policy: "allow", protocol: "any", srcCidr: "Local LAN", srcPort: "Any", destCidr: "Any", destPort: "Any", comment: "Default outbound allow", enabled: true },
    { id: "fw3-2", policy: "deny", protocol: "tcp", srcCidr: "10.0.30.0/24", srcPort: "Any", destCidr: "10.0.0.0/16", destPort: "Any", comment: "Block guest -> internal", enabled: true },
    { id: "fw3-3", policy: "deny", protocol: "tcp", srcCidr: "10.0.40.0/24", srcPort: "Any", destCidr: "10.0.0.0/24", destPort: "22,3389", comment: "Block IoT -> SSH/RDP", enabled: true },
    { id: "fw3-4", policy: "allow", protocol: "tcp", srcCidr: "10.0.20.0/24", srcPort: "Any", destCidr: "Any", destPort: "443", comment: "Allow sales -> HTTPS", enabled: true },
    { id: "fw3-5", policy: "deny", protocol: "udp", srcCidr: "Any", srcPort: "Any", destCidr: "Any", destPort: "53", comment: "Block external DNS (force internal)", enabled: true },
    { id: "fw3-6", policy: "allow", protocol: "udp", srcCidr: "10.0.0.0/16", srcPort: "Any", destCidr: "10.0.0.10", destPort: "53", comment: "Allow internal DNS", enabled: true },
    { id: "fw3-7", policy: "deny", protocol: "tcp", srcCidr: "Any", srcPort: "Any", destCidr: "Any", destPort: "23,21", comment: "Block Telnet/FTP", enabled: true },
    { id: "fw3-8", policy: "deny", protocol: "tcp", srcCidr: "10.0.30.0/24", srcPort: "Any", destCidr: "Any", destPort: "25", comment: "Block guest SMTP", enabled: true },
    { id: "fw3-9", policy: "allow", protocol: "icmp", srcCidr: "10.0.0.0/16", srcPort: "Any", destCidr: "Any", destPort: "Any", comment: "Allow ping outbound", enabled: true },
    { id: "fw3-10", policy: "deny", protocol: "tcp", srcCidr: "Any", srcPort: "Any", destCidr: "10.0.20.13", destPort: "Any", comment: "Lock down server-room cam", enabled: true },
    { id: "fw3-11", policy: "allow", protocol: "tcp", srcCidr: "10.0.10.0/24", srcPort: "Any", destCidr: "Any", destPort: "443,80", comment: "Allow corp web", enabled: true },
    { id: "fw3-12", policy: "deny", protocol: "any", srcCidr: "Any", srcPort: "Any", destCidr: "Any", destPort: "Any", comment: "Default deny", enabled: true },
  ];
}

function seedFirewallL7(): MerakiFirewallL7Rule[] {
  return [
    { id: "fw7-1", type: "application", value: "BitTorrent", policy: "deny", comment: "Block torrents" },
    { id: "fw7-2", type: "application-category", value: "Adult content", policy: "deny", comment: "Content policy" },
    { id: "fw7-3", type: "application-category", value: "Peer-to-peer", policy: "deny", comment: "Block P2P" },
    { id: "fw7-4", type: "application", value: "TOR", policy: "deny", comment: "Block Tor" },
    { id: "fw7-5", type: "application", value: "TikTok", policy: "deny", comment: "Distracting media" },
    { id: "fw7-6", type: "application-category", value: "Online gaming", policy: "deny", comment: "Block gaming during work hrs" },
  ];
}

// ===================================================================
// NAT / VPN
// ===================================================================

function seedPortForwards(): MerakiPortForward[] {
  return [
    { id: "pf-1", name: "Web Server", protocol: "tcp", publicPort: "443", lanIp: "10.0.50.10", localPort: "443", allowedRemote: "Any", enabled: true },
    { id: "pf-2", name: "Mail Server", protocol: "tcp", publicPort: "25", lanIp: "10.0.50.11", localPort: "25", allowedRemote: "Any", enabled: true },
    { id: "pf-3", name: "RDP Jumpbox", protocol: "tcp", publicPort: "3389", lanIp: "10.0.50.12", localPort: "3389", allowedRemote: "198.51.100.0/24", enabled: true },
  ];
}

function seedVpnPeers(): MerakiVpnPeer[] {
  return [
    { id: "vpn-branch", name: "BR-MX67-FW (Branch-Office)", networkId: "net-branch", publicIp: "198.51.100.55", status: "active", privateSubnets: ["10.10.0.0/16"] },
    { id: "vpn-retail", name: "RT-MX67-FW (Retail-Store)", networkId: "net-retail", publicIp: "198.51.100.71", status: "active", privateSubnets: ["10.20.0.0/16"] },
  ];
}

// ===================================================================
// Alerts
// ===================================================================

function seedAlerts(): MerakiAlert[] {
  return [
    { id: "al-001", ts: minutesAgo(2), severity: "warning", source: "HQ-AP-Conference", networkId: "net-hq", message: "High channel utilization on 2.4GHz (48%)" },
    { id: "al-002", ts: minutesAgo(12), severity: "critical", source: "RT-CAM-POS", networkId: "net-retail", message: "Camera offline > 10 minutes" },
    { id: "al-003", ts: minutesAgo(38), severity: "info", source: "HQ-MX67-FW", networkId: "net-hq", message: "WAN 2 (Comcast) loss spike 1.2%" },
    { id: "al-004", ts: minutesAgo(120), severity: "info", source: "HQ-AP-Conference", networkId: "net-hq", message: "Repeating wireless clients (3)" },
  ];
}

function seedAlertTypes(): MerakiAlertType[] {
  return [
    { id: "device-offline", label: "A device goes offline for X minutes", enabled: true, threshold: 5 },
    { id: "dhcp-fail", label: "DHCP issues are observed", enabled: true, threshold: 1 },
    { id: "vpn-down", label: "A VPN peer goes down", enabled: true, threshold: 1 },
    { id: "ap-repeating", label: "An AP has many repeating clients", enabled: true, threshold: 5 },
    { id: "wan-loss", label: "WAN connection has high loss", enabled: true, threshold: 1 },
    { id: "cellular-failover", label: "Failed over to cellular", enabled: true, threshold: 0 },
    { id: "port-power", label: "Switch port loses power (PoE)", enabled: true, threshold: 1 },
    { id: "mt-temp", label: "Temperature out of range", enabled: true, threshold: 1 },
    { id: "rogue-ssid", label: "Rogue SSID detected on LAN", enabled: true, threshold: 1 },
    { id: "config-change", label: "Any settings change", enabled: false, threshold: 0 },
  ];
}

// ===================================================================
// Threat events — seed an initial set matching source's original static 6-row
// security-center table (meraki-security.js renderSecCenter()), but as real state
// entries rather than hardcoded render-time content. The threat-engine adds more later.
// ===================================================================

function seedThreatEvents(): import("./types").MerakiThreatEvent[] {
  return [
    { id: "th-001", ts: minutesAgo(15), networkId: "net-hq", severity: "warning", category: "Malware download", signature: "Snort 1:35021 - Suspicious .pkx download", srcIp: "10.0.20.41", destIp: "185.220.101.42", action: "blocked", matchedRuleId: "fw3-9" },
    { id: "th-002", ts: minutesAgo(42), networkId: "net-hq", severity: "critical", category: "Malware callback", signature: "AMP retrospective: malicious SHA256", srcIp: "10.0.30.18", destIp: "45.153.160.2", action: "blocked", matchedRuleId: "fw3-2" },
    { id: "th-003", ts: minutesAgo(120), networkId: "net-hq", severity: "warning", category: "Exploit attempt", signature: "Snort 1:48022 - HTTP exploit attempt", srcIp: "10.0.10.55", destIp: "198.51.100.201", action: "blocked", matchedRuleId: "fw3-11" },
    { id: "th-004", ts: minutesAgo(280), networkId: "net-hq", severity: "warning", category: "Botnet C2", signature: "C&C beacon to known bad domain", srcIp: "10.0.10.71", destIp: "91.219.236.18", action: "blocked", matchedRuleId: "fw3-11" },
    { id: "th-005", ts: minutesAgo(610), networkId: "net-hq", severity: "info", category: "Phishing", signature: "Phishing page visit (Talos category)", srcIp: "10.0.10.22", destIp: "203.0.113.88", action: "alerted", matchedRuleId: null },
    { id: "th-006", ts: minutesAgo(920), networkId: "net-hq", severity: "info", category: "Data exfiltration attempt", signature: "IoT cleartext credential post", srcIp: "10.0.40.30", destIp: "198.51.100.240", action: "alerted", matchedRuleId: null },
  ];
}

// ===================================================================
// WAN health history — seed a starting history (last 24 samples per WAN link per
// appliance device), using the seeded RNG for jitter/loss/latency drift.
// ===================================================================

function seedWanHealthHistory(devices: MerakiDevice[]): MerakiWanHealthSample[] {
  const samples: MerakiWanHealthSample[] = [];
  const appliances = devices.filter((d) => d.type === "appliance");
  for (const dev of appliances) {
    const links: { key: "wan1" | "wan2"; link: MerakiWanLink | undefined }[] = [
      { key: "wan1", link: dev.wan1 },
      { key: "wan2", link: dev.wan2 },
    ];
    for (const { key, link } of links) {
      if (!link) continue;
      const rand = rng(seedFromString(`${dev.serial}:${key}:history`));
      for (let h = 23; h >= 0; h--) {
        const jitterDrift = (rand() - 0.5) * 0.6;
        const lossDrift = (rand() - 0.5) * 0.3;
        const latDrift = (rand() - 0.5) * 4;
        samples.push({
          ts: minutesAgo(h * 60),
          networkId: dev.networkId,
          serial: dev.serial,
          link: key,
          loss: Math.max(0, Math.round((link.loss + lossDrift) * 10) / 10),
          latency: Math.max(1, Math.round(link.latency + latDrift)),
          jitter: Math.max(0, Math.round((link.jitter + jitterDrift) * 10) / 10),
          failoverTriggered: false,
        });
      }
    }
  }
  return samples;
}

// ===================================================================
// Insight
// ===================================================================

function seedInsight(): MerakiState["insight"] {
  return {
    webApps: [
      { name: "Salesforce", healthPct: 99.92, latencyMs: 312 },
      { name: "Microsoft 365", healthPct: 99.85, latencyMs: 184 },
      { name: "Zoom", healthPct: 99.81, latencyMs: 142 },
      { name: "Workday", healthPct: 99.4, latencyMs: 422 },
      { name: "GitHub", healthPct: 99.98, latencyMs: 88 },
      { name: "AWS Console", healthPct: 99.95, latencyMs: 142 },
      { name: "Slack", healthPct: 99.71, latencyMs: 168 },
    ],
    wanHealth: [
      { networkId: "net-hq", goodputMbps: 432, lossPct: 0.1 },
      { networkId: "net-branch", goodputMbps: 78, lossPct: 0.2 },
      { networkId: "net-retail", goodputMbps: 22, lossPct: 0.3 },
    ],
    applications: [
      { name: "Microsoft Teams", category: "Business / collaboration", usageMB: 142 },
      { name: "Zoom", category: "Business / collaboration", usageMB: 98 },
      { name: "YouTube", category: "Video streaming", usageMB: 76 },
      { name: "Salesforce", category: "Business / collaboration", usageMB: 54 },
      { name: "GitHub", category: "Software updates", usageMB: 38 },
      { name: "iCloud", category: "Online backup", usageMB: 22 },
    ],
  };
}

// ===================================================================
// Camera events / sensor readings
// ===================================================================

function seedCameraEvents(): MerakiCameraEvent[] {
  return [
    { id: "cam-ev-1", serial: "Q2MV-MV12-C001", ts: minutesAgo(8), kind: "Motion", thumbnail: "" },
    { id: "cam-ev-2", serial: "Q2MV-MV12-C002", ts: minutesAgo(22), kind: "Person", thumbnail: "" },
    { id: "cam-ev-3", serial: "Q2MV-MV12-C003", ts: minutesAgo(48), kind: "Motion", thumbnail: "" },
    { id: "cam-ev-4", serial: "Q2MV-MV12-C004", ts: minutesAgo(180), kind: "Motion", thumbnail: "" },
    { id: "cam-ev-5", serial: "Q2MV-MV12-C001", ts: minutesAgo(360), kind: "Loitering", thumbnail: "" },
    { id: "cam-ev-6", serial: "Q2MV-MV12-C002", ts: minutesAgo(720), kind: "Person", thumbnail: "" },
  ];
}

// Sensor readings (last 24h hourly) — port source's sine-wave-plus-jitter formula
// `temp = 21 + Math.sin(h/4)*1.4 + jitter` using the seeded rng() instead of Math.random().
function seedSensorReadings(): MerakiSensorReading[] {
  const readings: MerakiSensorReading[] = [];
  const randServer = rng(seedFromString("Q2MT-MT10-S001:sensor"));
  const randDc = rng(seedFromString("Q2MT-MT10-S002:sensor"));
  for (let h = 0; h < 24; h++) {
    const jitterServer = (randInt(randServer, -3, 3)) / 10;
    const jitterDc = (randInt(randDc, -2, 2)) / 10;
    readings.push({
      serial: "Q2MT-MT10-S001",
      hour: h,
      temp: 21 + Math.sin(h / 4) * 1.4 + jitterServer,
      humidity: 42 + randInt(randServer, -3, 3),
    });
    readings.push({
      serial: "Q2MT-MT10-S002",
      hour: h,
      temp: 20 + Math.sin(h / 5) * 1.0 + jitterDc,
      humidity: 38 + randInt(randDc, -2, 2),
    });
  }
  return readings;
}

// ===================================================================
// Audit log (100 seeded rows)
// ===================================================================

function seedAuditLog(): MerakiAuditLogEntry[] {
  const auditActions = [
    "Login",
    "Logout",
    "Modified firewall rule",
    "Created SSID",
    "Disabled SSID",
    "Updated VLAN",
    "Rebooted device",
    "Claimed device",
    "Removed device",
    "Created admin",
    "Changed splash page",
    "Added port forward",
    "Bound to template",
    "Updated AutoVPN",
    "Upgraded firmware",
    "Changed content filtering",
    "Reset PoE port",
  ];
  const actors = [`ankit@${TENANT_DOMAIN}`, `rohit@${TENANT_DOMAIN}`, `netops@${TENANT_DOMAIN}`, "api-key:ITBDLabBot"];
  const targets = ["HQ-Main", "Branch-Office", "Retail-Store", "Org"];
  const rand = rng(seedFromString("audit-log"));
  const entries: MerakiAuditLogEntry[] = [];
  for (let a = 0; a < 100; a++) {
    const dayOffset = Math.floor(a / 4);
    const hh = pad(randInt(rand, 0, 23));
    const mm = pad(randInt(rand, 0, 59));
    entries.push({
      id: `audit-${a + 1}`,
      ts: `${daysAgo(dayOffset).slice(0, 10)}T${hh}:${mm}:00.000Z`,
      admin: actors[a % actors.length],
      action: auditActions[a % auditActions.length],
      page: targets[a % targets.length],
    });
  }
  return entries;
}

// ===================================================================
// Air Marshal / Bluetooth
// ===================================================================

function seedAirMarshal(): MerakiAirMarshalAp[] {
  return [
    { id: "am-1", ssid: "xfinitywifi", bssid: "34:bd:fa:11:22:33", channel: 6, threat: "Other", networkId: "net-hq" },
    { id: "am-2", ssid: "Linksys-Setup", bssid: "c4:41:1e:22:33:44", channel: 11, threat: "Rogue (BSSID seen on LAN)", networkId: "net-hq" },
    { id: "am-3", ssid: "FreePublic", bssid: "74:da:88:33:44:55", channel: 1, threat: "Other", networkId: "net-hq" },
    { id: "am-4", ssid: "CloudLab-Guest-Twin", bssid: "a4:55:aa:44:55:66", channel: 6, threat: "Spoof - Rogue!", networkId: "net-hq" },
    { id: "am-5", ssid: "NETGEAR-22", bssid: "14:f4:42:55:66:77", channel: 36, threat: "Friendly", networkId: "net-hq" },
    { id: "am-6", ssid: "IoT_Vendor", bssid: "90:78:b2:66:77:88", channel: 11, threat: "Other", networkId: "net-hq" },
  ];
}

function seedBluetoothClients(): MerakiBluetoothClient[] {
  return [
    { id: "bt-1", name: "Apple Watch Series 9", networkId: "net-hq", rssi: -52, lastSeen: minutesAgo(2) },
    { id: "bt-2", name: "AirPods Pro 2", networkId: "net-hq", rssi: -60, lastSeen: minutesAgo(4) },
    { id: "bt-3", name: "Fitbit Charge 6", networkId: "net-hq", rssi: -71, lastSeen: minutesAgo(11) },
    { id: "bt-4", name: "Samsung Buds", networkId: "net-hq", rssi: -68, lastSeen: minutesAgo(15) },
    { id: "bt-5", name: "Beats Solo Pro", networkId: "net-hq", rssi: -74, lastSeen: minutesAgo(20) },
    { id: "bt-6", name: "Tile Tracker", networkId: "net-hq", rssi: -85, lastSeen: minutesAgo(35) },
    { id: "bt-7", name: "Garmin Fenix 7", networkId: "net-hq", rssi: -66, lastSeen: minutesAgo(5) },
    { id: "bt-8", name: "Oura Ring Gen3", networkId: "net-hq", rssi: -77, lastSeen: minutesAgo(40) },
  ];
}

// ===================================================================
// Admin users / RADIUS / Inventory
// ===================================================================

function seedAdminUsers(): MerakiAdminUser[] {
  return [
    { id: "adm-1", email: `ankit@${TENANT_DOMAIN}`, role: "Organization admin", networks: [] },
    { id: "adm-2", email: `rohit@${TENANT_DOMAIN}`, role: "Network admin", networks: ["net-hq"] },
    { id: "adm-3", email: `netops@${TENANT_DOMAIN}`, role: "Read-only", networks: [] },
    { id: "adm-4", email: `priya@${TENANT_DOMAIN}`, role: "Help desk (monitor only)", networks: [] },
  ];
}

function seedRadius(): MerakiRadiusServerEntry[] {
  return [{ id: "radius-1", host: "10.0.0.50", port: 1812 }];
}

function seedInventory(): MerakiInventoryItem[] {
  return [
    { serial: "Q2KD-MX68-UNAS", model: "MX68", type: "appliance", claimedOn: daysAgo(40) },
    { serial: "Q2HP-MS250-NEW1", model: "MS250-24P", type: "switch", claimedOn: daysAgo(40) },
    { serial: "Q2MR-MR57-NEW1", model: "MR57", type: "wireless", claimedOn: daysAgo(40) },
  ];
}

// ===================================================================
// Root factory
// ===================================================================

export function freshMerakiState(): MerakiState {
  const networks = seedNetworks();
  const devices = seedDevices();
  const clients = seedClients(networks, devices);
  const ssids = seedSsids(networks);
  const vlans = seedVlans();
  const firewallL3 = seedFirewallL3();
  const firewallL7 = seedFirewallL7();
  const nat = { portForwards: seedPortForwards() };
  const vpn = { siteToSite: seedVpnPeers() };
  const alertsActive = seedAlerts();
  const alertTypes = seedAlertTypes();
  const threatEvents = seedThreatEvents();
  const wanHealthHistory = seedWanHealthHistory(devices);
  const insight = seedInsight();
  const cameraEvents = seedCameraEvents();
  const sensorReadings = seedSensorReadings();
  const auditLog = seedAuditLog();
  const airMarshal = seedAirMarshal();
  const bluetoothClients = seedBluetoothClients();
  const adminUsers = seedAdminUsers();
  const radius = seedRadius();
  const inventory = seedInventory();

  return {
    org: {
      id: "org-cloudlab",
      name: `${TENANT_COMPANY} Networks`,
      url: "https://dashboard.meraki.com/o/cloudlab",
      licensing: "Per-device",
      licenseStatus: "OK",
      licenseExpiry: "2027-04-18",
      deviceCount: devices.length,
      regions: ["Asia / South Asia"],
      admin: `ankit@${TENANT_DOMAIN}`,
      tz: "Asia/Kolkata",
    },
    networks,
    devices,
    inventory,
    clients,
    ssids,
    vlans,
    firewallL3,
    firewallL7,
    contentFiltering: {
      blockedCategories: [
        "Adult and Pornography",
        "Gambling",
        "Hate Speech",
        "Illegal Drugs",
        "Malware Sites",
        "Phishing and Other Frauds",
        "Proxy Avoidance and Anonymizers",
        "Violence",
      ],
      blockedUrlPatterns: ["*.bittorrent.com", "*.torrentfreak.com", "*.thepiratebay.org"],
      allowedUrlPatterns: [`*.${TENANT_DOMAIN}`, "*.itbd.net", "*.meraki.com"],
    },
    nat,
    vpn,
    alerts: { active: alertsActive, recipients: [`ankit@${TENANT_DOMAIN}`, `netops@${TENANT_DOMAIN}`], types: alertTypes },
    threatEvents,
    wanHealthHistory,
    insight,
    cameraEvents,
    sensorReadings,
    auditLog,
    airMarshal,
    bluetoothClients,
    adminUsers,
    radius,
    currentNetworkId: "net-hq",
  };
}
