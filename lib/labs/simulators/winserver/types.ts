export type WsServer = {
  name: string;
  fqdn: string;
  os: string;
  build: string;
  domain: string;
  workgroup: string;
  ip: string;
  gateway: string;
  dns: string[];
  roles: string[];
  features: string[];
  memoryGB: number;
  cpu: string;
  uptime: string;
  firewall: { domain: string; private: string; public: string };
  rdp: string;
  remoteMgmt: string;
  timezone: string;
  lastUpdated: string;
  ieEsc: string;
  customerExperience: string;
};

export type WsVmState = "Running" | "Off" | "Paused" | "Saved";

export type WsVmCheckpoint = { id: string; name: string; created: string; parent: string | null };
export type WsVmDisk = { ctrl: string; lun: number; path: string; sizeGB: number };
export type WsVmNetwork = { switch: string; vlan: number; macSpoofing: boolean; macAddress: string };
export type WsVmReplication = { enabled: boolean; replicaServer?: string; frequencySec?: number; healthState?: string };

export type WsVm = {
  id: string;
  name: string;
  os: string;
  generation: 1 | 2;
  state: WsVmState;
  cpuUsage: string;
  memoryAssigned: number;
  memoryStartup: number;
  memoryDynamic: boolean;
  memoryMin: number;
  memoryMax: number;
  memoryWeight: "Low" | "Medium" | "High";
  vCpus: number;
  uptime: string;
  status: string;
  secureBoot: boolean;
  tpmEnabled: boolean;
  integrationServices: string;
  checkpoints: WsVmCheckpoint[];
  checkpointType: "Production" | "Standard";
  disks: WsVmDisk[];
  network: WsVmNetwork;
  dvd: { path: string };
  replication: WsVmReplication;
  autoStart: string;
  autoStop: string;
  smartPaging: string;
  notes: string;
  lastMoved?: string[];
};

export type WsSwitch = { name: string; type: "External" | "Internal" | "Private"; nic?: string; shareMgmtOs?: boolean; vlanId: number };
export type WsVhd = { path: string; format: "VHD" | "VHDX"; type: "Fixed" | "Dynamic" | "Differencing"; sizeGB: number; used: number };

export type WsHyperV = {
  host: {
    name: string;
    defaultVmFolder: string;
    defaultVhdFolder: string;
    liveMigrationEnabled: boolean;
    maxLiveMigrations: number;
    storageMigrations: number;
    numaSpanning: boolean;
    enhancedSession: boolean;
    replicationEnabled: boolean;
  };
  vms: WsVm[];
  switches: WsSwitch[];
  vhds: WsVhd[];
  isoLibrary: string[];
};

export type WsVolume = { letter: string; label: string; capacityGB: number; freeGB: number; fileSystem: "NTFS" | "ReFS" | "FAT32"; dedup: boolean; allocationKB: number };
export type WsDisk = { num: number; status: string; capacityGB: number; partitions: number; bus: string; model: string; mbr: string };
export type WsSharePerm = { principal: string; access: "Read" | "Modify" | "Full Control" };
export type WsShare = {
  name: string;
  path: string;
  type: "SMB" | "NFS";
  remote: string;
  perms: WsSharePerm[];
  abe: boolean;
  caching: boolean;
  encrypt: boolean;
  ca: boolean;
  quotaGB: number;
  sizeGB: number;
};
export type WsIscsiTarget = { name: string; status: "Connected" | "Idle"; initiators: string[]; luns: number };
export type WsVirtualDisk = { name: string; resiliency: "Mirror" | "Parity" | "Simple"; sizeTB: number; used: string; status: string };
export type WsStoragePool = { name: string; status: string; physicalDisks: number; capacityTB: number; freeTB: number; virtualDisks: WsVirtualDisk[] };
export type WsQuota = { path: string; sizeGB: number; kind: "Hard" | "Soft"; used: number; notify: number[] };
export type WsFileScreen = { path: string; screen: string; extensions: string[]; type: "Active" | "Passive" };

export type WsFileshare = {
  volumes: WsVolume[];
  disks: WsDisk[];
  shares: WsShare[];
  iscsiTargets: WsIscsiTarget[];
  storagePools: WsStoragePool[];
  quotas: WsQuota[];
  fileScreens: WsFileScreen[];
};

export type WsDhcpExclusion = { start: string; end: string };
export type WsDhcpScope = {
  id: string;
  name: string;
  subnet: string;
  mask: string;
  cidr: number;
  startIp: string;
  endIp: string;
  exclusions: WsDhcpExclusion[];
  leaseDays: number;
  leaseHours: number;
  leaseMinutes: number;
  active: boolean;
  description: string;
  options: Record<string, string>;
};
export type WsDhcpLease = { scopeId: string; ip: string; mac: string; name: string; lease: string; expires: string; vendor: string; userClass: string };
export type WsDhcpReservation = { scopeId: string; ip: string; mac: string; name: string; description: string; type: "Both" | "DHCP" | "BOOTP" };
export type WsDhcpPolicy = {
  name: string;
  scopeId: string;
  conditions: { type: string; op: string; value: string }[];
  actions: { ipRange: string; options: Record<string, string> };
  enabled: boolean;
};
export type WsDhcpFilters = { allow: { mac: string; description: string }[]; deny: { mac: string; description: string }[] };

export type WsDhcp = {
  serverFqdn: string;
  authorized: boolean;
  scopes: WsDhcpScope[];
  serverOptions: Record<string, string>;
  leases: WsDhcpLease[];
  reservations: WsDhcpReservation[];
  policies: WsDhcpPolicy[];
  filters: WsDhcpFilters;
};

export type WsUpdate = {
  id: string;
  title: string;
  classification: string;
  product: string;
  severity: string;
  released: string;
  approval: string;
  groups: string[];
  installedPct: number;
  neededPct: number;
  failedPct: number;
  size: string;
  msrcSeverity: string;
  supersedes: string;
  kbArticles: string[];
};
export type WsUpdateProduct = { name: string; selected: boolean; parent: string };
export type WsUpdateClassification = { name: string; selected: boolean };
export type WsComputerGroup = { name: string; protected: boolean };
export type WsWsusComputer = {
  name: string;
  ip: string;
  os: string;
  lastReport: string;
  group: string;
  status: string;
  installedPct: number;
  neededPct: number;
  failedPct: number;
};
export type WsSyncHistoryEntry = { started: string; finished: string; result: string; newUpdates: number };
export type WsAutoApproveRule = { rule: string; classifications: string[]; groups: string[]; enabled: boolean };

export type WsWsus = {
  server: string;
  version: string;
  lastSync: string;
  nextSync: string;
  syncSchedule: { mode: "Manual" | "Daily"; time: string; perDay: number };
  updateSource: { mode: "Microsoft Update" | "Upstream server"; upstreamServer: string; useSsl: boolean };
  proxyServer: { enabled: boolean; host: string; port: number };
  products: WsUpdateProduct[];
  classifications: WsUpdateClassification[];
  computerGroups: WsComputerGroup[];
  updates: WsUpdate[];
  computers: WsWsusComputer[];
  syncHistory: WsSyncHistoryEntry[];
  emailNotifications: { enabled: boolean; smtpHost: string; smtpPort: number; recipients: string };
  updateFiles: { storeLocally: boolean; expressInstallation: boolean; languagesAll: boolean; languages: string[] };
  autoApprove: WsAutoApproveRule[];
};

export type WsCertStatus = "Issued" | "Revoked" | "Pending" | "Failed";
export type WsCert = {
  reqId: number;
  requester: string;
  certHash: string;
  template: string;
  effective: string;
  expiration: string;
  cn: string;
  email: string;
  serial: string;
  dn: string;
  status: WsCertStatus;
  revokeReason?: string;
};
export type WsCertTemplate = {
  name: string;
  schemaVersion: number;
  validityDays: number;
  renewalDays: number;
  publishToAd: boolean;
  managerApproval: boolean;
  minKeySize: number;
};
export type WsAdcs = {
  caName: string;
  caFqdn: string;
  serviceStatus: "Running" | "Stopped";
  certs: WsCert[];
  templates: WsCertTemplate[];
  enrollmentAgents: string[];
  crl: { lastBasePublish: string; lastDeltaPublish: string; intervalHours: number };
};

export type WsClusterRole = {
  name: string;
  status: "Running" | "Stopped" | "Failed";
  type: string;
  ownerNode: string;
  priority: "High" | "Medium" | "Low";
  autoStart: boolean;
};
export type WsClusterNode = { name: string; status: "Up" | "Down" | "Paused"; site: string; uptime: string; os: string };
export type WsClusterDisk = { name: string; status: string; owner: string; capacityGB: number; freeGB: number; pool: string; role: string };
export type WsClusterPool = { name: string; disks: number; capacityTB: number };
export type WsClusterNetwork = { name: string; subnets: string[]; role: "Cluster and Client" | "Cluster Only" | "Disabled"; state: string };
export type WsClusterEvent = { level: "Information" | "Warning" | "Error" | "Critical"; time: string; id: string; source: string; summary: string };

export type WsFailover = {
  clusterName: string;
  clusterFqdn: string;
  quorumType: string;
  roles: WsClusterRole[];
  nodes: WsClusterNode[];
  disks: WsClusterDisk[];
  pools: WsClusterPool[];
  networks: WsClusterNetwork[];
  events: WsClusterEvent[];
};

export type WsRrasInterface = { name: string; type: "Internal" | "LAN" | "Demand-dial"; status: string; ip: string; mask: string; description: string };
export type WsRoute = { destination: string; mask: string; gateway: string; interfaceName: string; metric: number };
export type WsNatMapping = { protocol: "TCP" | "UDP"; publicPort: number; privateAddr: string; privatePort: number; description: string };
export type WsVpnConnection = { user: string; ip: string; protocol: string; duration: string; bytesIn: number; bytesOut: number; connectedAt: string };

export type WsRras = {
  enabled: boolean;
  interfaces: WsRrasInterface[];
  routesV4: WsRoute[];
  routesV6: WsRoute[];
  nat: { enabled: boolean; publicInterface: string; privateInterface: string; addressPool: string; mappings: WsNatMapping[] };
  dhcpRelay: { serverIps: string[]; interfaces: string[]; bootThreshold: number; maxHops: number };
  logging: { localFile: boolean; path: string; mode: "Windows Accounting" | "RADIUS" };
  vpnClients: WsVpnConnection[];
};

export type WsPrintJob = { id: string; document: string; pages: number; sizeKB: number; status: string; owner: string; submitted: string };
export type WsPrinter = {
  name: string;
  status: "Ready" | "Printing" | "Paused" | "Toner Low" | "Out of Paper" | "Offline";
  jobsCount: number;
  driver: string;
  port: string;
  shareName: string;
  location: string;
  comments: string;
  color: boolean;
  deployedGpo?: string;
  jobs: WsPrintJob[];
};
export type WsPrintDriver = { provider: string; name: string; environment: string; infPath: string };
export type WsPrintForm = { name: string; widthMm: number; heightMm: number; builtIn: boolean };
export type WsPrintPort = { name: string; description: string; type: "Local" | "WSD" | "TCP/IP" | "LPR" };

export type WsPrintserver = {
  printers: WsPrinter[];
  drivers: WsPrintDriver[];
  forms: WsPrintForm[];
  ports: WsPrintPort[];
};

export type WsActivityEntry = { time: string; action: string; target: string; detail: string };

export type WinServerState = {
  server: WsServer;
  hyperv: WsHyperV;
  fileshare: WsFileshare;
  dhcp: WsDhcp;
  wsus: WsWsus;
  adcs: WsAdcs;
  failover: WsFailover;
  rras: WsRras;
  printserver: WsPrintserver;
  activity: WsActivityEntry[];
};
