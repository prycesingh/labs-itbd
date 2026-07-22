"use client";

// Network nav-group pages for the Palo Alto PAN-OS WebUI simulator. Ported
// from itbd-lab/simulators/network/js/paloalto-ui.js:
//   - PAGES['net-iface'] + ifaceModal (lines 1987-2123) -> InterfacesPage
//     (list + Flyout edit form). Source's ifaceModal is a full multi-tab
//     create/edit dialog (Config/IPv4/IPv6/SD-WAN/Advanced/ARP/ND/NDP Proxy)
//     that both creates and edits; reducer.ts only defines `UPDATE_INTERFACE`
//     (no ADD/DELETE — seed data's fixed 7-interface roster is edited in
//     place, matching the Cisco/FortiGate suites' "no add/delete where the
//     reducer doesn't support it" convention), so this port narrows to an
//     edit-only Flyout over the fields the reducer + PaloInterface type
//     actually carry (zone, vr, mgmtProfile, comment, mtu) plus a read-only
//     header showing name/type/tag/ip/mac, which source's Config/Advanced
//     tabs both exposed.
//   - PAGES['net-zones'] + zoneModal (lines 2126-2189) -> ZonesPage (full
//     CRUD, matching source's real `U._zone` `makeCRUD` wiring).
//   - PAGES['net-vrouters'] + vrModal (lines 2192-2307) -> VirtualRoutersPage.
//     Source's vrModal is one big multi-tab dialog per virtual router
//     (General/Static Routes/RIP/OSPF/BGP/Multicast/Redistribution) that
//     saves everything as a single record; this port instead renders one
//     section per virtual router with independently-actionable static-route
//     CRUD (ADD_STATIC_ROUTE/UPDATE_STATIC_ROUTE/DELETE_STATIC_ROUTE, nested
//     by vrName per reducer.ts) and OSPF/BGP edit modals
//     (UPDATE_VR_OSPF/UPDATE_VR_BGP) — RIP/Multicast/Redistribution have no
//     reducer actions (seed data's `rip`/`multicast` are inert `{enabled:
//     false}` singletons with no source save handler wiring either beyond
//     the general vrModal save) and are shown read-only via the existing VR
//     summary line, matching source's list-page columns
//     (Static/OSPF/BGP/RIP/Multicast, line 2210).
//   - PAGES['net-vlans'] (lines 2434-2441) -> VlansPage. Source's page is
//     bare read-only (no `+ Add` handler wired, no `U._vlan` CRUD helper
//     exists at all — contrast `U._iface`/`U._zone`/`U._vr`/`U._tun` which
//     source DOES register, lines 2443-2447) and reducer.ts defines no
//     vlan-mutating action, so this stays a genuine read-only table over
//     real seeded `state.vlans` — no action is invented for it.

import { useState } from "react";
import { toast } from "sonner";

import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import type {
  PaloBgpConfig,
  PaloBgpPeer,
  PaloInterface,
  PaloOspfConfig,
  PaloState,
  PaloStaticRoute,
  PaloVirtualRouter,
  PaloVlan,
  PaloZone,
} from "@/lib/labs/simulators/network-paloalto/types";
import { DataTable, type DataTableColumn, Field, Flyout, Led, Modal, NativeSelect, StatusPill, statusTone, Toggle } from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type PaloPageProps = { state: PaloState; dispatch: React.Dispatch<PaloAction> };

// ===================================================================
// 1. Interfaces — source PAGES['net-iface'] / ifaceModal
// ===================================================================

type InterfaceEditDraft = {
  zone: string;
  vr: string;
  mgmtProfile: string;
  comment: string;
  mtu: number;
};

function draftFromInterface(iface: PaloInterface): InterfaceEditDraft {
  return {
    zone: iface.zone,
    vr: iface.vr,
    mgmtProfile: iface.mgmtProfile,
    comment: iface.comment,
    mtu: iface.mtu,
  };
}

function InterfaceEditFlyout({
  iface,
  zoneOptions,
  vrOptions,
  onClose,
  dispatch,
}: {
  iface: PaloInterface;
  zoneOptions: { value: string; label: string }[];
  vrOptions: { value: string; label: string }[];
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<InterfaceEditDraft>(draftFromInterface(iface));

  function handleSubmit() {
    dispatch({
      type: "UPDATE_INTERFACE",
      name: iface.name,
      patch: {
        zone: draft.zone,
        vr: draft.vr,
        mgmtProfile: draft.mgmtProfile.trim(),
        comment: draft.comment.trim(),
        mtu: draft.mtu || 1500,
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
        <legend>Config</legend>
        <div className={styles.form}>
          <Field label="Interface Name">
            <input className={styles.input} value={iface.name} disabled />
          </Field>
          <Field label="Interface Type">
            <input className={styles.input} value={iface.type + (iface.tag ? ` (VLAN ${iface.tag})` : "")} disabled />
          </Field>
          <Field label="IP Address">
            <input className={styles.input} value={iface.ip || "-"} disabled />
          </Field>
          <Field label="Virtual Router">
            <NativeSelect value={draft.vr} onChange={(v) => setDraft((prev) => ({ ...prev, vr: v }))} options={vrOptions} />
          </Field>
          <Field label="Security Zone">
            <NativeSelect value={draft.zone} onChange={(v) => setDraft((prev) => ({ ...prev, zone: v }))} options={zoneOptions} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Advanced</legend>
        <div className={styles.form}>
          <Field label="Management Profile">
            <input
              className={styles.input}
              value={draft.mgmtProfile}
              onChange={(e) => setDraft((prev) => ({ ...prev, mgmtProfile: e.target.value }))}
              placeholder="e.g. allow-ping"
            />
          </Field>
          <Field label="MTU">
            <input
              className={styles.input}
              type="number"
              value={draft.mtu}
              onChange={(e) => setDraft((prev) => ({ ...prev, mtu: parseInt(e.target.value, 10) || 1500 }))}
            />
          </Field>
          <Field label="Comment">
            <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
          </Field>
        </div>
      </fieldset>
    </Flyout>
  );
}

export function InterfacesPage({ state, dispatch }: PaloPageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedIface = selected ? state.interfaces.find((i) => i.name === selected) ?? null : null;

  const zoneOptions = [{ value: "", label: "None" }, ...state.zones.map((z) => ({ value: z.name, label: z.name }))];
  const vrOptions = state.virtualRouters.map((v) => ({ value: v.name, label: v.name }));

  const columns: DataTableColumn<PaloInterface>[] = [
    {
      key: "name",
      header: "Interface",
      render: (i) => <b>{i.name}</b>,
    },
    {
      key: "type",
      header: "Type",
      render: (i) => (i.tag ? `${i.type} (VLAN ${i.tag})` : i.type),
    },
    { key: "ip", header: "IP Address", render: (i) => <span className={styles.mono}>{i.ip || "-"}</span> },
    { key: "zone", header: "Zone", render: (i) => i.zone || "-" },
    { key: "vr", header: "Virtual Router", render: (i) => i.vr || "-" },
    {
      key: "link",
      header: "Link",
      render: (i) => (
        <>
          <Led tone={i.link.toLowerCase() === "up" ? "up" : "down"} />
          <StatusPill tone={statusTone(i.link)}>{i.link}</StatusPill>
        </>
      ),
    },
    { key: "speed", header: "Speed", render: (i) => i.speed },
    { key: "mtu", header: "MTU", render: (i) => i.mtu },
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

      {selectedIface ? (
        <InterfaceEditFlyout
          iface={selectedIface}
          zoneOptions={zoneOptions}
          vrOptions={vrOptions}
          onClose={() => setSelected(null)}
          dispatch={dispatch}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 2. Zones — source PAGES['net-zones'] / zoneModal (full CRUD, matching
// source's real `U._zone` makeCRUD wiring)
// ===================================================================

const ZONE_TYPES = ["Layer3", "Layer2", "Tap", "Virtual Wire", "External"];

function emptyZoneDraft(): PaloZone {
  return { name: "", type: "Layer3", interfaces: "", userIdent: false, pktBufferProt: false, comment: "" };
}

function ZoneForm({ draft, onChange, lockName }: { draft: PaloZone; onChange: (patch: Partial<PaloZone>) => void; lockName?: boolean }) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} disabled={lockName} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Type">
        <NativeSelect value={draft.type} onChange={(v) => onChange({ type: v })} options={ZONE_TYPES.map((t) => ({ value: t, label: t }))} />
      </Field>
      <Field label="Interfaces" help="Comma-separated, e.g. ethernet1/1, tunnel.1">
        <input className={styles.input} value={draft.interfaces} onChange={(e) => onChange({ interfaces: e.target.value })} />
      </Field>
      <Field label="Enable User Identification">
        <Toggle checked={draft.userIdent} onChange={(checked) => onChange({ userIdent: checked })} />
      </Field>
      <Field label="Enable Packet Buffer Protection">
        <Toggle checked={draft.pktBufferProt} onChange={(checked) => onChange({ pktBufferProt: checked })} />
      </Field>
      <Field label="Comment">
        <input className={styles.input} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} />
      </Field>
    </div>
  );
}

function AddZoneModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloZone>(emptyZoneDraft());

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

function EditZoneModal({ zone, onClose, dispatch }: { zone: PaloZone; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloZone>(zone);

  function handleSubmit() {
    dispatch({
      type: "UPDATE_ZONE",
      name: zone.name,
      patch: {
        type: draft.type,
        interfaces: draft.interfaces,
        userIdent: draft.userIdent,
        pktBufferProt: draft.pktBufferProt,
        comment: draft.comment,
      },
    });
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

function DeleteZoneModal({ zone, onClose, dispatch }: { zone: PaloZone; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
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

export function ZonesPage({ state, dispatch }: PaloPageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editZone, setEditZone] = useState<PaloZone | null>(null);
  const [deleteZone, setDeleteZone] = useState<PaloZone | null>(null);

  const columns: DataTableColumn<PaloZone>[] = [
    { key: "name", header: "Name", render: (z) => <b>{z.name}</b> },
    { key: "type", header: "Type", render: (z) => z.type },
    { key: "interfaces", header: "Interfaces", render: (z) => z.interfaces || "-" },
    { key: "userIdent", header: "User-ID", render: (z) => (z.userIdent ? "Yes" : "No") },
    { key: "pktBufferProt", header: "Pkt Buffer Prot", render: (z) => (z.pktBufferProt ? "Yes" : "No") },
    { key: "comment", header: "Comment", render: (z) => z.comment },
    {
      key: "actions",
      header: "",
      render: (z) => (
        <div className={styles.rowActions}>
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
      <h2>Network &mdash; Zones</h2>

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
// 3. Virtual Routers — source PAGES['net-vrouters'] / vrModal. One section
// per virtual router: summary + static-route CRUD (nested by vrName) + OSPF
// config + BGP config (with peers table). RIP/Multicast/Redistribution have
// no reducer actions (see file header) — shown read-only via the summary.
// ===================================================================

function emptyStaticRouteDraft(firstIface: string): PaloStaticRoute {
  return { name: "", dst: "", nextHop: "", iface: firstIface, metric: 10, admin: 10 };
}

function StaticRouteForm({
  draft,
  onChange,
  ifaceOptions,
  lockName,
}: {
  draft: PaloStaticRoute;
  onChange: (patch: Partial<PaloStaticRoute>) => void;
  ifaceOptions: { value: string; label: string }[];
  lockName?: boolean;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} disabled={lockName} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Destination" required help="e.g. 0.0.0.0/0">
        <input className={styles.input} value={draft.dst} onChange={(e) => onChange({ dst: e.target.value })} placeholder="0.0.0.0/0" />
      </Field>
      <Field label="Next Hop" required>
        <input className={styles.input} value={draft.nextHop} onChange={(e) => onChange({ nextHop: e.target.value })} placeholder="203.0.113.1" />
      </Field>
      <Field label="Interface">
        <NativeSelect value={draft.iface} onChange={(v) => onChange({ iface: v })} options={ifaceOptions} />
      </Field>
      <Field label="Metric">
        <input className={styles.input} type="number" value={draft.metric} onChange={(e) => onChange({ metric: parseInt(e.target.value, 10) || 10 })} />
      </Field>
      <Field label="Admin Distance">
        <input className={styles.input} type="number" value={draft.admin} onChange={(e) => onChange({ admin: parseInt(e.target.value, 10) || 10 })} />
      </Field>
    </div>
  );
}

function AddStaticRouteModal({
  vrName,
  onClose,
  dispatch,
  ifaceOptions,
}: {
  vrName: string;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
  ifaceOptions: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState<PaloStaticRoute>(emptyStaticRouteDraft(ifaceOptions[0]?.value ?? ""));

  function handleSubmit() {
    if (!draft.name.trim() || !draft.dst.trim() || !draft.nextHop.trim()) {
      toast.error("Name, destination, and next hop are required");
      return;
    }
    dispatch({
      type: "ADD_STATIC_ROUTE",
      vrName,
      route: { ...draft, name: draft.name.trim(), dst: draft.dst.trim(), nextHop: draft.nextHop.trim() },
    });
    toast.success(`Static route ${draft.name} created`);
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
  vrName,
  route,
  onClose,
  dispatch,
  ifaceOptions,
}: {
  vrName: string;
  route: PaloStaticRoute;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
  ifaceOptions: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState<PaloStaticRoute>(route);

  function handleSubmit() {
    if (!draft.dst.trim() || !draft.nextHop.trim()) {
      toast.error("Destination and next hop are required");
      return;
    }
    dispatch({
      type: "UPDATE_STATIC_ROUTE",
      vrName,
      routeName: route.name,
      patch: { dst: draft.dst.trim(), nextHop: draft.nextHop.trim(), iface: draft.iface, metric: draft.metric, admin: draft.admin },
    });
    toast.success(`Static route ${route.name} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit Static Route — ${route.name}`}
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
      <StaticRouteForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} ifaceOptions={ifaceOptions} lockName />
    </Modal>
  );
}

function DeleteStaticRouteModal({
  vrName,
  route,
  onClose,
  dispatch,
}: {
  vrName: string;
  route: PaloStaticRoute;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_STATIC_ROUTE", vrName, routeName: route.name });
    toast.success(`Static route ${route.name} deleted`);
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
        Delete the static route <b>{route.name}</b> ({route.dst})? This cannot be undone.
      </p>
    </Modal>
  );
}

function StaticRoutesSection({
  vr,
  ifaceOptions,
  dispatch,
}: {
  vr: PaloVirtualRouter;
  ifaceOptions: { value: string; label: string }[];
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editRoute, setEditRoute] = useState<PaloStaticRoute | null>(null);
  const [deleteRoute, setDeleteRoute] = useState<PaloStaticRoute | null>(null);

  const columns: DataTableColumn<PaloStaticRoute>[] = [
    { key: "name", header: "Name", render: (r) => <b>{r.name}</b> },
    { key: "dst", header: "Destination", render: (r) => <span className={styles.mono}>{r.dst}</span> },
    { key: "nextHop", header: "Next Hop", render: (r) => <span className={styles.mono}>{r.nextHop}</span> },
    { key: "iface", header: "Interface", render: (r) => r.iface },
    { key: "metric", header: "Metric", render: (r) => r.metric },
    { key: "admin", header: "Admin Dist", render: (r) => r.admin },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={(e) => {
              e.stopPropagation();
              setEditRoute(r);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteRoute(r);
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
      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowAdd(true)}>
          + Add static route
        </button>
      </div>

      <DataTable columns={columns} rows={vr.staticRoutes} getRowKey={(r) => r.name} emptyMessage="No static routes." dense />

      {showAdd ? <AddStaticRouteModal vrName={vr.name} onClose={() => setShowAdd(false)} dispatch={dispatch} ifaceOptions={ifaceOptions} /> : null}
      {editRoute ? (
        <EditStaticRouteModal vrName={vr.name} route={editRoute} onClose={() => setEditRoute(null)} dispatch={dispatch} ifaceOptions={ifaceOptions} />
      ) : null}
      {deleteRoute ? <DeleteStaticRouteModal vrName={vr.name} route={deleteRoute} onClose={() => setDeleteRoute(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

function EditOspfModal({
  vrName,
  ospf,
  onClose,
  dispatch,
}: {
  vrName: string;
  ospf: PaloOspfConfig;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloOspfConfig>(ospf);

  function handleSubmit() {
    dispatch({
      type: "UPDATE_VR_OSPF",
      vrName,
      patch: { enabled: draft.enabled, routerId: draft.routerId.trim(), area: draft.area.trim() || "0.0.0.0", interfaces: draft.interfaces },
    });
    toast.success(`OSPF configuration for ${vrName} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit OSPF — ${vrName}`}
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
      <div className={styles.form}>
        <Field label="Enable OSPF">
          <Toggle checked={draft.enabled} onChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))} />
        </Field>
        <Field label="Router ID">
          <input className={styles.input} value={draft.routerId} onChange={(e) => setDraft((prev) => ({ ...prev, routerId: e.target.value }))} />
        </Field>
        <Field label="Area">
          <input className={styles.input} value={draft.area} onChange={(e) => setDraft((prev) => ({ ...prev, area: e.target.value }))} placeholder="0.0.0.0" />
        </Field>
        <Field label="Interfaces" help="Comma-separated interface names">
          <input
            className={styles.input}
            value={draft.interfaces.join(", ")}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                interfaces: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              }))
            }
          />
        </Field>
      </div>
    </Modal>
  );
}

function OspfSection({ vr, dispatch }: { vr: PaloVirtualRouter; dispatch: React.Dispatch<PaloAction> }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span>OSPF</span>
        <button type="button" className={styles.btnSm} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <div className={styles.widgetBody}>
        <dl className={styles.kv}>
          <dt>Status</dt>
          <dd>
            <StatusPill tone={statusTone(vr.ospf.enabled ? "enabled" : "disabled")}>{vr.ospf.enabled ? "enabled" : "disabled"}</StatusPill>
          </dd>
          <dt>Router ID</dt>
          <dd>{vr.ospf.routerId || "-"}</dd>
          <dt>Area</dt>
          <dd>{vr.ospf.area}</dd>
          <dt>Interfaces</dt>
          <dd>{vr.ospf.interfaces.length > 0 ? vr.ospf.interfaces.join(", ") : "-"}</dd>
        </dl>
      </div>
      {editing ? <EditOspfModal vrName={vr.name} ospf={vr.ospf} onClose={() => setEditing(false)} dispatch={dispatch} /> : null}
    </div>
  );
}

function EditBgpModal({
  vrName,
  bgp,
  onClose,
  dispatch,
}: {
  vrName: string;
  bgp: PaloBgpConfig;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [enabled, setEnabled] = useState(bgp.enabled);
  const [routerId, setRouterId] = useState(bgp.routerId);
  const [asn, setAsn] = useState(bgp.asn);

  function handleSubmit() {
    dispatch({
      type: "UPDATE_VR_BGP",
      vrName,
      patch: { enabled, routerId: routerId.trim(), asn: asn || 65000, peers: bgp.peers },
    });
    toast.success(`BGP configuration for ${vrName} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit BGP — ${vrName}`}
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
      <div className={styles.form}>
        <Field label="Enable BGP">
          <Toggle checked={enabled} onChange={setEnabled} />
        </Field>
        <Field label="Router ID">
          <input className={styles.input} value={routerId} onChange={(e) => setRouterId(e.target.value)} />
        </Field>
        <Field label="AS Number">
          <input className={styles.input} type="number" value={asn} onChange={(e) => setAsn(parseInt(e.target.value, 10) || 65000)} />
        </Field>
      </div>
    </Modal>
  );
}

function BgpSection({ vr, dispatch }: { vr: PaloVirtualRouter; dispatch: React.Dispatch<PaloAction> }) {
  const [editing, setEditing] = useState(false);

  const peerColumns: DataTableColumn<PaloBgpPeer>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "peerIp", header: "Peer IP", render: (p) => <span className={styles.mono}>{p.peerIp}</span> },
    { key: "remoteAs", header: "Remote AS", render: (p) => p.remoteAs },
    { key: "status", header: "Status", render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill> },
  ];

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span>BGP</span>
        <button type="button" className={styles.btnSm} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <div className={styles.widgetBody}>
        <dl className={styles.kv}>
          <dt>Status</dt>
          <dd>
            <StatusPill tone={statusTone(vr.bgp.enabled ? "enabled" : "disabled")}>{vr.bgp.enabled ? "enabled" : "disabled"}</StatusPill>
          </dd>
          <dt>Router ID</dt>
          <dd>{vr.bgp.routerId || "-"}</dd>
          <dt>AS Number</dt>
          <dd>{vr.bgp.asn}</dd>
        </dl>
        <h4>Peers</h4>
        <DataTable columns={peerColumns} rows={vr.bgp.peers} getRowKey={(p) => p.name} emptyMessage="No BGP peers." dense />
      </div>
      {editing ? <EditBgpModal vrName={vr.name} bgp={vr.bgp} onClose={() => setEditing(false)} dispatch={dispatch} /> : null}
    </div>
  );
}

function VirtualRouterSection({
  vr,
  ifaceOptions,
  dispatch,
}: {
  vr: PaloVirtualRouter;
  ifaceOptions: { value: string; label: string }[];
  dispatch: React.Dispatch<PaloAction>;
}) {
  return (
    <div className={styles.mt16}>
      <h3>{vr.name}</h3>
      <dl className={styles.kv}>
        <dt>Interfaces</dt>
        <dd>{vr.interfaces || "-"}</dd>
        <dt>RIP</dt>
        <dd>
          <StatusPill tone={statusTone(vr.rip.enabled ? "enabled" : "disabled")}>{vr.rip.enabled ? "enabled" : "disabled"}</StatusPill>
        </dd>
        <dt>Multicast</dt>
        <dd>
          <StatusPill tone={statusTone(vr.multicast.enabled ? "enabled" : "disabled")}>{vr.multicast.enabled ? "enabled" : "disabled"}</StatusPill>
        </dd>
      </dl>

      <h4>Static Routes</h4>
      <StaticRoutesSection vr={vr} ifaceOptions={ifaceOptions} dispatch={dispatch} />

      <div className={styles.grid2} style={{ marginTop: 12 }}>
        <OspfSection vr={vr} dispatch={dispatch} />
        <BgpSection vr={vr} dispatch={dispatch} />
      </div>
    </div>
  );
}

export function VirtualRoutersPage({ state, dispatch }: PaloPageProps) {
  const ifaceOptions = state.interfaces.map((i) => ({ value: i.name, label: i.name }));

  return (
    <div>
      <h2>Network &mdash; Virtual Routers</h2>

      {state.virtualRouters.length === 0 ? (
        <p className={styles.small}>No virtual routers configured.</p>
      ) : (
        state.virtualRouters.map((vr) => <VirtualRouterSection key={vr.name} vr={vr} ifaceOptions={ifaceOptions} dispatch={dispatch} />)
      )}
    </div>
  );
}

// ===================================================================
// 4. VLANs — source PAGES['net-vlans']. Bare read-only in source (no
// U._vlan CRUD helper registered, no reducer action defined — see file
// header). Genuine read-only view over real seeded state.vlans.
// ===================================================================

export function VlansPage({ state }: { state: PaloState }) {
  const columns: DataTableColumn<PaloVlan>[] = [
    { key: "name", header: "Name", render: (v) => <b>{v.name}</b> },
    { key: "interfaces", header: "Interfaces", render: (v) => v.interfaces || "-" },
    { key: "vifs", header: "Virtual Interfaces", render: (v) => v.vifs || "-" },
    { key: "comment", header: "Comment", render: (v) => v.comment },
  ];

  return (
    <div>
      <h2>Network &mdash; VLANs</h2>
      <DataTable columns={columns} rows={state.vlans} getRowKey={(v) => v.name} emptyMessage="No VLANs configured." />
    </div>
  );
}
