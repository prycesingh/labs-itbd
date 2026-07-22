"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AvdMsixPackage, AvdMsixPackageState, AvdState } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import {
  Callout,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  PropPair,
  RadioInline,
  SectionHeader,
  StatusBadge,
  TabBar,
  WizardFooter,
} from "./avd-ui";

// ─── Wizard: mock "discovered package" shape (from parsing the image) ──────
type DiscoveredPackage = {
  displayName: string;
  version: string;
  packageName: string;
  packageFamilyName: string;
  publisher: string;
  publisherDisplayName: string;
};

// ─── Wizard steps — mirrors avd-msix.js STEPS exactly ───────────────────────
const WIZARD_TABS = [
  { id: "image", label: "Image source" },
  { id: "package", label: "Package selection" },
  { id: "display", label: "Display options" },
  { id: "state", label: "State" },
  { id: "pools", label: "Host pools" },
  { id: "review", label: "Review + create" },
] as const;

type WizardTabId = (typeof WIZARD_TABS)[number]["id"];

type MsixWizardState = {
  // Step 1
  imagePath: string;
  pathValid: boolean;
  pathError: string;
  // Step 2
  packages: DiscoveredPackage[];
  selectedPackageIndex: number;
  // Step 3
  displayName: string;
  displayVersion: string;
  publisher: string;
  publisherDisplayName: string;
  logoPath: string;
  appVConfig: string;
  // Step 4
  state: AvdMsixPackageState;
  // Step 5
  hostPools: string[];
};

function freshWizardState(): MsixWizardState {
  return {
    imagePath: "",
    pathValid: false,
    pathError: "",
    packages: [],
    selectedPackageIndex: -1,
    displayName: "",
    displayVersion: "",
    publisher: "",
    publisherDisplayName: "",
    logoPath: "",
    appVConfig: "",
    state: "Active",
    hostPools: [],
  };
}

function validateWizardState(wiz: MsixWizardState): string[] {
  const errs: string[] = [];
  if (!wiz.pathValid) errs.push("Image path has not been validated.");
  if (wiz.selectedPackageIndex < 0) errs.push("Pick a package from the validated image.");
  if (!wiz.displayName) errs.push("Display name is required.");
  if (wiz.hostPools.length === 0) errs.push("Select at least one host pool.");
  return errs;
}

// ---- Mock image-parse helpers (same behavior as avd-msix.js _validatePath) ----
function prettify(s: string): string {
  const out = s.replace(/[-_.]/g, " ").replace(/\s+/g, " ").trim();
  if (!out) return "Application";
  return out
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function randTail(n: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function parseImagePath(path: string): DiscoveredPackage[] {
  const basename = path.replace(/.*\\/, "").replace(/\.[^.]+$/, "");
  const slug = basename.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "app";
  void slug;
  const name = prettify(basename);
  const verBase = Math.floor(Math.random() * 10) + 1;
  const version = `${verBase}.${Math.floor(Math.random() * 20)}.0.0`;

  const packages: DiscoveredPackage[] = [
    {
      displayName: name,
      version,
      packageName: `${name.replace(/\s/g, ".")}_${verBase}.0.0.0_x64__${randTail(13)}`,
      packageFamilyName: `${name.replace(/\s/g, ".")}_${randTail(13)}`,
      publisher: `CN=${name} Inc., O=${name} Inc., C=US`,
      publisherDisplayName: `${name} Inc.`,
    },
  ];

  // 30% chance the image contains a Plus/Pro edition too — matches source fidelity
  if (Math.random() < 0.3) {
    packages.push({
      displayName: `${name} Pro`,
      version: `${verBase}.${Math.floor(Math.random() * 20)}.0.0`,
      packageName: `${name.replace(/\s/g, ".")}Pro_${verBase}.0.0.0_x64__${randTail(13)}`,
      packageFamilyName: `${name.replace(/\s/g, ".")}Pro_${randTail(13)}`,
      publisher: `CN=${name} Inc., O=${name} Inc., C=US`,
      publisherDisplayName: `${name} Inc.`,
    });
  }
  return packages;
}

function stateBadgeStatus(s: AvdMsixPackageState): string {
  // StatusBadge's tone map only recognizes "Active"/"Failed" as-is; "Inactive" maps to neutral already.
  return s;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

type ViewState = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };

export function MsixPackagesPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [view, setView] = useState<ViewState>({ kind: "list" });

  if (view.kind === "create") {
    return (
      <MsixCreateWizard
        state={state}
        dispatch={dispatch}
        onCancel={() => setView({ kind: "list" })}
        onCreated={(id) => setView({ kind: "detail", id })}
      />
    );
  }

  const detailPkg = view.kind === "detail" ? state.msixPackages.find((p) => p.id === view.id) : undefined;

  return (
    <>
      <MsixList
        state={state}
        onCreate={() => setView({ kind: "create" })}
        onOpen={(id) => setView({ kind: "detail", id })}
      />
      {view.kind === "detail" && detailPkg ? (
        <MsixDetailFlyout
          pkg={detailPkg}
          state={state}
          dispatch={dispatch}
          onClose={() => setView({ kind: "list" })}
        />
      ) : null}
    </>
  );
}

// ─── List ────────────────────────────────────────────────────────────────
function MsixList({
  state,
  onCreate,
  onOpen,
}: {
  state: AvdState;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const pkgs = state.msixPackages;

  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>App attach packages</h1>
          <p className={styles.sub}>Dynamically attach MSIX packages to user sessions</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Add package
        </button>
      </div>

      <div className={styles.listBody}>
        {pkgs.length === 0 ? (
          <EmptyState message='No MSIX packages registered. Click "+ Add package" to register your first package.' />
        ) : (
          <DataTable columns={["Display name", "Version", "Publisher", "State", "Host pools", "App groups", "Last updated"]}>
            {pkgs.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" className={styles.link} onClick={() => onOpen(p.id)}>
                    {p.displayName}
                  </button>
                </td>
                <td>{p.displayVersion}</td>
                <td>{p.publisherDisplayName}</td>
                <td>
                  <StatusBadge status={stateBadgeStatus(p.state)} />
                </td>
                <td>{p.hostPools.length}</td>
                <td>{p.appGroups.length}</td>
                <td>{p.lastUpdated ? new Date(p.lastUpdated).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}

// ─── Create wizard ───────────────────────────────────────────────────────
function MsixCreateWizard({
  state,
  dispatch,
  onCancel,
  onCreated,
}: {
  state: AvdState;
  dispatch: React.Dispatch<AvdAction>;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [wiz, setWiz] = useState<MsixWizardState>(() => freshWizardState());
  const [activeTab, setActiveTab] = useState<WizardTabId>("image");

  const activeIndex = WIZARD_TABS.findIndex((t) => t.id === activeTab);
  const errors = useMemo(() => validateWizardState(wiz), [wiz]);

  function set<K extends keyof MsixWizardState>(key: K, value: MsixWizardState[K]) {
    setWiz((w) => ({ ...w, [key]: value }));
  }

  function setPath(v: string) {
    setWiz((w) => ({ ...w, imagePath: v, pathValid: false, pathError: "" }));
  }

  function suggestPath() {
    setWiz((w) => ({
      ...w,
      imagePath: "\\\\storprod01.file.core.windows.net\\appattach\\packages\\newapp.vhdx",
      pathError: "",
    }));
  }

  function validatePath() {
    const p = wiz.imagePath.trim();
    if (!/^\\\\[^\\]+\\[^\\]+\\.+/.test(p)) {
      setWiz((w) => ({
        ...w,
        pathValid: false,
        pathError: "Path must be a UNC like \\\\storage.file.core.windows.net\\share\\packages\\app.vhdx",
      }));
      return;
    }
    if (!/\.(vhdx?|cim)$/i.test(p)) {
      setWiz((w) => ({ ...w, pathValid: false, pathError: "Image must end in .vhd, .vhdx or .cim." }));
      return;
    }
    const packages = parseImagePath(p);
    const first = packages[0];
    setWiz((w) => ({
      ...w,
      pathValid: true,
      pathError: "",
      packages,
      selectedPackageIndex: 0,
      displayName: first.displayName,
      displayVersion: first.version,
      publisher: first.publisher,
      publisherDisplayName: first.publisherDisplayName,
    }));
  }

  function pickPackage(i: number) {
    const pk = wiz.packages[i];
    if (!pk) return;
    setWiz((w) => ({
      ...w,
      selectedPackageIndex: i,
      displayName: pk.displayName,
      displayVersion: pk.version,
      publisher: pk.publisher,
      publisherDisplayName: pk.publisherDisplayName,
    }));
  }

  function togglePool(name: string, on: boolean) {
    setWiz((w) => ({
      ...w,
      hostPools: on ? [...w.hostPools, name] : w.hostPools.filter((n) => n !== name),
    }));
  }

  function commit() {
    if (errors.length > 0) {
      setActiveTab("review");
      return;
    }
    const pk = wiz.packages[wiz.selectedPackageIndex];
    const id = "msix-" + crypto.randomUUID();
    const now = new Date().toISOString();
    const rec: AvdMsixPackage = {
      id,
      packageName: pk.packageName,
      packageFamilyName: pk.packageFamilyName,
      displayName: wiz.displayName,
      displayVersion: wiz.displayVersion,
      version: pk.version,
      publisher: wiz.publisher,
      publisherDisplayName: wiz.publisherDisplayName,
      imagePath: wiz.imagePath,
      logoPath: wiz.logoPath,
      appVConfig: wiz.appVConfig,
      state: wiz.state,
      hostPools: wiz.hostPools,
      appGroups: [],
      userAssignments: [],
      lastUpdated: now,
      isRegular: true,
      createdAt: now,
    };
    dispatch({ type: "ADD_MSIX_PACKAGE", pkg: rec });
    toast.success(`MSIX package "${rec.displayName}" registered`);
    onCreated(id);
  }

  return (
    <div className={styles.wizard}>
      <TabBar
        tabs={WIZARD_TABS.map((t, i) => ({ id: t.id, label: t.label, done: i < activeIndex }))}
        active={activeTab}
        onChange={(id) => setActiveTab(id as WizardTabId)}
      />

      <div className={styles.wizBody}>
        {activeTab === "image" && (
          <>
            <SectionHeader
              title="Image source"
              sub="Provide the UNC path to your MSIX App attach image (.vhd, .vhdx or .cim file) on Azure Files or another SMB share."
            />
            <Field
              label="UNC path to image"
              required
              help="Allowed extensions: .vhd, .vhdx, .cim. The session host computer accounts must have Read permission on the share."
            >
              <input
                value={wiz.imagePath}
                onChange={(e) => setPath(e.target.value)}
                placeholder="\\storage.file.core.windows.net\share\packages\app.vhdx"
                className={styles.input}
              />
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className={styles.btn} onClick={validatePath}>
                Validate path
              </button>
              <button type="button" className={styles.btnOutline} onClick={suggestPath}>
                Use a sample path
              </button>
            </div>
            {wiz.pathError ? (
              <div className={styles.calloutWarn} style={{ marginTop: 12 }}>
                {wiz.pathError}
              </div>
            ) : wiz.pathValid ? (
              <div className={styles.calloutInfo} style={{ marginTop: 12 }}>
                &#10003; Image path looks valid. Click Validate to parse the package.
              </div>
            ) : null}
          </>
        )}

        {activeTab === "package" && (
          <>
            {wiz.packages.length === 0 ? (
              <>
                <SectionHeader title="Package selection" sub="Image not parsed yet." />
                <Callout tone="info">
                  Go back to step 1 and click <b>Validate path</b> to discover the packages inside the image.
                </Callout>
              </>
            ) : (
              <>
                <SectionHeader
                  title="Package selection"
                  sub={`Found ${wiz.packages.length} package(s) inside the image. Pick the one to register.`}
                />
                <DataTable columns={["Application", "Version", "Package name", "Publisher"]}>
                  {wiz.packages.map((pk, i) => (
                    <tr key={pk.packageName}>
                      <td>
                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="radio"
                            name="msixpkg"
                            checked={wiz.selectedPackageIndex === i}
                            onChange={() => pickPackage(i)}
                          />
                          {pk.displayName}
                        </label>
                      </td>
                      <td>{pk.version}</td>
                      <td className={styles.help} style={{ fontFamily: "Consolas, monospace" }}>
                        {pk.packageName}
                      </td>
                      <td>{pk.publisherDisplayName}</td>
                    </tr>
                  ))}
                </DataTable>
              </>
            )}
          </>
        )}

        {activeTab === "display" && (
          <>
            <SectionHeader title="Display options" sub="Customise how the package appears to users." />
            <Field label="Display name" required>
              <input
                value={wiz.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="e.g., Adobe Acrobat Reader 24"
                className={styles.input}
              />
            </Field>
            <Field label="Display version">
              <input
                value={wiz.displayVersion}
                onChange={(e) => set("displayVersion", e.target.value)}
                placeholder="e.g., 24.3.0"
                className={styles.input}
              />
            </Field>
            <Field label="Publisher">
              <input
                value={wiz.publisher}
                onChange={(e) => set("publisher", e.target.value)}
                placeholder="CN=Adobe Inc., O=Adobe Inc., L=San Jose, S=California, C=US"
                className={styles.input}
                style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}
              />
            </Field>
            <Field label="Publisher display name">
              <input
                value={wiz.publisherDisplayName}
                onChange={(e) => set("publisherDisplayName", e.target.value)}
                placeholder="Adobe Inc."
                className={styles.input}
              />
            </Field>
            <Field label="Logo path">
              <input
                value={wiz.logoPath}
                onChange={(e) => set("logoPath", e.target.value)}
                placeholder="\\storage.file.core.windows.net\share\logos\app.png"
                className={styles.input}
              />
            </Field>
            <Field label="App-V configuration (optional)">
              <textarea
                rows={4}
                value={wiz.appVConfig}
                onChange={(e) => set("appVConfig", e.target.value)}
                className={styles.textarea}
              />
            </Field>
          </>
        )}

        {activeTab === "state" && (
          <>
            <SectionHeader title="State" sub="Choose whether this package is immediately available to users." />
            <Field label="Package state">
              <RadioInline
                name="msix-state"
                value={wiz.state}
                onChange={(v) => set("state", v as AvdMsixPackageState)}
                choices={["Active", "Inactive"]}
              />
            </Field>
            <Callout tone="info">
              <b>Active</b> packages are ready for user assignment and will be mounted on session hosts on demand.{" "}
              <b>Inactive</b> packages are staged but invisible to users until activated.
            </Callout>
          </>
        )}

        {activeTab === "pools" && (
          <>
            <SectionHeader title="Host pools" sub="Choose which host pools should mount this package." />
            {state.hostPools.length === 0 ? (
              <EmptyState message="No host pools available." />
            ) : (
              <DataTable columns={["Host pool", "Type", "Hosts"]}>
                {state.hostPools.map((hp) => {
                  const on = wiz.hostPools.includes(hp.name);
                  const hostCount = state.sessionHosts.filter((h) => h.hostPool === hp.name).length;
                  return (
                    <tr key={hp.id}>
                      <td>
                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input type="checkbox" checked={on} onChange={(e) => togglePool(hp.name, e.target.checked)} />
                          {hp.name}
                        </label>
                      </td>
                      <td>{hp.type}</td>
                      <td>{hostCount} hosts</td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </>
        )}

        {activeTab === "review" && (
          <>
            {errors.length === 0 ? (
              <div className={styles.calloutInfo}>&#10003; Validation passed</div>
            ) : (
              <div className={styles.calloutWarn}>
                <b>Validation failed:</b>
                <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.sectionCard}>
              <h3>Summary</h3>
              <PropPair label="Image path" value={wiz.imagePath || "—"} />
              <PropPair label="Display name" value={wiz.displayName || "—"} />
              <PropPair label="Display version" value={wiz.displayVersion || "—"} />
              <PropPair
                label="Package name"
                value={wiz.selectedPackageIndex >= 0 ? wiz.packages[wiz.selectedPackageIndex].packageName : "—"}
              />
              <PropPair label="Publisher" value={wiz.publisher || "—"} />
              <PropPair label="State" value={wiz.state} />
              <PropPair label="Host pools" value={wiz.hostPools.join(", ") || "—"} />
            </div>
          </>
        )}
      </div>

      <WizardFooter
        onCancel={onCancel}
        onBack={activeIndex > 0 ? () => setActiveTab(WIZARD_TABS[activeIndex - 1].id) : undefined}
        onNext={activeIndex < WIZARD_TABS.length - 1 ? () => setActiveTab(WIZARD_TABS[activeIndex + 1].id) : commit}
        nextLabel={activeIndex < WIZARD_TABS.length - 1 ? `Next : ${WIZARD_TABS[activeIndex + 1].label} >` : "Create"}
      />
    </div>
  );
}

// ─── Detail flyout ───────────────────────────────────────────────────────
function MsixDetailFlyout({
  pkg,
  state,
  dispatch,
  onClose,
}: {
  pkg: AvdMsixPackage;
  state: AvdState;
  dispatch: React.Dispatch<AvdAction>;
  onClose: () => void;
}) {
  function patch(p: Partial<AvdMsixPackage>) {
    dispatch({ type: "UPDATE_MSIX_PACKAGE", id: pkg.id, patch: { ...p, lastUpdated: new Date().toISOString() } });
  }

  function toggleHostPool(name: string) {
    const hostPools = pkg.hostPools.includes(name) ? pkg.hostPools.filter((n) => n !== name) : [...pkg.hostPools, name];
    patch({ hostPools });
  }

  function toggleAppGroup(id: string) {
    const appGroups = pkg.appGroups.includes(id) ? pkg.appGroups.filter((x) => x !== id) : [...pkg.appGroups, id];
    patch({ appGroups });
  }

  function toggleUser(upn: string) {
    const userAssignments = pkg.userAssignments.includes(upn)
      ? pkg.userAssignments.filter((u) => u !== upn)
      : [...pkg.userAssignments, upn];
    patch({ userAssignments });
  }

  function toggleState() {
    const next: AvdMsixPackageState = pkg.state === "Active" ? "Inactive" : "Active";
    patch({ state: next });
    toast.success(`Package is now ${next}`);
  }

  function handleDelete() {
    if (!window.confirm(`Delete MSIX package "${pkg.displayName}"?`)) return;
    dispatch({ type: "DELETE_MSIX_PACKAGE", id: pkg.id });
    toast.info("Package deleted");
    onClose();
  }

  return (
    <div className={styles.rulePanelOverlay} onClick={onClose}>
      <div className={styles.rulePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.rulePanelHeader}>
          <h2>{pkg.displayName}</h2>
          <button type="button" className={styles.rulePanelClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className={styles.rulePanelBody}>
          <div className={styles.sectionCard}>
            <h3>Overview</h3>
            <PropPair label="State" value={<StatusBadge status={stateBadgeStatus(pkg.state)} />} />
            <PropPair label="Version" value={pkg.displayVersion} />
            <PropPair label="Last updated" value={pkg.lastUpdated ? new Date(pkg.lastUpdated).toLocaleString() : "—"} />
            <PropPair label="Host pools" value={pkg.hostPools.length} />
            <PropPair label="Application groups" value={pkg.appGroups.length} />
            <PropPair label="User assignments" value={pkg.userAssignments.length} />
          </div>

          <div className={styles.sectionCard}>
            <h3>Identifier</h3>
            <PropPair label="Display name" value={pkg.displayName} />
            <PropPair label="Display version" value={pkg.displayVersion} />
            <PropPair label="Package name" value={<span className={styles.help}>{pkg.packageName}</span>} />
            <PropPair label="Package family name" value={<span className={styles.help}>{pkg.packageFamilyName}</span>} />
            <PropPair label="Version (numeric)" value={pkg.version} />
            <PropPair label="Publisher" value={<span className={styles.help}>{pkg.publisher}</span>} />
            <PropPair label="Publisher display" value={pkg.publisherDisplayName} />
          </div>

          <div className={styles.sectionCard}>
            <h3>Configuration</h3>
            <PropPair label="Image path" value={<span className={styles.help}>{truncate(pkg.imagePath, 70)}</span>} />
            <PropPair label="Logo path" value={pkg.logoPath || "—"} />
            <PropPair label="App-V configuration" value={pkg.appVConfig || "(none)"} />
            <PropPair label="Image type" value={pkg.isRegular ? "Regular package (Active/Inactive)" : "Per-host"} />
          </div>

          <div className={styles.sectionCard}>
            <h3>Host pool assignment</h3>
            {state.hostPools.length === 0 ? (
              <EmptyState message="No host pools available." />
            ) : (
              state.hostPools.map((hp) => (
                <Checkbox
                  key={hp.id}
                  label={`${hp.name} (${hp.type})`}
                  checked={pkg.hostPools.includes(hp.name)}
                  onChange={() => toggleHostPool(hp.name)}
                />
              ))
            )}
          </div>

          <div className={styles.sectionCard}>
            <h3>Application group assignment</h3>
            {state.applicationGroups.length === 0 ? (
              <EmptyState message="No application groups available." />
            ) : (
              state.applicationGroups.map((ag) => (
                <Checkbox
                  key={ag.id}
                  label={`${ag.name} (${ag.type})${ag.workspace ? ` · ${ag.workspace}` : ""}`}
                  checked={pkg.appGroups.includes(ag.id)}
                  onChange={() => toggleAppGroup(ag.id)}
                />
              ))
            )}
          </div>

          <div className={styles.sectionCard}>
            <h3>User assignments</h3>
            {state.users.length === 0 ? (
              <EmptyState message="No users available." />
            ) : (
              <div className={styles.multiList}>
                {state.users.map((u) => (
                  <label key={u.upn}>
                    <input
                      type="checkbox"
                      checked={pkg.userAssignments.includes(u.upn)}
                      onChange={() => toggleUser(u.upn)}
                    />{" "}
                    {u.displayName} <span className={styles.help}>({u.upn})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.sectionCard}>
            <h3>Actions</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={styles.btn} onClick={toggleState}>
                {pkg.state === "Active" ? "Deactivate" : "Activate"}
              </button>
              <button type="button" className={styles.btnOutline} style={{ color: "#a4262c" }} onClick={handleDelete}>
                Delete package
              </button>
            </div>
          </div>
        </div>

        <div className={styles.rulePanelFooter}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
