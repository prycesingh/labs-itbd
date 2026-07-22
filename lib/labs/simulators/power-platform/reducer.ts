import type {
  PpApp,
  PpAuditEntry,
  PpBiTenantSettings,
  PpBiWorkspace,
  PpChatMessage,
  PpCopilotBot,
  PpEnvironment,
  PpFlow,
  PpFlowRun,
  PpLockboxRequest,
  PpPagesSite,
  PpPolicy,
  PpState,
} from "./types";
import { advanceFlowRun, clampFailRate, computeRunDuration, deriveRunSteps } from "./flow-run-engine";
import { applyDlpFlags } from "./dlp-engine";

const DEFAULT_ACTOR = "admin@itbd.net";

// Ported house style from azure-devops/reducer.ts (itself ported from purview /
// sentinel / defender). `log()` — prepends an activity entry and caps the log at 200
// entries. Power Platform's `PpAuditEntry` shape (`ts`/`actor`/`action`/`target`/
// `status`) doubles as both the "activity log" and the tenant "audit log" in this
// state — both concepts map onto `state.auditLog` here (there is no separate
// `activityLog` array in `PpState`, unlike Azure DevOps).
function log(state: PpState, operation: string, target: string, status: PpAuditEntry["status"] = "Succeeded"): PpAuditEntry[] {
  const entry: PpAuditEntry = { ts: new Date().toISOString(), actor: DEFAULT_ACTOR, action: operation, target, status };
  return [entry, ...state.auditLog].slice(0, 200);
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

export type PpAction =
  | { type: "LOAD_STATE"; state: PpState }

  // ───────── Environments ─────────
  | { type: "ADD_ENVIRONMENT"; environment: PpEnvironment }
  | { type: "UPDATE_ENVIRONMENT"; id: string; patch: Partial<PpEnvironment> }
  | { type: "DELETE_ENVIRONMENT"; id: string }
  | { type: "RESET_ENVIRONMENT_DATABASE"; id: string }

  // ───────── Apps ─────────
  | { type: "ADD_APP"; app: PpApp }
  | { type: "UPDATE_APP"; id: string; patch: Partial<PpApp> }
  | { type: "SHARE_APP"; id: string }

  // ───────── Flows (CRUD) ─────────
  | { type: "ADD_FLOW"; flow: PpFlow }
  | { type: "UPDATE_FLOW"; id: string; patch: Partial<PpFlow> }
  | { type: "TOGGLE_FLOW_STATUS"; id: string }

  // ───────── Flow runs (state machine — real engine) ─────────
  | { type: "START_FLOW_RUN"; flowId: string }
  | { type: "ADVANCE_FLOW_RUN"; runId: string }
  | { type: "CANCEL_FLOW_RUN"; runId: string }

  // ───────── DLP policies ─────────
  | { type: "ADD_POLICY"; policy: PpPolicy }
  | { type: "UPDATE_POLICY"; id: string; patch: Partial<PpPolicy> }
  | { type: "DELETE_POLICY"; id: string }
  | { type: "TOGGLE_POLICY_STATUS"; id: string }
  | { type: "RECOMPUTE_DLP_FLAGS" }

  // ───────── Capacity / licenses ─────────
  | { type: "ADD_CAPACITY"; bucket: "database" | "file" | "log"; gb: number }
  | { type: "ADD_AI_CREDITS"; credits: number }
  | { type: "PURCHASE_LICENSE"; sku: string; count: number }

  // ───────── Power Pages ─────────
  | { type: "ADD_PAGES_SITE"; site: PpPagesSite }
  | { type: "TOGGLE_PAGES_SITE"; id: string }
  | { type: "DELETE_PAGES_SITE"; id: string }

  // ───────── Power BI ─────────
  | { type: "ADD_BI_WORKSPACE"; workspace: PpBiWorkspace }
  | { type: "UPDATE_BI_TENANT_SETTINGS"; patch: Partial<PpBiTenantSettings> }

  // ───────── Security: tenant isolation / lockbox / CMK ─────────
  | { type: "TOGGLE_TENANT_ISOLATION" }
  | { type: "ADD_ISOLATION_ALLOWED_DOMAIN"; domain: string }
  | { type: "REMOVE_ISOLATION_ALLOWED_DOMAIN"; domain: string }
  | { type: "TOGGLE_LOCKBOX" }
  | { type: "RESOLVE_LOCKBOX_REQUEST"; id: string; status: "Approved" | "Denied" }
  | { type: "START_CMK_SETUP"; keyVaultUri: string }
  | { type: "ADVANCE_CMK_SETUP" }

  // ───────── Copilot Studio ─────────
  | { type: "ADD_COPILOT_BOT"; bot: PpCopilotBot }
  | { type: "SEND_COPILOT_TEST_MESSAGE"; text: string };

export function ppReducer(state: PpState, action: PpAction): PpState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    // ───────── Environments ─────────
    case "ADD_ENVIRONMENT": {
      const environment: PpEnvironment = {
        ...action.environment,
        state: "Ready",
        createdOn: new Date().toISOString(),
        createdBy: DEFAULT_ACTOR,
      };
      return {
        ...state,
        environments: [...state.environments, environment],
        auditLog: log(state, "Environment created", environment.name),
      };
    }

    case "UPDATE_ENVIRONMENT": {
      const env = state.environments.find((e) => e.id === action.id);
      if (!env) return state;
      return {
        ...state,
        environments: state.environments.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
        auditLog: log(state, "Environment updated", env.name),
      };
    }

    case "DELETE_ENVIRONMENT": {
      const env = state.environments.find((e) => e.id === action.id);
      if (!env) return state;
      return {
        ...state,
        environments: state.environments.filter((e) => e.id !== action.id),
        auditLog: log(state, "Environment deleted", env.name),
      };
    }

    case "RESET_ENVIRONMENT_DATABASE": {
      const env = state.environments.find((e) => e.id === action.id);
      if (!env) return state;
      return {
        ...state,
        environments: state.environments.map((e) => (e.id === action.id ? { ...e, databaseSizeMB: 0 } : e)),
        auditLog: log(state, "Environment database reset", env.name),
      };
    }

    // ───────── Apps ─────────
    case "ADD_APP": {
      const app: PpApp = { ...action.app, created: new Date().toISOString().slice(0, 10), modified: new Date().toISOString().slice(0, 10) };
      const nextState = { ...state, apps: [...state.apps, app], auditLog: log(state, "App created", app.name) };
      return applyDlpFlags(nextState);
    }

    case "UPDATE_APP": {
      const app = state.apps.find((a) => a.id === action.id);
      if (!app) return state;
      const modified = new Date().toISOString().slice(0, 10);
      const nextState = {
        ...state,
        apps: state.apps.map((a) => (a.id === action.id ? { ...a, ...action.patch, modified } : a)),
        auditLog: log(state, "App updated", app.name),
      };
      return applyDlpFlags(nextState);
    }

    case "SHARE_APP": {
      const app = state.apps.find((a) => a.id === action.id);
      if (!app) return state;
      return {
        ...state,
        apps: state.apps.map((a) => (a.id === action.id ? { ...a, sharedCount: a.sharedCount + 1 } : a)),
        auditLog: log(state, "App shared", app.name),
      };
    }

    // ───────── Flows (CRUD) ─────────
    case "ADD_FLOW": {
      const nextState = { ...state, flows: [...state.flows, action.flow], auditLog: log(state, "Flow created", action.flow.name) };
      return applyDlpFlags(nextState);
    }

    case "UPDATE_FLOW": {
      const flow = state.flows.find((f) => f.id === action.id);
      if (!flow) return state;
      const nextState = {
        ...state,
        flows: state.flows.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
        auditLog: log(state, "Flow updated", flow.name),
      };
      return applyDlpFlags(nextState);
    }

    case "TOGGLE_FLOW_STATUS": {
      const flow = state.flows.find((f) => f.id === action.id);
      if (!flow) return state;
      const nextStatus = flow.status === "On" ? "Off" : "On";
      return {
        ...state,
        flows: state.flows.map((f) => (f.id === action.id ? { ...f, status: nextStatus } : f)),
        auditLog: log(state, nextStatus === "On" ? "Flow enabled" : "Flow disabled", flow.name),
      };
    }

    // ───────── Flow runs (real state-machine engine) ─────────
    // Call pattern (see flow-run-engine.ts doc comment): dispatch START_FLOW_RUN on
    // "Run now", then dispatch ADVANCE_FLOW_RUN from a ~2-3s setInterval while the run
    // is "Running", stopping once it reaches a terminal status.
    case "START_FLOW_RUN": {
      const flow = state.flows.find((f) => f.id === action.flowId);
      if (!flow) return state;
      const steps = deriveRunSteps(flow, state.connectors);
      const run: PpFlowRun = {
        id: genId("run"),
        flowId: flow.id,
        status: "Running",
        start: new Date().toISOString(),
        durationSec: null,
        output: "",
        steps,
      };
      return {
        ...state,
        flowRuns: [run, ...state.flowRuns],
        auditLog: log(state, "Flow run started", flow.name),
      };
    }

    case "ADVANCE_FLOW_RUN": {
      const run = state.flowRuns.find((r) => r.id === action.runId);
      if (!run || run.status !== "Running") return state;
      const flow = state.flows.find((f) => f.id === run.flowId);

      // Seed derived from the run's own id plus how many steps have already resolved,
      // so repeated calls against the same run progress deterministically (same call
      // count -> same outcome) without Math.random() — same convention as Azure
      // DevOps's ADVANCE_PIPELINE_RUN case.
      const resolvedCount = run.steps.filter((s) => s.status !== "Pending" && s.status !== "Running").length;
      const seed = run.id.length * 1000 + resolvedCount * 31;
      const failRate = flow ? clampFailRate(flow.failed, flow.total) : 0.05;
      const { steps, runStatus } = advanceFlowRun(run.steps, failRate, seed);
      const durationSec = computeRunDuration(steps);

      const output = runStatus === "Failed" ? "BadRequest: connector reference invalid" : runStatus === "Succeeded" ? "OK" : "";

      const updatedRuns = state.flowRuns.map((r) => (r.id === action.runId ? { ...r, steps, status: runStatus, durationSec, output } : r));

      if (runStatus === "Running") {
        return { ...state, flowRuns: updatedRuns };
      }

      // Terminal status reached: couple real-usage consequences onto the flow's own
      // counters and tenant capacity, exactly as the task spec requires — a run isn't
      // just a UI animation, it leaves a durable mark on the flow's history and the
      // tenant's flow-run capacity bucket.
      const updatedFlows = flow
        ? state.flows.map((f) => {
            if (f.id !== flow.id) return f;
            const succeeded = runStatus === "Succeeded";
            return {
              ...f,
              total: f.total + 1,
              success: f.success + (succeeded ? 1 : 0),
              failed: f.failed + (succeeded ? 0 : 1),
              lastRun: new Date().toISOString(),
            };
          })
        : state.flows;

      return {
        ...state,
        flowRuns: updatedRuns,
        flows: updatedFlows,
        capacity: { ...state.capacity, flowRuns: { ...state.capacity.flowRuns, used: state.capacity.flowRuns.used + 1 } },
        auditLog: log(state, "Flow run finished", `${flow ? flow.name : run.flowId} -> ${runStatus}`),
      };
    }

    case "CANCEL_FLOW_RUN": {
      const run = state.flowRuns.find((r) => r.id === action.runId);
      if (!run) return state;
      const flow = state.flows.find((f) => f.id === run.flowId);
      const cancelledSteps = run.steps.map((s) => (s.status === "Running" || s.status === "Pending" ? { ...s, status: "Skipped" as const } : s));
      return {
        ...state,
        flowRuns: state.flowRuns.map((r) =>
          r.id === action.runId
            ? { ...r, status: "Cancelled", steps: cancelledSteps, durationSec: computeRunDuration(cancelledSteps), output: "User cancelled" }
            : r,
        ),
        auditLog: log(state, "Flow run cancelled", flow ? flow.name : run.flowId),
      };
    }

    // ───────── DLP policies (every CRUD case auto-recomputes DLP flags) ─────────
    case "ADD_POLICY": {
      const policy: PpPolicy = { ...action.policy, modified: new Date().toISOString(), createdBy: DEFAULT_ACTOR };
      const nextState = { ...state, policies: [...state.policies, policy], auditLog: log(state, "DLP policy created", policy.name) };
      return applyDlpFlags(nextState);
    }

    case "UPDATE_POLICY": {
      const policy = state.policies.find((p) => p.id === action.id);
      if (!policy) return state;
      const modified = new Date().toISOString();
      const nextState = {
        ...state,
        policies: state.policies.map((p) => (p.id === action.id ? { ...p, ...action.patch, modified } : p)),
        auditLog: log(state, "DLP policy modified", policy.name),
      };
      return applyDlpFlags(nextState);
    }

    case "DELETE_POLICY": {
      const policy = state.policies.find((p) => p.id === action.id);
      if (!policy) return state;
      const nextState = { ...state, policies: state.policies.filter((p) => p.id !== action.id), auditLog: log(state, "DLP policy deleted", policy.name) };
      return applyDlpFlags(nextState);
    }

    case "TOGGLE_POLICY_STATUS": {
      const policy = state.policies.find((p) => p.id === action.id);
      if (!policy) return state;
      const nextStatus: PpPolicy["status"] = policy.status === "On" ? "Off" : "On";
      const nextState = {
        ...state,
        policies: state.policies.map((p) => (p.id === action.id ? { ...p, status: nextStatus, modified: new Date().toISOString() } : p)),
        auditLog: log(state, nextStatus === "On" ? "DLP policy enabled" : "DLP policy disabled", policy.name),
      };
      return applyDlpFlags(nextState);
    }

    case "RECOMPUTE_DLP_FLAGS":
      return applyDlpFlags(state);

    // ───────── Capacity / licenses ─────────
    case "ADD_CAPACITY": {
      const bucketName = action.bucket === "database" ? "Database" : action.bucket === "file" ? "File" : "Log";
      return {
        ...state,
        capacity: {
          ...state.capacity,
          [action.bucket]: { ...state.capacity[action.bucket], totalGB: state.capacity[action.bucket].totalGB + action.gb },
        },
        auditLog: log(state, "Capacity added", `${bucketName} +${action.gb} GB`),
      };
    }

    case "ADD_AI_CREDITS":
      return {
        ...state,
        capacity: { ...state.capacity, aiBuilder: { ...state.capacity.aiBuilder, totalCredits: state.capacity.aiBuilder.totalCredits + action.credits } },
        auditLog: log(state, "AI Builder credits added", `+${action.credits} credits`),
      };

    case "PURCHASE_LICENSE": {
      const license = state.licenses.find((l) => l.sku === action.sku);
      if (!license) return state;
      return {
        ...state,
        licenses: state.licenses.map((l) => (l.sku === action.sku ? { ...l, purchased: l.purchased + action.count } : l)),
        auditLog: log(state, "License purchased", `${license.name} x${action.count}`),
      };
    }

    // ───────── Power Pages ─────────
    case "ADD_PAGES_SITE":
      return {
        ...state,
        pagesSites: [...state.pagesSites, action.site],
        auditLog: log(state, "Power Pages site created", action.site.name),
      };

    case "TOGGLE_PAGES_SITE": {
      const site = state.pagesSites.find((s) => s.id === action.id);
      if (!site) return state;
      const nextStatus = site.status === "Active" ? "Inactive" : "Active";
      return {
        ...state,
        pagesSites: state.pagesSites.map((s) => (s.id === action.id ? { ...s, status: nextStatus } : s)),
        auditLog: log(state, nextStatus === "Active" ? "Power Pages site activated" : "Power Pages site deactivated", site.name),
      };
    }

    case "DELETE_PAGES_SITE": {
      const site = state.pagesSites.find((s) => s.id === action.id);
      if (!site) return state;
      return {
        ...state,
        pagesSites: state.pagesSites.filter((s) => s.id !== action.id),
        auditLog: log(state, "Power Pages site deleted", site.name),
      };
    }

    // ───────── Power BI ─────────
    case "ADD_BI_WORKSPACE":
      return {
        ...state,
        powerBI: { ...state.powerBI, workspaces: [...state.powerBI.workspaces, action.workspace] },
        auditLog: log(state, "Power BI workspace created", action.workspace.name),
      };

    case "UPDATE_BI_TENANT_SETTINGS":
      return {
        ...state,
        powerBI: { ...state.powerBI, tenantSettings: { ...state.powerBI.tenantSettings, ...action.patch } },
        auditLog: log(state, "Power BI tenant settings updated", "Tenant settings"),
      };

    // ───────── Security: tenant isolation / lockbox / CMK ─────────
    case "TOGGLE_TENANT_ISOLATION": {
      const nextEnabled = !state.security.isolation.enabled;
      return {
        ...state,
        security: { ...state.security, isolation: { ...state.security.isolation, enabled: nextEnabled } },
        auditLog: log(state, nextEnabled ? "Tenant isolation enabled" : "Tenant isolation disabled", state.tenant.name),
      };
    }

    case "ADD_ISOLATION_ALLOWED_DOMAIN": {
      if (state.security.isolation.allowList.includes(action.domain)) return state;
      return {
        ...state,
        security: { ...state.security, isolation: { ...state.security.isolation, allowList: [...state.security.isolation.allowList, action.domain] } },
        auditLog: log(state, "Tenant isolation allowed domain added", action.domain),
      };
    }

    case "REMOVE_ISOLATION_ALLOWED_DOMAIN":
      return {
        ...state,
        security: {
          ...state.security,
          isolation: { ...state.security.isolation, allowList: state.security.isolation.allowList.filter((d) => d !== action.domain) },
        },
        auditLog: log(state, "Tenant isolation allowed domain removed", action.domain),
      };

    case "TOGGLE_LOCKBOX": {
      const nextEnabled = !state.security.lockbox.enabled;
      return {
        ...state,
        security: { ...state.security, lockbox: { ...state.security.lockbox, enabled: nextEnabled } },
        auditLog: log(state, nextEnabled ? "Customer Lockbox enabled" : "Customer Lockbox disabled", state.tenant.name),
      };
    }

    case "RESOLVE_LOCKBOX_REQUEST": {
      const request = state.security.lockbox.requests.find((r) => r.id === action.id);
      if (!request) return state;
      const updatedRequests: PpLockboxRequest[] = state.security.lockbox.requests.map((r) => (r.id === action.id ? { ...r, status: action.status } : r));
      return {
        ...state,
        security: { ...state.security, lockbox: { ...state.security.lockbox, requests: updatedRequests } },
        auditLog: log(state, `Lockbox request ${action.status.toLowerCase()}`, request.requestedBy),
      };
    }

    case "START_CMK_SETUP":
      return {
        ...state,
        security: { ...state.security, cmk: { enabled: false, keyVaultUri: action.keyVaultUri, status: "Validating" } },
        auditLog: log(state, "Customer-managed key setup started", action.keyVaultUri),
      };

    case "ADVANCE_CMK_SETUP": {
      // Simple 2-3 step status progression (Validating -> Re-encrypting -> Active);
      // the UI drives the timing itself (e.g. its own setTimeout chain) rather than
      // this being a real timer-driven engine like flow runs.
      const current = state.security.cmk.status;
      const next = current === "Validating" ? "Re-encrypting" : current === "Re-encrypting" ? "Active" : current;
      if (next === current) return state;
      return {
        ...state,
        security: { ...state.security, cmk: { ...state.security.cmk, status: next, enabled: next === "Active" } },
        auditLog: log(state, "Customer-managed key setup advanced", next),
      };
    }

    // ───────── Copilot Studio ─────────
    case "ADD_COPILOT_BOT":
      return {
        ...state,
        copilot: { ...state.copilot, copilots: [...state.copilot.copilots, action.bot] },
        auditLog: log(state, "Copilot Studio bot created", action.bot.name),
      };

    case "SEND_COPILOT_TEST_MESSAGE": {
      const text = action.text.trim();
      if (!text) return state;
      const now = new Date().toISOString();
      const userMessage: PpChatMessage = { id: genId("msg"), from: "user", text, ts: now };

      // Real intent-matcher engine — ported from pp-copilot.js `matchIntent()`: scans
      // the seeded intents in order, returns the first whose keyword substring-matches
      // the (lowercased) input text. Confidence is a fixed high value for a keyword
      // hit (source's random 0.78-0.98 range collapses to a deterministic 0.9 here —
      // no Math.random() in reducer logic), and a lower fixed value for the knowledge
      // fallback / "not sure" case, matching source's 0.42 / 0.31 constants.
      const lowered = text.toLowerCase();
      const matchedIntent = state.copilot.intents.find((intent) => intent.keywords.some((kw) => lowered.includes(kw.toLowerCase())));

      let botMessage: PpChatMessage;
      if (matchedIntent) {
        botMessage = { id: genId("msg"), from: "bot", text: matchedIntent.response, confidence: 0.9, ts: now };
      } else if (state.copilot.knowledge.length > 0) {
        botMessage = {
          id: genId("msg"),
          from: "bot",
          text: "Based on the knowledge sources I have access to, I do not see a definitive answer to that. Could you rephrase, or do you want me to escalate to a human?",
          confidence: 0.42,
          ts: now,
        };
      } else {
        botMessage = { id: genId("msg"), from: "bot", text: "I am not sure I can help with that. Want to talk to a human?", confidence: 0.31, ts: now };
      }

      return {
        ...state,
        copilot: { ...state.copilot, testChat: [...state.copilot.testChat, userMessage, botMessage] },
      };
    }

    default:
      return state;
  }
}
