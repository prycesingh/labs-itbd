export type PpTenant = { name: string; domain: string; tenantId: string; region: string };

// ===== Connector catalog (static reference, not persisted per-user edits) =====

export type PpConnectorClass = "Business" | "Non-business" | "Blocked";
export type PpConnector = { id: string; name: string; publisher: string; def: PpConnectorClass; premium: boolean };

// ===== Environments =====

export type PpEnvironmentType = "Default" | "Production" | "Sandbox" | "Trial" | "Developer";
export type PpEnvironmentState = "Ready" | "Provisioning" | "Suspended";

export type PpEnvironmentUser = { upn: string; role: string };

export type PpEnvironment = {
  id: string;
  name: string;
  description: string;
  type: PpEnvironmentType;
  state: PpEnvironmentState;
  region: string;
  createdOn: string;
  createdBy: string;
  owner: string;
  url: string;
  dataverseEnabled: boolean;
  dataverseVersion: string;
  databaseSizeMB: number;
  capacityGB: number;
  language: string;
  currency: string;
  securityGroup: string | null;
  trialExpiresOn: string | null;
  users: PpEnvironmentUser[];
};

// ===== Apps =====

export type PpAppType = "Canvas" | "Model-driven";

export type PpApp = {
  id: string;
  name: string;
  type: PpAppType;
  owner: string;
  envId: string;
  created: string;
  modified: string;
  sharedCount: number;
  connectors: string[];
  dlpFlagged?: boolean;
  dlpFlagReason?: string;
};

// ===== Flows =====

export type PpFlowType = "Cloud" | "Desktop";
export type PpFlowStatus = "On" | "Off" | "Suspended";

export type PpFlow = {
  id: string;
  name: string;
  type: PpFlowType;
  owner: string;
  envId: string;
  status: PpFlowStatus;
  trigger: string;
  lastRun: string;
  total: number;
  success: number;
  failed: number;
  connectors: string[];
  dlpFlagged?: boolean;
  dlpFlagReason?: string;
};

// ===== Flow runs (real, persisted) =====

export type PpRunStepStatus = "Pending" | "Running" | "Succeeded" | "Failed" | "Skipped";
export type PpRunStep = { name: string; connectorId: string | null; status: PpRunStepStatus; startedAt: string | null; finishedAt: string | null; durationSec: number | null };

export type PpFlowRunStatus = "Running" | "Succeeded" | "Failed" | "Cancelled";

export type PpFlowRun = {
  id: string;
  flowId: string;
  status: PpFlowRunStatus;
  start: string;
  durationSec: number | null;
  output: string;
  steps: PpRunStep[];
};

// ===== DLP policies =====

export type PpPolicyType = "Default" | "Custom";
export type PpPolicyStatus = "On" | "Off";
export type PpPolicyScope = "Everyone" | "Specific environments" | "All except specific";

export type PpCustomRules = { blockPatterns: string[]; allowPatterns: string[] };

export type PpPolicy = {
  id: string;
  name: string;
  description: string;
  type: PpPolicyType;
  status: PpPolicyStatus;
  scope: PpPolicyScope;
  exceptionEnvs: string[];
  envIds: string[];
  createdBy: string;
  modified: string;
  business: string[];
  nonBusiness: string[];
  blocked: string[];
  customRules: PpCustomRules;
};

// ===== Capacity / licenses =====

export type PpCapacityBucket = { usedGB: number; totalGB: number };
export type PpCreditBucket = { usedCredits: number; totalCredits: number };
export type PpRunBucket = { used: number; total: number };

export type PpCapacity = {
  database: PpCapacityBucket;
  file: PpCapacityBucket;
  log: PpCapacityBucket;
  aiBuilder: PpCreditBucket;
  flowRuns: PpRunBucket;
};

export type PpLicense = { sku: string; name: string; purchased: number; assigned: number };

export type PpAuditEntry = { ts: string; actor: string; action: string; target: string; status: "Succeeded" | "Failed" };

export type PpMaker = { upn: string; displayName: string; department: string; appsOwned: number; flowsOwned: number; lastActive: string };

// ===== Power Pages sites =====

export type PpPagesSite = {
  id: string;
  name: string;
  envId: string;
  url: string;
  status: "Active" | "Inactive";
  createdOn: string;
  template: string;
  pageViews30d: number;
};

// ===== Power BI workspaces =====

export type PpBiWorkspace = { id: string; name: string; type: "Workspace" | "My workspace"; capacityUsedMB: number; reports: number; datasets: number; members: number };
export type PpBiTenantSettings = { exportEnabled: boolean; publishToWebEnabled: boolean; guestAccessEnabled: boolean };

// ===== Security (tenant isolation / lockbox / CMK) =====

export type PpIsolationSettings = { enabled: boolean; mode: "Allow" | "Block"; allowList: string[] };
export type PpLockboxRequest = { id: string; requestedBy: string; reason: string; requestedOn: string; status: "Pending" | "Approved" | "Denied" };
export type PpLockbox = { enabled: boolean; requests: PpLockboxRequest[] };
export type PpCmk = { enabled: boolean; keyVaultUri: string | null; status: "Not configured" | "Validating" | "Re-encrypting" | "Active" };

export type PpSecurity = { isolation: PpIsolationSettings; lockbox: PpLockbox; cmk: PpCmk };

// ===== Copilot Studio =====

export type PpCopilotBot = { id: string; name: string; envId: string; language: string; status: "Published" | "Draft"; sessions30d: number };
export type PpCopilotTopic = { id: string; name: string; trigger: string; nodeCount: number };
export type PpCopilotKnowledgeSource = { id: string; name: string; type: string; itemCount: number };
export type PpCopilotAction = { id: string; name: string; connectorId: string | null };
export type PpCopilotIntent = { id: string; name: string; keywords: string[]; response: string };

export type PpChatMessage = { id: string; from: "user" | "bot"; text: string; confidence?: number; ts: string };

export type PpCopilotState = {
  copilots: PpCopilotBot[];
  topics: PpCopilotTopic[];
  knowledge: PpCopilotKnowledgeSource[];
  actions: PpCopilotAction[];
  intents: PpCopilotIntent[];
  channels: { name: string; enabled: boolean }[];
  testChat: PpChatMessage[];
};

// ===== Root state =====

export type PpState = {
  tenant: PpTenant;
  connectors: PpConnector[];
  environments: PpEnvironment[];
  apps: PpApp[];
  flows: PpFlow[];
  flowRuns: PpFlowRun[];
  policies: PpPolicy[];
  capacity: PpCapacity;
  licenses: PpLicense[];
  auditLog: PpAuditEntry[];
  makers: PpMaker[];
  pagesSites: PpPagesSite[];
  powerBI: { workspaces: PpBiWorkspace[]; tenantSettings: PpBiTenantSettings };
  security: PpSecurity;
  copilot: PpCopilotState;
};
