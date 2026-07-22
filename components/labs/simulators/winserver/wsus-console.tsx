"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsComputerGroup, WsUpdate, WsWsus } from "@/lib/labs/simulators/winserver/types";
import { ActionItem, ActionsGroup, ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, type WsTreeNode } from "./ws-mmc";
import { CheckboxRow, EmptyPane, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import styles from "./winserver-console.module.css";

type UpdatesFilter = "all" | "critical" | "security";

type Dialog =
  | { kind: "approve"; ids: string[] }
  | { kind: "new-computer-group" }
  | { kind: "sync-now" }
  | { kind: "sync-schedule" }
  | { kind: "update-source" }
  | { kind: "products-classifications" }
  | { kind: "auto-approvals" }
  | { kind: "email-notifications" }
  | { kind: "cleanup-wizard" };

function pillClassFor(approval: string): string {
  if (approval === "Declined") return styles.pillRed;
  if (approval.startsWith("Approved")) return styles.pillGreen;
  return styles.pillAmber;
}

function computerStatusPillClass(status: string): string {
  if (status === "Failed") return styles.pillRed;
  if (status === "Needed") return styles.pillAmber;
  if (status === "Installed/Not Applicable") return styles.pillGreen;
  return "";
}

function filteredUpdates(updates: WsUpdate[], filter: UpdatesFilter): WsUpdate[] {
  if (filter === "critical") return updates.filter((u) => u.severity.includes("Critical"));
  if (filter === "security") return updates.filter((u) => u.classification === "Security Updates");
  return updates;
}

export function WsusConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("server");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true, server: true, updates: true, computers: true });
  const [checkedUpdateIds, setCheckedUpdateIds] = useState<string[]>([]);
  const [selectedComputer, setSelectedComputer] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const w = state.wsus;

  const tree: WsTreeNode = {
    id: "root",
    icon: "WU",
    label: "Update Services",
    children: [
      {
        id: "server",
        icon: "S",
        label: w.server,
        children: [
          {
            id: "updates",
            icon: "U",
            label: "Updates",
            children: [
              { id: "updates-all", icon: "A", label: "All Updates" },
              { id: "updates-critical", icon: "C", label: "Critical Updates" },
              { id: "updates-security", icon: "!", label: "Security Updates" },
            ],
          },
          {
            id: "computers",
            icon: "C",
            label: "Computers",
            children: w.computerGroups.map((g) => ({ id: `group:${g.name}`, icon: "G", label: g.name })),
          },
          { id: "syncs", icon: "SY", label: "Synchronizations" },
          { id: "reports", icon: "R", label: "Reports" },
          { id: "options", icon: "O", label: "Options" },
        ],
      },
    ],
  };

  function updatesFilterFor(nodeId: string): UpdatesFilter | null {
    if (nodeId === "updates" || nodeId === "updates-all") return "all";
    if (nodeId === "updates-critical") return "critical";
    if (nodeId === "updates-security") return "security";
    return null;
  }

  function groupOf(nodeId: string): WsComputerGroup | null {
    if (!nodeId.startsWith("group:")) return null;
    const name = nodeId.slice(6);
    return w.computerGroups.find((g) => g.name === name) ?? null;
  }

  function declineUpdates(ids: string[]) {
    ids.forEach((id) => dispatch({ type: "DECLINE_UPDATE", id }));
    toast.success(`${ids.length} update(s) declined.`);
    setCheckedUpdateIds([]);
  }

  function headingFor(): string {
    if (selectedNode === "server") return `Update Services - ${w.server}`;
    if (selectedNode === "updates" || selectedNode === "updates-all") return `Updates (${w.updates.length})`;
    if (selectedNode === "updates-critical") return `Updates - Critical Updates`;
    if (selectedNode === "updates-security") return `Updates - Security Updates`;
    if (selectedNode === "computers") return "Computers";
    const grp = groupOf(selectedNode);
    if (grp) return `Computers - ${grp.name}`;
    if (selectedNode === "syncs") return "Synchronizations";
    if (selectedNode === "reports") return "Reports";
    if (selectedNode === "options") return "Options";
    return "";
  }

  function showUpdateContextMenu(e: React.MouseEvent, u: WsUpdate) {
    const items: WsContextMenuItem[] = [
      { key: "approve", label: "Approve...", onClick: () => setDialog({ kind: "approve", ids: [u.id] }) },
      { key: "decline", label: "Decline", onClick: () => declineUpdates([u.id]) },
    ];
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showGroupContextMenu(e: React.MouseEvent, g: WsComputerGroup) {
    const items: WsContextMenuItem[] = [
      {
        key: "delete",
        label: "Delete Computer Group",
        disabled: g.protected,
        onClick: () => {
          if (g.protected) return;
          if (!confirm(`Delete group "${g.name}"? Its computers will be moved to Unassigned Computers.`)) return;
          dispatch({ type: "DELETE_WSUS_COMPUTER_GROUP", name: g.name });
          if (selectedNode === `group:${g.name}`) setSelectedNode("computers");
          toast.success(`Deleted computer group "${g.name}"`);
        },
      },
    ];
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  const activeUpdatesFilter = updatesFilterFor(selectedNode);
  const activeGroup = groupOf(selectedNode);

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={tree}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((ex) => ({ ...ex, [id]: !ex[id] }))}
          onContextMenu={(e, id) => {
            const g = groupOf(id);
            if (g) showGroupContextMenu(e, g);
          }}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor()}</ContentHeading>
          {selectedNode === "server" ? (
            <ServerHome state={state} onSyncNow={() => setDialog({ kind: "sync-now" })} />
          ) : activeUpdatesFilter ? (
            <UpdatesPane
              updates={filteredUpdates(w.updates, activeUpdatesFilter)}
              checkedIds={checkedUpdateIds}
              onToggle={(id) =>
                setCheckedUpdateIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
              }
              onApprove={() => {
                if (!checkedUpdateIds.length) {
                  toast.info("No updates selected.");
                  return;
                }
                setDialog({ kind: "approve", ids: checkedUpdateIds });
              }}
              onDecline={() => {
                if (!checkedUpdateIds.length) {
                  toast.info("No updates selected.");
                  return;
                }
                declineUpdates(checkedUpdateIds);
              }}
              onRowContextMenu={showUpdateContextMenu}
            />
          ) : selectedNode === "computers" || activeGroup ? (
            <ComputersPane
              state={state}
              groupName={activeGroup ? activeGroup.name : null}
              selected={selectedComputer}
              onSelect={setSelectedComputer}
              onNewGroup={() => setDialog({ kind: "new-computer-group" })}
            />
          ) : selectedNode === "syncs" ? (
            <SyncsPane
              history={w.syncHistory}
              onSyncNow={() => setDialog({ kind: "sync-now" })}
              onSchedule={() => setDialog({ kind: "sync-schedule" })}
            />
          ) : selectedNode === "reports" ? (
            <ReportsPane />
          ) : selectedNode === "options" ? (
            <OptionsPane onOpenDialog={setDialog} />
          ) : (
            <ContentBody>
              <EmptyPane>Select a node from the tree.</EmptyPane>
            </ContentBody>
          )}
        </>
      }
      actions={
        <ActionsGroup title={w.server}>
          <ActionItem label="Synchronize Now" onClick={() => setDialog({ kind: "sync-now" })} />
          <ActionItem label="Synchronization Schedule..." onClick={() => setDialog({ kind: "sync-schedule" })} />
          <ActionItem label="New Computer Group..." onClick={() => setDialog({ kind: "new-computer-group" })} />
          <ActionItem label="Refresh" onClick={() => toast.success("Refreshed.")} />
        </ActionsGroup>
      }
      dialogs={<WsusDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} onDoneApprove={() => setCheckedUpdateIds([])} />}
    />
  );
}

function ServerHome({ state, onSyncNow }: { state: WinServerState; onSyncNow: () => void }) {
  const w = state.wsus;
  const approvedCount = w.updates.filter((u) => u.approval.startsWith("Approved")).length;
  return (
    <ContentBody>
      <table className={styles.dashTable}>
        <tbody>
          <tr>
            <th style={{ width: "40%" }}>Status</th>
            <td>
              <span className={`${styles.pill} ${styles.pillGreen}`}>Running</span>
            </td>
          </tr>
          <tr>
            <th>Version</th>
            <td>{w.version}</td>
          </tr>
          <tr>
            <th>Source</th>
            <td>{w.updateSource.mode}</td>
          </tr>
          <tr>
            <th>Last synchronization</th>
            <td>{new Date(w.lastSync).toLocaleString()}</td>
          </tr>
          <tr>
            <th>Next synchronization</th>
            <td>{new Date(w.nextSync).toLocaleString()}</td>
          </tr>
          <tr>
            <th>Products selected</th>
            <td>
              {w.products.filter((p) => p.selected).length} / {w.products.length}
            </td>
          </tr>
          <tr>
            <th>Classifications selected</th>
            <td>
              {w.classifications.filter((c) => c.selected).length} / {w.classifications.length}
            </td>
          </tr>
          <tr>
            <th>Total updates</th>
            <td>{w.updates.length}</td>
          </tr>
          <tr>
            <th>Approved</th>
            <td>{approvedCount}</td>
          </tr>
          <tr>
            <th>Computers</th>
            <td>{w.computers.length}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 14 }}>
        <button type="button" className={styles.btnPrimary} onClick={onSyncNow}>
          Synchronize Now
        </button>
      </div>
    </ContentBody>
  );
}

function UpdatesPane({
  updates,
  checkedIds,
  onToggle,
  onApprove,
  onDecline,
  onRowContextMenu,
}: {
  updates: WsUpdate[];
  checkedIds: string[];
  onToggle: (id: string) => void;
  onApprove: () => void;
  onDecline: () => void;
  onRowContextMenu: (e: React.MouseEvent, u: WsUpdate) => void;
}) {
  return (
    <ContentBody>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onApprove}>
          Approve...
        </button>{" "}
        <button type="button" className={styles.btn} onClick={onDecline}>
          Decline
        </button>
      </div>
      {updates.length === 0 ? (
        <EmptyPane>No updates match this view.</EmptyPane>
      ) : (
        <ItemListTable columns={["", "Title", "Classification", "Product", "Approval", "Installed %", "Needed %", "Severity", "Released"]}>
          {updates.map((u) => (
            <tr key={u.id} onContextMenu={(e) => onRowContextMenu(e, u)}>
              <td>
                <input type="checkbox" checked={checkedIds.includes(u.id)} onChange={() => onToggle(u.id)} onClick={(e) => e.stopPropagation()} />
              </td>
              <td>{u.title}</td>
              <td>{u.classification}</td>
              <td>{u.product}</td>
              <td>
                <span className={`${styles.pill} ${pillClassFor(u.approval)}`}>{u.approval}</span>
              </td>
              <td>{u.installedPct}%</td>
              <td>{u.neededPct}%</td>
              <td>{u.severity}</td>
              <td>{u.released}</td>
            </tr>
          ))}
        </ItemListTable>
      )}
    </ContentBody>
  );
}

function ComputersPane({
  state,
  groupName,
  selected,
  onSelect,
  onNewGroup,
}: {
  state: WinServerState;
  groupName: string | null;
  selected: string | null;
  onSelect: (name: string) => void;
  onNewGroup: () => void;
}) {
  const computers = state.wsus.computers.filter((c) => !groupName || groupName === "All Computers" || c.group === groupName);
  return (
    <ContentBody>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onNewGroup}>
          New Computer Group...
        </button>
      </div>
      {computers.length === 0 ? (
        <EmptyPane>No computers in this group.</EmptyPane>
      ) : (
        <ItemListTable columns={["Name", "IP Address", "Operating System", "Group", "Status", "Installed %", "Needed %", "Failed %"]}>
          {computers.map((c) => (
            <tr key={c.name} className={selected === c.name ? styles.itemListRowSelected : ""} onClick={() => onSelect(c.name)}>
              <td>{c.name}</td>
              <td>{c.ip}</td>
              <td>{c.os}</td>
              <td>{c.group}</td>
              <td>
                <span className={`${styles.pill} ${computerStatusPillClass(c.status)}`}>{c.status}</span>
              </td>
              <td>{c.installedPct}%</td>
              <td>{c.neededPct}%</td>
              <td>{c.failedPct}%</td>
            </tr>
          ))}
        </ItemListTable>
      )}
    </ContentBody>
  );
}

function SyncsPane({ history, onSyncNow, onSchedule }: { history: WsWsus["syncHistory"]; onSyncNow: () => void; onSchedule: () => void }) {
  return (
    <ContentBody>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onSyncNow}>
          Synchronize Now
        </button>{" "}
        <button type="button" className={styles.btn} onClick={onSchedule}>
          Schedule...
        </button>
      </div>
      {history.length === 0 ? (
        <EmptyPane>No synchronizations have run yet.</EmptyPane>
      ) : (
        <ItemListTable columns={["Started", "Finished", "Result", "New Updates"]}>
          {history.map((h, i) => (
            <tr key={i}>
              <td>{new Date(h.started).toLocaleString()}</td>
              <td>{new Date(h.finished).toLocaleString()}</td>
              <td>
                <span className={`${styles.pill} ${h.result === "Succeeded" ? styles.pillGreen : styles.pillRed}`}>{h.result}</span>
              </td>
              <td>{h.newUpdates}</td>
            </tr>
          ))}
        </ItemListTable>
      )}
    </ContentBody>
  );
}

const REPORTS = [
  { key: "upd-status", title: "Update Status Summary", desc: "Aggregate of update install state across all computers." },
  { key: "upd-tabular", title: "Update Tabular Status", desc: "Per-update install/needed/failed for each computer." },
  { key: "cmp-status", title: "Computer Status Summary", desc: "Per-computer compliance summary." },
  { key: "cmp-tabular", title: "Computer Tabular Status", desc: "Per-computer detail with each update." },
  { key: "sync-results", title: "Synchronization Results", desc: "Last synchronization timings and new updates." },
];

function ReportsPane() {
  return (
    <ContentBody>
      <div className={styles.tileGrid}>
        {REPORTS.map((r) => (
          <div key={r.key} className={styles.tile} onClick={() => toast.info(`Generating report "${r.title}"...`)}>
            <div className={styles.tileHead}>{r.title}</div>
            <div className={styles.tileDesc}>{r.desc}</div>
          </div>
        ))}
      </div>
    </ContentBody>
  );
}

type OptionKey = "source" | "products" | "auto" | "email" | "cleanup";

const OPTION_TILES: { key: OptionKey; title: string; desc: string }[] = [
  { key: "source", title: "Update Source and Proxy Server", desc: "Configure upstream server, Microsoft Update, proxy." },
  { key: "products", title: "Products and Classifications", desc: "Select products and classifications to synchronize." },
  { key: "auto", title: "Automatic Approvals", desc: "Rules that auto-approve updates by classification." },
  { key: "email", title: "Email Notifications", desc: "Send status and synchronization emails." },
  { key: "cleanup", title: "Server Cleanup Wizard", desc: "Remove unused updates and expired data." },
];

function OptionsPane({ onOpenDialog }: { onOpenDialog: (d: Dialog) => void }) {
  function open(key: OptionKey) {
    if (key === "source") onOpenDialog({ kind: "update-source" });
    if (key === "products") onOpenDialog({ kind: "products-classifications" });
    if (key === "auto") onOpenDialog({ kind: "auto-approvals" });
    if (key === "email") onOpenDialog({ kind: "email-notifications" });
    if (key === "cleanup") onOpenDialog({ kind: "cleanup-wizard" });
  }
  return (
    <ContentBody>
      <div className={styles.tileGrid}>
        {OPTION_TILES.map((t) => (
          <div key={t.key} className={styles.tile} onClick={() => open(t.key)}>
            <div className={styles.tileHead}>{t.title}</div>
            <div className={styles.tileDesc}>{t.desc}</div>
          </div>
        ))}
      </div>
    </ContentBody>
  );
}

function WsusDialogs({
  dialog,
  state,
  dispatch,
  onClose,
  onDoneApprove,
}: {
  dialog: Dialog | null;
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  onClose: () => void;
  onDoneApprove: () => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "approve") return <ApproveDialog ids={dialog.ids} state={state} dispatch={dispatch} onClose={onClose} onDone={onDoneApprove} />;
  if (dialog.kind === "new-computer-group") return <NewComputerGroupDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "sync-now") return <SyncNowDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "sync-schedule") return <SyncScheduleDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "update-source") return <UpdateSourceDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "products-classifications") return <ProductsClassificationsDialog state={state} onClose={onClose} />;
  if (dialog.kind === "auto-approvals") return <AutoApprovalsDialog state={state} onClose={onClose} />;
  if (dialog.kind === "email-notifications") return <EmailNotificationsDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "cleanup-wizard") return <CleanupWizardDialog onClose={onClose} />;
  return null;
}

const APPROVAL_OPTIONS = [
  { value: "", label: "Not Approved" },
  { value: "install", label: "Approved (Install)" },
  { value: "detect", label: "Approved (Detect)" },
  { value: "decline", label: "Declined" },
] as const;

function ApproveDialog({
  ids,
  state,
  dispatch,
  onClose,
  onDone,
}: {
  ids: string[];
  state: WinServerState;
  dispatch: (a: WinServerAction) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");

  return (
    <WsDialogComponent
      title="Approve Updates"
      width="560px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const installGroups: string[] = [];
            const detectGroups: string[] = [];
            let declined = false;
            state.wsus.computerGroups.forEach((g) => {
              const choice = choices[g.name] || "";
              if (choice === "install") installGroups.push(g.name);
              else if (choice === "detect") detectGroups.push(`${g.name} (detect)`);
              else if (choice === "decline") declined = true;
            });
            ids.forEach((id) => {
              if (installGroups.length) {
                dispatch({ type: "APPROVE_UPDATE", id, approval: "Approved (Install)", groups: installGroups });
              } else if (detectGroups.length) {
                dispatch({ type: "APPROVE_UPDATE", id, approval: "Approved (Detect)", groups: detectGroups });
              } else if (declined) {
                dispatch({ type: "DECLINE_UPDATE", id });
              } else {
                dispatch({ type: "APPROVE_UPDATE", id, approval: "Not approved", groups: [] });
              }
            });
            toast.success(`${ids.length} update(s) processed.`);
            onDone();
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p style={{ marginBottom: 8 }}>
        Approve <b>{ids.length}</b> update(s) for installation or detection in the following computer groups:
      </p>
      <ItemListTable columns={["Computer Group", "Approval"]}>
        {state.wsus.computerGroups.map((g) => (
          <tr key={g.name}>
            <td>{g.name}</td>
            <td>
              <select value={choices[g.name] ?? ""} onChange={(e) => setChoices((c) => ({ ...c, [g.name]: e.target.value }))}>
                {APPROVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </ItemListTable>
      <div style={{ marginTop: 10 }}>
        <CheckboxRow id="apDeadline" label="Set a deadline" checked={deadline} onChange={setDeadline} />
        {deadline ? (
          <FormRow label="Deadline date/time">
            <input type="datetime-local" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </FormRow>
        ) : null}
      </div>
    </WsDialogComponent>
  );
}

function NewComputerGroupDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <WsDialogComponent
      title="Add Computer Group"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const trimmed = name.trim();
            if (!trimmed) {
              alert("Computer group name is required.");
              return false;
            }
            if (state.wsus.computerGroups.some((g) => g.name === trimmed)) {
              alert("A group with that name already exists.");
              return false;
            }
            dispatch({ type: "ADD_WSUS_COMPUTER_GROUP", name: trimmed });
            toast.success(`Computer group "${trimmed}" created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
    </WsDialogComponent>
  );
}

const SYNC_PHASES = [
  "Connecting to Microsoft Update...",
  "Downloading metadata...",
  "Indexing updates...",
  "Discovering new updates...",
  "Updating approval rules...",
  "Saving...",
  "Succeeded",
];

function SyncNowDialog({ dispatch, onClose }: { dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([SYNC_PHASES[0]]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 1;
    let cancelled = false;
    function step() {
      if (cancelled) return;
      if (i >= SYNC_PHASES.length) {
        dispatch({ type: "RUN_WSUS_SYNC" });
        setDone(true);
        toast.success("Synchronization succeeded.");
        return;
      }
      setLines((prev) => [...prev, SYNC_PHASES[i]]);
      i++;
      setTimeout(step, 450);
    }
    const timer = setTimeout(step, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WsDialogComponent title="Synchronizing..." width="480px" onClose={onClose} buttons={done ? [{ label: "OK", primary: true }] : []}>
      <div className={styles.terminal}>{lines.join("\n")}</div>
    </WsDialogComponent>
  );
}

function SyncScheduleDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"Manual" | "Daily">(state.wsus.syncSchedule.mode);
  const [time, setTime] = useState(state.wsus.syncSchedule.time);
  const [perDay, setPerDay] = useState(state.wsus.syncSchedule.perDay);

  return (
    <WsDialogComponent
      title="Synchronization Schedule"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "SET_WSUS_SYNC_SCHEDULE", schedule: { mode, time, perDay } });
            toast.success("Synchronization schedule updated.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormSection title="Synchronization mode">
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={mode === "Manual"} onChange={() => setMode("Manual")} /> Synchronize manually
        </label>
        <label style={{ display: "block" }}>
          <input type="radio" checked={mode === "Daily"} onChange={() => setMode("Daily")} /> Synchronize automatically
        </label>
      </FormSection>
      {mode === "Daily" ? (
        <>
          <FormRow label="First synchronization">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormRow>
          <FormRow label="Synchronizations per day">
            <input type="number" min={1} max={24} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} />
          </FormRow>
        </>
      ) : null}
    </WsDialogComponent>
  );
}

function UpdateSourceDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const w = state.wsus;
  const [mode, setMode] = useState<WsWsus["updateSource"]["mode"]>(w.updateSource.mode);
  const [upstreamServer, setUpstreamServer] = useState(w.updateSource.upstreamServer);
  const [useSsl, setUseSsl] = useState(w.updateSource.useSsl);
  const [proxyEnabled, setProxyEnabled] = useState(w.proxyServer.enabled);
  const [proxyHost, setProxyHost] = useState(w.proxyServer.host);
  const [proxyPort, setProxyPort] = useState(w.proxyServer.port);

  return (
    <WsDialogComponent
      title="Update Source and Proxy Server"
      width="600px"
      onClose={onClose}
      buttons={[{ label: "OK", primary: true, onClick: () => { toast.success("Update source settings saved."); return true; } }, { label: "Cancel" }]}
    >
      <FormSection title="Update Source">
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={mode === "Microsoft Update"} onChange={() => setMode("Microsoft Update")} /> Synchronize from Microsoft Update
        </label>
        <label style={{ display: "block" }}>
          <input type="radio" checked={mode === "Upstream server"} onChange={() => setMode("Upstream server")} /> Synchronize from another Windows Server Update Services server
        </label>
      </FormSection>
      <FormRow label="Server name">
        <input type="text" value={upstreamServer} onChange={(e) => setUpstreamServer(e.target.value)} disabled={mode !== "Upstream server"} />
      </FormRow>
      <CheckboxRow id="usSsl" label="Use SSL when synchronizing" checked={useSsl} onChange={setUseSsl} />
      <FormSection title="Proxy Server">
        <CheckboxRow id="usProxy" label="Use a proxy server when synchronizing" checked={proxyEnabled} onChange={setProxyEnabled} />
        <FormRow label="Server">
          <input type="text" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} disabled={!proxyEnabled} />
        </FormRow>
        <FormRow label="Port">
          <input type="number" value={proxyPort} onChange={(e) => setProxyPort(Number(e.target.value))} disabled={!proxyEnabled} />
        </FormRow>
      </FormSection>
      <HelpText>This dialog is decorative in this simulator; values are not persisted to state.</HelpText>
    </WsDialogComponent>
  );
}

function ProductsClassificationsDialog({ state, onClose }: { state: WinServerState; onClose: () => void }) {
  const [tab, setTab] = useState<"Products" | "Classifications">("Products");
  const grouped = new Map<string, typeof state.wsus.products>();
  state.wsus.products.forEach((p) => {
    const list = grouped.get(p.parent) ?? [];
    list.push(p);
    grouped.set(p.parent, list);
  });

  return (
    <WsDialogComponent title="Products and Classifications" width="720px" onClose={onClose} buttons={[{ label: "OK", primary: true }, { label: "Cancel" }]}>
      <div className={styles.tabsStrip}>
        {(["Products", "Classifications"] as const).map((t) => (
          <div key={t} className={`${styles.tab} ${t === tab ? styles.tabActive : ""}`} onClick={() => setTab(t)}>
            {t}
          </div>
        ))}
      </div>
      <div className={styles.tabPanel}>
        {tab === "Products" ? (
          <div>
            {Array.from(grouped.entries()).map(([parent, products]) => (
              <div key={parent} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{parent}</div>
                {products.map((p) => (
                  <CheckboxRow key={p.name} id={`prod-${p.name}`} label={p.name} checked={p.selected} onChange={() => {}} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {state.wsus.classifications.map((c) => (
              <CheckboxRow key={c.name} id={`cls-${c.name}`} label={c.name} checked={c.selected} onChange={() => {}} />
            ))}
          </div>
        )}
      </div>
      <HelpText>This dialog is decorative in this simulator; selections are not persisted to state.</HelpText>
    </WsDialogComponent>
  );
}

function AutoApprovalsDialog({ state, onClose }: { state: WinServerState; onClose: () => void }) {
  return (
    <WsDialogComponent title="Automatic Approvals" width="600px" onClose={onClose} buttons={[{ label: "OK", primary: true }]}>
      <p style={{ marginBottom: 8 }}>Rules that automatically approve updates as they are synchronized:</p>
      <ItemListTable columns={["Enabled", "Rule name", "Classifications", "Groups"]}>
        {state.wsus.autoApprove.map((r) => (
          <tr key={r.rule}>
            <td>
              <input type="checkbox" checked={r.enabled} readOnly />
            </td>
            <td>{r.rule}</td>
            <td>{r.classifications.join(", ")}</td>
            <td>{r.groups.join(", ")}</td>
          </tr>
        ))}
      </ItemListTable>
    </WsDialogComponent>
  );
}

function EmailNotificationsDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const w = state.wsus.emailNotifications;
  const [enabled, setEnabled] = useState(w.enabled);
  const [smtpHost, setSmtpHost] = useState(w.smtpHost);
  const [smtpPort, setSmtpPort] = useState(w.smtpPort);
  const [recipients, setRecipients] = useState(w.recipients);

  return (
    <WsDialogComponent
      title="Email Notifications"
      width="560px"
      onClose={onClose}
      buttons={[{ label: "OK", primary: true, onClick: () => { toast.success("Email notification settings saved."); return true; } }, { label: "Cancel" }]}
    >
      <CheckboxRow id="emEnabled" label="Send email notifications for new updates and status reports" checked={enabled} onChange={setEnabled} />
      <FormRow label="SMTP server">
        <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} disabled={!enabled} />
      </FormRow>
      <FormRow label="Port">
        <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} disabled={!enabled} />
      </FormRow>
      <FormRow label="Recipients">
        <input type="text" placeholder="email1@corp.com;email2@corp.com" value={recipients} onChange={(e) => setRecipients(e.target.value)} disabled={!enabled} />
      </FormRow>
      <HelpText>This dialog is decorative in this simulator; values are not persisted to state.</HelpText>
    </WsDialogComponent>
  );
}

function CleanupWizardDialog({ onClose }: { onClose: () => void }) {
  const [notNeeded, setNotNeeded] = useState(true);
  const [staleComputers, setStaleComputers] = useState(true);
  const [unneededFiles, setUnneededFiles] = useState(false);
  const [expired, setExpired] = useState(true);
  const [superseded, setSuperseded] = useState(true);

  return (
    <WsDialogComponent
      title="Server Cleanup Wizard"
      width="480px"
      onClose={onClose}
      buttons={[
        {
          label: "Run Cleanup",
          primary: true,
          onClick: () => {
            const checked = [notNeeded, staleComputers, unneededFiles, expired, superseded].filter(Boolean).length;
            const reclaimedGB = (checked * 0.6 + 0.8).toFixed(1);
            toast.success(`Server cleanup completed. Reclaimed ${reclaimedGB} GB.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p style={{ marginBottom: 8 }}>Select the cleanup operations to run:</p>
      <CheckboxRow id="cwNotNeeded" label="Updates that aren't needed" checked={notNeeded} onChange={setNotNeeded} />
      <CheckboxRow id="cwStale" label="Computers not contacted in 30 days" checked={staleComputers} onChange={setStaleComputers} />
      <CheckboxRow id="cwFiles" label="Unneeded update files" checked={unneededFiles} onChange={setUnneededFiles} />
      <CheckboxRow id="cwExpired" label="Expired updates" checked={expired} onChange={setExpired} />
      <CheckboxRow id="cwSuperseded" label="Superseded updates" checked={superseded} onChange={setSuperseded} />
    </WsDialogComponent>
  );
}
