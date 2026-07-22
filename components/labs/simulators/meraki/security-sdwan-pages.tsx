"use client";

// Security & SD-WAN nav-group pages for the Cisco Meraki dashboard simulator.
// Ported from itbd-lab/simulators/meraki/js/meraki-security.js (464 lines):
// Appliance status, Security center, VPN status, Addressing & VLANs, NAT,
// Site-to-site VPN, Routing, Firewall, Content filtering, SD-WAN & traffic
// shaping. (Source's Insight/AutoVPN/DHCP/Client VPN/Threat protection/Active
// Directory/Access control/Splash/Wireless concentrator leaves are consolidated
// elsewhere per the shell's confirmed MerakiPage union — see meraki-shell.tsx's
// header comment — and are out of scope for this file.)
//
// Three source bugs are fixed here, per the porting brief:
//
// 1. Source's `_addL3Rule`/`_addL7Rule` (meraki-security.js:308-332) built their
//    rule objects via a chain of native `prompt()` calls and finished by calling
//    `MerakiPortal.rerender()` — a function that does not exist anywhere in
//    meraki-portal.js's public API, so clicking either "+ Add rule" button threw
//    a ReferenceError and the rule was never actually visible (even though it HAD
//    been pushed onto the in-memory array). Here, `AddL3RuleModal`/`AddL7RuleModal`
//    are real controlled forms that dispatch `ADD_FIREWALL_L3_RULE` /
//    `ADD_FIREWALL_L7_RULE` against the now-crash-free reducer.
// 2. Source has two divergent hardcoded VLAN tables that never read real state:
//    meraki-security.js's own `renderVlans()` (6 rows: 10/20/30/40/50/99) and
//    meraki-switch.js's `renderRouting()` (5 rows: 10/20/30/40/50, no 99, "DMZ"
//    dhcp differs). `SecAddressingVlansPage` below is the FIRST of the two ported
//    (meraki-switch.js's routing page is owned by the Switch nav-group agent) and
//    uses the new canonical, per-network `state.vlans[]` from seedData.ts/reducer.ts
//    as the single source of truth — no more hardcoded arrays.
// 3. Source's Content filtering `renderContent()` Save button
//    (`onclick="MerakiPortal.toast('Content filtering saved', 'ok')"`) never read
//    the category checkboxes or URL-pattern textareas back into state at all —
//    editing anything and clicking Save silently discarded every edit.
//    `SecContentFilteringPage` below holds real form state and dispatches
//    `UPDATE_CONTENT_FILTERING` with the actual edited values.
//
// No native prompt()/alert()/confirm() anywhere — all destructive/multi-field
// actions go through `Modal` + `toast` (sonner), per house convention.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  MerakiFirewallL3Rule,
  MerakiFirewallL7Rule,
  MerakiPortForward,
  MerakiState,
  MerakiVlan,
  MerakiVpnPeer,
} from "@/lib/labs/simulators/meraki/types";
import type { MerakiAction } from "@/lib/labs/simulators/meraki/reducer";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Modal,
  NativeSelect,
  Sparkline,
  StatRow,
  StatusPill,
  statusTone,
  type DataTableColumn,
} from "./meraki-ui";
import styles from "./meraki-console.module.css";

type Dispatch = React.Dispatch<MerakiAction>;

// ===================================================================
// Shared helpers
// ===================================================================

// Monotonic-ish seed derivation for engine dispatches — each click mixes the
// current time with a small in-module counter so back-to-back clicks within
// the same millisecond still get distinct seeds (the engines are pure
// functions of `seed`, so a repeated seed would produce identical drift).
let engineSeedCounter = 0;
function nextEngineSeed(): number {
  engineSeedCounter += 1;
  return Date.now() + engineSeedCounter;
}

function currentAppliance(state: MerakiState) {
  return state.devices.find((d) => d.networkId === state.currentNetworkId && d.type === "appliance") ?? null;
}

function fmtTs(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// ===================================================================
// 1. Appliance status
// ===================================================================

export function SecApplianceStatusPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  const mx = currentAppliance(state);

  const history1 = useMemo(
    () => (mx ? state.wanHealthHistory.filter((s) => s.serial === mx.serial && s.link === "wan1").slice(-24) : []),
    [state.wanHealthHistory, mx],
  );
  const history2 = useMemo(
    () => (mx ? state.wanHealthHistory.filter((s) => s.serial === mx.serial && s.link === "wan2").slice(-24) : []),
    [state.wanHealthHistory, mx],
  );

  if (!mx) {
    return (
      <div>
        <h1 className={styles.pageH}>Appliance status</h1>
        <EmptyState message="No MX appliance in this network." />
      </div>
    );
  }

  function sampleNow() {
    dispatch({ type: "SAMPLE_WAN_HEALTH", serial: mx!.serial, seed: nextEngineSeed(), nowIso: new Date().toISOString() });
    toast.success("Sampled current WAN health.");
  }

  const wan1 = mx.wan1;
  const wan2 = mx.wan2;

  const historyColumns: DataTableColumn<(typeof history1)[number]>[] = [
    { key: "ts", header: "Time", render: (s) => fmtTs(s.ts) },
    { key: "loss", header: "Loss", render: (s) => `${s.loss}%` },
    { key: "latency", header: "Latency", render: (s) => `${s.latency} ms` },
    { key: "jitter", header: "Jitter", render: (s) => `${s.jitter} ms` },
    {
      key: "failover",
      header: "Failover",
      render: (s) => (s.failoverTriggered ? <StatusPill tone="crit">Triggered</StatusPill> : <span className={styles.small}>-</span>),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Appliance status</b>
      </div>
      <h1 className={styles.pageH}>Appliance status &mdash; {mx.name}</h1>

      <StatRow
        stats={[
          { label: "Status", value: mx.status === "online" ? "Online" : mx.status, sub: `${mx.uptimeDays} days uptime` },
          { label: "Active sessions", value: mx.sessions ?? 0, sub: `${mx.cpuPct ?? 0}% CPU / ${mx.memPct ?? 0}% RAM` },
          { label: "Public IP (WAN1)", value: wan1?.publicIp ?? "-", sub: wan1?.isp },
          { label: "Public IP (WAN2)", value: wan2?.publicIp ?? "-", sub: wan2 ? `${wan2.isp} (${wan2.status})` : undefined },
        ]}
      />

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={sampleNow}>
            Sample now
          </button>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardH}>Hardware</div>
          <div className={styles.cardB}>
            <dl className={styles.kv}>
              <dt>Model</dt>
              <dd>{mx.model}</dd>
              <dt>Serial</dt>
              <dd className={styles.mono}>{mx.serial}</dd>
              <dt>Firmware</dt>
              <dd>{mx.firmware}</dd>
              <dt>LAN IP</dt>
              <dd className={styles.mono}>{mx.lanIp}</dd>
              <dt>Last reboot</dt>
              <dd>{fmtTs(mx.lastReboot)}</dd>
              <dt>Tags</dt>
              <dd>
                {(mx.tags || []).map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
              </dd>
            </dl>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardH}>Uplinks</div>
          <div className={`${styles.cardB} ${styles.cardBDense}`}>
            <DataTable
              columns={[
                { key: "uplink", header: "Uplink", render: (u: { label: string; link: typeof wan1 }) => u.label },
                { key: "isp", header: "ISP", render: (u) => u.link?.isp ?? "-" },
                { key: "ip", header: "Public IP", render: (u) => <span className={styles.mono}>{u.link?.publicIp ?? "-"}</span> },
                {
                  key: "state",
                  header: "State",
                  render: (u) => (u.link ? <StatusPill tone={statusTone(u.link.status)}>{u.link.status}</StatusPill> : "-"),
                },
                {
                  key: "quality",
                  header: "Loss / Lat / Jit",
                  render: (u) => (u.link ? `${u.link.loss}% / ${u.link.latency}ms / ${u.link.jitter}ms` : "-"),
                },
                { key: "usage", header: "Usage (24h)", render: (u) => (u.link ? `${u.link.usage} GB` : "-") },
              ]}
              rows={[
                { label: "WAN 1", link: wan1 },
                { label: "WAN 2", link: wan2 },
              ]}
              getRowKey={(u) => u.label}
              dense
            />
          </div>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardH}>WAN 1 recent history ({history1.length} samples)</div>
          <div className={styles.cardB}>
            <div className={styles.mb8}>
              <Sparkline data={history1.map((s) => s.latency)} color="#5cb85c" />
              <span className={styles.small}> latency (ms)</span>
            </div>
            <DataTable columns={historyColumns} rows={history1.slice().reverse()} getRowKey={(s) => `${s.ts}-wan1`} dense emptyMessage="No samples yet." />
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardH}>WAN 2 recent history ({history2.length} samples)</div>
          <div className={styles.cardB}>
            {wan2 ? (
              <>
                <div className={styles.mb8}>
                  <Sparkline data={history2.map((s) => s.latency)} color="#5bc0de" />
                  <span className={styles.small}> latency (ms)</span>
                </div>
                <DataTable
                  columns={historyColumns}
                  rows={history2.slice().reverse()}
                  getRowKey={(s) => `${s.ts}-wan2`}
                  dense
                  emptyMessage="No samples yet."
                />
              </>
            ) : (
              <EmptyState message="No WAN2 uplink on this appliance." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 2. Security center (flagship real threat feed)
// ===================================================================

export function SecCenterPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  const events = useMemo(
    () =>
      state.threatEvents
        .filter((e) => e.networkId === state.currentNetworkId)
        .slice()
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    [state.threatEvents, state.currentNetworkId],
  );

  const blockedCount = events.filter((e) => e.action === "blocked").length;
  const alertedCount = events.filter((e) => e.action === "alerted").length;

  function generateEvent() {
    dispatch({ type: "GENERATE_THREAT_EVENT", networkId: state.currentNetworkId, seed: nextEngineSeed(), nowIso: new Date().toISOString() });
    toast.success("Generated a new threat event from current firewall/content-filter state.");
  }

  const columns: DataTableColumn<(typeof events)[number]>[] = [
    { key: "ts", header: "Time", render: (e) => fmtTs(e.ts) },
    { key: "severity", header: "Severity", render: (e) => <StatusPill tone={statusTone(e.severity)}>{e.severity}</StatusPill> },
    { key: "category", header: "Category", render: (e) => e.category },
    { key: "signature", header: "Signature", render: (e) => e.signature },
    { key: "src", header: "Source", render: (e) => <span className={styles.mono}>{e.srcIp}</span> },
    { key: "dest", header: "Destination", render: (e) => <span className={styles.mono}>{e.destIp}</span> },
    { key: "action", header: "Action", render: (e) => <StatusPill tone={statusTone(e.action)}>{e.action}</StatusPill> },
    {
      key: "rule",
      header: "Matched rule",
      render: (e) => (e.matchedRuleId ? <span className={styles.mono}>{e.matchedRuleId}</span> : <span className={styles.small}>Content filter / none</span>),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Security center</b>
      </div>
      <h1 className={styles.pageH}>Security center</h1>

      <StatRow
        stats={[
          { label: "Total events", value: events.length },
          { label: "Blocked", value: blockedCount },
          { label: "Alerted (unblocked)", value: alertedCount },
          { label: "IPS signature version", value: "36811", sub: "Updated 2 hours ago" },
        ]}
      />

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={generateEvent}>
            Generate event
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Recent threats (Snort IPS + AMP + content filter)</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={events} getRowKey={(e) => e.id} dense emptyMessage="No threat events for this network yet." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 3. VPN status
// ===================================================================

export function SecVpnStatusPage({ state }: { state: MerakiState }) {
  const mx = currentAppliance(state);

  // Relevance to the current network: peers whose own networkId matches (this
  // network's MX as a spoke/hub endpoint), plus every other peer (since
  // AutoVPN is hub-and-spoke and this network's MX may terminate tunnels to
  // ALL of them) — mirrors source's renderVpnStatus(), which always listed
  // MerakiData.state.vpn.siteToSite in full regardless of network.
  const relevantPeers = state.vpn.siteToSite;

  const peerColumns: DataTableColumn<MerakiVpnPeer>[] = [
    { key: "name", header: "Peer", render: (p) => p.name },
    { key: "ip", header: "Public IP", render: (p) => <span className={styles.mono}>{p.publicIp}</span> },
    { key: "status", header: "Status", render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill> },
    { key: "subnets", header: "Private subnets", render: (p) => p.privateSubnets.join(", ") },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>VPN status</b>
      </div>
      <h1 className={styles.pageH}>VPN status</h1>

      <StatRow
        stats={[
          { label: "This appliance", value: mx?.name ?? "-" },
          { label: "Site-to-site peers", value: relevantPeers.length },
          { label: "Peers up", value: relevantPeers.filter((p) => p.status === "active").length },
          { label: "Peers down", value: relevantPeers.filter((p) => p.status === "down").length },
        ]}
      />

      <div className={styles.card}>
        <div className={styles.cardH}>Site-to-site (AutoVPN) peers</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={peerColumns} rows={relevantPeers} getRowKey={(p) => p.id} dense emptyMessage="No site-to-site VPN peers configured." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 4. Addressing & VLANs — canonical state.vlans[]
// ===================================================================

type VlanDraft = { id: string; name: string; subnet: string; mxIp: string; groupPolicy: string; dhcpMode: string };

function emptyVlanDraft(): VlanDraft {
  return { id: "", name: "", subnet: "", mxIp: "", groupPolicy: "", dhcpMode: "Run on MX" };
}

function vlanToDraft(v: MerakiVlan): VlanDraft {
  return { id: String(v.id), name: v.name, subnet: v.subnet, mxIp: v.mxIp, groupPolicy: v.groupPolicy ?? "", dhcpMode: v.dhcpMode };
}

export function SecAddressingVlansPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  const vlans = useMemo(
    () => state.vlans.filter((v) => v.networkId === state.currentNetworkId).slice().sort((a, b) => a.id - b.id),
    [state.vlans, state.currentNetworkId],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editVlan, setEditVlan] = useState<MerakiVlan | null>(null);
  const [deleteVlan, setDeleteVlan] = useState<MerakiVlan | null>(null);
  const [draft, setDraft] = useState<VlanDraft>(emptyVlanDraft());

  function openAdd() {
    setDraft(emptyVlanDraft());
    setAddOpen(true);
  }
  function openEdit(v: MerakiVlan) {
    setDraft(vlanToDraft(v));
    setEditVlan(v);
  }

  function saveAdd() {
    const id = Number.parseInt(draft.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      toast.warning("Enter a valid VLAN ID.");
      return;
    }
    if (!draft.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    if (vlans.some((v) => v.id === id)) {
      toast.warning(`VLAN ${id} already exists in this network.`);
      return;
    }
    const vlan: MerakiVlan = {
      id,
      networkId: state.currentNetworkId,
      name: draft.name.trim(),
      subnet: draft.subnet.trim() || "0.0.0.0/24",
      mxIp: draft.mxIp.trim() || "0.0.0.1",
      groupPolicy: draft.groupPolicy.trim() ? draft.groupPolicy.trim() : null,
      dhcpMode: draft.dhcpMode.trim() || "Run on MX",
    };
    dispatch({ type: "ADD_VLAN", vlan });
    toast.success(`VLAN ${vlan.id} (${vlan.name}) added.`);
    setAddOpen(false);
  }

  function saveEdit() {
    if (!editVlan) return;
    dispatch({
      type: "UPDATE_VLAN",
      networkId: state.currentNetworkId,
      vlanId: editVlan.id,
      patch: {
        name: draft.name.trim(),
        subnet: draft.subnet.trim(),
        mxIp: draft.mxIp.trim(),
        groupPolicy: draft.groupPolicy.trim() ? draft.groupPolicy.trim() : null,
        dhcpMode: draft.dhcpMode.trim(),
      },
    });
    toast.success(`VLAN ${editVlan.id} updated.`);
    setEditVlan(null);
  }

  function confirmDelete() {
    if (!deleteVlan) return;
    dispatch({ type: "DELETE_VLAN", networkId: state.currentNetworkId, vlanId: deleteVlan.id });
    toast.success(`VLAN ${deleteVlan.id} deleted.`);
    setDeleteVlan(null);
  }

  const columns: DataTableColumn<MerakiVlan>[] = [
    { key: "id", header: "VLAN ID", render: (v) => v.id },
    { key: "name", header: "Name", render: (v) => v.name },
    { key: "subnet", header: "Subnet", render: (v) => <span className={styles.mono}>{v.subnet}</span> },
    { key: "mxIp", header: "MX IP", render: (v) => <span className={styles.mono}>{v.mxIp}</span> },
    { key: "policy", header: "Group policy", render: (v) => (v.groupPolicy ? <span className={styles.tag}>{v.groupPolicy}</span> : <span className={styles.small}>None</span>) },
    { key: "dhcp", header: "DHCP", render: (v) => v.dhcpMode },
    {
      key: "actions",
      header: "",
      render: (v) => (
        <div className={styles.flex}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => openEdit(v)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteVlan(v)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Addressing &amp; VLANs</b>
      </div>
      <h1 className={styles.pageH}>Addressing &amp; VLANs</h1>

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openAdd}>
            + Add VLAN
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={vlans} getRowKey={(v) => `${v.networkId}-${v.id}`} dense emptyMessage="No VLANs configured for this network." />
        </div>
      </div>

      {addOpen ? (
        <Modal
          title="Add VLAN"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAdd}>
                Add
              </button>
            </>
          }
        >
          <VlanForm draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} idEditable />
        </Modal>
      ) : null}

      {editVlan ? (
        <Modal
          title={`Edit VLAN ${editVlan.id}`}
          onClose={() => setEditVlan(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setEditVlan(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveEdit}>
                Save
              </button>
            </>
          }
        >
          <VlanForm draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} idEditable={false} />
        </Modal>
      ) : null}

      {deleteVlan ? (
        <Modal
          title="Delete VLAN"
          onClose={() => setDeleteVlan(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setDeleteVlan(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={confirmDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete VLAN <strong>{deleteVlan.id}</strong> ({deleteVlan.name})? This cannot be undone.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function VlanForm({ draft, onChange, idEditable }: { draft: VlanDraft; onChange: (patch: Partial<VlanDraft>) => void; idEditable: boolean }) {
  return (
    <>
      <Field label="VLAN ID">
        <input
          className={`${styles.input} ${styles.full}`}
          value={draft.id}
          disabled={!idEditable}
          placeholder="e.g. 60"
          onChange={(e) => onChange({ id: e.target.value })}
        />
      </Field>
      <Field label="Name">
        <input className={`${styles.input} ${styles.full}`} value={draft.name} placeholder="e.g. Contractors" onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Subnet">
        <input className={`${styles.input} ${styles.full}`} value={draft.subnet} placeholder="10.0.60.0/24" onChange={(e) => onChange({ subnet: e.target.value })} />
      </Field>
      <Field label="MX IP">
        <input className={`${styles.input} ${styles.full}`} value={draft.mxIp} placeholder="10.0.60.1" onChange={(e) => onChange({ mxIp: e.target.value })} />
      </Field>
      <Field label="Group policy" help="Leave blank for none.">
        <input className={`${styles.input} ${styles.full}`} value={draft.groupPolicy} placeholder="e.g. Guest-Limited" onChange={(e) => onChange({ groupPolicy: e.target.value })} />
      </Field>
      <Field label="DHCP">
        <input
          className={`${styles.input} ${styles.full}`}
          value={draft.dhcpMode}
          placeholder="Run on MX (10.0.60.20-200)"
          onChange={(e) => onChange({ dhcpMode: e.target.value })}
        />
      </Field>
    </>
  );
}

// ===================================================================
// 5. NAT (port forwards)
// ===================================================================

type PortForwardDraft = {
  name: string;
  protocol: "tcp" | "udp";
  publicPort: string;
  lanIp: string;
  localPort: string;
  allowedRemote: string;
};

function emptyPfDraft(): PortForwardDraft {
  return { name: "", protocol: "tcp", publicPort: "", lanIp: "", localPort: "", allowedRemote: "Any" };
}

function pfToDraft(p: MerakiPortForward): PortForwardDraft {
  return { name: p.name, protocol: p.protocol, publicPort: p.publicPort, lanIp: p.lanIp, localPort: p.localPort, allowedRemote: p.allowedRemote };
}

export function SecNatPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<MerakiPortForward | null>(null);
  const [deleteRow, setDeleteRow] = useState<MerakiPortForward | null>(null);
  const [draft, setDraft] = useState<PortForwardDraft>(emptyPfDraft());

  function openAdd() {
    setDraft(emptyPfDraft());
    setAddOpen(true);
  }
  function openEdit(p: MerakiPortForward) {
    setDraft(pfToDraft(p));
    setEditRow(p);
  }

  function saveAdd() {
    if (!draft.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    const portForward: MerakiPortForward = {
      id: `pf-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      protocol: draft.protocol,
      publicPort: draft.publicPort.trim() || "443",
      lanIp: draft.lanIp.trim() || "10.0.50.99",
      localPort: draft.localPort.trim() || "443",
      allowedRemote: draft.allowedRemote.trim() || "Any",
      enabled: true,
    };
    dispatch({ type: "ADD_PORT_FORWARD", portForward });
    toast.success("Port forward added.");
    setAddOpen(false);
  }

  function saveEdit() {
    if (!editRow) return;
    dispatch({
      type: "UPDATE_PORT_FORWARD",
      id: editRow.id,
      patch: {
        name: draft.name.trim(),
        protocol: draft.protocol,
        publicPort: draft.publicPort.trim(),
        lanIp: draft.lanIp.trim(),
        localPort: draft.localPort.trim(),
        allowedRemote: draft.allowedRemote.trim(),
      },
    });
    toast.success("Port forward updated.");
    setEditRow(null);
  }

  function confirmDelete() {
    if (!deleteRow) return;
    dispatch({ type: "DELETE_PORT_FORWARD", id: deleteRow.id });
    toast.success("Port forward deleted.");
    setDeleteRow(null);
  }

  function toggleRow(p: MerakiPortForward) {
    dispatch({ type: "TOGGLE_PORT_FORWARD", id: p.id });
    toast.success(`${p.name} ${p.enabled ? "disabled" : "enabled"}.`);
  }

  const columns: DataTableColumn<MerakiPortForward>[] = [
    { key: "name", header: "Name", render: (p) => p.name },
    { key: "proto", header: "Proto", render: (p) => p.protocol.toUpperCase() },
    { key: "pub", header: "Public port", render: (p) => p.publicPort },
    { key: "internal", header: "Internal", render: (p) => <span className={styles.mono}>{p.lanIp}:{p.localPort}</span> },
    { key: "allowed", header: "Allowed sources", render: (p) => <span className={styles.mono}>{p.allowedRemote}</span> },
    { key: "state", header: "State", render: (p) => <StatusPill tone={p.enabled ? "ok" : "muted"}>{p.enabled ? "Enabled" : "Disabled"}</StatusPill> },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className={styles.flex}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => openEdit(p)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => toggleRow(p)}>
            {p.enabled ? "Disable" : "Enable"}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteRow(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>NAT</b>
      </div>
      <h1 className={styles.pageH}>NAT</h1>

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openAdd}>
            + Add port forward
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Port forwarding</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={state.nat.portForwards} getRowKey={(p) => p.id} dense emptyMessage="No port forwards configured." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>1:1 NAT</div>
        <div className={`${styles.cardB} ${styles.small}`}>Read-only in this simulator. No 1:1 NAT entries configured.</div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardH}>1:Many NAT</div>
        <div className={`${styles.cardB} ${styles.small}`}>
          Read-only in this simulator. Useful for sharing a single public IP across multiple internal services on different external ports.
        </div>
      </div>

      {addOpen ? (
        <Modal
          title="Add port forward"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAdd}>
                Add
              </button>
            </>
          }
        >
          <PortForwardForm draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        </Modal>
      ) : null}

      {editRow ? (
        <Modal
          title={`Edit ${editRow.name}`}
          onClose={() => setEditRow(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setEditRow(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveEdit}>
                Save
              </button>
            </>
          }
        >
          <PortForwardForm draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        </Modal>
      ) : null}

      {deleteRow ? (
        <Modal
          title="Delete port forward"
          onClose={() => setDeleteRow(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setDeleteRow(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={confirmDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete port forward <strong>{deleteRow.name}</strong>?
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function PortForwardForm({ draft, onChange }: { draft: PortForwardDraft; onChange: (patch: Partial<PortForwardDraft>) => void }) {
  return (
    <>
      <Field label="Name">
        <input className={`${styles.input} ${styles.full}`} value={draft.name} placeholder="e.g. App server" onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Protocol">
        <NativeSelect
          value={draft.protocol}
          onChange={(v) => onChange({ protocol: v as "tcp" | "udp" })}
          options={[
            { value: "tcp", label: "tcp" },
            { value: "udp", label: "udp" },
          ]}
        />
      </Field>
      <Field label="Public port">
        <input className={styles.input} value={draft.publicPort} placeholder="e.g. 8443" onChange={(e) => onChange({ publicPort: e.target.value })} />
      </Field>
      <Field label="Internal IP">
        <input className={`${styles.input} ${styles.full}`} value={draft.lanIp} placeholder="10.0.50.x" onChange={(e) => onChange({ lanIp: e.target.value })} />
      </Field>
      <Field label="Internal port">
        <input className={styles.input} value={draft.localPort} placeholder="443" onChange={(e) => onChange({ localPort: e.target.value })} />
      </Field>
      <Field label="Allowed sources">
        <input className={`${styles.input} ${styles.full}`} value={draft.allowedRemote} placeholder="Any" onChange={(e) => onChange({ allowedRemote: e.target.value })} />
      </Field>
    </>
  );
}

// ===================================================================
// 6. Site-to-site VPN
// ===================================================================

type VpnPeerDraft = { name: string; publicIp: string; subnets: string };

function emptyPeerDraft(): VpnPeerDraft {
  return { name: "", publicIp: "", subnets: "" };
}

export function SecSiteToSiteVpnPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  const [addOpen, setAddOpen] = useState(false);
  const [deletePeer, setDeletePeer] = useState<MerakiVpnPeer | null>(null);
  const [draft, setDraft] = useState<VpnPeerDraft>(emptyPeerDraft());

  function openAdd() {
    setDraft(emptyPeerDraft());
    setAddOpen(true);
  }

  function saveAdd() {
    if (!draft.name.trim()) {
      toast.warning("Name is required.");
      return;
    }
    const subnets = draft.subnets
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const peer: MerakiVpnPeer = {
      id: `vpn-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      networkId: state.currentNetworkId,
      publicIp: draft.publicIp.trim() || "0.0.0.0",
      status: "active",
      privateSubnets: subnets.length ? subnets : ["0.0.0.0/24"],
    };
    dispatch({ type: "ADD_VPN_PEER", peer });
    toast.success(`Peer "${peer.name}" added.`);
    setAddOpen(false);
  }

  function confirmDelete() {
    if (!deletePeer) return;
    dispatch({ type: "DELETE_VPN_PEER", id: deletePeer.id });
    toast.success("Peer deleted.");
    setDeletePeer(null);
  }

  const columns: DataTableColumn<MerakiVpnPeer>[] = [
    { key: "name", header: "Name", render: (p) => p.name },
    { key: "ip", header: "Public IP", render: (p) => <span className={styles.mono}>{p.publicIp}</span> },
    { key: "status", header: "Status", render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill> },
    { key: "subnets", header: "Private subnets", render: (p) => p.privateSubnets.join(", ") },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeletePeer(p)}>
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Site-to-site VPN</b>
      </div>
      <h1 className={styles.pageH}>Site-to-site VPN</h1>

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openAdd}>
            + Add peer
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>AutoVPN / Non-Meraki peers</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={state.vpn.siteToSite} getRowKey={(p) => p.id} dense emptyMessage="No VPN peers configured." />
        </div>
      </div>

      {addOpen ? (
        <Modal
          title="Add peer"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAdd}>
                Add
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={`${styles.input} ${styles.full}`} value={draft.name} placeholder="aws-vpc-vpn" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </Field>
          <Field label="Public IP">
            <input
              className={`${styles.input} ${styles.full}`}
              value={draft.publicIp}
              placeholder="52.x.x.x"
              onChange={(e) => setDraft((d) => ({ ...d, publicIp: e.target.value }))}
            />
          </Field>
          <Field label="Remote subnets" help="Comma-separated CIDRs.">
            <input
              className={`${styles.input} ${styles.full}`}
              value={draft.subnets}
              placeholder="172.16.0.0/16, 172.17.0.0/16"
              onChange={(e) => setDraft((d) => ({ ...d, subnets: e.target.value }))}
            />
          </Field>
        </Modal>
      ) : null}

      {deletePeer ? (
        <Modal
          title="Delete peer"
          onClose={() => setDeletePeer(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setDeletePeer(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={confirmDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete VPN peer <strong>{deletePeer.name}</strong>?
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// 7. Routing — static/summary page, matches source's fidelity
// ===================================================================

export function SecRoutingPage({ state }: { state: MerakiState }) {
  const mx = currentAppliance(state);
  const vlans = state.vlans.filter((v) => v.networkId === state.currentNetworkId);

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Routing</b>
      </div>
      <h1 className={styles.pageH}>MX Routing</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>VLAN interfaces (advertised locally)</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "id", header: "VLAN", render: (v: MerakiVlan) => v.id },
              { key: "name", header: "Name", render: (v: MerakiVlan) => v.name },
              { key: "subnet", header: "Subnet", render: (v: MerakiVlan) => <span className={styles.mono}>{v.subnet}</span> },
              { key: "mxIp", header: "Next hop (MX)", render: (v: MerakiVlan) => <span className={styles.mono}>{v.mxIp}</span> },
            ]}
            rows={vlans}
            getRowKey={(v) => `${v.networkId}-${v.id}`}
            dense
            emptyMessage="No VLANs configured for this network."
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>OSPF (advertise networks to LAN core)</div>
        <div className={styles.cardB}>
          <div className={styles.formrow}>
            <label>OSPF on MX</label>
            <span className={styles.small}>Disabled</span>
          </div>
          <div className={styles.formrow}>
            <label>Router ID</label>
            <span className={styles.mono}>{mx?.lanIp ?? "-"}</span>
          </div>
          <div className={styles.formrow}>
            <label>Area</label>
            <span className={styles.mono}>0.0.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 8. Firewall (L3 + L7)
// ===================================================================

type L3Draft = {
  policy: "allow" | "deny";
  protocol: string;
  srcCidr: string;
  srcPort: string;
  destCidr: string;
  destPort: string;
  comment: string;
};

function emptyL3Draft(): L3Draft {
  return { policy: "allow", protocol: "tcp", srcCidr: "Any", srcPort: "Any", destCidr: "Any", destPort: "Any", comment: "" };
}

type L7Draft = { type: string; value: string; comment: string };

function emptyL7Draft(): L7Draft {
  return { type: "application", value: "", comment: "" };
}

export function SecFirewallPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  const [addL3Open, setAddL3Open] = useState(false);
  const [addL7Open, setAddL7Open] = useState(false);
  const [editL3, setEditL3] = useState<MerakiFirewallL3Rule | null>(null);
  const [editL7, setEditL7] = useState<MerakiFirewallL7Rule | null>(null);
  const [deleteL3, setDeleteL3] = useState<MerakiFirewallL3Rule | null>(null);
  const [deleteL7, setDeleteL7] = useState<MerakiFirewallL7Rule | null>(null);
  const [l3Draft, setL3Draft] = useState<L3Draft>(emptyL3Draft());
  const [l7Draft, setL7Draft] = useState<L7Draft>(emptyL7Draft());

  function openAddL3() {
    setL3Draft(emptyL3Draft());
    setAddL3Open(true);
  }
  function openEditL3(r: MerakiFirewallL3Rule) {
    setL3Draft({ policy: r.policy, protocol: r.protocol, srcCidr: r.srcCidr, srcPort: r.srcPort, destCidr: r.destCidr, destPort: r.destPort, comment: r.comment });
    setEditL3(r);
  }
  function openAddL7() {
    setL7Draft(emptyL7Draft());
    setAddL7Open(true);
  }
  function openEditL7(r: MerakiFirewallL7Rule) {
    setL7Draft({ type: r.type, value: r.value, comment: r.comment });
    setEditL7(r);
  }

  function saveAddL3() {
    const rule: MerakiFirewallL3Rule = {
      id: `fw3-${Date.now().toString(36)}`,
      policy: l3Draft.policy,
      protocol: l3Draft.protocol || "any",
      srcCidr: l3Draft.srcCidr || "Any",
      srcPort: l3Draft.srcPort || "Any",
      destCidr: l3Draft.destCidr || "Any",
      destPort: l3Draft.destPort || "Any",
      comment: l3Draft.comment,
      enabled: true,
    };
    // Real dispatch against the now crash-free reducer action — source's
    // `_addL3Rule` called the nonexistent `MerakiPortal.rerender()` here.
    dispatch({ type: "ADD_FIREWALL_L3_RULE", rule });
    toast.success("L3 rule added.");
    setAddL3Open(false);
  }

  function saveEditL3() {
    if (!editL3) return;
    dispatch({ type: "UPDATE_FIREWALL_L3_RULE", ruleId: editL3.id, patch: { ...l3Draft } });
    toast.success("L3 rule updated.");
    setEditL3(null);
  }

  function saveAddL7() {
    if (!l7Draft.value.trim()) {
      toast.warning("Value is required.");
      return;
    }
    const rule: MerakiFirewallL7Rule = {
      id: `fw7-${Date.now().toString(36)}`,
      type: l7Draft.type || "application",
      value: l7Draft.value.trim(),
      policy: "deny",
      comment: l7Draft.comment,
    };
    dispatch({ type: "ADD_FIREWALL_L7_RULE", rule });
    toast.success("L7 rule added.");
    setAddL7Open(false);
  }

  function saveEditL7() {
    if (!editL7) return;
    dispatch({ type: "UPDATE_FIREWALL_L7_RULE", ruleId: editL7.id, patch: { type: l7Draft.type, value: l7Draft.value.trim(), comment: l7Draft.comment } });
    toast.success("L7 rule updated.");
    setEditL7(null);
  }

  function toggleL3(r: MerakiFirewallL3Rule) {
    dispatch({ type: "TOGGLE_FIREWALL_L3_RULE", ruleId: r.id });
    toast.success(`Rule #${r.id} ${r.enabled ? "disabled" : "enabled"}.`);
  }

  const l3Columns: DataTableColumn<MerakiFirewallL3Rule>[] = [
    { key: "id", header: "#", render: (r) => <span className={styles.mono}>{r.id}</span> },
    { key: "policy", header: "Policy", render: (r) => <StatusPill tone={r.policy === "allow" ? "ok" : "crit"}>{r.policy}</StatusPill> },
    { key: "proto", header: "Proto", render: (r) => r.protocol },
    { key: "src", header: "Source", render: (r) => <span className={styles.mono}>{r.srcCidr}:{r.srcPort}</span> },
    { key: "dest", header: "Destination", render: (r) => <span className={styles.mono}>{r.destCidr}:{r.destPort}</span> },
    { key: "comment", header: "Comment", render: (r) => r.comment },
    { key: "state", header: "State", render: (r) => <StatusPill tone={r.enabled ? "ok" : "muted"}>{r.enabled ? "On" : "Off"}</StatusPill> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className={styles.flex}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => openEditL3(r)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => toggleL3(r)}>
            {r.enabled ? "Disable" : "Enable"}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteL3(r)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  const l7Columns: DataTableColumn<MerakiFirewallL7Rule>[] = [
    { key: "id", header: "#", render: (r) => <span className={styles.mono}>{r.id}</span> },
    { key: "type", header: "Type", render: (r) => r.type },
    { key: "value", header: "Application / category", render: (r) => r.value },
    { key: "policy", header: "Policy", render: (r) => <StatusPill tone="crit">{r.policy}</StatusPill> },
    { key: "comment", header: "Comment", render: (r) => r.comment },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className={styles.flex}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => openEditL7(r)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteL7(r)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Firewall</b>
      </div>
      <h1 className={styles.pageH}>Firewall (MX)</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>Layer 3 firewall rules (LAN -&gt; Internet)</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={l3Columns} rows={state.firewallL3} getRowKey={(r) => r.id} dense emptyMessage="No L3 rules." />
        </div>
      </div>
      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openAddL3}>
            + Add L3 rule
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Layer 7 firewall rules (block applications)</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={l7Columns} rows={state.firewallL7} getRowKey={(r) => r.id} dense emptyMessage="No L7 rules." />
        </div>
      </div>
      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openAddL7}>
            + Add L7 rule
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Inbound from Internet</div>
        <div className={`${styles.cardB} ${styles.small}`}>
          Inbound rules are managed under <strong>NAT (Port forwarding, 1:1, 1:Many)</strong>. Use that page to publish a service.
        </div>
      </div>

      {addL3Open ? (
        <Modal
          title="Add L3 rule"
          onClose={() => setAddL3Open(false)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setAddL3Open(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAddL3}>
                Add
              </button>
            </>
          }
        >
          <L3Form draft={l3Draft} onChange={(patch) => setL3Draft((d) => ({ ...d, ...patch }))} />
        </Modal>
      ) : null}

      {editL3 ? (
        <Modal
          title={`Edit L3 rule #${editL3.id}`}
          onClose={() => setEditL3(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setEditL3(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveEditL3}>
                Save
              </button>
            </>
          }
        >
          <L3Form draft={l3Draft} onChange={(patch) => setL3Draft((d) => ({ ...d, ...patch }))} />
        </Modal>
      ) : null}

      {deleteL3 ? (
        <Modal
          title="Delete L3 rule"
          onClose={() => setDeleteL3(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setDeleteL3(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => {
                  dispatch({ type: "DELETE_FIREWALL_L3_RULE", ruleId: deleteL3.id });
                  toast.success("L3 rule deleted.");
                  setDeleteL3(null);
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete L3 rule <strong>#{deleteL3.id}</strong> ({deleteL3.comment || "no comment"})?
          </p>
        </Modal>
      ) : null}

      {addL7Open ? (
        <Modal
          title="Add L7 rule"
          onClose={() => setAddL7Open(false)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setAddL7Open(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAddL7}>
                Add
              </button>
            </>
          }
        >
          <L7Form draft={l7Draft} onChange={(patch) => setL7Draft((d) => ({ ...d, ...patch }))} />
        </Modal>
      ) : null}

      {editL7 ? (
        <Modal
          title={`Edit L7 rule #${editL7.id}`}
          onClose={() => setEditL7(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setEditL7(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveEditL7}>
                Save
              </button>
            </>
          }
        >
          <L7Form draft={l7Draft} onChange={(patch) => setL7Draft((d) => ({ ...d, ...patch }))} />
        </Modal>
      ) : null}

      {deleteL7 ? (
        <Modal
          title="Delete L7 rule"
          onClose={() => setDeleteL7(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setDeleteL7(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => {
                  dispatch({ type: "DELETE_FIREWALL_L7_RULE", ruleId: deleteL7.id });
                  toast.success("L7 rule deleted.");
                  setDeleteL7(null);
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete L7 rule <strong>#{deleteL7.id}</strong> ({deleteL7.value})?
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function L3Form({ draft, onChange }: { draft: L3Draft; onChange: (patch: Partial<L3Draft>) => void }) {
  return (
    <>
      <Field label="Policy">
        <NativeSelect
          value={draft.policy}
          onChange={(v) => onChange({ policy: v as "allow" | "deny" })}
          options={[
            { value: "allow", label: "allow" },
            { value: "deny", label: "deny" },
          ]}
        />
      </Field>
      <Field label="Protocol">
        <NativeSelect
          value={draft.protocol}
          onChange={(v) => onChange({ protocol: v })}
          options={[
            { value: "any", label: "any" },
            { value: "tcp", label: "tcp" },
            { value: "udp", label: "udp" },
            { value: "icmp", label: "icmp" },
          ]}
        />
      </Field>
      <Field label="Source CIDR">
        <input className={`${styles.input} ${styles.full}`} value={draft.srcCidr} placeholder="10.0.0.0/24" onChange={(e) => onChange({ srcCidr: e.target.value })} />
      </Field>
      <Field label="Source port">
        <input className={styles.input} value={draft.srcPort} placeholder="Any" onChange={(e) => onChange({ srcPort: e.target.value })} />
      </Field>
      <Field label="Destination CIDR">
        <input className={`${styles.input} ${styles.full}`} value={draft.destCidr} placeholder="0.0.0.0/0" onChange={(e) => onChange({ destCidr: e.target.value })} />
      </Field>
      <Field label="Destination port">
        <input className={styles.input} value={draft.destPort} placeholder="e.g. 443, 80" onChange={(e) => onChange({ destPort: e.target.value })} />
      </Field>
      <Field label="Comment">
        <input className={`${styles.input} ${styles.full}`} value={draft.comment} placeholder="New rule" onChange={(e) => onChange({ comment: e.target.value })} />
      </Field>
    </>
  );
}

function L7Form({ draft, onChange }: { draft: L7Draft; onChange: (patch: Partial<L7Draft>) => void }) {
  return (
    <>
      <Field label="Type">
        <NativeSelect
          value={draft.type}
          onChange={(v) => onChange({ type: v })}
          options={[
            { value: "application", label: "application" },
            { value: "application-category", label: "applicationCategory" },
            { value: "host", label: "host" },
            { value: "port", label: "port" },
            { value: "ipRange", label: "ipRange" },
          ]}
        />
      </Field>
      <Field label="Value" help='e.g. "BitTorrent" or "*.example.com"'>
        <input className={`${styles.input} ${styles.full}`} value={draft.value} onChange={(e) => onChange({ value: e.target.value })} />
      </Field>
      <Field label="Comment">
        <input className={`${styles.input} ${styles.full}`} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} />
      </Field>
    </>
  );
}

// ===================================================================
// 9. Content filtering
// ===================================================================

const ALL_CATEGORIES = [
  "Abortion", "Adult and Pornography", "Alcohol and Tobacco", "Auctions", "Business and Economy",
  "Computer and Internet Info", "Computer and Internet Security", "Cult and Occult", "Dating",
  "Dynamically Generated Content", "Educational Institutions", "Entertainment and Arts",
  "Fashion and Beauty", "Financial Services", "Gambling", "Games", "Government", "Gross",
  "Hacking", "Hate Speech", "Health and Medicine", "Hunting and Fishing", "Illegal",
  "Illegal Drugs", "Image and Video Search", "Job Search", "Local Information", "Malware Sites",
  "Marijuana", "Military", "Motor Vehicles", "Music", "News and Media", "Nudity", "Online Greeting Cards",
  "Online Personal Storage", "P2P", "Parked Domains", "Pay to Surf", "Personal sites and Blogs",
  "Philosophy and Political Advocacy", "Phishing and Other Frauds", "Private IP Addresses",
  "Proxy Avoidance and Anonymizers", "Questionable", "Real Estate", "Recreation and Hobbies",
  "Reference and Research", "Religion", "SPAM URLs", "Search Engines", "Sex Education",
  "Shareware and Freeware", "Shopping", "Social Networking", "Society", "Sports", "Stock Advice and Tools",
  "Streaming Media", "Swimsuits and Intimate Apparel", "Training and Tools", "Translation",
  "Travel", "Unconfirmed SPAM Sources", "Violence", "Weapons", "Web Advertisements",
  "Web Hosting Sites", "Web-based Email",
] as const;

export function SecContentFilteringPage({ state, dispatch }: { state: MerakiState; dispatch: Dispatch }) {
  // Real, locally-held form state seeded from state.contentFiltering — Save
  // dispatches exactly what's currently in this state, fixing source's bug
  // where the Save button never read the checkboxes/textareas at all.
  const [blockedCategories, setBlockedCategories] = useState<string[]>(state.contentFiltering.blockedCategories);
  const [blockedUrlPatterns, setBlockedUrlPatterns] = useState(state.contentFiltering.blockedUrlPatterns.join("\n"));
  const [allowedUrlPatterns, setAllowedUrlPatterns] = useState(state.contentFiltering.allowedUrlPatterns.join("\n"));

  function toggleCategory(cat: string, checked: boolean) {
    setBlockedCategories((prev) => (checked ? [...prev, cat] : prev.filter((c) => c !== cat)));
  }

  function save() {
    const patch: Partial<MerakiState["contentFiltering"]> = {
      blockedCategories,
      blockedUrlPatterns: blockedUrlPatterns
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      allowedUrlPatterns: allowedUrlPatterns
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    // FIXES source's Save button: it never read these fields back into state.
    dispatch({ type: "UPDATE_CONTENT_FILTERING", patch });
    toast.success("Content filtering saved.");
  }

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>Content filtering</b>
      </div>
      <h1 className={styles.pageH}>Content filtering</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>URL pattern lists</div>
        <div className={styles.cardB}>
          <Field label="Blocked URL patterns" help="One pattern per line.">
            <textarea className={styles.textarea} value={blockedUrlPatterns} onChange={(e) => setBlockedUrlPatterns(e.target.value)} />
          </Field>
          <Field label="Allowed URL patterns" help="One pattern per line.">
            <textarea className={styles.textarea} value={allowedUrlPatterns} onChange={(e) => setAllowedUrlPatterns(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>
          Blocked categories ({blockedCategories.length} / {ALL_CATEGORIES.length})
        </div>
        <div className={styles.cardB}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {ALL_CATEGORIES.map((cat) => (
              <Checkbox key={cat} label={cat} checked={blockedCategories.includes(cat)} onChange={(checked) => toggleCategory(cat, checked)} />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 10. SD-WAN & traffic shaping — summary page, matches source's fidelity
// ===================================================================

export function SecSdwanPage({ state }: { state: MerakiState }) {
  const mx = currentAppliance(state);

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; Security &amp; SD-WAN &nbsp;&rsaquo;&nbsp; <b>SD-WAN &amp; traffic shaping</b>
      </div>
      <h1 className={styles.pageH}>SD-WAN &amp; traffic shaping</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>Uplink usage</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "uplink", header: "Uplink", render: (u: { label: string; usage?: number; isp?: string }) => u.label },
              { key: "isp", header: "ISP", render: (u) => u.isp ?? "-" },
              { key: "usage", header: "Usage (24h)", render: (u) => (u.usage != null ? `${u.usage} GB` : "-") },
            ]}
            rows={[
              { label: "WAN 1", usage: mx?.wan1?.usage, isp: mx?.wan1?.isp },
              { label: "WAN 2", usage: mx?.wan2?.usage, isp: mx?.wan2?.isp },
            ]}
            getRowKey={(u) => u.label}
            dense
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>SD-WAN policies (per traffic class)</div>
        <div className={`${styles.cardB} ${styles.small}`}>
          No custom SD-WAN policies configured for this network. Default policy: prefer WAN1, fail over to WAN2 on loss.
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Per-flow shaping rules</div>
        <div className={`${styles.cardB} ${styles.small}`}>No custom shaping rules. SD-WAN policies above handle classification and uplink selection.</div>
      </div>
    </div>
  );
}
