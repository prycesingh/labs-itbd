"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import { policyComplianceSummary } from "@/lib/labs/simulators/intune/compliance";
import type { IntuneCompliancePolicy, IntuneCompliancePolicySettings, IntuneState } from "@/lib/labs/simulators/intune/types";
import { exportCsv, FormGroup, Modal, Pill, WizStep } from "./intune-ui";
import styles from "./intune-console.module.css";

const TOP_TABS = ["Policies", "Notifications", "Compliance policy settings", "Locations", "Scripts"] as const;
type TopTab = (typeof TOP_TABS)[number];

const WIZ_STEPS = ["1 Basics", "2 Compliance settings", "3 Actions for noncompliance", "4 Scope tags", "5 Assignments", "6 Review + create"];

const PLATFORM_OPTIONS = ["Windows 10 and later", "iOS/iPadOS", "macOS", "Android Enterprise"] as const;
type PlatformOption = (typeof PLATFORM_OPTIONS)[number];

const NONCOMPLIANCE_ACTION_TYPES = ["Mark device noncompliant", "Send email to end user", "Send push notification", "Retire noncompliant device"];

function platformType(platform: PlatformOption): string {
  if (platform === "Windows 10 and later") return "Windows 10/11 compliance policy";
  if (platform === "iOS/iPadOS") return "iOS compliance policy";
  if (platform === "macOS") return "macOS compliance policy";
  return "Android compliance policy";
}

function defaultSettingsFor(platform: PlatformOption): IntuneCompliancePolicySettings {
  if (platform === "Windows 10 and later") {
    return { bitlocker: true, secureBoot: true, minOsVersion: "10.0.22000", passwordRequired: true, minPwLength: 8, defenderAtpLevel: "Low" };
  }
  if (platform === "macOS") {
    return { filevault: true, passwordRequired: true, minPwLength: 8, minOsVersion: "13.0" };
  }
  if (platform === "Android Enterprise") {
    return { encryptionRequired: true, blockRooted: true, minOsVersion: "12", defenderAtpLevel: "Low" };
  }
  return { passcodeRequired: true, blockJailbroken: true, minPwLength: 6, minOsVersion: "16.0" };
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeValue(value: string | number | boolean): string {
  if (value === true) return "Required";
  if (value === false) return "Not required";
  return String(value);
}

type WizardDraft = {
  name: string;
  platform: PlatformOption;
  settings: IntuneCompliancePolicySettings;
  actions: { action: string; scheduleDays: number }[];
  scopeTags: string;
  assignedGroupId: string;
};

function emptyDraft(defaultGroupId: string): WizardDraft {
  return {
    name: "",
    platform: "Windows 10 and later",
    settings: defaultSettingsFor("Windows 10 and later"),
    actions: [{ action: "Mark device noncompliant", scheduleDays: 0 }],
    scopeTags: "Default",
    assignedGroupId: defaultGroupId,
  };
}

export function CompliancePage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [tab, setTab] = useState<TopTab>("Policies");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStep, setWizStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(() => emptyDraft(state.groups[0]?.id ?? ""));

  const selected = state.compliancePolicies.find((p) => p.id === selectedId) ?? null;

  function groupName(id: string): string {
    return state.groups.find((g) => g.id === id)?.name ?? id;
  }

  function openWizard() {
    setDraft(emptyDraft(state.groups[0]?.id ?? ""));
    setWizStep(0);
    setWizardOpen(true);
  }

  function setPlatform(platform: PlatformOption) {
    setDraft((d) => ({ ...d, platform, settings: defaultSettingsFor(platform) }));
  }

  function setSetting(key: string, value: string | number | boolean) {
    setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  }

  function addActionRow() {
    setDraft((d) => ({ ...d, actions: [...d.actions, { action: "Send email to end user", scheduleDays: 0 }] }));
  }

  function removeActionRow(index: number) {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== index) }));
  }

  function updateActionRow(index: number, patch: Partial<{ action: string; scheduleDays: number }>) {
    setDraft((d) => ({ ...d, actions: d.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)) }));
  }

  function finishWizard() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      setWizStep(0);
      return;
    }
    const policy: IntuneCompliancePolicy = {
      id: `cp-${crypto.randomUUID().slice(0, 8)}`,
      name: draft.name.trim(),
      platform: draft.platform,
      type: platformType(draft.platform),
      assigned: draft.assignedGroupId,
      lastModified: new Date().toISOString().slice(0, 10),
      settings: draft.settings,
      nonComplianceActions: draft.actions,
    };
    dispatch({ type: "ADD_COMPLIANCE_POLICY", policy });
    toast.success(`Compliance policy "${policy.name}" created.`);
    setWizardOpen(false);
  }

  if (selected) {
    return (
      <PolicyDetail
        policy={selected}
        state={state}
        dispatch={dispatch}
        groupName={groupName}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Compliance policies</h1>
      <p className={styles.pageSub}>Define rules and settings that users and devices must meet to be compliant.</p>

      <div className={styles.subtabs}>
        {TOP_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.subtab} ${tab === t ? styles.subtabActive : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Policies" ? (
        <div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={openWizard}>
              + Create policy
            </button>
            <div className={styles.tbSep} />
            <button
              type="button"
              className={styles.tbBtn}
              onClick={() =>
                exportCsv(
                  "compliance-policies.csv",
                  ["Name", "Platform", "Type", "Assigned", "Last modified"],
                  state.compliancePolicies.map((p) => [p.name, p.platform, p.type, groupName(p.assigned), p.lastModified]),
                )
              }
            >
              Export
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Policy name</th>
                  <th>Platform</th>
                  <th>Policy type</th>
                  <th>Assigned</th>
                  <th>Last modified</th>
                </tr>
              </thead>
              <tbody>
                {state.compliancePolicies.length ? (
                  state.compliancePolicies.map((p) => (
                    <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                      <td className={styles.rowLink}>{p.name}</td>
                      <td>{p.platform}</td>
                      <td>{p.type}</td>
                      <td>{groupName(p.assigned)}</td>
                      <td>{p.lastModified}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.center}>
                      No compliance policies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "Notifications" ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Notification message templates</div>
          <p className={styles.muted}>Send branded email notifications to users whose devices fall out of compliance.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Last modified</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Noncompliance default</td>
                  <td>Your device is not compliant</td>
                  <td>2026-03-10</td>
                </tr>
                <tr>
                  <td>Grace period reminder</td>
                  <td>Action required: bring device into compliance</td>
                  <td>2026-04-01</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => toast.info("Notification templates aren't wired up in this simulator.")}>
            + Create
          </button>
        </div>
      ) : null}

      {tab === "Compliance policy settings" ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Compliance policy settings</div>
          <p className={styles.muted}>Tenant-wide compliance evaluation settings.</p>
          <div className={styles.reviewGrid}>
            <div className="lbl">Mark devices with no compliance policy assigned as</div>
            <div>
              <Pill tone="ok">Compliant</Pill>
            </div>
          </div>
          <div className={styles.reviewGrid}>
            <div className="lbl">Enhanced jailbreak detection (iOS/iPadOS)</div>
            <div>
              <Pill tone="muted">Disabled</Pill>
            </div>
          </div>
          <div className={styles.reviewGrid}>
            <div className="lbl">Compliance status validity period (days)</div>
            <div>30</div>
          </div>
        </div>
      ) : null}

      {tab === "Locations" ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Network locations</div>
          <p className={styles.muted}>Define network locations (IPv4 ranges) used by compliance policies.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IPv4 range</th>
                  <th>Used by</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Corporate Office HQ</td>
                  <td>10.10.0.0/16</td>
                  <td>2 policies</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => toast.info("Network locations aren't wired up in this simulator.")}>
            + Create
          </button>
        </div>
      ) : null}

      {tab === "Scripts" ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Custom compliance scripts</div>
          <p className={styles.muted}>Use PowerShell or Shell scripts to evaluate custom compliance signals.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Platform</th>
                  <th>Last modified</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Check antivirus running</td>
                  <td>Windows</td>
                  <td>2026-04-05</td>
                </tr>
                <tr>
                  <td>Check Gatekeeper enabled</td>
                  <td>macOS</td>
                  <td>2026-03-22</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => toast.info("Custom compliance scripts aren't wired up in this simulator.")}>
            + Create script
          </button>
        </div>
      ) : null}

      {wizardOpen ? (
        <Modal
          title="Create compliance policy"
          width="820px"
          onClose={() => setWizardOpen(false)}
          steps={WIZ_STEPS.map((label, i) => (
            <WizStep key={label} label={label} active={i === wizStep} done={i < wizStep} />
          ))}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setWizardOpen(false)}>
                Cancel
              </button>
              {wizStep > 0 ? (
                <button type="button" className={styles.btnOutline} onClick={() => setWizStep((s) => s - 1)}>
                  Previous
                </button>
              ) : null}
              {wizStep < WIZ_STEPS.length - 1 ? (
                <button type="button" className={styles.btn} onClick={() => setWizStep((s) => s + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={finishWizard}>
                  Create
                </button>
              )}
            </>
          }
        >
          {wizStep === 0 ? (
            <div>
              <FormGroup label="Platform *">
                <select className={styles.select} value={draft.platform} onChange={(e) => setPlatform(e.target.value as PlatformOption)}>
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Profile type">
                <input className={styles.input} disabled value={platformType(draft.platform)} />
              </FormGroup>
              <FormGroup label="Name *">
                <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g., Windows 11 compliance" />
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 1 ? <ComplianceSettingsForm platform={draft.platform} settings={draft.settings} onChange={setSetting} /> : null}

          {wizStep === 2 ? (
            <div>
              <p className={styles.muted}>Specify the sequence of actions to take when a device is noncompliant.</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Schedule</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.actions.map((a, i) => (
                      <tr key={i}>
                        <td>
                          <select className={styles.select} value={a.action} onChange={(e) => updateActionRow(i, { action: e.target.value })}>
                            {NONCOMPLIANCE_ACTION_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={365}
                            className={styles.input}
                            value={a.scheduleDays}
                            onChange={(e) => updateActionRow(i, { scheduleDays: parseInt(e.target.value, 10) || 0 })}
                          />{" "}
                          day(s) after noncompliance
                        </td>
                        <td>
                          <button type="button" className={styles.btnSubtle} onClick={() => removeActionRow(i)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className={styles.btnSubtle} style={{ marginTop: 12 }} onClick={addActionRow}>
                + Add action
              </button>
            </div>
          ) : null}

          {wizStep === 3 ? (
            <div>
              <FormGroup label="Scope tags" help="Filter access for delegated administrators. Decorative in this simulator.">
                <input className={styles.input} value={draft.scopeTags} onChange={(e) => setDraft((d) => ({ ...d, scopeTags: e.target.value }))} />
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 4 ? (
            <div>
              <p className={styles.muted}>Select the group to which this policy applies.</p>
              <FormGroup label="Assigned group">
                <select className={styles.select} value={draft.assignedGroupId} onChange={(e) => setDraft((d) => ({ ...d, assignedGroupId: e.target.value }))}>
                  {state.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.members} members)
                    </option>
                  ))}
                </select>
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 5 ? (
            <div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Name</div>
                <div>{draft.name || "(not set)"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Platform</div>
                <div>{draft.platform}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Profile type</div>
                <div>{platformType(draft.platform)}</div>
              </div>
              {Object.entries(draft.settings).map(([key, value]) => (
                <div className={styles.reviewGrid} key={key}>
                  <div className="lbl">{humanizeKey(key)}</div>
                  <div>{humanizeValue(value)}</div>
                </div>
              ))}
              {draft.actions.map((a, i) => (
                <div className={styles.reviewGrid} key={i}>
                  <div className="lbl">{a.action}</div>
                  <div>{a.scheduleDays} day(s)</div>
                </div>
              ))}
              <div className={styles.reviewGrid}>
                <div className="lbl">Scope tags</div>
                <div>{draft.scopeTags || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Assigned to</div>
                <div>{groupName(draft.assignedGroupId)}</div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function ComplianceSettingsForm({
  platform,
  settings,
  onChange,
}: {
  platform: PlatformOption;
  settings: IntuneCompliancePolicySettings;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  if (platform === "Windows 10 and later") {
    return (
      <div>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.bitlocker)} onChange={(e) => onChange("bitlocker", e.target.checked)} />
          Require BitLocker
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.secureBoot)} onChange={(e) => onChange("secureBoot", e.target.checked)} />
          Require Secure Boot
        </label>
        <FormGroup label="Minimum OS version">
          <input className={styles.input} value={String(settings.minOsVersion ?? "")} onChange={(e) => onChange("minOsVersion", e.target.value)} />
        </FormGroup>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.passwordRequired)} onChange={(e) => onChange("passwordRequired", e.target.checked)} />
          Require password to unlock devices
        </label>
        <FormGroup label="Minimum password length">
          <input
            type="number"
            min={1}
            max={32}
            className={styles.input}
            value={Number(settings.minPwLength ?? 0)}
            onChange={(e) => onChange("minPwLength", parseInt(e.target.value, 10) || 0)}
          />
        </FormGroup>
        <FormGroup label="Microsoft Defender machine risk score">
          <select className={styles.select} value={String(settings.defenderAtpLevel ?? "Low")} onChange={(e) => onChange("defenderAtpLevel", e.target.value)}>
            {["Clear", "Low", "Medium", "High", "Not configured"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FormGroup>
      </div>
    );
  }

  if (platform === "macOS") {
    return (
      <div>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.filevault)} onChange={(e) => onChange("filevault", e.target.checked)} />
          Require FileVault
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.passwordRequired)} onChange={(e) => onChange("passwordRequired", e.target.checked)} />
          Require password to unlock devices
        </label>
        <FormGroup label="Minimum password length">
          <input
            type="number"
            min={1}
            max={32}
            className={styles.input}
            value={Number(settings.minPwLength ?? 0)}
            onChange={(e) => onChange("minPwLength", parseInt(e.target.value, 10) || 0)}
          />
        </FormGroup>
        <FormGroup label="Minimum OS version">
          <input className={styles.input} value={String(settings.minOsVersion ?? "")} onChange={(e) => onChange("minOsVersion", e.target.value)} />
        </FormGroup>
      </div>
    );
  }

  // iOS/iPadOS and Android Enterprise
  const blockKey = platform === "Android Enterprise" ? "blockRooted" : "blockJailbroken";
  const blockLabel = platform === "Android Enterprise" ? "Block rooted devices" : "Block jailbroken devices";
  return (
    <div>
      {platform === "Android Enterprise" ? (
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.encryptionRequired)} onChange={(e) => onChange("encryptionRequired", e.target.checked)} />
          Require device encryption
        </label>
      ) : (
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={Boolean(settings.passcodeRequired)} onChange={(e) => onChange("passcodeRequired", e.target.checked)} />
          Require passcode
        </label>
      )}
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={Boolean(settings[blockKey])} onChange={(e) => onChange(blockKey, e.target.checked)} />
        {blockLabel}
      </label>
      <FormGroup label="Minimum password length">
        <input
          type="number"
          min={1}
          max={32}
          className={styles.input}
          value={Number(settings.minPwLength ?? 0)}
          onChange={(e) => onChange("minPwLength", parseInt(e.target.value, 10) || 0)}
        />
      </FormGroup>
      <FormGroup label="Minimum OS version">
        <input className={styles.input} value={String(settings.minOsVersion ?? "")} onChange={(e) => onChange("minOsVersion", e.target.value)} />
      </FormGroup>
    </div>
  );
}

function PolicyDetail({
  policy,
  state,
  dispatch,
  groupName,
  onBack,
}: {
  policy: IntuneCompliancePolicy;
  state: IntuneState;
  dispatch: (action: IntuneAction) => void;
  groupName: (id: string) => string;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(policy.name);
  const [editAssigned, setEditAssigned] = useState(policy.assigned);

  const summary = useMemo(() => policyComplianceSummary(policy, state.devices), [policy, state.devices]);
  const nonCompliantRows = summary.results.filter((r) => !r.result.compliant);

  function startEdit() {
    setEditName(policy.name);
    setEditAssigned(policy.assigned);
    setEditing(true);
  }

  function saveEdit() {
    if (!editName.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    dispatch({ type: "UPDATE_COMPLIANCE_POLICY", id: policy.id, patch: { name: editName.trim(), assigned: editAssigned } });
    toast.success("Policy updated.");
    setEditing(false);
  }

  function duplicate() {
    const copy: IntuneCompliancePolicy = {
      ...policy,
      id: `cp-${crypto.randomUUID().slice(0, 8)}`,
      name: `${policy.name} (copy)`,
      lastModified: new Date().toISOString().slice(0, 10),
    };
    dispatch({ type: "ADD_COMPLIANCE_POLICY", policy: copy });
    toast.success("Policy duplicated.");
  }

  function remove() {
    if (!confirm(`Delete policy "${policy.name}"?`)) return;
    dispatch({ type: "DELETE_COMPLIANCE_POLICY", id: policy.id });
    toast.success("Policy deleted.");
    onBack();
  }

  return (
    <div>
      <button type="button" className={styles.btnSubtle} onClick={onBack}>
        &lt; Back to compliance policies
      </button>
      <h1 className={styles.pageH1}>{policy.name}</h1>
      <p className={styles.pageSub}>
        {policy.platform} &middot; {policy.type}
      </p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={startEdit}>
          Edit
        </button>
        <button type="button" className={styles.tbBtn} onClick={duplicate}>
          Duplicate
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={remove}>
          Delete
        </button>
      </div>

      {editing ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Edit policy</div>
          <FormGroup label="Name">
            <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} />
          </FormGroup>
          <FormGroup label="Assigned group">
            <select className={styles.select} value={editAssigned} onChange={(e) => setEditAssigned(e.target.value)}>
              {state.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FormGroup>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={styles.btn} onClick={saveEdit}>
              Save
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardTitle}>Essentials</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Name</div>
          <div>{policy.name}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Platform</div>
          <div>{policy.platform}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Type</div>
          <div>{policy.type}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Assigned</div>
          <div>{groupName(policy.assigned)}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Last modified</div>
          <div>{policy.lastModified}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Compliance summary</div>
        <StatsRow total={summary.total} compliant={summary.compliant} nonCompliant={summary.nonCompliant} />
        {nonCompliantRows.length ? (
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Primary user</th>
                  <th>Reasons</th>
                </tr>
              </thead>
              <tbody>
                {nonCompliantRows.map(({ device, result }) => (
                  <tr key={device.id}>
                    <td>{device.name}</td>
                    <td>{device.primaryUser}</td>
                    <td>{result.failedSettings.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted} style={{ marginTop: 12 }}>
            All applicable devices are compliant with this policy.
          </p>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Configured settings</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(policy.settings).map(([key, value]) => (
                <tr key={key}>
                  <td>{humanizeKey(key)}</td>
                  <td>{humanizeValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatsRow({ total, compliant, nonCompliant }: { total: number; compliant: number; nonCompliant: number }) {
  return (
    <div className={styles.statRow}>
      <div className={styles.stat}>
        <div className={styles.statVal}>{total}</div>
        <div className={styles.statLabel}>Applicable devices</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statVal}>{compliant}</div>
        <div className={styles.statLabel}>Compliant</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statVal}>{nonCompliant}</div>
        <div className={styles.statLabel}>Not compliant</div>
      </div>
    </div>
  );
}
