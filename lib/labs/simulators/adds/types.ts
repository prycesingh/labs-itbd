export type AddsUser = {
  sAMAccountName: string;
  upn: string;
  name: string;
  givenName: string;
  surname: string;
  initials: string;
  displayName: string;
  email: string;
  department: string;
  title: string;
  manager: string;
  office: string;
  phone: string;
  mobile: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  description: string;
  memberOf: string[];
  enabled: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  cantChangePassword: boolean;
  neverExpires: boolean;
  passwordLastSet: string;
  lastLogon: string;
  created: string;
  ouPath: string;
  logonHours: string;
  logonTo: string;
  profilePath: string;
  loginScript: string;
  homeDir: string;
  homeDrive: string;
};

export type AddsGroupScope = "Domain local" | "Global" | "Universal";
export type AddsGroupCategory = "Security" | "Distribution";

export type AddsGroup = {
  name: string;
  scope: AddsGroupScope;
  category: AddsGroupCategory;
  description: string;
  members: string[];
  builtin: boolean;
  ouPath: string;
};

export type AddsComputer = {
  name: string;
  dnsName: string;
  os: string;
  osVersion: string;
  enabled: boolean;
  description: string;
  ouPath: string;
  lastLogon: string;
  servicePack: string;
};

export type AddsOu = {
  name: string;
  parent: string | null;
  description: string;
};

export type AddsBuiltInContainer = {
  name: string;
  type: string;
};

export type AddsGpoLink = {
  ou: string;
  enforced: boolean;
  enabled: boolean;
};

export type AddsGpo = {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  links: AddsGpoLink[];
  securityFiltering: string[];
  wmiFilter: string;
  created: string;
  modified: string;
  version: { user: number; computer: number };
  settings: Record<string, string>;
};

export type AddsDnsRecordType = "SOA" | "NS" | "A" | "AAAA" | "CNAME" | "MX" | "PTR" | "SRV" | "TXT";

export type AddsDnsRecord = {
  name: string;
  type: AddsDnsRecordType;
  data: string;
  timestamp: string;
};

export type AddsDnsZone = {
  name: string;
  type: "Primary" | "Secondary" | "Stub";
  direction: "Forward" | "Reverse";
  adIntegrated: boolean;
  replicationScope: string;
  dynamicUpdates: "Secure only" | "Secure and nonsecure" | "None";
  records: AddsDnsRecord[];
};

export type AddsDomainController = {
  name: string;
  os: string;
  site: string;
  ip: string;
  isGC: boolean;
  isPDC: boolean;
  roles: string[];
};

export type AddsDomain = {
  fqdn: string;
  netbios: string;
  forestFunctionalLevel: string;
  domainFunctionalLevel: string;
  forestRoot: string;
  schemaMaster: string;
  domainNamingMaster: string;
  pdcEmulator: string;
  ridMaster: string;
  infrastructureMaster: string;
};

export type AddsSite = {
  name: string;
  subnets: string[];
  description?: string;
  location?: string;
};

export type AddsSiteLink = {
  name: string;
  transport: "IP" | "SMTP";
  cost: number;
  interval: number;
  schedule: string;
  sitesContained: string[];
};

export type AddsSubnetObject = {
  prefix: string;
  site: string;
  location: string;
  description: string;
};

export type AddsConnectionObject = {
  id: string;
  name: string;
  owner: string;
  replicateFrom: string;
  transport: "IP" | "SMTP";
  schedule: string;
  enabled: boolean;
  auto: boolean;
};

export type AddsActivityEntry = {
  time: string;
  action: string;
  target: string;
  detail: string;
};

export type AddsGpoBackup = {
  id: string;
  gpoName: string;
  location: string;
  description: string;
  timestamp: string;
};

export type AddsWmiFilter = {
  name: string;
  description: string;
  query: string;
};

export type AddsRecycleBinItem = {
  id: string;
  kind: "User" | "Group" | "Computer" | "OU";
  name: string;
  deletedOn: string;
  deletedFrom: string;
  lastKnownParent: string;
  restored: boolean;
};

export type AddsPso = {
  name: string;
  precedence: number;
  minPasswordLength: number;
  maxPasswordAge: number;
  lockoutThreshold: number;
  appliesTo: string[];
};

export type AddsDcState = { usn: number; lastSync: string };

export type AddsReplicationEvent = {
  time: string;
  source: string;
  dest: string;
  message: string;
  level: "Information" | "Warning" | "Error";
};

export type AddsHealthCheckResult = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  fix: string;
  commands: string[];
};

export type AddsAadConnect = {
  syncIntervalMin: number;
  lastRun: string;
  nextRun: string;
  stagingMode: boolean;
  syncedObjects: number;
  pendingExports: number;
  connectors: {
    name: string;
    kind: "AD" | "EntraID";
    objectCount: number;
    lastFullImport: string;
    lastDeltaSync: string;
  }[];
};

export type AddsBitlockerRecord = {
  deviceName: string;
  driveLabel: string;
  recoveryKeyId: string;
  recoveryKey: string;
  lastBackup: string;
};

export type AddsRadiusClient = { name: string; ip: string; sharedSecretSet: boolean; vendor: string };
export type AddsNpsPolicy = { name: string; type: "Connection Request" | "Network Policy"; enabled: boolean; conditions: string; processingOrder: number };

export type AddsDhcpScope = {
  name: string;
  subnet: string;
  startRange: string;
  endRange: string;
  leaseDurationHours: number;
  leasesUsed: number;
  leasesTotal: number;
};

export type AddsToolsState = {
  laps: { enabled: boolean; passwordAgeDays: number; retrievals: { device: string; retrievedBy: string; time: string }[] };
  adcs: {
    caName: string;
    templates: { name: string; enrolleeSuppliesSubject: boolean; validityYears: number }[];
    issued: { template: string; subject: string; issued: string; expires: string }[];
  };
  dfsn: { namespaces: { name: string; type: "Domain-based" | "Stand-alone"; targets: string[] }[] };
  trusts: {
    forestFunctionalLevel: string;
    upnSuffixes: string[];
    relationships: { name: string; direction: "One-way: incoming" | "One-way: outgoing" | "Two-way"; type: string; sidFiltering: boolean; selectiveAuth: boolean }[];
  };
  adsi: { lastBrowsedContext: string };
  adfs: { federationServiceName: string; relyingParties: { name: string; identifier: string; enabled: boolean }[] };
  kerberos: { spns: { account: string; spn: string }[]; delegation: { account: string; type: "None" | "Unconstrained" | "Constrained"; services: string[] }[] };
  dhcp: { scopes: AddsDhcpScope[] };
  services: { name: string; status: "Running" | "Stopped"; startupType: "Automatic" | "Manual" | "Disabled" }[];
  taskScheduler: { name: string; status: "Ready" | "Running" | "Disabled"; lastRun: string; nextRun: string; trigger: string }[];
  firewall: { name: string; direction: "Inbound" | "Outbound"; action: "Allow" | "Block"; enabled: boolean; profile: string }[];
  nps: { clients: AddsRadiusClient[]; policies: AddsNpsPolicy[] };
  rras: {
    vpnServers: { name: string; type: string; status: "Running" | "Stopped" }[];
    routingInterfaces: { name: string; type: string; status: "Enabled" | "Disabled" }[];
  };
};

export type AddsState = {
  domain: AddsDomain;
  sites: AddsSite[];
  domainControllers: AddsDomainController[];
  ous: AddsOu[];
  builtInContainers: AddsBuiltInContainer[];
  users: AddsUser[];
  groups: AddsGroup[];
  computers: AddsComputer[];
  gpos: AddsGpo[];
  dnsZones: AddsDnsZone[];
  activity: AddsActivityEntry[];
  gpoBackups: AddsGpoBackup[];
  wmiFilters: AddsWmiFilter[];
  recycleBin: AddsRecycleBinItem[];
  recycleBinEnabled: boolean;
  psos: AddsPso[];
  siteLinks: AddsSiteLink[];
  subnetObjects: AddsSubnetObject[];
  connectionObjects: AddsConnectionObject[];
  dcState: Record<string, AddsDcState>;
  replicationEvents: AddsReplicationEvent[];
  aadConnect: AddsAadConnect;
  bitlocker: AddsBitlockerRecord[];
  tools: AddsToolsState;
};
