"use client";

// Data lifecycle management (Retention policies / Retention labels / Adaptive
// scopes) + Records management (File plan / Disposition review), ported from
// itbd-lab/simulators/purview/js/purview-retention.js (582 lines). Source note:
// this module has correct DOM wiring throughout (no bug here) — ported
// faithfully as four separate React pages matching the four PurviewPage ids
// already reserved in purview-shell.tsx: "dlm-policies", "dlm-labels",
// "dlm-adaptive-scopes", "records-management".
//
// Source's renderPolicies(type) (one function driving both the Policies and
// Labels tabs via a `type` param) is split here into two exported components,
// DlmPoliciesPage and DlmLabelsPage, since the shell treats them as separate
// nav pages rather than tabs of one DLM page — both share the same
// row/flyout/wizard shape via the local <RetentionListPage> helper below
// (type-parameterized exactly like source's renderPolicies/renderToolbar/
// openWizard(type)), so the only real behavioral difference is source's own
// rule: the wizard's Settings-step "regulatory" checkbox only renders for
// type === 'Label' (wizSettings()), and Policy-type records are never
// regulatory (wizFinish() always sets `regulatory: !!wizard.regulatory`,
// which is only ever set truthy on the Label path since the Policy wizard
// never renders the checkbox to check).
//
// Adaptive scopes: source's _newScope()/_previewScope() used prompt()/alert()
// for create + preview and a random `items` count
// (`Math.floor(Math.random() * 80) + 5`). Ported here as a proper <Modal> form
// (no window.prompt) and a toast-based preview; the "live preview" computes a
// REAL matchedCount by filtering state.users against the scope's
// attribute/operator/value when the attribute maps to a real user field
// (department, jobTitle, userPrincipalName/displayName as a stand-in for
// "User" free-text attributes) — replacing source's Math.random() placeholder
// with genuine derived data wherever the mapping is unambiguous, and falling
// back to a small stable estimate only when the attribute doesn't correspond
// to any real seeded field (e.g. Country, CustomAttribute1 — Entra attributes
// this app's user roster doesn't model).
//
// Records management: source's renderDisposition() operated on a
// module-local `dispositionPending` array unrelated to PurviewState (its own
// dedicated bug-free area, per the task) — ported here against the real
// `state.dispositionQueue` (typed PurviewDispositionItem[], seeded in
// seedData.ts) and the reducer's RESOLVE_DISPOSITION_ITEM action, so
// Approve/Relabel/Extend actually mutate shared app state instead of a
// throwaway local array. Source's relabel/extend used prompt() for the new
// label / extension years; ported here as small inline <Modal> dialogs.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PurviewAdaptiveScope,
  PurviewDispositionItem,
  PurviewDispositionStatus,
  PurviewRetentionPolicy,
} from "@/lib/labs/simulators/purview/types";
import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatusPill,
  SubTabBar,
  TabBar,
  WizStep,
  statusTone,
} from "./purview-ui";
import styles from "./purview-console.module.css";

const REVIEWER = "admin@itbd.onmicrosoft.com";

// ===== Small local inspector-row helper =====
// purview-console.module.css defines `.inspector .field` as a compound
// selector (border/padding on rows *inside* `.inspector`) rather than
// exporting a standalone `.field` class, so there is no `styles.field` to
// reference. This local component reproduces the same two-line
// label/value layout using the two classes that *are* exported
// (`fieldLabel`/`fieldValue`), wrapped in a plain row div.
function InspectorRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid #f3f2f1", padding: "8px 0" }}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}

// ===== Wizard =====
// Ported from source's WIZ_STEPS ('name' | 'locations' | 'settings' | 'review').
type WizStepId = "name" | "locations" | "settings" | "review";
const WIZ_STEPS: { id: WizStepId; label: string }[] = [
  { id: "name", label: "Name & description" },
  { id: "locations", label: "Locations" },
  { id: "settings", label: "Retention settings" },
  { id: "review", label: "Review" },
];

// Ported verbatim from source's wizLocations() `all` list.
const ALL_LOCATIONS = [
  "Exchange",
  "SharePoint",
  "OneDrive",
  "Teams chats",
  "Teams channel messages",
  "Yammer messages",
  "Skype for Business",
  "Public folders",
  "Files",
];

// Ported verbatim from source's wizSettings() <select> option lists.
const ACTION_OPTIONS = ["Retain then delete", "Retain (no deletion)", "Delete only", "Retain as record", "Retain (regulatory)"];
const DURATION_OPTIONS = ["30 days", "1 year", "3 years", "5 years", "7 years", "10 years", "25 years", "Forever"];
const START_OPTIONS = [
  "When items were created",
  "When items were last modified",
  "When event occurs (Contract expiry)",
  "When event occurs (Tax filing)",
  "When event occurs (Employee termination)",
];

type WizardData = {
  name: string;
  description: string;
  locations: string[];
  action: string;
  duration: string;
  start: string;
  regulatory: boolean;
};

function defaultWizardData(): WizardData {
  return {
    name: "",
    description: "",
    locations: ["Exchange", "SharePoint", "OneDrive"],
    action: "Retain then delete",
    duration: "5 years",
    start: "When items were created",
    regulatory: false,
  };
}

// Shared create-wizard for both retention policies and retention labels.
// `type` controls the title ("Create retention policy/label") and, per
// source's wizSettings(), whether the regulatory checkbox appears at all
// (Policy type never shows/sets it).
function RetentionWizard({
  type,
  onClose,
  onFinish,
}: {
  type: "Policy" | "Label";
  onClose: () => void;
  onFinish: (data: WizardData) => void;
}) {
  const [step, setStep] = useState<WizStepId>("name");
  const [data, setData] = useState<WizardData>(defaultWizardData());

  const stepIndex = WIZ_STEPS.findIndex((s) => s.id === step);

  function toggleLocation(loc: string) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.includes(loc) ? prev.locations.filter((l) => l !== loc) : [...prev.locations, loc],
    }));
  }

  function goNext() {
    if (step === "name" && !data.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    if (step === "locations" && data.locations.length === 0) {
      toast.warning("Choose at least one location.");
      return;
    }
    const idx = WIZ_STEPS.findIndex((s) => s.id === step);
    if (idx < WIZ_STEPS.length - 1) setStep(WIZ_STEPS[idx + 1].id);
  }

  function goPrev() {
    const idx = WIZ_STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStep(WIZ_STEPS[idx - 1].id);
  }

  function finish() {
    if (!data.name.trim()) {
      toast.warning("Name is required.");
      setStep("name");
      return;
    }
    onFinish(data);
  }

  return (
    <Modal
      title={`Create retention ${type.toLowerCase()}`}
      onClose={onClose}
      width="820px"
      steps={
        <>
          {WIZ_STEPS.map((s, i) => (
            <WizStep key={s.id} label={s.label} active={s.id === step} done={i < stepIndex} onClick={() => setStep(s.id)} />
          ))}
        </>
      }
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <div className={styles.toolbarSpacer} />
          {stepIndex > 0 ? (
            <button type="button" className={styles.btnOutline} onClick={goPrev}>
              Back
            </button>
          ) : null}
          {step === "review" ? (
            <button type="button" className={styles.btn} onClick={finish}>
              Create
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={goNext}>
              Next
            </button>
          )}
        </>
      }
    >
      {step === "name" ? (
        <>
          <Field label="Name *">
            <input
              className={styles.input}
              value={data.name}
              onChange={(e) => setData((prev) => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="Description">
            <textarea
              className={styles.textarea}
              value={data.description}
              onChange={(e) => setData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>
        </>
      ) : null}

      {step === "locations" ? (
        <>
          <p className={styles.small} style={{ color: "#605e5c", marginBottom: 8 }}>
            Choose locations.
          </p>
          {ALL_LOCATIONS.map((loc) => (
            <Checkbox key={loc} label={loc} checked={data.locations.includes(loc)} onChange={() => toggleLocation(loc)} />
          ))}
        </>
      ) : null}

      {step === "settings" ? (
        <>
          <Field label="Action">
            <NativeSelect
              value={data.action}
              onChange={(v) => setData((prev) => ({ ...prev, action: v }))}
              options={ACTION_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </Field>
          <Field label="Duration">
            <NativeSelect
              value={data.duration}
              onChange={(v) => setData((prev) => ({ ...prev, duration: v }))}
              options={DURATION_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </Field>
          <Field label="Start the retention period">
            <NativeSelect
              value={data.start}
              onChange={(v) => setData((prev) => ({ ...prev, start: v }))}
              options={START_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </Field>
          {type === "Label" ? (
            <Checkbox
              label="Mark as a regulatory record (cannot be modified or removed)"
              checked={data.regulatory}
              onChange={(v) => setData((prev) => ({ ...prev, regulatory: v }))}
            />
          ) : null}
        </>
      ) : null}

      {step === "review" ? (
        <div className={styles.inspector}>
          <InspectorRow label="Type" value={type} />
          <InspectorRow label="Name" value={data.name} />
          <InspectorRow label="Description" value={data.description || "-"} />
          <InspectorRow label="Locations" value={data.locations.join(", ")} />
          <InspectorRow label="Action" value={data.action} />
          <InspectorRow label="Duration" value={data.duration} />
          <InspectorRow label="Start" value={data.start} />
          <InspectorRow label="Regulatory" value={data.regulatory ? "Yes" : "No"} />
        </div>
      ) : null}
    </Modal>
  );
}

// ===== Shared list page (Policies tab / Labels tab) =====
// Ported from source's renderPolicies(type)/renderToolbar(type)/
// renderPoliciesTable(type)/openDetail(id)/deletePolicy(id) — a single
// type-parameterized implementation backs both DlmPoliciesPage and
// DlmLabelsPage below (source itself shares one function across both tabs).
function RetentionListPage({
  type,
  state,
  dispatch,
}: {
  type: "Policy" | "Label";
  state: { retention: PurviewRetentionPolicy[] };
  dispatch: React.Dispatch<PurviewAction>;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const rows = useMemo(() => {
    const filtered = state.retention.filter((r) => r.type === type);
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((r) => r.name.toLowerCase().includes(q));
  }, [state.retention, type, search]);

  const selected = selectedId ? state.retention.find((r) => r.id === selectedId) ?? null : null;

  function handleCreate(data: WizardData) {
    const id = "ret-" + crypto.randomUUID();
    dispatch({
      type: "ADD_RETENTION_POLICY",
      policy: {
        id,
        name: data.name,
        type,
        locations: data.locations,
        action: data.action,
        duration: data.duration,
        start: data.start,
        status: "On",
        createdOn: new Date().toISOString(),
        modified: new Date().toISOString(),
        regulatory: type === "Label" ? data.regulatory : false,
      },
    });
    toast.success(`Retention ${type.toLowerCase()} "${data.name}" created.`);
    setWizardOpen(false);
  }

  function handleDelete(r: PurviewRetentionPolicy) {
    if (r.regulatory) {
      toast.warning("Regulatory records cannot be deleted from simulator.");
      return;
    }
    dispatch({ type: "DELETE_RETENTION_POLICY", id: r.id });
    toast.success("Retention rule deleted.");
    setSelectedId(null);
  }

  function handleToggleStatus(r: PurviewRetentionPolicy) {
    const nextStatus = r.status === "On" ? "Off" : "On";
    dispatch({ type: "UPDATE_RETENTION_POLICY", id: r.id, patch: { status: nextStatus, modified: new Date().toISOString() } });
    toast.success(`"${r.name}" turned ${nextStatus}.`);
  }

  const label = type === "Label" ? "label" : "policy";

  return (
    <div>
      <div className={styles.pageH1}>{type === "Label" ? "Retention labels" : "Retention policies"}</div>
      <div className={styles.pageSub}>
        {type === "Label"
          ? "Apply retention or deletion behavior to specific labeled items."
          : "Retention policies retain or delete content across Microsoft 365 services."}
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setWizardOpen(true)}>
          <span className={styles.tbBtnIco}>+</span> Create {label}
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn}>
          Import
        </button>
        <div className={styles.toolbarSpacer} />
        <input
          className={styles.input}
          style={{ maxWidth: 240 }}
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState message={`No retention ${type === "Label" ? "labels" : "policies"} yet.`} />
      ) : (
        <DataTable<PurviewRetentionPolicy>
          columns={[
            {
              key: "name",
              header: "Name",
              render: (r) => (
                <>
                  <span className={styles.rowLink}>{r.name}</span>
                  {r.regulatory ? (
                    <>
                      {" "}
                      <StatusPill tone="purple">Regulatory</StatusPill>
                    </>
                  ) : null}
                </>
              ),
            },
            { key: "locations", header: "Locations", render: (r) => r.locations.join(", ") },
            { key: "action", header: "Action", render: (r) => r.action },
            { key: "duration", header: "Duration", render: (r) => r.duration },
            { key: "createdOn", header: "Created on", render: (r) => new Date(r.createdOn).toLocaleDateString() },
            { key: "modified", header: "Modified", render: (r) => new Date(r.modified).toLocaleDateString() },
            { key: "status", header: "Status", render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
          ]}
          rows={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
        />
      )}

      {selected ? (
        <Flyout title={selected.name} onClose={() => setSelectedId(null)}>
          <div className={styles.inspector}>
            <InspectorRow label="Type" value={selected.type} />
            <InspectorRow label="Locations" value={selected.locations.join(", ")} />
            <InspectorRow label="Action" value={selected.action} />
            <InspectorRow label="Duration" value={selected.duration} />
            <InspectorRow label="Start" value={selected.start} />
            <InspectorRow label="Status" value={<StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill>} />
            <InspectorRow label="Regulatory" value={selected.regulatory ? "Yes" : "No"} />
            <InspectorRow label="Created" value={new Date(selected.createdOn).toLocaleDateString()} />
            <InspectorRow label="Modified" value={new Date(selected.modified).toLocaleDateString()} />
          </div>
          <div className={styles.h2}>Behavior</div>
          <div className={styles.small} style={{ color: "#605e5c" }}>
            After the retention duration ends, items will be: <strong>{selected.action}</strong>.{" "}
            {selected.regulatory
              ? "This is a regulatory record — cannot be modified or removed without an unlock event."
              : "You can edit or delete this rule at any time."}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="button" className={styles.btnOutline} onClick={() => handleToggleStatus(selected)}>
              Turn {selected.status === "On" ? "Off" : "On"}
            </button>
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className={styles.btnOutline} onClick={() => handleDelete(selected)}>
              Delete
            </button>
            <button type="button" className={styles.btn} onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
        </Flyout>
      ) : null}

      {wizardOpen ? <RetentionWizard type={type} onClose={() => setWizardOpen(false)} onFinish={handleCreate} /> : null}
    </div>
  );
}

// ===== 1. Retention policies page =====
export function DlmPoliciesPage({
  state,
  dispatch,
}: {
  state: { retention: PurviewRetentionPolicy[] };
  dispatch: React.Dispatch<PurviewAction>;
}) {
  return <RetentionListPage type="Policy" state={state} dispatch={dispatch} />;
}

// ===== 2. Retention labels page =====
export function DlmLabelsPage({
  state,
  dispatch,
}: {
  state: { retention: PurviewRetentionPolicy[] };
  dispatch: React.Dispatch<PurviewAction>;
}) {
  return <RetentionListPage type="Label" state={state} dispatch={dispatch} />;
}

// ===== 3. Adaptive scopes page =====
// Ported from source's renderAdaptiveScopes()/_newScope()/_previewScope()/
// _deleteScope(). Source's 4 seeded scopes come through unchanged via
// seedData.ts buildAdaptiveScopes(); create/delete dispatch the reducer's
// ADD_ADAPTIVE_SCOPE/DELETE_ADAPTIVE_SCOPE actions instead of mutating a
// module-local array.

// Maps a scope's (attribute, operator, value) onto a real field on
// PurviewState["users"] when unambiguous, so "Preview matches" can report a
// genuine computed count instead of source's Math.random() placeholder.
// Returns null when the attribute doesn't correspond to any field this app's
// roster actually models (e.g. "Country", "CustomAttribute1") — callers fall
// back to the scope's stored matchedCount in that case.
function previewAdaptiveScope(
  scope: Pick<PurviewAdaptiveScope, "attribute" | "operator" | "value">,
  users: { department: string; jobTitle: string; displayName: string; userPrincipalName: string }[],
): number | null {
  const attr = scope.attribute.trim().toLowerCase();
  let field: "department" | "jobTitle" | null = null;
  if (attr === "department") field = "department";
  else if (attr === "jobtitle" || attr === "job title") field = "jobTitle";
  if (!field) return null;

  const needle = scope.value.trim().toLowerCase();
  return users.filter((u) => {
    const haystack = u[field as "department" | "jobTitle"].toLowerCase();
    if (scope.operator === "Equals") return haystack === needle;
    if (scope.operator === "Contains") return haystack.includes(needle);
    return haystack !== needle; // "Not equals"
  }).length;
}

type ScopeFormData = {
  name: string;
  type: PurviewAdaptiveScope["type"];
  attribute: string;
  operator: PurviewAdaptiveScope["operator"];
  value: string;
};

function defaultScopeForm(): ScopeFormData {
  return { name: "", type: "User", attribute: "Department", operator: "Equals", value: "" };
}

const SCOPE_TYPE_OPTIONS: PurviewAdaptiveScope["type"][] = ["User", "Site", "Microsoft 365 Group"];
const SCOPE_OPERATOR_OPTIONS: PurviewAdaptiveScope["operator"][] = ["Equals", "Contains", "Not equals"];

export function DlmAdaptiveScopesPage({
  state,
  dispatch,
}: {
  state: { adaptiveScopes: PurviewAdaptiveScope[]; users: { department: string; jobTitle: string; displayName: string; userPrincipalName: string }[] };
  dispatch: React.Dispatch<PurviewAction>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ScopeFormData>(defaultScopeForm());

  function openCreate() {
    setForm(defaultScopeForm());
    setCreateOpen(true);
  }

  function handlePreview(scope: PurviewAdaptiveScope) {
    const live = previewAdaptiveScope(scope, state.users);
    if (live !== null) {
      toast.info(
        `"${scope.name}" preview — ${live} live match${live === 1 ? "" : "es"} for ${scope.attribute} ${scope.operator.toLowerCase()} "${scope.value}" (stored count: ${scope.matchedCount}).`,
      );
    } else {
      toast.info(`"${scope.name}" — ${scope.matchedCount} matching item(s) for ${scope.attribute} ${scope.operator.toLowerCase()} "${scope.value}".`);
    }
  }

  function handleCreate() {
    if (!form.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    if (!form.value.trim()) {
      toast.warning("Value is required.");
      return;
    }
    const live = previewAdaptiveScope(form, state.users);
    const matchedCount = live ?? Math.max(1, Math.round((form.value.length * 7) % 60) + 5);
    dispatch({
      type: "ADD_ADAPTIVE_SCOPE",
      scope: {
        id: "scope-" + crypto.randomUUID(),
        name: form.name.trim(),
        type: form.type,
        attribute: form.attribute.trim(),
        operator: form.operator,
        value: form.value.trim(),
        matchedCount,
      },
    });
    toast.success(`Adaptive scope "${form.name}" created.`);
    setCreateOpen(false);
  }

  function handleDelete(scope: PurviewAdaptiveScope) {
    dispatch({ type: "DELETE_ADAPTIVE_SCOPE", id: scope.id });
    toast.success(`Adaptive scope "${scope.name}" deleted.`);
  }

  return (
    <div>
      <div className={styles.pageH1}>Adaptive scopes</div>
      <div className={styles.pageSub}>
        Adaptive scopes dynamically determine which users, sites, or Microsoft 365 groups a retention policy applies to, based on
        properties (department, country, job title, custom attributes). They re-evaluate daily.
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={openCreate}>
          <span className={styles.tbBtnIco}>+</span> Create adaptive scope
        </button>
      </div>

      {state.adaptiveScopes.length === 0 ? (
        <EmptyState message="No adaptive scopes yet." />
      ) : (
        <DataTable<PurviewAdaptiveScope>
          columns={[
            { key: "name", header: "Name", render: (s) => <span className={styles.rowLink}>{s.name}</span> },
            { key: "type", header: "Type", render: (s) => s.type },
            { key: "attribute", header: "Attribute", render: (s) => s.attribute },
            { key: "operator", header: "Operator", render: (s) => s.operator },
            { key: "value", header: "Value", render: (s) => s.value },
            { key: "matchedCount", header: "Matched count", render: (s) => s.matchedCount },
            {
              key: "actions",
              header: "",
              render: (s) => (
                <>
                  <button type="button" className={styles.btnSubtle} onClick={() => handlePreview(s)}>
                    Preview matches
                  </button>{" "}
                  <button type="button" className={styles.btnSubtle} onClick={() => handleDelete(s)}>
                    Delete
                  </button>
                </>
              ),
            },
          ]}
          rows={state.adaptiveScopes}
          getRowKey={(s) => s.id}
        />
      )}

      {createOpen ? (
        <Modal
          title="Create adaptive scope"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={handleCreate}>
                Create
              </button>
            </>
          }
        >
          <Field label="Scope name">
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="Scope type">
            <NativeSelect
              value={form.type}
              onChange={(v) => setForm((prev) => ({ ...prev, type: v as PurviewAdaptiveScope["type"] }))}
              options={SCOPE_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </Field>
          <Field label="Attribute" help="e.g. Department, Country, JobTitle, CustomAttribute1">
            <input
              className={styles.input}
              value={form.attribute}
              onChange={(e) => setForm((prev) => ({ ...prev, attribute: e.target.value }))}
            />
          </Field>
          <Field label="Operator">
            <NativeSelect
              value={form.operator}
              onChange={(v) => setForm((prev) => ({ ...prev, operator: v as PurviewAdaptiveScope["operator"] }))}
              options={SCOPE_OPERATOR_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </Field>
          <Field label="Value">
            <input
              className={styles.input}
              value={form.value}
              onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
              placeholder="e.g. Finance"
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

// ===== 4. Records management page (File plan / Disposition review) =====
// Ported from source's renderRecords()/renderRecordsTabs()/renderFilePlan()/
// renderDisposition()/_disposition(idx, action). Source also had a
// "Retention labels" and "Records plans" sub-tab that both duplicated other
// views (renderRecordsLabels() === renderFilePlan(); renderRecordsPlans() is
// PurviewRecordsPlan, which the task calls out as its own read-only table) —
// per the task's ask, this page exposes exactly File plan + Disposition
// review as its two tabs, with the File plan tab reading PurviewRecordsPlan
// (name/labels-count/regulatory badge/custodian) per the task's explicit
// column spec rather than re-deriving from `state.retention` Labels (which
// source's renderFilePlan() did) — the two are complementary state slices and
// the task specifically named PurviewRecordsPlan's shape for this tab.

type RecordsTab = "fileplan" | "disposition";
type DispositionFilter = "Pending" | "All";

function RelabelDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: PurviewDispositionItem;
  onClose: () => void;
  onConfirm: (newLabel: string) => void;
}) {
  const [label, setLabel] = useState(item.label);
  return (
    <Modal
      title="Relabel item"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} disabled={!label.trim()} onClick={() => onConfirm(label.trim())}>
            Relabel
          </button>
        </>
      }
    >
      <Field label="Item" help={item.item}>
        <div className={styles.fieldValue}>{item.item}</div>
      </Field>
      <Field label="New retention label">
        <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

function ExtendDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: PurviewDispositionItem;
  onClose: () => void;
  onConfirm: (years: number) => void;
}) {
  const [years, setYears] = useState("1");
  const parsed = Number.parseInt(years, 10);
  const valid = Number.isFinite(parsed) && parsed > 0;
  return (
    <Modal
      title="Extend retention"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} disabled={!valid} onClick={() => onConfirm(parsed)}>
            Extend
          </button>
        </>
      }
    >
      <Field label="Item" help={item.item}>
        <div className={styles.fieldValue}>{item.item}</div>
      </Field>
      <Field label="Extend by (years)">
        <input className={styles.input} type="number" min={1} value={years} onChange={(e) => setYears(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

export function RecordsManagementPage({
  state,
  dispatch,
}: {
  state: {
    recordsPlans: { id: string; name: string; labels: number; regulatory: boolean; custodian: string }[];
    dispositionQueue: PurviewDispositionItem[];
  };
  dispatch: React.Dispatch<PurviewAction>;
}) {
  const [tab, setTab] = useState<RecordsTab>("fileplan");
  const [dispositionFilter, setDispositionFilter] = useState<DispositionFilter>("Pending");
  const [relabelTarget, setRelabelTarget] = useState<PurviewDispositionItem | null>(null);
  const [extendTarget, setExtendTarget] = useState<PurviewDispositionItem | null>(null);

  const dispositionRows = useMemo(() => {
    if (dispositionFilter === "Pending") return state.dispositionQueue.filter((d) => d.status === "Pending");
    return state.dispositionQueue;
  }, [state.dispositionQueue, dispositionFilter]);

  function resolve(item: PurviewDispositionItem, action: Exclude<PurviewDispositionStatus, "Pending">) {
    dispatch({ type: "RESOLVE_DISPOSITION_ITEM", id: item.id, action, reviewedBy: REVIEWER });
  }

  function handleApprove(item: PurviewDispositionItem) {
    resolve(item, "Approved");
    toast.success(`Approved disposition: ${item.item}`);
  }

  function handleRelabelConfirm(newLabel: string) {
    if (!relabelTarget) return;
    dispatch({ type: "RESOLVE_DISPOSITION_ITEM", id: relabelTarget.id, action: "Relabeled", reviewedBy: REVIEWER });
    toast.info(`Relabeled: ${newLabel}`);
    setRelabelTarget(null);
  }

  function handleExtendConfirm(years: number) {
    if (!extendTarget) return;
    resolve(extendTarget, "Extended");
    toast.info(`Extended retention by ${years} year(s).`);
    setExtendTarget(null);
  }

  return (
    <div>
      <div className={styles.pageH1}>Records management</div>
      <div className={styles.pageSub}>File plan, retention labels and disposition review for records.</div>

      <TabBar
        tabs={[
          { key: "fileplan", label: "File plan" },
          { key: "disposition", label: "Disposition review" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as RecordsTab)}
      />

      {tab === "fileplan" ? (
        state.recordsPlans.length === 0 ? (
          <EmptyState message="No records plans yet." />
        ) : (
          <DataTable<{ id: string; name: string; labels: number; regulatory: boolean; custodian: string }>
            columns={[
              { key: "name", header: "Plan", render: (p) => <span className={styles.rowLink}>{p.name}</span> },
              { key: "labels", header: "Labels", render: (p) => p.labels },
              {
                key: "regulatory",
                header: "Type",
                render: (p) => (p.regulatory ? <StatusPill tone="purple">Regulatory</StatusPill> : <StatusPill tone="muted">Non-regulatory</StatusPill>),
              },
              { key: "custodian", header: "Custodian", render: (p) => p.custodian },
            ]}
            rows={state.recordsPlans}
            getRowKey={(p) => p.id}
          />
        )
      ) : (
        <>
          <SubTabBar
            tabs={[
              { key: "Pending", label: "Pending" },
              { key: "All", label: "All" },
            ]}
            active={dispositionFilter}
            onChange={(k) => setDispositionFilter(k as DispositionFilter)}
          />
          <p className={styles.small} style={{ color: "#605e5c", marginBottom: 12 }}>
            {state.dispositionQueue.filter((d) => d.status === "Pending").length} item(s) waiting for disposition review.
          </p>
          {dispositionRows.length === 0 ? (
            <EmptyState message="No disposition items match this filter." />
          ) : (
            <DataTable<PurviewDispositionItem>
              columns={[
                { key: "item", header: "Item", render: (d) => <span className={styles.rowLink}>{d.item}</span> },
                { key: "label", header: "Label", render: (d) => d.label },
                { key: "location", header: "Location", render: (d) => d.location },
                { key: "dueOn", header: "Due on", render: (d) => new Date(d.dueOn).toLocaleDateString() },
                { key: "status", header: "Status", render: (d) => <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill> },
                {
                  key: "reviewed",
                  header: "Reviewed by",
                  render: (d) => (d.reviewedBy ? `${d.reviewedBy} · ${d.reviewedOn ? new Date(d.reviewedOn).toLocaleDateString() : ""}` : "—"),
                },
                {
                  key: "actions",
                  header: "Action",
                  render: (d) =>
                    d.status === "Pending" ? (
                      <>
                        <button type="button" className={styles.btnSubtle} onClick={() => handleApprove(d)}>
                          Approve
                        </button>{" "}
                        <button type="button" className={styles.btnSubtle} onClick={() => setRelabelTarget(d)}>
                          Relabel
                        </button>{" "}
                        <button type="button" className={styles.btnSubtle} onClick={() => setExtendTarget(d)}>
                          Extend
                        </button>
                      </>
                    ) : null,
                },
              ]}
              rows={dispositionRows}
              getRowKey={(d) => d.id}
            />
          )}
        </>
      )}

      {relabelTarget ? <RelabelDialog item={relabelTarget} onClose={() => setRelabelTarget(null)} onConfirm={handleRelabelConfirm} /> : null}
      {extendTarget ? <ExtendDialog item={extendTarget} onClose={() => setExtendTarget(null)} onConfirm={handleExtendConfirm} /> : null}
    </div>
  );
}
