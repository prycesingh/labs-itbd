"use client";

// Custom detection rules — ported from defender-custom-detect.js. Source only
// implements step 1 (Query) of its declared 6-step wizard (Alert details /
// Impacted entities / Actions / Scope / Summary are stubs never rendered).
// Per this sub-phase's full-depth scope decision, all 6 steps are built out
// here as real, functional form steps bound to `DefenderCustomDetectionRule`.
// Persistence also genuinely goes through the reducer (ADD/UPDATE/DELETE),
// unlike source's non-persisted module-local RULES array.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderCustomDetectionRule, DefenderState } from "@/lib/labs/simulators/defender/types";
import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import { Checkbox, DataTable, EmptyState, Field, NativeSelect, WizStep, type DataTableColumn } from "./defender-ui";
import { SeverityBadge, StatusPill, statusTone } from "./defender-ui";
import styles from "./defender-console.module.css";

// Common automated response actions, derived from the union of `actions`
// across the 7 seeded rules plus a few standard Defender response actions
// so the checkbox list reads as a realistic, complete catalog.
const RESPONSE_ACTIONS = [
  "Isolate device",
  "Disable user",
  "Quarantine file",
  "Run AV scan",
  "Collect investigation package",
  "Mark as compromised",
  "Revoke all sessions",
  "Block initiating process hash globally",
  "Disable Outlook web access",
  "Force MFA re-registration",
  "Force device re-registration",
  "Generate alert only",
];

const DEVICE_GROUPS = ["Finance workstations", "Domain controllers", "Executive laptops", "Remote/VPN devices"];

const FREQUENCY_OPTIONS = [
  { value: "Continuous (NRT)", label: "Continuous (NRT)" },
  { value: "Every 15 min", label: "Every 15 min" },
  { value: "Every 30 min", label: "Every 30 min" },
  { value: "Every hour", label: "Every hour" },
  { value: "Every 6 hours", label: "Every 6 hours" },
];

const SEVERITY_OPTIONS: { value: DefenderCustomDetectionRule["severity"]; label: string }[] = [
  { value: "Informational", label: "Informational" },
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

const WIZARD_STEPS = ["Query", "Alert details", "Impacted entities", "Actions", "Scope", "Summary"] as const;

function emptyRule(): DefenderCustomDetectionRule {
  return {
    id: "",
    name: "",
    severity: "Medium",
    status: "Active",
    frequency: "Every hour",
    lastRun: "Never",
    lastResult: "-",
    entities: "",
    mitre: "",
    kql: "// Write your KQL query here\n",
    actions: [],
    alertTitle: "",
    alertCategory: "",
    alertDescription: "",
    recommendedActions: "",
    scope: "All devices",
    deviceGroups: [],
  };
}

type View = { mode: "list" } | { mode: "wizard"; editing: DefenderCustomDetectionRule | null };

export function CustomDetectionPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<DefenderCustomDetectionRule>(emptyRule());
  const [deleteTarget, setDeleteTarget] = useState<DefenderCustomDetectionRule | null>(null);

  const rules = state.customDetectionRules;
  const activeCount = useMemo(() => rules.filter((r) => r.status === "Active").length, [rules]);

  function openCreate() {
    setDraft(emptyRule());
    setStep(1);
    setView({ mode: "wizard", editing: null });
  }

  function openEdit(rule: DefenderCustomDetectionRule) {
    setDraft({ ...rule });
    setStep(1);
    setView({ mode: "wizard", editing: rule });
  }

  function backToList() {
    setView({ mode: "list" });
  }

  function patchDraft(patch: Partial<DefenderCustomDetectionRule>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function toggleAction(action: string, checked: boolean) {
    patchDraft({
      actions: checked ? [...draft.actions, action] : draft.actions.filter((a) => a !== action),
    });
  }

  function toggleDeviceGroup(group: string, checked: boolean) {
    patchDraft({
      deviceGroups: checked ? [...draft.deviceGroups, group] : draft.deviceGroups.filter((g) => g !== group),
    });
  }

  function saveRule() {
    if (!draft.kql.trim()) {
      toast.error("KQL query is required.");
      setStep(1);
      return;
    }
    if (!draft.name.trim()) {
      toast.error("Rule name is required.");
      setStep(2);
      return;
    }

    if (view.mode === "wizard" && view.editing) {
      dispatch({ type: "UPDATE_CUSTOM_DETECTION_RULE", id: view.editing.id, patch: { ...draft } });
      toast.success(`Rule "${draft.name}" updated.`);
    } else {
      const newRule: DefenderCustomDetectionRule = {
        ...draft,
        id: `cdr-${crypto.randomUUID()}`,
        lastRun: "Never",
        lastResult: "-",
      };
      dispatch({ type: "ADD_CUSTOM_DETECTION_RULE", rule: newRule });
      toast.success(`Rule "${newRule.name}" created.`);
    }
    setView({ mode: "list" });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_CUSTOM_DETECTION_RULE", id: deleteTarget.id });
    toast.success(`Rule "${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  if (view.mode === "wizard") {
    return (
      <div>
        <div className={styles.breadcrumb}>
          <a onClick={backToList}>Custom detection rules</a>
          <span>&gt;</span> {view.editing ? `Edit rule: ${view.editing.name}` : "New rule"}
        </div>
        <div className={styles.pageH1}>{view.editing ? `Edit rule: ${view.editing.name}` : "New custom detection rule"}</div>

        <div className={styles.wizSteps}>
          {WIZARD_STEPS.map((label, i) => (
            <div key={label} onClick={() => setStep(i + 1)} style={{ cursor: "pointer" }}>
              <WizStep label={`${i + 1}. ${label}`} active={step === i + 1} done={step > i + 1} />
            </div>
          ))}
        </div>

        <div className={styles.card}>
          {step === 1 && <QueryStep draft={draft} patchDraft={patchDraft} />}
          {step === 2 && <AlertDetailsStep draft={draft} patchDraft={patchDraft} />}
          {step === 3 && <EntitiesStep draft={draft} patchDraft={patchDraft} />}
          {step === 4 && <ActionsStep draft={draft} toggleAction={toggleAction} />}
          {step === 5 && <ScopeStep draft={draft} patchDraft={patchDraft} toggleDeviceGroup={toggleDeviceGroup} />}
          {step === 6 && <SummaryStep draft={draft} />}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={backToList}>
            Cancel
          </button>
          {step > 1 ? (
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setStep((s) => Math.max(1, s - 1))}>
              Back
            </button>
          ) : null}
          {step < WIZARD_STEPS.length ? (
            <button type="button" className={styles.btnPrimary} onClick={() => setStep((s) => Math.min(WIZARD_STEPS.length, s + 1))}>
              Next
            </button>
          ) : (
            <button type="button" className={styles.btnPrimary} onClick={saveRule}>
              {view.editing ? "Save" : "Create rule"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const columns: DataTableColumn<DefenderCustomDetectionRule>[] = [
    { key: "name", header: "Rule name", render: (r) => <span className={styles.rowLink}>{r.name}</span> },
    { key: "severity", header: "Severity", render: (r) => <SeverityBadge severity={r.severity} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
    { key: "frequency", header: "Frequency", render: (r) => r.frequency },
    { key: "lastRun", header: "Last run", render: (r) => r.lastRun },
    { key: "lastResult", header: "Last result", render: (r) => r.lastResult },
    { key: "mitre", header: "MITRE", render: (r) => <span style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{r.mitre}</span> },
    {
      key: "delete",
      header: "",
      render: (r) => (
        <button
          type="button"
          className={styles.btnSubtle}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(r);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Custom detection rules</a>
      </div>
      <div className={styles.pageH1}>Custom detection rules</div>
      <div className={styles.pageSub}>
        Scheduled KQL queries that auto-generate alerts or incidents and trigger response actions. {activeCount} of {rules.length} rules active.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Create detection rule
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState message="No custom detection rules yet." />
      ) : (
        <DataTable columns={columns} rows={rules} getRowKey={(r) => r.id} onRowClick={openEdit} emptyMessage="No custom detection rules." />
      )}

      <div className={styles.tip}>
        <strong>Frequency tiers:</strong> <code>Continuous (NRT)</code> = sub-minute, near-real-time; required for fast-acting threats.{" "}
        <code>Every 15 min / 30 min / hour / 6h</code> for less time-critical hunts. Continuous detections consume more advanced hunting quota.
      </div>

      {deleteTarget ? (
        <div className={styles.modalMask} onMouseDown={() => setDeleteTarget(null)}>
          <div className={styles.modal} style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete detection rule?</h2>
            </div>
            <div className={styles.modalBody}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action can&apos;t be undone.
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ===== Step 1: Query =====
function QueryStep({ draft, patchDraft }: { draft: DefenderCustomDetectionRule; patchDraft: (patch: Partial<DefenderCustomDetectionRule>) => void }) {
  return (
    <div>
      <Field label="KQL query" help="Advanced hunting query that returns rows this rule will alert on.">
        <textarea
          className={styles.textarea}
          style={{ height: 240, fontFamily: "Consolas, monospace", fontSize: 12, background: "#1e1e1e", color: "#d4d4d4" }}
          value={draft.kql}
          onChange={(e) => patchDraft({ kql: e.target.value })}
        />
      </Field>
      <div className={styles.row}>
        <Field label="Frequency">
          <NativeSelect value={draft.frequency} onChange={(value) => patchDraft({ frequency: value })} options={FREQUENCY_OPTIONS} />
        </Field>
        <Field label="Status">
          <NativeSelect
            value={draft.status}
            onChange={(value) => patchDraft({ status: value as DefenderCustomDetectionRule["status"] })}
            options={[
              { value: "Active", label: "Active" },
              { value: "Disabled", label: "Disabled" },
            ]}
          />
        </Field>
      </div>
    </div>
  );
}

// ===== Step 2: Alert details =====
function AlertDetailsStep({ draft, patchDraft }: { draft: DefenderCustomDetectionRule; patchDraft: (patch: Partial<DefenderCustomDetectionRule>) => void }) {
  return (
    <div>
      <Field label="Rule name">
        <input className={styles.input} value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} placeholder="e.g. Suspicious LSASS access by non-Microsoft process" />
      </Field>
      <Field label="Alert title">
        <input className={styles.input} value={draft.alertTitle} onChange={(e) => patchDraft({ alertTitle: e.target.value })} placeholder="Title shown on generated alerts" />
      </Field>
      <div className={styles.row}>
        <Field label="Severity">
          <NativeSelect value={draft.severity} onChange={(value) => patchDraft({ severity: value as DefenderCustomDetectionRule["severity"] })} options={SEVERITY_OPTIONS} />
        </Field>
        <Field label="Category">
          <input className={styles.input} value={draft.alertCategory} onChange={(e) => patchDraft({ alertCategory: e.target.value })} placeholder="e.g. CredentialAccess" />
        </Field>
      </div>
      <Field label="Description">
        <textarea className={styles.textarea} style={{ height: 90 }} value={draft.alertDescription} onChange={(e) => patchDraft({ alertDescription: e.target.value })} placeholder="What this alert means and why it fired" />
      </Field>
      <Field label="Recommended actions">
        <textarea className={styles.textarea} style={{ height: 90 }} value={draft.recommendedActions} onChange={(e) => patchDraft({ recommendedActions: e.target.value })} placeholder="Guidance for the analyst investigating this alert" />
      </Field>
      <Field label="MITRE ATT&CK technique(s)">
        <input className={styles.input} value={draft.mitre} onChange={(e) => patchDraft({ mitre: e.target.value })} placeholder="e.g. T1003.001 - LSASS Memory" />
      </Field>
    </div>
  );
}

// ===== Step 3: Impacted entities =====
function EntitiesStep({ draft, patchDraft }: { draft: DefenderCustomDetectionRule; patchDraft: (patch: Partial<DefenderCustomDetectionRule>) => void }) {
  return (
    <div>
      <Field label="Impacted entities" help="Comma-separated list of entity types returned by the query, e.g. Device, File, Process.">
        <input className={styles.input} value={draft.entities} onChange={(e) => patchDraft({ entities: e.target.value })} placeholder="Device, File, Process" />
      </Field>
      <div className={styles.tip}>
        Impacted entities identify which columns in your query map to Defender entity types (Device, User, Mailbox, File, Process, IP, Application, Network) so alerts can link directly to device pages, user profiles, and file/process details.
      </div>
    </div>
  );
}

// ===== Step 4: Actions =====
function ActionsStep({ draft, toggleAction }: { draft: DefenderCustomDetectionRule; toggleAction: (action: string, checked: boolean) => void }) {
  return (
    <div>
      <Field label="Automated response actions" help="Actions Defender will automatically take when this rule fires.">
        {RESPONSE_ACTIONS.map((action) => (
          <Checkbox key={action} label={action} checked={draft.actions.includes(action)} onChange={(checked) => toggleAction(action, checked)} />
        ))}
      </Field>
      {draft.actions.length === 0 ? <div className={styles.formHelp}>No automated actions selected — the rule will only generate an alert.</div> : null}
    </div>
  );
}

// ===== Step 5: Scope =====
function ScopeStep({ draft, patchDraft, toggleDeviceGroup }: { draft: DefenderCustomDetectionRule; patchDraft: (patch: Partial<DefenderCustomDetectionRule>) => void; toggleDeviceGroup: (group: string, checked: boolean) => void }) {
  return (
    <div>
      <Field label="Scope" help="Which devices this rule's query should run against.">
        <label className={styles.checkboxRow}>
          <input
            type="radio"
            name="scope"
            checked={draft.scope === "All devices"}
            onChange={() => patchDraft({ scope: "All devices", deviceGroups: [] })}
          />
          <span>All devices</span>
        </label>
        <label className={styles.checkboxRow}>
          <input type="radio" name="scope" checked={draft.scope === "Specific device groups"} onChange={() => patchDraft({ scope: "Specific device groups" })} />
          <span>Specific device groups</span>
        </label>
      </Field>
      {draft.scope === "Specific device groups" ? (
        <Field label="Device groups">
          {DEVICE_GROUPS.map((group) => (
            <Checkbox key={group} label={group} checked={draft.deviceGroups.includes(group)} onChange={(checked) => toggleDeviceGroup(group, checked)} />
          ))}
        </Field>
      ) : null}
    </div>
  );
}

// ===== Step 6: Summary =====
function SummaryStep({ draft }: { draft: DefenderCustomDetectionRule }) {
  return (
    <div>
      <div className={styles.h3}>Query</div>
      <div className={styles.tlDetail} style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>
        {draft.kql || "(empty)"}
      </div>

      <div className={styles.h3}>Alert details</div>
      <div className={styles.formHelp}>
        <strong>Name:</strong> {draft.name || "(untitled)"}
      </div>
      <div className={styles.formHelp}>
        <strong>Alert title:</strong> {draft.alertTitle || "-"}
      </div>
      <div className={styles.formHelp}>
        <strong>Severity:</strong> <SeverityBadge severity={draft.severity} />
      </div>
      <div className={styles.formHelp}>
        <strong>Category:</strong> {draft.alertCategory || "-"}
      </div>
      <div className={styles.formHelp}>
        <strong>Description:</strong> {draft.alertDescription || "-"}
      </div>
      <div className={styles.formHelp}>
        <strong>Recommended actions:</strong> {draft.recommendedActions || "-"}
      </div>
      <div className={styles.formHelp}>
        <strong>MITRE:</strong> {draft.mitre || "-"}
      </div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Impacted entities
      </div>
      <div className={styles.formHelp}>{draft.entities || "-"}</div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Actions
      </div>
      <div className={styles.formHelp}>{draft.actions.length > 0 ? draft.actions.join(", ") : "Generate alert only"}</div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Scope
      </div>
      <div className={styles.formHelp}>
        <strong>{draft.scope}</strong>
        {draft.scope === "Specific device groups" ? ` — ${draft.deviceGroups.length > 0 ? draft.deviceGroups.join(", ") : "(none selected)"}` : ""}
      </div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Status
      </div>
      <div className={styles.formHelp}>
        <StatusPill tone={statusTone(draft.status)}>{draft.status}</StatusPill> &middot; {draft.frequency}
      </div>
    </div>
  );
}
