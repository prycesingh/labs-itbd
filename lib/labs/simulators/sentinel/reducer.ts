import type {
  SentinelActivityEntry,
  SentinelAutomationRule,
  SentinelBookmark,
  SentinelEntityRisk,
  SentinelIncident,
  SentinelInstalledSolution,
  SentinelMitreTactic,
  SentinelQueryHistoryEntry,
  SentinelRepo,
  SentinelRule,
  SentinelSavedQuery,
  SentinelState,
  SentinelTiFeed,
  SentinelTiIndicator,
  SentinelWorkbook,
  SentinelWorkspace,
} from "./types";
import { MITRE_TACTIC_TECHNIQUE_COUNTS } from "./seedData";

const DEFAULT_ACTOR = "admin@itbd.onmicrosoft.com";

// Ported house style from defender/reducer.ts `log()` — prepends an activity entry
// and caps the log at 200 entries.
function log(state: SentinelState, operation: string, target: string, status: "Succeeded" | "Failed" = "Succeeded"): SentinelActivityEntry[] {
  const entry: SentinelActivityEntry = { timestamp: new Date().toISOString(), actor: DEFAULT_ACTOR, action: operation, target, status };
  return [entry, ...state.activityLog].slice(0, 200);
}

/**
 * Computes real MITRE ATT&CK coverage from the current rules array instead of
 * hardcoding static percentages (as source's sentinel-ueba-mitre.js did). For each
 * of the 14 tactics: ourCoverage = distinct enabled rules whose `tactics` includes
 * that tactic name (used as a stand-in "techniques covered" proxy — one rule can
 * stand for one technique's worth of coverage, capped at the tactic's real
 * technique count so coverage can never exceed 100%). alertsLast30d = count of
 * enabled rules for that tactic that have triggered within the last 30 days
 * (based on `lastTriggered`).
 */
export function computeMitreCoverage(rules: SentinelRule[]): SentinelMitreTactic[] {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  return MITRE_TACTIC_TECHNIQUE_COUNTS.map(({ tactic, techniques }) => {
    const enabledForTactic = rules.filter((r) => r.enabled && r.tactics.includes(tactic));
    const ourCoverage = Math.min(techniques, enabledForTactic.length);
    const alertsLast30d = enabledForTactic.filter((r) => {
      const t = Date.parse(r.lastTriggered);
      return !Number.isNaN(t) && now - t <= THIRTY_DAYS_MS;
    }).length;
    return { tactic, techniques, ourCoverage, alertsLast30d };
  });
}

export type SentinelAction =
  | { type: "LOAD_STATE"; state: SentinelState }

  // Incidents
  | { type: "UPDATE_INCIDENT"; id: string; patch: Partial<SentinelIncident> }
  | { type: "ADD_INCIDENT_COMMENT"; id: string; author: string; text: string }

  // Analytics rules
  | { type: "ADD_RULE"; rule: SentinelRule }
  | { type: "UPDATE_RULE"; id: string; patch: Partial<SentinelRule> }
  | { type: "TOGGLE_RULE_ENABLED"; id: string }
  | { type: "DELETE_RULE"; id: string }

  // Data connectors
  | { type: "TOGGLE_CONNECTOR"; id: string }

  // Workbooks
  | { type: "TOGGLE_WORKBOOK_PIN"; id: string }

  // Bookmarks
  | { type: "ADD_BOOKMARK"; bookmark: SentinelBookmark }

  // Playbooks
  | { type: "TOGGLE_PLAYBOOK_STATE"; id: string }

  // Automation rules
  | { type: "ADD_AUTOMATION_RULE"; rule: SentinelAutomationRule }
  | { type: "DELETE_AUTOMATION_RULE"; id: string }

  // Threat intelligence
  | { type: "ADD_TI_INDICATOR"; indicator: SentinelTiIndicator }
  | { type: "DELETE_TI_INDICATOR"; id: string }
  | { type: "TOGGLE_TI_FEED"; id: string }

  // Content hub
  | { type: "INSTALL_SOLUTION"; id: string }
  | { type: "UNINSTALL_SOLUTION"; id: string }

  // Repositories
  | { type: "ADD_REPO"; repo: SentinelRepo }
  | { type: "SYNC_REPO"; id: string }
  | { type: "DISCONNECT_REPO"; id: string }

  // Logs (saved queries + history)
  | { type: "ADD_SAVED_QUERY"; query: SentinelSavedQuery }
  | { type: "DELETE_SAVED_QUERY"; id: string }
  | { type: "RECORD_QUERY_HISTORY"; kql: string; rowCount: number }

  // Workspace settings
  | { type: "UPDATE_WORKSPACE_SETTINGS"; patch: Partial<SentinelWorkspace> }

  // UEBA entity risk
  | { type: "UPDATE_ENTITY_RISK"; id: string; patch: Partial<SentinelEntityRisk> };

export function sentinelReducer(state: SentinelState, action: SentinelAction): SentinelState {
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

    case "ADD_INCIDENT_COMMENT": {
      const incident = state.incidents.find((i) => i.id === action.id);
      if (!incident) return state;
      const comment = {
        id: `cmt-${Date.now().toString(36)}`,
        author: action.author,
        text: action.text,
        time: new Date().toISOString(),
      };
      return {
        ...state,
        incidents: state.incidents.map((i) => (i.id === action.id ? { ...i, comments: [...i.comments, comment] } : i)),
        activityLog: log(state, "Add incident comment", action.id),
      };
    }

    // ───────── Analytics rules ─────────
    case "ADD_RULE":
      return {
        ...state,
        rules: [action.rule, ...state.rules],
        activityLog: log(state, "Create analytics rule", action.rule.name),
      };

    case "UPDATE_RULE": {
      const rule = state.rules.find((r) => r.id === action.id);
      if (!rule) return state;
      return {
        ...state,
        rules: state.rules.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
        activityLog: log(state, "Update analytics rule", rule.name),
      };
    }

    case "TOGGLE_RULE_ENABLED": {
      const rule = state.rules.find((r) => r.id === action.id);
      if (!rule) return state;
      const nextEnabled = !rule.enabled;
      return {
        ...state,
        rules: state.rules.map((r) => (r.id === action.id ? { ...r, enabled: nextEnabled } : r)),
        activityLog: log(state, "Toggle rule", rule.name, "Succeeded"),
      };
    }

    case "DELETE_RULE": {
      const rule = state.rules.find((r) => r.id === action.id);
      if (!rule) return state;
      return {
        ...state,
        rules: state.rules.filter((r) => r.id !== action.id),
        activityLog: log(state, "Delete analytics rule", rule.name),
      };
    }

    // ───────── Data connectors ─────────
    case "TOGGLE_CONNECTOR": {
      const connector = state.connectors.find((c) => c.id === action.id);
      if (!connector) return state;
      const nextStatus = connector.status === "Connected" ? "Not connected" : "Connected";
      return {
        ...state,
        connectors: state.connectors.map((c) => (c.id === action.id ? { ...c, status: nextStatus } : c)),
        activityLog: log(state, "Toggle data connector", connector.name),
      };
    }

    // ───────── Workbooks ─────────
    case "TOGGLE_WORKBOOK_PIN": {
      const workbook = state.workbooks.find((w) => w.id === action.id);
      if (!workbook) return state;
      const pinned = state.pinnedWorkbooks.includes(action.id);
      return {
        ...state,
        pinnedWorkbooks: pinned ? state.pinnedWorkbooks.filter((id) => id !== action.id) : [...state.pinnedWorkbooks, action.id],
        activityLog: log(state, pinned ? "Unpin workbook" : "Pin workbook", workbook.name),
      };
    }

    // ───────── Bookmarks ─────────
    case "ADD_BOOKMARK":
      return {
        ...state,
        bookmarks: [action.bookmark, ...state.bookmarks],
        activityLog: log(state, "Create bookmark", action.bookmark.name),
      };

    // ───────── Playbooks ─────────
    case "TOGGLE_PLAYBOOK_STATE": {
      const playbook = state.playbooks.find((p) => p.id === action.id);
      if (!playbook) return state;
      const nextState = playbook.state === "Enabled" ? "Disabled" : "Enabled";
      return {
        ...state,
        playbooks: state.playbooks.map((p) => (p.id === action.id ? { ...p, state: nextState } : p)),
        activityLog: log(state, "Toggle playbook state", playbook.name),
      };
    }

    // ───────── Automation rules ─────────
    case "ADD_AUTOMATION_RULE":
      return {
        ...state,
        automationRules: [...state.automationRules, action.rule],
        activityLog: log(state, "Create automation rule", action.rule.name),
      };

    case "DELETE_AUTOMATION_RULE": {
      const rule = state.automationRules.find((r) => r.id === action.id);
      if (!rule) return state;
      return {
        ...state,
        automationRules: state.automationRules.filter((r) => r.id !== action.id),
        activityLog: log(state, "Delete automation rule", rule.name),
      };
    }

    // ───────── Threat intelligence ─────────
    case "ADD_TI_INDICATOR":
      return {
        ...state,
        threatIntel: { ...state.threatIntel, indicators: [action.indicator, ...state.threatIntel.indicators] },
        activityLog: log(state, "Add threat intel indicator", `${action.indicator.type}: ${action.indicator.value}`),
      };

    case "DELETE_TI_INDICATOR": {
      const indicator = state.threatIntel.indicators.find((i) => i.id === action.id);
      if (!indicator) return state;
      return {
        ...state,
        threatIntel: { ...state.threatIntel, indicators: state.threatIntel.indicators.filter((i) => i.id !== action.id) },
        activityLog: log(state, "Delete threat intel indicator", indicator.value),
      };
    }

    case "TOGGLE_TI_FEED": {
      const feed = state.threatIntel.feeds.find((f) => f.id === action.id);
      if (!feed) return state;
      const nextStatus = feed.status === "Connected" ? "Not connected" : "Connected";
      return {
        ...state,
        threatIntel: {
          ...state.threatIntel,
          feeds: state.threatIntel.feeds.map((f) => (f.id === action.id ? { ...f, status: nextStatus } : f)),
        },
        activityLog: log(state, "Toggle threat intel feed", feed.name),
      };
    }

    // ───────── Content hub ─────────
    // Genuinely pushes new rule/workbook records derived from the solution's
    // component counts into state.rules/state.workbooks (dedup-by-name), mirroring
    // source's real content-hub install behavior (finishInstall() in
    // sentinel-content-hub.js pushes rules with state=Disabled). Records an
    // InstalledSolution entry with the generated component names.
    case "INSTALL_SOLUTION": {
      const solution = state.solutions.find((s) => s.id === action.id);
      if (!solution) return state;

      const existingRuleNames = new Set(state.rules.map((r) => r.name));
      const existingWorkbookNames = new Set(state.workbooks.map((w) => w.name));

      const newRuleNames: string[] = [];
      const newRules: SentinelRule[] = [];
      for (let i = 0; i < solution.components.rules; i++) {
        const name = `${solution.name} rule ${i + 1}`;
        newRuleNames.push(name);
        if (!existingRuleNames.has(name)) {
          newRules.push({
            id: `rule-${Date.now().toString(36)}-${i}`,
            name,
            type: "Scheduled",
            dataSource: solution.name,
            tactics: [],
            enabled: false, // installed rules start Disabled, matching source
            severity: "Medium",
            created: new Date().toISOString().slice(0, 10),
            lastModified: new Date().toISOString().slice(0, 10),
            version: "1.0.0",
            lastTriggered: new Date(0).toISOString(),
            lookback: "24 hours",
            period: "1 hour",
            threshold: 5,
            groupBy: "Single alert",
            automation: null,
            kql: null,
          });
        }
      }

      const newWorkbookNames: string[] = [];
      const newWorkbooks: SentinelWorkbook[] = [];
      for (let i = 0; i < solution.components.workbooks; i++) {
        const name = `${solution.name} workbook ${i + 1}`;
        newWorkbookNames.push(name);
        if (!existingWorkbookNames.has(name)) {
          newWorkbooks.push({
            id: `wb-${Date.now().toString(36)}-${i}`,
            name,
            publisher: solution.publisher,
            dataSource: solution.name,
            categories: [solution.category],
            description: `Installed with the ${solution.name} solution.`,
            installed: true,
            version: "1.0.0",
          });
        }
      }

      const playbookNames = Array.from({ length: solution.components.playbooks }, (_, i) => `${solution.name} playbook ${i + 1}`);
      const huntingQueryNames = Array.from({ length: solution.components.huntingQueries }, (_, i) => `${solution.name} hunt ${i + 1}`);

      const installedEntry: SentinelInstalledSolution = {
        id: solution.id,
        version: "1.0.0",
        installedOn: new Date().toISOString().slice(0, 10),
        components: {
          rules: newRuleNames,
          workbooks: newWorkbookNames,
          playbooks: playbookNames,
          huntingQueries: huntingQueryNames,
        },
      };

      return {
        ...state,
        rules: [...newRules, ...state.rules],
        workbooks: [...state.workbooks, ...newWorkbooks],
        installedSolutions: [...state.installedSolutions.filter((s) => s.id !== action.id), installedEntry],
        activityLog: log(state, "Install solution", solution.name),
      };
    }

    // Removes the installed-solution record but intentionally leaves the rules and
    // workbooks that install added behind — this matches both the real Sentinel
    // product (uninstalling a Content Hub solution does not roll back the
    // analytics rules/workbooks it created) and source's uninstall() behavior in
    // sentinel-content-hub.js, whose confirm() dialog says exactly this.
    case "UNINSTALL_SOLUTION": {
      const installed = state.installedSolutions.find((s) => s.id === action.id);
      if (!installed) return state;
      const solution = state.solutions.find((s) => s.id === action.id);
      return {
        ...state,
        installedSolutions: state.installedSolutions.filter((s) => s.id !== action.id),
        activityLog: log(state, "Uninstall solution", solution?.name ?? action.id),
      };
    }

    // ───────── Repositories ─────────
    case "ADD_REPO":
      return {
        ...state,
        repos: [...state.repos, action.repo],
        activityLog: log(state, "Connect repository", action.repo.name),
      };

    case "SYNC_REPO": {
      const repo = state.repos.find((r) => r.id === action.id);
      if (!repo) return state;
      // Deterministic bump (not Math.random()) — proportional to how many rules are
      // already deployed from this repo, capped at +5 per sync so it stays modest.
      const bump = Math.min(5, 1 + Math.floor(repo.deployedRules / 20));
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.id ? { ...r, deployedRules: r.deployedRules + bump, status: "Connected", lastSync: new Date().toISOString() } : r,
        ),
        activityLog: log(state, "Sync repository", repo.name),
      };
    }

    case "DISCONNECT_REPO": {
      const repo = state.repos.find((r) => r.id === action.id);
      if (!repo) return state;
      return {
        ...state,
        repos: state.repos.filter((r) => r.id !== action.id),
        activityLog: log(state, "Disconnect repository", repo.name),
      };
    }

    // ───────── Logs: saved queries + history ─────────
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

    case "RECORD_QUERY_HISTORY": {
      const entry: SentinelQueryHistoryEntry = { kql: action.kql, ranAt: new Date().toISOString(), rowCount: action.rowCount };
      return {
        ...state,
        queryHistory: [entry, ...state.queryHistory].slice(0, 50),
      };
    }

    // ───────── Workspace settings ─────────
    case "UPDATE_WORKSPACE_SETTINGS":
      return {
        ...state,
        workspace: { ...state.workspace, ...action.patch },
        activityLog: log(state, "Update workspace settings", state.workspace.name),
      };

    // ───────── UEBA entity risk ─────────
    case "UPDATE_ENTITY_RISK": {
      const entity = state.entityRisks.find((e) => e.id === action.id);
      if (!entity) return state;
      return {
        ...state,
        entityRisks: state.entityRisks.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
        activityLog: log(state, "Update entity risk status", entity.name),
      };
    }

    default:
      return state;
  }
}
