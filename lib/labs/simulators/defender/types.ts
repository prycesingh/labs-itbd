export type DefenderTenant = { name: string; domain: string; primaryDomain: string; tenantId: string };

export type DefenderSeverity = "High" | "Medium" | "Low" | "Informational";
export type DefenderIncidentStatus = "Active" | "In progress" | "Resolved";

export type DefenderAttackStoryEvent = { ts: number; type: string; icon: string; title: string; detail: string };

export type DefenderEvidence = {
  files: { name: string; sha256: string; verdict: string; firstSeen: string }[];
  processes: { name: string; cmdLine: string; pid: number; account: string }[];
  ips: { addr: string; country: string; asn: string; reputation: string }[];
  urls: { url: string; verdict: string; category: string }[];
  mailboxes: { upn: string; deliveryAction: string; deliveryLocation: string }[];
};

export type DefenderIncident = {
  id: string;
  title: string;
  severity: DefenderSeverity;
  status: DefenderIncidentStatus;
  categories: string[];
  serviceSources: string[];
  investigationState: string;
  tags: string[];
  assignedTo: string;
  created: string;
  lastActivity: string;
  activeAlerts: number;
  totalAlerts: number;
  impactedDevices: number;
  impactedUsers: number;
  impactedMailboxes: number;
  mitreTactics: string[];
  attackStory: DefenderAttackStoryEvent[];
  evidence: DefenderEvidence;
  user?: string;
  device?: string;
  entities?: { type: string; value: string }[];
  comment?: string;
};

export type DefenderAlert = {
  id: string;
  title: string;
  severity: DefenderSeverity;
  status: "New" | "In progress" | "Resolved";
  category: string;
  serviceSource: string;
  incidentId: string;
  incidentTitle: string;
  detectionSource: string;
  firstActivity: string;
  lastActivity: string;
  impactedAssets: string;
  mitreTechnique: string;
};

export type DefenderInstalledSoftware = { name: string; version: string; vendor: string; vulns: number };
export type DefenderRecommendation = { title: string; impact: string; status: "Active" | "Completed" };

export type DefenderDevice = {
  id: string;
  name: string;
  domain: string;
  riskLevel: "Very High" | "High" | "Medium" | "Low" | "None";
  exposureLevel: "High" | "Medium" | "Low";
  os: string;
  healthState: "Active" | "Inactive" | "No sensor data";
  lastSeen: string;
  onboardedOn: string;
  tags: string[];
  managedBy: string;
  avStatus: string;
  firstSeen: string;
  ipAddress: string;
  publicIp: string;
  loggedOnUser: string;
  deviceType: "Workstation" | "Server";
  vulnerabilities: number;
  missingKbs: string[];
  installedSoftware: DefenderInstalledSoftware[];
  recommendations: DefenderRecommendation[];
};

export type DefenderIdentity = {
  id: string;
  displayName: string;
  username: string;
  upn: string;
  jobTitle: string;
  department: string;
  signInRisk: "High" | "Medium" | "Low" | "None";
  userRisk: "High" | "Medium" | "Low" | "None";
  mfaRegistered: boolean;
  mfaMethods: string[];
  riskySignIns: number;
  lastSignIn: string;
  lastRiskySignIn: string | null;
  isSensitive: boolean;
  privilegedRoles: string[];
};

export type DefenderSecureScoreAction = {
  id: string;
  title: string;
  category: "Identity" | "Devices" | "Apps" | "Data" | "Microsoft Defender for Cloud";
  impact: number;
  status: "Achieved" | "Not achieved" | "Risk accepted";
  userImpact: "Low" | "Moderate" | "High";
  implementation: string;
  regression: boolean;
};

export type DefenderSecureScore = {
  actions: DefenderSecureScoreAction[];
  currentScore: number;
  maxScore: number;
  percentage: number;
  history: { date: string; score: number }[];
  comparison: { similarOrgs: number; yourOrg: number };
};

export type DefenderEmailThreat = {
  id: string;
  subject: string;
  sender: string;
  senderIp: string;
  recipient: string;
  threatType: "Phish" | "Malware" | "BEC";
  deliveryAction: string;
  deliveryLocation: string;
  detectionTech: string;
  received: string;
  originalSize: string;
  hasAttachment: boolean;
  attachmentName: string | null;
  urls: string[];
  primaryOverride: string;
  authenticationResults: { spf: string; dkim: string; dmarc: string; compauth: string };
};

export type DefenderSubmission = {
  id: string;
  type: "Email" | "URL" | "File";
  submitter: string;
  submittedFor: string;
  date: string;
  status: "Completed" | "In progress";
  result: string;
};

export type DefenderThreatAnalytic = {
  id: string;
  name: string;
  severity: DefenderSeverity;
  category: "Activity profile" | "Threat actor" | "Vulnerability" | "Tool/Tech";
  exposureLevel: "High" | "Medium" | "Low";
  alertsCount: number;
  impactedAssets: number;
  lastUpdated: string;
};

export type DefenderVulnerability = {
  id: string;
  name: string;
  severity: "High" | "Medium";
  cvss: number;
  exposedDevices: number;
  threatActivity: "Active" | "None" | "Patched";
  age: number;
};

export type DefenderCampaign = {
  id: string;
  name: string;
  type: "Phish" | "Malware" | "BEC";
  messages: number;
  users: number;
  urls: number;
  status: "Active" | "Resolved";
  firstSeen: string;
  lastSeen: string;
};

export type DefenderActivityEntry = { timestamp: string; actor: string; action: string; target: string; status: "Succeeded" | "Failed" };

// ===== Advanced Hunting =====

export type DefenderHuntingQuery = { id: string; name: string; tactic: string; technique: string; kql: string };
export type DefenderDetectionSummaryCard = {
  name: string;
  frequency: string;
  period: string;
  threshold: string;
  severity: "High" | "Medium";
  mitre: string;
  state: "Active";
};
export type DefenderHuntingSchema = Record<string, string>;
export type DefenderScheduledHunt = { name: string; schedule: string; lastRun: string; lastResult: string; owner: string };

export type DefenderHuntResultRow = Record<string, string>;
export type DefenderHuntRun = { queryId: string; ranAt: string; rowCount: number; columns: string[]; rows: DefenderHuntResultRow[] };

// ===== Custom detection rules =====

export type DefenderCustomDetectionRule = {
  id: string;
  name: string;
  severity: "Informational" | "Low" | "Medium" | "High" | "Critical";
  status: "Active" | "Disabled";
  frequency: string;
  lastRun: string;
  lastResult: string;
  entities: string;
  mitre: string;
  kql: string;
  actions: string[];
  alertTitle: string;
  alertCategory: string;
  alertDescription: string;
  recommendedActions: string;
  scope: "All devices" | "Specific device groups";
  deviceGroups: string[];
};

// ===== Endpoints: asset inventory =====

export type DefenderAsset = {
  id: string;
  name: string;
  type: "IoT device" | "Network device" | "Unmanaged endpoint";
  vendor: string;
  ipAddress: string;
  category: string;
  onboarded: boolean;
  discoveredOn: string;
  classification?: string;
};

// ===== Identities / ITDR =====

export type DefenderPostureFinding = {
  id: string;
  area: "Identity hygiene" | "Privileged access" | "Authentication" | "Lateral movement" | "Network exposure" | "Data exposure" | "Detection coverage";
  severity: "Critical" | "High" | "Medium";
  title: string;
  affected: string;
  recommendation: string;
  status: "Open" | "In progress";
};

export type DefenderLmpNode = { type: "group" | "host" | "creds" | "user"; name: string; icon: string; detail: string };
export type DefenderLateralMovementPath = {
  id: string;
  target: string;
  riskScore: number;
  hops: number;
  description: string;
  path: DefenderLmpNode[];
};

export type DefenderSensitiveAccount = {
  upn: string;
  tier: "Tier-0" | "Tier-1" | "Tier-2";
  role: string;
  lastSignIn: string;
  mfaMethods: string;
  riskLevel: "None" | "Low" | "Medium" | "High";
};

export type DefenderHoneyToken = {
  id: string;
  name: string;
  type: "User" | "Document";
  created: string;
  triggers: number;
  lastTrigger: string;
  placedIn: string;
};

// ===== Cloud Apps =====

export type DefenderDiscoveredApp = {
  name: string;
  cat: string;
  users: number;
  trafficMB: number;
  risk: number;
  tag: "Sanctioned" | "Monitored" | "Unsanctioned" | "Block";
  publisherVerified: boolean;
  compliance: string;
};

export type DefenderOAuthApp = {
  id: string;
  name: string;
  publisher: string;
  publisherVerified: boolean;
  consentType: string;
  permissions: string[];
  permissionTier: "Low" | "Medium" | "High" | "High risk" | "Critical";
  consentedDate: string;
  firstUser: string;
  risk: number;
  verdict: "Approved" | "Investigate" | "Block";
  note: string;
};

export type DefenderConnector = { name: string; status: "Connected" | "Disconnected"; authMode: string; lastSync: string; scopes: string };
export type DefenderSessionPolicy = { id: string; name: string; state: "Active" | "Report-only"; appliesTo: string; signals: string; action: string };

// ===== Email policies =====

export type DefenderAntiPhishPolicy = {
  name: string;
  priority: number | "Lowest";
  status: "On" | "On (default)";
  users: string;
  settings: {
    phishingThreshold: string;
    impersonationProtection: {
      userImpersonationProtection: "On" | "Off";
      domainImpersonationProtection: "On" | "Off";
      trustedSenders: number;
      trustedDomains: number;
      protectedUsers?: string[];
    };
    mailboxIntelligence: string;
    spoofIntelligence: string;
    honorDmarcPolicy: string;
    actions: {
      onUserImpersonation: string;
      onDomainImpersonation: string;
      onMailboxIntelligence: string;
      onSpoof: string;
      onDmarcReject: string;
    };
  };
};

export type DefenderAntiMalwarePolicy = {
  name: string;
  priority: number | "Lowest";
  status: "On";
  users: string;
  commonAttachmentFilter: string;
  zeroHourAutoPurge: string;
  notify: string;
};

export type DefenderAntiSpamInbound = {
  kind: "Inbound";
  name: string;
  priority: number | "Lowest";
  users: string;
  bulkThreshold: number;
  spamAction: string;
  highConfidenceSpamAction: string;
  phishAction: string;
  highConfidencePhishAction: string;
  bulkAction: string;
  retentionDays: number;
};
export type DefenderAntiSpamOutbound = {
  kind: "Outbound";
  name: string;
  priority: number | "Lowest";
  users: string;
  externalRecipientsPerHour: number;
  internalRecipientsPerHour: number;
  totalRecipientsPerDay: number;
  actionOnExceeded: string;
  forwardingRulesEnabled: string;
};
export type DefenderConnectionFilterPolicy = {
  kind: "ConnectionFilter";
  name: string;
  priority: "N/A";
  users: "N/A";
  ipAllowList: string[];
  ipBlockList: string[];
  safeListEnabled: "On" | "Off";
};
export type DefenderAntiSpamPolicy = DefenderAntiSpamInbound | DefenderAntiSpamOutbound | DefenderConnectionFilterPolicy;

export type DefenderSafeAttachmentsPolicy = {
  name: string;
  status: "On";
  users: string;
  action: "Dynamic Delivery" | "Block";
  redirectOnDetection: "On" | "Off";
  redirectEmail: string;
  includeRecipients: string;
  description: string;
};

export type DefenderSafeLinksPolicy = {
  name: string;
  status: "On";
  users: string;
  urlRewriting: "On";
  scanWhileUserClicks: string;
  applyToInternalMail: "On";
  doNotRewriteForOrgRecipients?: string;
  doNotTrackUserClicks?: "Off";
  doNotAllowUserClickThrough: string;
  urlAllowList: string;
  description: string;
};

export type DefenderDkimDomain = { domain: string; enabled: boolean; selectorRotated: string; nextRotation: string; keyLength: string };

export type DefenderQuarantinePolicyType = {
  name: "AdminOnlyAccessPolicy" | "DefaultFullAccessPolicy" | "DefaultFullAccessWithNotificationPolicy" | "NotificationEnabledPolicy";
  userPermissions: string;
  notification: string;
};

// ===== Email extras: Tenant Allow/Block List + Quarantine + Threat Explorer =====

export type DefenderTabEntry = { id: string; value: string; list: "Allow" | "Block"; reason: string; expiresOn: string; addedBy: string; addedOn: string };
export type DefenderTenantAllowBlock = { senders: DefenderTabEntry[]; urls: DefenderTabEntry[]; files: DefenderTabEntry[] };

export type DefenderQuarantineMessage = {
  id: string;
  received: string;
  sender: string;
  recipient: string;
  subject: string;
  policy: string;
  reason: string;
  sizeKb: number;
  status: "Pending" | "Released by admin" | "Released by user" | "Reported to Microsoft";
  releasedOn?: string;
  reportVerdict?: "False positive" | "Phish" | "Spam" | "Malware" | "Other";
};

export type DefenderCannedResultTable = { headers: string[]; rows: string[][] };

// ===== Email & Collaboration (rich version) =====

export type DefenderEmailCollabExplorer = {
  viewMode: string;
  lookback: string;
  stats: {
    totalEmail: number;
    delivered: number;
    junked: number;
    quarantined: number;
    blocked: number;
    zapped: number;
    phishCount: number;
    malwareCount: number;
  };
  topUrlClicks: { url: string; clicks: number; threatType: string; timeOfClickAction: string; users: string[] }[];
  topAttachments: { sender: string; fileName: string; sha256: string; verdict: string; recipients: number; action: string }[];
};

export type DefenderEmailCampaign = {
  name: string;
  firstSeen: string;
  lastSeen: string;
  confidence: "High" | "Medium";
  threatType: "Phish" | "Malware" | "Spam";
  impact: string;
  subject: string;
  subjectVariations: number;
  payloadType: string;
  senders: number;
  ips: number;
  recipients: number;
  clicks: number;
  attachments: number;
  urls: number;
  mitre: string;
};

export type DefenderEmailSubmission = {
  date: string;
  type: "Email" | "URL" | "File";
  submittedBy: string;
  submittedAs: "Phish" | "False positive" | "Malware";
  reason: string;
  items: number;
  verdict: string;
};

export type DefenderAttackSimulation = {
  name: string;
  status: "Completed" | "In progress";
  startDate: string;
  endDate: string;
  techniques: string;
  targeted: number;
  clicked: number;
  percentClicked: number;
  reported: number;
  percentReported: number;
  compromised: number;
  trainingAssigned: number;
  trainingCompleted: number;
};

export type DefenderThreatTrackerItem = {
  name: string;
  type: "Microsoft" | "Custom (your tenant)";
  severity: "Critical" | "High" | "Medium";
  firstAdded: string;
  tagged: string;
};

export type DefenderEmailCollab = {
  explorer: DefenderEmailCollabExplorer;
  campaigns: DefenderEmailCampaign[];
  submissions: DefenderEmailSubmission[];
  simulations: DefenderAttackSimulation[];
  threatTracker: DefenderThreatTrackerItem[];
};

// ===== Permissions & roles =====

export type DefenderWorkloadId = "xdr" | "endpoints" | "email" | "identity" | "cloudapps" | "ti" | "hunting" | "autoir";
export type DefenderWorkload = { id: DefenderWorkloadId; label: string };

export type DefenderPermUser = { id: string; upn: string; name: string; department: string };

export type DefenderRole = {
  id: string;
  name: string;
  type: "Entra" | "Defender custom";
  desc: string;
  workloads: DefenderWorkloadId[];
  actions: string[];
  scope: string;
  jit: boolean;
  builtIn: boolean;
};

export type DefenderRoleAssignment = {
  roleId: string;
  userId: string;
  assignedOn: string;
  assignedBy: string;
  jit: boolean;
  expiresOn: string | null;
};

// ===== Action Center =====

export type DefenderPendingAction = {
  id: string;
  type: string;
  target: string;
  requestedBy: string;
  requestedOn: string;
  investigation: string;
};
export type DefenderActionHistoryEntry = {
  id: string;
  type: string;
  target: string;
  status: "Approved" | "Rejected";
  actionedBy: string;
  actionedOn: string;
  reason?: string;
};

// ===== Root state =====

export type DefenderState = {
  tenant: DefenderTenant;
  incidents: DefenderIncident[];
  alerts: DefenderAlert[];
  devices: DefenderDevice[];
  identities: DefenderIdentity[];
  secureScore: DefenderSecureScore;
  emailThreats: DefenderEmailThreat[];
  submissions: DefenderSubmission[];
  threatAnalytics: DefenderThreatAnalytic[];
  vulnerabilities: DefenderVulnerability[];
  campaigns: DefenderCampaign[];
  activityLog: DefenderActivityEntry[];

  huntingQueries: DefenderHuntingQuery[];
  detectionSummaryCards: DefenderDetectionSummaryCard[];
  huntingSchema: DefenderHuntingSchema;
  scheduledHunts: DefenderScheduledHunt[];
  huntRuns: DefenderHuntRun[];

  customDetectionRules: DefenderCustomDetectionRule[];

  assets: DefenderAsset[];

  postureFindings: DefenderPostureFinding[];
  lateralMovementPaths: DefenderLateralMovementPath[];
  sensitiveAccounts: DefenderSensitiveAccount[];
  honeyTokens: DefenderHoneyToken[];

  discoveredApps: DefenderDiscoveredApp[];
  oauthApps: DefenderOAuthApp[];
  connectors: DefenderConnector[];
  sessionPolicies: DefenderSessionPolicy[];

  antiPhishPolicies: DefenderAntiPhishPolicy[];
  antiMalwarePolicies: DefenderAntiMalwarePolicy[];
  blockedFileExtensions: string[];
  antiSpamPolicies: DefenderAntiSpamPolicy[];
  safeAttachmentsPolicies: DefenderSafeAttachmentsPolicy[];
  safeLinksPolicies: DefenderSafeLinksPolicy[];
  dkimDomains: DefenderDkimDomain[];
  quarantinePolicyTypes: DefenderQuarantinePolicyType[];

  tenantAllowBlock: DefenderTenantAllowBlock;
  quarantine: { items: DefenderQuarantineMessage[] };

  emailCollab: DefenderEmailCollab;

  workloads: DefenderWorkload[];
  actionLibrary: Record<DefenderWorkloadId, string[]>;
  permUsers: DefenderPermUser[];
  roles: DefenderRole[];
  roleAssignments: DefenderRoleAssignment[];

  pendingActions: DefenderPendingAction[];
  actionHistory: DefenderActionHistoryEntry[];

  threatAnalyticsRead: string[];
  threatAnalyticsSubscriptions: string[];
};
