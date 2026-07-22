"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsGpo, AddsGpoLink, AddsState } from "@/lib/labs/simulators/adds/types";
import { gpoPoliciesInCategory, gpoPolicyCategories, type GpoPolicyDef } from "@/lib/labs/simulators/adds/gpoCatalog";
import { AddsContextMenu, type ContextMenuItem } from "./adds-context-menu";
import { AddsDialog, CheckboxRow, EmptyPane, FormRow, FormSection, HelpText } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable, ListBox, MmcLayout, MmcTreeNode, TabbedPanel, type TreeNode } from "./mmc-console";
import styles from "./adds-console.module.css";

type Dialog =
  | { kind: "new-gpo" }
  | { kind: "link-gpo"; gpoName: string }
  | { kind: "add-security-filter"; gpoName: string }
  | { kind: "set-wmi-filter"; gpoName: string }
  | { kind: "new-wmi-filter" }
  | { kind: "backup-all" }
  | { kind: "gpme"; gpoName: string }
  | { kind: "policy-editor"; gpoName: string; policy: GpoPolicyDef };

const WMI_PRESETS = [
  { name: "Windows 11 only", description: "Applies only to Windows 11 clients", query: 'SELECT * FROM Win32_OperatingSystem WHERE Version LIKE "10.0.22%"' },
  { name: "Laptops only", description: "Applies only to devices with a battery (laptops)", query: "SELECT * FROM Win32_Battery WHERE BatteryStatus IS NOT NULL" },
  { name: "64-bit OS only", description: "Applies only to 64-bit operating systems", query: 'SELECT * FROM Win32_OperatingSystem WHERE OSArchitecture = "64-bit"' },
];

function newGpoId(): string {
  return `{${crypto.randomUUID().toUpperCase()}}`;
}

export function GpoConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("domainRoot");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ forest: true, domains: true, domainRoot: true, gpos: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [activeTab, setActiveTab] = useState("Scope");

  const treeRoot: TreeNode = {
    id: "forest",
    icon: "F",
    label: `Forest: ${state.domain.fqdn}`,
    children: [
      {
        id: "domains",
        icon: "D",
        label: "Domains",
        children: [
          {
            id: "domainRoot",
            icon: "D",
            label: state.domain.fqdn,
            children: [
              {
                id: "gpos",
                icon: "P",
                label: "Group Policy Objects",
                children: state.gpos.map((g) => ({ id: `gpo:${g.name}`, icon: "g", label: g.name })),
              },
              { id: "wmi", icon: "W", label: "WMI Filters", children: state.wmiFilters.map((w) => ({ id: `wmi:${w.name}`, icon: "w", label: w.name })) },
              { id: "starter", icon: "S", label: "Starter GPOs" },
            ],
          },
        ],
      },
      { id: "sites", icon: "S", label: "Sites", children: state.sites.map((s) => ({ id: `site:${s.name}`, icon: "s", label: s.name })) },
      { id: "modeling", icon: "M", label: "Group Policy Modeling" },
      { id: "results", icon: "R", label: "Group Policy Results" },
    ],
  };

  function headingFor(node: string): string {
    if (node === "forest") return `Forest: ${state.domain.fqdn}`;
    if (node === "domains") return "Domains";
    if (node === "domainRoot") return state.domain.fqdn;
    if (node === "gpos") return `Group Policy Objects in ${state.domain.fqdn}`;
    if (node === "wmi") return "WMI Filters";
    if (node === "starter") return "Starter GPOs";
    if (node === "sites") return "Sites";
    if (node === "modeling") return "Group Policy Modeling";
    if (node === "results") return "Group Policy Results";
    if (node.startsWith("gpo:")) return node.slice(4);
    if (node.startsWith("wmi:")) return node.slice(4);
    if (node.startsWith("site:")) return node.slice(5);
    return "";
  }

  function linksAt(ou: string): AddsGpo[] {
    return state.gpos.filter((g) => g.links.some((l) => l.ou === ou));
  }

  function toggleLink(gpoName: string, ou: string, field: "enforced" | "enabled") {
    dispatch({ type: "TOGGLE_GPO_LINK", gpoName, ou, field });
  }

  function removeLink(gpoName: string, ou: string) {
    if (!confirm(`Remove link of ${gpoName} from ${ou || "(domain root)"}?`)) return;
    dispatch({ type: "UNLINK_GPO", gpoName, ou });
    toast.success("Link removed.");
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const items: ContextMenuItem[] = [];
    if (nodeId === "gpos") {
      items.push({ key: "new", label: "New", onClick: () => setDialog({ kind: "new-gpo" }) });
      items.push({ key: "back", label: "Back Up All...", onClick: () => setDialog({ kind: "backup-all" }) });
    } else if (nodeId.startsWith("gpo:")) {
      const gname = nodeId.slice(4);
      const g = state.gpos.find((x) => x.name === gname);
      items.push({ key: "edit", label: "Edit...", onClick: () => setDialog({ kind: "gpme", gpoName: gname }) });
      items.push("-");
      items.push({ key: "link", label: "Link to OU...", onClick: () => setDialog({ kind: "link-gpo", gpoName: gname }) });
      items.push("-");
      items.push({
        key: "del",
        label: "Delete",
        onClick: () => {
          if (g?.builtin) {
            toast.error("Built-in GPOs cannot be deleted.");
            return;
          }
          if (confirm(`Delete GPO "${gname}"?`)) {
            dispatch({ type: "DELETE_GPO", name: gname });
            toast.success(`Deleted ${gname}`);
            setSelectedNode("gpos");
          }
        },
      });
    } else if (nodeId === "wmi") {
      items.push({ key: "newwmi", label: "New...", onClick: () => setDialog({ kind: "new-wmi-filter" }) });
    }
    if (items.length) AddsContextMenu.show(e.clientX, e.clientY, items);
  }

  function renderLinkedTable(gpos: AddsGpo[], atOu: string) {
    if (!gpos.length) return <EmptyPane>No GPOs are linked here.</EmptyPane>;
    return (
      <ItemListTable columns={["Link order", "GPO", "Enforced", "Link Enabled", "GPO Status", ""]}>
        {gpos.map((g, i) => {
          const link = g.links.find((l) => l.ou === atOu);
          if (!link) return null;
          return (
            <tr key={g.name}>
              <td>{i + 1}</td>
              <td>{g.name}</td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); toggleLink(g.name, atOu, "enforced"); }}>
                  {link.enforced ? "Yes" : "No"}
                </a>
              </td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); toggleLink(g.name, atOu, "enabled"); }}>
                  {link.enabled ? "Yes" : "No"}
                </a>
              </td>
              <td>Enabled</td>
              <td>
                <button type="button" className={styles.btn} onClick={() => removeLink(g.name, atOu)}>
                  Remove link
                </button>
              </td>
            </tr>
          );
        })}
      </ItemListTable>
    );
  }

  function renderGpoList() {
    return (
      <ContentBody
        onContextMenu={(e) => {
          e.preventDefault();
          AddsContextMenu.show(e.clientX, e.clientY, [
            { key: "new", label: "New GPO...", onClick: () => setDialog({ kind: "new-gpo" }) },
            { key: "back", label: "Back Up All...", onClick: () => setDialog({ kind: "backup-all" }) },
          ]);
        }}
      >
        <ItemListTable columns={["Name", "GPO Status", "WMI Filter", "Modified"]}>
          {state.gpos.map((g) => (
            <tr
              key={g.name}
              onDoubleClick={() => {
                setSelectedNode(`gpo:${g.name}`);
                setExpanded((ex) => ({ ...ex, gpos: true }));
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setSelectedNode(`gpo:${g.name}`);
                showTreeContextMenu(e, `gpo:${g.name}`);
              }}
            >
              <td>
                <span className={styles.itmIcon}>g</span>
                {g.name}
              </td>
              <td>Enabled</td>
              <td>{g.wmiFilter || "(none)"}</td>
              <td>{g.modified || "-"}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderDomainRoot() {
    const linked = linksAt("");
    return (
      <ContentBody>
        <p>This is the domain root. The following GPOs are linked here:</p>
        {renderLinkedTable(linked, "")}
      </ContentBody>
    );
  }

  function renderWmiList() {
    if (!state.wmiFilters.length) {
      return (
        <EmptyPane>
          No WMI filters are defined.
          <br />
          <br />
          Right-click <b>WMI Filters</b> to create a new filter.
        </EmptyPane>
      );
    }
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Description", "Query"]}>
          {state.wmiFilters.map((w) => (
            <tr key={w.name}>
              <td>
                <span className={styles.itmIcon}>w</span>
                {w.name}
              </td>
              <td>{w.description}</td>
              <td>{w.query}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderGpoDetail(gname: string) {
    const g = state.gpos.find((x) => x.name === gname);
    if (!g) return <EmptyPane>GPO not found.</EmptyPane>;
    const tabs = ["Scope", "Details", "Settings", "Delegation"];
    return (
      <ContentBody>
        <TabbedPanel
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          renderTab={(tab) => {
            if (tab === "Scope") return <ScopeTab gpo={g} state={state} dispatch={dispatch} onSetDialog={setDialog} onToggleLink={toggleLink} onRemoveLink={removeLink} />;
            if (tab === "Details") return <DetailsTab gpo={g} />;
            if (tab === "Settings") return <SettingsTab gpo={g} />;
            return <DelegationTab />;
          }}
        />
        <div style={{ marginTop: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "gpme", gpoName: gname })}>
            Edit...
          </button>{" "}
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "link-gpo", gpoName: gname })}>
            Link to OU...
          </button>
        </div>
      </ContentBody>
    );
  }

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={treeRoot}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
          onContextMenu={showTreeContextMenu}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          {selectedNode.startsWith("gpo:") ? (
            renderGpoDetail(selectedNode.slice(4))
          ) : selectedNode === "gpos" ? (
            renderGpoList()
          ) : selectedNode === "domainRoot" ? (
            renderDomainRoot()
          ) : selectedNode === "wmi" ? (
            renderWmiList()
          ) : selectedNode === "starter" ? (
            <EmptyPane>
              Starter GPOs are not yet configured.
              <br />
              <br />
              Click <b>Create Starter GPOs Folder</b> in the Action pane.
            </EmptyPane>
          ) : (
            <EmptyPane>Select an object in the tree.</EmptyPane>
          )}
        </>
      }
      dialogs={<GpoDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} onSwitchDialog={setDialog} />}
    />
  );
}

function ScopeTab({
  gpo,
  state,
  dispatch,
  onSetDialog,
  onToggleLink,
  onRemoveLink,
}: {
  gpo: AddsGpo;
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onSetDialog: (d: Dialog | null) => void;
  onToggleLink: (gpoName: string, ou: string, field: "enforced" | "enabled") => void;
  onRemoveLink: (gpoName: string, ou: string) => void;
}) {
  return (
    <>
      <h4 style={{ margin: "6px 0" }}>Links</h4>
      {!gpo.links.length ? (
        <EmptyPane>No links</EmptyPane>
      ) : (
        <ItemListTable columns={["Location", "Enforced", "Link Enabled", "Path"]}>
          {gpo.links.map((l: AddsGpoLink) => (
            <tr key={l.ou || "(root)"}>
              <td>{l.ou || state.domain.fqdn}</td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); onToggleLink(gpo.name, l.ou, "enforced"); }}>
                  {l.enforced ? "Yes" : "No"}
                </a>
              </td>
              <td>
                <a href="#" onClick={(e) => { e.preventDefault(); onToggleLink(gpo.name, l.ou, "enabled"); }}>
                  {l.enabled ? "Yes" : "No"}
                </a>
              </td>
              <td>
                {state.domain.fqdn}
                {l.ou ? `/${l.ou}` : ""}
              </td>
            </tr>
          ))}
        </ItemListTable>
      )}
      <div style={{ marginTop: 6 }}>
        <button type="button" className={styles.btn} onClick={() => onSetDialog({ kind: "link-gpo", gpoName: gpo.name })}>
          Add link...
        </button>{" "}
        {gpo.links.map((l) => (
          <button key={l.ou || "(root)"} type="button" className={styles.btn} onClick={() => onRemoveLink(gpo.name, l.ou)} style={{ marginLeft: 4 }}>
            Remove link at {l.ou || "(domain root)"}
          </button>
        ))}
      </div>

      <h4 style={{ margin: "12px 0 6px" }}>Security Filtering</h4>
      <p style={{ fontSize: 12, color: "#555" }}>The settings in this GPO can only apply to the following groups, users, and computers:</p>
      <ul style={{ marginLeft: 20, listStyle: "none", paddingLeft: 0 }}>
        {gpo.securityFiltering.map((s, i) => (
          <li key={`${s}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
            <span>{s}</span>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!confirm(`Remove ${s} from security filtering?`)) return;
                dispatch({ type: "SET_GPO_SECURITY_FILTERING", gpoName: gpo.name, principals: gpo.securityFiltering.filter((_, idx) => idx !== i) });
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 6 }}>
        <button type="button" className={styles.btnPrimary} onClick={() => onSetDialog({ kind: "add-security-filter", gpoName: gpo.name })}>
          Add...
        </button>
      </div>

      <h4 style={{ margin: "12px 0 6px" }}>WMI Filtering</h4>
      <p style={{ fontSize: 12 }}>
        This GPO is linked to the following WMI filter: <b>{gpo.wmiFilter || "<none>"}</b>{" "}
        <button type="button" className={styles.btn} style={{ marginLeft: 8 }} onClick={() => onSetDialog({ kind: "set-wmi-filter", gpoName: gpo.name })}>
          Change...
        </button>{" "}
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            dispatch({ type: "SET_GPO_WMI_FILTER", gpoName: gpo.name, filterName: "" });
            toast.success("WMI filter cleared.");
          }}
        >
          None
        </button>
      </p>
    </>
  );
}

function DetailsTab({ gpo }: { gpo: AddsGpo }) {
  return (
    <table className={styles.policyTable}>
      <tbody>
        <tr>
          <th>Owner</th>
          <td>CORP\Domain Admins</td>
        </tr>
        <tr>
          <th>Created</th>
          <td>{gpo.created}</td>
        </tr>
        <tr>
          <th>Modified</th>
          <td>{gpo.modified}</td>
        </tr>
        <tr>
          <th>User version</th>
          <td>{gpo.version.user} (AD), {gpo.version.user} (SYSVOL)</td>
        </tr>
        <tr>
          <th>Computer version</th>
          <td>{gpo.version.computer} (AD), {gpo.version.computer} (SYSVOL)</td>
        </tr>
        <tr>
          <th>Unique ID</th>
          <td>{gpo.id}</td>
        </tr>
        <tr>
          <th>GPO Status</th>
          <td>Enabled</td>
        </tr>
        <tr>
          <th>Comment</th>
          <td>{gpo.description}</td>
        </tr>
      </tbody>
    </table>
  );
}

function SettingsTab({ gpo }: { gpo: AddsGpo }) {
  const keys = Object.keys(gpo.settings);
  if (!keys.length) return <EmptyPane>No settings have been defined for this Group Policy Object.</EmptyPane>;
  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <b>{gpo.name}</b> - settings (HTML report)
      </p>
      <ItemListTable columns={["Policy", "Setting"]}>
        {keys.map((k) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{gpo.settings[k]}</td>
          </tr>
        ))}
      </ItemListTable>
    </>
  );
}

function DelegationTab() {
  const entries = [
    { name: "Authenticated Users", perm: "Read (from Security Filtering), Apply group policy", inh: "No" },
    { name: "CORP\\Domain Admins", perm: "Edit settings, delete, modify security", inh: "No" },
    { name: "CORP\\Enterprise Admins", perm: "Edit settings, delete, modify security", inh: "No" },
    { name: "NT AUTHORITY\\ENTERPRISE DOMAIN CONTROLLERS", perm: "Read", inh: "No" },
    { name: "NT AUTHORITY\\SYSTEM", perm: "Edit settings, delete, modify security", inh: "No" },
  ];
  return (
    <ItemListTable columns={["Name", "Allowed Permissions", "Inherited"]}>
      {entries.map((e) => (
        <tr key={e.name}>
          <td>{e.name}</td>
          <td>{e.perm}</td>
          <td>{e.inh}</td>
        </tr>
      ))}
    </ItemListTable>
  );
}

function GpoDialogs({
  dialog,
  state,
  dispatch,
  onClose,
  onSwitchDialog,
}: {
  dialog: Dialog | null;
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onClose: () => void;
  onSwitchDialog: (d: Dialog | null) => void;
}) {
  if (!dialog) return null;

  if (dialog.kind === "new-gpo") return <NewGpoDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "link-gpo") return <LinkGpoDialog gpoName={dialog.gpoName} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-security-filter") return <AddSecurityFilterDialog gpoName={dialog.gpoName} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "set-wmi-filter") return <SetWmiFilterDialog gpoName={dialog.gpoName} state={state} dispatch={dispatch} onClose={onClose} onNewFilter={() => onSwitchDialog({ kind: "new-wmi-filter" })} />;
  if (dialog.kind === "new-wmi-filter") return <NewWmiFilterDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "backup-all") return <BackupAllDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "gpme") return <GpmeDialog gpoName={dialog.gpoName} state={state} onClose={onClose} onOpenPolicy={(policy) => onSwitchDialog({ kind: "policy-editor", gpoName: dialog.gpoName, policy })} />;
  if (dialog.kind === "policy-editor")
    return (
      <PolicyEditorDialog
        gpoName={dialog.gpoName}
        policy={dialog.policy}
        state={state}
        dispatch={dispatch}
        onClose={() => onSwitchDialog({ kind: "gpme", gpoName: dialog.gpoName })}
      />
    );
  return null;
}

function NewGpoDialog({ state, dispatch, onClose }: { state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <AddsDialog
      title="New GPO"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const trimmed = name.trim();
            if (!trimmed) { alert("GPO name is required."); return false; }
            if (state.gpos.some((g) => g.name === trimmed)) { alert("A GPO with that name already exists."); return false; }
            const now = new Date().toISOString();
            dispatch({
              type: "ADD_GPO",
              gpo: {
                id: newGpoId(),
                name: trimmed,
                description: description.trim(),
                builtin: false,
                links: [],
                securityFiltering: ["Authenticated Users"],
                wmiFilter: "",
                created: now,
                modified: now,
                version: { user: 0, computer: 0 },
                settings: {},
              },
            });
            toast.success(`GPO created: ${trimmed}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <FormRow label="Source Starter GPO">
        <select disabled>
          <option>(none)</option>
        </select>
      </FormRow>
    </AddsDialog>
  );
}

function LinkGpoDialog({ gpoName, state, dispatch, onClose }: { gpoName: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const locations = useMemo(() => ["(domain root)", ...state.ous.map((o) => o.name)], [state.ous]);

  return (
    <AddsDialog
      title="Link an existing GPO"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const pick = selected[0];
            if (pick === undefined) { alert("Select a location."); return false; }
            const ou = pick === "(domain root)" ? "" : pick;
            const gpo = state.gpos.find((g) => g.name === gpoName);
            if (gpo?.links.some((l) => l.ou === ou)) {
              toast.info("GPO is already linked there.");
              return true;
            }
            dispatch({ type: "LINK_GPO", gpoName, ou });
            toast.success("Linked.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Select the OU to link <b>{gpoName}</b> to:
      </p>
      <ListBox
        items={locations.map((n) => ({ key: n, label: `${state.domain.fqdn}${n === "(domain root)" ? "" : `/${n}`}` }))}
        selected={selected}
        onSelect={setSelected}
        height={220}
      />
    </AddsDialog>
  );
}

function AddSecurityFilterDialog({ gpoName, state, dispatch, onClose }: { gpoName: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const gpo = state.gpos.find((g) => g.name === gpoName);
  const options = useMemo(
    () => [...state.groups.map((g) => g.name), ...state.users.map((u) => u.sAMAccountName)],
    [state.groups, state.users],
  );
  if (!gpo) return null;

  return (
    <AddsDialog
      title="Select User, Computer, or Group"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const typed = text.split(";").map((s) => s.trim()).filter(Boolean);
            const additions = Array.from(new Set([...selected, ...typed]));
            if (!additions.length) { alert("Enter or select at least one principal."); return false; }
            const merged = Array.from(new Set([...gpo.securityFiltering, ...additions]));
            dispatch({ type: "SET_GPO_SECURITY_FILTERING", gpoName, principals: merged });
            toast.success(`Added ${additions.length} principal(s) to security filtering.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Enter the object names">
        <input type="text" placeholder="Type names; semicolon separated" value={text} onChange={(e) => setText(e.target.value)} />
      </FormRow>
      <HelpText>Or pick from list:</HelpText>
      <ListBox items={options.map((n) => ({ key: n, label: n }))} selected={selected} onSelect={setSelected} multi height={200} />
    </AddsDialog>
  );
}

function SetWmiFilterDialog({
  gpoName,
  state,
  dispatch,
  onClose,
  onNewFilter,
}: {
  gpoName: string;
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onClose: () => void;
  onNewFilter: () => void;
}) {
  const gpo = state.gpos.find((g) => g.name === gpoName);
  const [selected, setSelected] = useState<string[]>(gpo?.wmiFilter ? [gpo.wmiFilter] : []);
  if (!gpo) return null;

  return (
    <AddsDialog
      title="Select WMI Filter"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "SET_GPO_WMI_FILTER", gpoName, filterName: selected[0] ?? "" });
            toast.success("WMI filter updated.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      {state.wmiFilters.length ? (
        <ListBox items={state.wmiFilters.map((w) => ({ key: w.name, label: `${w.name} — ${w.description}` }))} selected={selected} onSelect={setSelected} height={200} />
      ) : (
        <EmptyPane>(no WMI filters defined)</EmptyPane>
      )}
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            onClose();
            onNewFilter();
          }}
        >
          New WMI Filter...
        </button>
      </div>
    </AddsDialog>
  );
}

function NewWmiFilterDialog({ dispatch, onClose }: { dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState("");

  function applyPreset(idx: string) {
    setPreset(idx);
    if (!idx) return;
    const p = WMI_PRESETS[Number(idx)];
    if (!p) return;
    if (!name) setName(p.name);
    if (!description) setDescription(p.description);
    setQuery(p.query);
  }

  return (
    <AddsDialog
      title="New WMI Filter"
      width="560px"
      onClose={onClose}
      buttons={[
        {
          label: "Save",
          primary: true,
          onClick: () => {
            const trimmedName = name.trim();
            const trimmedQuery = query.trim();
            if (!trimmedName) { alert("Filter name required."); return false; }
            if (!trimmedQuery) { alert("At least one WQL query is required."); return false; }
            dispatch({ type: "ADD_WMI_FILTER", name: trimmedName, description: description.trim(), query: trimmedQuery });
            toast.success(`WMI filter "${trimmedName}" created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" placeholder="Workstations only" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" placeholder="Applies the GPO only to client OS" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <FormRow label="Insert preset">
        <select value={preset} onChange={(e) => applyPreset(e.target.value)}>
          <option value="">— pick a preset —</option>
          {WMI_PRESETS.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="WQL query">
        <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SELECT * FROM Win32_OperatingSystem WHERE ProductType=1" />
      </FormRow>
      <HelpText>WMI filters add CPU per group policy refresh. Test on a handful of endpoints before wide rollout.</HelpText>
    </AddsDialog>
  );
}

function BackupAllDialog({ state, dispatch, onClose }: { state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [location, setLocation] = useState("\\\\DC01\\GPOBackups");
  const [description, setDescription] = useState("");

  return (
    <AddsDialog
      title="Back Up Group Policy Objects"
      width="600px"
      onClose={onClose}
      buttons={[
        {
          label: "Back Up",
          primary: true,
          onClick: () => {
            const loc = location.trim();
            if (!loc) { alert("Backup location required."); return false; }
            const desc = description.trim() || `Backup of all GPOs ${new Date().toISOString().slice(0, 10)}`;
            dispatch({ type: "BACKUP_ALL_GPOS", location: loc, description: desc });
            toast.success(`${state.gpos.length} GPO${state.gpos.length === 1 ? "" : "s"} backed up to ${loc}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p style={{ marginBottom: 10 }}>
        <b>
          {state.gpos.length} GPO{state.gpos.length === 1 ? "" : "s"}
        </b>{" "}
        in the {state.domain.fqdn} domain will be backed up.
      </p>
      <FormRow label="Location">
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </FormRow>
      <FormRow label="Description (optional)">
        <input type="text" placeholder="Quarterly backup — March 2026" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <HelpText>
        Backup includes GPO settings, links, security filters and delegation. Restore using <code>Restore-GPO</code> or right-click → Manage Backups.
      </HelpText>
      <ItemListTable columns={["GPO", "Size (KB)"]}>
        {state.gpos.map((g) => (
          <tr key={g.name}>
            <td>{g.name}</td>
            <td>{20 + (g.name.length % 5) * 15}</td>
          </tr>
        ))}
      </ItemListTable>
    </AddsDialog>
  );
}

function GpmeDialog({
  gpoName,
  state,
  onClose,
  onOpenPolicy,
}: {
  gpoName: string;
  state: AddsState;
  onClose: () => void;
  onOpenPolicy: (policy: GpoPolicyDef) => void;
}) {
  const gpo = state.gpos.find((g) => g.name === gpoName);
  const categories = useMemo(() => gpoPolicyCategories(), []);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? "");
  const [expandedEditor, setExpandedEditor] = useState<Record<string, boolean>>({ "Computer Configuration": true, "User Configuration": true });
  if (!gpo) return null;

  const computerCategories = categories.filter((c) => c.startsWith("Computer Configuration"));
  const userCategories = categories.filter((c) => c.startsWith("User Configuration"));

  function buildTree(root: string, cats: string[]): TreeNode {
    const children: TreeNode[] = cats.map((c) => ({ id: c, icon: ".", label: c.slice(root.length + 1) }));
    return { id: root, icon: ".", label: root, children };
  }

  const editorTree: TreeNode = {
    id: "gpme-root",
    icon: "",
    label: "",
    children: [buildTree("Computer Configuration", computerCategories), buildTree("User Configuration", userCategories)],
  };

  const policies = gpoPoliciesInCategory(selectedCategory);

  return (
    <AddsDialog
      title={`Group Policy Management Editor - [${gpo.name} [DC01.${state.domain.fqdn}] Policy]`}
      width="900px"
      onClose={onClose}
      buttons={[{ label: "Close" }]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 8 }}>
        <div style={{ height: 480, overflow: "auto", border: "1px solid #adadad", background: "#fff" }}>
          <MmcTreeNode
            node={editorTree}
            selected={selectedCategory}
            expanded={expandedEditor}
            onSelect={setSelectedCategory}
            onToggle={(id) => setExpandedEditor((ex) => ({ ...ex, [id]: !ex[id] }))}
          />
        </div>
        <div style={{ height: 480, overflow: "auto", border: "1px solid #adadad", background: "#fff", padding: 8 }}>
          {!policies.length ? (
            <EmptyPane>
              <b>{selectedCategory}</b>
              <br />
              <br />
              Select a leaf folder under Administrative Templates or Account Policies to see configurable settings.
              <br />
              <br />
              Other sections of this Group Policy editor are placeholders in this lab.
            </EmptyPane>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>{selectedCategory}</p>
              <ItemListTable columns={["Setting", "State", "Comment"]}>
                {policies.map((p) => {
                  const value = gpo.settings[p.path];
                  const state_ = value === undefined ? "Not Configured" : value === "Disabled" || value === "Enabled" ? value : "Enabled";
                  const cls = state_ === "Enabled" ? styles.policyStateEnabled : state_ === "Disabled" ? styles.policyStateDisabled : styles.policyStateNotconfig;
                  return (
                    <tr key={p.path} onClick={() => onOpenPolicy(p)}>
                      <td>{p.name}</td>
                      <td className={cls}>{state_}</td>
                      <td>{p.helpText}</td>
                    </tr>
                  );
                })}
              </ItemListTable>
            </>
          )}
        </div>
      </div>
    </AddsDialog>
  );
}

function PolicyEditorDialog({
  gpoName,
  policy,
  state,
  dispatch,
  onClose,
}: {
  gpoName: string;
  policy: GpoPolicyDef;
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onClose: () => void;
}) {
  const gpo = state.gpos.find((g) => g.name === gpoName);
  const current = gpo?.settings[policy.path];
  const initialState: "Not Configured" | "Enabled" | "Disabled" = current === undefined ? "Not Configured" : current === "Disabled" ? "Disabled" : "Enabled";
  const [radioState, setRadioState] = useState<"Not Configured" | "Enabled" | "Disabled">(initialState);
  const [numValue, setNumValue] = useState<string>(
    policy.kind === "numeric" ? (typeof current === "string" && current.includes(" ") ? current.split(" ")[0] : policy.default ?? "0") : "0",
  );
  const [textValue, setTextValue] = useState<string>(policy.kind === "text" && typeof current === "string" && current !== "Enabled" && current !== "Disabled" ? current : "");
  const [listValue, setListValue] = useState<string>(policy.kind === "list" && typeof current === "string" && current !== "Enabled" && current !== "Disabled" ? current : "");
  const [enumValue, setEnumValue] = useState<string>(
    policy.kind === "enum" ? (typeof current === "string" && policy.options?.includes(current) ? current : policy.default ?? policy.options?.[0] ?? "") : "",
  );

  function computeStoredValue(): string {
    if (policy.kind === "numeric") return `${numValue} ${policy.unit ?? ""}`.trim();
    if (policy.kind === "text") return textValue || "Enabled";
    if (policy.kind === "list") return listValue || "Enabled";
    if (policy.kind === "enum") return enumValue;
    return "Enabled";
  }

  function apply(): string {
    const stored = radioState === "Enabled" ? computeStoredValue() : radioState;
    dispatch({ type: "SET_GPO_POLICY", gpoName, path: policy.path, value: stored });
    return stored;
  }

  return (
    <AddsDialog
      title={policy.name}
      width="640px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const stored = apply();
            toast.success(`${policy.name}: ${stored}`);
            return true;
          },
        },
        {
          label: "Apply",
          onClick: () => {
            const stored = apply();
            toast.success(`${policy.name}: ${stored}`);
            return false;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormSection title="">
        {(["Not Configured", "Enabled", "Disabled"] as const).map((s) => (
          <label key={s} style={{ marginRight: 16 }}>
            <input type="radio" checked={radioState === s} onChange={() => setRadioState(s)} /> {s}
          </label>
        ))}
      </FormSection>
      <FormSection title="Supported on">{policy.supported}</FormSection>
      {radioState === "Enabled" ? (
        <FormSection title="Options">
          {policy.kind === "numeric" ? (
            <FormRow label={policy.name}>
              <input type="number" value={numValue} onChange={(e) => setNumValue(e.target.value)} style={{ maxWidth: 120 }} />
              <span style={{ marginLeft: 4 }}>{policy.unit ?? ""}</span>
            </FormRow>
          ) : null}
          {policy.kind === "text" ? (
            <FormRow label="Value">
              <input type="text" value={textValue} onChange={(e) => setTextValue(e.target.value)} />
            </FormRow>
          ) : null}
          {policy.kind === "list" ? (
            <FormRow label="List">
              <textarea value={listValue} onChange={(e) => setListValue(e.target.value)} placeholder="one per line" />
            </FormRow>
          ) : null}
          {policy.kind === "enum" ? (
            <FormRow label="Option">
              <select value={enumValue} onChange={(e) => setEnumValue(e.target.value)}>
                {(policy.options ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormRow>
          ) : null}
        </FormSection>
      ) : null}
      <FormSection title="Help">
        <HelpText>{policy.helpText}</HelpText>
      </FormSection>
    </AddsDialog>
  );
}
