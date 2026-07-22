import type {
  CiscoAcl,
  CiscoAclRule,
  CiscoDevice,
  CiscoDhcpPool,
  CiscoDiagHistoryEntry,
  CiscoInterface,
  CiscoLocalUser,
  CiscoNatStaticEntry,
  CiscoState,
  CiscoStaticRoute,
  CiscoSyslogEntry,
  CiscoVlan,
} from "./types";
import { simulatePing, simulateTraceroute } from "./routing-engine";
import { freshCiscoState } from "./seedData";

// This is a NEW reducer — source (cisco-data.js + cisco-ui.js) is 100%
// direct-mutation via `CiscoData.state.foo = ...; CiscoData.save()`. Every action
// below corresponds either to a real mutation call-site in source (grep for
// `CiscoData.save()` / `CiscoData.state.` assignments across cisco-ui.js — interface
// edit/toggle/add, static route add/delete, ripConfig/ospfConfig/device patch, ACL
// add, IPsec tunnel add, NAT static entry add/delete, syslog clear) or a plausible
// real-admin-portal mutation in the same family (VLAN/EIGRP/BGP/DHCP/local-user CRUD,
// ACL rule CRUD) that a real WebUI needs even though source's own UI didn't wire a
// button for it.

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Same shared convention as routing-engine.ts / seedData.ts / every other port. No
// Math.random() anywhere in this file — TICK_COUNTERS' formulas (which source drove
// with raw Math.random()) take a `seed` from the action payload instead.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return Math.floor(rand() * (hi - lo + 1)) + lo;
}

/** Hash a string into a positive integer seed — derives a per-call RNG seed from a
 * stable key (e.g. interface name + timestamp) so results are deterministic across
 * reloads given the same inputs, without ever calling Math.random(). */
function seedFromString(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % 2147483647;
  }
  return h <= 0 ? h + 2147483646 : h;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

let idCounter = 0;
/** Deterministic-enough id generator for history entries created inside the reducer. */
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export type CiscoAction =
  | { type: "LOAD_STATE"; state: CiscoState }
  | { type: "RESET_STATE" }

  // ───────── Live counters (ported from cisco-data.js `tickCounters()`) ─────────
  | { type: "TICK_COUNTERS"; seed: number }

  // ───────── Interfaces (cisco-ui.js `_toggleIface`/`_saveIface`/`_addIface`) ─────────
  | { type: "TOGGLE_INTERFACE_ADMIN"; name: string; nowIso: string }
  | { type: "UPDATE_INTERFACE"; name: string; patch: Partial<CiscoInterface> }
  | { type: "ADD_INTERFACE"; iface: CiscoInterface }

  // ───────── VLANs (no direct source mutation call-site — real CRUD surface a
  // switch-config WebUI needs; state.vlans is the canonical list, mirrors the
  // approach taken in the Meraki port for the same gap) ─────────
  | { type: "ADD_VLAN"; vlan: CiscoVlan }
  | { type: "UPDATE_VLAN"; id: number; patch: Partial<CiscoVlan> }
  | { type: "DELETE_VLAN"; id: number }

  // ───────── Static routes (cisco-ui.js real `.push`/`.splice` + `CiscoData.save()`
  // around line 2849-2860) ─────────
  | { type: "ADD_STATIC_ROUTE"; route: CiscoStaticRoute }
  | { type: "UPDATE_STATIC_ROUTE"; index: number; patch: Partial<CiscoStaticRoute> }
  | { type: "DELETE_STATIC_ROUTE"; index: number }

  // ───────── ACLs (cisco-ui.js real `.push` around line 2935 for ACL add; rule-level
  // CRUD is a plausible real extension since source only ever pushed whole ACLs) ─────────
  | { type: "ADD_ACL"; acl: CiscoAcl }
  | { type: "UPDATE_ACL"; number: number; patch: Partial<Omit<CiscoAcl, "rules">> }
  | { type: "DELETE_ACL"; number: number }
  | { type: "ADD_ACL_RULE"; aclNumber: number; rule: CiscoAclRule }
  | { type: "UPDATE_ACL_RULE"; aclNumber: number; seq: number; patch: Partial<CiscoAclRule> }
  | { type: "DELETE_ACL_RULE"; aclNumber: number; seq: number }

  // ───────── NAT (cisco-ui.js real static-entry add/delete around line 3028-3036;
  // UPDATE_NAT_CONFIG covers the overload/outsideInterface/insideInterfaces/aclRef
  // fields, which source never exposed a save handler for but a real NAT config page
  // needs) ─────────
  | { type: "ADD_NAT_STATIC_ENTRY"; entry: CiscoNatStaticEntry }
  | { type: "DELETE_NAT_STATIC_ENTRY"; index: number }
  | { type: "UPDATE_NAT_CONFIG"; patch: Partial<Pick<CiscoState["nat"], "overload" | "outsideInterface" | "insideInterfaces" | "aclRef">> }

  // ───────── Local users (no direct source mutation call-site; real CRUD a
  // Configure > Users page needs) ─────────
  | { type: "ADD_LOCAL_USER"; user: CiscoLocalUser }
  | { type: "DELETE_LOCAL_USER"; username: string }

  // ───────── DHCP pools (no direct source mutation call-site; real CRUD a
  // Configure > DHCP page needs) ─────────
  | { type: "ADD_DHCP_POOL"; pool: CiscoDhcpPool }
  | { type: "UPDATE_DHCP_POOL"; name: string; patch: Partial<CiscoDhcpPool> }
  | { type: "DELETE_DHCP_POOL"; name: string }

  // ───────── Syslog (cisco-data.js `appendSyslog()` unshifts + caps at 200; source's
  // real "Clear log" button around cisco-ui.js line 3043-3044) ─────────
  | { type: "APPEND_SYSLOG_ENTRY"; entry: CiscoSyslogEntry }
  | { type: "CLEAR_SYSLOG" }

  // ───────── Diagnostics — the real routing-aware ping/traceroute engine ─────────
  | { type: "RUN_PING"; dst: string; srcInterfaceName: string | null; seed: number; nowIso: string }
  | { type: "RUN_TRACEROUTE"; dst: string; srcInterfaceName: string | null; seed: number; nowIso: string }
  | { type: "CLEAR_DIAG_HISTORY" }

  // ───────── Routing protocol config (cisco-ui.js real ripConfig/ospfConfig save
  // handlers around line 2867-2902; EIGRP/BGP have no direct source save handler but
  // follow the identical shape) ─────────
  | { type: "UPDATE_OSPF_CONFIG"; patch: Partial<CiscoState["ospfConfig"]> }
  | { type: "UPDATE_EIGRP_CONFIG"; patch: Partial<CiscoState["eigrpConfig"]> }
  | { type: "UPDATE_BGP_CONFIG"; patch: Partial<CiscoState["bgpConfig"]> }

  // ───────── Device (cisco-ui.js real device-field save handler around line 2908-2914
  // — hostname/banner/domain/dns edits) ─────────
  | { type: "UPDATE_DEVICE"; patch: Partial<CiscoDevice> };

const DIAG_HISTORY_CAP = 50;
const SYSLOG_CAP = 200;

export function ciscoReducer(state: CiscoState, action: CiscoAction): CiscoState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "RESET_STATE":
      return freshCiscoState();

    // ───────── Live counters — ports tickCounters()'s exact formulas, seeded ─────────
    case "TICK_COUNTERS": {
      const rand = rng(action.seed);
      const interfaces = state.interfaces.map((f) => {
        if (!f.adminUp || !f.lineUp) return f;
        const d = randInt(rand, 800, 12799);
        const u = randInt(rand, 500, 9499);
        const inputErrors = f.role === "wan" && rand() < 0.25 ? f.inputErrors + 1 : f.inputErrors;
        return {
          ...f,
          inputPackets: f.inputPackets + d,
          outputPackets: f.outputPackets + u,
          bytesIn: f.bytesIn + d * randInt(rand, 200, 999),
          bytesOut: f.bytesOut + u * randInt(rand, 200, 999),
          inputRate: 1000 * randInt(rand, 1000, 9999),
          outputRate: 1000 * randInt(rand, 800, 6799),
          inputErrors,
        };
      });
      const dv = state.device;
      const cpu5sec = clamp(dv.cpu5sec + (randInt(rand, 0, 8) - 4), 5, 92);
      const cpu1min = clamp(dv.cpu1min + (randInt(rand, 0, 4) - 2), 5, 85);
      const cpu5min = clamp(dv.cpu5min + (randInt(rand, 0, 2) - 1), 5, 80);
      const memDelta = randInt(rand, 0, 19999) - 10000;
      const memUsed = clamp(dv.memUsed + memDelta, 800000, dv.memTotal - 200000);
      return {
        ...state,
        interfaces,
        device: { ...dv, cpu5sec, cpu1min, cpu5min, memUsed },
      };
    }

    // ───────── Interfaces ─────────
    case "TOGGLE_INTERFACE_ADMIN": {
      const iface = state.interfaces.find((f) => f.name === action.name);
      if (!iface) return state;
      const adminUp = !iface.adminUp;
      // Real router behavior: line protocol follows admin state — bringing an
      // interface down also drops line-up, bringing it up restores it (matches
      // source's real `f.lineUp = f.adminUp` mutation in `_toggleIface`).
      const lineUp = adminUp;
      const entry: CiscoSyslogEntry = {
        ts: action.nowIso,
        seq: 100000 + randInt(rng(seedFromString(iface.name + action.nowIso)), 1, 9999),
        facility: "LINK",
        severity: "warning",
        mnemonic: "CHANGED",
        message: `%LINK-3-CHANGED: Interface ${iface.name}, changed state to ${adminUp ? "up" : "administratively down"}`,
      };
      return {
        ...state,
        interfaces: state.interfaces.map((f) => (f.name === action.name ? { ...f, adminUp, lineUp } : f)),
        syslog: { ...state.syslog, entries: [entry, ...state.syslog.entries].slice(0, SYSLOG_CAP) },
      };
    }
    case "UPDATE_INTERFACE": {
      return {
        ...state,
        interfaces: state.interfaces.map((f) => (f.name === action.name ? { ...f, ...action.patch } : f)),
      };
    }
    case "ADD_INTERFACE": {
      if (state.interfaces.some((f) => f.name === action.iface.name)) return state;
      return { ...state, interfaces: [...state.interfaces, action.iface] };
    }

    // ───────── VLANs ─────────
    case "ADD_VLAN": {
      if (state.vlans.some((v) => v.id === action.vlan.id)) return state;
      return { ...state, vlans: [...state.vlans, action.vlan] };
    }
    case "UPDATE_VLAN": {
      return { ...state, vlans: state.vlans.map((v) => (v.id === action.id ? { ...v, ...action.patch } : v)) };
    }
    case "DELETE_VLAN": {
      return { ...state, vlans: state.vlans.filter((v) => v.id !== action.id) };
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

    // ───────── ACLs ─────────
    case "ADD_ACL": {
      if (state.acls.some((a) => a.number === action.acl.number)) return state;
      return { ...state, acls: [...state.acls, action.acl] };
    }
    case "UPDATE_ACL": {
      return {
        ...state,
        acls: state.acls.map((a) => (a.number === action.number ? { ...a, ...action.patch } : a)),
      };
    }
    case "DELETE_ACL": {
      return { ...state, acls: state.acls.filter((a) => a.number !== action.number) };
    }
    case "ADD_ACL_RULE": {
      return {
        ...state,
        acls: state.acls.map((a) => (a.number === action.aclNumber ? { ...a, rules: [...a.rules, action.rule] } : a)),
      };
    }
    case "UPDATE_ACL_RULE": {
      return {
        ...state,
        acls: state.acls.map((a) =>
          a.number === action.aclNumber ? { ...a, rules: a.rules.map((r) => (r.seq === action.seq ? { ...r, ...action.patch } : r)) } : a,
        ),
      };
    }
    case "DELETE_ACL_RULE": {
      return {
        ...state,
        acls: state.acls.map((a) => (a.number === action.aclNumber ? { ...a, rules: a.rules.filter((r) => r.seq !== action.seq) } : a)),
      };
    }

    // ───────── NAT ─────────
    case "ADD_NAT_STATIC_ENTRY": {
      return { ...state, nat: { ...state.nat, staticEntries: [...state.nat.staticEntries, action.entry] } };
    }
    case "DELETE_NAT_STATIC_ENTRY": {
      return {
        ...state,
        nat: { ...state.nat, staticEntries: state.nat.staticEntries.filter((_, i) => i !== action.index) },
      };
    }
    case "UPDATE_NAT_CONFIG": {
      return { ...state, nat: { ...state.nat, ...action.patch } };
    }

    // ───────── Local users ─────────
    case "ADD_LOCAL_USER": {
      if (state.localUsers.some((u) => u.username === action.user.username)) return state;
      return { ...state, localUsers: [...state.localUsers, action.user] };
    }
    case "DELETE_LOCAL_USER": {
      return { ...state, localUsers: state.localUsers.filter((u) => u.username !== action.username) };
    }

    // ───────── DHCP pools ─────────
    case "ADD_DHCP_POOL": {
      if (state.dhcpPools.some((p) => p.name === action.pool.name)) return state;
      return { ...state, dhcpPools: [...state.dhcpPools, action.pool] };
    }
    case "UPDATE_DHCP_POOL": {
      return {
        ...state,
        dhcpPools: state.dhcpPools.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p)),
      };
    }
    case "DELETE_DHCP_POOL": {
      return { ...state, dhcpPools: state.dhcpPools.filter((p) => p.name !== action.name) };
    }

    // ───────── Syslog ─────────
    case "APPEND_SYSLOG_ENTRY": {
      return {
        ...state,
        syslog: { ...state.syslog, entries: [action.entry, ...state.syslog.entries].slice(0, SYSLOG_CAP) },
      };
    }
    case "CLEAR_SYSLOG": {
      return { ...state, syslog: { ...state.syslog, entries: [] } };
    }

    // ───────── Diagnostics ─────────
    case "RUN_PING": {
      const result = simulatePing(action.dst, action.srcInterfaceName, state, action.seed);
      const summary =
        result.kind === "ok" || result.kind === "partial"
          ? `${result.received}/${result.sent} received (${result.lossPct}% loss)${result.avgMs != null ? `, avg ${result.avgMs}ms` : ""} via ${result.route?.sourceKind ?? "unknown"}`
          : describePingFailureKind(result.kind);
      const entry: CiscoDiagHistoryEntry = {
        id: genId("diag"),
        ts: action.nowIso,
        kind: "ping",
        dst: action.dst,
        src: action.srcInterfaceName,
        summary,
      };
      return { ...state, diagHistory: [entry, ...state.diagHistory].slice(0, DIAG_HISTORY_CAP) };
    }
    case "RUN_TRACEROUTE": {
      const result = simulateTraceroute(action.dst, action.srcInterfaceName, state, action.seed);
      const summary = result.reached
        ? `Reached in ${result.hops.length} hop(s), last RTT ${result.hops[result.hops.length - 1]?.rttMs ?? "?"}ms`
        : `Timed out after ${result.hops.length} hop(s) — no route to host`;
      const entry: CiscoDiagHistoryEntry = {
        id: genId("diag"),
        ts: action.nowIso,
        kind: "traceroute",
        dst: action.dst,
        src: action.srcInterfaceName,
        summary,
      };
      return { ...state, diagHistory: [entry, ...state.diagHistory].slice(0, DIAG_HISTORY_CAP) };
    }
    case "CLEAR_DIAG_HISTORY": {
      return { ...state, diagHistory: [] };
    }

    // ───────── Routing protocol config ─────────
    case "UPDATE_OSPF_CONFIG": {
      return { ...state, ospfConfig: { ...state.ospfConfig, ...action.patch } };
    }
    case "UPDATE_EIGRP_CONFIG": {
      return { ...state, eigrpConfig: { ...state.eigrpConfig, ...action.patch } };
    }
    case "UPDATE_BGP_CONFIG": {
      return { ...state, bgpConfig: { ...state.bgpConfig, ...action.patch } };
    }

    // ───────── Device ─────────
    case "UPDATE_DEVICE": {
      return { ...state, device: { ...state.device, ...action.patch } };
    }

    default:
      return state;
  }
}

function describePingFailureKind(kind: string): string {
  switch (kind) {
    case "src_admin_down":
      return "Source interface is administratively down";
    case "src_link_down":
      return "Source interface line protocol is down";
    case "bad_dest":
      return "Invalid destination (reserved address)";
    case "no_route":
      return "No route to host";
    case "fail":
      return "100% packet loss";
    default:
      return kind;
  }
}
