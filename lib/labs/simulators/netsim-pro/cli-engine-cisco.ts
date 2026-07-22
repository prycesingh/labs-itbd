import type { CiscoCliInterface, CiscoCliModeFrame, CiscoCliState } from "./cli-types";

// ===================================================================
// Cisco IOS engine — real linear mode-stack parser.
//
// Unlike the source `cli.js` (a flat whole-string dictionary lookup with a
// 3-value mode string), this builds a genuine per-mode command tree and
// resolves input via token-by-token unambiguous-prefix matching, the same way
// real IOS does (e.g. "sh ip int br" -> "show ip interface brief").
// ===================================================================

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input.trim())) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

// ---- command tree ----------------------------------------------------
// Each node is either a literal keyword or a placeholder (`<...>`, greedy to
// end of line handled specially). Leaves carry a handler key resolved in
// execCiscoCommand's dispatch table.

type TreeNode = {
  word: string; // literal keyword, or "<arg>" style placeholder
  children?: TreeNode[];
  leaf?: string; // handler id when this node completes a command
};

function node(word: string, opts: { children?: TreeNode[]; leaf?: string } = {}): TreeNode {
  return { word, children: opts.children, leaf: opts.leaf };
}

const SHOW_SUBTREE: TreeNode[] = [
  node("version", { leaf: "show-version" }),
  node("running-config", { leaf: "show-running-config" }),
  node("ip", {
    children: [
      node("interface", { children: [node("brief", { leaf: "show-ip-interface-brief" })] }),
      node("route", { leaf: "show-ip-route" }),
    ],
  }),
  node("interfaces", { leaf: "show-interfaces" }),
  node("vlan", { children: [node("brief", { leaf: "show-vlan-brief" })] }),
  node("arp", { leaf: "show-arp" }),
];

const GLOBAL_TREE: TreeNode[] = [
  node("show", { children: SHOW_SUBTREE }),
  node("ping", { leaf: "ping" }),
  node("help", { leaf: "help" }),
  node("?", { leaf: "help" }),
  node("exit", { leaf: "exit" }),
  node("logout", { leaf: "exit" }),
];

const USER_TREE: TreeNode[] = [...GLOBAL_TREE, node("enable", { leaf: "enable" })];

const PRIV_TREE: TreeNode[] = [
  ...GLOBAL_TREE,
  node("disable", { leaf: "disable" }),
  node("configure", { children: [node("terminal", { leaf: "configure-terminal" })] }),
  node("write", { children: [node("memory", { leaf: "write-memory" })] }),
  node("copy", {
    children: [
      node("running-config", { children: [node("startup-config", { leaf: "write-memory" })] }),
    ],
  }),
];

const CONFIG_TREE: TreeNode[] = [
  ...GLOBAL_TREE,
  node("end", { leaf: "end" }),
  node("hostname", { leaf: "hostname" }),
  node("interface", { leaf: "interface" }),
  node("vlan", { leaf: "vlan" }),
  node("router", { leaf: "router" }),
  node("ip", { children: [node("route", { leaf: "ip-route" })] }),
  node("access-list", { leaf: "access-list" }),
  node("line", { leaf: "line" }),
];

const CONFIG_IF_TREE: TreeNode[] = [
  ...GLOBAL_TREE,
  node("end", { leaf: "end" }),
  node("ip", { children: [node("address", { leaf: "ip-address" })] }),
  node("shutdown", { leaf: "shutdown" }),
  node("no", {
    children: [
      node("shutdown", { leaf: "no-shutdown" }),
      node("description", { leaf: "no-description" }),
    ],
  }),
  node("description", { leaf: "description" }),
];

const CONFIG_ROUTER_TREE: TreeNode[] = [
  ...GLOBAL_TREE,
  node("end", { leaf: "end" }),
  node("network", { leaf: "network" }),
];

const CONFIG_LINE_TREE: TreeNode[] = [
  ...GLOBAL_TREE,
  node("end", { leaf: "end" }),
  node("password", { leaf: "password" }),
  node("login", { leaf: "login" }),
  node("transport", { children: [node("input", { leaf: "transport-input" })] }),
];

const CONFIG_ACL_TREE: TreeNode[] = [
  ...GLOBAL_TREE,
  node("end", { leaf: "end" }),
  node("permit", { leaf: "acl-rule" }),
  node("deny", { leaf: "acl-rule" }),
];

function treeForMode(frame: CiscoCliModeFrame): TreeNode[] {
  switch (frame.kind) {
    case "user":
      return USER_TREE;
    case "enable":
      return PRIV_TREE;
    case "config":
      return CONFIG_TREE;
    case "config-if":
      return CONFIG_IF_TREE;
    case "config-router":
      return CONFIG_ROUTER_TREE;
    case "config-line":
      return CONFIG_LINE_TREE;
    case "config-acl":
      return CONFIG_ACL_TREE;
    default:
      return GLOBAL_TREE;
  }
}

// Resolve a single token against unambiguous-prefix matching among candidates.
function resolveToken(tok: string, candidates: TreeNode[]): TreeNode | "ambiguous" | null {
  const lower = tok.toLowerCase();
  const exact = candidates.find((c) => c.word.toLowerCase() === lower);
  if (exact) return exact;
  const matches = candidates.filter((c) => c.word.toLowerCase().startsWith(lower));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return "ambiguous";
  return null;
}

type ResolveResult =
  | { ok: true; leaf: string; consumed: number; rest: string[] }
  | { ok: false; reason: "unknown" | "ambiguous" | "incomplete" };

// Walk tokens through the tree for the current mode, returning the resolved
// leaf handler id plus the remaining (unconsumed) tokens to pass as args.
function resolveCommand(tokens: string[], tree: TreeNode[]): ResolveResult {
  if (tokens.length === 0) return { ok: false, reason: "incomplete" };
  let candidates = tree;
  let i = 0;
  let lastLeaf: string | undefined;
  while (i < tokens.length) {
    const result = resolveToken(tokens[i], candidates);
    if (result === "ambiguous") return { ok: false, reason: "ambiguous" };
    if (result === null) {
      // No further literal match — if we already resolved a leaf, treat the
      // remaining tokens as free-form arguments to that leaf.
      if (lastLeaf) return { ok: true, leaf: lastLeaf, consumed: i, rest: tokens.slice(i) };
      return { ok: false, reason: "unknown" };
    }
    i++;
    if (result.leaf) lastLeaf = result.leaf;
    candidates = result.children ?? [];
    if (candidates.length === 0) {
      return lastLeaf
        ? { ok: true, leaf: lastLeaf, consumed: i, rest: tokens.slice(i) }
        : { ok: false, reason: "incomplete" };
    }
  }
  if (lastLeaf) return { ok: true, leaf: lastLeaf, consumed: i, rest: [] };
  return { ok: false, reason: "incomplete" };
}

// ---- prompt rendering ----------------------------------------------------

export function getCiscoPrompt(state: CiscoCliState): string {
  const frame = state.modeStack[state.modeStack.length - 1] ?? { kind: "user" };
  const host = state.hostname;
  switch (frame.kind) {
    case "user":
      return `${host}>`;
    case "enable":
      return `${host}#`;
    case "config":
      return `${host}(config)#`;
    case "config-if":
      return `${host}(config-if)#`;
    case "config-router":
      return `${host}(config-router)#`;
    case "config-line":
      return `${host}(config-line)#`;
    case "config-acl":
      return `${host}(config-acl)#`;
    default:
      return `${host}>`;
  }
}

// ---- helpers on state -----------------------------------------------------

function findIface(state: CiscoCliState, name: string): CiscoCliInterface | undefined {
  const lower = name.toLowerCase();
  return state.interfaces.find((i) => i.name.toLowerCase() === lower || i.name.toLowerCase().replace(/\s+/g, "") === lower);
}

function normalizeIfaceName(raw: string): string {
  // Expand common abbreviations (gi0/1 -> GigabitEthernet0/1, etc.) loosely —
  // pragmatic mapping, not exhaustive.
  const m = raw.match(/^([a-zA-Z]+)(\d.*)$/);
  if (!m) return raw;
  const prefix = m[1].toLowerCase();
  const rest = m[2];
  if (prefix.startsWith("gi")) return `GigabitEthernet${rest}`;
  if (prefix.startsWith("fa")) return `FastEthernet${rest}`;
  if (prefix.startsWith("se")) return `Serial${rest}`;
  if (prefix.startsWith("lo")) return `Loopback${rest}`;
  if (prefix.startsWith("te")) return `TenGigabitEthernet${rest}`;
  return raw;
}

function renderRunningConfig(state: CiscoCliState): string[] {
  const lines: string[] = [];
  lines.push("Building configuration...");
  lines.push("");
  lines.push("Current configuration:");
  lines.push("!");
  lines.push("version 15.7");
  lines.push(`hostname ${state.hostname}`);
  lines.push("!");
  for (const iface of state.interfaces) {
    lines.push(`interface ${iface.name}`);
    if (iface.description) lines.push(` description ${iface.description}`);
    if (iface.vlan !== null) lines.push(` switchport access vlan ${iface.vlan}`);
    if (iface.ip !== "unassigned") lines.push(` ip address ${iface.ip} ${iface.mask}`);
    lines.push(iface.adminUp ? " no shutdown" : " shutdown");
    lines.push("!");
  }
  for (const route of state.routes) {
    lines.push(`ip route ${route.dst} ${route.mask} ${route.nextHop}`);
  }
  if (state.routes.length) lines.push("!");
  for (const vlan of state.vlans) {
    if (vlan.id === 1) continue;
    lines.push(`vlan ${vlan.id}`);
    lines.push(` name ${vlan.name}`);
  }
  const aclIds = Array.from(new Set(state.acls.map((a) => a.aclId)));
  for (const id of aclIds) {
    for (const rule of state.acls.filter((a) => a.aclId === id)) {
      lines.push(`access-list ${id} ${rule.action} ${rule.text}`);
    }
  }
  lines.push("end");
  return lines;
}

function pingOutput(target: string): string[] {
  // Deterministic-per-target heuristic: private ranges + well-known public IPs
  // succeed, everything else times out. No Math.random()/Date.now().
  const isPrivate =
    /^10\./.test(target) ||
    /^192\.168\./.test(target) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(target) ||
    target === "127.0.0.1";
  const wellKnown = ["8.8.8.8", "1.1.1.1", "8.8.4.4"].includes(target);
  const succeeds = isPrivate || wellKnown;
  const lines = [
    "Type escape sequence to abort.",
    `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`,
  ];
  if (succeeds) {
    lines.push("!!!!!");
    lines.push("Success rate is 100 percent (5/5), round-trip min/avg/max = 8/14/22 ms");
  } else {
    lines.push(".....");
    lines.push("Success rate is 0 percent (0/5)");
  }
  return lines;
}

function helpForMode(tree: TreeNode[]): string[] {
  const words = tree.map((n) => n.word).filter((w) => w !== "?");
  return [`Available commands: ${words.join(", ")}`];
}

// ---- main entry point -----------------------------------------------------

export function execCiscoCommand(
  state: CiscoCliState,
  input: string,
): { state: CiscoCliState; output: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { state, output: [] };
  const tokens = tokenize(trimmed);
  const topFrame = state.modeStack[state.modeStack.length - 1] ?? { kind: "user" };
  const tree = treeForMode(topFrame);
  const resolved = resolveCommand(tokens, tree);

  if (!resolved.ok) {
    if (resolved.reason === "ambiguous") {
      return { state, output: [`% Ambiguous command:  "${trimmed}"`] };
    }
    return { state, output: [`% Invalid input detected at '^' marker.`, `% Unknown command: "${trimmed}"`] };
  }

  const args = resolved.rest;
  const argStr = args.join(" ");

  switch (resolved.leaf) {
    case "enable": {
      if (topFrame.kind !== "user") return { state, output: [] };
      return { state: { ...state, modeStack: [...state.modeStack, { kind: "enable" }] }, output: [] };
    }
    case "disable": {
      return { state: { ...state, modeStack: [{ kind: "user" }] }, output: [] };
    }
    case "configure-terminal": {
      return { state: { ...state, modeStack: [...state.modeStack, { kind: "config" }] }, output: ["Enter configuration commands, one per line.  End with CNTL/Z."] };
    }
    case "exit": {
      if (state.modeStack.length <= 1) return { state, output: [] };
      return { state: { ...state, modeStack: state.modeStack.slice(0, -1) }, output: [] };
    }
    case "end": {
      return { state: { ...state, modeStack: [{ kind: "user" }, { kind: "enable" }] }, output: [] };
    }
    case "hostname": {
      const name = args[0];
      if (!name) return { state, output: ["% Incomplete command."] };
      return { state: { ...state, hostname: name }, output: [] };
    }
    case "interface": {
      const raw = args[0];
      if (!raw) return { state, output: ["% Incomplete command."] };
      const name = normalizeIfaceName(raw);
      const exists = findIface(state, name);
      let interfaces = state.interfaces;
      if (!exists) {
        interfaces = [
          ...state.interfaces,
          { name, ip: "unassigned", mask: "unassigned", adminUp: false, lineUp: false, description: "", vlan: null },
        ];
      }
      return {
        state: { ...state, interfaces, modeStack: [...state.modeStack, { kind: "config-if", iface: name }] },
        output: [],
      };
    }
    case "vlan": {
      const idStr = args[0];
      const id = Number(idStr);
      if (!idStr || Number.isNaN(id)) return { state, output: ["% Incomplete command."] };
      const exists = state.vlans.some((v) => v.id === id);
      const vlans = exists ? state.vlans : [...state.vlans, { id, name: `VLAN${id.toString().padStart(4, "0")}` }];
      return { state: { ...state, vlans }, output: [] };
    }
    case "router": {
      const proto = args[0] ?? "";
      const id = args[1] ?? "";
      return {
        state: { ...state, modeStack: [...state.modeStack, { kind: "config-router", proto, id }] },
        output: [],
      };
    }
    case "network": {
      // Acknowledged only — real OSPF/EIGRP/BGP network statement semantics
      // are out of scope for this sandbox.
      return { state, output: [] };
    }
    case "ip-route": {
      if (args.length < 3) return { state, output: ["% Incomplete command."] };
      const [dst, mask, nextHop] = args;
      return { state: { ...state, routes: [...state.routes, { dst, mask, nextHop }] }, output: [] };
    }
    case "access-list": {
      const aclId = args[0];
      const action = args[1] as "permit" | "deny" | undefined;
      if (!aclId || (action !== "permit" && action !== "deny")) {
        return { state, output: ["% Incomplete command."] };
      }
      const text = args.slice(2).join(" ");
      const seq = (state.acls.filter((a) => a.aclId === aclId).length + 1) * 10;
      return { state: { ...state, acls: [...state.acls, { aclId, seq, action, text }] }, output: [] };
    }
    case "line": {
      const line = args.join(" ");
      return { state: { ...state, modeStack: [...state.modeStack, { kind: "config-line", line }] }, output: [] };
    }
    case "password":
    case "login":
    case "transport-input": {
      // Line-mode settings acknowledged without persisted state (not modeled
      // in CiscoCliState) — matches scope note in the task for config-line.
      return { state, output: [] };
    }
    case "acl-rule": {
      if (topFrame.kind !== "config-acl") return { state, output: [] };
      const action = tokens[0] as "permit" | "deny";
      const text = args.join(" ");
      const seq = (state.acls.filter((a) => a.aclId === topFrame.aclId).length + 1) * 10;
      return {
        state: { ...state, acls: [...state.acls, { aclId: topFrame.aclId, seq, action, text }] },
        output: [],
      };
    }
    case "ip-address": {
      if (topFrame.kind !== "config-if" || args.length < 2) return { state, output: ["% Incomplete command."] };
      const [ip, mask] = args;
      const interfaces = state.interfaces.map((i) =>
        i.name === topFrame.iface ? { ...i, ip, mask } : i,
      );
      return { state: { ...state, interfaces }, output: [] };
    }
    case "shutdown": {
      if (topFrame.kind !== "config-if") return { state, output: [] };
      const interfaces = state.interfaces.map((i) =>
        i.name === topFrame.iface ? { ...i, adminUp: false, lineUp: false } : i,
      );
      return { state: { ...state, interfaces }, output: [] };
    }
    case "no-shutdown": {
      if (topFrame.kind !== "config-if") return { state, output: [] };
      const interfaces = state.interfaces.map((i) =>
        i.name === topFrame.iface ? { ...i, adminUp: true, lineUp: true } : i,
      );
      return { state: { ...state, interfaces }, output: [] };
    }
    case "description": {
      if (topFrame.kind !== "config-if") return { state, output: [] };
      const text = argStr;
      const interfaces = state.interfaces.map((i) =>
        i.name === topFrame.iface ? { ...i, description: text } : i,
      );
      return { state: { ...state, interfaces }, output: [] };
    }
    case "no-description": {
      if (topFrame.kind !== "config-if") return { state, output: [] };
      const interfaces = state.interfaces.map((i) =>
        i.name === topFrame.iface ? { ...i, description: "" } : i,
      );
      return { state: { ...state, interfaces }, output: [] };
    }
    case "show-version": {
      return {
        state,
        output: [
          "Cisco IOS Software, Version 15.7(3)M",
          `${state.hostname} uptime is 12 weeks, 3 days, 4 hours, 18 minutes`,
          'System image file is "flash:c2900-universalk9-mz.SPA.157-3.M.bin"',
          "Processor: 512MB DRAM, 256MB Flash",
        ],
      };
    }
    case "show-running-config": {
      return { state, output: renderRunningConfig(state) };
    }
    case "show-ip-interface-brief": {
      const header = "Interface              IP-Address      OK? Method Status                Protocol";
      const rows = state.interfaces.map((i) => {
        const status = i.adminUp ? "up" : "administratively down";
        const proto = i.lineUp ? "up" : "down";
        return `${i.name.padEnd(22)} ${i.ip.padEnd(15)} YES manual ${status.padEnd(21)} ${proto}`;
      });
      return { state, output: [header, ...rows] };
    }
    case "show-ip-route": {
      const gw = state.routes.find((r) => r.dst === "0.0.0.0");
      const lines: string[] = [];
      lines.push(gw ? `Gateway of last resort is ${gw.nextHop} to network 0.0.0.0` : "Gateway of last resort is not set");
      lines.push("");
      for (const i of state.interfaces) {
        if (i.ip !== "unassigned" && i.adminUp) lines.push(`C    ${i.ip}/24 is directly connected, ${i.name}`);
      }
      for (const r of state.routes) {
        if (r.dst === "0.0.0.0") lines.push(`S*   0.0.0.0/0 [1/0] via ${r.nextHop}`);
        else lines.push(`S    ${r.dst}/24 [1/0] via ${r.nextHop}`);
      }
      return { state, output: lines };
    }
    case "show-interfaces": {
      const lines: string[] = [];
      for (const i of state.interfaces) {
        lines.push(`${i.name} is ${i.adminUp ? "up" : "administratively down"}, line protocol is ${i.lineUp ? "up" : "down"}`);
        lines.push(`  Description: ${i.description || "(none)"}`);
        lines.push(`  Internet address is ${i.ip}/${i.mask}`);
        lines.push("  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec");
      }
      return { state, output: lines };
    }
    case "show-vlan-brief": {
      const header = "VLAN Name                             Status    Ports";
      const sep = "---- -------------------------------- --------- ---------";
      const rows = state.vlans.map((v) => {
        const ports = state.interfaces.filter((i) => i.vlan === v.id).map((i) => i.name).join(", ");
        return `${String(v.id).padEnd(4)} ${v.name.padEnd(33)} active    ${ports}`;
      });
      return { state, output: [header, sep, ...rows] };
    }
    case "show-arp": {
      const header = "Protocol  Address          Age (min)  Hardware Addr   Type   Interface";
      const rows = state.interfaces
        .filter((i) => i.ip !== "unassigned")
        .map((i, idx) => `Internet  ${i.ip.padEnd(16)} ${String(idx * 5).padStart(9)}  00${(idx + 10).toString(16)}.7966.68${idx.toString().padStart(2, "0")}  ARPA   ${i.name}`);
      return { state, output: [header, ...rows] };
    }
    case "ping": {
      const target = args[0];
      if (!target) return { state, output: ["% Incomplete command."] };
      return { state, output: pingOutput(target) };
    }
    case "write-memory": {
      return { state, output: ["Building configuration...", "[OK]"] };
    }
    case "help": {
      return { state, output: helpForMode(tree) };
    }
    default:
      return { state, output: [`% Unknown command: "${trimmed}"`] };
  }
}

// ---- tab completion -----------------------------------------------------

export function getCiscoSuggestions(state: CiscoCliState, partial: string): string[] {
  const topFrame = state.modeStack[state.modeStack.length - 1] ?? { kind: "user" };
  const tree = treeForMode(topFrame);
  const tokens = tokenize(partial);

  if (tokens.length === 0) return tree.map((n) => n.word);

  // Walk all-but-last token deterministically (must be exact/unambiguous),
  // then suggest completions for the last (possibly partial) token.
  let candidates = tree;
  for (let i = 0; i < tokens.length - 1; i++) {
    const result = resolveToken(tokens[i], candidates);
    if (result === "ambiguous" || result === null) return [];
    candidates = result.children ?? [];
  }
  const lastTok = tokens[tokens.length - 1].toLowerCase();
  const endsWithSpace = /\s$/.test(partial);
  if (endsWithSpace) {
    // Last full token was already resolved above as part of the walk only if
    // there were >=2 tokens; if input ends with a space after a single token,
    // resolve it now to descend into its children.
    const result = resolveToken(tokens[tokens.length - 1], candidates);
    if (result && result !== "ambiguous") candidates = result.children ?? [];
    return candidates.map((n) => n.word);
  }
  return candidates.filter((n) => n.word.toLowerCase().startsWith(lastTok)).map((n) => n.word);
}
