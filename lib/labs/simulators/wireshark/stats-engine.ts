// ===== WIRESHARK SIMULATOR — STATISTICS ENGINE =====
// Ports the real computation logic (NOT the DOM-rendering) from
// itbd-lab/simulators/wireshark/js/wireshark-stats.js into pure, typed functions
// operating on `WsPacket[]`. The UI agent owns rendering (tables/canvases); these
// functions only produce the data.

import type { WsConversation, WsEndpoint, WsIoGraphBucket, WsPacket, WsProtocolHierarchyNode } from "./types";

const TCP_LIKE_PROTOCOLS = ["TCP", "HTTP", "HTTPS", "TLSv1.2", "TLSv1.3", "SMB2", "LDAP", "KRB5", "BGP"];
const UDP_LIKE_PROTOCOLS = ["UDP", "DNS", "DHCP", "MDNS", "NBNS", "SSDP", "ISAKMP", "SNMP"];

// ----- Protocol Hierarchy -----

type HierarchyAccum = {
  name: string;
  packets: number;
  bytes: number;
  children: Map<string, HierarchyAccum>;
};

function makeAccum(name: string): HierarchyAccum {
  return { name, packets: 0, bytes: 0, children: new Map() };
}

/** Ports source's getProtocolHierarchy(): builds a Frame > Ethernet > ... chain per packet. */
export function getProtocolHierarchy(packets: WsPacket[]): WsProtocolHierarchyNode[] {
  if (packets.length === 0) return [];

  const totalPackets = packets.length;
  const totalBytes = packets.reduce((s, p) => s + p.length, 0);

  const root = makeAccum("Frame");
  packets.forEach((p) => {
    root.packets++;
    root.bytes += p.length;

    const chain: string[] = ["Ethernet"];
    if (p.protocol === "ARP") chain.push("Address Resolution Protocol");
    else if (p.protocol === "STP") chain.push("Spanning Tree Protocol");
    else if (p.protocol === "CDP") chain.push("Cisco Discovery Protocol");
    else if (p.protocol === "LLDP") chain.push("Link Layer Discovery Protocol");
    else {
      chain.push("Internet Protocol Version 4");
      if (UDP_LIKE_PROTOCOLS.indexOf(p.protocol) !== -1) {
        chain.push("User Datagram Protocol");
        if (p.protocol === "DHCP") chain.push("Dynamic Host Configuration Protocol");
        else if (p.protocol === "DNS") chain.push("Domain Name System");
        else if (p.protocol === "MDNS") chain.push("Multicast Domain Name System");
        else if (p.protocol === "NBNS") chain.push("NetBIOS Name Service");
        else if (p.protocol === "SSDP") chain.push("Simple Service Discovery Protocol");
        else if (p.protocol === "ISAKMP") chain.push("Internet Security Association and Key Management Protocol");
      } else if (p.protocol === "ICMP") chain.push("Internet Control Message Protocol");
      else if (p.protocol === "OSPF") chain.push("Open Shortest Path First");
      else if (p.protocol === "ESP") chain.push("Encapsulating Security Payload");
      else {
        chain.push("Transmission Control Protocol");
        if (p.protocol === "HTTP") chain.push("Hypertext Transfer Protocol");
        else if (p.protocol === "TLSv1.3" || p.protocol === "TLSv1.2") chain.push("Transport Layer Security");
        else if (p.protocol === "SMB2") chain.push("SMB2 (Server Message Block 2)");
        else if (p.protocol === "LDAP") chain.push("Lightweight Directory Access Protocol");
        else if (p.protocol === "KRB5") chain.push("Kerberos");
        else if (p.protocol === "BGP") chain.push("Border Gateway Protocol");
      }
    }

    let node = root;
    chain.forEach((layer) => {
      let child = node.children.get(layer);
      if (!child) {
        child = makeAccum(layer);
        node.children.set(layer, child);
      }
      child.packets++;
      child.bytes += p.length;
      node = child;
    });
  });

  function flatten(node: HierarchyAccum): WsProtocolHierarchyNode[] {
    return Array.from(node.children.values()).map((c) => ({
      protocol: c.name,
      packets: c.packets,
      bytes: c.bytes,
      pctPackets: totalPackets > 0 ? (c.packets / totalPackets) * 100 : 0,
      pctBytes: totalBytes > 0 ? (c.bytes / totalBytes) * 100 : 0,
      children: flatten(c),
    }));
  }

  return flatten(root);
}

// ----- Conversations -----

type Layer = "eth" | "ipv4" | "tcp" | "udp";

function conversationEndpoints(p: WsPacket, layer: Layer): [string, string] | null {
  if (layer === "eth") return [p.srcMac, p.dstMac];
  if (layer === "ipv4") return [p.src, p.dst];
  if (layer === "tcp") {
    if (TCP_LIKE_PROTOCOLS.indexOf(p.protocol) === -1) return null;
    return [`${p.src}:${p.srcPort}`, `${p.dst}:${p.dstPort}`];
  }
  if (layer === "udp") {
    if (UDP_LIKE_PROTOCOLS.indexOf(p.protocol) === -1) return null;
    return [`${p.src}:${p.srcPort}`, `${p.dst}:${p.dstPort}`];
  }
  return null;
}

/** Ports source's getConversations(layer) across all 4 layers in one pass. */
export function getConversations(packets: WsPacket[]): WsConversation[] {
  const layers: Layer[] = ["eth", "ipv4", "tcp", "udp"];
  const out: WsConversation[] = [];

  layers.forEach((layer) => {
    const map = new Map<
      string,
      { a: string; b: string; packetsAtoB: number; packetsBtoA: number; bytesAtoB: number; bytesBtoA: number; relStart: number; lastTs: number }
    >();
    packets.forEach((p) => {
      const endpoints = conversationEndpoints(p, layer);
      if (!endpoints) return;
      const [a0, b0] = endpoints;
      const a = a0 < b0 ? a0 : b0;
      const b = a0 < b0 ? b0 : a0;
      const key = `${a}|${b}`;
      let conv = map.get(key);
      if (!conv) {
        conv = { a, b, packetsAtoB: 0, packetsBtoA: 0, bytesAtoB: 0, bytesBtoA: 0, relStart: p.time, lastTs: p.time };
        map.set(key, conv);
      }
      if (a0 === conv.a) {
        conv.packetsAtoB++;
        conv.bytesAtoB += p.length;
      } else {
        conv.packetsBtoA++;
        conv.bytesBtoA += p.length;
      }
      conv.lastTs = p.time;
    });
    map.forEach((c) => {
      out.push({
        key: `${layer}:${c.a}|${c.b}`,
        layer,
        a: c.a,
        b: c.b,
        packetsAtoB: c.packetsAtoB,
        packetsBtoA: c.packetsBtoA,
        bytesAtoB: c.bytesAtoB,
        bytesBtoA: c.bytesBtoA,
        duration: c.lastTs - c.relStart,
      });
    });
  });

  return out;
}

// ----- Endpoints -----

function endpointAddrs(p: WsPacket, layer: Layer): [string, string] | null {
  if (layer === "eth") return [p.srcMac, p.dstMac];
  if (layer === "ipv4") return [p.src, p.dst];
  if (layer === "tcp") {
    if (TCP_LIKE_PROTOCOLS.indexOf(p.protocol) === -1) return null;
    return [`${p.src}:${p.srcPort}`, `${p.dst}:${p.dstPort}`];
  }
  if (layer === "udp") {
    if (UDP_LIKE_PROTOCOLS.indexOf(p.protocol) === -1) return null;
    return [`${p.src}:${p.srcPort}`, `${p.dst}:${p.dstPort}`];
  }
  return null;
}

/** Ports source's getEndpoints(layer) across all 4 layers in one pass. */
export function getEndpoints(packets: WsPacket[]): WsEndpoint[] {
  const layers: Layer[] = ["eth", "ipv4", "tcp", "udp"];
  const out: WsEndpoint[] = [];

  layers.forEach((layer) => {
    const map = new Map<string, { packets: number; bytes: number; txPackets: number; rxPackets: number }>();
    packets.forEach((p) => {
      const addrs = endpointAddrs(p, layer);
      if (!addrs) return;
      const [src, dst] = addrs;
      if (src) {
        const e = map.get(src) || { packets: 0, bytes: 0, txPackets: 0, rxPackets: 0 };
        e.packets++;
        e.bytes += p.length;
        e.txPackets++;
        map.set(src, e);
      }
      if (dst) {
        const e = map.get(dst) || { packets: 0, bytes: 0, txPackets: 0, rxPackets: 0 };
        e.packets++;
        e.bytes += p.length;
        e.rxPackets++;
        map.set(dst, e);
      }
    });
    map.forEach((e, address) => {
      out.push({ layer, address, packets: e.packets, bytes: e.bytes, txPackets: e.txPackets, rxPackets: e.rxPackets });
    });
  });

  return out;
}

// ----- Packet length histogram -----

const LENGTH_BUCKETS: [string, (n: number) => boolean][] = [
  ["0-19", (n) => n < 20],
  ["20-39", (n) => n >= 20 && n < 40],
  ["40-79", (n) => n >= 40 && n < 80],
  ["80-159", (n) => n >= 80 && n < 160],
  ["160-319", (n) => n >= 160 && n < 320],
  ["320-639", (n) => n >= 320 && n < 640],
  ["640-1279", (n) => n >= 640 && n < 1280],
  ["1280-2559", (n) => n >= 1280 && n < 2560],
  ["2560+", (n) => n >= 2560],
];

/** Ports source's renderPacketLengths()'s bucketing (math only, no HTML). */
export function getPacketLengthHistogram(packets: WsPacket[]): { bucket: string; count: number }[] {
  const counts = LENGTH_BUCKETS.map(() => 0);
  packets.forEach((p) => {
    for (let i = 0; i < LENGTH_BUCKETS.length; i++) {
      if (LENGTH_BUCKETS[i][1](p.length)) {
        counts[i]++;
        break;
      }
    }
  });
  return LENGTH_BUCKETS.map(([bucket], i) => ({ bucket, count: counts[i] }));
}

// ----- I/O graph bucketing -----

/** Ports source's renderIoGraph()'s bucketing (math only, no canvas). */
export function getIoGraphBuckets(packets: WsPacket[], bucketSeconds: number): WsIoGraphBucket[] {
  if (packets.length === 0 || bucketSeconds <= 0) return [];
  const t0 = packets[0].time;
  const tN = packets[packets.length - 1].time;
  const numBuckets = Math.max(1, Math.ceil((tN - t0) / bucketSeconds) + 1);
  const buckets: WsIoGraphBucket[] = [];
  for (let i = 0; i < numBuckets; i++) {
    buckets.push({ bucketStart: t0 + i * bucketSeconds, packets: 0, bytes: 0 });
  }
  packets.forEach((p) => {
    const idx = Math.min(numBuckets - 1, Math.max(0, Math.floor((p.time - t0) / bucketSeconds)));
    buckets[idx].packets++;
    buckets[idx].bytes += p.length;
  });
  return buckets;
}

// ----- DNS stats -----

/** Ports source's getDnsStats()'s byType tally (query-type breakdown only). */
export function getDnsStats(packets: WsPacket[]): { queryType: string; count: number }[] {
  const byType = new Map<string, number>();
  packets.forEach((p) => {
    if (p.protocol !== "DNS" && p.protocol !== "MDNS") return;
    if (p.dnsType) byType.set(p.dnsType, (byType.get(p.dnsType) || 0) + 1);
  });
  return Array.from(byType.entries())
    .map(([queryType, count]) => ({ queryType, count }))
    .sort((a, b) => b.count - a.count);
}

// ----- HTTP stats -----

/** Ports source's getHttpStats()'s byMethod tally. */
export function getHttpStats(packets: WsPacket[]): { method: string; count: number }[] {
  const byMethod = new Map<string, number>();
  packets.forEach((p) => {
    if (p.protocol !== "HTTP" || !p.httpReq) return;
    byMethod.set(p.httpReq.method, (byMethod.get(p.httpReq.method) || 0) + 1);
  });
  return Array.from(byMethod.entries())
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);
}

/** Ports source's getHttpStats()'s byCode tally, split out as its own function per spec. */
export function getHttpResponseCodeStats(packets: WsPacket[]): { code: number; count: number }[] {
  const byCode = new Map<number, number>();
  packets.forEach((p) => {
    if (p.protocol !== "HTTP" || !p.httpResp) return;
    byCode.set(p.httpResp.code, (byCode.get(p.httpResp.code) || 0) + 1);
  });
  return Array.from(byCode.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code - b.code);
}

// ----- Follow stream -----

/** Strips non-printable bytes the way source's asciiOf() + follow-stream cleanup did. */
function cleanAscii(hexBytes: string, fromByteOffset: number): string {
  let out = "";
  for (let i = fromByteOffset * 2; i < hexBytes.length; i += 2) {
    const byte = parseInt(hexBytes.substr(i, 2), 16);
    out += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".";
  }
  return out;
}

/**
 * Ports source's followStream(): reconstructs a TCP/UDP stream's conversation as an
 * ordered list of client/server "sides", preferring the clean `httpReq`/`httpResp`
 * text (matching source's approach of synthesizing readable HTTP text) and falling
 * back to a cleaned ASCII rendering of the raw bytes for non-HTTP packets.
 */
export function followStream(packets: WsPacket[], streamKey: string): { side: "client" | "server"; text: string }[] {
  const pkts = packets.filter((p) => p.stream === streamKey);
  if (pkts.length === 0) return [];

  const clientIp = pkts[0].src;

  const out: { side: "client" | "server"; text: string }[] = [];
  pkts.forEach((p) => {
    const side: "client" | "server" = p.src === clientIp ? "client" : "server";

    if (p.httpReq) {
      out.push({ side, text: `${p.httpReq.method} ${p.httpReq.path} HTTP/1.1\nHost: ${p.httpReq.host}\n\n` });
      return;
    }
    if (p.httpResp) {
      out.push({
        side,
        text: `HTTP/1.1 ${p.httpResp.code} ${p.httpResp.text || ""}\nServer: Apache/2.4.52\nContent-Type: text/html\n\n`,
      });
      return;
    }
    // Non-HTTP: fall back to a cleaned ASCII rendering of bytes past the Ethernet+IP+L4
    // header region (54 bytes, matching source's `p.bytes.substr(54 * 2)`).
    const ascii = cleanAscii(p.bytes, 54);
    const clean = ascii.replace(/[^\x20-\x7e\n]/g, ".").slice(0, 200);
    if (clean.trim()) out.push({ side, text: clean + "\n" });
  });

  return out;
}
