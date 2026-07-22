import type { EditPathCliInterface, EditPathCliState } from "./cli-types";

// ===================================================================
// Shared Juniper JunOS / Palo Alto PAN-OS engine — both vendors use the same
// operational/configuration split with an `[edit ...]` hierarchy path and a
// stage-then-commit model (`set`/`delete` flip `pendingChanges`; `commit`
// applies and clears it). Parsing logic is shared; only prompt strings and a
// handful of path vocab differ, parameterized by `vendor`.
//
// `mode` ("operational" | "configuration") was added to EditPathCliState
// (see cli-types.ts) because `editPath` alone can't distinguish operational
// mode from configuration-mode-at-the-top (`editPath === []` after `top`).
// ===================================================================

export type EditPathVendor = "juniper" | "paloalto";

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input.trim())) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

function findIface(state: EditPathCliState, name: string): EditPathCliInterface | undefined {
  return state.interfaces.find((i) => i.name === name);
}

// ---- pragmatic `set`/`delete` path pattern-matching ----------------------
// Supports the realistic handful of paths called out in the task:
//   interfaces <name> unit <n> family inet address <cidr>   (Juniper)
//   network interface <name> ip <cidr>                       (Palo Alto)
//   interfaces <name> disable / interfaces <name> enable
//   security-zone <zone> interfaces <name>  (Juniper zone membership)
//   zone <zone> network layer3 <name>        (Palo Alto zone membership)
//   routing-options static route <dst> next-hop <gw>  (Juniper)
//   static-route <name> destination <dst> nexthop ip-address <gw>  (Palo Alto)
//   security policies from-zone <a> to-zone <b> rule <name> ... (both, pragmatic)

function applySetPath(state: EditPathCliState, vendor: EditPathVendor, path: string[]): EditPathCliState {
  const full = [...state.editPath, ...path];

  // Interface IP address.
  if (vendor === "juniper" && full[0] === "interfaces") {
    const name = full[1];
    const familyIdx = full.indexOf("address");
    if (name && familyIdx !== -1 && full[familyIdx + 1]) {
      const ip = full[familyIdx + 1];
      const interfaces = state.interfaces.map((i) => (i.name === name ? { ...i, ip } : i));
      return { ...state, interfaces, pendingChanges: true };
    }
    if (name && full[2] === "disable") {
      const interfaces = state.interfaces.map((i) => (i.name === name ? { ...i, adminUp: false } : i));
      return { ...state, interfaces, pendingChanges: true };
    }
    if (name && full[2] === "enable") {
      const interfaces = state.interfaces.map((i) => (i.name === name ? { ...i, adminUp: true } : i));
      return { ...state, interfaces, pendingChanges: true };
    }
  }
  if (vendor === "paloalto" && full[0] === "network" && full[1] === "interface") {
    const name = full[2];
    const ipIdx = full.indexOf("ip");
    if (name && ipIdx !== -1 && full[ipIdx + 1]) {
      const ip = full[ipIdx + 1];
      const interfaces = state.interfaces.map((i) => (i.name === name ? { ...i, ip } : i));
      return { ...state, interfaces, pendingChanges: true };
    }
  }

  // Zone membership.
  if (vendor === "juniper" && full[0] === "security-zones" && full[2] === "interfaces") {
    const zoneName = full[1];
    const ifaceName = full[3];
    if (zoneName && ifaceName) {
      const zones = state.zones.map((z) =>
        z.name === zoneName && !z.interfaces.includes(ifaceName)
          ? { ...z, interfaces: [...z.interfaces, ifaceName] }
          : z,
      );
      const interfaces = state.interfaces.map((i) => (i.name === ifaceName ? { ...i, zone: zoneName } : i));
      return { ...state, zones, interfaces, pendingChanges: true };
    }
  }
  if (vendor === "paloalto" && full[0] === "zone") {
    const zoneName = full[1];
    const l3Idx = full.indexOf("layer3");
    const ifaceName = l3Idx !== -1 ? full[l3Idx + 1] : undefined;
    if (zoneName && ifaceName) {
      const zones = state.zones.map((z) =>
        z.name === zoneName && !z.interfaces.includes(ifaceName)
          ? { ...z, interfaces: [...z.interfaces, ifaceName] }
          : z,
      );
      const interfaces = state.interfaces.map((i) => (i.name === ifaceName ? { ...i, zone: zoneName } : i));
      return { ...state, zones, interfaces, pendingChanges: true };
    }
  }

  // Static routes.
  if (vendor === "juniper" && full[0] === "routing-options" && full[1] === "static" && full[2] === "route") {
    const dst = full[3];
    const nhIdx = full.indexOf("next-hop");
    const nextHop = nhIdx !== -1 ? full[nhIdx + 1] : undefined;
    if (dst && nextHop) {
      const exists = state.routes.some((r) => r.dst === dst);
      const routes = exists
        ? state.routes.map((r) => (r.dst === dst ? { dst, nextHop } : r))
        : [...state.routes, { dst, nextHop }];
      return { ...state, routes, pendingChanges: true };
    }
  }
  if (vendor === "paloalto" && full[0] === "static-route") {
    const name = full[1];
    const destIdx = full.indexOf("destination");
    const nhIdx = full.indexOf("ip-address");
    const dst = destIdx !== -1 ? full[destIdx + 1] : undefined;
    const nextHop = nhIdx !== -1 ? full[nhIdx + 1] : undefined;
    if (name && dst && nextHop) {
      const exists = state.routes.some((r) => r.dst === dst);
      const routes = exists
        ? state.routes.map((r) => (r.dst === dst ? { dst, nextHop } : r))
        : [...state.routes, { dst, nextHop }];
      return { ...state, routes, pendingChanges: true };
    }
  }

  // Security policy / rule fields (pragmatic subset: action only).
  if (full[0] === "security" && (full[1] === "policies" || full[1] === "policy")) {
    const ruleIdx = full.indexOf("rule");
    const actionIdx = full.indexOf("action") !== -1 ? full.indexOf("action") : full.indexOf("then");
    const ruleName = ruleIdx !== -1 ? full[ruleIdx + 1] : undefined;
    const action = actionIdx !== -1 ? (full[actionIdx + 1] as "permit" | "deny") : undefined;
    if (ruleName && action) {
      const exists = state.securityRules.some((r) => r.name === ruleName);
      const securityRules = exists
        ? state.securityRules.map((r) => (r.name === ruleName ? { ...r, action } : r))
        : [
            ...state.securityRules,
            { name: ruleName, fromZone: "any", toZone: "any", source: "any", destination: "any", application: "any", action },
          ];
      return { ...state, securityRules, pendingChanges: true };
    }
  }

  // Unrecognized path — still flip pendingChanges (matches the "set on any
  // path stages a change" contract) but leaves state otherwise untouched.
  return { ...state, pendingChanges: true };
}

function applyDeletePath(state: EditPathCliState, path: string[]): EditPathCliState {
  const full = [...state.editPath, ...path];
  if (full[0] === "interfaces" || full[0] === "network") {
    return { ...state, pendingChanges: true };
  }
  if (full[0] === "routing-options" || full[0] === "static-route") {
    const dst = full[0] === "routing-options" ? full[3] : undefined;
    if (dst) return { ...state, routes: state.routes.filter((r) => r.dst !== dst), pendingChanges: true };
  }
  return { ...state, pendingChanges: true };
}

function renderEditBanner(editPath: string[]): string[] {
  if (editPath.length === 0) return [];
  return [`[edit ${editPath.join(" ")}]`];
}

export function getEditPathPrompt(
  state: EditPathCliState,
  vendor: EditPathVendor,
): string {
  const opPrompt = vendor === "juniper" ? `user@${state.hostname}> ` : `admin@${state.hostname}> `;
  const cfgPrompt = vendor === "juniper" ? `user@${state.hostname}# ` : `admin@${state.hostname}# `;
  if (state.mode === "operational") return opPrompt.trimEnd();
  const banner = renderEditBanner(state.editPath);
  const prompt = cfgPrompt.trimEnd();
  return banner.length ? `${banner.join("\n")}\n${prompt}` : prompt;
}

function renderShow(state: EditPathCliState): string[] {
  const path = state.editPath;
  if (path.length === 0) {
    const lines: string[] = [];
    lines.push("interfaces {");
    for (const i of state.interfaces) {
      lines.push(`    ${i.name} { unit ${i.unit} { family inet { address ${i.ip}; } } } # ${i.adminUp ? "enabled" : "disabled"}`);
    }
    lines.push("}");
    lines.push("routing-options {");
    for (const r of state.routes) lines.push(`    static { route ${r.dst} next-hop ${r.nextHop}; }`);
    lines.push("}");
    return lines;
  }
  if (path[0] === "interfaces" && path[1]) {
    const iface = findIface(state, path[1]);
    if (!iface) return ["error: no such interface"];
    return [`unit ${iface.unit} {`, `    family inet {`, `        address ${iface.ip};`, `    }`, `}`];
  }
  return [`# ${path.join(" ")}`];
}

export function execEditPathCommand(
  state: EditPathCliState,
  input: string,
  vendor: EditPathVendor,
): { state: EditPathCliState; output: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { state, output: [] };
  const tokens = tokenize(trimmed);
  const cmd = tokens[0]?.toLowerCase();

  if (cmd === "configure") {
    if (state.mode === "configuration") return { state, output: ["Entering configuration mode"] };
    return { state: { ...state, mode: "configuration" }, output: ["Entering configuration mode", ...renderEditBanner(state.editPath)] };
  }

  if (state.mode === "operational") {
    if (cmd === "show") {
      return { state, output: renderShow(state) };
    }
    if (cmd === "help" || cmd === "?") {
      return { state, output: ["Available: configure, show, help"] };
    }
    return { state, output: [`Unknown command: "${trimmed}"`] };
  }

  // configuration mode
  if (cmd === "set") {
    const next = applySetPath(state, vendor, tokens.slice(1));
    return { state: next, output: [] };
  }
  if (cmd === "delete") {
    const next = applyDeletePath(state, tokens.slice(1));
    return { state: next, output: [] };
  }
  if (cmd === "edit") {
    return { state: { ...state, editPath: [...state.editPath, ...tokens.slice(1)] }, output: [] };
  }
  if (cmd === "up") {
    return { state: { ...state, editPath: state.editPath.slice(0, -1) }, output: [] };
  }
  if (cmd === "top") {
    return { state: { ...state, editPath: [] }, output: [] };
  }
  if (cmd === "show") {
    return { state, output: renderShow(state) };
  }
  if (cmd === "exit") {
    if (state.editPath.length > 0) {
      return { state: { ...state, editPath: state.editPath.slice(0, -1) }, output: [] };
    }
    if (state.pendingChanges) {
      return {
        state: { ...state, mode: "operational" },
        output: [
          vendor === "juniper"
            ? "warning: uncommitted changes will be discarded on exit"
            : "Configuration is not committed. Exit anyway? Uncommitted changes will be lost.",
        ],
      };
    }
    return { state: { ...state, mode: "operational" }, output: [] };
  }
  if (cmd === "commit") {
    if (!state.pendingChanges) return { state, output: ["No configuration changes."] };
    return { state: { ...state, pendingChanges: false }, output: ["commit complete"] };
  }
  if (cmd === "help" || cmd === "?") {
    return { state, output: ["Available: set, delete, edit, up, top, show, exit, commit, help"] };
  }

  return { state, output: [`Unknown command: "${trimmed}"`] };
}

export function getEditPathSuggestions(
  state: EditPathCliState,
  partial: string,
): string[] {
  const tokens = tokenize(partial);
  const last = (tokens[tokens.length - 1] ?? "").toLowerCase();

  if (state.mode === "operational") {
    const opts = ["configure", "show", "help"];
    return tokens.length <= 1 ? opts.filter((o) => o.startsWith(last)) : [];
  }
  const opts = ["set", "delete", "edit", "up", "top", "show", "exit", "commit", "help"];
  return tokens.length <= 1 ? opts.filter((o) => o.startsWith(last)) : [];
}
