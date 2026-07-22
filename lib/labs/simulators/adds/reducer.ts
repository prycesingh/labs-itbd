import type {
  AddsConnectionObject,
  AddsDnsRecord,
  AddsDnsZone,
  AddsGpo,
  AddsGpoLink,
  AddsGroup,
  AddsOu,
  AddsSite,
  AddsSiteLink,
  AddsState,
  AddsSubnetObject,
  AddsUser,
} from "./types";

function log(state: AddsState, action: string, target: string, detail = ""): AddsState {
  const entry = { time: new Date().toISOString(), action, target, detail };
  return { ...state, activity: [entry, ...state.activity].slice(0, 200) };
}

export type AddsAction =
  | { type: "LOAD_STATE"; state: AddsState }
  | { type: "ADD_OU"; ou: AddsOu }
  | { type: "DELETE_OU"; name: string }
  | { type: "RENAME_OU"; oldName: string; newName: string }
  | { type: "ADD_USER"; user: AddsUser }
  | { type: "UPDATE_USER"; sam: string; patch: Partial<AddsUser> }
  | { type: "DELETE_USER"; sam: string }
  | { type: "MOVE_USER"; sam: string; newOu: string }
  | { type: "SET_USER_ENABLED"; sam: string; enabled: boolean }
  | { type: "RESET_USER_PASSWORD"; sam: string; mustChange?: boolean; unlock?: boolean }
  | { type: "ADD_GROUP"; group: AddsGroup }
  | { type: "UPDATE_GROUP"; name: string; patch: Partial<AddsGroup> }
  | { type: "DELETE_GROUP"; name: string }
  | { type: "ADD_GROUP_MEMBER"; groupName: string; sam: string }
  | { type: "REMOVE_GROUP_MEMBER"; groupName: string; sam: string }
  | { type: "ADD_COMPUTER"; name: string; description: string; ouPath: string }
  | { type: "UPDATE_COMPUTER"; name: string; patch: Partial<import("./types").AddsComputer> }
  | { type: "DELETE_COMPUTER"; name: string }
  | { type: "MOVE_COMPUTER"; name: string; newOu: string }
  | { type: "ADD_GPO"; gpo: AddsGpo }
  | { type: "UPDATE_GPO"; name: string; patch: Partial<AddsGpo> }
  | { type: "DELETE_GPO"; name: string }
  | { type: "SET_GPO_POLICY"; gpoName: string; path: string; value: string }
  | { type: "LINK_GPO"; gpoName: string; ou: string }
  | { type: "UNLINK_GPO"; gpoName: string; ou: string }
  | { type: "TOGGLE_GPO_LINK"; gpoName: string; ou: string; field: "enforced" | "enabled" }
  | { type: "SET_GPO_SECURITY_FILTERING"; gpoName: string; principals: string[] }
  | { type: "SET_GPO_WMI_FILTER"; gpoName: string; filterName: string }
  | { type: "ADD_WMI_FILTER"; name: string; description: string; query: string }
  | { type: "BACKUP_ALL_GPOS"; location: string; description: string }
  | { type: "ADD_ZONE"; zone: AddsDnsZone }
  | { type: "UPDATE_ZONE"; name: string; patch: Partial<AddsDnsZone> }
  | { type: "DELETE_ZONE"; name: string }
  | { type: "ADD_RECORD"; zoneName: string; record: AddsDnsRecord }
  | { type: "DELETE_RECORD"; zoneName: string; index: number }
  | { type: "UPDATE_RECORD"; zoneName: string; index: number; patch: Partial<AddsDnsRecord> }
  | { type: "TRANSFER_FSMO_ROLE"; role: keyof AddsState["domain"]; targetDc: string }
  | { type: "SEIZE_FSMO_ROLE"; role: keyof AddsState["domain"]; targetDc: string }
  | { type: "FORCE_REPLICATION"; fromDc: string; toDc: string }
  | { type: "ADD_SITE"; site: AddsSite }
  | { type: "DELETE_SITE"; name: string }
  | { type: "ADD_SUBNET"; subnet: AddsSubnetObject }
  | { type: "ADD_SITE_LINK"; link: AddsSiteLink }
  | { type: "ADD_CONNECTION_OBJECT"; conn: AddsConnectionObject }
  | { type: "SET_RECYCLE_BIN_ENABLED"; enabled: boolean }
  | { type: "RESTORE_RECYCLE_BIN_ITEM"; id: string }
  | { type: "AAD_CONNECT_RUN_SYNC" }
  | { type: "AAD_CONNECT_SET_STAGING"; staging: boolean }
  | { type: "BITLOCKER_RETRIEVE"; deviceName: string; retrievedBy: string }
  | { type: "TOOLS_SERVICE_SET_STATUS"; name: string; status: "Running" | "Stopped" }
  | { type: "TOOLS_FIREWALL_TOGGLE"; name: string }
  | { type: "TOOLS_TASK_TOGGLE"; name: string }
  | { type: "TOOLS_NPS_ADD_CLIENT"; client: import("./types").AddsRadiusClient };

function findUser(state: AddsState, sam: string): AddsUser | undefined {
  return state.users.find((u) => u.sAMAccountName === sam);
}
function findGroup(state: AddsState, name: string): AddsGroup | undefined {
  return state.groups.find((g) => g.name === name);
}
function findGpo(state: AddsState, idOrName: string): AddsGpo | undefined {
  return state.gpos.find((g) => g.id === idOrName || g.name === idOrName);
}
function findZone(state: AddsState, name: string): AddsDnsZone | undefined {
  return state.dnsZones.find((z) => z.name === name);
}

export function addsReducer(state: AddsState, action: AddsAction): AddsState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "ADD_OU": {
      if (state.ous.some((o) => o.name === action.ou.name)) return state;
      return log({ ...state, ous: [...state.ous, action.ou] }, "Create OU", action.ou.name, action.ou.description);
    }
    case "DELETE_OU": {
      const inUse =
        state.users.some((u) => u.ouPath === action.name) ||
        state.computers.some((c) => c.ouPath === action.name) ||
        state.groups.some((g) => g.ouPath === action.name);
      if (inUse) return state;
      return log({ ...state, ous: state.ous.filter((o) => o.name !== action.name) }, "Delete OU", action.name);
    }
    case "RENAME_OU": {
      const ous = state.ous.map((o) => (o.name === action.oldName ? { ...o, name: action.newName } : o));
      const users = state.users.map((u) => (u.ouPath === action.oldName ? { ...u, ouPath: action.newName } : u));
      const groups = state.groups.map((g) => (g.ouPath === action.oldName ? { ...g, ouPath: action.newName } : g));
      const computers = state.computers.map((c) => (c.ouPath === action.oldName ? { ...c, ouPath: action.newName } : c));
      const gpos = state.gpos.map((g) => ({ ...g, links: g.links.map((l) => (l.ou === action.oldName ? { ...l, ou: action.newName } : l)) }));
      return log({ ...state, ous, users, groups, computers, gpos }, "Rename OU", action.oldName, `to ${action.newName}`);
    }

    case "ADD_USER": {
      if (findUser(state, action.user.sAMAccountName)) return state;
      const memberOf = action.user.memberOf.includes("Domain Users") ? action.user.memberOf : [...action.user.memberOf, "Domain Users"];
      const user = { ...action.user, created: new Date().toISOString(), memberOf };
      const groups = state.groups.map((g) => (g.name === "Domain Users" && !g.members.includes(user.sAMAccountName) ? { ...g, members: [...g.members, user.sAMAccountName] } : g));
      return log({ ...state, users: [...state.users, user], groups }, "Create User", user.sAMAccountName, user.displayName);
    }
    case "UPDATE_USER": {
      const users = state.users.map((u) => (u.sAMAccountName === action.sam ? { ...u, ...action.patch } : u));
      return log({ ...state, users }, "Update User", action.sam);
    }
    case "DELETE_USER": {
      const users = state.users.filter((u) => u.sAMAccountName !== action.sam);
      const groups = state.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== action.sam) }));
      return log({ ...state, users, groups }, "Delete User", action.sam);
    }
    case "MOVE_USER": {
      const users = state.users.map((u) => (u.sAMAccountName === action.sam ? { ...u, ouPath: action.newOu } : u));
      return log({ ...state, users }, "Move User", action.sam, `to ${action.newOu}`);
    }
    case "SET_USER_ENABLED": {
      const users = state.users.map((u) => (u.sAMAccountName === action.sam ? { ...u, enabled: action.enabled } : u));
      return log({ ...state, users }, action.enabled ? "Enable User" : "Disable User", action.sam);
    }
    case "RESET_USER_PASSWORD": {
      const users = state.users.map((u) =>
        u.sAMAccountName === action.sam
          ? {
              ...u,
              passwordLastSet: new Date().toISOString(),
              locked: action.unlock ? false : u.locked,
              mustChangePassword: action.mustChange !== undefined ? action.mustChange : u.mustChangePassword,
            }
          : u,
      );
      return log({ ...state, users }, "Reset Password", action.sam);
    }

    case "ADD_GROUP": {
      if (findGroup(state, action.group.name)) return state;
      return log({ ...state, groups: [...state.groups, { ...action.group, members: action.group.members ?? [] }] }, "Create Group", action.group.name);
    }
    case "UPDATE_GROUP": {
      const groups = state.groups.map((g) => (g.name === action.name ? { ...g, ...action.patch } : g));
      return log({ ...state, groups }, "Update Group", action.name);
    }
    case "DELETE_GROUP": {
      const g = findGroup(state, action.name);
      if (!g || g.builtin) return state;
      const groups = state.groups.filter((x) => x.name !== action.name);
      const users = state.users.map((u) => ({ ...u, memberOf: u.memberOf.filter((m) => m !== action.name) }));
      return log({ ...state, groups, users }, "Delete Group", action.name);
    }
    case "ADD_GROUP_MEMBER": {
      const g = findGroup(state, action.groupName);
      const u = findUser(state, action.sam);
      if (!g || !u) return state;
      const groups = state.groups.map((x) => (x.name === action.groupName && !x.members.includes(action.sam) ? { ...x, members: [...x.members, action.sam] } : x));
      const users = state.users.map((x) => (x.sAMAccountName === action.sam && !x.memberOf.includes(action.groupName) ? { ...x, memberOf: [...x.memberOf, action.groupName] } : x));
      return log({ ...state, groups, users }, "Add member", action.groupName, action.sam);
    }
    case "REMOVE_GROUP_MEMBER": {
      const groups = state.groups.map((x) => (x.name === action.groupName ? { ...x, members: x.members.filter((m) => m !== action.sam) } : x));
      const users = state.users.map((x) => (x.sAMAccountName === action.sam ? { ...x, memberOf: x.memberOf.filter((m) => m !== action.groupName) } : x));
      return log({ ...state, groups, users }, "Remove member", action.groupName, action.sam);
    }

    case "ADD_COMPUTER": {
      if (state.computers.some((c) => c.name === action.name)) return state;
      const computer = {
        name: action.name,
        dnsName: `${action.name}.${state.domain.fqdn}`,
        os: "Windows 11 Enterprise",
        osVersion: "10.0 (22631)",
        enabled: true,
        description: action.description,
        ouPath: action.ouPath,
        lastLogon: "",
        servicePack: "",
      };
      return log({ ...state, computers: [...state.computers, computer] }, "Create Computer", action.name);
    }
    case "UPDATE_COMPUTER": {
      const computers = state.computers.map((c) => (c.name === action.name ? { ...c, ...action.patch } : c));
      return log({ ...state, computers }, "Update Computer", action.name);
    }
    case "DELETE_COMPUTER":
      return log({ ...state, computers: state.computers.filter((c) => c.name !== action.name) }, "Delete Computer", action.name);
    case "MOVE_COMPUTER": {
      const computers = state.computers.map((c) => (c.name === action.name ? { ...c, ouPath: action.newOu } : c));
      return log({ ...state, computers }, "Move Computer", action.name, `to ${action.newOu}`);
    }

    case "ADD_GPO": {
      if (findGpo(state, action.gpo.name)) return state;
      return log({ ...state, gpos: [...state.gpos, action.gpo] }, "Create GPO", action.gpo.name);
    }
    case "UPDATE_GPO": {
      const gpos = state.gpos.map((g) => (g.name === action.name ? { ...g, ...action.patch, modified: new Date().toISOString() } : g));
      return log({ ...state, gpos }, "Modify GPO", action.name);
    }
    case "DELETE_GPO":
      return log({ ...state, gpos: state.gpos.filter((g) => g.name !== action.name || g.builtin) }, "Delete GPO", action.name);
    case "SET_GPO_POLICY": {
      const gpos = state.gpos.map((g) => {
        if (g.name !== action.gpoName) return g;
        const settings = { ...g.settings };
        if (action.value === "Not Configured") delete settings[action.path];
        else settings[action.path] = action.value;
        const version = action.path.startsWith("Computer/") ? { ...g.version, computer: g.version.computer + 1 } : { ...g.version, user: g.version.user + 1 };
        return { ...g, settings, version, modified: new Date().toISOString() };
      });
      return log({ ...state, gpos }, "Set policy", action.gpoName, `${action.path} = ${action.value}`);
    }
    case "LINK_GPO": {
      const g = findGpo(state, action.gpoName);
      if (!g || g.links.some((l) => l.ou === action.ou)) return state;
      const link: AddsGpoLink = { ou: action.ou, enforced: false, enabled: true };
      const gpos = state.gpos.map((x) => (x.name === action.gpoName ? { ...x, links: [...x.links, link] } : x));
      return log({ ...state, gpos }, "Link GPO", action.gpoName, `to ${action.ou || "domain root"}`);
    }
    case "UNLINK_GPO": {
      const gpos = state.gpos.map((g) => (g.name === action.gpoName ? { ...g, links: g.links.filter((l) => l.ou !== action.ou) } : g));
      return log({ ...state, gpos }, "Unlink GPO", action.gpoName, `from ${action.ou || "domain root"}`);
    }
    case "TOGGLE_GPO_LINK": {
      const gpos = state.gpos.map((g) =>
        g.name === action.gpoName ? { ...g, links: g.links.map((l) => (l.ou === action.ou ? { ...l, [action.field]: !l[action.field] } : l)) } : g,
      );
      return log({ ...state, gpos }, "Update GPO link", action.gpoName, action.field);
    }
    case "SET_GPO_SECURITY_FILTERING": {
      const gpos = state.gpos.map((g) => (g.name === action.gpoName ? { ...g, securityFiltering: action.principals } : g));
      return log({ ...state, gpos }, "Update security filtering", action.gpoName);
    }
    case "SET_GPO_WMI_FILTER": {
      const gpos = state.gpos.map((g) => (g.name === action.gpoName ? { ...g, wmiFilter: action.filterName } : g));
      return log({ ...state, gpos }, "Set WMI filter", action.gpoName, action.filterName || "(none)");
    }
    case "ADD_WMI_FILTER":
      return log({ ...state, wmiFilters: [...state.wmiFilters, { name: action.name, description: action.description, query: action.query }] }, "Create WMI Filter", action.name);
    case "BACKUP_ALL_GPOS": {
      const timestamp = new Date().toISOString();
      const backups = state.gpos.map((g) => ({ id: crypto.randomUUID(), gpoName: g.name, location: action.location, description: action.description, timestamp }));
      return log({ ...state, gpoBackups: [...backups, ...state.gpoBackups] }, "Back Up All GPOs", action.location, `${state.gpos.length} GPOs`);
    }

    case "ADD_ZONE": {
      if (findZone(state, action.zone.name)) return state;
      return log({ ...state, dnsZones: [...state.dnsZones, action.zone] }, "Create Zone", action.zone.name);
    }
    case "UPDATE_ZONE": {
      const dnsZones = state.dnsZones.map((z) => (z.name === action.name ? { ...z, ...action.patch } : z));
      return log({ ...state, dnsZones }, "Update Zone", action.name);
    }
    case "DELETE_ZONE":
      return log({ ...state, dnsZones: state.dnsZones.filter((z) => z.name !== action.name) }, "Delete Zone", action.name);
    case "ADD_RECORD": {
      const record = { ...action.record, timestamp: action.record.timestamp || new Date().toISOString() };
      const dnsZones = state.dnsZones.map((z) => (z.name === action.zoneName ? { ...z, records: [...z.records, record] } : z));
      return log({ ...state, dnsZones }, "Create DNS Record", action.zoneName, `${record.name} ${record.type} ${record.data}`);
    }
    case "DELETE_RECORD": {
      const zone = findZone(state, action.zoneName);
      const removed = zone?.records[action.index];
      const dnsZones = state.dnsZones.map((z) => (z.name === action.zoneName ? { ...z, records: z.records.filter((_, i) => i !== action.index) } : z));
      return log({ ...state, dnsZones }, "Delete DNS Record", action.zoneName, removed ? `${removed.name} ${removed.type}` : "");
    }
    case "UPDATE_RECORD": {
      const dnsZones = state.dnsZones.map((z) =>
        z.name === action.zoneName
          ? { ...z, records: z.records.map((r, i) => (i === action.index ? { ...r, ...action.patch, timestamp: new Date().toISOString() } : r)) }
          : z,
      );
      return log({ ...state, dnsZones }, "Update DNS Record", action.zoneName);
    }

    case "TRANSFER_FSMO_ROLE": {
      const targetFqdn = `${action.targetDc}.${state.domain.fqdn}`;
      const domain = { ...state.domain, [action.role]: targetFqdn };
      return log({ ...state, domain }, "Transfer FSMO role", String(action.role), `to ${action.targetDc}`);
    }
    case "SEIZE_FSMO_ROLE": {
      const targetFqdn = `${action.targetDc}.${state.domain.fqdn}`;
      const domain = { ...state.domain, [action.role]: targetFqdn };
      return log({ ...state, domain }, "Seize FSMO role", String(action.role), `by ${action.targetDc}`);
    }
    case "FORCE_REPLICATION": {
      const now = new Date().toISOString();
      const dcState = { ...state.dcState };
      const fromEntry = dcState[action.fromDc] ?? { usn: 0, lastSync: now };
      const toEntry = dcState[action.toDc] ?? { usn: 0, lastSync: now };
      dcState[action.fromDc] = { usn: fromEntry.usn + 1, lastSync: now };
      dcState[action.toDc] = { usn: toEntry.usn + 1, lastSync: now };
      const event = { time: now, source: action.fromDc, dest: action.toDc, message: "Replication completed successfully", level: "Information" as const };
      return log({ ...state, dcState, replicationEvents: [event, ...state.replicationEvents].slice(0, 100) }, "Force Replication", `${action.fromDc} -> ${action.toDc}`);
    }

    case "ADD_SITE": {
      if (state.sites.some((s) => s.name === action.site.name)) return state;
      return log({ ...state, sites: [...state.sites, action.site] }, "Create Site", action.site.name);
    }
    case "DELETE_SITE": {
      if (action.name === "Default-First-Site-Name") return state;
      if (state.domainControllers.some((dc) => dc.site === action.name)) return state;
      return log({ ...state, sites: state.sites.filter((s) => s.name !== action.name) }, "Delete Site", action.name);
    }
    case "ADD_SUBNET":
      return log({ ...state, subnetObjects: [...state.subnetObjects, action.subnet] }, "Create Subnet", action.subnet.prefix);
    case "ADD_SITE_LINK":
      return log({ ...state, siteLinks: [...state.siteLinks, action.link] }, "Create Site Link", action.link.name);
    case "ADD_CONNECTION_OBJECT":
      return log({ ...state, connectionObjects: [...state.connectionObjects, action.conn] }, "Create Connection Object", action.conn.name);

    case "SET_RECYCLE_BIN_ENABLED":
      if (state.recycleBinEnabled) return state;
      return log({ ...state, recycleBinEnabled: action.enabled }, "Enable AD Recycle Bin", state.domain.fqdn);
    case "RESTORE_RECYCLE_BIN_ITEM": {
      const item = state.recycleBin.find((r) => r.id === action.id);
      const recycleBin = state.recycleBin.map((r) => (r.id === action.id ? { ...r, restored: true } : r));
      return log({ ...state, recycleBin }, "Restore object", item?.name ?? action.id);
    }

    case "AAD_CONNECT_RUN_SYNC": {
      const now = new Date().toISOString();
      const next = new Date(Date.now() + state.aadConnect.syncIntervalMin * 60_000).toISOString();
      return log(
        { ...state, aadConnect: { ...state.aadConnect, lastRun: now, nextRun: next, syncedObjects: state.aadConnect.syncedObjects + Math.floor(Math.random() * 3) } },
        "Run sync now",
        "Microsoft Entra Connect",
      );
    }
    case "AAD_CONNECT_SET_STAGING":
      return log({ ...state, aadConnect: { ...state.aadConnect, stagingMode: action.staging } }, "Set staging mode", action.staging ? "Enabled" : "Disabled");

    case "BITLOCKER_RETRIEVE":
      return log({ ...state, tools: { ...state.tools, laps: state.tools.laps } }, "Retrieve BitLocker key", action.deviceName, `by ${action.retrievedBy}`);

    case "TOOLS_SERVICE_SET_STATUS": {
      const services = state.tools.services.map((s) => (s.name === action.name ? { ...s, status: action.status } : s));
      return log({ ...state, tools: { ...state.tools, services } }, action.status === "Running" ? "Start service" : "Stop service", action.name);
    }
    case "TOOLS_FIREWALL_TOGGLE": {
      const firewall = state.tools.firewall.map((f) => (f.name === action.name ? { ...f, enabled: !f.enabled } : f));
      return log({ ...state, tools: { ...state.tools, firewall } }, "Toggle firewall rule", action.name);
    }
    case "TOOLS_TASK_TOGGLE": {
      const taskScheduler = state.tools.taskScheduler.map((t) => (t.name === action.name ? { ...t, status: t.status === "Disabled" ? ("Ready" as const) : ("Disabled" as const) } : t));
      return log({ ...state, tools: { ...state.tools, taskScheduler } }, "Toggle scheduled task", action.name);
    }
    case "TOOLS_NPS_ADD_CLIENT": {
      if (state.tools.nps.clients.some((c) => c.name === action.client.name)) return state;
      const nps = { ...state.tools.nps, clients: [...state.tools.nps.clients, action.client] };
      return log({ ...state, tools: { ...state.tools, nps } }, "Add RADIUS client", action.client.name, action.client.ip);
    }

    default:
      return state;
  }
}
