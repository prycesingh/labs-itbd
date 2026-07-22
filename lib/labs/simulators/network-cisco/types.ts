export type CiscoDevice = {
  hostname: string;
  model: string;
  iosVersion: string;
  iosImage: string;
  serial: string;
  uptime: string;
  location: string;
  contact: string;
  bootReason: string;
  configRegister: string;
  systemTime: string;
  timezone: string;
  adminUser: string;
  privilegeLevel: number;
  cpu5sec: number;
  cpu1min: number;
  cpu5min: number;
  memTotal: number;
  memUsed: number;
  tempSystem: string;
  tempCpu: string;
  fanStatus: string;
  powerSupply: string;
  bannerMotd: string;
  domainName: string;
  dnsServers: string[];
  ntpServers: string[];
};

export type CiscoInterfaceRole = "wan" | "lan" | "dmz" | "unused" | "loopback";

export type CiscoInterface = {
  name: string;
  alias: string;
  role: CiscoInterfaceRole;
  ip: string;
  mask: string;
  mtu: number;
  duplex: string;
  speed: string;
  adminUp: boolean;
  lineUp: boolean;
  description: string;
  encap: string;
  mac: string;
  natRole: "inside" | "outside" | "";
  inputErrors: number;
  crcErrors: number;
  frameErrors: number;
  overrun: number;
  ignored: number;
  outputDrops: number;
  lateCollisions: number;
  deferred: number;
  inputPackets: number;
  outputPackets: number;
  bytesIn: number;
  bytesOut: number;
  loadIn: number;
  loadOut: number;
  inputRate: number;
  outputRate: number;
};

export type CiscoVlan = { id: number; name: string; state: string; ports: string; members: number; gateway: string };

export type CiscoVtp = { domain: string; mode: string; version: number; revision: number; pruning: boolean; password: string };

export type CiscoSpanningTree = {
  mode: string;
  priority: number;
  rootBridge: string;
  helloTime: number;
  forwardDelay: number;
  maxAge: number;
};

export type CiscoEtherChannel = { group: number; protocol: string; members: string; mode: string; load: string; status: string };

export type CiscoStaticRoute = {
  dst: string;
  mask: string;
  nextHop: string;
  iface: string;
  distance: number;
  tag: string;
  comment: string;
};

export type CiscoRipConfig = {
  enabled: boolean;
  version: number;
  networks: string[];
  passiveInterfaces: string[];
  autoSummary: boolean;
};

export type CiscoEigrpConfig = {
  enabled: boolean;
  asn: number;
  routerId: string;
  networks: { network: string; wildcard: string }[];
  passiveInterfaces: string[];
  authMode: string;
  authKey: string;
};

export type CiscoEigrpNeighbor = {
  neighbor: string;
  iface: string;
  holdTime: number;
  uptime: string;
  srtt: number;
  rto: number;
  q: number;
  seq: number;
};

export type CiscoOspfArea = { area: number; type: string; networks: string[] };

export type CiscoOspfConfig = {
  enabled: boolean;
  processId: number;
  routerId: string;
  areas: CiscoOspfArea[];
  referenceBandwidth: number;
  passiveInterfaces: string[];
  authMode: string;
  authKey: string;
};

export type CiscoOspfNeighbor = {
  neighbor: string;
  iface: string;
  priority: number;
  state: string;
  deadTime: string;
  address: string;
};

export type CiscoBgpNeighbor = {
  peer: string;
  remoteAs: number;
  description: string;
  state: string;
  uptime: string;
  prefixesIn: number;
  prefixesOut: number;
};

export type CiscoBgpConfig = {
  enabled: boolean;
  asn: number;
  routerId: string;
  neighbors: CiscoBgpNeighbor[];
  networks: string[];
};

export type CiscoAclRule = {
  seq: number;
  action: "permit" | "deny";
  proto: string;
  src: string;
  srcWc: string;
  dst: string;
  dstWc: string;
  op: string;
  port: string;
  log: boolean;
  hits: number;
  remark?: string;
};

export type CiscoAcl = {
  number: number;
  name: string;
  type: "extended" | "standard";
  bound: string;
  rules: CiscoAclRule[];
};

export type CiscoNatStaticEntry = {
  type: "static-tcp" | "static";
  insideLocal: string;
  port: number | "";
  insideGlobal: string;
  globalPort: number | "";
  comment: string;
};

export type CiscoNatTranslation = {
  proto: "udp" | "tcp";
  insideLocal: string;
  insideGlobal: string;
  outsideLocal: string;
  outsideGlobal: string;
};

export type CiscoNat = {
  overload: boolean;
  outsideInterface: string;
  insideInterfaces: string[];
  aclRef: number;
  staticEntries: CiscoNatStaticEntry[];
  translations: CiscoNatTranslation[];
};

export type CiscoAaaServer = {
  name: string;
  address: string;
  port: number;
  key: string;
  timeout: number;
  status: string;
};

export type CiscoAaa = {
  enabled: boolean;
  model: string;
  methods: {
    login: string[];
    enable: string[];
    exec: string[];
    commands: Record<string, string[]>;
  };
  tacacsServers: (CiscoAaaServer & { singleConn: boolean })[];
  radiusServers: CiscoAaaServer[];
  accounting: string;
};

export type CiscoLocalUser = { username: string; privilege: number; secret: string; encryption: string; comment: string };

export type CiscoDhcpOption = { code: number; type: string; value: string; name: string };

export type CiscoDhcpPool = {
  name: string;
  network: string;
  mask: string;
  gateway: string;
  dns: string;
  excluded: string;
  leaseDays: number;
  domain: string;
  active: number;
  free: number;
  options: CiscoDhcpOption[];
};

export type CiscoDhcpBinding = { ip: string; mac: string; lease: string; type: string; hostname: string };

export type CiscoSnmp = {
  communities: { string: string; access: "RO" | "RW"; acl: string }[];
  trapHosts: { host: string; community: string; version: string; traps: string[] }[];
  contact: string;
  location: string;
};

export type CiscoSyslogEntry = {
  ts: string;
  seq: number;
  facility: string;
  severity: string;
  mnemonic: string;
  message: string;
};

export type CiscoSyslog = {
  bufferSize: number;
  bufferLevel: string;
  consoleLevel: string;
  monitorLevel: string;
  trapLevel: string;
  servers: { host: string; vrf: string; source: string }[];
  entries: CiscoSyslogEntry[];
};

export type CiscoHttpsServer = { http: boolean; https: boolean; port: number; sslPort: number; aaaAuthList: string; acl: string };

export type CiscoSshConfig = { enabled: boolean; version: number; timeout: number; retries: number; acl: string; cryptoKeyBits: number };

export type CiscoTelnetConfig = { enabled: boolean };

export type CiscoVtyLines = { range: string; transport: string; execTimeout: string; accessClass: string };

export type CiscoNtpAssociation = {
  server: string;
  stratum: number;
  when: number;
  poll: number;
  reach: number;
  delay: number;
  offset: number;
  disp: number;
  sync: boolean;
};

export type CiscoCertificate = { name: string; type: string; usage: string; valid: string; status: string };

export type CiscoIpsecTunnel = {
  name: string;
  peer: string;
  auth: string;
  ike: string;
  enc: string;
  hash: string;
  dh: number;
  localNet: string;
  remoteNet: string;
  state: string;
  pkts: number;
  kBytes: number;
  uptime: string;
};

export type CiscoSslVpnGateway = {
  name: string;
  listenIf: string;
  port: number;
  idle: number;
  cert: string;
  activeSessions: number;
  peakSessions: number;
};

export type CiscoSslVpn = { gateways: CiscoSslVpnGateway[] };

export type CiscoIps = { enabled: boolean; signatures: number; action: string; lastUpdate: string; blockedRecently: number };

export type CiscoQosClass = { class: string; bw: string; shape: string; queue: string; drop: number };
export type CiscoQosPolicyMap = { name: string; applied: string; classes: CiscoQosClass[] };
export type CiscoQos = {
  wizardApplied: boolean;
  classMaps: { name: string; match: string; hits: number }[];
  policyMaps: CiscoQosPolicyMap[];
};

export type CiscoVoiceConfig = { callManager: string; dialPeers: number; phones: number; gateway: string };

export type CiscoWirelessConfig = {
  country: string;
  radios: { id: number; band: string; channel: number; power: number; status: string }[];
  ssids: { name: string; vlan: number; security: string; clients: number }[];
};

export type CiscoFirewallStats = { activeSessions: number; halfOpen: number; droppedPkts: number; policy: string };

export type CiscoFile = { name: string; size: number; type: string; date: string };

export type CiscoAaaEvent = {
  ts: string;
  user: string;
  source: string;
  method: string;
  server: string;
  result: "FAILED" | "SUCCESS";
  reason: string;
};

export type CiscoRoutingEvent = { ts: string; proto: string; event: string; detail: string };

export type CiscoTopTalker = { src: string; app: string; pkts: number; bytes: string; pct: number };

export type CiscoCanonicalSwitch = { hostname: string; vendor: string; mgmtIp: string; site?: string; role?: string };
export type CiscoTenant = { name: string; domain: string };

// ===== Diagnostics (ping/traceroute) — real routing-aware engine output =====

export type PingOutcomeKind = "ok" | "partial" | "fail" | "src_admin_down" | "src_link_down" | "bad_dest" | "no_route";

export type PingResult = {
  kind: PingOutcomeKind;
  dst: string;
  src: string | null;
  sent: number;
  received: number;
  lossPct: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  route: CiscoRouteResolution | null;
};

export type TraceHop = { hop: number; address: string; rttMs: number | null; timedOut: boolean };

export type TraceResult = {
  dst: string;
  src: string | null;
  hops: TraceHop[];
  reached: boolean;
};

export type CiscoRouteSourceKind = "connected" | "static" | "ospf" | "eigrp" | "bgp" | "none";

export type CiscoRouteResolution = {
  matched: boolean;
  sourceKind: CiscoRouteSourceKind;
  egressInterface: string | null;
  nextHop: string | null;
  distance: number | null;
};

// ===== Diagnostics history (persisted so ping/traceroute results survive reload) =====

export type CiscoDiagHistoryEntry = {
  id: string;
  ts: string;
  kind: "ping" | "traceroute";
  dst: string;
  src: string | null;
  summary: string;
};

// ===== Root state =====

export type CiscoState = {
  device: CiscoDevice;
  interfaces: CiscoInterface[];
  vlans: CiscoVlan[];
  vtp: CiscoVtp;
  spanningTree: CiscoSpanningTree;
  etherChannels: CiscoEtherChannel[];
  staticRoutes: CiscoStaticRoute[];
  ripConfig: CiscoRipConfig;
  eigrpConfig: CiscoEigrpConfig;
  eigrpNeighbors: CiscoEigrpNeighbor[];
  ospfConfig: CiscoOspfConfig;
  ospfNeighbors: CiscoOspfNeighbor[];
  bgpConfig: CiscoBgpConfig;
  acls: CiscoAcl[];
  nat: CiscoNat;
  aaa: CiscoAaa;
  localUsers: CiscoLocalUser[];
  dhcpPools: CiscoDhcpPool[];
  dhcpBindings: CiscoDhcpBinding[];
  snmp: CiscoSnmp;
  syslog: CiscoSyslog;
  httpsServer: CiscoHttpsServer;
  sshConfig: CiscoSshConfig;
  telnetConfig: CiscoTelnetConfig;
  vtyLines: CiscoVtyLines;
  ntpAssociations: CiscoNtpAssociation[];
  certificates: CiscoCertificate[];
  ipsecTunnels: CiscoIpsecTunnel[];
  sslVpn: CiscoSslVpn;
  ips: CiscoIps;
  qos: CiscoQos;
  voiceConfig: CiscoVoiceConfig;
  wirelessConfig: CiscoWirelessConfig;
  firewallStats: CiscoFirewallStats;
  files: CiscoFile[];
  aaaEvents: CiscoAaaEvent[];
  routingEvents: CiscoRoutingEvent[];
  topTalkers: CiscoTopTalker[];
  diagHistory: CiscoDiagHistoryEntry[];
  canonicalSwitches: CiscoCanonicalSwitch[];
  canonicalSites: unknown;
  tenant: CiscoTenant;
};
