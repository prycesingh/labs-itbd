"use client";

// Device Info / Environment / Interfaces / EtherChannel / VLANs / VTP /
// Spanning Tree pages for the Cisco IOS WebUI simulator. Ported from
// itbd-lab/simulators/network/js/cisco-ui.js:
//   - Router Properties (P['a-router-prop'], line ~1099) -> DeviceInfoPage.
//     Source's real `_saveRouterProps` handler (line ~2906) only ever wrote
//     hostname/domainName/location/contact/bannerMotd; DNS servers were a
//     separate read-only-ish page (`a-dns`) and NTP servers had no editable
//     form at all in source (`a-ntp` just displayed `ntpAssociations`, a
//     different array from `state.device.ntpServers`). Per the porting
//     brief, this page consolidates hostname/banner/domain/DNS/NTP into one
//     editable "Additional Tasks" surface dispatching UPDATE_DEVICE, since a
//     real router-properties admin page needs all of those fields together.
//   - System Summary environmentals + CPU/memory gauges (P['m-sysover'],
//     line ~1203, and drawGauge()/CU._runHealthCheck's "Environment OK"
//     finding, line ~2497) -> EnvironmentPage. Read-only in source (no save
//     handler ever touches temp/fan/power/cpu/mem) and stays read-only here.
//   - Interfaces and Connections (P['iface-list'], line ~568) + Edit/Save/
//     Toggle handlers (_editIface/_saveIface/_toggleIface, line ~2746) +
//     interface diagnostics counters (CU._runIfDiag, line ~2021) ->
//     InterfacesPage. Source's Shut/No Shut link (line 581) is a REAL
//     mutation (`_toggleIface` flips adminUp + cascades lineUp + appends a
//     syslog entry) — wired here via TOGGLE_INTERFACE_ADMIN exactly as
//     source intended, not decorative. The Edit modal's field set (name
//     read-only, description, IP, mask, MTU, duplex, speed, NAT role,
//     admin-up checkbox) is ported 1:1 from `_editIface`/`_saveIface`, minus
//     the NAT-role field (out of scope for this page group; NAT gets its own
//     page elsewhere) but plus MTU/description/IP/mask which the brief calls
//     out explicitly.
//   - Trunks/EtherChannel table (P['iface-trunk'], line ~613, and the
//     etherchannel branch of the generic-fallback table renderer, line 439)
//     -> EtherchannelPage. No mutation call-site in source at all (source
//     only ever displayed a hardcoded 3-row table) — kept strictly read-only
//     per the brief ("don't invent one"), reading from the real
//     `state.etherChannels` seed instead of source's hardcoded rows.
//   - VLAN database (P['iface-vlan'], line ~600) -> VlansPage. Source never
//     wired Add/Edit/Delete for VLANs (display-only `<table>`), but the
//     reducer (ADD_VLAN/UPDATE_VLAN/DELETE_VLAN) exists specifically because
//     a real switch-config WebUI needs VLAN CRUD — same gap-filling
//     rationale the reducer file documents for the Meraki port. Wired here.
//   - VTP page: no dedicated source page module was found (VTP fields only
//     ever appear via `state.vtp` in show-tech / CLI-dump text); this is a
//     genuine read-only summary of the real seeded VtpConfig, matching the
//     "read-only summary page" instruction.
//   - Spanning Tree: source's generic fallback table renderer has a
//     `/spanning|stp/.test(l)` branch (line 433) showing a hardcoded
//     per-VLAN table disconnected from any real state. This page instead
//     reads the REAL `state.spanningTree` config object (mode/priority/root
//     bridge/hello/forward-delay/max-age), matching the brief's read-only
//     summary instruction with genuine backing data instead of source's
//     fabricated table.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { CiscoState, CiscoInterface, CiscoVlan } from "@/lib/labs/simulators/network-cisco/types";
import type { CiscoAction } from "@/lib/labs/simulators/network-cisco/reducer";
import {
  DataTable,
  type DataTableColumn,
  Field,
  Flyout,
  Gauge,
  Led,
  type LedTone,
  Modal,
  NativeSelect,
  Sparkline,
  StatRow,
  StatusPill,
  statusTone,
} from "./cisco-ui";
import styles from "./cisco-console.module.css";

type Props = { state: CiscoState; dispatch: React.Dispatch<CiscoAction> };

// ===================================================================
// 1. Device Info (Router Properties + Additional Tasks: DNS / NTP)
// ===================================================================
export function DeviceInfoPage({ state, dispatch }: Props) {
  const d = state.device;

  const [hostname, setHostname] = useState(d.hostname);
  const [bannerMotd, setBannerMotd] = useState(d.bannerMotd);
  const [domainName, setDomainName] = useState(d.domainName);
  const [location, setLocation] = useState(d.location);
  const [contact, setContact] = useState(d.contact);
  const [dnsServers, setDnsServers] = useState(d.dnsServers.join("\n"));
  const [ntpServers, setNtpServers] = useState(d.ntpServers.join("\n"));

  // Re-sync local form state if the device changes from elsewhere (e.g.
  // RESET_STATE) — matches every other ported suite's edit-form convention.
  useEffect(() => {
    setHostname(d.hostname);
    setBannerMotd(d.bannerMotd);
    setDomainName(d.domainName);
    setLocation(d.location);
    setContact(d.contact);
    setDnsServers(d.dnsServers.join("\n"));
    setNtpServers(d.ntpServers.join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.hostname, d.bannerMotd, d.domainName, d.location, d.contact, d.dnsServers, d.ntpServers]);

  function handleSave() {
    const dns = dnsServers.split("\n").map((s) => s.trim()).filter(Boolean);
    const ntp = ntpServers.split("\n").map((s) => s.trim()).filter(Boolean);
    dispatch({
      type: "UPDATE_DEVICE",
      patch: {
        hostname: hostname.trim() || d.hostname,
        bannerMotd,
        domainName: domainName.trim(),
        location: location.trim(),
        contact: contact.trim(),
        dnsServers: dns,
        ntpServers: ntp,
      },
    });
    toast.success("Router properties applied");
  }

  return (
    <div>
      <div className={styles.crumb}>
        {d.hostname} &nbsp;&rsaquo;&nbsp; <b>Router Properties &amp; Access</b>
      </div>
      <h1 className={styles.pageH}>Router Properties &amp; Access</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Device Identity</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Model</dt>
            <dd>{d.model}</dd>
            <dt>Serial</dt>
            <dd className={styles.mono}>{d.serial}</dd>
            <dt>IOS Version</dt>
            <dd>{d.iosVersion}</dd>
            <dt>IOS Image</dt>
            <dd className={styles.mono}>{d.iosImage}</dd>
            <dt>Uptime</dt>
            <dd>{d.uptime}</dd>
            <dt>Boot Reason</dt>
            <dd>{d.bootReason}</dd>
            <dt>Config Register</dt>
            <dd className={styles.mono}>{d.configRegister}</dd>
            <dt>System Time</dt>
            <dd>{d.systemTime}</dd>
            <dt>Timezone</dt>
            <dd>{d.timezone}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Hostname / Banner / Domain / DNS / NTP</div>
        <div className={styles.cardBody}>
          <Field label="Hostname">
            <input className={styles.input} value={hostname} onChange={(e) => setHostname(e.target.value)} />
          </Field>
          <Field label="Location">
            <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Contact">
            <input className={styles.input} value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="MOTD Banner">
            <textarea className={styles.textarea} rows={3} value={bannerMotd} onChange={(e) => setBannerMotd(e.target.value)} />
          </Field>
          <Field label="Domain Name" help="ip domain name">
            <input className={styles.input} value={domainName} onChange={(e) => setDomainName(e.target.value)} />
          </Field>
          <Field label="DNS Servers" help="One per line — ip name-server">
            <textarea className={styles.textarea} rows={2} value={dnsServers} onChange={(e) => setDnsServers(e.target.value)} />
          </Field>
          <Field label="NTP Servers" help="One per line — ntp server">
            <textarea className={styles.textarea} rows={2} value={ntpServers} onChange={(e) => setNtpServers(e.target.value)} />
          </Field>
          <div className={styles.toolbar}>
            <button type="button" className={styles.btn} onClick={handleSave}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 2. Environment (read-only: temp / fan / power / CPU & memory gauges)
// ===================================================================
export function EnvironmentPage({ state }: { state: CiscoState }) {
  const d = state.device;
  const memPct = d.memTotal > 0 ? Math.round((d.memUsed / d.memTotal) * 100) : 0;

  return (
    <div>
      <div className={styles.crumb}>
        {d.hostname} &nbsp;&rsaquo;&nbsp; <b>Environment</b>
      </div>
      <h1 className={styles.pageH}>Environment</h1>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>Environmental Status</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>System Temperature</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.tempSystem}</StatusPill>
              </dd>
              <dt>CPU Temperature</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.tempCpu}</StatusPill>
              </dd>
              <dt>Fan Status</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.fanStatus}</StatusPill>
              </dd>
              <dt>Power Supply</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.powerSupply}</StatusPill>
              </dd>
            </dl>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>CPU Utilization</div>
          <div className={styles.cardBody} style={{ textAlign: "center" }}>
            <Gauge value={d.cpu5sec} label="5 sec" color="#005073" />
            <div className={`${styles.small} ${styles.mt10}`}>
              5sec {d.cpu5sec}% &middot; 1min {d.cpu1min}% &middot; 5min {d.cpu5min}%
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Memory Utilization</div>
          <div className={styles.cardBody} style={{ textAlign: "center" }}>
            <Gauge value={memPct} label="Used" color="#2e8540" />
            <div className={`${styles.small} ${styles.mt10}`}>
              Used: {d.memUsed.toLocaleString()} KB of {d.memTotal.toLocaleString()} KB
            </div>
          </div>
        </div>
      </div>

      <StatRow
        stats={[
          { label: "CPU 5 sec", value: `${d.cpu5sec}%` },
          { label: "CPU 1 min", value: `${d.cpu1min}%` },
          { label: "CPU 5 min", value: `${d.cpu5min}%` },
          { label: "Memory", value: `${memPct}%`, sub: `${d.memUsed.toLocaleString()} / ${d.memTotal.toLocaleString()} KB` },
        ]}
      />
    </div>
  );
}

// ===================================================================
// 3. Interfaces (list + flyout detail + genuine admin toggle + edit form)
// ===================================================================
function ifaceLedTone(f: CiscoInterface): LedTone {
  if (!f.adminUp) return "admin-down";
  return f.lineUp ? "up" : "down";
}
function ifaceStatusText(f: CiscoInterface): string {
  if (!f.adminUp) return "admin down";
  return f.lineUp ? "up/up" : "up/down";
}
function ifaceStatusTone(f: CiscoInterface): "up" | "down" | "muted" {
  if (!f.adminUp) return "muted";
  return f.lineUp ? "up" : "down";
}

// Interface edit form state — mirrors source's `_editIface` field set
// (description/IP/mask/MTU/duplex/speed), extended with admin-up per the
// brief's "edit form (IP/mask/MTU/description)" instruction.
type IfaceEditForm = {
  description: string;
  ip: string;
  mask: string;
  mtu: string;
  duplex: string;
  speed: string;
};

function toEditForm(f: CiscoInterface): IfaceEditForm {
  return { description: f.description, ip: f.ip, mask: f.mask, mtu: String(f.mtu), duplex: f.duplex, speed: f.speed };
}

const DUPLEX_OPTIONS = [
  { value: "auto", label: "auto" },
  { value: "full", label: "full" },
  { value: "half", label: "half" },
];
const SPEED_OPTIONS = [
  { value: "auto", label: "auto" },
  { value: "1000Mb/s", label: "1000Mb/s" },
  { value: "100Mb/s", label: "100Mb/s" },
];

export function InterfacesPage({ state, dispatch }: Props) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IfaceEditForm | null>(null);

  const selected = useMemo(() => state.interfaces.find((f) => f.name === selectedName) ?? null, [state.interfaces, selectedName]);

  // Auto-refresh counters every 2.5s while this page is mounted, matching
  // source's `m-ifstatus:after` live-refresh interval (CiscoData.tickCounters()
  // on a 2500ms timer) — optional polish, cleaned up on unmount.
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "TICK_COUNTERS", seed: Date.now() % 2147483647 });
    }, 2500);
    return () => clearInterval(id);
  }, [dispatch]);

  function openDetail(f: CiscoInterface) {
    setSelectedName(f.name);
    setEditForm(null);
  }
  function closeDetail() {
    setSelectedName(null);
    setEditForm(null);
  }

  // Genuinely wired: dispatches the real TOGGLE_INTERFACE_ADMIN action, which
  // flips adminUp, cascades lineUp, and appends a real syslog entry — this is
  // source's real `_toggleIface` intent (Shut / No Shut), not decorative.
  function handleToggleAdmin(f: CiscoInterface) {
    dispatch({ type: "TOGGLE_INTERFACE_ADMIN", name: f.name, nowIso: new Date().toISOString().replace("T", " ").slice(0, 19) });
    toast.success(`Interface ${f.name} ${f.adminUp ? "shut down" : "brought up"}`);
  }

  function startEdit(f: CiscoInterface) {
    setEditForm(toEditForm(f));
  }

  function saveEdit(f: CiscoInterface) {
    if (!editForm) return;
    const mtu = parseInt(editForm.mtu, 10);
    dispatch({
      type: "UPDATE_INTERFACE",
      name: f.name,
      patch: {
        description: editForm.description,
        ip: editForm.ip,
        mask: editForm.mask,
        mtu: Number.isFinite(mtu) && mtu > 0 ? mtu : f.mtu,
        duplex: editForm.duplex,
        speed: editForm.speed,
      },
    });
    toast.success(`Interface ${f.name} updated`);
    setEditForm(null);
  }

  const columns: DataTableColumn<CiscoInterface>[] = [
    {
      key: "name",
      header: "Interface",
      render: (f) => (
        <span>
          <b>{f.name}</b>
          {f.alias ? <span className={styles.small}> ({f.alias})</span> : null}
        </span>
      ),
    },
    { key: "role", header: "Role", render: (f) => f.role },
    { key: "ip", header: "IP / Mask", render: (f) => <span className={styles.mono}>{f.ip ? `${f.ip}${f.mask ? ` / ${f.mask}` : ""}` : "--"}</span> },
    { key: "description", header: "Description", render: (f) => f.description || "" },
    {
      key: "status",
      header: "Status",
      render: (f) => (
        <span>
          <Led tone={ifaceLedTone(f)} />
          <StatusPill tone={ifaceStatusTone(f)}>{ifaceStatusText(f)}</StatusPill>
        </span>
      ),
    },
    { key: "speed", header: "Duplex / Speed", render: (f) => `${f.duplex} / ${f.speed}` },
    { key: "rateIn", header: "Input Rate", render: (f) => <span className={styles.mono}>{(f.inputRate / 1000).toLocaleString()} kbps</span> },
    { key: "rateOut", header: "Output Rate", render: (f) => <span className={styles.mono}>{(f.outputRate / 1000).toLocaleString()} kbps</span> },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.device.hostname} &nbsp;&rsaquo;&nbsp; <b>Interfaces and Connections</b>
      </div>
      <h1 className={styles.pageH}>Interfaces and Connections</h1>
      <div className={styles.small} style={{ marginBottom: 10 }}>
        Click a row for full counters. Use Shut / No Shut in the detail panel to change administrative state.
      </div>

      <DataTable columns={columns} rows={state.interfaces} getRowKey={(f) => f.name} onRowClick={openDetail} emptyMessage="No interfaces configured." />

      {selected ? (
        <Flyout
          title={selected.name}
          onClose={closeDetail}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={closeDetail}>
                Close
              </button>
              {editForm ? (
                <>
                  <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setEditForm(null)}>
                    Cancel Edit
                  </button>
                  <button type="button" className={styles.btn} onClick={() => saveEdit(selected)}>
                    Apply
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.btn} onClick={() => startEdit(selected)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={selected.adminUp ? styles.btnDanger : styles.btn}
                    onClick={() => handleToggleAdmin(selected)}
                  >
                    {selected.adminUp ? "Shutdown" : "No Shutdown"}
                  </button>
                </>
              )}
            </>
          }
        >
          <div className={styles.card} style={{ marginBottom: 12 }}>
            <div className={styles.cardHeader}>Status</div>
            <div className={styles.cardBody}>
              <div style={{ marginBottom: 8 }}>
                <Led tone={ifaceLedTone(selected)} />
                <StatusPill tone={ifaceStatusTone(selected)}>{ifaceStatusText(selected)}</StatusPill>
              </div>
              <dl className={styles.kv}>
                <dt>Role</dt>
                <dd>{selected.role}</dd>
                <dt>MAC</dt>
                <dd className={styles.mono}>{selected.mac || "--"}</dd>
                <dt>Encapsulation</dt>
                <dd>{selected.encap}</dd>
                <dt>NAT Role</dt>
                <dd>{selected.natRole || "--"}</dd>
              </dl>
            </div>
          </div>

          {editForm ? (
            <div className={styles.card}>
              <div className={styles.cardHeader}>Edit Interface</div>
              <div className={styles.cardBody}>
                <Field label="Description">
                  <input
                    className={styles.input}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </Field>
                <Field label="IP Address">
                  <input className={styles.input} value={editForm.ip} onChange={(e) => setEditForm({ ...editForm, ip: e.target.value })} />
                </Field>
                <Field label="Subnet Mask">
                  <input className={styles.input} value={editForm.mask} onChange={(e) => setEditForm({ ...editForm, mask: e.target.value })} />
                </Field>
                <Field label="MTU">
                  <input
                    type="number"
                    className={styles.input}
                    value={editForm.mtu}
                    onChange={(e) => setEditForm({ ...editForm, mtu: e.target.value })}
                  />
                </Field>
                <Field label="Duplex">
                  <NativeSelect value={editForm.duplex} onChange={(v) => setEditForm({ ...editForm, duplex: v })} options={DUPLEX_OPTIONS} />
                </Field>
                <Field label="Speed">
                  <NativeSelect value={editForm.speed} onChange={(v) => setEditForm({ ...editForm, speed: v })} options={SPEED_OPTIONS} />
                </Field>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.card}>
                <div className={styles.cardHeader}>Traffic</div>
                <div className={styles.cardBody}>
                  <div className={styles.flex} style={{ alignItems: "center", marginBottom: 8 }}>
                    <span className={styles.small}>Load In</span>
                    <Sparkline data={[selected.loadIn, selected.loadIn, selected.loadOut, selected.loadIn]} />
                    <span className={styles.small}>Load Out</span>
                    <Sparkline data={[selected.loadOut, selected.loadIn, selected.loadOut, selected.loadOut]} color="#2e8540" />
                  </div>
                  <dl className={styles.kv}>
                    <dt>Input Rate</dt>
                    <dd className={styles.mono}>{(selected.inputRate / 1000).toLocaleString()} kbps</dd>
                    <dt>Output Rate</dt>
                    <dd className={styles.mono}>{(selected.outputRate / 1000).toLocaleString()} kbps</dd>
                    <dt>Load In / Out</dt>
                    <dd>
                      {selected.loadIn}/255 &middot; {selected.loadOut}/255
                    </dd>
                    <dt>Packets In / Out</dt>
                    <dd>
                      {selected.inputPackets.toLocaleString()} / {selected.outputPackets.toLocaleString()}
                    </dd>
                    <dt>Bytes In / Out</dt>
                    <dd>
                      {selected.bytesIn.toLocaleString()} / {selected.bytesOut.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>Error Counters</div>
                <div className={styles.cardBody}>
                  <dl className={styles.kv}>
                    <dt>Input Errors</dt>
                    <dd>{selected.inputErrors}</dd>
                    <dt>CRC Errors</dt>
                    <dd>{selected.crcErrors}</dd>
                    <dt>Frame Errors</dt>
                    <dd>{selected.frameErrors}</dd>
                    <dt>Overrun</dt>
                    <dd>{selected.overrun}</dd>
                    <dt>Ignored</dt>
                    <dd>{selected.ignored}</dd>
                    <dt>Output Drops</dt>
                    <dd>{selected.outputDrops}</dd>
                    <dt>Late Collisions</dt>
                    <dd>{selected.lateCollisions}</dd>
                    <dt>Deferred</dt>
                    <dd>{selected.deferred}</dd>
                  </dl>
                </div>
              </div>
            </>
          )}
        </Flyout>
      ) : null}
    </div>
  );
}

// ===================================================================
// 4. EtherChannel (read-only — no real backing mutation in source)
// ===================================================================
export function EtherchannelPage({ state }: { state: CiscoState }) {
  const columns: DataTableColumn<CiscoState["etherChannels"][number]>[] = [
    { key: "group", header: "Group", render: (e) => <b>Po{e.group}</b> },
    { key: "protocol", header: "Protocol", render: (e) => e.protocol },
    { key: "members", header: "Members", render: (e) => <span className={styles.mono}>{e.members}</span> },
    { key: "mode", header: "Mode", render: (e) => e.mode },
    { key: "load", header: "Load Balance", render: (e) => e.load },
    { key: "status", header: "Status", render: (e) => <StatusPill tone={statusTone(e.status)}>{e.status}</StatusPill> },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.device.hostname} &nbsp;&rsaquo;&nbsp; <b>Trunks, EtherChannel &amp; Bridges</b>
      </div>
      <h1 className={styles.pageH}>Trunks, EtherChannel &amp; Bridges</h1>
      <div className={styles.card}>
        <div className={styles.cardHeader}>EtherChannel Groups</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.etherChannels} getRowKey={(e) => String(e.group)} emptyMessage="No EtherChannel groups configured." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 5. VLANs (list + Add/Edit modal + delete confirm)
// ===================================================================
type VlanForm = { id: string; name: string; state: string; ports: string; members: string; gateway: string };

const EMPTY_VLAN_FORM: VlanForm = { id: "", name: "", state: "active", ports: "", members: "0", gateway: "" };

function vlanToForm(v: CiscoVlan): VlanForm {
  return { id: String(v.id), name: v.name, state: v.state, ports: v.ports, members: String(v.members), gateway: v.gateway };
}

const VLAN_STATE_OPTIONS = [
  { value: "active", label: "active" },
  { value: "suspended", label: "suspended" },
];

export function VlansPage({ state, dispatch }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<VlanForm>(EMPTY_VLAN_FORM);
  const [editVlanId, setEditVlanId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<VlanForm>(EMPTY_VLAN_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  function openAdd() {
    setAddForm(EMPTY_VLAN_FORM);
    setAddOpen(true);
  }

  function submitAdd() {
    const id = parseInt(addForm.id, 10);
    if (!Number.isFinite(id) || id < 1 || id > 4094) {
      toast.error("VLAN ID must be between 1 and 4094");
      return;
    }
    if (state.vlans.some((v) => v.id === id)) {
      toast.error(`VLAN ${id} already exists`);
      return;
    }
    if (!addForm.name.trim()) {
      toast.error("VLAN name is required");
      return;
    }
    const members = parseInt(addForm.members, 10);
    dispatch({
      type: "ADD_VLAN",
      vlan: {
        id,
        name: addForm.name.trim(),
        state: addForm.state,
        ports: addForm.ports.trim(),
        members: Number.isFinite(members) && members >= 0 ? members : 0,
        gateway: addForm.gateway.trim(),
      },
    });
    toast.success(`VLAN ${id} created`);
    setAddOpen(false);
  }

  function openEdit(v: CiscoVlan) {
    setEditVlanId(v.id);
    setEditForm(vlanToForm(v));
  }

  function submitEdit() {
    if (editVlanId == null) return;
    const members = parseInt(editForm.members, 10);
    dispatch({
      type: "UPDATE_VLAN",
      id: editVlanId,
      patch: {
        name: editForm.name.trim(),
        state: editForm.state,
        ports: editForm.ports.trim(),
        members: Number.isFinite(members) && members >= 0 ? members : 0,
        gateway: editForm.gateway.trim(),
      },
    });
    toast.success(`VLAN ${editVlanId} updated`);
    setEditVlanId(null);
  }

  function confirmDelete() {
    if (confirmDeleteId == null) return;
    dispatch({ type: "DELETE_VLAN", id: confirmDeleteId });
    toast.success(`VLAN ${confirmDeleteId} deleted`);
    setConfirmDeleteId(null);
  }

  const columns: DataTableColumn<CiscoVlan>[] = [
    { key: "id", header: "VLAN ID", render: (v) => <b>{v.id}</b> },
    { key: "name", header: "Name", render: (v) => v.name },
    { key: "state", header: "State", render: (v) => <StatusPill tone={statusTone(v.state)}>{v.state}</StatusPill> },
    { key: "ports", header: "Ports", render: (v) => <span className={styles.mono}>{v.ports}</span> },
    { key: "members", header: "Members", render: (v) => v.members },
    { key: "gateway", header: "SVI Gateway", render: (v) => <span className={styles.mono}>{v.gateway || "--"}</span> },
    {
      key: "actions",
      header: "Actions",
      render: (v) => (
        <span className={styles.actions}>
          <a onClick={() => openEdit(v)}>Edit</a>
          <a className="del" onClick={() => setConfirmDeleteId(v.id)}>
            Delete
          </a>
        </span>
      ),
    },
  ];

  const vlanBeingDeleted = confirmDeleteId != null ? state.vlans.find((v) => v.id === confirmDeleteId) : null;

  return (
    <div>
      <div className={styles.crumb}>
        {state.device.hostname} &nbsp;&rsaquo;&nbsp; <b>VLAN</b>
      </div>
      <h1 className={styles.pageH}>VLAN</h1>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={openAdd}>
          + Add VLAN
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>VLAN Database</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.vlans} getRowKey={(v) => String(v.id)} emptyMessage="No VLANs configured." />
        </div>
      </div>

      {addOpen ? (
        <Modal
          title="Add VLAN"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={submitAdd}>
                Create
              </button>
            </>
          }
        >
          <Field label="VLAN ID">
            <input className={styles.input} type="number" value={addForm.id} onChange={(e) => setAddForm({ ...addForm, id: e.target.value })} />
          </Field>
          <Field label="Name">
            <input className={styles.input} value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          </Field>
          <Field label="State">
            <NativeSelect value={addForm.state} onChange={(v) => setAddForm({ ...addForm, state: v })} options={VLAN_STATE_OPTIONS} />
          </Field>
          <Field label="Ports" help="e.g. Gi1/0/1-12">
            <input className={styles.input} value={addForm.ports} onChange={(e) => setAddForm({ ...addForm, ports: e.target.value })} />
          </Field>
          <Field label="Members">
            <input className={styles.input} type="number" value={addForm.members} onChange={(e) => setAddForm({ ...addForm, members: e.target.value })} />
          </Field>
          <Field label="SVI Gateway">
            <input className={styles.input} value={addForm.gateway} onChange={(e) => setAddForm({ ...addForm, gateway: e.target.value })} />
          </Field>
        </Modal>
      ) : null}

      {editVlanId != null ? (
        <Modal
          title={`Edit VLAN ${editVlanId}`}
          onClose={() => setEditVlanId(null)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setEditVlanId(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={submitEdit}>
                Apply
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={styles.input} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </Field>
          <Field label="State">
            <NativeSelect value={editForm.state} onChange={(v) => setEditForm({ ...editForm, state: v })} options={VLAN_STATE_OPTIONS} />
          </Field>
          <Field label="Ports">
            <input className={styles.input} value={editForm.ports} onChange={(e) => setEditForm({ ...editForm, ports: e.target.value })} />
          </Field>
          <Field label="Members">
            <input className={styles.input} type="number" value={editForm.members} onChange={(e) => setEditForm({ ...editForm, members: e.target.value })} />
          </Field>
          <Field label="SVI Gateway">
            <input className={styles.input} value={editForm.gateway} onChange={(e) => setEditForm({ ...editForm, gateway: e.target.value })} />
          </Field>
        </Modal>
      ) : null}

      {vlanBeingDeleted ? (
        <Modal
          title="Delete VLAN"
          onClose={() => setConfirmDeleteId(null)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnMuted}`} onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnDanger} onClick={confirmDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete VLAN <b>{vlanBeingDeleted.id}</b> ({vlanBeingDeleted.name})? This cannot be undone.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// 6. VTP (read-only summary)
// ===================================================================
export function VtpPage({ state }: { state: CiscoState }) {
  const vtp = state.vtp;
  return (
    <div>
      <div className={styles.crumb}>
        {state.device.hostname} &nbsp;&rsaquo;&nbsp; <b>VTP</b>
      </div>
      <h1 className={styles.pageH}>VTP</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>VLAN Trunking Protocol</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Domain</dt>
            <dd>{vtp.domain}</dd>
            <dt>Mode</dt>
            <dd>
              <StatusPill tone="info">{vtp.mode}</StatusPill>
            </dd>
            <dt>Version</dt>
            <dd>{vtp.version}</dd>
            <dt>Configuration Revision</dt>
            <dd>{vtp.revision}</dd>
            <dt>Pruning</dt>
            <dd>
              <StatusPill tone={vtp.pruning ? "up" : "muted"}>{vtp.pruning ? "Enabled" : "Disabled"}</StatusPill>
            </dd>
            <dt>Password</dt>
            <dd className={styles.mono}>{vtp.password ? "********" : "(none)"}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 7. Spanning Tree (read-only summary)
// ===================================================================
export function SpanningTreePage({ state }: { state: CiscoState }) {
  const st = state.spanningTree;
  return (
    <div>
      <div className={styles.crumb}>
        {state.device.hostname} &nbsp;&rsaquo;&nbsp; <b>Spanning Tree</b>
      </div>
      <h1 className={styles.pageH}>Spanning Tree</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Spanning Tree Protocol</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Mode</dt>
            <dd>
              <StatusPill tone="info">{st.mode}</StatusPill>
            </dd>
            <dt>Bridge Priority</dt>
            <dd>{st.priority}</dd>
            <dt>Root Bridge</dt>
            <dd>{st.rootBridge}</dd>
            <dt>Hello Time</dt>
            <dd>{st.helloTime}s</dd>
            <dt>Forward Delay</dt>
            <dd>{st.forwardDelay}s</dd>
            <dt>Max Age</dt>
            <dd>{st.maxAge}s</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
