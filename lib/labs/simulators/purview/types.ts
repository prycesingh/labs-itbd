export type PurviewTenant = { name: string; domain: string; primaryDomain: string; tenantId: string; complianceScore: number; scoreMax: number };

// ===== Sensitivity labels / Information protection =====

export type PurviewSensitivityLabel = {
  id: string;
  name: string;
  order: number;
  color: string;
  scope: string;
  encryption: boolean;
  marking: string;
  autoLabel: boolean;
  parent: string | null;
  createdOn: string;
  description: string;
};

export type PurviewLabelPolicy = {
  id: string;
  name: string;
  publishedTo: string;
  labels: string[];
  defaultLabel: string;
  requireJustification: boolean;
  mandatory: boolean;
  modified: string;
};

export type PurviewAutoLabelPolicy = {
  id: string;
  name: string;
  label: string;
  locations: string;
  condition: string;
  mode: "Simulation" | "On" | "Off";
  matches: number;
  modified: string;
};

// ===== DLP =====

export type PurviewDlpRule = { name: string; priority: number; conditions: string; actions: string; severity: "High" | "Medium" | "Low" };

export type PurviewDlpPolicy = {
  id: string;
  name: string;
  description: string;
  locations: string[];
  template: string;
  status: "Active" | "Disabled";
  runMode: "On" | "Test" | "Test+notify";
  lastModified: string;
  createdBy: string;
  rules: PurviewDlpRule[];
};

// ===== Retention / records management =====

export type PurviewRetentionPolicy = {
  id: string;
  name: string;
  type: "Policy" | "Label";
  locations: string[];
  action: string;
  duration: string;
  start: string;
  status: "On" | "Test" | "Off";
  modified: string;
  createdOn: string;
  regulatory: boolean;
};

export type PurviewRecordsPlan = { id: string; name: string; labels: number; regulatory: boolean; custodian: string };

export type PurviewDispositionStatus = "Pending" | "Approved" | "Relabeled" | "Extended";
export type PurviewDispositionItem = {
  id: string;
  item: string;
  label: string;
  location: string;
  dueOn: string;
  status: PurviewDispositionStatus;
  reviewedBy?: string;
  reviewedOn?: string;
};

export type PurviewAdaptiveScope = {
  id: string;
  name: string;
  type: "User" | "Site" | "Microsoft 365 Group";
  attribute: string;
  operator: "Equals" | "Contains" | "Not equals";
  value: string;
  matchedCount: number;
};

// ===== eDiscovery =====

export type PurviewCustodian = { upn: string; sources: string[]; status: string };
export type PurviewHold = { name: string; locations: string; placed: string; itemCount: number; status: "On" | "Off" };
export type PurviewSearch = { id: string; name: string; query: string; locations: string; dateRange: string; items: number; sizeMB: number };
export type PurviewExport = { id: string; name: string; status: "Completed" | "Running" | "Failed"; sizeMB: number; items: number; exportKey: string; exportedOn: string };
export type PurviewNotification = { id: string; subject: string; to: string; sentOn: string; status: string };

export type PurviewEDiscoveryCase = {
  id: string;
  name: string;
  tier: "Standard" | "Premium";
  status: "Active" | "Closing" | "Closed";
  caseNumber: string;
  createdBy: string;
  createdOn: string;
  investigators: string[];
  custodians: PurviewCustodian[];
  holds: PurviewHold[];
  searches: PurviewSearch[];
  exports: PurviewExport[];
  notifications: PurviewNotification[];
};

// ===== Audit =====

export type PurviewAuditEvent = {
  id: string;
  ts: string;
  user: string;
  activity: string;
  item: string;
  workload: string;
  ip: string;
  clientApp: string;
  result: "Success" | "Failure";
  details: { correlationId: string; sessionId: string; appId: string; siteUrl: string | null };
};

export type PurviewAuditSavedSearch = { id: string; name: string; query: string; range: string; createdOn: string };

export type PurviewContentSearchRow = {
  id: string;
  subject: string;
  sender: string;
  receivedOn: string;
  location: string;
  sizeKB: number;
  preview: string;
};

// ===== Communication compliance =====

export type PurviewCcPolicy = {
  id: string;
  name: string;
  template: string;
  scope: string;
  classifiers: string[];
  status: "Active" | "Disabled";
  matchesLast30d: number;
};

export type PurviewCcAlert = {
  id: string;
  policyId: string;
  severity: "High" | "Medium" | "Low";
  status: "New" | "In review" | "Resolved" | "Escalated";
  user: string;
  hits: string;
  detectedOn: string;
  reviewer: string | null;
  notes: { id: string; author: string; text: string; time: string }[];
};

export type PurviewClassifier = { id: string; name: string; category: string; description: string };

// ===== Insider risk management =====

export type PurviewIrmIndicator = { id: string; name: string; group: "Office" | "Device" | "Defender for Cloud Apps" | "Risk score booster"; weight: number };

export type PurviewIrmPolicy = {
  id: string;
  name: string;
  template: string;
  priority: "Users with elevated risk" | "Standard";
  usersInScope: number;
  alertsLast90d: number;
  status: "Active" | "Disabled";
  indicatorIds: string[];
};

export type PurviewIrmCase = {
  id: string;
  policyId: string;
  upn: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  status: "Active" | "Resolved" | "Escalated to investigation";
  openedOn: string;
  realNameRevealed: boolean;
  triggeredIndicatorIds: string[];
  history: { id: string; time: string; label: string }[];
  notes: { id: string; author: string; text: string; time: string }[];
};

// ===== Compliance Manager =====

export type PurviewControlStatus = "Not started" | "In progress" | "Implemented" | "Not applicable";

export type PurviewControl = {
  id: string;
  title: string;
  status: PurviewControlStatus;
  points: number;
  owner: string;
  testDate: string | null;
};

export type PurviewAssessment = {
  id: string;
  name: string;
  template: string;
  category: string;
  controls: PurviewControl[];
};

export type PurviewImprovementAction = {
  id: string;
  title: string;
  points: number;
  status: "Not started" | "In progress" | "Completed";
  category: string;
  assignee?: string;
  dueOn?: string;
};

export type PurviewComplianceScore = { achievedPoints: number; possiblePoints: number; percentage: number };

// ===== Data Map / Data Governance =====

export type PurviewDataSource = {
  id: string;
  name: string;
  kind: string;
  assets: number;
  classifiedAssets: number;
  sensitiveTypes: number;
  lastScan: string;
  status: "Registered" | "Scanning" | "Scan failed";
};

export type PurviewScanJob = { id: string; sourceId: string; name: string; schedule: string; lastRun: string; duration: string; status: "Succeeded" | "Running" | "Failed" };

export type PurviewClassificationType = { id: string; name: string; category: string; builtIn: boolean; pattern?: string };

export type PurviewGlossaryTerm = { id: string; name: string; definition: string; steward: string; status: "Draft" | "Approved"; linkedAssets: number };

// ===== Root state =====

export type PurviewState = {
  tenant: PurviewTenant;
  sensitivityLabels: PurviewSensitivityLabel[];
  labelPolicies: PurviewLabelPolicy[];
  autoLabelingPolicies: PurviewAutoLabelPolicy[];
  dlpPolicies: PurviewDlpPolicy[];
  dlpTemplates: string[];
  sitTypes: string[];
  retention: PurviewRetentionPolicy[];
  recordsPlans: PurviewRecordsPlan[];
  dispositionQueue: PurviewDispositionItem[];
  adaptiveScopes: PurviewAdaptiveScope[];
  ediscoveryCases: PurviewEDiscoveryCase[];
  auditEvents: PurviewAuditEvent[];
  auditSavedSearches: PurviewAuditSavedSearch[];
  contentSearch: PurviewContentSearchRow[];
  ccPolicies: PurviewCcPolicy[];
  ccAlerts: PurviewCcAlert[];
  classifiers: PurviewClassifier[];
  irmIndicators: PurviewIrmIndicator[];
  irmPolicies: PurviewIrmPolicy[];
  irmCases: PurviewIrmCase[];
  complianceAssessments: PurviewAssessment[];
  complianceActions: PurviewImprovementAction[];
  dataSources: PurviewDataSource[];
  scanJobs: PurviewScanJob[];
  classificationTypes: PurviewClassificationType[];
  glossaryTerms: PurviewGlossaryTerm[];
  users: { userPrincipalName: string; displayName: string; department: string; jobTitle: string; adminRole: string | null }[];
  devices: { name: string; owner: string; os: string; kind: string }[];
  activityLog: { timestamp: string; actor: string; action: string; target: string; status: "Succeeded" | "Failed" }[];
};
