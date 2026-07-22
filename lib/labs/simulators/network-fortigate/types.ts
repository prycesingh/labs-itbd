export type FortiSystem = {
  hostname: string;
  serial: string;
  firmware: string;
  license: string;
  model: string;
  uptime: string;
  lastRebootReason: string;
  systemTime: string;
  timezone: string;
  cpu: number;
  memory: number;
  sessions: number;
  peakSessions: number;
  throughputIn: number;
  throughputOut: number;
  adminUser: string;
  operationMode: string;
  ha: string;
};

export type FortiAdminProfile = { name: string; scope: string; permissions: string };

export type FortiAdministrator = {
  name: string;
  profile: string;
  type: string;
  trustedHosts: string;
  twoFactor: string;
};

export type FortiInterface = {
  name: string;
  alias: string;
  type: "Physical" | "VLAN";
  members: string;
  role: "wan" | "lan" | "dmz" | "undefined";
  addrMode: "DHCP" | "Manual";
  ip: string;
  gw: string;
  admin: string;
  link: string;
  mac: string;
  mtu: number;
  speed: string;
  vlanId?: number;
  access: string[];
  dhcpServer: boolean;
  dhcpRange?: string;
  comments: string;
};

export type FortiZone = { name: string; interfaces: string; intrazone: "block" | "allow" };

export type FortiStaticRoute = {
  dst: string;
  gw: string;
  device: string;
  distance: number;
  priority: number;
  status: string;
  comments: string;
};

export type FortiPolicyRoute = {
  protocol: string;
  incoming: string;
  src: string;
  dst: string;
  service: string;
  action: string;
  gw: string;
  outDevice: string;
};

export type FortiAddress = { name: string; type: "subnet" | "fqdn"; value: string; iface: string; color: number; comment: string };

export type FortiAddressGroup = { name: string; members: string; comment: string };

export type FortiService = { name: string; protocol: string; port: string; category: string };

export type FortiServiceGroup = { name: string; members: string; comment: string };

export type FortiSchedule = { name: string; type: "Recurring" | "One-time"; days?: string; start: string; end: string };

export type FortiVip = {
  name: string;
  extIf: string;
  extIp: string;
  mappedIp: string;
  extPort: string;
  mappedPort: string;
  protocol: string;
  portForward: boolean;
  comment: string;
};

export type FortiIpPool = { name: string; type: string; extIp: string; arpReply: boolean; comment: string };

export type FortiPolicy = {
  id: number;
  name: string;
  from: string;
  to: string;
  src: string;
  dst: string;
  schedule: string;
  service: string;
  action: "accept" | "deny";
  nat: boolean;
  inspection: "flow" | "proxy";
  logTraffic: "all" | "utm";
  logViolation?: boolean;
  av: string;
  web: string;
  dns: string;
  app: string;
  ips: string;
  file: string;
  ssl: string;
  bytes: string;
  sessions: number;
  status: string;
  comments: string;
};

export type FortiAvProfile = {
  name: string;
  inspectionMode: "flow-based" | "proxy-based";
  protocols: string[];
  treatWinExeAsVirus: boolean;
  scanArchives: boolean;
  sandbox: boolean;
  quarantine: boolean;
  comment: string;
};

export type FortiWebFilterProfile = {
  name: string;
  mode: "flow-based" | "proxy-based";
  overrides: Record<string, string>;
  blockedSites?: string[];
  comment: string;
};

export type FortiIpsProfile = { name: string; sensors: string[]; action: string; logging: string; comment: string };

export type FortiAppControlProfile = { name: string; blocks: string[]; schedule?: string; comment: string };

export type FortiSslProfile = { name: string; mode: string; comment: string };

export type FortiDnsFilterProfile = {
  name: string;
  fortiguard: boolean;
  externalIp: string;
  safeSearch: boolean;
  blockedCats?: string[];
  comment: string;
};

export type FortiFileFilterProfile = { name: string; blockTypes: string[]; comment: string };

export type FortiDlpProfile = { name: string; sensors: string[]; action: string; comment: string };

export type FortiWafProfile = { name: string; signatures: string; extended: boolean; comment: string };

export type FortiIpsecPhase1 = { encryption: string; hash: string; dh: string; lifetime: number };
export type FortiIpsecPhase2 = { encryption: string; hash: string; pfs: boolean; lifetime: number };

export type FortiIpsecTunnel = {
  name: string;
  remoteGw: string;
  auth: string;
  ike: string;
  phase1: FortiIpsecPhase1;
  phase2: FortiIpsecPhase2;
  localSubnet: string;
  remoteSubnet: string;
  status: string;
  uptime: string;
  bytesIn: string;
  bytesOut: string;
};

export type FortiSslVpnPortal = {
  name: string;
  webMode: boolean;
  tunnelMode: boolean;
  splitTunnel: boolean;
  dnsServer?: string;
  userGroups: string;
  comment: string;
};

export type FortiSslVpnSettings = {
  listenInterface: string;
  listenPort: number;
  idleTimeout: number;
  tlsVersion: string;
  serverCert: string;
  tunnelIpPool: string;
};

export type FortiLocalUser = {
  name: string;
  enabled: boolean;
  twoFactor: string;
  email: string;
  group: string;
  comment: string;
};

export type FortiUserGroup = { name: string; type: "Firewall" | "Guest"; members: string; comment: string };

export type FortiLdapServer = {
  name: string;
  server: string;
  port: number;
  baseDn: string;
  bindDn: string;
  secure: string;
  comment: string;
};

export type FortiRadiusServer = { name: string; server: string; port: number; secret: string; auth: string; comment: string };

export type FortiForwardLogEntry = {
  date: string;
  time: string;
  src: string;
  dst: string;
  srcPort: number;
  dstPort: number;
  proto: "TCP" | "UDP";
  app: string;
  action: "accept" | "deny" | "start" | "close" | "dns";
  policy: string;
  sent: string;
  received: string;
};

export type FortiEventLogEntry = { date: string; time: string; type: string; level: string; msg: string };

export type FortiCanonicalDevice = { name: string; vendor: string; mgmtIp?: string; site?: string };
export type FortiTenant = { name: string; domain: string };
export type FortiVpnUser = { upn: string; displayName: string; group: string };

export type FortiWebCategoryGroup = { group: string; items: string[] };

// ===== Root state =====

export type FortiGateState = {
  system: FortiSystem;
  adminProfiles: FortiAdminProfile[];
  administrators: FortiAdministrator[];
  interfaces: FortiInterface[];
  zones: FortiZone[];
  staticRoutes: FortiStaticRoute[];
  policyRoutes: FortiPolicyRoute[];
  addresses: FortiAddress[];
  addressGroups: FortiAddressGroup[];
  services: FortiService[];
  serviceGroups: FortiServiceGroup[];
  schedules: FortiSchedule[];
  vips: FortiVip[];
  ipPools: FortiIpPool[];
  policies: FortiPolicy[];
  avProfiles: FortiAvProfile[];
  webFilterProfiles: FortiWebFilterProfile[];
  ipsProfiles: FortiIpsProfile[];
  appControlProfiles: FortiAppControlProfile[];
  sslProfiles: FortiSslProfile[];
  dnsFilterProfiles: FortiDnsFilterProfile[];
  fileFilterProfiles: FortiFileFilterProfile[];
  dlpProfiles: FortiDlpProfile[];
  wafProfiles: FortiWafProfile[];
  ipsecTunnels: FortiIpsecTunnel[];
  sslVpnPortals: FortiSslVpnPortal[];
  sslVpnSettings: FortiSslVpnSettings;
  localUsers: FortiLocalUser[];
  userGroups: FortiUserGroup[];
  ldapServers: FortiLdapServer[];
  radiusServers: FortiRadiusServer[];
  forwardLogs: FortiForwardLogEntry[];
  eventLogs: FortiEventLogEntry[];
  canonicalFortigates: FortiCanonicalDevice[];
  canonicalSites: unknown;
  tenant: FortiTenant;
  vpnUsers: FortiVpnUser[];
};
