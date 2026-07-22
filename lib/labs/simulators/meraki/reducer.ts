import type {
  MerakiAdminUser,
  MerakiAlertType,
  MerakiDevice,
  MerakiFirewallL3Rule,
  MerakiFirewallL7Rule,
  MerakiInventoryItem,
  MerakiPortForward,
  MerakiSsid,
  MerakiState,
  MerakiVlan,
  MerakiVpnPeer,
} from "./types";
import { advanceClientRoam } from "./client-roam-engine";
import { advanceLifecycle, startFirmwareUpdate, startReboot } from "./device-lifecycle-engine";
import { generateThreatEvent } from "./threat-engine";
import { sampleWanHealth } from "./wan-health-engine";

// This is a NEW reducer — source (all 5 meraki-*.js modules) is 100%
// direct-mutation-then-`MerakiData.save()`, with no reducer/action concept at all.
// Every action below corresponds to either a real mutation call site in source (grep
// for `MerakiData.save()` across meraki-network.js / meraki-switch.js /
// meraki-wireless.js / meraki-security.js / meraki-portal.js), or a source button that
// was decorative/no-op and is now made real per the approved bug-fix scope (called out
// in each case's comment below).

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

export type MerakiAction =
  | { type: "LOAD_STATE"; state: MerakiState }

  // ───────── Network switcher — replaces source's raw <select onchange> + full page
  // reload (meraki-portal.js renderTopbar()'s `merNetSel` change handler) ─────────
  | { type: "SET_CURRENT_NETWORK"; networkId: string }

  // ───────── Clients (meraki-network.js) ─────────
  // Real mutation, ported from `_blockClient` (sets policy + status offline).
  | { type: "BLOCK_CLIENT"; clientId: string }
  // FIXES source's `_saveClient` bug: the modal's policy <select> value was never
  // read — Save just called MerakiData.save() on unchanged state. This action
  // genuinely applies the passed policy.
  | { type: "SAVE_CLIENT_POLICY"; clientId: string; policy: string }

  // ───────── Switch ports (meraki-switch.js) ─────────
  // FIXES source's `portsCache` bug: ported edits from `_savePort` never persisted
  // (module-level JS variable, not part of MerakiData.state). This action persists
  // directly onto `device.ports`.
  | { type: "UPDATE_SWITCH_PORT"; serial: string; portId: string; patch: Partial<MerakiDevice["ports"] extends (infer P)[] | undefined ? P : never> }

  // ───────── Device inventory (meraki-portal.js `_assignDevice`) ─────────
  | { type: "ASSIGN_DEVICE_TO_NETWORK"; serial: string; networkId: string }

  // ───────── SSIDs (meraki-wireless.js) ─────────
  // FIXES source's `_ssidSave` bug: only the Access-control tab's 5 fields
  // (name/enabled/hidden/authMode/psk) were ever read from the DOM and saved, even
  // though the editor has 7 tabs (Splash, Network access, Traffic shaping, Firewall,
  // Hotspot 2.0, Wireless concentrator all silently discarded on Save). This action
  // accepts a patch covering ANY SSID field so a future UI can wire all 7 tabs.
  | { type: "UPDATE_SSID"; ssidId: string; patch: Partial<MerakiSsid> }

  // ───────── Firewall (meraki-security.js) ─────────
  // FIXES source's `_addL3Rule`/`_addL7Rule` crash bug: both called
  // `MerakiPortal.rerender()`, a function that does not exist anywhere in
  // meraki-portal.js's public API (only `navigate`/`init`/etc. are exported) — clicking
  // either button would throw. These are now normal, crash-free reducer cases.
  | { type: "ADD_FIREWALL_L3_RULE"; rule: MerakiFirewallL3Rule }
  | { type: "ADD_FIREWALL_L7_RULE"; rule: MerakiFirewallL7Rule }
  | { type: "UPDATE_FIREWALL_L3_RULE"; ruleId: string; patch: Partial<MerakiFirewallL3Rule> }
  | { type: "UPDATE_FIREWALL_L7_RULE"; ruleId: string; patch: Partial<MerakiFirewallL7Rule> }
  | { type: "DELETE_FIREWALL_L3_RULE"; ruleId: string }
  | { type: "DELETE_FIREWALL_L7_RULE"; ruleId: string }
  | { type: "TOGGLE_FIREWALL_L3_RULE"; ruleId: string }

  // ───────── VLANs — operate on the new canonical state.vlans[] (source had no single
  // canonical list; see seedData.ts's VLAN-reconciliation comment) ─────────
  | { type: "ADD_VLAN"; vlan: MerakiVlan }
  | { type: "UPDATE_VLAN"; networkId: string; vlanId: number; patch: Partial<MerakiVlan> }
  | { type: "DELETE_VLAN"; networkId: string; vlanId: number }

  // ───────── NAT (meraki-security.js `_savePortForward` is the only real NAT mutation
  // in source; 1:1/1:Many are hardcoded read-only there — this covers the full
  // real CRUD surface for port forwards) ─────────
  | { type: "ADD_PORT_FORWARD"; portForward: MerakiPortForward }
  | { type: "UPDATE_PORT_FORWARD"; id: string; patch: Partial<MerakiPortForward> }
  | { type: "DELETE_PORT_FORWARD"; id: string }
  | { type: "TOGGLE_PORT_FORWARD"; id: string }

  // ───────── VPN ─────────
  | { type: "ADD_VPN_PEER"; peer: MerakiVpnPeer }
  | { type: "DELETE_VPN_PEER"; id: string }

  // ───────── Content filtering ─────────
  // FIXES source's renderContent() Save button: it called
  // `MerakiPortal.toast('Content filtering saved', 'ok')` without ever reading the
  // category checkboxes or URL-pattern textareas back into state.
  | { type: "UPDATE_CONTENT_FILTERING"; patch: Partial<MerakiState["contentFiltering"]> }

  // ───────── Alerts (meraki-network.js) ─────────
  // Real mutation, ported from `_dismissAlert`.
  | { type: "DISMISS_ALERT"; alertId: string }
  // FIXES source's renderAlerts() "Save" button: alert-type checkboxes/threshold
  // <input>s were rendered from state but the Save button only toasted
  // 'Alert configuration saved' without reading any of them back.
  | { type: "UPDATE_ALERT_TYPE"; alertTypeId: string; patch: Partial<MerakiAlertType> }

  // ───────── Admin users (meraki-network.js renderAdmins()) ─────────
  // FIXES source's fully-decorative "+ Add admin" / "Edit" buttons, which rendered
  // with no onclick handler at all.
  | { type: "ADD_ADMIN_USER"; admin: MerakiAdminUser }
  | { type: "DELETE_ADMIN_USER"; id: string }

  // ───────── Device lifecycle engine (device-lifecycle-engine.ts) ─────────
  | { type: "START_DEVICE_REBOOT"; serial: string; nowIso: string }
  | { type: "START_FIRMWARE_UPDATE"; serial: string; targetVersion: string; nowIso: string }
  | { type: "ADVANCE_DEVICE_LIFECYCLE"; serial: string; nowIso: string }

  // ───────── WAN health engine (wan-health-engine.ts) ─────────
  | { type: "SAMPLE_WAN_HEALTH"; serial: string; seed: number; nowIso: string }

  // ───────── Threat engine (threat-engine.ts) ─────────
  | { type: "GENERATE_THREAT_EVENT"; networkId: string; seed: number; nowIso: string }

  // ───────── Client roam engine (client-roam-engine.ts) ─────────
  | { type: "ADVANCE_CLIENT_ROAM"; clientId: string; seed: number; nowIso: string };

export function merakiReducer(state: MerakiState, action: MerakiAction): MerakiState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    // ───────── Network switcher ─────────
    case "SET_CURRENT_NETWORK": {
      const exists = state.networks.some((n) => n.id === action.networkId);
      if (!exists) return state;
      return { ...state, currentNetworkId: action.networkId };
    }

    // ───────── Clients ─────────
    case "BLOCK_CLIENT": {
      return {
        ...state,
        clients: state.clients.map((c) => (c.id === action.clientId ? { ...c, policy: "Block-Internet", status: "offline" } : c)),
      };
    }
    case "SAVE_CLIENT_POLICY": {
      return {
        ...state,
        clients: state.clients.map((c) => (c.id === action.clientId ? { ...c, policy: action.policy } : c)),
      };
    }

    // ───────── Switch ports ─────────
    case "UPDATE_SWITCH_PORT": {
      return {
        ...state,
        devices: state.devices.map((d) => {
          if (d.serial !== action.serial || !d.ports) return d;
          return { ...d, ports: d.ports.map((p) => (p.portId === action.portId ? { ...p, ...action.patch } : p)) };
        }),
      };
    }

    // ───────── Device inventory ─────────
    case "ASSIGN_DEVICE_TO_NETWORK": {
      const item = state.inventory.find((i) => i.serial === action.serial);
      if (!item) return state;
      const newDevice: MerakiDevice = {
        serial: item.serial,
        name: `${item.model}-${item.serial.slice(-4)}`,
        model: item.model,
        type: item.type,
        networkId: action.networkId,
        status: "online",
        lanIp: "",
        mac: "",
        uptimeDays: 0,
        firmware: "Latest stable",
        firmwareLatest: "Latest stable",
        tags: [],
        lastReboot: "",
      };
      return {
        ...state,
        inventory: state.inventory.filter((i) => i.serial !== action.serial),
        devices: [...state.devices, newDevice],
      };
    }

    // ───────── SSIDs ─────────
    case "UPDATE_SSID": {
      return {
        ...state,
        ssids: state.ssids.map((s) => (s.id === action.ssidId ? { ...s, ...action.patch } : s)),
      };
    }

    // ───────── Firewall ─────────
    case "ADD_FIREWALL_L3_RULE":
      return { ...state, firewallL3: [...state.firewallL3, action.rule] };
    case "ADD_FIREWALL_L7_RULE":
      return { ...state, firewallL7: [...state.firewallL7, action.rule] };
    case "UPDATE_FIREWALL_L3_RULE":
      return { ...state, firewallL3: state.firewallL3.map((r) => (r.id === action.ruleId ? { ...r, ...action.patch } : r)) };
    case "UPDATE_FIREWALL_L7_RULE":
      return { ...state, firewallL7: state.firewallL7.map((r) => (r.id === action.ruleId ? { ...r, ...action.patch } : r)) };
    case "DELETE_FIREWALL_L3_RULE":
      return { ...state, firewallL3: state.firewallL3.filter((r) => r.id !== action.ruleId) };
    case "DELETE_FIREWALL_L7_RULE":
      return { ...state, firewallL7: state.firewallL7.filter((r) => r.id !== action.ruleId) };
    case "TOGGLE_FIREWALL_L3_RULE":
      return { ...state, firewallL3: state.firewallL3.map((r) => (r.id === action.ruleId ? { ...r, enabled: !r.enabled } : r)) };

    // ───────── VLANs ─────────
    case "ADD_VLAN":
      return { ...state, vlans: [...state.vlans, action.vlan] };
    case "UPDATE_VLAN":
      return {
        ...state,
        vlans: state.vlans.map((v) => (v.networkId === action.networkId && v.id === action.vlanId ? { ...v, ...action.patch } : v)),
      };
    case "DELETE_VLAN":
      return { ...state, vlans: state.vlans.filter((v) => !(v.networkId === action.networkId && v.id === action.vlanId)) };

    // ───────── NAT ─────────
    case "ADD_PORT_FORWARD":
      return { ...state, nat: { ...state.nat, portForwards: [...state.nat.portForwards, action.portForward] } };
    case "UPDATE_PORT_FORWARD":
      return { ...state, nat: { ...state.nat, portForwards: state.nat.portForwards.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) } };
    case "DELETE_PORT_FORWARD":
      return { ...state, nat: { ...state.nat, portForwards: state.nat.portForwards.filter((p) => p.id !== action.id) } };
    case "TOGGLE_PORT_FORWARD":
      return { ...state, nat: { ...state.nat, portForwards: state.nat.portForwards.map((p) => (p.id === action.id ? { ...p, enabled: !p.enabled } : p)) } };

    // ───────── VPN ─────────
    case "ADD_VPN_PEER":
      return { ...state, vpn: { ...state.vpn, siteToSite: [...state.vpn.siteToSite, action.peer] } };
    case "DELETE_VPN_PEER":
      return { ...state, vpn: { ...state.vpn, siteToSite: state.vpn.siteToSite.filter((p) => p.id !== action.id) } };

    // ───────── Content filtering ─────────
    case "UPDATE_CONTENT_FILTERING":
      return { ...state, contentFiltering: { ...state.contentFiltering, ...action.patch } };

    // ───────── Alerts ─────────
    case "DISMISS_ALERT":
      return { ...state, alerts: { ...state.alerts, active: state.alerts.active.filter((a) => a.id !== action.alertId) } };
    case "UPDATE_ALERT_TYPE":
      return {
        ...state,
        alerts: { ...state.alerts, types: state.alerts.types.map((t) => (t.id === action.alertTypeId ? { ...t, ...action.patch } : t)) },
      };

    // ───────── Admin users ─────────
    case "ADD_ADMIN_USER":
      return { ...state, adminUsers: [...state.adminUsers, action.admin] };
    case "DELETE_ADMIN_USER":
      return { ...state, adminUsers: state.adminUsers.filter((a) => a.id !== action.id) };

    // ───────── Device lifecycle engine ─────────
    case "START_DEVICE_REBOOT": {
      return {
        ...state,
        devices: state.devices.map((d) => (d.serial === action.serial ? startReboot(d, action.nowIso) : d)),
      };
    }
    case "START_FIRMWARE_UPDATE": {
      return {
        ...state,
        devices: state.devices.map((d) => (d.serial === action.serial ? startFirmwareUpdate(d, action.targetVersion, action.nowIso) : d)),
      };
    }
    case "ADVANCE_DEVICE_LIFECYCLE": {
      const device = state.devices.find((d) => d.serial === action.serial);
      if (!device) return state;
      const result = advanceLifecycle(device, action.nowIso);
      if (!result) return state;
      const auditEntry = {
        id: genId("audit"),
        ts: action.nowIso,
        admin: "system",
        action: result.auditMessage,
        page: device.networkId,
      };
      return {
        ...state,
        devices: state.devices.map((d) => (d.serial === action.serial ? result.device : d)),
        auditLog: [auditEntry, ...state.auditLog],
      };
    }

    // ───────── WAN health engine ─────────
    case "SAMPLE_WAN_HEALTH": {
      const device = state.devices.find((d) => d.serial === action.serial);
      if (!device) return state;
      const result = sampleWanHealth(device, action.seed, action.nowIso);
      return {
        ...state,
        devices: state.devices.map((d) => (d.serial === action.serial ? result.updatedDevice : d)),
        wanHealthHistory: [...state.wanHealthHistory, ...result.samples],
        alerts: result.failoverAlert ? { ...state.alerts, active: [result.failoverAlert, ...state.alerts.active] } : state.alerts,
      };
    }

    // ───────── Threat engine ─────────
    case "GENERATE_THREAT_EVENT": {
      const event = generateThreatEvent(action.networkId, state.firewallL3, state.firewallL7, state.contentFiltering, action.seed, action.nowIso);
      return { ...state, threatEvents: [event, ...state.threatEvents] };
    }

    // ───────── Client roam engine ─────────
    case "ADVANCE_CLIENT_ROAM": {
      const client = state.clients.find((c) => c.id === action.clientId);
      if (!client) return state;
      const aps = state.devices.filter((d) => d.type === "wireless" && d.networkId === client.networkId);
      const updated = advanceClientRoam(client, aps, action.seed, action.nowIso);
      return { ...state, clients: state.clients.map((c) => (c.id === action.clientId ? updated : c)) };
    }

    default:
      return state;
  }
}
