"use client";

// Analytics Rules — ported from itbd-lab/simulators/sentinel/js/sentinel-rules.js.
// Active rules table (real filter chips + enable/disable + delete), a
// Templates gallery that reuses the same 40 seeded rules as "templates", a
// static Anomalies reference tab (3 UEBA-style rows, matching source's
// hardcoded anomaliesHtml()), and the 5-step Create Rule wizard
// (General -> Rule logic -> Incident settings -> Automation -> Review).
//
// Divergence from source (intentional, per this port's scope): source's
// wizard "Test query" button is fake (`toast('Query validated - 12 matching
// rows')`, hardcoded regardless of the actual query text). Here it calls the
// real KQL micro-interpreter (`runKqlQuery` over `buildSyntheticTables`) and
// reports the genuine row count + a sample of real rows.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SentinelRule, SentinelRuleType, SentinelSeverity, SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import { buildSyntheticTables, runKqlQuery } from "@/lib/labs/simulators/sentinel/kql-engine";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  SeverityBadge,
  StatRow,
  StatusPill,
  SubTabBar,
  WizStep,
  type DataTableColumn,
} from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

// Standard 14 MITRE ATT&CK tactics — matches the reference list hardcoded in
// lib/labs/simulators/sentinel/seedData.ts (module-local `TACTICS`, not
// exported, so reproduced verbatim here).
const TACTICS = [
  "Reconnaissance",
  "Resource Development",
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
];

const SEVERITY_OPTIONS: SentinelSeverity[] = ["High", "Medium", "Low", "Informational"];
const RULE_TYPE_FILTERS: (SentinelRuleType | "all")[] = ["all", "Scheduled", "NRT", "Microsoft Security", "Anomaly", "ML Behavioral", "Fusion"];

const DEFAULT_KQL =
  "SecurityEvent\n| where TimeGenerated > ago(1h)\n| where EventID == 4625\n| summarize count() by Account, IpAddress\n| where count_ > 10";

// Static UEBA-style reference rows for the Anomalies tab — matches source's
// hardcoded anomaliesHtml() 3 rows exactly (name/type/severity/status/lastTriggered).
const ANOMALY_ROWS: { name: string; type: string; severity: SentinelSeverity; lastTriggered: string }[] = [
  { name: "Anomalous data transfer", type: "UEBA", severity: "Medium", lastTriggered: "3 hours ago" },
  { name: "Anomalous logon time", type: "UEBA", severity: "Low", lastTriggered: "1 day ago" },
  { name: "Anomalous resource deployment volume", type: "UEBA", severity: "Medium", lastTriggered: "5 days ago" },
];

// ===== Wizard dot-path state =====
// Mirrors source's `wizardState` shape (general / ruleLogic / incidentSettings
// / automation) and its `wizSet('path.to.field', value)` setter, reimplemented
// as an immutable local React state update instead of source's direct mutation.
type WizardState = {
  general: {
    name: string;
    description: string;
    tactics: string[];
    severity: SentinelSeverity;
    status: "Enabled" | "Disabled";
  };
  ruleLogic: {
    kql: string;
    frequency: string;
    period: string;
    threshold: string;
    groupBy: string;
  };
  incidentSettings: {
    create: boolean;
    groupAlerts: string;
    reopen: "Enabled" | "Disabled";
    stopGrouping: string;
    alertTitleOverride: string;
    alertSeverityOverride: SentinelSeverity | "";
  };
  automation: {
    playbook: string;
  };
};

function freshWizardState(): WizardState {
  return {
    general: { name: "", description: "", tactics: [], severity: "Medium", status: "Enabled" },
    ruleLogic: { kql: DEFAULT_KQL, frequency: "5 minutes", period: "1 hour", threshold: "0", groupBy: "Single alert" },
    incidentSettings: {
      create: true,
      groupAlerts: "Group all alerts triggered by this rule",
      reopen: "Disabled",
      stopGrouping: "5 hours",
      alertTitleOverride: "",
      alertSeverityOverride: "",
    },
    automation: { playbook: "" },
  };
}

function wizardStateFromRule(rule: SentinelRule): WizardState {
  const fresh = freshWizardState();
  return {
    ...fresh,
    general: {
      ...fresh.general,
      name: `${rule.name} (copy)`,
      severity: rule.severity,
      tactics: [...rule.tactics],
    },
    ruleLogic: {
      ...fresh.ruleLogic,
      kql: rule.kql || fresh.ruleLogic.kql,
      period: rule.period || fresh.ruleLogic.period,
      threshold: String(rule.threshold ?? fresh.ruleLogic.threshold),
      groupBy: rule.groupBy || fresh.ruleLogic.groupBy,
    },
    automation: { playbook: rule.automation ?? "" },
  };
}

type FilterState = { type: SentinelRuleType | "all"; dataSource: string; tactic: string };

function uniqueBy<T, K extends keyof T>(arr: T[], key: K): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const v = String(item[key]);
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

const WIZARD_STEPS = ["General", "Set rule logic", "Incident settings", "Automated response", "Review and create"] as const;

export function RulesPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [tab, setTab] = useState<"active" | "templates" | "anomalies">("active");
  const [filter, setFilter] = useState<FilterState>({ type: "all", dataSource: "all", tactic: "all" });
  const [detailRule, setDetailRule] = useState<SentinelRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SentinelRule | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStepIdx, setWizStepIdx] = useState(0);
  const [wiz, setWiz] = useState<WizardState>(freshWizardState());
  const [testResult, setTestResult] = useState<{ rowCount: number; scannedRows: number; sample: Record<string, string | number>[]; error?: string } | null>(null);

  // Built once and reused across "Test query" calls — real synthetic tables
  // derived from the same seeded roster (users/devices) as the rest of the
  // simulator, per kql-engine.ts's documented convention.
  const tables = useMemo(() => buildSyntheticTables(state.users, state.devices), [state.users, state.devices]);

  const enabledCount = state.rules.filter((r) => r.enabled).length;
  const disabledCount = state.rules.length - enabledCount;
  const withAutomationCount = state.rules.filter((r) => r.automation).length;

  const dataSources = uniqueBy(state.rules, "dataSource");

  const filteredActive = state.rules.filter((r) => {
    if (filter.type !== "all" && r.type !== filter.type) return false;
    if (filter.dataSource !== "all" && r.dataSource !== filter.dataSource) return false;
    if (filter.tactic !== "all" && !r.tactics.includes(filter.tactic)) return false;
    return true;
  });

  const filteredTemplates = state.rules.filter((r) => {
    if (filter.dataSource !== "all" && r.dataSource !== filter.dataSource) return false;
    if (filter.tactic !== "all" && !r.tactics.includes(filter.tactic)) return false;
    return true;
  });

  function relativeTime(iso: string): string {
    if (!iso || iso === "Never") return "Never";
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    const diffMs = Date.now() - t;
    if (diffMs < 0) return "just now";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function handleToggle(rule: SentinelRule, e: React.MouseEvent) {
    e.stopPropagation();
    dispatch({ type: "TOGGLE_RULE_ENABLED", id: rule.id });
    toast.success(`Rule "${rule.name}" ${rule.enabled ? "disabled" : "enabled"}`);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_RULE", id: deleteTarget.id });
    toast.success(`Analytics rule "${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
  }

  function openWizard(template?: SentinelRule) {
    setWiz(template ? wizardStateFromRule(template) : freshWizardState());
    setWizStepIdx(0);
    setTestResult(null);
    setWizardOpen(true);
    if (template) toast.info(`Template "${template.name}" — customize before saving`);
  }

  function closeWizard() {
    setWizardOpen(false);
  }

  function patchGeneral(patch: Partial<WizardState["general"]>) {
    setWiz((w) => ({ ...w, general: { ...w.general, ...patch } }));
  }
  function patchRuleLogic(patch: Partial<WizardState["ruleLogic"]>) {
    setWiz((w) => ({ ...w, ruleLogic: { ...w.ruleLogic, ...patch } }));
  }
  function patchIncident(patch: Partial<WizardState["incidentSettings"]>) {
    setWiz((w) => ({ ...w, incidentSettings: { ...w.incidentSettings, ...patch } }));
  }
  function patchAutomation(patch: Partial<WizardState["automation"]>) {
    setWiz((w) => ({ ...w, automation: { ...w.automation, ...patch } }));
  }

  function toggleTactic(t: string) {
    setWiz((w) => ({
      ...w,
      general: {
        ...w.general,
        tactics: w.general.tactics.includes(t) ? w.general.tactics.filter((x) => x !== t) : [...w.general.tactics, t],
      },
    }));
  }

  // REAL "Test query" — runs the genuine KQL micro-interpreter against the
  // synthetic table store and reports the actual row count / sample rows.
  // Never fabricated: unlike source's hardcoded toast, this reflects whatever
  // the current draft KQL text actually produces.
  function runTestQuery() {
    const result = runKqlQuery(wiz.ruleLogic.kql, tables);
    setTestResult({ rowCount: result.rowCount, scannedRows: result.scannedRows, sample: result.rows.slice(0, 5), error: result.error });
    dispatch({ type: "RECORD_QUERY_HISTORY", kql: wiz.ruleLogic.kql, rowCount: result.rowCount });
    if (result.error && result.rowCount === 0 && result.scannedRows === 0) {
      toast.error(`Query validation failed: ${result.error}`);
    } else {
      toast.success(`Query validated — ${result.rowCount} matching row${result.rowCount === 1 ? "" : "s"} (scanned ${result.scannedRows})`);
    }
  }

  function goToStep(idx: number) {
    setWizStepIdx(idx);
  }
  function nextStep() {
    setWizStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1));
  }
  function prevStep() {
    setWizStepIdx((i) => Math.max(0, i - 1));
  }

  function commitWizard() {
    if (!wiz.general.name.trim()) {
      toast.error("Rule name is required");
      setWizStepIdx(0);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newRule: SentinelRule = {
      id: `rule-${crypto.randomUUID()}`,
      name: wiz.general.name.trim(),
      type: "Scheduled",
      dataSource: "Custom",
      tactics: [...wiz.general.tactics],
      enabled: wiz.general.status === "Enabled",
      severity: wiz.general.severity,
      created: today,
      lastModified: today,
      version: "1.0.0",
      lastTriggered: "Never",
      lookback: wiz.ruleLogic.period,
      period: wiz.ruleLogic.period,
      threshold: Number(wiz.ruleLogic.threshold) || 0,
      groupBy: wiz.incidentSettings.groupAlerts,
      automation: wiz.automation.playbook.trim() ? wiz.automation.playbook.trim() : null,
      kql: wiz.ruleLogic.kql,
    };
    dispatch({ type: "ADD_RULE", rule: newRule });
    toast.success(`Analytics rule "${newRule.name}" created`);
    setWizardOpen(false);
  }

  return (
    <div>
      <SubTabBar
        tabs={[
          { key: "active", label: "Active rules" },
          { key: "templates", label: "Rule templates" },
          { key: "anomalies", label: "Anomalies" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === "active" && (
        <ActiveRulesTab
          state={state}
          filter={filter}
          setFilter={setFilter}
          filtered={filteredActive}
          enabledCount={enabledCount}
          disabledCount={disabledCount}
          withAutomationCount={withAutomationCount}
          dataSources={dataSources}
          relativeTime={relativeTime}
          onToggle={handleToggle}
          onDelete={setDeleteTarget}
          onRowClick={setDetailRule}
          onCreate={() => openWizard()}
        />
      )}

      {tab === "templates" && (
        <TemplatesTab filter={filter} setFilter={setFilter} filtered={filteredTemplates} onInstall={(r) => openWizard(r)} />
      )}

      {tab === "anomalies" && <AnomaliesTab />}

      {detailRule && (
        <Flyout title={detailRule.name} subtitle={`${detailRule.type} · ${detailRule.dataSource}`} onClose={() => setDetailRule(null)}>
          <RuleDetail rule={detailRule} />
        </Flyout>
      )}

      {deleteTarget && (
        <Modal
          title="Delete analytics rule"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={handleDeleteConfirm}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete analytics rule <strong>{deleteTarget.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}

      {wizardOpen && (
        <Modal
          title="Analytics rule wizard - Scheduled query rule"
          onClose={closeWizard}
          width="920px"
          steps={
            <>
              {WIZARD_STEPS.map((label, i) => (
                <WizStep key={label} label={`${i + 1}. ${label}`} active={wizStepIdx === i} done={wizStepIdx > i} onClick={() => goToStep(i)} />
              ))}
            </>
          }
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={closeWizard}>
                Cancel
              </button>
              <div style={{ flex: 1 }} />
              {wizStepIdx > 0 && (
                <button type="button" className={styles.btnOutline} onClick={prevStep}>
                  &lt; Previous
                </button>
              )}
              {wizStepIdx < WIZARD_STEPS.length - 1 ? (
                <button type="button" className={styles.btn} onClick={nextStep}>
                  Next : {WIZARD_STEPS[wizStepIdx + 1]} &gt;
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={commitWizard}>
                  Save
                </button>
              )}
            </>
          }
        >
          {wizStepIdx === 0 && <GeneralStep general={wiz.general} patch={patchGeneral} toggleTactic={toggleTactic} />}
          {wizStepIdx === 1 && (
            <RuleLogicStep ruleLogic={wiz.ruleLogic} patch={patchRuleLogic} onTestQuery={runTestQuery} testResult={testResult} />
          )}
          {wizStepIdx === 2 && <IncidentStep incident={wiz.incidentSettings} patch={patchIncident} />}
          {wizStepIdx === 3 && <AutomationStep automation={wiz.automation} patch={patchAutomation} playbooks={state.playbooks} />}
          {wizStepIdx === 4 && <ReviewStep wiz={wiz} />}
        </Modal>
      )}
    </div>
  );
}

// ===================== ACTIVE RULES TAB =====================

function FilterChips({ filter, setFilter, dataSources }: { filter: FilterState; setFilter: React.Dispatch<React.SetStateAction<FilterState>>; dataSources: string[] }) {
  return (
    <div className={styles.filterRow}>
      {RULE_TYPE_FILTERS.map((t) => (
        <button
          key={t}
          type="button"
          className={`${styles.chip} ${filter.type === t ? styles.chipActive : ""}`}
          onClick={() => setFilter((f) => ({ ...f, type: t }))}
        >
          {t === "all" ? "Type: any" : t}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.chip} ${filter.dataSource === "all" ? styles.chipActive : ""}`}
        onClick={() => setFilter((f) => ({ ...f, dataSource: "all" }))}
      >
        Source: any
      </button>
      {dataSources.slice(0, 6).map((s) => (
        <button
          key={s}
          type="button"
          className={`${styles.chip} ${filter.dataSource === s ? styles.chipActive : ""}`}
          onClick={() => setFilter((f) => ({ ...f, dataSource: s }))}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ActiveRulesTab({
  state,
  filter,
  setFilter,
  filtered,
  enabledCount,
  disabledCount,
  withAutomationCount,
  dataSources,
  relativeTime,
  onToggle,
  onDelete,
  onRowClick,
  onCreate,
}: {
  state: SentinelState;
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  filtered: SentinelRule[];
  enabledCount: number;
  disabledCount: number;
  withAutomationCount: number;
  dataSources: string[];
  relativeTime: (iso: string) => string;
  onToggle: (rule: SentinelRule, e: React.MouseEvent) => void;
  onDelete: (rule: SentinelRule) => void;
  onRowClick: (rule: SentinelRule) => void;
  onCreate: () => void;
}) {
  const columns: DataTableColumn<SentinelRule>[] = [
    { key: "status", header: "Status", render: (r) => <StatusPill tone={r.enabled ? "ok" : "muted"}>{r.enabled ? "Enabled" : "Disabled"}</StatusPill> },
    { key: "severity", header: "Severity", render: (r) => <SeverityBadge severity={r.severity} /> },
    { key: "name", header: "Name", render: (r) => <span className={styles.rowLink}>{r.name}</span> },
    { key: "type", header: "Type", render: (r) => r.type },
    { key: "dataSource", header: "Data source", render: (r) => r.dataSource },
    {
      key: "tactics",
      header: "Tactics",
      render: (r) => (
        <>
          {r.tactics.slice(0, 2).map((t) => (
            <span key={t} className={styles.mitre}>
              {t}
            </span>
          ))}
        </>
      ),
    },
    { key: "lastTriggered", header: "Last triggered", render: (r) => relativeTime(r.lastTriggered) },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button type="button" className={styles.btnOutline} style={{ padding: "3px 8px", fontSize: 11 }} onClick={(e) => onToggle(r, e)}>
          {r.enabled ? "Disable" : "Enable"}
        </button>
      ),
    },
    {
      key: "delete",
      header: "",
      render: (r) => (
        <button
          type="button"
          className={styles.btnOutline}
          style={{ padding: "3px 8px", fontSize: 11 }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <StatRow
        stats={[
          { label: "Total rules", value: state.rules.length },
          { label: "Enabled", value: enabledCount },
          { label: "Disabled", value: disabledCount },
          { label: "With playbook automation", value: withAutomationCount },
        ]}
      />

      <div style={{ marginBottom: 10, display: "flex", gap: 8 }}>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
        <button type="button" className={styles.btnOutline} onClick={() => toast.info("Import from template — use the Rule templates tab.")}>
          Import from template
        </button>
      </div>

      <FilterChips filter={filter} setFilter={setFilter} dataSources={dataSources} />

      <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.id} onRowClick={onRowClick} emptyMessage="No rules match the current filters." />
    </div>
  );
}

// ===================== RULE DETAIL FLYOUT =====================

function RuleDetail({ rule }: { rule: SentinelRule }) {
  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Properties</div>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>
            <strong>Status:</strong> <StatusPill tone={rule.enabled ? "ok" : "muted"}>{rule.enabled ? "Enabled" : "Disabled"}</StatusPill>
          </div>
          <div>
            <strong>Severity:</strong> <SeverityBadge severity={rule.severity} />
          </div>
          <div>
            <strong>Type:</strong> {rule.type}
          </div>
          <div>
            <strong>Data source:</strong> {rule.dataSource}
          </div>
          <div>
            <strong>Tactics:</strong>{" "}
            {rule.tactics.length ? rule.tactics.map((t) => <span key={t} className={styles.mitre}>{t}</span>) : "(none)"}
          </div>
          <div>
            <strong>Created:</strong> {rule.created}
          </div>
          <div>
            <strong>Last modified:</strong> {rule.lastModified}
          </div>
          <div>
            <strong>Version:</strong> {rule.version}
          </div>
          <div>
            <strong>Last triggered:</strong> {rule.lastTriggered}
          </div>
          <div>
            <strong>Lookback:</strong> {rule.lookback}
          </div>
          <div>
            <strong>Period:</strong> {rule.period}
          </div>
          <div>
            <strong>Threshold:</strong> {rule.threshold}
          </div>
          <div>
            <strong>Group by:</strong> {rule.groupBy}
          </div>
          <div>
            <strong>Automation:</strong> {rule.automation ?? "None"}
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>KQL query</div>
        {rule.kql ? (
          <pre className={styles.kql} style={{ minHeight: "auto", whiteSpace: "pre-wrap" }}>
            {rule.kql}
          </pre>
        ) : (
          <EmptyState message="No KQL query attached to this rule." />
        )}
      </div>
    </div>
  );
}

// ===================== TEMPLATES TAB =====================

function TemplatesTab({
  filter,
  setFilter,
  filtered,
  onInstall,
}: {
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  filtered: SentinelRule[];
  onInstall: (rule: SentinelRule) => void;
}) {
  const sources = ["all", "Azure AD", "Office 365", "Azure Activity", "Microsoft 365 Defender", "Threat Intelligence", "Security Events", "DNS", "AWS CloudTrail", "Syslog"];
  const tactics = ["all", ...TACTICS];

  return (
    <div>
      <div className={styles.sub}>Browse rule templates from Microsoft and 3rd-party solutions. Filter by data source or MITRE tactic.</div>

      <div className={styles.filterRow}>
        {sources.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${filter.dataSource === s ? styles.chipActive : ""}`}
            onClick={() => setFilter((f) => ({ ...f, dataSource: s }))}
          >
            {s === "all" ? "Source: any" : s}
          </button>
        ))}
      </div>
      <div className={styles.filterRow}>
        {tactics.slice(0, 8).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.chip} ${filter.tactic === t ? styles.chipActive : ""}`}
            onClick={() => setFilter((f) => ({ ...f, tactic: t }))}
          >
            {t === "all" ? "Tactic: any" : t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No templates match the current filters." />
      ) : (
        <div className={styles.tileGrid}>
          {filtered.map((r) => (
            <div key={r.id} className={styles.tile} onClick={() => onInstall(r)}>
              <div className={styles.tileTitle}>{r.name}</div>
              <div className={styles.tileSub}>
                {r.type} &middot; {r.dataSource}
              </div>
              <div style={{ marginTop: 6 }}>
                {r.tactics.slice(0, 2).map((t) => (
                  <span key={t} className={styles.mitre}>
                    {t}
                  </span>
                ))}
              </div>
              <div className={styles.tileFoot}>
                <SeverityBadge severity={r.severity} /> &middot; {r.enabled ? "Active" : "Available"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== ANOMALIES TAB =====================

function AnomaliesTab() {
  const columns: DataTableColumn<(typeof ANOMALY_ROWS)[number]>[] = [
    { key: "name", header: "Name", render: (r) => <span className={styles.rowLink}>{r.name}</span> },
    { key: "type", header: "Type", render: (r) => r.type },
    { key: "severity", header: "Severity", render: (r) => <SeverityBadge severity={r.severity} /> },
    { key: "status", header: "Status", render: () => <StatusPill tone="ok">Enabled</StatusPill> },
    { key: "lastTriggered", header: "Last triggered", render: (r) => r.lastTriggered },
  ];
  return (
    <div>
      <div className={styles.sub}>UEBA-style anomaly rules powered by ML.</div>
      <DataTable columns={columns} rows={ANOMALY_ROWS} getRowKey={(r) => r.name} emptyMessage="No anomaly rules." />
    </div>
  );
}

// ===================== WIZARD STEP 1: GENERAL =====================

function GeneralStep({
  general,
  patch,
  toggleTactic,
}: {
  general: WizardState["general"];
  patch: (p: Partial<WizardState["general"]>) => void;
  toggleTactic: (t: string) => void;
}) {
  return (
    <div>
      <Field label="Name *">
        <input
          type="text"
          className={styles.input}
          value={general.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="My analytics rule"
        />
      </Field>
      <Field label="Description">
        <textarea
          className={styles.textarea}
          rows={3}
          style={{ fontFamily: "inherit" }}
          value={general.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
      <Field label="Severity">
        <NativeSelect
          value={general.severity}
          onChange={(v) => patch({ severity: v as SentinelSeverity })}
          options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
      </Field>
      <Field label="MITRE ATT&CK tactics">
        <div style={{ maxHeight: 140, overflowY: "auto", background: "#fafafa", padding: 8, border: "1px solid #edebe9" }}>
          {TACTICS.map((t) => (
            <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, margin: "4px 8px 4px 0", fontSize: 12 }}>
              <input type="checkbox" checked={general.tactics.includes(t)} onChange={() => toggleTactic(t)} /> {t}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Status">
        <NativeSelect
          value={general.status}
          onChange={(v) => patch({ status: v as "Enabled" | "Disabled" })}
          options={[
            { value: "Enabled", label: "Enabled" },
            { value: "Disabled", label: "Disabled" },
          ]}
        />
      </Field>
    </div>
  );
}

// ===================== WIZARD STEP 2: RULE LOGIC =====================

function RuleLogicStep({
  ruleLogic,
  patch,
  onTestQuery,
  testResult,
}: {
  ruleLogic: WizardState["ruleLogic"];
  patch: (p: Partial<WizardState["ruleLogic"]>) => void;
  onTestQuery: () => void;
  testResult: { rowCount: number; scannedRows: number; sample: Record<string, string | number>[]; error?: string } | null;
}) {
  return (
    <div>
      <Field label="Rule query *">
        <textarea className={styles.kql} value={ruleLogic.kql} onChange={(e) => patch({ kql: e.target.value })} />
        <div style={{ marginTop: 6 }}>
          <button type="button" className={styles.btnOutline} onClick={onTestQuery}>
            Test query
          </button>
        </div>
        {testResult && (
          <div className={styles.resultsInfo} style={{ marginTop: 8 }}>
            {testResult.error && testResult.scannedRows === 0 && testResult.rowCount === 0 ? (
              <span>{testResult.error}</span>
            ) : (
              <>
                <div>
                  <strong>{testResult.rowCount}</strong> matching row{testResult.rowCount === 1 ? "" : "s"} (scanned {testResult.scannedRows})
                  {testResult.error ? ` — ${testResult.error}` : ""}
                </div>
                {testResult.sample.length > 0 && (
                  <pre style={{ marginTop: 6, fontFamily: "Consolas, monospace", fontSize: 11, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(testResult.sample, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </Field>

      <div className={styles.h3}>Query scheduling</div>
      <div className={styles.row}>
        <Field label="Run query every">
          <input type="text" className={styles.input} value={ruleLogic.frequency} onChange={(e) => patch({ frequency: e.target.value })} />
        </Field>
        <Field label="Lookup data from the last">
          <input type="text" className={styles.input} value={ruleLogic.period} onChange={(e) => patch({ period: e.target.value })} />
        </Field>
      </div>
      <Field label="Alert threshold (number of results >)">
        <input type="text" className={styles.input} value={ruleLogic.threshold} onChange={(e) => patch({ threshold: e.target.value })} />
      </Field>
      <Field label="Group by">
        <input type="text" className={styles.input} value={ruleLogic.groupBy} onChange={(e) => patch({ groupBy: e.target.value })} />
      </Field>
    </div>
  );
}

// ===================== WIZARD STEP 3: INCIDENT SETTINGS =====================

function IncidentStep({ incident, patch }: { incident: WizardState["incidentSettings"]; patch: (p: Partial<WizardState["incidentSettings"]>) => void }) {
  return (
    <div>
      <Field label="">
        <Checkbox
          label="Create incidents from alerts triggered by this analytics rule"
          checked={incident.create}
          onChange={(checked) => patch({ create: checked })}
        />
      </Field>

      <div className={styles.h3}>Alert grouping</div>
      <Field label="Group related alerts">
        <NativeSelect
          value={incident.groupAlerts}
          onChange={(v) => patch({ groupAlerts: v })}
          options={[
            { value: "Group all alerts triggered by this rule", label: "Group all alerts triggered by this rule" },
            {
              value: "Group alerts triggered by this rule on matching entities and details",
              label: "Group alerts triggered by this rule on matching entities and details",
            },
            { value: "Do not group", label: "Do not group" },
          ]}
        />
      </Field>
      <Field label="Re-open closed matching incidents">
        <NativeSelect
          value={incident.reopen}
          onChange={(v) => patch({ reopen: v as "Enabled" | "Disabled" })}
          options={[
            { value: "Disabled", label: "Disabled" },
            { value: "Enabled", label: "Enabled" },
          ]}
        />
      </Field>
      <Field label="Stop grouping after">
        <input type="text" className={styles.input} value={incident.stopGrouping} onChange={(e) => patch({ stopGrouping: e.target.value })} />
      </Field>

      <div className={styles.h3}>Alert details customization</div>
      <Field label="Alert title override">
        <input
          type="text"
          className={styles.input}
          value={incident.alertTitleOverride}
          onChange={(e) => patch({ alertTitleOverride: e.target.value })}
          placeholder="(use rule name)"
        />
      </Field>
      <Field label="Alert severity override">
        <NativeSelect
          value={incident.alertSeverityOverride}
          onChange={(v) => patch({ alertSeverityOverride: v as SentinelSeverity | "" })}
          options={[{ value: "", label: "(none — use rule severity)" }, ...SEVERITY_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
      </Field>
    </div>
  );
}

// ===================== WIZARD STEP 4: AUTOMATION =====================

function AutomationStep({
  automation,
  patch,
  playbooks,
}: {
  automation: WizardState["automation"];
  patch: (p: Partial<WizardState["automation"]>) => void;
  playbooks: SentinelState["playbooks"];
}) {
  return (
    <div>
      <div className={styles.sub}>Configure automation to run when this analytics rule fires.</div>
      <Field label="Run playbook on alert/incident" help="Cross-referenced from the Playbooks page; leave blank for no automation.">
        <NativeSelect
          value={automation.playbook}
          onChange={(v) => patch({ playbook: v })}
          options={[{ value: "", label: "(none)" }, ...playbooks.map((p) => ({ value: `Playbook: ${p.name}`, label: `${p.name} (${p.trigger})` }))]}
        />
      </Field>
      <div className={styles.h3}>Automation rules</div>
      <div className={styles.card}>
        <div style={{ fontSize: 13 }}>
          No automation rules configured. Create one to automatically assign owners, suppress duplicate incidents, or run playbooks based on
          conditions.
        </div>
      </div>
    </div>
  );
}

// ===================== WIZARD STEP 5: REVIEW =====================

function ReviewStep({ wiz }: { wiz: WizardState }) {
  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Review and create</div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div>
            <strong>Name:</strong> {wiz.general.name || "(not set)"}
          </div>
          <div>
            <strong>Severity:</strong> {wiz.general.severity}
          </div>
          <div>
            <strong>Status:</strong> {wiz.general.status}
          </div>
          <div>
            <strong>Tactics:</strong> {wiz.general.tactics.length ? wiz.general.tactics.join(", ") : "(none)"}
          </div>
          <div>
            <strong>Query period:</strong> {wiz.ruleLogic.period}, every {wiz.ruleLogic.frequency}
          </div>
          <div>
            <strong>Threshold:</strong> {wiz.ruleLogic.threshold}
          </div>
          <div>
            <strong>Create incidents:</strong> {wiz.incidentSettings.create ? "Yes" : "No"}
          </div>
          <div>
            <strong>Grouping:</strong> {wiz.incidentSettings.groupAlerts}
          </div>
          <div>
            <strong>Automation:</strong> {wiz.automation.playbook || "None"}
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>KQL query</div>
        <pre className={styles.kql} style={{ minHeight: "auto", whiteSpace: "pre-wrap" }}>
          {wiz.ruleLogic.kql}
        </pre>
      </div>
    </div>
  );
}
