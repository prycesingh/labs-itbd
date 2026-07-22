"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { IntuneConfigProfile, IntuneDevice, IntuneState } from "@/lib/labs/simulators/intune/types";
import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import { Modal, WizStep, FormGroup, Pill, exportCsv } from "./intune-ui";
import styles from "./intune-console.module.css";

const PLATFORMS = ["Windows 10 and later", "iOS or iPadOS", "macOS", "Android Enterprise"];

const PROFILE_TYPES = [
  "Device restrictions",
  "Wi-Fi",
  "VPN",
  "Email",
  "Endpoint protection",
  "Identity protection",
  "Custom",
  "Administrative templates",
  "SCEP certificate",
  "Settings catalog",
  "Templates",
];

const WIZ_STEPS = ["Platform", "Profile type", "Configuration settings", "Scope tags", "Assignments", "Applicability rules", "Review"];

type WizardState = {
  platform: string;
  type: string;
  name: string;
  settings: Record<string, string | number | boolean>;
  scopeTags: string;
  assignedGroupId: string;
  applicabilityProperty: string;
  applicabilityOperator: string;
  applicabilityValue: string;
};

function freshWizardState(): WizardState {
  return {
    platform: PLATFORMS[0],
    type: PROFILE_TYPES[0],
    name: "",
    settings: {},
    scopeTags: "Default",
    assignedGroupId: "",
    applicabilityProperty: "OS edition",
    applicabilityOperator: "Equals",
    applicabilityValue: "",
  };
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
}

// Deployment status is derived from real device data rather than random fake numbers:
// devices are "targeted" when their platform family matches the profile's platform string,
// then split by compliance + check-in recency — Compliant with a check-in in the last 72h
// counts Succeeded, In-grace-period or a stale (>72h) Compliant check-in counts Pending,
// Not compliant counts Failed, and Not evaluated counts Pending (policy hasn't landed yet).
function platformMatches(devicePlatform: IntuneDevice["platform"], profilePlatform: string): boolean {
  const p = profilePlatform.toLowerCase();
  if (p.startsWith("windows")) return devicePlatform === "Windows";
  if (p.startsWith("ios") || p.startsWith("ipados")) return devicePlatform === "iOS" || devicePlatform === "iPadOS";
  if (p.startsWith("macos")) return devicePlatform === "macOS";
  if (p.startsWith("android")) return devicePlatform === "Android";
  return false;
}

function deriveDeploymentStatus(profile: IntuneConfigProfile, devices: IntuneDevice[]) {
  const targeted = devices.filter((d) => platformMatches(d.platform, profile.platform));
  let succeeded = 0;
  let pending = 0;
  let failed = 0;
  const now = Date.now();
  for (const d of targeted) {
    const hoursSinceCheckIn = (now - new Date(d.lastCheckIn).getTime()) / 3600000;
    if (d.compliance === "Not compliant") {
      failed++;
    } else if (d.compliance === "Not evaluated") {
      pending++;
    } else if (d.compliance === "In grace period") {
      pending++;
    } else if (d.compliance === "Compliant" && hoursSinceCheckIn <= 72) {
      succeeded++;
    } else {
      pending++;
    }
  }
  return { targeted: targeted.length, succeeded, pending, failed, conflict: 0 };
}

function DeviceRestrictionsForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="cfg-camera" checked={Boolean(settings.blockCamera)} onChange={(e) => onChange({ blockCamera: e.target.checked })} />
        <label htmlFor="cfg-camera">Block camera</label>
      </div>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="cfg-cortana" checked={Boolean(settings.blockCortana)} onChange={(e) => onChange({ blockCortana: e.target.checked })} />
        <label htmlFor="cfg-cortana">Block Cortana</label>
      </div>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="cfg-bt" checked={Boolean(settings.blockBluetooth)} onChange={(e) => onChange({ blockBluetooth: e.target.checked })} />
        <label htmlFor="cfg-bt">Block Bluetooth</label>
      </div>
    </>
  );
}

function WifiForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <>
      <FormGroup label="SSID">
        <input className={styles.input} value={String(settings.ssid ?? "")} onChange={(e) => onChange({ ssid: e.target.value })} placeholder="CorpWiFi" />
      </FormGroup>
      <FormGroup label="Security type">
        <select className={styles.select} value={String(settings.security ?? "WPA2-Enterprise")} onChange={(e) => onChange({ security: e.target.value })}>
          <option>WPA2-Enterprise</option>
          <option>WPA2-Personal</option>
          <option>Open</option>
        </select>
      </FormGroup>
    </>
  );
}

function VpnForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <>
      <FormGroup label="Connection type">
        <select className={styles.select} value={String(settings.connectionType ?? "IKEv2")} onChange={(e) => onChange({ connectionType: e.target.value })}>
          <option>IKEv2</option>
          <option>L2TP</option>
          <option>SSTP</option>
          <option>Automatic</option>
        </select>
      </FormGroup>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="cfg-alwayson" checked={Boolean(settings.alwaysOn)} onChange={(e) => onChange({ alwaysOn: e.target.checked })} />
        <label htmlFor="cfg-alwayson">Always On</label>
      </div>
    </>
  );
}

function EmailForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <>
      <FormGroup label="Email server">
        <input className={styles.input} value={String(settings.server ?? "")} onChange={(e) => onChange({ server: e.target.value })} placeholder="outlook.office365.com" />
      </FormGroup>
      <FormGroup label="Sync mail for">
        <select className={styles.select} value={String(settings.syncWindow ?? "1 week")} onChange={(e) => onChange({ syncWindow: e.target.value })}>
          <option>1 day</option>
          <option>3 days</option>
          <option>1 week</option>
          <option>2 weeks</option>
          <option>1 month</option>
        </select>
      </FormGroup>
    </>
  );
}

function EndpointProtectionForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="cfg-firewall" checked={Boolean(settings.firewall)} onChange={(e) => onChange({ firewall: e.target.checked })} />
        <label htmlFor="cfg-firewall">Microsoft Defender Firewall</label>
      </div>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="cfg-defender" checked={Boolean(settings.defenderRealtime)} onChange={(e) => onChange({ defenderRealtime: e.target.checked })} />
        <label htmlFor="cfg-defender">Defender real-time protection</label>
      </div>
    </>
  );
}

function CustomForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <>
      <FormGroup label="OMA-URI">
        <input className={styles.input} value={String(settings.omaUri ?? "")} onChange={(e) => onChange({ omaUri: e.target.value })} placeholder="./Vendor/MSFT/Policy/Config/..." />
      </FormGroup>
      <FormGroup label="Value">
        <input className={styles.input} value={String(settings.value ?? "")} onChange={(e) => onChange({ value: e.target.value })} placeholder="0" />
      </FormGroup>
    </>
  );
}

function GenericForm({ settings, onChange }: { settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  return (
    <FormGroup label="Settings" help="Describe the settings this profile should apply.">
      <textarea className={styles.textarea} rows={4} value={String(settings.notes ?? "")} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Name your settings" />
    </FormGroup>
  );
}

function ConfigSettingsForm({ type, settings, onChange }: { type: string; settings: Record<string, string | number | boolean>; onChange: (patch: Record<string, string | number | boolean>) => void }) {
  if (type === "Device restrictions") return <DeviceRestrictionsForm settings={settings} onChange={onChange} />;
  if (type === "Wi-Fi") return <WifiForm settings={settings} onChange={onChange} />;
  if (type === "VPN") return <VpnForm settings={settings} onChange={onChange} />;
  if (type === "Email") return <EmailForm settings={settings} onChange={onChange} />;
  if (type === "Endpoint protection") return <EndpointProtectionForm settings={settings} onChange={onChange} />;
  if (type === "Custom") return <CustomForm settings={settings} onChange={onChange} />;
  return <GenericForm settings={settings} onChange={onChange} />;
}

function ConfigWizard({ state, dispatch, onClose }: { state: IntuneState; dispatch: (action: IntuneAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [wiz, setWiz] = useState<WizardState>(freshWizardState());

  const patchSettings = (patch: Record<string, string | number | boolean>) => setWiz((w) => ({ ...w, settings: { ...w.settings, ...patch } }));

  const finish = () => {
    if (!wiz.name.trim()) {
      toast.error("Name is required.");
      setStep(2);
      return;
    }
    const group = state.groups.find((g) => g.id === wiz.assignedGroupId) ?? state.groups[0];
    const profile: IntuneConfigProfile = {
      id: `pr-${crypto.randomUUID()}`,
      name: wiz.name.trim(),
      platform: wiz.platform,
      type: wiz.type,
      status: "Assigned",
      assigned: group?.id ?? "",
      lastModified: new Date().toISOString().slice(0, 10),
      settings: wiz.settings,
    };
    dispatch({ type: "ADD_CONFIG_PROFILE", profile });
    toast.success("Configuration profile created");
    onClose();
  };

  const steps = (
    <>
      {WIZ_STEPS.map((label, i) => (
        <WizStep key={label} label={`${i + 1} ${label}`} active={i === step} done={i < step} />
      ))}
    </>
  );

  const footer = (
    <>
      <button type="button" className={styles.btnOutline} onClick={onClose}>
        Cancel
      </button>
      <div className={styles.spacer} />
      {step > 0 ? (
        <button type="button" className={styles.btnOutline} onClick={() => setStep((s) => s - 1)}>
          Previous
        </button>
      ) : null}
      {step < WIZ_STEPS.length - 1 ? (
        <button type="button" className={styles.btn} onClick={() => setStep((s) => s + 1)}>
          Next
        </button>
      ) : (
        <button type="button" className={styles.btn} onClick={finish}>
          Create
        </button>
      )}
    </>
  );

  return (
    <Modal title="Create a profile" onClose={onClose} width="820px" steps={steps} footer={footer}>
      {step === 0 ? (
        <FormGroup label="Platform">
          <select className={styles.select} value={wiz.platform} onChange={(e) => setWiz((w) => ({ ...w, platform: e.target.value }))}>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </FormGroup>
      ) : null}

      {step === 1 ? (
        <FormGroup label="Profile type">
          <select className={styles.select} value={wiz.type} onChange={(e) => setWiz((w) => ({ ...w, type: e.target.value, settings: {} }))}>
            {PROFILE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </FormGroup>
      ) : null}

      {step === 2 ? (
        <>
          <FormGroup label="Name">
            <input className={styles.input} value={wiz.name} onChange={(e) => setWiz((w) => ({ ...w, name: e.target.value }))} placeholder={`e.g., ${wiz.type}`} />
          </FormGroup>
          <ConfigSettingsForm type={wiz.type} settings={wiz.settings} onChange={patchSettings} />
        </>
      ) : null}

      {step === 3 ? (
        <FormGroup label="Scope tags" help="Filter access for delegated administrators (decorative).">
          <input className={styles.input} value={wiz.scopeTags} onChange={(e) => setWiz((w) => ({ ...w, scopeTags: e.target.value }))} />
        </FormGroup>
      ) : null}

      {step === 4 ? (
        <FormGroup label="Assigned group">
          <select className={styles.select} value={wiz.assignedGroupId} onChange={(e) => setWiz((w) => ({ ...w, assignedGroupId: e.target.value }))}>
            <option value="">Select a group</option>
            {state.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormGroup>
      ) : null}

      {step === 5 ? (
        <>
          <p className={styles.muted}>Apply this profile only when the rule criteria are met.</p>
          <FormGroup label="Property">
            <select className={styles.select} value={wiz.applicabilityProperty} onChange={(e) => setWiz((w) => ({ ...w, applicabilityProperty: e.target.value }))}>
              <option>OS edition</option>
              <option>OS version</option>
            </select>
          </FormGroup>
          <FormGroup label="Operator">
            <select className={styles.select} value={wiz.applicabilityOperator} onChange={(e) => setWiz((w) => ({ ...w, applicabilityOperator: e.target.value }))}>
              <option>Equals</option>
              <option>Not equals</option>
              <option>Greater than or equal</option>
            </select>
          </FormGroup>
          <FormGroup label="Value">
            <input className={styles.input} value={wiz.applicabilityValue} onChange={(e) => setWiz((w) => ({ ...w, applicabilityValue: e.target.value }))} placeholder="Windows 11 Enterprise" />
          </FormGroup>
        </>
      ) : null}

      {step === 6 ? (
        <div className={styles.reviewGrid}>
          <div className="lbl">Platform</div>
          <div>{wiz.platform}</div>
          <div className="lbl">Profile type</div>
          <div>{wiz.type}</div>
          <div className="lbl">Name</div>
          <div>{wiz.name || "(not set)"}</div>
          <div className="lbl">Scope tags</div>
          <div>{wiz.scopeTags || "—"}</div>
          <div className="lbl">Assigned group</div>
          <div>{state.groups.find((g) => g.id === wiz.assignedGroupId)?.name ?? "(not set)"}</div>
          <div className="lbl">Applicability rule</div>
          <div>
            {wiz.applicabilityValue ? `${wiz.applicabilityProperty} ${wiz.applicabilityOperator} ${wiz.applicabilityValue}` : "None"}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function ConfigDetail({ profile, state, dispatch, onBack }: { profile: IntuneConfigProfile; state: IntuneState; dispatch: (action: IntuneAction) => void; onBack: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [assignedGroupId, setAssignedGroupId] = useState(profile.assigned);

  const groupName = state.groups.find((g) => g.id === profile.assigned)?.name ?? profile.assigned;
  const deployment = deriveDeploymentStatus(profile, state.devices);

  const saveEdits = () => {
    dispatch({ type: "UPDATE_CONFIG_PROFILE", id: profile.id, patch: { name: name.trim() || profile.name, assigned: assignedGroupId } });
    toast.success("Profile updated");
    setEditing(false);
  };

  const duplicate = () => {
    const copy: IntuneConfigProfile = { ...profile, id: `pr-${crypto.randomUUID()}`, name: `${profile.name} (copy)`, lastModified: new Date().toISOString().slice(0, 10) };
    dispatch({ type: "ADD_CONFIG_PROFILE", profile: copy });
    toast.success("Profile duplicated");
  };

  const remove = () => {
    if (!confirm(`Delete profile "${profile.name}"?`)) return;
    dispatch({ type: "DELETE_CONFIG_PROFILE", id: profile.id });
    toast.success("Profile deleted");
    onBack();
  };

  return (
    <div>
      <button type="button" className={styles.btnSubtle} onClick={onBack}>
        &lt; Back to configuration profiles
      </button>
      <h1 className={styles.pageH1}>{profile.name}</h1>
      <p className={styles.pageSub}>
        {profile.platform} · {profile.type}
      </p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button type="button" className={styles.tbBtn} onClick={duplicate}>
          Duplicate
        </button>
        <button type="button" className={styles.tbBtn} onClick={remove}>
          Delete
        </button>
      </div>

      {editing ? (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Edit profile</div>
          <FormGroup label="Name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </FormGroup>
          <FormGroup label="Assigned group">
            <select className={styles.select} value={assignedGroupId} onChange={(e) => setAssignedGroupId(e.target.value)}>
              {state.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FormGroup>
          <button type="button" className={styles.btn} onClick={saveEdits}>
            Save
          </button>
        </div>
      ) : null}

      <div className={styles.formRow}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Essentials</div>
          <div className={styles.reviewGrid}>
            <div className="lbl">Name</div>
            <div>{profile.name}</div>
            <div className="lbl">Platform</div>
            <div>{profile.platform}</div>
            <div className="lbl">Type</div>
            <div>{profile.type}</div>
            <div className="lbl">Assigned</div>
            <div>{groupName}</div>
            <div className="lbl">Last modified</div>
            <div>{profile.lastModified}</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Deployment status</div>
          <div className={styles.reviewGrid}>
            <div className="lbl">Targeted devices</div>
            <div>{deployment.targeted}</div>
            <div className="lbl">Succeeded</div>
            <div>
              <Pill tone="ok">{deployment.succeeded}</Pill>
            </div>
            <div className="lbl">Pending</div>
            <div>
              <Pill tone="warn">{deployment.pending}</Pill>
            </div>
            <div className="lbl">Failed</div>
            <div>
              <Pill tone="err">{deployment.failed}</Pill>
            </div>
            <div className="lbl">Conflict</div>
            <div>
              <Pill tone="muted">{deployment.conflict}</Pill>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Configured settings</div>
        {Object.keys(profile.settings).length === 0 ? (
          <div className={styles.emptyState}>No settings configured for this profile.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(profile.settings).map(([key, value]) => (
                  <tr key={key}>
                    <td>{humanizeKey(key)}</td>
                    <td>{humanizeValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfigPage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const selected = state.configProfiles.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return <ConfigDetail profile={selected} state={state} dispatch={dispatch} onBack={() => setSelectedId(null)} />;
  }

  const exportProfiles = () => {
    exportCsv(
      "configuration-profiles.csv",
      ["Name", "Platform", "Type", "Status", "Assigned to", "Last modified"],
      state.configProfiles.map((p) => [p.name, p.platform, p.type, p.status, state.groups.find((g) => g.id === p.assigned)?.name ?? p.assigned, p.lastModified]),
    );
  };

  return (
    <div>
      <h1 className={styles.pageH1}>Configuration</h1>
      <p className={styles.pageSub}>Create profiles to apply settings to managed devices.</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setShowWizard(true)}>
          + Create profile
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={exportProfiles}>
          Export CSV
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Profile name</th>
              <th>Platform</th>
              <th>Profile type</th>
              <th>Status</th>
              <th>Assigned to</th>
              <th>Last modified</th>
            </tr>
          </thead>
          <tbody>
            {state.configProfiles.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.center}>
                  No configuration profiles.
                </td>
              </tr>
            ) : (
              state.configProfiles.map((p) => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                  <td className={styles.rowLink}>{p.name}</td>
                  <td>{p.platform}</td>
                  <td>{p.type}</td>
                  <td>
                    <Pill tone={p.status === "Assigned" ? "ok" : "muted"}>{p.status}</Pill>
                  </td>
                  <td>{state.groups.find((g) => g.id === p.assigned)?.name ?? p.assigned}</td>
                  <td>{p.lastModified}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className={styles.muted} style={{ marginTop: 12 }}>
        Update rings, quality/feature/driver updates, and endpoint analytics tabs are not simulated (other profile types coming soon).
      </p>

      {showWizard ? <ConfigWizard state={state} dispatch={dispatch} onClose={() => setShowWizard(false)} /> : null}
    </div>
  );
}
