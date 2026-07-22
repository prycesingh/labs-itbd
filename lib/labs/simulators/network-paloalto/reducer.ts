import type {
  PaloAddress,
  PaloAddressGroup,
  PaloAdministrator,
  PaloAsProfile,
  PaloAuthPolicy,
  PaloAvProfile,
  PaloBgpConfig,
  PaloDataProfile,
  PaloDecryptionPolicy,
  PaloDevice,
  PaloFileProfile,
  PaloGpGateway,
  PaloGpPortal,
  PaloHighAvailability,
  PaloIkeGateway,
  PaloInterface,
  PaloIpsecTunnel,
  PaloLocalUser,
  PaloNatPolicy,
  PaloOspfConfig,
  PaloProfileGroup,
  PaloSecurityPolicy,
  PaloService,
  PaloServiceGroup,
  PaloState,
  PaloStaticRoute,
  PaloTag,
  PaloTrafficLogEntry,
  PaloUrlProfile,
  PaloUserGroup,
  PaloVpProfile,
  PaloWildfireProfile,
  PaloZone,
} from "./types";
import { freshPaloState } from "./seedData";

// This is a NEW reducer — source (paloalto-data.js) is 100% direct-mutation via the
// generic `getList`/`add`/`updateByName`/`removeByName` helpers keyed by object `name`,
// plus `addRule`/`updateRule`/`removeRule`/`reorderRule` keyed by numeric `id` for the
// four rulebase-style policy lists (securityPolicies/natPolicies/decryptionPolicies/
// authPolicies). Every action below corresponds either to a real generic-helper
// call-site a PAN-OS WebUI page would drive (interfaces/zones/static-routes/objects/
// security-profiles/VPN/users/device), or to the id-keyed rule helpers for policies
// (`ADD_*_POLICY`/`UPDATE_*_POLICY`/`DELETE_*_POLICY`/`TOGGLE_*_POLICY`/
// `REORDER_*_POLICY`, matching the FortiGate port's 5-action-per-policy-type
// convention), or to the live-log append helper (`appendTrafficLog`, unshift + cap at
// 400 exactly as source does).

const TRAFFIC_LOG_CAP = 400;

export type PaloAction =
  | { type: "LOAD_STATE"; state: PaloState }
  | { type: "RESET_STATE" }

  // ───────── Device (no single source save handler — hostname/admin-user/timezone
  // edits a Dashboard "Edit" page needs) ─────────
  | { type: "UPDATE_DEVICE"; patch: Partial<PaloDevice> }

  // ───────── Interfaces (source: `updateByName('interfaces', name, obj)`) ─────────
  | { type: "UPDATE_INTERFACE"; name: string; patch: Partial<PaloInterface> }

  // ───────── Zones (source: `add`/`updateByName`/`removeByName` on 'zones') ─────────
  | { type: "ADD_ZONE"; zone: PaloZone }
  | { type: "UPDATE_ZONE"; name: string; patch: Partial<PaloZone> }
  | { type: "DELETE_ZONE"; name: string }

  // ───────── Static routes (source: nested array inside a named virtual router,
  // still push/splice via array helpers keyed by route `name` within that vRouter) ─────────
  | { type: "ADD_STATIC_ROUTE"; vrName: string; route: PaloStaticRoute }
  | { type: "UPDATE_STATIC_ROUTE"; vrName: string; routeName: string; patch: Partial<PaloStaticRoute> }
  | { type: "DELETE_STATIC_ROUTE"; vrName: string; routeName: string }

  // ───────── Virtual router OSPF / BGP (source: nested config object on the named
  // virtual router, patched in place) ─────────
  | { type: "UPDATE_VR_OSPF"; vrName: string; patch: Partial<PaloOspfConfig> }
  | { type: "UPDATE_VR_BGP"; vrName: string; patch: Partial<PaloBgpConfig> }

  // ───────── Addresses / address groups (source: `add`/`updateByName`/
  // `removeByName` on 'addresses' / 'addressGroups') ─────────
  | { type: "ADD_ADDRESS"; address: PaloAddress }
  | { type: "UPDATE_ADDRESS"; name: string; patch: Partial<PaloAddress> }
  | { type: "DELETE_ADDRESS"; name: string }
  | { type: "ADD_ADDRESS_GROUP"; group: PaloAddressGroup }
  | { type: "UPDATE_ADDRESS_GROUP"; name: string; patch: Partial<PaloAddressGroup> }
  | { type: "DELETE_ADDRESS_GROUP"; name: string }

  // ───────── Services / service groups (source: `add`/`updateByName`/
  // `removeByName` on 'services' / 'serviceGroups') ─────────
  | { type: "ADD_SERVICE"; service: PaloService }
  | { type: "UPDATE_SERVICE"; name: string; patch: Partial<PaloService> }
  | { type: "DELETE_SERVICE"; name: string }
  | { type: "ADD_SERVICE_GROUP"; group: PaloServiceGroup }
  | { type: "UPDATE_SERVICE_GROUP"; name: string; patch: Partial<PaloServiceGroup> }
  | { type: "DELETE_SERVICE_GROUP"; name: string }

  // ───────── Tags (source: `add`/`updateByName`/`removeByName` on 'tags') ─────────
  | { type: "ADD_TAG"; tag: PaloTag }
  | { type: "UPDATE_TAG"; name: string; patch: Partial<PaloTag> }
  | { type: "DELETE_TAG"; name: string }

  // ───────── Security profiles (8 types) — source's fixed pre-configured profile
  // sets are edited in place via `updateByName`; a real WebUI wouldn't add/delete from
  // these small canonical sets, matching the FortiGate port's edit-only convention for
  // its profile types ─────────
  | { type: "UPDATE_AV_PROFILE"; name: string; patch: Partial<PaloAvProfile> }
  | { type: "UPDATE_AS_PROFILE"; name: string; patch: Partial<PaloAsProfile> }
  | { type: "UPDATE_VP_PROFILE"; name: string; patch: Partial<PaloVpProfile> }
  | { type: "UPDATE_URL_PROFILE"; name: string; patch: Partial<PaloUrlProfile> }
  | { type: "UPDATE_FILE_PROFILE"; name: string; patch: Partial<PaloFileProfile> }
  | { type: "UPDATE_WILDFIRE_PROFILE"; name: string; patch: Partial<PaloWildfireProfile> }
  | { type: "UPDATE_DATA_PROFILE"; name: string; patch: Partial<PaloDataProfile> }
  | { type: "UPDATE_PROFILE_GROUP"; name: string; patch: Partial<PaloProfileGroup> }

  // ───────── Policies (id-keyed rulebases, source: `addRule`/`updateRule`/
  // `removeRule`/`reorderRule` on the given listName). TOGGLE_*_STATUS and
  // REORDER_*_POLICY have no direct 1:1 source call-site but are the actions a real
  // Policies table needs — PAN-OS rulebases are strictly order-sensitive top-to-bottom
  // rule evaluation, so reordering must be a first-class action rather than a generic
  // patch, matching the FortiGate port's identical 5-action-per-policy-type
  // convention. ─────────
  | { type: "ADD_SECURITY_POLICY"; policy: Omit<PaloSecurityPolicy, "id"> }
  | { type: "UPDATE_SECURITY_POLICY"; id: number; patch: Partial<PaloSecurityPolicy> }
  | { type: "DELETE_SECURITY_POLICY"; id: number }
  | { type: "TOGGLE_SECURITY_POLICY"; id: number }
  | { type: "REORDER_SECURITY_POLICY"; id: number; direction: "up" | "down" }

  | { type: "ADD_NAT_POLICY"; policy: Omit<PaloNatPolicy, "id"> }
  | { type: "UPDATE_NAT_POLICY"; id: number; patch: Partial<PaloNatPolicy> }
  | { type: "DELETE_NAT_POLICY"; id: number }
  | { type: "TOGGLE_NAT_POLICY"; id: number }
  | { type: "REORDER_NAT_POLICY"; id: number; direction: "up" | "down" }

  | { type: "ADD_DECRYPTION_POLICY"; policy: Omit<PaloDecryptionPolicy, "id"> }
  | { type: "UPDATE_DECRYPTION_POLICY"; id: number; patch: Partial<PaloDecryptionPolicy> }
  | { type: "DELETE_DECRYPTION_POLICY"; id: number }
  | { type: "TOGGLE_DECRYPTION_POLICY"; id: number }
  | { type: "REORDER_DECRYPTION_POLICY"; id: number; direction: "up" | "down" }

  | { type: "ADD_AUTH_POLICY"; policy: Omit<PaloAuthPolicy, "id"> }
  | { type: "UPDATE_AUTH_POLICY"; id: number; patch: Partial<PaloAuthPolicy> }
  | { type: "DELETE_AUTH_POLICY"; id: number }
  | { type: "TOGGLE_AUTH_POLICY"; id: number }
  | { type: "REORDER_AUTH_POLICY"; id: number; direction: "up" | "down" }

  // ───────── VPN (source: `add`/`updateByName`/`removeByName` on 'ipsecTunnels' /
  // 'ikeGateways'; GlobalProtect portals/gateways are a fixed 1-2 entry config edited
  // in place, no add/delete needed) ─────────
  | { type: "ADD_IPSEC_TUNNEL"; tunnel: PaloIpsecTunnel }
  | { type: "UPDATE_IPSEC_TUNNEL"; name: string; patch: Partial<PaloIpsecTunnel> }
  | { type: "DELETE_IPSEC_TUNNEL"; name: string }
  | { type: "ADD_IKE_GATEWAY"; gateway: PaloIkeGateway }
  | { type: "UPDATE_IKE_GATEWAY"; name: string; patch: Partial<PaloIkeGateway> }
  | { type: "DELETE_IKE_GATEWAY"; name: string }
  | { type: "UPDATE_GP_PORTAL"; name: string; patch: Partial<PaloGpPortal> }
  | { type: "UPDATE_GP_GATEWAY"; name: string; patch: Partial<PaloGpGateway> }

  // ───────── Users (source: `add`/`updateByName`/`removeByName` on 'localUsers' /
  // 'userGroups') ─────────
  | { type: "ADD_LOCAL_USER"; user: PaloLocalUser }
  | { type: "UPDATE_LOCAL_USER"; name: string; patch: Partial<PaloLocalUser> }
  | { type: "DELETE_LOCAL_USER"; name: string }
  | { type: "ADD_USER_GROUP"; group: PaloUserGroup }
  | { type: "UPDATE_USER_GROUP"; name: string; patch: Partial<PaloUserGroup> }
  | { type: "DELETE_USER_GROUP"; name: string }

  // ───────── Device: administrators / HA (source: `add`/`removeByName` on
  // 'administrators'; 'highAvailability' is a singleton object patched directly) ─────────
  | { type: "ADD_ADMINISTRATOR"; administrator: PaloAdministrator }
  | { type: "DELETE_ADMINISTRATOR"; name: string }
  | { type: "UPDATE_HA_CONFIG"; patch: Partial<PaloHighAvailability> }

  // ───────── Logs (source: `appendTrafficLog()` unshifts + caps at 400; "Clear logs"
  // is a plausible real Monitor > Logs page action even though source never wired a
  // clear button for any log list) ─────────
  | { type: "APPEND_TRAFFIC_LOG"; entry: PaloTrafficLogEntry }
  | { type: "CLEAR_TRAFFIC_LOGS" }
  | { type: "CLEAR_THREAT_LOGS" }
  | { type: "CLEAR_URL_LOGS" }
  | { type: "CLEAR_SYSTEM_LOGS" };

function nextPolicyId<T extends { id: number }>(policies: T[]): number {
  let max = 0;
  for (const p of policies) {
    if (p.id > max) max = p.id;
  }
  return max + 1;
}

function findPolicyIndex<T extends { id: number }>(policies: T[], id: number): number {
  return policies.findIndex((p) => p.id === id);
}

function reorderById<T extends { id: number }>(list: T[], id: number, direction: "up" | "down"): T[] {
  const idx = findPolicyIndex(list, id);
  if (idx === -1) return list;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return list;
  const next = list.slice();
  const tmp = next[idx];
  next[idx] = next[swapWith];
  next[swapWith] = tmp;
  return next;
}

export function paloReducer(state: PaloState, action: PaloAction): PaloState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "RESET_STATE":
      return freshPaloState();

    // ───────── Device ─────────
    case "UPDATE_DEVICE": {
      return { ...state, device: { ...state.device, ...action.patch } };
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

    // ───────── Static routes (nested inside a named virtual router) ─────────
    case "ADD_STATIC_ROUTE": {
      return {
        ...state,
        virtualRouters: state.virtualRouters.map((vr) =>
          vr.name === action.vrName ? { ...vr, staticRoutes: [...vr.staticRoutes, action.route] } : vr,
        ),
      };
    }
    case "UPDATE_STATIC_ROUTE": {
      return {
        ...state,
        virtualRouters: state.virtualRouters.map((vr) =>
          vr.name === action.vrName
            ? {
                ...vr,
                staticRoutes: vr.staticRoutes.map((r) =>
                  r.name === action.routeName ? { ...r, ...action.patch } : r,
                ),
              }
            : vr,
        ),
      };
    }
    case "DELETE_STATIC_ROUTE": {
      return {
        ...state,
        virtualRouters: state.virtualRouters.map((vr) =>
          vr.name === action.vrName
            ? { ...vr, staticRoutes: vr.staticRoutes.filter((r) => r.name !== action.routeName) }
            : vr,
        ),
      };
    }

    // ───────── Virtual router OSPF / BGP ─────────
    case "UPDATE_VR_OSPF": {
      return {
        ...state,
        virtualRouters: state.virtualRouters.map((vr) =>
          vr.name === action.vrName ? { ...vr, ospf: { ...vr.ospf, ...action.patch } } : vr,
        ),
      };
    }
    case "UPDATE_VR_BGP": {
      return {
        ...state,
        virtualRouters: state.virtualRouters.map((vr) =>
          vr.name === action.vrName ? { ...vr, bgp: { ...vr.bgp, ...action.patch } } : vr,
        ),
      };
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

    // ───────── Tags ─────────
    case "ADD_TAG": {
      if (state.tags.some((t) => t.name === action.tag.name)) return state;
      return { ...state, tags: [...state.tags, action.tag] };
    }
    case "UPDATE_TAG": {
      return { ...state, tags: state.tags.map((t) => (t.name === action.name ? { ...t, ...action.patch } : t)) };
    }
    case "DELETE_TAG": {
      return { ...state, tags: state.tags.filter((t) => t.name !== action.name) };
    }

    // ───────── Security profiles ─────────
    case "UPDATE_AV_PROFILE": {
      return { ...state, avProfiles: state.avProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_AS_PROFILE": {
      return { ...state, asProfiles: state.asProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_VP_PROFILE": {
      return { ...state, vpProfiles: state.vpProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_URL_PROFILE": {
      return { ...state, urlProfiles: state.urlProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_FILE_PROFILE": {
      return { ...state, fileProfiles: state.fileProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_WILDFIRE_PROFILE": {
      return {
        ...state,
        wildfireProfiles: state.wildfireProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "UPDATE_DATA_PROFILE": {
      return { ...state, dataProfiles: state.dataProfiles.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)) };
    }
    case "UPDATE_PROFILE_GROUP": {
      return {
        ...state,
        profileGroups: state.profileGroups.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }

    // ───────── Security policies ─────────
    case "ADD_SECURITY_POLICY": {
      const id = nextPolicyId(state.securityPolicies);
      const policy: PaloSecurityPolicy = { ...action.policy, id };
      return { ...state, securityPolicies: [...state.securityPolicies, policy] };
    }
    case "UPDATE_SECURITY_POLICY": {
      return {
        ...state,
        securityPolicies: state.securityPolicies.map((p) =>
          p.id === action.id ? { ...p, ...action.patch, id: p.id } : p,
        ),
      };
    }
    case "DELETE_SECURITY_POLICY": {
      return { ...state, securityPolicies: state.securityPolicies.filter((p) => p.id !== action.id) };
    }
    case "TOGGLE_SECURITY_POLICY": {
      return {
        ...state,
        securityPolicies: state.securityPolicies.map((p) =>
          p.id === action.id ? { ...p, disabled: !p.disabled } : p,
        ),
      };
    }
    case "REORDER_SECURITY_POLICY": {
      return { ...state, securityPolicies: reorderById(state.securityPolicies, action.id, action.direction) };
    }

    // ───────── NAT policies ─────────
    case "ADD_NAT_POLICY": {
      const id = nextPolicyId(state.natPolicies);
      const policy: PaloNatPolicy = { ...action.policy, id };
      return { ...state, natPolicies: [...state.natPolicies, policy] };
    }
    case "UPDATE_NAT_POLICY": {
      return {
        ...state,
        natPolicies: state.natPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch, id: p.id } : p)),
      };
    }
    case "DELETE_NAT_POLICY": {
      return { ...state, natPolicies: state.natPolicies.filter((p) => p.id !== action.id) };
    }
    case "TOGGLE_NAT_POLICY": {
      return {
        ...state,
        natPolicies: state.natPolicies.map((p) => (p.id === action.id ? { ...p, disabled: !p.disabled } : p)),
      };
    }
    case "REORDER_NAT_POLICY": {
      return { ...state, natPolicies: reorderById(state.natPolicies, action.id, action.direction) };
    }

    // ───────── Decryption policies ─────────
    case "ADD_DECRYPTION_POLICY": {
      const id = nextPolicyId(state.decryptionPolicies);
      const policy: PaloDecryptionPolicy = { ...action.policy, id };
      return { ...state, decryptionPolicies: [...state.decryptionPolicies, policy] };
    }
    case "UPDATE_DECRYPTION_POLICY": {
      return {
        ...state,
        decryptionPolicies: state.decryptionPolicies.map((p) =>
          p.id === action.id ? { ...p, ...action.patch, id: p.id } : p,
        ),
      };
    }
    case "DELETE_DECRYPTION_POLICY": {
      return { ...state, decryptionPolicies: state.decryptionPolicies.filter((p) => p.id !== action.id) };
    }
    case "TOGGLE_DECRYPTION_POLICY": {
      // PaloDecryptionPolicy has no `disabled` field in types.ts — toggling flips
      // action between decrypt/no-decrypt, which is the closest real-world equivalent
      // of "disabling" a decryption rule (leaving it in place but inert).
      return {
        ...state,
        decryptionPolicies: state.decryptionPolicies.map((p) =>
          p.id === action.id ? { ...p, action: p.action === "decrypt" ? "no-decrypt" : "decrypt" } : p,
        ),
      };
    }
    case "REORDER_DECRYPTION_POLICY": {
      return { ...state, decryptionPolicies: reorderById(state.decryptionPolicies, action.id, action.direction) };
    }

    // ───────── Auth policies ─────────
    case "ADD_AUTH_POLICY": {
      const id = nextPolicyId(state.authPolicies);
      const policy: PaloAuthPolicy = { ...action.policy, id };
      return { ...state, authPolicies: [...state.authPolicies, policy] };
    }
    case "UPDATE_AUTH_POLICY": {
      return {
        ...state,
        authPolicies: state.authPolicies.map((p) => (p.id === action.id ? { ...p, ...action.patch, id: p.id } : p)),
      };
    }
    case "DELETE_AUTH_POLICY": {
      return { ...state, authPolicies: state.authPolicies.filter((p) => p.id !== action.id) };
    }
    case "TOGGLE_AUTH_POLICY": {
      // PaloAuthPolicy has no `disabled` field in types.ts — toggling flips the
      // timeout to/from 0 as the closest real-world "disabled" stand-in (0 = no
      // captive-portal timeout enforced), preserving the original value by negating.
      return {
        ...state,
        authPolicies: state.authPolicies.map((p) =>
          p.id === action.id ? { ...p, timeout: p.timeout === 0 ? 60 : 0 } : p,
        ),
      };
    }
    case "REORDER_AUTH_POLICY": {
      return { ...state, authPolicies: reorderById(state.authPolicies, action.id, action.direction) };
    }

    // ───────── VPN ─────────
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
    case "ADD_IKE_GATEWAY": {
      if (state.ikeGateways.some((g) => g.name === action.gateway.name)) return state;
      return { ...state, ikeGateways: [...state.ikeGateways, action.gateway] };
    }
    case "UPDATE_IKE_GATEWAY": {
      return {
        ...state,
        ikeGateways: state.ikeGateways.map((g) => (g.name === action.name ? { ...g, ...action.patch } : g)),
      };
    }
    case "DELETE_IKE_GATEWAY": {
      return { ...state, ikeGateways: state.ikeGateways.filter((g) => g.name !== action.name) };
    }
    case "UPDATE_GP_PORTAL": {
      return {
        ...state,
        globalProtect: {
          ...state.globalProtect,
          portals: state.globalProtect.portals.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
        },
      };
    }
    case "UPDATE_GP_GATEWAY": {
      return {
        ...state,
        globalProtect: {
          ...state.globalProtect,
          gateways: state.globalProtect.gateways.map((g) => (g.name === action.name ? { ...g, ...action.patch } : g)),
        },
      };
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

    // ───────── Device: administrators / HA ─────────
    case "ADD_ADMINISTRATOR": {
      if (state.administrators.some((a) => a.name === action.administrator.name)) return state;
      return { ...state, administrators: [...state.administrators, action.administrator] };
    }
    case "DELETE_ADMINISTRATOR": {
      return { ...state, administrators: state.administrators.filter((a) => a.name !== action.name) };
    }
    case "UPDATE_HA_CONFIG": {
      return { ...state, highAvailability: { ...state.highAvailability, ...action.patch } };
    }

    // ───────── Logs ─────────
    case "APPEND_TRAFFIC_LOG": {
      return { ...state, trafficLogs: [action.entry, ...state.trafficLogs].slice(0, TRAFFIC_LOG_CAP) };
    }
    case "CLEAR_TRAFFIC_LOGS": {
      return { ...state, trafficLogs: [] };
    }
    case "CLEAR_THREAT_LOGS": {
      return { ...state, threatLogs: [] };
    }
    case "CLEAR_URL_LOGS": {
      return { ...state, urlLogs: [] };
    }
    case "CLEAR_SYSTEM_LOGS": {
      return { ...state, systemLogs: [] };
    }

    default:
      return state;
  }
}
