"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AvdApplicationGroup, AvdState, AvdWorkspace } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import {
  DataTable,
  EmptyState,
  Field,
  NativeSelect,
  PropPair,
  ResourceGroupField,
  SectionHeader,
  TabBar,
  WizardFooter,
} from "./avd-ui";

// ─── Wizard state ──────────────────────────────────────────────────
const WIZARD_TABS = [
  { id: "basics", label: "Basics" },
  { id: "appgroups", label: "Application groups" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type WizardTabId = (typeof WIZARD_TABS)[number]["id"];

type TagDraft = { key: string; value: string };

type WorkspaceWizardState = {
  resourceGroup: string;
  name: string;
  friendlyName: string;
  description: string;
  region: string;
  appGroups: string[];
  tags: TagDraft[];
};

function freshWizardState(state: AvdState): WorkspaceWizardState {
  return {
    resourceGroup: state.resourceGroups[0]?.name ?? "",
    name: "",
    friendlyName: "",
    description: "",
    region: state.regions[0] ?? "",
    appGroups: [],
    tags: [],
  };
}

function validateWizardState(wiz: WorkspaceWizardState): string[] {
  const errs: string[] = [];
  if (!wiz.name) errs.push("Workspace name is required.");
  else if (!/^[a-zA-Z0-9-]{3,64}$/.test(wiz.name)) errs.push("Workspace name must be 3-64 alphanumeric / hyphen.");
  if (!wiz.resourceGroup) errs.push("Resource group is required.");
  return errs;
}

// ─── Blade sections ────────────────────────────────────────────────
const BLADE_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity log" },
  { id: "iam", label: "Access control (IAM)" },
  { id: "tags", label: "Tags" },
  { id: "appgroups", label: "Application groups" },
  { id: "properties", label: "Properties" },
  { id: "locks", label: "Locks" },
  { id: "diag", label: "Diagnostic settings" },
] as const;

type BladeSectionId = (typeof BLADE_SECTIONS)[number]["id"];

type ViewState = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };

export function WorkspacesPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [view, setView] = useState<ViewState>({ kind: "list" });

  if (view.kind === "create") {
    return (
      <WorkspaceCreateWizard
        state={state}
        dispatch={dispatch}
        onCancel={() => setView({ kind: "list" })}
        onCreated={(id) => setView({ kind: "detail", id })}
      />
    );
  }

  if (view.kind === "detail") {
    const ws = state.workspaces.find((w) => w.id === view.id);
    if (!ws) {
      return (
        <div className={styles.sectionCard}>
          <EmptyState message="Workspace not found." />
          <button type="button" className={styles.link} onClick={() => setView({ kind: "list" })}>
            Back to workspaces
          </button>
        </div>
      );
    }
    return (
      <WorkspaceDetailBlade
        workspace={ws}
        state={state}
        dispatch={dispatch}
        onBack={() => setView({ kind: "list" })}
        onDeleted={() => setView({ kind: "list" })}
      />
    );
  }

  return (
    <WorkspaceList
      state={state}
      onCreate={() => setView({ kind: "create" })}
      onOpen={(id) => setView({ kind: "detail", id })}
    />
  );
}

// ─── List ──────────────────────────────────────────────────────────
function WorkspaceList({
  state,
  onCreate,
  onOpen,
}: {
  state: AvdState;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Workspaces</h1>
          <p className={styles.sub}>Group application groups for end-user feed publishing</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {state.workspaces.length === 0 ? (
          <EmptyState message="No workspaces yet. Click Create to make your first one." />
        ) : (
          <DataTable columns={["Name", "Friendly name", "Resource group", "Region", "App groups"]}>
            {state.workspaces.map((w) => (
              <tr key={w.id}>
                <td>
                  <button type="button" className={styles.link} onClick={() => onOpen(w.id)}>
                    {w.name}
                  </button>
                </td>
                <td>{w.friendlyName || "—"}</td>
                <td>{w.resourceGroup}</td>
                <td>{w.region}</td>
                <td>{w.applicationGroups.length}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}

// ─── Create wizard ─────────────────────────────────────────────────
function WorkspaceCreateWizard({
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
  const [wiz, setWiz] = useState<WorkspaceWizardState>(() => freshWizardState(state));
  const [activeTab, setActiveTab] = useState<WizardTabId>("basics");
  const [resourceGroupNames, setResourceGroupNames] = useState<string[]>(() => state.resourceGroups.map((rg) => rg.name));

  const activeIndex = WIZARD_TABS.findIndex((t) => t.id === activeTab);
  const errors = useMemo(() => validateWizardState(wiz), [wiz]);

  function set<K extends keyof WorkspaceWizardState>(key: K, value: WorkspaceWizardState[K]) {
    setWiz((w) => ({ ...w, [key]: value }));
  }

  function toggleAppGroup(id: string) {
    setWiz((w) => ({
      ...w,
      appGroups: w.appGroups.includes(id) ? w.appGroups.filter((x) => x !== id) : [...w.appGroups, id],
    }));
  }

  function commit() {
    if (errors.length > 0) {
      setActiveTab("review");
      return;
    }
    const id = "ws-" + crypto.randomUUID();
    const workspace: AvdWorkspace = {
      id,
      name: wiz.name,
      friendlyName: wiz.friendlyName,
      description: wiz.description,
      resourceGroup: wiz.resourceGroup,
      region: wiz.region,
      applicationGroups: [...wiz.appGroups],
      tags: wiz.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
    };
    dispatch({ type: "ADD_WORKSPACE", workspace });
    // Keep each selected app group's `workspace` pointer consistent with the
    // new workspace's `applicationGroups` array (mirrors the source
    // simulator's "last write wins" behavior when an app group is picked
    // into more than one workspace during creation).
    wiz.appGroups.forEach((agId) => {
      dispatch({ type: "UPDATE_APP_GROUP", id: agId, patch: { workspace: id } });
    });
    toast.success(`Workspace "${workspace.name}" created`);
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
        {activeTab === "basics" && (
          <>
            <SectionHeader title="Project details" />
            <Field label="Subscription" required>
              <NativeSelect value={state.subscription.name} onChange={() => {}}>
                <option>{state.subscription.name}</option>
              </NativeSelect>
            </Field>
            <ResourceGroupField
              resourceGroups={resourceGroupNames}
              value={wiz.resourceGroup}
              onChange={(v) => set("resourceGroup", v)}
              onCreate={(name) => setResourceGroupNames((names) => (names.includes(name) ? names : [...names, name]))}
            />
            <SectionHeader title="Workspace details" />
            <Field label="Workspace name" required>
              <input
                value={wiz.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g., ws-prod"
                className={styles.input}
              />
            </Field>
            <Field label="Friendly name">
              <input
                value={wiz.friendlyName}
                onChange={(e) => set("friendlyName", e.target.value)}
                placeholder="CloudLab Production"
                className={styles.input}
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={2}
                value={wiz.description}
                onChange={(e) => set("description", e.target.value)}
                className={styles.textarea}
              />
            </Field>
            <Field label="Region" required>
              <NativeSelect value={wiz.region} onChange={(v) => set("region", v)}>
                {state.regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
            </Field>
          </>
        )}

        {activeTab === "appgroups" && (
          <>
            <SectionHeader title="Application groups" sub="Pick the application groups to include in this workspace." />
            {state.applicationGroups.length === 0 ? (
              <EmptyState message="No application groups exist yet — create some first." />
            ) : (
              <DataTable columns={["", "Name", "Type", "Host pool"]}>
                {state.applicationGroups.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={wiz.appGroups.includes(a.id)}
                        onChange={() => toggleAppGroup(a.id)}
                      />
                    </td>
                    <td>{a.name}</td>
                    <td>{a.type}</td>
                    <td>{a.hostPool}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader title="Tags" />
            <DataTable columns={["Name", "Value", ""]}>
              {wiz.tags.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyState}>
                    No tags.
                  </td>
                </tr>
              ) : (
                wiz.tags.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        value={t.key}
                        onChange={(e) => {
                          const tags = [...wiz.tags];
                          tags[i] = { ...tags[i], key: e.target.value };
                          set("tags", tags);
                        }}
                        placeholder="Name"
                        className={styles.input}
                      />
                    </td>
                    <td>
                      <input
                        value={t.value}
                        onChange={(e) => {
                          const tags = [...wiz.tags];
                          tags[i] = { ...tags[i], value: e.target.value };
                          set("tags", tags);
                        }}
                        placeholder="Value"
                        className={styles.input}
                      />
                    </td>
                    <td>
                      <button type="button" className={styles.link} onClick={() => set("tags", wiz.tags.filter((_, idx) => idx !== i))}>
                        &times;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
            <button
              type="button"
              className={styles.link}
              style={{ marginTop: 8 }}
              onClick={() => set("tags", [...wiz.tags, { key: "", value: "" }])}
            >
              + Add tag
            </button>
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
              <PropPair label="Subscription" value={state.subscription.name} />
              <PropPair label="Resource group" value={wiz.resourceGroup} />
              <PropPair label="Workspace name" value={wiz.name || "—"} />
              <PropPair label="Friendly name" value={wiz.friendlyName || "—"} />
              <PropPair label="Region" value={wiz.region} />
              <PropPair label="App groups" value={`${wiz.appGroups.length} selected`} />
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

// ─── Detail blade ──────────────────────────────────────────────────
function WorkspaceDetailBlade({
  workspace,
  state,
  dispatch,
  onBack,
  onDeleted,
}: {
  workspace: AvdWorkspace;
  state: AvdState;
  dispatch: React.Dispatch<AvdAction>;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [section, setSection] = useState<BladeSectionId>("overview");

  function handleDelete() {
    if (!window.confirm(`Delete workspace "${workspace.name}"?`)) return;
    dispatch({ type: "DELETE_WORKSPACE", id: workspace.id });
    toast.info("Workspace deleted");
    onDeleted();
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon} style={{ background: "#008272" }}>
          WS
        </div>
        <div style={{ flex: 1 }}>
          <h1>{workspace.name}</h1>
          <p className={styles.bladeSub}>Workspace · {workspace.friendlyName || workspace.name}</p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className={styles.bladeFrame}>
        <aside className={styles.bladeNav}>
          {BLADE_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`${styles.bladeItem} ${section === s.id ? styles.bladeItemActive : ""}`}
            >
              {s.label}
            </button>
          ))}
        </aside>
        <main className={styles.bladeMain}>
          {section === "overview" && <SecOverview workspace={workspace} state={state} onGoToAppGroups={() => setSection("appgroups")} />}
          {section === "activity" && <SecActivity workspace={workspace} state={state} />}
          {section === "iam" && <SecIAM />}
          {section === "tags" && <SecTags workspace={workspace} dispatch={dispatch} />}
          {section === "appgroups" && <SecAppGroups workspace={workspace} state={state} dispatch={dispatch} />}
          {section === "properties" && <SecProperties workspace={workspace} state={state} dispatch={dispatch} />}
          {section === "locks" && <SecLocks />}
          {section === "diag" && (
            <div className={styles.sectionCard}>
              <h3>Diagnostic settings</h3>
              <p>Stream workspace events to a Log Analytics workspace.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SecOverview({
  workspace,
  state,
  onGoToAppGroups,
}: {
  workspace: AvdWorkspace;
  state: AvdState;
  onGoToAppGroups: () => void;
}) {
  const groups = workspace.applicationGroups
    .map((id) => state.applicationGroups.find((a) => a.id === id))
    .filter((a): a is AvdApplicationGroup => Boolean(a));

  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Essentials</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Friendly name" value={workspace.friendlyName || "—"} />
          <PropPair label="Resource group" value={workspace.resourceGroup} />
          <PropPair label="Region" value={workspace.region} />
          <PropPair label="Subscription" value={state.subscription.name} />
          <PropPair label="Subscription ID" value={state.subscription.id} />
          <PropPair label="Application groups" value={groups.length} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Application groups included
          <button type="button" className={styles.link} onClick={onGoToAppGroups}>
            Manage
          </button>
        </h3>
        {groups.length === 0 ? (
          <EmptyState message="No application groups yet." />
        ) : (
          <ul style={{ lineHeight: 1.7, paddingLeft: 20 }}>
            {groups.map((a) => (
              <li key={a.id}>
                {a.name} <span className={`${styles.badge} ${styles.badgeOutline}`}>{a.type}</span> &middot; pool {a.hostPool}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.sectionCard}>
        <h3>Description</h3>
        <p>{workspace.description || "No description."}</p>
      </div>
    </>
  );
}

function SecActivity({ workspace, state }: { workspace: AvdWorkspace; state: AvdState }) {
  const logs = state.activityLog.filter((l) => l.resource === workspace.name).slice(0, 20);
  return (
    <div className={styles.sectionCard}>
      <h3>Activity log</h3>
      {logs.length === 0 ? (
        <EmptyState message="No activity yet." />
      ) : (
        <DataTable columns={["Time", "Operation", "Status"]}>
          {logs.map((l, i) => (
            <tr key={i}>
              <td>{new Date(l.time).toLocaleString()}</td>
              <td>{l.operation}</td>
              <td>
                <span className={`${styles.badge} ${l.status === "Succeeded" ? styles.badgeRunning : styles.badgeStopped}`}>{l.status}</span>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function SecIAM() {
  return (
    <div className={styles.sectionCard}>
      <h3>Access control (IAM)</h3>
      <div className={styles.subTabs}>
        <div className={`${styles.subTab} ${styles.subTabActive}`}>Check access</div>
        <div className={styles.subTab}>Role assignments</div>
        <div className={styles.subTab}>Roles</div>
      </div>
      <div className={styles.sectionCard} style={{ background: "#faf9f8", marginTop: 16 }}>
        <b>Common workspace roles:</b>
        <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 1.8 }}>
          <li>Desktop Virtualization Workspace Contributor — manage workspace properties and app group registration.</li>
          <li>Desktop Virtualization Reader — view workspace.</li>
        </ul>
      </div>
    </div>
  );
}

function SecTags({ workspace, dispatch }: { workspace: AvdWorkspace; dispatch: React.Dispatch<AvdAction> }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const keys = Object.keys(workspace.tags);

  function addTag() {
    if (!key) return;
    dispatch({ type: "UPDATE_WORKSPACE", id: workspace.id, patch: { tags: { ...workspace.tags, [key]: value } } });
    setKey("");
    setValue("");
  }

  function removeTag(k: string) {
    const tags = { ...workspace.tags };
    delete tags[k];
    dispatch({ type: "UPDATE_WORKSPACE", id: workspace.id, patch: { tags } });
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Tags</h3>
      <DataTable columns={["Name", "Value", ""]}>
        {keys.length === 0 ? (
          <tr>
            <td colSpan={3} className={styles.emptyState}>
              No tags.
            </td>
          </tr>
        ) : (
          keys.map((k) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{workspace.tags[k]}</td>
              <td>
                <button type="button" className={styles.link} onClick={() => removeTag(k)}>
                  Remove
                </button>
              </td>
            </tr>
          ))
        )}
      </DataTable>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Name" className={styles.input} style={{ width: 160 }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={styles.input} style={{ width: 160 }} />
        <button type="button" className={styles.btn} onClick={addTag}>
          Add tag
        </button>
      </div>
    </div>
  );
}

function SecAppGroups({
  workspace,
  state,
  dispatch,
}: {
  workspace: AvdWorkspace;
  state: AvdState;
  dispatch: React.Dispatch<AvdAction>;
}) {
  function addAppGroup(ag: AvdApplicationGroup) {
    if (workspace.applicationGroups.includes(ag.id)) return;
    dispatch({
      type: "UPDATE_WORKSPACE",
      id: workspace.id,
      patch: { applicationGroups: [...workspace.applicationGroups, ag.id] },
    });
    dispatch({ type: "UPDATE_APP_GROUP", id: ag.id, patch: { workspace: workspace.id } });
    toast.success(`${ag.name} added to ${workspace.name}`);
  }

  function removeAppGroup(ag: AvdApplicationGroup) {
    dispatch({
      type: "UPDATE_WORKSPACE",
      id: workspace.id,
      patch: { applicationGroups: workspace.applicationGroups.filter((x) => x !== ag.id) },
    });
    // Only clear the app group's workspace pointer if it still points here —
    // keeps the two-sided relationship consistent without clobbering a
    // pointer that may have already moved to a different workspace.
    if (ag.workspace === workspace.id) {
      dispatch({ type: "UPDATE_APP_GROUP", id: ag.id, patch: { workspace: null } });
    }
    toast.info(`${ag.name} removed from ${workspace.name}`);
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Application groups</h3>
      {state.applicationGroups.length === 0 ? (
        <EmptyState message="No application groups available." />
      ) : (
        <DataTable columns={["Name", "Type", "Host pool", "Included", ""]}>
          {state.applicationGroups.map((a) => {
            const included = workspace.applicationGroups.includes(a.id);
            return (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.type}</td>
                <td>{a.hostPool}</td>
                <td>{included ? "Yes" : "No"}</td>
                <td>
                  {included ? (
                    <button type="button" className={styles.link} onClick={() => removeAppGroup(a)}>
                      Remove
                    </button>
                  ) : (
                    <button type="button" className={styles.link} onClick={() => addAppGroup(a)}>
                      Add
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}

function SecProperties({
  workspace,
  state,
  dispatch,
}: {
  workspace: AvdWorkspace;
  state: AvdState;
  dispatch: React.Dispatch<AvdAction>;
}) {
  const [friendlyName, setFriendlyName] = useState(workspace.friendlyName);
  const [description, setDescription] = useState(workspace.description);

  function save() {
    dispatch({ type: "UPDATE_WORKSPACE", id: workspace.id, patch: { friendlyName, description } });
    toast.success("Saved");
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Properties</h3>
      <Field label="Friendly name">
        <input value={friendlyName} onChange={(e) => setFriendlyName(e.target.value)} className={styles.input} style={{ maxWidth: 380 }} />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={styles.textarea} />
      </Field>
      <button type="button" className={styles.btn} onClick={save}>
        Save
      </button>
      <h4 style={{ marginTop: 18, marginBottom: 8 }}>Resource info</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair
          label="Resource ID"
          value={`/subscriptions/${state.subscription.id}/resourceGroups/${workspace.resourceGroup}/providers/Microsoft.DesktopVirtualization/workspaces/${workspace.name}`}
        />
        <PropPair label="Region" value={workspace.region} />
        <PropPair label="Subscription" value={state.subscription.name} />
      </div>
    </div>
  );
}

function SecLocks() {
  return (
    <div className={styles.sectionCard}>
      <h3>Locks</h3>
      <p>Locks prevent accidental deletion or modification.</p>
      <button type="button" className={styles.btn}>
        + Add
      </button>
      <DataTable columns={["Lock name", "Type", "Scope"]}>
        <tr>
          <td colSpan={3} className={styles.emptyState}>
            No locks defined.
          </td>
        </tr>
      </DataTable>
    </div>
  );
}
