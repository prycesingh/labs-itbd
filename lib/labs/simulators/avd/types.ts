export type AvdSubscription = { id: string; name: string; tenantId: string; tenantName: string };
export type AvdResourceGroup = { name: string; region: string };
export type AvdImage = { id: string; name: string; publisher: string; os: string };
export type AvdVmSize = { name: string; vcpus: number; ram: number; cost: number };

export type AvdHostPoolType = "Pooled" | "Personal";
export type AvdLoadBalancing = "Breadth-first" | "Depth-first" | "";
export type AvdAssignmentType = "Automatic" | "Direct" | "";

export type AvdHostPool = {
  id: string;
  name: string;
  resourceGroup: string;
  region: string;
  type: AvdHostPoolType;
  loadBalancing: AvdLoadBalancing;
  maxSessionLimit: number;
  assignmentType: AvdAssignmentType;
  validationEnvironment: boolean;
  startVmOnConnect: boolean;
  preferredAppGroupType: "Desktop" | "RemoteApp";
  agentVersion: string;
  customRdpProperty: string;
  description: string;
  scalingPlans: string[];
  azureStackHci: boolean;
  tags: Record<string, string>;
  createdAt: string;
  autoShutdown?: AvdAutoShutdown;
};

export type AvdSessionHostStatus = "Available" | "Unavailable" | "Shutdown" | "Upgrading";

export type AvdSessionHost = {
  id: string;
  name: string;
  hostPool: string;
  status: AvdSessionHostStatus;
  sessions: number;
  disconnectedSessions: number;
  allowNewSessions: boolean;
  agentVersion: string;
  os: string;
  lastHeartbeat: string;
  drainMode: boolean;
  vmSize: string;
  assignedUser?: string;
};

export type AvdRemoteApp = {
  name: string;
  displayName: string;
  source: "Start menu" | "File path";
  filePath: string;
  iconPath: string;
  iconIndex: number;
  description: string;
  showInWebFeed: boolean;
  requireCmdLine: boolean;
  cmdLineArgs: string;
};

export type AvdApplicationGroup = {
  id: string;
  name: string;
  type: "Desktop" | "RemoteApp";
  hostPool: string;
  resourceGroup: string;
  region: string;
  description: string;
  workspace: string | null;
  applications: AvdRemoteApp[];
  assignments: string[];
  tags: Record<string, string>;
};

export type AvdWorkspace = {
  id: string;
  name: string;
  friendlyName: string;
  description: string;
  resourceGroup: string;
  region: string;
  applicationGroups: string[];
  tags: Record<string, string>;
};

export type AvdSchedulePhaseRamp = { start: string; loadBalancing: AvdLoadBalancing; minHostsPct: number; capacityThresholdPct: number };
export type AvdSchedulePhasePeak = { start: string; loadBalancing: AvdLoadBalancing };
export type AvdSchedulePhaseRampDown = AvdSchedulePhaseRamp & { forceLogoffUsers: boolean; waitTimeMinutes: number };

export type AvdSchedule = {
  name: string;
  daysOfWeek: string[];
  rampUp: AvdSchedulePhaseRamp;
  peak: AvdSchedulePhasePeak;
  rampDown: AvdSchedulePhaseRampDown;
  offPeak: AvdSchedulePhasePeak;
};

export type AvdScalingPlan = {
  id: string;
  name: string;
  resourceGroup: string;
  region: string;
  timeZone: string;
  hostPoolType: AvdHostPoolType;
  exclusionTag: string;
  schedules: AvdSchedule[];
  hostPoolAssignments: string[];
  poolOverrides: Record<string, boolean>;
  enabled: boolean;
  tags: Record<string, string>;
};

export type AvdMsixPackageState = "Active" | "Inactive" | "Failed";

export type AvdMsixPackage = {
  id: string;
  packageName: string;
  packageFamilyName: string;
  displayName: string;
  displayVersion: string;
  version: string;
  publisher: string;
  publisherDisplayName: string;
  imagePath: string;
  logoPath: string;
  appVConfig: string;
  state: AvdMsixPackageState;
  hostPools: string[];
  appGroups: string[];
  userAssignments: string[];
  lastUpdated: string;
  isRegular: boolean;
  createdAt: string;
};

export type AvdAutoShutdown = {
  enabled: boolean;
  disconnectThresholdMin: number;
  idleThresholdMin: number;
  dailyShutdownTime: string;
  timezone: string;
  notifyBefore: boolean;
  notifyMinutes: number;
  notifyMessage: string;
  notifyToast: boolean;
  notifyEmail: boolean;
};

export type AvdFslogixConfig = {
  id: string;
  name: string;
  appliesTo: string;
  profileContainerPath: string;
  storageAccount: string;
  storageAccountResource: string;
  azureFilesShare: string;
  profileSizeGB: number;
  profileLockCheck: boolean;
  roamingOsPrefs: boolean;
  odfcEnabled: boolean;
  odfcPath: string;
  odfcIncludes: string[];
  authMethod: string;
  regKeys: {
    outlookCacheMode: boolean;
    oneDriveSync: boolean;
    teamsCache: boolean;
    edgeData: boolean;
    oneNoteCache: boolean;
  };
};

export type AvdImageTemplate = {
  id: string;
  name: string;
  source: string;
  customizations: string;
  lastBuilt: string;
  duration: string;
  status: "Succeeded" | "Running" | "Failed" | "Not run";
  destinationGallery: string;
  destinationImage: string;
  schedule: string;
  assignedHostPools: string[];
};

export type AvdUpdatePlan = {
  id: string;
  name: string;
  hostPool: string;
  stage: string;
  schedule: string;
  hosts: number;
  status: "Not started" | "Running" | "Completed" | "Failed";
  lastRun: string;
};

// Private Link sub-resource connection, one row per AVD Private Endpoint
// (global feed / per-workspace feed / per-host-pool connection). Deploy
// order matters: global first, then feed, then per-host-pool connection —
// see privateEndpoints seed data and the Private Link reference table.
export type AvdPrivateEndpointSubResource = "global" | "feed" | "connection";

export type AvdPrivateEndpoint = {
  id: string;
  resource: string;
  subResource: AvdPrivateEndpointSubResource;
  name: string;
  vnet: string;
  subnet: string;
  privateDnsZone: string;
  approvalStatus: "Approved" | "Pending" | "Rejected";
};

export type AvdUser = { upn: string; displayName: string; role: string; department: string };

export type AvdActivityEntry = { time: string; operation: string; resource: string; status: "Succeeded" | "Failed" };

export type AvdScalingLogEntry = { time: string; pool: string; event: "Started" | "Stopped" | "Drained" | "Skipped"; reason: string };

export type AvdState = {
  subscription: AvdSubscription;
  regions: string[];
  resourceGroups: AvdResourceGroup[];
  images: AvdImage[];
  vmSizes: AvdVmSize[];
  defaultCustomRdp: string;
  hostPools: AvdHostPool[];
  sessionHosts: AvdSessionHost[];
  applicationGroups: AvdApplicationGroup[];
  workspaces: AvdWorkspace[];
  scalingPlans: AvdScalingPlan[];
  msixPackages: AvdMsixPackage[];
  fslogixConfigs: AvdFslogixConfig[];
  imageTemplates: AvdImageTemplate[];
  updatePlans: AvdUpdatePlan[];
  privateEndpoints: AvdPrivateEndpoint[];
  users: AvdUser[];
  activityLog: AvdActivityEntry[];
  scalingLog: AvdScalingLogEntry[];
};
