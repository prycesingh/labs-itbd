import type { FortiCliAddress, FortiCliInterface, FortiCliPolicy, FortiCliRoute, FortiCliState } from "./cli-types";

// ===================================================================
// FortiGate engine — object-cursor config/edit/next/end parser.
//
// FortiOS has no privilege-escalation step (no `enable`) — exec and config
// share the same top-level prompt family, differentiated only by the cursor
// path. `config <block>` pushes a configPath; `edit <name>` stages a
// pendingEdit (from the existing object if found, else a fresh blank one);
// `set <field> <value>` mutates the staged pendingEdit; `next` commits it and
// stays in the block for another edit; `end` commits any pending edit and
// clears the cursor back to the top-level prompt.
// ===================================================================

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input.trim())) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

const CONFIG_BLOCKS: Record<string, string[]> = {
  "system interface": ["system", "interface"],
  "firewall policy": ["firewall", "policy"],
  "firewall address": ["firewall", "address"],
  "router static": ["router", "static"],
};

const CONFIG_BLOCK_KEYS = Object.keys(CONFIG_BLOCKS);

function blockPathFromArgs(args: string[]): string[] | null {
  const joined = args.join(" ");
  for (const key of CONFIG_BLOCK_KEYS) {
    if (key === joined || key.startsWith(joined)) {
      // only accept if joined is a real prefix match to a full known block
      if (joined.length > 0 && key.startsWith(joined)) return CONFIG_BLOCKS[key];
    }
  }
  return CONFIG_BLOCKS[joined] ?? null;
}

function pathLabel(configPath: string[]): string {
  if (configPath.length === 0) return "";
  const flat = configPath.join(" ");
  if (flat === "system interface") return "interface";
  if (flat === "firewall policy") return "policy";
  if (flat === "firewall address") return "address";
  if (flat === "router static") return "static";
  return configPath[configPath.length - 1];
}

export function getFortiPrompt(state: FortiCliState): string {
  const { cursor } = state;
  if (cursor.editTarget) return `FGT (${cursor.editTarget}) #`;
  if (cursor.configPath.length > 0) return `FGT (${pathLabel(cursor.configPath)}) #`;
  return "FGT #";
}

function blankObjectFor(configPath: string[], key: string): Record<string, unknown> {
  const flat = configPath.join(" ");
  if (flat === "system interface") {
    return { name: key, ip: "0.0.0.0", mask: "0.0.0.0", status: "down", alias: "" };
  }
  if (flat === "firewall policy") {
    const idNum = Number(key);
    return {
      id: Number.isNaN(idNum) ? 0 : idNum,
      srcintf: "any",
      dstintf: "any",
      srcaddr: "all",
      dstaddr: "all",
      service: "ALL",
      action: "deny",
      status: "enable",
    };
  }
  if (flat === "firewall address") {
    return { name: key, subnet: "0.0.0.0/0" };
  }
  if (flat === "router static") {
    return { dst: "0.0.0.0/0", gateway: "0.0.0.0", device: key };
  }
  return { name: key };
}

function findExisting(state: FortiCliState, configPath: string[], key: string): Record<string, unknown> | null {
  const flat = configPath.join(" ");
  if (flat === "system interface") {
    const found = state.interfaces.find((i) => i.name === key);
    return found ? { ...found } : null;
  }
  if (flat === "firewall policy") {
    const found = state.policies.find((p) => String(p.id) === key);
    return found ? { ...found } : null;
  }
  if (flat === "firewall address") {
    const found = state.addresses.find((a) => a.name === key);
    return found ? { ...found } : null;
  }
  if (flat === "router static") {
    const found = state.routes.find((r) => r.device === key);
    return found ? { ...found } : null;
  }
  return null;
}

function commitEdit(state: FortiCliState): FortiCliState {
  const { cursor, pendingEdit } = state;
  if (!pendingEdit || !cursor.editTarget) return state;
  const flat = cursor.configPath.join(" ");
  const key = cursor.editTarget;

  if (flat === "system interface") {
    const obj = pendingEdit as unknown as FortiCliInterface;
    const exists = state.interfaces.some((i) => i.name === key);
    const interfaces = exists
      ? state.interfaces.map((i) => (i.name === key ? { ...obj, name: key } : i))
      : [...state.interfaces, { ...obj, name: key }];
    return { ...state, interfaces };
  }
  if (flat === "firewall policy") {
    const obj = pendingEdit as unknown as FortiCliPolicy;
    const idNum = Number(key);
    const exists = state.policies.some((p) => p.id === idNum);
    const policies = exists
      ? state.policies.map((p) => (p.id === idNum ? { ...obj, id: idNum } : p))
      : [...state.policies, { ...obj, id: idNum }];
    return { ...state, policies };
  }
  if (flat === "firewall address") {
    const obj = pendingEdit as unknown as FortiCliAddress;
    const exists = state.addresses.some((a) => a.name === key);
    const addresses = exists
      ? state.addresses.map((a) => (a.name === key ? { ...obj, name: key } : a))
      : [...state.addresses, { ...obj, name: key }];
    return { ...state, addresses };
  }
  if (flat === "router static") {
    const obj = pendingEdit as unknown as FortiCliRoute;
    const exists = state.routes.some((r) => r.device === key);
    const routes = exists
      ? state.routes.map((r) => (r.device === key ? { ...obj, device: key } : r))
      : [...state.routes, { ...obj, device: key }];
    return { ...state, routes };
  }
  return state;
}

function renderShow(state: FortiCliState): string[] {
  const { cursor } = state;
  const flat = cursor.configPath.join(" ");
  if (cursor.editTarget && state.pendingEdit) {
    return Object.entries(state.pendingEdit).map(([k, v]) => `    set ${k} ${v}`);
  }
  if (flat === "system interface") {
    return state.interfaces.flatMap((i) => [
      `edit "${i.name}"`,
      `    set ip ${i.ip} ${i.mask}`,
      `    set status ${i.status}`,
      `    set alias "${i.alias}"`,
      "next",
    ]);
  }
  if (flat === "firewall policy") {
    return state.policies.flatMap((p) => [
      `edit ${p.id}`,
      `    set srcintf "${p.srcintf}"`,
      `    set dstintf "${p.dstintf}"`,
      `    set action ${p.action}`,
      `    set status ${p.status}`,
      "next",
    ]);
  }
  if (flat === "firewall address") {
    return state.addresses.flatMap((a) => [`edit "${a.name}"`, `    set subnet ${a.subnet}`, "next"]);
  }
  if (flat === "router static") {
    return state.routes.flatMap((r) => [`edit "${r.device}"`, `    set dst ${r.dst}`, `    set gateway ${r.gateway}`, "next"]);
  }
  return ["config-version=FGT-7.2.5", `hostname : ${state.hostname}`];
}

export function execFortiCommand(
  state: FortiCliState,
  input: string,
): { state: FortiCliState; output: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { state, output: [] };
  const tokens = tokenize(trimmed);
  const cmd = tokens[0]?.toLowerCase();

  if (cmd === "config") {
    const path = blockPathFromArgs(tokens.slice(1));
    if (!path) return { state, output: [`Unknown action 0 for object ${tokens.slice(1).join(" ")}`] };
    return { state: { ...state, cursor: { configPath: path, editTarget: null }, pendingEdit: null }, output: [] };
  }

  if (cmd === "edit") {
    if (state.cursor.configPath.length === 0) {
      return { state, output: ["% command parse error before 'edit'"] };
    }
    const key = tokens.slice(1).join(" ").replace(/^"|"$/g, "");
    if (!key) return { state, output: ["% Incomplete command."] };
    const existing = findExisting(state, state.cursor.configPath, key);
    const pendingEdit = existing ?? blankObjectFor(state.cursor.configPath, key);
    return {
      state: { ...state, cursor: { ...state.cursor, editTarget: key }, pendingEdit },
      output: [],
    };
  }

  if (cmd === "set") {
    if (!state.pendingEdit) return { state, output: ["% command parse error before 'set'"] };
    const field = tokens[1];
    const value = tokens.slice(2).join(" ");
    if (!field) return { state, output: ["% Incomplete command."] };
    return { state: { ...state, pendingEdit: { ...state.pendingEdit, [field]: value } }, output: [] };
  }

  if (cmd === "next") {
    const committed = commitEdit(state);
    return { state: { ...committed, cursor: { ...committed.cursor, editTarget: null }, pendingEdit: null }, output: [] };
  }

  if (cmd === "end") {
    const committed = commitEdit(state);
    return { state: { ...committed, cursor: { configPath: [], editTarget: null }, pendingEdit: null }, output: [] };
  }

  if (cmd === "get") {
    const sub = tokens.slice(1).join(" ");
    if (sub === "system status") {
      return {
        state,
        output: [
          "Version: FortiGate-60F v7.2.5, build1517",
          `Hostname: ${state.hostname}`,
          "Uptime: 21 days, 6 hours, 12 minutes",
        ],
      };
    }
    if (sub === "system interface") {
      return {
        state,
        output: state.interfaces.map((i) => `name: ${i.name.padEnd(8)} status: ${i.status.padEnd(6)} ip: ${i.ip}/${i.mask}  alias: ${i.alias}`),
      };
    }
    if (sub === "router info routing-table all") {
      return {
        state,
        output: state.routes.map((r) =>
          r.dst === "0.0.0.0/0" ? `S    ${r.dst} [10/0] via ${r.gateway}, ${r.device}` : `C    ${r.dst} is directly connected, ${r.device}`,
        ),
      };
    }
    if (sub === "firewall policy") {
      const header = "id  name       from    to      source      destination  action";
      const rows = state.policies.map(
        (p) => `${String(p.id).padEnd(3)} ${("policy" + p.id).padEnd(10)} ${p.srcintf.padEnd(7)} ${p.dstintf.padEnd(7)} ${p.srcaddr.padEnd(11)} ${p.dstaddr.padEnd(12)} ${p.action.toUpperCase()}`,
      );
      return { state, output: [header, ...rows] };
    }
    return { state, output: [`command parse error before '${sub}'`] };
  }

  if (cmd === "show") {
    return { state, output: renderShow(state) };
  }

  if (cmd === "help" || cmd === "?") {
    const words =
      state.cursor.editTarget
        ? ["set <field> <value>", "next", "end"]
        : state.cursor.configPath.length > 0
          ? ["edit <name>", "next", "end", "show"]
          : ["config system interface", "config firewall policy", "config firewall address", "config router static", "get system status", "get system interface", "get router info routing-table all", "get firewall policy", "show", "help"];
    return { state, output: [`Available: ${words.join(", ")}`] };
  }

  return { state, output: [`Unknown action 0 for object ${trimmed}`] };
}

export function getFortiSuggestions(state: FortiCliState, partial: string): string[] {
  const tokens = tokenize(partial);
  const last = (tokens[tokens.length - 1] ?? "").toLowerCase();

  if (state.cursor.editTarget) {
    const opts = ["set", "next", "end"];
    return tokens.length <= 1 ? opts.filter((o) => o.startsWith(last)) : [];
  }
  if (state.cursor.configPath.length > 0) {
    const opts = ["edit", "next", "end", "show"];
    return tokens.length <= 1 ? opts.filter((o) => o.startsWith(last)) : [];
  }
  const topLevel = ["config", "get", "show", "help"];
  if (tokens.length <= 1) return topLevel.filter((o) => o.startsWith(last));
  if (tokens[0]?.toLowerCase() === "config") {
    return CONFIG_BLOCK_KEYS.filter((k) => k.startsWith(tokens.slice(1).join(" ")));
  }
  return [];
}
