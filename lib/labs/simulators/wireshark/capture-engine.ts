// ===== WIRESHARK SIMULATOR — LIVE CAPTURE ENGINE =====
// Source's Start/Stop/Restart capture buttons are 100% decorative: `_capture()` in
// wireshark-main.js only ever calls `alert(...)` — no timer, no new packets, ever.
// This is the approved "make it real" upgrade: a genuine live-capture engine that
// generates one plausible new packet per call, continuing the existing conversation
// model (same CloudLab roster, same dissection-tree depth as the static seed).
//
// Pure function — deterministic via the seeded LCG (never `Math.random()`), and
// never touches the wall clock internally (`nowMs` is passed in by the caller). The
// reducer/UI layer owns the `setInterval` that repeatedly calls this and dispatches
// `APPEND_LIVE_PACKET` while `captureStatus === "capturing"`.

import type { WsPacket, WsTreeNode } from "./types";
import { HOSTS } from "./seedData";

function rng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashSeed(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33 + input.charCodeAt(i)) & 0x7fffffff;
  }
  return h === 0 ? 1 : h;
}

function hex(n: number, w: number): string {
  let s = Math.trunc(n).toString(16);
  while (s.length < w) s = "0" + s;
  return s;
}

function rInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randHex(rand: () => number, nBytes: number): string {
  let s = "";
  for (let i = 0; i < nBytes; i++) s += hex(rInt(rand, 0, 255), 2);
  return s;
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

function macFor(ip: string): string {
  const h = HOSTS.find((host) => host.ip === ip);
  return h ? h.mac : "00:1c:b3:aa:11:01";
}

function formatAbsTime(nowMs: number): string {
  const d = new Date(nowMs);
  const pad = (n: number, w: number) => {
    let s = String(n);
    while (s.length < w) s = "0" + s;
    return s;
  };
  return (
    d.getUTCFullYear() +
    "-" +
    pad(d.getUTCMonth() + 1, 2) +
    "-" +
    pad(d.getUTCDate(), 2) +
    " " +
    pad(d.getUTCHours(), 2) +
    ":" +
    pad(d.getUTCMinutes(), 2) +
    ":" +
    pad(d.getUTCSeconds(), 2) +
    "." +
    pad(d.getUTCMilliseconds(), 3)
  );
}

// ----- Dissection tree builders (mirror seedData.ts's depth/shape) -----

function frameNode(p: WsPacket, deltaSeconds: number): WsTreeNode {
  return {
    label: "Frame " + p.no,
    value: ": " + p.length + " bytes on wire, " + p.length + " bytes captured",
    children: [
      { label: "Interface id", value: ": 0 (eth0)" },
      { label: "Encapsulation type", value: ": Ethernet (1)" },
      { label: "Arrival Time", value: ": " + p.timeAbs + " UTC" },
      { label: "Time delta from previous captured frame", value: ": " + deltaSeconds.toFixed(6) + " seconds" },
      { label: "Time since reference or first frame", value: ": " + p.time.toFixed(6) + " seconds" },
      { label: "Frame Number", value: ": " + p.no },
      { label: "Frame Length", value: ": " + p.length + " bytes (" + p.length * 8 + " bits)" },
      { label: "Capture Length", value: ": " + p.length + " bytes" },
      { label: "Frame is marked", value: ": False" },
      { label: "Frame is ignored", value: ": False" },
      { label: "[Live-captured packet]", value: ": True" },
    ],
  };
}

function ethNode(p: WsPacket, etype: string): WsTreeNode {
  return {
    label: "Ethernet II",
    value: ", Src: " + p.srcMac + ", Dst: " + p.dstMac,
    children: [
      { label: "Destination", value: ": " + p.dstMac },
      { label: "Source", value: ": " + p.srcMac },
      { label: "Type", value: ": " + (etype === "0x0806" ? "ARP (0x0806)" : "IPv4 (0x0800)") },
    ],
  };
}

function ipv4Node(p: WsPacket, proto: string, rand: () => number): WsTreeNode {
  return {
    label: "Internet Protocol Version 4",
    value: ", Src: " + p.src + ", Dst: " + p.dst,
    children: [
      { label: "0100 .... = Version", value: ": 4" },
      { label: ".... 0101 = Header Length", value: ": 20 bytes (5)" },
      { label: "Total Length", value: ": " + (p.length - 14) },
      { label: "Identification", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) },
      { label: "Time to live", value: ": 64" },
      { label: "Protocol", value: ": " + proto },
      { label: "Header Checksum", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) + " [validation disabled]" },
      { label: "Source Address", value: ": " + p.src },
      { label: "Destination Address", value: ": " + p.dst },
    ],
  };
}

function tcpNode(p: WsPacket, flags: string[], seq: number, ack: number, payloadLen: number): WsTreeNode {
  return {
    label: "Transmission Control Protocol",
    value: ", Src Port: " + p.srcPort + ", Dst Port: " + p.dstPort + ", Seq: " + seq + ", Ack: " + ack + ", Len: " + payloadLen,
    children: [
      { label: "Source Port", value: ": " + p.srcPort },
      { label: "Destination Port", value: ": " + p.dstPort },
      { label: "Stream index", value: ": " + p.stream },
      { label: "Sequence Number", value: ": " + seq },
      { label: "Acknowledgment Number", value: ": " + ack },
      { label: "Flags", value: ": (" + flags.join(", ") + ")", children: flags.map((f) => ({ label: f, value: ": Set" })) },
      { label: "Window", value: ": 64240" },
    ],
  };
}

function udpNode(p: WsPacket, len: number): WsTreeNode {
  return {
    label: "User Datagram Protocol",
    value: ", Src Port: " + p.srcPort + ", Dst Port: " + p.dstPort,
    children: [
      { label: "Source Port", value: ": " + p.srcPort },
      { label: "Destination Port", value: ": " + p.dstPort },
      { label: "Length", value: ": " + len },
    ],
  };
}

// ----- Weighted protocol family mix (mirrors source's overall seed distribution:
// mostly TCP/HTTP/DNS/ARP, occasional TLS/ICMP, rare suspicious patterns) -----

type Family = "tcp" | "http" | "dns" | "arp" | "tls" | "icmp" | "suspicious";

const FAMILY_WEIGHTS: [Family, number][] = [
  ["tcp", 28],
  ["http", 20],
  ["dns", 20],
  ["arp", 10],
  ["tls", 10],
  ["icmp", 8],
  ["suspicious", 4],
];

function pickFamily(rand: () => number): Family {
  const total = FAMILY_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [family, weight] of FAMILY_WEIGHTS) {
    if (roll < weight) return family;
    roll -= weight;
  }
  return "tcp";
}

const CLIENTS = ["10.10.0.50", "10.10.0.51", "10.10.0.52", "10.10.0.53"];
const EXTERNAL_HOSTS = [
  { ip: "142.250.183.46", sni: "www.google.com" },
  { ip: "20.81.111.85", sni: "www.microsoft.com" },
  { ip: "1.1.1.1", sni: "one.one.one.one" },
];
const DNS_NAMES = [
  { n: "www.google.com", t: "A" },
  { n: "www.microsoft.com", t: "A" },
  { n: "login.microsoftonline.com", t: "A" },
  { n: "github.com", t: "A" },
  { n: "cloudlab.in", t: "A" },
];
const HTTP_PATHS = ["/", "/index.html", "/about", "/api/users", "/health", "/favicon.ico"];

/**
 * Finds an existing TCP-ish stream in `priorPackets` to extend, or returns null to
 * start a fresh one. Extending an existing stream keeps `follow stream` / TCP
 * conversation stats meaningful for live-captured traffic too.
 */
function findExtendableTcpStream(priorPackets: WsPacket[], rand: () => number): WsPacket | null {
  const tcpPackets = priorPackets.filter((p) => p.protocol === "TCP" || p.protocol === "HTTP");
  if (tcpPackets.length === 0) return null;
  // Look at a small recent window so live traffic tends to continue "hot" streams.
  const windowStart = Math.max(0, tcpPackets.length - 40);
  const window = tcpPackets.slice(windowStart);
  return pick(rand, window);
}

/**
 * Generates ONE new packet continuing the existing conversation model. Deterministic
 * given (nextFrameNo, seed, nowMs) — no `Math.random()`, no internal wall-clock reads.
 */
export function generateLivePacket(nextFrameNo: number, priorPackets: WsPacket[], seed: number, nowMs: number): WsPacket {
  const rand = rng(hashSeed(`live-${nextFrameNo}-${seed}`));
  const family = pickFamily(rand);

  const lastTime = priorPackets.length > 0 ? priorPackets[priorPackets.length - 1].time : 0;
  const time = lastTime + rand() * 0.5 + 0.01;
  const timeAbs = formatAbsTime(nowMs);
  const delta = priorPackets.length > 0 ? time - lastTime : 0;

  let base: {
    src: string;
    dst: string;
    protocol: string;
    length: number;
    info: string;
    color: string;
    stream: string;
    srcPort?: number;
    dstPort?: number;
    tcpFlags?: WsPacket["tcpFlags"];
    httpReq?: WsPacket["httpReq"];
    httpResp?: WsPacket["httpResp"];
    dnsQ?: string;
    dnsType?: string;
    tlsType?: string;
    suspicious?: boolean;
  };

  if (family === "arp") {
    const client = pick(rand, CLIENTS);
    const asker = "10.10.0.1";
    base = {
      src: asker,
      dst: client,
      protocol: "ARP",
      length: 60,
      info: "Who has " + client + "? Tell " + asker,
      color: "arp",
      stream: "",
    };
  } else if (family === "dns") {
    const rec = pick(rand, DNS_NAMES);
    const client = pick(rand, CLIENTS);
    const isQuery = rand() > 0.5;
    const port = 50000 + rInt(rand, 0, 10000);
    base = isQuery
      ? {
          src: client,
          dst: "10.10.0.20",
          protocol: "DNS",
          length: 70 + rec.n.length,
          srcPort: port,
          dstPort: 53,
          info: "Standard query 0x" + hex(rInt(rand, 0, 65535), 4) + " " + rec.t + " " + rec.n,
          color: "dns",
          stream: "dns-" + client + "-" + rec.n,
          dnsQ: rec.n,
          dnsType: rec.t,
        }
      : {
          src: "10.10.0.20",
          dst: client,
          protocol: "DNS",
          length: 86 + rec.n.length,
          srcPort: 53,
          dstPort: port,
          info: "Standard query response 0x" + hex(rInt(rand, 0, 65535), 4) + " " + rec.t + " " + rec.n,
          color: "dns",
          stream: "dns-" + client + "-" + rec.n,
          dnsQ: rec.n,
          dnsType: rec.t,
        };
  } else if (family === "icmp") {
    const client = pick(rand, CLIENTS);
    const isReq = rand() > 0.5;
    base = isReq
      ? { src: client, dst: "8.8.8.8", protocol: "ICMP", length: 98, info: "Echo (ping) request  id=0x0001, ttl=64", color: "icmp", stream: "" }
      : { src: "8.8.8.8", dst: client, protocol: "ICMP", length: 98, info: "Echo (ping) reply    id=0x0001, ttl=119", color: "icmp", stream: "" };
  } else if (family === "tls") {
    const client = pick(rand, CLIENTS);
    const ext = pick(rand, EXTERNAL_HOSTS);
    const port = 49300 + rInt(rand, 0, 4000);
    base = {
      src: client,
      dst: ext.ip,
      protocol: "TLSv1.3",
      srcPort: port,
      dstPort: 443,
      length: 580 + rInt(rand, 0, 400),
      info: "Application Data",
      color: "tls",
      stream: "tls-live-" + client + "-" + ext.ip,
      tlsType: "ApplicationData",
    };
  } else if (family === "suspicious") {
    const attacker = "23.45.67.89";
    const target = pick(rand, CLIENTS);
    const port = 20000 + rInt(rand, 0, 40000);
    base = {
      src: attacker,
      dst: target,
      protocol: "TCP",
      srcPort: port,
      dstPort: pick(rand, [22, 445, 3389, 5985]),
      length: 60,
      info: "[SYN, port scan] " + port + "  >  " + pick(rand, [22, 445, 3389, 5985]) + " [SYN] Seq=0 Win=1024 Len=0",
      color: "suspicious",
      stream: "suspicious-live-" + attacker + "-" + target,
      suspicious: true,
      tcpFlags: { syn: true },
    };
  } else if (family === "http") {
    const extendable = findExtendableTcpStream(priorPackets, rand);
    const client = extendable ? extendable.src.startsWith("10.10.0.5") ? extendable.src : pick(rand, CLIENTS) : pick(rand, CLIENTS);
    const path = pick(rand, HTTP_PATHS);
    const isReq = rand() > 0.5;
    const streamKey = extendable?.stream || "tcp-live-" + client;
    const port = extendable?.srcPort && extendable.src === client ? extendable.srcPort : 50000 + rInt(rand, 0, 10000);
    base = isReq
      ? {
          src: client,
          dst: "10.10.0.15",
          protocol: "HTTP",
          srcPort: port,
          dstPort: 80,
          length: 180 + rInt(rand, 0, 200),
          info: "GET " + path + " HTTP/1.1 ",
          color: "http",
          stream: streamKey,
          httpReq: { method: "GET", host: "web01.cloudlab.in", path },
          tcpFlags: { ack: true, psh: true },
        }
      : {
          src: "10.10.0.15",
          dst: client,
          protocol: "HTTP",
          srcPort: 80,
          dstPort: port,
          length: 220 + rInt(rand, 0, 400),
          info: "HTTP/1.1 200 OK",
          color: "http",
          stream: streamKey,
          httpResp: { code: 200, text: "OK" },
          tcpFlags: { ack: true, psh: true },
        };
  } else {
    // "tcp": continue an existing stream's data-segment traffic, or start a new one.
    const extendable = findExtendableTcpStream(priorPackets, rand);
    const client = extendable ? extendable.src : pick(rand, CLIENTS);
    const server = extendable ? extendable.dst : "10.10.0.15";
    const streamKey = extendable?.stream || "tcp-live-" + client;
    const cPort = extendable?.srcPort || 49152 + rInt(rand, 0, 4000);
    const sPort = extendable?.dstPort || 80;
    const fromClient = rand() > 0.5;
    base = {
      src: fromClient ? client : server,
      dst: fromClient ? server : client,
      protocol: "TCP",
      srcPort: fromClient ? cPort : sPort,
      dstPort: fromClient ? sPort : cPort,
      length: 60 + rInt(rand, 0, 1400),
      info:
        (fromClient ? cPort : sPort) +
        "  >  " +
        (fromClient ? sPort : cPort) +
        " [ACK] Seq=" +
        rInt(rand, 1, 5000) +
        " Ack=" +
        rInt(rand, 1, 5000) +
        " Win=" +
        rInt(rand, 64, 65535) +
        " Len=" +
        rInt(rand, 0, 1400),
      color: "tcp",
      stream: streamKey,
      tcpFlags: { ack: true },
    };
  }

  const srcMac = base.protocol === "ARP" ? macFor(base.src) : macFor(base.src);
  const dstMac = macFor(base.dst);

  const p: WsPacket = {
    no: nextFrameNo,
    time,
    timeAbs,
    delta: Number(delta.toFixed(6)),
    src: base.src,
    srcMac,
    dst: base.dst,
    dstMac,
    protocol: base.protocol,
    length: base.length,
    info: base.info,
    tree: [],
    bytes: randHex(rand, base.length),
    color: base.color,
    stream: base.stream,
    tcpFlags: base.tcpFlags || {},
    httpReq: base.httpReq,
    httpResp: base.httpResp,
    dnsQ: base.dnsQ,
    dnsType: base.dnsType,
    srcPort: base.srcPort,
    dstPort: base.dstPort,
    tlsType: base.tlsType,
    suspicious: !!base.suspicious,
    marked: false,
    ignored: false,
  };

  // Build a full Frame -> Ethernet -> IPv4 -> L4 -> App dissection tree, matching the
  // static seed data's depth (never a flat/fake tree for live packets).
  const topTree: WsTreeNode[] = [];
  topTree.push(frameNode(p, delta));
  const etype = p.protocol === "ARP" ? "0x0806" : "0x0800";
  topTree.push(ethNode(p, etype));

  if (p.protocol !== "ARP") {
    let ipProto = "TCP (6)";
    if (p.protocol === "DNS") ipProto = "UDP (17)";
    if (p.protocol === "ICMP") ipProto = "ICMP (1)";
    topTree.push(ipv4Node(p, ipProto, rand));

    if (p.protocol === "TCP" || p.protocol === "HTTP" || p.protocol === "TLSv1.3") {
      let flags = ["ACK"];
      if (p.tcpFlags?.syn) flags = p.tcpFlags.ack ? ["SYN", "ACK"] : ["SYN"];
      else if (p.tcpFlags?.rst) flags = p.tcpFlags.ack ? ["RST", "ACK"] : ["RST"];
      else if (p.tcpFlags?.fin) flags = ["FIN", "ACK"];
      else if (p.tcpFlags?.psh) flags = ["PSH", "ACK"];
      topTree.push(tcpNode(p, flags, rInt(rand, 1, 100000), rInt(rand, 1, 100000), Math.max(0, p.length - 66)));

      if (p.protocol === "HTTP" && p.httpReq) {
        topTree.push({
          label: "Hypertext Transfer Protocol",
          value: "",
          children: [
            { label: p.httpReq.method + " " + p.httpReq.path + " HTTP/1.1\\r\\n", value: "" },
            { label: "Host", value: ": " + p.httpReq.host + "\\r\\n" },
          ],
        });
      } else if (p.protocol === "HTTP" && p.httpResp) {
        topTree.push({
          label: "Hypertext Transfer Protocol",
          value: "",
          children: [{ label: "HTTP/1.1 " + p.httpResp.code + " " + (p.httpResp.text || "") + "\\r\\n", value: "" }],
        });
      } else if (p.protocol === "TLSv1.3") {
        topTree.push({
          label: "Transport Layer Security",
          value: "",
          children: [{ label: "TLSv1.3 Record Layer: Application Data", value: "" }],
        });
      }
    } else if (p.protocol === "DNS") {
      topTree.push(udpNode(p, Math.max(8, p.length - 42)));
      const isResponse = /response/.test(p.info);
      topTree.push({
        label: "Domain Name System (" + (isResponse ? "response" : "query") + ")",
        value: "",
        children: [
          { label: "Transaction ID", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) },
          { label: "Questions", value: ": 1" },
          {
            label: "Queries",
            value: "",
            children: [{ label: (p.dnsQ || "") + ": type " + (p.dnsType || "A") + ", class IN", value: "" }],
          },
        ],
      });
    } else if (p.protocol === "ICMP") {
      const isReq = /request/.test(p.info);
      topTree.push({
        label: "Internet Control Message Protocol",
        value: "",
        children: [
          { label: "Type", value: isReq ? ": 8 (Echo (ping) request)" : ": 0 (Echo (ping) reply)" },
          { label: "Code", value: ": 0" },
        ],
      });
    }
  } else {
    topTree.push({
      label: "Address Resolution Protocol (request)",
      value: "",
      children: [
        { label: "Hardware type", value: ": Ethernet (1)" },
        { label: "Protocol type", value: ": IPv4 (0x0800)" },
        { label: "Opcode", value: ": request (1)" },
        { label: "Sender IP address", value: ": " + p.src },
        { label: "Target IP address", value: ": " + p.dst },
      ],
    });
  }

  if (p.suspicious) {
    topTree.push({ label: "[Suspicious: live-captured anomalous traffic]", value: "" });
  }

  p.tree = topTree;

  return p;
}
