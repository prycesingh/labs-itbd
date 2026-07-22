"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import type { IntuneApp, IntuneAppAssignment, IntuneDevice, IntuneState } from "@/lib/labs/simulators/intune/types";
import { BladeActionButton, BladeLayout, FormGroup, Modal, Pill, exportCsv } from "./intune-ui";
import styles from "./intune-console.module.css";

const APP_TYPES = [
  "Microsoft 365 Apps (Windows)",
  "Microsoft 365 Apps (macOS)",
  "Microsoft Edge (Windows)",
  "Microsoft Edge (macOS)",
  "Windows app (Win32)",
  "Microsoft Store app (new)",
  "iOS store app",
  "Managed Google Play app",
  "Built-in app",
  "Web link",
  "Android Enterprise system app",
  "Microsoft Defender for Endpoint (macOS)",
  "Microsoft Defender for Endpoint (Linux)",
] as const;

const APP_PLATFORMS = ["Windows", "iOS", "Android", "macOS", "Linux"] as const;
type AppPlatformFilter = "All" | (typeof APP_PLATFORMS)[number];

const APP_SECTIONS = ["Overview", "Properties", "Assignments", "Monitor", "Roles"];

const INTENTS: IntuneAppAssignment["intent"][] = ["Required", "Available", "Uninstall", "Available without enrollment"];
const FILTER_MODES = ["None", "Include", "Exclude"] as const;

function intentTone(intent: IntuneAppAssignment["intent"]): "ok" | "err" | "info" | "muted" {
  if (intent === "Required") return "info";
  if (intent === "Available") return "ok";
  if (intent === "Uninstall") return "err";
  return "muted";
}

function groupName(state: IntuneState, groupId: string): string {
  return state.groups.find((g) => g.id === groupId)?.name ?? groupId;
}

function makeAppId(): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `ap-${rand}`;
}

export function AppsPage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [platformFilter, setPlatformFilter] = useState<AppPlatformFilter>("All");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(APP_SECTIONS[0]);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    if (platformFilter === "All") return state.apps;
    return state.apps.filter((a) => a.platform === platformFilter);
  }, [state.apps, platformFilter]);

  const selectedApp = selectedAppId ? state.apps.find((a) => a.id === selectedAppId) : undefined;

  function openApp(id: string) {
    setSelectedAppId(id);
    setActiveSection(APP_SECTIONS[0]);
  }

  function backToList() {
    setSelectedAppId(null);
  }

  function handleExport() {
    exportCsv(
      "apps.csv",
      ["Name", "Type", "Platform", "Status", "Version", "Assignments"],
      filtered.map((a) => [a.name, a.type, a.platform, a.status, a.version || "—", a.assignments.length]),
    );
    toast.info("App export started — file ready in Reports");
  }

  if (selectedApp) {
    return (
      <AppBlade
        state={state}
        app={selectedApp}
        dispatch={dispatch}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBack={backToList}
      />
    );
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Apps</h1>
      <p className={styles.pageSub}>Add, assign and monitor apps in your tenant.</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setShowAdd(true)}>
          + Add
        </button>
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      <div className={styles.filterRow}>
        {(["All", ...APP_PLATFORMS] as AppPlatformFilter[]).map((p) => (
          <div
            key={p}
            className={`${styles.filterChip} ${platformFilter === p ? styles.filterChipActive : ""}`}
            onClick={() => setPlatformFilter(p)}
          >
            {p}
          </div>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Platform</th>
              <th>Status</th>
              <th>Version</th>
              <th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td className={styles.rowLink} onClick={() => openApp(a.id)}>
                    {a.name}
                  </td>
                  <td onClick={() => openApp(a.id)}>{a.type}</td>
                  <td onClick={() => openApp(a.id)}>{a.platform}</td>
                  <td onClick={() => openApp(a.id)}>
                    <Pill tone={a.status === "Published" ? "ok" : "warn"}>{a.status}</Pill>
                  </td>
                  <td onClick={() => openApp(a.id)}>{a.version || "—"}</td>
                  <td onClick={() => openApp(a.id)}>{a.assignments.length}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className={styles.center}>
                  No apps match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd ? <AddAppModal state={state} dispatch={dispatch} onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}

function AddAppModal({ state, dispatch, onClose }: { state: IntuneState; dispatch: (action: IntuneAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publisher, setPublisher] = useState("");
  const [category, setCategory] = useState("Productivity");
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState<(typeof APP_PLATFORMS)[number]>("Windows");
  const [type, setType] = useState<(typeof APP_TYPES)[number]>(APP_TYPES[0]);
  const [groupId, setGroupId] = useState(state.groups[0]?.id ?? "");

  function handleAdd() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const app: IntuneApp = {
      id: makeAppId(),
      name: name.trim(),
      type,
      platform,
      status: "Published",
      version: version.trim(),
      assignments: [],
      description: description.trim(),
    };
    dispatch({ type: "ADD_APP", app });
    toast.success(`App "${app.name}" added`);
    onClose();
  }

  return (
    <Modal title="Add app" onClose={onClose} footer={
      <>
        <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.btn} onClick={handleAdd}>Add</button>
      </>
    }>
      <FormGroup label="Name">
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="App name" />
      </FormGroup>
      <FormGroup label="Description">
        <textarea className={styles.textarea} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
      </FormGroup>
      <FormGroup label="Publisher">
        <input className={styles.input} value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Microsoft Corporation" />
      </FormGroup>
      <FormGroup label="Category">
        <input className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Productivity" />
      </FormGroup>
      <FormGroup label="Version">
        <input className={styles.input} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" />
      </FormGroup>
      <FormGroup label="Platform">
        <select className={styles.select} value={platform} onChange={(e) => setPlatform(e.target.value as (typeof APP_PLATFORMS)[number])}>
          {APP_PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </FormGroup>
      <FormGroup label="App type">
        <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as (typeof APP_TYPES)[number])}>
          {APP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </FormGroup>
      <FormGroup label="Required group">
        <select className={styles.select} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {state.groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </FormGroup>
    </Modal>
  );
}

function AppBlade({
  state,
  app,
  dispatch,
  activeSection,
  onSectionChange,
  onBack,
}: {
  state: IntuneState;
  app: IntuneApp;
  dispatch: (action: IntuneAction) => void;
  activeSection: string;
  onSectionChange: (s: string) => void;
  onBack: () => void;
}) {
  const [showAssign, setShowAssign] = useState(false);

  function handleDelete() {
    if (typeof window !== "undefined" && !window.confirm(`Delete app "${app.name}"? This cannot be undone.`)) return;
    dispatch({ type: "DELETE_APP", id: app.id });
    toast.success(`${app.name} deleted`);
    onBack();
  }

  function handleProperties() {
    onSectionChange("Properties");
  }

  const toolbar = (
    <>
      <BladeActionButton label="Assign" onClick={() => setShowAssign(true)} />
      <BladeActionButton label="Properties" onClick={handleProperties} />
      <BladeActionButton label="Delete" onClick={handleDelete} danger />
    </>
  );

  return (
    <div>
      <button type="button" className={styles.btnSubtle} onClick={onBack}>
        &larr; Back to Apps
      </button>
      <BladeLayout title={app.name} toolbar={toolbar} sections={APP_SECTIONS} activeSection={activeSection} onSectionChange={onSectionChange}>
        {activeSection === "Overview" ? <OverviewSection app={app} /> : null}
        {activeSection === "Properties" ? <PropertiesSection app={app} dispatch={dispatch} /> : null}
        {activeSection === "Assignments" ? <AssignmentsSection state={state} app={app} dispatch={dispatch} /> : null}
        {activeSection === "Monitor" ? <MonitorSection state={state} app={app} /> : null}
        {activeSection === "Roles" ? <RolesSection /> : null}
      </BladeLayout>

      {showAssign ? <AssignModal state={state} app={app} dispatch={dispatch} onClose={() => setShowAssign(false)} /> : null}
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.reviewGrid}>
      <div className="lbl">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function OverviewSection({ app }: { app: IntuneApp }) {
  return (
    <div>
      <PropRow label="Name" value={app.name} />
      <PropRow label="Type" value={app.type} />
      <PropRow label="Platform" value={app.platform} />
      <PropRow label="Version" value={app.version || "—"} />
      <PropRow label="Status" value={<Pill tone={app.status === "Published" ? "ok" : "warn"}>{app.status}</Pill>} />
      <PropRow label="Description" value={app.description || "—"} />
      <PropRow label="Assignments" value={app.assignments.length} />
    </div>
  );
}

function PropertiesSection({ app, dispatch }: { app: IntuneApp; dispatch: (action: IntuneAction) => void }) {
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description);
  const [version, setVersion] = useState(app.version);

  function handleSave() {
    dispatch({ type: "UPDATE_APP", id: app.id, patch: { name: name.trim() || app.name, description, version } });
    toast.success("App updated");
  }

  return (
    <div>
      <FormGroup label="Name">
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
      </FormGroup>
      <FormGroup label="Description">
        <textarea className={styles.textarea} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormGroup>
      <FormGroup label="Version">
        <input className={styles.input} value={version} onChange={(e) => setVersion(e.target.value)} />
      </FormGroup>
      <button type="button" className={styles.btn} onClick={handleSave}>
        Save
      </button>
    </div>
  );
}

function AssignmentsSection({ state, app, dispatch }: { state: IntuneState; app: IntuneApp; dispatch: (action: IntuneAction) => void }) {
  if (!app.assignments.length) {
    return <div className={styles.emptyState}>No assignments. Use the Assign action to add one.</div>;
  }

  function handleRemove(groupId: string) {
    dispatch({ type: "UNASSIGN_APP", id: app.id, groupId });
    toast.success("Assignment removed");
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Group</th>
            <th>Intent</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {app.assignments.map((a) => (
            <tr key={a.groupId}>
              <td>{groupName(state, a.groupId)}</td>
              <td>
                <Pill tone={intentTone(a.intent)}>{a.intent}</Pill>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.btnSubtle} onClick={() => handleRemove(a.groupId)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function deviceInstallStatus(device: IntuneDevice): "Installed" | "Failed" | "Pending" {
  if (device.compliance === "Compliant") return "Installed";
  if (device.compliance === "Not compliant") return "Failed";
  return "Pending";
}

function installStatusTone(status: "Installed" | "Failed" | "Pending"): "ok" | "err" | "warn" {
  if (status === "Installed") return "ok";
  if (status === "Failed") return "err";
  return "warn";
}

function MonitorSection({ state, app }: { state: IntuneState; app: IntuneApp }) {
  const assignedGroupIds = new Set(app.assignments.map((a) => a.groupId));
  const relevantDevices = useMemo(() => {
    if (!assignedGroupIds.size) return [];
    return state.devices.filter((d) => {
      const user = state.users.find((u) => u.id === d.primaryUser);
      if (!user) return false;
      // No explicit user-group membership map exists in this simulator's data model,
      // so plausibility is approximated by the user's department matching an assigned
      // group's name (e.g. "Sales Team" <-> Sales) or a device-wide dynamic group
      // ("All Users"/"All Devices"/platform groups) being among the assignments.
      return app.assignments.some((a) => {
        const g = state.groups.find((x) => x.id === a.groupId);
        if (!g) return false;
        if (g.type === "Dynamic") return true;
        return g.name.toLowerCase().includes(user.department.toLowerCase());
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.devices, state.users, state.groups, app.assignments]);

  if (!app.assignments.length) {
    return <div className={styles.emptyState}>Assign this app to a group to see install status.</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Device</th>
            <th>User</th>
            <th>Compliance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {relevantDevices.length ? (
            relevantDevices.map((d) => {
              const status = deviceInstallStatus(d);
              const user = state.users.find((u) => u.id === d.primaryUser);
              return (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{user?.name ?? d.primaryUser}</td>
                  <td>{d.compliance}</td>
                  <td>
                    <Pill tone={installStatusTone(status)}>{status}</Pill>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} className={styles.center}>
                No devices fall within the assigned groups.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RolesSection() {
  const rows: [string, number][] = [
    ["Application Manager", 3],
    ["Help Desk Operator", 5],
    ["School Administrator", 1],
  ];
  return (
    <div>
      <p className={styles.muted}>No custom role assignments. Use tenant roles to delegate access.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Role</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([role, members]) => (
              <tr key={role}>
                <td>{role}</td>
                <td>{members}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssignModal({ state, app, dispatch, onClose }: { state: IntuneState; app: IntuneApp; dispatch: (action: IntuneAction) => void; onClose: () => void }) {
  const [intent, setIntent] = useState<IntuneAppAssignment["intent"]>("Required");
  const [groupId, setGroupId] = useState(state.groups[0]?.id ?? "");
  const [filterMode, setFilterMode] = useState<(typeof FILTER_MODES)[number]>("None");
  const [filter, setFilter] = useState("");

  function handleAssign() {
    if (!groupId) {
      toast.error("Select a group to assign");
      return;
    }
    dispatch({ type: "ASSIGN_APP", id: app.id, assignment: { groupId, intent } });
    toast.success(`Assignment added (${intent})`);
    onClose();
  }

  return (
    <Modal title={`Add assignment — ${app.name}`} onClose={onClose} footer={
      <>
        <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.btn} onClick={handleAssign}>Add</button>
      </>
    }>
      <FormGroup label="Intent">
        <select className={styles.select} value={intent} onChange={(e) => setIntent(e.target.value as IntuneAppAssignment["intent"])}>
          {INTENTS.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </FormGroup>
      <FormGroup label="Group">
        <select className={styles.select} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {state.groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </FormGroup>
      <FormGroup label="Filter mode">
        <select className={styles.select} value={filterMode} onChange={(e) => setFilterMode(e.target.value as (typeof FILTER_MODES)[number])}>
          {FILTER_MODES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </FormGroup>
      <FormGroup label="Filter" help="Simulated only — filters are not persisted on the assignment record.">
        <input className={styles.input} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="(no filter)" disabled={filterMode === "None"} />
      </FormGroup>
    </Modal>
  );
}
