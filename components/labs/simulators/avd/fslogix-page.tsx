"use client";

import { useState } from "react";

import type { AvdFslogixConfig, AvdState } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import { Callout, Checkbox, EmptyState, Field, NativeSelect, PropPair, StatusBadge } from "./avd-ui";

const ODFC_OPTIONS = ["Outlook cache", "OneDrive sync", "Teams cache", "Edge data", "OneNote cache", "SharePoint cache"];

const REG_KEY_LABELS: Record<keyof AvdFslogixConfig["regKeys"], string> = {
  outlookCacheMode: "Outlook cache mode",
  oneDriveSync: "OneDrive sync",
  teamsCache: "Teams cache",
  edgeData: "Edge data",
  oneNoteCache: "OneNote cache",
};

function newFslogixConfig(defaultHostPool: string): AvdFslogixConfig {
  return {
    id: `fsl-${crypto.randomUUID()}`,
    name: "FSLogix - new config",
    appliesTo: defaultHostPool,
    profileContainerPath: "\\\\fslogix01.cloudlab.in\\profiles$\\%username%",
    storageAccount: "",
    storageAccountResource: "",
    azureFilesShare: "",
    profileSizeGB: 30,
    profileLockCheck: true,
    roamingOsPrefs: false,
    odfcEnabled: false,
    odfcPath: "",
    odfcIncludes: [],
    authMethod: "",
    regKeys: { outlookCacheMode: true, oneDriveSync: true, teamsCache: true, edgeData: true, oneNoteCache: false },
  };
}

/** Real FSLogix registry paths — see Microsoft's FSLogix Profile Container / ODFC configuration reference. */
function generateGpoScript(f: AvdFslogixConfig): string {
  const sizeMB = (f.profileSizeGB || 30) * 1024;
  const includes = f.odfcIncludes || [];
  const rk = f.regKeys || ({} as AvdFslogixConfig["regKeys"]);

  const lines: string[] = [
    `# FSLogix Group Policy / registry settings for: ${f.name}`,
    `# Applies to host pool: ${f.appliesTo}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    "# === Profile container (HKLM\\SOFTWARE\\FSLogix\\Profiles) ===",
    'reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v Enabled        /t REG_DWORD /d 1 /f',
    `reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v VHDLocations   /t REG_MULTI_SZ /d "${f.profileContainerPath}" /f`,
    `reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v SizeInMBs      /t REG_DWORD /d ${sizeMB} /f`,
    'reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v VolumeType     /t REG_SZ    /d "VHDX" /f',
    `reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v ProfileType    /t REG_DWORD /d ${f.roamingOsPrefs ? 3 : 0} /f`,
    `reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v LockedRetryCount /t REG_DWORD /d ${f.profileLockCheck ? 12 : 3} /f`,
    'reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v LockedRetryInterval /t REG_DWORD /d 5 /f',
    'reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v DeleteLocalProfileWhenVHDShouldApply /t REG_DWORD /d 1 /f',
    'reg add "HKLM\\SOFTWARE\\FSLogix\\Profiles" /v FlipFlopProfileDirectoryName /t REG_DWORD /d 1 /f',
  ];

  if (f.storageAccount) {
    lines.push("", `# Backing storage: ${f.storageAccount}${f.azureFilesShare ? ` (share: ${f.azureFilesShare})` : ""}`);
  }
  if (f.authMethod) {
    lines.push(`# Authentication method: ${f.authMethod}`);
  }

  if (f.odfcEnabled) {
    lines.push("", "# === Office Container / ODFC (HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC) ===");
    lines.push('reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v Enabled      /t REG_DWORD /d 1 /f');
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v VHDLocations /t REG_MULTI_SZ /d "${f.odfcPath}" /f`);
    lines.push('reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v VolumeType   /t REG_SZ    /d "VHDX" /f');
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v IncludeOutlook       /t REG_DWORD /d ${includes.includes("Outlook cache") ? 1 : 0} /f`);
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v IncludeOneDrive      /t REG_DWORD /d ${includes.includes("OneDrive sync") ? 1 : 0} /f`);
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v IncludeTeams         /t REG_DWORD /d ${includes.includes("Teams cache") ? 1 : 0} /f`);
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v IncludeEdge          /t REG_DWORD /d ${includes.includes("Edge data") ? 1 : 0} /f`);
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v IncludeOneNote       /t REG_DWORD /d ${includes.includes("OneNote cache") ? 1 : 0} /f`);
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\FSLogix\\ODFC" /v IncludeSharepoint    /t REG_DWORD /d ${includes.includes("SharePoint cache") ? 1 : 0} /f`);
  }

  lines.push("", "# === Application registry toggles ===");
  if (rk.outlookCacheMode) {
    lines.push('reg add "HKCU\\Software\\Microsoft\\Office\\16.0\\Outlook\\Cached Mode" /v Enable /t REG_DWORD /d 1 /f');
    lines.push('reg add "HKCU\\Software\\Microsoft\\Office\\16.0\\Outlook\\Cached Mode" /v SyncWindowSetting /t REG_DWORD /d 1 /f');
  }
  if (rk.oneDriveSync) {
    lines.push('reg add "HKLM\\Software\\Policies\\Microsoft\\OneDrive" /v SilentAccountConfig /t REG_DWORD /d 1 /f');
    lines.push('reg add "HKLM\\Software\\Policies\\Microsoft\\OneDrive" /v FilesOnDemandEnabled /t REG_DWORD /d 1 /f');
  }
  if (rk.teamsCache) {
    lines.push("# Teams cache - allow per-machine install for AVD");
    lines.push('reg add "HKLM\\Software\\Microsoft\\Teams" /v IsWVDEnvironment /t REG_DWORD /d 1 /f');
  }
  if (rk.edgeData) {
    lines.push('reg add "HKLM\\Software\\Policies\\Microsoft\\Edge" /v RoamingProfileSupportEnabled /t REG_DWORD /d 1 /f');
  }
  if (rk.oneNoteCache) {
    lines.push('reg add "HKCU\\Software\\Microsoft\\Office\\16.0\\OneNote\\Preferences" /v EnableFastCloseTraceWriting /t REG_DWORD /d 0 /f');
  }

  lines.push("", "# === Restart FSLogix services so changes apply ===");
  lines.push('Restart-Service -Name "frxsvc" -Force');
  lines.push('Restart-Service -Name "frxccd" -Force');

  return lines.join("\n");
}

function FslogixCard({
  config,
  onOpen,
  onDelete,
}: {
  config: AvdFslogixConfig;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const activeRegKeys = (Object.keys(config.regKeys) as (keyof AvdFslogixConfig["regKeys"])[]).filter(
    (k) => config.regKeys[k],
  );

  return (
    <div className={styles.card} style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{config.name}</h3>
        {config.appliesTo ? <StatusBadge status={config.appliesTo} /> : null}
      </div>

      <PropPair label="Profile container" value={<span className={styles.help}>{config.profileContainerPath || "—"}</span>} />
      <PropPair label="Profile size" value={`${config.profileSizeGB} GB`} />
      <PropPair
        label="Storage account"
        value={config.storageAccount ? config.storageAccount : <span style={{ color: "#a4262c" }}>Not configured</span>}
      />
      <PropPair label="ODFC" value={config.odfcEnabled ? "Enabled" : "Disabled"} />

      <div style={{ marginTop: 8 }}>
        <div className={styles.propLabel}>Registry toggles</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {activeRegKeys.length === 0 ? (
            <span className={styles.help}>None enabled</span>
          ) : (
            activeRegKeys.map((k) => (
              <span key={k} className={`${styles.badge} ${styles.badgeOutline}`}>
                {REG_KEY_LABELS[k]}
              </span>
            ))
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className={styles.btn} onClick={onOpen}>
          Edit
        </button>
        <button type="button" className={styles.btnOutline} style={{ color: "#a4262c" }} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function FslogixEditor({
  config,
  hostPoolNames,
  gpoScript,
  onUpdate,
  onToggleOdfcInclude,
  onToggleRegKey,
  onGenerateGpo,
  onClose,
}: {
  config: AvdFslogixConfig;
  hostPoolNames: string[];
  gpoScript: string;
  onUpdate: (patch: Partial<AvdFslogixConfig>) => void;
  onToggleOdfcInclude: (option: string) => void;
  onToggleRegKey: (key: keyof AvdFslogixConfig["regKeys"], value: boolean) => void;
  onGenerateGpo: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.sectionCard} style={{ marginTop: 16 }}>
      <h3>Edit: {config.name}</h3>

      <Field label="Name" required>
        <input
          className={styles.input}
          value={config.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </Field>

      <Field label="Applies to host pool">
        <NativeSelect value={config.appliesTo} onChange={(v) => onUpdate({ appliesTo: v })}>
          <option value="">(none)</option>
          {hostPoolNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Profile container path (UNC)" help="The FSLogix VHDLocations target for the user profile container.">
        <input
          className={styles.input}
          value={config.profileContainerPath}
          onChange={(e) => onUpdate({ profileContainerPath: e.target.value })}
        />
      </Field>

      <Field label="Storage account" help="Leave blank if this configuration targets an on-prem file server instead of Azure Files.">
        <input
          className={styles.input}
          value={config.storageAccount}
          onChange={(e) => onUpdate({ storageAccount: e.target.value })}
          placeholder="e.g., cldataststavd"
        />
      </Field>

      <Field label="Azure Files share">
        <input
          className={styles.input}
          value={config.azureFilesShare}
          onChange={(e) => onUpdate({ azureFilesShare: e.target.value })}
          placeholder="e.g., profiles"
        />
      </Field>

      <Field label="Profile size (GB)">
        <input
          type="number"
          min={1}
          className={styles.input}
          value={config.profileSizeGB}
          onChange={(e) => onUpdate({ profileSizeGB: parseInt(e.target.value, 10) || 0 })}
        />
      </Field>

      <Field label="Authentication method" help="Leave blank if not yet configured.">
        <input
          className={styles.input}
          value={config.authMethod}
          onChange={(e) => onUpdate({ authMethod: e.target.value })}
          placeholder="e.g., Entra Kerberos (hybrid)"
        />
      </Field>

      <Checkbox
        label="Profile lock check"
        checked={config.profileLockCheck}
        onChange={(v) => onUpdate({ profileLockCheck: v })}
        help="Increases LockedRetryCount so users can reconnect to an in-use profile."
      />
      <Checkbox
        label="Roaming OS preferences"
        checked={config.roamingOsPrefs}
        onChange={(v) => onUpdate({ roamingOsPrefs: v })}
        help="Sets ProfileType to include OS-level preferences in the roaming container."
      />
      <Checkbox
        label="ODFC (Office Container) enabled"
        checked={config.odfcEnabled}
        onChange={(v) => onUpdate({ odfcEnabled: v })}
      />

      <Field label="ODFC path" help={config.odfcEnabled ? undefined : "Enable ODFC above to edit this path."}>
        <input
          className={styles.input}
          value={config.odfcPath}
          disabled={!config.odfcEnabled}
          onChange={(e) => onUpdate({ odfcPath: e.target.value })}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>ODFC includes</p>
          {ODFC_OPTIONS.map((opt) => (
            <Checkbox
              key={opt}
              label={opt}
              checked={config.odfcIncludes.includes(opt)}
              onChange={() => onToggleOdfcInclude(opt)}
            />
          ))}
        </div>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Registry / app toggles</p>
          {(Object.keys(REG_KEY_LABELS) as (keyof AvdFslogixConfig["regKeys"])[]).map((k) => (
            <Checkbox
              key={k}
              label={REG_KEY_LABELS[k]}
              checked={config.regKeys[k]}
              onChange={(v) => onToggleRegKey(k, v)}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" className={styles.btn} onClick={onClose}>
          Done
        </button>
        <button type="button" className={styles.btnOutline} onClick={onGenerateGpo}>
          Generate GPO / registry script
        </button>
      </div>

      {gpoScript ? (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Generated Group Policy / registry script</h4>
          <textarea readOnly rows={20} className={styles.textarea} value={gpoScript} />
        </div>
      ) : null}
    </div>
  );
}

export function FslogixPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gpoScript, setGpoScript] = useState<string>("");

  const configs = state.fslogixConfigs;
  const editingConfig = configs.find((f) => f.id === editingId) ?? null;
  const hostPoolNames = state.hostPools.map((p) => p.name);

  function openEditor(id: string) {
    setEditingId(id);
    setGpoScript("");
  }

  function closeEditor() {
    setEditingId(null);
    setGpoScript("");
  }

  function handleAdd() {
    const config = newFslogixConfig(hostPoolNames[0] ?? "");
    dispatch({ type: "ADD_FSLOGIX_CONFIG", config });
    setEditingId(config.id);
    setGpoScript("");
  }

  function handleDelete(id: string) {
    dispatch({ type: "DELETE_FSLOGIX_CONFIG", id });
    if (editingId === id) closeEditor();
  }

  function handleUpdate(id: string, patch: Partial<AvdFslogixConfig>) {
    dispatch({ type: "UPDATE_FSLOGIX_CONFIG", id, patch });
  }

  function handleToggleOdfcInclude(config: AvdFslogixConfig, option: string) {
    const odfcIncludes = config.odfcIncludes.includes(option)
      ? config.odfcIncludes.filter((o) => o !== option)
      : [...config.odfcIncludes, option];
    dispatch({ type: "UPDATE_FSLOGIX_CONFIG", id: config.id, patch: { odfcIncludes } });
  }

  function handleToggleRegKey(config: AvdFslogixConfig, key: keyof AvdFslogixConfig["regKeys"], value: boolean) {
    dispatch({ type: "UPDATE_FSLOGIX_CONFIG", id: config.id, patch: { regKeys: { ...config.regKeys, [key]: value } } });
  }

  function handleGenerateGpo(config: AvdFslogixConfig) {
    setGpoScript(generateGpoScript(config));
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>FSLogix profile containers</h1>
      <p className={styles.help} style={{ marginBottom: 16 }}>
        Profile and Office (ODFC) container management
      </p>

      <div className={styles.sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ border: "none", margin: 0, padding: 0 }}>Configurations</h3>
          <button type="button" className={styles.btn} onClick={handleAdd}>
            + Add configuration
          </button>
        </div>

        <Callout tone="info">
          FSLogix moves the Windows user profile and Office data into a VHDX container so it follows the user across
          pooled session hosts.
        </Callout>

        <div style={{ marginTop: 16 }}>
          {configs.length === 0 ? (
            <EmptyState message='No FSLogix configurations yet. Click "+ Add configuration" to create one.' />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
              {configs.map((config) => (
                <FslogixCard
                  key={config.id}
                  config={config}
                  onOpen={() => openEditor(config.id)}
                  onDelete={() => handleDelete(config.id)}
                />
              ))}
            </div>
          )}
        </div>

        {editingConfig ? (
          <FslogixEditor
            config={editingConfig}
            hostPoolNames={hostPoolNames}
            gpoScript={gpoScript}
            onUpdate={(patch) => handleUpdate(editingConfig.id, patch)}
            onToggleOdfcInclude={(option) => handleToggleOdfcInclude(editingConfig, option)}
            onToggleRegKey={(key, value) => handleToggleRegKey(editingConfig, key, value)}
            onGenerateGpo={() => handleGenerateGpo(editingConfig)}
            onClose={closeEditor}
          />
        ) : null}
      </div>
    </div>
  );
}
