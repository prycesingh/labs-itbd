"use client";

// Switch nav-group pages for the Cisco Meraki dashboard simulator. Ported
// from itbd-lab/simulators/meraki/js/meraki-switch.js (renderSwitches(),
// renderPorts()/openPort()/_savePort(), renderRouting(), renderAcl()).
//
// Three source bugs are deliberately NOT reproduced here (fixed at the
// data/reducer layer; this file exercises the fixes):
//   1. Source's `portsCache` (module-level JS object) never persisted port
//      edits back into `MerakiData.state` — `_savePort()` mutated a cache
//      entry that no render path ever read from again. Ports are now real,
//      eagerly-seeded `device.ports` state (seedData.ts `buildSwitchPorts()`)
//      and edits are persisted via the `UPDATE_SWITCH_PORT` reducer action.
//   2. Source's `_switchSwitch()` spliced the chosen device to the front of
//      the shared `MerakiData.state.devices` array as a side effect of
//      merely viewing a different switch's ports. There is no such reducer
//      action here — "which switch's ports are shown" is ordinary
//      component-local `useState`, and `state.devices` is never reordered.
//   3. Source's Routing & DHCP page (renderRouting()) hardcoded a second,
//      divergent VLAN table (own vlan/name/cidr/mxIp/dhcp literals) instead
//      of reading from any canonical list. This port reads the real
//      canonical `state.vlans[]` (reconciled in seedData.ts) instead.
//
// Source's ACL page (renderAcl()) is 100% hardcoded/static — not read from
// state, no reducer action exists (and none was planned per the porting
// brief: reducer.ts has no ACL action). It is ported as a clearly-labeled
// static reference table with source's exact rows, not new CRUD.

import { useState } from "react";

import type { MerakiState } from "@/lib/labs/simulators/meraki/types";
import type { MerakiAction } from "@/lib/labs/simulators/meraki/reducer";
import {
  DataTable,
  EmptyState,
  Field,
  Flyout,
  NativeSelect,
  StatusPill,
  Toggle,
  statusTone,
  type DataTableColumn,
} from "./meraki-ui";
import styles from "./meraki-console.module.css";
import { toast } from "sonner";

type MerakiDevice = MerakiState["devices"][number];
type MerakiSwitchPort = NonNullable<MerakiDevice["ports"]>[number];

function currentNetwork(state: MerakiState) {
  return state.networks.find((n) => n.id === state.currentNetworkId);
}

function switchesInCurrentNetwork(state: MerakiState): MerakiDevice[] {
  const networkId = state.currentNetworkId;
  return state.devices.filter((d) => d.type === "switch" && d.networkId === networkId);
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

// ===================================================================
// 1. Switches list — ported from renderSwitches()
// ===================================================================
export function SwSwitchesPage({
  state,
  onSelectSwitch,
}: {
  state: MerakiState;
  onSelectSwitch: (serial: string) => void;
}) {
  const switches = switchesInCurrentNetwork(state);

  const columns: DataTableColumn<MerakiDevice>[] = [
    { key: "name", header: "Name", render: (s) => s.name },
    { key: "model", header: "Model", render: (s) => s.model },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill>,
    },
    {
      key: "poe",
      header: "PoE",
      render: (s) =>
        s.poeBudget && s.poeBudget > 0 ? (
          `${s.poeUsed ?? 0}W / ${s.poeBudget}W (${Math.round(((s.poeUsed ?? 0) / s.poeBudget) * 100)}%)`
        ) : (
          "N/A"
        ),
    },
    {
      key: "ports",
      header: "Ports active",
      render: (s) => `${s.portsActive ?? 0} / ${s.portsTotal ?? 0}`,
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; <b>Switches</b>
      </div>
      <h1 className={styles.pageH}>Switches</h1>

      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={switches}
            getRowKey={(s) => s.serial}
            onRowClick={(s) => onSelectSwitch(s.serial)}
            emptyMessage="No switches in this network."
            dense
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 2. Switch ports — ported from renderPorts()/openPort()/_savePort()
// ===================================================================
export function SwPortsPage({ state, dispatch }: { state: MerakiState; dispatch: React.Dispatch<MerakiAction> }) {
  const switches = switchesInCurrentNetwork(state);

  // Bug fix #2: which switch's ports are shown lives in ordinary local
  // React state — never mutate state.devices order to "switch" the active
  // switch (that was source's `_switchSwitch()` splice-to-front hack).
  const [activeSwitchSerial, setActiveSwitchSerial] = useState<string>(switches[0]?.serial ?? "");
  const [openPortId, setOpenPortId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<MerakiSwitchPort>>({});

  const activeSwitch = switches.find((s) => s.serial === activeSwitchSerial) ?? switches[0];
  const ports: MerakiSwitchPort[] = activeSwitch?.ports ?? [];

  const networkVlans = state.vlans.filter((v) => v.networkId === state.currentNetworkId);
  const vlanLabel = (vlanId: number) => {
    const vlan = networkVlans.find((v) => v.id === vlanId);
    return vlan ? `${vlanId} (${vlan.name})` : `${vlanId}`;
  };

  if (!switches.length) {
    return (
      <div>
        <h1 className={styles.pageH}>Switch ports</h1>
        <EmptyState message="No switches in this network." />
      </div>
    );
  }

  const openPort = ports.find((p) => p.portId === openPortId) ?? null;

  function handleOpenPort(port: MerakiSwitchPort) {
    setOpenPortId(port.portId);
    setDraft(port);
  }

  function handleClose() {
    setOpenPortId(null);
    setDraft({});
  }

  function handleSave() {
    if (!activeSwitch || !openPortId) return;
    // Genuine persistence — dispatches UPDATE_SWITCH_PORT directly onto
    // device.ports, fixing source's portsCache bug (edits there never
    // outlived the module-level cache object).
    dispatch({ type: "UPDATE_SWITCH_PORT", serial: activeSwitch.serial, portId: openPortId, patch: draft });
    toast.success(`Port ${openPortId} on ${activeSwitch.name} saved`);
    handleClose();
  }

  const columns: DataTableColumn<MerakiSwitchPort>[] = [
    { key: "num", header: "#", render: (p) => p.portId },
    { key: "name", header: "Name", render: (p) => p.name },
    {
      key: "vlan",
      header: "VLAN",
      render: (p) => (
        <>
          VLAN {vlanLabel(p.vlan)}
          <br />
          <span className={styles.small}>Native: {vlanLabel(p.nativeVlan)}</span>
        </>
      ),
    },
    {
      key: "link",
      header: "Link",
      render: (p) =>
        p.linkStatus === "disconnected" ? (
          <StatusPill tone="muted">Down</StatusPill>
        ) : (
          <StatusPill tone="ok">Connected</StatusPill>
        ),
    },
    {
      key: "poe",
      header: "PoE",
      render: (p) => (p.poe.enabled ? `${p.poe.used}W / ${p.poe.max}W` : "-"),
    },
    {
      key: "counters",
      header: "Counters",
      render: (p) => (
        <span className={styles.small}>
          {formatBytes(p.rxBytes)} RX / {formatBytes(p.txBytes)} TX
        </span>
      ),
    },
    {
      key: "errors",
      header: "Errors",
      render: (p) => (p.errors > 10 ? <StatusPill tone="warn">{p.errors}</StatusPill> : p.errors),
    },
    { key: "access", header: "Access policy", render: (p) => p.accessPolicy },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; <b>Switch ports</b>
      </div>
      <h1 className={styles.pageH}>Switch ports</h1>

      <div className={styles.actbar}>
        <div className={styles.actbarLeft}>
          <label className={styles.small}>Switch:</label>
          <NativeSelect
            value={activeSwitchSerial}
            onChange={(v) => setActiveSwitchSerial(v)}
            options={switches.map((s) => ({ value: s.serial, label: s.name }))}
          />
        </div>
      </div>

      {activeSwitch ? (
        <div className={styles.card}>
          <div className={styles.cardH}>
            {activeSwitch.name} &mdash; {activeSwitch.model}
          </div>
          <div className={styles.cardB}>
            <div className={styles.portgrid}>
              {ports.map((p) => {
                const up = p.linkStatus !== "disconnected";
                const cls = [
                  styles.port,
                  up ? styles.portUp : styles.portDown,
                  p.poe.used > 25 ? styles.portPoeWarn : "",
                  p.vlan === 1 && p.allowedVlans === "all" ? styles.portTrunk : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={p.portId} className={cls} title={`Port ${p.portId}`} onClick={() => handleOpenPort(p)}>
                    {p.portId}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <div className={styles.cardH}>Port detail</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={ports} getRowKey={(p) => p.portId} onRowClick={handleOpenPort} dense emptyMessage="No ports." />
        </div>
      </div>

      {openPort && activeSwitch ? (
        <Flyout
          title={`Port ${openPort.portId} — ${activeSwitch.name}`}
          onClose={handleClose}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={handleClose}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={() => toast.success("Port cycled")}>
                Cycle port
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
                Save
              </button>
            </>
          }
        >
          <div className={styles.grid2}>
            <div>
              <Field label="Name (description)">
                <input
                  className={`${styles.input} ${styles.full}`}
                  value={draft.name ?? openPort.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>
              <Field label="Enabled">
                <Toggle checked={draft.enabled ?? openPort.enabled} onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} />
              </Field>
              <Field label="VLAN (access)">
                <NativeSelect
                  value={String(draft.vlan ?? openPort.vlan)}
                  onChange={(v) => setDraft((d) => ({ ...d, vlan: Number(v) }))}
                  options={networkVlans.map((v) => ({ value: String(v.id), label: `${v.id} — ${v.name}` }))}
                />
              </Field>
              <Field label="Native VLAN (trunk)">
                <NativeSelect
                  value={String(draft.nativeVlan ?? openPort.nativeVlan)}
                  onChange={(v) => setDraft((d) => ({ ...d, nativeVlan: Number(v) }))}
                  options={networkVlans.map((v) => ({ value: String(v.id), label: `${v.id} — ${v.name}` }))}
                />
              </Field>
              <Field label="Allowed VLANs (trunk)">
                <input
                  className={`${styles.input} ${styles.full}`}
                  value={draft.allowedVlans ?? openPort.allowedVlans}
                  onChange={(e) => setDraft((d) => ({ ...d, allowedVlans: e.target.value }))}
                />
              </Field>
            </div>
            <div>
              <Field label="PoE">
                <Toggle
                  label="Enabled"
                  checked={draft.poe?.enabled ?? openPort.poe.enabled}
                  onChange={(v) => setDraft((d) => ({ ...d, poe: { ...openPort.poe, ...d.poe, enabled: v } }))}
                />
              </Field>
              <Field label="PoE budget (max, W)">
                <input
                  className={styles.input}
                  type="number"
                  style={{ width: 120 }}
                  value={draft.poe?.max ?? openPort.poe.max}
                  onChange={(e) => setDraft((d) => ({ ...d, poe: { ...openPort.poe, ...d.poe, max: Number(e.target.value) || 0 } }))}
                />
              </Field>
              <Field label="STP guard">
                <NativeSelect
                  value={draft.stpGuard ?? openPort.stpGuard}
                  onChange={(v) => setDraft((d) => ({ ...d, stpGuard: v }))}
                  options={[
                    { value: "None", label: "None" },
                    { value: "Root guard", label: "Root guard" },
                    { value: "BPDU guard", label: "BPDU guard" },
                    { value: "Loop guard", label: "Loop guard" },
                  ]}
                />
              </Field>
              <Field label="Storm control">
                <Toggle checked={draft.stormControl ?? openPort.stormControl} onChange={(v) => setDraft((d) => ({ ...d, stormControl: v }))} />
              </Field>
              <Field label="Access policy">
                <NativeSelect
                  value={draft.accessPolicy ?? openPort.accessPolicy}
                  onChange={(v) => setDraft((d) => ({ ...d, accessPolicy: v }))}
                  options={[
                    { value: "None", label: "None" },
                    { value: "Open", label: "Open" },
                    { value: "Sticky MAC", label: "Sticky MAC" },
                    { value: "MAC-based", label: "MAC-based" },
                    { value: "802.1X (Open auth)", label: "802.1X (Open auth)" },
                    { value: "802.1X + MAB", label: "802.1X + MAB" },
                  ]}
                />
              </Field>
            </div>
          </div>

          <div className={styles.sectionTitle}>Live counters</div>
          <dl className={styles.kv}>
            <dt>Link</dt>
            <dd>{openPort.linkStatus === "disconnected" ? "Down" : "Connected"}</dd>
            <dt>RX / TX bytes</dt>
            <dd>
              {(openPort.rxBytes / 1024 / 1024).toFixed(1)} MB / {(openPort.txBytes / 1024 / 1024).toFixed(1)} MB
            </dd>
            <dt>Tagged frames</dt>
            <dd>{openPort.taggedCount.toLocaleString()}</dd>
            <dt>Untagged frames</dt>
            <dd>{openPort.untaggedCount.toLocaleString()}</dd>
            <dt>Errors</dt>
            <dd>{openPort.errors}</dd>
          </dl>
        </Flyout>
      ) : null}
    </div>
  );
}

// ===================================================================
// 3. Routing & DHCP — ported from renderRouting(), replacing source's
// second divergent hardcoded VLAN table with the real canonical state.vlans[]
// ===================================================================
export function SwRoutingDhcpPage({ state }: { state: MerakiState }) {
  const network = currentNetwork(state);
  const vlans = state.vlans.filter((v) => v.networkId === state.currentNetworkId);

  const columns: DataTableColumn<MerakiState["vlans"][number]>[] = [
    { key: "vlan", header: "VLAN", render: (v) => v.id },
    { key: "name", header: "Name", render: (v) => v.name },
    { key: "subnet", header: "Subnet", render: (v) => <span className={styles.mono}>{v.subnet}</span> },
    { key: "mxIp", header: "MX IP", render: (v) => <span className={styles.mono}>{v.mxIp}</span> },
    { key: "groupPolicy", header: "Group policy", render: (v) => v.groupPolicy ?? "—" },
    { key: "dhcp", header: "DHCP", render: (v) => v.dhcpMode },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; <b>Routing &amp; DHCP</b>
      </div>
      <h1 className={styles.pageH}>Routing &amp; DHCP (Layer 3)</h1>
      <div className={styles.pageSub}>{network ? network.name : "No network selected"}</div>

      <div className={styles.card}>
        <div className={styles.cardH}>Interface (VLAN) configuration</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={vlans} getRowKey={(v) => `${v.networkId}-${v.id}`} dense emptyMessage="No VLANs configured for this network." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 4. ACL — source's renderAcl() is 100% hardcoded/static (not read from
// state) and no ACL reducer action exists (none planned per the porting
// brief). Ported as a clearly-labeled static reference table matching
// source's exact rows/fidelity, not new CRUD.
// ===================================================================
type AclRule = {
  id: number;
  policy: "allow" | "deny";
  proto: string;
  src: string;
  dst: string;
  dstPort?: string;
  comment: string;
  enabled: boolean;
};

const ACL_RULES: AclRule[] = [
  { id: 1, policy: "allow", proto: "any", src: "any", dst: "any", comment: "Default allow", enabled: true },
  { id: 2, policy: "deny", proto: "tcp", src: "10.0.40.0/24", dst: "10.0.20.0/24", dstPort: "22,3389", comment: "IoT -> Servers SSH/RDP", enabled: true },
  { id: 3, policy: "deny", proto: "udp", src: "10.0.30.0/24", dst: "any", dstPort: "53", comment: "Guest external DNS", enabled: true },
];

export function SwAclPage({ state }: { state: MerakiState }) {
  const columns: DataTableColumn<AclRule>[] = [
    { key: "id", header: "#", render: (r) => r.id },
    {
      key: "policy",
      header: "Policy",
      render: (r) => <StatusPill tone={r.policy === "allow" ? "ok" : "crit"}>{r.policy}</StatusPill>,
    },
    { key: "proto", header: "Proto", render: (r) => r.proto },
    { key: "src", header: "Source", render: (r) => <span className={styles.mono}>{r.src}</span> },
    {
      key: "dst",
      header: "Destination",
      render: (r) => (
        <span className={styles.mono}>
          {r.dst}
          {r.dstPort ? `:${r.dstPort}` : ""}
        </span>
      ),
    },
    { key: "comment", header: "Comment", render: (r) => r.comment },
    {
      key: "state",
      header: "State",
      render: (r) => (r.enabled ? <StatusPill tone="ok">Enabled</StatusPill> : <StatusPill tone="muted">Disabled</StatusPill>),
    },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; <b>Layer 3 ACL</b>
      </div>
      <h1 className={styles.pageH}>Layer 3 ACL</h1>
      <div className={styles.help}>
        Reference view — matches the source simulator&rsquo;s static ACL rule set. This page is not backed by a reducer action; no add/edit/delete
        controls are exposed here.
      </div>

      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={ACL_RULES} getRowKey={(r) => String(r.id)} dense />
        </div>
      </div>
    </div>
  );
}
