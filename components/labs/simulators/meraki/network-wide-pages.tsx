"use client";

// Network-wide nav-group pages for the Cisco Meraki dashboard simulator.
// Ported from itbd-lab/simulators/meraki/js/meraki-network.js (renderOverview,
// renderClients/openClient/_blockClient/_saveClient, renderDevices,
// renderTopology, renderTraffic, renderHealth, renderAlerts/_dismissAlert,
// renderGeneral, renderAdmins, renderTemplates). Every export below is
// current-network-scoped (reads `state.currentNetworkId`), matching source's
// per-network Network-wide section (as opposed to the Organization-level
// pages a sibling agent owns).
//
// Two source bugs are fixed here per the porting brief:
//  - Clients: `_saveClient` never read the policy <select>'s value — Save
//    just called MerakiData.save() on unchanged state. NwClientsPage's detail
//    flyout tracks the selected policy in local state and dispatches
//    SAVE_CLIENT_POLICY with that actual value.
//  - Alerts: the "Configure alert types" Save button never read the
//    enabled-checkbox/threshold-input values back — it only toasted. Here
//    each alert-type row edits local draft state and dispatches
//    UPDATE_ALERT_TYPE with the actually-edited enabled/threshold.
//
// Devices is the flagship feature: Reboot / Update firmware genuinely drive
// device.pendingAction via START_DEVICE_REBOOT / START_FIRMWARE_UPDATE, then
// a real setInterval dispatches ADVANCE_DEVICE_LIFECYCLE every 2s until the
// pendingAction clears — mirroring power-platform/flows-page.tsx's
// FlowFlyout run-advancing pattern (dispatch START, then interval-driven
// ADVANCE, tracked via a useRef<Map>, cleared on terminal state and on
// unmount). Source's reboot/firmware buttons were fake (an instant toast with
// no state transition) or absent entirely.
//
// Admins fixes source's fully-decorative "+ Add admin" / "Edit" buttons
// (rendered with no onclick handler at all) via a real Modal form dispatching
// ADD_ADMIN_USER, and a confirm Modal dispatching DELETE_ADMIN_USER.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { MerakiAction } from "@/lib/labs/simulators/meraki/reducer";
import type {
  MerakiAlertType,
  MerakiClient,
  MerakiDevice,
  MerakiAdminUser,
  MerakiProductType,
  MerakiState,
} from "@/lib/labs/simulators/meraki/types";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  Sparkline,
  StatRow,
  StatusPill,
  Toggle,
  exportCsv,
  statusTone,
} from "./meraki-ui";
import styles from "./meraki-console.module.css";

type MerakiPageProps = { state: MerakiState; dispatch: React.Dispatch<MerakiAction> };

// Available group policies — ported from source's client policy <select>
// options (meraki-network.js openClient(): "Default"/"Corporate"/
// "Guest-Limited"/"IoT-Restricted"/"Block-Internet"/"Quarantine").
const CLIENT_POLICIES = ["Default", "Corporate", "Guest-Limited", "IoT-Restricted", "Block-Internet", "Quarantine"];

const ADMIN_ROLES = ["Organization admin", "Network admin", "Read-only", "Help desk (monitor only)"];

function currentNetwork(state: MerakiState) {
  return state.networks.find((n) => n.id === state.currentNetworkId);
}

function clientsInCurrentNetwork(state: MerakiState): MerakiClient[] {
  return state.clients.filter((c) => c.networkId === state.currentNetworkId);
}

function devicesInCurrentNetwork(state: MerakiState): MerakiDevice[] {
  return state.devices.filter((d) => d.networkId === state.currentNetworkId);
}

// ===================================================================
// 1. Overview — source renderOverview()
// ===================================================================

export function NwOverviewPage({ state }: { state: MerakiState }) {
  const net = currentNetwork(state);
  const clients = clientsInCurrentNetwork(state);
  const devices = devicesInCurrentNetwork(state);
  const devicesOnline = devices.filter((d) => d.status === "online").length;
  const clientsOnline = clients.filter((c) => c.status === "online").length;
  const appliance = devices.find((d) => d.type === "appliance");

  const recentAlerts = state.alerts.active.filter((a) => a.networkId === state.currentNetworkId).slice(0, 8);

  // Mini traffic summary — matches source's static topApps list (real state
  // has no per-app usage tracked yet, so this mirrors source's illustrative
  // fidelity rather than fabricating new realism).
  const topApps = [
    { name: "Microsoft 365 / SharePoint", usageMb: 142 },
    { name: "Zoom", usageMb: 98 },
    { name: "YouTube", usageMb: 76 },
    { name: "Salesforce", usageMb: 54 },
    { name: "GitHub", usageMb: 38 },
  ];

  if (!net) return <EmptyState message="No network selected." />;

  return (
    <div>
      <h1 className={styles.pageH}>
        {net.name} &mdash; Overview
      </h1>

      <StatRow
        stats={[
          { label: "Clients online", value: clientsOnline, sub: `of ${clients.length} total` },
          { label: "Devices online", value: `${devicesOnline} / ${devices.length}`, sub: `${devices.length - devicesOnline} alerting/offline` },
          { label: "WAN download (24h)", value: `${net.wanUsage.down} GB`, sub: appliance?.wan1 ? `Uplink: ${appliance.wan1.isp}` : "-" },
          { label: "WAN upload (24h)", value: `${net.wanUsage.up} GB`, sub: "combined uplinks" },
        ]}
      />

      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardH}>Top applications by usage (24h)</div>
          <div className={`${styles.cardB} ${styles.cardBDense}`}>
            <DataTable
              columns={[
                { key: "name", header: "Application", render: (a: (typeof topApps)[number]) => a.name },
                { key: "usage", header: "Usage", render: (a: (typeof topApps)[number]) => `${a.usageMb} MB` },
                {
                  key: "share",
                  header: "Share",
                  render: (a: (typeof topApps)[number]) => (
                    <div className={styles.bar}>
                      <div style={{ width: `${Math.min(100, a.usageMb / 1.5)}%` }} />
                    </div>
                  ),
                },
              ]}
              rows={topApps}
              getRowKey={(a) => a.name}
              dense
            />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardH}>Recent alerts</div>
          <div className={`${styles.cardB} ${styles.cardBDense}`}>
            <DataTable
              columns={[
                { key: "ts", header: "Time", render: (a: MerakiState["alerts"]["active"][number]) => <span className={styles.mono}>{a.ts}</span> },
                {
                  key: "severity",
                  header: "Severity",
                  render: (a: MerakiState["alerts"]["active"][number]) => <StatusPill tone={statusTone(a.severity)}>{a.severity}</StatusPill>,
                },
                { key: "source", header: "Source", render: (a: MerakiState["alerts"]["active"][number]) => a.source },
                { key: "message", header: "Message", render: (a: MerakiState["alerts"]["active"][number]) => a.message },
              ]}
              rows={recentAlerts}
              getRowKey={(a) => a.id}
              dense
              emptyMessage="No active alerts for this network."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 2. Clients — source renderClients()/openClient()/_blockClient()/_saveClient()
// ===================================================================

function ClientDetailFlyout({
  client,
  dispatch,
  onClose,
}: {
  client: MerakiClient;
  dispatch: React.Dispatch<MerakiAction>;
  onClose: () => void;
}) {
  // Local draft of the selected policy — this is the fix for source's bug:
  // the modal rendered a <select> but Save never read its value. Here, Save
  // dispatches SAVE_CLIENT_POLICY with whatever the admin actually picked.
  const [draftPolicy, setDraftPolicy] = useState(client.policy);

  function handleSave() {
    dispatch({ type: "SAVE_CLIENT_POLICY", clientId: client.id, policy: draftPolicy });
    toast.success("Client policy saved", { description: `${client.description} -> ${draftPolicy}` });
    onClose();
  }

  function handleBlock() {
    dispatch({ type: "BLOCK_CLIENT", clientId: client.id });
    toast.warning("Client moved to Block-Internet policy", { description: client.description });
    onClose();
  }

  return (
    <Flyout
      title={`Client: ${client.description}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Close
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleBlock}>
            Block from network
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Save policy
          </button>
        </>
      }
    >
      <div className={styles.grid2}>
        <div>
          <dl className={styles.kv}>
            <dt>Description</dt>
            <dd>{client.description}</dd>
            <dt>MAC</dt>
            <dd className={styles.mono}>{client.mac}</dd>
            <dt>IP</dt>
            <dd className={styles.mono}>{client.ip}</dd>
            <dt>VLAN</dt>
            <dd>{client.vlan}</dd>
            <dt>SSID</dt>
            <dd>{client.ssid ?? "-"}</dd>
            <dt>Connected to</dt>
            <dd>{client.connectedTo ?? "-"}</dd>
          </dl>
        </div>
        <div>
          <dl className={styles.kv}>
            <dt>Connectivity</dt>
            <dd>{client.connectivity}</dd>
            <dt>Manufacturer</dt>
            <dd>{client.manufacturer}</dd>
            <dt>OS</dt>
            <dd>{client.os}</dd>
            <dt>Status</dt>
            <dd>
              <StatusPill tone={statusTone(client.status)}>{client.status}</StatusPill>
            </dd>
            <dt>First seen</dt>
            <dd>{client.firstSeen}</dd>
            <dt>Last seen</dt>
            <dd>{client.lastSeen}</dd>
            {client.signal != null ? (
              <>
                <dt>RSSI</dt>
                <dd>{client.signal} dBm</dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>

      <div className={styles.sectionTitle}>Bandwidth (last 24h)</div>
      <div className={styles.flex} style={{ padding: 6 }}>
        <Sparkline data={client.bandwidthSeries} color="#5cb85c" />
        <span>
          <b>{client.usage24h.recv} MB</b> received / <b>{client.usage24h.sent} MB</b> sent
        </span>
      </div>

      <div className={styles.sectionTitle}>Group policy</div>
      <NativeSelect
        value={draftPolicy}
        onChange={setDraftPolicy}
        options={CLIENT_POLICIES.map((p) => ({ value: p, label: p }))}
      />
    </Flyout>
  );
}

export function NwClientsPage({ state, dispatch }: MerakiPageProps) {
  const [search, setSearch] = useState("");
  const [connectivityFilter, setConnectivityFilter] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clients = clientsInCurrentNetwork(state);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (connectivityFilter && c.connectivity !== connectivityFilter) return false;
      if (!q) return true;
      const haystack = `${c.description} ${c.mac} ${c.ip} ${c.ssid ?? ""} ${c.connectedTo ?? ""} ${c.policy}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, search, connectivityFilter]);

  const selectedClient = selectedClientId ? state.clients.find((c) => c.id === selectedClientId) ?? null : null;

  function handleExport() {
    exportCsv(
      "meraki-clients.csv",
      ["Description", "MAC", "IP", "VLAN", "Connectivity", "SSID", "Status", "Connected to", "Policy", "Last seen"],
      filteredClients.map((c) => [c.description, c.mac, c.ip, c.vlan, c.connectivity, c.ssid ?? "", c.status, c.connectedTo ?? "", c.policy, c.lastSeen]),
    );
    toast.success(`Exported ${filteredClients.length} clients to CSV`);
  }

  const columns: DataTableColumn<MerakiClient>[] = [
    { key: "description", header: "Description", render: (c) => <span className={styles.rowLink}>{c.description}</span> },
    { key: "mac", header: "MAC address", render: (c) => <span className={styles.mono}>{c.mac}</span> },
    { key: "ip", header: "IP", render: (c) => <span className={styles.mono}>{c.ip}</span> },
    { key: "vlan", header: "VLAN", render: (c) => c.vlan },
    {
      key: "connectivity",
      header: "Connectivity",
      render: (c) => (
        <>
          <StatusPill tone={c.connectivity === "Wireless" ? "info" : "muted"}>{c.connectivity}</StatusPill>
          {c.ssid ? <span className={styles.tag}>{c.ssid}</span> : null}
        </>
      ),
    },
    { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
    { key: "bandwidth", header: "Bandwidth (24h)", render: (c) => <Sparkline data={c.bandwidthSeries} /> },
    { key: "connectedTo", header: "Connected to", render: (c) => <span className={styles.small}>{c.connectedTo ?? "-"}</span> },
    { key: "policy", header: "Policy", render: (c) => <span className={styles.tag}>{c.policy}</span> },
    { key: "lastSeen", header: "Last seen", render: (c) => <span className={styles.small}>{c.lastSeen}</span> },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Clients</h1>

      <div className={styles.actbar}>
        <div className={styles.actbarLeft}>
          <input
            className={styles.input}
            style={{ width: 280 }}
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <NativeSelect
            value={connectivityFilter}
            onChange={setConnectivityFilter}
            options={[
              { value: "", label: "All connectivity" },
              { value: "Wireless", label: "Wireless" },
              { value: "Wired", label: "Wired" },
            ]}
          />
        </div>
        <div className={styles.actbarRight}>
          <button type="button" className={styles.btn} onClick={handleExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={filteredClients}
            getRowKey={(c) => c.id}
            onRowClick={(c) => setSelectedClientId(c.id)}
            dense
            emptyMessage="No clients match your search."
          />
        </div>
      </div>

      {selectedClient ? (
        <ClientDetailFlyout client={selectedClient} dispatch={dispatch} onClose={() => setSelectedClientId(null)} />
      ) : null}
    </div>
  );
}

// ===================================================================
// 3. Devices — source renderDevices() (FLAGSHIP: real reboot/firmware-update engine)
// ===================================================================

const LIFECYCLE_ADVANCE_INTERVAL_MS = 2000;

// Plausible "next" firmware version strings per product family, since
// firmwareLatest is already known on the device — Update firmware targets
// that value (matching device-lifecycle-engine's advanceLifecycle(), which
// falls back to `device.firmwareLatest` if no target is supplied).
function nextFirmwareVersion(device: MerakiDevice): string {
  return device.firmwareLatest || device.firmware;
}

function DeviceDetailFlyout({
  device,
  state,
  dispatch,
  onClose,
}: {
  device: MerakiDevice;
  state: MerakiState;
  dispatch: React.Dispatch<MerakiAction>;
  onClose: () => void;
}) {
  // Always re-read the live device from state so the flyout reflects
  // in-flight pendingAction progress rather than a stale initial snapshot.
  const liveDevice = state.devices.find((d) => d.serial === device.serial) ?? device;

  // Track which serials this flyout has an active advance-timer for, keyed by
  // serial (there's only ever one device open here, but the Map pattern
  // mirrors flows-page.tsx's FlowFlyout exactly per the porting brief).
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  function clearDeviceInterval(serial: string) {
    const interval = intervalsRef.current.get(serial);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(serial);
    }
  }

  // Drive the pending action forward on a real wall-clock timer while one is
  // in flight, dispatching ADVANCE_DEVICE_LIFECYCLE every 2s until
  // pendingAction clears (terminal state) — the flagship live-progress wiring.
  useEffect(() => {
    if (!liveDevice.pendingAction) return;
    const serial = liveDevice.serial;
    if (intervalsRef.current.has(serial)) return;
    const interval = setInterval(() => {
      dispatch({ type: "ADVANCE_DEVICE_LIFECYCLE", serial, nowIso: new Date().toISOString() });
    }, LIFECYCLE_ADVANCE_INTERVAL_MS);
    intervalsRef.current.set(serial, interval);
    return () => clearDeviceInterval(serial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDevice.pendingAction?.kind, liveDevice.pendingAction?.ticksRemaining, liveDevice.serial, dispatch]);

  // Toast once when the pending action clears (transitions from non-null to
  // null), tracked via a ref so it fires exactly once per completion.
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (liveDevice.pendingAction) {
      wasPendingRef.current = true;
    } else if (wasPendingRef.current) {
      wasPendingRef.current = false;
      toast.success(`${liveDevice.name} is back online`, { description: `Firmware ${liveDevice.firmware}` });
    }
  }, [liveDevice.pendingAction, liveDevice.name, liveDevice.firmware]);

  // Clean up any tracked interval on unmount (flyout closed mid-progress).
  useEffect(() => {
    const intervals = intervalsRef.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
    };
  }, []);

  function handleReboot() {
    dispatch({ type: "START_DEVICE_REBOOT", serial: liveDevice.serial, nowIso: new Date().toISOString() });
    toast.info(`Rebooting ${liveDevice.name}...`);
  }

  function handleFirmwareUpdate() {
    const target = nextFirmwareVersion(liveDevice);
    dispatch({ type: "START_FIRMWARE_UPDATE", serial: liveDevice.serial, targetVersion: target, nowIso: new Date().toISOString() });
    toast.info(`Updating firmware on ${liveDevice.name} to ${target}...`);
  }

  const pending = liveDevice.pendingAction;
  const busy = !!pending;

  return (
    <Flyout
      title={`Device: ${liveDevice.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btn} disabled={busy} onClick={handleReboot}>
            Reboot
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={handleFirmwareUpdate}>
            Update firmware
          </button>
        </>
      }
    >
      <dl className={styles.kv}>
        <dt>Model</dt>
        <dd>{liveDevice.model}</dd>
        <dt>Serial</dt>
        <dd className={styles.mono}>{liveDevice.serial}</dd>
        <dt>LAN IP / MAC</dt>
        <dd className={styles.mono}>{liveDevice.lanIp || liveDevice.mac || "-"}</dd>
        <dt>Firmware</dt>
        <dd>{liveDevice.firmware}</dd>
        <dt>Latest firmware</dt>
        <dd>{liveDevice.firmwareLatest}</dd>
        <dt>Uptime</dt>
        <dd>{liveDevice.uptimeDays} d</dd>
        <dt>Status</dt>
        <dd>
          <StatusPill tone={statusTone(liveDevice.status)}>{liveDevice.status}</StatusPill>
        </dd>
      </dl>

      {pending ? (
        <div className={styles.help}>
          {pending.kind === "reboot" ? "Rebooting" : "Updating firmware"}... ({pending.ticksRemaining} tick{pending.ticksRemaining === 1 ? "" : "s"}{" "}
          remaining)
        </div>
      ) : null}
    </Flyout>
  );
}

export function NwDevicesPage({ state, dispatch }: MerakiPageProps) {
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const devices = devicesInCurrentNetwork(state);
  const selectedDevice = selectedSerial ? state.devices.find((d) => d.serial === selectedSerial) ?? null : null;

  const columns: DataTableColumn<MerakiDevice>[] = [
    { key: "name", header: "Name", render: (d) => <span className={styles.rowLink}>{d.name}</span> },
    { key: "type", header: "Type", render: (d) => productTypeLabel(d.type) },
    { key: "model", header: "Model", render: (d) => d.model },
    { key: "serial", header: "Serial", render: (d) => <span className={styles.mono}>{d.serial}</span> },
    { key: "lanIp", header: "LAN IP / MAC", render: (d) => <span className={styles.mono}>{d.lanIp || d.mac || "-"}</span> },
    { key: "firmware", header: "Firmware", render: (d) => d.firmware },
    { key: "uptime", header: "Uptime", render: (d) => `${d.uptimeDays} d` },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <>
          <StatusPill tone={statusTone(d.status)}>
            {d.status === "rebooting" && d.pendingAction
              ? `Rebooting... (${d.pendingAction.ticksRemaining} left)`
              : d.status === "updating" && d.pendingAction
                ? `Updating... (${d.pendingAction.ticksRemaining} left)`
                : d.status}
          </StatusPill>
        </>
      ),
    },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Devices</h1>
      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={devices}
            getRowKey={(d) => d.serial}
            onRowClick={(d) => setSelectedSerial(d.serial)}
            dense
            emptyMessage="No devices in this network."
          />
        </div>
      </div>

      {selectedDevice ? (
        <DeviceDetailFlyout device={selectedDevice} state={state} dispatch={dispatch} onClose={() => setSelectedSerial(null)} />
      ) : null}
    </div>
  );
}

function productTypeLabel(type: MerakiProductType): string {
  if (type === "appliance") return "Appliance (MX)";
  if (type === "switch") return "Switch (MS)";
  if (type === "wireless") return "Access point (MR)";
  if (type === "camera") return "Camera (MV)";
  return "Sensor (MT)";
}

// ===================================================================
// 4. Topology — source renderTopology() (real SVG diagram, kept real)
// ===================================================================

type TopoNode = { id: string; label: string; x: number; y: number; kind: "cloud" | "fw" | "sw" | "ap" | "cam"; parent?: string };

export function NwTopologyPage({ state }: { state: MerakiState }) {
  const devices = devicesInCurrentNetwork(state);
  const w = 1100;
  const h = 460;

  const nodes: TopoNode[] = [];
  nodes.push({ id: "inet", label: "Internet", x: 80, y: h / 2, kind: "cloud" });

  const mx = devices.find((d) => d.type === "appliance");
  if (mx) nodes.push({ id: mx.serial, label: `${mx.name} (${mx.model})`, x: 260, y: h / 2, kind: "fw" });

  const switches = devices.filter((d) => d.type === "switch");
  const swSpacing = (h - 60) / Math.max(1, switches.length);
  switches.forEach((sw, i) => {
    nodes.push({ id: sw.serial, label: `${sw.name} (${sw.model})`, x: 480, y: 30 + (i + 0.5) * swSpacing, kind: "sw", parent: mx ? mx.serial : "inet" });
  });

  const aps = devices.filter((d) => d.type === "wireless");
  const apSpacing = (h - 60) / Math.max(1, aps.length);
  aps.forEach((ap, j) => {
    const parentSw = switches[j % Math.max(1, switches.length)];
    nodes.push({ id: ap.serial, label: `${ap.name} (${ap.model})`, x: 740, y: 30 + (j + 0.5) * apSpacing, kind: "ap", parent: parentSw?.serial });
  });

  const cams = devices.filter((d) => d.type === "camera");
  cams.forEach((cam, k) => {
    const parentSw2 = switches[k % Math.max(1, switches.length)];
    nodes.push({ id: cam.serial, label: cam.name, x: 960, y: 50 + k * 70, kind: "cam", parent: parentSw2?.serial });
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div>
      <h1 className={styles.pageH}>Topology</h1>
      <div className={styles.help}>
        Auto-computed L2/L3 topology from CDP/LLDP neighbor data. Click <b>Devices</b> to drill into individual hardware.
      </div>
      <div className={styles.card}>
        <div className={styles.cardB}>
          <svg className={styles.topo} viewBox={`0 0 ${w} ${h}`}>
            {nodes.map((n) => {
              if (!n.parent) return null;
              const p = nodeById.get(n.parent);
              if (!p) return null;
              return <line key={`edge-${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke="#9aa7b4" strokeWidth={1.4} />;
            })}
            {mx ? <line x1={80} y1={h / 2} x2={260} y2={h / 2} stroke="#9aa7b4" strokeWidth={1.6} /> : null}
            {nodes.map((n) => {
              const color = n.kind === "fw" ? "#5cb85c" : n.kind === "sw" ? "#2273c1" : n.kind === "ap" ? "#1a3a52" : n.kind === "cam" ? "#8e44ad" : "#6b7785";
              return (
                <g key={n.id}>
                  {n.kind === "cloud" ? (
                    <ellipse cx={n.x} cy={n.y} rx={30} ry={18} fill="#6b7785" />
                  ) : (
                    <rect x={n.x - 22} y={n.y - 14} width={44} height={28} rx={4} ry={4} fill={color} />
                  )}
                  <text x={n.x} y={n.y + 28} textAnchor="middle" fontSize={10} fill="#2b3138">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 5. Traffic analytics — source renderTraffic() (illustrative/static, ported as reference content)
// ===================================================================

// Static reference content — source's traffic analytics is itself
// illustrative (hardcoded app/category/destination tables, no real per-app
// tracking in state), so this is ported at matching fidelity rather than
// fabricating new realism, per the porting brief.
const TRAFFIC_APPS = [
  { name: "Microsoft 365", usageMb: 142, share: 32 },
  { name: "Zoom", usageMb: 98, share: 22 },
  { name: "YouTube", usageMb: 76, share: 17 },
  { name: "Salesforce", usageMb: 54, share: 12 },
  { name: "GitHub", usageMb: 38, share: 9 },
  { name: "iCloud", usageMb: 22, share: 5 },
  { name: "Other", usageMb: 14, share: 3 },
];

const TRAFFIC_CATEGORIES = [
  { name: "Business / collaboration", share: 52 },
  { name: "Software updates", share: 16 },
  { name: "Video streaming", share: 14 },
  { name: "Social networking", share: 7 },
  { name: "Online backup", share: 5 },
  { name: "Adult / blocked", share: 0 },
  { name: "Other", share: 6 },
];

const TRAFFIC_DESTINATIONS = [
  { country: "United States", share: 78 },
  { country: "Ireland (Azure)", share: 9 },
  { country: "Netherlands", share: 4 },
  { country: "Singapore", share: 3 },
  { country: "India", share: 3 },
  { country: "Other", share: 3 },
];

const PIE_COLORS = ["#5cb85c", "#2273c1", "#f0ad4e", "#8e44ad", "#1a3a52", "#5bc0de", "#95a5a6"];

function pieSlices(parts: number[]): { path: string; color: string }[] {
  const total = parts.reduce((s, p) => s + p, 0) || 1;
  let cumulative = 0;
  return parts.map((part, i) => {
    const frac = part / total;
    const start = cumulative * Math.PI * 2;
    const end = (cumulative + frac) * Math.PI * 2;
    cumulative += frac;
    const x1 = Math.cos(start) * 80;
    const y1 = Math.sin(start) * 80;
    const x2 = Math.cos(end) * 80;
    const y2 = Math.sin(end) * 80;
    const large = frac > 0.5 ? 1 : 0;
    return { path: `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A80 80 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`, color: PIE_COLORS[i % PIE_COLORS.length] };
  });
}

export function NwTrafficAnalyticsPage({ state }: { state: MerakiState }) {
  void state; // current-network scoping not modeled in source's static traffic tables
  const slices = pieSlices(TRAFFIC_APPS.map((a) => a.share));

  return (
    <div>
      <h1 className={styles.pageH}>Traffic analytics</h1>
      <div className={styles.help}>
        Application categorization powered by Cisco Talos. Traffic analytics must be <b>enabled</b> on the network (Network-wide &rsaquo; General).
        Figures below are illustrative reference data, matching source&apos;s static traffic-analytics fidelity.
      </div>

      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardH}>Top applications (24h)</div>
          <div className={styles.cardB}>
            <div className={styles.flex} style={{ gap: 18, alignItems: "flex-start" }}>
              <svg width={170} height={170} viewBox="-100 -100 200 200">
                {slices.map((s, i) => (
                  <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1} />
                ))}
              </svg>
              <div style={{ flex: 1 }}>
                <table className={styles.table}>
                  <tbody>
                    {TRAFFIC_APPS.map((a) => (
                      <tr key={a.name}>
                        <td>{a.name}</td>
                        <td>{a.usageMb} MB</td>
                        <td>{a.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardH}>Top categories</div>
          <div className={`${styles.cardB} ${styles.cardBDense}`}>
            <DataTable
              columns={[
                { key: "name", header: "Category", render: (c: (typeof TRAFFIC_CATEGORIES)[number]) => c.name },
                { key: "share", header: "Share", render: (c: (typeof TRAFFIC_CATEGORIES)[number]) => `${c.share}%` },
                {
                  key: "bar",
                  header: "",
                  render: (c: (typeof TRAFFIC_CATEGORIES)[number]) => (
                    <div className={styles.bar}>
                      <div style={{ width: `${c.share}%` }} />
                    </div>
                  ),
                },
              ]}
              rows={TRAFFIC_CATEGORIES}
              getRowKey={(c) => c.name}
              dense
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Top destination countries</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "country", header: "Country", render: (d: (typeof TRAFFIC_DESTINATIONS)[number]) => d.country },
              { key: "share", header: "Share", render: (d: (typeof TRAFFIC_DESTINATIONS)[number]) => `${d.share}%` },
              {
                key: "bar",
                header: "",
                render: (d: (typeof TRAFFIC_DESTINATIONS)[number]) => (
                  <div className={styles.bar}>
                    <div style={{ width: `${d.share}%` }} />
                  </div>
                ),
              },
            ]}
            rows={TRAFFIC_DESTINATIONS}
            getRowKey={(d) => d.country}
            dense
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 6. Health — source renderHealth()
// ===================================================================

export function NwHealthPage({ state }: { state: MerakiState }) {
  const devices = devicesInCurrentNetwork(state);
  const wan = devices.find((d) => d.type === "appliance");

  const onlineCount = devices.filter((d) => d.status === "online").length;
  const alertingCount = devices.filter((d) => d.status === "alerting").length;
  const offlineCount = devices.filter((d) => d.status === "offline").length;

  const clients = clientsInCurrentNetwork(state);
  const clientsOnline = clients.filter((c) => c.status === "online").length;

  return (
    <div>
      <h1 className={styles.pageH}>Health</h1>

      <StatRow
        stats={[
          { label: "Devices online", value: onlineCount, sub: `of ${devices.length}` },
          { label: "Devices alerting", value: alertingCount },
          { label: "Devices offline", value: offlineCount },
          { label: "Clients online", value: clientsOnline, sub: `of ${clients.length}` },
        ]}
      />

      {wan?.wan1 ? (
        <div className={styles.card}>
          <div className={styles.cardH}>WAN uplinks</div>
          <div className={`${styles.cardB} ${styles.cardBDense}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Uplink</th>
                  <th>ISP</th>
                  <th>Public IP</th>
                  <th>Status</th>
                  <th>Loss</th>
                  <th>Latency</th>
                  <th>Jitter</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>WAN 1</td>
                  <td>{wan.wan1.isp}</td>
                  <td className={styles.mono}>{wan.wan1.publicIp}</td>
                  <td>
                    <StatusPill tone={statusTone(wan.wan1.status)}>{wan.wan1.status}</StatusPill>
                  </td>
                  <td>{wan.wan1.loss}%</td>
                  <td>{wan.wan1.latency} ms</td>
                  <td>{wan.wan1.jitter} ms</td>
                </tr>
                {wan.wan2 ? (
                  <tr>
                    <td>WAN 2</td>
                    <td>{wan.wan2.isp}</td>
                    <td className={styles.mono}>{wan.wan2.publicIp}</td>
                    <td>
                      <StatusPill tone={statusTone(wan.wan2.status)}>{wan.wan2.status}</StatusPill>
                    </td>
                    <td>{wan.wan2.loss}%</td>
                    <td>{wan.wan2.latency} ms</td>
                    <td>{wan.wan2.jitter} ms</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardH}>Device health</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Device",
                render: (d: MerakiDevice) => d.name,
              },
              { key: "model", header: "Model", render: (d: MerakiDevice) => d.model },
              { key: "status", header: "Status", render: (d: MerakiDevice) => <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill> },
            ]}
            rows={devices}
            getRowKey={(d) => d.serial}
            dense
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 7. Alerts — source renderAlerts()/_dismissAlert()
// ===================================================================

function AlertTypeRow({ alertType, dispatch }: { alertType: MerakiAlertType; dispatch: React.Dispatch<MerakiAction> }) {
  // Local draft state, matching the ClientDetailFlyout pattern: this is the
  // fix for source's bug where the Save button never read the
  // enabled-checkbox/threshold-input values back into state.
  const [enabled, setEnabled] = useState(alertType.enabled);
  const [threshold, setThreshold] = useState(alertType.threshold != null ? String(alertType.threshold) : "");
  const [dirty, setDirty] = useState(false);

  function handleSave() {
    const parsedThreshold = threshold.trim() === "" ? null : Number(threshold);
    dispatch({
      type: "UPDATE_ALERT_TYPE",
      alertTypeId: alertType.id,
      patch: { enabled, threshold: Number.isNaN(parsedThreshold) ? alertType.threshold : parsedThreshold },
    });
    toast.success(`Alert configuration saved for "${alertType.label}"`);
    setDirty(false);
  }

  return (
    <tr>
      <td>{alertType.label}</td>
      <td>
        <Toggle
          checked={enabled}
          onChange={(v) => {
            setEnabled(v);
            setDirty(true);
          }}
        />
      </td>
      <td>
        <input
          className={styles.input}
          style={{ width: 80 }}
          value={threshold}
          onChange={(e) => {
            setThreshold(e.target.value);
            setDirty(true);
          }}
        />
      </td>
      <td>
        <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`} disabled={!dirty} onClick={handleSave}>
          Save
        </button>
      </td>
    </tr>
  );
}

export function NwAlertsPage({ state, dispatch }: MerakiPageProps) {
  const activeAlerts = state.alerts.active.filter((a) => a.networkId === state.currentNetworkId);

  function handleDismiss(alertId: string) {
    dispatch({ type: "DISMISS_ALERT", alertId });
    toast.success("Alert dismissed");
  }

  return (
    <div>
      <h1 className={styles.pageH}>Alerts</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>Active alerts</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "ts", header: "Time", render: (a: MerakiState["alerts"]["active"][number]) => <span className={styles.mono}>{a.ts}</span> },
              {
                key: "severity",
                header: "Severity",
                render: (a: MerakiState["alerts"]["active"][number]) => <StatusPill tone={statusTone(a.severity)}>{a.severity}</StatusPill>,
              },
              { key: "source", header: "Source", render: (a: MerakiState["alerts"]["active"][number]) => a.source },
              { key: "message", header: "Message", render: (a: MerakiState["alerts"]["active"][number]) => a.message },
              {
                key: "actions",
                header: "",
                render: (a: MerakiState["alerts"]["active"][number]) => (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSm}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(a.id);
                    }}
                  >
                    Dismiss
                  </button>
                ),
              },
            ]}
            rows={activeAlerts}
            getRowKey={(a) => a.id}
            dense
            emptyMessage="No active alerts."
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Alert recipients</div>
        <div className={styles.cardB}>
          {state.alerts.recipients.map((r) => (
            <span key={r} className={styles.tag}>
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Configure alert types</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Alert</th>
                <th>Enabled</th>
                <th>Threshold</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.alerts.types.map((t) => (
                <AlertTypeRow key={t.id} alertType={t} dispatch={dispatch} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 8. General — source renderGeneral() (read-only display, no backing action)
// ===================================================================

export function NwGeneralPage({ state }: { state: MerakiState }) {
  const net = currentNetwork(state);
  if (!net) return <EmptyState message="No network selected." />;

  return (
    <div>
      <h1 className={styles.pageH}>General settings</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>Network details</div>
        <div className={styles.cardB}>
          <div className={styles.formrow}>
            <label>Network name</label>
            <div>{net.name}</div>
          </div>
          <div className={styles.formrow}>
            <label>Time zone</label>
            <div>{net.tz}</div>
          </div>
          <div className={styles.formrow}>
            <label>Region</label>
            <div>{net.region}</div>
          </div>
          <div className={styles.formrow}>
            <label>Network tag</label>
            <div>
              <span className={styles.tag}>{net.tag}</span>
            </div>
          </div>
          <div className={styles.formrow}>
            <label>Product types</label>
            <div>{net.productTypes.join(", ")}</div>
          </div>
          <div className={styles.formrow}>
            <label>Status</label>
            <div>
              <StatusPill tone={statusTone(net.status)}>{net.status}</StatusPill>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.small}>
        Settings here are read-only in this simulator — no editable backing action exists for network configuration
        beyond what other Network-wide pages (Clients, Devices, Alerts, Administrators) already wire up.
      </div>
    </div>
  );
}

// ===================================================================
// 9. Administrators — source renderAdmins() (fixes decorative Add/Edit buttons)
// ===================================================================

function AddAdminModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<MerakiAction> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ADMIN_ROLES[1]);

  function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address for the new administrator");
      return;
    }
    const admin: MerakiAdminUser = {
      id: `adm-${Date.now().toString(36)}`,
      email: trimmed,
      role,
      networks: [],
    };
    dispatch({ type: "ADD_ADMIN_USER", admin });
    toast.success(`Added administrator ${trimmed}`);
    onClose();
  }

  return (
    <Modal
      title="Add administrator"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Add admin
          </button>
        </>
      }
    >
      <Field label="Email address">
        <input
          className={`${styles.input} ${styles.full}`}
          placeholder="admin@cloudlab.io"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Role">
        <NativeSelect value={role} onChange={setRole} options={ADMIN_ROLES.map((r) => ({ value: r, label: r }))} />
      </Field>
    </Modal>
  );
}

function DeleteAdminModal({
  admin,
  onClose,
  dispatch,
}: {
  admin: MerakiAdminUser;
  onClose: () => void;
  dispatch: React.Dispatch<MerakiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_ADMIN_USER", id: admin.id });
    toast.success(`Removed administrator ${admin.email}`);
    onClose();
  }

  return (
    <Modal
      title="Remove administrator"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleConfirm}>
            Remove
          </button>
        </>
      }
    >
      <p>
        Remove <b>{admin.email}</b> ({admin.role}) as an administrator? This cannot be undone.
      </p>
    </Modal>
  );
}

export function NwAdminsPage({ state, dispatch }: MerakiPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MerakiAdminUser | null>(null);

  return (
    <div>
      <h1 className={styles.pageH}>Administrators</h1>

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAddModal(true)}>
            + Add admin
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "email", header: "Email", render: (a: MerakiAdminUser) => a.email },
              { key: "role", header: "Role", render: (a: MerakiAdminUser) => a.role },
              {
                key: "networks",
                header: "Networks",
                render: (a: MerakiAdminUser) => (a.networks.length ? a.networks.join(", ") : "All networks"),
              },
              {
                key: "actions",
                header: "",
                render: (a: MerakiAdminUser) => (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(a);
                    }}
                  >
                    Delete
                  </button>
                ),
              },
            ]}
            rows={state.adminUsers}
            getRowKey={(a) => a.id}
            dense
            emptyMessage="No administrators configured."
          />
        </div>
      </div>

      {showAddModal ? <AddAdminModal onClose={() => setShowAddModal(false)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteAdminModal admin={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 10. Network templates — source renderTemplates() (thin static stub, ported at matching fidelity)
// ===================================================================

export function NwTemplatesPage({ state }: { state: MerakiState }) {
  const net = currentNetwork(state);

  return (
    <div>
      <h1 className={styles.pageH}>Network templates</h1>
      <div className={styles.card}>
        <div className={styles.cardB}>
          <p className={styles.small}>
            No templates currently bound to <b>{net ? net.name : "this network"}</b>. Use a template to push a common SSID, firewall, and
            switch profile across multiple networks at once.
          </p>
        </div>
      </div>
    </div>
  );
}
