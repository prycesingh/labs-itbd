import type {
  AdoActivityEntry,
  AdoBranch,
  AdoBranchPolicies,
  AdoDeploymentGroup,
  AdoEnvironment,
  AdoFeed,
  AdoPackage,
  AdoPipeline,
  AdoPipelineFolder,
  AdoPipelineRun,
  AdoPullRequest,
  AdoPush,
  AdoSavedQuery,
  AdoSecureFile,
  AdoServiceConnection,
  AdoState,
  AdoTag,
  AdoTaskGroup,
  AdoTestOutcome,
  AdoVariableGroup,
  AdoWorkItem,
  AdoWorkItemType,
} from "./types";
import { advanceStageRuns, computeRunDuration, createStageRuns, parseStagesFromYaml } from "./pipeline-engine";

const DEFAULT_ACTOR = "admin@itbd.net";

// Ported house style from purview/reducer.ts (itself ported from sentinel/defender).
// `log()` — prepends an activity entry and caps the log at 200 entries.
function log(state: AdoState, action: string, target: string): AdoActivityEntry[] {
  const entry: AdoActivityEntry = { when: new Date().toISOString(), actor: DEFAULT_ACTOR, action, target };
  return [entry, ...state.activityLog].slice(0, 200);
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

// Linear work-item state FSMs. Task uses a 3-state flow; everything else (Epic,
// Feature, User Story, Bug) uses the standard 4-state flow.
const TASK_STATES = ["To Do", "In Progress", "Done"] as const;
const STANDARD_STATES = ["New", "Active", "Resolved", "Closed"] as const;

function nextWorkItemState(type: AdoWorkItemType, current: string): string {
  const states: readonly string[] = type === "Task" ? TASK_STATES : STANDARD_STATES;
  const idx = states.indexOf(current);
  if (idx === -1 || idx === states.length - 1) return current;
  return states[idx + 1];
}

export type AdoAction =
  | { type: "LOAD_STATE"; state: AdoState }

  // ───────── Org / project context ─────────
  | { type: "SWITCH_ORG"; orgId: string }
  | { type: "SWITCH_PROJECT"; projectId: string }

  // ───────── Work items ─────────
  | { type: "ADD_WORK_ITEM"; item: AdoWorkItem }
  | { type: "UPDATE_WORK_ITEM"; id: number; patch: Partial<AdoWorkItem> }
  | { type: "ADD_WORK_ITEM_COMMENT"; id: number; author: string; text: string }
  | { type: "ADVANCE_WORK_ITEM_STATE"; id: number }
  | { type: "MOVE_WORK_ITEM_TO_STATE"; id: number; state: string }

  // ───────── Saved queries (real persisted) ─────────
  | { type: "ADD_SAVED_QUERY"; query: AdoSavedQuery }
  | { type: "DELETE_SAVED_QUERY"; id: string }

  // ───────── Repos: branches ─────────
  | { type: "ADD_REPO_BRANCH"; repoId: string; branch: AdoBranch }
  | { type: "DELETE_REPO_BRANCH"; repoId: string; branchName: string }
  | { type: "UPDATE_BRANCH_POLICIES"; repoId: string; branchName: string; patch: Partial<AdoBranchPolicies> }

  // ───────── Repos: file overrides ─────────
  | { type: "SET_FILE_OVERRIDE"; repoId: string; path: string; content: string }

  // ───────── Repos: pull requests ─────────
  | { type: "ADD_PULL_REQUEST"; repoId: string; pr: AdoPullRequest }
  | { type: "VOTE_ON_PR"; repoId: string; prId: number; vote: AdoPullRequest["vote"] }
  | { type: "COMPLETE_PR"; repoId: string; prId: number }
  | { type: "ADD_PR_THREAD"; repoId: string; prId: number; author: string; text: string }

  // ───────── Repos: tags / pushes ─────────
  | { type: "ADD_TAG"; repoId: string; tag: AdoTag }
  | { type: "ADD_PUSH"; repoId: string; push: AdoPush }

  // ───────── Pipelines ─────────
  | { type: "ADD_PIPELINE"; pipeline: AdoPipeline }
  | { type: "SET_PIPELINE_YAML"; id: string; yaml: string }
  | { type: "DELETE_PIPELINE"; id: string }

  // ───────── Pipeline runs (state machine) ─────────
  | { type: "START_PIPELINE_RUN"; pipelineId: string; branch: string; triggeredBy: string; reason: string }
  | { type: "ADVANCE_PIPELINE_RUN"; runId: string }
  | { type: "CANCEL_PIPELINE_RUN"; runId: string }

  // ───────── Pipelines: environments / library / connections / folders ─────────
  | { type: "ADD_ENVIRONMENT"; environment: AdoEnvironment }
  | { type: "ADD_VARIABLE_GROUP"; group: AdoVariableGroup }
  | { type: "ADD_SERVICE_CONNECTION"; connection: AdoServiceConnection }
  | { type: "ADD_SECURE_FILE"; file: AdoSecureFile }
  | { type: "ADD_TASK_GROUP"; group: AdoTaskGroup }
  | { type: "ADD_DEPLOYMENT_GROUP"; group: AdoDeploymentGroup }
  | { type: "ADD_PIPELINE_FOLDER"; folder: AdoPipelineFolder }

  // ───────── Test plans ─────────
  | { type: "RECORD_TEST_STEP_RESULT"; planId: string; suiteId: string; caseId: string; outcome: AdoTestOutcome }

  // ───────── Artifacts ─────────
  | { type: "ADD_FEED"; feed: AdoFeed }
  | { type: "ADD_PACKAGE"; feedId: string; package: AdoPackage };

export function adoReducer(state: AdoState, action: AdoAction): AdoState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    // ───────── Org / project context ─────────
    case "SWITCH_ORG": {
      const org = state.orgs.find((o) => o.id === action.orgId);
      if (!org) return state;
      const firstProject = state.projects.find((p) => p.org === action.orgId);
      return {
        ...state,
        currentOrg: action.orgId,
        currentProject: firstProject ? firstProject.id : state.currentProject,
        activityLog: log(state, "Switch organization", org.name),
      };
    }

    case "SWITCH_PROJECT": {
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project) return state;
      return {
        ...state,
        currentProject: action.projectId,
        activityLog: log(state, "Switch project", project.name),
      };
    }

    // ───────── Work items ─────────
    case "ADD_WORK_ITEM":
      return {
        ...state,
        workItems: [...state.workItems, action.item],
        activityLog: log(state, "Create work item", `#${action.item.id} ${action.item.title}`),
      };

    case "UPDATE_WORK_ITEM": {
      const item = state.workItems.find((w) => w.id === action.id);
      if (!item) return state;
      const changedDate = new Date().toISOString().substring(0, 10);
      return {
        ...state,
        workItems: state.workItems.map((w) => (w.id === action.id ? { ...w, ...action.patch, changedDate } : w)),
        activityLog: log(state, "Update work item", `#${item.id} ${item.title}`),
      };
    }

    case "ADD_WORK_ITEM_COMMENT": {
      const item = state.workItems.find((w) => w.id === action.id);
      if (!item) return state;
      const comment = { id: genId("c"), author: action.author, when: new Date().toISOString().substring(0, 10), text: action.text };
      return {
        ...state,
        workItems: state.workItems.map((w) => (w.id === action.id ? { ...w, comments: [...w.comments, comment] } : w)),
        activityLog: log(state, "Comment on work item", `#${item.id} ${item.title}`),
      };
    }

    case "ADVANCE_WORK_ITEM_STATE": {
      const item = state.workItems.find((w) => w.id === action.id);
      if (!item) return state;
      const nextState = nextWorkItemState(item.type, item.state);
      if (nextState === item.state) return state;
      const changedDate = new Date().toISOString().substring(0, 10);
      const historyEntry = { when: changedDate, actor: item.assignedTo, change: `State changed from ${item.state} to ${nextState}` };
      return {
        ...state,
        workItems: state.workItems.map((w) =>
          w.id === action.id ? { ...w, state: nextState, changedDate, history: [...w.history, historyEntry] } : w,
        ),
        activityLog: log(state, "Advance work item state", `#${item.id} ${item.title} → ${nextState}`),
      };
    }

    case "MOVE_WORK_ITEM_TO_STATE": {
      const item = state.workItems.find((w) => w.id === action.id);
      if (!item) return state;
      if (item.state === action.state) return state;
      const changedDate = new Date().toISOString().substring(0, 10);
      const historyEntry = { when: changedDate, actor: item.assignedTo, change: `State changed from ${item.state} to ${action.state}` };
      return {
        ...state,
        workItems: state.workItems.map((w) =>
          w.id === action.id ? { ...w, state: action.state, changedDate, history: [...w.history, historyEntry] } : w,
        ),
        activityLog: log(state, "Move work item", `#${item.id} ${item.title} → ${action.state}`),
      };
    }

    // ───────── Saved queries ─────────
    case "ADD_SAVED_QUERY":
      return {
        ...state,
        savedQueries: [...state.savedQueries, action.query],
        activityLog: log(state, "Save query", action.query.name),
      };

    case "DELETE_SAVED_QUERY": {
      const query = state.savedQueries.find((q) => q.id === action.id);
      if (!query) return state;
      return {
        ...state,
        savedQueries: state.savedQueries.filter((q) => q.id !== action.id),
        activityLog: log(state, "Delete saved query", query.name),
      };
    }

    // ───────── Repos: branches ─────────
    case "ADD_REPO_BRANCH": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.map((r) => (r.id === action.repoId ? { ...r, branches: [...r.branches, action.branch] } : r)),
        activityLog: log(state, "Create branch", `${action.branch.name} → ${repo.name}`),
      };
    }

    case "DELETE_REPO_BRANCH": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId ? { ...r, branches: r.branches.filter((b) => b.name !== action.branchName) } : r,
        ),
        activityLog: log(state, "Delete branch", `${action.branchName} → ${repo.name}`),
      };
    }

    case "UPDATE_BRANCH_POLICIES": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      const branch = repo.branches.find((b) => b.name === action.branchName);
      if (!branch) return state;
      const nextPolicies: AdoBranchPolicies = { ...(branch.policies as AdoBranchPolicies), ...action.patch };
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId
            ? { ...r, branches: r.branches.map((b) => (b.name === action.branchName ? { ...b, policies: nextPolicies } : b)) }
            : r,
        ),
        activityLog: log(state, "Update branch policies", `${action.branchName} → ${repo.name}`),
      };
    }

    // ───────── Repos: file overrides ─────────
    case "SET_FILE_OVERRIDE": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId ? { ...r, fileOverrides: { ...r.fileOverrides, [action.path]: action.content } } : r,
        ),
        activityLog: log(state, "Edit file", `${action.path} → ${repo.name}`),
      };
    }

    // ───────── Repos: pull requests ─────────
    case "ADD_PULL_REQUEST": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.map((r) => (r.id === action.repoId ? { ...r, pullRequests: [...r.pullRequests, action.pr] } : r)),
        activityLog: log(state, "Create pull request", `#${action.pr.id} ${action.pr.title} → ${repo.name}`),
      };
    }

    case "VOTE_ON_PR": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      const pr = repo.pullRequests.find((p) => p.id === action.prId);
      if (!pr) return state;
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId
            ? { ...r, pullRequests: r.pullRequests.map((p) => (p.id === action.prId ? { ...p, vote: action.vote } : p)) }
            : r,
        ),
        activityLog: log(state, "Vote on pull request", `#${pr.id} ${pr.title} → ${action.vote}`),
      };
    }

    case "COMPLETE_PR": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      const pr = repo.pullRequests.find((p) => p.id === action.prId);
      if (!pr) return state;
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId
            ? { ...r, pullRequests: r.pullRequests.map((p) => (p.id === action.prId ? { ...p, status: "Completed" } : p)) }
            : r,
        ),
        activityLog: log(state, "Complete pull request", `#${pr.id} ${pr.title} → ${repo.name}`),
      };
    }

    case "ADD_PR_THREAD": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      const pr = repo.pullRequests.find((p) => p.id === action.prId);
      if (!pr) return state;
      const thread = { id: genId("t"), author: action.author, when: new Date().toISOString().substring(0, 10), text: action.text };
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId
            ? { ...r, pullRequests: r.pullRequests.map((p) => (p.id === action.prId ? { ...p, threads: [...p.threads, thread] } : p)) }
            : r,
        ),
        activityLog: log(state, "Comment on pull request", `#${pr.id} ${pr.title} → ${repo.name}`),
      };
    }

    // ───────── Repos: tags / pushes ─────────
    case "ADD_TAG": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.map((r) => (r.id === action.repoId ? { ...r, tags: [...r.tags, action.tag] } : r)),
        activityLog: log(state, "Create tag", `${action.tag.name} → ${repo.name}`),
      };
    }

    case "ADD_PUSH": {
      const repo = state.repos.find((r) => r.id === action.repoId);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.map((r) => (r.id === action.repoId ? { ...r, pushes: [action.push, ...r.pushes] } : r)),
        activityLog: log(state, "Push commits", `${action.push.branch} → ${repo.name}`),
      };
    }

    // ───────── Pipelines ─────────
    case "ADD_PIPELINE": {
      // Stages are (re-)derived from the YAML here so callers never need to worry
      // about keeping `.stages` in sync with `.yaml` themselves.
      const pipeline: AdoPipeline = { ...action.pipeline, stages: parseStagesFromYaml(action.pipeline.yaml) };
      return {
        ...state,
        pipelines: [...state.pipelines, pipeline],
        activityLog: log(state, "Create pipeline", pipeline.name),
      };
    }

    case "SET_PIPELINE_YAML": {
      const pipeline = state.pipelines.find((p) => p.id === action.id);
      if (!pipeline) return state;
      const stages = parseStagesFromYaml(action.yaml);
      return {
        ...state,
        pipelines: state.pipelines.map((p) => (p.id === action.id ? { ...p, yaml: action.yaml, stages } : p)),
        activityLog: log(state, "Update pipeline YAML", pipeline.name),
      };
    }

    case "DELETE_PIPELINE": {
      const pipeline = state.pipelines.find((p) => p.id === action.id);
      if (!pipeline) return state;
      return {
        ...state,
        pipelines: state.pipelines.filter((p) => p.id !== action.id),
        activityLog: log(state, "Delete pipeline", pipeline.name),
      };
    }

    // ───────── Pipeline runs (state machine) ─────────
    case "START_PIPELINE_RUN": {
      const pipeline = state.pipelines.find((p) => p.id === action.pipelineId);
      if (!pipeline) return state;
      const stageRuns = createStageRuns(pipeline.stages);
      const maxRunNumber = state.pipelineRuns.reduce((max, r) => Math.max(max, r.runNumber), 800);
      const startedAtMs = Date.now();
      const run = {
        id: genId("run"),
        runNumber: maxRunNumber + 1,
        pipeline: pipeline.id,
        branch: action.branch,
        commit: Math.random().toString(16).slice(2, 10),
        triggeredBy: action.triggeredBy,
        status: "Running" as const,
        duration: "0m 0s",
        when: new Date().toISOString().substring(0, 10),
        reason: action.reason,
        stageRuns,
        startedAtMs,
      };
      return {
        ...state,
        pipelineRuns: [run, ...state.pipelineRuns],
        activityLog: log(state, "Start pipeline run", `${pipeline.name} #${run.runNumber} (${action.branch})`),
      };
    }

    case "ADVANCE_PIPELINE_RUN": {
      const run = state.pipelineRuns.find((r) => r.id === action.runId);
      if (!run || run.status !== "Running") return state;
      const pipeline = state.pipelines.find((p) => p.id === run.pipeline);
      // Seed derived from the run's own id/runNumber combined with how many stages
      // have already resolved, so repeated calls against the same run progress
      // deterministically (same call count → same outcome) without Math.random().
      const resolvedCount = run.stageRuns.filter((s) => s.status !== "Pending" && s.status !== "Running").length;
      const seed = run.runNumber * 1000 + resolvedCount * 31 + run.id.length;
      const { stageRuns, runStatus } = advanceStageRuns(run.stageRuns, seed);
      const duration = computeRunDuration(stageRuns);
      const nextStatus: AdoPipelineRun["status"] = runStatus;
      const updatedRuns = state.pipelineRuns.map((r) => (r.id === action.runId ? { ...r, stageRuns, status: nextStatus, duration } : r));

      if (runStatus !== "Running") {
        return {
          ...state,
          pipelineRuns: updatedRuns,
          activityLog: log(state, "Pipeline run finished", `${pipeline ? pipeline.name : run.pipeline} #${run.runNumber} → ${runStatus}`),
        };
      }
      return { ...state, pipelineRuns: updatedRuns };
    }

    case "CANCEL_PIPELINE_RUN": {
      const run = state.pipelineRuns.find((r) => r.id === action.runId);
      if (!run) return state;
      const pipeline = state.pipelines.find((p) => p.id === run.pipeline);
      const cancelStageRuns = run.stageRuns.map((s) =>
        s.status === "Running" || s.status === "Pending" ? { ...s, status: "Canceled" as const } : s,
      );
      return {
        ...state,
        pipelineRuns: state.pipelineRuns.map((r) =>
          r.id === action.runId ? { ...r, status: "Canceled", stageRuns: cancelStageRuns, duration: computeRunDuration(cancelStageRuns) } : r,
        ),
        activityLog: log(state, "Cancel pipeline run", `${pipeline ? pipeline.name : run.pipeline} #${run.runNumber}`),
      };
    }

    // ───────── Pipelines: environments / library / connections / folders ─────────
    case "ADD_ENVIRONMENT":
      return {
        ...state,
        environments: [...state.environments, action.environment],
        activityLog: log(state, "Create environment", action.environment.name),
      };

    case "ADD_VARIABLE_GROUP":
      return {
        ...state,
        variableGroups: [...state.variableGroups, action.group],
        activityLog: log(state, "Create variable group", action.group.name),
      };

    case "ADD_SERVICE_CONNECTION":
      return {
        ...state,
        serviceConnections: [...state.serviceConnections, action.connection],
        activityLog: log(state, "Create service connection", action.connection.name),
      };

    case "ADD_SECURE_FILE":
      return {
        ...state,
        secureFiles: [...state.secureFiles, action.file],
        activityLog: log(state, "Upload secure file", action.file.name),
      };

    case "ADD_TASK_GROUP":
      return {
        ...state,
        taskGroups: [...state.taskGroups, action.group],
        activityLog: log(state, "Create task group", action.group.name),
      };

    case "ADD_DEPLOYMENT_GROUP":
      return {
        ...state,
        deploymentGroups: [...state.deploymentGroups, action.group],
        activityLog: log(state, "Create deployment group", action.group.name),
      };

    case "ADD_PIPELINE_FOLDER":
      return {
        ...state,
        pipelineFolders: [...state.pipelineFolders, action.folder],
        activityLog: log(state, "Create pipeline folder", action.folder.name),
      };

    // ───────── Test plans ─────────
    case "RECORD_TEST_STEP_RESULT": {
      const plan = state.testPlans.find((p) => p.id === action.planId);
      if (!plan) return state;
      const suite = plan.suites.find((s) => s.id === action.suiteId);
      if (!suite) return state;
      const testCase = suite.cases.find((c) => c.id === action.caseId);
      if (!testCase) return state;
      return {
        ...state,
        testPlans: state.testPlans.map((p) =>
          p.id === action.planId
            ? {
                ...p,
                suites: p.suites.map((s) =>
                  s.id === action.suiteId
                    ? { ...s, cases: s.cases.map((c) => (c.id === action.caseId ? { ...c, outcome: action.outcome } : c)) }
                    : s,
                ),
              }
            : p,
        ),
        activityLog: log(state, "Record test result", `${testCase.id} ${testCase.title} → ${action.outcome}`),
      };
    }

    // ───────── Artifacts ─────────
    case "ADD_FEED":
      return {
        ...state,
        feeds: [...state.feeds, action.feed],
        activityLog: log(state, "Create feed", action.feed.name),
      };

    case "ADD_PACKAGE": {
      const feed = state.feeds.find((f) => f.id === action.feedId);
      if (!feed) return state;
      return {
        ...state,
        feeds: state.feeds.map((f) => (f.id === action.feedId ? { ...f, packages: [...f.packages, action.package] } : f)),
        activityLog: log(state, "Publish package", `${action.package.name} → ${feed.name}`),
      };
    }

    default:
      return state;
  }
}
