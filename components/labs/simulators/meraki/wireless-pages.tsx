"use client";

// Wireless nav-group pages for the Cisco Meraki dashboard simulator. Ported
// from itbd-lab/simulators/meraki/js/meraki-wireless.js (336 lines): Access
// points list + detail, SSIDs (15 slots per network, 7-tab editor), Air
// Marshal (rogue AP detection), Bluetooth clients (read-only).
//
// Two real bug fixes vs. source, both called out at their call sites below:
//
// 1. AP "Reboot" — source's AP modal "Reboot" button
//    (`MerakiPortal.toast('AP rebooted', 'ok');MerakiPortal.closeModal()`)
//    never touched state at all. This port wires it to the real
//    device-lifecycle engine: dispatch `START_DEVICE_REBOOT`, then run a real
//    `setInterval` dispatching `ADVANCE_DEVICE_LIFECYCLE` every ~2s until
//    `device.pendingAction` goes back to null, mirroring
//    power-platform/flows-page.tsx's flow-run wiring pattern (interval map
//    keyed by id, ref-tracked, cleared on terminal state and on unmount).
//
// 2. SSID editor Save — source's `_ssidSave` only ever read 5 DOM fields from
//    the Access-control tab (name/enabled/hidden/authMode/psk); edits made on
//    any of the other 6 tabs (Splash, Network access, Traffic shaping,
//    Firewall, Hotspot 2.0, Wireless concentrator) were silently discarded on
//    Save. This port stages edits from ALL 7 tabs in one local component
//    state object (a `Partial<MerakiSsid>` patch) across tab switches, and a
//    single Save button dispatches ONE `UPDATE_SSID` with the full
//    accumulated patch — nothing typed into any tab is lost.
//
// Air Marshal's Contain/Reclassify buttons are decorative in source (no
// backing mutation - only a "Contain" would-deauth explanation in the help
// text) and reducer.ts has no Air Marshal action, so they remain toast-only
// here too, matching source's own fidelity rather than fabricating a new
// state mutation with no reducer support.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { MerakiAction } from "@/lib/labs/simulators/meraki/reducer";
import type {
  MerakiAirMarshalAp,
  MerakiBluetoothClient,
  MerakiDevice,
  MerakiFirewallL3Rule,
  MerakiFirewallL7Rule,
  MerakiSsid,
  MerakiSsidAuthMode,
  MerakiState,
} from "@/lib/labs/simulators/meraki/types";
import {
  DataTable,
  type DataTableColumn,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatusPill,
  TabBar,
  Toggle,
  statusTone,
} from "./meraki-ui";
import styles from "./meraki-console.module.css";

// How often a device with a pending reboot/firmware action advances one tick
// — matches power-platform/flows-page.tsx's ADVANCE_INTERVAL_MS convention
// (real wall-clock cadence, not instant) and device-lifecycle-engine.ts's
// doc comment suggesting ~2s.
const ADVANCE_INTERVAL_MS = 2000;

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

// ===================================================================
// Access points
// ===================================================================

function apStatusTone(status: MerakiDevice["status"]) {
  return statusTone(status);
}

function ApDetailFlyout({
  ap,
  state,
  dispatch,
  onClose,
}: {
  ap: MerakiDevice;
  state: MerakiState;
  dispatch: React.Dispatch<MerakiAction>;
  onClose: () => void;
}) {
  // Always re-read the live device from state so the "Rebooting..." progress
  // reflects real reducer state, not a stale snapshot taken when the flyout
  // opened.
  const liveAp = state.devices.find((d) => d.serial === ap.serial) ?? ap;

  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  function clearDeviceInterval(serial: string) {
    const interval = intervalsRef.current.get(serial);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(serial);
    }
  }

  // While this AP has a pending lifecycle action (reboot/firmware-update),
  // run a real setInterval dispatching ADVANCE_DEVICE_LIFECYCLE until the
  // reducer clears pendingAction back to null (terminal state) — the actual
  // fix for source's fake, instant "AP rebooted" toast.
  useEffect(() => {
    if (!liveAp.pendingAction) return;
    const serial = liveAp.serial;
    if (intervalsRef.current.has(serial)) return;
    const interval = setInterval(() => {
      dispatch({ type: "ADVANCE_DEVICE_LIFECYCLE", serial, nowIso: new Date().toISOString() });
    }, ADVANCE_INTERVAL_MS);
    intervalsRef.current.set(serial, interval);
    return () => clearDeviceInterval(serial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAp.pendingAction, liveAp.serial, dispatch]);

  // Clean up every tracked interval on unmount (flyout closed mid-reboot)
  // so no zombie timer keeps dispatching after this component is gone.
  useEffect(() => {
    const intervals = intervalsRef.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
    };
  }, []);

  // Toast once when reboot completes — tracked so it fires exactly once per
  // transition rather than on every re-render.
  const [announcedIdle, setAnnouncedIdle] = useState(true);
  useEffect(() => {
    if (liveAp.pendingAction) {
      setAnnouncedIdle(false);
      return;
    }
    if (!announcedIdle) {
      toast.success(`${liveAp.name} rebooted`, { description: "Device is back online." });
      setAnnouncedIdle(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAp.pendingAction]);

  function handleReboot() {
    dispatch({ type: "START_DEVICE_REBOOT", serial: liveAp.serial, nowIso: new Date().toISOString() });
    toast.info(`Rebooting ${liveAp.name}...`);
  }

  const clients = state.clients.filter((c) => c.connectedTo === liveAp.serial);
  const neighbors = state.devices
    .filter((d) => d.type === "wireless" && d.networkId === liveAp.networkId && d.serial !== liveAp.serial)
    .slice(0, 4);

  const isRebooting = !!liveAp.pendingAction;

  return (
    <Flyout
      title={`AP: ${liveAp.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btn} disabled>
            Locate on floor plan
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleReboot} disabled={isRebooting}>
            {isRebooting ? `Rebooting… (${liveAp.pendingAction?.ticksRemaining} tick${liveAp.pendingAction?.ticksRemaining === 1 ? "" : "s"} left)` : "Reboot"}
          </button>
        </>
      }
    >
      {isRebooting ? (
        <div className={styles.help}>
          <StatusPill tone="warn">Rebooting</StatusPill> Reboot in progress — {liveAp.pendingAction?.ticksRemaining} tick
          {liveAp.pendingAction?.ticksRemaining === 1 ? "" : "s"} remaining. This device will return to Online automatically.
        </div>
      ) : null}

      <div className={styles.grid2}>
        <dl className={styles.kv}>
          <dt>Serial</dt>
          <dd className={styles.mono}>{liveAp.serial}</dd>
          <dt>Model</dt>
          <dd>{liveAp.model}</dd>
          <dt>Firmware</dt>
          <dd>{liveAp.firmware}</dd>
          <dt>LAN IP</dt>
          <dd className={styles.mono}>{liveAp.lanIp}</dd>
          <dt>MAC</dt>
          <dd className={styles.mono}>{liveAp.mac}</dd>
          <dt>Uptime</dt>
          <dd>{liveAp.uptimeDays} days</dd>
        </dl>
        <dl className={styles.kv}>
          <dt>Channel (2.4GHz)</dt>
          <dd>
            {liveAp.channel24 ?? "-"} ({liveAp.channelUtil24 ?? 0}% util)
          </dd>
          <dt>Channel (5GHz)</dt>
          <dd>
            {liveAp.channel5 ?? "-"} ({liveAp.channelUtil5 ?? 0}% util)
          </dd>
          <dt>TX power 2.4 / 5</dt>
          <dd>
            {liveAp.txPower24 ?? "-"} / {liveAp.txPower5 ?? "-"} dBm
          </dd>
          <dt>Clients connected</dt>
          <dd>{liveAp.clientsCount ?? 0}</dd>
          <dt>Outdoor?</dt>
          <dd>{liveAp.outdoor ? "Yes" : "No"}</dd>
          <dt>Tags</dt>
          <dd>
            {liveAp.tags.length === 0
              ? "-"
              : liveAp.tags.map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
          </dd>
        </dl>
      </div>

      <div className={styles.sectionTitle}>Clients on this AP</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Client</th>
            <th>MAC</th>
            <th>SSID</th>
            <th>RSSI</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.textC}>
                <span className={styles.small}>No clients</span>
              </td>
            </tr>
          ) : (
            clients.slice(0, 12).map((c) => (
              <tr key={c.id}>
                <td>{c.description}</td>
                <td className={styles.mono}>{c.mac}</td>
                <td>{c.ssid ?? "-"}</td>
                <td>{c.signal != null ? `${c.signal} dBm` : "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className={styles.sectionTitle}>RF neighbours (5 GHz)</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Neighbour AP</th>
            <th>Channel</th>
          </tr>
        </thead>
        <tbody>
          {neighbors.length === 0 ? (
            <tr>
              <td colSpan={2} className={styles.textC}>
                <span className={styles.small}>No neighbours</span>
              </td>
            </tr>
          ) : (
            neighbors.map((n) => (
              <tr key={n.serial}>
                <td>{n.name}</td>
                <td>{n.channel5 ?? "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Flyout>
  );
}

export function WlAccessPointsPage({ state, dispatch }: { state: MerakiState; dispatch: React.Dispatch<MerakiAction> }) {
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);

  const aps = useMemo(
    () => state.devices.filter((d) => d.type === "wireless" && d.networkId === state.currentNetworkId),
    [state.devices, state.currentNetworkId],
  );

  const selectedAp = selectedSerial ? state.devices.find((d) => d.serial === selectedSerial) ?? null : null;

  const columns: DataTableColumn<MerakiDevice>[] = [
    { key: "name", header: "Name", render: (a) => <span className={styles.rowLink}>{a.name}</span> },
    { key: "model", header: "Model", render: (a) => a.model },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill tone={apStatusTone(a.status)}>{a.status}</StatusPill>,
    },
    { key: "clients", header: "Clients", render: (a) => a.clientsCount ?? 0 },
    { key: "channel24", header: "Channel 2.4", render: (a) => a.channel24 ?? "-" },
    { key: "channel5", header: "Channel 5", render: (a) => a.channel5 ?? "-" },
    { key: "util24", header: "Util 2.4", render: (a) => `${a.channelUtil24 ?? 0}%` },
    { key: "util5", header: "Util 5", render: (a) => `${a.channelUtil5 ?? 0}%` },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Access points</h1>
      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={aps}
            getRowKey={(a) => a.serial}
            onRowClick={(a) => setSelectedSerial(a.serial)}
            dense
            emptyMessage="No access points in this network."
          />
        </div>
      </div>

      {selectedAp ? (
        <ApDetailFlyout ap={selectedAp} state={state} dispatch={dispatch} onClose={() => setSelectedSerial(null)} />
      ) : null}
    </div>
  );
}

// ===================================================================
// SSIDs
// ===================================================================

const AUTH_MODE_OPTIONS: { value: MerakiSsidAuthMode; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "psk", label: "WPA2/WPA3-PSK" },
  { value: "8021x-radius", label: "802.1X (RADIUS Enterprise)" },
];

const SPLASH_TYPE_OPTIONS = ["None", "Click-through", "Sign-on with my.meraki.com", "Sign-on with custom RADIUS", "Cisco ISE", "SMS authentication"];

const IP_ASSIGNMENT_OPTIONS = ["NAT mode", "Bridge to LAN", "Layer 3 roaming", "VPN: tunnel to concentrator"];

const MAC_80211W_OPTIONS = ["Disabled", "Optional", "Required"];

const SSID_TABS = [
  { key: "access", label: "Access control" },
  { key: "splash", label: "Splash page" },
  { key: "netaccess", label: "Network access" },
  { key: "shaping", label: "Traffic shaping" },
  { key: "firewall", label: "Firewall" },
  { key: "hotspot", label: "Hotspot 2.0" },
  { key: "concentrator", label: "Wireless concentrator" },
];

// The staged, in-progress edit for a single SSID — a Partial<MerakiSsid> so
// ANY field across ANY of the 7 tabs can be present. This is what fixes
// source's `_ssidSave` bug: instead of reading 5 DOM fields at Save time
// (discarding the other 6 tabs), every tab's inputs write directly into this
// one object as the admin edits, and Save dispatches it whole.
type SsidPatch = Partial<MerakiSsid>;

function AccessControlTab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const name = patch.name ?? ssid.name;
  const enabled = patch.enabled ?? ssid.enabled;
  const hidden = patch.hidden ?? ssid.hidden;
  const authMode = patch.authMode ?? ssid.authMode;
  const psk = patch.psk ?? ssid.psk ?? "";
  const mac80211w = patch.mac80211w ?? ssid.mac80211w;
  const radius = patch.radius ?? ssid.radius;
  const radiusServer = radius.servers[0];

  function updateRadiusServer(fields: Partial<{ host: string; port: number; secret: string }>) {
    const nextServer = { host: radiusServer?.host ?? "", port: radiusServer?.port ?? 1812, secret: radiusServer?.secret ?? "", ...fields };
    onChange({ radius: { ...radius, servers: [nextServer] } });
  }

  function updateRadiusAccounting(accounting: boolean) {
    onChange({ radius: { ...radius, accounting } });
  }

  return (
    <div>
      <Field label="SSID name">
        <input className={`${styles.input} ${styles.full}`} value={name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Enabled">
        <Toggle checked={enabled} onChange={(checked) => onChange({ enabled: checked })} />
      </Field>
      <Field label="Hidden (don't broadcast SSID)">
        <Toggle checked={hidden} onChange={(checked) => onChange({ hidden: checked })} />
      </Field>
      <Field label="Security">
        <NativeSelect value={authMode} onChange={(v) => onChange({ authMode: v as MerakiSsidAuthMode })} options={AUTH_MODE_OPTIONS} className={styles.full} />
      </Field>
      <Field label="Pre-shared key (PSK)" help="Used for WPA2-PSK / WPA3-Personal modes.">
        <input className={`${styles.input} ${styles.full}`} value={psk} onChange={(e) => onChange({ psk: e.target.value })} />
      </Field>
      <Field label="802.11w (PMF)">
        <NativeSelect
          value={mac80211w}
          onChange={(v) => onChange({ mac80211w: v })}
          options={MAC_80211W_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
      </Field>
      <div className={styles.sectionTitle}>RADIUS (for Enterprise modes)</div>
      <Field label="RADIUS server IP">
        <input className={`${styles.input} ${styles.full}`} value={radiusServer?.host ?? ""} onChange={(e) => updateRadiusServer({ host: e.target.value })} />
      </Field>
      <Field label="Port">
        <input
          className={styles.input}
          style={{ width: 120 }}
          value={radiusServer?.port ?? 1812}
          onChange={(e) => updateRadiusServer({ port: Number(e.target.value) || 1812 })}
        />
      </Field>
      <Field label="Shared secret">
        <input
          className={`${styles.input} ${styles.full}`}
          type="password"
          value={radiusServer?.secret ?? ""}
          onChange={(e) => updateRadiusServer({ secret: e.target.value })}
        />
      </Field>
      <Field label="RADIUS accounting">
        <Toggle checked={radius.accounting} onChange={updateRadiusAccounting} />
      </Field>
    </div>
  );
}

function SplashTab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const splash = patch.splash ?? ssid.splash;
  const blockedCountries = patch.splashBlockedCountries ?? ssid.splashBlockedCountries;

  return (
    <div>
      <Field label="Splash type">
        <NativeSelect
          value={splash.type}
          onChange={(v) => onChange({ splash: { ...splash, type: v } })}
          options={SPLASH_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
          className={styles.full}
        />
      </Field>
      <Field label="Splash / terms text">
        <textarea className={styles.textarea} value={splash.text} onChange={(e) => onChange({ splash: { ...splash, text: e.target.value } })} />
      </Field>
      <Field label="Blocked countries" help="Countries whose clients are blocked from this splash page.">
        <div>
          {blockedCountries.length === 0 ? (
            <span className={styles.small}>None</span>
          ) : (
            blockedCountries.map((c) => (
              <span key={c} className={styles.tag}>
                {c}
              </span>
            ))
          )}
        </div>
      </Field>
    </div>
  );
}

function NetworkAccessTab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const ipAssignment = patch.ipAssignment ?? ssid.ipAssignment;
  const vlan = patch.vlan ?? ssid.vlan;
  const mdns = patch.mdns ?? ssid.mdns;
  const minBitrate = patch.minBitrate ?? ssid.minBitrate;
  const perClientLimit = patch.perClientLimit ?? ssid.perClientLimit;

  return (
    <div>
      <Field label="Client IP assignment">
        <NativeSelect
          value={ipAssignment}
          onChange={(v) => onChange({ ipAssignment: v })}
          options={IP_ASSIGNMENT_OPTIONS.map((o) => ({ value: o, label: o }))}
          className={styles.full}
        />
      </Field>
      <Field label="VLAN tagging" help="VLAN ID for tagged bridge mode.">
        <input className={styles.input} style={{ width: 120 }} value={vlan} onChange={(e) => onChange({ vlan: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="mDNS / Bonjour gateway">
        <Toggle checked={mdns} onChange={(checked) => onChange({ mdns: checked })} />
      </Field>
      <Field label="Minimum bitrate (Mbps)">
        <NativeSelect
          value={String(minBitrate)}
          onChange={(v) => onChange({ minBitrate: Number(v) })}
          options={["1", "6", "12", "24"].map((o) => ({ value: o, label: o }))}
        />
      </Field>
      <Field label="Per-client device limit" help="0 = unlimited.">
        <input
          className={styles.input}
          style={{ width: 160 }}
          value={perClientLimit}
          onChange={(e) => onChange({ perClientLimit: Number(e.target.value) || 0 })}
        />
      </Field>
    </div>
  );
}

function TrafficShapingTab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const bandwidthDown = patch.bandwidthDown ?? ssid.bandwidthDown;
  const bandwidthUp = patch.bandwidthUp ?? ssid.bandwidthUp;

  return (
    <div>
      <Field label="Per-client bandwidth down (Kbps)" help="0 = unlimited.">
        <input
          className={styles.input}
          style={{ width: 160 }}
          value={bandwidthDown}
          onChange={(e) => onChange({ bandwidthDown: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Per-client bandwidth up (Kbps)" help="0 = unlimited.">
        <input
          className={styles.input}
          style={{ width: 160 }}
          value={bandwidthUp}
          onChange={(e) => onChange({ bandwidthUp: Number(e.target.value) || 0 })}
        />
      </Field>
    </div>
  );
}

function FirewallTab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const l3Rules = patch.l3Rules ?? ssid.l3Rules;
  const l7Rules = patch.l7Rules ?? ssid.l7Rules;

  function addL3() {
    const rule: MerakiFirewallL3Rule = {
      id: genId("ssid-l3"),
      policy: "allow",
      protocol: "any",
      srcCidr: "Any",
      srcPort: "Any",
      destCidr: "Any",
      destPort: "Any",
      comment: "New rule",
      enabled: true,
    };
    onChange({ l3Rules: [...l3Rules, rule] });
  }
  function removeL3(id: string) {
    onChange({ l3Rules: l3Rules.filter((r) => r.id !== id) });
  }
  function addL7() {
    const rule: MerakiFirewallL7Rule = { id: genId("ssid-l7"), type: "application", value: "New app", policy: "deny", comment: "New rule" };
    onChange({ l7Rules: [...l7Rules, rule] });
  }
  function removeL7(id: string) {
    onChange({ l7Rules: l7Rules.filter((r) => r.id !== id) });
  }

  return (
    <div>
      <div className={styles.sectionTitle}>Layer 3 firewall rules</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Policy</th>
            <th>Proto</th>
            <th>Destination</th>
            <th>Comment</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {l3Rules.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.textC}>
                <span className={styles.small}>No rules</span>
              </td>
            </tr>
          ) : (
            l3Rules.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>
                  <StatusPill tone={r.policy === "allow" ? "ok" : "crit"}>{r.policy}</StatusPill>
                </td>
                <td>{r.protocol}</td>
                <td>{r.destCidr}</td>
                <td>{r.comment}</td>
                <td>
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => removeL3(r.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button type="button" className={`${styles.btn} ${styles.mt8}`} onClick={addL3}>
        + Add L3 rule
      </button>

      <div className={styles.sectionTitle}>Layer 7 firewall rules</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Value</th>
            <th>Policy</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {l7Rules.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.textC}>
                <span className={styles.small}>No rules</span>
              </td>
            </tr>
          ) : (
            l7Rules.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.type}</td>
                <td>{r.value}</td>
                <td>
                  <StatusPill tone="crit">{r.policy}</StatusPill>
                </td>
                <td>
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => removeL7(r.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button type="button" className={`${styles.btn} ${styles.mt8}`} onClick={addL7}>
        + Add L7 rule
      </button>
    </div>
  );
}

function Hotspot20Tab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const hotspot20 = patch.hotspot20 ?? ssid.hotspot20;

  return (
    <div>
      <Field label="Hotspot 2.0 / Passpoint">
        <Toggle checked={hotspot20.enabled} onChange={(checked) => onChange({ hotspot20: { ...hotspot20, enabled: checked } })} />
      </Field>
      <Field label="Operator-friendly name">
        <input
          className={`${styles.input} ${styles.full}`}
          value={hotspot20.operatorName}
          onChange={(e) => onChange({ hotspot20: { ...hotspot20, operatorName: e.target.value } })}
        />
      </Field>
    </div>
  );
}

function ConcentratorTab({ patch, ssid, onChange }: { patch: SsidPatch; ssid: MerakiSsid; onChange: (patch: SsidPatch) => void }) {
  const concentrator = patch.concentrator ?? ssid.concentrator;
  const vlan = patch.vlan ?? ssid.vlan;

  return (
    <div>
      <Field label="Backhaul SSID through MX concentrator">
        <Toggle checked={!!concentrator} onChange={(checked) => onChange({ concentrator: checked ? (concentrator || "HQ-Main MX67") : null })} />
      </Field>
      <Field label="Concentrator network">
        <input
          className={`${styles.input} ${styles.full}`}
          value={concentrator ?? ""}
          disabled={!concentrator}
          onChange={(e) => onChange({ concentrator: e.target.value })}
        />
      </Field>
      <Field label="VLAN at concentrator">
        <input className={styles.input} style={{ width: 120 }} value={vlan} onChange={(e) => onChange({ vlan: Number(e.target.value) || 0 })} />
      </Field>
      <div className={styles.small}>
        Wireless concentrator tunnels all traffic from this SSID to the MX at HQ. Useful for remote-worker AP teleworker mode.
      </div>
    </div>
  );
}

function SsidEditorModal({
  ssid,
  dispatch,
  onClose,
}: {
  ssid: MerakiSsid;
  dispatch: React.Dispatch<MerakiAction>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>("access");
  // The ONE staged patch object accumulating edits across all 7 tabs — this
  // is what Save dispatches whole, fixing source's per-tab-discard bug.
  const [patch, setPatch] = useState<SsidPatch>({});

  function mergePatch(next: SsidPatch) {
    setPatch((prev) => ({ ...prev, ...next }));
  }

  function handleSave() {
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save.");
      onClose();
      return;
    }
    dispatch({ type: "UPDATE_SSID", ssidId: ssid.id, patch });
    toast.success(`SSID "${patch.name ?? ssid.name}" saved`, {
      description: "All 7 tabs' edits were persisted.",
    });
    onClose();
  }

  let body: React.ReactNode;
  switch (tab) {
    case "access":
      body = <AccessControlTab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    case "splash":
      body = <SplashTab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    case "netaccess":
      body = <NetworkAccessTab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    case "shaping":
      body = <TrafficShapingTab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    case "firewall":
      body = <FirewallTab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    case "hotspot":
      body = <Hotspot20Tab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    case "concentrator":
      body = <ConcentratorTab patch={patch} ssid={ssid} onChange={mergePatch} />;
      break;
    default:
      body = null;
  }

  return (
    <Modal
      title={`Configure SSID: ${ssid.name}`}
      onClose={onClose}
      width="820px"
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Save
          </button>
        </>
      }
    >
      <TabBar tabs={SSID_TABS} active={tab} onChange={setTab} />
      {body}
    </Modal>
  );
}

export function WlSsidsPage({ state, dispatch }: { state: MerakiState; dispatch: React.Dispatch<MerakiAction> }) {
  const [editingSsidId, setEditingSsidId] = useState<string | null>(null);

  const ssids = useMemo(
    () => state.ssids.filter((s) => s.networkId === state.currentNetworkId).sort((a, b) => a.slot - b.slot),
    [state.ssids, state.currentNetworkId],
  );

  const editingSsid = editingSsidId ? state.ssids.find((s) => s.id === editingSsidId) ?? null : null;

  const columns: DataTableColumn<MerakiSsid>[] = [
    { key: "slot", header: "#", render: (s) => s.slot },
    {
      key: "name",
      header: "Name",
      render: (s) => (
        <>
          <span className={styles.rowLink}>{s.name}</span>
          {s.hidden ? (
            <span className={styles.tag} style={{ marginLeft: 6 }}>
              Hidden
            </span>
          ) : null}
        </>
      ),
    },
    {
      key: "enabled",
      header: "Enabled",
      render: (s) => (
        <Toggle
          checked={s.enabled}
          onChange={(checked) => {
            dispatch({ type: "UPDATE_SSID", ssidId: s.id, patch: { enabled: checked } });
            toast.success(`SSID "${s.name}" ${checked ? "enabled" : "disabled"}`);
          }}
        />
      ),
    },
    { key: "authMode", header: "Security", render: (s) => s.authMode },
    { key: "clients", header: "Clients", render: (s) => s.clientsCount },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>SSIDs — 15 max per network</h1>
      <div className={styles.help}>
        Click any SSID name to open the full editor (Access control, Splash page, Network access, Traffic shaping, Firewall, Hotspot 2.0, Wireless
        concentrator). All 7 tabs are staged together and saved in one update.
      </div>
      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={columns}
            rows={ssids}
            getRowKey={(s) => s.id}
            onRowClick={(s) => setEditingSsidId(s.id)}
            dense
            emptyMessage="No SSIDs configured for this network."
          />
        </div>
      </div>

      {editingSsid ? <SsidEditorModal ssid={editingSsid} dispatch={dispatch} onClose={() => setEditingSsidId(null)} /> : null}
    </div>
  );
}

// ===================================================================
// Air Marshal
// ===================================================================

function airMarshalTone(threat: string) {
  if (threat.toLowerCase().includes("rogue") || threat.toLowerCase().includes("spoof")) return "crit" as const;
  if (threat.toLowerCase().includes("friendly")) return "ok" as const;
  return "info" as const;
}

export function WlAirMarshalPage({ state }: { state: MerakiState }) {
  const entries = useMemo(
    () => state.airMarshal.filter((a) => a.networkId === state.currentNetworkId),
    [state.airMarshal, state.currentNetworkId],
  );

  // No reducer action backs Contain/Reclassify (checked reducer.ts — there is
  // none planned for Air Marshal), and source's own buttons are decorative
  // (onclick-less `<button class="mer-btn sm">`). Rendering these as
  // toast-only illustrative actions matches source's fidelity rather than
  // fabricating a state mutation with no reducer support.
  function handleContain(entry: MerakiAirMarshalAp) {
    toast.info(`Contain requested for ${entry.ssid} (${entry.bssid})`, {
      description: "Illustrative only — deauth containment isn't wired to a persisted state change in this simulator.",
    });
  }
  function handleReclassify(entry: MerakiAirMarshalAp) {
    toast.info(`Reclassify requested for ${entry.ssid} (${entry.bssid})`, {
      description: "Illustrative only — matches source, which has no backing mutation for this action either.",
    });
  }

  const columns: DataTableColumn<MerakiAirMarshalAp>[] = [
    { key: "ssid", header: "SSID", render: (a) => a.ssid },
    { key: "bssid", header: "BSSID", render: (a) => <span className={styles.mono}>{a.bssid}</span> },
    { key: "channel", header: "Ch", render: (a) => a.channel },
    { key: "threat", header: "Classification", render: (a) => <StatusPill tone={airMarshalTone(a.threat)}>{a.threat}</StatusPill> },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={(e) => {
              e.stopPropagation();
              handleContain(a);
            }}
          >
            Contain
          </button>{" "}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={(e) => {
              e.stopPropagation();
              handleReclassify(a);
            }}
          >
            Reclassify
          </button>
        </>
      ),
    },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Air Marshal</h1>
      <div className={styles.help}>
        Rogue and neighbouring BSSIDs detected by MR APs. A <b>Rogue</b> is a BSSID seen on the LAN side. <b>Contain</b> sends deauth frames (use
        cautiously — legal restrictions in some regions). Contain/Reclassify are illustrative here, matching source's own decorative buttons.
      </div>
      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={entries} getRowKey={(a) => a.id} dense emptyMessage="No neighbouring or rogue APs detected." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// Bluetooth clients (read-only, matching source)
// ===================================================================

export function WlBluetoothPage({ state }: { state: MerakiState }) {
  const clients = useMemo(
    () => state.bluetoothClients.filter((b) => b.networkId === state.currentNetworkId),
    [state.bluetoothClients, state.currentNetworkId],
  );

  const columns: DataTableColumn<MerakiBluetoothClient>[] = [
    { key: "name", header: "Name", render: (b) => b.name },
    { key: "rssi", header: "RSSI", render: (b) => `${b.rssi} dBm` },
    { key: "lastSeen", header: "Last seen", render: (b) => <span className={styles.small}>{new Date(b.lastSeen).toLocaleString()}</span> },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Bluetooth clients</h1>
      <div className={styles.help}>
        Detected BLE devices in range of any MR access point. Used for analytics, presence, and indoor positioning. Read-only, matching source.
      </div>
      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable columns={columns} rows={clients} getRowKey={(b) => b.id} dense emptyMessage="No Bluetooth clients detected." />
        </div>
      </div>
    </div>
  );
}

