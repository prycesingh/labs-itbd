export type SentinelWorkspace = {
  name: string;
  subscription: string;
  resourceGroup: string;
  region: string;
  created: string;
  dataRetention: string;
  dailyCapReservation: string;
  tenantName: string;
  tenantId: string;
  pricingTier: string;
  estimatedDailyGB: number;
  retentionDays: number;
  dailyCapGB: number;
  tableRetention: Record<string, number>;
  audit: { queryLogs: boolean; health: boolean };
};

export type SentinelSeverity = "High" | "Medium" | "Low" | "Informational";
export type SentinelIncidentStatus = "New" | "Active" | "Closed";

export type SentinelEntity = { name: string; type: string };

export type SentinelIncident = {
  id: string;
  title: string;
  severity: SentinelSeverity;
  status: SentinelIncidentStatus;
  owner: string;
  tactics: string[];
  techniques: string[];
  created: string;
  lastModified: string;
  alertsCount: number;
  entitiesCount: number;
  entities: SentinelEntity[];
  productNames: string[];
  comments: { id: string; author: string; text: string; time: string }[];
  rule: string;
};

export type SentinelRuleType = "Scheduled" | "NRT" | "Microsoft Security" | "Anomaly" | "ML Behavioral" | "Fusion";

export type SentinelRule = {
  id: string;
  name: string;
  type: SentinelRuleType;
  dataSource: string;
  tactics: string[];
  enabled: boolean;
  severity: SentinelSeverity;
  created: string;
  lastModified: string;
  version: string;
  lastTriggered: string;
  lookback: string;
  period: string;
  threshold: number;
  groupBy: string;
  automation: string | null;
  kql: string | null;
};

export type SentinelConnectorStatus = "Connected" | "Not connected";

export type SentinelConnector = {
  id: string;
  name: string;
  provider: "Microsoft" | "Amazon" | "Google" | "Other";
  status: SentinelConnectorStatus;
  dataTypes: string[];
  lastIngest: string;
  recordsLast24h: number;
  kind: string;
};

export type SentinelWorkbook = {
  id: string;
  name: string;
  publisher: string;
  dataSource: string;
  categories: string[];
  description: string;
  installed: boolean;
  version: string;
};

export type SentinelHuntingQuery = {
  id: string;
  name: string;
  description: string;
  tactics: string[];
  techniques: string[];
  dataSources: string[];
  provider: string;
  createdBy: string;
  query: string;
};

export type SentinelBookmark = { id: string; name: string; created: string; createdBy: string; tags: string[]; notes: string };

export type SentinelPlaybookStep = { type: "Trigger" | "Action" | "Condition" | "For each"; name: string; details: string };

export type SentinelPlaybook = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  state: "Enabled" | "Disabled";
  lastRun: string;
  runsTotal: number;
  runsSuccess: number;
  runsFailed: number;
  steps: SentinelPlaybookStep[];
};

export type SentinelAutomationRule = { id: string; name: string; order: number; trigger: string; action: string; enabled: boolean };

// ===== Watchlists (reconciled single model, CloudLab-roster-derived where real) =====

export type SentinelWatchlistItem = Record<string, string>;

export type SentinelWatchlist = {
  id: string;
  name: string;
  provider: string;
  itemCount: number;
  lastUpdated: string;
  description: string;
  content: SentinelWatchlistItem[];
  searchKey: string;
};

// ===== Threat Intelligence (single canonical model) =====

export type SentinelTiIndicatorType = "IP" | "Domain" | "URL" | "FileHash" | "Email";
export type SentinelTiConfidence = "High" | "Medium" | "Low";

export type SentinelTiIndicator = {
  id: string;
  type: SentinelTiIndicatorType;
  value: string;
  threatType: string;
  confidence: SentinelTiConfidence;
  source: string;
  firstSeen: string;
  lastSeen: string;
  tags: string[];
  active: boolean;
};

export type SentinelTiFeed = { id: string; name: string; provider: string; status: "Connected" | "Not connected"; indicatorCount: number; lastSync: string };

// ===== UEBA / MITRE / Notebooks =====

export type SentinelEntityRisk = {
  id: string;
  name: string;
  type: "User" | "Host";
  riskScore: number;
  insights: string[];
  baseline: string;
  lastActivity: string;
};

export type SentinelMitreTechnique = { id: string; name: string; tactic: string };

export type SentinelMitreTactic = {
  tactic: string;
  techniques: number;
  ourCoverage: number;
  alertsLast30d: number;
};

export type SentinelNotebook = { id: string; name: string; description: string; provider: string; lastRun: string };

// ===== Content Hub =====

export type SentinelSolutionComponents = { rules: number; workbooks: number; playbooks: number; huntingQueries: number };

export type SentinelSolution = {
  id: string;
  name: string;
  publisher: string;
  category: string;
  description: string;
  components: SentinelSolutionComponents;
};

export type SentinelInstalledSolution = {
  id: string;
  version: string;
  installedOn: string;
  components: { rules: string[]; workbooks: string[]; playbooks: string[]; huntingQueries: string[] };
};

// ===== Repositories =====

export type SentinelRepo = {
  id: string;
  name: string;
  source: "GitHub" | "Azure DevOps";
  org: string;
  repo: string;
  branch: string;
  folder: string;
  deployedRules: number;
  status: "Connected" | "Sync error";
  lastSync: string;
};

// ===== Logs =====

export type SentinelSavedQuery = { id: string; name: string; kql: string; createdBy: string; created: string };
export type SentinelQueryHistoryEntry = { kql: string; ranAt: string; rowCount: number };

// ===== Real KQL engine result shape =====

export type SentinelKqlResult = {
  kql: string;
  table: string | null;
  columns: string[];
  rows: Record<string, string | number>[];
  rowCount: number;
  scannedRows: number;
  durationMs: number;
  error?: string;
};

// ===== Users / devices (CloudLab-roster-themed, hardcoded inline per project convention) =====

export type SentinelUser = {
  userPrincipalName: string;
  displayName: string;
  department: string;
  title: string;
  adminRole: string | null;
  sensitiveAccount: boolean;
  objectId: string;
  sid: string;
  mfaEnrolled: boolean;
  accountEnabled: boolean;
};

export type SentinelDevice = { id: string; name: string; owner: string; os: string };

export type SentinelActivityEntry = { timestamp: string; actor: string; action: string; target: string; status: "Succeeded" | "Failed" };

// ===== Root state =====

export type SentinelState = {
  workspace: SentinelWorkspace;
  incidents: SentinelIncident[];
  rules: SentinelRule[];
  connectors: SentinelConnector[];
  workbooks: SentinelWorkbook[];
  huntingQueries: SentinelHuntingQuery[];
  bookmarks: SentinelBookmark[];
  playbooks: SentinelPlaybook[];
  automationRules: SentinelAutomationRule[];
  watchlists: SentinelWatchlist[];
  threatIntel: { indicators: SentinelTiIndicator[]; feeds: SentinelTiFeed[] };
  entityRisks: SentinelEntityRisk[];
  mitreTactics: SentinelMitreTactic[];
  notebooks: SentinelNotebook[];
  solutions: SentinelSolution[];
  installedSolutions: SentinelInstalledSolution[];
  repos: SentinelRepo[];
  savedQueries: SentinelSavedQuery[];
  queryHistory: SentinelQueryHistoryEntry[];
  users: SentinelUser[];
  devices: SentinelDevice[];
  activityLog: SentinelActivityEntry[];
  pinnedWorkbooks: string[];
};
