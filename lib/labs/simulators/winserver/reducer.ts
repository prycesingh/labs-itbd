import type {
  WinServerState,
  WsCert,
  WsCertTemplate,
  WsClusterRole,
  WsDhcpPolicy,
  WsDhcpReservation,
  WsDhcpScope,
  WsFileScreen,
  WsPrintDriver,
  WsPrinter,
  WsPrintForm,
  WsPrintPort,
  WsQuota,
  WsShare,
  WsStoragePool,
  WsSwitch,
  WsVm,
  WsVmState,
  WsVolume,
  WsWsus,
} from "./types";

function log(state: WinServerState, action: string, target: string, detail = ""): WinServerState {
  const entry = { time: new Date().toISOString(), action, target, detail };
  return { ...state, activity: [entry, ...state.activity].slice(0, 200) };
}

export type WinServerAction =
  | { type: "LOAD_STATE"; state: WinServerState }
  | { type: "ADD_VM"; vm: WsVm }
  | { type: "UPDATE_VM"; id: string; patch: Partial<WsVm> }
  | { type: "DELETE_VM"; id: string }
  | { type: "SET_VM_STATE"; id: string; state: WsVmState; status: string }
  | { type: "ADD_VM_CHECKPOINT"; id: string; name: string }
  | { type: "DELETE_VM_CHECKPOINT"; id: string; checkpointId: string }
  | { type: "MOVE_VM"; id: string; note: string }
  | { type: "ADD_SWITCH"; sw: WsSwitch }
  | { type: "DELETE_SWITCH"; name: string }
  | { type: "ADD_VOLUME"; volume: WsVolume }
  | { type: "ADD_STORAGE_POOL"; pool: WsStoragePool }
  | { type: "ADD_SHARE"; share: WsShare }
  | { type: "UPDATE_SHARE"; name: string; patch: Partial<WsShare> }
  | { type: "DELETE_SHARE"; name: string }
  | { type: "ADD_QUOTA"; quota: WsQuota }
  | { type: "ADD_FILE_SCREEN"; screen: WsFileScreen }
  | { type: "ADD_DHCP_SCOPE"; scope: WsDhcpScope }
  | { type: "UPDATE_DHCP_SCOPE"; id: string; patch: Partial<WsDhcpScope> }
  | { type: "DELETE_DHCP_SCOPE"; id: string }
  | { type: "ADD_DHCP_RESERVATION"; reservation: WsDhcpReservation }
  | { type: "DELETE_DHCP_RESERVATION"; scopeId: string; ip: string }
  | { type: "ADD_DHCP_POLICY"; policy: WsDhcpPolicy }
  | { type: "SET_DHCP_OPTIONS"; scopeId: string | null; options: Record<string, string> }
  | { type: "ADD_DHCP_FILTER"; list: "allow" | "deny"; entry: { mac: string; description: string } }
  | { type: "APPROVE_UPDATE"; id: string; approval: string; groups: string[] }
  | { type: "DECLINE_UPDATE"; id: string }
  | { type: "ADD_WSUS_COMPUTER_GROUP"; name: string }
  | { type: "DELETE_WSUS_COMPUTER_GROUP"; name: string }
  | { type: "RUN_WSUS_SYNC" }
  | { type: "SET_WSUS_SYNC_SCHEDULE"; schedule: WsWsus["syncSchedule"] }
  | { type: "ISSUE_CERT"; reqId: number }
  | { type: "DENY_CERT"; reqId: number }
  | { type: "REVOKE_CERT"; reqId: number; reason: string }
  | { type: "PUBLISH_CRL"; kind: "Base" | "Delta" }
  | { type: "MOVE_CLUSTER_ROLE"; name: string; targetNode: string }
  | { type: "SET_CLUSTER_ROLE_STATUS"; name: string; status: WsClusterRole["status"] }
  | { type: "PAUSE_NODE"; name: string; drain: boolean }
  | { type: "RESUME_NODE"; name: string }
  | { type: "EVICT_NODE"; name: string }
  | { type: "ADD_CLUSTER_ROLE"; role: WsClusterRole }
  | { type: "UPDATE_CLUSTER_ROLE"; name: string; patch: Partial<WsClusterRole> }
  | { type: "REMOVE_CLUSTER_ROLE"; name: string }
  | { type: "ADD_RRAS_ROUTE"; version: "v4" | "v6"; route: { destination: string; mask: string; gateway: string; interfaceName: string; metric: number } }
  | { type: "DELETE_RRAS_ROUTE"; version: "v4" | "v6"; destination: string }
  | { type: "ADD_NAT_MAPPING"; mapping: { protocol: "TCP" | "UDP"; publicPort: number; privateAddr: string; privatePort: number; description: string } }
  | { type: "SET_NAT_ENABLED"; enabled: boolean }
  | { type: "ADD_PRINTER"; printer: WsPrinter }
  | { type: "UPDATE_PRINTER"; name: string; patch: Partial<WsPrinter> }
  | { type: "DELETE_PRINTER"; name: string }
  | { type: "ADD_PRINT_PORT"; port: WsPrintPort }
  | { type: "ADD_PRINT_FORM"; form: WsPrintForm }
  | { type: "ADD_PRINT_DRIVER"; driver: WsPrintDriver };

export function winServerReducer(state: WinServerState, action: WinServerAction): WinServerState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "ADD_VM": {
      if (state.hyperv.vms.some((v) => v.id === action.vm.id)) return state;
      return log({ ...state, hyperv: { ...state.hyperv, vms: [...state.hyperv.vms, action.vm] } }, "Create VM", action.vm.name);
    }
    case "UPDATE_VM": {
      const vms = state.hyperv.vms.map((v) => (v.id === action.id ? { ...v, ...action.patch } : v));
      return log({ ...state, hyperv: { ...state.hyperv, vms } }, "Update VM", action.id);
    }
    case "DELETE_VM": {
      const vm = state.hyperv.vms.find((v) => v.id === action.id);
      const vms = state.hyperv.vms.filter((v) => v.id !== action.id);
      return log({ ...state, hyperv: { ...state.hyperv, vms } }, "Delete VM", vm?.name ?? action.id);
    }
    case "SET_VM_STATE": {
      const vms = state.hyperv.vms.map((v) => (v.id === action.id ? { ...v, state: action.state, status: action.status } : v));
      const vm = state.hyperv.vms.find((v) => v.id === action.id);
      return log({ ...state, hyperv: { ...state.hyperv, vms } }, `Set VM state: ${action.state}`, vm?.name ?? action.id);
    }
    case "ADD_VM_CHECKPOINT": {
      const vms = state.hyperv.vms.map((v) => {
        if (v.id !== action.id) return v;
        const parent = v.checkpoints.length ? v.checkpoints[v.checkpoints.length - 1].id : null;
        return { ...v, checkpoints: [...v.checkpoints, { id: crypto.randomUUID(), name: action.name, created: new Date().toISOString(), parent }] };
      });
      return log({ ...state, hyperv: { ...state.hyperv, vms } }, "Create checkpoint", action.name);
    }
    case "DELETE_VM_CHECKPOINT": {
      const vms = state.hyperv.vms.map((v) => (v.id === action.id ? { ...v, checkpoints: v.checkpoints.filter((c) => c.id !== action.checkpointId) } : v));
      return log({ ...state, hyperv: { ...state.hyperv, vms } }, "Delete checkpoint", action.checkpointId);
    }
    case "MOVE_VM": {
      const vms = state.hyperv.vms.map((v) => (v.id === action.id ? { ...v, lastMoved: [...(v.lastMoved ?? []), action.note] } : v));
      const vm = state.hyperv.vms.find((v) => v.id === action.id);
      return log({ ...state, hyperv: { ...state.hyperv, vms } }, "Move VM", vm?.name ?? action.id, action.note);
    }
    case "ADD_SWITCH": {
      if (state.hyperv.switches.some((s) => s.name === action.sw.name)) return state;
      return log({ ...state, hyperv: { ...state.hyperv, switches: [...state.hyperv.switches, action.sw] } }, "Create virtual switch", action.sw.name);
    }
    case "DELETE_SWITCH":
      return log({ ...state, hyperv: { ...state.hyperv, switches: state.hyperv.switches.filter((s) => s.name !== action.name) } }, "Delete virtual switch", action.name);

    case "ADD_VOLUME":
      return log({ ...state, fileshare: { ...state.fileshare, volumes: [...state.fileshare.volumes, action.volume] } }, "Create volume", action.volume.letter);
    case "ADD_STORAGE_POOL":
      return log({ ...state, fileshare: { ...state.fileshare, storagePools: [...state.fileshare.storagePools, action.pool] } }, "Create storage pool", action.pool.name);
    case "ADD_SHARE": {
      if (state.fileshare.shares.some((s) => s.name === action.share.name)) return state;
      return log({ ...state, fileshare: { ...state.fileshare, shares: [...state.fileshare.shares, action.share] } }, "Create share", action.share.name);
    }
    case "UPDATE_SHARE": {
      const shares = state.fileshare.shares.map((s) => (s.name === action.name ? { ...s, ...action.patch } : s));
      return log({ ...state, fileshare: { ...state.fileshare, shares } }, "Update share", action.name);
    }
    case "DELETE_SHARE":
      return log({ ...state, fileshare: { ...state.fileshare, shares: state.fileshare.shares.filter((s) => s.name !== action.name) } }, "Stop sharing", action.name);
    case "ADD_QUOTA":
      return log({ ...state, fileshare: { ...state.fileshare, quotas: [...state.fileshare.quotas, action.quota] } }, "Create quota", action.quota.path);
    case "ADD_FILE_SCREEN":
      return log({ ...state, fileshare: { ...state.fileshare, fileScreens: [...state.fileshare.fileScreens, action.screen] } }, "Create file screen", action.screen.path);

    case "ADD_DHCP_SCOPE": {
      if (state.dhcp.scopes.some((s) => s.id === action.scope.id)) return state;
      return log({ ...state, dhcp: { ...state.dhcp, scopes: [...state.dhcp.scopes, action.scope] } }, "Create DHCP scope", action.scope.name);
    }
    case "UPDATE_DHCP_SCOPE": {
      const scopes = state.dhcp.scopes.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s));
      return log({ ...state, dhcp: { ...state.dhcp, scopes } }, "Update DHCP scope", action.id);
    }
    case "DELETE_DHCP_SCOPE":
      return log({ ...state, dhcp: { ...state.dhcp, scopes: state.dhcp.scopes.filter((s) => s.id !== action.id) } }, "Delete DHCP scope", action.id);
    case "ADD_DHCP_RESERVATION":
      return log({ ...state, dhcp: { ...state.dhcp, reservations: [...state.dhcp.reservations, action.reservation] } }, "Create DHCP reservation", action.reservation.ip);
    case "DELETE_DHCP_RESERVATION":
      return log(
        { ...state, dhcp: { ...state.dhcp, reservations: state.dhcp.reservations.filter((r) => !(r.scopeId === action.scopeId && r.ip === action.ip)) } },
        "Delete DHCP reservation",
        action.ip,
      );
    case "ADD_DHCP_POLICY":
      return log({ ...state, dhcp: { ...state.dhcp, policies: [...state.dhcp.policies, action.policy] } }, "Create DHCP policy", action.policy.name);
    case "SET_DHCP_OPTIONS": {
      if (action.scopeId === null) {
        return log({ ...state, dhcp: { ...state.dhcp, serverOptions: action.options } }, "Set DHCP server options", "server");
      }
      const scopes = state.dhcp.scopes.map((s) => (s.id === action.scopeId ? { ...s, options: action.options } : s));
      return log({ ...state, dhcp: { ...state.dhcp, scopes } }, "Set DHCP scope options", action.scopeId);
    }
    case "ADD_DHCP_FILTER": {
      const filters = { ...state.dhcp.filters, [action.list]: [...state.dhcp.filters[action.list], action.entry] };
      return log({ ...state, dhcp: { ...state.dhcp, filters } }, `Add DHCP ${action.list} filter`, action.entry.mac);
    }

    case "APPROVE_UPDATE": {
      const updates = state.wsus.updates.map((u) => (u.id === action.id ? { ...u, approval: action.approval, groups: action.groups } : u));
      return log({ ...state, wsus: { ...state.wsus, updates } }, "Approve update", action.id);
    }
    case "DECLINE_UPDATE": {
      const updates = state.wsus.updates.map((u) => (u.id === action.id ? { ...u, approval: "Declined" } : u));
      return log({ ...state, wsus: { ...state.wsus, updates } }, "Decline update", action.id);
    }
    case "ADD_WSUS_COMPUTER_GROUP":
      return log({ ...state, wsus: { ...state.wsus, computerGroups: [...state.wsus.computerGroups, { name: action.name, protected: false }] } }, "Create computer group", action.name);
    case "DELETE_WSUS_COMPUTER_GROUP": {
      const grp = state.wsus.computerGroups.find((g) => g.name === action.name);
      if (grp?.protected) return state;
      return log({ ...state, wsus: { ...state.wsus, computerGroups: state.wsus.computerGroups.filter((g) => g.name !== action.name) } }, "Delete computer group", action.name);
    }
    case "RUN_WSUS_SYNC": {
      const now = new Date().toISOString();
      const entry = { started: now, finished: now, result: "Succeeded", newUpdates: Math.floor(Math.random() * 10) };
      return log(
        { ...state, wsus: { ...state.wsus, lastSync: now, syncHistory: [entry, ...state.wsus.syncHistory].slice(0, 50) } },
        "Synchronize now",
        "WSUS",
      );
    }
    case "SET_WSUS_SYNC_SCHEDULE":
      return log({ ...state, wsus: { ...state.wsus, syncSchedule: action.schedule } }, "Set synchronization schedule", action.schedule.mode);

    case "ISSUE_CERT": {
      const cert = state.adcs.certs.find((c) => c.reqId === action.reqId);
      if (!cert) return state;
      const certs = state.adcs.certs.map((c): WsCert => (c.reqId === action.reqId ? { ...c, status: "Issued" as const, serial: Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase() } : c));
      return log({ ...state, adcs: { ...state.adcs, certs } }, "Issue certificate", String(action.reqId));
    }
    case "DENY_CERT": {
      const certs = state.adcs.certs.map((c) => (c.reqId === action.reqId ? { ...c, status: "Failed" as const } : c));
      return log({ ...state, adcs: { ...state.adcs, certs } }, "Deny certificate request", String(action.reqId));
    }
    case "REVOKE_CERT": {
      const certs = state.adcs.certs.map((c) => (c.reqId === action.reqId ? { ...c, status: "Revoked" as const, revokeReason: action.reason } : c));
      return log({ ...state, adcs: { ...state.adcs, certs } }, "Revoke certificate", String(action.reqId), action.reason);
    }
    case "PUBLISH_CRL": {
      const now = new Date().toISOString();
      const crl = action.kind === "Base" ? { ...state.adcs.crl, lastBasePublish: now } : { ...state.adcs.crl, lastDeltaPublish: now };
      return log({ ...state, adcs: { ...state.adcs, crl } }, `Publish ${action.kind} CRL`, state.adcs.caName);
    }

    case "MOVE_CLUSTER_ROLE": {
      const roles = state.failover.roles.map((r) => (r.name === action.name ? { ...r, ownerNode: action.targetNode } : r));
      return log({ ...state, failover: { ...state.failover, roles } }, "Move cluster role", action.name, `to ${action.targetNode}`);
    }
    case "SET_CLUSTER_ROLE_STATUS": {
      const roles = state.failover.roles.map((r) => (r.name === action.name ? { ...r, status: action.status } : r));
      return log({ ...state, failover: { ...state.failover, roles } }, `Set role status: ${action.status}`, action.name);
    }
    case "PAUSE_NODE": {
      const nodes = state.failover.nodes.map((n) => (n.name === action.name ? { ...n, status: "Paused" as const } : n));
      let roles = state.failover.roles;
      if (action.drain) {
        const otherNodes = state.failover.nodes.filter((n) => n.name !== action.name && n.status === "Up").map((n) => n.name);
        const bestNode = otherNodes[0];
        if (bestNode) {
          roles = roles.map((r) => (r.ownerNode === action.name ? { ...r, ownerNode: bestNode } : r));
        }
      }
      return log({ ...state, failover: { ...state.failover, nodes, roles } }, action.drain ? "Pause node (drain roles)" : "Pause node", action.name);
    }
    case "RESUME_NODE": {
      const nodes = state.failover.nodes.map((n) => (n.name === action.name ? { ...n, status: "Up" as const } : n));
      return log({ ...state, failover: { ...state.failover, nodes } }, "Resume node", action.name);
    }
    case "EVICT_NODE": {
      const nodes = state.failover.nodes.filter((n) => n.name !== action.name);
      return log({ ...state, failover: { ...state.failover, nodes } }, "Evict node", action.name);
    }
    case "ADD_CLUSTER_ROLE":
      return log({ ...state, failover: { ...state.failover, roles: [...state.failover.roles, action.role] } }, "Configure role", action.role.name);
    case "UPDATE_CLUSTER_ROLE": {
      const roles = state.failover.roles.map((r) => (r.name === action.name ? { ...r, ...action.patch } : r));
      return log({ ...state, failover: { ...state.failover, roles } }, "Update cluster role", action.name);
    }
    case "REMOVE_CLUSTER_ROLE":
      return log({ ...state, failover: { ...state.failover, roles: state.failover.roles.filter((r) => r.name !== action.name) } }, "Remove cluster role", action.name);

    case "ADD_RRAS_ROUTE": {
      const key = action.version === "v4" ? "routesV4" : "routesV6";
      return log({ ...state, rras: { ...state.rras, [key]: [...state.rras[key], action.route] } }, "Create static route", action.route.destination);
    }
    case "DELETE_RRAS_ROUTE": {
      const key = action.version === "v4" ? "routesV4" : "routesV6";
      return log({ ...state, rras: { ...state.rras, [key]: state.rras[key].filter((r) => r.destination !== action.destination) } }, "Delete static route", action.destination);
    }
    case "ADD_NAT_MAPPING":
      return log({ ...state, rras: { ...state.rras, nat: { ...state.rras.nat, mappings: [...state.rras.nat.mappings, action.mapping] } } }, "Create NAT mapping", String(action.mapping.publicPort));
    case "SET_NAT_ENABLED":
      return log({ ...state, rras: { ...state.rras, nat: { ...state.rras.nat, enabled: action.enabled } } }, action.enabled ? "Enable NAT" : "Disable NAT", "RRAS");

    case "ADD_PRINTER": {
      if (state.printserver.printers.some((p) => p.name === action.printer.name)) return state;
      return log({ ...state, printserver: { ...state.printserver, printers: [...state.printserver.printers, action.printer] } }, "Add printer", action.printer.name);
    }
    case "UPDATE_PRINTER": {
      const printers = state.printserver.printers.map((p) => (p.name === action.name ? { ...p, ...action.patch } : p));
      return log({ ...state, printserver: { ...state.printserver, printers } }, "Update printer", action.name);
    }
    case "DELETE_PRINTER":
      return log({ ...state, printserver: { ...state.printserver, printers: state.printserver.printers.filter((p) => p.name !== action.name) } }, "Delete printer", action.name);
    case "ADD_PRINT_PORT":
      return log({ ...state, printserver: { ...state.printserver, ports: [...state.printserver.ports, action.port] } }, "Create port", action.port.name);
    case "ADD_PRINT_FORM":
      return log({ ...state, printserver: { ...state.printserver, forms: [...state.printserver.forms, action.form] } }, "Create form", action.form.name);
    case "ADD_PRINT_DRIVER":
      return log({ ...state, printserver: { ...state.printserver, drivers: [...state.printserver.drivers, action.driver] } }, "Add driver", action.driver.name);

    default:
      return state;
  }
}
