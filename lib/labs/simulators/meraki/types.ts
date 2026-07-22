export type MerakiProductType = "appliance" | "switch" | "wireless" | "camera" | "sensor";

export type MerakiOrg = {
  id: string;
  name: string;
  url: string;
  licensing: string;
  licenseStatus: string;
  licenseExpiry: string;
  deviceCount: number;
  regions: string[];
  admin: string;
  tz: string;
};

export type MerakiNetworkStatus = "online" | "degraded" | "offline";

export type MerakiNetwork = {
  id: string;
  name: string;
  tag: string;
  productTypes: MerakiProductType[];
  tz: string;
  region: string;
  clientsOnline: number;
  clientsTotal: number;
  devicesOnline: number;
  devicesTotal: number;
  wanUsage: { down: number; up: number };
  status: MerakiNetworkStatus;
};

// ===== Devices (polymorphic) =====

export type MerakiDeviceStatus = "online" | "offline" | "alerting" | "rebooting" | "updating";

export type MerakiWanLink = {
  isp: string;
  plan: string;
  publicIp: string;
  status: "active" | "ready" | "failed";
  loss: number;
  latency: number;
  jitter: number;
  usage: number;
};

export type MerakiSwitchPort = {
  portId: string;
  name: string;
  enabled: boolean;
  vlan: number;
  nativeVlan: number;
  allowedVlans: string;
  poe: { enabled: boolean; used: number; max: number; lldpMed: string | null };
  stpGuard: string;
  stormControl: boolean;
  accessPolicy: string;
  taggedCount: number;
  untaggedCount: number;
  rxBytes: number;
  txBytes: number;
  errors: number;
  linkStatus: "connected" | "disconnected";
};

export type MerakiDevice = {
  serial: string;
  name: string;
  model: string;
  type: MerakiProductType;
  networkId: string;
  status: MerakiDeviceStatus;
  lanIp: string;
  mac: string;
  uptimeDays: number;
  firmware: string;
  firmwareLatest: string;
  tags: string[];
  lastReboot: string;
  // appliance (MX)
  wan1?: MerakiWanLink;
  wan2?: MerakiWanLink;
  cpuPct?: number;
  memPct?: number;
  sessions?: number;
  publicIp?: string;
  // switch (MS)
  poeBudget?: number;
  poeUsed?: number;
  portsTotal?: number;
  portsActive?: number;
  isL3?: boolean;
  ports?: MerakiSwitchPort[];
  // wireless (MR)
  clientsCount?: number;
  channel24?: number;
  channel5?: number;
  channelUtil24?: number;
  channelUtil5?: number;
  txPower24?: number;
  txPower5?: number;
  outdoor?: boolean;
  // camera (MV)
  resolution?: string;
  retention?: string;
  motion?: boolean;
  rtsp?: boolean;
  // sensor (MT)
  temp?: number;
  humidity?: number;
  battery?: number;
  alertThresholds?: { tempMax: number; tempMin: number };
  // lifecycle-engine transient fields
  pendingAction?: { kind: "reboot" | "firmware-update"; startedAt: string; ticksRemaining: number } | null;
};

export type MerakiInventoryItem = {
  serial: string;
  model: string;
  type: MerakiProductType;
  claimedOn: string;
};

// ===== Clients =====

export type MerakiClientStatus = "online" | "offline";

export type MerakiClient = {
  id: string;
  description: string;
  mac: string;
  ip: string;
  vlan: number;
  connectivity: string;
  ssid: string | null;
  status: MerakiClientStatus;
  networkId: string;
  connectedTo: string | null;
  manufacturer: string;
  os: string;
  policy: string;
  usage24h: { recv: number; sent: number };
  lastSeen: string;
  firstSeen: string;
  signal: number | null;
  bandwidthSeries: number[];
  // client-roam-engine transient fields
  roamState?: "stable" | "roaming" | "disconnecting" | "reconnecting";
  roamTicksRemaining?: number;
};

// ===== SSIDs =====

export type MerakiSsidAuthMode = "open" | "psk" | "8021x-radius";

export type MerakiRadiusServer = { host: string; port: number; secret: string };

export type MerakiSsid = {
  id: string;
  slot: number;
  name: string;
  enabled: boolean;
  networkId: string;
  authMode: MerakiSsidAuthMode;
  encryption: string;
  psk: string | null;
  radius: { servers: MerakiRadiusServer[]; accounting: boolean; attempts: number };
  splash: { type: string; text: string };
  ipAssignment: string;
  vlan: number;
  bandwidthDown: number;
  bandwidthUp: number;
  hidden: boolean;
  mac80211w: string;
  minBitrate: number;
  mdns: boolean;
  perClientLimit: number;
  l3Rules: MerakiFirewallL3Rule[];
  l7Rules: MerakiFirewallL7Rule[];
  hotspot20: { enabled: boolean; operatorName: string };
  concentrator: string | null;
  clientsCount: number;
  splashBlockedCountries: string[];
};

// ===== Firewall / NAT / VPN =====

export type MerakiFirewallL3Rule = {
  id: string;
  policy: "allow" | "deny";
  protocol: string;
  srcCidr: string;
  srcPort: string;
  destCidr: string;
  destPort: string;
  comment: string;
  enabled: boolean;
};

export type MerakiFirewallL7Rule = {
  id: string;
  type: string;
  value: string;
  policy: "deny";
  comment: string;
};

export type MerakiPortForward = {
  id: string;
  name: string;
  protocol: "tcp" | "udp";
  publicPort: string;
  lanIp: string;
  localPort: string;
  allowedRemote: string;
  enabled: boolean;
};

export type MerakiVpnPeer = {
  id: string;
  name: string;
  networkId: string;
  publicIp: string;
  status: "active" | "down";
  privateSubnets: string[];
};

// ===== VLANs (canonical, real state — reconciles the two duplicate source tables) =====

export type MerakiVlan = {
  id: number;
  networkId: string;
  name: string;
  subnet: string;
  mxIp: string;
  groupPolicy: string | null;
  dhcpMode: string;
};

// ===== Alerts =====

export type MerakiAlertSeverity = "critical" | "warning" | "info";

export type MerakiAlert = {
  id: string;
  ts: string;
  severity: MerakiAlertSeverity;
  source: string;
  networkId: string;
  message: string;
};

export type MerakiAlertType = { id: string; label: string; enabled: boolean; threshold: number | null };

// ===== Threat / IPS (real engine output) =====

export type MerakiThreatEvent = {
  id: string;
  ts: string;
  networkId: string;
  severity: MerakiAlertSeverity;
  category: string;
  signature: string;
  srcIp: string;
  destIp: string;
  action: "blocked" | "allowed" | "alerted";
  matchedRuleId: string | null;
};

// ===== WAN health (real engine output) =====

export type MerakiWanHealthSample = {
  ts: string;
  networkId: string;
  serial: string;
  link: "wan1" | "wan2";
  loss: number;
  latency: number;
  jitter: number;
  failoverTriggered: boolean;
};

// ===== Insight =====

export type MerakiInsightWebApp = { name: string; healthPct: number; latencyMs: number };
export type MerakiInsightWanHealth = { networkId: string; goodputMbps: number; lossPct: number };
export type MerakiInsightApplication = { name: string; category: string; usageMB: number };

// ===== Camera / sensor =====

export type MerakiCameraEvent = { id: string; serial: string; ts: string; kind: string; thumbnail: string };
export type MerakiSensorReading = { serial: string; hour: number; temp: number; humidity: number };

// ===== Misc =====

export type MerakiAuditLogEntry = { id: string; ts: string; admin: string; action: string; page: string };
export type MerakiAirMarshalAp = { id: string; ssid: string; bssid: string; channel: number; threat: string; networkId: string };
export type MerakiBluetoothClient = { id: string; name: string; networkId: string; rssi: number; lastSeen: string };
export type MerakiAdminUser = { id: string; email: string; role: string; networks: string[] };
export type MerakiRadiusServerEntry = { id: string; host: string; port: number };

// ===== Root state =====

export type MerakiState = {
  org: MerakiOrg;
  networks: MerakiNetwork[];
  devices: MerakiDevice[];
  inventory: MerakiInventoryItem[];
  clients: MerakiClient[];
  ssids: MerakiSsid[];
  vlans: MerakiVlan[];
  firewallL3: MerakiFirewallL3Rule[];
  firewallL7: MerakiFirewallL7Rule[];
  contentFiltering: { blockedCategories: string[]; blockedUrlPatterns: string[]; allowedUrlPatterns: string[] };
  nat: { portForwards: MerakiPortForward[] };
  vpn: { siteToSite: MerakiVpnPeer[] };
  alerts: { active: MerakiAlert[]; recipients: string[]; types: MerakiAlertType[] };
  threatEvents: MerakiThreatEvent[];
  wanHealthHistory: MerakiWanHealthSample[];
  insight: { webApps: MerakiInsightWebApp[]; wanHealth: MerakiInsightWanHealth[]; applications: MerakiInsightApplication[] };
  cameraEvents: MerakiCameraEvent[];
  sensorReadings: MerakiSensorReading[];
  auditLog: MerakiAuditLogEntry[];
  airMarshal: MerakiAirMarshalAp[];
  bluetoothClients: MerakiBluetoothClient[];
  adminUsers: MerakiAdminUser[];
  radius: MerakiRadiusServerEntry[];
  currentNetworkId: string;
};
