"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { IntuneAutopilotProfile, IntuneState } from "@/lib/labs/simulators/intune/types";
import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import { Modal, WizStep, FormGroup, Pill } from "./intune-ui";
import styles from "./intune-console.module.css";

type AutopilotTab = "devices" | "profiles" | "esp" | "hash";

const TABS: { id: AutopilotTab; label: string }[] = [
  { id: "devices", label: "Devices" },
  { id: "profiles", label: "Deployment Profiles" },
  { id: "esp", label: "Enrollment Status Page" },
  { id: "hash", label: "Hardware Hash" },
];

const WIZ_STEPS = ["Basics", "Out-of-box experience (OOBE)", "Scope tags", "Assignments", "Review + create"];

const DEPLOYMENT_MODES: IntuneAutopilotProfile["mode"][] = ["User-driven", "Self-deploying", "Pre-provisioning"];
const JOIN_TYPES: Array<"Entra joined" | "Entra hybrid joined"> = ["Entra joined", "Entra hybrid joined"];
const ACCOUNT_TYPES: IntuneAutopilotProfile["userAccountType"][] = ["Standard", "Administrator"];

const SAMPLE_SERIAL = "PF2ABC123456";

function randomToken(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Expands the %RAND:n% / %SERIAL% placeholders used by real Autopilot device name
// templates so admins can preview what an enrolled device would actually be named.
function expandDeviceNameTemplate(template: string): string {
  if (!template) return "";
  return template.replace(/%RAND:(\d+)%/gi, (_m, n) => randomToken(Number(n))).replace(/%SERIAL%/gi, SAMPLE_SERIAL);
}

type WizardState = {
  name: string;
  mode: IntuneAutopilotProfile["mode"];
  joinType: IntuneAutopilotProfile["joinType"];
  skipEula: boolean;
  hideAccountOptions: boolean;
  userAccountType: IntuneAutopilotProfile["userAccountType"];
  deviceNameTemplate: string;
  scopeTags: string;
  assignedGroupId: string;
};

function freshWizardState(defaultGroupId: string): WizardState {
  return {
    name: "",
    mode: "User-driven",
    joinType: "Entra joined",
    skipEula: true,
    hideAccountOptions: true,
    userAccountType: "Standard",
    deviceNameTemplate: "CL-%RAND:5%",
    scopeTags: "Default",
    assignedGroupId: defaultGroupId,
  };
}

function ProfileWizard({ state, dispatch, onClose }: { state: IntuneState; dispatch: (action: IntuneAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [wiz, setWiz] = useState<WizardState>(() => freshWizardState(state.groups[0]?.id ?? ""));

  const finish = () => {
    if (!wiz.name.trim()) {
      toast.error("Name is required.");
      setStep(0);
      return;
    }
    const profile: IntuneAutopilotProfile = {
      id: `apr-${crypto.randomUUID()}`,
      name: wiz.name.trim(),
      mode: wiz.mode,
      joinType: wiz.joinType,
      assigned: wiz.assignedGroupId || (state.groups[0]?.id ?? ""),
      skipEula: wiz.skipEula,
      hideAccountOptions: wiz.hideAccountOptions,
      userAccountType: wiz.userAccountType,
      deviceNameTemplate: wiz.deviceNameTemplate,
    };
    dispatch({ type: "ADD_AUTOPILOT_PROFILE", profile });
    toast.success("Autopilot profile created");
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
    <Modal title="Create deployment profile" onClose={onClose} width="820px" steps={steps} footer={footer}>
      {step === 0 ? (
        <FormGroup label="Name" help="e.g., Pilot - User-driven">
          <input className={styles.input} value={wiz.name} onChange={(e) => setWiz((w) => ({ ...w, name: e.target.value }))} placeholder="e.g., Pilot - User-driven" />
        </FormGroup>
      ) : null}

      {step === 1 ? (
        <>
          <FormGroup label="Deployment mode">
            {DEPLOYMENT_MODES.map((m) => (
              <div key={m} className={styles.radioRow}>
                <input type="radio" id={`ap-mode-${m}`} name="ap-mode" checked={wiz.mode === m} onChange={() => setWiz((w) => ({ ...w, mode: m }))} />
                <label htmlFor={`ap-mode-${m}`}>{m}</label>
              </div>
            ))}
          </FormGroup>

          <FormGroup label="Join to Entra ID as">
            {JOIN_TYPES.map((j) => (
              <div key={j} className={styles.radioRow}>
                <input type="radio" id={`ap-join-${j}`} name="ap-join" checked={wiz.joinType === j} onChange={() => setWiz((w) => ({ ...w, joinType: j }))} />
                <label htmlFor={`ap-join-${j}`}>{j}</label>
              </div>
            ))}
          </FormGroup>

          <div className={styles.checkboxRow}>
            <input type="checkbox" id="ap-skip-eula" checked={wiz.skipEula} onChange={(e) => setWiz((w) => ({ ...w, skipEula: e.target.checked }))} />
            <label htmlFor="ap-skip-eula">Skip Microsoft Software License Terms</label>
          </div>

          <div className={styles.checkboxRow}>
            <input type="checkbox" id="ap-hide-account" checked={wiz.hideAccountOptions} onChange={(e) => setWiz((w) => ({ ...w, hideAccountOptions: e.target.checked }))} />
            <label htmlFor="ap-hide-account">Hide change account options</label>
          </div>

          <FormGroup label="User account type">
            {ACCOUNT_TYPES.map((a) => (
              <div key={a} className={styles.radioRow}>
                <input type="radio" id={`ap-account-${a}`} name="ap-account" checked={wiz.userAccountType === a} onChange={() => setWiz((w) => ({ ...w, userAccountType: a }))} />
                <label htmlFor={`ap-account-${a}`}>{a}</label>
              </div>
            ))}
          </FormGroup>

          <FormGroup label="Device name template" help="Use %RAND:n% for n random characters (e.g. %RAND:5%) and %SERIAL% for the device serial number.">
            <input
              className={styles.input}
              value={wiz.deviceNameTemplate}
              onChange={(e) => setWiz((w) => ({ ...w, deviceNameTemplate: e.target.value }))}
              placeholder="e.g., CL-%RAND:5%"
            />
          </FormGroup>
          {wiz.deviceNameTemplate ? <p className={styles.muted}>Example: {expandDeviceNameTemplate(wiz.deviceNameTemplate)}</p> : null}
        </>
      ) : null}

      {step === 2 ? (
        <FormGroup label="Scope tags" help="Filter access for delegated administrators (decorative).">
          <input className={styles.input} value={wiz.scopeTags} onChange={(e) => setWiz((w) => ({ ...w, scopeTags: e.target.value }))} />
        </FormGroup>
      ) : null}

      {step === 3 ? (
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

      {step === 4 ? (
        <div className={styles.reviewGrid}>
          <div className="lbl">Name</div>
          <div>{wiz.name || "(not set)"}</div>
          <div className="lbl">Deployment mode</div>
          <div>{wiz.mode}</div>
          <div className="lbl">Join to Entra ID as</div>
          <div>{wiz.joinType}</div>
          <div className="lbl">Skip EULA</div>
          <div>{wiz.skipEula ? "Yes" : "No"}</div>
          <div className="lbl">Hide account options</div>
          <div>{wiz.hideAccountOptions ? "Yes" : "No"}</div>
          <div className="lbl">User account type</div>
          <div>{wiz.userAccountType}</div>
          <div className="lbl">Device name template</div>
          <div>{wiz.deviceNameTemplate || "—"}</div>
          <div className="lbl">Example device name</div>
          <div>{wiz.deviceNameTemplate ? expandDeviceNameTemplate(wiz.deviceNameTemplate) : "—"}</div>
          <div className="lbl">Scope tags</div>
          <div>{wiz.scopeTags || "—"}</div>
          <div className="lbl">Assigned group</div>
          <div>{state.groups.find((g) => g.id === wiz.assignedGroupId)?.name ?? "(not set)"}</div>
        </div>
      ) : null}
    </Modal>
  );
}

function ProfileDetail({ profile, state, dispatch, onBack }: { profile: IntuneAutopilotProfile; state: IntuneState; dispatch: (action: IntuneAction) => void; onBack: () => void }) {
  const groupName = state.groups.find((g) => g.id === profile.assigned)?.name ?? profile.assigned;

  const remove = () => {
    if (!confirm(`Delete profile "${profile.name}"?`)) return;
    dispatch({ type: "DELETE_AUTOPILOT_PROFILE", id: profile.id });
    toast.success("Profile deleted");
    onBack();
  };

  return (
    <div>
      <button type="button" className={styles.btnSubtle} onClick={onBack}>
        &lt; Back to deployment profiles
      </button>
      <h1 className={styles.pageH1}>{profile.name}</h1>
      <p className={styles.pageSub}>Windows Autopilot deployment profile</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={remove}>
          Delete
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Deployment</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Deployment mode</div>
          <div>{profile.mode}</div>
          <div className="lbl">Join type</div>
          <div>{profile.joinType}</div>
          <div className="lbl">Assigned group</div>
          <div>{groupName}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Out-of-box experience (OOBE)</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Microsoft Software License Terms</div>
          <div>{profile.skipEula ? "Hide" : "Show"}</div>
          <div className="lbl">Hide change account options</div>
          <div>{profile.hideAccountOptions ? "Hide" : "Show"}</div>
          <div className="lbl">User account type</div>
          <div>{profile.userAccountType}</div>
          <div className="lbl">Device name template</div>
          <div>{profile.deviceNameTemplate || "—"}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Device name preview</div>
        {profile.deviceNameTemplate ? (
          <p>
            Template <strong>{profile.deviceNameTemplate}</strong> would produce a name like <strong>{expandDeviceNameTemplate(profile.deviceNameTemplate)}</strong> on enrollment.
          </p>
        ) : (
          <p className={styles.muted}>No device name template configured.</p>
        )}
      </div>
    </div>
  );
}

function DevicesTab({ state }: { state: IntuneState }) {
  const userName = (id: string) => (id ? state.users.find((u) => u.id === id)?.name ?? id : "—");

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("CSV import scheduled — refresh in 5 minutes")}>
          Import
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.success("Autopilot device sync requested")}>
          Sync
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Serial Number</th>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>Group Tag</th>
              <th>Profile Status</th>
              <th>Assigned User</th>
              <th>Date Added</th>
            </tr>
          </thead>
          <tbody>
            {state.autopilotDevices.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.center}>
                  No Autopilot devices.
                </td>
              </tr>
            ) : (
              state.autopilotDevices.map((d) => (
                <tr key={d.id}>
                  <td>{d.serial}</td>
                  <td>{d.mfg}</td>
                  <td>{d.model}</td>
                  <td>{d.groupTag}</td>
                  <td>
                    <Pill tone={d.profileStatus === "Assigned" ? "ok" : "muted"}>{d.profileStatus}</Pill>
                  </td>
                  <td>{userName(d.assignedUser)}</td>
                  <td>{d.dateAdded}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfilesTab({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const selected = state.autopilotProfiles.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return <ProfileDetail profile={selected} state={state} dispatch={dispatch} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setShowWizard(true)}>
          + Create profile
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Deployment Mode</th>
              <th>Join Type</th>
              <th>Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {state.autopilotProfiles.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.center}>
                  No deployment profiles.
                </td>
              </tr>
            ) : (
              state.autopilotProfiles.map((p) => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                  <td className={styles.rowLink}>{p.name}</td>
                  <td>{p.mode}</td>
                  <td>{p.joinType}</td>
                  <td>{state.groups.find((g) => g.id === p.assigned)?.name ?? p.assigned}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showWizard ? <ProfileWizard state={state} dispatch={dispatch} onClose={() => setShowWizard(false)} /> : null}
    </div>
  );
}

function EspTab() {
  const [showProgress, setShowProgress] = useState(true);
  const [blockUntilInstalled, setBlockUntilInstalled] = useState(true);
  const [allowRetry, setAllowRetry] = useState(true);
  const [timeoutMinutes, setTimeoutMinutes] = useState(60);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Enrollment Status Page</div>
      <p className={styles.muted}>Configure the user experience during Windows device setup (decorative — not persisted).</p>

      <div className={styles.checkboxRow}>
        <input type="checkbox" id="esp-progress" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
        <label htmlFor="esp-progress">Show app and profile installation progress to users</label>
      </div>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="esp-block" checked={blockUntilInstalled} onChange={(e) => setBlockUntilInstalled(e.target.checked)} />
        <label htmlFor="esp-block">Block device use until required apps are installed</label>
      </div>
      <div className={styles.checkboxRow}>
        <input type="checkbox" id="esp-retry" checked={allowRetry} onChange={(e) => setAllowRetry(e.target.checked)} />
        <label htmlFor="esp-retry">Allow users to retry installation errors</label>
      </div>

      <FormGroup label="Block device use until required apps are installed (timeout, minutes)">
        <input
          type="number"
          className={styles.input}
          value={timeoutMinutes}
          min={0}
          onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
        />
      </FormGroup>

      <button type="button" className={styles.btn} onClick={() => toast.success("Enrollment Status Page settings saved")}>
        Save
      </button>
    </div>
  );
}

function HashTab() {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Hardware Hash</div>
      <p className={styles.muted}>Collect the Autopilot hardware hash from a device using PowerShell, then upload the resulting CSV via Devices &gt; Windows Autopilot &gt; Devices &gt; Import.</p>
      <pre className={styles.codeBlock}>
        {"Install-Script -Name Get-WindowsAutoPilotInfo\n" +
          "Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned\n" +
          "Get-WindowsAutoPilotInfo -OutputFile autopilot-hash.csv"}
      </pre>
    </div>
  );
}

export function AutopilotPage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [tab, setTab] = useState<AutopilotTab>("devices");

  return (
    <div>
      <h1 className={styles.pageH1}>Windows Autopilot</h1>
      <p className={styles.pageSub}>Zero-touch provisioning for Windows devices.</p>

      <div className={styles.subtabs}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`${styles.subtab} ${tab === t.id ? styles.subtabActive : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "devices" ? <DevicesTab state={state} /> : null}
      {tab === "profiles" ? <ProfilesTab state={state} dispatch={dispatch} /> : null}
      {tab === "esp" ? <EspTab /> : null}
      {tab === "hash" ? <HashTab /> : null}
    </div>
  );
}
