"use client";

// Communication Compliance page for the Microsoft Purview compliance-portal
// simulator. Ported from itbd-lab/simulators/purview/js/purview-comm-compliance.js
// (PurviewCommComp module) — the richest triage UX in the suite: Overview /
// Policies / Alerts / Classifiers / Reports tabs, a 3-tab alert triage flyout
// (Message context / User history / Reviewer actions) with full CRUD
// (resolve/escalate/notify/assign/add note), bulk-assign + CSV export on the
// Alerts tab, and a 6-step "create policy" wizard.
//
// Source's tab navigation was module-level `view`/`go()` state that replaced
// `document.getElementById('mainContent')?.innerHTML` on every nav click —
// and `go()` actually looked for `#mainContent` OR `#pv-main`, while the real
// mount point elsewhere in that app used neither id consistently, breaking
// internal tab nav after first render. This is built as a NORMAL React
// component driven entirely by local `useState` + conditional rendering, with
// zero direct DOM manipulation anywhere, so that bug class is structurally
// impossible here.
//
// "Notify employee" is cosmetic-only in source too: `notifyEmployee()` just
// sets `a.status = 'Notify employee'` (a status value that doesn't exist in
// this app's `PurviewCcAlert["status"]` union) and appends a note string.
// There is no ASSIGN-equivalent reducer action for a "Notify employee" status
// here, so this port keeps the action's real, useful side effect — appending
// a reviewer note documenting the notice that was "sent" via
// ADD_CC_ALERT_NOTE — and surfaces the rest purely as a toast, matching the
// task's instruction to keep it toast-only where source has no real state to
// change.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import type { PurviewCcAlert, PurviewCcPolicy, PurviewState } from "@/lib/labs/simulators/purview/types";
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
  exportCsv,
} from "./purview-ui";
import styles from "./purview-console.module.css";

type CcTab = "overview" | "policies" | "alerts" | "classifiers" | "reports";

const TABS: { key: CcTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "policies", label: "Policies" },
  { key: "alerts", label: "Alerts" },
  { key: "classifiers", label: "Classifiers" },
  { key: "reports", label: "Reports" },
];

// Source's TEMPLATES / SCOPES_USERS lists, ported verbatim for the wizard.
const TEMPLATES = ["Inappropriate content", "Sensitive information", "Customer complaints", "Conflict of interest", "Regulatory compliance", "Custom"];
const SCOPES = ["All users (12,420)", "Finance department (847)", "Trading desk (64)", "Support team (380)", "Executive group (28)", "India region only (8,142)", "HR group (52)"];

function statusTone(status: PurviewCcAlert["status"]): "ok" | "warn" | "err" | "info" {
  if (status === "Resolved") return "ok";
  if (status === "Escalated") return "err";
  if (status === "In review") return "warn";
  return "info"; // New
}

function policyStatusTone(status: PurviewCcPolicy["status"]): "ok" | "err" {
  return status === "Active" ? "ok" : "err";
}

// ===== Create/edit policy wizard state =====
type WizardState = {
  editId: string | null;
  name: string;
  template: string;
  scope: string;
  classifierIds: string[];
  condition: string;
  samplingPct: number;
};

function freshWizard(): WizardState {
  return { editId: null, name: "New comm compliance policy", template: TEMPLATES[0], scope: SCOPES[0], classifierIds: [], condition: "", samplingPct: 100 };
}

const WIZARD_STEPS = ["Name + description", "Template", "Scope", "Classifiers", "Conditions", "Review"];

export function CommCompliancePage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [tab, setTab] = useState<CcTab>("overview");

  // ----- Policies -----
  const [openPolicyId, setOpenPolicyId] = useState<string | null>(null);
  const openPolicy = state.ccPolicies.find((p) => p.id === openPolicyId) ?? null;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStepIdx, setWizStepIdx] = useState(0);
  const [wiz, setWiz] = useState<WizardState>(freshWizard());

  // ----- Alerts -----
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const [alertTab, setAlertTab] = useState<"context" | "history" | "actions">("context");
  const openAlert = state.ccAlerts.find((a) => a.id === openAlertId) ?? null;
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [bulkReviewer, setBulkReviewer] = useState(state.users[0]?.userPrincipalName ?? "");

  const policyName = (policyId: string) => state.ccPolicies.find((p) => p.id === policyId)?.name ?? policyId;

  // ===== Overview stats =====
  const overviewStats = useMemo(() => {
    const totalPolicies = state.ccPolicies.length;
    const totalAlerts = state.ccAlerts.length;
    const byStatus = { New: 0, "In review": 0, Resolved: 0, Escalated: 0 };
    const bySeverity = { High: 0, Medium: 0, Low: 0 };
    for (const a of state.ccAlerts) {
      byStatus[a.status] += 1;
      bySeverity[a.severity] += 1;
    }
    return { totalPolicies, totalAlerts, byStatus, bySeverity };
  }, [state.ccPolicies, state.ccAlerts]);

  // ===== Policy wizard handlers =====
  function openNewPolicyWizard() {
    setWiz(freshWizard());
    setWizStepIdx(0);
    setWizardOpen(true);
  }
  function openEditPolicyWizard(policy: PurviewCcPolicy) {
    setWiz({
      editId: policy.id,
      name: policy.name,
      template: policy.template,
      scope: policy.scope,
      classifierIds: [...policy.classifiers],
      condition: "",
      samplingPct: 100,
    });
    setWizStepIdx(0);
    setWizardOpen(true);
  }
  function closeWizard() {
    setWizardOpen(false);
  }
  function patchWiz(patch: Partial<WizardState>) {
    setWiz((w) => ({ ...w, ...patch }));
  }
  function toggleClassifier(id: string) {
    setWiz((w) => ({ ...w, classifierIds: w.classifierIds.includes(id) ? w.classifierIds.filter((c) => c !== id) : [...w.classifierIds, id] }));
  }
  function goNext() {
    if (wizStepIdx === 0 && !wiz.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    if (wizStepIdx === 3 && wiz.classifierIds.length === 0) {
      toast.error("Pick at least one classifier.");
      return;
    }
    setWizStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1));
  }
  function goBack() {
    setWizStepIdx((i) => Math.max(0, i - 1));
  }

  function commitWizard() {
    if (wiz.editId) {
      dispatch({
        type: "UPDATE_CC_POLICY",
        id: wiz.editId,
        patch: { name: wiz.name.trim(), template: wiz.template, scope: wiz.scope, classifiers: [...wiz.classifierIds] },
      });
      toast.success("Policy updated");
    } else {
      const policy: PurviewCcPolicy = {
        id: "cc-" + crypto.randomUUID(),
        name: wiz.name.trim(),
        template: wiz.template,
        scope: wiz.scope,
        classifiers: [...wiz.classifierIds],
        status: "Active",
        matchesLast30d: 0,
      };
      dispatch({ type: "ADD_CC_POLICY", policy });
      toast.success(`Policy created — sampling at ${wiz.samplingPct}% in the first 30 days`);
    }
    setWizardOpen(false);
  }

  // ===== Alert triage handlers =====
  function openAlertFlyout(alert: PurviewCcAlert) {
    setOpenAlertId(alert.id);
    setAlertTab("context");
    setNoteDraft("");
  }
  function closeAlertFlyout() {
    setOpenAlertId(null);
  }

  function handleResolve(id: string) {
    dispatch({ type: "RESOLVE_CC_ALERT", id });
    toast.success(`Alert ${id} resolved`);
  }
  function handleEscalate(id: string) {
    dispatch({ type: "ESCALATE_CC_ALERT", id });
    toast.success(`Alert ${id} escalated`);
  }
  function handleAssignReviewer(id: string, reviewer: string) {
    dispatch({ type: "ASSIGN_CC_REVIEWER", id, reviewer });
    toast.success(`Assigned to ${reviewer}`);
  }
  function handleAddNote(id: string) {
    const text = noteDraft.trim();
    if (!text) return;
    dispatch({ type: "ADD_CC_ALERT_NOTE", id, author: "admin@itbd.net", text });
    setNoteDraft("");
    toast.success("Note added");
  }
  // Cosmetic-only in source (no real "notified" state in PurviewCcAlert) — the
  // one real side effect kept is a reviewer note documenting the notice sent.
  function handleNotifyEmployee(alert: PurviewCcAlert) {
    dispatch({ type: "ADD_CC_ALERT_NOTE", id: alert.id, author: "admin@itbd.net", text: `Sent code-of-conduct refresher notice to ${alert.user}.` });
    toast.success(`Notice sent to ${alert.user}`);
  }

  function toggleAlertSelected(id: string) {
    setSelectedAlertIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function handleBulkAssign() {
    if (selectedAlertIds.length === 0) {
      toast.error("Select at least one alert first.");
      return;
    }
    if (!bulkReviewer) return;
    for (const id of selectedAlertIds) {
      dispatch({ type: "ASSIGN_CC_REVIEWER", id, reviewer: bulkReviewer });
    }
    toast.success(`${selectedAlertIds.length} alert(s) assigned to ${bulkReviewer}`);
    setSelectedAlertIds([]);
  }
  function handleExportAlerts() {
    exportCsv(
      "comm-compliance-alerts.csv",
      ["ID", "User", "Policy", "Severity", "Detected", "Status", "Reviewer", "Hits"],
      state.ccAlerts.map((a) => [a.id, a.user, policyName(a.policyId), a.severity, new Date(a.detectedOn).toLocaleString(), a.status, a.reviewer ?? "unassigned", a.hits]),
    );
    toast.success(`Exported ${state.ccAlerts.length} alerts to CSV`);
  }

  return (
    <div>
      <div className={styles.pageH1}>Communication Compliance</div>
      <div className={styles.pageSub}>
        Detect, capture, and act on inappropriate or risky communications in Teams, Exchange, Yammer, and Viva Engage.
      </div>

      <SubTabBar tabs={TABS} active={tab} onChange={(key) => setTab(key as CcTab)} />

      {tab === "overview" ? <OverviewTab stats={overviewStats} /> : null}

      {tab === "policies" ? (
        <PoliciesTab policies={state.ccPolicies} onOpenPolicy={(p) => setOpenPolicyId(p.id)} onCreate={openNewPolicyWizard} />
      ) : null}

      {tab === "alerts" ? (
        <AlertsTab
          state={state}
          policyName={policyName}
          onOpenAlert={openAlertFlyout}
          selectedIds={selectedAlertIds}
          onToggleSelected={toggleAlertSelected}
          bulkReviewer={bulkReviewer}
          onBulkReviewerChange={setBulkReviewer}
          onBulkAssign={handleBulkAssign}
          onExport={handleExportAlerts}
        />
      ) : null}

      {tab === "classifiers" ? <ClassifiersTab classifiers={state.classifiers} /> : null}

      {tab === "reports" ? <ReportsTab stats={overviewStats} /> : null}

      {openPolicy ? (
        <Flyout
          title={openPolicy.name}
          subtitle={
            <>
              {openPolicy.template} · {openPolicy.scope} · <StatusPill tone={policyStatusTone(openPolicy.status)}>{openPolicy.status}</StatusPill>
            </>
          }
          onClose={() => setOpenPolicyId(null)}
          footer={
            <button type="button" className={styles.btn} onClick={() => openEditPolicyWizard(openPolicy)}>
              Edit policy
            </button>
          }
        >
          <PolicyDetail policy={openPolicy} classifiers={state.classifiers} />
        </Flyout>
      ) : null}

      {openAlert ? (
        <AlertFlyout
          alert={openAlert}
          state={state}
          policyName={policyName(openAlert.policyId)}
          tab={alertTab}
          onTabChange={setAlertTab}
          onClose={closeAlertFlyout}
          onResolve={() => handleResolve(openAlert.id)}
          onEscalate={() => handleEscalate(openAlert.id)}
          onAssign={(reviewer) => handleAssignReviewer(openAlert.id, reviewer)}
          noteDraft={noteDraft}
          onNoteDraftChange={setNoteDraft}
          onAddNote={() => handleAddNote(openAlert.id)}
          onNotifyEmployee={() => handleNotifyEmployee(openAlert)}
        />
      ) : null}

      {wizardOpen ? (
        <Modal
          title={`${wiz.editId ? "Edit" : "Create"} communication compliance policy`}
          onClose={closeWizard}
          width="720px"
          steps={WIZARD_STEPS.map((label, i) => (
            <WizStep key={label} label={`${i + 1}. ${label}`} active={wizStepIdx === i} done={wizStepIdx > i} onClick={() => setWizStepIdx(i)} />
          ))}
          footer={
            <>
              {wizStepIdx > 0 ? (
                <button type="button" className={styles.btnOutline} onClick={goBack}>
                  ← Back
                </button>
              ) : null}
              <button type="button" className={styles.btnOutline} onClick={closeWizard}>
                Cancel
              </button>
              {wizStepIdx < WIZARD_STEPS.length - 1 ? (
                <button type="button" className={styles.btn} onClick={goNext}>
                  Next →
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={commitWizard}>
                  {wiz.editId ? "Save changes" : "Create policy"}
                </button>
              )}
            </>
          }
        >
          <WizardStepBody wiz={wiz} patch={patchWiz} onToggleClassifier={toggleClassifier} classifiers={state.classifiers} stepIdx={wizStepIdx} />
        </Modal>
      ) : null}
    </div>
  );
}

// ===== Overview tab =====

function OverviewTab({ stats }: { stats: { totalPolicies: number; totalAlerts: number; byStatus: Record<string, number>; bySeverity: Record<string, number> } }) {
  return (
    <div>
      <StatRow
        stats={[
          { label: "Total policies", value: stats.totalPolicies },
          { label: "Total alerts", value: stats.totalAlerts },
          { label: "New", value: stats.byStatus["New"] ?? 0 },
          { label: "In review", value: stats.byStatus["In review"] ?? 0 },
          { label: "Resolved", value: stats.byStatus["Resolved"] ?? 0 },
          { label: "Escalated", value: stats.byStatus["Escalated"] ?? 0 },
        ]}
      />
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Alerts by severity
      </div>
      <StatRow
        stats={[
          { label: "High severity", value: stats.bySeverity["High"] ?? 0 },
          { label: "Medium severity", value: stats.bySeverity["Medium"] ?? 0 },
          { label: "Low severity", value: stats.bySeverity["Low"] ?? 0 },
        ]}
      />
    </div>
  );
}

// ===== Policies tab =====

function PoliciesTab({
  policies,
  onOpenPolicy,
  onCreate,
}: {
  policies: PurviewCcPolicy[];
  onOpenPolicy: (policy: PurviewCcPolicy) => void;
  onCreate: () => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <strong>{policies.length} policies</strong>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create policy
        </button>
      </div>
      <DataTable<PurviewCcPolicy>
        columns={[
          { key: "name", header: "Policy", render: (p) => <strong>{p.name}</strong> },
          { key: "template", header: "Template", render: (p) => p.template },
          { key: "scope", header: "Scope", render: (p) => p.scope },
          {
            key: "classifiers",
            header: "Classifiers",
            render: (p) =>
              p.classifiers.length === 0 ? (
                <span className={styles.muted} style={{ fontSize: 12 }}>
                  none
                </span>
              ) : (
                <div className={styles.filterRow}>
                  {p.classifiers.map((c) => (
                    <span key={c} className={styles.filterChip}>
                      {c}
                    </span>
                  ))}
                </div>
              ),
          },
          { key: "status", header: "Status", render: (p) => <StatusPill tone={policyStatusTone(p.status)}>{p.status}</StatusPill> },
          { key: "matches", header: "Matches (30d)", render: (p) => p.matchesLast30d },
        ]}
        rows={policies}
        getRowKey={(p) => p.id}
        onRowClick={onOpenPolicy}
        emptyMessage="No communication compliance policies yet."
      />
    </div>
  );
}

function PolicyDetail({ policy, classifiers }: { policy: PurviewCcPolicy; classifiers: PurviewState["classifiers"] }) {
  const applied = classifiers.filter((c) => policy.classifiers.includes(c.id));
  return (
    <div>
      <div className={styles.inspector}>
        <div className="field">
          <div className={styles.fieldLabel}>Template</div>
          <div className={styles.fieldValue}>{policy.template}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Scope</div>
          <div className={styles.fieldValue}>{policy.scope}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Status</div>
          <div className={styles.fieldValue}>
            <StatusPill tone={policyStatusTone(policy.status)}>{policy.status}</StatusPill>
          </div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Matches (last 30 days)</div>
          <div className={styles.fieldValue}>{policy.matchesLast30d}</div>
        </div>
      </div>

      <div className={styles.h3}>Classifiers applied ({applied.length})</div>
      {applied.length === 0 ? (
        <EmptyState message="No classifiers applied to this policy." />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Classifier", render: (c) => <strong>{c.name}</strong> },
            { key: "category", header: "Category", render: (c) => c.category },
            { key: "description", header: "Description", render: (c) => c.description },
          ]}
          rows={applied}
          getRowKey={(c) => c.id}
        />
      )}
    </div>
  );
}

// ===== Alerts tab =====

function AlertsTab({
  state,
  policyName,
  onOpenAlert,
  selectedIds,
  onToggleSelected,
  bulkReviewer,
  onBulkReviewerChange,
  onBulkAssign,
  onExport,
}: {
  state: PurviewState;
  policyName: (policyId: string) => string;
  onOpenAlert: (alert: PurviewCcAlert) => void;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
  bulkReviewer: string;
  onBulkReviewerChange: (upn: string) => void;
  onBulkAssign: () => void;
  onExport: () => void;
}) {
  return (
    <div>
      <div className={styles.toolbar} style={{ marginBottom: 12 }}>
        <div>
          <strong>{state.ccAlerts.length}</strong> alerts <span className={styles.muted}>&middot; {selectedIds.length} selected</span>
        </div>
        <div className={styles.toolbarSpacer} />
        <NativeSelect
          value={bulkReviewer}
          onChange={onBulkReviewerChange}
          options={state.users.map((u) => ({ value: u.userPrincipalName, label: u.displayName }))}
        />
        <button type="button" className={styles.btnOutline} onClick={onBulkAssign}>
          Bulk assign
        </button>
        <button type="button" className={styles.btnOutline} onClick={onExport}>
          Export CSV
        </button>
      </div>

      <DataTable<PurviewCcAlert>
        columns={[
          {
            key: "select",
            header: "",
            width: "36px",
            render: (a) => (
              <input
                type="checkbox"
                checked={selectedIds.includes(a.id)}
                onChange={() => onToggleSelected(a.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ),
          },
          { key: "id", header: "ID", render: (a) => <strong>{a.id}</strong> },
          { key: "policy", header: "Policy", render: (a) => policyName(a.policyId) },
          { key: "severity", header: "Severity", render: (a) => <SeverityBadge severity={a.severity} /> },
          { key: "user", header: "User", render: (a) => a.user },
          { key: "hits", header: "Hits", render: (a) => a.hits },
          { key: "detected", header: "Detected", render: (a) => new Date(a.detectedOn).toLocaleString() },
          { key: "status", header: "Status", render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status}</StatusPill> },
          { key: "reviewer", header: "Reviewer", render: (a) => a.reviewer ?? "unassigned" },
        ]}
        rows={state.ccAlerts}
        getRowKey={(a) => a.id}
        onRowClick={onOpenAlert}
        emptyMessage="No alerts."
      />
    </div>
  );
}

// ===== Alert triage flyout =====

function AlertFlyout({
  alert,
  state,
  policyName,
  tab,
  onTabChange,
  onClose,
  onResolve,
  onEscalate,
  onAssign,
  noteDraft,
  onNoteDraftChange,
  onAddNote,
  onNotifyEmployee,
}: {
  alert: PurviewCcAlert;
  state: PurviewState;
  policyName: string;
  tab: "context" | "history" | "actions";
  onTabChange: (tab: "context" | "history" | "actions") => void;
  onClose: () => void;
  onResolve: () => void;
  onEscalate: () => void;
  onAssign: (reviewer: string) => void;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onAddNote: () => void;
  onNotifyEmployee: () => void;
}) {
  const flyoutTabs: { key: string; label: string }[] = [
    { key: "context", label: "Message context" },
    { key: "history", label: "User history" },
    { key: "actions", label: "Reviewer actions" },
  ];

  return (
    <Flyout
      title={`${alert.id} — ${alert.user}`}
      subtitle={
        <>
          <SeverityBadge severity={alert.severity} /> · {policyName} · {new Date(alert.detectedOn).toLocaleString()} ·{" "}
          <StatusPill tone={statusTone(alert.status)}>{alert.status}</StatusPill>
        </>
      }
      onClose={onClose}
      tabs={<SubTabBar tabs={flyoutTabs} active={tab} onChange={(key) => onTabChange(key as typeof tab)} />}
    >
      {tab === "context" ? <MessageContextTab alert={alert} /> : null}
      {tab === "history" ? <UserHistoryTab alert={alert} state={state} /> : null}
      {tab === "actions" ? (
        <ReviewerActionsTab
          alert={alert}
          state={state}
          onResolve={onResolve}
          onEscalate={onEscalate}
          onAssign={onAssign}
          noteDraft={noteDraft}
          onNoteDraftChange={onNoteDraftChange}
          onAddNote={onAddNote}
          onNotifyEmployee={onNotifyEmployee}
        />
      ) : null}
    </Flyout>
  );
}

function MessageContextTab({ alert }: { alert: PurviewCcAlert }) {
  const isExternal = alert.user.includes("@") && !alert.user.endsWith("@cloudlab.in");
  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Message that triggered the alert
      </div>
      <div className={styles.card} style={{ borderLeft: `3px solid ${alert.severity === "High" ? "#a4262c" : "#5c2d91"}` }}>
        <div className={styles.muted} style={{ fontSize: 11, marginBottom: 6 }}>
          From: <strong>{alert.user}</strong> — flagged by <strong>{alert.hits}</strong>
        </div>
        <div className={styles.muted} style={{ fontSize: 11, marginBottom: 10 }}>
          Detected: {new Date(alert.detectedOn).toLocaleString()}
        </div>
        <div style={{ fontStyle: "italic", color: "#323130" }}>
          [Sample matched content — full transcript redacted in preview. Open in advanced eDiscovery for the full conversation thread + attachments.]
        </div>
      </div>

      <div className={styles.h3}>Detection</div>
      <div className={styles.inspector}>
        <div className="field">
          <div className={styles.fieldLabel}>Match details</div>
          <div className={styles.fieldValue}>{alert.hits}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Severity</div>
          <div className={styles.fieldValue}>
            <SeverityBadge severity={alert.severity} />
          </div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>User</div>
          <div className={styles.fieldValue}>{alert.user}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Sensitivity</div>
          <div className={styles.fieldValue}>
            {isExternal ? <span style={{ color: "#a4262c", fontWeight: 600 }}>External recipient — elevated risk</span> : "Internal"}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserHistoryTab({ alert, state }: { alert: PurviewCcAlert; state: PurviewState }) {
  const others = state.ccAlerts.filter((a) => a.user === alert.user && a.id !== alert.id);
  const user = state.users.find((u) => u.userPrincipalName === alert.user);

  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        {alert.user} — alert history
      </div>
      {others.length === 0 ? (
        <EmptyState message="No other alerts for this user." />
      ) : (
        <DataTable<PurviewCcAlert>
          columns={[
            { key: "id", header: "ID", render: (o) => o.id },
            { key: "severity", header: "Severity", render: (o) => <SeverityBadge severity={o.severity} /> },
            { key: "detected", header: "Detected", render: (o) => new Date(o.detectedOn).toLocaleString() },
            { key: "status", header: "Status", render: (o) => <StatusPill tone={statusTone(o.status)}>{o.status}</StatusPill> },
          ]}
          rows={others}
          getRowKey={(o) => o.id}
        />
      )}

      <div className={styles.h3}>User profile</div>
      <div className={styles.inspector}>
        <div className="field">
          <div className={styles.fieldLabel}>Display name</div>
          <div className={styles.fieldValue}>{user?.displayName ?? "Unknown"}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Department</div>
          <div className={styles.fieldValue}>{user?.department ?? "General"}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Job title</div>
          <div className={styles.fieldValue}>{user?.jobTitle ?? "—"}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Total alerts</div>
          <div className={styles.fieldValue}>{others.length + 1}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Risk indication</div>
          <div className={styles.fieldValue}>
            {others.length >= 2 ? (
              <strong style={{ color: "#a4262c" }}>Elevated</strong>
            ) : (
              <strong style={{ color: "#107c10" }}>Normal</strong>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewerActionsTab({
  alert,
  state,
  onResolve,
  onEscalate,
  onAssign,
  noteDraft,
  onNoteDraftChange,
  onAddNote,
  onNotifyEmployee,
}: {
  alert: PurviewCcAlert;
  state: PurviewState;
  onResolve: () => void;
  onEscalate: () => void;
  onAssign: (reviewer: string) => void;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onAddNote: () => void;
  onNotifyEmployee: () => void;
}) {
  const [reviewerChoice, setReviewerChoice] = useState(alert.reviewer ?? state.users[0]?.userPrincipalName ?? "");

  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Take action on this alert
      </div>
      {alert.status !== "Resolved" ? (
        <div className={styles.flexRow} style={{ flexWrap: "wrap", marginBottom: 16 }}>
          <button type="button" className={styles.btn} onClick={onResolve}>
            Resolve
          </button>
          <button type="button" className={styles.btnOutline} onClick={onNotifyEmployee}>
            Notify employee
          </button>
          <button type="button" className={styles.btnDanger} onClick={onEscalate}>
            Escalate to legal/HR
          </button>
        </div>
      ) : (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <strong>Current status:</strong> {alert.status}
        </div>
      )}

      <div className={styles.h3}>Assign reviewer</div>
      <div className={styles.flexRow} style={{ marginBottom: 16 }}>
        <NativeSelect
          value={reviewerChoice}
          onChange={setReviewerChoice}
          options={state.users.map((u) => ({ value: u.userPrincipalName, label: u.displayName }))}
          style={{ flex: 1 }}
        />
        <button type="button" className={styles.btnOutline} onClick={() => onAssign(reviewerChoice)}>
          Assign
        </button>
      </div>

      <div className={styles.h3}>Reviewer notes</div>
      {alert.notes.length === 0 ? (
        <div className={styles.muted} style={{ fontSize: 12, padding: 8 }}>
          No reviewer notes yet.
        </div>
      ) : (
        alert.notes.map((n) => (
          <div key={n.id} className={styles.card} style={{ borderLeft: "3px solid #5c2d91", marginBottom: 6, padding: "8px 12px" }}>
            <div style={{ fontSize: 12 }}>{n.text}</div>
            <div className={styles.muted} style={{ fontSize: 11, marginTop: 4 }}>
              {n.author} &middot; {new Date(n.time).toLocaleString()}
            </div>
          </div>
        ))
      )}
      <div className={styles.flexRow} style={{ marginTop: 10 }}>
        <input
          className={styles.input}
          type="text"
          placeholder="Add a note (visible to other reviewers)"
          value={noteDraft}
          onChange={(e) => onNoteDraftChange(e.target.value)}
        />
        <button type="button" className={styles.btnOutline} onClick={onAddNote} disabled={!noteDraft.trim()}>
          Add note
        </button>
      </div>
    </div>
  );
}

// ===== Classifiers tab =====

function ClassifiersTab({ classifiers }: { classifiers: PurviewState["classifiers"] }) {
  return (
    <div>
      <p className={styles.muted} style={{ marginBottom: 14, fontSize: 13 }}>
        Pre-trained classifiers ship with Purview. Train custom classifiers with 50+ positive samples.
      </p>
      <DataTable
        columns={[
          { key: "name", header: "Classifier", render: (c) => <strong>{c.name}</strong> },
          { key: "category", header: "Category", render: (c) => c.category },
          { key: "description", header: "Description", render: (c) => c.description },
        ]}
        rows={classifiers}
        getRowKey={(c) => c.id}
        emptyMessage="No classifiers."
      />
    </div>
  );
}

// ===== Reports tab =====

const REPORTS = [
  { name: "Policy match report", purpose: "Counts by policy, action taken, time-to-resolve.", cadence: "Daily" },
  { name: "Reviewer activity", purpose: "Per-reviewer queue depth, resolution time, escalation rate.", cadence: "Hourly" },
  { name: "User-level rollup", purpose: "Repeat offenders / cleared users for HR review.", cadence: "Daily" },
  { name: "Communication patterns", purpose: "External-domain flows, off-hours messaging, atypical channels.", cadence: "Daily" },
  { name: "Regulatory exam pack (MiFID II)", purpose: "Pre-formatted record set for financial regulator request.", cadence: "On demand" },
];

function ReportsTab({ stats }: { stats: { totalPolicies: number; totalAlerts: number; byStatus: Record<string, number>; bySeverity: Record<string, number> } }) {
  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Available reports
      </div>
      <DataTable
        columns={[
          { key: "name", header: "Report", render: (r) => <strong>{r.name}</strong> },
          { key: "purpose", header: "Purpose", render: (r) => r.purpose },
          { key: "cadence", header: "Refresh cadence", render: (r) => r.cadence },
        ]}
        rows={REPORTS}
        getRowKey={(r) => r.name}
      />

      <div className={styles.h3}>Current snapshot</div>
      <StatRow
        stats={[
          { label: "Total policies", value: stats.totalPolicies },
          { label: "Total alerts", value: stats.totalAlerts },
          { label: "Escalated", value: stats.byStatus["Escalated"] ?? 0 },
          { label: "Resolved", value: stats.byStatus["Resolved"] ?? 0 },
        ]}
      />

      <div className={styles.card} style={{ borderLeft: "3px solid #b8860b" }}>
        <strong>Retention:</strong> Communication compliance match data inherits the Microsoft 365 audit retention — default 180
        days, up to 10 years with the Premium audit add-on. For regulated industries, always pair with an eDiscovery (Premium)
        hold.
      </div>
    </div>
  );
}

// ===== Create/edit policy wizard steps =====

function WizardStepBody({
  wiz,
  patch,
  onToggleClassifier,
  classifiers,
  stepIdx,
}: {
  wiz: WizardState;
  patch: (p: Partial<WizardState>) => void;
  onToggleClassifier: (id: string) => void;
  classifiers: PurviewState["classifiers"];
  stepIdx: number;
}) {
  if (stepIdx === 0) {
    return (
      <div>
        <Field label="Policy name">
          <input className={styles.input} type="text" value={wiz.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
        </Field>
        <Field label="Description / custom condition (optional)">
          <textarea
            className={styles.textarea}
            value={wiz.condition}
            onChange={(e) => patch({ condition: e.target.value })}
            placeholder="e.g. revenue projection, Q3 earnings, MNPI"
          />
        </Field>
      </div>
    );
  }

  if (stepIdx === 1) {
    return (
      <div>
        <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
          Pick a template to seed detection settings.
        </p>
        <Field label="Template">
          <NativeSelect value={wiz.template} onChange={(value) => patch({ template: value })} options={TEMPLATES.map((t) => ({ value: t, label: t }))} />
        </Field>
      </div>
    );
  }

  if (stepIdx === 2) {
    return (
      <div>
        <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
          Pick a single group. To scope across multiple groups, create a custom user list in Entra and select it.
        </p>
        <Field label="Users in scope">
          <NativeSelect value={wiz.scope} onChange={(value) => patch({ scope: value })} options={SCOPES.map((s) => ({ value: s, label: s }))} />
        </Field>
      </div>
    );
  }

  if (stepIdx === 3) {
    return (
      <div>
        <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
          Pick classifiers to apply. At least one classifier is required.
        </p>
        {classifiers.map((c) => (
          <Checkbox
            key={c.id}
            label={`${c.name} — ${c.description}`}
            checked={wiz.classifierIds.includes(c.id)}
            onChange={() => onToggleClassifier(c.id)}
          />
        ))}
      </div>
    );
  }

  if (stepIdx === 4) {
    return (
      <div>
        <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
          Conditions and detection settings for this policy.
        </p>
        <Field label="Custom keywords / condition (optional)">
          <textarea className={styles.textarea} value={wiz.condition} onChange={(e) => patch({ condition: e.target.value })} />
        </Field>
        <Field label="Sampling rate (% of matches reviewed)">
          <input
            className={styles.input}
            type="number"
            min={1}
            max={100}
            value={wiz.samplingPct}
            onChange={(e) => patch({ samplingPct: parseInt(e.target.value, 10) || 100 })}
            style={{ width: 100 }}
          />
        </Field>
      </div>
    );
  }

  // Review step
  const classifierNames = classifiers.filter((c) => wiz.classifierIds.includes(c.id)).map((c) => c.name);
  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Review
      </div>
      <div className={styles.inspector}>
        <div className="field">
          <div className={styles.fieldLabel}>Name</div>
          <div className={styles.fieldValue}>{wiz.name.trim() || "(untitled)"}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Template</div>
          <div className={styles.fieldValue}>{wiz.template}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Users in scope</div>
          <div className={styles.fieldValue}>{wiz.scope}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Classifiers</div>
          <div className={styles.fieldValue}>{classifierNames.length > 0 ? classifierNames.join(", ") : "None"}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Custom condition</div>
          <div className={styles.fieldValue}>{wiz.condition || "(none)"}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Sampling rate</div>
          <div className={styles.fieldValue}>{wiz.samplingPct}%</div>
        </div>
      </div>
      <p className={styles.muted} style={{ marginTop: 12, fontSize: 12 }}>
        {wiz.editId
          ? "Clicking Save changes updates the policy. Existing open alerts are unaffected."
          : "Clicking Create policy activates the policy. Communications matching the conditions will start generating alerts within ~5 minutes."}
      </p>
    </div>
  );
}
