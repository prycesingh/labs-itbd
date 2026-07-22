import type {
  AvdActivityEntry,
  AvdApplicationGroup,
  AvdFslogixConfig,
  AvdHostPool,
  AvdImageTemplate,
  AvdMsixPackage,
  AvdPrivateEndpoint,
  AvdRemoteApp,
  AvdScalingLogEntry,
  AvdScalingPlan,
  AvdSchedule,
  AvdSessionHost,
  AvdState,
  AvdUpdatePlan,
  AvdWorkspace,
} from "./types";

function log(state: AvdState, operation: string, resource: string, status: "Succeeded" | "Failed" = "Succeeded"): AvdActivityEntry[] {
  const entry: AvdActivityEntry = { time: new Date().toISOString(), operation, resource, status };
  return [entry, ...state.activityLog].slice(0, 200);
}

function scalingLog(state: AvdState, pool: string, event: AvdScalingLogEntry["event"], reason: string): AvdScalingLogEntry[] {
  const entry: AvdScalingLogEntry = { time: new Date().toISOString(), pool, event, reason };
  return [entry, ...state.scalingLog].slice(0, 200);
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const DAY_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type AvdPhaseInfo = {
  phase: "Ramp-up" | "Peak" | "Ramp-down" | "Off-peak" | "Off-hours (no schedule)";
  schedule: AvdSchedule | null;
  next: { name: string; start: number } | null;
};

export function currentPhase(plan: AvdScalingPlan, nowDate?: Date): AvdPhaseInfo {
  const now = nowDate ?? new Date();
  const todayShort = DAY_MAP[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const sch = (plan.schedules || []).find((s) => (s.daysOfWeek || []).includes(todayShort));
  if (!sch) return { phase: "Off-hours (no schedule)", schedule: null, next: null };

  const phases = [
    { name: "Ramp-up" as const, start: timeToMinutes(sch.rampUp.start) },
    { name: "Peak" as const, start: timeToMinutes(sch.peak.start) },
    { name: "Ramp-down" as const, start: timeToMinutes(sch.rampDown.start) },
    { name: "Off-peak" as const, start: timeToMinutes(sch.offPeak.start) },
  ].sort((a, b) => a.start - b.start);

  let phase = phases[phases.length - 1];
  let next: { name: string; start: number } | null = null;
  for (const p of phases) {
    if (nowMin >= p.start) phase = p;
    else if (!next) next = p;
  }
  if (!next) next = phases[0];

  return { phase: phase.name, schedule: sch, next };
}

export function computePlannedHosts(plan: AvdScalingPlan, info: AvdPhaseInfo, total: number): number {
  if (!info.schedule || !plan.enabled) return total;
  const sch = info.schedule;
  switch (info.phase) {
    case "Ramp-up":
      return Math.max(1, Math.round(total * (sch.rampUp.minHostsPct / 100)));
    case "Peak":
      return total;
    case "Ramp-down":
      return Math.max(1, Math.round(total * (sch.rampDown.minHostsPct / 100)));
    case "Off-peak":
      return Math.max(1, Math.round(total * (sch.rampDown.minHostsPct / 100)));
    default:
      return total;
  }
}

function applyPhase(sessionHosts: AvdSessionHost[], hostPoolName: string, info: AvdPhaseInfo, plan: AvdScalingPlan): AvdSessionHost[] {
  const inPool = sessionHosts.filter((h) => h.hostPool === hostPoolName);
  const outOfPool = sessionHosts.filter((h) => h.hostPool !== hostPoolName);
  const planned = computePlannedHosts(plan, info, inPool.length);

  const sorted = [...inPool].sort((a, b) => (a.sessions || 0) - (b.sessions || 0));
  const updated = sorted.map((h, i) => {
    if (i < planned) {
      return { ...h, status: "Available" as const, allowNewSessions: true, drainMode: false };
    }
    return {
      ...h,
      status: (info.phase === "Ramp-down" ? "Unavailable" : "Shutdown") as AvdSessionHost["status"],
      sessions: 0,
      drainMode: info.phase === "Ramp-down",
      allowNewSessions: false,
    };
  });

  return [...outOfPool, ...updated];
}

export type AvdAction =
  | { type: "LOAD_STATE"; state: AvdState }
  | { type: "ADD_HOST_POOL"; pool: AvdHostPool }
  | { type: "UPDATE_HOST_POOL"; id: string; patch: Partial<AvdHostPool> }
  | { type: "DELETE_HOST_POOL"; id: string }
  | { type: "ADD_SESSION_HOST"; host: AvdSessionHost }
  | { type: "UPDATE_SESSION_HOST"; id: string; patch: Partial<AvdSessionHost> }
  | { type: "REMOVE_SESSION_HOST"; id: string }
  | { type: "DRAIN_SESSION_HOST"; id: string; drain: boolean }
  | { type: "ADD_APP_GROUP"; group: AvdApplicationGroup }
  | { type: "UPDATE_APP_GROUP"; id: string; patch: Partial<AvdApplicationGroup> }
  | { type: "DELETE_APP_GROUP"; id: string }
  | { type: "ADD_REMOTE_APP"; groupId: string; app: AvdRemoteApp }
  | { type: "UPDATE_REMOTE_APP"; groupId: string; appName: string; patch: Partial<AvdRemoteApp> }
  | { type: "DELETE_REMOTE_APP"; groupId: string; appName: string }
  | { type: "ADD_WORKSPACE"; workspace: AvdWorkspace }
  | { type: "UPDATE_WORKSPACE"; id: string; patch: Partial<AvdWorkspace> }
  | { type: "DELETE_WORKSPACE"; id: string }
  | { type: "ADD_SCALING_PLAN"; plan: AvdScalingPlan }
  | { type: "UPDATE_SCALING_PLAN"; id: string; patch: Partial<AvdScalingPlan> }
  | { type: "DELETE_SCALING_PLAN"; id: string }
  | { type: "TOGGLE_SCALING_PLAN_ENABLED"; id: string }
  | { type: "ADD_SCALING_SCHEDULE"; id: string; schedule: AvdSchedule }
  | { type: "UPDATE_SCALING_SCHEDULE"; id: string; index: number; patch: Partial<AvdSchedule> }
  | { type: "DELETE_SCALING_SCHEDULE"; id: string; index: number }
  | { type: "TOGGLE_SCALING_POOL"; id: string; poolName: string; on: boolean }
  | { type: "SET_SCALING_POOL_OVERRIDE"; id: string; poolName: string; enabled: boolean }
  | { type: "RUN_SCALING_NOW"; id: string }
  | { type: "RUN_SCALING_POOL_NOW"; id: string; poolName: string }
  | { type: "ADD_MSIX_PACKAGE"; pkg: AvdMsixPackage }
  | { type: "UPDATE_MSIX_PACKAGE"; id: string; patch: Partial<AvdMsixPackage> }
  | { type: "DELETE_MSIX_PACKAGE"; id: string }
  | { type: "ADD_FSLOGIX_CONFIG"; config: AvdFslogixConfig }
  | { type: "UPDATE_FSLOGIX_CONFIG"; id: string; patch: Partial<AvdFslogixConfig> }
  | { type: "DELETE_FSLOGIX_CONFIG"; id: string }
  | { type: "ADD_UPDATE_PLAN"; plan: AvdUpdatePlan }
  | { type: "UPDATE_UPDATE_PLAN"; id: string; patch: Partial<AvdUpdatePlan> }
  | { type: "DELETE_UPDATE_PLAN"; id: string }
  | { type: "RUN_UPDATE_PLAN"; id: string }
  | { type: "ADD_IMAGE_TEMPLATE"; template: AvdImageTemplate }
  | { type: "UPDATE_IMAGE_TEMPLATE"; id: string; patch: Partial<AvdImageTemplate> }
  | { type: "DELETE_IMAGE_TEMPLATE"; id: string }
  | { type: "RUN_IMAGE_BUILD"; id: string }
  | { type: "ADD_PRIVATE_ENDPOINT"; endpoint: AvdPrivateEndpoint }
  | { type: "DELETE_PRIVATE_ENDPOINT"; id: string }
  | { type: "SET_PERSONAL_ASSIGNMENT"; hostId: string; upn: string | undefined }
  | { type: "SET_AUTO_SHUTDOWN"; hostPoolId: string; autoShutdown: AvdHostPool["autoShutdown"] };

export function avdReducer(state: AvdState, action: AvdAction): AvdState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "ADD_HOST_POOL":
      return {
        ...state,
        hostPools: [...state.hostPools, action.pool],
        activityLog: log(state, "Create host pool", action.pool.name),
      };

    case "UPDATE_HOST_POOL": {
      const pool = state.hostPools.find((p) => p.id === action.id);
      return {
        ...state,
        hostPools: state.hostPools.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: pool ? log(state, "Update host pool", pool.name) : state.activityLog,
      };
    }

    case "DELETE_HOST_POOL": {
      const pool = state.hostPools.find((p) => p.id === action.id);
      if (!pool) return state;
      return {
        ...state,
        hostPools: state.hostPools.filter((p) => p.id !== action.id),
        sessionHosts: state.sessionHosts.filter((h) => h.hostPool !== pool.name),
        activityLog: log(state, "Delete host pool", pool.name),
      };
    }

    case "ADD_SESSION_HOST":
      return {
        ...state,
        sessionHosts: [...state.sessionHosts, action.host],
        activityLog: log(state, "Add session host", action.host.name),
      };

    case "UPDATE_SESSION_HOST":
      return {
        ...state,
        sessionHosts: state.sessionHosts.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      };

    case "REMOVE_SESSION_HOST": {
      const host = state.sessionHosts.find((h) => h.id === action.id);
      return {
        ...state,
        sessionHosts: state.sessionHosts.filter((h) => h.id !== action.id),
        activityLog: host ? log(state, "Remove session host", host.name) : state.activityLog,
      };
    }

    case "DRAIN_SESSION_HOST": {
      const host = state.sessionHosts.find((h) => h.id === action.id);
      return {
        ...state,
        sessionHosts: state.sessionHosts.map((h) =>
          h.id === action.id ? { ...h, drainMode: action.drain, allowNewSessions: !action.drain } : h,
        ),
        activityLog: host ? log(state, action.drain ? "Enable drain mode" : "Disable drain mode", host.name) : state.activityLog,
      };
    }

    case "ADD_APP_GROUP":
      return {
        ...state,
        applicationGroups: [...state.applicationGroups, action.group],
        workspaces: action.group.workspace
          ? state.workspaces.map((w) =>
              w.id === action.group.workspace ? { ...w, applicationGroups: [...w.applicationGroups, action.group.id] } : w,
            )
          : state.workspaces,
        activityLog: log(state, "Create app group", action.group.name),
      };

    case "UPDATE_APP_GROUP": {
      const group = state.applicationGroups.find((g) => g.id === action.id);
      return {
        ...state,
        applicationGroups: state.applicationGroups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
        activityLog: group ? log(state, "Update app group", group.name) : state.activityLog,
      };
    }

    case "DELETE_APP_GROUP": {
      const group = state.applicationGroups.find((g) => g.id === action.id);
      if (!group) return state;
      return {
        ...state,
        applicationGroups: state.applicationGroups.filter((g) => g.id !== action.id),
        workspaces: state.workspaces.map((w) => ({
          ...w,
          applicationGroups: w.applicationGroups.filter((id) => id !== action.id),
        })),
        activityLog: log(state, "Delete app group", group.name),
      };
    }

    case "ADD_REMOTE_APP":
      return {
        ...state,
        applicationGroups: state.applicationGroups.map((g) =>
          g.id === action.groupId ? { ...g, applications: [...g.applications, action.app] } : g,
        ),
      };

    case "UPDATE_REMOTE_APP":
      return {
        ...state,
        applicationGroups: state.applicationGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, applications: g.applications.map((a) => (a.name === action.appName ? { ...a, ...action.patch } : a)) }
            : g,
        ),
      };

    case "DELETE_REMOTE_APP":
      return {
        ...state,
        applicationGroups: state.applicationGroups.map((g) =>
          g.id === action.groupId ? { ...g, applications: g.applications.filter((a) => a.name !== action.appName) } : g,
        ),
      };

    case "ADD_WORKSPACE":
      return {
        ...state,
        workspaces: [...state.workspaces, action.workspace],
        activityLog: log(state, "Create workspace", action.workspace.name),
      };

    case "UPDATE_WORKSPACE": {
      const ws = state.workspaces.find((w) => w.id === action.id);
      return {
        ...state,
        workspaces: state.workspaces.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)),
        activityLog: ws ? log(state, "Update workspace", ws.name) : state.activityLog,
      };
    }

    case "DELETE_WORKSPACE": {
      const ws = state.workspaces.find((w) => w.id === action.id);
      if (!ws) return state;
      return {
        ...state,
        workspaces: state.workspaces.filter((w) => w.id !== action.id),
        activityLog: log(state, "Delete workspace", ws.name),
      };
    }

    case "ADD_SCALING_PLAN":
      return {
        ...state,
        scalingPlans: [...state.scalingPlans, action.plan],
        activityLog: log(state, "Create scaling plan", action.plan.name),
      };

    case "UPDATE_SCALING_PLAN": {
      const plan = state.scalingPlans.find((p) => p.id === action.id);
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: plan ? log(state, "Update scaling plan", plan.name) : state.activityLog,
      };
    }

    case "DELETE_SCALING_PLAN": {
      const plan = state.scalingPlans.find((p) => p.id === action.id);
      if (!plan) return state;
      return {
        ...state,
        scalingPlans: state.scalingPlans.filter((p) => p.id !== action.id),
        activityLog: log(state, "Delete scaling plan", plan.name),
      };
    }

    case "TOGGLE_SCALING_PLAN_ENABLED": {
      const plan = state.scalingPlans.find((p) => p.id === action.id);
      if (!plan) return state;
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) => (p.id === action.id ? { ...p, enabled: !p.enabled } : p)),
        activityLog: log(state, plan.enabled ? "Disable scaling plan" : "Enable scaling plan", plan.name),
      };
    }

    case "ADD_SCALING_SCHEDULE":
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) =>
          p.id === action.id ? { ...p, schedules: [...p.schedules, action.schedule] } : p,
        ),
      };

    case "UPDATE_SCALING_SCHEDULE":
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) =>
          p.id === action.id
            ? { ...p, schedules: p.schedules.map((s, i) => (i === action.index ? { ...s, ...action.patch } : s)) }
            : p,
        ),
      };

    case "DELETE_SCALING_SCHEDULE":
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) =>
          p.id === action.id ? { ...p, schedules: p.schedules.filter((_, i) => i !== action.index) } : p,
        ),
      };

    case "TOGGLE_SCALING_POOL":
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) => {
          if (p.id !== action.id) return p;
          const hostPoolAssignments = action.on
            ? [...p.hostPoolAssignments, action.poolName]
            : p.hostPoolAssignments.filter((n) => n !== action.poolName);
          const poolOverrides = { ...p.poolOverrides };
          if (!action.on) delete poolOverrides[action.poolName];
          return { ...p, hostPoolAssignments, poolOverrides };
        }),
      };

    case "SET_SCALING_POOL_OVERRIDE":
      return {
        ...state,
        scalingPlans: state.scalingPlans.map((p) =>
          p.id === action.id ? { ...p, poolOverrides: { ...p.poolOverrides, [action.poolName]: action.enabled } } : p,
        ),
      };

    case "RUN_SCALING_NOW": {
      const plan = state.scalingPlans.find((p) => p.id === action.id);
      if (!plan) return state;
      const info = currentPhase(plan);
      let sessionHosts = state.sessionHosts;
      let sLog = state.scalingLog;
      for (const poolName of plan.hostPoolAssignments) {
        const hp = state.hostPools.find((h) => h.name === poolName || h.id === poolName);
        if (!hp) continue;
        sessionHosts = applyPhase(sessionHosts, hp.name, info, plan);
        sLog = [{ time: new Date().toISOString(), pool: hp.name, event: "Started" as const, reason: `Phase = ${info.phase}` }, ...sLog].slice(0, 200);
      }
      return {
        ...state,
        sessionHosts,
        scalingLog: sLog,
        activityLog: log(state, "Run scaling plan now", plan.name),
      };
    }

    case "RUN_SCALING_POOL_NOW": {
      const plan = state.scalingPlans.find((p) => p.id === action.id);
      const hp = state.hostPools.find((h) => h.name === action.poolName || h.id === action.poolName);
      if (!plan || !hp) return state;
      const info = currentPhase(plan);
      const sessionHosts = applyPhase(state.sessionHosts, hp.name, info, plan);
      return {
        ...state,
        sessionHosts,
        scalingLog: [
          { time: new Date().toISOString(), pool: hp.name, event: "Started" as const, reason: `Phase = ${info.phase}` },
          ...state.scalingLog,
        ].slice(0, 200),
        activityLog: log(state, "Apply scaling to pool", hp.name),
      };
    }

    case "ADD_MSIX_PACKAGE":
      return {
        ...state,
        msixPackages: [...state.msixPackages, action.pkg],
        activityLog: log(state, "Add MSIX package", action.pkg.displayName),
      };

    case "UPDATE_MSIX_PACKAGE": {
      const pkg = state.msixPackages.find((p) => p.id === action.id);
      return {
        ...state,
        msixPackages: state.msixPackages.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: pkg ? log(state, "Update MSIX package", pkg.displayName) : state.activityLog,
      };
    }

    case "DELETE_MSIX_PACKAGE": {
      const pkg = state.msixPackages.find((p) => p.id === action.id);
      if (!pkg) return state;
      return {
        ...state,
        msixPackages: state.msixPackages.filter((p) => p.id !== action.id),
        activityLog: log(state, "Remove MSIX package", pkg.displayName),
      };
    }

    case "ADD_FSLOGIX_CONFIG":
      return {
        ...state,
        fslogixConfigs: [...state.fslogixConfigs, action.config],
        activityLog: log(state, "Create FSLogix config", action.config.name),
      };

    case "UPDATE_FSLOGIX_CONFIG": {
      const cfg = state.fslogixConfigs.find((f) => f.id === action.id);
      return {
        ...state,
        fslogixConfigs: state.fslogixConfigs.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)),
        activityLog: cfg ? log(state, "Update FSLogix config", cfg.name) : state.activityLog,
      };
    }

    case "DELETE_FSLOGIX_CONFIG": {
      const cfg = state.fslogixConfigs.find((f) => f.id === action.id);
      if (!cfg) return state;
      return {
        ...state,
        fslogixConfigs: state.fslogixConfigs.filter((f) => f.id !== action.id),
        activityLog: log(state, "Delete FSLogix config", cfg.name),
      };
    }

    case "ADD_UPDATE_PLAN":
      return { ...state, updatePlans: [...state.updatePlans, action.plan], activityLog: log(state, "Create update plan", action.plan.name) };

    case "UPDATE_UPDATE_PLAN":
      return {
        ...state,
        updatePlans: state.updatePlans.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };

    case "DELETE_UPDATE_PLAN": {
      const plan = state.updatePlans.find((p) => p.id === action.id);
      if (!plan) return state;
      return {
        ...state,
        updatePlans: state.updatePlans.filter((p) => p.id !== action.id),
        activityLog: log(state, "Delete update plan", plan.name),
      };
    }

    case "RUN_UPDATE_PLAN": {
      const plan = state.updatePlans.find((p) => p.id === action.id);
      if (!plan) return state;
      return {
        ...state,
        updatePlans: state.updatePlans.map((p) =>
          p.id === action.id ? { ...p, status: "Running", stage: "Validation", lastRun: new Date().toISOString() } : p,
        ),
        activityLog: log(state, "Run update plan", plan.name),
      };
    }

    case "ADD_IMAGE_TEMPLATE":
      return {
        ...state,
        imageTemplates: [...state.imageTemplates, action.template],
        activityLog: log(state, "Create image template", action.template.name),
      };

    case "UPDATE_IMAGE_TEMPLATE": {
      const tpl = state.imageTemplates.find((t) => t.id === action.id);
      return {
        ...state,
        imageTemplates: state.imageTemplates.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
        activityLog: tpl ? log(state, "Update image template", tpl.name) : state.activityLog,
      };
    }

    case "DELETE_IMAGE_TEMPLATE": {
      const tpl = state.imageTemplates.find((t) => t.id === action.id);
      if (!tpl) return state;
      return {
        ...state,
        imageTemplates: state.imageTemplates.filter((t) => t.id !== action.id),
        activityLog: log(state, "Delete image template", tpl.name),
      };
    }

    case "RUN_IMAGE_BUILD": {
      const tpl = state.imageTemplates.find((t) => t.id === action.id);
      if (!tpl) return state;
      return {
        ...state,
        imageTemplates: state.imageTemplates.map((t) =>
          t.id === action.id ? { ...t, status: "Running", lastBuilt: new Date().toISOString() } : t,
        ),
        activityLog: log(state, "Run image build", tpl.name),
      };
    }

    case "ADD_PRIVATE_ENDPOINT":
      return {
        ...state,
        privateEndpoints: [...state.privateEndpoints, action.endpoint],
        activityLog: log(state, "Create private endpoint", action.endpoint.name),
      };

    case "DELETE_PRIVATE_ENDPOINT": {
      const pe = state.privateEndpoints.find((p) => p.id === action.id);
      if (!pe) return state;
      return {
        ...state,
        privateEndpoints: state.privateEndpoints.filter((p) => p.id !== action.id),
        activityLog: log(state, "Delete private endpoint", pe.name),
      };
    }

    case "SET_PERSONAL_ASSIGNMENT": {
      const host = state.sessionHosts.find((h) => h.id === action.hostId);
      return {
        ...state,
        sessionHosts: state.sessionHosts.map((h) => (h.id === action.hostId ? { ...h, assignedUser: action.upn } : h)),
        activityLog: host ? log(state, "Assign personal desktop", host.name) : state.activityLog,
      };
    }

    case "SET_AUTO_SHUTDOWN": {
      const pool = state.hostPools.find((p) => p.id === action.hostPoolId);
      return {
        ...state,
        hostPools: state.hostPools.map((p) => (p.id === action.hostPoolId ? { ...p, autoShutdown: action.autoShutdown } : p)),
        activityLog: pool ? log(state, "Set auto-shutdown policy", pool.name) : state.activityLog,
      };
    }

    default:
      return state;
  }
}
