"use client";

// Data policies (DLP) page for the Power Platform Admin Center simulator.
// Ported from itbd-lab/simulators/powerplatform/js/pp-dlp.js (472 lines):
//
// - Policies `DataTable` (name / type / status / scope / business-nonBusiness-
//   blocked counts / real DLP-flagged-affected count) + search, matching
//   source's `renderTable()`/`filteredPolicies()`.
// - Row click opens a `Flyout` with policy detail: description, scope +
//   target/exception environments, three connector buckets as tag lists
//   (source's `.pp-dlp-board`), custom allow/block regex patterns, and a
//   live-computed "Affected apps/flows" section. Source only showed the
//   static connector buckets in the flyout with no real app/flow
//   cross-reference — this port adds a genuine one: it re-derives, for THIS
//   policy specifically, which of `state.apps`/`state.flows` are flagged
//   because of it, using the same policy-scope + connector-classification
//   logic as dlp-engine.ts (an app/flow only counts as "affected by this
//   policy" if the policy is in scope for its environment AND its connector
//   list actually conflicts under this policy's own buckets) — not just
//   "is dlpFlagged true for any reason", which could attribute an app to the
//   wrong policy when multiple policies apply to the same environment.
// - "+ New policy" 5-step wizard (General / Define connectors / Custom
//   connectors / Scope / Review and finish), matching source's `WIZ_STEPS`
//   order and per-step bodies (`wizGeneral`/`wizConnectors`/`wizCustom`/
//   `wizScope`/`wizReview`). The ~255-connector catalog gets a text filter
//   input above each bucket list (source's `connSearch`), and each connector
//   row has B/N/X move buttons across the three buckets, same as source's
//   `moveConn()`. Finishing dispatches `ADD_POLICY` (which auto-recomputes
//   `dlpFlagged` via the reducer's built-in `applyDlpFlags` call — no manual
//   `RECOMPUTE_DLP_FLAGS` dispatch needed here).
// - Export button reads `state.policies` and downloads JSON. Source's
//   `exportJson()` read `state.dlpPolicies` — a field that does not exist
//   anywhere in `PpState` (the real field is `policies`), so source's export
//   silently always produced an empty `[]`. Fixed here to read the correct
//   `state.policies` field.
// - Toggle-status / Delete actions in the flyout footer dispatch
//   `TOGGLE_POLICY_STATUS` / `DELETE_POLICY`. Default-type policies cannot be
//   deleted (matches source's `deleteOne()` guard); delete asks for
//   confirmation via a small `Modal`, never native `confirm()`.
//
// No native prompt()/alert()/confirm() anywhere — all confirmations route
// through Modal + toast (sonner), per house convention (see
// azure-devops/repos-branches-page.tsx for the sibling delete-confirm idiom).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PpState, PpPolicy, PpPolicyScope, PpConnector } from "@/lib/labs/simulators/power-platform/types";
import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import { Checkbox, DataTable, EmptyState, Field, Flyout, Modal, WizStep, StatusPill, statusTone, type DataTableColumn } from "./pp-ui";
import styles from "./pp-console.module.css";

// ===================================================================
// Shared helpers
// ===================================================================

function scopeLabel(p: PpPolicy): string {
  if (p.scope === "Everyone") return "Everyone";
  if (p.scope === "Specific environments") return `Specific: ${p.envIds.length} env(s)`;
  if (p.scope === "All except specific") return `All except: ${p.exceptionEnvs.length} env(s)`;
  return p.scope;
}

function connectorAbbr(name: string): string {
  const letters = name.replace(/[^A-Z0-9]/g, "");
  return (letters.slice(0, 2) || name.slice(0, 2).toUpperCase()).slice(0, 2);
}

function policyAppliesToEnv(policy: PpPolicy, envId: string): boolean {
  if (policy.scope === "Everyone") return true;
  if (policy.scope === "Specific environments") return policy.envIds.includes(envId);
  if (policy.scope === "All except specific") return !policy.exceptionEnvs.includes(envId);
  return false;
}

// Mirrors dlp-engine.ts classifyConnectorUnderPolicy()/evaluatePolicyAgainstConnectors()
// but scoped to a single policy so the flyout can show real "affected by THIS policy"
// results, not just any policy's dlpFlagged flag.
function connectorClassUnderPolicy(connectorId: string, policy: PpPolicy, connectors: PpConnector[]): "Business" | "Non-business" | "Blocked" {
  if (policy.blocked.includes(connectorId)) return "Blocked";
  if (policy.business.includes(connectorId)) return "Business";
  if (policy.nonBusiness.includes(connectorId)) return "Non-business";
  const entry = connectors.find((c) => c.id === connectorId);
  return entry ? entry.def : "Business";
}

function conflictsUnderPolicy(connectorIds: string[], policy: PpPolicy, connectors: PpConnector[]): boolean {
  if (connectorIds.length === 0) return false;
  const classes = connectorIds.map((id) => connectorClassUnderPolicy(id, policy, connectors));
  if (classes.some((c) => c === "Blocked")) return true;
  return new Set(classes).size > 1;
}

type WizardStepId = "general" | "connectors" | "custom" | "scope" | "review";
const WIZ_STEPS: { id: WizardStepId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "connectors", label: "Define connectors" },
  { id: "custom", label: "Custom connectors" },
  { id: "scope", label: "Scope" },
  { id: "review", label: "Review and finish" },
];

type WizardDraft = {
  name: string;
  description: string;
  business: string[];
  nonBusiness: string[];
  blocked: string[];
  blockPatterns: string;
  allowPatterns: string;
  scope: PpPolicyScope;
  envIds: string[];
  exceptionEnvs: string[];
};

function buildDefaultBuckets(connectors: PpConnector[]): { business: string[]; nonBusiness: string[]; blocked: string[] } {
  const business: string[] = [];
  const nonBusiness: string[] = [];
  const blocked: string[] = [];
  for (const c of connectors) {
    if (c.def === "Business") business.push(c.id);
    else if (c.def === "Non-business") nonBusiness.push(c.id);
    else blocked.push(c.id);
  }
  return { business, nonBusiness, blocked };
}

function parsePatterns(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ===================================================================
// Main page
// ===================================================================

export function DlpPoliciesPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof PpPolicy>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PpPolicy | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const flyPolicy = flyoutId ? state.policies.find((p) => p.id === flyoutId) ?? null : null;

  // ---- Table filtering/sorting (matches source's filteredPolicies()) ----
  const rows = useMemo(() => {
    let list = state.policies.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => `${p.name} ${p.type} ${p.scope}`.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const x = String(a[sortKey] ?? "");
      const y = String(b[sortKey] ?? "");
      return x.localeCompare(y) * sortDir;
    });
    return list;
  }, [state.policies, search, sortKey, sortDir]);

  function sortBy(key: keyof PpPolicy) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  // Real DLP-flagged-affected count for a policy: apps/flows in scope for this
  // policy whose connector list actually conflicts under this policy's buckets.
  function affectedCountFor(policy: PpPolicy): number {
    const appHits = state.apps.filter((a) => policyAppliesToEnv(policy, a.envId) && conflictsUnderPolicy(a.connectors, policy, state.connectors)).length;
    const flowHits = state.flows.filter((f) => policyAppliesToEnv(policy, f.envId) && conflictsUnderPolicy(f.connectors, policy, state.connectors)).length;
    return appHits + flowHits;
  }

  function exportJson() {
    // Bug fix applied: source's exportJson() read `state.dlpPolicies`, a field
    // that does not exist on PpState (the real field is `state.policies`), so
    // the exported file was always an empty array. This reads the correct field.
    const policies = state.policies;
    const json = JSON.stringify(policies, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dlp-policies-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${policies.length} DLP policies`);
  }

  function toggleStatus(policy: PpPolicy) {
    dispatch({ type: "TOGGLE_POLICY_STATUS", id: policy.id });
    toast.success(`Policy ${policy.name} is now ${policy.status === "On" ? "Off" : "On"}`);
  }

  function requestDelete(policy: PpPolicy) {
    if (policy.type === "Default") {
      toast.error("Default tenant policies cannot be deleted.");
      return;
    }
    setDeleteTarget(policy);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_POLICY", id: deleteTarget.id });
    toast.success("Policy deleted.");
    setDeleteTarget(null);
    setFlyoutId(null);
  }

  // DataTable headers are plain strings (no per-column click handler in the
  // shared primitive), so sort state is surfaced as a small arrow suffix on
  // the currently-active sort column's header instead of a clickable <th>.
  function headerFor(key: keyof PpPolicy, label: string): string {
    if (sortKey !== key) return label;
    return `${label} ${sortDir === 1 ? "↑" : "↓"}`;
  }

  const columns: DataTableColumn<PpPolicy>[] = [
    { key: "name", header: headerFor("name", "Name"), render: (p) => <span className={styles.rowLink}>{p.name}</span> },
    { key: "type", header: headerFor("type", "Type"), render: (p) => p.type },
    { key: "status", header: headerFor("status", "Status"), render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill> },
    { key: "scope", header: headerFor("scope", "Scope"), render: (p) => scopeLabel(p) },
    {
      key: "buckets",
      header: "Business / Non-business / Blocked",
      render: (p) => `${p.business.length} / ${p.nonBusiness.length} / ${p.blocked.length}`,
    },
    { key: "affected", header: "Affected apps/flows", render: (p) => affectedCountFor(p) },
    { key: "modified", header: headerFor("modified", "Last modified"), render: (p) => new Date(p.modified).toLocaleString() },
    { key: "createdBy", header: "Created by", render: (p) => p.createdBy },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Data policies</div>
      <div className={styles.pageSub}>
        Restrict which connectors can share data with each other. Policies are evaluated whenever an app or flow tries to use a combination of
        connectors.
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setWizardOpen(true)}>
          + New policy
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Refreshed.")}>
          Refresh
        </button>
        <button type="button" className={styles.tbBtn} onClick={exportJson}>
          Export to JSON
        </button>
        <span className={styles.spacer} />
        <select
          className={styles.select}
          style={{ maxWidth: 180 }}
          value={sortKey}
          onChange={(e) => sortBy(e.target.value as keyof PpPolicy)}
          aria-label="Sort policies by"
        >
          <option value="name">Sort: Name</option>
          <option value="type">Sort: Type</option>
          <option value="status">Sort: Status</option>
          <option value="scope">Sort: Scope</option>
          <option value="modified">Sort: Last modified</option>
        </select>
        <input
          className={styles.input}
          style={{ maxWidth: 240 }}
          placeholder="Search policies"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState message='No policies match your filter. Click "+ New policy" to create one.' />
      ) : (
        <DataTable<PpPolicy> columns={columns} rows={rows} getRowKey={(p) => p.id} onRowClick={(p) => setFlyoutId(p.id)} />
      )}

      <div className={styles.card} style={{ marginTop: 14, background: "#faf9f8" }}>
        <div className={styles.cardTitle}>How data policies work</div>
        <div className={styles.muted} style={{ fontSize: 13, lineHeight: 1.5 }}>
          A data policy classifies every connector into <strong>Business</strong>, <strong>Non-business</strong> or <strong>Blocked</strong>. Apps
          and flows are only allowed to share data <em>within</em> a category, never across them. Blocked connectors cannot be used at all. After
          publishing, any existing app or flow that mixes categories is automatically <strong>disabled</strong> until remediated.
        </div>
      </div>

      {flyPolicy ? (
        <PolicyDetailFlyout
          policy={flyPolicy}
          state={state}
          onClose={() => setFlyoutId(null)}
          onToggleStatus={() => toggleStatus(flyPolicy)}
          onDelete={() => requestDelete(flyPolicy)}
        />
      ) : null}

      {deleteTarget ? (
        <Modal
          title="Delete policy"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnDanger} onClick={confirmDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete the policy <strong>{deleteTarget.name}</strong>? Apps and flows that depend on it may start being allowed again.
          </p>
        </Modal>
      ) : null}

      {wizardOpen ? <NewPolicyWizard state={state} dispatch={dispatch} onClose={() => setWizardOpen(false)} /> : null}
    </div>
  );
}

// ===================================================================
// Detail flyout
// ===================================================================

function ConnectorTagList({ ids, connectors }: { ids: string[]; connectors: PpConnector[] }) {
  if (!ids.length) {
    return <div className={styles.muted} style={{ fontSize: 12, padding: 8 }}>Empty</div>;
  }
  return (
    <div style={{ maxHeight: 380, overflow: "auto" }}>
      {ids.map((cid) => {
        const c = connectors.find((x) => x.id === cid);
        const name = c ? c.name : cid;
        return (
          <div key={cid} className={styles.connItem}>
            <span className={styles.connIcon}>{connectorAbbr(name)}</span>
            <span>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

function PolicyDetailFlyout({
  policy,
  state,
  onClose,
  onToggleStatus,
  onDelete,
}: {
  policy: PpPolicy;
  state: PpState;
  onClose: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  function envName(id: string): string {
    return state.environments.find((e) => e.id === id)?.name ?? id;
  }

  let envList = "";
  if (policy.scope === "Specific environments" && policy.envIds.length) {
    envList = policy.envIds.map(envName).join(", ");
  } else if (policy.scope === "All except specific" && policy.exceptionEnvs.length) {
    envList = `except: ${policy.exceptionEnvs.map(envName).join(", ")}`;
  }

  const affectedApps = state.apps.filter(
    (a) => policyAppliesToEnv(policy, a.envId) && conflictsUnderPolicy(a.connectors, policy, state.connectors),
  );
  const affectedFlows = state.flows.filter(
    (f) => policyAppliesToEnv(policy, f.envId) && conflictsUnderPolicy(f.connectors, policy, state.connectors),
  );

  return (
    <Flyout
      title={policy.name}
      subtitle={
        <>
          {policy.type} &middot; {scopeLabel(policy)}
          {envList ? <> &middot; {envList}</> : null}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btnOutline} onClick={onToggleStatus}>
            {policy.status === "On" ? "Turn off" : "Turn on"}
          </button>
          <button type="button" className={styles.btnDanger} onClick={onDelete}>
            Delete
          </button>
        </>
      }
    >
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        {policy.description}
      </div>

      <div className={styles.dlpBoard}>
        <div className={`${styles.dlpCol} ${styles.dlpColBusiness}`}>
          <h3>Business ({policy.business.length})</h3>
          <ConnectorTagList ids={policy.business} connectors={state.connectors} />
        </div>
        <div className={`${styles.dlpCol} ${styles.dlpColNonbusiness}`}>
          <h3>Non-business ({policy.nonBusiness.length})</h3>
          <ConnectorTagList ids={policy.nonBusiness} connectors={state.connectors} />
        </div>
        <div className={`${styles.dlpCol} ${styles.dlpColBlocked}`}>
          <h3>Blocked ({policy.blocked.length})</h3>
          <ConnectorTagList ids={policy.blocked} connectors={state.connectors} />
        </div>
      </div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Custom rules
      </div>
      <div className={styles.reviewGrid}>
        <div className={styles.lbl}>Block patterns</div>
        <div>{policy.customRules.blockPatterns.length ? policy.customRules.blockPatterns.join(", ") : <span className={styles.muted}>None</span>}</div>
        <div className={styles.lbl}>Allow patterns</div>
        <div>{policy.customRules.allowPatterns.length ? policy.customRules.allowPatterns.join(", ") : <span className={styles.muted}>None</span>}</div>
      </div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Affected apps/flows ({affectedApps.length + affectedFlows.length})
      </div>
      {affectedApps.length === 0 && affectedFlows.length === 0 ? (
        <div className={styles.muted} style={{ fontSize: 12 }}>
          No apps or flows currently conflict with this policy.
        </div>
      ) : (
        <div>
          {affectedApps.map((a) => (
            <div key={a.id} className={styles.connItem}>
              <StatusPill tone="err">App</StatusPill>
              <span>{a.name}</span>
              <span className={styles.muted} style={{ marginLeft: "auto", fontSize: 11 }}>
                {a.dlpFlagReason}
              </span>
            </div>
          ))}
          {affectedFlows.map((f) => (
            <div key={f.id} className={styles.connItem}>
              <StatusPill tone="err">Flow</StatusPill>
              <span>{f.name}</span>
              <span className={styles.muted} style={{ marginLeft: "auto", fontSize: 11 }}>
                {f.dlpFlagReason}
              </span>
            </div>
          ))}
        </div>
      )}
    </Flyout>
  );
}

// ===================================================================
// Create wizard — 5 steps
// ===================================================================

function NewPolicyWizard({ state, dispatch, onClose }: { state: PpState; dispatch: React.Dispatch<PpAction>; onClose: () => void }) {
  const defaults = useMemo(() => buildDefaultBuckets(state.connectors), [state.connectors]);

  const [step, setStep] = useState<WizardStepId>("general");
  const [connSearch, setConnSearch] = useState("");
  const [draft, setDraft] = useState<WizardDraft>({
    name: "",
    description: "",
    business: defaults.business,
    nonBusiness: defaults.nonBusiness,
    blocked: defaults.blocked,
    blockPatterns: "",
    allowPatterns: "",
    scope: "Everyone",
    envIds: [],
    exceptionEnvs: [],
  });

  const stepIdx = WIZ_STEPS.findIndex((s) => s.id === step);

  function goTo(id: WizardStepId) {
    setStep(id);
  }

  function goNext() {
    if (step === "general" && !draft.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    if (stepIdx < WIZ_STEPS.length - 1) setStep(WIZ_STEPS[stepIdx + 1].id);
  }

  function goPrev() {
    if (stepIdx > 0) setStep(WIZ_STEPS[stepIdx - 1].id);
  }

  function moveConn(cid: string, target: "business" | "nonBusiness" | "blocked") {
    setDraft((d) => {
      const business = d.business.filter((x) => x !== cid);
      const nonBusiness = d.nonBusiness.filter((x) => x !== cid);
      const blocked = d.blocked.filter((x) => x !== cid);
      if (target === "business") business.push(cid);
      if (target === "nonBusiness") nonBusiness.push(cid);
      if (target === "blocked") blocked.push(cid);
      return { ...d, business, nonBusiness, blocked };
    });
  }

  function finish() {
    if (!draft.name.trim()) {
      toast.warning("Name is required.");
      setStep("general");
      return;
    }
    const policy: PpPolicy = {
      id: `dlp-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      description: draft.description.trim(),
      type: "Custom",
      status: "On",
      scope: draft.scope,
      envIds: draft.envIds.slice(),
      exceptionEnvs: draft.exceptionEnvs.slice(),
      createdBy: "admin@itbd.net",
      modified: new Date().toISOString(),
      business: draft.business.slice(),
      nonBusiness: draft.nonBusiness.slice(),
      blocked: draft.blocked.slice(),
      customRules: {
        blockPatterns: parsePatterns(draft.blockPatterns),
        allowPatterns: parsePatterns(draft.allowPatterns),
      },
    };
    dispatch({ type: "ADD_POLICY", policy });
    toast.success(`Policy "${policy.name}" created.`);
    onClose();
  }

  return (
    <Modal
      title="+ New data policy"
      onClose={onClose}
      width="980px"
      steps={WIZ_STEPS.map((s, i) => (
        <WizStep key={s.id} label={s.label} active={s.id === step} done={i < stepIdx} onClick={() => goTo(s.id)} />
      ))}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <span className={styles.spacer} />
          {stepIdx > 0 ? (
            <button type="button" className={styles.btnOutline} onClick={goPrev}>
              Back
            </button>
          ) : null}
          {step === "review" ? (
            <button type="button" className={styles.btn} onClick={finish}>
              Create policy
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={goNext}>
              Next
            </button>
          )}
        </>
      }
    >
      {step === "general" ? (
        <WizGeneralStep draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
      ) : null}
      {step === "connectors" ? (
        <WizConnectorsStep connectors={state.connectors} draft={draft} search={connSearch} onSearch={setConnSearch} onMove={moveConn} />
      ) : null}
      {step === "custom" ? <WizCustomStep draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} /> : null}
      {step === "scope" ? <WizScopeStep state={state} draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} /> : null}
      {step === "review" ? <WizReviewStep state={state} draft={draft} /> : null}
    </Modal>
  );
}

function WizGeneralStep({ draft, onChange }: { draft: WizardDraft; onChange: (patch: Partial<WizardDraft>) => void }) {
  return (
    <>
      <Field label="Name *">
        <input
          className={styles.input}
          placeholder="e.g. Production — Strict"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <textarea
          className={styles.textarea}
          placeholder="Describe what this policy is for"
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
    </>
  );
}

function WizConnectorsStep({
  connectors,
  draft,
  search,
  onSearch,
  onMove,
}: {
  connectors: PpConnector[];
  draft: WizardDraft;
  search: string;
  onSearch: (v: string) => void;
  onMove: (cid: string, target: "business" | "nonBusiness" | "blocked") => void;
}) {
  function bucketFor(ids: string[], target: "business" | "nonBusiness" | "blocked") {
    const set = new Set(ids);
    const items = connectors.filter((c) => set.has(c.id) && (!search || c.name.toLowerCase().includes(search.toLowerCase())));
    if (!items.length) {
      return (
        <div className={styles.muted} style={{ fontSize: 12, padding: 8 }}>
          No connectors here.
        </div>
      );
    }
    return items.map((c) => (
      <div key={c.id} className={styles.connItem}>
        <span className={styles.connIcon}>{connectorAbbr(c.name)}</span>
        <span title={c.publisher}>
          {c.name}
          {c.premium ? (
            <>
              {" "}
              &middot; <span className={styles.muted}>Premium</span>
            </>
          ) : null}
        </span>
        <span className={styles.connActions}>
          {target !== "business" ? (
            <button type="button" title="Move to Business" onClick={() => onMove(c.id, "business")}>
              B
            </button>
          ) : null}
          {target !== "nonBusiness" ? (
            <button type="button" title="Move to Non-business" onClick={() => onMove(c.id, "nonBusiness")}>
              N
            </button>
          ) : null}
          {target !== "blocked" ? (
            <button type="button" title="Move to Blocked" onClick={() => onMove(c.id, "blocked")}>
              X
            </button>
          ) : null}
        </span>
      </div>
    ));
  }

  return (
    <div>
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        Click the B / N / X buttons below a connector to move it into another category.
      </div>
      <input
        className={styles.input}
        placeholder="Search connectors"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{ maxWidth: 340, marginBottom: 8 }}
      />
      <div className={styles.dlpBoard}>
        <div className={`${styles.dlpCol} ${styles.dlpColBusiness}`}>
          <h3>Business ({draft.business.length})</h3>
          <div style={{ maxHeight: 380, overflow: "auto" }}>{bucketFor(draft.business, "business")}</div>
        </div>
        <div className={`${styles.dlpCol} ${styles.dlpColNonbusiness}`}>
          <h3>Non-business ({draft.nonBusiness.length})</h3>
          <div style={{ maxHeight: 380, overflow: "auto" }}>{bucketFor(draft.nonBusiness, "nonBusiness")}</div>
        </div>
        <div className={`${styles.dlpCol} ${styles.dlpColBlocked}`}>
          <h3>Blocked ({draft.blocked.length})</h3>
          <div style={{ maxHeight: 380, overflow: "auto" }}>{bucketFor(draft.blocked, "blocked")}</div>
        </div>
      </div>
    </div>
  );
}

function WizCustomStep({ draft, onChange }: { draft: WizardDraft; onChange: (patch: Partial<WizardDraft>) => void }) {
  return (
    <>
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        Restrict or permit specific custom connectors by URL pattern or connector ID. Patterns support wildcards (*).
      </div>
      <Field label="Block patterns (one per line or comma-separated)">
        <textarea
          className={styles.textarea}
          placeholder={"*.untrusted.com\n*chatgpt*"}
          value={draft.blockPatterns}
          onChange={(e) => onChange({ blockPatterns: e.target.value })}
        />
      </Field>
      <Field label="Allow patterns">
        <textarea
          className={styles.textarea}
          placeholder={"*.cloudlab.in\ncorp-api-*"}
          value={draft.allowPatterns}
          onChange={(e) => onChange({ allowPatterns: e.target.value })}
        />
      </Field>
    </>
  );
}

function WizScopeStep({ state, draft, onChange }: { state: PpState; draft: WizardDraft; onChange: (patch: Partial<WizardDraft>) => void }) {
  function toggleEnvPick(id: string, checked: boolean) {
    onChange({ envIds: checked ? [...draft.envIds, id] : draft.envIds.filter((x) => x !== id) });
  }
  function toggleEnvExc(id: string, checked: boolean) {
    onChange({ exceptionEnvs: checked ? [...draft.exceptionEnvs, id] : draft.exceptionEnvs.filter((x) => x !== id) });
  }

  return (
    <>
      <label className={styles.radioRow} style={{ border: "1px solid #edebe9", borderRadius: 4, padding: 10, marginBottom: 6 }}>
        <input type="radio" name="dlpScope" checked={draft.scope === "Everyone"} onChange={() => onChange({ scope: "Everyone" })} />
        <div>
          <strong>Add all environments</strong>
          <div className={styles.muted} style={{ fontSize: 12 }}>
            Apply this policy to every environment in the tenant.
          </div>
        </div>
      </label>

      <label className={styles.radioRow} style={{ border: "1px solid #edebe9", borderRadius: 4, padding: 10, marginBottom: 6 }}>
        <input
          type="radio"
          name="dlpScope"
          checked={draft.scope === "Specific environments"}
          onChange={() => onChange({ scope: "Specific environments" })}
        />
        <div>
          <strong>Add multiple environments</strong>
          <div className={styles.muted} style={{ fontSize: 12 }}>
            Pick environments to apply this policy to.
          </div>
        </div>
      </label>
      <div style={{ marginLeft: 24, marginBottom: 10 }}>
        {state.environments.map((e) => (
          <Checkbox
            key={e.id}
            label={`${e.name} (${e.type})`}
            checked={draft.envIds.includes(e.id)}
            onChange={(checked) => toggleEnvPick(e.id, checked)}
          />
        ))}
      </div>

      <label className={styles.radioRow} style={{ border: "1px solid #edebe9", borderRadius: 4, padding: 10, marginBottom: 6 }}>
        <input
          type="radio"
          name="dlpScope"
          checked={draft.scope === "All except specific"}
          onChange={() => onChange({ scope: "All except specific" })}
        />
        <div>
          <strong>Exclude environments</strong>
          <div className={styles.muted} style={{ fontSize: 12 }}>
            Apply to all environments except those you select below.
          </div>
        </div>
      </label>
      <div style={{ marginLeft: 24 }}>
        {state.environments.map((e) => (
          <Checkbox
            key={e.id}
            label={`${e.name} (${e.type})`}
            checked={draft.exceptionEnvs.includes(e.id)}
            onChange={(checked) => toggleEnvExc(e.id, checked)}
          />
        ))}
      </div>
    </>
  );
}

function WizReviewStep({ state, draft }: { state: PpState; draft: WizardDraft }) {
  function envName(id: string): string {
    return state.environments.find((e) => e.id === id)?.name ?? id;
  }

  const blockPatterns = parsePatterns(draft.blockPatterns);
  const allowPatterns = parsePatterns(draft.allowPatterns);

  const envsSummary =
    draft.scope === "Specific environments"
      ? draft.envIds.map(envName).join(", ") || "None selected"
      : draft.scope === "All except specific"
        ? `all except: ${draft.exceptionEnvs.map(envName).join(", ") || "none"}`
        : "All";

  const rows: [string, React.ReactNode][] = [
    ["Name", draft.name || "-"],
    ["Description", draft.description || "-"],
    ["Business", `${draft.business.length} connector(s)`],
    ["Non-business", `${draft.nonBusiness.length} connector(s)`],
    ["Blocked", `${draft.blocked.length} connector(s)`],
    ["Block patterns", blockPatterns.length ? blockPatterns.join(", ") : "None"],
    ["Allow patterns", allowPatterns.length ? allowPatterns.join(", ") : "None"],
    ["Scope", draft.scope],
    ["Environments", envsSummary],
  ];

  return (
    <div>
      <div className={styles.h3}>Review and finish</div>
      <div className={styles.reviewGrid}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <div className={styles.lbl}>{label}</div>
            <div>{value}</div>
          </div>
        ))}
      </div>
      <div className={styles.card} style={{ background: "#fff4ce", borderColor: "#f5e0a3", marginTop: 12 }}>
        <strong>Heads up.</strong> After publishing, flows and apps that mix data across these categories will be <strong>disabled</strong> until
        the maker remediates them.
      </div>
    </div>
  );
}
