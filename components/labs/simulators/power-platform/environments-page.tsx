"use client";

// Environments page for the Power Platform Admin Center simulator. Ported
// from itbd-lab/simulators/powerplatform/js/pp-environments.js (626 lines):
// a sortable/filterable table of `state.environments`, a detail flyout with
// tabs (Details / Dataverse / Security / Backups / Resources / Users / DLP /
// History — a broader tab set than source's 8 Overview/Settings/Database/
// Users/Teams/Roles/Resources/Updates split, consolidated + extended per the
// porting brief so every tab surfaces real seeded state where it exists), a
// 5-step "+ New environment" wizard dispatching ADD_ENVIRONMENT, and
// destructive "Reset database" / "Delete environment" actions gated behind
// Modal confirmations (typed-name confirm, matching Azure-style destructive
// UX) rather than source's `PPPortal.confirm()` window-level confirm — no
// native prompt()/alert()/confirm() anywhere, per house convention (see
// analytics-capacity-licenses-page.tsx for the sibling idiom this follows).
//
// Backups tab is explicitly illustrative/static (source has no real backup
// records in state — `PpEnvironment` has no backup history field — so 3 mock
// nightly-backup rows are shown, clearly labeled as illustrative). History
// tab is real, filtered from `state.auditLog` by target string matching the
// environment's name or id. Resources/Users/DLP tabs are all real, derived
// from `state.apps`/`state.flows`/`env.users`/`state.policies`.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import type {
  PpEnvironment,
  PpEnvironmentType,
  PpPolicy,
  PpState,
} from "@/lib/labs/simulators/power-platform/types";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatusPill,
  TabBar,
  WizStep,
  statusTone,
  type DataTableColumn,
} from "./pp-ui";
import styles from "./pp-console.module.css";

// ===================================================================
// Constants
// ===================================================================

const REGIONS = [
  "India",
  "United States",
  "Europe",
  "United Kingdom",
  "Australia",
  "Canada",
  "Japan",
  "Brazil",
  "South Africa",
  "Switzerland",
  "UAE",
  "Germany",
  "France",
  "Korea",
];

const LANGUAGES = ["English (United States)", "English (United Kingdom)", "English (India)", "German", "French", "Japanese", "Spanish"];

const CURRENCIES = ["INR - Indian Rupee", "USD - US Dollar", "EUR - Euro", "GBP - British Pound", "JPY - Japanese Yen"];

const ENV_TYPES: { type: PpEnvironmentType; sub: string; disabled?: boolean }[] = [
  { type: "Production", sub: "Long-running line-of-business workloads." },
  { type: "Sandbox", sub: "Pre-production for testing customizations and resets." },
  { type: "Trial", sub: "30-day evaluation; auto-deletes when it expires." },
  { type: "Developer", sub: "Free per-developer environment with Dataverse capacity." },
  { type: "Default", sub: "The auto-provisioned default for the tenant. Only one allowed.", disabled: true },
];

const DETAIL_TABS: { key: string; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "dataverse", label: "Dataverse" },
  { key: "security", label: "Security" },
  { key: "backups", label: "Backups" },
  { key: "resources", label: "Resources" },
  { key: "users", label: "Users" },
  { key: "dlp", label: "DLP" },
  { key: "history", label: "History" },
];

// Illustrative-only mock backup entries — `PpEnvironment` has no persisted
// backup history, so these three nightly-backup rows are static reference
// content (clearly labeled in the tab body), same treatment source gives
// e.g. release-wave "Updates" data.
const MOCK_BACKUPS = [
  { label: "Scheduled nightly backup", offsetDays: 1 },
  { label: "Scheduled nightly backup", offsetDays: 2 },
  { label: "Scheduled nightly backup", offsetDays: 3 },
];

// ===================================================================
// Helpers
// ===================================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function trialDaysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000)));
}

// DLP scope logic: does this policy apply to the given environment? Mirrors
// the reducer's dlp-engine semantics — "Everyone" applies tenant-wide,
// "Specific environments" applies only if envId is listed, "All except
// specific" applies everywhere except the listed exceptionEnvs.
function policyAppliesToEnv(policy: PpPolicy, envId: string): boolean {
  if (policy.scope === "Everyone") return true;
  if (policy.scope === "Specific environments") return policy.envIds.includes(envId);
  if (policy.scope === "All except specific") return !policy.exceptionEnvs.includes(envId);
  return false;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ===================================================================
// Wizard — 5 steps: name/description/type -> region/language/currency ->
// Dataverse toggle+version+capacity -> security group -> review
// ===================================================================

type WizardState = {
  name: string;
  description: string;
  type: PpEnvironmentType;
  region: string;
  language: string;
  currency: string;
  createDb: boolean;
  startingCapacityGB: string;
  securityGroup: string;
};

const WIZARD_STEP_KEYS = ["basics", "region", "dataverse", "security", "review"] as const;
type WizardStepKey = (typeof WIZARD_STEP_KEYS)[number];

const WIZARD_STEP_LABELS: Record<WizardStepKey, string> = {
  basics: "Name",
  region: "Region",
  dataverse: "Dataverse",
  security: "Security group",
  review: "Review and finish",
};

function NewEnvironmentWizard({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<PpAction> }) {
  const [step, setStep] = useState<WizardStepKey>("basics");
  const [wizard, setWizard] = useState<WizardState>({
    name: "",
    description: "",
    type: "Production",
    region: "India",
    language: "English (United States)",
    currency: "INR - Indian Rupee",
    createDb: true,
    startingCapacityGB: "5",
    securityGroup: "",
  });

  const stepIndex = WIZARD_STEP_KEYS.indexOf(step);

  function patch(partial: Partial<WizardState>) {
    setWizard((prev) => ({ ...prev, ...partial }));
  }

  function goTo(target: WizardStepKey) {
    setStep(target);
  }

  function goNext() {
    if (step === "basics" && !wizard.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    const idx = WIZARD_STEP_KEYS.indexOf(step);
    if (idx < WIZARD_STEP_KEYS.length - 1) setStep(WIZARD_STEP_KEYS[idx + 1]);
  }

  function goPrev() {
    const idx = WIZARD_STEP_KEYS.indexOf(step);
    if (idx > 0) setStep(WIZARD_STEP_KEYS[idx - 1]);
  }

  function handleFinish() {
    if (!wizard.name.trim()) {
      toast.warning("Name is required.");
      setStep("basics");
      return;
    }
    const capacityGB = wizard.createDb ? Math.max(1, Number.parseFloat(wizard.startingCapacityGB) || 5) : 0;
    const slug = slugify(wizard.name);
    const environment: PpEnvironment = {
      id: `env-${Date.now().toString(36)}`,
      name: wizard.name.trim(),
      description: wizard.description.trim(),
      type: wizard.type,
      state: "Ready",
      region: wizard.region,
      createdOn: new Date().toISOString(),
      createdBy: "admin@itbd.net",
      owner: "admin@itbd.net",
      url: `https://${slug}.crm8.dynamics.com`,
      dataverseEnabled: wizard.createDb,
      dataverseVersion: wizard.createDb ? "9.2.24013.00208" : "",
      databaseSizeMB: wizard.createDb ? 64 : 0,
      capacityGB,
      language: wizard.language,
      currency: wizard.currency,
      securityGroup: wizard.securityGroup.trim() || null,
      trialExpiresOn: wizard.type === "Trial" ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() : null,
      users: [],
    };
    dispatch({ type: "ADD_ENVIRONMENT", environment });
    toast.success(`Environment "${environment.name}" provisioned.`);
    onClose();
  }

  const stepsBar = (
    <>
      {WIZARD_STEP_KEYS.map((key, i) => (
        <WizStep key={key} label={WIZARD_STEP_LABELS[key]} active={step === key} done={i < stepIndex} onClick={() => goTo(key)} />
      ))}
    </>
  );

  const footer = (
    <>
      <button type="button" className={styles.btnOutline} onClick={onClose}>
        Cancel
      </button>
      <span className={styles.spacer} />
      {stepIndex > 0 ? (
        <button type="button" className={styles.btnOutline} onClick={goPrev}>
          Back
        </button>
      ) : null}
      {step === "review" ? (
        <button type="button" className={styles.btn} onClick={handleFinish}>
          Create
        </button>
      ) : (
        <button type="button" className={styles.btn} onClick={goNext}>
          Next
        </button>
      )}
    </>
  );

  return (
    <Modal title="+ New environment" onClose={onClose} width="820px" steps={stepsBar} footer={footer}>
      {step === "basics" ? (
        <>
          <Field label="Name *">
            <input
              className={styles.input}
              placeholder="e.g. Marketing Production"
              value={wizard.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={styles.textarea}
              placeholder="Optional"
              value={wizard.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
          <div className={styles.muted} style={{ marginBottom: 10 }}>
            Choose an environment type.
          </div>
          {ENV_TYPES.map((t) => (
            <label
              key={t.type}
              className={styles.radioRow}
              style={{ border: "1px solid #edebe9", borderRadius: 4, padding: 10, marginBottom: 6, cursor: t.disabled ? "not-allowed" : "pointer" }}
            >
              <input
                type="radio"
                name="envType"
                value={t.type}
                checked={wizard.type === t.type}
                disabled={t.disabled}
                onChange={() => patch({ type: t.type })}
              />
              <div>
                <strong>{t.type}</strong>
                <div className={styles.muted} style={{ fontSize: 12 }}>
                  {t.sub}
                </div>
              </div>
            </label>
          ))}
        </>
      ) : null}

      {step === "region" ? (
        <>
          <Field label="Region *" help="Region cannot be changed after creation. Choose the location closest to your users.">
            <NativeSelect value={wizard.region} onChange={(value) => patch({ region: value })} options={REGIONS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <div className={styles.formRow}>
            <Field label="Language">
              <NativeSelect value={wizard.language} onChange={(value) => patch({ language: value })} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            </Field>
            <Field label="Currency">
              <NativeSelect value={wizard.currency} onChange={(value) => patch({ currency: value })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            </Field>
          </div>
        </>
      ) : null}

      {step === "dataverse" ? (
        <>
          <Checkbox label="Create a database for this environment (recommended)" checked={wizard.createDb} onChange={(checked) => patch({ createDb: checked })} />
          <div className={styles.muted} style={{ fontSize: 12, marginBottom: 10 }}>
            Adds Microsoft Dataverse storage so you can build model-driven apps and store relational data.
          </div>
          {wizard.createDb ? (
            <>
              <Field label="Dataverse version">
                <input className={styles.input} value="9.2.24013.00208" disabled readOnly />
              </Field>
              <Field label="Starting capacity (GB)">
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  step="1"
                  value={wizard.startingCapacityGB}
                  onChange={(e) => patch({ startingCapacityGB: e.target.value })}
                />
              </Field>
            </>
          ) : null}
        </>
      ) : null}

      {step === "security" ? (
        <Field label="Security group" help="Restrict access to one security group (optional).">
          <input
            className={styles.input}
            placeholder="Restrict access to one security group (optional)"
            value={wizard.securityGroup}
            onChange={(e) => patch({ securityGroup: e.target.value })}
          />
        </Field>
      ) : null}

      {step === "review" ? (
        <>
          <div className={styles.h3}>Review and finish</div>
          <div className={styles.reviewGrid}>
            <div className="lbl">Name</div>
            <div>{wizard.name || "-"}</div>
            <div className="lbl">Description</div>
            <div>{wizard.description || "-"}</div>
            <div className="lbl">Type</div>
            <div>{wizard.type}</div>
            <div className="lbl">Region</div>
            <div>{wizard.region}</div>
            <div className="lbl">Language</div>
            <div>{wizard.language}</div>
            <div className="lbl">Currency</div>
            <div>{wizard.currency}</div>
            <div className="lbl">Create database</div>
            <div>{wizard.createDb ? "Yes" : "No"}</div>
            {wizard.createDb ? (
              <>
                <div className="lbl">Starting capacity</div>
                <div>{wizard.startingCapacityGB} GB</div>
              </>
            ) : null}
            <div className="lbl">Security group</div>
            <div>{wizard.securityGroup || "None"}</div>
          </div>
          <div className={styles.muted} style={{ marginTop: 10 }}>
            Click <strong>Create</strong> to provision the environment. Provisioning typically takes 1-3 minutes.
          </div>
        </>
      ) : null}
    </Modal>
  );
}

// ===================================================================
// Destructive confirm modals — typed-name confirm (Azure-style), no native
// confirm() anywhere.
// ===================================================================

function ResetDatabaseModal({ env, onClose, dispatch }: { env: PpEnvironment; onClose: () => void; dispatch: React.Dispatch<PpAction> }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === env.name;

  function handleConfirm() {
    if (!matches) return;
    dispatch({ type: "RESET_ENVIRONMENT_DATABASE", id: env.id });
    toast.success(`Database reset for ${env.name}.`);
    onClose();
  }

  return (
    <Modal
      title="Reset database"
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} disabled={!matches} onClick={handleConfirm}>
            Reset database
          </button>
        </>
      }
    >
      <p>
        This deletes all custom tables and rows in <strong>{env.name}</strong>. This action cannot be undone.
      </p>
      <Field label={`Type "${env.name}" to confirm`}>
        <input className={styles.input} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={env.name} />
      </Field>
    </Modal>
  );
}

function DeleteEnvironmentModal({ env, onClose, dispatch }: { env: PpEnvironment; onClose: () => void; dispatch: React.Dispatch<PpAction> }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === env.name;

  function handleConfirm() {
    if (!matches) return;
    dispatch({ type: "DELETE_ENVIRONMENT", id: env.id });
    toast.success(`Environment "${env.name}" deleted.`);
    onClose();
  }

  return (
    <Modal
      title="Delete environment"
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} disabled={!matches} onClick={handleConfirm}>
            Delete environment
          </button>
        </>
      }
    >
      <p>
        Delete <strong>{env.name}</strong>? This is irreversible (recoverable for 7 days in the real product; permanent here).
      </p>
      <Field label={`Type "${env.name}" to confirm`}>
        <input className={styles.input} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={env.name} />
      </Field>
    </Modal>
  );
}

// ===================================================================
// Add-user mini-form (Users tab)
// ===================================================================

function AddUserForm({ env, dispatch }: { env: PpEnvironment; dispatch: React.Dispatch<PpAction> }) {
  const [upn, setUpn] = useState("");
  const [role, setRole] = useState("Basic User");

  function handleAdd() {
    const trimmed = upn.trim();
    if (!trimmed) {
      toast.warning("Enter a user principal name (email).");
      return;
    }
    if (env.users.some((u) => u.upn.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`${trimmed} already has a role in this environment.`);
      return;
    }
    dispatch({ type: "UPDATE_ENVIRONMENT", id: env.id, patch: { users: [...env.users, { upn: trimmed, role }] } });
    toast.success(`${trimmed} added as ${role}.`);
    setUpn("");
  }

  return (
    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <Field label="User (UPN)">
          <input className={styles.input} placeholder="user@cloudlab.in" value={upn} onChange={(e) => setUpn(e.target.value)} />
        </Field>
      </div>
      <div style={{ minWidth: 200 }}>
        <Field label="Security role">
          <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>
      </div>
      <button type="button" className={styles.btn} style={{ marginBottom: 14 }} onClick={handleAdd}>
        + Add user
      </button>
    </div>
  );
}

// ===================================================================
// Detail flyout tab bodies
// ===================================================================

function DetailsTab({ env }: { env: PpEnvironment }) {
  return (
    <div className={styles.reviewGrid}>
      <div className="lbl">Display name</div>
      <div>{env.name}</div>
      <div className="lbl">Description</div>
      <div>{env.description || "-"}</div>
      <div className="lbl">Environment URL</div>
      <div>
        <span className={styles.code}>{env.url}</span>
      </div>
      <div className="lbl">Environment ID</div>
      <div>
        <span className={styles.code}>{env.id}</span>
      </div>
      <div className="lbl">Type</div>
      <div>{env.type}</div>
      <div className="lbl">State</div>
      <div>
        <StatusPill tone={statusTone(env.state)}>{env.state}</StatusPill>
      </div>
      <div className="lbl">Region</div>
      <div>{env.region}</div>
      <div className="lbl">Created on</div>
      <div>{formatDateTime(env.createdOn)}</div>
      <div className="lbl">Created by</div>
      <div>{env.createdBy}</div>
      <div className="lbl">Owner</div>
      <div>{env.owner}</div>
      {env.trialExpiresOn ? (
        <>
          <div className="lbl">Trial expires</div>
          <div>
            {formatDate(env.trialExpiresOn)} ({trialDaysLeft(env.trialExpiresOn)} days left)
          </div>
        </>
      ) : null}
    </div>
  );
}

function DataverseTab({
  env,
  onReset,
  onDelete,
}: {
  env: PpEnvironment;
  onReset: () => void;
  onDelete: () => void;
}) {
  const usedGB = env.databaseSizeMB / 1024;
  const pct = env.capacityGB ? Math.min(100, Math.round((usedGB / env.capacityGB) * 100)) : 0;
  const barClass = pct > 85 ? styles.barHigh : pct > 65 ? styles.barMed : "";

  if (!env.dataverseEnabled) {
    return <EmptyState message="Dataverse is not provisioned for this environment." />;
  }

  return (
    <div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Version</div>
        <div>{env.dataverseVersion}</div>
        <div className="lbl">Language</div>
        <div>{env.language}</div>
        <div className="lbl">Currency</div>
        <div>{env.currency}</div>
      </div>

      <div className={styles.gauge} style={{ marginTop: 14 }}>
        <div className={styles.gtitle}>Database capacity</div>
        <div>
          <span className={styles.gval}>{usedGB.toFixed(2)}</span>
          <span className={styles.gunit}>/ {env.capacityGB} GB</span>
        </div>
        <div className={`${styles.bar} ${barClass}`}>
          <div style={{ height: "100%", width: `${pct}%`, background: "currentColor" }} />
        </div>
        <div className={styles.muted} style={{ fontSize: 12, marginTop: 4 }}>
          {pct}% used
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => toast.info(`Manual backup queued for ${env.name}`)}>
          Back up
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => toast.info("Copy operation queued")}>
          Copy
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={onReset}>
          Reset database
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={env.type === "Default"} onClick={onDelete}>
          Delete environment
        </button>
      </div>
      {env.type === "Default" ? (
        <div className={styles.muted} style={{ fontSize: 12, marginTop: 6 }}>
          The Default environment cannot be deleted.
        </div>
      ) : null}
    </div>
  );
}

function SecurityTab({ env, dispatch }: { env: PpEnvironment; dispatch: React.Dispatch<PpAction> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(env.securityGroup ?? "");

  function handleSave() {
    dispatch({ type: "UPDATE_ENVIRONMENT", id: env.id, patch: { securityGroup: value.trim() || null } });
    toast.success("Security group updated.");
    setEditing(false);
  }

  return (
    <div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Security group</div>
        <div>{env.securityGroup ?? "None — all makers in the tenant can access this environment."}</div>
      </div>

      {editing ? (
        <div style={{ marginTop: 12 }}>
          <Field label="Security group" help="Restrict access to one security group (leave blank to allow everyone).">
            <input className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Power Platform Admins" />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={styles.btn} onClick={handleSave}>
              Save
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => { setValue(env.securityGroup ?? ""); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => setEditing(true)}>
          Edit security group
        </button>
      )}
    </div>
  );
}

function BackupsTab({ env }: { env: PpEnvironment }) {
  return (
    <div>
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        Illustrative backup history — this simulator does not run real backup jobs; restore points shown below are for reference only.
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Backup</th>
              <th>Restore point</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_BACKUPS.map((b, i) => {
              const ts = new Date(Date.now() - b.offsetDays * 24 * 3600 * 1000);
              return (
                <tr key={i}>
                  <td>{b.label}</td>
                  <td>{ts.toLocaleString()}</td>
                  <td>System (nightly)</td>
                  <td>
                    <StatusPill tone="default">Available</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!env.dataverseEnabled ? (
        <div className={styles.muted} style={{ fontSize: 12, marginTop: 8 }}>
          Note: Dataverse is not provisioned for this environment — real backups would not exist until it is.
        </div>
      ) : null}
    </div>
  );
}

function ResourcesTab({ env, state }: { env: PpEnvironment; state: PpState }) {
  const apps = state.apps.filter((a) => a.envId === env.id);
  const flows = state.flows.filter((f) => f.envId === env.id);

  return (
    <div>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statVal}>{apps.length}</div>
          <div className={styles.statLabel}>Apps in this environment</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{flows.length}</div>
          <div className={styles.statLabel}>Flows in this environment</div>
        </div>
      </div>

      <div className={styles.h3}>Apps</div>
      {apps.length === 0 ? (
        <EmptyState message="No apps in this environment." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>App</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Shared with</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
                  <td>{a.owner}</td>
                  <td>{a.sharedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.h3}>Flows</div>
      {flows.length === 0 ? (
        <EmptyState message="No flows in this environment." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Flow</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Last run</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>
                    <StatusPill tone={statusTone(f.status)}>{f.status}</StatusPill>
                  </td>
                  <td>{f.owner}</td>
                  <td>{formatDateTime(f.lastRun)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersTab({ env, dispatch }: { env: PpEnvironment; dispatch: React.Dispatch<PpAction> }) {
  function handleRemove(upn: string) {
    dispatch({ type: "UPDATE_ENVIRONMENT", id: env.id, patch: { users: env.users.filter((u) => u.upn !== upn) } });
    toast.success(`${upn} removed from this environment.`);
  }

  return (
    <div>
      {env.users.length === 0 ? (
        <EmptyState message="No users with explicit roles." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Security role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {env.users.map((u) => (
                <tr key={u.upn}>
                  <td>{u.upn}</td>
                  <td>{u.role}</td>
                  <td>
                    <button type="button" className={styles.btnSubtle} onClick={() => handleRemove(u.upn)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddUserForm env={env} dispatch={dispatch} />
    </div>
  );
}

function DlpTab({ env, state }: { env: PpEnvironment; state: PpState }) {
  const applicablePolicies = state.policies.filter((p) => policyAppliesToEnv(p, env.id));

  const columns: DataTableColumn<PpPolicy>[] = [
    { key: "name", header: "Policy", render: (p) => <strong>{p.name}</strong> },
    { key: "type", header: "Type", render: (p) => p.type },
    { key: "scope", header: "Scope", render: (p) => p.scope },
    { key: "status", header: "Status", render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill> },
    { key: "modified", header: "Modified", render: (p) => formatDateTime(p.modified) },
  ];

  return (
    <div>
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        Data loss prevention policies that apply to this environment (by scope).
      </div>
      <DataTable columns={columns} rows={applicablePolicies} getRowKey={(p) => p.id} emptyMessage="No DLP policies apply to this environment." />
    </div>
  );
}

function HistoryTab({ env, state }: { env: PpEnvironment; state: PpState }) {
  const entries = state.auditLog.filter((a) => a.target === env.name || a.target.includes(env.name) || a.target === env.id);

  return (
    <div>
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        Audit log entries referencing this environment.
      </div>
      {entries.length === 0 ? (
        <EmptyState message="No audit history for this environment yet." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.ts}-${i}`}>
                  <td>{formatDateTime(e.ts)}</td>
                  <td>{e.actor}</td>
                  <td>{e.action}</td>
                  <td>
                    <StatusPill tone={statusTone(e.status)}>{e.status}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================================================================
// Detail flyout
// ===================================================================

function EnvironmentDetailFlyout({
  env,
  state,
  onClose,
  dispatch,
}: {
  env: PpEnvironment;
  state: PpState;
  onClose: () => void;
  dispatch: React.Dispatch<PpAction>;
}) {
  const [tab, setTab] = useState("details");
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Flyout
        title={env.name}
        subtitle={
          <>
            {env.type} &middot; {env.region}
          </>
        }
        onClose={onClose}
        tabs={<TabBar tabs={DETAIL_TABS} active={tab} onChange={setTab} />}
        footer={
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
        }
      >
        {tab === "details" ? <DetailsTab env={env} /> : null}
        {tab === "dataverse" ? <DataverseTab env={env} onReset={() => setResetting(true)} onDelete={() => setDeleting(true)} /> : null}
        {tab === "security" ? <SecurityTab env={env} dispatch={dispatch} /> : null}
        {tab === "backups" ? <BackupsTab env={env} /> : null}
        {tab === "resources" ? <ResourcesTab env={env} state={state} /> : null}
        {tab === "users" ? <UsersTab env={env} dispatch={dispatch} /> : null}
        {tab === "dlp" ? <DlpTab env={env} state={state} /> : null}
        {tab === "history" ? <HistoryTab env={env} state={state} /> : null}
      </Flyout>

      {resetting ? <ResetDatabaseModal env={env} onClose={() => setResetting(false)} dispatch={dispatch} /> : null}
      {deleting ? (
        <DeleteEnvironmentModal
          env={env}
          onClose={() => {
            setDeleting(false);
            onClose();
          }}
          dispatch={dispatch}
        />
      ) : null}
    </>
  );
}

// ===================================================================
// Main page
// ===================================================================

export function EnvironmentsPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const selectedEnv = useMemo(() => state.environments.find((e) => e.id === selectedEnvId) ?? null, [state.environments, selectedEnvId]);

  const columns: DataTableColumn<PpEnvironment>[] = [
    {
      key: "name",
      header: "Display name",
      render: (e) => (
        <>
          <span className={styles.rowLink}>{e.name}</span>
          {e.trialExpiresOn ? (
            <span style={{ marginLeft: 8 }}>
              <StatusPill tone={trialDaysLeft(e.trialExpiresOn) < 7 ? "err" : "warn"}>Trial &middot; {trialDaysLeft(e.trialExpiresOn)} days left</StatusPill>
            </span>
          ) : null}
        </>
      ),
    },
    { key: "type", header: "Type", render: (e) => e.type },
    { key: "state", header: "State", render: (e) => <StatusPill tone={statusTone(e.state)}>{e.state}</StatusPill> },
    { key: "region", header: "Region", render: (e) => e.region },
    { key: "dataverse", header: "Dataverse", render: (e) => (e.dataverseEnabled ? "Yes" : "No") },
    {
      key: "database",
      header: "Database size / capacity",
      render: (e) => (e.dataverseEnabled ? `${(e.databaseSizeMB / 1024).toFixed(2)} / ${e.capacityGB} GB` : "-"),
    },
    { key: "createdOn", header: "Created on", render: (e) => formatDate(e.createdOn) },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Environments</div>
      <div className={styles.pageSub}>Spaces to provision Dataverse, Power Apps, flows and Copilot Studio bots.</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setWizardOpen(true)}>
          + New environment
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Environments refreshed")}>
          Refresh
        </button>
      </div>

      <DataTable columns={columns} rows={state.environments} getRowKey={(e) => e.id} onRowClick={(e) => setSelectedEnvId(e.id)} emptyMessage="No environments yet." />

      {selectedEnv ? (
        <EnvironmentDetailFlyout env={selectedEnv} state={state} onClose={() => setSelectedEnvId(null)} dispatch={dispatch} />
      ) : null}

      {wizardOpen ? <NewEnvironmentWizard onClose={() => setWizardOpen(false)} dispatch={dispatch} /> : null}
    </div>
  );
}
