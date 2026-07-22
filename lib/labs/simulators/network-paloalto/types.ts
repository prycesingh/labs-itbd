export type PaloDevice = {
  hostname: string;
  model: string;
  panOS: string;
  appContent: string;
  threatContent: string;
  antivirus: string;
  wildfire: string;
  urlDb: string;
  globalProtectClient: string;
  serial: string;
  uptime: string;
  license: string;
  mgmtIp: string;
  mgmtMac: string;
  family: string;
  operationalMode: string;
  multiVsys: string;
  cpuMgmt: number;
  cpuDp: number;
  memory: number;
  sessions: number;
  sessionUtil: number;
  packetsPerSec: number;
  throughputMbps: number;
  adminUser: string;
  adminRole: string;
  timezone: string;
  systemTime: string;
  ha: string;
  wildfireRegion: string;
  logRetentionDays: number;
  pendingChanges: number;
};

export type PaloInterface = {
  name: string;
  type: "Layer3" | "Layer3-Subinterface" | "Tunnel";
  tag?: number;
  ip: string;
  zone: string;
  vr: string;
  mgmtProfile: string;
  comment: string;
  link: string;
  speed: string;
  mtu: number;
  mac?: string;
  parent?: string;
};

export type PaloZone = {
  name: string;
  type: string;
  interfaces: string;
  userIdent: boolean;
  pktBufferProt: boolean;
  comment: string;
};

export type PaloStaticRoute = { name: string; dst: string; nextHop: string; iface: string; metric: number; admin: number };

export type PaloOspfConfig = { enabled: boolean; routerId: string; area: string; interfaces: string[] };
export type PaloBgpPeer = { name: string; peerIp: string; remoteAs: number; status: string };
export type PaloBgpConfig = { enabled: boolean; routerId: string; asn: number; peers: PaloBgpPeer[] };

export type PaloVirtualRouter = {
  name: string;
  interfaces: string;
  staticRoutes: PaloStaticRoute[];
  ospf: PaloOspfConfig;
  bgp: PaloBgpConfig;
  rip: { enabled: boolean };
  multicast: { enabled: boolean };
};

export type PaloVlan = { name: string; interfaces: string; vifs: string; comment: string };

export type PaloAddress = {
  name: string;
  type: "IP Netmask" | "IP Range" | "Static" | "FQDN";
  value: string;
  members?: string;
  tags: string;
  description: string;
};

export type PaloAddressGroup = {
  name: string;
  type: "Static" | "Dynamic";
  members: string;
  filter: string;
  tags: string;
  description: string;
};

export type PaloService = { name: string; protocol: "TCP" | "UDP"; dstPort: string; srcPort: string; tags: string; description: string };

export type PaloServiceGroup = { name: string; members: string; tags: string; description: string };

export type PaloApplication = {
  name: string;
  category: string;
  subcategory: string;
  technology: string;
  risk: number;
  ports: string;
  tags: string;
  description: string;
};

export type PaloApplicationGroup = { name: string; members: string; tags: string; description: string };

export type PaloApplicationFilter = {
  name: string;
  category: string;
  subcategory: string;
  risk: string;
  tags: string;
  description: string;
};

export type PaloTag = { name: string; color: string; comment: string };

// ===== Security Profiles =====

export type PaloAvProfile = {
  name: string;
  decoders: string[];
  action: string;
  wildfireAction: string;
  packetCapture: boolean;
  description: string;
};

export type PaloSeverityRule = { severity: string; action: string };

export type PaloAsProfile = { name: string; rules: PaloSeverityRule[]; dnsSinkhole: string; description: string };
export type PaloVpProfile = { name: string; rules: PaloSeverityRule[]; packetCapture: string; description: string };

export type PaloUrlProfile = {
  name: string;
  categories: Record<string, string>;
  credentialDetection: string;
  description: string;
};

export type PaloFileRule = { apps: string; filetypes: string; direction: string; action: string };
export type PaloFileProfile = { name: string; rules: PaloFileRule[]; description: string };

export type PaloWildfireRule = { apps: string; filetypes: string; direction: string; analysis: string };
export type PaloWildfireProfile = { name: string; rules: PaloWildfireRule[]; description: string };

export type PaloDataRule = { apps: string; filetypes: string; direction: string; action: string };
export type PaloDataProfile = { name: string; patterns: string[]; rules: PaloDataRule[]; description: string };

export type PaloProfileGroup = {
  name: string;
  av: string;
  as: string;
  vp: string;
  url: string;
  file: string;
  wildfire: string;
  data: string;
  description: string;
};

// ===== Policies =====

export type PaloSecurityPolicy = {
  id: number;
  name: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  users: string;
  app: string;
  service: string;
  urlCat: string;
  action: "allow" | "deny";
  logStart: boolean;
  logEnd: boolean;
  profileGroup: string;
  tag: string;
  description: string;
  hitCount: number;
  disabled: boolean;
};

export type PaloNatPolicy = {
  id: number;
  name: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  service: string;
  type: string;
  natType: "source" | "destination";
  sourceTranslation: string;
  interfaceAddr: string;
  translatedAddr: string;
  destTranslation?: string;
  destPort?: string;
  description: string;
  disabled: boolean;
};

export type PaloDecryptionPolicy = {
  id: number;
  name: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  service: string;
  urlCat: string;
  action: "decrypt" | "no-decrypt";
  type: string;
  profile: string;
  description: string;
};

export type PaloAuthPolicy = {
  id: number;
  name: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  service: string;
  urlCat: string;
  authProfile: string;
  timeout: number;
  description: string;
};

// ===== VPN / GlobalProtect =====

export type PaloProxyId = { name: string; local: string; remote: string; proto: string };

export type PaloIpsecTunnel = {
  name: string;
  gateway: string;
  peerIp: string;
  ikeProfile: string;
  ipsecProfile: string;
  tunnelInterface: string;
  psk: string;
  proxyIds: PaloProxyId[];
  status: string;
  uptime: string;
  bytesIn: string;
  bytesOut: string;
};

export type PaloIkeGateway = {
  name: string;
  version: string;
  peerIp: string;
  localIp: string;
  authType: string;
  psk: string;
  localId: string;
  peerId: string;
  cryptoProfile: string;
};

export type PaloIkeCrypto = { name: string; dhGroup: string; auth: string; encryption: string; lifetime: string };
export type PaloIpsecCrypto = { name: string; esp: boolean; dhGroup: string; auth: string; encryption: string; lifetime: string };

export type PaloGpPortal = {
  name: string;
  iface: string;
  ip: string;
  cert: string;
  authProfile: string;
  clientCfg: string;
  agentVersion: string;
  description: string;
};

export type PaloGpGateway = {
  name: string;
  iface: string;
  ip: string;
  cert: string;
  authProfile: string;
  tunnelInterface: string;
  ipPool: string;
  description: string;
};

export type PaloGlobalProtect = {
  portals: PaloGpPortal[];
  gateways: PaloGpGateway[];
};

// ===== Auth / Users =====

export type PaloAuthProfile = {
  name: string;
  method: string;
  userDomain: string;
  allowList: string;
  factors: string[];
  description: string;
};

export type PaloAuthSequence = { name: string; profiles: string[]; description: string };
export type PaloLocalUser = { name: string; pwdSet: boolean; disabled: boolean; group: string };
export type PaloUserGroup = { name: string; members: string };

// ===== Device =====

export type PaloAdministrator = { name: string; role: string; auth: string; publicKey: string; client: string };

export type PaloCertificate = { name: string; cn: string; issuer: string; notAfter: string; usage: string; status: string };

export type PaloSnmpServer = { name: string; server: string; version: string; community: string };
export type PaloSyslogServer = { name: string; server: string; transport: string; port: number; format: string };
export type PaloEmailServer = { name: string; server: string; from: string; to: string };
export type PaloRadiusServer = { name: string; server: string; port: number; secret: string };
export type PaloLdapServer = { name: string; server: string; port: number; baseDn: string; bindDn: string; ssl: boolean };

export type PaloServerProfiles = {
  snmp: PaloSnmpServer[];
  syslog: PaloSyslogServer[];
  email: PaloEmailServer[];
  radius: PaloRadiusServer[];
  ldap: PaloLdapServer[];
};

export type PaloLogForwardingProfile = {
  name: string;
  traffic: string;
  threat: string;
  url: string;
  wildfire: string;
  system: string;
  description: string;
};

export type PaloHighAvailability = { enabled: boolean; mode: string; peerIp: string; priority: number; preempt: boolean };

// ===== Logs =====

export type PaloTrafficLogEntry = {
  time: string;
  srcZone: string;
  dstZone: string;
  src: string;
  dst: string;
  srcPort: number;
  dstPort: number;
  proto: "tcp" | "udp";
  app: string;
  rule: string;
  action: string;
  severity: string;
  bytes: number;
  packets: number;
};

export type PaloThreatLogEntry = {
  time: string;
  type: string;
  severity: string;
  name: string;
  src: string;
  dst: string;
  app: string;
  action: string;
  rule: string;
};

export type PaloUrlLogEntry = { time: string; url: string; cat: string; action: string; src: string; rule: string };

export type PaloWildfireEntry = {
  time: string;
  file: string;
  sha256: string;
  size: string;
  src: string;
  dst: string;
  app: string;
  verdict: string;
  action: string;
};

export type PaloSystemLogEntry = { time: string; subtype: string; severity: string; msg: string };
export type PaloConfigLogEntry = { time: string; admin: string; cmd: string; result: string };

// ===== ACC (dashboards) =====

export type PaloAccTopApp = { name: string; sessions: number; bytes: string; risk: number };
export type PaloAccTopSource = { ip: string; sessions: number; bytes: string };
export type PaloAccTopDestination = { ip: string; sessions: number; bytes: string; country: string };
export type PaloAccThreatCategory = { cat: string; count: number };
export type PaloAccTopUrlBlocked = { cat: string; count: number };

export type PaloAcc = {
  topApps: PaloAccTopApp[];
  topSources: PaloAccTopSource[];
  topDestinations: PaloAccTopDestination[];
  threatsByCategory: PaloAccThreatCategory[];
  topUrlBlocked: PaloAccTopUrlBlocked[];
};

// ===== Canonical roster =====

export type PaloCanonicalDevice = { name: string; vendor: string; mgmtIp?: string; site?: string };
export type PaloTenant = { name: string; domain: string };
export type PaloVpnUser = { upn: string; displayName: string; group: string; dept: string };

export type PaloUrlCategoryGroup = { group: string; items: string[] };

// ===== Root state =====

export type PaloState = {
  device: PaloDevice;
  interfaces: PaloInterface[];
  zones: PaloZone[];
  virtualRouters: PaloVirtualRouter[];
  vlans: PaloVlan[];

  addresses: PaloAddress[];
  addressGroups: PaloAddressGroup[];
  services: PaloService[];
  serviceGroups: PaloServiceGroup[];
  applications: PaloApplication[];
  applicationGroups: PaloApplicationGroup[];
  applicationFilters: PaloApplicationFilter[];
  tags: PaloTag[];

  avProfiles: PaloAvProfile[];
  asProfiles: PaloAsProfile[];
  vpProfiles: PaloVpProfile[];
  urlProfiles: PaloUrlProfile[];
  fileProfiles: PaloFileProfile[];
  wildfireProfiles: PaloWildfireProfile[];
  dataProfiles: PaloDataProfile[];
  profileGroups: PaloProfileGroup[];

  securityPolicies: PaloSecurityPolicy[];
  natPolicies: PaloNatPolicy[];
  decryptionPolicies: PaloDecryptionPolicy[];
  authPolicies: PaloAuthPolicy[];

  ipsecTunnels: PaloIpsecTunnel[];
  ikeGateways: PaloIkeGateway[];
  ikeCrypto: PaloIkeCrypto[];
  ipsecCrypto: PaloIpsecCrypto[];
  globalProtect: PaloGlobalProtect;

  authProfiles: PaloAuthProfile[];
  authSequence: PaloAuthSequence[];
  localUsers: PaloLocalUser[];
  userGroups: PaloUserGroup[];

  administrators: PaloAdministrator[];
  certificates: PaloCertificate[];
  serverProfiles: PaloServerProfiles;
  logForwarding: PaloLogForwardingProfile[];
  highAvailability: PaloHighAvailability;

  trafficLogs: PaloTrafficLogEntry[];
  threatLogs: PaloThreatLogEntry[];
  urlLogs: PaloUrlLogEntry[];
  wildfireSubmissions: PaloWildfireEntry[];
  systemLogs: PaloSystemLogEntry[];
  configLogs: PaloConfigLogEntry[];

  acc: PaloAcc;

  canonicalPalos: PaloCanonicalDevice[];
  canonicalSites: unknown;
  tenant: PaloTenant;
  vpnUsers: PaloVpnUser[];
};
