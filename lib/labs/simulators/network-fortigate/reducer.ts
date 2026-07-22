import type {
  FortiAddress,
  FortiAddressGroup,
  FortiAdministrator,
  FortiAppControlProfile,
  FortiAvProfile,
  FortiDlpProfile,
  FortiDnsFilterProfile,
  FortiFileFilterProfile,
  FortiForwardLogEntry,
  FortiGateState,
  FortiInterface,
  FortiIpPool,
  FortiIpsecTunnel,
  FortiIpsProfile,
  FortiLocalUser,
  FortiPolicy,
  FortiSchedule,
  FortiService,
  FortiServiceGroup,
  FortiSslProfile,
  FortiSslVpnPortal,
  FortiStaticRoute,
  FortiSystem,
  FortiUserGroup,
  FortiVip,
  FortiWafProfile,
  FortiWebFilterProfile,
  FortiZone,
} from "./types";
import { freshFortiGateState } from "./seedData";

// This is a NEW reducer — source (fortigate-data.js) is 100% direct-mutation via
// generic `getList`/`updateByName`/`removeByName`/`add` helpers keyed by object
// `name` (or numeric `id` for policies) followed by `FortiData.save()`. Every action
// below corresponds either to a real generic-helper call-site a FortiGate WebUI page
// would drive (interfaces/zones/routes/addresses/services/schedules/VIPs/IP
// pools/security profiles/IPsec/SSL-VPN/users/admins), or to source's
// policy-specific helpers (`addPolicy`/`updatePolicy`/`removePolicy` — numeric
// `nextPolicyId()`), or to the live-log append helper (`appendForwardLog`, unshift +
// cap at 200). Static routes and policy routes carry no unique key field in source
// (plain array position), so — matching the Cisco port's identical `staticRoutes`
// gap — static-route mutations are index-based.

const FORWARD_LOG_CAP = 200;

export type FortiAction =
  | { type: "LOAD_STATE"; state: FortiGateState }
  | { type: "RESET_STATE" }

  // ───────── System (no single source save handler — hostname/admin-user/timezone
  // edits a Dashboard > System Information "Edit" page needs) ─────────
  | { type: "UPDATE_SYSTEM"; patch: Partial<FortiSystem> }

  // ───────── Administrators (source: `add('administrators', obj)` /
  // `removeByName('administrators', name)`) ─────────
  | { type: "ADD_ADMINISTRATOR"; administrator: FortiAdministrator }
  | { type: "DELETE_ADMINISTRATOR"; name: string }

  // ───────── Interfaces (source: `updateByName('interfaces', name, obj)`) ─────────
  | { type: "UPDATE_INTERFACE"; name: string; patch: Partial<FortiInterface> }

  // ───────── Zones (source: `add`/`updateByName`/`removeByName` on 'zones') ─────────
  | { type: "ADD_ZONE"; zone: FortiZone }
  | { type: "UPDATE_ZONE"; name: string; patch: Partial<FortiZone> }
  | { type: "DELETE_ZONE"; name: string }

  // ───────── Static routes (source: plain array push/splice on 'staticRoutes' — no
  // unique key field, so mutations are index-based, matching source's array-position
  // semantics and the identical convention in the Cisco port's reducer) ─────────
  | { type: "ADD_STATIC_ROUTE"; route: FortiStaticRoute }
  | { type: "UPDATE_STATIC_ROUTE"; index: number; patch: Partial<FortiStaticRoute> }
  | { type: "DELETE_STATIC_ROUTE"; index: number }

  // ───────── Addresses / address groups (source: `add`/`updateByName`/`removeByName`
  // on 'addresses' / 'addressGroups') ─────────
  | { type: "ADD_ADDRESS"; address: FortiAddress }
  | { type: "UPDATE_ADDRESS"; name: string; patch: Partial<FortiAddress> }
  | { type: "DELETE_ADDRESS"; name: string }
  | { type: "ADD_ADDRESS_GROUP"; group: FortiAddressGroup }
  | { type: "UPDATE_ADDRESS_GROUP"; name: string; patch: Partial<FortiAddressGroup> }
  | { type: "DELETE_ADDRESS_GROUP"; name: string }

  // ───────── Services / service groups (source: `add`/`updateByName`/`removeByName`
  // on 'services' / 'serviceGroups') ─────────
  | { type: "ADD_SERVICE"; service: FortiService }
  | { type: "UPDATE_SERVICE"; name: string; patch: Partial<FortiService> }
  | { type: "DELETE_SERVICE"; name: string }
  | { type: "ADD_SERVICE_GROUP"; group: FortiServiceGroup }
  | { type: "UPDATE_SERVICE_GROUP"; name: string; patch: Partial<FortiServiceGroup> }
  | { type: "DELETE_SERVICE_GROUP"; name: string }

  // ───────── Schedules (source: `add`/`updateByName`/`removeByName` on
  // 'schedules') ─────────
  | { type: "ADD_SCHEDULE"; schedule: FortiSchedule }
  | { type: "UPDATE_SCHEDULE"; name: string; patch: Partial<FortiSchedule> }
  | { type: "DELETE_SCHEDULE"; name: string }

  // ───────── VIPs (source: `add`/`updateByName`/`removeByName` on 'vips') ─────────
  | { type: "ADD_VIP"; vip: FortiVip }
  | { type: "UPDATE_VIP"; name: string; patch: Partial<FortiVip> }
  | { type: "DELETE_VIP"; name: string }

  // ───────── IP pools (source: `add`/`updateByName`/`removeByName` on
  // 'ipPools') ─────────
  | { type: "ADD_IP_POOL"; pool: FortiIpPool }
  | { type: "UPDATE_IP_POOL"; name: string; patch: Partial<FortiIpPool> }
  | { type: "DELETE_IP_POOL"; name: string }

  // ───────── Firewall policies (source: `addPolicy`/`updatePolicy`/`removePolicy`,
  // keyed by numeric id via `nextPolicyId()`/`findPolicyIndex()`. TOGGLE_POLICY_STATUS
  // and REORDER_POLICY have no direct source call-site but are the two actions a real
  // Policy & Objects > Firewall Policy table needs — FortiGate policies are strictly
  // order-sensitive top-to-bottom rule evaluation, so reordering must be a first-class
  // action rather than a generic patch.) ─────────
  | { type: "ADD_POLICY"; policy: Omit<FortiPolicy, "id"> }
  | { type: "UPDATE_POLICY"; id: number; patch: Partial<FortiPolicy> }
  | { type: "DELETE_POLICY"; id: number }
  | { type: "TOGGLE_POLICY_STATUS"; id: number }
  | { type: "REORDER_POLICY"; id: number; direction: "up" | "down" }

  // ───────── Security profiles — AV / Web Filter / IPS are the three most commonly
  // edited profile types in a real FortiGate UI, so they get full update actions;
  // the remaining 7 profile arrays (app-control/SSL/DNS-filter/file-filter/DLP/WAF)
  // are still covered with generic-shape update actions since source's own
  // `updateByName` helper works identically across every profile array — leaving any
  // of the 10 with zero mutation path would be an artificial gap relative to source. ─────────
  | { type: "UPDATE_AV_PROFILE"; name: string; patch: Partial<FortiAvProfile> }
  | { type: "UPDATE_WEB_FILTER_PROFILE"; name: string; patch: Partial<FortiWebFilterProfile> }
  | { type: "UPDATE_IPS_PROFILE"; name: string; patch: Partial<FortiIpsProfile> }
  | { type: "UPDATE_APP_CONTROL_PROFILE"; name: string; patch: Partial<FortiAppControlProfile> }
  | { type: "UPDATE_SSL_PROFILE"; name: string; patch: Partial<FortiSslProfile> }
  | { type: "UPDATE_DNS_FILTER_PROFILE"; name: string; patch: Partial<FortiDnsFilterProfile> }
  | { type: "UPDATE_FILE_FILTER_PROFILE"; name: string; patch: Partial<FortiFileFilterProfile> }
  | { type: "UPDATE_DLP_PROFILE"; name: string; patch: Partial<FortiDlpProfile> }
  | { type: "UPDATE_WAF_PROFILE"; name: string; patch: Partial<FortiWafProfile> }

  // ───────── IPsec tunnels (source: `add`/`updateByName`/`removeByName` on
  // 'ipsecTunnels') ─────────
  | { type: "ADD_IPSEC_TUNNEL"; tunnel: FortiIpsecTunnel }
  | { type: "UPDATE_IPSEC_TUNNEL"; name: string; patch: Partial<FortiIpsecTunnel> }
  | { type: "DELETE_IPSEC_TUNNEL"; name: string }

  // ───────── SSL VPN (source: 'sslVpnSettings' is a singleton object patched
  // directly; 'sslVpnPortals' uses the generic add/updateByName/removeByName
  // helpers) ─────────
  | { type: "UPDATE_SSL_VPN_SETTINGS"; patch: Partial<FortiGateState["sslVpnSettings"]> }
  | { type: "ADD_SSL_VPN_PORTAL"; portal: FortiSslVpnPortal }
  | { type: "UPDATE_SSL_VPN_PORTAL"; name: string; patch: Partial<FortiSslVpnPortal> }
  | { type: "DELETE_SSL_VPN_PORTAL"; name: string }

  // ───────── Users (source: `add`/`updateByName`/`removeByName` on 'localUsers' /
  // 'userGroups') ─────────
  | { type: "ADD_LOCAL_USER"; user: FortiLocalUser }
  | { type: "UPDATE_LOCAL_USER"; name: string; patch: Partial<FortiLocalUser> }
  | { type: "DELETE_LOCAL_USER"; name: string }
  | { type: "ADD_USER_GROUP"; group: FortiUserGroup }
  | { type: "UPDATE_USER_GROUP"; name: string; patch: Partial<FortiUserGroup> }
  | { type: "DELETE_USER_GROUP"; name: string }

  // ───────── Logs (source: `appendForwardLog()` unshifts + caps at 200; "Clear
  // logs" is a plausible real Log & Report page action even though source never
  // wired a clear button for either log list) ─────────
  | { type: "APPEND_FORWARD_LOG"; entry: FortiForwardLogEntry }
  | { type: "CLEAR_FORWARD_LOGS" }
  | { type: "CLEAR_EVENT_LOGS" };

function nextPolicyId(policies: FortiPolicy[]): number {
  let max = 0;
  for (const p of policies) {
    if (p.id > max) max = p.id;
  }
  return max + 1;
}

function findPolicyIndex(policies: FortiPolicy[], id: number): number {
  return policies.findIndex((p) => p.id === id);
}

export function fortiReducer(state: FortiGateState, action: FortiAction): FortiGateState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "RESET_STATE":
      return freshFortiGateState();

    // ───────── System ─────────
    case "UPDATE_SYSTEM": {
      return { ...state, system: { ...state.system, ...action.patch } };
    }

    // ───────── Administrators ─────────
    case "ADD_ADMINISTRATOR": {
      if (state.administrators.some((a) => a.name === action.administrator.name)) return state;
      return { ...state, administrators: [...state.administrators, action.administrator] };
    }
    case "DELETE_ADMINISTRATOR": {
      return { ...state, administrators: state.administrators.filter((a) => a.name !== action.name) };
    }

    // ───────── Interfaces ─────────
    case "UPDATE_INTERFACE": {
      return {
        ...state,
        interfaces: state.interfaces.map((f) => (f.name === action.name ? { ...f, ...action.patch } : f)),
      };
    }

    // ───────── Zones ─────────
    case "ADD_ZONE": {
      if (state.zones.some((z) => z.name === action.zone.name)) return state;
      return { ...state, zones: [...state.zones, action.zone] };
    }
    case "UPDATE_ZONE": {
      return { ...state, zones: state.zones.map((z) => (z.name === action.name ? { ...z, ...action.patch } : z)) };
    }
    case "DELETE_ZONE": {
      return { ...state, zones: state.zones.filter((z) => z.name !== action.name) };
    }

    // ───────── Static routes ─────────
    case "ADD_STATIC_ROUTE": {
      return { ...state, staticRoutes: [...state.staticRoutes, action.route] };
    }
    case "UPDATE_STATIC_ROUTE": {
      return {
        ...state,
        staticRoutes: state.staticRoutes.map((r, i) => (i === action.index ? { ...r, ...action.patch } : r)),
      };
    }
    case "DELETE_STATIC_ROUTE": {
      return { ...state, staticRoutes: state.staticRoutes.filter((_, i) => i !== action.index) };
    }

    // ───────── Addresses / address groups ─────────
    case "ADD_ADDRESS": {
      if (state.addresses.some((a) => a.name === action.address.name)) return state;
      return { ...state, addresses: [...state.addresses, action.address] };
    }
    case "UPDATE_ADDRESS": {
      return { ...state, addresses: state.addresses.map((a) => (a.name === action.name ? { ...a, ...action.patch } : a)) };
    }
    case "DELETE_ADDRESS": {
      return { ...state, addresses: state.addresses.filter((a) => a.name !== action.name) };
    }
    case "ADD_ADDRESS_GROUP": {
      if (state.addressGroups.some((g) => g.name === action.group.name)) return state;
      return { ...state, addressGroups: [...state.addressGroups, action.group] };
    }
    case "UPDATE_ADDRESS_GROUP": {
      return {
        ...state,
        addressGroups: state.addressGroups.map((g) => (g.name === action.name ? { ...g, ...action.patch } : g)),
      };
    }
    case "DELETE_ADDRESS_GROUP": {
      return { ...state, addressGroups: state.addressGroups.filter((g) => g.name !== action.name) };
    }

    // ───────── Services / service groups ─────────
    case "ADD_SERVICE": {
      if (state.services.some((s) => s.name === action.service.name)) return state;
      return { ...state, services: [...state.services, action.service] };
    }
    case "UPDATE_SERVICE": {
      return { ...state, services: state.services.map((s) => (s.name === action.name ? { ...s, ...action.patch } : s)) };
    }
    case "DELETE_SERVICE": {
      return { ...state, services: state.services.filter((s) => s.name !== action.name) };
    }
    case "ADD_SERVICE_GROUP": {
      if (state.serviceGroups.some((g) => g.name === action.group.name)) return state;
      return { ...state, serviceGroups: [...state.serviceGroups, action.group] };
    }
    case "UPDATE_SERVICE_GROUP": {
      return {
        ...state,
        serviceGroups: state.serviceGroups.map((g) => (g.name === action.name ? { ...g, ...action.patch } : g)),
      };
    }
    case "DELETE_SERVICE_GROUP": {
      return { ...state, serviceGroups: state.serviceGroups.filter((g) => g.name !== action.name) };
    }

    // ───────── Schedules ─────────
    case "ADD_SCHEDULE": {
      if (state.schedules.some((s) => s.name === action.schedule.name)) return state;
      return { ...state, schedules: [...state.schedules, action.schedule] };
    }
    case "UPDATE_SCHEDULE": {
      return { ...state, schedules: state.schedules.map((s) => (s.name === action.name ? { ...s, ...action.patch } : s)) };
    }
    case "DELETE_SCHEDULE": {
      return { ...state, schedules: state.schedules.filter((s) => s.name !== action.name) };
    }

    // ───────── VIPs ─────────
    case "ADD_VIP": {
      if (state.vips.some((v) => v.name === action.vip.name)) return state;
      return { ...state, vips: [...state.vips, action.vip] };
    }
    case "UPDATE_VIP": {
      return { ...state, vips: state.vips.map((v) => (v.name === action.name ? { ...v, ...action.patch } : v)) };
    }
    case "DELETE_VIP": {
      return { ...state, vips: state.vips.filter((v) => v.name !== action.name) };
    }

    // ───────── IP pools ─────────
    case "ADD_IP_POOL": {
      if (state.ipPools.some((p) => p.name === action.pool.name)) return state;
      return { ...state, ipPools: [...state.ipPools, action.pool] };
    }
    case "UPDATE_IP_POOL": {
      return { ...state, ipPools: state.ipPools.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "DELETE_IP_POOL": {
      return { ...state, ipPools: state.ipPools.filter((p) => p.name !== action.name) };
    }

    // ───────── Firewall policies ─────────
    case "ADD_POLICY": {
      const id = nextPolicyId(state.policies);
      const policy: FortiPolicy = { ...action.policy, id };
      return { ...state, policies: [...state.policies, policy] };
    }
    case "UPDATE_POLICY": {
      return {
        ...state,
        policies: state.policies.map((p) => (p.id === action.id ? { ...p, ...action.patch, id: p.id } : p)),
      };
    }
    case "DELETE_POLICY": {
      return { ...state, policies: state.policies.filter((p) => p.id !== action.id) };
    }
    case "TOGGLE_POLICY_STATUS": {
      return {
        ...state,
        policies: state.policies.map((p) =>
          p.id === action.id ? { ...p, status: p.status === "enable" ? "disable" : "enable" } : p,
        ),
      };
    }
    case "REORDER_POLICY": {
      const idx = findPolicyIndex(state.policies, action.id);
      if (idx === -1) return state;
      const swapWith = action.direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= state.policies.length) return state;
      const policies = state.policies.slice();
      const tmp = policies[idx];
      policies[idx] = policies[swapWith];
      policies[swapWith] = tmp;
      return { ...state, policies };
    }

    // ───────── Security profiles ─────────
    case "UPDATE_AV_PROFILE": {
      return { ...state, avProfiles: state.avProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_WEB_FILTER_PROFILE": {
      return {
        ...state,
        webFilterProfiles: state.webFilterProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "UPDATE_IPS_PROFILE": {
      return { ...state, ipsProfiles: state.ipsProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_APP_CONTROL_PROFILE": {
      return {
        ...state,
        appControlProfiles: state.appControlProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "UPDATE_SSL_PROFILE": {
      return { ...state, sslProfiles: state.sslProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_DNS_FILTER_PROFILE": {
      return {
        ...state,
        dnsFilterProfiles: state.dnsFilterProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "UPDATE_FILE_FILTER_PROFILE": {
      return {
        ...state,
        fileFilterProfiles: state.fileFilterProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "UPDATE_DLP_PROFILE": {
      return { ...state, dlpProfiles: state.dlpProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_WAF_PROFILE": {
      return { ...state, wafProfiles: state.wafProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }

    // ───────── IPsec tunnels ─────────
    case "ADD_IPSEC_TUNNEL": {
      if (state.ipsecTunnels.some((t) => t.name === action.tunnel.name)) return state;
      return { ...state, ipsecTunnels: [...state.ipsecTunnels, action.tunnel] };
    }
    case "UPDATE_IPSEC_TUNNEL": {
      return {
        ...state,
        ipsecTunnels: state.ipsecTunnels.map((t) => (t.name === action.name ? { ...t, ...action.patch } : t)),
      };
    }
    case "DELETE_IPSEC_TUNNEL": {
      return { ...state, ipsecTunnels: state.ipsecTunnels.filter((t) => t.name !== action.name) };
    }

    // ───────── SSL VPN ─────────
    case "UPDATE_SSL_VPN_SETTINGS": {
      return { ...state, sslVpnSettings: { ...state.sslVpnSettings, ...action.patch } };
    }
    case "ADD_SSL_VPN_PORTAL": {
      if (state.sslVpnPortals.some((p) => p.name === action.portal.name)) return state;
      return { ...state, sslVpnPortals: [...state.sslVpnPortals, action.portal] };
    }
    case "UPDATE_SSL_VPN_PORTAL": {
      return {
        ...state,
        sslVpnPortals: state.sslVpnPortals.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "DELETE_SSL_VPN_PORTAL": {
      return { ...state, sslVpnPortals: state.sslVpnPortals.filter((p) => p.name !== action.name) };
    }

    // ───────── Users ─────────
    case "ADD_LOCAL_USER": {
      if (state.localUsers.some((u) => u.name === action.user.name)) return state;
      return { ...state, localUsers: [...state.localUsers, action.user] };
    }
    case "UPDATE_LOCAL_USER": {
      return { ...state, localUsers: state.localUsers.map((u) => (u.name === action.name ? { ...u, ...action.patch } : u)) };
    }
    case "DELETE_LOCAL_USER": {
      return { ...state, localUsers: state.localUsers.filter((u) => u.name !== action.name) };
    }
    case "ADD_USER_GROUP": {
      if (state.userGroups.some((g) => g.name === action.group.name)) return state;
      return { ...state, userGroups: [...state.userGroups, action.group] };
    }
    case "UPDATE_USER_GROUP": {
      return { ...state, userGroups: state.userGroups.map((g) => (g.name === action.name ? { ...g, ...action.patch } : g)) };
    }
    case "DELETE_USER_GROUP": {
      return { ...state, userGroups: state.userGroups.filter((g) => g.name !== action.name) };
    }

    // ───────── Logs ─────────
    case "APPEND_FORWARD_LOG": {
      return { ...state, forwardLogs: [action.entry, ...state.forwardLogs].slice(0, FORWARD_LOG_CAP) };
    }
    case "CLEAR_FORWARD_LOGS": {
      return { ...state, forwardLogs: [] };
    }
    case "CLEAR_EVENT_LOGS": {
      return { ...state, eventLogs: [] };
    }

    default:
      return state;
  }
}
