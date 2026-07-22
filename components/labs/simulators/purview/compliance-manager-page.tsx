"use client";

// Compliance Manager page for the Microsoft Purview compliance-portal
// simulator. Ported from itbd-lab/simulators/purview/js/purview-compliance-mgr.js
// (score ring, breakdown bars, 9 regulatory-template assessments, improvement
// actions, "+ Add assessment" 4-step wizard).
//
// Two deliberate departures from source, both required by the porting task:
//
// 1. Source's overall tenant score (`SCORE.current = 67`) is a static number
//    that never recalculates from the assessments/actions it displays
//    alongside. This port instead calls the real `computeComplianceScore()`
//    engine (compliance-engine.ts) from `useMemo`, so the score genuinely
//    derives from `state.complianceAssessments`/`state.complianceActions` and
//    updates the instant a control or action status changes.
//
// 2. Source's tab navigation (`view`/`go()` module-level variables +
//    `document.getElementById('mainContent').innerHTML = shell()`) breaks
//    after first render because `go()` looks for `#mainContent` but the shell
//    is actually mounted under `#pv-main` in some flows — a wrong-element-id
//    bug. This is built as a normal React component with local `useState` +
//    conditional rendering (via `SubTabBar`), so that bug class is
//    structurally impossible here: there is no DOM id lookup anywhere.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import { computeComplianceScore } from "@/lib/labs/simulators/purview/compliance-engine";
import type { PurviewAssessment, PurviewControl, PurviewControlStatus, PurviewImprovementAction, PurviewState } from "@/lib/labs/simulators/purview/types";
import { DataTable, EmptyState, Field, Flyout, Modal, NativeSelect, StatRow, SubTabBar, WizStep } from "./purview-ui";
import styles from "./purview-console.module.css";

type ComplianceTab = "overview" | "assessments" | "actions";

const TABS: { key: ComplianceTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "assessments", label: "Assessments" },
  { key: "actions", label: "Improvement actions" },
];

const CONTROL_STATUSES: PurviewControlStatus[] = ["Not started", "In progress", "Implemented", "Not applicable"];
const ACTION_STATUSES: PurviewImprovementAction["status"][] = ["Not started", "In progress", "Completed"];

// Regulatory templates matching source's ALL_TEMPLATES list (the wizard's
// "pick a template" step). Kept as a flat list here, mirroring source.
const ASSESSMENT_TEMPLATES: string[] = [
  "Microsoft Data Protection Baseline",
  "ISO 27001:2022",
  "ISO 27002:2022",
  "ISO 27701 Privacy",
  "NIST 800-53 Rev 5 Moderate",
  "NIST 800-171 Rev 2",
  "CIS M365 v3.0",
  "HIPAA / HITECH",
  "PCI DSS v4.0",
  "SOC 2 Type II",
  "EU GDPR",
  "EU NIS 2 Directive",
  "UK GDPR + DPA 2018",
  "India DPDP Act",
  "Singapore PDPA",
  "Australia Essential Eight",
  "CMMC L2",
  "FedRAMP Moderate",
];

const OWNER_GROUPS: string[] = ["Compliance team", "InfoSec", "Legal + DPO", "Finance + IT", "Audit Committee", "IT Ops", "Healthcare BU", "India Legal"];

// Fixed small seed control set for newly-created assessments (source
// synthesizes a "0 / N" control count from the template; here we actually
// seed real per-control rows, matching the task's "real controls" ask, kept
// intentionally small since a brand-new assessment naturally starts thin).
const NEW_ASSESSMENT_CONTROL_TITLES = [
  "Multi-factor authentication for admins",
  "Conditional Access for risky sign-ins",
  "Data loss prevention for sensitive types",
  "Sensitivity label encryption for confidential",
  "Audit log retention >= 365 days",
  "Quarterly access reviews on privileged roles",
];

function computeAssessmentScore(assessment: PurviewAssessment): number {
  let achieved = 0;
  let possible = 0;
  for (const control of assessment.controls) {
    possible += control.points;
    if (control.status === "Implemented") achieved += control.points;
  }
  return possible > 0 ? Math.round((achieved / possible) * 100) : 0;
}

// ===== Add-assessment wizard state =====
type WizardState = { template: string; name: string; ownerGroup: string; dueOn: string };

function freshWizardState(): WizardState {
  const due = new Date();
  due.setDate(due.getDate() + 90);
  return { template: ASSESSMENT_TEMPLATES[0], name: "", ownerGroup: OWNER_GROUPS[0], dueOn: due.toISOString().slice(0, 10) };
}

const WIZARD_STEPS = ["Template", "Basics", "Seed controls", "Review"];

export function ComplianceManagerPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [tab, setTab] = useState<ComplianceTab>("overview");
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStepIdx, setWizStepIdx] = useState(0);
  const [wiz, setWiz] = useState<WizardState>(freshWizardState());

  // The REAL overall compliance score — derived live from state, never a
  // stored/static value. Recomputes automatically whenever a control status
  // or action status changes, since MARK_CONTROL_STATUS/UPDATE_ACTION_STATUS
  // both produce a new complianceAssessments/complianceActions reference.
  const score = useMemo(
    () => computeComplianceScore(state.complianceAssessments, state.complianceActions),
    [state.complianceAssessments, state.complianceActions],
  );

  const openAssessment = state.complianceAssessments.find((a) => a.id === openAssessmentId) ?? null;

  const notStartedActions = useMemo(
    () => state.complianceActions.filter((a) => a.status === "Not started").slice(0, 5),
    [state.complianceActions],
  );

  function handleMarkControl(assessmentId: string, controlId: string, status: PurviewControlStatus) {
    dispatch({ type: "MARK_CONTROL_STATUS", assessmentId, controlId, status });
    toast.success(`Control marked ${status}`);
  }

  function handleActionStatus(id: string, status: PurviewImprovementAction["status"]) {
    dispatch({ type: "UPDATE_ACTION_STATUS", id, status });
    toast.success(`Action status: ${status}`);
  }

  function openWizard() {
    setWiz(freshWizardState());
    setWizStepIdx(0);
    setWizardOpen(true);
  }
  function closeWizard() {
    setWizardOpen(false);
  }
  function patchWiz(patch: Partial<WizardState>) {
    setWiz((w) => ({ ...w, ...patch }));
  }
  function goNext() {
    setWizStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1));
  }
  function goBack() {
    setWizStepIdx((i) => Math.max(0, i - 1));
  }

  function commitWizard() {
    const name = wiz.name.trim() || wiz.template;
    const controls: PurviewControl[] = NEW_ASSESSMENT_CONTROL_TITLES.map((title, i) => ({
      id: `asmt-${Date.now().toString(36)}-ctrl-${i + 1}`,
      title,
      status: "Not started",
      points: 10 + (i % 3) * 5,
      owner: wiz.ownerGroup,
      testDate: null,
    }));
    const assessment: PurviewAssessment = {
      id: `asmt-${Date.now().toString(36)}`,
      name,
      template: wiz.template,
      category: "Custom",
      controls,
    };
    dispatch({ type: "ADD_ASSESSMENT", assessment });
    toast.success("Assessment created — start implementing controls");
    setWizardOpen(false);
  }

  return (
    <div>
      <div className={styles.pageH1}>Compliance Manager</div>
      <div className={styles.pageSub}>Manage compliance activities across Microsoft Cloud services with assessments, scores, and improvement actions.</div>

      <SubTabBar tabs={TABS} active={tab} onChange={(key) => setTab(key as ComplianceTab)} />

      {tab === "overview" ? (
        <OverviewTab score={score} notStartedActions={notStartedActions} onGoToActions={() => setTab("actions")} />
      ) : null}

      {tab === "assessments" ? (
        <AssessmentsTab
          assessments={state.complianceAssessments}
          onOpenAssessment={(id) => setOpenAssessmentId(id)}
          onAddAssessment={openWizard}
        />
      ) : null}

      {tab === "actions" ? <ActionsTab actions={state.complianceActions} onStatusChange={handleActionStatus} /> : null}

      {openAssessment ? (
        <Flyout
          title={openAssessment.name}
          subtitle={
            <>
              Template: {openAssessment.template} · Category: {openAssessment.category} · Score:{" "}
              <strong>{computeAssessmentScore(openAssessment)}%</strong>
            </>
          }
          onClose={() => setOpenAssessmentId(null)}
        >
          <AssessmentControls assessment={openAssessment} onMarkControl={handleMarkControl} />
        </Flyout>
      ) : null}

      {wizardOpen ? (
        <Modal
          title="Create new assessment"
          onClose={closeWizard}
          width="680px"
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
                  Create assessment
                </button>
              )}
            </>
          }
        >
          <WizardStepBody wiz={wiz} patch={patchWiz} stepIdx={wizStepIdx} />
        </Modal>
      ) : null}
    </div>
  );
}

// ===== Overview tab =====

function OverviewTab({
  score,
  notStartedActions,
  onGoToActions,
}: {
  score: ReturnType<typeof computeComplianceScore>;
  notStartedActions: PurviewImprovementAction[];
  onGoToActions: () => void;
}) {
  // strokeDasharray for a 90px-diameter ring matching purview-console.module.css
  // `.scoreRing` — circumference of a circle inscribed with radius 40.
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = (score.percentage / 100) * circumference;

  return (
    <div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
        <div className={styles.card} style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 320 }}>
          <svg width="90" height="90" viewBox="0 0 90 90" role="img" aria-label={`Compliance score ${score.percentage}%`}>
            <circle cx="45" cy="45" r={radius} fill="none" stroke="#edebe9" strokeWidth="8" />
            <circle
              cx="45"
              cy="45"
              r={radius}
              fill="none"
              stroke="#5c2d91"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              transform="rotate(-90 45 45)"
            />
            <text x="45" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill="#5c2d91">
              {score.percentage}%
            </text>
          </svg>
          <div>
            <div className={styles.cardTitle} style={{ marginBottom: 4 }}>
              Your compliance score
            </div>
            <div className={styles.muted}>
              <strong>{score.achievedPoints}</strong> / {score.possiblePoints} points achieved
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280 }} className={styles.card}>
          <div className={styles.cardTitle}>Score breakdown</div>
          <BreakdownBar label="Achieved points" value={score.achievedPoints} max={score.possiblePoints} />
          <BreakdownBar label="Remaining points" value={score.possiblePoints - score.achievedPoints} max={score.possiblePoints} />
        </div>
      </div>

      <StatRow
        stats={[
          { label: "Achieved points", value: score.achievedPoints },
          { label: "Possible points", value: score.possiblePoints },
          { label: "Score", value: `${score.percentage}%` },
        ]}
      />

      <div className={styles.h3} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Top priority actions (highest impact on score)</span>
        <button type="button" className={styles.btnSubtle} onClick={onGoToActions}>
          View all improvement actions →
        </button>
      </div>
      <DataTable<PurviewImprovementAction>
        columns={[
          { key: "title", header: "Action", render: (a) => <strong>{a.title}</strong> },
          { key: "points", header: "Score impact", render: (a) => <span style={{ color: "#5c2d91", fontWeight: 600 }}>+{a.points}</span> },
          { key: "category", header: "Category", render: (a) => a.category },
          { key: "assignee", header: "Assignee", render: (a) => a.assignee ?? "unassigned" },
        ]}
        rows={notStartedActions}
        getRowKey={(a) => a.id}
        emptyMessage="No outstanding improvement actions — great work."
      />
    </div>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span>{label}</span>
        <span>
          <strong>{value}</strong> / {max}
        </span>
      </div>
      <div style={{ height: 6, background: "#f3f2f1", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#5c2d91" }} />
      </div>
    </div>
  );
}

// ===== Assessments tab =====

function AssessmentsTab({
  assessments,
  onOpenAssessment,
  onAddAssessment,
}: {
  assessments: PurviewAssessment[];
  onOpenAssessment: (id: string) => void;
  onAddAssessment: () => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <strong>{assessments.length} active assessments</strong>{" "}
          <span className={styles.muted} style={{ fontSize: 12 }}>
            — click any row for per-control breakdown
          </span>
        </div>
        <button type="button" className={styles.btn} onClick={onAddAssessment}>
          + Add assessment
        </button>
      </div>

      <DataTable<PurviewAssessment>
        columns={[
          { key: "name", header: "Name", render: (a) => <strong>{a.name}</strong> },
          { key: "template", header: "Template", render: (a) => a.template },
          { key: "category", header: "Category", render: (a) => a.category },
          { key: "score", header: "Score", render: (a) => `${computeAssessmentScore(a)}%` },
          { key: "controls", header: "Controls", render: (a) => `${a.controls.filter((c) => c.status === "Implemented").length} / ${a.controls.length}` },
        ]}
        rows={assessments}
        getRowKey={(a) => a.id}
        onRowClick={(a) => onOpenAssessment(a.id)}
        emptyMessage="No assessments yet — add one to start tracking controls."
      />
    </div>
  );
}

function AssessmentControls({
  assessment,
  onMarkControl,
}: {
  assessment: PurviewAssessment;
  onMarkControl: (assessmentId: string, controlId: string, status: PurviewControlStatus) => void;
}) {
  const implemented = assessment.controls.filter((c) => c.status === "Implemented").length;

  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Controls — {implemented} of {assessment.controls.length} implemented
      </div>
      <DataTable<PurviewControl>
        columns={[
          { key: "title", header: "Control", render: (c) => <strong>{c.title}</strong> },
          {
            key: "status",
            header: "Status",
            render: (c) => (
              <NativeSelect
                value={c.status}
                onChange={(value) => onMarkControl(assessment.id, c.id, value as PurviewControlStatus)}
                options={CONTROL_STATUSES.map((s) => ({ value: s, label: s }))}
              />
            ),
          },
          { key: "points", header: "Points", render: (c) => c.points },
          { key: "owner", header: "Owner", render: (c) => c.owner },
          { key: "testDate", header: "Test date", render: (c) => (c.testDate ? new Date(c.testDate).toLocaleDateString() : "—") },
        ]}
        rows={assessment.controls}
        getRowKey={(c) => c.id}
        emptyMessage="No controls on this assessment."
      />
    </div>
  );
}

// ===== Improvement actions tab =====

function ActionsTab({
  actions,
  onStatusChange,
}: {
  actions: PurviewImprovementAction[];
  onStatusChange: (id: string, status: PurviewImprovementAction["status"]) => void;
}) {
  if (actions.length === 0) return <EmptyState message="No improvement actions." />;

  return (
    <DataTable<PurviewImprovementAction>
      columns={[
        { key: "title", header: "Action", render: (a) => <strong>{a.title}</strong> },
        { key: "points", header: "Score impact", render: (a) => <span style={{ color: "#5c2d91", fontWeight: 600 }}>+{a.points}</span> },
        {
          key: "status",
          header: "Status",
          render: (a) => (
            <NativeSelect
              value={a.status}
              onChange={(value) => onStatusChange(a.id, value as PurviewImprovementAction["status"])}
              options={ACTION_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          ),
        },
        { key: "category", header: "Category", render: (a) => a.category },
        { key: "assignee", header: "Assignee", render: (a) => a.assignee ?? "unassigned" },
        { key: "dueOn", header: "Due date", render: (a) => (a.dueOn ? new Date(a.dueOn).toLocaleDateString() : "—") },
      ]}
      rows={actions}
      getRowKey={(a) => a.id}
      emptyMessage="No improvement actions."
    />
  );
}

// ===== Add-assessment wizard steps =====

function WizardStepBody({ wiz, patch, stepIdx }: { wiz: WizardState; patch: (p: Partial<WizardState>) => void; stepIdx: number }) {
  if (stepIdx === 0) {
    return (
      <div>
        <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
          Microsoft maintains 300+ regulatory templates. Premium templates require an E5 + Compliance add-on.
        </p>
        <Field label="Template">
          <NativeSelect value={wiz.template} onChange={(value) => patch({ template: value })} options={ASSESSMENT_TEMPLATES.map((t) => ({ value: t, label: t }))} />
        </Field>
      </div>
    );
  }

  if (stepIdx === 1) {
    return (
      <div>
        <Field label="Assessment name (optional — defaults to template name)">
          <input className={styles.input} type="text" value={wiz.name} onChange={(e) => patch({ name: e.target.value })} placeholder={wiz.template} />
        </Field>
        <Field label="Owner group">
          <NativeSelect value={wiz.ownerGroup} onChange={(value) => patch({ ownerGroup: value })} options={OWNER_GROUPS.map((g) => ({ value: g, label: g }))} />
        </Field>
        <Field label="Due date">
          <input className={styles.input} type="date" value={wiz.dueOn} onChange={(e) => patch({ dueOn: e.target.value })} />
        </Field>
      </div>
    );
  }

  if (stepIdx === 2) {
    return (
      <div>
        <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
          A starter set of controls will be created at &quot;Not started&quot;, owned by <strong>{wiz.ownerGroup}</strong>. Implement each
          from the Assessments tab once created.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
          {NEW_ASSESSMENT_CONTROL_TITLES.map((title) => (
            <li key={title} style={{ marginBottom: 4 }}>
              {title}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Review step
  return (
    <div>
      <div className={styles.h3} style={{ marginTop: 0 }}>
        Summary
      </div>
      <div className={styles.inspector}>
        <div className="field">
          <div className={styles.fieldLabel}>Name</div>
          <div className={styles.fieldValue}>{wiz.name.trim() || wiz.template}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Template</div>
          <div className={styles.fieldValue}>{wiz.template}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Owner</div>
          <div className={styles.fieldValue}>{wiz.ownerGroup}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Due date</div>
          <div className={styles.fieldValue}>{wiz.dueOn}</div>
        </div>
        <div className="field">
          <div className={styles.fieldLabel}>Starter controls</div>
          <div className={styles.fieldValue}>{NEW_ASSESSMENT_CONTROL_TITLES.length}</div>
        </div>
      </div>
    </div>
  );
}
