"use client";

// Information protection (Sensitivity labels) page for the Microsoft Purview
// compliance-portal simulator. Ported from
// itbd-lab/simulators/purview/js/purview-labels.js (517 lines) — three
// sub-tabs (Labels / Label policies / Auto-labeling policies) plus a full
// 7-step "Create a sensitivity label" wizard (Basics -> Scope -> Protection ->
// Marking -> Sites -> Auto-labeling -> Review). Source notes this is the
// cleanest, most-complete module with no known bugs, so this port stays
// faithful to its structure and field set rather than simplifying it.
//
// Two differences from a byte-for-byte port, both required by the shared
// `PurviewLabelPolicy`/`PurviewAutoLabelPolicy` shapes already defined in
// types.ts (source's policies/auto-label tabs are read-only "would open a
// wizard" toasts with no create flow at all):
//   - "Create label policy" and "Create auto-labeling policy" get small,
//     genuinely-functional 2-3 step modals (per the task's ask for a simpler
//     flow matching source's actual, much shallower depth for these two
//     tabs) instead of source's single `PurviewPortal.toast(...)` stub.
//   - The label wizard's `wizFinish()` maps 1:1 onto `ADD_LABEL`, including
//     the same field derivations (`scope`/`marking` joined strings, `order`
//     as next available number, `createdOn` as `new Date().toISOString()`).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import type {
  PurviewAutoLabelPolicy,
  PurviewLabelPolicy,
  PurviewSensitivityLabel,
  PurviewState,
} from "@/lib/labs/simulators/purview/types";

import {
  Checkbox,
  DataTable,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatusPill,
  SubTabBar,
  WizStep,
  statusTone,
} from "./purview-ui";
import styles from "./purview-console.module.css";

// ===== Local types =====

type SubTab = "labels" | "policies" | "auto";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "labels", label: "Labels" },
  { key: "policies", label: "Label policies" },
  { key: "auto", label: "Auto-labeling policies" },
];

// Create-label wizard step ids, in order — matches source's `WIZ_STEPS`.
type WizStepId = "basics" | "scope" | "protection" | "marking" | "sites" | "autolabel" | "review";

const WIZ_STEPS: { id: WizStepId; label: string }[] = [
  { id: "basics", label: "Provide basics" },
  { id: "scope", label: "Define scope" },
  { id: "protection", label: "Protection settings" },
  { id: "marking", label: "Apply label to content" },
  { id: "sites", label: "Site and group settings" },
  { id: "autolabel", label: "Auto-labeling for files" },
  { id: "review", label: "Review and create" },
];

// Source's 6-color quick palette (wizBasics) is widened to the task's ask for
// the full 12-color swatch picker — the remaining 6 are drawn from the labels
// already seeded in seedData.ts (`buildSensitivityLabels()`), so every
// swatch on offer here also appears as a real label color somewhere in state.
const LABEL_COLORS = [
  "#107c10",
  "#2564cf",
  "#5c2d91",
  "#ca5010",
  "#d83b01",
  "#a4262c",
  "#0078d4",
  "#8764b8",
  "#498205",
  "#c239b3",
  "#986f0b",
  "#038387",
];

const SCOPE_OPTIONS = ["File", "Email", "Groups & sites", "Schematized data"];

const PERMISSION_LEVELS = ["Owner", "Co-Author", "Reviewer", "Viewer", "Custom"];

const SIT_CONDITIONS = [
  "Credit Card Number (1+)",
  "U.S. SSN (1+) OR Aadhaar (1+)",
  "AWS Access Key OR Azure Subscription ID",
  "Custom regex or trainable classifier",
];

type LabelWizardState = {
  name: string;
  description: string;
  scope: string[];
  encryption: boolean;
  permissionLevel: string;
  color: string;
  markHeader: boolean;
  markFooter: boolean;
  markWatermark: boolean;
  headerText: string;
  footerText: string;
  watermarkText: string;
  siteTargeting: string;
  autoLabel: boolean;
  autoLabelCondition: string;
};

function freshLabelWizard(): LabelWizardState {
  return {
    name: "",
    description: "",
    scope: ["File", "Email"],
    encryption: false,
    permissionLevel: "Co-Author",
    color: LABEL_COLORS[0],
    markHeader: false,
    markFooter: false,
    markWatermark: false,
    headerText: "Confidential - cloudlab.in",
    footerText: "Sensitivity: Confidential",
    watermarkText: "CONFIDENTIAL",
    siteTargeting: "",
    autoLabel: false,
    autoLabelCondition: SIT_CONDITIONS[0],
  };
}

function markingSummary(w: Pick<LabelWizardState, "markHeader" | "markFooter" | "markWatermark">): string {
  const parts: string[] = [];
  if (w.markHeader) parts.push("Header");
  if (w.markFooter) parts.push("Footer");
  if (w.markWatermark) parts.push("Watermark");
  return parts.join(", ") || "None";
}

// ===== Create label policy modal state =====

type PolicyWizardState = {
  name: string;
  publishedTo: string;
  labelIds: string[];
  defaultLabel: string;
  requireJustification: boolean;
  mandatory: boolean;
};

function freshPolicyWizard(firstLabelId: string): PolicyWizardState {
  return {
    name: "",
    publishedTo: "All users",
    labelIds: [],
    defaultLabel: firstLabelId,
    requireJustification: true,
    mandatory: true,
  };
}

// ===== Create auto-labeling policy modal state =====

type AutoWizardState = {
  name: string;
  label: string;
  locations: string;
  condition: string;
  mode: "Simulation" | "On" | "Off";
};

function freshAutoWizard(firstLabelId: string): AutoWizardState {
  return {
    name: "",
    label: firstLabelId,
    locations: "SharePoint, OneDrive",
    condition: SIT_CONDITIONS[0],
    mode: "Simulation",
  };
}

export function InformationProtectionPage({
  state,
  dispatch,
}: {
  state: PurviewState;
  dispatch: React.Dispatch<PurviewAction>;
}) {
  const [tab, setTab] = useState<SubTab>("labels");

  const [detailLabelId, setDetailLabelId] = useState<string | null>(null);
  const [detailPolicyId, setDetailPolicyId] = useState<string | null>(null);

  const [labelWizardOpen, setLabelWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizStepId>("basics");
  const [wizard, setWizard] = useState<LabelWizardState>(freshLabelWizard());

  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyStep, setPolicyStep] = useState<0 | 1>(0);
  const [policyWizard, setPolicyWizard] = useState<PolicyWizardState>(() => freshPolicyWizard(state.sensitivityLabels[0]?.id ?? ""));

  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoStep, setAutoStep] = useState<0 | 1>(0);
  const [autoWizard, setAutoWizard] = useState<AutoWizardState>(() => freshAutoWizard(state.sensitivityLabels[0]?.id ?? ""));

  const sortedLabels = useMemo(
    () => [...state.sensitivityLabels].sort((a, b) => a.order - b.order),
    [state.sensitivityLabels],
  );

  const detailLabel = detailLabelId ? state.sensitivityLabels.find((l) => l.id === detailLabelId) ?? null : null;
  const detailPolicy = detailPolicyId ? state.labelPolicies.find((p) => p.id === detailPolicyId) ?? null : null;

  function labelName(id: string): string {
    return state.sensitivityLabels.find((l) => l.id === id)?.name ?? "(none)";
  }

  // ===== Create-label wizard handlers =====

  function openLabelWizard() {
    setWizard(freshLabelWizard());
    setWizardStep("basics");
    setLabelWizardOpen(true);
  }

  function closeLabelWizard() {
    setLabelWizardOpen(false);
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
      toast.warning("Label name is required.");
      return;
    }
    const idx = stepIndex(wizardStep);
    if (idx < WIZ_STEPS.length - 1) wizGoTo(WIZ_STEPS[idx + 1].id);
  }

  function toggleScope(value: string) {
    setWizard((w) => ({
      ...w,
      scope: w.scope.includes(value) ? w.scope.filter((s) => s !== value) : [...w.scope, value],
    }));
  }

  function wizFinish() {
    if (!wizard.name.trim()) {
      toast.warning("Label name is required.");
      setWizardStep("basics");
      return;
    }
    const nextOrder = state.sensitivityLabels.reduce((max, l) => Math.max(max, l.order), 0) + 1;
    const label: PurviewSensitivityLabel = {
      id: `lab-${crypto.randomUUID()}`,
      name: wizard.name.trim(),
      order: nextOrder,
      color: wizard.color,
      scope: wizard.scope.join(", ") || "File, Email",
      encryption: wizard.encryption,
      marking: markingSummary(wizard),
      autoLabel: wizard.autoLabel,
      parent: null,
      createdOn: new Date().toISOString(),
      description: wizard.description,
    };
    dispatch({ type: "ADD_LABEL", label });
    setLabelWizardOpen(false);
    toast.success(`Sensitivity label "${label.name}" created.`);
    setTab("labels");
  }

  // ===== Label detail / delete =====

  function handleDeleteLabel(id: string) {
    const label = state.sensitivityLabels.find((l) => l.id === id);
    if (!label) return;
    dispatch({ type: "DELETE_LABEL", id });
    setDetailLabelId(null);
    toast.success("Label deleted.");
  }

  // ===== Label policy modal =====

  function openPolicyModal() {
    setPolicyWizard(freshPolicyWizard(state.sensitivityLabels[0]?.id ?? ""));
    setPolicyStep(0);
    setPolicyModalOpen(true);
  }

  function togglePolicyLabel(id: string) {
    setPolicyWizard((w) => ({
      ...w,
      labelIds: w.labelIds.includes(id) ? w.labelIds.filter((x) => x !== id) : [...w.labelIds, id],
    }));
  }

  function finishPolicyWizard() {
    if (!policyWizard.name.trim()) {
      toast.warning("Policy name is required.");
      setPolicyStep(0);
      return;
    }
    if (policyWizard.labelIds.length === 0) {
      toast.warning("Select at least one label to publish.");
      setPolicyStep(0);
      return;
    }
    const policy: PurviewLabelPolicy = {
      id: `lp-${crypto.randomUUID()}`,
      name: policyWizard.name.trim(),
      publishedTo: policyWizard.publishedTo,
      labels: policyWizard.labelIds,
      defaultLabel: policyWizard.defaultLabel || policyWizard.labelIds[0],
      requireJustification: policyWizard.requireJustification,
      mandatory: policyWizard.mandatory,
      modified: new Date().toISOString(),
    };
    dispatch({ type: "ADD_LABEL_POLICY", policy });
    setPolicyModalOpen(false);
    toast.success(`Label policy "${policy.name}" published.`);
  }

  // ===== Auto-labeling policy modal =====

  function openAutoModal() {
    setAutoWizard(freshAutoWizard(state.sensitivityLabels[0]?.id ?? ""));
    setAutoStep(0);
    setAutoModalOpen(true);
  }

  function finishAutoWizard() {
    if (!autoWizard.name.trim()) {
      toast.warning("Policy name is required.");
      setAutoStep(0);
      return;
    }
    const policy: PurviewAutoLabelPolicy = {
      id: `al-${crypto.randomUUID()}`,
      name: autoWizard.name.trim(),
      label: autoWizard.label,
      locations: autoWizard.locations,
      condition: autoWizard.condition,
      mode: autoWizard.mode,
      matches: 0,
      modified: new Date().toISOString(),
    };
    dispatch({ type: "ADD_AUTO_LABEL_POLICY", policy });
    setAutoModalOpen(false);
    toast.success(`Auto-labeling policy "${policy.name}" created.`);
  }

  return (
    <div>
      <div className={styles.pageH1}>Information protection</div>
      <div className={styles.pageSub}>Sensitivity labels apply encryption, marking and policies to your data.</div>

      <SubTabBar tabs={SUB_TABS} active={tab} onChange={(k) => setTab(k as SubTab)} />

      {tab === "labels" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={openLabelWizard}>
              <span className={styles.tbBtnIco}>+</span> Create a label
            </button>
            <button type="button" className={styles.tbBtn} onClick={() => toast.info("Publish label wizard would open. Users get labels in Office apps within 24 hours.")}>
              Publish labels
            </button>
          </div>
          <DataTable<PurviewSensitivityLabel>
            columns={[
              {
                key: "name",
                header: "Name",
                render: (l) => (
                  <span>
                    <span className={styles.labelSwatch} style={{ background: l.color }} />
                    <span className={styles.rowLink}>{l.name}</span>
                  </span>
                ),
              },
              { key: "order", header: "Order", render: (l) => l.order },
              { key: "scope", header: "Scope", render: (l) => l.scope },
              {
                key: "encryption",
                header: "Encryption",
                render: (l) => (l.encryption ? <StatusPill tone="purple">Encryption</StatusPill> : <StatusPill tone="muted">None</StatusPill>),
              },
              { key: "marking", header: "Marking", render: (l) => l.marking },
              {
                key: "autoLabel",
                header: "Auto-label",
                render: (l) => (l.autoLabel ? <StatusPill tone="ok">Auto</StatusPill> : <StatusPill tone="muted">Off</StatusPill>),
              },
              { key: "parent", header: "Parent", render: (l) => l.parent ?? "—" },
            ]}
            rows={sortedLabels}
            getRowKey={(l) => l.id}
            onRowClick={(l) => setDetailLabelId(l.id)}
            emptyMessage="No sensitivity labels yet."
          />
        </>
      ) : null}

      {tab === "policies" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={openPolicyModal}>
              <span className={styles.tbBtnIco}>+</span> Publish labels
            </button>
          </div>
          <DataTable<PurviewLabelPolicy>
            columns={[
              { key: "name", header: "Name", render: (p) => <span className={styles.rowLink}>{p.name}</span> },
              { key: "publishedTo", header: "Published to", render: (p) => p.publishedTo },
              { key: "labels", header: "Labels", render: (p) => `${p.labels.length} labels` },
              { key: "defaultLabel", header: "Default", render: (p) => labelName(p.defaultLabel) },
              { key: "requireJustification", header: "Justification", render: (p) => (p.requireJustification ? "Yes" : "No") },
              { key: "mandatory", header: "Mandatory", render: (p) => (p.mandatory ? "Yes" : "No") },
              { key: "modified", header: "Modified", render: (p) => new Date(p.modified).toLocaleDateString() },
            ]}
            rows={state.labelPolicies}
            getRowKey={(p) => p.id}
            onRowClick={(p) => setDetailPolicyId(p.id)}
            emptyMessage="No label policies yet."
          />
        </>
      ) : null}

      {tab === "auto" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={openAutoModal}>
              <span className={styles.tbBtnIco}>+</span> Create auto-labeling policy
            </button>
          </div>
          <DataTable<PurviewAutoLabelPolicy>
            columns={[
              { key: "name", header: "Name", render: (p) => <span className={styles.rowLink}>{p.name}</span> },
              { key: "label", header: "Label", render: (p) => labelName(p.label) },
              { key: "locations", header: "Locations", render: (p) => p.locations },
              { key: "condition", header: "Condition", render: (p) => p.condition },
              { key: "mode", header: "Mode", render: (p) => <StatusPill tone={statusTone(p.mode)}>{p.mode}</StatusPill> },
              { key: "matches", header: "Matches", render: (p) => p.matches },
              { key: "modified", header: "Modified", render: (p) => new Date(p.modified).toLocaleDateString() },
            ]}
            rows={state.autoLabelingPolicies}
            getRowKey={(p) => p.id}
            emptyMessage="No auto-labeling policies yet."
          />
        </>
      ) : null}

      {/* ===== Label detail flyout ===== */}
      {detailLabel ? (
        <Flyout
          title={detailLabel.name}
          subtitle={<span className={styles.labelSwatch} style={{ background: detailLabel.color }} />}
          onClose={() => setDetailLabelId(null)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => handleDeleteLabel(detailLabel.id)}>
                Delete
              </button>
              <button type="button" className={styles.btn} onClick={() => setDetailLabelId(null)}>
                Close
              </button>
            </>
          }
        >
          <div className={styles.inspector}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Order</div>
              <div className={styles.fieldValue}>{detailLabel.order}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Parent</div>
              <div className={styles.fieldValue}>{detailLabel.parent ?? "None"}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Scope</div>
              <div className={styles.fieldValue}>{detailLabel.scope}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Encryption</div>
              <div className={styles.fieldValue}>{detailLabel.encryption ? "Enabled" : "None"}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Marking</div>
              <div className={styles.fieldValue}>{detailLabel.marking}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Auto-label</div>
              <div className={styles.fieldValue}>{detailLabel.autoLabel ? "Enabled" : "Off"}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Created</div>
              <div className={styles.fieldValue}>{new Date(detailLabel.createdOn).toLocaleDateString()}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Color</div>
              <div className={styles.fieldValue}>
                <span className={styles.labelSwatch} style={{ background: detailLabel.color }} />
                {detailLabel.color}
              </div>
            </div>
          </div>

          <div className={styles.h3}>Description</div>
          <div className={`${styles.small} ${styles.muted}`}>{detailLabel.description}</div>

          <div className={styles.h2}>Encryption settings</div>
          {detailLabel.encryption ? (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Permissions</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Permission level</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>All users in @cloudlab.in</td>
                    <td>Co-Author</td>
                  </tr>
                  <tr>
                    <td>finance-team@cloudlab.in</td>
                    <td>Owner</td>
                  </tr>
                  <tr>
                    <td>External (specific people)</td>
                    <td>Reviewer</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`${styles.small} ${styles.muted}`}>Encryption is not configured for this label.</div>
          )}

          <div className={styles.h2}>Visual marking</div>
          <div className={styles.small}>
            Header / Footer / Watermark — configured as: <strong>{detailLabel.marking}</strong>
          </div>
        </Flyout>
      ) : null}

      {/* ===== Label policy detail flyout ===== */}
      {detailPolicy ? (
        <Flyout
          title={detailPolicy.name}
          subtitle={detailPolicy.publishedTo}
          onClose={() => setDetailPolicyId(null)}
          footer={
            <button type="button" className={styles.btn} onClick={() => setDetailPolicyId(null)}>
              Close
            </button>
          }
        >
          <div className={styles.inspector}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Published to</div>
              <div className={styles.fieldValue}>{detailPolicy.publishedTo}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Default label</div>
              <div className={styles.fieldValue}>{labelName(detailPolicy.defaultLabel)}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Require justification</div>
              <div className={styles.fieldValue}>{detailPolicy.requireJustification ? "Yes" : "No"}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Mandatory</div>
              <div className={styles.fieldValue}>{detailPolicy.mandatory ? "Yes" : "No"}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Modified</div>
              <div className={styles.fieldValue}>{new Date(detailPolicy.modified).toLocaleDateString()}</div>
            </div>
          </div>

          <div className={styles.h3}>Included labels ({detailPolicy.labels.length})</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Encryption</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {detailPolicy.labels.map((id) => {
                const l = state.sensitivityLabels.find((x) => x.id === id);
                if (!l) return null;
                return (
                  <tr key={id}>
                    <td>
                      <span className={styles.labelSwatch} style={{ background: l.color }} />
                      {l.name}
                    </td>
                    <td>{l.encryption ? "Enabled" : "None"}</td>
                    <td>{l.scope}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Flyout>
      ) : null}

      {/* ===== Create-label wizard (7 steps) ===== */}
      {labelWizardOpen ? (
        <Modal
          title="Create a sensitivity label"
          onClose={closeLabelWizard}
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
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeLabelWizard}>
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
                  Create label
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={wizNext}>
                  Next
                </button>
              )}
            </>
          }
        >
          {wizardStep === "basics" ? (
            <>
              <Field label="Name *">
                <input
                  className={styles.input}
                  value={wizard.name}
                  onChange={(e) => setWizard((w) => ({ ...w, name: e.target.value }))}
                  placeholder="e.g. Confidential / Finance"
                />
              </Field>
              <Field label="Description">
                <textarea
                  className={styles.textarea}
                  value={wizard.description}
                  onChange={(e) => setWizard((w) => ({ ...w, description: e.target.value }))}
                />
              </Field>
              <Field label="Color">
                <div className={styles.flexRow} style={{ flexWrap: "wrap" }}>
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={styles.labelSwatch}
                      onClick={() => setWizard((w) => ({ ...w, color: c }))}
                      style={{
                        background: c,
                        width: 22,
                        height: 22,
                        cursor: "pointer",
                        marginRight: 6,
                        outline: wizard.color === c ? "2px solid #5c2d91" : undefined,
                        outlineOffset: wizard.color === c ? 1 : undefined,
                      }}
                      aria-label={`Choose color ${c}`}
                    />
                  ))}
                </div>
              </Field>
            </>
          ) : null}

          {wizardStep === "scope" ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>Choose where this label can be applied.</p>
              {SCOPE_OPTIONS.map((s) => (
                <Checkbox key={s} label={s} checked={wizard.scope.includes(s)} onChange={() => toggleScope(s)} />
              ))}
            </>
          ) : null}

          {wizardStep === "protection" ? (
            <>
              <Checkbox
                label="Encrypt files and emails with Azure RMS"
                checked={wizard.encryption}
                onChange={(v) => setWizard((w) => ({ ...w, encryption: v }))}
              />
              {wizard.encryption ? (
                <div className={`${styles.card} ${styles.mt12}`}>
                  <div className={styles.cardTitle}>Permissions</div>
                  <Field label="Permission level">
                    <NativeSelect
                      value={wizard.permissionLevel}
                      onChange={(v) => setWizard((w) => ({ ...w, permissionLevel: v }))}
                      options={PERMISSION_LEVELS.map((p) => ({ value: p, label: p }))}
                    />
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}

          {wizardStep === "marking" ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>Apply visual marking to documents and emails.</p>
              <Checkbox label="Header" checked={wizard.markHeader} onChange={(v) => setWizard((w) => ({ ...w, markHeader: v }))} />
              <input
                className={`${styles.input} ${styles.mb12}`}
                value={wizard.headerText}
                onChange={(e) => setWizard((w) => ({ ...w, headerText: e.target.value }))}
              />
              <Checkbox label="Footer" checked={wizard.markFooter} onChange={(v) => setWizard((w) => ({ ...w, markFooter: v }))} />
              <input
                className={`${styles.input} ${styles.mb12}`}
                value={wizard.footerText}
                onChange={(e) => setWizard((w) => ({ ...w, footerText: e.target.value }))}
              />
              <Checkbox
                label="Watermark"
                checked={wizard.markWatermark}
                onChange={(v) => setWizard((w) => ({ ...w, markWatermark: v }))}
              />
              <input
                className={`${styles.input} ${styles.mb12}`}
                value={wizard.watermarkText}
                onChange={(e) => setWizard((w) => ({ ...w, watermarkText: e.target.value }))}
              />
            </>
          ) : null}

          {wizardStep === "sites" ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>
                When this label is applied to a Group, Team or SharePoint site, target these sites/groups.
              </p>
              <Field label="Sites / groups (comma-separated)" help="Descriptive only in this simulation.">
                <input
                  className={styles.input}
                  value={wizard.siteTargeting}
                  onChange={(e) => setWizard((w) => ({ ...w, siteTargeting: e.target.value }))}
                  placeholder="e.g. Finance Hub, Legal Hub"
                />
              </Field>
            </>
          ) : null}

          {wizardStep === "autolabel" ? (
            <>
              <Checkbox
                label="Recommend or apply this label automatically based on content"
                checked={wizard.autoLabel}
                onChange={(v) => setWizard((w) => ({ ...w, autoLabel: v }))}
              />
              <Field label="Detection condition">
                <NativeSelect
                  value={wizard.autoLabelCondition}
                  onChange={(v) => setWizard((w) => ({ ...w, autoLabelCondition: v }))}
                  options={SIT_CONDITIONS.map((c) => ({ value: c, label: c }))}
                />
              </Field>
            </>
          ) : null}

          {wizardStep === "review" ? (
            <div className={styles.inspector}>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Name</div>
                <div className={styles.fieldValue}>{wizard.name}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Scope</div>
                <div className={styles.fieldValue}>{wizard.scope.join(", ") || "-"}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Color</div>
                <div className={styles.fieldValue}>
                  <span className={styles.labelSwatch} style={{ background: wizard.color }} />
                  {wizard.color}
                </div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Encryption</div>
                <div className={styles.fieldValue}>{wizard.encryption ? `Enabled (${wizard.permissionLevel})` : "None"}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Marking</div>
                <div className={styles.fieldValue}>{markingSummary(wizard)}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Auto-label</div>
                <div className={styles.fieldValue}>{wizard.autoLabel ? `On - ${wizard.autoLabelCondition}` : "Off"}</div>
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Site / group targeting</div>
                <div className={styles.fieldValue}>{wizard.siteTargeting || "None"}</div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {/* ===== Create label policy modal (2 steps) ===== */}
      {policyModalOpen ? (
        <Modal
          title="Publish labels"
          onClose={() => setPolicyModalOpen(false)}
          width="720px"
          steps={
            <>
              <WizStep label="Choose labels" active={policyStep === 0} done={policyStep > 0} onClick={() => setPolicyStep(0)} />
              <WizStep label="Policy settings" active={policyStep === 1} done={false} onClick={() => setPolicyStep(1)} />
            </>
          }
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPolicyModalOpen(false)}>
                Cancel
              </button>
              <span style={{ flex: 1 }} />
              {policyStep === 1 ? (
                <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPolicyStep(0)}>
                  Back
                </button>
              ) : null}
              {policyStep === 0 ? (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    if (policyWizard.labelIds.length === 0) {
                      toast.warning("Select at least one label to publish.");
                      return;
                    }
                    setPolicyStep(1);
                  }}
                >
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={finishPolicyWizard}>
                  Publish
                </button>
              )}
            </>
          }
        >
          {policyStep === 0 ? (
            <>
              <p className={`${styles.muted} ${styles.small}`}>Choose the labels this policy will publish to users.</p>
              {sortedLabels.map((l) => (
                <Checkbox
                  key={l.id}
                  label={l.name}
                  checked={policyWizard.labelIds.includes(l.id)}
                  onChange={() => togglePolicyLabel(l.id)}
                />
              ))}
            </>
          ) : (
            <>
              <Field label="Policy name *">
                <input
                  className={styles.input}
                  value={policyWizard.name}
                  onChange={(e) => setPolicyWizard((w) => ({ ...w, name: e.target.value }))}
                  placeholder="e.g. All users - sensitivity labels"
                />
              </Field>
              <Field label="Published to">
                <input
                  className={styles.input}
                  value={policyWizard.publishedTo}
                  onChange={(e) => setPolicyWizard((w) => ({ ...w, publishedTo: e.target.value }))}
                  placeholder="e.g. All users, Finance group"
                />
              </Field>
              <Field label="Default label">
                <NativeSelect
                  value={policyWizard.defaultLabel}
                  onChange={(v) => setPolicyWizard((w) => ({ ...w, defaultLabel: v }))}
                  options={policyWizard.labelIds.map((id) => ({ value: id, label: labelName(id) }))}
                />
              </Field>
              <Checkbox
                label="Require justification to remove or lower a label"
                checked={policyWizard.requireJustification}
                onChange={(v) => setPolicyWizard((w) => ({ ...w, requireJustification: v }))}
              />
              <Checkbox
                label="Mandatory labeling"
                checked={policyWizard.mandatory}
                onChange={(v) => setPolicyWizard((w) => ({ ...w, mandatory: v }))}
              />
            </>
          )}
        </Modal>
      ) : null}

      {/* ===== Create auto-labeling policy modal (2 steps) ===== */}
      {autoModalOpen ? (
        <Modal
          title="Create auto-labeling policy"
          onClose={() => setAutoModalOpen(false)}
          width="720px"
          steps={
            <>
              <WizStep label="Label & locations" active={autoStep === 0} done={autoStep > 0} onClick={() => setAutoStep(0)} />
              <WizStep label="Condition & mode" active={autoStep === 1} done={false} onClick={() => setAutoStep(1)} />
            </>
          }
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setAutoModalOpen(false)}>
                Cancel
              </button>
              <span style={{ flex: 1 }} />
              {autoStep === 1 ? (
                <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setAutoStep(0)}>
                  Back
                </button>
              ) : null}
              {autoStep === 0 ? (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    if (!autoWizard.name.trim()) {
                      toast.warning("Policy name is required.");
                      return;
                    }
                    setAutoStep(1);
                  }}
                >
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={finishAutoWizard}>
                  Create policy
                </button>
              )}
            </>
          }
        >
          {autoStep === 0 ? (
            <>
              <Field label="Policy name *">
                <input
                  className={styles.input}
                  value={autoWizard.name}
                  onChange={(e) => setAutoWizard((w) => ({ ...w, name: e.target.value }))}
                  placeholder="e.g. Auto-label PII as Customer Data"
                />
              </Field>
              <Field label="Label to apply">
                <NativeSelect
                  value={autoWizard.label}
                  onChange={(v) => setAutoWizard((w) => ({ ...w, label: v }))}
                  options={sortedLabels.map((l) => ({ value: l.id, label: l.name }))}
                />
              </Field>
              <Field label="Locations">
                <input
                  className={styles.input}
                  value={autoWizard.locations}
                  onChange={(e) => setAutoWizard((w) => ({ ...w, locations: e.target.value }))}
                  placeholder="e.g. SharePoint, OneDrive"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Detection condition">
                <NativeSelect
                  value={autoWizard.condition}
                  onChange={(v) => setAutoWizard((w) => ({ ...w, condition: v }))}
                  options={SIT_CONDITIONS.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Mode">
                <NativeSelect
                  value={autoWizard.mode}
                  onChange={(v) => setAutoWizard((w) => ({ ...w, mode: v as AutoWizardState["mode"] }))}
                  options={[
                    { value: "Simulation", label: "Run in simulation mode" },
                    { value: "On", label: "Turn on immediately" },
                    { value: "Off", label: "Keep off" },
                  ]}
                />
              </Field>
            </>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
