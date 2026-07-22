import type {
  DefenderActionHistoryEntry,
  DefenderActivityEntry,
  DefenderAntiMalwarePolicy,
  DefenderAntiPhishPolicy,
  DefenderAntiSpamPolicy,
  DefenderAsset,
  DefenderCustomDetectionRule,
  DefenderDiscoveredApp,
  DefenderDkimDomain,
  DefenderHoneyToken,
  DefenderHuntingQuery,
  DefenderHuntRun,
  DefenderIncident,
  DefenderPendingAction,
  DefenderQuarantineMessage,
  DefenderRole,
  DefenderRoleAssignment,
  DefenderSafeAttachmentsPolicy,
  DefenderSafeLinksPolicy,
  DefenderSecureScoreAction,
  DefenderSessionPolicy,
  DefenderState,
  DefenderTabEntry,
} from "./types";
import { runHuntingQuery } from "./hunting-engine";

const DEFAULT_ACTOR = "admin@itbd.onmicrosoft.com";

function log(state: DefenderState, operation: string, target: string, status: "Succeeded" | "Failed" = "Succeeded"): DefenderActivityEntry[] {
  const entry: DefenderActivityEntry = { timestamp: new Date().toISOString(), actor: DEFAULT_ACTOR, action: operation, target, status };
  return [entry, ...state.activityLog].slice(0, 200);
}

// Recomputes currentScore/percentage from the full actions array — mirrors source's
// updateAction() point-sum recalc engine. Called any time a secure score action's
// status changes.
function recalcSecureScore(actions: DefenderSecureScoreAction[]): { currentScore: number; percentage: number } {
  let achieved = 0;
  let total = 0;
  actions.forEach((a) => {
    total += a.impact;
    if (a.status === "Achieved") achieved += a.impact;
  });
  return {
    currentScore: Math.round(achieved),
    percentage: total > 0 ? Math.round((achieved / total) * 100) : 0,
  };
}

export type DefenderTabList = "senders" | "urls" | "files";

export type DefenderAction =
  | { type: "LOAD_STATE"; state: DefenderState }

  // Incidents
  | { type: "UPDATE_INCIDENT"; id: string; patch: Partial<DefenderIncident> }

  // Secure score
  | { type: "UPDATE_SECURE_SCORE_ACTION"; id: string; patch: Partial<DefenderSecureScoreAction> }

  // Custom detection rules
  | { type: "ADD_CUSTOM_DETECTION_RULE"; rule: DefenderCustomDetectionRule }
  | { type: "UPDATE_CUSTOM_DETECTION_RULE"; id: string; patch: Partial<DefenderCustomDetectionRule> }
  | { type: "DELETE_CUSTOM_DETECTION_RULE"; id: string }

  // Asset inventory (endpoints)
  | { type: "ONBOARD_ASSET"; id: string; tag?: string }
  | { type: "OFFBOARD_ASSET"; id: string }
  | { type: "CLASSIFY_ASSET"; id: string; classification: string }

  // ITDR
  | { type: "ADD_HONEY_TOKEN"; token: DefenderHoneyToken }

  // Cloud apps
  | { type: "SET_OAUTH_VERDICT"; id: string; verdict: "Approved" | "Investigate" | "Block"; note: string }
  | { type: "SET_APP_TAG"; name: string; tag: DefenderDiscoveredApp["tag"] }
  | { type: "ADD_SESSION_POLICY"; policy: DefenderSessionPolicy }

  // Tenant Allow/Block list
  | { type: "ADD_TAB_ENTRY"; list: DefenderTabList; entry: DefenderTabEntry }
  | { type: "DELETE_TAB_ENTRY"; list: DefenderTabList; id: string }

  // Quarantine
  | { type: "RELEASE_QUARANTINE_MESSAGE"; id: string; allowSender?: boolean }
  | { type: "REPORT_QUARANTINE_MESSAGE"; id: string; verdict: NonNullable<DefenderQuarantineMessage["reportVerdict"]> }

  // Permissions & roles
  | { type: "ADD_ROLE"; role: DefenderRole }
  | { type: "UPDATE_ROLE"; id: string; patch: Partial<DefenderRole> }
  | { type: "DELETE_ROLE"; id: string }
  | { type: "ADD_ROLE_ASSIGNMENT"; assignment: DefenderRoleAssignment }
  | { type: "DELETE_ROLE_ASSIGNMENT"; roleId: string; userId: string }

  // Action center
  | { type: "APPROVE_PENDING_ACTION"; id: string }
  | { type: "REJECT_PENDING_ACTION"; id: string; reason?: string }

  // Advanced hunting
  | { type: "RUN_HUNTING_QUERY"; query: DefenderHuntingQuery }

  // Threat analytics
  | { type: "MARK_THREAT_ANALYTIC_READ"; id: string }
  | { type: "TOGGLE_THREAT_ANALYTIC_SUBSCRIPTION"; id: string }

  // Email policies — anti-phish / anti-malware / anti-spam / Safe Attachments /
  // Safe Links / DKIM. These policy shapes have no dedicated `id` field, so
  // CRUD is keyed by `name` (or `domain` for DKIM) per types.ts.
  | { type: "ADD_ANTI_PHISH_POLICY"; policy: DefenderAntiPhishPolicy }
  | { type: "UPDATE_ANTI_PHISH_POLICY"; name: string; patch: Partial<DefenderAntiPhishPolicy> }
  | { type: "DELETE_ANTI_PHISH_POLICY"; name: string }

  | { type: "ADD_ANTI_MALWARE_POLICY"; policy: DefenderAntiMalwarePolicy }
  | { type: "UPDATE_ANTI_MALWARE_POLICY"; name: string; patch: Partial<DefenderAntiMalwarePolicy> }
  | { type: "DELETE_ANTI_MALWARE_POLICY"; name: string }

  | { type: "ADD_ANTI_SPAM_POLICY"; policy: DefenderAntiSpamPolicy }
  | { type: "UPDATE_ANTI_SPAM_POLICY"; name: string; patch: Partial<DefenderAntiSpamPolicy> }
  | { type: "DELETE_ANTI_SPAM_POLICY"; name: string }

  | { type: "ADD_SAFE_ATTACHMENTS_POLICY"; policy: DefenderSafeAttachmentsPolicy }
  | { type: "UPDATE_SAFE_ATTACHMENTS_POLICY"; name: string; patch: Partial<DefenderSafeAttachmentsPolicy> }
  | { type: "DELETE_SAFE_ATTACHMENTS_POLICY"; name: string }

  | { type: "ADD_SAFE_LINKS_POLICY"; policy: DefenderSafeLinksPolicy }
  | { type: "UPDATE_SAFE_LINKS_POLICY"; name: string; patch: Partial<DefenderSafeLinksPolicy> }
  | { type: "DELETE_SAFE_LINKS_POLICY"; name: string }

  | { type: "UPDATE_DKIM_DOMAIN"; domain: string; patch: Partial<DefenderDkimDomain> };

export function defenderReducer(state: DefenderState, action: DefenderAction): DefenderState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    // ───────── Incidents ─────────
    case "UPDATE_INCIDENT": {
      const incident = state.incidents.find((i) => i.id === action.id);
      if (!incident) return state;
      return {
        ...state,
        incidents: state.incidents.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
        activityLog: log(state, "Update incident", action.id),
      };
    }

    // ───────── Secure score (point-sum recalc engine) ─────────
    case "UPDATE_SECURE_SCORE_ACTION": {
      const found = state.secureScore.actions.find((a) => a.id === action.id);
      if (!found) return state;
      const actions = state.secureScore.actions.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a));
      const { currentScore, percentage } = recalcSecureScore(actions);
      return {
        ...state,
        secureScore: { ...state.secureScore, actions, currentScore, percentage },
        activityLog: log(state, "Update secure score action", found.title),
      };
    }

    // ───────── Custom detection rules ─────────
    case "ADD_CUSTOM_DETECTION_RULE":
      return {
        ...state,
        customDetectionRules: [...state.customDetectionRules, action.rule],
        activityLog: log(state, "Create custom detection rule", action.rule.name),
      };

    case "UPDATE_CUSTOM_DETECTION_RULE": {
      const rule = state.customDetectionRules.find((r) => r.id === action.id);
      return {
        ...state,
        customDetectionRules: state.customDetectionRules.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
        activityLog: rule ? log(state, "Update custom detection rule", rule.name) : state.activityLog,
      };
    }

    case "DELETE_CUSTOM_DETECTION_RULE": {
      const rule = state.customDetectionRules.find((r) => r.id === action.id);
      if (!rule) return state;
      return {
        ...state,
        customDetectionRules: state.customDetectionRules.filter((r) => r.id !== action.id),
        activityLog: log(state, "Delete custom detection rule", rule.name),
      };
    }

    // ───────── Asset inventory ─────────
    case "ONBOARD_ASSET": {
      const asset = state.assets.find((a) => a.id === action.id);
      if (!asset) return state;
      return {
        ...state,
        assets: state.assets.map((a) => (a.id === action.id ? { ...a, onboarded: true } : a)),
        activityLog: log(state, "Onboard asset", asset.name),
      };
    }

    case "OFFBOARD_ASSET": {
      const asset = state.assets.find((a) => a.id === action.id);
      if (!asset) return state;
      return {
        ...state,
        assets: state.assets.map((a) => (a.id === action.id ? { ...a, onboarded: false } : a)),
        activityLog: log(state, "Offboard asset", asset.name),
      };
    }

    case "CLASSIFY_ASSET": {
      const asset = state.assets.find((a) => a.id === action.id);
      if (!asset) return state;
      return {
        ...state,
        assets: state.assets.map((a: DefenderAsset) => (a.id === action.id ? { ...a, classification: action.classification } : a)),
        activityLog: log(state, "Reclassify asset", `${asset.name} → ${action.classification}`),
      };
    }

    // ───────── ITDR ─────────
    case "ADD_HONEY_TOKEN":
      return {
        ...state,
        honeyTokens: [action.token, ...state.honeyTokens],
        activityLog: log(state, "Place honey token", action.token.name),
      };

    // ───────── Cloud apps ─────────
    case "SET_OAUTH_VERDICT": {
      const app = state.oauthApps.find((o) => o.id === action.id);
      if (!app) return state;
      return {
        ...state,
        oauthApps: state.oauthApps.map((o) => (o.id === action.id ? { ...o, verdict: action.verdict, note: action.note } : o)),
        activityLog: log(state, `Set OAuth app verdict (${action.verdict})`, app.name),
      };
    }

    case "SET_APP_TAG": {
      const app = state.discoveredApps.find((a) => a.name === action.name);
      if (!app) return state;
      return {
        ...state,
        discoveredApps: state.discoveredApps.map((a) => (a.name === action.name ? { ...a, tag: action.tag } : a)),
        activityLog: log(state, `Set app tag (${action.tag})`, app.name),
      };
    }

    case "ADD_SESSION_POLICY":
      return {
        ...state,
        sessionPolicies: [action.policy, ...state.sessionPolicies],
        activityLog: log(state, "Create session policy", action.policy.name),
      };

    // ───────── Tenant Allow/Block list ─────────
    case "ADD_TAB_ENTRY":
      return {
        ...state,
        tenantAllowBlock: {
          ...state.tenantAllowBlock,
          [action.list]: [...state.tenantAllowBlock[action.list], action.entry],
        },
        activityLog: log(state, `Add ${action.entry.list} entry (${action.list})`, action.entry.value),
      };

    case "DELETE_TAB_ENTRY": {
      const entry = state.tenantAllowBlock[action.list].find((e) => e.id === action.id);
      if (!entry) return state;
      return {
        ...state,
        tenantAllowBlock: {
          ...state.tenantAllowBlock,
          [action.list]: state.tenantAllowBlock[action.list].filter((e) => e.id !== action.id),
        },
        activityLog: log(state, `Remove Tenant Allow/Block entry (${action.list})`, entry.value),
      };
    }

    // ───────── Quarantine ─────────
    // Cross-feature side effect preserved from source: "Release + allow sender" also
    // pushes a new Allow entry into tenantAllowBlock.senders (90-day expiry).
    case "RELEASE_QUARANTINE_MESSAGE": {
      const msg = state.quarantine.items.find((q) => q.id === action.id);
      if (!msg) return state;
      const releasedOn = new Date().toISOString().slice(0, 16).replace("T", " ");
      const items = state.quarantine.items.map((q) =>
        q.id === action.id ? { ...q, status: "Released by admin" as const, releasedOn } : q,
      );

      let tenantAllowBlock = state.tenantAllowBlock;
      let activityLog = log(state, "Release quarantined message", msg.id);
      if (action.allowSender) {
        const newEntry: DefenderTabEntry = {
          id: `s-${Date.now().toString(36)}`,
          value: msg.sender,
          list: "Allow",
          reason: `Released from quarantine ${msg.id} as legitimate`,
          expiresOn: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          addedBy: DEFAULT_ACTOR,
          addedOn: new Date().toISOString().slice(0, 10),
        };
        tenantAllowBlock = { ...state.tenantAllowBlock, senders: [...state.tenantAllowBlock.senders, newEntry] };
        activityLog = log({ ...state, activityLog }, "Allow sender (from quarantine release)", msg.sender);
      }

      return { ...state, quarantine: { items }, tenantAllowBlock, activityLog };
    }

    case "REPORT_QUARANTINE_MESSAGE": {
      const msg = state.quarantine.items.find((q) => q.id === action.id);
      if (!msg) return state;
      return {
        ...state,
        quarantine: {
          items: state.quarantine.items.map((q) =>
            q.id === action.id ? { ...q, status: "Reported to Microsoft" as const, reportVerdict: action.verdict } : q,
          ),
        },
        activityLog: log(state, `Report quarantined message (${action.verdict})`, msg.id),
      };
    }

    // ───────── Permissions & roles ─────────
    case "ADD_ROLE":
      return {
        ...state,
        roles: [...state.roles, action.role],
        activityLog: log(state, "Create custom role", action.role.name),
      };

    case "UPDATE_ROLE": {
      const role = state.roles.find((r) => r.id === action.id);
      if (!role || role.builtIn) return state;
      return {
        ...state,
        roles: state.roles.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
        activityLog: log(state, "Update role", role.name),
      };
    }

    case "DELETE_ROLE": {
      const role = state.roles.find((r) => r.id === action.id);
      if (!role || role.builtIn) return state;
      return {
        ...state,
        roles: state.roles.filter((r) => r.id !== action.id),
        roleAssignments: state.roleAssignments.filter((a) => a.roleId !== action.id),
        activityLog: log(state, "Delete role", role.name),
      };
    }

    case "ADD_ROLE_ASSIGNMENT": {
      const role = state.roles.find((r) => r.id === action.assignment.roleId);
      return {
        ...state,
        roleAssignments: [...state.roleAssignments, action.assignment],
        activityLog: role ? log(state, "Assign role member", role.name) : state.activityLog,
      };
    }

    case "DELETE_ROLE_ASSIGNMENT": {
      const role = state.roles.find((r) => r.id === action.roleId);
      return {
        ...state,
        roleAssignments: state.roleAssignments.filter((a) => !(a.roleId === action.roleId && a.userId === action.userId)),
        activityLog: role ? log(state, "Remove role member", role.name) : state.activityLog,
      };
    }

    // ───────── Action center ─────────
    case "APPROVE_PENDING_ACTION": {
      const pending = state.pendingActions.find((p) => p.id === action.id);
      if (!pending) return state;
      const historyEntry: DefenderActionHistoryEntry = {
        id: pending.id,
        type: pending.type,
        target: pending.target,
        status: "Approved",
        actionedBy: DEFAULT_ACTOR,
        actionedOn: new Date().toISOString(),
      };
      return {
        ...state,
        pendingActions: state.pendingActions.filter((p) => p.id !== action.id),
        actionHistory: [historyEntry, ...state.actionHistory],
        activityLog: log(state, "Approve pending action", pending.target),
      };
    }

    case "REJECT_PENDING_ACTION": {
      const pending = state.pendingActions.find((p) => p.id === action.id);
      if (!pending) return state;
      const historyEntry: DefenderActionHistoryEntry = {
        id: pending.id,
        type: pending.type,
        target: pending.target,
        status: "Rejected",
        actionedBy: DEFAULT_ACTOR,
        actionedOn: new Date().toISOString(),
        reason: action.reason,
      };
      return {
        ...state,
        pendingActions: state.pendingActions.filter((p) => p.id !== action.id),
        actionHistory: [historyEntry, ...state.actionHistory],
        activityLog: log(state, "Reject pending action", pending.target),
      };
    }

    // ───────── Advanced hunting ─────────
    case "RUN_HUNTING_QUERY": {
      const run = runHuntingQuery(state, action.query);
      return {
        ...state,
        huntRuns: [run, ...state.huntRuns].slice(0, 50),
        activityLog: log(state, "Run hunting query", action.query.name),
      };
    }

    // ───────── Threat analytics ─────────
    case "MARK_THREAT_ANALYTIC_READ": {
      if (state.threatAnalyticsRead.includes(action.id)) return state;
      return { ...state, threatAnalyticsRead: [...state.threatAnalyticsRead, action.id] };
    }

    case "TOGGLE_THREAT_ANALYTIC_SUBSCRIPTION": {
      const subscribed = state.threatAnalyticsSubscriptions.includes(action.id);
      return {
        ...state,
        threatAnalyticsSubscriptions: subscribed
          ? state.threatAnalyticsSubscriptions.filter((id) => id !== action.id)
          : [...state.threatAnalyticsSubscriptions, action.id],
      };
    }

    // ───────── Email policies: Anti-phish (keyed by `name`, no dedicated id) ─────────
    case "ADD_ANTI_PHISH_POLICY":
      return {
        ...state,
        antiPhishPolicies: [...state.antiPhishPolicies, action.policy],
        activityLog: log(state, "Create anti-phish policy", action.policy.name),
      };

    case "UPDATE_ANTI_PHISH_POLICY": {
      const policy = state.antiPhishPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        antiPhishPolicies: state.antiPhishPolicies.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update anti-phish policy", policy.name),
      };
    }

    case "DELETE_ANTI_PHISH_POLICY": {
      const policy = state.antiPhishPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        antiPhishPolicies: state.antiPhishPolicies.filter((p) => p.name !== action.name),
        activityLog: log(state, "Delete anti-phish policy", policy.name),
      };
    }

    // ───────── Email policies: Anti-malware ─────────
    case "ADD_ANTI_MALWARE_POLICY":
      return {
        ...state,
        antiMalwarePolicies: [...state.antiMalwarePolicies, action.policy],
        activityLog: log(state, "Create anti-malware policy", action.policy.name),
      };

    case "UPDATE_ANTI_MALWARE_POLICY": {
      const policy = state.antiMalwarePolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        antiMalwarePolicies: state.antiMalwarePolicies.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update anti-malware policy", policy.name),
      };
    }

    case "DELETE_ANTI_MALWARE_POLICY": {
      const policy = state.antiMalwarePolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        antiMalwarePolicies: state.antiMalwarePolicies.filter((p) => p.name !== action.name),
        activityLog: log(state, "Delete anti-malware policy", policy.name),
      };
    }

    // ───────── Email policies: Anti-spam (discriminated union: Inbound/Outbound/ConnectionFilter) ─────────
    case "ADD_ANTI_SPAM_POLICY":
      return {
        ...state,
        antiSpamPolicies: [...state.antiSpamPolicies, action.policy],
        activityLog: log(state, "Create anti-spam policy", action.policy.name),
      };

    case "UPDATE_ANTI_SPAM_POLICY": {
      const policy = state.antiSpamPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        antiSpamPolicies: state.antiSpamPolicies.map((p) => (p.name === action.name ? ({ ...p, ...action.patch } as DefenderAntiSpamPolicy) : p)),
        activityLog: log(state, "Update anti-spam policy", policy.name),
      };
    }

    case "DELETE_ANTI_SPAM_POLICY": {
      const policy = state.antiSpamPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        antiSpamPolicies: state.antiSpamPolicies.filter((p) => p.name !== action.name),
        activityLog: log(state, "Delete anti-spam policy", policy.name),
      };
    }

    // ───────── Email policies: Safe Attachments ─────────
    case "ADD_SAFE_ATTACHMENTS_POLICY":
      return {
        ...state,
        safeAttachmentsPolicies: [...state.safeAttachmentsPolicies, action.policy],
        activityLog: log(state, "Create Safe Attachments policy", action.policy.name),
      };

    case "UPDATE_SAFE_ATTACHMENTS_POLICY": {
      const policy = state.safeAttachmentsPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        safeAttachmentsPolicies: state.safeAttachmentsPolicies.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update Safe Attachments policy", policy.name),
      };
    }

    case "DELETE_SAFE_ATTACHMENTS_POLICY": {
      const policy = state.safeAttachmentsPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        safeAttachmentsPolicies: state.safeAttachmentsPolicies.filter((p) => p.name !== action.name),
        activityLog: log(state, "Delete Safe Attachments policy", policy.name),
      };
    }

    // ───────── Email policies: Safe Links ─────────
    case "ADD_SAFE_LINKS_POLICY":
      return {
        ...state,
        safeLinksPolicies: [...state.safeLinksPolicies, action.policy],
        activityLog: log(state, "Create Safe Links policy", action.policy.name),
      };

    case "UPDATE_SAFE_LINKS_POLICY": {
      const policy = state.safeLinksPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        safeLinksPolicies: state.safeLinksPolicies.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update Safe Links policy", policy.name),
      };
    }

    case "DELETE_SAFE_LINKS_POLICY": {
      const policy = state.safeLinksPolicies.find((p) => p.name === action.name);
      if (!policy) return state;
      return {
        ...state,
        safeLinksPolicies: state.safeLinksPolicies.filter((p) => p.name !== action.name),
        activityLog: log(state, "Delete Safe Links policy", policy.name),
      };
    }

    // ───────── Email policies: DKIM (keyed by `domain`, patch-only — no add/delete) ─────────
    case "UPDATE_DKIM_DOMAIN": {
      const domain = state.dkimDomains.find((d) => d.domain === action.domain);
      if (!domain) return state;
      return {
        ...state,
        dkimDomains: state.dkimDomains.map((d) => (d.domain === action.domain ? { ...d, ...action.patch } : d)),
        activityLog: log(state, "Update DKIM signing config", domain.domain),
      };
    }

    // NOTE for page-building agents: quarantine *policy types* (quarantinePolicyTypes)
    // are read-only reference data in the real product's Threat policies blade (no
    // create/edit/delete UI) — intentionally left un-wired here. Live quarantine
    // *messages* (state.quarantine.items) already have full CRUD via
    // RELEASE_QUARANTINE_MESSAGE / REPORT_QUARANTINE_MESSAGE above.

    default:
      return state;
  }
}
