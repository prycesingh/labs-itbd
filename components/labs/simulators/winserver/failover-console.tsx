"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsClusterDisk, WsClusterEvent, WsClusterRole } from "@/lib/labs/simulators/winserver/types";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, type WsTreeNode } from "./ws-mmc";
import { CheckboxRow, EmptyPane, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import styles from "./winserver-console.module.css";

type Dialog =
  | { kind: "move-role"; name: string }
  | { kind: "pause-node"; name: string }
  | { kind: "create-cluster" }
  | { kind: "configure-role" };

const ROLE_TYPES = [
  "File Server",
  "SQL Server Failover Cluster Instance",
  "Hyper-V Virtual Machine",
  "Generic Application",
  "Generic Script",
  "Generic Service",
  "DHCP Server",
  "DFS Namespace Server",
  "Distributed Transaction Coordinator",
  "iSNS Server",
  "Print Server",
  "Scale-Out File Server",
  "Virtual Machine",
] as const;

function rolePill(status: WsClusterRole["status"]): string {
  if (status === "Running") return styles.pillGreen;
  if (status === "Failed") return styles.pillRed;
  return styles.pillAmber;
}

function nodePill(status: "Up" | "Down" | "Paused"): string {
  if (status === "Up") return styles.pillGreen;
  if (status === "Down") return styles.pillRed;
  return styles.pillAmber;
}

function eventPill(level: WsClusterEvent["level"]): string {
  if (level === "Critical" || level === "Error") return styles.pillRed;
  if (level === "Warning") return styles.pillAmber;
  return styles.pillGreen;
}

function diskPill(status: string): string {
  return status === "Online" ? styles.pillGreen : styles.pillRed;
}

export function FailoverConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("cluster");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ cluster: true, storage: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const f = state.failover;

  const tree: WsTreeNode = {
    id: "cluster",
    icon: "CL",
    label: f.clusterFqdn,
    children: [
      { id: "roles", icon: "RL", label: "Roles" },
      { id: "nodes", icon: "ND", label: "Nodes" },
      {
        id: "storage",
        icon: "ST",
        label: "Storage",
        children: [
          { id: "disks", icon: "DK", label: "Disks" },
          { id: "pools", icon: "PL", label: "Pools" },
        ],
      },
      { id: "networks", icon: "NT", label: "Networks" },
      { id: "events", icon: "EV", label: "Cluster Events" },
    ],
  };

  function headingFor(node: string): string {
    if (node === "cluster") return f.clusterFqdn;
    if (node === "roles") return `Roles (${f.roles.length})`;
    if (node === "nodes") return `Nodes (${f.nodes.length})`;
    if (node === "storage") return "Storage";
    if (node === "disks") return `Disks (${f.disks.length})`;
    if (node === "pools") return `Pools (${f.pools.length})`;
    if (node === "networks") return `Networks (${f.networks.length})`;
    if (node === "events") return "Cluster Events";
    return "";
  }

  function moveRoleBestNode(role: WsClusterRole) {
    const target = f.nodes.find((n) => n.name !== role.ownerNode && n.status === "Up");
    if (!target) {
      toast.error("No other node is available to take this role.");
      return;
    }
    dispatch({ type: "MOVE_CLUSTER_ROLE", name: role.name, targetNode: target.name });
    toast.success(`${role.name} moved to ${target.name}`);
  }

  function toggleRoleStatus(role: WsClusterRole) {
    const next = role.status === "Running" ? "Stopped" : "Running";
    dispatch({ type: "SET_CLUSTER_ROLE_STATUS", name: role.name, status: next });
    toast.success(`${role.name} ${next === "Running" ? "started" : "stopped"}`);
  }

  function toggleAutoStart(role: WsClusterRole) {
    dispatch({ type: "UPDATE_CLUSTER_ROLE", name: role.name, patch: { autoStart: !role.autoStart } });
    toast.success(`Auto Start ${role.autoStart ? "disabled" : "enabled"} for ${role.name}`);
  }

  function removeRole(role: WsClusterRole) {
    if (!confirm(`Remove role "${role.name}"?`)) return;
    dispatch({ type: "REMOVE_CLUSTER_ROLE", name: role.name });
    toast.success(`Removed ${role.name}`);
  }

  function resumeNode(name: string) {
    dispatch({ type: "RESUME_NODE", name });
    toast.success(`${name} resumed`);
  }

  function evictNode(name: string) {
    if (!confirm(`Evict node "${name}" from the cluster? This removes it permanently.`)) return;
    dispatch({ type: "EVICT_NODE", name });
    toast.success(`${name} evicted`);
  }

  function showRoleContextMenu(e: React.MouseEvent, role: WsClusterRole) {
    const items: WsContextMenuItem[] = [
      { key: "move-best", label: "Move > Best Possible Node", onClick: () => moveRoleBestNode(role) },
      { key: "move-select", label: "Move > Select Node...", onClick: () => setDialog({ kind: "move-role", name: role.name }) },
      "-",
      { key: "toggle-status", label: role.status === "Running" ? "Stop Role" : "Start Role", onClick: () => toggleRoleStatus(role) },
      { key: "toggle-autostart", label: role.autoStart ? "Disable Auto Start" : "Enable Auto Start", onClick: () => toggleAutoStart(role) },
      "-",
      { key: "remove", label: "Remove", onClick: () => removeRole(role) },
      { key: "props", label: "Properties", onClick: () => toast.info(`${role.name}: ${role.type} on ${role.ownerNode}, priority ${role.priority}`) },
    ];
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showNodeContextMenu(e: React.MouseEvent, node: WinServerState["failover"]["nodes"][number]) {
    const items: WsContextMenuItem[] = [];
    if (node.status === "Paused") {
      items.push({ key: "resume", label: "Resume", onClick: () => resumeNode(node.name) });
    } else {
      items.push({ key: "pause", label: "Pause...", onClick: () => setDialog({ kind: "pause-node", name: node.name }) });
    }
    items.push("-");
    items.push({ key: "evict", label: "Evict...", onClick: () => evictNode(node.name) });
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function renderRoles() {
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "configure-role" })}>
            Configure Role...
          </button>
        </div>
        {f.roles.length === 0 ? (
          <EmptyPane>No clustered roles. Use Configure Role... to add one.</EmptyPane>
        ) : (
          <ItemListTable columns={["Name", "Status", "Type", "Owner Node", "Priority", "Auto Start"]}>
            {f.roles.map((r) => (
              <tr key={r.name} onContextMenu={(e) => { e.preventDefault(); showRoleContextMenu(e, r); }}>
                <td>{r.name}</td>
                <td>
                  <span className={`${styles.pill} ${rolePill(r.status)}`}>{r.status}</span>
                </td>
                <td>{r.type}</td>
                <td>{r.ownerNode}</td>
                <td>{r.priority}</td>
                <td>{r.autoStart ? "Enabled" : "Disabled"}</td>
              </tr>
            ))}
          </ItemListTable>
        )}
      </ContentBody>
    );
  }

  function renderNodes() {
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Status", "Site", "Uptime", "OS"]}>
          {f.nodes.map((n) => (
            <tr key={n.name} onContextMenu={(e) => { e.preventDefault(); showNodeContextMenu(e, n); }}>
              <td>{n.name}</td>
              <td>
                <span className={`${styles.pill} ${nodePill(n.status)}`}>{n.status}</span>
              </td>
              <td>{n.site}</td>
              <td>{n.uptime}</td>
              <td>{n.os}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderDisks() {
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Status", "Owner", "Capacity", "Free Space", "Pool", "Role"]}>
          {f.disks.map((d: WsClusterDisk) => (
            <tr key={d.name}>
              <td>{d.name}</td>
              <td>
                <span className={`${styles.pill} ${diskPill(d.status)}`}>{d.status}</span>
              </td>
              <td>{d.owner}</td>
              <td>{d.capacityGB} GB</td>
              <td>{d.freeGB} GB</td>
              <td>{d.pool}</td>
              <td>{d.role}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderPools() {
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Disks", "Capacity"]}>
          {f.pools.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.disks}</td>
              <td>{p.capacityTB} TB</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderNetworks() {
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Subnets", "Cluster Use", "State"]}>
          {f.networks.map((n) => (
            <tr key={n.name}>
              <td>{n.name}</td>
              <td>{n.subnets.join(", ")}</td>
              <td>{n.role}</td>
              <td>
                <span className={`${styles.pill} ${n.state === "Up" ? styles.pillGreen : styles.pillRed}`}>{n.state}</span>
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderEvents() {
    const sorted = [...f.events].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return (
      <ContentBody>
        <ItemListTable columns={["Level", "Date and Time", "Event ID", "Source", "Summary"]}>
          {sorted.map((e, i) => (
            <tr key={`${e.id}-${e.time}-${i}`}>
              <td>
                <span className={`${styles.pill} ${eventPill(e.level)}`}>{e.level}</span>
              </td>
              <td>{new Date(e.time).toLocaleString()}</td>
              <td>{e.id}</td>
              <td>{e.source}</td>
              <td>{e.summary}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const items: WsContextMenuItem[] = [];
    if (nodeId === "cluster") {
      items.push({ key: "create-cluster", label: "Create Cluster...", onClick: () => setDialog({ kind: "create-cluster" }) });
      items.push({ key: "configure-role", label: "Configure Role...", onClick: () => setDialog({ kind: "configure-role" }) });
    } else if (nodeId === "roles") {
      items.push({ key: "configure-role", label: "Configure Role...", onClick: () => setDialog({ kind: "configure-role" }) });
    }
    if (items.length) WsContextMenu.show(e.clientX, e.clientY, items);
  }

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={tree}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((ex) => ({ ...ex, [id]: !ex[id] }))}
          onContextMenu={showTreeContextMenu}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          {selectedNode === "cluster" ? (
            <ContentBody>
              <p style={{ marginBottom: 8 }}>Create failover clusters, manage roles, validate configurations, and view events.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "create-cluster" })}>
                  Create Cluster...
                </button>
                <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "configure-role" })}>
                  Configure Role...
                </button>
                <button type="button" className={styles.btn} onClick={() => toast.success("Validation report: 14 passed, 2 warnings, 0 errors.")}>
                  Validate Configuration...
                </button>
              </div>
            </ContentBody>
          ) : selectedNode === "roles" ? (
            renderRoles()
          ) : selectedNode === "nodes" ? (
            renderNodes()
          ) : selectedNode === "storage" ? (
            <ContentBody>
              <EmptyPane>Select Disks or Pools from the tree to view cluster storage.</EmptyPane>
            </ContentBody>
          ) : selectedNode === "disks" ? (
            renderDisks()
          ) : selectedNode === "pools" ? (
            renderPools()
          ) : selectedNode === "networks" ? (
            renderNetworks()
          ) : selectedNode === "events" ? (
            renderEvents()
          ) : (
            <EmptyPane>Select an object in the tree.</EmptyPane>
          )}
        </>
      }
      dialogs={<FailoverDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} />}
    />
  );
}

function FailoverDialogs({
  dialog,
  state,
  dispatch,
  onClose,
}: {
  dialog: Dialog | null;
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  onClose: () => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "move-role") return <MoveRoleDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "pause-node") return <PauseNodeDialog name={dialog.name} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "create-cluster") return <CreateClusterWizard onClose={onClose} />;
  if (dialog.kind === "configure-role") return <ConfigureRoleWizard state={state} dispatch={dispatch} onClose={onClose} />;
  return null;
}

function MoveRoleDialog({ name, state, dispatch, onClose }: { name: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const role = state.failover.roles.find((r) => r.name === name);
  const otherNodes = state.failover.nodes.filter((n) => n.name !== role?.ownerNode && n.status === "Up");
  const [mode, setMode] = useState<"best" | "select">("best");
  const [targetNode, setTargetNode] = useState(otherNodes[0]?.name ?? "");
  if (!role) return null;

  return (
    <WsDialogComponent
      title="Move Clustered Role"
      onClose={onClose}
      buttons={[
        {
          label: "Move",
          primary: true,
          onClick: () => {
            const target = mode === "best" ? otherNodes[0]?.name : targetNode;
            if (!target) {
              alert("No eligible node is available.");
              return false;
            }
            dispatch({ type: "MOVE_CLUSTER_ROLE", name: role.name, targetNode: target });
            toast.success(`${role.name} moved to ${target}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Select destination node for <b>{role.name}</b>:
      </p>
      <FormSection title="">
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={mode === "best"} onChange={() => setMode("best")} /> Best Possible Node
        </label>
        <label style={{ display: "block" }}>
          <input type="radio" checked={mode === "select"} onChange={() => setMode("select")} /> Select Node
        </label>
      </FormSection>
      {mode === "select" ? (
        <FormRow label="Node">
          <select value={targetNode} onChange={(e) => setTargetNode(e.target.value)}>
            {otherNodes.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name} ({n.site})
              </option>
            ))}
          </select>
        </FormRow>
      ) : (
        <HelpText>{otherNodes[0] ? `Best possible node: ${otherNodes[0].name}` : "No other node is currently Up."}</HelpText>
      )}
    </WsDialogComponent>
  );
}

function PauseNodeDialog({ name, dispatch, onClose }: { name: string; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [drain, setDrain] = useState(true);

  return (
    <WsDialogComponent
      title={`Pause Node - ${name}`}
      onClose={onClose}
      buttons={[
        {
          label: "Pause",
          primary: true,
          onClick: () => {
            dispatch({ type: "PAUSE_NODE", name, drain });
            toast.success(drain ? `${name} paused. Roles drained to other nodes.` : `${name} paused without draining roles.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Pausing <b>{name}</b> stops new roles from starting on it.
      </p>
      <CheckboxRow id="pauseDrain" label="Drain Roles" checked={drain} onChange={setDrain} />
      <HelpText>Draining moves any roles currently owned by this node to another available node before it is paused.</HelpText>
    </WsDialogComponent>
  );
}

const CREATE_CLUSTER_STEPS = ["Before You Begin", "Select Servers", "Validation Report", "Access Point", "Quorum + Storage", "Confirmation", "Creating", "Summary"] as const;

const VALIDATION_TESTS = [
  "Inventory: List Operating System",
  "Network: Validate Network Communication",
  "Network: Validate Cluster Network Configuration",
  "Storage: List Potential Cluster Disks",
  "System Configuration: Validate Active Directory Configuration",
  "System Configuration: Validate Services",
];

const CREATE_CLUSTER_LOG_LINES = [
  "Verifying account permissions...",
  "Creating cluster object in Active Directory...",
  "Creating cluster IP address resource...",
  "Registering DNS A record...",
  "Bringing cluster core resources online...",
  "Configuring quorum...",
  "Replicating cluster database across nodes...",
  "Cluster creation complete.",
];

function CreateClusterWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [servers, setServers] = useState("NODE01, NODE02, NODE03");
  const [showValidationDetail, setShowValidationDetail] = useState(false);
  const [cnoName, setCnoName] = useState("CLUSTER-NEW");
  const [cnoIp, setCnoIp] = useState("10.10.0.40");
  const [quorum, setQuorum] = useState<"Cloud Witness" | "File Share Witness" | "Disk Witness" | "No Witness">("Cloud Witness");
  const [addStorage, setAddStorage] = useState(true);

  const isCreating = step === 6;

  return (
    <WsDialogComponent
      title="Create Cluster Wizard"
      width="640px"
      onClose={onClose}
      buttons={
        isCreating
          ? []
          : [
              ...(step > 0 ? [{ label: "< Previous", onClick: () => { setStep(step - 1); return false; } }] : []),
              step < CREATE_CLUSTER_STEPS.length - 2
                ? { label: "Next >", primary: true, onClick: () => { setStep(step + 1); return false; } }
                : { label: "Finish", primary: true, onClick: () => { toast.success(`Cluster ${cnoName} created successfully.`); return true; } },
              { label: "Cancel" },
            ]
      }
    >
      <div className={styles.wizSteps}>
        {CREATE_CLUSTER_STEPS.map((s, i) => (
          <span key={s} className={i === step ? styles.wizStepActive : i < step ? styles.wizStepDone : styles.wizStep}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div style={{ padding: 14 }}>
        {step === 0 ? (
          <>
            <p>This wizard creates a failover cluster, including configuring the cluster name and IP address.</p>
            <HelpText>
              Prerequisites: all nodes run the same Windows Server edition and build, are joined to the same Active Directory domain, have the Failover
              Clustering feature installed, share access to the same storage, and are within 5 minutes of each other for Kerberos time sync.
            </HelpText>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <FormRow label="Server names">
              <input type="text" value={servers} onChange={(e) => setServers(e.target.value)} />
            </FormRow>
            <HelpText>Each node will be validated for clustering eligibility. Minimum 2 nodes for HA, 3+ recommended for quorum.</HelpText>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <p>
              <b>14 tests passed</b>, <b>2 warnings</b>, <b>0 errors</b>.
            </p>
            <button type="button" className={styles.btn} onClick={() => setShowValidationDetail((v) => !v)}>
              {showValidationDetail ? "Hide details" : "Show details"}
            </button>
            {showValidationDetail ? (
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12 }}>
                {VALIDATION_TESTS.map((t) => (
                  <li key={t}>{t} — PASS</li>
                ))}
                <li>Network: cluster nodes reachable on a single subnet — WARNING</li>
                <li>Storage: one disk has only one path (MPIO recommended) — WARNING</li>
              </ul>
            ) : null}
          </>
        ) : null}
        {step === 3 ? (
          <>
            <FormRow label="Cluster Name">
              <input type="text" value={cnoName} onChange={(e) => setCnoName(e.target.value)} />
            </FormRow>
            <FormRow label="Address">
              <input type="text" value={cnoIp} onChange={(e) => setCnoIp(e.target.value)} />
            </FormRow>
            <HelpText>Creates the Cluster Name Object (CNO) in Active Directory and a DNS A record.</HelpText>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <FormSection title="Witness type">
              {(["Cloud Witness", "File Share Witness", "Disk Witness", "No Witness"] as const).map((q) => (
                <label key={q} style={{ display: "block", marginBottom: 6 }}>
                  <input type="radio" checked={quorum === q} onChange={() => setQuorum(q)} /> {q}
                </label>
              ))}
            </FormSection>
            <CheckboxRow id="ccAddStorage" label="Add all eligible storage to the cluster" checked={addStorage} onChange={setAddStorage} />
          </>
        ) : null}
        {step === 5 ? (
          <FormSection title="Confirmation">
            <div>
              <b>Cluster name:</b> {cnoName}
            </div>
            <div>
              <b>Cluster IP:</b> {cnoIp}
            </div>
            <div>
              <b>Nodes:</b> {servers}
            </div>
            <div>
              <b>Witness:</b> {quorum}
            </div>
            <div>
              <b>Add all eligible storage:</b> {addStorage ? "Yes" : "No"}
            </div>
          </FormSection>
        ) : null}
        {step === 6 ? <CreatingLog lines={CREATE_CLUSTER_LOG_LINES} onDone={() => setStep(7)} /> : null}
        {step === 7 ? (
          <div style={{ background: "#dff6dd", padding: 14, borderLeft: "3px solid #107c10", fontSize: 13 }}>
            <b>Cluster {cnoName} created successfully.</b>
            <br />
            <br />
            Next steps: move shared storage to Cluster Shared Volumes, create roles via Configure Role, configure cluster networks, and document the
            recovery procedure.
          </div>
        ) : null}
      </div>
    </WsDialogComponent>
  );
}

function CreatingLog({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const [logged, setLogged] = useState<string[]>([]);

  useEffect(() => {
    const timers = lines.map((line, i) => setTimeout(() => setLogged((prev) => [...prev, line]), 250 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [lines]);

  return (
    <div style={{ fontFamily: "Consolas, monospace", fontSize: 11, background: "#1e1e1e", color: "#d4d4d4", padding: 14, borderRadius: 4, lineHeight: 1.6, minHeight: 160 }}>
      {logged.map((line, i) => (
        <div key={i}>
          {line} <span style={{ color: "#3fb950" }}>[PASS]</span>
        </div>
      ))}
      {logged.length === lines.length ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={onDone}>
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}

const CONFIGURE_ROLE_STEPS = ["Select Role", "Client Access Point", "Select Storage", "Confirmation", "Creating", "Summary"] as const;

const CONFIGURE_ROLE_LOG_LINES = ["Creating client access point...", "Binding storage to role...", "Bringing role online..."];

function ConfigureRoleWizard({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [roleType, setRoleType] = useState<(typeof ROLE_TYPES)[number]>("File Server");
  const [capName, setCapName] = useState("NEW-ROLE-01");
  const [capIp, setCapIp] = useState("10.10.0.50");
  const availableDisks = state.failover.disks.filter((d) => !d.role.startsWith("CSV"));
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);

  const isVm = roleType === "Hyper-V Virtual Machine" || roleType === "Virtual Machine";
  const isCreating = step === 4;

  function toggleDisk(name: string) {
    setSelectedDisks((prev) => (prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]));
  }

  function finish() {
    const ownerNode = state.failover.nodes.find((n) => n.status === "Up")?.name ?? state.failover.nodes[0]?.name ?? "";
    const role: WsClusterRole = {
      name: capName,
      status: "Running",
      type: roleType,
      ownerNode,
      priority: "Medium",
      autoStart: true,
    };
    dispatch({ type: "ADD_CLUSTER_ROLE", role });
    toast.success(`Role "${capName}" configured on ${ownerNode}.`);
    return true;
  }

  return (
    <WsDialogComponent
      title="High Availability Wizard"
      width="640px"
      onClose={onClose}
      buttons={
        isCreating
          ? []
          : [
              ...(step > 0 ? [{ label: "< Previous", onClick: () => { setStep(step - 1); return false; } }] : []),
              step < CONFIGURE_ROLE_STEPS.length - 2
                ? {
                    label: "Next >",
                    primary: true,
                    onClick: () => {
                      if (step === 0 && !roleType) {
                        alert("Select a role type.");
                        return false;
                      }
                      if (step === 1 && !isVm && !capName.trim()) {
                        alert("Client access point name is required.");
                        return false;
                      }
                      setStep(step + 1);
                      return false;
                    },
                  }
                : { label: "Finish", primary: true, onClick: finish },
              { label: "Cancel" },
            ]
      }
    >
      <div className={styles.wizSteps}>
        {CONFIGURE_ROLE_STEPS.map((s, i) => (
          <span key={s} className={i === step ? styles.wizStepActive : i < step ? styles.wizStepDone : styles.wizStep}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div style={{ padding: 14 }}>
        {step === 0 ? (
          <FormSection title="Select Role">
            {ROLE_TYPES.map((r) => (
              <label key={r} style={{ display: "block", marginBottom: 4 }}>
                <input type="radio" checked={roleType === r} onChange={() => setRoleType(r)} /> {r}
              </label>
            ))}
          </FormSection>
        ) : null}
        {step === 1 ? (
          isVm ? (
            <HelpText>Virtual machine roles do not require a separate client access point — the VM name resource is used instead.</HelpText>
          ) : (
            <>
              <FormRow label="Name">
                <input type="text" value={capName} onChange={(e) => setCapName(e.target.value)} />
              </FormRow>
              <FormRow label="IP Address">
                <input type="text" value={capIp} onChange={(e) => setCapIp(e.target.value)} />
              </FormRow>
            </>
          )
        ) : null}
        {step === 2 ? (
          availableDisks.length === 0 ? (
            <EmptyPane>No available (non-CSV) disks to assign.</EmptyPane>
          ) : (
            <FormSection title="Select Storage">
              {availableDisks.map((d) => (
                <label key={d.name} style={{ display: "block", marginBottom: 4 }}>
                  <input type="checkbox" checked={selectedDisks.includes(d.name)} onChange={() => toggleDisk(d.name)} /> {d.name} ({d.freeGB} GB free)
                </label>
              ))}
            </FormSection>
          )
        ) : null}
        {step === 3 ? (
          <FormSection title="Confirmation">
            <div>
              <b>Type:</b> {roleType}
            </div>
            <div>
              <b>Name:</b> {capName}
            </div>
            {!isVm ? (
              <div>
                <b>IP:</b> {capIp}
              </div>
            ) : null}
            <div>
              <b>Storage:</b> {selectedDisks.length ? selectedDisks.join(", ") : "(none)"}
            </div>
          </FormSection>
        ) : null}
        {step === 4 ? <CreatingLog lines={CONFIGURE_ROLE_LOG_LINES} onDone={() => setStep(5)} /> : null}
        {step === 5 ? (
          <p>
            The role <b>{capName}</b> has been successfully configured.
          </p>
        ) : null}
      </div>
    </WsDialogComponent>
  );
}
