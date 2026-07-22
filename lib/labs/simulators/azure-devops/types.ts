export type AdoOrg = { id: string; name: string; url: string; region: string };

export type AdoProject = {
  id: string;
  org: string;
  name: string;
  description: string;
  visibility: "Private" | "Public";
  process: "Agile" | "Scrum" | "Basic";
  created: string;
};

// Single canonical roster shape — normalized at the seed layer regardless of
// source, fixing source's latent CloudLabInfra-vs-fallback shape mismatch.
export type AdoTeamMember = { id: string; name: string; email: string; initials: string; role: string; department?: string; accessLevel?: string };

export type AdoIteration = { id: string; name: string; start: string; end: string; state: "past" | "current" | "future" | "backlog" };
export type AdoArea = { id: string; path: string };

export type AdoWorkItemType = "Epic" | "Feature" | "User Story" | "Bug" | "Task";

export type AdoComment = { id: string; author: string; when: string; text: string };
export type AdoHistoryEntry = { when: string; actor: string; change: string };

export type AdoWorkItem = {
  id: number;
  type: AdoWorkItemType;
  title: string;
  state: string;
  reason: string;
  assignedTo: string;
  createdBy: string;
  createdDate: string;
  changedDate: string;
  iteration: string;
  area: string;
  tags: string[];
  priority: number;
  description: string;
  comments: AdoComment[];
  history: AdoHistoryEntry[];
  attachments: string[];
  links: string[];
  parent?: number;
  storyPoints?: number;
  severity?: string;
  reproSteps?: string;
  activity?: string;
  remainingWork?: number;
};

// ===== Repos =====

export type AdoFileNode = { type: "file" | "folder"; name: string; children?: AdoFileNode[]; content?: string };

export type AdoCommit = {
  id: string;
  short: string;
  message: string;
  author: string;
  date: string;
  files: number;
  additions: number;
  deletions: number;
  branch: string;
};

export type AdoBranchPolicies = {
  requireReviewers: boolean;
  minReviewers: number;
  resetVotesOnPush: boolean;
  allowSelfApprove: boolean;
  checkComments: boolean;
  buildValidation: boolean;
  linkedWorkItems: boolean;
  limitMergeTypes: boolean;
  squashOnly: boolean;
};

export type AdoBranch = {
  name: string;
  isDefault: boolean;
  ahead: number;
  behind: number;
  lastCommit: string;
  when: string;
  author: string;
  policies?: AdoBranchPolicies;
};

export type AdoPrCheck = { name: string; status: "Succeeded" | "Failed" | "Waiting" | "Approved" };
export type AdoPrThread = { id: string; author: string; when: string; text: string };
export type AdoPrVote = "Approved" | "Approved with suggestions" | "Waiting" | "Rejected";

export type AdoPullRequest = {
  id: number;
  title: string;
  source: string;
  target: string;
  author: string;
  status: "Active" | "Completed" | "Abandoned";
  vote: AdoPrVote;
  reviewers: string[];
  created: string;
  description: string;
  workItems: number[];
  commits: number;
  threads: AdoPrThread[];
  checks: AdoPrCheck[];
  autoComplete?: boolean;
};

export type AdoTag = { name: string; commit: string; date: string; message: string };
export type AdoPush = { id: string; who: string; branch: string; commits: number; when: string };

export type AdoRepo = {
  id: string;
  name: string;
  project: string;
  defaultBranch: string;
  size: string;
  commits: AdoCommit[];
  branches: AdoBranch[];
  pullRequests: AdoPullRequest[];
  tags: AdoTag[];
  pushes: AdoPush[];
  files: AdoFileNode[];
  fileOverrides: Record<string, string>;
};

// ===== Pipelines =====

export type AdoPipeline = {
  id: string;
  name: string;
  project: string;
  repo: string;
  yaml: string;
  stages: string[];
  folder?: string;
  source?: string;
  createdBy?: string;
  createdAt?: string;
};

export type AdoRunStageStatus = "Pending" | "Running" | "Succeeded" | "Failed" | "Canceled" | "Skipped";
export type AdoRunStage = { name: string; status: AdoRunStageStatus; startedAt: string | null; finishedAt: string | null; durationSec: number | null };

export type AdoPipelineRun = {
  id: string;
  runNumber: number;
  pipeline: string;
  branch: string;
  commit: string;
  triggeredBy: string;
  status: "Running" | "Succeeded" | "Failed" | "Canceled";
  duration: string;
  when: string;
  reason: string;
  stageRuns: AdoRunStage[];
  startedAtMs: number | null;
};

export type AdoRelease = { id: string; name: string; stages: string[]; lastRun: string; status: string };

export type AdoDeployment = { when: string; status: "Succeeded" | "Failed"; by: string };
export type AdoEnvironment = { id: string; name: string; description: string; resourceCount: number; deployments: AdoDeployment[] };

export type AdoVariable = { k: string; v: string; secret: boolean };
export type AdoVariableGroup = { id: string; name: string; linkedKeyVault: string | null; variables: AdoVariable[] };

export type AdoSecureFile = { id: string; name: string; uploaded: string; size: string };
export type AdoServiceConnection = { id: string; name: string; type: string; scope: string; verified: boolean };
export type AdoTaskGroup = { id: string; name: string; description: string; steps: string[] };
export type AdoDeploymentGroup = { id: string; name: string; targets: number; tags: string[] };
export type AdoPipelineFolder = { id: string; name: string };

// ===== Test Plans =====

export type AdoTestOutcome = "Passed" | "Failed" | "Blocked" | "Not Run";
export type AdoTestCase = { id: string; title: string; steps: string[]; outcome: AdoTestOutcome; assignedTester: string };
export type AdoTestSuite = { id: string; name: string; cases: AdoTestCase[] };
export type AdoTestPlan = { id: string; name: string; project: string; iteration: string; suites: AdoTestSuite[] };

// ===== Artifacts =====

export type AdoPackageVersion = { version: string; publishedOn: string; downloads: number };
export type AdoPackage = { name: string; versions: AdoPackageVersion[]; downloads: number };
export type AdoFeed = { id: string; name: string; type: "npm" | "NuGet" | "Maven"; upstream: string[]; packages: AdoPackage[] };

// ===== Saved queries (real persisted) =====

export type AdoSavedQuery = { id: string; name: string; type: string[]; state: string[]; assignedTo: string };

export type AdoActivityEntry = { when: string; actor: string; action: string; target: string };

// ===== Root state =====

export type AdoState = {
  currentOrg: string;
  currentProject: string;
  orgs: AdoOrg[];
  projects: AdoProject[];
  team: AdoTeamMember[];
  iterations: AdoIteration[];
  areas: AdoArea[];
  workItems: AdoWorkItem[];
  repos: AdoRepo[];
  pipelines: AdoPipeline[];
  pipelineRuns: AdoPipelineRun[];
  releases: AdoRelease[];
  environments: AdoEnvironment[];
  variableGroups: AdoVariableGroup[];
  secureFiles: AdoSecureFile[];
  serviceConnections: AdoServiceConnection[];
  taskGroups: AdoTaskGroup[];
  deploymentGroups: AdoDeploymentGroup[];
  pipelineFolders: AdoPipelineFolder[];
  testPlans: AdoTestPlan[];
  feeds: AdoFeed[];
  savedQueries: AdoSavedQuery[];
  activityLog: AdoActivityEntry[];
};
