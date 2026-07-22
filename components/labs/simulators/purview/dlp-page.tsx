"use client";

// Data loss prevention (DLP) page for the Microsoft Purview compliance-portal
// simulator. Ported from itbd-lab/simulators/purview/js/purview-dlp.js (625
// lines) — Overview / Policies / Sensitive info types / Templates tabs, a
// policies table with a rule-detail flyout, and a 6-step "Create policy"
// wizard (Template -> Basics -> Locations -> Rules -> Mode -> Review) that
// creates a policy with one default rule, matching source's `wizFinish()`
// shape 1:1 (`ADD_DLP_POLICY`).
//
// Source's "Endpoint DLP settings" and "Browser & domain restrictions" tabs
// and its "Classifiers" tab are out of scope for this page per the task brief
// (this page covers Overview/Policies/Test policy/Sensitive info types/
// Templates only); its "Top DLP incidents" bar chart was 100% hardcoded fake
// numbers with no backing state, so it is replaced here with a genuine
// "rules by severity" bar summary computed from `state.dlpPolicies` at render
// time. There is also a brand-new "Test policy" tab with no equivalent in
// source at all: it runs pasted sample content through the real regex-based
// DLP engine (dlp-engine.ts) against one or all policies and displays the
// actual matches found (never fabricated counts) — the flagship "make it
// real" feature for this sub-phase.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import type { PurviewDlpPolicy, PurviewDlpRule, PurviewState } from "@/lib/labs/simulators/purview/types";
import { scanContentAgainstAllPolicies, scanContentAgainstPolicy, type DlpRuleMatchResult } from "@/lib/labs/simulators/purview/dlp-engine";

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
} from "./purview-ui";
import styles from "./purview-console.module.css";

// ===== Local types =====

type SubTab = "overview" | "policies" | "test" | "sit" | "templates";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "policies", label: "Policies" },
  { key: "test", label: "Test policy" },
  { key: "sit", label: "Sensitive info types" },
  { key: "templates", label: "Templates" },
];

// Locations offered by the create-policy wizard, matching source's
// `ALL_LOCATIONS` (id + label pairs used for both the checkbox list and the
// review-step summary).
const ALL_LOCATIONS: { id: string; label: string }[] = [
  { id: "Exchange", label: "Exchange email" },
  { id: "SharePoint", label: "SharePoint sites" },
  { id: "OneDrive", label: "OneDrive accounts" },
  { id: "Teams chat", label: "Teams chat & channel messages" },
  { id: "Endpoint", label: "Devices (Endpoint)" },
  { id: "Defender for Cloud Apps", label: "Defender for Cloud Apps" },
  { id: "On-premises", label: "On-premises repositories" },
  { id: "Power BI", label: "Power BI workspaces" },
  { id: "Power Platform", label: "Power Platform (Fabric)" },
];

const RULE_ACTIONS = ["Notify user with policy tip", "Block access", "Restrict access externally", "Send incident report"];

const RUN_MODES: { value: PurviewDlpPolicy["runMode"]; label: string }[] = [
  { value: "Test", label: "Run the policy in test mode (no actions taken)" },
  { value: "Test+notify", label: "Run in test mode and show policy tips" },
  { value: "On", label: "Turn it on right away" },
];

// Create-policy wizard step ids, in order — matches source's `WIZ_STEPS`.
type WizStepId = "template" | "basics" | "locations" | "rules" | "mode" | "review";

const WIZ_STEPS: { id: WizStepId; label: string }[] = [
  { id: "template", label: "Choose template" },
  { id: "basics", label: "Name & description" },
  { id: "locations", label: "Choose locations" },
  { id: "rules", label: "Define settings" },
  { id: "mode", label: "Test or turn on" },
  { id: "review", label: "Review & finish" },
];

type WizardRule = { name: string; conditions: string; actions: string; severity: PurviewDlpRule["severity"] };

function freshWizardRule(): WizardRule {
  return { name: "Default rule", conditions: "Credit Card Number (1+)", actions: RULE_ACTIONS[0], severity: "Medium" };
}

type WizardState = {
  template: string;
  name: string;
  description: string;
  locations: string[];
  rule: WizardRule;
  sendReport: boolean;
  runMode: PurviewDlpPolicy["runMode"];
};

function freshWizard(firstTemplate: string): WizardState {
  return {
    template: firstTemplate,
    name: "",
    description: "",
    locations: ["Exchange", "SharePoint", "OneDrive"],
    rule: freshWizardRule(),
    sendReport: true,
    runMode: "Test",
  };
}

// Sample content pre-fill for the Test policy tab's "Load sample text" button
// — a realistic multi-line blob containing several genuinely matchable
// patterns (SSN-shaped digits, a plausible Visa-shaped card number that
// passes the engine's Luhn check, an email, and a fake-but-shaped AWS access
// key) so a user can try the real scan immediately without composing input.
const SAMPLE_TEXT = `Hi team,

Attaching the customer intake form for our new account. Please handle carefully:

Customer SSN: 078-05-1120
Billing card on file: 4111 1111 1111 1111
Contact email: sunita@cloudlab.in

Also, ops - the old deploy key still works, please rotate it:
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE

Let me know once this is filed. Thanks!
`;

export function DlpPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [tab, setTab] = useState<SubTab>("overview");

  // ===== Policies tab state =====
  const [search, setSearch] = useState("");
  const [detailPolicyId, setDetailPolicyId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizStepId>("template");
  const [wizard, setWizard] = useState<WizardState>(() => freshWizard(state.dlpTemplates[0] ?? "Custom"));

  // ===== Test policy tab state =====
  const [testContent, setTestContent] = useState("");
  const [testPolicyId, setTestPolicyId] = useState<string>("__all__");
  const [testResults, setTestResults] = useState<
    { policyId: string; policyName: string; ruleResults: DlpRuleMatchResult[] }[] | null
  >(null);

  // ===== Sensitive info types tab state =====
  const [sitSearch, setSitSearch] = useState("");

  const detailPolicy = detailPolicyId ? state.dlpPolicies.find((p) => p.id === detailPolicyId) ?? null : null;

  // ===== Overview: real derived stats =====
  const activeCount = useMemo(() => state.dlpPolicies.filter((p) => p.status === "Active").length, [state.dlpPolicies]);
  const totalRules = useMemo(() => state.dlpPolicies.reduce((sum, p) => sum + p.rules.length, 0), [state.dlpPolicies]);
  const locationCoverage = useMemo(() => {
    const set = new Set<string>();
    for (const p of state.dlpPolicies) for (const l of p.locations) set.add(l);
    return set.size;
  }, [state.dlpPolicies]);

  const severityCounts = useMemo(() => {
    const counts: Record<PurviewDlpRule["severity"], number> = { High: 0, Medium: 0, Low: 0 };
    for (const p of state.dlpPolicies) for (const r of p.rules) counts[r.severity] += 1;
    return counts;
  }, [state.dlpPolicies]);
  const maxSeverityCount = Math.max(1, severityCounts.High, severityCounts.Medium, severityCounts.Low);

  // ===== Policies tab: filtered list =====
  const filteredPolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.dlpPolicies;
    return state.dlpPolicies.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.template.toLowerCase().includes(q),
    );
  }, [state.dlpPolicies, search]);

  // ===== Sensitive info types tab: filtered list =====
  const filteredSitTypes = useMemo(() => {
    const q = sitSearch.trim().toLowerCase();
    if (!q) return state.sitTypes;
    return state.sitTypes.filter((t) => t.toLowerCase().includes(q));
  }, [state.sitTypes, sitSearch]);

  // ===== Policy actions =====

  function handleToggleStatus(id: string) {
    dispatch({ type: "TOGGLE_DLP_STATUS", id });
  }

  function handleDelete(id: string) {
    const policy = state.dlpPolicies.find((p) => p.id === id);
    if (!policy) return;
    dispatch({ type: "DELETE_DLP_POLICY", id });
    setDetailPolicyId(null);
    toast.success(`Policy "${policy.name}" deleted.`);
  }

  // ===== Create-policy wizard =====

  function openWizard(templateSeed?: string) {
    setWizard(freshWizard(templateSeed ?? state.dlpTemplates[0] ?? "Custom"));
    setWizardStep("template");
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
  }

  function stepIndex(id: WizStepId): number {
    return WIZ_STEPS.findIndex((s) => s.id === id);
  }

  function wizGoTo(id: WizStepId) {
    setWizardStep(id);
  }

  function wizPrev() {
    const idx = stepIndex(wizardStep);
    if (idx > 0) wizGoTo(WIZ_STEPS[idx - 1].id);
  }

  function wizNext() {
    if (wizardStep === "basics" && !wizard.name.trim()) {
      toast.warning("Policy name is required.");
      return;
    }
    if (wizardStep === "locations" && wizard.locations.length === 0) {
      toast.warning("Choose at least one location.");
      return;
    }
    if (wizardStep === "rules" && !wizard.rule.name.trim()) {
      toast.warning("Rule name is required.");
      return;
    }
    const idx = stepIndex(wizardStep);
    if (idx < WIZ_STEPS.length - 1) wizGoTo(WIZ_STEPS[idx + 1].id);
  }

  function toggleLocation(id: string) {
    setWizard((w) => ({
      ...w,
      locations: w.locations.includes(id) ? w.locations.filter((l) => l !== id) : [...w.locations, id],
    }));
  }

  function wizFinish() {
    if (!wizard.name.trim()) {
      toast.warning("Policy name is required.");
      setWizardStep("basics");
      return;
    }
    if (wizard.locations.length === 0) {
      toast.warning("Choose at least one location.");
      setWizardStep("locations");
      return;
    }
    const rule: PurviewDlpRule = {
      name: wizard.rule.name.trim(),
      priority: 0,
      conditions: wizard.rule.conditions,
      actions: wizard.rule.actions + (wizard.sendReport ? ", Send incident report" : ""),
      severity: wizard.rule.severity,
    };
    const policy: PurviewDlpPolicy = {
      id: "dlp-" + crypto.randomUUID(),
      name: wizard.name.trim(),
      description: wizard.description,
      locations: wizard.locations,
      template: wizard.template || "Custom",
      status: "Active",
      runMode: wizard.runMode,
      lastModified: new Date().toISOString(),
      createdBy: "admin@itbd.net",
      rules: [rule],
    };
    dispatch({ type: "ADD_DLP_POLICY", policy });
    setWizardOpen(false);
    toast.success(`DLP policy "${policy.name}" created.`);
    setTab("policies");
  }

  // ===== Test policy tab =====

  function loadSampleText() {
    setTestContent(SAMPLE_TEXT);
    toast.info("Sample content loaded. Click Scan to run it through the real DLP engine.");
  }

  function runScan() {
    if (!testContent.trim()) {
      toast.warning("Paste some sample content first.");
      return;
    }
    if (testPolicyId === "__all__") {
      const results = scanContentAgainstAllPolicies(testContent, state.dlpPolicies);
      setTestResults(results);
      const totalMatches = results.reduce(
        (sum, r) => sum + r.ruleResults.reduce((s, rr) => s + rr.matches.length, 0),
        0,
      );
      toast.success(`Scan complete: ${totalMatches} real match${totalMatches === 1 ? "" : "es"} found across ${state.dlpPolicies.length} polic${state.dlpPolicies.length === 1 ? "y" : "ies"}.`);
    } else {
      const policy = state.dlpPolicies.find((p) => p.id === testPolicyId);
      if (!policy) return;
      const ruleResults = scanContentAgainstPolicy(testContent, policy);
      setTestResults([{ policyId: policy.id, policyName: policy.name, ruleResults }]);
      const totalMatches = ruleResults.reduce((s, rr) => s + rr.matches.length, 0);
      toast.success(`Scan complete: ${totalMatches} real match${totalMatches === 1 ? "" : "es"} found in "${policy.name}".`);
    }
  }

  // Redacts a matched value for display — shows only the last 4 characters,
  // masking the rest, so the tester feels realistic (like a real DLP console
  // would mask sensitive hits) while still proving a genuine match occurred.
  function redact(value: string): string {
    if (value.length <= 4) return "*".repeat(value.length);
    return "*".repeat(value.length - 4) + value.slice(-4);
  }

  return (
    <div>
      <div className={styles.pageH1}>Data loss prevention</div>
      <div className={styles.pageSub}>Detect and prevent risky sharing of sensitive information.</div>

      <SubTabBar tabs={SUB_TABS} active={tab} onChange={(k) => setTab(k as SubTab)} />

      {/* ===== Overview ===== */}
      {tab === "overview" ? (
        <>
          <StatRow
            stats={[
              { label: "Active policies", value: activeCount, sub: `${state.dlpPolicies.length} total policies` },
              { label: "Total rules", value: totalRules },
              { label: "Location coverage", value: locationCoverage, sub: "Distinct locations protected" },
            ]}
          />

          <div className={styles.h2}>Rules by severity</div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Across all {state.dlpPolicies.length} policies</div>
            {(["High", "Medium", "Low"] as const).map((sev) => {
              const count = severityCounts[sev];
              const pct = Math.round((count / maxSeverityCount) * 100);
              return (
                <div key={sev} className={styles.flexRow} style={{ padding: "6px 0" }}>
                  <div style={{ flex: 1 }}>
                    <SeverityBadge severity={sev} />
                  </div>
                  <div style={{ width: 320, background: "#f3f2f1", height: 8, borderRadius: 4, margin: "0 12px" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: 8,
                        borderRadius: 4,
                        background: sev === "High" ? "#a4262c" : sev === "Medium" ? "#ca5010" : "#107c10",
                      }}
                    />
                  </div>
                  <div style={{ minWidth: 30, textAlign: "right", fontWeight: 600 }}>{count}</div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* ===== Policies ===== */}
      {tab === "policies" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => openWizard()}>
              <span className={styles.tbBtnIco}>+</span> Create policy
            </button>
            <button type="button" className={styles.tbBtn} onClick={() => toast.info("Import would accept a JSON policy export from another tenant.")}>
              Import policy
            </button>
            <span className={styles.toolbarSpacer} />
            <input
              className={styles.input}
              style={{ maxWidth: 240 }}
              placeholder="Search policies"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredPolicies.length === 0 ? (
            <EmptyState message="No DLP policies match your search." />
          ) : (
            <DataTable<PurviewDlpPolicy>
              columns={[
                { key: "name", header: "Name", render: (p) => <span className={styles.rowLink}>{p.name}</span> },
                { key: "template", header: "Template", render: (p) => p.template },
                {
                  key: "status",
                  header: "Status",
                  render: (p) => (
                    <button
                      type="button"
                      className={styles.btnSubtle}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(p.id);
                      }}
                    >
                      <StatusPill tone={p.status === "Active" ? "ok" : "err"}>{p.status}</StatusPill>
                    </button>
                  ),
                },
                {
                  key: "runMode",
                  header: "Run mode",
                  render: (p) => <StatusPill tone={p.runMode === "On" ? "ok" : p.runMode === "Test" ? "warn" : "info"}>{p.runMode}</StatusPill>,
                },
                {
                  key: "locations",
                  header: "Locations",
                  render: (p) => (
                    <span>
                      {p.locations.map((l) => (
                        <span key={l} className={`${styles.pill} ${styles.pillPurple}`} style={{ marginRight: 4 }}>
                          {l}
                        </span>
                      ))}
                    </span>
                  ),
                },
                { key: "lastModified", header: "Last modified", render: (p) => new Date(p.lastModified).toLocaleDateString() },
                { key: "rules", header: "Rules", render: (p) => p.rules.length },
              ]}
              rows={filteredPolicies}
              getRowKey={(p) => p.id}
              onRowClick={(p) => setDetailPolicyId(p.id)}
              emptyMessage="No DLP policies match your search."
            />
          )}
        </>
      ) : null}

      {/* ===== Test policy (flagship real feature) ===== */}
      {tab === "test" ? (
        <>
          <p className={`${styles.muted} ${styles.small}`}>
            Paste sample content below and scan it against a real DLP policy. Matches are found by the same regex-based
            content-matching engine that powers this simulator&apos;s policies (SSN, credit card w/ Luhn check, PAN,
            Aadhaar, AWS key, email, IBAN, and more) — nothing here is a canned or fabricated result.
          </p>

          <Field label="Sample content">
            <textarea
              className={styles.textarea}
              style={{ minHeight: 180, fontFamily: "Consolas, 'Courier New', monospace" }}
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              placeholder="Paste an email body, document text, or chat message to scan..."
            />
          </Field>

          <div className={styles.flexRow} style={{ marginBottom: 14 }}>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={loadSampleText}>
              Load sample text
            </button>
            <div style={{ minWidth: 260 }}>
              <NativeSelect
                value={testPolicyId}
                onChange={setTestPolicyId}
                options={[
                  { value: "__all__", label: "All policies" },
                  ...state.dlpPolicies.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
            <button type="button" className={styles.btn} onClick={runScan}>
              Scan
            </button>
          </div>

          {testResults ? (
            <>
              <div className={styles.h2}>Scan results</div>
              {testResults.every((r) => r.ruleResults.every((rr) => rr.matches.length === 0)) ? (
                <EmptyState message="No matches found in the scanned content." />
              ) : (
                testResults.map((policyResult) => {
                  const hasAnyMatch = policyResult.ruleResults.some((rr) => rr.matches.length > 0);
                  if (!hasAnyMatch) return null;
                  return (
                    <div key={policyResult.policyId} className={styles.card}>
                      <div className={styles.cardTitle}>{policyResult.policyName}</div>
                      {policyResult.ruleResults
                        .filter((rr) => rr.matches.length > 0)
                        .map((rr) => (
                          <div key={rr.ruleName} className={styles.mt12}>
                            <div className={styles.flexRow} style={{ marginBottom: 6 }}>
                              <strong>{rr.ruleName}</strong>
                              <SeverityBadge severity={rr.severity} />
                              <span className={`${styles.small} ${styles.muted}`}>
                                {rr.matches.length} match{rr.matches.length === 1 ? "" : "es"}
                              </span>
                            </div>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Matched value</th>
                                  <th>Position</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rr.matches.map((m, i) => (
                                  <tr key={`${m.type}-${m.index}-${i}`}>
                                    <td>{m.type}</td>
                                    <td style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>{redact(m.value)}</td>
                                    <td>{m.index}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                    </div>
                  );
                })
              )}
            </>
          ) : null}
        </>
      ) : null}

      {/* ===== Sensitive info types ===== */}
      {tab === "sit" ? (
        <>
          <div className={styles.toolbar}>
            <input
              className={styles.input}
              style={{ maxWidth: 280 }}
              placeholder="Search sensitive info types"
              value={sitSearch}
              onChange={(e) => setSitSearch(e.target.value)}
            />
            <span className={styles.toolbarSpacer} />
            <span className={`${styles.small} ${styles.muted}`}>
              {filteredSitTypes.length} of {state.sitTypes.length} types
            </span>
          </div>
          <DataTable<string>
            columns={[
              { key: "name", header: "Name", render: (t) => t },
              { key: "type", header: "Type", render: () => "Predefined" },
              { key: "publisher", header: "Publisher", render: () => "Microsoft" },
              { key: "status", header: "Status", render: () => <StatusPill tone="ok">Ready</StatusPill> },
            ]}
            rows={filteredSitTypes}
            getRowKey={(t) => t}
            emptyMessage="No sensitive info types match your search."
          />
        </>
      ) : null}

      {/* ===== Templates ===== */}
      {tab === "templates" ? (
        <>
          <div className={styles.pageSub}>{state.dlpTemplates.length} policy templates available.</div>
          <div className={styles.cardGrid}>
            {state.dlpTemplates.map((t) => (
              <div key={t} className={styles.tile} onClick={() => openWizard(t)}>
                <div className={styles.tileTitle}>{t}</div>
                <div className={styles.tileSub}>Use this template to create a DLP policy.</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ===== Policy detail flyout ===== */}
      {detailPolicy ? (
        <Flyout
          title={detailPolicy.name}
          subtitle={detailPolicy.template}
          onClose={() => setDetailPolicyId(null)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => handleDelete(detailPolicy.id)}>
                Delete
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleToggleStatus(detailPolicy.id)}>
                Toggle status
              </button>
              <button type="button" className={styles.btn} onClick={() => setDetailPolicyId(null)}>
                Close
              </button>
            </>
          }
        >
          <div className={styles.inspector}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Status</div>
              <div className={styles.fieldValue}>
                <StatusPill tone={detailPolicy.status === "Active" ? "ok" : "err"}>{detailPolicy.status}</StatusPill>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Run mode</div>
              <div className={styles.fieldValue}>{detailPolicy.runMode}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Template</div>
              <div className={styles.fieldValue}>{detailPolicy.template}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Created by</div>
              <div className={styles.fieldValue}>{detailPolicy.createdBy}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Last modified</div>
              <div className={styles.fieldValue}>{new Date(detailPolicy.lastModified).toLocaleString()}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Rules</div>
              <div className={styles.fieldValue}>{detailPolicy.rules.length}</div>
            </div>
          </div>

          <div className={styles.h3}>Description</div>
          <div className={`${styles.small} ${styles.muted}`}>{detailPolicy.description}</div>

          <div className={styles.h3}>Locations</div>
          <div>
            {detailPolicy.locations.map((l) => (
              <span key={l} className={`${styles.pill} ${styles.pillPurple}`} style={{ marginRight: 4 }}>
                {l}
              </span>
            ))}
          </div>

          <div className={styles.h2}>Rules</div>
          <DataTable<PurviewDlpRule>
            columns={[
              { key: "name", header: "Name", render: (r) => r.name },
              { key: "priority", header: "Priority", render: (r) => r.priority },
              { key: "conditions", header: "Conditions", render: (r) => <span className={styles.small}>{r.conditions}</span> },
              { key: "actions", header: "Actions", render: (r) => <span className={styles.small}>{r.actions}</span> },
              { key: "severity", header: "Severity", render: (r) => <SeverityBadge severity={r.severity} /> },
            ]}
            rows={detailPolicy.rules}
            getRowKey={(r) => r.name}
            emptyMessage="No rules defined."
          />
        </Flyout>
      ) : null}

      {/* ===== Create-policy wizard (6 steps) ===== */}
      {wizardOpen ? (
        <Modal
          title="Create DLP policy"
          onClose={closeWizard}
          width="880px"
          steps={WIZ_STEPS.map((s) => (
            <WizStep
              key={s.id}
              label={s.label}
              active={s.id === wizardStep}
              done={stepIndex(s.id) < stepIndex(wizardStep)}
              onClick={() => wizGoTo(s.id)}
            />
          ))}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeWizard}>
                Cancel
              </button>
              <span style={{ flex: 1 }} />
              {stepIndex(wizardStep) > 0 ? (
                <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={wizPrev}>
                  Back
                </button>
              ) : null}
              {wizardStep === "review" ? (
                <button type="button" className={styles.btn} onClick={wizFinish}>
                  Create
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={wizNext}>
                  Next
                </button>
              )}
            </>
          }
        >
          {wizardStep === "template" ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>
                Start from a regulatory template or build a custom policy. {state.dlpTemplates.length} templates available.
              </p>
              <Field label="Template">
                <NativeSelect
                  value={wizard.template}
                  onChange={(v) => setWizard((w) => ({ ...w, template: v }))}
                  options={state.dlpTemplates.map((t) => ({ value: t, label: t }))}
                />
              </Field>
            </>
          ) : null}

          {wizardStep === "basics" ? (
            <>
              <Field label="Name *">
                <input
                  className={styles.input}
                  value={wizard.name}
                  onChange={(e) => setWizard((w) => ({ ...w, name: e.target.value }))}
                  placeholder="e.g. PII external block"
                />
              </Field>
              <Field label="Description">
                <textarea
                  className={styles.textarea}
                  value={wizard.description}
                  onChange={(e) => setWizard((w) => ({ ...w, description: e.target.value }))}
                  placeholder="Describe the goal of this policy"
                />
              </Field>
            </>
          ) : null}

          {wizardStep === "locations" ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>Choose where this policy will protect content.</p>
              {ALL_LOCATIONS.map((l) => (
                <Checkbox key={l.id} label={l.label} checked={wizard.locations.includes(l.id)} onChange={() => toggleLocation(l.id)} />
              ))}
            </>
          ) : null}

          {wizardStep === "rules" ? (
            <>
              <Field label="Rule name *">
                <input
                  className={styles.input}
                  value={wizard.rule.name}
                  onChange={(e) => setWizard((w) => ({ ...w, rule: { ...w.rule, name: e.target.value } }))}
                  placeholder="e.g. Default rule"
                />
              </Field>
              <Field label="Condition - content contains" help="Choose one sensitive info type. Real Purview lets you add multiple conditions.">
                <NativeSelect
                  value={wizard.rule.conditions}
                  onChange={(v) => setWizard((w) => ({ ...w, rule: { ...w.rule, conditions: v } }))}
                  options={state.sitTypes.slice(0, 30).map((s) => ({ value: `${s} (1+)`, label: s }))}
                />
              </Field>
              <Field label="Action">
                <NativeSelect
                  value={wizard.rule.actions}
                  onChange={(v) => setWizard((w) => ({ ...w, rule: { ...w.rule, actions: v } }))}
                  options={RULE_ACTIONS.map((a) => ({ value: a, label: a }))}
                />
              </Field>
              <Field label="Severity">
                <NativeSelect
                  value={wizard.rule.severity}
                  onChange={(v) => setWizard((w) => ({ ...w, rule: { ...w.rule, severity: v as PurviewDlpRule["severity"] } }))}
                  options={[
                    { value: "High", label: "High" },
                    { value: "Medium", label: "Medium" },
                    { value: "Low", label: "Low" },
                  ]}
                />
              </Field>
              <Checkbox
                label="Send an incident report to compliance admins"
                checked={wizard.sendReport}
                onChange={(v) => setWizard((w) => ({ ...w, sendReport: v }))}
              />
            </>
          ) : null}

          {wizardStep === "mode" ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>Choose how the policy will run after creation.</p>
              {RUN_MODES.map((m) => (
                <label key={m.value} className={styles.checkboxRow}>
                  <input
                    type="radio"
                    name="runMode"
                    checked={wizard.runMode === m.value}
                    onChange={() => setWizard((w) => ({ ...w, runMode: m.value }))}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </>
          ) : null}

          {wizardStep === "review" ? (
            <div className={styles.inspector}>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Template</div>
                <div className={styles.fieldValue}>{wizard.template || "-"}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Name</div>
                <div className={styles.fieldValue}>{wizard.name}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Description</div>
                <div className={styles.fieldValue}>{wizard.description || "-"}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Locations</div>
                <div className={styles.fieldValue}>{wizard.locations.join(", ") || "-"}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Rule</div>
                <div className={styles.fieldValue}>{wizard.rule.name}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Condition</div>
                <div className={styles.fieldValue}>{wizard.rule.conditions}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Action</div>
                <div className={styles.fieldValue}>{wizard.rule.actions}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Severity</div>
                <div className={styles.fieldValue}>
                  <SeverityBadge severity={wizard.rule.severity} />
                </div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Run mode</div>
                <div className={styles.fieldValue}>{wizard.runMode}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Incident report</div>
                <div className={styles.fieldValue}>{wizard.sendReport ? "Yes" : "No"}</div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
