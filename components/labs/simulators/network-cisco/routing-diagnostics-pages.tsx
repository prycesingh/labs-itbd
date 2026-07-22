"use client";

// Routing + Diagnostics nav-group pages for the Cisco IOS WebUI simulator.
// Ported from itbd-lab/simulators/network/js/cisco-ui.js:
//   - P['rt-static']  (lines 646-665)  + CU._addStatic/_saveStatic/_delStatic
//     (lines ~2835-2863)               -> StaticRoutesPage
//   - P['rt-rip']     (lines 668-680)  + CU._saveRip (lines 2865-2876)
//                                       -> RipPage
//   - P['rt-eigrp']   (lines 683-704)  + CU._saveEigrp (lines 2877-2892)
//                                       -> EigrpPage
//   - P['rt-ospf']    (lines 707-729)  + CU._saveOspf (lines 2893-2905)
//                                       -> OspfPage
//   - P['rt-bgp']     (lines 732-752)  -> BgpPage
//   - P['t-ping']/CU._runPing/decidePingScenario (lines 1573-1591, 1751-1911)
//     P['t-trace']/CU._runTrace          (lines 1594-1606, 1916-1979)
//                                       -> PingTraceroutePage (THE FLAGSHIP PAGE)
//   - Troubleshoot > System > Diagnostic History (new — no source
//     equivalent; source never persisted ping/trace runs anywhere) + reducer's
//     real CLEAR_DIAG_HISTORY action -> DiagHistoryPage
//
// Source's ping/traceroute (CU._runPing/decidePingScenario/CU._runTrace/
// generateHops) is 100% `Math.random()`-bucketed regex matching on the
// destination string — it never consulted `CiscoData.state.staticRoutes` /
// `ospfConfig` / `eigrpConfig` / `bgpConfig` at all, so e.g. pinging a real
// OSPF-learned subnet with no static/connected route would still just roll
// dice against a `/^10\./` regex. That fabricated-reachability behavior is
// NOT reproduced here. `PingTraceroutePage` calls the real, routing-table-
// aware `simulatePing`/`simulateTraceroute` engine (routing-engine.ts) via the
// `RUN_PING`/`RUN_TRACEROUTE` reducer actions — a ping only succeeds if
// `resolveRoute()` finds a genuine connected/static/OSPF/EIGRP/BGP match, and
// the reported `sourceKind` reflects which routing source actually answered.
// Source's console-line vocabulary ("Type escape sequence to abort.",
// "Sending N, size-byte ICMP Echos to X", "Tracing the route to X") is kept
// for visual fidelity to the real IOS CLI experience, but the underlying
// pass/fail/latency numbers are now genuine, not randomized-independent of
// state.
//
// BGP: source's own "Apply" button (P['rt-bgp']) was decorative — it only
// called `H.toast('BGP config applied')` and never wrote back to
// `CiscoData.state.bgpConfig` (unlike RIP/EIGRP/OSPF, which had real
// `_saveX` handlers). Per this port's reducer (which DOES define
// `UPDATE_BGP_CONFIG`), `BgpPage` wires a genuine save — the missing
// source handler was a gap in source's own UI, not an intentional
// read-only design, matching the judgment already applied to DHCP pools in
// vpn-services-pages.tsx.
//
// RIP has no reducer action at all (disabled by default in seed data, and no
// `UPDATE_RIP_CONFIG` exists in reducer.ts) — `RipPage` is intentionally a
// read-only config-display page, matching the porting brief.

import { useState } from "react";
import { toast } from "sonner";

import type { CiscoAction } from "@/lib/labs/simulators/network-cisco/reducer";
import { simulatePing, simulateTraceroute } from "@/lib/labs/simulators/network-cisco/routing-engine";
import type {
  CiscoBgpConfig,
  CiscoDiagHistoryEntry,
  CiscoEigrpConfig,
  CiscoOspfConfig,
  CiscoRouteSourceKind,
  CiscoState,
  CiscoStaticRoute,
  PingResult,
  TraceResult,
} from "@/lib/labs/simulators/network-cisco/types";
import { DataTable, type DataTableColumn, EmptyState, Field, Modal, NativeSelect, StatusPill, statusTone } from "./cisco-ui";
import styles from "./cisco-console.module.css";

type CiscoPageProps = { state: CiscoState; dispatch: React.Dispatch<CiscoAction> };

// ===================================================================
// shared helpers
// ===================================================================

/** Comma-separated free-text -> trimmed non-empty string array (source's
 * `.split(',').map(trim).filter(Boolean)` convention for passive-interface
 * lists, e.g. CU._saveRip). */
function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Newline-separated free-text -> trimmed non-empty string array (source's
 * `.split('\n').map(trim).filter(Boolean)` convention for network lists,
 * e.g. CU._saveRip/_saveEigrp/_saveOspf). */
function parseLineList(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const routeSourceLabel: Record<CiscoRouteSourceKind, string> = {
  connected: "Directly connected",
  static: "Static route",
  ospf: "OSPF",
  eigrp: "EIGRP",
  bgp: "BGP",
  none: "No route",
};

// ===================================================================
// 1. Static Routes — source P['rt-static'] + CU._addStatic/_saveStatic/_delStatic
// ===================================================================

function emptyStaticRouteDraft(): CiscoStaticRoute {
  return { dst: "", mask: "255.255.255.0", nextHop: "", iface: "", distance: 1, tag: "", comment: "" };
}

function StaticRouteForm({ draft, onChange }: { draft: CiscoStaticRoute; onChange: (patch: Partial<CiscoStaticRoute>) => void }) {
  return (
    <div className={styles.form}>
      <Field label="Destination network">
        <input className={styles.input} value={draft.dst} onChange={(e) => onChange({ dst: e.target.value })} placeholder="192.168.100.0" />
      </Field>
      <Field label="Subnet mask">
        <input className={styles.input} value={draft.mask} onChange={(e) => onChange({ mask: e.target.value })} placeholder="255.255.255.0" />
      </Field>
      <Field label="Next hop">
        <input className={styles.input} value={draft.nextHop} onChange={(e) => onChange({ nextHop: e.target.value })} placeholder="10.10.0.254" />
      </Field>
      <Field label="Egress interface" help="Optional — leave blank to route via next-hop lookup only">
        <input className={styles.input} value={draft.iface} onChange={(e) => onChange({ iface: e.target.value })} placeholder="GigabitEthernet0/0/0" />
      </Field>
      <Field label="Administrative distance">
        <input
          className={styles.input}
          type="number"
          min={1}
          max={255}
          value={draft.distance}
          onChange={(e) => onChange({ distance: parseInt(e.target.value, 10) || 1 })}
        />
      </Field>
      <Field label="Comment">
        <input className={styles.input} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder="Lab segment" />
      </Field>
    </div>
  );
}

function AddStaticRouteModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<CiscoAction> }) {
  const [draft, setDraft] = useState<CiscoStaticRoute>(emptyStaticRouteDraft());

  function handleSubmit() {
    if (!draft.dst.trim() || !draft.mask.trim() || !draft.nextHop.trim()) {
      toast.error("Destination, mask, and next hop are required");
      return;
    }
    dispatch({ type: "ADD_STATIC_ROUTE", route: draft });
    toast.success(`Static route to ${draft.dst} added`);
    onClose();
  }

  return (
    <Modal
      title="Add Static Route"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Apply
          </button>
        </>
      }
    >
      <StaticRouteForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditStaticRouteModal({
  index,
  route,
  onClose,
  dispatch,
}: {
  index: number;
  route: CiscoStaticRoute;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [draft, setDraft] = useState<CiscoStaticRoute>(route);

  function handleSubmit() {
    if (!draft.dst.trim() || !draft.mask.trim() || !draft.nextHop.trim()) {
      toast.error("Destination, mask, and next hop are required");
      return;
    }
    dispatch({ type: "UPDATE_STATIC_ROUTE", index, patch: draft });
    toast.success(`Static route to ${draft.dst} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit Static Route – ${route.dst}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Save changes
          </button>
        </>
      }
    >
      <StaticRouteForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
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
  route: CiscoStaticRoute;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_STATIC_ROUTE", index });
    toast.success(`Static route to ${route.dst} removed`);
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
        Delete the static route <b>ip route {route.dst} {route.mask} {route.nextHop}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

export function StaticRoutesPage({ state, dispatch }: CiscoPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const columns: DataTableColumn<CiscoStaticRoute & { index: number }>[] = [
    { key: "dst", header: "Destination", render: (r) => <span className={styles.mono}>{r.dst}</span> },
    { key: "mask", header: "Mask", render: (r) => <span className={styles.mono}>{r.mask}</span> },
    { key: "nextHop", header: "Next Hop", render: (r) => <span className={styles.mono}>{r.nextHop}</span> },
    { key: "iface", header: "Interface", render: (r) => r.iface || "--" },
    { key: "distance", header: "AD", render: (r) => r.distance },
    { key: "comment", header: "Comment", render: (r) => r.comment || "" },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className={styles.flex}>
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

  const cli = state.staticRoutes
    .map((r) => `ip route ${r.dst} ${r.mask} ${r.nextHop}${r.distance !== 1 ? ` ${r.distance}` : ""}${r.comment ? `   ! ${r.comment}` : ""}`)
    .join("\n");

  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Router &nbsp;&rsaquo;&nbsp; <b>Static Routing</b>
      </div>
      <h1 className={styles.pageH}>Static Routing</h1>

      <div className={styles.toolbar}>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={styles.btn} onClick={() => setShowAddModal(true)}>
          + Add route
        </button>
      </div>

      <DataTable columns={columns} rows={rows} getRowKey={(r) => `${r.index}-${r.dst}-${r.mask}`} emptyMessage="No static routes configured." />

      <div className={`${styles.card} ${styles.mt16}`}>
        <div className={styles.cardHeader}>CLI Equivalent</div>
        <div className={styles.cardBody}>
          <div className={styles.console}>{cli || "! No static routes configured"}</div>
        </div>
      </div>

      {showAddModal ? <AddStaticRouteModal onClose={() => setShowAddModal(false)} dispatch={dispatch} /> : null}
      {editIndex !== null && state.staticRoutes[editIndex] ? (
        <EditStaticRouteModal index={editIndex} route={state.staticRoutes[editIndex]} onClose={() => setEditIndex(null)} dispatch={dispatch} />
      ) : null}
      {deleteIndex !== null && state.staticRoutes[deleteIndex] ? (
        <DeleteStaticRouteModal index={deleteIndex} route={state.staticRoutes[deleteIndex]} onClose={() => setDeleteIndex(null)} dispatch={dispatch} />
      ) : null}
    </div>
  );
}

// ===================================================================
// 2. RIP — source P['rt-rip']. Read-only: RIP is disabled by default in
// seed data and reducer.ts defines no UPDATE_RIP_CONFIG action (unlike
// RIP/EIGRP/OSPF/BGP's siblings — RIP was intentionally left config-display
// only per the porting brief). Rendered with the same field fidelity as
// source's form (enabled/version/networks/passive interfaces/auto-summary),
// just without an edit affordance.
// ===================================================================

export function RipPage({ state }: { state: CiscoState }) {
  const r = state.ripConfig;
  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Router &nbsp;&rsaquo;&nbsp; <b>RIP</b>
      </div>
      <h1 className={styles.pageH}>RIP</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>RIP Configuration</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Enabled</dt>
            <dd>
              <StatusPill tone={statusTone(r.enabled ? "enabled" : "disabled")}>{r.enabled ? "Enabled" : "Disabled"}</StatusPill>
            </dd>
            <dt>Version</dt>
            <dd>RIPv{r.version}</dd>
            <dt>Networks</dt>
            <dd className={styles.mono}>{r.networks.length > 0 ? r.networks.join(", ") : "--"}</dd>
            <dt>Passive Interfaces</dt>
            <dd className={styles.mono}>{r.passiveInterfaces.length > 0 ? r.passiveInterfaces.join(", ") : "none"}</dd>
            <dt>Auto-summary</dt>
            <dd>{r.autoSummary ? "Enabled" : "Disabled"}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.small}>
        RIP routing is {r.enabled ? "active" : "not active"} on this device — this is a read-only summary (matching this simulator's routing
        engine, which does not evaluate RIP-learned routes).
      </div>
    </div>
  );
}

// ===================================================================
// 3. EIGRP — source P['rt-eigrp'] + CU._saveEigrp
// ===================================================================

function eigrpNetworksToText(networks: CiscoEigrpConfig["networks"]): string {
  return networks.map((n) => `${n.network} ${n.wildcard}`).join("\n");
}

function parseEigrpNetworksText(text: string): CiscoEigrpConfig["networks"] {
  return parseLineList(text).map((line) => {
    const parts = line.split(/\s+/);
    return { network: parts[0] ?? "", wildcard: parts[1] || "0.0.0.255" };
  });
}

export function EigrpPage({ state, dispatch }: CiscoPageProps) {
  const e = state.eigrpConfig;
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(e.enabled);
  const [asn, setAsn] = useState(String(e.asn));
  const [routerId, setRouterId] = useState(e.routerId);
  const [networksText, setNetworksText] = useState(eigrpNetworksToText(e.networks));
  const [passiveText, setPassiveText] = useState(e.passiveInterfaces.join(", "));

  function startEdit() {
    setEnabled(e.enabled);
    setAsn(String(e.asn));
    setRouterId(e.routerId);
    setNetworksText(eigrpNetworksToText(e.networks));
    setPassiveText(e.passiveInterfaces.join(", "));
    setEditing(true);
  }

  function handleSave() {
    const parsedAsn = parseInt(asn, 10);
    if (!routerId.trim()) {
      toast.error("Router ID is required");
      return;
    }
    dispatch({
      type: "UPDATE_EIGRP_CONFIG",
      patch: {
        enabled,
        asn: Number.isFinite(parsedAsn) && parsedAsn > 0 ? parsedAsn : e.asn,
        routerId: routerId.trim(),
        networks: parseEigrpNetworksText(networksText),
        passiveInterfaces: parseCommaList(passiveText),
      },
    });
    toast.success("EIGRP configuration applied");
    setEditing(false);
  }

  const neighborColumns: DataTableColumn<CiscoState["eigrpNeighbors"][number]>[] = [
    { key: "neighbor", header: "Neighbor", render: (n) => <span className={styles.mono}>{n.neighbor}</span> },
    { key: "iface", header: "Interface", render: (n) => n.iface },
    { key: "holdTime", header: "Hold", render: (n) => `${n.holdTime}s` },
    { key: "uptime", header: "Uptime", render: (n) => n.uptime },
    { key: "srtt", header: "SRTT", render: (n) => n.srtt },
    { key: "rto", header: "RTO", render: (n) => n.rto },
    { key: "q", header: "Q", render: (n) => n.q },
    { key: "seq", header: "Seq", render: (n) => n.seq },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Router &nbsp;&rsaquo;&nbsp; <b>EIGRP</b>
      </div>
      <h1 className={styles.pageH}>EIGRP</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span>EIGRP Process - AS {e.asn}</span>
          {!editing ? (
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={startEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <div className={styles.cardBody}>
          {editing ? (
            <div className={styles.form}>
              <Field label="Enabled">
                <label className={styles.checkrow}>
                  <input type="checkbox" checked={enabled} onChange={(ev) => setEnabled(ev.target.checked)} /> <span>Enable EIGRP routing process</span>
                </label>
              </Field>
              <Field label="Autonomous System">
                <input className={styles.input} type="number" value={asn} onChange={(ev) => setAsn(ev.target.value)} />
              </Field>
              <Field label="Router ID">
                <input className={styles.input} value={routerId} onChange={(ev) => setRouterId(ev.target.value)} />
              </Field>
              <Field label="Networks (wildcard pairs)" help="One per line, e.g. 10.10.0.0 0.0.0.255">
                <textarea className={styles.textarea} rows={3} value={networksText} onChange={(ev) => setNetworksText(ev.target.value)} />
              </Field>
              <Field label="Passive Interfaces" help="Comma-separated">
                <input className={styles.input} value={passiveText} onChange={(ev) => setPassiveText(ev.target.value)} />
              </Field>
              <div className={styles.flex} style={{ marginTop: 10 }}>
                <button type="button" className={styles.btn} onClick={handleSave}>
                  Apply
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className={styles.kv}>
              <dt>Enabled</dt>
              <dd>
                <StatusPill tone={statusTone(e.enabled ? "enabled" : "disabled")}>{e.enabled ? "Enabled" : "Disabled"}</StatusPill>
              </dd>
              <dt>Autonomous System</dt>
              <dd>{e.asn}</dd>
              <dt>Router ID</dt>
              <dd className={styles.mono}>{e.routerId}</dd>
              <dt>Networks</dt>
              <dd className={styles.mono}>
                {e.networks.length > 0 ? e.networks.map((n) => `${n.network} ${n.wildcard}`).join(", ") : "--"}
              </dd>
              <dt>Passive Interfaces</dt>
              <dd className={styles.mono}>{e.passiveInterfaces.length > 0 ? e.passiveInterfaces.join(", ") : "none"}</dd>
              <dt>Authentication</dt>
              <dd>{e.authMode ? e.authMode.toUpperCase() : "None"}</dd>
            </dl>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>EIGRP Neighbors (show ip eigrp neighbors)</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={neighborColumns} rows={state.eigrpNeighbors} getRowKey={(n) => n.neighbor} emptyMessage="No EIGRP neighbors." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 4. OSPF — source P['rt-ospf'] + CU._saveOspf
// ===================================================================

export function OspfPage({ state, dispatch }: CiscoPageProps) {
  const o = state.ospfConfig;
  const primaryArea = o.areas[0];
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(o.enabled);
  const [processId, setProcessId] = useState(String(o.processId));
  const [routerId, setRouterId] = useState(o.routerId);
  const [referenceBandwidth, setReferenceBandwidth] = useState(String(o.referenceBandwidth));
  const [networksText, setNetworksText] = useState(primaryArea ? primaryArea.networks.join("\n") : "");
  const [passiveText, setPassiveText] = useState(o.passiveInterfaces.join(", "));

  function startEdit() {
    setEnabled(o.enabled);
    setProcessId(String(o.processId));
    setRouterId(o.routerId);
    setReferenceBandwidth(String(o.referenceBandwidth));
    setNetworksText(primaryArea ? primaryArea.networks.join("\n") : "");
    setPassiveText(o.passiveInterfaces.join(", "));
    setEditing(true);
  }

  function handleSave() {
    if (!routerId.trim()) {
      toast.error("Router ID is required");
      return;
    }
    const parsedProcessId = parseInt(processId, 10);
    const parsedBandwidth = parseInt(referenceBandwidth, 10);
    const updatedAreas = primaryArea
      ? o.areas.map((area, i) => (i === 0 ? { ...area, networks: parseLineList(networksText) } : area))
      : [{ area: 0, type: "standard", networks: parseLineList(networksText) }];
    dispatch({
      type: "UPDATE_OSPF_CONFIG",
      patch: {
        enabled,
        processId: Number.isFinite(parsedProcessId) && parsedProcessId > 0 ? parsedProcessId : o.processId,
        routerId: routerId.trim(),
        referenceBandwidth: Number.isFinite(parsedBandwidth) && parsedBandwidth > 0 ? parsedBandwidth : o.referenceBandwidth,
        areas: updatedAreas,
        passiveInterfaces: parseCommaList(passiveText),
      },
    });
    toast.success("OSPF configuration applied");
    setEditing(false);
  }

  const neighborColumns: DataTableColumn<CiscoState["ospfNeighbors"][number]>[] = [
    { key: "neighbor", header: "Neighbor ID", render: (n) => <span className={styles.mono}>{n.neighbor}</span> },
    { key: "priority", header: "Pri", render: (n) => n.priority },
    { key: "state", header: "State", render: (n) => <StatusPill tone={statusTone(n.state.split("/")[0] ?? n.state)}>{n.state}</StatusPill> },
    { key: "deadTime", header: "Dead Time", render: (n) => n.deadTime },
    { key: "address", header: "Address", render: (n) => <span className={styles.mono}>{n.address}</span> },
    { key: "iface", header: "Interface", render: (n) => n.iface },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Router &nbsp;&rsaquo;&nbsp; <b>OSPF</b>
      </div>
      <h1 className={styles.pageH}>OSPF</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span>OSPF Process {o.processId}</span>
          {!editing ? (
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={startEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <div className={styles.cardBody}>
          {editing ? (
            <div className={styles.form}>
              <Field label="Enabled">
                <label className={styles.checkrow}>
                  <input type="checkbox" checked={enabled} onChange={(ev) => setEnabled(ev.target.checked)} /> <span>Enable OSPF routing process</span>
                </label>
              </Field>
              <Field label="Process ID">
                <input className={styles.input} type="number" value={processId} onChange={(ev) => setProcessId(ev.target.value)} />
              </Field>
              <Field label="Router ID">
                <input className={styles.input} value={routerId} onChange={(ev) => setRouterId(ev.target.value)} />
              </Field>
              <Field label="Reference Bandwidth (Mbps)">
                <input className={styles.input} type="number" value={referenceBandwidth} onChange={(ev) => setReferenceBandwidth(ev.target.value)} />
              </Field>
              <Field label={`Networks (area ${primaryArea?.area ?? 0})`} help="One CIDR per line, e.g. 10.10.0.0/24">
                <textarea className={styles.textarea} rows={3} value={networksText} onChange={(ev) => setNetworksText(ev.target.value)} />
              </Field>
              <Field label="Passive Interfaces" help="Comma-separated">
                <input className={styles.input} value={passiveText} onChange={(ev) => setPassiveText(ev.target.value)} />
              </Field>
              <div className={styles.flex} style={{ marginTop: 10 }}>
                <button type="button" className={styles.btn} onClick={handleSave}>
                  Apply
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className={styles.kv}>
              <dt>Enabled</dt>
              <dd>
                <StatusPill tone={statusTone(o.enabled ? "enabled" : "disabled")}>{o.enabled ? "Enabled" : "Disabled"}</StatusPill>
              </dd>
              <dt>Process ID</dt>
              <dd>{o.processId}</dd>
              <dt>Router ID</dt>
              <dd className={styles.mono}>{o.routerId}</dd>
              <dt>Reference Bandwidth</dt>
              <dd>{o.referenceBandwidth} Mbps</dd>
              <dt>Areas</dt>
              <dd className={styles.mono}>
                {o.areas.map((a) => `area ${a.area} (${a.type}): ${a.networks.join(", ") || "--"}`).join(" · ")}
              </dd>
              <dt>Passive Interfaces</dt>
              <dd className={styles.mono}>{o.passiveInterfaces.length > 0 ? o.passiveInterfaces.join(", ") : "none"}</dd>
              <dt>Authentication</dt>
              <dd>{o.authMode ? o.authMode : "None"}</dd>
            </dl>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>OSPF Neighbors (show ip ospf neighbor)</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={neighborColumns} rows={state.ospfNeighbors} getRowKey={(n) => n.neighbor} emptyMessage="No OSPF neighbors." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 5. BGP — source P['rt-bgp']. Source's own "Apply" button was decorative
// (only toasted, never mutated state — see file header); this port wires a
// genuine save via the reducer's real UPDATE_BGP_CONFIG action.
// ===================================================================

export function BgpPage({ state, dispatch }: CiscoPageProps) {
  const b = state.bgpConfig;
  const [editing, setEditing] = useState(false);
  const [asn, setAsn] = useState(String(b.asn));
  const [routerId, setRouterId] = useState(b.routerId);
  const [networksText, setNetworksText] = useState(b.networks.join("\n"));

  function startEdit() {
    setAsn(String(b.asn));
    setRouterId(b.routerId);
    setNetworksText(b.networks.join("\n"));
    setEditing(true);
  }

  function handleSave() {
    if (!routerId.trim()) {
      toast.error("Router ID is required");
      return;
    }
    const parsedAsn = parseInt(asn, 10);
    const patch: Partial<CiscoBgpConfig> = {
      asn: Number.isFinite(parsedAsn) && parsedAsn > 0 ? parsedAsn : b.asn,
      routerId: routerId.trim(),
      networks: parseLineList(networksText),
    };
    dispatch({ type: "UPDATE_BGP_CONFIG", patch });
    toast.success("BGP config applied");
    setEditing(false);
  }

  const neighborColumns: DataTableColumn<CiscoState["bgpConfig"]["neighbors"][number]>[] = [
    { key: "peer", header: "Peer", render: (n) => <span className={styles.mono}>{n.peer}</span> },
    { key: "remoteAs", header: "Remote AS", render: (n) => n.remoteAs },
    { key: "description", header: "Description", render: (n) => n.description },
    {
      key: "state",
      header: "State",
      render: (n) => <StatusPill tone={n.state === "Established" ? "up" : "warn"}>{n.state}</StatusPill>,
    },
    { key: "uptime", header: "Uptime", render: (n) => n.uptime },
    { key: "prefixesIn", header: "Prefixes In", render: (n) => n.prefixesIn.toLocaleString() },
    { key: "prefixesOut", header: "Prefixes Out", render: (n) => n.prefixesOut.toLocaleString() },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Router &nbsp;&rsaquo;&nbsp; <b>BGP</b>
      </div>
      <h1 className={styles.pageH}>BGP</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span>BGP AS {b.asn}</span>
          {!editing ? (
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={startEdit}>
              Edit
            </button>
          ) : null}
        </div>
        <div className={styles.cardBody}>
          {editing ? (
            <div className={styles.form}>
              <Field label="Local AS">
                <input className={styles.input} type="number" value={asn} onChange={(ev) => setAsn(ev.target.value)} />
              </Field>
              <Field label="Router ID">
                <input className={styles.input} value={routerId} onChange={(ev) => setRouterId(ev.target.value)} />
              </Field>
              <Field label="Advertised Networks" help="One CIDR per line, e.g. 203.0.113.0/24">
                <textarea className={styles.textarea} rows={2} value={networksText} onChange={(ev) => setNetworksText(ev.target.value)} />
              </Field>
              <div className={styles.flex} style={{ marginTop: 10 }}>
                <button type="button" className={styles.btn} onClick={handleSave}>
                  Apply
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className={styles.kv}>
              <dt>Local AS</dt>
              <dd>{b.asn}</dd>
              <dt>Router ID</dt>
              <dd className={styles.mono}>{b.routerId}</dd>
              <dt>Advertised Networks</dt>
              <dd className={styles.mono}>{b.networks.length > 0 ? b.networks.join(", ") : "--"}</dd>
            </dl>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>BGP Neighbors (show ip bgp summary)</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={neighborColumns} rows={b.neighbors} getRowKey={(n) => n.peer} emptyMessage="No BGP neighbors configured." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 6. Ping & Traceroute — THE FLAGSHIP PAGE. Source P['t-ping']/CU._runPing/
// decidePingScenario + P['t-trace']/CU._runTrace/generateHops.
//
// Genuinely routing-aware: every result on this page traces back to
// `resolveRoute()` in routing-engine.ts via the `RUN_PING`/`RUN_TRACEROUTE`
// reducer actions (which call `simulatePing`/`simulateTraceroute`
// internally) — nothing here is fabricated independent of `state`.
//
// Dispatch doesn't return a value (plain reducer actions), so this component
// also calls `simulatePing`/`simulateTraceroute` directly, client-side, with
// the SAME seed it dispatches — giving synchronous render feedback without
// waiting on a state round-trip, while `dispatch` is still the one true
// source of the persisted `diagHistory` entry (read back on the History
// page). Both calls hit the identical pure function with the identical
// seed, so the immediate render and the persisted history entry can never
// diverge.
// ===================================================================

type PingRunResult = { kind: "ping"; result: PingResult };
type TraceRunResult = { kind: "traceroute"; result: TraceResult };
type DiagRunResult = PingRunResult | TraceRunResult;

let diagSeedCounter = 0;
/** Derives a fresh numeric seed per probe from wall-clock time plus a
 * monotonic counter (collision-proof even for two probes fired in the same
 * millisecond) — this is the UI layer, so unlike the pure engine/reducer
 * files (which must stay deterministic and never touch Date.now()), a
 * wall-clock-derived seed here is exactly the intended source of
 * "randomness" for a fresh probe each time the operator clicks Ping/Traceroute. */
function nextDiagSeed(): number {
  diagSeedCounter += 1;
  return Date.now() + diagSeedCounter;
}

function PingResultCard({ result }: { result: PingResult }) {
  const tone = result.kind === "ok" ? "up" : result.kind === "partial" ? "warn" : "down";
  return (
    <div className={styles.diag}>
      <div className={styles.diagHd}>Ping Results</div>
      <div className={styles.diagBd}>
        <dl className={styles.kv}>
          <dt>Destination</dt>
          <dd className={styles.mono}>{result.dst}</dd>
          <dt>Source</dt>
          <dd className={styles.mono}>{result.src ?? "(default - auto)"}</dd>
          <dt>Sent / Received</dt>
          <dd>
            {result.sent} / {result.received}
          </dd>
          <dt>Loss</dt>
          <dd>
            <StatusPill tone={tone}>{result.lossPct}% loss</StatusPill>
          </dd>
          {result.minMs != null ? (
            <>
              <dt>Round-trip min/avg/max</dt>
              <dd>
                {result.minMs}/{result.avgMs}/{result.maxMs} ms
              </dd>
            </>
          ) : null}
          <dt>Route source</dt>
          <dd>
            {result.route ? <StatusPill tone={statusTone(result.route.matched ? "up" : "down")}>{routeSourceLabel[result.route.sourceKind]}</StatusPill> : "--"}
          </dd>
          {result.route?.egressInterface ? (
            <>
              <dt>Egress interface</dt>
              <dd className={styles.mono}>{result.route.egressInterface}</dd>
            </>
          ) : null}
          {result.route?.nextHop ? (
            <>
              <dt>Next hop</dt>
              <dd className={styles.mono}>{result.route.nextHop}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function TraceResultCard({ result }: { result: TraceResult }) {
  const columns: DataTableColumn<(typeof result.hops)[number]>[] = [
    { key: "hop", header: "Hop", render: (h) => h.hop },
    { key: "address", header: "Address", render: (h) => <span className={styles.mono}>{h.timedOut ? "*" : h.address}</span> },
    { key: "rtt", header: "RTT", render: (h) => (h.timedOut || h.rttMs == null ? <StatusPill tone="down">timed out</StatusPill> : `${h.rttMs} ms`) },
  ];
  return (
    <div className={styles.diag}>
      <div className={styles.diagHd}>Traceroute Results</div>
      <div className={styles.diagBd}>
        <div className={`${styles.small} ${styles.mb10}`}>
          Destination <span className={styles.mono}>{result.dst}</span> from{" "}
          <span className={styles.mono}>{result.src ?? "(default - auto)"}</span> —{" "}
          <StatusPill tone={result.reached ? "up" : "down"}>{result.reached ? "reached" : "no route to host"}</StatusPill>
        </div>
        <DataTable columns={columns} rows={result.hops} getRowKey={(h) => String(h.hop)} dense emptyMessage="No hops recorded." />
      </div>
    </div>
  );
}

export function PingTraceroutePage({ state, dispatch }: CiscoPageProps) {
  const [dst, setDst] = useState("");
  const [srcInterfaceName, setSrcInterfaceName] = useState("");
  const [lastRun, setLastRun] = useState<DiagRunResult | null>(null);

  const ifaceOptions = [
    { value: "", label: "(default - auto)" },
    ...state.interfaces.map((f) => ({ value: f.name, label: f.ip ? `${f.name} (${f.ip})` : f.name })),
  ];

  function handlePing() {
    const target = dst.trim();
    if (!target) {
      toast.error("Enter a destination IP or hostname");
      return;
    }
    const seed = nextDiagSeed();
    const src = srcInterfaceName || null;
    const nowIso = new Date().toISOString();
    // Immediate render feedback — same pure function, same seed, as the
    // RUN_PING action the reducer will execute below.
    const result = simulatePing(target, src, state, seed);
    setLastRun({ kind: "ping", result });
    dispatch({ type: "RUN_PING", dst: target, srcInterfaceName: src, seed, nowIso });
    toast[result.kind === "ok" ? "success" : result.kind === "partial" ? "warning" : "error"](`Ping to ${target}: ${result.received}/${result.sent} received`);
  }

  function handleTraceroute() {
    const target = dst.trim();
    if (!target) {
      toast.error("Enter a destination IP or hostname");
      return;
    }
    const seed = nextDiagSeed();
    const src = srcInterfaceName || null;
    const nowIso = new Date().toISOString();
    const result = simulateTraceroute(target, src, state, seed);
    setLastRun({ kind: "traceroute", result });
    dispatch({ type: "RUN_TRACEROUTE", dst: target, srcInterfaceName: src, seed, nowIso });
    toast[result.reached ? "success" : "error"](`Traceroute to ${target}: ${result.reached ? "reached" : "no route to host"}`);
  }

  return (
    <div>
      <div className={styles.crumb}>
        Troubleshoot &nbsp;&rsaquo;&nbsp; Connectivity &nbsp;&rsaquo;&nbsp; <b>Ping & Traceroute</b>
      </div>
      <h1 className={styles.pageH}>Ping & Traceroute</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>ICMP Echo / Traceroute</div>
        <div className={styles.cardBody}>
          <div className={styles.form}>
            <Field label="Destination IP / Hostname">
              <input className={styles.input} value={dst} onChange={(e) => setDst(e.target.value)} placeholder="e.g. 8.8.8.8 or 10.10.0.2" />
            </Field>
            <Field label="Source Interface">
              <NativeSelect value={srcInterfaceName} onChange={setSrcInterfaceName} options={ifaceOptions} />
            </Field>
            <div className={styles.flex} style={{ marginTop: 10 }}>
              <button type="button" className={styles.btn} onClick={handlePing}>
                Ping
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={handleTraceroute}>
                Traceroute
              </button>
            </div>
          </div>

          <div className={styles.console} style={{ marginTop: 12 }}>
            Type escape sequence to abort.
            {"\n"}
            {lastRun
              ? lastRun.kind === "ping"
                ? `Sending ${lastRun.result.sent}, 100-byte ICMP Echos to ${lastRun.result.dst}, timeout is 2 seconds:${
                    lastRun.result.src ? `\nPacket sent with a source address of ${lastRun.result.src}` : ""
                  }\n${"!".repeat(lastRun.result.received)}${".".repeat(lastRun.result.sent - lastRun.result.received)}`
                : `Tracing the route to ${lastRun.result.dst}\nVRF info: (vrf in name/id, vrf out name/id)`
              : "Enter a destination above and choose Ping or Traceroute."}
          </div>
        </div>
      </div>

      {lastRun ? (
        lastRun.kind === "ping" ? <PingResultCard result={lastRun.result} /> : <TraceResultCard result={lastRun.result} />
      ) : (
        <EmptyState message="No diagnostics run yet." />
      )}
    </div>
  );
}

// ===================================================================
// 7. Diagnostic History — Troubleshoot > System (new page; no source
// equivalent since source never persisted ping/trace runs). Reads
// `state.diagHistory` (already newest-first — RUN_PING/RUN_TRACEROUTE
// unshift onto the array, matching the syslog/routing-events convention)
// and dispatches the real CLEAR_DIAG_HISTORY action.
// ===================================================================

export function DiagHistoryPage({ state, dispatch }: CiscoPageProps) {
  const columns: DataTableColumn<CiscoDiagHistoryEntry>[] = [
    { key: "ts", header: "Timestamp", render: (e) => <span className={styles.mono}>{e.ts}</span> },
    { key: "kind", header: "Type", render: (e) => <StatusPill tone={e.kind === "ping" ? "info" : "muted"}>{e.kind}</StatusPill> },
    { key: "dst", header: "Destination", render: (e) => <span className={styles.mono}>{e.dst}</span> },
    { key: "src", header: "Source", render: (e) => (e.src ? <span className={styles.mono}>{e.src}</span> : "(default - auto)") },
    { key: "summary", header: "Summary", render: (e) => e.summary },
  ];

  function handleClear() {
    dispatch({ type: "CLEAR_DIAG_HISTORY" });
    toast.success("Diagnostic history cleared");
  }

  return (
    <div>
      <div className={styles.crumb}>
        Troubleshoot &nbsp;&rsaquo;&nbsp; System &nbsp;&rsaquo;&nbsp; <b>Diagnostic History</b>
      </div>
      <h1 className={styles.pageH}>Diagnostic History</h1>

      <div className={styles.toolbar}>
        <span className={styles.small}>{state.diagHistory.length} entries</span>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleClear}>
          Clear history
        </button>
      </div>

      <DataTable columns={columns} rows={state.diagHistory} getRowKey={(e) => e.id} emptyMessage="No ping or traceroute runs recorded yet." />
    </div>
  );
}
