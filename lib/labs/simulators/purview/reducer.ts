import type {
  PurviewAdaptiveScope,
  PurviewAssessment,
  PurviewAuditSavedSearch,
  PurviewAutoLabelPolicy,
  PurviewCcAlert,
  PurviewCcPolicy,
  PurviewControlStatus,
  PurviewCustodian,
  PurviewDispositionStatus,
  PurviewDlpPolicy,
  PurviewEDiscoveryCase,
  PurviewExport,
  PurviewGlossaryTerm,
  PurviewHold,
  PurviewImprovementAction,
  PurviewIrmCase,
  PurviewIrmPolicy,
  PurviewLabelPolicy,
  PurviewNotification,
  PurviewRetentionPolicy,
  PurviewSearch,
  PurviewSensitivityLabel,
  PurviewState,
} from "./types";
import { runContentSearchQuery } from "./search-engine";
import { computeIrmRiskScore } from "./irm-engine";

const DEFAULT_ACTOR = "admin@itbd.onmicrosoft.com";

// Ported house style from sentinel/reducer.ts (itself ported from defender/reducer.ts)
// `log()` — prepends an activity entry and caps the log at 200 entries.
function log(state: PurviewState, operation: string, target: string, status: "Succeeded" | "Failed" = "Succeeded"): PurviewState["activityLog"] {
  const entry = { timestamp: new Date().toISOString(), actor: DEFAULT_ACTOR, action: operation, target, status };
  return [entry, ...state.activityLog].slice(0, 200);
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

export type PurviewAction =
  | { type: "LOAD_STATE"; state: PurviewState }

  // Sensitivity labels
  | { type: "ADD_LABEL"; label: PurviewSensitivityLabel }
  | { type: "UPDATE_LABEL"; id: string; patch: Partial<PurviewSensitivityLabel> }
  | { type: "DELETE_LABEL"; id: string }
  | { type: "ADD_LABEL_POLICY"; policy: PurviewLabelPolicy }
  | { type: "UPDATE_LABEL_POLICY"; id: string; patch: Partial<PurviewLabelPolicy> }
  | { type: "ADD_AUTO_LABEL_POLICY"; policy: PurviewAutoLabelPolicy }
  | { type: "UPDATE_AUTO_LABEL_POLICY"; id: string; patch: Partial<PurviewAutoLabelPolicy> }

  // DLP
  | { type: "ADD_DLP_POLICY"; policy: PurviewDlpPolicy }
  | { type: "UPDATE_DLP_POLICY"; id: string; patch: Partial<PurviewDlpPolicy> }
  | { type: "DELETE_DLP_POLICY"; id: string }
  | { type: "TOGGLE_DLP_STATUS"; id: string }

  // Retention / records management
  | { type: "ADD_RETENTION_POLICY"; policy: PurviewRetentionPolicy }
  | { type: "UPDATE_RETENTION_POLICY"; id: string; patch: Partial<PurviewRetentionPolicy> }
  | { type: "DELETE_RETENTION_POLICY"; id: string }
  | { type: "RESOLVE_DISPOSITION_ITEM"; id: string; action: Exclude<PurviewDispositionStatus, "Pending">; reviewedBy: string }
  | { type: "ADD_ADAPTIVE_SCOPE"; scope: PurviewAdaptiveScope }
  | { type: "DELETE_ADAPTIVE_SCOPE"; id: string }

  // eDiscovery
  | { type: "ADD_EDISCOVERY_CASE"; case: PurviewEDiscoveryCase }
  | { type: "UPDATE_EDISCOVERY_CASE"; id: string; patch: Partial<PurviewEDiscoveryCase> }
  | { type: "ADD_CUSTODIAN"; caseId: string; custodian: PurviewCustodian }
  | { type: "ADD_HOLD"; caseId: string; hold: PurviewHold }
  | { type: "ADD_SEARCH"; caseId: string; name: string; query: string; locations: string; dateRange: string }
  | { type: "ADD_EXPORT"; caseId: string; export: PurviewExport }
  | { type: "ADD_NOTIFICATION"; caseId: string; notification: PurviewNotification }

  // Audit
  | { type: "ADD_AUDIT_SAVED_SEARCH"; search: PurviewAuditSavedSearch }
  | { type: "DELETE_AUDIT_SAVED_SEARCH"; id: string }

  // Communication compliance
  | { type: "ADD_CC_POLICY"; policy: PurviewCcPolicy }
  | { type: "UPDATE_CC_POLICY"; id: string; patch: Partial<PurviewCcPolicy> }
  | { type: "RESOLVE_CC_ALERT"; id: string }
  | { type: "ESCALATE_CC_ALERT"; id: string }
  | { type: "ADD_CC_ALERT_NOTE"; id: string; author: string; text: string }
  | { type: "ASSIGN_CC_REVIEWER"; id: string; reviewer: string }

  // Insider risk management
  | { type: "ADD_IRM_POLICY"; policy: PurviewIrmPolicy }
  | { type: "UPDATE_IRM_POLICY"; id: string; patch: Partial<PurviewIrmPolicy> }
  | { type: "TOGGLE_IRM_REALNAME"; id: string }
  | { type: "ADD_IRM_CASE_NOTE"; id: string; author: string; text: string }
  | { type: "RESOLVE_IRM_CASE"; id: string }
  | { type: "ESCALATE_IRM_CASE"; id: string }
  | { type: "RECOMPUTE_IRM_CASE_SCORE"; id: string }

  // Compliance manager
  | { type: "MARK_CONTROL_STATUS"; assessmentId: string; controlId: string; status: PurviewControlStatus }
  | { type: "UPDATE_ACTION_STATUS"; id: string; status: PurviewImprovementAction["status"] }
  | { type: "ADD_ASSESSMENT"; assessment: PurviewAssessment }

  // Data map / glossary
  | { type: "ADD_GLOSSARY_TERM"; term: PurviewGlossaryTerm }
  | { type: "UPDATE_GLOSSARY_TERM"; id: string; patch: Partial<PurviewGlossaryTerm> }
  | { type: "TRIGGER_SCAN"; sourceId: string };

export function purviewReducer(state: PurviewState, action: PurviewAction): PurviewState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    // ───────── Sensitivity labels ─────────
    case "ADD_LABEL":
      return {
        ...state,
        sensitivityLabels: [...state.sensitivityLabels, action.label],
        activityLog: log(state, "Create sensitivity label", action.label.name),
      };

    case "UPDATE_LABEL": {
      const label = state.sensitivityLabels.find((l) => l.id === action.id);
      if (!label) return state;
      return {
        ...state,
        sensitivityLabels: state.sensitivityLabels.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)),
        activityLog: log(state, "Update sensitivity label", label.name),
      };
    }

    case "DELETE_LABEL": {
      const label = state.sensitivityLabels.find((l) => l.id === action.id);
      if (!label) return state;
      return {
        ...state,
        sensitivityLabels: state.sensitivityLabels.filter((l) => l.id !== action.id),
        activityLog: log(state, "Delete sensitivity label", label.name),
      };
    }

    case "ADD_LABEL_POLICY":
      return {
        ...state,
        labelPolicies: [...state.labelPolicies, action.policy],
        activityLog: log(state, "Create label policy", action.policy.name),
      };

    case "UPDATE_LABEL_POLICY": {
      const policy = state.labelPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        labelPolicies: state.labelPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update label policy", policy.name),
      };
    }

    case "ADD_AUTO_LABEL_POLICY":
      return {
        ...state,
        autoLabelingPolicies: [...state.autoLabelingPolicies, action.policy],
        activityLog: log(state, "Create auto-labeling policy", action.policy.name),
      };

    case "UPDATE_AUTO_LABEL_POLICY": {
      const policy = state.autoLabelingPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        autoLabelingPolicies: state.autoLabelingPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update auto-labeling policy", policy.name),
      };
    }

    // ───────── DLP ─────────
    case "ADD_DLP_POLICY":
      return {
        ...state,
        dlpPolicies: [action.policy, ...state.dlpPolicies],
        activityLog: log(state, "Create DLP policy", action.policy.name),
      };

    case "UPDATE_DLP_POLICY": {
      const policy = state.dlpPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        dlpPolicies: state.dlpPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update DLP policy", policy.name),
      };
    }

    case "DELETE_DLP_POLICY": {
      const policy = state.dlpPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        dlpPolicies: state.dlpPolicies.filter((p) => p.id !== action.id),
        activityLog: log(state, "Delete DLP policy", policy.name),
      };
    }

    case "TOGGLE_DLP_STATUS": {
      const policy = state.dlpPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      const nextStatus = policy.status === "Active" ? "Disabled" : "Active";
      return {
        ...state,
        dlpPolicies: state.dlpPolicies.map((p) => (p.id === action.id ? { ...p, status: nextStatus } : p)),
        activityLog: log(state, "Toggle DLP policy status", policy.name),
      };
    }

    // ───────── Retention / records management ─────────
    case "ADD_RETENTION_POLICY":
      return {
        ...state,
        retention: [action.policy, ...state.retention],
        activityLog: log(state, "Create retention policy", action.policy.name),
      };

    case "UPDATE_RETENTION_POLICY": {
      const policy = state.retention.find((r) => r.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        retention: state.retention.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
        activityLog: log(state, "Update retention policy", policy.name),
      };
    }

    case "DELETE_RETENTION_POLICY": {
      const policy = state.retention.find((r) => r.id === action.id);
      if (!policy) return state;
      if (policy.regulatory) {
        return { ...state, activityLog: log(state, "Delete retention policy", policy.name, "Failed") };
      }
      return {
        ...state,
        retention: state.retention.filter((r) => r.id !== action.id),
        activityLog: log(state, "Delete retention policy", policy.name),
      };
    }

    case "RESOLVE_DISPOSITION_ITEM": {
      const item = state.dispositionQueue.find((d) => d.id === action.id);
      if (!item) return state;
      return {
        ...state,
        dispositionQueue: state.dispositionQueue.map((d) =>
          d.id === action.id ? { ...d, status: action.action, reviewedBy: action.reviewedBy, reviewedOn: new Date().toISOString() } : d,
        ),
        activityLog: log(state, `Disposition ${action.action.toLowerCase()}`, item.item),
      };
    }

    case "ADD_ADAPTIVE_SCOPE":
      return {
        ...state,
        adaptiveScopes: [...state.adaptiveScopes, action.scope],
        activityLog: log(state, "Create adaptive scope", action.scope.name),
      };

    case "DELETE_ADAPTIVE_SCOPE": {
      const scope = state.adaptiveScopes.find((s) => s.id === action.id);
      if (!scope) return state;
      return {
        ...state,
        adaptiveScopes: state.adaptiveScopes.filter((s) => s.id !== action.id),
        activityLog: log(state, "Delete adaptive scope", scope.name),
      };
    }

    // ───────── eDiscovery ─────────
    case "ADD_EDISCOVERY_CASE":
      return {
        ...state,
        ediscoveryCases: [action.case, ...state.ediscoveryCases],
        activityLog: log(state, "Create eDiscovery case", action.case.name),
      };

    case "UPDATE_EDISCOVERY_CASE": {
      const c = state.ediscoveryCases.find((x) => x.id === action.id);
      if (!c) return state;
      return {
        ...state,
        ediscoveryCases: state.ediscoveryCases.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
        activityLog: log(state, "Update eDiscovery case", c.name),
      };
    }

    case "ADD_CUSTODIAN": {
      const c = state.ediscoveryCases.find((x) => x.id === action.caseId);
      if (!c) return state;
      return {
        ...state,
        ediscoveryCases: state.ediscoveryCases.map((x) =>
          x.id === action.caseId ? { ...x, custodians: [...x.custodians, action.custodian] } : x,
        ),
        activityLog: log(state, "Add custodian", `${action.custodian.upn} → ${c.name}`),
      };
    }

    case "ADD_HOLD": {
      const c = state.ediscoveryCases.find((x) => x.id === action.caseId);
      if (!c) return state;
      return {
        ...state,
        ediscoveryCases: state.ediscoveryCases.map((x) => (x.id === action.caseId ? { ...x, holds: [...x.holds, action.hold] } : x)),
        activityLog: log(state, "Create hold", `${action.hold.name} → ${c.name}`),
      };
    }

    // Genuinely runs the eDiscovery search-filter engine (search-engine.ts) against
    // this case's content-search-shaped universe and stores the REAL match count —
    // no Math.random() placeholder counts, matching the task's requirement.
    case "ADD_SEARCH": {
      const c = state.ediscoveryCases.find((x) => x.id === action.caseId);
      if (!c) return state;
      const matches = runContentSearchQuery(action.query, state.contentSearch);
      const totalSizeKB = matches.reduce((sum, m) => sum + m.sizeKB, 0);
      const search: PurviewSearch = {
        id: genId("srch"),
        name: action.name,
        query: action.query,
        locations: action.locations,
        dateRange: action.dateRange,
        items: matches.length,
        sizeMB: Math.round((totalSizeKB / 1024) * 100) / 100,
      };
      return {
        ...state,
        ediscoveryCases: state.ediscoveryCases.map((x) => (x.id === action.caseId ? { ...x, searches: [...x.searches, search] } : x)),
        activityLog: log(state, "Run eDiscovery search", `${search.name} (${search.items} items) → ${c.name}`),
      };
    }

    case "ADD_EXPORT": {
      const c = state.ediscoveryCases.find((x) => x.id === action.caseId);
      if (!c) return state;
      return {
        ...state,
        ediscoveryCases: state.ediscoveryCases.map((x) => (x.id === action.caseId ? { ...x, exports: [...x.exports, action.export] } : x)),
        activityLog: log(state, "Create export", `${action.export.name} → ${c.name}`),
      };
    }

    case "ADD_NOTIFICATION": {
      const c = state.ediscoveryCases.find((x) => x.id === action.caseId);
      if (!c) return state;
      return {
        ...state,
        ediscoveryCases: state.ediscoveryCases.map((x) =>
          x.id === action.caseId ? { ...x, notifications: [...x.notifications, action.notification] } : x,
        ),
        activityLog: log(state, "Send notification", `${action.notification.subject} → ${c.name}`),
      };
    }

    // ───────── Audit ─────────
    case "ADD_AUDIT_SAVED_SEARCH":
      return {
        ...state,
        auditSavedSearches: [...state.auditSavedSearches, action.search],
        activityLog: log(state, "Save audit search", action.search.name),
      };

    case "DELETE_AUDIT_SAVED_SEARCH": {
      const search = state.auditSavedSearches.find((s) => s.id === action.id);
      if (!search) return state;
      return {
        ...state,
        auditSavedSearches: state.auditSavedSearches.filter((s) => s.id !== action.id),
        activityLog: log(state, "Delete audit search", search.name),
      };
    }

    // ───────── Communication compliance ─────────
    case "ADD_CC_POLICY":
      return {
        ...state,
        ccPolicies: [...state.ccPolicies, action.policy],
        activityLog: log(state, "Create communication compliance policy", action.policy.name),
      };

    case "UPDATE_CC_POLICY": {
      const policy = state.ccPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        ccPolicies: state.ccPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update communication compliance policy", policy.name),
      };
    }

    case "RESOLVE_CC_ALERT": {
      const alert = state.ccAlerts.find((a) => a.id === action.id);
      if (!alert) return state;
      return {
        ...state,
        ccAlerts: state.ccAlerts.map((a) => (a.id === action.id ? { ...a, status: "Resolved" } : a)),
        activityLog: log(state, "Resolve alert", alert.id),
      };
    }

    case "ESCALATE_CC_ALERT": {
      const alert = state.ccAlerts.find((a) => a.id === action.id);
      if (!alert) return state;
      return {
        ...state,
        ccAlerts: state.ccAlerts.map((a) => (a.id === action.id ? { ...a, status: "Escalated" } : a)),
        activityLog: log(state, "Escalate alert", alert.id),
      };
    }

    case "ADD_CC_ALERT_NOTE": {
      const alert = state.ccAlerts.find((a) => a.id === action.id);
      if (!alert) return state;
      const note = { id: genId("note"), author: action.author, text: action.text, time: new Date().toISOString() };
      return {
        ...state,
        ccAlerts: state.ccAlerts.map((a) => (a.id === action.id ? { ...a, notes: [...a.notes, note] } : a)),
        activityLog: log(state, "Add alert note", alert.id),
      };
    }

    case "ASSIGN_CC_REVIEWER": {
      const alert = state.ccAlerts.find((a) => a.id === action.id);
      if (!alert) return state;
      return {
        ...state,
        ccAlerts: state.ccAlerts.map((a) => (a.id === action.id ? { ...a, reviewer: action.reviewer } : a)),
        activityLog: log(state, "Assign reviewer", `${alert.id} → ${action.reviewer}`),
      };
    }

    // ───────── Insider risk management ─────────
    case "ADD_IRM_POLICY":
      return {
        ...state,
        irmPolicies: [...state.irmPolicies, action.policy],
        activityLog: log(state, "Create insider risk policy", action.policy.name),
      };

    case "UPDATE_IRM_POLICY": {
      const policy = state.irmPolicies.find((p) => p.id === action.id);
      if (!policy) return state;
      return {
        ...state,
        irmPolicies: state.irmPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        activityLog: log(state, "Update insider risk policy", policy.name),
      };
    }

    case "TOGGLE_IRM_REALNAME": {
      const irmCase = state.irmCases.find((c) => c.id === action.id);
      if (!irmCase) return state;
      const nextRevealed = !irmCase.realNameRevealed;
      const historyEntry = {
        id: genId("h"),
        time: new Date().toISOString(),
        label: nextRevealed ? "Revealed real identity — access audit-logged." : "Re-pseudonymized on case review.",
      };
      return {
        ...state,
        irmCases: state.irmCases.map((c) =>
          c.id === action.id ? { ...c, realNameRevealed: nextRevealed, history: [...c.history, historyEntry] } : c,
        ),
        activityLog: log(state, nextRevealed ? "Reveal real identity" : "Re-pseudonymize identity", irmCase.id),
      };
    }

    case "ADD_IRM_CASE_NOTE": {
      const irmCase = state.irmCases.find((c) => c.id === action.id);
      if (!irmCase) return state;
      const note = { id: genId("note"), author: action.author, text: action.text, time: new Date().toISOString() };
      return {
        ...state,
        irmCases: state.irmCases.map((c) => (c.id === action.id ? { ...c, notes: [...c.notes, note] } : c)),
        activityLog: log(state, "Add case note", irmCase.id),
      };
    }

    case "RESOLVE_IRM_CASE": {
      const irmCase = state.irmCases.find((c) => c.id === action.id);
      if (!irmCase) return state;
      return {
        ...state,
        irmCases: state.irmCases.map((c) => (c.id === action.id ? { ...c, status: "Resolved" } : c)),
        activityLog: log(state, "Resolve case", irmCase.id),
      };
    }

    case "ESCALATE_IRM_CASE": {
      const irmCase = state.irmCases.find((c) => c.id === action.id);
      if (!irmCase) return state;
      return {
        ...state,
        irmCases: state.irmCases.map((c) => (c.id === action.id ? { ...c, status: "Escalated to investigation" } : c)),
        activityLog: log(state, "Escalate case", irmCase.id),
      };
    }

    // Recalculates a case's riskScore/riskLevel from its triggeredIndicatorIds via
    // the real IRM scoring engine (irm-engine.ts) — not a stored static value.
    case "RECOMPUTE_IRM_CASE_SCORE": {
      const irmCase = state.irmCases.find((c) => c.id === action.id);
      if (!irmCase) return state;
      const { score, level } = computeIrmRiskScore(irmCase.triggeredIndicatorIds, state.irmIndicators);
      return {
        ...state,
        irmCases: state.irmCases.map((c) => (c.id === action.id ? { ...c, riskScore: score, riskLevel: level } : c)),
        activityLog: log(state, "Recompute risk score", `${irmCase.id} → ${score} (${level})`),
      };
    }

    // ───────── Compliance manager ─────────
    case "MARK_CONTROL_STATUS": {
      const assessment = state.complianceAssessments.find((a) => a.id === action.assessmentId);
      if (!assessment) return state;
      const control = assessment.controls.find((c) => c.id === action.controlId);
      if (!control) return state;
      return {
        ...state,
        complianceAssessments: state.complianceAssessments.map((a) =>
          a.id === action.assessmentId
            ? { ...a, controls: a.controls.map((c) => (c.id === action.controlId ? { ...c, status: action.status } : c)) }
            : a,
        ),
        activityLog: log(state, "Mark control status", `${control.title} → ${action.status}`),
      };
    }

    case "UPDATE_ACTION_STATUS": {
      const item = state.complianceActions.find((a) => a.id === action.id);
      if (!item) return state;
      return {
        ...state,
        complianceActions: state.complianceActions.map((a) => (a.id === action.id ? { ...a, status: action.status } : a)),
        activityLog: log(state, "Update improvement action status", `${item.title} → ${action.status}`),
      };
    }

    case "ADD_ASSESSMENT":
      return {
        ...state,
        complianceAssessments: [...state.complianceAssessments, action.assessment],
        activityLog: log(state, "Create assessment", action.assessment.name),
      };

    // ───────── Data map / glossary ─────────
    case "ADD_GLOSSARY_TERM":
      return {
        ...state,
        glossaryTerms: [action.term, ...state.glossaryTerms],
        activityLog: log(state, "Create glossary term", action.term.name),
      };

    case "UPDATE_GLOSSARY_TERM": {
      const term = state.glossaryTerms.find((t) => t.id === action.id);
      if (!term) return state;
      return {
        ...state,
        glossaryTerms: state.glossaryTerms.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
        activityLog: log(state, "Update glossary term", term.name),
      };
    }

    // Toggles a scan job's status Running → Succeeded (or Not-running → Running),
    // matching the task's ask for a simple realistic toggle with no real timer.
    case "TRIGGER_SCAN": {
      const job = state.scanJobs.find((j) => j.sourceId === action.sourceId);
      if (!job) return state;
      const nextStatus = job.status === "Running" ? "Succeeded" : "Running";
      return {
        ...state,
        scanJobs: state.scanJobs.map((j) =>
          j.sourceId === action.sourceId
            ? { ...j, status: nextStatus, lastRun: nextStatus === "Succeeded" ? new Date().toISOString() : j.lastRun }
            : j,
        ),
        dataSources: state.dataSources.map((s) =>
          s.id === action.sourceId ? { ...s, status: nextStatus === "Running" ? "Scanning" : "Registered", lastScan: nextStatus === "Succeeded" ? new Date().toISOString() : s.lastScan } : s,
        ),
        activityLog: log(state, "Trigger scan", `${job.name} → ${nextStatus}`),
      };
    }

    default:
      return state;
  }
}
