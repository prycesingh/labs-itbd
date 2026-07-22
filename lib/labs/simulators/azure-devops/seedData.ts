import type {
  AdoActivityEntry,
  AdoArea,
  AdoBranch,
  AdoBranchPolicies,
  AdoCommit,
  AdoDeploymentGroup,
  AdoEnvironment,
  AdoFeed,
  AdoFileNode,
  AdoIteration,
  AdoOrg,
  AdoPipeline,
  AdoPipelineRun,
  AdoProject,
  AdoPullRequest,
  AdoPush,
  AdoRelease,
  AdoRepo,
  AdoRunStage,
  AdoSecureFile,
  AdoServiceConnection,
  AdoState,
  AdoTag,
  AdoTaskGroup,
  AdoTeamMember,
  AdoTestCase,
  AdoTestPlan,
  AdoTestSuite,
  AdoWorkItem,
  AdoWorkItemType,
} from "./types";
import { parseStagesFromYaml } from "./pipeline-engine";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Ported verbatim from itbd-lab/simulators/{avd,defender,sentinel,purview} `rng(seed)`
// — same simple LCG used across every ported simulator in this app so seed data is
// stable across reloads within a session (no Math.random()). Not needed for most of
// this file (source's ado-data.js uses its own `randHash` below for hashes), but kept
// for parity with sibling simulators in case future seed additions need it.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
void rng;

// ===== Deterministic hash generator =====
// Ported verbatim from ado-data.js `randHash(seed, salt)` — NOT Math.random(), a
// hand-rolled deterministic string hash used to fabricate believable commit/tag SHAs.
function randHash(seed: number, salt: string): string {
  const chars = "abcdef0123456789";
  let out = "";
  let n = seed * 17 + (salt ? salt.length : 0) * 13;
  for (let i = 0; i < 40; i++) {
    n = (n * 31 + i * 7) >>> 0;
    out += chars[n % 16];
  }
  return out;
}

// ===== Organizations + Projects =====
const ORGS: AdoOrg[] = [
  { id: "org-training", name: "CloudLab-Training", url: "dev.azure.com/cloudlab-training", region: "Central India" },
  { id: "org-customer-a", name: "CloudLab-Customer-A", url: "dev.azure.com/cloudlab-customer-a", region: "Central India" },
  { id: "org-sandbox", name: "CloudLab-Sandbox", url: "dev.azure.com/cloudlab-sandbox", region: "Central India" },
];

const PROJECTS: AdoProject[] = [
  { id: "proj-webapp", org: "org-training", name: "WebApp-Production", description: "Customer-facing web application", visibility: "Private", process: "Agile", created: "2024-04-12" },
  { id: "proj-mobile", org: "org-training", name: "Mobile-App", description: "iOS and Android mobile clients", visibility: "Private", process: "Scrum", created: "2024-06-20" },
  { id: "proj-iac", org: "org-training", name: "Infrastructure-IaC", description: "Terraform and Bicep templates", visibility: "Private", process: "Agile", created: "2024-03-05" },
  { id: "proj-portal", org: "org-training", name: "Customer-Portal", description: "Self-service customer portal", visibility: "Private", process: "Agile", created: "2025-01-10" },
  { id: "proj-internal", org: "org-training", name: "Internal-Tools", description: "Internal automation utilities", visibility: "Private", process: "Basic", created: "2024-11-22" },
];

// ===== Team roster =====
// Source (ado-data.js) has two roster code paths: a CloudLabInfra-sourced branch
// ({id,displayName,upn,email,role,department,accessLevel}) and a local-fallback branch
// ({id,name,email,initials,role}). Every UI consumer in source assumes the FALLBACK
// shape (`.name`, `.initials`) — the CloudLabInfra branch would silently break those
// consumers if it were ever active. This app has no shared CloudLabInfra bridge (same
// situation as Sentinel/Purview/Defender/AVD), so we hardcode the local-fallback shape
// below as the ONE canonical roster — matching `AdoTeamMember` (name/initials primary,
// department/accessLevel optional) and sidestepping the shape-mismatch bug entirely.
const TEAM: AdoTeamMember[] = [
  { id: "usr-ankit", name: "Alex Johnson", email: "admin@itbd.net", initials: "AS", role: "Project Administrator" },
  { id: "usr-priya", name: "Priya Patel", email: "priya@cloudlab.in", initials: "PP", role: "Product Owner" },
  { id: "usr-rahul", name: "Rahul Verma", email: "rahul@cloudlab.in", initials: "RV", role: "Developer" },
  { id: "usr-sneha", name: "Sneha Iyer", email: "sneha@cloudlab.in", initials: "SI", role: "Developer" },
  { id: "usr-vikram", name: "Vikram Singh", email: "vikram@cloudlab.in", initials: "VS", role: "Tech Lead" },
  { id: "usr-anjali", name: "Anjali Mehta", email: "anjali@cloudlab.in", initials: "AM", role: "QA Engineer" },
  { id: "usr-rohit", name: "Rohit Kapoor", email: "rohit@cloudlab.in", initials: "RK", role: "Developer" },
  { id: "usr-deepika", name: "Deepika Rao", email: "deepika@cloudlab.in", initials: "DR", role: "Senior Developer" },
  { id: "usr-manish", name: "Manish Tiwari", email: "manish@cloudlab.in", initials: "MT", role: "DevOps Engineer" },
  { id: "usr-meera", name: "Meera Shah", email: "meera@cloudlab.in", initials: "MS", role: "Scrum Master" },
];

// ===== Iterations / Areas =====
const ITERATIONS: AdoIteration[] = [
  { id: "iter-123", name: "Sprint 123", start: "2026-03-31", end: "2026-04-13", state: "past" },
  { id: "iter-124", name: "Sprint 124", start: "2026-04-28", end: "2026-05-11", state: "current" },
  { id: "iter-125", name: "Sprint 125", start: "2026-05-12", end: "2026-05-25", state: "future" },
  { id: "iter-bk", name: "Backlog", start: "", end: "", state: "backlog" },
];

const AREAS: AdoArea[] = [
  { id: "area-fe", path: "WebApp/Frontend" },
  { id: "area-be", path: "WebApp/Backend" },
  { id: "area-mb", path: "Mobile" },
  { id: "area-in", path: "Infrastructure" },
];

// ===== Work item seed content =====
const EPIC_TITLES = ["Q2 Customer Portal Modernization", "Mobile App 3.0 Release"];

const FEATURE_TITLES = [
  "Single Sign-On with Azure AD",
  "Real-time notifications service",
  "Dark mode across web and mobile",
  "GDPR compliance dashboard",
  "Multi-tenant billing engine",
];

const STORY_TITLES = [
  "As a user I can log in using my Microsoft account",
  "As a user I receive push notifications on iOS",
  "As a user I receive push notifications on Android",
  "As an admin I can revoke user sessions",
  "As a user I can switch the UI to dark mode",
  "As an admin I can export GDPR data on demand",
  "As a user I can delete my account end-to-end",
  "As a customer I can see itemised invoices",
  "As a customer I can pay using UPI",
  "As a customer I can pay using credit card",
  "As an admin I can configure tax rules per region",
  "As a developer I can run end-to-end tests locally",
  "As a tester I can mark a defect as not-reproducible",
  "As a manager I can view team velocity charts",
  "As a tester I can capture screenshots in a test run",
  "As an SRE I can roll back a deployment from the portal",
  "As a developer I can publish a package to internal feed",
  "As a customer I can request a refund online",
  "As a customer I receive a receipt by email",
  "As an admin I can grant role-based access",
];

const BUG_TITLES = [
  "Login page throws 500 on Safari iOS",
  "Push notification icon missing on Android 14",
  "Dark mode contrast fails WCAG AA on filter chips",
  "Invoice PDF shows wrong currency for INR",
  "UPI callback returns empty payload intermittently",
  "Session token leaks in browser console logs",
  "Build pipeline fails on Node 20 LTS",
  "Terraform plan diff shows phantom changes on RG tags",
  "NullReferenceException in OrderService.GetById",
  "CORS error when calling /api/v2/users from mobile",
  "Memory leak in WebSocket reconnection loop",
  "Search results pagination skips last page",
  "Email notifications delayed by >10 minutes",
  "PDF export crashes when invoice has >100 line items",
  "OAuth refresh token expiry not honoured",
];

const TASK_TITLES = [
  "Set up unit test coverage reporting",
  "Configure SonarCloud quality gate",
  "Upgrade Node runtime to v20 LTS",
  "Document release runbook in wiki",
  "Add Application Insights to API",
  "Containerize legacy worker service",
  "Schedule weekly DR drill in staging",
  "Rotate signing certificate before expiry",
];

const TAGS = ["frontend", "backend", "mobile", "infrastructure", "security", "tech-debt", "urgent", "cherry-pick", "release-blocker", "spike"];

function pickIter(seed: number): string {
  const pool = ["iter-124", "iter-124", "iter-125", "iter-bk", "iter-123"];
  return pool[seed % pool.length];
}

function buildItem(id: number, type: AdoWorkItemType, title: string, people: string[], iter: string): AdoWorkItem {
  let state: string;
  let reason: string;
  if (type === "Bug") {
    state = ["New", "Active", "Resolved", "Closed"][id % 4];
    reason = state === "New" ? "New defect reported" : state === "Active" ? "Investigation underway" : state === "Resolved" ? "Fix verified" : "Verified and closed";
  } else if (type === "Task") {
    state = ["To Do", "In Progress", "Done"][id % 3];
    reason = state === "To Do" ? "New" : state === "In Progress" ? "Work started" : "Work completed";
  } else {
    state = ["New", "Active", "Resolved", "Closed"][id % 4];
    reason = "New";
  }
  const assignee = people[id % people.length];
  const created = `2026-0${3 + (id % 3)}-${String(((id * 7) % 27) + 1).padStart(2, "0")}`;
  const areaPaths = AREAS.map((a) => a.path);
  return {
    id,
    type,
    title,
    state,
    reason,
    assignedTo: assignee,
    createdBy: people[(id + 3) % people.length],
    createdDate: created,
    changedDate: created,
    iteration: iter,
    area: areaPaths[id % areaPaths.length],
    tags: [TAGS[id % TAGS.length], TAGS[(id + 3) % TAGS.length]],
    priority: (id % 4) + 1,
    description: `Detailed description for ${title}. Acceptance criteria captured in linked spec.`,
    comments: [
      { id: "c1", author: people[id % people.length], when: created, text: "Investigation started. Will post findings shortly." },
      { id: "c2", author: people[(id + 2) % people.length], when: created, text: "Repro confirmed on staging. Assigning to dev." },
    ],
    history: [
      { when: created, actor: assignee, change: "Created work item" },
      { when: created, actor: assignee, change: `Assigned to ${assignee}` },
    ],
    attachments: [],
    links: [],
  };
}

function seedWorkItems(): AdoWorkItem[] {
  const items: AdoWorkItem[] = [];
  let id = 1000;
  const people = TEAM.map((t) => t.name);

  // Epics
  for (let i = 0; i < EPIC_TITLES.length; i++) {
    items.push(buildItem(++id, "Epic", EPIC_TITLES[i], people, "iter-bk"));
  }
  // Features
  for (let j = 0; j < FEATURE_TITLES.length; j++) {
    const feat = buildItem(++id, "Feature", FEATURE_TITLES[j], people, j < 2 ? "iter-124" : "iter-125");
    feat.parent = 1001 + (j % EPIC_TITLES.length);
    items.push(feat);
  }
  // User Stories
  for (let k = 0; k < STORY_TITLES.length; k++) {
    const story = buildItem(++id, "User Story", STORY_TITLES[k], people, pickIter(k));
    story.parent = 1003 + (k % FEATURE_TITLES.length);
    story.storyPoints = [1, 2, 3, 5, 8, 13][k % 6];
    items.push(story);
  }
  // Bugs
  for (let b = 0; b < BUG_TITLES.length; b++) {
    const bug = buildItem(++id, "Bug", BUG_TITLES[b], people, pickIter(b + 3));
    bug.severity = ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"][b % 4];
    bug.priority = (b % 4) + 1;
    bug.reproSteps = "1. Open the affected page\n2. Trigger the action described in the title\n3. Observe the failure in the console / network tab";
    items.push(bug);
  }
  // Tasks
  for (let t = 0; t < TASK_TITLES.length; t++) {
    const task = buildItem(++id, "Task", TASK_TITLES[t], people, pickIter(t + 5));
    task.activity = ["Development", "Testing", "Documentation", "Deployment", "Design"][t % 5];
    task.remainingWork = (t % 6) + 1;
    items.push(task);
  }
  return items;
}

// ===== Repos / commits / branches / PRs =====
const REPO_DEFS: { id: string; name: string; project: string; defaultBranch: string; size: string }[] = [
  { id: "repo-webapp-react", name: "webapp-react", project: "proj-webapp", defaultBranch: "main", size: "24.6 MB" },
  { id: "repo-webapp-api", name: "webapp-api", project: "proj-webapp", defaultBranch: "main", size: "12.1 MB" },
  { id: "repo-mobile-android", name: "mobile-android", project: "proj-mobile", defaultBranch: "main", size: "38.4 MB" },
  { id: "repo-mobile-ios", name: "mobile-ios", project: "proj-mobile", defaultBranch: "main", size: "41.2 MB" },
  { id: "repo-iac", name: "infrastructure-terraform", project: "proj-iac", defaultBranch: "main", size: "5.8 MB" },
];

const COMMIT_VERBS = ["Add", "Fix", "Refactor", "Update", "Remove", "Bump", "Patch", "Document", "Test", "Cleanup"];
const COMMIT_SUBJ = [
  "login route handler", "PR template", "GitHub Actions cache key",
  "unit tests for OrderService", "Terraform aks module version",
  "flaky payment integration test", "README installation steps",
  "dependency lockfile", "ESLint configuration", "k8s deployment manifest",
  "circuit breaker timeout", "OAuth scopes for tenant admin",
  "image asset compression", "NSwag client regeneration",
  "storage retention policy", "Helm chart values for prod",
  "OpenTelemetry exporter", "Jest snapshot mismatches",
  "broken navigation on iOS 17", "circular dependency in services",
];

function seedCommits(repoId: string): AdoCommit[] {
  const list: AdoCommit[] = [];
  for (let i = 30; i >= 1; i--) {
    const verb = COMMIT_VERBS[(i + repoId.length) % COMMIT_VERBS.length];
    const subj = COMMIT_SUBJ[(i * 3 + repoId.length) % COMMIT_SUBJ.length];
    const hash = randHash(i, repoId);
    const d = new Date();
    d.setDate(d.getDate() - i);
    list.push({
      id: hash,
      short: hash.substring(0, 8),
      message: `${verb} ${subj}`,
      author: TEAM[(i + repoId.length) % TEAM.length].name,
      date: d.toISOString().substring(0, 10),
      files: 1 + (i % 8),
      additions: 5 + ((i * 7) % 120),
      deletions: 1 + ((i * 3) % 40),
      branch: i % 5 === 0 ? `feature/${["login", "payments", "darkmode", "gdpr", "sso"][Math.floor(i / 5) % 5]}` : "main",
    });
  }
  return list;
}

function defaultBranchPolicies(isDefault: boolean): AdoBranchPolicies {
  // Sensible defaults so branch-policy edits (UPDATE_BRANCH_POLICIES) have something
  // real to patch — source left `policies` undefined entirely (a persistence gap).
  return {
    requireReviewers: isDefault,
    minReviewers: isDefault ? 2 : 1,
    resetVotesOnPush: isDefault,
    allowSelfApprove: !isDefault,
    checkComments: isDefault,
    buildValidation: isDefault,
    linkedWorkItems: isDefault,
    limitMergeTypes: isDefault,
    squashOnly: false,
  };
}

function seedBranches(): AdoBranch[] {
  return [
    { name: "main", isDefault: true, ahead: 0, behind: 0, lastCommit: "Update README installation steps", when: "2 hours ago", author: "Alex Johnson", policies: defaultBranchPolicies(true) },
    { name: "develop", isDefault: false, ahead: 12, behind: 0, lastCommit: "Refactor circuit breaker timeout", when: "4 hours ago", author: "Deepika Rao", policies: defaultBranchPolicies(false) },
    { name: "feature/login", isDefault: false, ahead: 4, behind: 6, lastCommit: "Add login route handler", when: "Yesterday", author: "Rohit Kapoor", policies: defaultBranchPolicies(false) },
    { name: "feature/payments", isDefault: false, ahead: 7, behind: 3, lastCommit: "Fix flaky payment integration test", when: "2 days ago", author: "Sneha Iyer", policies: defaultBranchPolicies(false) },
    { name: "release/v2.4", isDefault: false, ahead: 0, behind: 18, lastCommit: "Bump dependency lockfile", when: "1 week ago", author: "Vikram Singh", policies: defaultBranchPolicies(false) },
  ];
}

function seedPullRequests(repoId: string): AdoPullRequest[] {
  return [
    {
      id: 101 + repoId.length,
      title: "Add Microsoft SSO login flow",
      source: "feature/login",
      target: "main",
      author: "Rohit Kapoor",
      status: "Active",
      vote: "Waiting",
      reviewers: ["Vikram Singh", "Deepika Rao"],
      created: "2026-05-12",
      description: "Implements OIDC login against Azure AD. Covers ticket #1014.",
      workItems: [1014, 1019],
      commits: 7,
      threads: [
        { id: "t1", author: "Vikram Singh", when: "2026-05-13", text: "Please add a unit test for the refresh-token path." },
        { id: "t2", author: "Rohit Kapoor", when: "2026-05-13", text: "Done in commit 9a3b21." },
      ],
      checks: [
        { name: "Build webapp-build #842", status: "Succeeded" },
        { name: "SonarCloud quality gate", status: "Succeeded" },
        { name: "Required reviewers (2 of 2)", status: "Waiting" },
      ],
    },
    {
      id: 102 + repoId.length,
      title: "Refactor circuit breaker timeout",
      source: "develop",
      target: "main",
      author: "Deepika Rao",
      status: "Completed",
      vote: "Approved",
      reviewers: ["Vikram Singh", "Manish Tiwari"],
      created: "2026-05-08",
      description: "Increases circuit breaker timeout from 2s to 5s after observed traffic patterns.",
      workItems: [1022],
      commits: 3,
      threads: [],
      checks: [
        { name: "Build webapp-build #835", status: "Succeeded" },
        { name: "Required reviewers", status: "Approved" },
      ],
    },
    {
      id: 103 + repoId.length,
      title: "Spike: experiment with edge cache",
      source: "feature/edge-cache",
      target: "main",
      author: "Sneha Iyer",
      status: "Abandoned",
      vote: "Rejected",
      reviewers: ["Vikram Singh"],
      created: "2026-04-26",
      description: "Spike was abandoned after performance numbers did not meet target.",
      workItems: [],
      commits: 2,
      threads: [],
      checks: [],
    },
  ];
}

function seedTags(repoId: string): AdoTag[] {
  return [
    { name: "v2.4.0", commit: randHash(1, repoId).substring(0, 8), date: "2026-04-30", message: "Release 2.4.0 — SSO + dark mode" },
    { name: "v2.3.5", commit: randHash(2, repoId).substring(0, 8), date: "2026-04-12", message: "Hotfix for invoice currency bug" },
    { name: "v2.3.0", commit: randHash(3, repoId).substring(0, 8), date: "2026-03-20", message: "Release 2.3.0 — billing engine" },
    { name: "v2.2.0", commit: randHash(4, repoId).substring(0, 8), date: "2026-02-15", message: "Release 2.2.0 — push notifications" },
  ];
}

function seedPushes(): AdoPush[] {
  return [
    { id: "push-1", who: "Rohit Kapoor", branch: "feature/login", commits: 3, when: "2 hours ago" },
    { id: "push-2", who: "Deepika Rao", branch: "develop", commits: 1, when: "4 hours ago" },
    { id: "push-3", who: "Sneha Iyer", branch: "feature/payments", commits: 2, when: "Yesterday" },
    { id: "push-4", who: "Alex Johnson", branch: "main", commits: 1, when: "Yesterday" },
    { id: "push-5", who: "Vikram Singh", branch: "release/v2.4", commits: 5, when: "2 days ago" },
  ];
}

function fileNode(name: string): AdoFileNode {
  return { type: "file", name };
}

function seedFileTree(name: string): AdoFileNode[] {
  if (name.indexOf("terraform") >= 0) {
    return [
      { type: "folder", name: "modules", children: [
        { type: "folder", name: "aks", children: [fileNode("main.tf"), fileNode("variables.tf"), fileNode("outputs.tf")] },
        { type: "folder", name: "network", children: [fileNode("main.tf"), fileNode("variables.tf")] },
        { type: "folder", name: "storage", children: [fileNode("main.tf"), fileNode("variables.tf")] },
      ] },
      { type: "folder", name: "envs", children: [
        { type: "folder", name: "prod", children: [fileNode("main.tfvars"), fileNode("backend.tf")] },
        { type: "folder", name: "staging", children: [fileNode("main.tfvars"), fileNode("backend.tf")] },
      ] },
      fileNode("README.md"), fileNode(".gitignore"), fileNode("azure-pipelines.yml"),
    ];
  }
  if (name.indexOf("android") >= 0) {
    return [
      { type: "folder", name: "app", children: [
        { type: "folder", name: "src", children: [
          { type: "folder", name: "main", children: [
            { type: "folder", name: "java", children: [fileNode("MainActivity.kt"), fileNode("LoginActivity.kt")] },
            { type: "folder", name: "res", children: [fileNode("strings.xml"), fileNode("colors.xml")] },
          ] },
        ] },
        fileNode("build.gradle.kts"),
      ] },
      fileNode("README.md"), fileNode("build.gradle.kts"), fileNode("azure-pipelines.yml"),
    ];
  }
  if (name.indexOf("ios") >= 0) {
    return [
      { type: "folder", name: "CloudLab", children: [
        fileNode("AppDelegate.swift"), fileNode("SceneDelegate.swift"),
        fileNode("LoginView.swift"), fileNode("HomeView.swift"),
      ] },
      fileNode("Podfile"), fileNode("README.md"), fileNode("azure-pipelines.yml"),
    ];
  }
  if (name.indexOf("api") >= 0) {
    return [
      { type: "folder", name: "src", children: [
        { type: "folder", name: "controllers", children: [fileNode("UsersController.cs"), fileNode("OrdersController.cs"), fileNode("AuthController.cs")] },
        { type: "folder", name: "services", children: [fileNode("UserService.cs"), fileNode("OrderService.cs"), fileNode("PaymentService.cs")] },
        fileNode("Program.cs"), fileNode("appsettings.json"),
      ] },
      fileNode("README.md"), fileNode("Dockerfile"), fileNode("azure-pipelines.yml"),
    ];
  }
  // webapp-react default
  return [
    { type: "folder", name: "src", children: [
      { type: "folder", name: "components", children: [fileNode("Login.jsx"), fileNode("Dashboard.jsx"), fileNode("Profile.jsx")] },
      { type: "folder", name: "pages", children: [fileNode("Home.jsx"), fileNode("About.jsx"), fileNode("NotFound.jsx")] },
      fileNode("App.jsx"), fileNode("main.jsx"), fileNode("index.css"),
    ] },
    { type: "folder", name: "public", children: [fileNode("favicon.ico"), fileNode("robots.txt")] },
    fileNode("package.json"), fileNode("vite.config.js"), fileNode("README.md"), fileNode("azure-pipelines.yml"),
  ];
}

function seedRepos(): AdoRepo[] {
  return REPO_DEFS.map((r) => ({
    id: r.id,
    name: r.name,
    project: r.project,
    defaultBranch: r.defaultBranch,
    size: r.size,
    commits: seedCommits(r.id),
    branches: seedBranches(),
    pullRequests: seedPullRequests(r.id),
    tags: seedTags(r.id),
    pushes: seedPushes(),
    files: seedFileTree(r.name),
    // Fixes source's "file edits lost on reload" gap — starts empty, patched via
    // SET_FILE_OVERRIDE so edited file content is now real persisted state.
    fileOverrides: {},
  }));
}

// ===== Pipelines =====
// azure-pipelines.yml is ported verbatim from ado-data.js YAML_WEBAPP/YAML_ANDROID/
// YAML_IAC/YAML_NIGHTLY constants (that file's default per-pipeline yaml, distinct
// from the 14 "New pipeline" starter templates ported into PIPELINE_TEMPLATES below).
const YAML_WEBAPP = `trigger:
  branches:
    include: [ main, develop ]

pool:
  vmImage: ubuntu-latest

variables:
  - group: Common-Secrets
  - name: buildConfiguration
    value: Release

stages:
  - stage: Build
    jobs:
      - job: Compile
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.x' }
          - script: npm ci && npm run build

  - stage: Test
    dependsOn: Build
    jobs:
      - job: UnitTests
        steps:
          - script: npm test -- --ci

  - stage: Package
    dependsOn: Test
    jobs:
      - job: Pack
        steps:
          - task: PublishPipelineArtifact@1
            inputs: { targetPath: 'dist', artifact: 'webapp' }

  - stage: Deploy_Dev
    dependsOn: Package
    jobs:
      - deployment: Dev
        environment: dev
        strategy:
          runOnce:
            deploy:
              steps:
                - script: echo "Deploy to Dev"

  - stage: Deploy_Staging
    dependsOn: Deploy_Dev
    jobs:
      - deployment: Staging
        environment: staging

  - stage: Deploy_Prod
    dependsOn: Deploy_Staging
    jobs:
      - deployment: Prod
        environment: prod
`;

const YAML_ANDROID = `trigger:
  branches: { include: [ main ] }

pool:
  vmImage: macos-latest

steps:
  - task: Gradle@3
    inputs:
      gradleWrapperFile: 'gradlew'
      tasks: 'assembleRelease'
  - task: AndroidSigning@3
  - task: GooglePlayRelease@4
    inputs: { serviceConnection: 'play-store-svc', track: 'production' }
`;

const YAML_IAC = `trigger:
  branches: { include: [ main ] }

pool:
  vmImage: ubuntu-latest

stages:
  - stage: Plan
    jobs:
      - job: TerraformPlan
        steps:
          - script: terraform init && terraform plan -out=tfplan
  - stage: Apply
    dependsOn: Plan
    jobs:
      - deployment: Apply
        environment: prod
        strategy:
          runOnce:
            deploy:
              steps:
                - script: terraform apply -auto-approve tfplan
`;

const YAML_NIGHTLY = `schedules:
  - cron: "0 2 * * *"
    branches: { include: [ main ] }
    always: true

stages:
  - stage: Smoke
    jobs: [ { job: Smoke,        steps: [ { script: npm run test:smoke } ] } ]
  - stage: Regression
    jobs: [ { job: Regression,   steps: [ { script: npm run test:regression } ] } ]
  - stage: Performance
    jobs: [ { job: Performance,  steps: [ { script: npm run test:perf } ] } ]
`;

const PIPELINE_DEFS: { id: string; name: string; project: string; repo: string; yaml: string }[] = [
  { id: "pl-webapp-build", name: "webapp-build", project: "proj-webapp", repo: "webapp-react", yaml: YAML_WEBAPP },
  { id: "pl-android", name: "mobile-android-build", project: "proj-mobile", repo: "mobile-android", yaml: YAML_ANDROID },
  { id: "pl-iac", name: "infrastructure-deploy", project: "proj-iac", repo: "infrastructure-terraform", yaml: YAML_IAC },
  { id: "pl-nightly", name: "nightly-tests", project: "proj-webapp", repo: "webapp-react", yaml: YAML_NIGHTLY },
];

function seedPipelines(): AdoPipeline[] {
  return PIPELINE_DEFS.map((p) => ({
    id: p.id,
    name: p.name,
    project: p.project,
    repo: p.repo,
    yaml: p.yaml,
    stages: parseStagesFromYaml(p.yaml),
    createdBy: "Alex Johnson",
    createdAt: "2024-05-01",
  }));
}

function seedRuns(pipelines: AdoPipeline[]): AdoPipelineRun[] {
  const runs: AdoPipelineRun[] = [];
  let num = 800;
  pipelines.forEach((pl) => {
    for (let i = 0; i < 20; i++) {
      const r = Math.abs(((i + pl.name.length) * 13) % 100);
      const status: AdoPipelineRun["status"] = r < 75 ? "Succeeded" : r < 90 ? "Failed" : "Canceled";
      const d = new Date();
      d.setDate(d.getDate() - i);
      num++;
      const stageNames = pl.stages.length ? pl.stages : ["Build"];
      // Completed seed runs get all stages stamped with the run's own terminal status
      // (a canceled run shows every stage as Canceled, etc.) since these are historical
      // rows, not live runs progressing through ADVANCE_PIPELINE_RUN.
      const stageStatus: AdoRunStage["status"] = status;
      const stageRuns: AdoRunStage[] = stageNames.map((name) => ({
        name,
        status: stageStatus,
        startedAt: d.toISOString(),
        finishedAt: d.toISOString(),
        durationSec: 30 + (i % 9) * 12,
      }));
      runs.push({
        id: `run-${num}`,
        runNumber: num,
        pipeline: pl.id,
        branch: i % 4 === 0 ? "feature/login" : "main",
        commit: randHash(i, pl.id).substring(0, 8),
        triggeredBy: TEAM[(i + pl.name.length) % TEAM.length].name,
        status,
        duration: `${4 + (i % 9)}m ${10 + ((i * 3) % 50)}s`,
        when: d.toISOString().substring(0, 10),
        reason: i % 3 === 0 ? "CI" : i % 3 === 1 ? "Manual" : "PullRequest",
        stageRuns,
        startedAtMs: d.getTime(),
      });
    }
  });
  return runs;
}

// ===== Releases =====
const RELEASES: AdoRelease[] = [
  { id: "rel-1", name: "WebApp-Release", stages: ["Dev", "Staging", "Prod"], lastRun: "2026-05-13", status: "Succeeded" },
  { id: "rel-2", name: "API-Release", stages: ["Dev", "Staging", "Prod"], lastRun: "2026-05-12", status: "Succeeded" },
  { id: "rel-3", name: "Mobile-Release", stages: ["Internal", "Beta", "Production"], lastRun: "2026-05-10", status: "Failed" },
];

// ===== Environments / Library / Service connections / Agent pools / Deployment groups =====
// Per this sub-phase's scope decision, the RICHER `ado-pipelines-depth.js` reference
// content (ENVIRONMENTS/VAR_GROUPS/SVC_CONNECTIONS/DEPLOY_GROUPS) is merged in here as
// the canonical seed, superseding the shallower duplicate data that otherwise lives in
// ado-pipelines.js (PIPELINES module) / ado-data.js. Deployment history entries are
// synthesized from each environment's `deploys24h`/`lastDeploy` since AdoDeployment
// needs discrete rows, not just a running counter.
function envDeployments(count: number, lastDeployBy: string): { when: string; status: "Succeeded" | "Failed"; by: string }[] {
  const out: { when: string; status: "Succeeded" | "Failed"; by: string }[] = [];
  const n = Math.min(count, 6);
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setHours(d.getHours() - i * 3);
    out.push({ when: d.toISOString(), status: i === 0 && /Failed/i.test(lastDeployBy) ? "Failed" : "Succeeded", by: lastDeployBy.replace(/^\d{2}:\d{2} by /, "").replace(/\s*\(run.*\)$/, "") });
  }
  return out;
}

const ENVIRONMENTS: AdoEnvironment[] = [
  { id: "env-dev", name: "dev", description: "Shared dev environment — AKS prod-dev, 2 VMs", resourceCount: 3, deployments: envDeployments(47, "14:42 by build-pipeline (run #2841)") },
  { id: "env-staging", name: "staging", description: "Pre-production replica — AKS prod-stg, 3 VMs", resourceCount: 2, deployments: envDeployments(12, "12:18 by build-pipeline (run #2838)") },
  { id: "env-prod", name: "prod", description: "Production environment — AKS prod-east, AKS prod-west, 8 VMs, 1 Cosmos", resourceCount: 4, deployments: envDeployments(2, "09:08 by release-train (run #841)") },
  { id: "env-prod-canary", name: "prod-canary", description: "Production canary slice — AKS prod-east (canary VS)", resourceCount: 1, deployments: envDeployments(8, "14:48 by release-train (run #845)") },
  { id: "env-prod-eu", name: "prod-eu", description: "EU production region — AKS prod-eu, 2 VMs", resourceCount: 3, deployments: envDeployments(1, "08:30 by release-train (run #840)") },
  { id: "env-compliance-audit", name: "compliance-audit", description: "CMDB-prod, audit-log-archive — audit trail only, no live deploys", resourceCount: 2, deployments: envDeployments(0, "audit-pipeline (run #112)") },
];

type AdoVariableGroupSeed = { id: string; name: string; linkedKeyVault: string | null; variables: { k: string; v: string; secret: boolean }[] };

const VARIABLE_GROUPS: AdoVariableGroupSeed[] = [
  { id: "vg-prod-secrets", name: "prod-secrets", linkedKeyVault: "kv-ado-prod", variables: [
    { k: "AZ_TENANT_ID", v: "********", secret: true },
    { k: "AZ_CLIENT_ID", v: "********", secret: true },
    { k: "SQL_CONN_STRING", v: "********", secret: true },
  ] },
  { id: "vg-prod-config", name: "prod-config", linkedKeyVault: null, variables: [
    { k: "LOG_LEVEL", v: "warning", secret: false },
    { k: "API_BASE_URL", v: "https://api.cloudlab.in", secret: false },
    { k: "FEATURE_FLAGS", v: "sso,darkmode,billing-v2", secret: false },
  ] },
  { id: "vg-staging-secrets", name: "staging-secrets", linkedKeyVault: "kv-ado-stg", variables: [
    { k: "AZ_TENANT_ID", v: "********", secret: true },
    { k: "DB_PASS", v: "********", secret: true },
  ] },
  { id: "vg-az-service-principals", name: "azure-service-principals", linkedKeyVault: "kv-ado-prod", variables: [
    { k: "SP_CLIENT_ID", v: "********", secret: true },
    { k: "SP_CLIENT_SECRET", v: "********", secret: true },
  ] },
  { id: "vg-compliance-tags", name: "compliance-tags", linkedKeyVault: null, variables: [
    { k: "COST_CENTER", v: "ENG-2026", secret: false },
    { k: "DATA_CLASSIFICATION", v: "Confidential", secret: false },
  ] },
];

const SECURE_FILES: AdoSecureFile[] = [
  { id: "sf-1", name: "prod-jumpbox-ssh.pem", uploaded: "2026-01-04", size: "3.2 KB" },
  { id: "sf-2", name: "apns-cert-prod.p12", uploaded: "2026-02-18", size: "4.8 KB" },
  { id: "sf-3", name: "codesign-cert.cer", uploaded: "2026-03-22", size: "2.4 KB" },
  { id: "sf-4", name: "signing-key.jks", uploaded: "2026-01-30", size: "5 KB" },
  { id: "sf-5", name: "mac-cert.p12", uploaded: "2026-04-02", size: "14 KB" },
];

const SERVICE_CONNECTIONS: AdoServiceConnection[] = [
  { id: "sc-1", name: "azure-prod-east", type: "Azure Resource Manager", scope: "sub: prod-east (workload identity federation)", verified: true },
  { id: "sc-2", name: "azure-prod-west", type: "Azure Resource Manager", scope: "sub: prod-west (workload identity federation)", verified: true },
  { id: "sc-3", name: "azure-prod-eu", type: "Azure Resource Manager", scope: "sub: prod-eu (workload identity federation)", verified: true },
  { id: "sc-4", name: "acr-prod", type: "Docker Registry (Azure CR)", scope: "acr.prod.azurecr.io (managed identity)", verified: true },
  { id: "sc-5", name: "github-org-readonly", type: "GitHub", scope: "org: contoso-eng", verified: true },
  { id: "sc-6", name: "snyk-org", type: "Snyk", scope: "org: contoso", verified: true },
  { id: "sc-7", name: "sonarcloud-org", type: "SonarCloud", scope: "org: contoso", verified: true },
  { id: "sc-8", name: "service-now-prod", type: "Generic", scope: "instance: contoso.service-now.com", verified: true },
  { id: "sc-9", name: "play-store-svc", type: "Google Play", scope: "play.google.com/cloudlab", verified: true },
];

const TASK_GROUPS: AdoTaskGroup[] = [
  { id: "tg-1", name: "Standard build + publish", description: "Restore, build, test, publish pipeline artifact.", steps: ["Restore dependencies", "Build", "Run unit tests", "Publish pipeline artifact"] },
  { id: "tg-2", name: "Container build + push", description: "Build a Docker image and push to ACR.", steps: ["Docker build", "Docker tag", "Docker push"] },
  { id: "tg-3", name: "Terraform plan + apply", description: "Standard IaC gate with manual approval between plan and apply.", steps: ["terraform init", "terraform plan", "Manual approval", "terraform apply"] },
];

const DEPLOYMENT_GROUPS: AdoDeploymentGroup[] = [
  { id: "dg-1", name: "web-prod-iis-pool", targets: 8, tags: ["iis", "prod", "east"] },
  { id: "dg-2", name: "web-prod-iis-eu", targets: 4, tags: ["iis", "prod", "eu"] },
  { id: "dg-3", name: "app-prod-windsvc", targets: 6, tags: ["windsvc", "prod"] },
];

// ===== Test plans =====
// Ported from ado-testplans.js `suites(prefix, count)` — deterministic outcome cycling
// via index % 6 against a fixed outcome list, NOT random.
const TEST_CASE_TITLES = ["Login flow", "Signup flow", "Search results", "Cart checkout", "Payment UPI", "Payment Card", "Profile edit", "Logout", "Forgot password", "Multi-tenant switch"];
const TEST_OUTCOME_CYCLE: AdoTestCase["outcome"][] = ["Passed", "Passed", "Passed", "Failed", "Blocked", "Not Run"];

function seedTestCases(prefix: string, count: number): AdoTestCase[] {
  const arr: AdoTestCase[] = [];
  for (let i = 1; i <= count; i++) {
    arr.push({
      id: `${prefix}-tc-${i}`,
      title: `${prefix} test ${i} - ${TEST_CASE_TITLES[i % TEST_CASE_TITLES.length]}`,
      steps: ["Open the application", "Trigger the test action", "Verify state"],
      outcome: TEST_OUTCOME_CYCLE[i % TEST_OUTCOME_CYCLE.length],
      assignedTester: TEAM[i % TEAM.length].name,
    });
  }
  return arr;
}

function seedTestPlans(): AdoTestPlan[] {
  const suite = (id: string, name: string, prefix: string, count: number): AdoTestSuite => ({ id, name, cases: seedTestCases(prefix, count) });
  return [
    {
      id: "tp-regression",
      name: "Regression Suite",
      project: "proj-webapp",
      iteration: "Sprint 124",
      suites: [
        suite("s-1", "Smoke", "REG", 15),
        suite("s-2", "Functional", "FUN", 20),
        suite("s-3", "Cross-browser", "CRO", 15),
      ],
    },
    {
      id: "tp-sanity",
      name: "Sanity Suite",
      project: "proj-webapp",
      iteration: "Sprint 124",
      suites: [
        suite("s-4", "Critical paths", "SAN", 25),
        suite("s-5", "Quick smoke", "QSM", 25),
      ],
    },
  ];
}

// ===== Artifacts / Feeds =====
const FEEDS: AdoFeed[] = [
  {
    id: "feed-npm",
    name: "npm-internal",
    type: "npm",
    upstream: ["npmjs.org"],
    packages: [
      { name: "@cloudlab/ui-components", versions: [
        { version: "1.2.3", publishedOn: "2026-04-16", downloads: 2647 },
        { version: "1.2.2", publishedOn: "2026-04-02", downloads: 1084 },
        { version: "1.2.1", publishedOn: "2026-03-19", downloads: 642 },
        { version: "1.2.0", publishedOn: "2026-03-05", downloads: 439 },
      ], downloads: 4812 },
      { name: "@cloudlab/auth-client", versions: [
        { version: "0.9.7", publishedOn: "2026-04-20", downloads: 1210 },
        { version: "0.9.6", publishedOn: "2026-04-06", downloads: 561 },
        { version: "0.9.5", publishedOn: "2026-03-23", downloads: 333 },
      ], downloads: 2104 },
      { name: "@cloudlab/logger", versions: [
        { version: "2.1.0", publishedOn: "2026-04-25", downloads: 4950 },
        { version: "2.0.0", publishedOn: "2026-04-11", downloads: 4040 },
      ], downloads: 8990 },
    ],
  },
  {
    id: "feed-nuget",
    name: "nuget-internal",
    type: "NuGet",
    upstream: ["nuget.org"],
    packages: [
      { name: "CloudLab.Auth", versions: [
        { version: "3.4.0", publishedOn: "2026-04-18", downloads: 685 },
        { version: "3.3.0", publishedOn: "2026-04-04", downloads: 342 },
        { version: "3.2.0", publishedOn: "2026-03-21", downloads: 218 },
      ], downloads: 1245 },
      { name: "CloudLab.Logging", versions: [
        { version: "1.0.5", publishedOn: "2026-04-22", downloads: 539 },
        { version: "1.0.4", publishedOn: "2026-04-08", downloads: 441 },
      ], downloads: 980 },
    ],
  },
  {
    id: "feed-maven",
    name: "maven-internal",
    type: "Maven",
    upstream: ["maven-central"],
    packages: [
      { name: "in.cloudlab:auth-sdk", versions: [
        { version: "2.0.0", publishedOn: "2026-04-14", downloads: 315 },
        { version: "1.9.0", publishedOn: "2026-03-31", downloads: 225 },
      ], downloads: 540 },
      { name: "in.cloudlab:logging-sdk", versions: [
        { version: "1.0.0", publishedOn: "2026-04-10", downloads: 230 },
      ], downloads: 230 },
    ],
  },
];

// ===== Activity log =====
// Source's `activityLog` shape here is { when, actor, action, target } — using the
// local-fallback roster's activity feed (source's non-CloudLabInfra else-branch),
// consistent with the roster shape decision above.
const ACTIVITY_LOG: AdoActivityEntry[] = [
  { when: "2026-05-13 10:14", actor: "Rohit Kapoor", action: "pushed", target: "feature/login (3 commits)" },
  { when: "2026-05-13 09:42", actor: "Deepika Rao", action: "merged PR", target: "#102 Refactor circuit breaker" },
  { when: "2026-05-13 09:10", actor: "Manish Tiwari", action: "ran pipeline", target: "webapp-build #842" },
  { when: "2026-05-12 17:48", actor: "Sneha Iyer", action: "created bug", target: "#1057 Login throws 500 on Safari iOS" },
  { when: "2026-05-12 15:22", actor: "Vikram Singh", action: "approved PR", target: "#102 Refactor circuit breaker" },
  { when: "2026-05-11 11:05", actor: "Anjali Mehta", action: "recorded test result", target: "REG-tc-4 -> Failed" },
];

export function freshAdoState(): AdoState {
  const pipelines = seedPipelines();
  return {
    currentOrg: "org-training",
    currentProject: "proj-webapp",
    orgs: ORGS,
    projects: PROJECTS,
    team: TEAM,
    iterations: ITERATIONS,
    areas: AREAS,
    workItems: seedWorkItems(),
    repos: seedRepos(),
    pipelines,
    pipelineRuns: seedRuns(pipelines),
    releases: RELEASES,
    environments: ENVIRONMENTS,
    variableGroups: VARIABLE_GROUPS.map((g) => ({ id: g.id, name: g.name, linkedKeyVault: g.linkedKeyVault, variables: g.variables })),
    secureFiles: SECURE_FILES,
    serviceConnections: SERVICE_CONNECTIONS,
    taskGroups: TASK_GROUPS,
    deploymentGroups: DEPLOYMENT_GROUPS,
    pipelineFolders: [{ id: "pf-root", name: "\\" }],
    testPlans: seedTestPlans(),
    feeds: FEEDS,
    // Fixes source's "saved queries lost on reload" gap — starts empty, real
    // persisted state once ADD_SAVED_QUERY/DELETE_SAVED_QUERY are dispatched.
    savedQueries: [],
    activityLog: ACTIVITY_LOG,
  };
}
