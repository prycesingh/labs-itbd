"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AvdApplicationGroup, AvdRemoteApp, AvdState } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import {
  Callout,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  NativeSelect,
  PropPair,
  RadioInline,
  StatusBadge,
  SubTabBar,
  TabBar,
  WizardFooter,
} from "./avd-ui";

// ─── Wizard state ────────────────────────────────────────────────────────

const WIZARD_TABS = [
  { id: "basics", label: "Basics" },
  { id: "assignments", label: "Assignments" },
  { id: "applications", label: "Applications" },
  { id: "workspace", label: "Workspace" },
  { id: "review", label: "Review + create" },
] as const;
type WizardTabId = (typeof WIZARD_TABS)[number]["id"];

type WizardTag = { key: string; value: string };

type WizardState = {
  resourceGroup: string;
  hostPool: string;
  region: string;
  type: "Desktop" | "RemoteApp";
  name: string;
  description: string;
  assignments: string[];
  registerWorkspace: "No" | "Yes";
  workspaceTarget: string;
  tags: WizardTag[];
};

function freshWizardState(defaultResourceGroup: string, defaultRegion: string): WizardState {
  return {
    resourceGroup: defaultResourceGroup,
    hostPool: "",
    region: defaultRegion,
    type: "RemoteApp",
    name: "",
    description: "",
    assignments: [],
    registerWorkspace: "No",
    workspaceTarget: "",
    tags: [],
  };
}

function validateWizard(state: WizardState): string[] {
  const errs: string[] = [];
  if (!state.name) errs.push("Name is required.");
  if (!state.hostPool) errs.push("Host pool is required.");
  if (state.registerWorkspace === "Yes" && !state.workspaceTarget) errs.push("Pick a workspace.");
  return errs;
}

// ─── Detail blade sections ────────────────────────────────────────────────

const DETAIL_SECTIONS = [
  { group: "", items: [{ id: "overview", label: "Overview" }, { id: "tags", label: "Tags" }] },
  {
    group: "Settings",
    items: [
      { id: "properties", label: "Properties" },
      { id: "applications", label: "Applications" },
      { id: "assignments", label: "Assignments" },
      { id: "workspace", label: "Workspace" },
    ],
  },
] as const;
type DetailSectionId = (typeof DETAIL_SECTIONS)[number]["items"][number]["id"];

function newRemoteApp(): AvdRemoteApp {
  return {
    name: "new-app",
    displayName: "New application",
    source: "Start menu",
    filePath: "",
    iconPath: "",
    iconIndex: 0,
    description: "",
    showInWebFeed: true,
    requireCmdLine: false,
    cmdLineArgs: "",
  };
}

// ─── RemoteApp editor (modal) ─────────────────────────────────────────────

function RemoteAppEditor({
  app,
  isNew,
  existingNames,
  onSave,
  onCancel,
}: {
  app: AvdRemoteApp;
  isNew: boolean;
  existingNames: string[];
  onSave: (app: AvdRemoteApp) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AvdRemoteApp>(app);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AvdRemoteApp>(key: K, value: AvdRemoteApp[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    if (!draft.name.trim()) {
      setError("Application name is required.");
      return;
    }
    if (!draft.displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    const nameConflict = existingNames.some((n) => n === draft.name && !(isNew === false && n === app.name));
    if (nameConflict) {
      setError(`An application named "${draft.name}" already exists in this group.`);
      return;
    }
    setError(null);
    onSave(draft);
  }

  return (
    <div className={styles.rulePanelOverlay} onClick={onCancel}>
      <div className={styles.rulePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.rulePanelHeader}>
          <h2>{isNew ? "Add application" : "Edit application"}</h2>
          <button type="button" className={styles.rulePanelClose} onClick={onCancel}>
            ×
          </button>
        </div>
        <div className={styles.rulePanelBody}>
          <Field label="Application name" required help="Internal identifier used within this application group.">
            <input className={styles.input} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g., word" />
          </Field>
          <Field label="Display name" required>
            <input
              className={styles.input}
              value={draft.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              placeholder="e.g., Microsoft Word"
            />
          </Field>
          <Field label="Description">
            <input className={styles.input} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Source" required>
            <RadioInline name="appSource" value={draft.source} onChange={(v) => set("source", v as AvdRemoteApp["source"])} choices={["Start menu", "File path"]} />
          </Field>
          <Field label="File path" required help="Path to the executable on the session host image.">
            <input
              className={styles.input}
              value={draft.filePath}
              onChange={(e) => set("filePath", e.target.value)}
              placeholder="C:\Program Files\app\app.exe"
            />
          </Field>
          <Field label="Icon path">
            <input className={styles.input} value={draft.iconPath} onChange={(e) => set("iconPath", e.target.value)} placeholder="Defaults to file path" />
          </Field>
          <Field label="Icon index">
            <input
              type="number"
              className={styles.input}
              style={{ width: 100 }}
              value={draft.iconIndex}
              onChange={(e) => set("iconIndex", parseInt(e.target.value, 10) || 0)}
            />
          </Field>
          <Checkbox label="Show in web feed" checked={draft.showInWebFeed} onChange={(v) => set("showInWebFeed", v)} />
          <Checkbox
            label="Require command line arguments"
            checked={draft.requireCmdLine}
            onChange={(v) => set("requireCmdLine", v)}
            help="If enabled, users must supply the arguments below when launching."
          />
          <Field label="Command line arguments" help="Optional arguments passed to the executable, or required if the checkbox above is enabled.">
            <input className={styles.input} value={draft.cmdLineArgs} onChange={(e) => set("cmdLineArgs", e.target.value)} />
          </Field>
          {error ? <div className={styles.validationErr}>{error}</div> : null}
        </div>
        <div className={styles.rulePanelFooter}>
          <button type="button" className={styles.btn} onClick={save}>
            Save
          </button>
          <button type="button" className={styles.btnOutline} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── List ──────────────────────────────────────────────────────────────

function AppGroupList({
  groups,
  onOpen,
  onCreate,
}: {
  groups: AvdApplicationGroup[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div>
      <div className={styles.listHeader}>
        <div>
          <h1>Application groups</h1>
          <p className={styles.sub}>Desktop and RemoteApp groups</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>
      <div className={styles.listBody}>
        {groups.length === 0 ? (
          <EmptyState message='No application groups yet. Click "+ Create" to make your first one.' />
        ) : (
          <DataTable columns={["Name", "Type", "Host pool", "Workspace", "Apps", "Assignments"]}>
            {groups.map((ag) => (
              <tr key={ag.id}>
                <td>
                  <button type="button" className={styles.link} onClick={() => onOpen(ag.id)}>
                    {ag.name}
                  </button>
                </td>
                <td>
                  <StatusBadge status={ag.type} />
                </td>
                <td>{ag.hostPool}</td>
                <td>{ag.workspace || "—"}</td>
                <td>{ag.applications.length}</td>
                <td>{ag.assignments.length}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}

// ─── Create wizard ─────────────────────────────────────────────────────

function AppGroupCreateWizard({
  state,
  onCancel,
  onCreate,
}: {
  state: AvdState;
  onCancel: () => void;
  onCreate: (group: AvdApplicationGroup) => void;
}) {
  const [wiz, setWiz] = useState<WizardState>(() => freshWizardState(state.resourceGroups[0]?.name ?? "", state.regions[0] ?? ""));
  const [activeTab, setActiveTab] = useState<WizardTabId>("basics");
  const activeIndex = WIZARD_TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setWiz((w) => ({ ...w, [key]: value }));
  }

  const errors = useMemo(() => validateWizard(wiz), [wiz]);

  function toggleAssignment(upn: string) {
    setWiz((w) => ({
      ...w,
      assignments: w.assignments.includes(upn) ? w.assignments.filter((u) => u !== upn) : [...w.assignments, upn],
    }));
  }

  function commit() {
    if (errors.length > 0) {
      setActiveTab("review");
      return;
    }
    const group: AvdApplicationGroup = {
      id: "ag-" + crypto.randomUUID(),
      name: wiz.name,
      type: wiz.type,
      hostPool: wiz.hostPool,
      resourceGroup: wiz.resourceGroup,
      region: wiz.region,
      description: wiz.description,
      workspace: wiz.registerWorkspace === "Yes" ? wiz.workspaceTarget : null,
      applications: [],
      assignments: wiz.assignments.slice(),
      tags: wiz.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
    };
    onCreate(group);
  }

  return (
    <div className={styles.wizard}>
      <TabBar tabs={WIZARD_TABS.map((t, i) => ({ id: t.id, label: t.label, done: i < activeIndex }))} active={activeTab} onChange={(id) => setActiveTab(id as WizardTabId)} />

      <div className={styles.wizBody}>
        {activeTab === "basics" ? (
          <>
            <div className={styles.wizSection}>
              <h3>Project details</h3>
            </div>
            <Field label="Subscription" required>
              <NativeSelect value={state.subscription.name} onChange={() => {}}>
                <option>{state.subscription.name}</option>
              </NativeSelect>
            </Field>
            <Field label="Resource group" required>
              <NativeSelect value={wiz.resourceGroup} onChange={(v) => set("resourceGroup", v)}>
                {state.resourceGroups.map((rg) => (
                  <option key={rg.name} value={rg.name}>
                    {rg.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <div className={styles.wizSection}>
              <h3>Application group</h3>
            </div>
            <Field label="Host pool" required>
              <NativeSelect value={wiz.hostPool} onChange={(v) => set("hostPool", v)}>
                <option value="">— select pool —</option>
                {state.hostPools.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Location" required>
              <NativeSelect value={wiz.region} onChange={(v) => set("region", v)}>
                {state.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Application group type">
              <RadioInline name="ag-type" value={wiz.type} onChange={(v) => set("type", v as WizardState["type"])} choices={["Desktop", "RemoteApp"]} />
            </Field>
            <Field label="Name" required>
              <input className={styles.input} value={wiz.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g., RAG-prod-office" />
            </Field>
            <Field label="Description">
              <textarea className={styles.textarea} rows={2} value={wiz.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </>
        ) : null}

        {activeTab === "assignments" ? (
          <>
            <div className={styles.wizSection}>
              <h3>Assignments</h3>
              <p>Pick users and groups who can launch resources from this application group. You can change these later.</p>
            </div>
            <DataTable columns={["", "Name", "UPN", "Type"]}>
              {state.users.map((u) => (
                <tr key={u.upn}>
                  <td>
                    <input type="checkbox" checked={wiz.assignments.includes(u.upn)} onChange={() => toggleAssignment(u.upn)} />
                  </td>
                  <td>{u.displayName}</td>
                  <td className={styles.help}>{u.upn}</td>
                  <td>{u.role}</td>
                </tr>
              ))}
            </DataTable>
          </>
        ) : null}

        {activeTab === "applications" ? (
          <>
            <div className={styles.wizSection}>
              <h3>Applications</h3>
              <p>
                {wiz.type === "RemoteApp"
                  ? "Published applications are added after the application group is created, from the Applications tab on the resource."
                  : "This is a Desktop application group — the full Windows desktop is published. There is no per-app list."}
              </p>
            </div>
            {wiz.type === "RemoteApp" ? (
              <Callout tone="info">You can add individual RemoteApps once this group is created.</Callout>
            ) : null}
          </>
        ) : null}

        {activeTab === "workspace" ? (
          <>
            <div className={styles.wizSection}>
              <h3>Workspace</h3>
              <p>Register this application group with a workspace so users can see it in the AVD client.</p>
            </div>
            <Field label="Register with workspace?">
              <RadioInline name="registerWorkspace" value={wiz.registerWorkspace} onChange={(v) => set("registerWorkspace", v as WizardState["registerWorkspace"])} choices={["No", "Yes"]} />
            </Field>
            {wiz.registerWorkspace === "Yes" ? (
              <Field label="Workspace" required>
                <NativeSelect value={wiz.workspaceTarget} onChange={(v) => set("workspaceTarget", v)}>
                  <option value="">— select —</option>
                  {state.workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.friendlyName || ""})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <Callout tone="info">You can register this group later.</Callout>
            )}
          </>
        ) : null}

        {activeTab === "review" ? (
          <>
            {errors.length === 0 ? (
              <Callout tone="info">✓ Validation passed</Callout>
            ) : (
              <Callout tone="warn">
                <b>Validation failed:</b>
                <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Callout>
            )}
            <div className={styles.sectionCard}>
              <h3>Summary</h3>
              {[
                ["Subscription", state.subscription.name],
                ["Resource group", wiz.resourceGroup],
                ["Host pool", wiz.hostPool || "—"],
                ["Type", wiz.type],
                ["Name", wiz.name || "—"],
                ["Assignments", `${wiz.assignments.length} selected`],
                ["Workspace registration", wiz.registerWorkspace + (wiz.workspaceTarget ? ` → ${wiz.workspaceTarget}` : "")],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span style={{ color: "#605e5c", fontWeight: 600 }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
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

// ─── Detail blade sections (render) ──────────────────────────────────────

function SecOverview({ group }: { group: AvdApplicationGroup }) {
  return (
    <div>
      <div className={styles.sectionCard}>
        <h3>Overview</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <PropPair label="Type" value={group.type} />
          <PropPair label="Host pool" value={group.hostPool} />
          <PropPair label="Resource group" value={group.resourceGroup} />
          <PropPair label="Location" value={group.region} />
          <PropPair label="Workspace" value={group.workspace || "—"} />
          <PropPair label="Apps" value={group.applications.length} />
          <PropPair label="Assignments" value={group.assignments.length} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Description</h3>
        <p>{group.description || "No description."}</p>
      </div>
    </div>
  );
}

function SecTags({
  group,
  onAddTag,
  onDeleteTag,
}: {
  group: AvdApplicationGroup;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const entries = Object.entries(group.tags);

  return (
    <div className={styles.sectionCard}>
      <h3>Tags</h3>
      <DataTable columns={["Name", "Value", ""]}>
        {entries.length === 0 ? (
          <tr>
            <td colSpan={3} className={styles.help} style={{ textAlign: "center" }}>
              No tags.
            </td>
          </tr>
        ) : (
          entries.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{v}</td>
              <td>
                <button type="button" className={styles.link} onClick={() => onDeleteTag(k)}>
                  Remove
                </button>
              </td>
            </tr>
          ))
        )}
      </DataTable>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input className={styles.input} placeholder="Name" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className={styles.input} placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!key) return;
            onAddTag(key, value);
            setKey("");
            setValue("");
          }}
        >
          Add tag
        </button>
      </div>
    </div>
  );
}

function SecProperties({
  group,
  hostPools,
  onUpdate,
}: {
  group: AvdApplicationGroup;
  hostPools: string[];
  onUpdate: (patch: Partial<AvdApplicationGroup>) => void;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Properties</h3>
      <Field label="Type">
        <NativeSelect value={group.type} onChange={() => {}}>
          <option>{group.type}</option>
        </NativeSelect>
      </Field>
      <Field label="Host pool">
        <NativeSelect value={group.hostPool} onChange={(v) => onUpdate({ hostPool: v })}>
          {hostPools.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Description">
        <textarea className={styles.textarea} rows={4} value={group.description} onChange={(e) => onUpdate({ description: e.target.value })} />
      </Field>
    </div>
  );
}

function SecApplications({
  group,
  onAdd,
  onEdit,
  onDelete,
}: {
  group: AvdApplicationGroup;
  onAdd: () => void;
  onEdit: (appName: string) => void;
  onDelete: (appName: string) => void;
}) {
  if (group.type !== "RemoteApp") {
    return (
      <div className={styles.sectionCard}>
        <h3>Applications</h3>
        <Callout tone="info">This is a Desktop application group — the full Windows desktop is published. There is no per-app list.</Callout>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Published applications</h3>
      <DataTable columns={["Name", "Source", "File path", "Web feed", "Cmd line", ""]}>
        {group.applications.length === 0 ? (
          <tr>
            <td colSpan={6} className={styles.help} style={{ textAlign: "center" }}>
              No applications published.
            </td>
          </tr>
        ) : (
          group.applications.map((a) => (
            <tr key={a.name}>
              <td>
                <b>{a.displayName}</b>
                <div className={styles.help}>{a.name}</div>
              </td>
              <td>{a.source}</td>
              <td className={styles.help}>{a.filePath}</td>
              <td>{a.showInWebFeed ? "Yes" : "No"}</td>
              <td>{a.requireCmdLine ? "Required" : "Optional"}</td>
              <td>
                <button type="button" className={styles.link} onClick={() => onEdit(a.name)}>
                  Edit
                </button>{" "}
                <button type="button" className={styles.link} onClick={() => onDelete(a.name)}>
                  Remove
                </button>
              </td>
            </tr>
          ))
        )}
      </DataTable>
      <div style={{ marginTop: 10 }}>
        <button type="button" className={styles.btn} onClick={onAdd}>
          + Add application
        </button>
      </div>
    </div>
  );
}

function SecAssignments({
  group,
  users,
  onAssign,
  onUnassign,
}: {
  group: AvdApplicationGroup;
  users: AvdState["users"];
  onAssign: (upn: string) => void;
  onUnassign: (upn: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const current = group.assignments;
  const notAssigned = users.filter((u) => !current.includes(u.upn));

  return (
    <div className={styles.sectionCard}>
      <h3>Assignments</h3>
      <DataTable columns={["User / group", ""]}>
        {current.length === 0 ? (
          <tr>
            <td colSpan={2} className={styles.help} style={{ textAlign: "center" }}>
              No users / groups assigned.
            </td>
          </tr>
        ) : (
          current.map((upn) => {
            const info = users.find((u) => u.upn === upn);
            return (
              <tr key={upn}>
                <td>
                  {upn}
                  {info ? (
                    <span className={`${styles.badge} ${styles.badgeOutline}`} style={{ marginLeft: 8 }}>
                      {info.role}
                    </span>
                  ) : null}
                </td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onUnassign(upn)}>
                    Remove
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </DataTable>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <NativeSelect value={selected} onChange={setSelected}>
          <option value="">— select —</option>
          {notAssigned.map((u) => (
            <option key={u.upn} value={u.upn}>
              {u.displayName} ({u.upn})
            </option>
          ))}
        </NativeSelect>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!selected) return;
            onAssign(selected);
            setSelected("");
          }}
        >
          + Add assignment
        </button>
      </div>
    </div>
  );
}

function SecWorkspace({
  group,
  workspaces,
  onSetWorkspace,
}: {
  group: AvdApplicationGroup;
  workspaces: AvdState["workspaces"];
  onSetWorkspace: (workspaceId: string | null) => void;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Workspace</h3>
      <p style={{ marginBottom: 12 }}>
        Registering this application group with a workspace makes it visible to assigned users in the AVD client. An application group can belong to
        only one workspace at a time.
      </p>
      <Field label="Workspace">
        <NativeSelect value={group.workspace ?? ""} onChange={(v) => onSetWorkspace(v || null)}>
          <option value="">— not registered —</option>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.friendlyName || "—"})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Callout tone="info">
        This only updates this application group&apos;s own workspace reference. The workspace&apos;s list of included application groups is kept in
        sync when you visit the Workspaces page.
      </Callout>
    </div>
  );
}

// ─── Detail blade ──────────────────────────────────────────────────────

function AppGroupDetailBlade({
  group,
  state,
  onBack,
  onDelete,
  onUpdate,
  onAddTag,
  onDeleteTag,
  onAssign,
  onUnassign,
  onSetWorkspace,
  onAddApp,
  onSaveApp,
  onDeleteApp,
}: {
  group: AvdApplicationGroup;
  state: AvdState;
  onBack: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<AvdApplicationGroup>) => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onAssign: (upn: string) => void;
  onUnassign: (upn: string) => void;
  onSetWorkspace: (workspaceId: string | null) => void;
  onAddApp: (app: AvdRemoteApp) => void;
  onSaveApp: (appName: string, patch: Partial<AvdRemoteApp>) => void;
  onDeleteApp: (appName: string) => void;
}) {
  const [section, setSection] = useState<DetailSectionId>("overview");
  const [appEditor, setAppEditor] = useState<{ isNew: boolean; app: AvdRemoteApp } | null>(null);

  function renderSection() {
    switch (section) {
      case "overview":
        return <SecOverview group={group} />;
      case "tags":
        return <SecTags group={group} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "properties":
        return <SecProperties group={group} hostPools={state.hostPools.map((p) => p.name)} onUpdate={onUpdate} />;
      case "applications":
        return (
          <SecApplications
            group={group}
            onAdd={() => setAppEditor({ isNew: true, app: newRemoteApp() })}
            onEdit={(appName) => {
              const app = group.applications.find((a) => a.name === appName);
              if (app) setAppEditor({ isNew: false, app });
            }}
            onDelete={onDeleteApp}
          />
        );
      case "assignments":
        return <SecAssignments group={group} users={state.users} onAssign={onAssign} onUnassign={onUnassign} />;
      case "workspace":
        return <SecWorkspace group={group} workspaces={state.workspaces} onSetWorkspace={onSetWorkspace} />;
      default:
        return <SecOverview group={group} />;
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>{group.type === "Desktop" ? "D" : "RA"}</div>
        <div style={{ flex: 1 }}>
          <h1>{group.name}</h1>
          <p className={styles.bladeSub}>
            {group.type} application group · {group.hostPool}
          </p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className={styles.bladeFrame}>
        <aside className={styles.bladeNav}>
          {DETAIL_SECTIONS.map((grp) => (
            <div key={grp.group || "root"}>
              {grp.group ? <div className={styles.bladeHeading}>{grp.group}</div> : null}
              {grp.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`${styles.bladeItem} ${section === item.id ? styles.bladeItemActive : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main className={styles.bladeMain}>{renderSection()}</main>
      </div>

      {appEditor ? (
        <RemoteAppEditor
          app={appEditor.app}
          isNew={appEditor.isNew}
          existingNames={group.applications.map((a) => a.name).filter((n) => appEditor.isNew || n !== appEditor.app.name)}
          onSave={(app) => {
            if (appEditor.isNew) {
              onAddApp(app);
              toast.success(`Application "${app.displayName}" added`);
            } else {
              onSaveApp(appEditor.app.name, app);
              toast.success(`Application "${app.displayName}" saved`);
            }
            setAppEditor(null);
          }}
          onCancel={() => setAppEditor(null)}
        />
      ) : null}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────

type View = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };

export function ApplicationGroupsPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [view, setView] = useState<View>({ kind: "list" });

  const group = view.kind === "detail" ? state.applicationGroups.find((g) => g.id === view.id) ?? null : null;

  if (view.kind === "create") {
    return (
      <AppGroupCreateWizard
        state={state}
        onCancel={() => setView({ kind: "list" })}
        onCreate={(newGroup) => {
          dispatch({ type: "ADD_APP_GROUP", group: newGroup });
          toast.success(`Application group "${newGroup.name}" created`);
          setView({ kind: "detail", id: newGroup.id });
        }}
      />
    );
  }

  if (view.kind === "detail" && group) {
    return (
      <AppGroupDetailBlade
        group={group}
        state={state}
        onBack={() => setView({ kind: "list" })}
        onDelete={() => {
          if (!confirm(`Delete application group "${group.name}"?`)) return;
          dispatch({ type: "DELETE_APP_GROUP", id: group.id });
          toast.info("Application group deleted");
          setView({ kind: "list" });
        }}
        onUpdate={(patch) => dispatch({ type: "UPDATE_APP_GROUP", id: group.id, patch })}
        onAddTag={(key, value) => {
          if (!key) return;
          dispatch({ type: "UPDATE_APP_GROUP", id: group.id, patch: { tags: { ...group.tags, [key]: value } } });
        }}
        onDeleteTag={(key) => {
          const tags = { ...group.tags };
          delete tags[key];
          dispatch({ type: "UPDATE_APP_GROUP", id: group.id, patch: { tags } });
        }}
        onAssign={(upn) => {
          if (group.assignments.includes(upn)) return;
          dispatch({ type: "UPDATE_APP_GROUP", id: group.id, patch: { assignments: [...group.assignments, upn] } });
        }}
        onUnassign={(upn) => {
          dispatch({ type: "UPDATE_APP_GROUP", id: group.id, patch: { assignments: group.assignments.filter((u) => u !== upn) } });
        }}
        onSetWorkspace={(workspaceId) => {
          dispatch({ type: "UPDATE_APP_GROUP", id: group.id, patch: { workspace: workspaceId } });
          toast.success(workspaceId ? "Workspace updated" : "Removed from workspace");
        }}
        onAddApp={(app) => dispatch({ type: "ADD_REMOTE_APP", groupId: group.id, app })}
        onSaveApp={(appName, patch) => dispatch({ type: "UPDATE_REMOTE_APP", groupId: group.id, appName, patch })}
        onDeleteApp={(appName) => {
          dispatch({ type: "DELETE_REMOTE_APP", groupId: group.id, appName });
          toast.info("Application removed");
        }}
      />
    );
  }

  return (
    <AppGroupList
      groups={state.applicationGroups}
      onOpen={(id) => setView({ kind: "detail", id })}
      onCreate={() => setView({ kind: "create" })}
    />
  );
}
