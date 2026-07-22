// ===== WIRESHARK SIMULATOR — DISPLAY FILTER ENGINE =====
// Close port of itbd-lab/simulators/wireshark/js/wireshark-filter.js: a hand-rolled
// Wireshark-style display-filter lexer/recursive-descent-parser/evaluator.
// Grammar (same precedence as source): orExpr > andExpr > notExpr > atom.
//
// Bug fix #1 (approved): source's getFieldValue() has no `case 'frame':`, so
// `frame contains "X"` always evaluated to `undefined` (never matched) — Ctrl+F/Find
// was silently broken. This port adds a real `frame` field that substring/regex
// searches across `info`, `protocol`, and the flattened dissection-tree text.
//
// Bug fix (canonical field catalog): source had a richer `FIELDS` array in
// wireshark-filter.js AND a second, smaller, unsynced duplicate catalog in main.js.
// `getFieldCatalog()` here is the ONE canonical catalog — it covers every field
// `getFieldValue` supports (including the new `frame` field), and there is no
// second copy anywhere in this layer.

import type { WsFieldCatalogEntry, WsFilterAst, WsFilterCompileResult, WsPacket, WsTreeNode } from "./types";

// ----- Lexer -----

export type Token =
  | { t: "paren"; v: "(" | ")" }
  | { t: "string"; v: string }
  | { t: "number"; v: number }
  | { t: "op"; v: "&&" | "||" | "!" }
  | { t: "cmp"; v: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "matches" }
  | { t: "ident"; v: string };

const IDENT_CHAR = /[A-Za-z0-9_.\-:]/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ t: "paren", v: c });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let s = "";
      while (j < input.length && input[j] !== quote) {
        if (input[j] === "\\" && j + 1 < input.length) {
          s += input[j + 1];
          j += 2;
        } else {
          s += input[j];
          j++;
        }
      }
      tokens.push({ t: "string", v: s });
      i = j + 1;
      continue;
    }
    if (c === "&" && input[i + 1] === "&") {
      tokens.push({ t: "op", v: "&&" });
      i += 2;
      continue;
    }
    if (c === "|" && input[i + 1] === "|") {
      tokens.push({ t: "op", v: "||" });
      i += 2;
      continue;
    }
    if (c === "=" && input[i + 1] === "=") {
      tokens.push({ t: "cmp", v: "==" });
      i += 2;
      continue;
    }
    if (c === "!" && input[i + 1] === "=") {
      tokens.push({ t: "cmp", v: "!=" });
      i += 2;
      continue;
    }
    if (c === ">" && input[i + 1] === "=") {
      tokens.push({ t: "cmp", v: ">=" });
      i += 2;
      continue;
    }
    if (c === "<" && input[i + 1] === "=") {
      tokens.push({ t: "cmp", v: "<=" });
      i += 2;
      continue;
    }
    if (c === ">") {
      tokens.push({ t: "cmp", v: ">" });
      i++;
      continue;
    }
    if (c === "<") {
      tokens.push({ t: "cmp", v: "<" });
      i++;
      continue;
    }
    if (c === "!") {
      tokens.push({ t: "op", v: "!" });
      i++;
      continue;
    }
    if (IDENT_CHAR.test(c)) {
      let k = i;
      while (k < input.length && IDENT_CHAR.test(input[k])) k++;
      const word = input.substring(i, k);
      const lower = word.toLowerCase();
      if (lower === "and") tokens.push({ t: "op", v: "&&" });
      else if (lower === "or") tokens.push({ t: "op", v: "||" });
      else if (lower === "not") tokens.push({ t: "op", v: "!" });
      else if (lower === "contains" || lower === "matches") tokens.push({ t: "cmp", v: lower });
      else if (/^[0-9]+$/.test(word)) tokens.push({ t: "number", v: parseInt(word, 10) });
      else if (/^0x[0-9a-fA-F]+$/.test(word)) tokens.push({ t: "number", v: parseInt(word.substring(2), 16) });
      else tokens.push({ t: "ident", v: word });
      i = k;
      continue;
    }
    throw new Error("Unexpected character: " + c + " at position " + i);
  }
  return tokens;
}

// ----- Parser -----
// Grammar:
//  expr       := orExpr
//  orExpr     := andExpr ('||' andExpr)*
//  andExpr    := notExpr ('&&' notExpr)*
//  notExpr    := '!' notExpr | atom
//  atom       := '(' expr ')' | comparison | flag
//  comparison := ident cmp value
//  flag       := ident

export function parse(tokens: Token[]): WsFilterAst {
  let pos = 0;
  function peek(): Token | undefined {
    return tokens[pos];
  }
  function consume(): Token | undefined {
    return tokens[pos++];
  }
  function expectParen(v: "(" | ")"): void {
    const tk = consume();
    if (!tk || tk.t !== "paren" || tk.v !== v) {
      throw new Error('Expected paren "' + v + '" near "' + (tk ? tk.v : "EOF") + '"');
    }
  }

  function parseOr(): WsFilterAst {
    let left = parseAnd();
    while (peek()?.t === "op" && peek()?.v === "||") {
      consume();
      left = { type: "or", left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd(): WsFilterAst {
    let left = parseNot();
    while (peek()?.t === "op" && peek()?.v === "&&") {
      consume();
      left = { type: "and", left, right: parseNot() };
    }
    return left;
  }
  function parseNot(): WsFilterAst {
    if (peek()?.t === "op" && peek()?.v === "!") {
      consume();
      return { type: "not", expr: parseNot() };
    }
    return parseAtom();
  }
  function parseAtom(): WsFilterAst {
    const tk = peek();
    if (!tk) throw new Error("Unexpected end of expression");
    if (tk.t === "paren" && tk.v === "(") {
      consume();
      const e = parseOr();
      expectParen(")");
      return e;
    }
    if (tk.t === "ident") {
      const ident = consume() as Token & { t: "ident" };
      const nxt = peek();
      if (nxt && nxt.t === "cmp") {
        const op = (consume() as Token & { t: "cmp" }).v;
        const val = consume();
        if (!val) throw new Error('Expected value after "' + op + '"');
        const v = val.t === "string" ? val.v : val.t === "number" ? String(val.v) : String(val.v);
        return { type: "cmp", field: ident.v, op, value: v };
      }
      return { type: "flag", field: ident.v };
    }
    throw new Error("Unexpected token: " + tk.v);
  }

  const ast = parseOr();
  if (pos < tokens.length) throw new Error('Unexpected token "' + tokens[pos].v + '"');
  return ast;
}

// ----- Field value extraction -----

const TCP_LIKE_PROTOCOLS = ["TCP", "HTTP", "HTTPS", "TLSv1.2", "TLSv1.3", "SMB2", "LDAP", "KRB5", "BGP"];
const UDP_LIKE_PROTOCOLS = ["UDP", "DNS", "DHCP", "MDNS", "NBNS", "SSDP", "ISAKMP", "SNMP"];

/** Flattens a dissection tree into one lowercase-friendly search string (labels + values). */
function flattenTreeText(tree: WsTreeNode[] | undefined): string {
  if (!tree || tree.length === 0) return "";
  let out = "";
  const visit = (nodes: WsTreeNode[]) => {
    for (const n of nodes) {
      out += " " + n.label;
      if (n.value) out += " " + n.value;
      if (n.children && n.children.length > 0) visit(n.children);
    }
  };
  visit(tree);
  return out;
}

export function getFieldValue(packet: WsPacket, field: string): unknown {
  const p = packet;
  switch (field) {
    case "ip":
      return !!p.src && /^\d+\.\d+\.\d+\.\d+$/.test(p.src);
    case "ip.src":
      return p.src;
    case "ip.dst":
      return p.dst;
    case "ip.addr":
      return [p.src, p.dst];
    case "ip.proto":
      return undefined;
    case "ipv6":
      return false;
    case "eth.src":
      return p.srcMac;
    case "eth.dst":
      return p.dstMac;
    case "eth.addr":
      return [p.srcMac, p.dstMac];
    case "tcp":
      return TCP_LIKE_PROTOCOLS.indexOf(p.protocol) !== -1;
    case "tcp.port":
      return [p.srcPort, p.dstPort];
    case "tcp.srcport":
      return p.srcPort;
    case "tcp.dstport":
      return p.dstPort;
    case "tcp.flags.syn":
      return p.tcpFlags?.syn ? 1 : 0;
    case "tcp.flags.ack":
      return p.tcpFlags?.ack ? 1 : 0;
    case "tcp.flags.fin":
      return p.tcpFlags?.fin ? 1 : 0;
    case "tcp.flags.rst":
      return p.tcpFlags?.rst ? 1 : 0;
    case "tcp.flags.psh":
      return p.tcpFlags?.psh ? 1 : 0;
    case "tcp.analysis.retransmission":
      return p.color === "tcp-retx" || /Retransmission/.test(p.info || "");
    case "tcp.stream":
      return p.stream;
    case "udp":
      return UDP_LIKE_PROTOCOLS.indexOf(p.protocol) !== -1;
    case "udp.port":
      return [p.srcPort, p.dstPort];
    case "udp.srcport":
      return p.srcPort;
    case "udp.dstport":
      return p.dstPort;
    case "http":
      return p.protocol === "HTTP";
    case "http.host":
      return p.httpReq ? p.httpReq.host : undefined;
    case "http.request":
      return !!p.httpReq;
    case "http.response":
      return !!p.httpResp;
    case "http.request.method":
      return p.httpReq ? p.httpReq.method : undefined;
    case "http.request.uri":
      return p.httpReq ? p.httpReq.path : undefined;
    case "http.response.code":
      return p.httpResp ? p.httpResp.code : undefined;
    case "dns":
      return p.protocol === "DNS" || p.protocol === "MDNS";
    case "dns.qry.name":
      return p.dnsQ;
    case "dns.qry.type":
      return p.dnsType;
    case "tls":
      return p.protocol === "TLSv1.2" || p.protocol === "TLSv1.3";
    case "tls.handshake.type":
      return p.tlsType;
    case "tls.handshake.extensions_server_name": {
      if (p.tree) {
        for (const n of p.tree) {
          if (n.children) {
            for (const child of n.children) {
              if (/SNI/.test(child.label || "")) return (child.value || "").replace(/^:\s*/, "");
            }
          }
        }
      }
      return undefined;
    }
    // Bug fix #1: real `frame` field — searches info, protocol, and flattened tree text.
    // (Source had no `case 'frame':`, so `frame contains "X"` always evaluated to
    // `undefined` and Ctrl+F/Find silently never matched.)
    case "frame":
      return [p.info, p.protocol, flattenTreeText(p.tree)].filter(Boolean).join(" ");
    case "frame.number":
      return p.no;
    case "frame.len":
      return p.length;
    case "frame.time_relative":
      return p.time;
    case "arp":
      return p.protocol === "ARP";
    case "icmp":
      return p.protocol === "ICMP";
    case "smb":
    case "smb2":
      return p.protocol === "SMB2";
    case "ldap":
      return p.protocol === "LDAP";
    case "kerberos":
      return p.protocol === "KRB5";
    case "ospf":
      return p.protocol === "OSPF";
    case "bgp":
      return p.protocol === "BGP";
    case "dhcp":
      return p.protocol === "DHCP";
    case "mdns":
      return p.protocol === "MDNS";
    case "nbns":
      return p.protocol === "NBNS";
    case "ssdp":
      return p.protocol === "SSDP";
    case "esp":
      return p.protocol === "ESP";
    case "isakmp":
      return p.protocol === "ISAKMP";
    case "ws.suspicious":
      return !!p.suspicious;
    default:
      return undefined;
  }
}

// ----- Comparison -----

export function compare(actual: unknown, op: string, expected: string): boolean {
  if (Array.isArray(actual)) {
    return actual.some((item) => compare(item, op, expected));
  }
  if (actual === undefined || actual === null) return false;

  const a = actual;
  const e = expected;

  // Numeric auto-detection: actual is a number, or actual parses as a float AND
  // expected looks like a plain integer/decimal literal.
  const aIsNumeric = typeof a === "number" || (!isNaN(parseFloat(String(a))) && /^\d+(\.\d+)?$/.test(String(e)));
  if (aIsNumeric) {
    const na = parseFloat(String(a));
    const ne = parseFloat(e);
    if (!isNaN(na) && !isNaN(ne)) {
      switch (op) {
        case "==":
          return na === ne;
        case "!=":
          return na !== ne;
        case "<":
          return na < ne;
        case ">":
          return na > ne;
        case "<=":
          return na <= ne;
        case ">=":
          return na >= ne;
      }
    }
  }

  const sa = String(a).toLowerCase();
  const se = String(e).toLowerCase();
  switch (op) {
    case "==":
      return sa === se;
    case "!=":
      return sa !== se;
    case "<":
      return sa < se;
    case ">":
      return sa > se;
    case "<=":
      return sa <= se;
    case ">=":
      return sa >= se;
    case "contains":
      return sa.indexOf(se) !== -1;
    case "matches":
      try {
        return new RegExp(expected, "i").test(String(a));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ----- AST evaluation -----

function evalAst(ast: WsFilterAst | null, p: WsPacket): boolean {
  if (!ast) return true;
  switch (ast.type) {
    case "or":
      return evalAst(ast.left, p) || evalAst(ast.right, p);
    case "and":
      return evalAst(ast.left, p) && evalAst(ast.right, p);
    case "not":
      return !evalAst(ast.expr, p);
    case "flag":
      return !!getFieldValue(p, ast.field);
    case "cmp":
      return compare(getFieldValue(p, ast.field), ast.op, ast.value);
    default:
      return false;
  }
}

// ----- Compile / apply -----

export function compile(expr: string): WsFilterCompileResult {
  if (!expr || !expr.trim()) {
    return { ok: true, predicate: () => true, ast: null, error: null };
  }
  try {
    const ast = parse(tokenize(expr));
    return {
      ok: true,
      predicate: (p: WsPacket) => evalAst(ast, p),
      ast,
      error: null,
    };
  } catch (e) {
    return { ok: false, predicate: null, ast: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export function applyFilter(packets: WsPacket[], expr: string): WsPacket[] {
  if (!expr || !expr.trim()) return packets;
  const result = compile(expr);
  if (!result.ok || !result.predicate) return packets;
  return packets.filter(result.predicate);
}

// ----- Field catalog (THE single canonical catalog — see file header) -----

export function getFieldCatalog(): WsFieldCatalogEntry[] {
  return [
    { field: "ip", type: "boolean", description: "Internet Protocol" },
    { field: "ip.src", type: "string", description: "Source IPv4 address" },
    { field: "ip.dst", type: "string", description: "Destination IPv4 address" },
    { field: "ip.addr", type: "array", description: "Source or destination IPv4 address" },
    { field: "ipv6", type: "boolean", description: "Internet Protocol v6 (always false — no IPv6 traffic in this capture)" },
    { field: "eth.src", type: "string", description: "Source MAC address" },
    { field: "eth.dst", type: "string", description: "Destination MAC address" },
    { field: "eth.addr", type: "array", description: "Source or destination MAC address" },
    { field: "tcp", type: "boolean", description: "Transmission Control Protocol" },
    { field: "tcp.port", type: "array", description: "Source or destination TCP port" },
    { field: "tcp.srcport", type: "number", description: "Source TCP port" },
    { field: "tcp.dstport", type: "number", description: "Destination TCP port" },
    { field: "tcp.flags.syn", type: "number", description: "TCP SYN flag (1/0)" },
    { field: "tcp.flags.ack", type: "number", description: "TCP ACK flag (1/0)" },
    { field: "tcp.flags.fin", type: "number", description: "TCP FIN flag (1/0)" },
    { field: "tcp.flags.rst", type: "number", description: "TCP RST flag (1/0)" },
    { field: "tcp.flags.psh", type: "number", description: "TCP PSH flag (1/0)" },
    { field: "tcp.analysis.retransmission", type: "boolean", description: "TCP retransmission detected" },
    { field: "tcp.stream", type: "string", description: "TCP stream identifier" },
    { field: "udp", type: "boolean", description: "User Datagram Protocol" },
    { field: "udp.port", type: "array", description: "Source or destination UDP port" },
    { field: "udp.srcport", type: "number", description: "Source UDP port" },
    { field: "udp.dstport", type: "number", description: "Destination UDP port" },
    { field: "http", type: "boolean", description: "Hypertext Transfer Protocol" },
    { field: "http.host", type: "string", description: "HTTP Host header" },
    { field: "http.request", type: "boolean", description: "HTTP request" },
    { field: "http.response", type: "boolean", description: "HTTP response" },
    { field: "http.request.method", type: "string", description: "HTTP request method" },
    { field: "http.request.uri", type: "string", description: "HTTP request URI" },
    { field: "http.response.code", type: "number", description: "HTTP response status code" },
    { field: "dns", type: "boolean", description: "Domain Name System" },
    { field: "dns.qry.name", type: "string", description: "DNS query name" },
    { field: "dns.qry.type", type: "string", description: "DNS query record type" },
    { field: "tls", type: "boolean", description: "Transport Layer Security" },
    { field: "tls.handshake.type", type: "string", description: "TLS handshake message type" },
    { field: "tls.handshake.extensions_server_name", type: "string", description: "TLS SNI value" },
    {
      field: "frame",
      type: "string",
      description: "Full-text search across frame info, protocol, and dissection tree (Ctrl+F / Find)",
    },
    { field: "frame.number", type: "number", description: "Frame number" },
    { field: "frame.len", type: "number", description: "Frame length on the wire" },
    { field: "frame.time_relative", type: "number", description: "Time since first frame (s)" },
    { field: "arp", type: "boolean", description: "Address Resolution Protocol" },
    { field: "icmp", type: "boolean", description: "Internet Control Message Protocol" },
    { field: "smb", type: "boolean", description: "Server Message Block (SMB)" },
    { field: "smb2", type: "boolean", description: "SMB2 protocol" },
    { field: "ldap", type: "boolean", description: "Lightweight Directory Access Protocol" },
    { field: "kerberos", type: "boolean", description: "Kerberos authentication" },
    { field: "ospf", type: "boolean", description: "Open Shortest Path First" },
    { field: "bgp", type: "boolean", description: "Border Gateway Protocol" },
    { field: "dhcp", type: "boolean", description: "Dynamic Host Configuration Protocol" },
    { field: "mdns", type: "boolean", description: "Multicast DNS" },
    { field: "nbns", type: "boolean", description: "NetBIOS Name Service" },
    { field: "ssdp", type: "boolean", description: "Simple Service Discovery Protocol" },
    { field: "esp", type: "boolean", description: "Encapsulating Security Payload" },
    { field: "isakmp", type: "boolean", description: "IKE / ISAKMP" },
    { field: "ws.suspicious", type: "boolean", description: "CloudLab tag: suspicious traffic" },
  ];
}

// ----- Autocomplete -----

export function getSuggestions(partial: string): string[] {
  const prefix = (partial.match(/[A-Za-z0-9_.]+$/) || [""])[0];
  if (!prefix) return [];
  const lower = prefix.toLowerCase();
  return getFieldCatalog()
    .filter((f) => f.field.toLowerCase().indexOf(lower) === 0)
    .slice(0, 12)
    .map((f) => f.field);
}
