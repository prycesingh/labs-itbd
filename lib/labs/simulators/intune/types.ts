export type IntuneTenant = {
  name: string;
  domain: string;
  tenantId: string;
  country: string;
  adminEmail: string;
};

export type IntuneUser = {
  id: string;
  name: string;
  upn: string;
  department: string;
  licenses: string[];
};

export type IntuneGroup = {
  id: string;
  name: string;
  type: "Dynamic" | "Assigned";
  members: number;
  description: string;
};

export type IntunePlatform = "Windows" | "iOS" | "iPadOS" | "macOS" | "Android" | "Linux";
export type IntuneCompliance = "Compliant" | "Not compliant" | "In grace period" | "Not evaluated";
export type IntuneOwnership = "Corporate" | "Personal";
export type IntuneJoinType = "Entra joined" | "Entra hybrid joined" | "Entra registered";

export type IntuneDevice = {
  id: string;
  name: string;
  platform: IntunePlatform;
  os: string;
  osVersion: string;
  manufacturer: string;
  model: string;
  serial: string;
  primaryUser: string;
  ownership: IntuneOwnership;
  joinType: IntuneJoinType;
  managedBy: string;
  compliance: IntuneCompliance;
  encryption: string;
  lastCheckIn: string;
  enrollmentDate: string;
  imei: string;
  wifi: string;
  ram: string;
  storage: string;
  cpu: string;
  scanResult?: { type: "Quick" | "Full"; started: string; result: string };
  locate?: { lat: number; lng: number; when: string };
  bitlockerRotatedAt?: string;
};

export type IntuneCompliancePolicySettings = Record<string, string | number | boolean>;
export type IntuneCompliancePolicy = {
  id: string;
  name: string;
  platform: string;
  type: string;
  assigned: string;
  lastModified: string;
  settings: IntuneCompliancePolicySettings;
  nonComplianceActions: { action: string; scheduleDays: number }[];
};

export type IntuneConfigProfile = {
  id: string;
  name: string;
  platform: string;
  type: string;
  status: "Assigned" | "Not assigned";
  assigned: string;
  lastModified: string;
  settings: Record<string, string | number | boolean>;
};

export type IntuneAppAssignment = { groupId: string; intent: "Required" | "Available" | "Uninstall" | "Available without enrollment" };
export type IntuneApp = {
  id: string;
  name: string;
  type: string;
  platform: string;
  status: "Published" | "Not published";
  version: string;
  assignments: IntuneAppAssignment[];
  description: string;
};

export type IntuneCaPolicy = {
  id: string;
  name: string;
  state: "On" | "Off" | "Report-only";
  modified: string;
  users: { includeAll: boolean; exclude: string[] };
  apps: { includeAll: boolean; include?: string[]; exclude: string[] };
  conditions: { platforms: string; locations: string; clientApps: string };
  grant: { block: boolean; requireMfa: boolean; requireCompliant: boolean; requireHybrid: boolean; requireAppProtection: boolean };
};

export type IntuneAutopilotDevice = {
  id: string;
  serial: string;
  mfg: string;
  model: string;
  groupTag: string;
  profileStatus: "Assigned" | "Not assigned";
  assignedUser: string;
  dateAdded: string;
};

export type IntuneAutopilotProfile = {
  id: string;
  name: string;
  mode: "User-driven" | "Self-deploying" | "Pre-provisioning";
  joinType: IntuneJoinType;
  assigned: string;
  skipEula: boolean;
  hideAccountOptions: boolean;
  userAccountType: "Standard" | "Administrator";
  deviceNameTemplate: string;
};

export type IntuneActivityEntry = { time: string; action: string; target: string; detail: string };

export type IntuneState = {
  tenant: IntuneTenant;
  users: IntuneUser[];
  groups: IntuneGroup[];
  devices: IntuneDevice[];
  compliancePolicies: IntuneCompliancePolicy[];
  configProfiles: IntuneConfigProfile[];
  apps: IntuneApp[];
  autopilotDevices: IntuneAutopilotDevice[];
  autopilotProfiles: IntuneAutopilotProfile[];
  conditionalAccess: IntuneCaPolicy[];
  activityLog: IntuneActivityEntry[];
};
