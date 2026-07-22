"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsDhcpReservation, WsDhcpScope } from "@/lib/labs/simulators/winserver/types";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import { CheckboxRow, EmptyPane, FormRow, HelpText, WsDialogComponent } from "./ws-dialog";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, type WsTreeNode } from "./ws-mmc";
import styles from "./winserver-console.module.css";

type Dialog =
  | { kind: "add-exclusion"; scopeId: string }
  | { kind: "new-reservation"; scopeId: string }
  | { kind: "new-scope" }
  | { kind: "scope-properties"; scopeId: string }
  | { kind: "scope-stats"; scopeId: string }
  | { kind: "add-filter"; list: "allow" | "deny" };

const COMMON_OPTIONS: { code: string; placeholder: string }[] = [
  { code: "003 Router", placeholder: "10.0.0.1" },
  { code: "006 DNS Servers", placeholder: "10.0.0.5, 10.0.0.6" },
  { code: "015 DNS Domain Name", placeholder: "corp.cloudlab.local" },
  { code: "044 WINS/NBNS Servers", placeholder: "" },
  { code: "046 WINS/NBT Node Type", placeholder: "0x8 (H-node)" },
];

function ipToNum(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function ipRangeSize(start: string, end: string): number {
  return ipToNum(end) - ipToNum(start) + 1;
}

function formatLease(scope: WsDhcpScope): string {
  if (scope.leaseDays === 0 && scope.leaseHours === 0 && scope.leaseMinutes === 0) return "Unlimited";
  const parts: string[] = [];
  if (scope.leaseDays) parts.push(`${scope.leaseDays} day${scope.leaseDays > 1 ? "s" : ""}`);
  if (scope.leaseHours) parts.push(`${scope.leaseHours} hour${scope.leaseHours > 1 ? "s" : ""}`);
  if (scope.leaseMinutes) parts.push(`${scope.leaseMinutes} min`);
  return parts.join(" ");
}

export function DhcpConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("dhcproot");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ dhcproot: true, server: true, ipv4: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const { dhcp } = state;

  function scopeById(id: string): WsDhcpScope | undefined {
    return dhcp.scopes.find((s) => s.id === id);
  }

  const treeRoot: WsTreeNode = {
    id: "dhcproot",
    icon: "DH",
    label: "DHCP",
    children: [
      {
        id: "server",
        icon: "S",
        label: dhcp.serverFqdn,
        children: [
          {
            id: "ipv4",
            icon: "v4",
            label: "IPv4",
            children: [
              ...dhcp.scopes.map((s) => ({
                id: `scope:${s.id}`,
                icon: "SC",
                label: `Scope [${s.subnet}] ${s.name}`,
                children: [
                  { id: `pool:${s.id}`, icon: "AP", label: "Address Pool" },
                  { id: `leases:${s.id}`, icon: "AL", label: "Address Leases" },
                  { id: `res:${s.id}`, icon: "RV", label: "Reservations" },
                  { id: `opts:${s.id}`, icon: "OP", label: "Scope Options" },
                ],
              })),
              { id: "server-options", icon: "SO", label: "Server Options" },
              {
                id: "filters",
                icon: "FI",
                label: "Filters",
                children: [
                  { id: "filters-allow", icon: "A", label: "Allow" },
                  { id: "filters-deny", icon: "D", label: "Deny" },
                ],
              },
            ],
          },
          { id: "ipv6", icon: "v6", label: "IPv6" },
        ],
      },
    ],
  };

  function headingFor(node: string): string {
    if (node === "dhcproot") return "DHCP";
    if (node === "server") return dhcp.serverFqdn;
    if (node === "ipv4") return "IPv4";
    if (node === "ipv6") return "IPv6";
    if (node === "server-options") return "Server Options";
    if (node === "filters" || node === "filters-allow" || node === "filters-deny") return "Filters";
    if (node.startsWith("scope:")) {
      const s = scopeById(node.slice(6));
      return s ? `Scope [${s.subnet}] ${s.name}` : "Scope";
    }
    if (node.startsWith("pool:")) {
      const s = scopeById(node.slice(5));
      return `Address Pool - ${s?.name ?? ""}`;
    }
    if (node.startsWith("leases:")) {
      const s = scopeById(node.slice(7));
      return `Address Leases - ${s?.name ?? ""}`;
    }
    if (node.startsWith("res:")) {
      const s = scopeById(node.slice(4));
      return `Reservations - ${s?.name ?? ""}`;
    }
    if (node.startsWith("opts:")) {
      const s = scopeById(node.slice(5));
      return `Scope Options - ${s?.name ?? ""}`;
    }
    return "";
  }

  function activateScope(scopeId: string, active: boolean) {
    dispatch({ type: "UPDATE_DHCP_SCOPE", id: scopeId, patch: { active } });
    toast.success(active ? "Scope activated" : "Scope deactivated");
  }

  function deleteScope(scopeId: string) {
    const scope = scopeById(scopeId);
    if (!confirm(`Delete scope "${scope?.name ?? scopeId}" and all associated leases and reservations?`)) return;
    dispatch({ type: "DELETE_DHCP_SCOPE", id: scopeId });
    toast.success("Scope deleted");
    setSelectedNode("ipv4");
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const items: WsContextMenuItem[] = [];
    if (nodeId === "ipv4") {
      items.push({ key: "ns", label: "New Scope...", onClick: () => setDialog({ kind: "new-scope" }) });
      items.push("-");
      items.push({ key: "rec", label: "Reconcile All Scopes...", onClick: () => toast.success("All scopes are consistent.") });
    } else if (nodeId === "server") {
      items.push({ key: "auth", label: "Authorize", onClick: () => toast.info("Server is already authorized.") });
      items.push({ key: "backup", label: "Backup...", onClick: () => toast.success("DHCP database backed up to C:\\Windows\\System32\\dhcp\\backup") });
      items.push({ key: "restore", label: "Restore...", onClick: () => toast.info("DHCP database restored. Service restart required.") });
    } else if (nodeId.startsWith("scope:")) {
      const scopeId = nodeId.slice(6);
      const scope = scopeById(scopeId);
      if (scope) {
        items.push({ key: "stats", label: "Display Statistics...", onClick: () => setDialog({ kind: "scope-stats", scopeId }) });
        items.push({ key: "toggle", label: scope.active ? "Deactivate" : "Activate", onClick: () => activateScope(scopeId, !scope.active) });
        items.push("-");
        items.push({ key: "reconcile", label: "Reconcile...", onClick: () => toast.success("Scope is consistent.") });
        items.push({ key: "delete", label: "Delete", onClick: () => deleteScope(scopeId) });
        items.push("-");
        items.push({ key: "props", label: "Properties", onClick: () => setDialog({ kind: "scope-properties", scopeId }) });
      }
    }
    if (items.length) WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function renderServerPane() {
    return (
      <ContentBody>
        <p style={{ marginBottom: 8 }}>A scope is a range of IP addresses that the DHCP server can lease to clients on this network.</p>
        <table className={styles.dashTable}>
          <tbody>
            <tr>
              <th style={{ width: "40%" }}>Status</th>
              <td>
                <span className={styles.pillGreen} style={{ display: "inline-block" }}>
                  Running
                </span>
              </td>
            </tr>
            <tr>
              <th>Authorization</th>
              <td>
                <span className={dhcp.authorized ? styles.pillGreen : styles.pillRed} style={{ display: "inline-block" }}>
                  {dhcp.authorized ? "Authorized" : "Not Authorized"}
                </span>
              </td>
            </tr>
            <tr>
              <th>Number of scopes</th>
              <td>{dhcp.scopes.length}</td>
            </tr>
            <tr>
              <th>Total leases</th>
              <td>{dhcp.leases.length}</td>
            </tr>
            <tr>
              <th>Total reservations</th>
              <td>{dhcp.reservations.length}</td>
            </tr>
          </tbody>
        </table>
      </ContentBody>
    );
  }

  function renderIpv4Summary() {
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "new-scope" })}>
            New Scope...
          </button>
        </div>
        <ItemListTable columns={["Subnet", "Name", "State", "Range", "Leases", "Reservations"]}>
          {dhcp.scopes.map((s) => {
            const leaseCount = dhcp.leases.filter((l) => l.scopeId === s.id).length;
            const resCount = dhcp.reservations.filter((r) => r.scopeId === s.id).length;
            return (
              <tr key={s.id} onDoubleClick={() => setSelectedNode(`scope:${s.id}`)}>
                <td>{s.subnet}</td>
                <td>{s.name}</td>
                <td>
                  <span className={s.active ? styles.pillGreen : styles.pillRed}>{s.active ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  {s.startIp} - {s.endIp}
                </td>
                <td>{leaseCount}</td>
                <td>{resCount}</td>
              </tr>
            );
          })}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderScope(scopeId: string) {
    const s = scopeById(scopeId);
    if (!s) return <EmptyPane>Scope not found.</EmptyPane>;
    const leases = dhcp.leases.filter((l) => l.scopeId === s.id);
    const reservations = dhcp.reservations.filter((r) => r.scopeId === s.id);
    const poolSize = ipRangeSize(s.startIp, s.endIp) - reservations.length;
    return (
      <ContentBody>
        <table className={styles.dashTable}>
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Name</th>
              <td>{s.name}</td>
            </tr>
            <tr>
              <th>Description</th>
              <td>{s.description}</td>
            </tr>
            <tr>
              <th>State</th>
              <td>
                <span className={s.active ? styles.pillGreen : styles.pillRed}>{s.active ? "Active" : "Inactive"}</span>
              </td>
            </tr>
            <tr>
              <th>Address Pool</th>
              <td>
                {s.startIp} - {s.endIp} ({ipRangeSize(s.startIp, s.endIp)} addresses)
              </td>
            </tr>
            <tr>
              <th>Subnet mask</th>
              <td>
                {s.mask} (/{s.cidr})
              </td>
            </tr>
            <tr>
              <th>Active leases</th>
              <td>{leases.length}</td>
            </tr>
            <tr>
              <th>Reservations</th>
              <td>{reservations.length}</td>
            </tr>
            <tr>
              <th>Available addresses</th>
              <td>{poolSize - leases.length}</td>
            </tr>
            <tr>
              <th>Lease duration</th>
              <td>{formatLease(s)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btn} onClick={() => activateScope(s.id, !s.active)}>
            {s.active ? "Deactivate" : "Activate"}
          </button>{" "}
          <button type="button" className={styles.btn} onClick={() => deleteScope(s.id)}>
            Delete Scope...
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderPool(scopeId: string) {
    const s = scopeById(scopeId);
    if (!s) return <EmptyPane>Scope not found.</EmptyPane>;
    return (
      <ContentBody>
        <ItemListTable columns={["Start IP", "End IP", "Description"]}>
          <tr>
            <td>{s.startIp}</td>
            <td>{s.endIp}</td>
            <td>Address range for distribution</td>
          </tr>
        </ItemListTable>
        <h3 style={{ marginTop: 14, color: "#1d6dad", fontSize: 14 }}>Exclusions</h3>
        <ItemListTable columns={["Start IP", "End IP"]}>
          {s.exclusions.length ? (
            s.exclusions.map((exc, i) => (
              <tr key={i}>
                <td>{exc.start}</td>
                <td>{exc.end}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} style={{ color: "#666" }}>
                No exclusions
              </td>
            </tr>
          )}
        </ItemListTable>
        <div style={{ marginTop: 8 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "add-exclusion", scopeId })}>
            Add Exclusion Range...
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderLeases(scopeId: string) {
    const s = scopeById(scopeId);
    if (!s) return <EmptyPane>Scope not found.</EmptyPane>;
    const leases = dhcp.leases.filter((l) => l.scopeId === s.id);
    return (
      <ContentBody>
        <ItemListTable columns={["Client IP Address", "Name", "Lease Expires", "Unique ID", "Type", "Vendor Class", "User Class"]}>
          {leases.length ? (
            leases.map((l) => (
              <tr key={l.ip}>
                <td>{l.ip}</td>
                <td>{l.name}</td>
                <td>{new Date(l.expires).toLocaleString()}</td>
                <td>{l.mac}</td>
                <td>{l.lease}</td>
                <td>{l.vendor}</td>
                <td>{l.userClass}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} style={{ color: "#666" }}>
                No active leases
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    );
  }

  function deleteReservation(scopeId: string, ip: string) {
    if (!confirm("Delete this reservation?")) return;
    dispatch({ type: "DELETE_DHCP_RESERVATION", scopeId, ip });
    toast.success("Reservation deleted");
  }

  function renderReservations(scopeId: string) {
    const s = scopeById(scopeId);
    if (!s) return <EmptyPane>Scope not found.</EmptyPane>;
    const reservations = dhcp.reservations.filter((r) => r.scopeId === s.id);
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "new-reservation", scopeId })}>
            New Reservation...
          </button>
        </div>
        <ItemListTable columns={["IP Address", "Name", "MAC Address", "Description", "Type", ""]}>
          {reservations.length ? (
            reservations.map((r) => (
              <tr key={r.ip}>
                <td>{r.ip}</td>
                <td>{r.name}</td>
                <td>{r.mac}</td>
                <td>{r.description}</td>
                <td>{r.type}</td>
                <td>
                  <button type="button" className={styles.btn} onClick={() => deleteReservation(scopeId, r.ip)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} style={{ color: "#666" }}>
                No reservations
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderOptionsEditor(scopeId: string | null) {
    const target = scopeId === null ? dhcp.serverOptions : scopeById(scopeId)?.options ?? {};
    return (
      <ContentBody>
        {scopeId !== null ? null : <p style={{ marginBottom: 8 }}>Server options apply to all scopes unless overridden at the scope level.</p>}
        <OptionsEditorForm
          options={target}
          onSave={(options) => {
            dispatch({ type: "SET_DHCP_OPTIONS", scopeId, options });
            toast.success("Options saved");
          }}
        />
      </ContentBody>
    );
  }

  function addFilter(list: "allow" | "deny", mac: string, description: string) {
    dispatch({ type: "ADD_DHCP_FILTER", list, entry: { mac, description } });
    toast.success("Filter added");
  }

  function renderFilters() {
    return (
      <ContentBody>
        <h3 style={{ color: "#1d6dad", fontSize: 14 }}>Allow</h3>
        <div style={{ marginBottom: 6 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "add-filter", list: "allow" })}>
            Add Filter...
          </button>
        </div>
        <ItemListTable columns={["MAC Address", "Description"]}>
          {dhcp.filters.allow.length ? (
            dhcp.filters.allow.map((f, i) => (
              <tr key={i}>
                <td>{f.mac}</td>
                <td>{f.description}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} style={{ color: "#666" }}>
                No allow filters
              </td>
            </tr>
          )}
        </ItemListTable>
        <h3 style={{ marginTop: 14, color: "#1d6dad", fontSize: 14 }}>Deny</h3>
        <div style={{ marginBottom: 6 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "add-filter", list: "deny" })}>
            Add Filter...
          </button>
        </div>
        <ItemListTable columns={["MAC Address", "Description"]}>
          {dhcp.filters.deny.length ? (
            dhcp.filters.deny.map((f, i) => (
              <tr key={i}>
                <td>{f.mac}</td>
                <td>{f.description}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} style={{ color: "#666" }}>
                No deny filters
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderContent() {
    if (selectedNode === "dhcproot" || selectedNode === "server") return renderServerPane();
    if (selectedNode === "ipv4") return renderIpv4Summary();
    if (selectedNode === "ipv6") return <EmptyPane>No IPv6 scopes configured.</EmptyPane>;
    if (selectedNode === "server-options") return renderOptionsEditor(null);
    if (selectedNode === "filters" || selectedNode === "filters-allow" || selectedNode === "filters-deny") return renderFilters();
    if (selectedNode.startsWith("scope:")) return renderScope(selectedNode.slice(6));
    if (selectedNode.startsWith("pool:")) return renderPool(selectedNode.slice(5));
    if (selectedNode.startsWith("leases:")) return renderLeases(selectedNode.slice(7));
    if (selectedNode.startsWith("res:")) return renderReservations(selectedNode.slice(4));
    if (selectedNode.startsWith("opts:")) return renderOptionsEditor(selectedNode.slice(5));
    return <EmptyPane>Select an item from the tree.</EmptyPane>;
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
          {renderContent()}
        </>
      }
      dialogs={
        <DhcpDialogs
          dialog={dialog}
          state={state}
          dispatch={dispatch}
          onClose={() => setDialog(null)}
          onScopeCreated={(id) => setSelectedNode(`scope:${id}`)}
          onAddFilter={addFilter}
        />
      }
    />
  );
}

function OptionsEditorForm({ options, onSave }: { options: Record<string, string>; onSave: (options: Record<string, string>) => void }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const o of COMMON_OPTIONS) initial[o.code] = options[o.code] !== undefined;
    return initial;
  });
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const o of COMMON_OPTIONS) initial[o.code] = options[o.code] ?? "";
    return initial;
  });

  return (
    <div className={styles.formSection}>
      {COMMON_OPTIONS.map((o) => (
        <div key={o.code}>
          <CheckboxRow id={`opt-${o.code}`} label={o.code} checked={enabled[o.code]} onChange={(v) => setEnabled((e) => ({ ...e, [o.code]: v }))} />
          <FormRow label="Value">
            <input
              type="text"
              value={values[o.code]}
              placeholder={o.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [o.code]: e.target.value }))}
            />
          </FormRow>
        </div>
      ))}
      <button
        type="button"
        className={styles.btnPrimary}
        onClick={() => {
          const next: Record<string, string> = {};
          for (const o of COMMON_OPTIONS) {
            if (enabled[o.code]) next[o.code] = values[o.code];
          }
          onSave(next);
        }}
      >
        OK
      </button>
    </div>
  );
}

function DhcpDialogs({
  dialog,
  state,
  dispatch,
  onClose,
  onScopeCreated,
  onAddFilter,
}: {
  dialog: Dialog | null;
  state: WinServerState;
  dispatch: (a: WinServerAction) => void;
  onClose: () => void;
  onScopeCreated: (id: string) => void;
  onAddFilter: (list: "allow" | "deny", mac: string, description: string) => void;
}) {
  if (!dialog) return null;

  if (dialog.kind === "add-exclusion") return <AddExclusionDialog scopeId={dialog.scopeId} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "new-reservation") return <NewReservationDialog scopeId={dialog.scopeId} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "new-scope") return <NewScopeWizard state={state} dispatch={dispatch} onClose={onClose} onCreated={onScopeCreated} />;
  if (dialog.kind === "scope-properties") return <ScopePropertiesDialog scopeId={dialog.scopeId} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "scope-stats") return <ScopeStatsDialog scopeId={dialog.scopeId} state={state} onClose={onClose} />;
  if (dialog.kind === "add-filter") return <AddFilterDialog list={dialog.list} onClose={onClose} onAdd={onAddFilter} />;
  return null;
}

function AddExclusionDialog({ scopeId, state, dispatch, onClose }: { scopeId: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const scope = state.dhcp.scopes.find((s) => s.id === scopeId);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  if (!scope) return null;

  return (
    <WsDialogComponent
      title="Add Exclusion"
      onClose={onClose}
      buttons={[
        {
          label: "Add",
          primary: true,
          onClick: () => {
            if (!start.trim() || !end.trim()) {
              alert("Start and end IP are required.");
              return false;
            }
            dispatch({ type: "UPDATE_DHCP_SCOPE", id: scopeId, patch: { exclusions: [...scope.exclusions, { start: start.trim(), end: end.trim() }] } });
            toast.success("Exclusion range added");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Start IP">
        <input type="text" value={start} onChange={(e) => setStart(e.target.value)} />
      </FormRow>
      <FormRow label="End IP">
        <input type="text" value={end} onChange={(e) => setEnd(e.target.value)} />
      </FormRow>
    </WsDialogComponent>
  );
}

function NewReservationDialog({ scopeId, state, dispatch, onClose }: { scopeId: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const scope = state.dhcp.scopes.find((s) => s.id === scopeId);
  const [name, setName] = useState("");
  const [ip, setIp] = useState(scope ? scope.subnet.replace(/\.\d+$/, ".") : "");
  const [mac, setMac] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<WsDhcpReservation["type"]>("Both");
  if (!scope) return null;

  return (
    <WsDialogComponent
      title="New Reservation"
      onClose={onClose}
      buttons={[
        {
          label: "Add",
          primary: true,
          onClick: () => {
            if (!ip.trim() || !mac.trim()) {
              alert("IP address and MAC address are required.");
              return false;
            }
            if (state.dhcp.reservations.some((r) => r.scopeId === scopeId && r.ip === ip.trim())) {
              alert("A reservation for that IP already exists.");
              return false;
            }
            dispatch({
              type: "ADD_DHCP_RESERVATION",
              reservation: { scopeId, ip: ip.trim(), mac: mac.trim(), name: name.trim(), description: description.trim(), type },
            });
            toast.success("Reservation created");
            return true;
          },
        },
        { label: "Close" },
      ]}
    >
      <FormRow label="Reservation name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="IP address">
        <input type="text" value={ip} onChange={(e) => setIp(e.target.value)} />
      </FormRow>
      <FormRow label="MAC address">
        <input type="text" value={mac} placeholder="00-15-5D-AA-BB-CC" onChange={(e) => setMac(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <FormRow label="Supported types">
        <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          {(["Both", "DHCP", "BOOTP"] as const).map((t) => (
            <label key={t}>
              <input type="radio" checked={type === t} onChange={() => setType(t)} /> {t === "Both" ? "Both" : `${t} only`}
            </label>
          ))}
        </div>
      </FormRow>
    </WsDialogComponent>
  );
}

function ScopePropertiesDialog({ scopeId, state, dispatch, onClose }: { scopeId: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const scope = state.dhcp.scopes.find((s) => s.id === scopeId);
  const [name, setName] = useState(scope?.name ?? "");
  const [description, setDescription] = useState(scope?.description ?? "");
  const [startIp, setStartIp] = useState(scope?.startIp ?? "");
  const [endIp, setEndIp] = useState(scope?.endIp ?? "");
  const [leaseDays, setLeaseDays] = useState(scope?.leaseDays ?? 0);
  const [leaseHours, setLeaseHours] = useState(scope?.leaseHours ?? 0);
  if (!scope) return null;

  return (
    <WsDialogComponent
      title={`Scope [${scope.subnet}] ${scope.name} Properties`}
      width="500px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({
              type: "UPDATE_DHCP_SCOPE",
              id: scopeId,
              patch: { name: name.trim(), description: description.trim(), startIp: startIp.trim(), endIp: endIp.trim(), leaseDays, leaseHours },
            });
            toast.success("Scope properties saved");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Scope name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <FormRow label="Start IP">
        <input type="text" value={startIp} onChange={(e) => setStartIp(e.target.value)} />
      </FormRow>
      <FormRow label="End IP">
        <input type="text" value={endIp} onChange={(e) => setEndIp(e.target.value)} />
      </FormRow>
      <FormRow label="Lease (days)">
        <input type="number" value={leaseDays} onChange={(e) => setLeaseDays(Number(e.target.value))} />
      </FormRow>
      <FormRow label="Lease (hours)">
        <input type="number" value={leaseHours} onChange={(e) => setLeaseHours(Number(e.target.value))} />
      </FormRow>
    </WsDialogComponent>
  );
}

function ScopeStatsDialog({ scopeId, state, onClose }: { scopeId: string; state: WinServerState; onClose: () => void }) {
  const scope = state.dhcp.scopes.find((s) => s.id === scopeId);
  if (!scope) return null;
  const total = ipRangeSize(scope.startIp, scope.endIp);
  const leaseCount = state.dhcp.leases.filter((l) => l.scopeId === scopeId).length;
  const resCount = state.dhcp.reservations.filter((r) => r.scopeId === scopeId).length;
  const pct = total > 0 ? Math.round(((leaseCount + resCount) / total) * 100) : 0;

  return (
    <WsDialogComponent title={`Statistics - ${scope.name}`} onClose={onClose} buttons={[{ label: "Close", primary: true }]}>
      <table className={styles.dashTable}>
        <tbody>
          <tr>
            <th style={{ width: "55%" }}>Start address</th>
            <td>{scope.startIp}</td>
          </tr>
          <tr>
            <th>End address</th>
            <td>{scope.endIp}</td>
          </tr>
          <tr>
            <th>Total addresses</th>
            <td>{total}</td>
          </tr>
          <tr>
            <th>In use</th>
            <td>{leaseCount}</td>
          </tr>
          <tr>
            <th>Reserved</th>
            <td>{resCount}</td>
          </tr>
          <tr>
            <th>Available</th>
            <td>{total - leaseCount - resCount}</td>
          </tr>
          <tr>
            <th>% in use</th>
            <td>{pct}%</td>
          </tr>
        </tbody>
      </table>
    </WsDialogComponent>
  );
}

function AddFilterDialog({ list, onClose, onAdd }: { list: "allow" | "deny"; onClose: () => void; onAdd: (list: "allow" | "deny", mac: string, description: string) => void }) {
  const [mac, setMac] = useState("");
  const [description, setDescription] = useState("");

  return (
    <WsDialogComponent
      title={`Add MAC Filter (${list === "allow" ? "Allow" : "Deny"})`}
      onClose={onClose}
      buttons={[
        {
          label: "Add",
          primary: true,
          onClick: () => {
            if (!mac.trim()) {
              alert("MAC address is required.");
              return false;
            }
            onAdd(list, mac.trim(), description.trim());
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="MAC address">
        <input type="text" value={mac} placeholder="00-AA-BB-CC-DD-EE" onChange={(e) => setMac(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
    </WsDialogComponent>
  );
}

// ===== New Scope Wizard =====

type WizStepKey = "welcome" | "name" | "range" | "exclusions" | "lease" | "configure-now" | "router" | "dns" | "wins" | "activate" | "summary";

const WIZ_STEP_LABELS: Record<WizStepKey, string> = {
  welcome: "Welcome",
  name: "Scope Name",
  range: "IP Address Range",
  exclusions: "Add Exclusions",
  lease: "Lease Duration",
  "configure-now": "Configure DHCP Options",
  router: "Router",
  dns: "Domain Name and DNS Servers",
  wins: "WINS Servers",
  activate: "Activate Scope",
  summary: "Summary",
};

function NewScopeWizard({
  state,
  dispatch,
  onClose,
  onCreated,
}: {
  state: WinServerState;
  dispatch: (a: WinServerAction) => void;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("New Scope");
  const [description, setDescription] = useState("");
  const [startIp, setStartIp] = useState("10.40.0.50");
  const [endIp, setEndIp] = useState("10.40.0.200");
  const [mask, setMask] = useState("255.255.255.0");
  const [cidr, setCidr] = useState(24);
  const [exclusions, setExclusions] = useState<{ start: string; end: string }[]>([]);
  const [excStart, setExcStart] = useState("");
  const [excEnd, setExcEnd] = useState("");
  const [leaseDays, setLeaseDays] = useState(8);
  const [leaseHours, setLeaseHours] = useState(0);
  const [leaseMinutes, setLeaseMinutes] = useState(0);
  const [configureNow, setConfigureNow] = useState<"yes" | "no">("yes");
  const [router, setRouter] = useState("10.40.0.1");
  const [dnsDomain, setDnsDomain] = useState("corp.cloudlab.local");
  const [dnsServers, setDnsServers] = useState("10.10.0.5, 10.10.0.6");
  const [winsServers, setWinsServers] = useState("");
  const [activate, setActivate] = useState<"yes" | "no">("yes");

  // Conditional branch: the Router/DNS/WINS steps only appear when the admin
  // opts to configure DHCP options now. Steps are filtered dynamically off
  // the current radio choice, not hardcoded as a fixed linear list.
  const steps: WizStepKey[] =
    configureNow === "yes"
      ? ["welcome", "name", "range", "exclusions", "lease", "configure-now", "router", "dns", "wins", "activate", "summary"]
      : ["welcome", "name", "range", "exclusions", "lease", "configure-now", "activate", "summary"];
  const step = steps[stepIndex];
  const subnet = startIp.replace(/\.\d+$/, ".0");

  function goNext(): boolean {
    if (step === "name" && !name.trim()) {
      alert("Scope name is required.");
      return false;
    }
    if (step === "range" && (!startIp.trim() || !endIp.trim())) {
      alert("Start and end IP address are required.");
      return false;
    }
    if (stepIndex === steps.length - 1) {
      const options: Record<string, string> = {};
      if (configureNow === "yes") {
        if (router.trim()) options["003 Router"] = router.trim();
        if (dnsServers.trim()) options["006 DNS Servers"] = dnsServers.trim();
        if (dnsDomain.trim()) options["015 DNS Domain Name"] = dnsDomain.trim();
        if (winsServers.trim()) options["044 WINS/NBNS Servers"] = winsServers.trim();
      }
      const scope: WsDhcpScope = {
        id: `sc-${Date.now()}`,
        name: name.trim(),
        subnet,
        mask: mask.trim(),
        cidr,
        startIp: startIp.trim(),
        endIp: endIp.trim(),
        exclusions,
        leaseDays,
        leaseHours,
        leaseMinutes,
        active: activate === "yes",
        description: description.trim(),
        options,
      };
      dispatch({ type: "ADD_DHCP_SCOPE", scope });
      toast.success("Scope created");
      onCreated(scope.id);
      return true;
    }
    setStepIndex((i) => i + 1);
    return false;
  }

  function goBack(): boolean {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    return false;
  }

  return (
    <WsDialogComponent
      title="New Scope Wizard"
      width="640px"
      onClose={onClose}
      buttons={[
        { label: "< Back", onClick: goBack },
        { label: stepIndex === steps.length - 1 ? "Finish" : "Next >", primary: true, onClick: goNext },
        { label: "Cancel" },
      ]}
    >
      <div className={styles.wizSteps}>
        {steps.map((s, i) => (
          <span key={s} className={i === stepIndex ? styles.wizStepActive : i < stepIndex ? styles.wizStepDone : styles.wizStep}>
            {WIZ_STEP_LABELS[s]}
          </span>
        ))}
      </div>

      {step === "welcome" ? (
        <div style={{ padding: 4 }}>
          <h3>Welcome to the New Scope Wizard</h3>
          <p>This wizard helps you set up a scope for distributing IP addresses to clients on your network. To continue, click Next.</p>
        </div>
      ) : null}

      {step === "name" ? (
        <>
          <FormRow label="Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Description">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {step === "range" ? (
        <>
          <FormRow label="Start IP address">
            <input type="text" value={startIp} onChange={(e) => setStartIp(e.target.value)} />
          </FormRow>
          <FormRow label="End IP address">
            <input type="text" value={endIp} onChange={(e) => setEndIp(e.target.value)} />
          </FormRow>
          <FormRow label="Length (CIDR)">
            <input type="number" min={8} max={30} value={cidr} onChange={(e) => setCidr(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Subnet mask">
            <input type="text" value={mask} onChange={(e) => setMask(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {step === "exclusions" ? (
        <>
          <p style={{ marginBottom: 6 }}>Exclusions are ranges of addresses within the scope that the server should not offer. Adding an exclusion is optional.</p>
          <FormRow label="Start IP">
            <input type="text" value={excStart} onChange={(e) => setExcStart(e.target.value)} />
          </FormRow>
          <FormRow label="End IP">
            <input type="text" value={excEnd} onChange={(e) => setExcEnd(e.target.value)} />
          </FormRow>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              if (!excStart.trim() || !excEnd.trim()) return;
              setExclusions((cur) => [...cur, { start: excStart.trim(), end: excEnd.trim() }]);
              setExcStart("");
              setExcEnd("");
            }}
          >
            Add
          </button>
          <div style={{ padding: 8, background: "#fafafa", border: "1px solid #d4d4d4", marginTop: 8 }}>
            Current exclusions: {exclusions.length ? exclusions.map((x) => `${x.start}-${x.end}`).join(", ") : "(none)"}
          </div>
        </>
      ) : null}

      {step === "lease" ? (
        <>
          <FormRow label="Days">
            <input type="number" value={leaseDays} onChange={(e) => setLeaseDays(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Hours">
            <input type="number" value={leaseHours} onChange={(e) => setLeaseHours(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Minutes">
            <input type="number" value={leaseMinutes} onChange={(e) => setLeaseMinutes(Number(e.target.value))} />
          </FormRow>
        </>
      ) : null}

      {step === "configure-now" ? (
        <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <label>
            <input type="radio" checked={configureNow === "yes"} onChange={() => setConfigureNow("yes")} /> Yes, I want to configure these options now
          </label>
          <label>
            <input type="radio" checked={configureNow === "no"} onChange={() => setConfigureNow("no")} /> No, I will configure these options later
          </label>
        </div>
      ) : null}

      {step === "router" ? (
        <FormRow label="IP address">
          <input type="text" value={router} onChange={(e) => setRouter(e.target.value)} />
        </FormRow>
      ) : null}

      {step === "dns" ? (
        <>
          <FormRow label="Parent domain">
            <input type="text" value={dnsDomain} onChange={(e) => setDnsDomain(e.target.value)} />
          </FormRow>
          <FormRow label="DNS server IPs">
            <input type="text" value={dnsServers} onChange={(e) => setDnsServers(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {step === "wins" ? (
        <FormRow label="WINS server IPs">
          <input type="text" value={winsServers} onChange={(e) => setWinsServers(e.target.value)} />
        </FormRow>
      ) : null}

      {step === "activate" ? (
        <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <label>
            <input type="radio" checked={activate === "yes"} onChange={() => setActivate("yes")} /> Yes, I want to activate this scope now
          </label>
          <label>
            <input type="radio" checked={activate === "no"} onChange={() => setActivate("no")} /> No, I will activate this scope later
          </label>
        </div>
      ) : null}

      {step === "summary" ? (
        <div className={styles.formSection}>
          <div>
            <b>Name:</b> {name}
          </div>
          <div>
            <b>Range:</b> {startIp} - {endIp}
          </div>
          <div>
            <b>Subnet mask:</b> {mask}
          </div>
          <div>
            <b>Lease:</b> {leaseDays}d {leaseHours}h {leaseMinutes}m
          </div>
          {configureNow === "yes" ? (
            <>
              <div>
                <b>Router:</b> {router || "(none)"}
              </div>
              <div>
                <b>DNS:</b> {dnsServers || "(none)"}
              </div>
              <div>
                <b>WINS:</b> {winsServers || "(none)"}
              </div>
            </>
          ) : (
            <div>DHCP options will be configured later.</div>
          )}
          <div>
            <b>Activate:</b> {activate === "yes" ? "Yes" : "No"}
          </div>
          <HelpText>Click Finish to create the scope on {state.dhcp.serverFqdn}.</HelpText>
        </div>
      ) : null}
    </WsDialogComponent>
  );
}
