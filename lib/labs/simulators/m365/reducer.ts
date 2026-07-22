import type {
  M365Domain,
  M365DistributionGroup,
  M365Group,
  M365License,
  M365Mailbox,
  M365MeetingPolicy,
  M365SharedMailbox,
  M365SharepointSite,
  M365State,
  M365Team,
  M365TeamsPolicy,
  M365TransportRule,
  M365User,
} from "./types";

function log(state: M365State, actor: string, action: string, target: string): M365State {
  const entry = { time: new Date().toISOString(), actor, action, target };
  return { ...state, activityLog: [entry, ...state.activityLog].slice(0, 200) };
}

export type M365Action =
  | { type: "LOAD_STATE"; state: M365State }
  | { type: "ADD_USER"; user: M365User }
  | { type: "UPDATE_USER"; id: string; patch: Partial<M365User> }
  | { type: "DELETE_USER"; id: string }
  | { type: "RESTORE_USER"; id: string }
  | { type: "SET_USER_ENABLED"; ids: string[]; enabled: boolean }
  | { type: "SET_USER_MFA"; ids: string[]; enabled: boolean }
  | { type: "RESET_USER_PASSWORD"; ids: string[] }
  | { type: "ASSIGN_LICENSES"; ids: string[]; skus: string[]; assign: boolean }
  | { type: "ASSIGN_ROLES"; ids: string[]; roles: string[]; assign: boolean }
  | { type: "ADD_GROUP"; group: M365Group }
  | { type: "UPDATE_GROUP"; id: string; patch: Partial<M365Group> }
  | { type: "DELETE_GROUP"; id: string }
  | { type: "ADD_SHARED_MAILBOX"; mailbox: M365SharedMailbox }
  | { type: "ADD_SEATS"; sku: string; count: number }
  | { type: "SET_LICENSE_RENEWAL"; sku: string; renewalMode: M365License["renewalMode"] }
  | { type: "CANCEL_LICENSE"; sku: string }
  | { type: "BUY_LICENSE"; sku: string; name: string; seats: number; monthly: number }
  | { type: "ADD_DOMAIN"; domain: M365Domain }
  | { type: "SET_DEFAULT_DOMAIN"; name: string }
  | { type: "REMOVE_DOMAIN"; name: string }
  | { type: "SET_DOMAIN_PURPOSE"; name: string; purpose: Partial<M365Domain["purpose"]> }
  | { type: "SET_DOMAIN_DNS_MANAGEMENT"; name: string; dnsManagement: M365Domain["dnsManagement"] }
  | { type: "CHECK_DOMAIN_HEALTH"; name: string }
  | { type: "ADD_TEAM"; team: M365Team }
  | { type: "UPDATE_TEAM"; id: string; patch: Partial<M365Team> }
  | { type: "DELETE_TEAM"; id: string }
  | { type: "ADD_TEAMS_POLICY"; policy: M365TeamsPolicy }
  | { type: "DELETE_TEAMS_POLICY"; name: string }
  | { type: "ASSIGN_TEAMS_POLICY"; usernames: string[]; policyName: string }
  | { type: "ADD_MEETING_POLICY"; policy: M365MeetingPolicy }
  | { type: "DELETE_MEETING_POLICY"; name: string }
  | { type: "UPDATE_TEAMS_ORG_SETTINGS"; patch: Partial<M365State["teamsOrgSettings"]> }
  | { type: "ADD_SHAREPOINT_SITE"; site: M365SharepointSite }
  | { type: "UPDATE_SHAREPOINT_SITE"; id: string; patch: Partial<M365SharepointSite> }
  | { type: "DELETE_SHAREPOINT_SITE"; id: string }
  | { type: "UPDATE_SHAREPOINT_SETTINGS"; patch: Partial<M365State["sharepointSettings"]> }
  | { type: "ADD_TRANSPORT_RULE"; rule: M365TransportRule }
  | { type: "UPDATE_TRANSPORT_RULE"; id: string; patch: Partial<M365TransportRule> }
  | { type: "DELETE_TRANSPORT_RULE"; id: string }
  | { type: "ADD_MAILBOX_FROM_USER"; username: string; displayName: string; email: string }
  | { type: "UPDATE_MAILBOX"; user: string; patch: Partial<M365Mailbox> }
  | { type: "ADD_DISTRIBUTION_GROUP"; group: M365DistributionGroup }
  | { type: "UPDATE_OFFICE_DEPLOY"; patch: Partial<M365State["officeDeploy"]> };

const ACTOR = "admin@cloudlab.onmicrosoft.com";

export function m365Reducer(state: M365State, action: M365Action): M365State {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "ADD_USER": {
      if (state.users.some((u) => u.id === action.user.id)) return state;
      return log({ ...state, users: [...state.users, action.user] }, ACTOR, "Created user", action.user.displayName);
    }
    case "UPDATE_USER": {
      const users = state.users.map((u) => (u.id === action.id ? { ...u, ...action.patch } : u));
      return log({ ...state, users }, ACTOR, "Updated user", action.id);
    }
    case "DELETE_USER": {
      const user = state.users.find((u) => u.id === action.id);
      if (!user) return state;
      const users = state.users.filter((u) => u.id !== action.id);
      const deletedUsers = [{ ...user, deletedOn: new Date().toISOString() }, ...state.deletedUsers];
      return log({ ...state, users, deletedUsers }, ACTOR, "Deleted user", user.displayName);
    }
    case "RESTORE_USER": {
      const user = state.deletedUsers.find((u) => u.id === action.id);
      if (!user) return state;
      const deletedUsers = state.deletedUsers.filter((u) => u.id !== action.id);
      const { deletedOn, ...restored } = user;
      void deletedOn;
      return log({ ...state, users: [...state.users, restored], deletedUsers }, ACTOR, "Restored user", user.displayName);
    }
    case "SET_USER_ENABLED": {
      const users = state.users.map((u) => (action.ids.includes(u.id) ? { ...u, accountEnabled: action.enabled, signInBlocked: !action.enabled } : u));
      return log({ ...state, users }, ACTOR, action.enabled ? "Enabled sign-in" : "Blocked sign-in", `${action.ids.length} user(s)`);
    }
    case "SET_USER_MFA": {
      const users = state.users.map((u) => (action.ids.includes(u.id) ? { ...u, mfaEnabled: action.enabled } : u));
      return log({ ...state, users }, ACTOR, action.enabled ? "Enabled MFA" : "Disabled MFA", `${action.ids.length} user(s)`);
    }
    case "RESET_USER_PASSWORD":
      return log(state, ACTOR, "Reset password", `${action.ids.length} user(s)`);
    case "ASSIGN_LICENSES": {
      const users = state.users.map((u) => {
        if (!action.ids.includes(u.id)) return u;
        const licenses = action.assign ? Array.from(new Set([...u.licenses, ...action.skus])) : u.licenses.filter((s) => !action.skus.includes(s));
        return { ...u, licenses };
      });
      return log({ ...state, users }, ACTOR, action.assign ? "Assigned licenses" : "Removed licenses", `${action.ids.length} user(s)`);
    }
    case "ASSIGN_ROLES": {
      const users = state.users.map((u) => {
        if (!action.ids.includes(u.id)) return u;
        const roles = action.assign ? Array.from(new Set([...u.roles, ...action.roles])) : u.roles.filter((r) => !action.roles.includes(r));
        return { ...u, roles: roles.length ? roles : ["User"] };
      });
      return log({ ...state, users }, ACTOR, action.assign ? "Assigned roles" : "Removed roles", `${action.ids.length} user(s)`);
    }

    case "ADD_GROUP": {
      if (state.groups.some((g) => g.id === action.group.id)) return state;
      return log({ ...state, groups: [...state.groups, action.group] }, ACTOR, "Created group", action.group.name);
    }
    case "UPDATE_GROUP": {
      const groups = state.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g));
      return log({ ...state, groups }, ACTOR, "Updated group", action.id);
    }
    case "DELETE_GROUP": {
      const g = state.groups.find((x) => x.id === action.id);
      return log({ ...state, groups: state.groups.filter((x) => x.id !== action.id) }, ACTOR, "Deleted group", g?.name ?? action.id);
    }
    case "ADD_SHARED_MAILBOX":
      return log({ ...state, sharedMailboxes: [...state.sharedMailboxes, action.mailbox] }, ACTOR, "Created shared mailbox", action.mailbox.displayName);

    case "ADD_SEATS": {
      const licenses = state.licenses.map((l) => (l.sku === action.sku ? { ...l, purchased: l.purchased + action.count } : l));
      return log({ ...state, licenses }, ACTOR, `Added ${action.count} seats`, action.sku);
    }
    case "SET_LICENSE_RENEWAL": {
      const licenses = state.licenses.map((l) => (l.sku === action.sku ? { ...l, renewalMode: action.renewalMode } : l));
      return log({ ...state, licenses }, ACTOR, "Changed renewal setting", action.sku);
    }
    case "CANCEL_LICENSE": {
      const licenses = state.licenses.map((l) => (l.sku === action.sku ? { ...l, status: "Cancelled" as const } : l));
      return log({ ...state, licenses }, ACTOR, "Cancelled subscription", action.sku);
    }
    case "BUY_LICENSE": {
      const existing = state.licenses.find((l) => l.sku === action.sku);
      const licenses = existing
        ? state.licenses.map((l) => (l.sku === action.sku ? { ...l, purchased: l.purchased + action.seats, status: "Active" as const } : l))
        : [
            ...state.licenses,
            {
              sku: action.sku,
              name: action.name,
              purchased: action.seats,
              monthly: action.monthly,
              status: "Active" as const,
              purchaseDate: new Date().toISOString().slice(0, 10),
              renewalDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
              billingCycle: "Annual" as const,
              renewalMode: "Auto-renew" as const,
            },
          ];
      return log({ ...state, licenses }, ACTOR, "Purchased license", `${action.name} x${action.seats}`);
    }

    case "ADD_DOMAIN": {
      if (state.domains.some((d) => d.name === action.domain.name)) return state;
      return log({ ...state, domains: [...state.domains, action.domain] }, ACTOR, "Added domain", action.domain.name);
    }
    case "SET_DEFAULT_DOMAIN": {
      const domains = state.domains.map((d) => ({ ...d, isDefault: d.name === action.name }));
      return log({ ...state, domains }, ACTOR, "Set default domain", action.name);
    }
    case "REMOVE_DOMAIN": {
      const target = state.domains.find((d) => d.name === action.name);
      if (!target || target.isDefault || target.name.endsWith(".onmicrosoft.com")) return state;
      return log({ ...state, domains: state.domains.filter((d) => d.name !== action.name) }, ACTOR, "Removed domain", action.name);
    }
    case "SET_DOMAIN_PURPOSE": {
      const domains = state.domains.map((d) => (d.name === action.name ? { ...d, purpose: { ...d.purpose, ...action.purpose } } : d));
      return log({ ...state, domains }, ACTOR, "Updated domain purpose", action.name);
    }
    case "SET_DOMAIN_DNS_MANAGEMENT": {
      const domains = state.domains.map((d) => (d.name === action.name ? { ...d, dnsManagement: action.dnsManagement } : d));
      return log({ ...state, domains }, ACTOR, "Changed DNS management", action.name);
    }
    case "CHECK_DOMAIN_HEALTH": {
      const domains = state.domains.map((d) => (d.name === action.name ? { ...d, status: "Healthy" as const, verified: true } : d));
      return log({ ...state, domains }, ACTOR, "Checked domain health", action.name);
    }

    case "ADD_TEAM": {
      if (state.teams.some((t) => t.id === action.team.id)) return state;
      return log({ ...state, teams: [...state.teams, action.team] }, ACTOR, "Created team", action.team.name);
    }
    case "UPDATE_TEAM": {
      const teams = state.teams.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t));
      return log({ ...state, teams }, ACTOR, "Updated team", action.id);
    }
    case "DELETE_TEAM": {
      const t = state.teams.find((x) => x.id === action.id);
      return log({ ...state, teams: state.teams.filter((x) => x.id !== action.id) }, ACTOR, "Deleted team", t?.name ?? action.id);
    }
    case "ADD_TEAMS_POLICY":
      return log({ ...state, teamsPolicies: [...state.teamsPolicies, action.policy] }, ACTOR, "Created Teams policy", action.policy.name);
    case "DELETE_TEAMS_POLICY": {
      if (action.name.startsWith("Global")) return state;
      return log({ ...state, teamsPolicies: state.teamsPolicies.filter((p) => p.name !== action.name) }, ACTOR, "Deleted Teams policy", action.name);
    }
    case "ASSIGN_TEAMS_POLICY":
      return log(state, ACTOR, `Assigned Teams policy "${action.policyName}"`, `${action.usernames.length} user(s)`);
    case "ADD_MEETING_POLICY":
      return log({ ...state, teamsMeetingPolicies: [...state.teamsMeetingPolicies, action.policy] }, ACTOR, "Created meeting policy", action.policy.name);
    case "DELETE_MEETING_POLICY": {
      if (action.name === "Global") return state;
      return log({ ...state, teamsMeetingPolicies: state.teamsMeetingPolicies.filter((p) => p.name !== action.name) }, ACTOR, "Deleted meeting policy", action.name);
    }
    case "UPDATE_TEAMS_ORG_SETTINGS":
      return log({ ...state, teamsOrgSettings: { ...state.teamsOrgSettings, ...action.patch } }, ACTOR, "Updated Teams org settings", "");

    case "ADD_SHAREPOINT_SITE": {
      if (state.sharepointSites.some((s) => s.id === action.site.id)) return state;
      return log({ ...state, sharepointSites: [...state.sharepointSites, action.site] }, ACTOR, "Created site", action.site.name);
    }
    case "UPDATE_SHAREPOINT_SITE": {
      const sharepointSites = state.sharepointSites.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s));
      return log({ ...state, sharepointSites }, ACTOR, "Updated site", action.id);
    }
    case "DELETE_SHAREPOINT_SITE": {
      const site = state.sharepointSites.find((s) => s.id === action.id);
      if (!site) return state;
      const sharepointSites = state.sharepointSites.filter((s) => s.id !== action.id);
      const deletedSites = [{ ...site, deletedOn: new Date().toISOString() }, ...state.deletedSites];
      return log({ ...state, sharepointSites, deletedSites }, ACTOR, "Deleted site", site.name);
    }
    case "UPDATE_SHAREPOINT_SETTINGS":
      return log({ ...state, sharepointSettings: { ...state.sharepointSettings, ...action.patch } }, ACTOR, "Updated SharePoint settings", "");

    case "ADD_TRANSPORT_RULE": {
      const transportRules = [...state.exchange.transportRules, action.rule];
      return log({ ...state, exchange: { ...state.exchange, transportRules } }, ACTOR, "Created mail flow rule", action.rule.name);
    }
    case "UPDATE_TRANSPORT_RULE": {
      const transportRules = state.exchange.transportRules.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r));
      return log({ ...state, exchange: { ...state.exchange, transportRules } }, ACTOR, "Updated mail flow rule", action.id);
    }
    case "DELETE_TRANSPORT_RULE": {
      const r = state.exchange.transportRules.find((x) => x.id === action.id);
      const transportRules = state.exchange.transportRules.filter((x) => x.id !== action.id);
      return log({ ...state, exchange: { ...state.exchange, transportRules } }, ACTOR, "Deleted mail flow rule", r?.name ?? action.id);
    }
    case "ADD_MAILBOX_FROM_USER": {
      if (state.exchange.mailboxes.some((m) => m.user === action.username)) return state;
      const mailbox = {
        user: action.username,
        email: action.email,
        displayName: action.displayName,
        type: "User mailbox" as const,
        sizeMB: 0,
        quotaGB: 50,
        archive: false,
        forwarding: "",
        litigationHold: false,
      };
      return log({ ...state, exchange: { ...state.exchange, mailboxes: [...state.exchange.mailboxes, mailbox] } }, ACTOR, "Created mailbox", action.displayName);
    }
    case "UPDATE_MAILBOX": {
      const mailboxes = state.exchange.mailboxes.map((m) => (m.user === action.user ? { ...m, ...action.patch } : m));
      return log({ ...state, exchange: { ...state.exchange, mailboxes } }, ACTOR, "Updated mailbox", action.user);
    }
    case "ADD_DISTRIBUTION_GROUP": {
      if (state.exchange.distributionGroups.some((g) => g.name === action.group.name)) return state;
      const distributionGroups = [...state.exchange.distributionGroups, action.group];
      return log({ ...state, exchange: { ...state.exchange, distributionGroups } }, ACTOR, "Created mail flow group", action.group.name);
    }

    case "UPDATE_OFFICE_DEPLOY":
      return log({ ...state, officeDeploy: { ...state.officeDeploy, ...action.patch } }, ACTOR, "Updated Office deployment config", "");

    default:
      return state;
  }
}
