"use client";

// Network nav-group pages for the FortiGate WebUI simulator. Ported from
// itbd-lab/simulators/network/js/fortigate-ui.js:
//   - PAGES['interfaces'] / renderInterfacesPage + ifaceModal (lines 657-802)
//     -> InterfacesPage (list + Flyout edit form)
//   - PAGES['zones'] (lines 805-817) -> ZonesPage
//   - PAGES['static-routes'] + routeModal (lines 820-889) -> StaticRoutesPage
//   - Policy Routes: only a NAV stub (`{ id: 'policy-routes', label: 'Policy
//     Routes' }`, fortigate-ui.js:37) — source never wired a
//     `PAGES['policy-routes']` renderer at all, and reducer.ts defines no
//     policy-route mutation actions (seeded data has a real single-row
//     `policyRoutes` array with no unique key, matching source's
//     fortigate-data.js:72-74). PolicyRoutesPage is therefore a genuine
//     read-only table over real state — no action is invented for it.
//   - DHCP Server: source has no dedicated `PAGES['dhcp']` page — DHCP
//     server config lives inside the per-interface `ifaceModal` "DHCP
//     Server" fieldset (lines 744-752). DhcpPage is a structural addition
//     (this port's `FortiPage` union carries a standalone "dhcp" page,
//     fortigate-shell.tsx:63) that surfaces the same `dhcpServer`/`dhcpRange`
//     fields already on `FortiInterface`, filtered to interfaces where a
//     DHCP server is relevant — it does not duplicate the full Interfaces
//     table, only the DHCP-relevant slice.
//
// Source's Zones page (PAGES['zones']) rendered a bare `toolbar('Create
// New', null)` — a decorative "+ Create New" button wired to nothing
// (`onclick` omitted per `toolbar()`'s own null-handling, fortigate-ui.js:
// 1734-1739) and no delete/edit affordance anywhere. This port makes the
// Zones page fully interactive instead of preserving that gap, because
// reducer.ts DOES define real `ADD_ZONE`/`UPDATE_ZONE`/`DELETE_ZONE`
// actions (a deliberate capability beyond source, not present for e.g.
// policy routes) — matching the judgment already applied elsewhere in this
// suite (e.g. Cisco's BgpPage) that a real reducer action with no source
// wiring is a gap in source's own UI, not an intentional read-only design.

import { useState } from "react";
import { toast } from "sonner";

import type { FortiAction } from "@/lib/labs/simulators/network-fortigate/reducer";
import type { FortiGateState, FortiInterface, FortiStaticRoute, FortiZone } from "@/lib/labs/simulators/network-fortigate/types";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Flyout,
  Led,
  Modal,
  NativeSelect,
  StatusPill,
  statusTone,
  Toggle,
} from "./fortigate-ui";
import styles from "./fortigate-console.module.css";

type FortiPageProps = { state: FortiGateState; dispatch: React.Dispatch<FortiAction> };

// Administrative-access service chips — source's `accessOpts` list
// (fortigate-ui.js:712).
const ACCESS_OPTIONS = ["HTTPS", "HTTP", "PING", "SSH", "SNMP", "FMG-Access", "FTM", "RADIUS-Accounting", "FortiTelemetry", "SPEEDTEST"];

// ===================================================================
// 1. Interfaces — source PAGES['interfaces']/renderInterfacesPage + ifaceModal
// ===================================================================

type InterfaceEditDraft = {
  alias: string;
  addrMode: FortiInterface["addrMode"];
  ip: string;
  gw: string;
  mtu: number;
  access: string[];
  comments: string;
};

function draftFromInterface(iface: FortiInterface): InterfaceEditDraft {
  return {
    alias: iface.alias,
    addrMode: iface.addrMode,
    ip: iface.ip,
    gw: iface.gw,
    mtu: iface.mtu,
    access: iface.access,
    comments: iface.comments,
  };
}

function InterfaceEditFlyout({
  iface,
  onClose,
  dispatch,
}: {
  iface: FortiInterface;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<InterfaceEditDraft>(draftFromInterface(iface));

  function toggleAccess(service: string, checked: boolean) {
    setDraft((prev) => ({
      ...prev,
      access: checked ? [...prev.access, service] : prev.access.filter((a) => a !== service),
    }));
  }

  function handleSubmit() {
    dispatch({
      type: "UPDATE_INTERFACE",
      name: iface.name,
      patch: {
        alias: draft.alias.trim(),
        addrMode: draft.addrMode,
        ip: draft.ip.trim(),
        gw: draft.gw.trim(),
        mtu: draft.mtu || 1500,
        access: draft.access,
        comments: draft.comments.trim(),
      },
    });
    toast.success(`Interface ${iface.name} updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Interface — ${iface.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            OK
          </button>
        </>
      }
    >
      <fieldset className={styles.fieldset}>
        <legend>Interface</legend>
        <div className={styles.form}>
          <Field label="Alias">
            <input className={styles.input} value={draft.alias} onChange={(e) => setDraft((prev) => ({ ...prev, alias: e.target.value }))} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Address</legend>
        <div className={styles.form}>
          <Field label="Addressing mode" required>
            <NativeSelect
              value={draft.addrMode}
              onChange={(v) => setDraft((prev) => ({ ...prev, addrMode: v as FortiInterface["addrMode"] }))}
              options={[
                { value: "Manual", label: "Manual" },
                { value: "DHCP", label: "DHCP" },
              ]}
            />
          </Field>
          <Field label="IP/Netmask" help="e.g. 10.1.0.1/24">
            <input className={styles.input} value={draft.ip} onChange={(e) => setDraft((prev) => ({ ...prev, ip: e.target.value }))} placeholder="10.1.0.1/24" />
          </Field>
          <Field label="Gateway">
            <input className={styles.input} value={draft.gw} onChange={(e) => setDraft((prev) => ({ ...prev, gw: e.target.value }))} placeholder="203.0.113.1" />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Administrative Access (IPv4)</legend>
        <div className={styles.chipGroup}>
          {ACCESS_OPTIONS.map((a) => {
            const on = draft.access.includes(a);
            return (
              <span
                key={a}
                className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                onClick={() => toggleAccess(a, !on)}
              >
                {a}
              </span>
            );
          })}
        </div>
        <div className={styles.hint}>Click to toggle. Required services for managing the firewall on this interface.</div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Miscellaneous</legend>
        <div className={styles.form}>
          <Field label="MTU">
            <input
              className={styles.input}
              type="number"
              value={draft.mtu}
              onChange={(e) => setDraft((prev) => ({ ...prev, mtu: parseInt(e.target.value, 10) || 1500 }))}
            />
          </Field>
          <Field label="Comments">
            <textarea className={styles.textarea} value={draft.comments} onChange={(e) => setDraft((prev) => ({ ...prev, comments: e.target.value }))} />
          </Field>
        </div>
      </fieldset>
    </Flyout>
  );
}

export function InterfacesPage({ state, dispatch }: FortiPageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedIface = selected ? state.interfaces.find((i) => i.name === selected) ?? null : null;

  const columns: DataTableColumn<FortiInterface>[] = [
    {
      key: "name",
      header: "Name",
      render: (i) => (
        <>
          <b>{i.name}</b>
          {i.alias ? <span className={styles.small}> ({i.alias})</span> : null}
        </>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (i) => (
        <>
          {i.type}
          {i.vlanId ? ` (VLAN ${i.vlanId})` : ""}
        </>
      ),
    },
    { key: "role", header: "Role", render: (i) => i.role.toUpperCase() },
    {
      key: "addr",
      header: "Addressing",
      render: (i) => (
        <div>
          <span className={styles.mono}>{i.ip || "-"}</span>
          <div className={styles.small}>
            {i.addrMode}
            {i.gw ? ` via ${i.gw}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "admin",
      header: "Admin",
      render: (i) => (
        <>
          <Led tone={i.admin === "up" ? "up" : "down"} />
          <StatusPill tone={statusTone(i.admin)}>{i.admin}</StatusPill>
        </>
      ),
    },
    {
      key: "link",
      header: "Link",
      render: (i) => (
        <>
          <Led tone={i.link === "up" ? "up" : "down"} />
          <StatusPill tone={statusTone(i.link)}>{i.link}</StatusPill>
        </>
      ),
    },
    { key: "speed", header: "Speed", render: (i) => i.speed },
    {
      key: "access",
      header: "Access",
      render: (i) => (i.access.length > 0 ? i.access.join(", ") : <span className={styles.small}>none</span>),
    },
  ];

  return (
    <div>
      <h2>Network &mdash; Interfaces</h2>

      <DataTable
        columns={columns}
        rows={state.interfaces}
        getRowKey={(i) => i.name}
        onRowClick={(i) => setSelected(i.name)}
        emptyMessage="No interfaces configured."
      />

      {selectedIface ? <InterfaceEditFlyout iface={selectedIface} onClose={() => setSelected(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 2. Zones — source PAGES['zones'] (read-only in source; add/edit/delete
// added here since reducer.ts defines real ADD_ZONE/UPDATE_ZONE/DELETE_ZONE
// actions — see file header)
// ===================================================================

function emptyZoneDraft(): FortiZone {
  return { name: "", interfaces: "", intrazone: "block" };
}

function ZoneForm({ draft, onChange, lockName }: { draft: FortiZone; onChange: (patch: Partial<FortiZone>) => void; lockName?: boolean }) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} disabled={lockName} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Interface members" help="Comma-separated, e.g. port2, VLAN10">
        <input className={styles.input} value={draft.interfaces} onChange={(e) => onChange({ interfaces: e.target.value })} />
      </Field>
      <Field label="Intra-zone traffic">
        <NativeSelect
          value={draft.intrazone}
          onChange={(v) => onChange({ intrazone: v as FortiZone["intrazone"] })}
          options={[
            { value: "allow", label: "Allow" },
            { value: "block", label: "Block" },
          ]}
        />
      </Field>
    </div>
  );
}

function AddZoneModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiZone>(emptyZoneDraft());

  function handleSubmit() {
    if (!draft.name.trim()) {
      toast.error("Zone name is required");
      return;
    }
    dispatch({ type: "ADD_ZONE", zone: { ...draft, name: draft.name.trim() } });
    toast.success(`Zone ${draft.name} created`);
    onClose();
  }

  return (
    <Modal
      title="New Zone"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            OK
          </button>
        </>
      }
    >
      <ZoneForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditZoneModal({ zone, onClose, dispatch }: { zone: FortiZone; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiZone>(zone);

  function handleSubmit() {
    dispatch({ type: "UPDATE_ZONE", name: zone.name, patch: { interfaces: draft.interfaces, intrazone: draft.intrazone } });
    toast.success(`Zone ${zone.name} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit Zone — ${zone.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            OK
          </button>
        </>
      }
    >
      <ZoneForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} lockName />
    </Modal>
  );
}

function DeleteZoneModal({ zone, onClose, dispatch }: { zone: FortiZone; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  function handleConfirm() {
    dispatch({ type: "DELETE_ZONE", name: zone.name });
    toast.success(`Zone ${zone.name} deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete Zone"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Delete
          </button>
        </>
      }
    >
      <p>
        Delete the zone <b>{zone.name}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

export function ZonesPage({ state, dispatch }: FortiPageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editZone, setEditZone] = useState<FortiZone | null>(null);
  const [deleteZone, setDeleteZone] = useState<FortiZone | null>(null);

  const columns: DataTableColumn<FortiZone>[] = [
    { key: "name", header: "Name", render: (z) => <b>{z.name}</b> },
    { key: "interfaces", header: "Interface Members", render: (z) => z.interfaces || "-" },
    { key: "intrazone", header: "Intra-Zone Traffic", render: (z) => <StatusPill tone={statusTone(z.intrazone)}>{z.intrazone}</StatusPill> },
    {
      key: "actions",
      header: "",
      render: (z) => (
        <div className={styles.flex} style={{ gap: 4 }}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={(e) => {
              e.stopPropagation();
              setEditZone(z);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteZone(z);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Zones</h2>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowAdd(true)}>
          + Add zone
        </button>
      </div>

      <DataTable columns={columns} rows={state.zones} getRowKey={(z) => z.name} emptyMessage="No zones configured." />

      {showAdd ? <AddZoneModal onClose={() => setShowAdd(false)} dispatch={dispatch} /> : null}
      {editZone ? <EditZoneModal zone={editZone} onClose={() => setEditZone(null)} dispatch={dispatch} /> : null}
      {deleteZone ? <DeleteZoneModal zone={deleteZone} onClose={() => setDeleteZone(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 3. Static Routes — source PAGES['static-routes'] + routeModal
// ===================================================================

function emptyStaticRouteDraft(firstDevice: string): FortiStaticRoute {
  return { dst: "", gw: "", device: firstDevice, distance: 10, priority: 0, status: "enable", comments: "" };
}

function StaticRouteForm({
  draft,
  onChange,
  ifaceOptions,
}: {
  draft: FortiStaticRoute;
  onChange: (patch: Partial<FortiStaticRoute>) => void;
  ifaceOptions: { value: string; label: string }[];
}) {
  return (
    <div className={styles.form}>
      <Field label="Destination" required help="e.g. 0.0.0.0/0">
        <input className={styles.input} value={draft.dst} onChange={(e) => onChange({ dst: e.target.value })} placeholder="0.0.0.0/0" />
      </Field>
      <Field label="Gateway IP" required>
        <input className={styles.input} value={draft.gw} onChange={(e) => onChange({ gw: e.target.value })} placeholder="203.0.113.1" />
      </Field>
      <Field label="Interface" required>
        <NativeSelect value={draft.device} onChange={(v) => onChange({ device: v })} options={ifaceOptions} />
      </Field>
      <Field label="Administrative distance">
        <input
          className={styles.input}
          type="number"
          value={draft.distance}
          onChange={(e) => onChange({ distance: parseInt(e.target.value, 10) || 10 })}
        />
      </Field>
      <Field label="Priority">
        <input
          className={styles.input}
          type="number"
          value={draft.priority}
          onChange={(e) => onChange({ priority: parseInt(e.target.value, 10) || 0 })}
        />
      </Field>
      <Field label="Comments">
        <input className={styles.input} value={draft.comments} onChange={(e) => onChange({ comments: e.target.value })} />
      </Field>
      <Field label="Status">
        <Toggle checked={draft.status === "enable"} onChange={(checked) => onChange({ status: checked ? "enable" : "disable" })} />
      </Field>
    </div>
  );
}

function AddStaticRouteModal({
  onClose,
  dispatch,
  ifaceOptions,
}: {
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
  ifaceOptions: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState<FortiStaticRoute>(emptyStaticRouteDraft(ifaceOptions[0]?.value ?? ""));

  function handleSubmit() {
    if (!draft.dst.trim() || !draft.gw.trim()) {
      toast.error("Destination and gateway are required");
      return;
    }
    dispatch({ type: "ADD_STATIC_ROUTE", route: { ...draft, dst: draft.dst.trim(), gw: draft.gw.trim() } });
    toast.success(`Route to ${draft.dst} created`);
    onClose();
  }

  return (
    <Modal
      title="New Static Route"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            OK
          </button>
        </>
      }
    >
      <StaticRouteForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} ifaceOptions={ifaceOptions} />
    </Modal>
  );
}

function EditStaticRouteModal({
  index,
  route,
  onClose,
  dispatch,
  ifaceOptions,
}: {
  index: number;
  route: FortiStaticRoute;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
  ifaceOptions: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState<FortiStaticRoute>(route);

  function handleSubmit() {
    if (!draft.dst.trim() || !draft.gw.trim()) {
      toast.error("Destination and gateway are required");
      return;
    }
    dispatch({ type: "UPDATE_STATIC_ROUTE", index, patch: { ...draft, dst: draft.dst.trim(), gw: draft.gw.trim() } });
    toast.success(`Route to ${draft.dst} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit Static Route — ${route.dst}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            OK
          </button>
        </>
      }
    >
      <StaticRouteForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} ifaceOptions={ifaceOptions} />
    </Modal>
  );
}

function DeleteStaticRouteModal({
  index,
  route,
  onClose,
  dispatch,
}: {
  index: number;
  route: FortiStaticRoute;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_STATIC_ROUTE", index });
    toast.success(`Route to ${route.dst} deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete Static Route"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Delete
          </button>
        </>
      }
    >
      <p>
        Delete the static route to <b>{route.dst}</b> via <b>{route.gw}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

export function StaticRoutesPage({ state, dispatch }: FortiPageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const ifaceOptions = state.interfaces.map((i) => ({ value: i.name, label: i.alias ? `${i.name} (${i.alias})` : i.name }));

  const columns: DataTableColumn<FortiStaticRoute & { index: number }>[] = [
    { key: "dst", header: "Destination", render: (r) => <span className={styles.mono}>{r.dst}</span> },
    { key: "gw", header: "Gateway", render: (r) => <span className={styles.mono}>{r.gw}</span> },
    { key: "device", header: "Device", render: (r) => r.device },
    { key: "distance", header: "Distance", render: (r) => r.distance },
    { key: "priority", header: "Priority", render: (r) => r.priority },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
    { key: "comments", header: "Comments", render: (r) => r.comments },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className={styles.flex} style={{ gap: 4 }}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={(e) => {
              e.stopPropagation();
              setEditIndex(r.index);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteIndex(r.index);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const rows = state.staticRoutes.map((r, index) => ({ ...r, index }));

  return (
    <div>
      <h2>Static Routes</h2>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowAdd(true)}>
          + Add route
        </button>
      </div>

      <DataTable columns={columns} rows={rows} getRowKey={(r) => `${r.index}-${r.dst}-${r.gw}`} emptyMessage="No static routes configured." />

      {showAdd ? <AddStaticRouteModal onClose={() => setShowAdd(false)} dispatch={dispatch} ifaceOptions={ifaceOptions} /> : null}
      {editIndex !== null && state.staticRoutes[editIndex] ? (
        <EditStaticRouteModal
          index={editIndex}
          route={state.staticRoutes[editIndex]}
          onClose={() => setEditIndex(null)}
          dispatch={dispatch}
          ifaceOptions={ifaceOptions}
        />
      ) : null}
      {deleteIndex !== null && state.staticRoutes[deleteIndex] ? (
        <DeleteStaticRouteModal index={deleteIndex} route={state.staticRoutes[deleteIndex]} onClose={() => setDeleteIndex(null)} dispatch={dispatch} />
      ) : null}
    </div>
  );
}

// ===================================================================
// 4. Policy Routes — no source renderer, no reducer action (see file
// header). Read-only view over real seeded `state.policyRoutes`.
// ===================================================================

export function PolicyRoutesPage({ state }: { state: FortiGateState }) {
  const columns: DataTableColumn<FortiGateState["policyRoutes"][number]>[] = [
    { key: "protocol", header: "Protocol", render: (r) => r.protocol },
    { key: "incoming", header: "Incoming Interface", render: (r) => r.incoming },
    { key: "src", header: "Source Address", render: (r) => <span className={styles.mono}>{r.src}</span> },
    { key: "dst", header: "Destination Address", render: (r) => <span className={styles.mono}>{r.dst}</span> },
    { key: "service", header: "Service", render: (r) => r.service },
    { key: "action", header: "Action", render: (r) => <StatusPill tone={statusTone(r.action)}>{r.action}</StatusPill> },
    { key: "gw", header: "Gateway", render: (r) => <span className={styles.mono}>{r.gw}</span> },
    { key: "outDevice", header: "Outgoing Interface", render: (r) => r.outDevice },
  ];

  return (
    <div>
      <h2>Policy Routes</h2>

      {state.policyRoutes.length === 0 ? (
        <EmptyState message="No policy routes configured." />
      ) : (
        <DataTable
          columns={columns}
          rows={state.policyRoutes}
          getRowKey={(r) => `${r.incoming}-${r.src}-${r.dst}-${r.service}`}
          emptyMessage="No policy routes configured."
        />
      )}
    </div>
  );
}

// ===================================================================
// 5. DHCP Servers — structural addition (see file header). Same
// state.interfaces data as InterfacesPage, filtered/focused to the DHCP
// server slice (dhcpServer/dhcpRange), not a duplicate of the full table.
// ===================================================================

function DhcpRangeCell({ iface, dispatch }: { iface: FortiInterface; dispatch: React.Dispatch<FortiAction> }) {
  const [value, setValue] = useState(iface.dhcpRange ?? "");
  const [dirty, setDirty] = useState(false);

  function commit() {
    if (!dirty) return;
    dispatch({ type: "UPDATE_INTERFACE", name: iface.name, patch: { dhcpRange: value.trim() } });
    toast.success(`DHCP range for ${iface.name} updated`);
    setDirty(false);
  }

  return (
    <input
      className={styles.input}
      value={value}
      disabled={!iface.dhcpServer}
      placeholder="10.1.0.100 - 10.1.0.200"
      onChange={(e) => {
        setValue(e.target.value);
        setDirty(true);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function DhcpPage({ state, dispatch }: FortiPageProps) {
  const dhcpInterfaces = state.interfaces.filter((i) => i.dhcpServer);

  const columns: DataTableColumn<FortiInterface>[] = [
    {
      key: "name",
      header: "Interface",
      render: (i) => (
        <>
          <b>{i.name}</b>
          {i.alias ? <span className={styles.small}> ({i.alias})</span> : null}
        </>
      ),
    },
    { key: "ip", header: "Interface IP", render: (i) => <span className={styles.mono}>{i.ip || "-"}</span> },
    {
      key: "dhcpServer",
      header: "DHCP Server",
      render: (i) => (
        <Toggle
          checked={i.dhcpServer}
          onChange={(checked) => {
            dispatch({ type: "UPDATE_INTERFACE", name: i.name, patch: { dhcpServer: checked } });
            toast.success(`DHCP server ${checked ? "enabled" : "disabled"} on ${i.name}`);
          }}
        />
      ),
    },
    { key: "dhcpRange", header: "Address Range", render: (i) => <DhcpRangeCell iface={i} dispatch={dispatch} /> },
  ];

  return (
    <div>
      <h2>Network &mdash; DHCP Servers</h2>
      <p className={styles.small}>DHCP server configuration for interfaces with DHCP serving enabled or available.</p>

      {dhcpInterfaces.length === 0 ? (
        <EmptyState message="No interfaces have a DHCP server enabled." />
      ) : (
        <DataTable columns={columns} rows={dhcpInterfaces} getRowKey={(i) => i.name} emptyMessage="No DHCP servers configured." />
      )}
    </div>
  );
}
