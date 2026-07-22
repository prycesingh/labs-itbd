"use client";

// Insider Risk Management page for the Microsoft Purview compliance-portal
// simulator. Ported from itbd-lab/simulators/purview/js/purview-irm.js (662
// lines) — Overview / Cases / Alert dashboard / Policies / Indicators &
// triggers / Forensic evidence / Privacy & roles tabs.
//
// Two deliberate departures from a byte-for-byte port, both required by the
// task brief:
//   - Source's per-case `riskLevel` is a static hardcoded string in its CASES
//     array (never computed from indicator weights) — every risk score/level
//     shown here is instead computed LIVE via `computeIrmRiskScore()` against
//     each case's `triggeredIndicatorIds` + `state.irmIndicators`, never read
//     from the stored `riskScore`/`riskLevel` fields directly. They already
//     agree (seed data was built consistent with the engine), but the UI
//     genuinely recomputes so the display would track a change to a case's
//     triggered indicators.
//   - Source's `PurviewIRM` router swaps tabs via
//     `document.getElementById('mainContent' || 'pv-main').innerHTML = ...`
//     with a broken element-id fallback that silently stops re-rendering
//     after first paint (source's actual bug — see its `go()`/`rerender()`).
//     This is a normal React component using local `useState` for both the
//     top-level `SubTabBar` and the case flyout's internal tab, so that bug
//     class is structurally impossible here.
//
// Forensic evidence: source's `forensicView()` is a genuinely separate
// top-level tab (a standalone table of forensic-capture rows keyed by case
// id, not part of the case flyout's tab set — source's case flyout only has
// timeline/alerts/notes/actions). Ported here as its own SubTabBar tab,
// matching source, with each row cross-linking back to its case.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import { computeIrmRiskScore, pseudonym } from "@/lib/labs/simulators/purview/irm-engine";
import type { PurviewIrmCase, PurviewIrmPolicy, PurviewState } from "@/lib/labs/simulators/purview/types";

import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatRow,
  StatusPill,
  SubTabBar,
  statusTone,
} from "./purview-ui";
import styles from "./purview-console.module.css";

// ===== Local types =====

type Tab = "overview" | "cases" | "alerts" | "policies" | "indicators" | "forensic" | "privacy";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "cases", label: "Cases" },
  { key: "alerts", label: "Alert dashboard" },
  { key: "policies", label: "Policies" },
  { key: "indicators", label: "Indicators & triggers" },
  { key: "forensic", label: "Forensic evidence" },
  { key: "privacy", label: "Privacy & roles" },
];

type CaseFlyoutTab = "risk" | "timeline" | "notes" | "actions";

const CASE_FLYOUT_TABS: { key: CaseFlyoutTab; label: string }[] = [
  { key: "risk", label: "Risk breakdown" },
  { key: "timeline", label: "Activity timeline" },
  { key: "notes", label: "Notes" },
  { key: "actions", label: "Reviewer actions" },
];

// Source's TEMPLATES list (create-policy wizard step 1).
const TEMPLATES = [
  "Data theft by departing users",
  "Data leaks",
  "Data leaks by priority users",
  "Security policy violations",
  "Patient data misuse (HIPAA)",
  "Risky AI usage",
  "General data leaks (custom)",
];

// Source's PRIVACY controls table (privacyView()).
type PrivacyControlRow = { control: string; desc: string };

const PRIVACY_CONTROLS: PrivacyControlRow[] = [
  {
    control: "Pseudonymized usernames by default",
    desc: 'All alerts/cases show pseudonyms (e.g., "User-482911") until a reviewer with "view real names" permission opens the user identity.',
  },
  {
    control: "Anonymization of file names",
    desc: 'Sensitive file names hidden by hash; reviewer must click "Show real name" to reveal. Action is audited.',
  },
  {
    control: "Separation of duties",
    desc: "Investigator role cannot see HRIS data. Compliance officer cannot see DLP details. Separate evidence rooms.",
  },
  {
    control: 'Auto-purge after disposition',
    desc: 'Once a case is closed as "No action", evidence is purged after 30 days (configurable).',
  },
  {
    control: "Geo-fenced visibility",
    desc: "EU employee data visible only to EU-based investigators (GDPR). India/Singapore similar.",
  },
  {
    control: "Audit log",
    desc: 'Every "show real name" / "view content" click is logged to Audit (Premium) for 10 years.',
  },
];

type RbacRoleRow = { role: string; can: string; cannot: string };

const RBAC_ROLES: RbacRoleRow[] = [
  { role: "Insider Risk Management", can: "All admin + investigator actions", cannot: "—" },
  { role: "IRM Admins", can: "Create / modify policies, manage settings", cannot: "View case content or user identity" },
  { role: "IRM Analysts", can: "Triage alerts, view pseudonymized cases", cannot: "View real user identity, view content" },
  { role: "IRM Investigators", can: "Open cases, view content, request real-name reveal", cannot: "Create / modify policies, view forensic evidence (separate)" },
  { role: "IRM Auditors", can: "View all RBAC actions in audit log", cannot: "Any operational action" },
];

// Source's forensicView() sample rows — one synthesized forensic-capture
// entry per high-severity case, keyed by case id so this tab cross-links
// back into the Cases flyout.
type ForensicRow = { caseId: string; device: string; capturedAt: string; duration: string; trigger: string; reviewerAccess: string };

const FORENSIC_EVIDENCE: ForensicRow[] = [
  { caseId: "C-1042", device: "LAPTOP-USERPS-01", capturedAt: "14:42:18", duration: "2m 30s (before+after)", trigger: "USB copy of sensitive-labeled files", reviewerAccess: "2 named reviewers" },
  { caseId: "C-1040", device: "LAPTOP-USERMX-04", capturedAt: "13:14:22", duration: "2m 30s", trigger: "External email with sensitive content", reviewerAccess: "Legal counsel only" },
  { caseId: "C-1038", device: "HEALTHCLI-118", capturedAt: "11:08:11", duration: "5m 00s", trigger: "Bulk PHI download flagged", reviewerAccess: "Healthcare compliance officer only" },
];

// ===== Create-policy modal state =====

type PolicyWizardState = {
  name: string;
  template: string;
  priority: PurviewIrmPolicy["priority"];
  usersInScope: string;
  indicatorIds: string[];
};

function freshPolicyWizard(defaultIndicatorIds: string[]): PolicyWizardState {
  return {
    name: "",
    template: TEMPLATES[1],
    priority: "Standard",
    usersInScope: "",
    indicatorIds: defaultIndicatorIds,
  };
}

export function InsiderRiskPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [tab, setTab] = useState<Tab>("overview");

  const [caseFlyoutId, setCaseFlyoutId] = useState<string | null>(null);
  const [caseFlyoutTab, setCaseFlyoutTab] = useState<CaseFlyoutTab>("risk");
  const [noteDraft, setNoteDraft] = useState("");

  const [policyDetailId, setPolicyDetailId] = useState<string | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyWizard, setPolicyWizard] = useState<PolicyWizardState>(() =>
    freshPolicyWizard(state.irmIndicators.slice(0, 3).map((i) => i.id)),
  );

  // ===== Live risk computation (never read case.riskScore/riskLevel directly) =====

  const riskByCaseId = useMemo(() => {
    const map = new Map<string, { score: number; level: "Low" | "Medium" | "High" | "Critical" }>();
    for (const c of state.irmCases) {
      map.set(c.id, computeIrmRiskScore(c.triggeredIndicatorIds, state.irmIndicators));
    }
    return map;
  }, [state.irmCases, state.irmIndicators]);

  function liveRisk(c: PurviewIrmCase) {
    return riskByCaseId.get(c.id) ?? computeIrmRiskScore(c.triggeredIndicatorIds, state.irmIndicators);
  }

  function displayNameFor(upn: string): string {
    return state.users.find((u) => u.userPrincipalName === upn)?.displayName ?? upn;
  }

  function userCellFor(c: PurviewIrmCase) {
    return c.realNameRevealed ? displayNameFor(c.upn) : pseudonym(c.upn);
  }

  function policyNameFor(policyId: string): string {
    return state.irmPolicies.find((p) => p.id === policyId)?.name ?? policyId;
  }

  // ===== Overview stats (all live-computed) =====

  const totalCases = state.irmCases.length;
  const activeCases = state.irmCases.filter((c) => c.status === "Active").length;
  const byLevel = useMemo(() => {
    const counts: Record<"Low" | "Medium" | "High" | "Critical", number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    for (const c of state.irmCases) counts[liveRisk(c).level]++;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.irmCases, riskByCaseId]);

  const casesSortedByScoreDesc = useMemo(
    () => [...state.irmCases].sort((a, b) => liveRisk(b).score - liveRisk(a).score),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.irmCases, riskByCaseId],
  );

  // ===== Case flyout =====

  const flyoutCase = caseFlyoutId ? state.irmCases.find((c) => c.id === caseFlyoutId) ?? null : null;

  function openCase(c: PurviewIrmCase) {
    setCaseFlyoutId(c.id);
    setCaseFlyoutTab("risk");
    setNoteDraft("");
  }

  function closeCaseFlyout() {
    setCaseFlyoutId(null);
    setNoteDraft("");
  }

  function handleToggleRealName(c: PurviewIrmCase) {
    dispatch({ type: "TOGGLE_IRM_REALNAME", id: c.id });
    toast(c.realNameRevealed ? "Re-pseudonymized on case review." : "Identity revealed — access logged to Purview audit", {
      description: c.realNameRevealed ? undefined : "This access is permanently logged and visible to IRM Auditors.",
    });
  }

  function handleAddNote(c: PurviewIrmCase) {
    if (!noteDraft.trim()) return;
    dispatch({ type: "ADD_IRM_CASE_NOTE", id: c.id, author: "You", text: noteDraft.trim() });
    setNoteDraft("");
    toast.success("Note added.");
  }

  function handleResolve(c: PurviewIrmCase) {
    dispatch({ type: "RESOLVE_IRM_CASE", id: c.id });
    toast.success("Case resolved.");
  }

  function handleEscalate(c: PurviewIrmCase) {
    dispatch({ type: "ESCALATE_IRM_CASE", id: c.id });
    toast.success("Escalated to investigation.");
  }

  // ===== Policies =====

  const policyDetail = policyDetailId ? state.irmPolicies.find((p) => p.id === policyDetailId) ?? null : null;

  function handleTogglePolicyStatus(p: PurviewIrmPolicy) {
    const nextStatus = p.status === "Active" ? "Disabled" : "Active";
    dispatch({ type: "UPDATE_IRM_POLICY", id: p.id, patch: { status: nextStatus } });
    toast.success(`Policy ${nextStatus === "Active" ? "activated" : "disabled"}.`);
  }

  function openPolicyModal() {
    setPolicyWizard(freshPolicyWizard(state.irmIndicators.slice(0, 3).map((i) => i.id)));
    setPolicyModalOpen(true);
  }

  function togglePolicyIndicator(id: string) {
    setPolicyWizard((w) => ({
      ...w,
      indicatorIds: w.indicatorIds.includes(id) ? w.indicatorIds.filter((x) => x !== id) : [...w.indicatorIds, id],
    }));
  }

  function finishPolicyWizard() {
    if (!policyWizard.name.trim()) {
      toast.warning("Policy name is required.");
      return;
    }
    if (policyWizard.indicatorIds.length === 0) {
      toast.warning("Select at least one indicator.");
      return;
    }
    const usersInScope = Number.parseInt(policyWizard.usersInScope, 10);
    const policy: PurviewIrmPolicy = {
      id: `irm-${crypto.randomUUID()}`,
      name: policyWizard.name.trim(),
      template: policyWizard.template,
      priority: policyWizard.priority,
      usersInScope: Number.isFinite(usersInScope) && usersInScope >= 0 ? usersInScope : 0,
      alertsLast90d: 0,
      status: "Active",
      indicatorIds: policyWizard.indicatorIds,
    };
    dispatch({ type: "ADD_IRM_POLICY", policy });
    setPolicyModalOpen(false);
    toast.success(`Policy "${policy.name}" created — sampling starts within 5 minutes.`);
  }

  // ===== Indicators grouped =====

  const indicatorsByGroup = useMemo(() => {
    const groups = new Map<string, typeof state.irmIndicators>();
    for (const ind of state.irmIndicators) {
      const arr = groups.get(ind.group) ?? [];
      arr.push(ind);
      groups.set(ind.group, arr);
    }
    return groups;
  }, [state.irmIndicators]);

  function indicatorLabel(id: string): { name: string; weight: number } | null {
    const ind = state.irmIndicators.find((i) => i.id === id);
    return ind ? { name: ind.name, weight: ind.weight } : null;
  }

  return (
    <div>
      <div className={styles.pageH1}>Insider Risk Management</div>
      <div className={styles.pageSub}>
        Detect risky activity, investigate within a privacy-preserving workflow, and act through forensic evidence and notice templates.
      </div>

      <SubTabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {/* ===== Overview ===== */}
      {tab === "overview" ? (
        <>
          <StatRow
            stats={[
              { label: "Total cases", value: totalCases },
              { label: "Active cases", value: activeCases },
              { label: "Critical risk", value: byLevel.Critical },
              { label: "High risk", value: byLevel.High },
              { label: "Medium risk", value: byLevel.Medium },
              { label: "Low risk", value: byLevel.Low },
            ]}
          />

          <div className={styles.h3}>Risk level distribution</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Level</th>
                <th>Open cases</th>
                <th>SLA</th>
                <th>Auto-escalation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <StatusPill tone="err">Critical</StatusPill>
                </td>
                <td>{byLevel.Critical}</td>
                <td>2 hours</td>
                <td>Auto-page Legal + HR on-call</td>
              </tr>
              <tr>
                <td>
                  <StatusPill tone="warn">High</StatusPill>
                </td>
                <td>{byLevel.High}</td>
                <td>8 hours</td>
                <td>Notify IRM tier-2</td>
              </tr>
              <tr>
                <td>
                  <StatusPill tone="info">Medium</StatusPill>
                </td>
                <td>{byLevel.Medium}</td>
                <td>2 business days</td>
                <td>—</td>
              </tr>
              <tr>
                <td>
                  <StatusPill tone="muted">Low</StatusPill>
                </td>
                <td>{byLevel.Low}</td>
                <td>5 business days</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>

          <div className={styles.h3}>Recent cases</div>
          <DataTable<PurviewIrmCase>
            columns={caseColumns()}
            rows={state.irmCases.slice(0, 4)}
            getRowKey={(c) => c.id}
            onRowClick={openCase}
            emptyMessage="No insider risk cases."
          />
        </>
      ) : null}

      {/* ===== Cases ===== */}
      {tab === "cases" ? (
        <>
          <div className={styles.toolbar}>
            <strong>{state.irmCases.length} cases</strong>
          </div>
          <DataTable<PurviewIrmCase>
            columns={caseColumns()}
            rows={state.irmCases}
            getRowKey={(c) => c.id}
            onRowClick={openCase}
            emptyMessage="No insider risk cases."
          />
        </>
      ) : null}

      {/* ===== Alert dashboard ===== */}
      {tab === "alerts" ? (
        <>
          <p className={`${styles.muted} ${styles.small}`} style={{ marginBottom: 14 }}>
            Cases ranked by live-computed risk score, highest first — the same {`computeIrmRiskScore()`} engine used everywhere else in this
            module.
          </p>
          <DataTable<PurviewIrmCase>
            columns={[
              { key: "id", header: "Case", render: (c) => <span className={styles.rowLink}>{c.id}</span> },
              { key: "user", header: "User", render: (c) => <code>{userCellFor(c)}</code> },
              { key: "policy", header: "Policy", render: (c) => policyNameFor(c.policyId) },
              { key: "score", header: "Risk score", render: (c) => <strong>{liveRisk(c).score}</strong> },
              { key: "level", header: "Risk level", render: (c) => <StatusPill tone={riskTone(liveRisk(c).level)}>{liveRisk(c).level}</StatusPill> },
              { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
              { key: "openedOn", header: "Opened", render: (c) => c.openedOn },
            ]}
            rows={casesSortedByScoreDesc}
            getRowKey={(c) => c.id}
            onRowClick={openCase}
            emptyMessage="No cases."
          />
        </>
      ) : null}

      {/* ===== Policies ===== */}
      {tab === "policies" ? (
        <>
          <div className={styles.toolbar}>
            <strong>{state.irmPolicies.length} policies</strong>
            <span className={styles.toolbarSpacer} />
            <button type="button" className={styles.tbBtn} onClick={openPolicyModal}>
              <span className={styles.tbBtnIco}>+</span> Create policy
            </button>
          </div>
          <DataTable<PurviewIrmPolicy>
            columns={[
              { key: "name", header: "Name", render: (p) => <span className={styles.rowLink}>{p.name}</span> },
              { key: "template", header: "Template", render: (p) => p.template },
              { key: "priority", header: "Priority", render: (p) => p.priority },
              { key: "usersInScope", header: "Users in scope", render: (p) => p.usersInScope.toLocaleString() },
              { key: "alertsLast90d", header: "Alerts (90d)", render: (p) => p.alertsLast90d },
              {
                key: "status",
                header: "Status",
                render: (p) => (
                  <button
                    type="button"
                    className={styles.btnSubtle}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePolicyStatus(p);
                    }}
                  >
                    <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill>
                  </button>
                ),
              },
            ]}
            rows={state.irmPolicies}
            getRowKey={(p) => p.id}
            onRowClick={(p) => setPolicyDetailId(p.id)}
            emptyMessage="No insider risk policies yet."
          />
          <div className={styles.card} style={{ marginTop: 14, borderLeft: "3px solid #0078d4", background: "#deecf9" }}>
            <strong>HRIS integration:</strong> Connect Workday / SAP SuccessFactors to Purview via the Microsoft 365 HR connector.
            Departing-user policies activate automatically the moment Workday records a resignation, and run for 30 days post-termination.
          </div>
        </>
      ) : null}

      {/* ===== Indicators & triggers ===== */}
      {tab === "indicators" ? (
        <>
          <p className={`${styles.muted} ${styles.small}`} style={{ marginBottom: 14 }}>
            Indicators are the signals fed into the risk model. Each indicator has a real weight below — the cumulative weighted score per user
            (summed across triggered indicators) generates an alert when above the policy threshold. Weights are shown here so the scoring is
            transparent, unlike a static risk label.
          </p>
          {Array.from(indicatorsByGroup.entries()).map(([group, indicators]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div className={styles.h3}>{group}</div>
              <DataTable
                columns={[
                  { key: "name", header: "Indicator", render: (i) => i.name },
                  { key: "group", header: "Group", render: (i) => i.group },
                  { key: "weight", header: "Weight", render: (i) => <strong>{i.weight}</strong> },
                ]}
                rows={indicators}
                getRowKey={(i) => i.id}
                emptyMessage="No indicators in this group."
              />
            </div>
          ))}
        </>
      ) : null}

      {/* ===== Forensic evidence ===== */}
      {tab === "forensic" ? (
        <>
          <p className={`${styles.muted} ${styles.small}`} style={{ marginBottom: 14 }}>
            Forensic evidence captures clip-recorded screen activity around high-severity alerts. Requires endpoint agent + explicit user notice
            (privacy policy).
          </p>
          <DataTable<ForensicRow>
            columns={[
              {
                key: "caseId",
                header: "Case",
                render: (r) => {
                  const c = state.irmCases.find((x) => x.id === r.caseId);
                  return c ? (
                    <button type="button" className={styles.rowLink} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => openCase(c)}>
                      {r.caseId}
                    </button>
                  ) : (
                    r.caseId
                  );
                },
              },
              { key: "device", header: "Device", render: (r) => r.device },
              { key: "capturedAt", header: "Captured at", render: (r) => r.capturedAt },
              { key: "duration", header: "Duration", render: (r) => r.duration },
              { key: "trigger", header: "Trigger", render: (r) => r.trigger },
              { key: "reviewerAccess", header: "Reviewer access", render: (r) => r.reviewerAccess },
            ]}
            rows={FORENSIC_EVIDENCE}
            getRowKey={(r) => r.caseId}
            emptyMessage="No forensic captures."
          />
          <div className={styles.card} style={{ marginTop: 14, borderLeft: "3px solid #b8860b", background: "#fff4ce" }}>
            <strong>Privacy bar:</strong> Forensic clip recording requires employee notice + works-council approval in EU/Germany/France. Get legal
            sign-off before enabling in regulated geographies.
          </div>
        </>
      ) : null}

      {/* ===== Privacy & roles ===== */}
      {tab === "privacy" ? (
        <>
          <p className={`${styles.muted} ${styles.small}`} style={{ marginBottom: 14 }}>
            IRM is privacy-preserving by design. Identity reveal is logged, approved, and limited by role.
          </p>
          <DataTable<PrivacyControlRow>
            columns={[
              { key: "control", header: "Privacy control", render: (r) => <strong>{r.control}</strong> },
              { key: "desc", header: "How it works", render: (r) => r.desc },
            ]}
            rows={PRIVACY_CONTROLS}
            getRowKey={(r) => r.control}
          />

          <div className={styles.h3}>RBAC roles</div>
          <DataTable<RbacRoleRow>
            columns={[
              { key: "role", header: "Role", render: (r) => r.role },
              { key: "can", header: "Can do", render: (r) => r.can },
              { key: "cannot", header: "Cannot do", render: (r) => r.cannot },
            ]}
            rows={RBAC_ROLES}
            getRowKey={(r) => r.role}
          />
        </>
      ) : null}

      {/* ===== Case detail flyout ===== */}
      {flyoutCase ? (
        <Flyout
          title={`${flyoutCase.id} — ${userCellFor(flyoutCase)}`}
          subtitle={
            <>
              <StatusPill tone={riskTone(liveRisk(flyoutCase).level)}>{liveRisk(flyoutCase).level}</StatusPill>{" "}
              (score {liveRisk(flyoutCase).score}) &middot; {policyNameFor(flyoutCase.policyId)} &middot;{" "}
              <StatusPill tone={statusTone(flyoutCase.status)}>{flyoutCase.status}</StatusPill> &middot; Opened {flyoutCase.openedOn}
              {flyoutCase.realNameRevealed ? (
                <>
                  {" "}
                  &middot; <span style={{ color: "#a4262c", fontWeight: 600 }}>Real name revealed</span>
                </>
              ) : null}
            </>
          }
          onClose={closeCaseFlyout}
          tabs={
            <SubTabBar
              tabs={CASE_FLYOUT_TABS}
              active={caseFlyoutTab}
              onChange={(k) => setCaseFlyoutTab(k as CaseFlyoutTab)}
            />
          }
        >
          {caseFlyoutTab === "risk" ? (
            <>
              <div className={styles.h3}>Live risk score</div>
              <div className={styles.inspector}>
                <div className={styles.field}>
                  <div className={styles.fieldLabel}>Score</div>
                  <div className={styles.fieldValue}>
                    <strong>{liveRisk(flyoutCase).score}</strong>
                  </div>
                </div>
                <div className={styles.field}>
                  <div className={styles.fieldLabel}>Level</div>
                  <div className={styles.fieldValue}>
                    <StatusPill tone={riskTone(liveRisk(flyoutCase).level)}>{liveRisk(flyoutCase).level}</StatusPill>
                  </div>
                </div>
              </div>

              <div className={styles.h3}>Identity</div>
              <p className={styles.small}>
                <code>{userCellFor(flyoutCase)}</code>
                {flyoutCase.realNameRevealed ? (
                  <span className={`${styles.pill} ${styles.pillErr}`} style={{ marginLeft: 8 }}>
                    Real name revealed
                  </span>
                ) : null}
              </p>
              <button type="button" className={flyoutCase.realNameRevealed ? styles.btnOutline : styles.btn} onClick={() => handleToggleRealName(flyoutCase)}>
                {flyoutCase.realNameRevealed ? "Re-pseudonymize" : "Show real identity (audit-logged)"}
              </button>

              <div className={styles.h3}>Triggered indicators ({flyoutCase.triggeredIndicatorIds.length})</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th>Group</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {flyoutCase.triggeredIndicatorIds.map((id) => {
                    const ind = state.irmIndicators.find((i) => i.id === id);
                    if (!ind) return null;
                    return (
                      <tr key={id}>
                        <td>{ind.name}</td>
                        <td>{ind.group}</td>
                        <td>
                          <strong>{ind.weight}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : null}

          {caseFlyoutTab === "timeline" ? (
            <>
              <div className={styles.h3}>Activity timeline</div>
              {flyoutCase.history.length === 0 ? (
                <EmptyState message="No timeline events yet." />
              ) : (
                <div className={styles.tree}>
                  {flyoutCase.history.map((h) => (
                    <div key={h.id} style={{ padding: "8px 4px", borderBottom: "1px solid #f3f2f1" }}>
                      <div className={`${styles.small} ${styles.muted}`}>{new Date(h.time).toLocaleString()}</div>
                      <div style={{ fontSize: 13, marginTop: 2 }}>{h.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {caseFlyoutTab === "notes" ? (
            <>
              <div className={styles.h3}>Reviewer notes</div>
              {flyoutCase.notes.length === 0 ? (
                <EmptyState message="No notes yet." />
              ) : (
                flyoutCase.notes.map((n) => (
                  <div key={n.id} className={styles.card} style={{ borderLeft: "3px solid #5c2d91", padding: "8px 12px", marginBottom: 6 }}>
                    <div className={`${styles.small} ${styles.muted}`}>
                      {new Date(n.time).toLocaleString()} &middot; {n.author}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{n.text}</div>
                  </div>
                ))
              )}
              <div className={`${styles.flexRow} ${styles.mt12}`}>
                <input
                  className={styles.input}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a note (visible to other reviewers + audit log)"
                />
                <button type="button" className={styles.btnOutline} onClick={() => handleAddNote(flyoutCase)}>
                  Add note
                </button>
              </div>
            </>
          ) : null}

          {caseFlyoutTab === "actions" ? (
            <>
              <div className={styles.h3}>Reviewer actions</div>
              {flyoutCase.status === "Resolved" ? (
                <div className={`${styles.small} ${styles.muted}`}>Current status: {flyoutCase.status} — case is closed.</div>
              ) : (
                <div className={styles.flexRow} style={{ flexWrap: "wrap" }}>
                  <button type="button" className={styles.btn} onClick={() => handleResolve(flyoutCase)}>
                    Resolve — No action
                  </button>
                  {flyoutCase.status !== "Escalated to investigation" ? (
                    <button type="button" className={styles.btnOutline} onClick={() => handleEscalate(flyoutCase)}>
                      Escalate to investigation
                    </button>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </Flyout>
      ) : null}

      {/* ===== Policy detail flyout ===== */}
      {policyDetail ? (
        <Flyout
          title={policyDetail.name}
          subtitle={`${policyDetail.template} · ${policyDetail.priority}`}
          onClose={() => setPolicyDetailId(null)}
          footer={
            <button type="button" className={styles.btn} onClick={() => setPolicyDetailId(null)}>
              Close
            </button>
          }
        >
          <div className={styles.inspector}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Template</div>
              <div className={styles.fieldValue}>{policyDetail.template}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Priority</div>
              <div className={styles.fieldValue}>{policyDetail.priority}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Users in scope</div>
              <div className={styles.fieldValue}>{policyDetail.usersInScope.toLocaleString()}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Alerts (90d)</div>
              <div className={styles.fieldValue}>{policyDetail.alertsLast90d}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Status</div>
              <div className={styles.fieldValue}>
                <StatusPill tone={statusTone(policyDetail.status)}>{policyDetail.status}</StatusPill>
              </div>
            </div>
          </div>

          <div className={styles.h3}>Indicators ({policyDetail.indicatorIds.length})</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Indicator</th>
                <th>Group</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {policyDetail.indicatorIds.map((id) => {
                const info = indicatorLabel(id);
                if (!info) return null;
                return (
                  <tr key={id}>
                    <td>{info.name}</td>
                    <td>{state.irmIndicators.find((i) => i.id === id)?.group}</td>
                    <td>
                      <strong>{info.weight}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Flyout>
      ) : null}

      {/* ===== Create policy modal ===== */}
      {policyModalOpen ? (
        <Modal
          title="Create insider risk policy"
          onClose={() => setPolicyModalOpen(false)}
          width="720px"
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPolicyModalOpen(false)}>
                Cancel
              </button>
              <span style={{ flex: 1 }} />
              <button type="button" className={styles.btn} onClick={finishPolicyWizard}>
                Create policy
              </button>
            </>
          }
        >
          <Field label="Policy name *">
            <input
              className={styles.input}
              value={policyWizard.name}
              onChange={(e) => setPolicyWizard((w) => ({ ...w, name: e.target.value }))}
              placeholder="e.g. Data leaks by priority users"
            />
          </Field>
          <Field label="Template">
            <NativeSelect
              value={policyWizard.template}
              onChange={(v) => setPolicyWizard((w) => ({ ...w, template: v }))}
              options={TEMPLATES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Priority">
            <NativeSelect
              value={policyWizard.priority}
              onChange={(v) => setPolicyWizard((w) => ({ ...w, priority: v as PurviewIrmPolicy["priority"] }))}
              options={[
                { value: "Standard", label: "Standard" },
                { value: "Users with elevated risk", label: "Users with elevated risk" },
              ]}
            />
          </Field>
          <Field label="Users in scope" help="Approximate headcount this policy will monitor.">
            <input
              className={styles.input}
              type="number"
              min={0}
              value={policyWizard.usersInScope}
              onChange={(e) => setPolicyWizard((w) => ({ ...w, usersInScope: e.target.value }))}
              placeholder="e.g. 240"
            />
          </Field>
          <Field label="Indicators" help="Signals fed into the risk score. Cumulative weighted scores trigger alerts above the policy threshold.">
            {Array.from(indicatorsByGroup.entries()).map(([group, indicators]) => (
              <div key={group} style={{ marginBottom: 10 }}>
                <div className={`${styles.small} ${styles.muted}`} style={{ marginBottom: 4, fontWeight: 600 }}>
                  {group}
                </div>
                {indicators.map((ind) => (
                  <Checkbox
                    key={ind.id}
                    label={`${ind.name} (weight ${ind.weight})`}
                    checked={policyWizard.indicatorIds.includes(ind.id)}
                    onChange={() => togglePolicyIndicator(ind.id)}
                  />
                ))}
              </div>
            ))}
          </Field>
        </Modal>
      ) : null}
    </div>
  );

  function caseColumns() {
    return [
      { key: "id", header: "Case", render: (c: PurviewIrmCase) => <span className={styles.rowLink}>{c.id}</span> },
      { key: "user", header: "User", render: (c: PurviewIrmCase) => <code>{userCellFor(c)}</code> },
      { key: "policy", header: "Policy", render: (c: PurviewIrmCase) => policyNameFor(c.policyId) },
      {
        key: "risk",
        header: "Risk",
        render: (c: PurviewIrmCase) => <StatusPill tone={riskTone(liveRisk(c).level)}>{liveRisk(c).level}</StatusPill>,
      },
      { key: "status", header: "Status", render: (c: PurviewIrmCase) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
      { key: "openedOn", header: "Opened", render: (c: PurviewIrmCase) => c.openedOn },
    ];
  }
}

function riskTone(level: "Low" | "Medium" | "High" | "Critical"): "err" | "warn" | "info" | "muted" {
  if (level === "Critical") return "err";
  if (level === "High") return "warn";
  if (level === "Medium") return "info";
  return "muted";
}
