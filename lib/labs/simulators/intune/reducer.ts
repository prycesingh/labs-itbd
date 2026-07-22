import type {
  IntuneApp,
  IntuneAppAssignment,
  IntuneAutopilotProfile,
  IntuneCaPolicy,
  IntuneCompliancePolicy,
  IntuneConfigProfile,
  IntuneDevice,
  IntuneState,
} from "./types";

function log(state: IntuneState, action: string, target: string, detail = ""): IntuneState {
  const entry = { time: new Date().toISOString(), action, target, detail };
  return { ...state, activityLog: [entry, ...state.activityLog].slice(0, 200) };
}

export type IntuneAction =
  | { type: "LOAD_STATE"; state: IntuneState }
  | { type: "UPDATE_DEVICE"; id: string; patch: Partial<IntuneDevice> }
  | { type: "DELETE_DEVICE"; id: string }
  | { type: "SYNC_DEVICE"; id: string }
  | { type: "SCAN_DEVICE"; id: string; scanType: "Quick" | "Full" }
  | { type: "LOCATE_DEVICE"; id: string }
  | { type: "ROTATE_BITLOCKER"; id: string }
  | { type: "WIPE_DEVICE"; id: string }
  | { type: "RETIRE_DEVICE"; id: string }
  | { type: "RENAME_DEVICE"; id: string; name: string }
  | { type: "ADD_COMPLIANCE_POLICY"; policy: IntuneCompliancePolicy }
  | { type: "UPDATE_COMPLIANCE_POLICY"; id: string; patch: Partial<IntuneCompliancePolicy> }
  | { type: "DELETE_COMPLIANCE_POLICY"; id: string }
  | { type: "ADD_CONFIG_PROFILE"; profile: IntuneConfigProfile }
  | { type: "UPDATE_CONFIG_PROFILE"; id: string; patch: Partial<IntuneConfigProfile> }
  | { type: "DELETE_CONFIG_PROFILE"; id: string }
  | { type: "ADD_APP"; app: IntuneApp }
  | { type: "UPDATE_APP"; id: string; patch: Partial<IntuneApp> }
  | { type: "DELETE_APP"; id: string }
  | { type: "ASSIGN_APP"; id: string; assignment: IntuneAppAssignment }
  | { type: "UNASSIGN_APP"; id: string; groupId: string }
  | { type: "ADD_CA_POLICY"; policy: IntuneCaPolicy }
  | { type: "UPDATE_CA_POLICY"; id: string; patch: Partial<IntuneCaPolicy> }
  | { type: "DELETE_CA_POLICY"; id: string }
  | { type: "CYCLE_CA_STATE"; id: string }
  | { type: "ADD_AUTOPILOT_PROFILE"; profile: IntuneAutopilotProfile }
  | { type: "DELETE_AUTOPILOT_PROFILE"; id: string }
  | { type: "ASSIGN_LICENSE"; userId: string; license: string }
  | { type: "REMOVE_LICENSE"; userId: string; license: string };

function makeFakeKey(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const groups: string[] = [];
  for (let g = 0; g < 8; g++) {
    h = (h * 1103515245 + 12345) >>> 0;
    groups.push(String(h % 1000000).padStart(6, "0"));
  }
  return groups.join("-");
}

export function bitlockerKeyFor(deviceId: string): string {
  return makeFakeKey(deviceId);
}

export function intuneReducer(state: IntuneState, action: IntuneAction): IntuneState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "UPDATE_DEVICE": {
      const devices = state.devices.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d));
      return log({ ...state, devices }, "Update device", action.id);
    }
    case "DELETE_DEVICE": {
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices: state.devices.filter((x) => x.id !== action.id) }, "Delete device", d?.name ?? action.id);
    }
    case "SYNC_DEVICE": {
      const devices = state.devices.map((d) => (d.id === action.id ? { ...d, lastCheckIn: new Date().toISOString() } : d));
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices }, "Sync device", d?.name ?? action.id);
    }
    case "SCAN_DEVICE": {
      const now = new Date().toISOString();
      const devices = state.devices.map((d) =>
        d.id === action.id ? { ...d, scanResult: { type: action.scanType, started: now, result: "No threats found" } } : d,
      );
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices }, `${action.scanType} scan`, d?.name ?? action.id);
    }
    case "LOCATE_DEVICE": {
      const lat = 12.9 + Math.random() * 0.2;
      const lng = 77.5 + Math.random() * 0.2;
      const devices = state.devices.map((d) => (d.id === action.id ? { ...d, locate: { lat, lng, when: new Date().toISOString() } } : d));
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices }, "Locate device", d?.name ?? action.id);
    }
    case "ROTATE_BITLOCKER": {
      const devices = state.devices.map((d) => (d.id === action.id ? { ...d, bitlockerRotatedAt: new Date().toISOString() } : d));
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices }, "Rotate BitLocker key", d?.name ?? action.id);
    }
    case "WIPE_DEVICE": {
      const devices = state.devices.map((d) => (d.id === action.id ? { ...d, compliance: "Not evaluated" as const, managedBy: "Pending wipe" } : d));
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices }, "Wipe device", d?.name ?? action.id);
    }
    case "RETIRE_DEVICE": {
      const d = state.devices.find((x) => x.id === action.id);
      return log({ ...state, devices: state.devices.filter((x) => x.id !== action.id) }, "Retire device", d?.name ?? action.id);
    }
    case "RENAME_DEVICE": {
      const devices = state.devices.map((d) => (d.id === action.id ? { ...d, name: action.name } : d));
      return log({ ...state, devices }, "Rename device", action.name);
    }

    case "ADD_COMPLIANCE_POLICY": {
      if (state.compliancePolicies.some((p) => p.id === action.policy.id)) return state;
      return log({ ...state, compliancePolicies: [...state.compliancePolicies, action.policy] }, "Create compliance policy", action.policy.name);
    }
    case "UPDATE_COMPLIANCE_POLICY": {
      const compliancePolicies = state.compliancePolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch, lastModified: new Date().toISOString().slice(0, 10) } : p));
      return log({ ...state, compliancePolicies }, "Update compliance policy", action.id);
    }
    case "DELETE_COMPLIANCE_POLICY": {
      const p = state.compliancePolicies.find((x) => x.id === action.id);
      return log({ ...state, compliancePolicies: state.compliancePolicies.filter((x) => x.id !== action.id) }, "Delete compliance policy", p?.name ?? action.id);
    }

    case "ADD_CONFIG_PROFILE": {
      if (state.configProfiles.some((p) => p.id === action.profile.id)) return state;
      return log({ ...state, configProfiles: [...state.configProfiles, action.profile] }, "Create configuration profile", action.profile.name);
    }
    case "UPDATE_CONFIG_PROFILE": {
      const configProfiles = state.configProfiles.map((p) => (p.id === action.id ? { ...p, ...action.patch, lastModified: new Date().toISOString().slice(0, 10) } : p));
      return log({ ...state, configProfiles }, "Update configuration profile", action.id);
    }
    case "DELETE_CONFIG_PROFILE": {
      const p = state.configProfiles.find((x) => x.id === action.id);
      return log({ ...state, configProfiles: state.configProfiles.filter((x) => x.id !== action.id) }, "Delete configuration profile", p?.name ?? action.id);
    }

    case "ADD_APP": {
      if (state.apps.some((a) => a.id === action.app.id)) return state;
      return log({ ...state, apps: [...state.apps, action.app] }, "Add app", action.app.name);
    }
    case "UPDATE_APP": {
      const apps = state.apps.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a));
      return log({ ...state, apps }, "Update app", action.id);
    }
    case "DELETE_APP": {
      const a = state.apps.find((x) => x.id === action.id);
      return log({ ...state, apps: state.apps.filter((x) => x.id !== action.id) }, "Delete app", a?.name ?? action.id);
    }
    case "ASSIGN_APP": {
      const apps = state.apps.map((a) => {
        if (a.id !== action.id) return a;
        const assignments = a.assignments.filter((x) => x.groupId !== action.assignment.groupId);
        return { ...a, assignments: [...assignments, action.assignment] };
      });
      const a = state.apps.find((x) => x.id === action.id);
      return log({ ...state, apps }, `Assign app (${action.assignment.intent})`, a?.name ?? action.id);
    }
    case "UNASSIGN_APP": {
      const apps = state.apps.map((a) => (a.id === action.id ? { ...a, assignments: a.assignments.filter((x) => x.groupId !== action.groupId) } : a));
      return log({ ...state, apps }, "Unassign app", action.id);
    }

    case "ADD_CA_POLICY": {
      if (state.conditionalAccess.some((p) => p.id === action.policy.id)) return state;
      return log({ ...state, conditionalAccess: [...state.conditionalAccess, action.policy] }, "Create Conditional Access policy", action.policy.name);
    }
    case "UPDATE_CA_POLICY": {
      const conditionalAccess = state.conditionalAccess.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p));
      return log({ ...state, conditionalAccess }, "Update Conditional Access policy", action.id);
    }
    case "DELETE_CA_POLICY": {
      const p = state.conditionalAccess.find((x) => x.id === action.id);
      return log({ ...state, conditionalAccess: state.conditionalAccess.filter((x) => x.id !== action.id) }, "Delete Conditional Access policy", p?.name ?? action.id);
    }
    case "CYCLE_CA_STATE": {
      const order = { On: "Off", Off: "Report-only", "Report-only": "On" } as const;
      const conditionalAccess = state.conditionalAccess.map((p) => (p.id === action.id ? { ...p, state: order[p.state] } : p));
      return log({ ...state, conditionalAccess }, "Toggle Conditional Access state", action.id);
    }

    case "ADD_AUTOPILOT_PROFILE": {
      if (state.autopilotProfiles.some((p) => p.id === action.profile.id)) return state;
      return log({ ...state, autopilotProfiles: [...state.autopilotProfiles, action.profile] }, "Create Autopilot profile", action.profile.name);
    }
    case "DELETE_AUTOPILOT_PROFILE": {
      const p = state.autopilotProfiles.find((x) => x.id === action.id);
      return log({ ...state, autopilotProfiles: state.autopilotProfiles.filter((x) => x.id !== action.id) }, "Delete Autopilot profile", p?.name ?? action.id);
    }

    case "ASSIGN_LICENSE": {
      const users = state.users.map((u) => (u.id === action.userId && !u.licenses.includes(action.license) ? { ...u, licenses: [...u.licenses, action.license] } : u));
      return log({ ...state, users }, "Assign license", action.license);
    }
    case "REMOVE_LICENSE": {
      const users = state.users.map((u) => (u.id === action.userId ? { ...u, licenses: u.licenses.filter((l) => l !== action.license) } : u));
      return log({ ...state, users }, "Remove license", action.license);
    }

    default:
      return state;
  }
}
