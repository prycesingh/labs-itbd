// ===== WIRESHARK SIMULATOR — SEED DATA =====
// Ports itbd-lab/simulators/wireshark/js/wireshark-data.js's ~455-packet pre-seeded
// capture (17 seedX() functions) into a typed, deterministic `freshWiresharkState()`.
//
// Source used `Math.random()` throughout (MACs, hex payload bytes, checksums, IDs,
// jitter). Per the porting convention shared by every prior simulator, this file uses
// ONLY a seeded LCG (never `Math.random()`, never `Date.now()`/`new Date()`) so the
// capture is stable across reloads yet not hardcoded byte-for-byte.

import type {
  WiresharkState,
  WsColoringRule,
  WsInterface,
  WsPrefs,
  WsProfile,
  WsSavedFilter,
  WsTreeNode,
  WsPacket,
  WsTcpFlags,
} from "./types";

// ----- Deterministic seeded PRNG (shared convention across every port) -----

function rng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Stable string -> 31-bit seed hash (djb2 variant), used to derive a per-entity RNG seed. */
function hashSeed(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33 + input.charCodeAt(i)) & 0x7fffffff;
  }
  return h === 0 ? 1 : h;
}

// ----- Small formatting helpers (ported from source's pad()/hex()) -----

function pad(n: number, w: number): string {
  let s = String(n);
  while (s.length < w) s = "0" + s;
  return s;
}

function hex(n: number, w: number): string {
  let s = Math.trunc(n).toString(16);
  while (s.length < w) s = "0" + s;
  return s;
}

/** Seeded replacement for source's `r(min,max)` (Math.random-based). */
function rInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randMac(rand: () => number, prefix?: string): string {
  return (
    (prefix || "00:1c:b3") +
    ":" +
    hex(rInt(rand, 0, 255), 2) +
    ":" +
    hex(rInt(rand, 0, 255), 2) +
    ":" +
    hex(rInt(rand, 0, 255), 2)
  );
}

function randHex(rand: () => number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += hex(rInt(rand, 0, 255), 2);
  return s;
}

function asciiToHex(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += hex(s.charCodeAt(i) & 0xff, 2);
  return out;
}

// ----- Hosts and identities (CloudLab Inc. shared roster convention) -----

type Host = { ip: string; mac: string; name: string; role: string };

export const HOSTS: Host[] = [
  { ip: "10.10.0.1", mac: "00:1c:b3:aa:11:01", name: "gw.cloudlab.in", role: "router" },
  { ip: "10.10.0.5", mac: "00:1c:b3:aa:11:05", name: "dc01.cloudlab.in", role: "dc" },
  { ip: "10.10.0.10", mac: "00:1c:b3:aa:11:0a", name: "fs01.cloudlab.in", role: "fileserver" },
  { ip: "10.10.0.15", mac: "00:1c:b3:aa:11:0f", name: "web01.cloudlab.in", role: "web" },
  { ip: "10.10.0.20", mac: "00:1c:b3:aa:11:14", name: "dns01.cloudlab.in", role: "dns" },
  { ip: "10.10.0.25", mac: "00:1c:b3:aa:11:19", name: "dhcp01.cloudlab.in", role: "dhcp" },
  { ip: "10.10.0.50", mac: "00:1c:b3:bb:22:32", name: "win10-ankit", role: "client" },
  { ip: "10.10.0.51", mac: "00:1c:b3:bb:22:33", name: "win10-priya", role: "client" },
  { ip: "10.10.0.52", mac: "00:1c:b3:bb:22:34", name: "win10-vikram", role: "client" },
  { ip: "10.10.0.53", mac: "00:1c:b3:bb:22:35", name: "mac-sneha", role: "client" },
  { ip: "10.10.0.100", mac: "00:1c:b3:cc:33:64", name: "printer-hr", role: "printer" },
  { ip: "10.10.0.200", mac: "00:1c:b3:cc:33:c8", name: "cam-lobby", role: "iot" },
  { ip: "8.8.8.8", mac: "00:1c:b3:aa:11:01", name: "dns.google", role: "external" },
  { ip: "1.1.1.1", mac: "00:1c:b3:aa:11:01", name: "one.one.one.one", role: "external" },
  { ip: "142.250.183.46", mac: "00:1c:b3:aa:11:01", name: "www.google.com", role: "external" },
  { ip: "20.81.111.85", mac: "00:1c:b3:aa:11:01", name: "azure-edge", role: "external" },
  { ip: "23.45.67.89", mac: "00:1c:b3:aa:11:01", name: "evil.example.com", role: "external" },
];

function host(ip: string): Host | null {
  for (const h of HOSTS) if (h.ip === ip) return h;
  return null;
}

function macFor(rand: () => number, ip: string): string {
  const h = host(ip);
  return h ? h.mac : randMac(rand);
}

const BROADCAST_MAC = "ff:ff:ff:ff:ff:ff";
const BROADCAST_IP = "255.255.255.255";
const MCAST_MDNS_MAC = "01:00:5e:00:00:fb";
const MCAST_MDNS_IP = "224.0.0.251";
const MCAST_SSDP_MAC = "01:00:5e:7f:ff:fa";
const MCAST_SSDP_IP = "239.255.255.250";

// A fixed "capture start" instant so every derived Arrival Time is stable across
// reloads without ever calling `Date.now()`/`new Date()` inside this module. Chosen
// as an arbitrary but fixed epoch millis value (source used `Date.now() - 5min`; we
// pin an equivalent fixed moment instead so the seed is fully deterministic).
const CAPTURE_START_MS = 1750000000000; // 2025-06-15T08:26:40.000Z (fixed anchor)

// ----- Packet spec used while building the seed (pre-dissection-tree) -----

type PacketSpec = {
  src?: string;
  srcMac?: string;
  dst?: string;
  dstMac?: string;
  protocol: string;
  length?: number;
  info: string;
  tree?: WsTreeNode[];
  bytes?: string;
  color?: string;
  stream?: string;
  tcpFlags?: WsTcpFlags;
  httpReq?: WsPacket["httpReq"];
  httpResp?: WsPacket["httpResp"];
  dnsQ?: string;
  dnsType?: string;
  srcPort?: number;
  dstPort?: number;
  tlsType?: string;
  suspicious?: boolean;
};

/** Builder — mirrors source's closures (clock/frameCounter/packets) inside one function scope. */
function buildSeedPackets(): WsPacket[] {
  const packets: WsPacket[] = [];
  let frameCounter = 0;
  let clock = 0.0;

  function nextTs(rand: () => number): number {
    clock += rand() * 0.012 + 0.001;
    return clock;
  }

  function absTs(rel: number): string {
    const d = new Date(CAPTURE_START_MS + rel * 1000);
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

  function makePacket(spec: PacketSpec): WsPacket {
    frameCounter++;
    const rand = rng(hashSeed(`ws-seed-${frameCounter}-${spec.protocol}-${spec.info}`));
    const rel = nextTs(rand);
    const length = spec.length ?? rInt(rand, 60, 1500);
    const dstMac =
      spec.dstMac ||
      (spec.dst === BROADCAST_IP
        ? BROADCAST_MAC
        : spec.dst === MCAST_MDNS_IP
          ? MCAST_MDNS_MAC
          : spec.dst === MCAST_SSDP_IP
            ? MCAST_SSDP_MAC
            : spec.dst
              ? macFor(rand, spec.dst)
              : randMac(rand));
    const prevTime = packets.length > 0 ? packets[packets.length - 1].time : 0;
    const p: WsPacket = {
      no: frameCounter,
      time: rel,
      timeAbs: absTs(rel),
      delta: frameCounter === 1 ? 0 : Number((rel - prevTime).toFixed(6)),
      src: spec.src ?? "",
      srcMac: spec.srcMac || (spec.src ? macFor(rand, spec.src) : randMac(rand)),
      dst: spec.dst ?? "",
      dstMac,
      protocol: spec.protocol,
      length,
      info: spec.info,
      tree: spec.tree || [],
      bytes: spec.bytes || randHex(rand, length),
      color: spec.color || "default",
      stream: spec.stream ?? "",
      tcpFlags: spec.tcpFlags || {},
      httpReq: spec.httpReq,
      httpResp: spec.httpResp,
      dnsQ: spec.dnsQ,
      dnsType: spec.dnsType,
      srcPort: spec.srcPort,
      dstPort: spec.dstPort,
      tlsType: spec.tlsType,
      suspicious: !!spec.suspicious,
      marked: false,
      ignored: false,
    };
    packets.push(p);
    return p;
  }

  // ----- Dissection tree node builders (Frame/Ethernet/IPv4/TCP/UDP) -----

  function flagsToByte(flags: string[]): number {
    let b = 0;
    flags.forEach((f) => {
      if (f === "FIN") b |= 1;
      if (f === "SYN") b |= 2;
      if (f === "RST") b |= 4;
      if (f === "PSH") b |= 8;
      if (f === "ACK") b |= 16;
      if (f === "URG") b |= 32;
    });
    return b;
  }

  function frameNode(p: WsPacket): WsTreeNode {
    return {
      label: "Frame " + p.no,
      value: ": " + p.length + " bytes on wire, " + p.length + " bytes captured",
      children: [
        { label: "Interface id", value: ": 0 (eth0)" },
        { label: "Encapsulation type", value: ": Ethernet (1)" },
        { label: "Arrival Time", value: ": " + p.timeAbs + " UTC" },
        { label: "Epoch Time", value: ": " + ((CAPTURE_START_MS + p.time * 1000) / 1000).toFixed(6) },
        { label: "Time delta from previous captured frame", value: ": " + p.delta.toFixed(6) + " seconds" },
        { label: "Time since reference or first frame", value: ": " + p.time.toFixed(6) + " seconds" },
        { label: "Frame Number", value: ": " + p.no },
        { label: "Frame Length", value: ": " + p.length + " bytes (" + p.length * 8 + " bits)" },
        { label: "Capture Length", value: ": " + p.length + " bytes" },
        { label: "Frame is marked", value: ": " + (p.marked ? "True" : "False") },
        { label: "Frame is ignored", value: ": " + (p.ignored ? "True" : "False") },
      ],
    };
  }

  function ethNode(p: WsPacket, etype: string): WsTreeNode {
    const typeLabel =
      etype === "0x0800"
        ? "IPv4 (0x0800)"
        : etype === "0x0806"
          ? "ARP (0x0806)"
          : etype === "0x86DD"
            ? "IPv6 (0x86DD)"
            : etype === "0x8100"
              ? "802.1Q Virtual LAN (0x8100)"
              : etype === "0x88CC"
                ? "LLDP (0x88CC)"
                : etype === "0x2000"
                  ? "CDP (0x2000)"
                  : etype;
    return {
      label: "Ethernet II",
      value: ", Src: " + p.srcMac + ", Dst: " + p.dstMac,
      children: [
        { label: "Destination", value: ": " + p.dstMac },
        { label: "Source", value: ": " + p.srcMac },
        { label: "Type", value: ": " + typeLabel },
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
        { label: "Differentiated Services Field", value: ": 0x00 (DSCP: CS0, ECN: Not-ECT)" },
        { label: "Total Length", value: ": " + (p.length - 14) },
        { label: "Identification", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) + " (" + rInt(rand, 0, 65535) + ")" },
        {
          label: "Flags",
          value: ": 0x4000, Don't fragment",
          children: [
            { label: "0... .... .... .... = Reserved bit", value: ": Not set" },
            { label: ".1.. .... .... .... = Don't fragment", value: ": Set" },
            { label: "..0. .... .... .... = More fragments", value: ": Not set" },
            { label: "...0 0000 0000 0000 = Fragment offset", value: ": 0" },
          ],
        },
        { label: "Time to live", value: ": 64" },
        { label: "Protocol", value: ": " + proto },
        { label: "Header Checksum", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) + " [validation disabled]" },
        { label: "Source Address", value: ": " + p.src },
        { label: "Destination Address", value: ": " + p.dst },
      ],
    };
  }

  function tcpNode(
    p: WsPacket,
    opts: { flags?: string[]; seq?: number; ack?: number; payloadLen?: number; win?: number },
    rand: () => number,
  ): WsTreeNode {
    const flags = opts.flags || ["ACK"];
    const seq = opts.seq ?? rInt(rand, 1, 100000);
    const ack = opts.ack ?? rInt(rand, 1, 100000);
    return {
      label: "Transmission Control Protocol",
      value:
        ", Src Port: " +
        p.srcPort +
        ", Dst Port: " +
        p.dstPort +
        ", Seq: " +
        seq +
        ", Ack: " +
        ack +
        ", Len: " +
        (opts.payloadLen || 0),
      children: [
        { label: "Source Port", value: ": " + p.srcPort },
        { label: "Destination Port", value: ": " + p.dstPort },
        { label: "Stream index", value: ": " + (p.stream || 0) },
        { label: "TCP Segment Len", value: ": " + (opts.payloadLen || 0) },
        { label: "Sequence Number", value: ": " + seq },
        { label: "Acknowledgment Number", value: ": " + ack },
        { label: "Header Length", value: ": 20 bytes (5)" },
        {
          label: "Flags",
          value: ": 0x" + hex(flagsToByte(flags), 3) + " (" + flags.join(", ") + ")",
          children: flags.map((f) => ({ label: f, value: ": Set" })),
        },
        { label: "Window", value: ": " + (opts.win || 65535) },
        { label: "Checksum", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) + " [unverified]" },
        { label: "Urgent Pointer", value: ": 0" },
      ],
    };
  }

  function udpNode(p: WsPacket, opts: { len?: number }, rand: () => number): WsTreeNode {
    return {
      label: "User Datagram Protocol",
      value: ", Src Port: " + p.srcPort + ", Dst Port: " + p.dstPort,
      children: [
        { label: "Source Port", value: ": " + p.srcPort },
        { label: "Destination Port", value: ": " + p.dstPort },
        { label: "Length", value: ": " + (opts.len || 64) },
        { label: "Checksum", value: ": 0x" + hex(rInt(rand, 0, 65535), 4) + " [unverified]" },
      ],
    };
  }

  // ===== 1) DHCP exchange (DISCOVER/OFFER/REQUEST/ACK) x 2 =====
  function seedDhcp() {
    const clients = [
      { ip: "10.10.0.50", mac: "00:1c:b3:bb:22:32", name: "win10-ankit" },
      { ip: "10.10.0.51", mac: "00:1c:b3:bb:22:33", name: "win10-priya" },
    ];
    clients.forEach((c) => {
      const rTxn = rng(hashSeed(`dhcp-txn-${c.mac}`));
      const txnId = "0x" + hex(rInt(rTxn, 0, 65535), 8);
      makePacket({
        src: "0.0.0.0",
        dst: BROADCAST_IP,
        srcMac: c.mac,
        dstMac: BROADCAST_MAC,
        protocol: "DHCP",
        length: 342,
        srcPort: 68,
        dstPort: 67,
        info: "DHCP Discover - Transaction ID " + txnId,
        color: "broadcast",
        stream: "dhcp-" + c.mac,
        tree: [
          {
            label: "Dynamic Host Configuration Protocol (Discover)",
            value: "",
            children: [
              { label: "Message type", value: ": Boot Request (1)" },
              { label: "Hardware type", value: ": Ethernet (0x01)" },
              { label: "Hardware address length", value: ": 6" },
              { label: "Hops", value: ": 0" },
              { label: "Transaction ID", value: ": " + txnId },
              { label: "Client MAC address", value: ": " + c.mac },
              { label: "DHCP Option: DHCP Message Type", value: ": Discover (53)" },
              { label: "DHCP Option: Host Name", value: ": " + c.name },
              { label: "DHCP Option: Parameter Request List", value: ": Subnet, Router, DNS, Domain Name" },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.25",
        dst: BROADCAST_IP,
        srcMac: "00:1c:b3:aa:11:19",
        dstMac: BROADCAST_MAC,
        protocol: "DHCP",
        length: 342,
        srcPort: 67,
        dstPort: 68,
        info: "DHCP Offer    - Offered " + c.ip,
        color: "broadcast",
        stream: "dhcp-" + c.mac,
        tree: [
          {
            label: "Dynamic Host Configuration Protocol (Offer)",
            value: "",
            children: [
              { label: "Message type", value: ": Boot Reply (2)" },
              { label: "Your (client) IP address", value: ": " + c.ip },
              { label: "DHCP Option: Subnet Mask", value: ": 255.255.255.0" },
              { label: "DHCP Option: Router", value: ": 10.10.0.1" },
              { label: "DHCP Option: Domain Name Server", value: ": 10.10.0.20" },
              { label: "DHCP Option: IP Address Lease Time", value: ": 1 day (86400s)" },
              { label: "DHCP Option: DHCP Server Identifier", value: ": 10.10.0.25" },
            ],
          },
        ],
      });
      makePacket({
        src: "0.0.0.0",
        dst: BROADCAST_IP,
        srcMac: c.mac,
        dstMac: BROADCAST_MAC,
        protocol: "DHCP",
        length: 342,
        srcPort: 68,
        dstPort: 67,
        info: "DHCP Request  - Requested " + c.ip,
        color: "broadcast",
        stream: "dhcp-" + c.mac,
        tree: [
          {
            label: "Dynamic Host Configuration Protocol (Request)",
            value: "",
            children: [
              { label: "DHCP Option: DHCP Message Type", value: ": Request (53)" },
              { label: "DHCP Option: Requested IP Address", value: ": " + c.ip },
              { label: "DHCP Option: DHCP Server Identifier", value: ": 10.10.0.25" },
              { label: "DHCP Option: Host Name", value: ": " + c.name },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.25",
        dst: c.ip,
        srcMac: "00:1c:b3:aa:11:19",
        dstMac: c.mac,
        protocol: "DHCP",
        length: 342,
        srcPort: 67,
        dstPort: 68,
        info: "DHCP ACK      - Confirmed " + c.ip,
        color: "default",
        stream: "dhcp-" + c.mac,
        tree: [
          {
            label: "Dynamic Host Configuration Protocol (ACK)",
            value: "",
            children: [
              { label: "Message type", value: ": Boot Reply (2)" },
              { label: "Your (client) IP address", value: ": " + c.ip },
              { label: "DHCP Option: DHCP Message Type", value: ": ACK (53)" },
              { label: "DHCP Option: IP Address Lease Time", value: ": 1 day (86400s)" },
            ],
          },
        ],
      });
    });
  }

  // ===== 2) DNS queries + responses (60) =====
  function seedDns() {
    const names = [
      { n: "www.google.com", t: "A", a: "142.250.183.46" },
      { n: "www.microsoft.com", t: "A", a: "20.81.111.85" },
      { n: "login.microsoftonline.com", t: "A", a: "20.190.190.132" },
      { n: "graph.microsoft.com", t: "A", a: "20.190.135.50" },
      { n: "github.com", t: "A", a: "140.82.121.4" },
      { n: "mail.google.com", t: "CNAME", a: "googlemail.l.google.com" },
      { n: "cloudlab.in", t: "A", a: "52.222.95.83" },
      { n: "itbd.net", t: "A", a: "52.222.95.83" },
      { n: "aad.azuread.com", t: "AAAA", a: "2620:1ec:8f8::1" },
      { n: "_ldap._tcp.cloudlab.in", t: "SRV", a: "dc01.cloudlab.in:389" },
      { n: "_kerberos._tcp.cloudlab.in", t: "SRV", a: "dc01.cloudlab.in:88" },
      { n: "cloudlab.in", t: "MX", a: "mx1.cloudlab.in" },
      { n: "cloudlab.in", t: "TXT", a: "v=spf1 include:spf.cloudlab.in -all" },
      { n: "nonexistent.cloudlab.in", t: "A", a: "NXDOMAIN" },
      { n: "autodiscover.cloudlab.in", t: "A", a: "52.222.95.84" },
    ];
    for (let rep = 0; rep < 2; rep++) {
      names.forEach((rec, idx) => {
        const clientIp = ["10.10.0.50", "10.10.0.51", "10.10.0.52", "10.10.0.53"][idx % 4];
        const rDns = rng(hashSeed(`dns-${rep}-${idx}-${rec.n}`));
        const txnId = "0x" + hex(rInt(rDns, 0, 65535), 4);
        const port = 50000 + rInt(rDns, 0, 10000);
        makePacket({
          src: clientIp,
          dst: "10.10.0.20",
          protocol: "DNS",
          length: 70 + rec.n.length,
          srcPort: port,
          dstPort: 53,
          info: "Standard query " + txnId + " " + rec.t + " " + rec.n,
          color: "dns",
          stream: "dns-" + clientIp + "-" + rec.n,
          dnsQ: rec.n,
          dnsType: rec.t,
          tree: [
            {
              label: "Domain Name System (query)",
              value: "",
              children: [
                { label: "Transaction ID", value: ": " + txnId },
                { label: "Flags", value: ": 0x0100 Standard query" },
                { label: "Questions", value: ": 1" },
                { label: "Answer RRs", value: ": 0" },
                { label: "Authority RRs", value: ": 0" },
                { label: "Additional RRs", value: ": 0" },
                {
                  label: "Queries",
                  value: "",
                  children: [
                    {
                      label: rec.n + ": type " + rec.t + ", class IN",
                      value: "",
                      children: [
                        { label: "Name", value: ": " + rec.n },
                        { label: "Type", value: ": " + rec.t },
                        { label: "Class", value: ": IN (0x0001)" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        });
        const isNx = rec.a === "NXDOMAIN";
        makePacket({
          src: "10.10.0.20",
          dst: clientIp,
          protocol: "DNS",
          length: 86 + rec.n.length,
          srcPort: 53,
          dstPort: port,
          info: "Standard query response " + txnId + " " + (isNx ? "No such name" : rec.t + " " + rec.n + " " + rec.a),
          color: "dns",
          stream: "dns-" + clientIp + "-" + rec.n,
          dnsQ: rec.n,
          dnsType: rec.t,
          tree: [
            {
              label: "Domain Name System (response)",
              value: "",
              children: [
                { label: "Transaction ID", value: ": " + txnId },
                {
                  label: "Flags",
                  value: ": 0x" + (isNx ? "8183 Standard query response, No such name" : "8180 Standard query response"),
                },
                { label: "Questions", value: ": 1" },
                { label: "Answer RRs", value: ": " + (isNx ? "0" : "1") },
                {
                  label: "Answers",
                  value: "",
                  children: isNx
                    ? [{ label: "(none)", value: "" }]
                    : [
                        {
                          label: rec.n + ": type " + rec.t + ", class IN, " + rec.t.toLowerCase() + " " + rec.a,
                          value: "",
                          children: [
                            { label: "Name", value: ": " + rec.n },
                            { label: "Type", value: ": " + rec.t },
                            { label: "Class", value: ": IN" },
                            { label: "Time to live", value: ": " + rInt(rDns, 60, 3600) },
                            { label: rec.t + " record value", value: ": " + rec.a },
                          ],
                        },
                      ],
                },
              ],
            },
          ],
        });
      });
    }
  }

  // ===== 3) ARP (12) =====
  function seedArp() {
    for (let i = 0; i < 6; i++) {
      const who = "10.10.0." + (50 + i);
      const asker = "10.10.0." + (1 + i);
      const rArp = rng(hashSeed(`arp-${i}`));
      const askerMac = macFor(rArp, asker) || randMac(rArp);
      makePacket({
        src: asker,
        dst: who,
        srcMac: askerMac,
        dstMac: BROADCAST_MAC,
        protocol: "ARP",
        length: 60,
        info: "Who has " + who + "? Tell " + asker,
        color: "arp",
        tree: [
          {
            label: "Address Resolution Protocol (request)",
            value: "",
            children: [
              { label: "Hardware type", value: ": Ethernet (1)" },
              { label: "Protocol type", value: ": IPv4 (0x0800)" },
              { label: "Opcode", value: ": request (1)" },
              { label: "Sender MAC address", value: ": " + askerMac },
              { label: "Sender IP address", value: ": " + asker },
              { label: "Target MAC address", value: ": 00:00:00:00:00:00" },
              { label: "Target IP address", value: ": " + who },
            ],
          },
        ],
      });
      const whoMac = macFor(rArp, who) || randMac(rArp);
      makePacket({
        src: who,
        dst: asker,
        srcMac: whoMac,
        dstMac: askerMac,
        protocol: "ARP",
        length: 60,
        info: who + " is at " + whoMac,
        color: "arp",
        tree: [
          {
            label: "Address Resolution Protocol (reply)",
            value: "",
            children: [
              { label: "Opcode", value: ": reply (2)" },
              { label: "Sender MAC address", value: ": " + whoMac },
              { label: "Sender IP address", value: ": " + who },
              { label: "Target MAC address", value: ": " + askerMac },
              { label: "Target IP address", value: ": " + asker },
            ],
          },
        ],
      });
    }
  }

  // ===== 4) TCP streams (80) and HTTP (40) =====
  function seedTcpHttp() {
    const streams = [
      { c: "10.10.0.50", s: "10.10.0.15", sp: 49152, dp: 80, host: "web01.cloudlab.in", path: "/", method: "GET", code: 200 },
      { c: "10.10.0.51", s: "10.10.0.15", sp: 49153, dp: 80, host: "web01.cloudlab.in", path: "/login.php", method: "POST", code: 200 },
      { c: "10.10.0.52", s: "10.10.0.15", sp: 49154, dp: 80, host: "web01.cloudlab.in", path: "/admin", method: "GET", code: 404 },
      { c: "10.10.0.50", s: "142.250.183.46", sp: 49155, dp: 80, host: "www.google.com", path: "/", method: "GET", code: 301 },
      { c: "10.10.0.53", s: "10.10.0.15", sp: 49156, dp: 80, host: "web01.cloudlab.in", path: "/api/v1/error", method: "POST", code: 500 },
    ];
    streams.forEach((st, idx) => {
      const rSt = rng(hashSeed(`tcphttp-${idx}`));
      makePacket({
        src: st.c,
        dst: st.s,
        protocol: "TCP",
        srcPort: st.sp,
        dstPort: st.dp,
        length: 74,
        info: st.sp + "  >  " + st.dp + " [SYN] Seq=0 Win=64240 Len=0 MSS=1460 WS=256 SACK_PERM",
        color: "tcp-syn",
        stream: "tcp-" + idx,
        tcpFlags: { syn: true },
        tree: [
          {
            label: "Transmission Control Protocol",
            value: ", Src Port: " + st.sp + ", Dst Port: " + st.dp + ", Seq: 0, Len: 0",
            children: [
              { label: "Source Port", value: ": " + st.sp },
              { label: "Destination Port", value: ": " + st.dp },
              { label: "Stream index", value: ": " + idx },
              { label: "Sequence Number", value: ": 0 (relative)" },
              { label: "Header Length", value: ": 40 bytes (10)" },
              {
                label: "Flags",
                value: ": 0x002 (SYN)",
                children: [
                  { label: "..0. .... = Urgent", value: ": Not set" },
                  { label: "...0 .... = Acknowledgment", value: ": Not set" },
                  { label: ".... ..1. = Syn", value: ": Set" },
                  { label: ".... ...0 = Fin", value: ": Not set" },
                ],
              },
              { label: "Window", value: ": 64240" },
              { label: "Options", value: ": (20 bytes), MSS, SACK permitted, Window scale (256)" },
            ],
          },
        ],
      });
      makePacket({
        src: st.s,
        dst: st.c,
        protocol: "TCP",
        srcPort: st.dp,
        dstPort: st.sp,
        length: 74,
        info: st.dp + "  >  " + st.sp + " [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1460",
        color: "tcp-syn",
        stream: "tcp-" + idx,
        tcpFlags: { syn: true, ack: true },
        tree: [
          {
            label: "Transmission Control Protocol",
            value: "[SYN, ACK]",
            children: [
              { label: "Source Port", value: ": " + st.dp },
              { label: "Destination Port", value: ": " + st.sp },
              { label: "Stream index", value: ": " + idx },
              { label: "Flags", value: ": 0x012 (SYN, ACK)" },
              { label: "Window", value: ": 65535" },
            ],
          },
        ],
      });
      makePacket({
        src: st.c,
        dst: st.s,
        protocol: "TCP",
        srcPort: st.sp,
        dstPort: st.dp,
        length: 66,
        info: st.sp + "  >  " + st.dp + " [ACK] Seq=1 Ack=1 Win=131328 Len=0",
        color: "tcp",
        stream: "tcp-" + idx,
        tcpFlags: { ack: true },
        tree: [
          {
            label: "Transmission Control Protocol",
            value: "[ACK]",
            children: [
              { label: "Source Port", value: ": " + st.sp },
              { label: "Destination Port", value: ": " + st.dp },
              { label: "Flags", value: ": 0x010 (ACK)" },
            ],
          },
        ],
      });
      const reqHex = asciiToHex(
        st.method +
          " " +
          st.path +
          " HTTP/1.1\r\nHost: " +
          st.host +
          "\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0)\r\nAccept: */*\r\n\r\n",
      );
      makePacket({
        src: st.c,
        dst: st.s,
        protocol: "HTTP",
        srcPort: st.sp,
        dstPort: st.dp,
        length: 200 + rInt(rSt, 0, 120),
        info: st.method + " " + st.path + " HTTP/1.1 ",
        color: "http",
        stream: "tcp-" + idx,
        httpReq: { method: st.method, host: st.host, path: st.path },
        tcpFlags: { ack: true, psh: true },
        bytes: reqHex + randHex(rSt, 40),
        tree: [
          {
            label: "Hypertext Transfer Protocol",
            value: "",
            children: [
              {
                label: st.method + " " + st.path + " HTTP/1.1\\r\\n",
                value: "",
                children: [
                  { label: "Request Method", value: ": " + st.method },
                  { label: "Request URI", value: ": " + st.path },
                  { label: "Request Version", value: ": HTTP/1.1" },
                ],
              },
              { label: "Host", value: ": " + st.host + "\\r\\n" },
              { label: "User-Agent", value: ": Mozilla/5.0 (Windows NT 10.0)\\r\\n" },
              { label: "Accept", value: ": */*\\r\\n" },
              { label: "[Full request URI]", value: ": http://" + st.host + st.path },
            ],
          },
        ],
      });
      const rstext: Record<number, string> = { 200: "OK", 301: "Moved Permanently", 404: "Not Found", 500: "Internal Server Error" };
      const respText = rstext[st.code] || "OK";
      const respBody =
        st.code === 200
          ? "<html><body><h1>Hello from web01</h1></body></html>"
          : st.code === 404
            ? "<html><body><h1>404 Not Found</h1></body></html>"
            : st.code === 301
              ? "<html><body>Moved.</body></html>"
              : "<html><body><h1>Server Error</h1></body></html>";
      const respHex = asciiToHex(
        "HTTP/1.1 " + st.code + " " + respText + "\r\nServer: Apache/2.4.52\r\nContent-Type: text/html\r\nContent-Length: " +
          respBody.length +
          "\r\n\r\n" +
          respBody,
      );
      makePacket({
        src: st.s,
        dst: st.c,
        protocol: "HTTP",
        srcPort: st.dp,
        dstPort: st.sp,
        length: 250 + rInt(rSt, 0, 200),
        info: "HTTP/1.1 " + st.code + " " + respText + "  (text/html)",
        color: "http",
        stream: "tcp-" + idx,
        httpResp: { code: st.code, text: respText },
        tcpFlags: { ack: true, psh: true },
        bytes: respHex + randHex(rSt, 40),
        tree: [
          {
            label: "Hypertext Transfer Protocol",
            value: "",
            children: [
              {
                label: "HTTP/1.1 " + st.code + " " + respText + "\\r\\n",
                value: "",
                children: [
                  { label: "Response Version", value: ": HTTP/1.1" },
                  { label: "Status Code", value: ": " + st.code },
                  { label: "Response Phrase", value: ": " + respText },
                ],
              },
              { label: "Server", value: ": Apache/2.4.52 (Ubuntu)\\r\\n" },
              { label: "Content-Type", value: ": text/html\\r\\n" },
              { label: "Content-Length", value: ": " + respBody.length + "\\r\\n" },
              { label: "Line-based text data", value: ": text/html (1 line)", children: [{ label: respBody, value: "" }] },
            ],
          },
        ],
      });
      for (let k = 0; k < 4; k++) {
        makePacket({
          src: k % 2 === 0 ? st.c : st.s,
          dst: k % 2 === 0 ? st.s : st.c,
          protocol: "TCP",
          srcPort: k % 2 === 0 ? st.sp : st.dp,
          dstPort: k % 2 === 0 ? st.dp : st.sp,
          length: 60 + rInt(rSt, 0, 1400),
          info:
            "TCP segment of a reassembled PDU [ACK] Seq=" +
            rInt(rSt, 1, 5000) +
            " Ack=" +
            rInt(rSt, 1, 5000) +
            " Win=" +
            rInt(rSt, 64, 65535) +
            " Len=" +
            rInt(rSt, 0, 1400),
          color: "tcp",
          stream: "tcp-" + idx,
          tcpFlags: { ack: true },
          tree: [
            {
              label: "Transmission Control Protocol",
              value: "[ACK]",
              children: [
                { label: "Stream index", value: ": " + idx },
                { label: "Flags", value: ": 0x010 (ACK)" },
              ],
            },
          ],
        });
      }
      makePacket({
        src: st.c,
        dst: st.s,
        protocol: "TCP",
        srcPort: st.sp,
        dstPort: st.dp,
        length: 66,
        info: st.sp + "  >  " + st.dp + " [FIN, ACK] Seq=" + rInt(rSt, 100, 5000) + " Ack=" + rInt(rSt, 100, 5000),
        color: "tcp",
        stream: "tcp-" + idx,
        tcpFlags: { fin: true, ack: true },
        tree: [{ label: "Transmission Control Protocol", value: "[FIN, ACK]", children: [{ label: "Flags", value: ": 0x011 (FIN, ACK)" }] }],
      });
      makePacket({
        src: st.s,
        dst: st.c,
        protocol: "TCP",
        srcPort: st.dp,
        dstPort: st.sp,
        length: 66,
        info: st.dp + "  >  " + st.sp + " [FIN, ACK] Seq=" + rInt(rSt, 100, 5000) + " Ack=" + rInt(rSt, 100, 5000),
        color: "tcp",
        stream: "tcp-" + idx,
        tcpFlags: { fin: true, ack: true },
        tree: [{ label: "Transmission Control Protocol", value: "[FIN, ACK]", children: [{ label: "Flags", value: ": 0x011 (FIN, ACK)" }] }],
      });
    });

    const extraPaths = ["/index.html", "/about", "/api/users", "/static/app.js", "/static/style.css", "/favicon.ico", "/health", "/metrics"];
    for (let ep = 0; ep < 15; ep++) {
      const rEp = rng(hashSeed(`tcphttp-extra-${ep}`));
      const path = extraPaths[ep % extraPaths.length];
      const code = [200, 200, 200, 200, 304, 200, 404, 200][ep % 8];
      makePacket({
        src: "10.10.0." + (50 + (ep % 4)),
        dst: "10.10.0.15",
        protocol: "HTTP",
        srcPort: 50000 + ep,
        dstPort: 80,
        length: 180 + rInt(rEp, 0, 100),
        info: "GET " + path + " HTTP/1.1 ",
        color: "http",
        stream: "tcp-extra-" + ep,
        httpReq: { method: "GET", host: "web01.cloudlab.in", path },
        tree: [
          {
            label: "Hypertext Transfer Protocol",
            value: "",
            children: [
              { label: "GET " + path + " HTTP/1.1\\r\\n", value: "" },
              { label: "Host", value: ": web01.cloudlab.in\\r\\n" },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.15",
        dst: "10.10.0." + (50 + (ep % 4)),
        protocol: "HTTP",
        srcPort: 80,
        dstPort: 50000 + ep,
        length: 220 + rInt(rEp, 0, 400),
        info: "HTTP/1.1 " + code + (code === 200 ? " OK" : code === 304 ? " Not Modified" : " Not Found"),
        color: "http",
        stream: "tcp-extra-" + ep,
        httpResp: { code, text: code === 200 ? "OK" : code === 304 ? "Not Modified" : "Not Found" },
        tree: [{ label: "Hypertext Transfer Protocol", value: "", children: [{ label: "HTTP/1.1 " + code + "\\r\\n", value: "" }] }],
      });
    }

    makePacket({
      src: "10.10.0.51",
      dst: "10.10.0.15",
      protocol: "TCP",
      srcPort: 49200,
      dstPort: 22,
      length: 60,
      info: "49200  >  22 [RST] Seq=1 Win=0 Len=0",
      color: "tcp-rst",
      stream: "tcp-rst-1",
      tcpFlags: { rst: true },
      tree: [{ label: "TCP", value: "[RST]", children: [{ label: "Flags", value: ": 0x004 (RST)" }] }],
    });
    makePacket({
      src: "10.10.0.50",
      dst: "10.10.0.15",
      protocol: "TCP",
      srcPort: 49152,
      dstPort: 80,
      length: 1514,
      info: "[TCP Retransmission] 49152  >  80 [PSH, ACK] Seq=1500 Ack=1 Win=64240 Len=1448",
      color: "tcp-retx",
      stream: "tcp-0",
      tcpFlags: { ack: true, psh: true },
      tree: [{ label: "TCP", value: "[Retransmission]", children: [{ label: "Flags", value: ": 0x018 (PSH, ACK)" }] }],
    });
  }

  // ===== 5) TLS 1.3 (35) and TLS 1.2 (20) =====
  function seedTls() {
    const tls13Sessions = [
      { c: "10.10.0.50", s: "20.81.111.85", sni: "www.microsoft.com" },
      { c: "10.10.0.51", s: "142.250.183.46", sni: "www.google.com" },
      { c: "10.10.0.52", s: "20.190.190.132", sni: "login.microsoftonline.com" },
      { c: "10.10.0.50", s: "52.222.95.83", sni: "itbd.net" },
    ];
    tls13Sessions.forEach((s, idx) => {
      const rTls = rng(hashSeed(`tls13-${idx}`));
      const port = 49300 + idx * 4;
      makePacket({
        src: s.c,
        dst: s.s,
        protocol: "TLSv1.3",
        srcPort: port,
        dstPort: 443,
        length: 580 + rInt(rTls, 0, 50),
        info: "Client Hello (SNI=" + s.sni + ")",
        color: "tls",
        stream: "tls13-" + idx,
        tlsType: "ClientHello",
        tree: [
          {
            label: "Transport Layer Security",
            value: "",
            children: [
              {
                label: "TLSv1.3 Record Layer: Handshake Protocol: Client Hello",
                value: "",
                children: [
                  { label: "Content Type", value: ": Handshake (22)" },
                  { label: "Version", value: ": TLS 1.2 (0x0303)" },
                  { label: "Length", value: ": 512" },
                  { label: "Handshake Type", value: ": Client Hello (1)" },
                  { label: "Random", value: ": " + randHex(rTls, 32) },
                  {
                    label: "Cipher Suites (3)",
                    value: "",
                    children: [
                      { label: "TLS_AES_256_GCM_SHA384", value: " (0x1302)" },
                      { label: "TLS_CHACHA20_POLY1305_SHA256", value: " (0x1303)" },
                      { label: "TLS_AES_128_GCM_SHA256", value: " (0x1301)" },
                    ],
                  },
                  {
                    label: "Extensions",
                    value: "",
                    children: [
                      {
                        label: "Extension: server_name (len=" + s.sni.length + ")",
                        value: "",
                        children: [{ label: "Server Name", value: ": " + s.sni }],
                      },
                      { label: "Extension: supported_versions", value: ": TLS 1.3, TLS 1.2" },
                      { label: "Extension: key_share", value: ": X25519" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      makePacket({
        src: s.s,
        dst: s.c,
        protocol: "TLSv1.3",
        srcPort: 443,
        dstPort: port,
        length: 200 + rInt(rTls, 0, 30),
        info: "Server Hello",
        color: "tls",
        stream: "tls13-" + idx,
        tlsType: "ServerHello",
        tree: [
          {
            label: "Transport Layer Security",
            value: "",
            children: [
              {
                label: "TLSv1.3 Record Layer: Handshake Protocol: Server Hello",
                value: "",
                children: [
                  { label: "Handshake Type", value: ": Server Hello (2)" },
                  { label: "Cipher Suite", value: ": TLS_AES_256_GCM_SHA384 (0x1302)" },
                ],
              },
            ],
          },
        ],
      });
      ["Encrypted Extensions", "Certificate", "Certificate Verify", "Finished"].forEach((step) => {
        makePacket({
          src: s.s,
          dst: s.c,
          protocol: "TLSv1.3",
          srcPort: 443,
          dstPort: port,
          length: 200 + rInt(rTls, 0, 1300),
          info: step + " (encrypted)",
          color: "tls",
          stream: "tls13-" + idx,
          tlsType: step,
          tree: [
            {
              label: "Transport Layer Security",
              value: "",
              children: [{ label: "TLSv1.3 Record Layer: Application Data Protocol: " + step, value: "" }],
            },
          ],
        });
      });
      for (let ad = 0; ad < 3; ad++) {
        makePacket({
          src: ad % 2 === 0 ? s.c : s.s,
          dst: ad % 2 === 0 ? s.s : s.c,
          protocol: "TLSv1.3",
          srcPort: ad % 2 === 0 ? port : 443,
          dstPort: ad % 2 === 0 ? 443 : port,
          length: 600 + rInt(rTls, 0, 800),
          info: "Application Data",
          color: "tls",
          stream: "tls13-" + idx,
          tree: [{ label: "Transport Layer Security", value: "", children: [{ label: "TLSv1.3 Record Layer: Application Data", value: "" }] }],
        });
      }
    });

    const tls12 = [
      { c: "10.10.0.50", s: "52.222.95.84", sni: "autodiscover.cloudlab.in" },
      { c: "10.10.0.52", s: "20.190.135.50", sni: "graph.microsoft.com" },
    ];
    tls12.forEach((s, idx) => {
      const rTls = rng(hashSeed(`tls12-${idx}`));
      const port = 49500 + idx * 10;
      makePacket({
        src: s.c,
        dst: s.s,
        protocol: "TLSv1.2",
        srcPort: port,
        dstPort: 443,
        length: 580,
        info: "Client Hello (SNI=" + s.sni + ")",
        color: "tls",
        stream: "tls12-" + idx,
        tlsType: "ClientHello",
        tree: [
          {
            label: "Transport Layer Security",
            value: "",
            children: [
              { label: "Handshake Type", value: ": Client Hello (1)" },
              { label: "Version", value: ": TLS 1.2 (0x0303)" },
              { label: "SNI", value: ": " + s.sni },
            ],
          },
        ],
      });
      makePacket({
        src: s.s,
        dst: s.c,
        protocol: "TLSv1.2",
        srcPort: 443,
        dstPort: port,
        length: 200,
        info: "Server Hello",
        color: "tls",
        stream: "tls12-" + idx,
        tlsType: "ServerHello",
        tree: [
          {
            label: "TLS",
            value: "",
            children: [
              { label: "Server Hello", value: "" },
              { label: "Cipher Suite", value: ": TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 (0xc030)" },
            ],
          },
        ],
      });
      const clientSteps = ["Client Key Exchange", "Change Cipher Spec", "Encrypted Handshake Message"];
      ["Certificate", "Server Key Exchange", "Server Hello Done", "Client Key Exchange", "Change Cipher Spec", "Encrypted Handshake Message", "Application Data"].forEach(
        (step) => {
          const fromClient = clientSteps.indexOf(step) >= 0;
          makePacket({
            src: fromClient ? s.c : s.s,
            dst: fromClient ? s.s : s.c,
            protocol: "TLSv1.2",
            srcPort: fromClient ? port : 443,
            dstPort: fromClient ? 443 : port,
            length: 200 + rInt(rTls, 0, 1200),
            info: step,
            color: "tls",
            stream: "tls12-" + idx,
            tlsType: step,
            tree: [{ label: "TLS", value: "", children: [{ label: step, value: "" }] }],
          });
        },
      );
    });
  }

  // ===== 6) SMB (25) =====
  function seedSmb() {
    const sessions = [
      { c: "10.10.0.50", s: "10.10.0.10", user: "CLOUDLAB\\ankit", share: "projects", file: "plan.docx" },
      { c: "10.10.0.51", s: "10.10.0.10", user: "CLOUDLAB\\priya", share: "hr", file: "salary.xlsx" },
    ];
    sessions.forEach((s, i) => {
      const rSmb = rng(hashSeed(`smb-${i}`));
      const port = 49600 + i * 5;
      const seq = [
        "Negotiate Protocol Request",
        "Negotiate Protocol Response",
        "Session Setup Request, NTLMSSP_NEGOTIATE",
        "Session Setup Response, NTLMSSP_CHALLENGE",
        "Session Setup Request, NTLMSSP_AUTH, User: " + s.user,
        "Session Setup Response",
        "Tree Connect Request Tree: \\\\fs01\\" + s.share,
        "Tree Connect Response",
        "Create Request File: " + s.file,
        "Create Response File: " + s.file,
        "Read Request",
        "Read Response",
        "Close Request",
      ];
      seq.forEach((info, k) => {
        makePacket({
          src: k % 2 === 0 ? s.c : s.s,
          dst: k % 2 === 0 ? s.s : s.c,
          protocol: "SMB2",
          srcPort: k % 2 === 0 ? port : 445,
          dstPort: k % 2 === 0 ? 445 : port,
          length: 150 + rInt(rSmb, 0, 1000),
          info,
          color: "smb",
          stream: "smb-" + i,
          tree: [
            {
              label: "SMB2 (Server Message Block Protocol version 2)",
              value: "",
              children: [
                {
                  label: "Header",
                  value: "",
                  children: [
                    { label: "Server Component", value: ": SMB2" },
                    { label: "Command", value: ": " + info.split(" ")[0] },
                  ],
                },
                { label: info, value: "" },
              ],
            },
          ],
        });
      });
    });
  }

  // ===== 7) LDAP (18) =====
  function seedLdap() {
    const port = 49700;
    const clients = [
      { c: "10.10.0.50", user: "CN=ankit,OU=Users,DC=cloudlab,DC=in" },
      { c: "10.10.0.51", user: "CN=priya,OU=Users,DC=cloudlab,DC=in" },
      { c: "10.10.0.52", user: "CN=vikram,OU=Users,DC=cloudlab,DC=in" },
    ];
    clients.forEach((cl, i) => {
      const p = port + i * 6;
      makePacket({
        src: cl.c,
        dst: "10.10.0.5",
        protocol: "LDAP",
        srcPort: p,
        dstPort: 389,
        length: 130,
        info: 'bindRequest(1) "' + cl.user + '" simple',
        color: "ldap",
        stream: "ldap-" + i,
        tree: [
          {
            label: "Lightweight Directory Access Protocol",
            value: "",
            children: [
              {
                label: "LDAPMessage bindRequest",
                value: "",
                children: [
                  { label: "messageID", value: ": 1" },
                  { label: "protocolOp", value: ": bindRequest (0)" },
                  { label: "name", value: ": " + cl.user },
                  { label: "authentication", value: ": simple" },
                ],
              },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.5",
        dst: cl.c,
        protocol: "LDAP",
        srcPort: 389,
        dstPort: p,
        length: 88,
        info: "bindResponse(1) success",
        color: "ldap",
        stream: "ldap-" + i,
        tree: [{ label: "LDAP", value: "", children: [{ label: "bindResponse", value: "" }, { label: "resultCode", value: ": success (0)" }] }],
      });
      makePacket({
        src: cl.c,
        dst: "10.10.0.5",
        protocol: "LDAP",
        srcPort: p,
        dstPort: 389,
        length: 180,
        info: 'searchRequest(2) "DC=cloudlab,DC=in" wholeSubtree',
        color: "ldap",
        stream: "ldap-" + i,
        tree: [
          {
            label: "LDAP",
            value: "",
            children: [
              {
                label: "searchRequest",
                value: "",
                children: [
                  { label: "baseObject", value: ": DC=cloudlab,DC=in" },
                  { label: "scope", value: ": wholeSubtree (2)" },
                  { label: "filter", value: ": (objectClass=user)" },
                ],
              },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.5",
        dst: cl.c,
        protocol: "LDAP",
        srcPort: 389,
        dstPort: p,
        length: 720,
        info: 'searchResEntry(2) "CN=Domain Admins,...", searchResDone(2) success',
        color: "ldap",
        stream: "ldap-" + i,
        tree: [{ label: "LDAP", value: "", children: [{ label: "searchResEntry", value: "" }, { label: "searchResDone success", value: "" }] }],
      });
      makePacket({
        src: cl.c,
        dst: "10.10.0.5",
        protocol: "LDAP",
        srcPort: p,
        dstPort: 389,
        length: 80,
        info: "unbindRequest(3)",
        color: "ldap",
        stream: "ldap-" + i,
        tree: [{ label: "LDAP", value: "", children: [{ label: "unbindRequest", value: "" }] }],
      });
      makePacket({
        src: cl.c,
        dst: "10.10.0.5",
        protocol: "LDAP",
        srcPort: p,
        dstPort: 389,
        length: 90,
        info: "extendedReq(4) LDAP_START_TLS",
        color: "ldap",
        stream: "ldap-" + i,
        tree: [{ label: "LDAP", value: "", children: [{ label: "extendedReq StartTLS", value: "" }] }],
      });
    });
  }

  // ===== 8) Kerberos (12) =====
  function seedKerberos() {
    const users = ["ankit", "priya", "vikram"];
    users.forEach((u, i) => {
      const p = 49800 + i * 6;
      makePacket({
        src: "10.10.0.50",
        dst: "10.10.0.5",
        protocol: "KRB5",
        srcPort: p,
        dstPort: 88,
        length: 290,
        info: "AS-REQ",
        color: "kerberos",
        stream: "krb-" + i,
        tree: [
          {
            label: "Kerberos",
            value: "",
            children: [
              {
                label: "as-req",
                value: "",
                children: [
                  { label: "pvno", value: ": 5" },
                  { label: "msg-type", value: ": krb-as-req (10)" },
                  { label: "cname", value: ": " + u },
                  { label: "realm", value: ": CLOUDLAB.IN" },
                  { label: "sname", value: ": krbtgt/CLOUDLAB.IN" },
                ],
              },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.5",
        dst: "10.10.0.50",
        protocol: "KRB5",
        srcPort: 88,
        dstPort: p,
        length: 1480,
        info: "AS-REP",
        color: "kerberos",
        stream: "krb-" + i,
        tree: [{ label: "Kerberos", value: "", children: [{ label: "as-rep", value: "" }, { label: "ticket: krbtgt/CLOUDLAB.IN", value: "" }] }],
      });
      makePacket({
        src: "10.10.0.50",
        dst: "10.10.0.5",
        protocol: "KRB5",
        srcPort: p,
        dstPort: 88,
        length: 1500,
        info: "TGS-REQ",
        color: "kerberos",
        stream: "krb-" + i,
        tree: [{ label: "Kerberos", value: "", children: [{ label: "tgs-req", value: "" }, { label: "sname", value: ": cifs/fs01.cloudlab.in" }] }],
      });
      makePacket({
        src: "10.10.0.5",
        dst: "10.10.0.50",
        protocol: "KRB5",
        srcPort: 88,
        dstPort: p,
        length: 1480,
        info: "TGS-REP",
        color: "kerberos",
        stream: "krb-" + i,
        tree: [{ label: "Kerberos", value: "", children: [{ label: "tgs-rep", value: "" }] }],
      });
    });
  }

  // ===== 9) ICMP (20) =====
  function seedIcmp() {
    for (let i = 0; i < 8; i++) {
      makePacket({
        src: "10.10.0.50",
        dst: "8.8.8.8",
        protocol: "ICMP",
        length: 98,
        info: "Echo (ping) request  id=0x0001, seq=" + (i + 1) + "/" + (i + 1) * 256 + ", ttl=64",
        color: "icmp",
        tree: [
          {
            label: "Internet Control Message Protocol",
            value: "",
            children: [
              { label: "Type", value: ": 8 (Echo (ping) request)" },
              { label: "Code", value: ": 0" },
              { label: "Identifier (BE)", value: ": 1 (0x0001)" },
              { label: "Sequence number (BE)", value: ": " + (i + 1) },
            ],
          },
        ],
      });
      makePacket({
        src: "8.8.8.8",
        dst: "10.10.0.50",
        protocol: "ICMP",
        length: 98,
        info: "Echo (ping) reply    id=0x0001, seq=" + (i + 1) + "/" + (i + 1) * 256 + ", ttl=119",
        color: "icmp",
        tree: [{ label: "ICMP", value: "", children: [{ label: "Type", value: ": 0 (Echo (ping) reply)" }, { label: "Code", value: ": 0" }] }],
      });
    }
    makePacket({
      src: "10.10.0.1",
      dst: "10.10.0.50",
      protocol: "ICMP",
      length: 70,
      info: "Time-to-live exceeded (Time to live exceeded in transit)",
      color: "icmp",
      tree: [{ label: "ICMP", value: "", children: [{ label: "Type", value: ": 11 (Time-to-live exceeded)" }, { label: "Code", value: ": 0" }] }],
    });
    makePacket({
      src: "10.10.0.1",
      dst: "10.10.0.51",
      protocol: "ICMP",
      length: 70,
      info: "Destination unreachable (Host unreachable)",
      color: "icmp",
      tree: [
        {
          label: "ICMP",
          value: "",
          children: [{ label: "Type", value: ": 3 (Destination unreachable)" }, { label: "Code", value: ": 1 (Host unreachable)" }],
        },
      ],
    });
    for (let z = 0; z < 2; z++) {
      makePacket({
        src: "10.10.0.50",
        dst: "10.10.0.1",
        protocol: "ICMP",
        length: 98,
        info: "Echo (ping) request to gw",
        color: "icmp",
        tree: [{ label: "ICMP", value: "", children: [{ label: "Type", value: ": 8" }] }],
      });
      makePacket({
        src: "10.10.0.1",
        dst: "10.10.0.50",
        protocol: "ICMP",
        length: 98,
        info: "Echo (ping) reply from gw",
        color: "icmp",
        tree: [{ label: "ICMP", value: "", children: [{ label: "Type", value: ": 0" }] }],
      });
    }
  }

  // ===== 10) OSPF (15) =====
  function seedOspf() {
    const types: [string, string][] = [
      ["Hello", "1"],
      ["DB Description", "2"],
      ["LS Request", "3"],
      ["LS Update", "4"],
      ["LS Acknowledge", "5"],
    ];
    for (let i = 0; i < 3; i++) {
      types.forEach((t) => {
        const rOspf = rng(hashSeed(`ospf-${i}-${t[0]}`));
        makePacket({
          src: "10.10.0.1",
          dst: "224.0.0.5",
          protocol: "OSPF",
          length: 82 + rInt(rOspf, 0, 40),
          info: t[0],
          color: "routing",
          tree: [
            {
              label: "Open Shortest Path First",
              value: "",
              children: [
                {
                  label: "OSPF Header",
                  value: "",
                  children: [
                    { label: "Version", value: ": 2" },
                    { label: "Message Type", value: ": " + t[0] + " Packet (" + t[1] + ")" },
                    { label: "Packet Length", value: ": 48" },
                    { label: "Source OSPF Router", value: ": 1.1.1.1" },
                    { label: "Area ID", value: ": 0.0.0.0 (Backbone)" },
                  ],
                },
              ],
            },
          ],
        });
      });
    }
  }

  // ===== 11) BGP (10) =====
  function seedBgp() {
    const msgs: [string, string][] = [
      ["OPEN", "170"],
      ["UPDATE", "100"],
      ["KEEPALIVE", "19"],
      ["UPDATE", "120"],
      ["KEEPALIVE", "19"],
    ];
    for (let k = 0; k < 2; k++) {
      msgs.forEach((m) => {
        makePacket({
          src: "10.10.0.1",
          dst: "10.10.0.2",
          protocol: "BGP",
          srcPort: 49900,
          dstPort: 179,
          length: parseInt(m[1], 10) + 40,
          info: m[0] + " Message",
          color: "routing",
          stream: "bgp-1",
          tree: [
            {
              label: "Border Gateway Protocol - " + m[0] + " Message",
              value: "",
              children: [
                { label: "Length", value: ": " + m[1] },
                { label: "Type", value: ": " + m[0] },
              ],
            },
          ],
        });
      });
    }
  }

  // ===== 12) IPsec (14) =====
  function seedIpsec() {
    const rIke = rng(hashSeed("ipsec-ike"));
    ["IKE_SA_INIT", "IKE_AUTH", "IKE_AUTH", "CREATE_CHILD_SA", "INFORMATIONAL"].forEach((msg) => {
      makePacket({
        src: "10.10.0.1",
        dst: "20.0.0.1",
        protocol: "ISAKMP",
        srcPort: 500,
        dstPort: 500,
        length: 350 + rInt(rIke, 0, 600),
        info: msg + " MID=" + rInt(rIke, 0, 5),
        color: "default",
        stream: "ike-1",
        tree: [
          {
            label: "Internet Security Association and Key Management Protocol",
            value: "",
            children: [
              { label: "Initiator SPI", value: ": " + randHex(rIke, 16) },
              { label: "Responder SPI", value: ": " + randHex(rIke, 16) },
              { label: "Exchange type", value: ": " + msg + " (34)" },
            ],
          },
        ],
      });
    });
    const rEsp = rng(hashSeed("ipsec-esp"));
    for (let i = 0; i < 9; i++) {
      makePacket({
        src: "10.10.0.1",
        dst: "20.0.0.1",
        protocol: "ESP",
        length: 100 + rInt(rEsp, 0, 1400),
        info: "ESP (SPI=0x" + hex(rInt(rEsp, 0, 4294967295), 8) + ")",
        color: "default",
        stream: "esp-1",
        tree: [
          {
            label: "Encapsulating Security Payload",
            value: "",
            children: [
              { label: "ESP SPI", value: ": 0x" + hex(rInt(rEsp, 0, 4294967295), 8) },
              { label: "ESP Sequence", value: ": " + (i + 1) },
            ],
          },
        ],
      });
    }
  }

  // ===== 13) VLAN 802.1Q (10) =====
  function seedVlan() {
    for (let i = 0; i < 10; i++) {
      const rVlan = rng(hashSeed(`vlan-${i}`));
      const vid = [10, 20, 30][i % 3];
      makePacket({
        src: "10.10." + vid + ".5",
        dst: "10.10." + vid + ".6",
        protocol: "TCP",
        srcPort: 49000 + i,
        dstPort: 80,
        length: 78 + rInt(rVlan, 0, 200),
        info: "VLAN " + vid + " tagged frame, [ACK] Seq=" + rInt(rVlan, 1, 1000),
        color: "tcp",
        stream: "vlan-" + vid,
        tree: [
          {
            label: "802.1Q Virtual LAN",
            value: ", PRI: 0, DEI: 0, ID: " + vid,
            children: [
              { label: "Priority Code Point", value: ": Best Effort (default) (0)" },
              { label: "Drop Eligible Indicator", value: ": Ineligible" },
              { label: "VLAN Identifier", value: ": " + vid },
              { label: "Type", value: ": IPv4 (0x0800)" },
            ],
          },
        ],
      });
    }
  }

  // ===== 14) Spanning Tree BPDU (8) =====
  function seedStp() {
    for (let i = 0; i < 8; i++) {
      makePacket({
        src: "10.10.0.1",
        dst: "01:80:c2:00:00:00",
        srcMac: "00:1c:b3:aa:11:01",
        dstMac: "01:80:c2:00:00:00",
        protocol: "STP",
        length: 60,
        info: "Conf. Root = 32768/0/00:1c:b3:aa:11:01 Cost = 0 Port = 0x8001",
        color: "broadcast",
        tree: [
          {
            label: "Spanning Tree Protocol",
            value: "",
            children: [
              { label: "Protocol Identifier", value: ": Spanning Tree Protocol (0x0000)" },
              { label: "Protocol Version Identifier", value: ": Spanning Tree (0)" },
              { label: "BPDU Type", value: ": Configuration (0x00)" },
              { label: "BPDU flags", value: ": 0x00" },
              { label: "Root Identifier", value: ": 32768 / 0 / 00:1c:b3:aa:11:01" },
              { label: "Root Path Cost", value: ": 0" },
              { label: "Bridge Identifier", value: ": 32768 / 0 / 00:1c:b3:aa:11:01" },
            ],
          },
        ],
      });
    }
  }

  // ===== 15) CDP / LLDP (6) =====
  function seedCdpLldp() {
    for (let i = 0; i < 3; i++) {
      makePacket({
        src: "10.10.0.1",
        dst: "01:00:0c:cc:cc:cc",
        srcMac: "00:1c:b3:aa:11:01",
        dstMac: "01:00:0c:cc:cc:cc",
        protocol: "CDP",
        length: 250,
        info: "Device ID: gw.cloudlab.in  Port ID: GigabitEthernet0/1",
        color: "broadcast",
        tree: [
          {
            label: "Cisco Discovery Protocol",
            value: "",
            children: [
              { label: "Version", value: ": 2" },
              { label: "TTL", value: ": 180 seconds" },
              { label: "Device ID: gw.cloudlab.in", value: "" },
              { label: "Software Version: Cisco IOS 15.2", value: "" },
              { label: "Platform: cisco WS-C3850-48P", value: "" },
              { label: "Port ID: GigabitEthernet0/1", value: "" },
            ],
          },
        ],
      });
      makePacket({
        src: "10.10.0.1",
        dst: "01:80:c2:00:00:0e",
        srcMac: "00:1c:b3:aa:11:01",
        dstMac: "01:80:c2:00:00:0e",
        protocol: "LLDP",
        length: 220,
        info: "Chassis Id=00:1c:b3:aa:11:01 Port Id=Gi0/1 TTL=120",
        color: "broadcast",
        tree: [
          {
            label: "Link Layer Discovery Protocol",
            value: "",
            children: [
              { label: "Chassis Subtype = MAC address, Id: 00:1c:b3:aa:11:01", value: "" },
              { label: "Port Subtype = Interface name, Id: GigabitEthernet0/1", value: "" },
              { label: "Time To Live = 120 seconds", value: "" },
              { label: "System Name = gw.cloudlab.in", value: "" },
            ],
          },
        ],
      });
    }
  }

  // ===== 16) SSDP / mDNS / NetBIOS (25) =====
  function seedDiscovery() {
    for (let i = 0; i < 8; i++) {
      makePacket({
        src: "10.10.0." + (50 + (i % 4)),
        dst: MCAST_SSDP_IP,
        protocol: "SSDP",
        srcPort: 49152,
        dstPort: 1900,
        length: 216,
        info: "M-SEARCH * HTTP/1.1 ",
        color: "broadcast",
        tree: [
          {
            label: "Simple Service Discovery Protocol",
            value: "",
            children: [
              { label: "M-SEARCH * HTTP/1.1\\r\\n", value: "" },
              { label: "HOST", value: ": 239.255.255.250:1900\\r\\n" },
              { label: "MAN", value: ': "ssdp:discover"\\r\\n' },
              { label: "ST", value: ": urn:dial-multiscreen-org:service:dial:1\\r\\n" },
            ],
          },
        ],
      });
    }
    for (let j = 0; j < 9; j++) {
      const rMdns = rng(hashSeed(`mdns-${j}`));
      makePacket({
        src: "10.10.0." + (50 + (j % 4)),
        dst: MCAST_MDNS_IP,
        protocol: "MDNS",
        srcPort: 5353,
        dstPort: 5353,
        length: 90 + rInt(rMdns, 0, 50),
        info: "Standard query 0x0000 PTR _services._dns-sd._udp.local",
        color: "dns",
        tree: [
          {
            label: "Multicast DNS",
            value: "",
            children: [
              { label: "Transaction ID", value: ": 0x0000" },
              { label: "Questions", value: ": 1" },
              {
                label: "Queries",
                value: "",
                children: [{ label: "_services._dns-sd._udp.local: type PTR, class IN", value: "" }],
              },
            ],
          },
        ],
      });
    }
    for (let k = 0; k < 8; k++) {
      const rNbns = rng(hashSeed(`nbns-${k}`));
      makePacket({
        src: "10.10.0." + (50 + (k % 4)),
        dst: "10.10.0.255",
        protocol: "NBNS",
        srcPort: 137,
        dstPort: 137,
        length: 92,
        info: "Name query NB WORKGROUP<1d>",
        color: "broadcast",
        tree: [
          {
            label: "NetBIOS Name Service",
            value: "",
            children: [
              { label: "Transaction ID", value: ": 0x" + hex(rInt(rNbns, 0, 65535), 4) },
              { label: "Flags", value: ": 0x0110 Name query" },
              { label: "Queries", value: "", children: [{ label: "WORKGROUP<1d>: type NB, class IN", value: "" }] },
            ],
          },
        ],
      });
    }
  }

  // ===== 17) Suspicious traffic (30) =====
  function seedSuspicious() {
    const attacker = "10.10.0.51";
    const target = "10.10.0.10";
    const ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 389, 443, 445, 465, 514, 587, 636, 993, 995, 3306, 3389, 5432, 5985, 5986, 8080, 8443];
    for (let i = 0; i < ports.length && i < 10; i++) {
      makePacket({
        src: attacker,
        dst: target,
        protocol: "TCP",
        srcPort: 51000 + i,
        dstPort: ports[i],
        length: 60,
        info: "[SYN, port scan] " + (51000 + i) + "  >  " + ports[i] + " [SYN] Seq=0 Win=1024 Len=0",
        color: "suspicious",
        suspicious: true,
        tcpFlags: { syn: true },
        tree: [
          {
            label: "Transmission Control Protocol",
            value: "[SYN]",
            children: [
              { label: "Flags", value: ": 0x002 (SYN)" },
              { label: "[Connection establishment, SYN scan signature]", value: "" },
            ],
          },
        ],
      });
      makePacket({
        src: target,
        dst: attacker,
        protocol: "TCP",
        srcPort: ports[i],
        dstPort: 51000 + i,
        length: 60,
        info: ports[i] + "  >  " + (51000 + i) + " [RST, ACK]",
        color: "tcp-rst",
        suspicious: true,
        tcpFlags: { rst: true, ack: true },
        tree: [{ label: "TCP", value: "[RST, ACK]", children: [{ label: "Flags", value: ": 0x014 (RST, ACK)" }] }],
      });
    }
    for (let f = 0; f < 6; f++) {
      makePacket({
        src: "23.45.67.89",
        dst: "10.10.0.15",
        protocol: "TCP",
        srcPort: 12345 + f,
        dstPort: 80,
        length: 60,
        info: "[SYN flood] [TCP Port numbers reused] " + (12345 + f) + "  >  80 [SYN] Seq=0",
        color: "suspicious",
        suspicious: true,
        tcpFlags: { syn: true },
        tree: [
          {
            label: "TCP",
            value: "[SYN]",
            children: [
              { label: "Flags", value: ": 0x002 (SYN)" },
              { label: "[Suspicious: repeated SYN, no ACK]", value: "" },
            ],
          },
        ],
      });
    }
    for (let d = 0; d < 6; d++) {
      const rDnsExfil = rng(hashSeed(`dns-exfil-${d}`));
      const enc = randHex(rDnsExfil, 30);
      makePacket({
        src: "10.10.0.52",
        dst: "23.45.67.89",
        protocol: "DNS",
        srcPort: 50001,
        dstPort: 53,
        length: 120 + d,
        info: "Standard query 0x" + hex(rInt(rDnsExfil, 0, 65535), 4) + " TXT " + enc + ".evil.example.com",
        color: "suspicious",
        suspicious: true,
        dnsType: "TXT",
        dnsQ: enc + ".evil.example.com",
        tree: [
          {
            label: "Domain Name System (query)",
            value: "",
            children: [
              {
                label: "Queries",
                value: "",
                children: [{ label: enc + ".evil.example.com: type TXT, class IN", value: "" }],
              },
              { label: "[Suspicious: long subdomain, possible DNS tunneling]", value: "" },
            ],
          },
        ],
      });
    }
    makePacket({
      src: "10.10.0.52",
      dst: "23.45.67.89",
      protocol: "HTTP",
      srcPort: 50002,
      dstPort: 80,
      length: 500,
      info: "POST /upload.php HTTP/1.1  (base64-encoded payload)",
      color: "suspicious",
      suspicious: true,
      httpReq: { method: "POST", host: "evil.example.com", path: "/upload.php" },
      tree: [
        {
          label: "HTTP",
          value: "",
          children: [
            { label: "POST /upload.php HTTP/1.1\\r\\n", value: "" },
            { label: "Content-Type", value: ": application/octet-stream\\r\\n" },
            { label: "[Suspicious: encoded payload exfil over HTTP]", value: "" },
          ],
        },
      ],
    });
    for (let b = 0; b < 6; b++) {
      makePacket({
        src: "23.45.67.89",
        dst: "10.10.0.50",
        protocol: "TCP",
        srcPort: 51500 + b,
        dstPort: 3389,
        length: 60,
        info: "[RDP brute force?] " + (51500 + b) + "  >  3389 [SYN]",
        color: "suspicious",
        suspicious: true,
        tcpFlags: { syn: true },
        tree: [{ label: "TCP", value: "[SYN]", children: [{ label: "Flags", value: ": 0x002 (SYN)" }] }],
      });
    }
  }

  // ----- Build the capture (same order as source) -----
  seedDhcp();
  seedDns();
  seedArp();
  seedTcpHttp();
  seedTls();
  seedSmb();
  seedLdap();
  seedKerberos();
  seedIcmp();
  seedOspf();
  seedBgp();
  seedIpsec();
  seedVlan();
  seedStp();
  seedCdpLldp();
  seedDiscovery();
  seedSuspicious();

  // ----- Build full dissection tree for every packet (Frame > Ethernet > IP > L4 > App) -----
  const l4Protocols = ["TCP", "HTTP", "HTTPS", "TLSv1.2", "TLSv1.3", "SMB2", "LDAP", "KRB5", "BGP"];
  const udpProtocols = ["UDP", "DHCP", "DNS", "MDNS", "NBNS", "SSDP", "SNMP", "ISAKMP"];
  packets.forEach((p) => {
    const rTree = rng(hashSeed(`tree-${p.no}`));
    const topTree: WsTreeNode[] = [];
    topTree.push(frameNode(p));
    let etype = p.protocol === "ARP" ? "0x0806" : "0x0800";
    if (p.protocol === "CDP") etype = "0x2000";
    if (p.protocol === "LLDP") etype = "0x88CC";
    if (p.protocol === "STP") etype = "0x0026";
    topTree.push(ethNode(p, etype));
    if (["ARP", "STP", "CDP", "LLDP"].indexOf(p.protocol) === -1) {
      let ipProto = "TCP (6)";
      if (udpProtocols.indexOf(p.protocol) !== -1) ipProto = "UDP (17)";
      if (p.protocol === "ICMP") ipProto = "ICMP (1)";
      if (p.protocol === "OSPF") ipProto = "OSPF IGP (89)";
      if (p.protocol === "ESP") ipProto = "Encap Security Payload (50)";
      topTree.push(ipv4Node(p, ipProto, rTree));
      if (l4Protocols.indexOf(p.protocol) !== -1) {
        let flags = ["ACK"];
        if (p.tcpFlags?.syn) flags = p.tcpFlags.ack ? ["SYN", "ACK"] : ["SYN"];
        else if (p.tcpFlags?.rst) flags = p.tcpFlags.ack ? ["RST", "ACK"] : ["RST"];
        else if (p.tcpFlags?.fin) flags = ["FIN", "ACK"];
        else if (p.tcpFlags?.psh) flags = ["PSH", "ACK"];
        topTree.push(tcpNode(p, { flags, payloadLen: Math.max(0, p.length - 66) }, rTree));
      } else if (udpProtocols.indexOf(p.protocol) !== -1) {
        topTree.push(udpNode(p, { len: Math.max(8, p.length - 42) }, rTree));
      }
    }
    p.tree.forEach((n) => topTree.push(n));
    p.tree = topTree;
    // Ensure bytes roughly match length (deterministic pad/truncate).
    if (!p.bytes || p.bytes.length < p.length * 2) {
      const need = p.length - (p.bytes ? p.bytes.length / 2 : 0);
      p.bytes = (p.bytes || "") + randHex(rTree, Math.max(0, need));
    }
    if (p.bytes.length > p.length * 2) p.bytes = p.bytes.substring(0, p.length * 2);
  });

  return packets;
}

// ----- Default coloring rules (ported 1:1 from source's getDefaultColoringRules()) -----

export function getDefaultColoringRules(): WsColoringRule[] {
  return [
    { id: "cr-bad-tcp", name: "Bad TCP", filter: "tcp.flags.rst == 1", bg: "#ff4444", fg: "#ffffff", enabled: true },
    { id: "cr-tcp-retx", name: "TCP Retransmission", filter: "tcp.analysis.retransmission", bg: "#000000", fg: "#ff4444", enabled: true },
    { id: "cr-tcp-synfin", name: "TCP SYN/FIN", filter: "tcp.flags.syn == 1 || tcp.flags.fin == 1", bg: "#c2dbff", fg: "#11264a", enabled: true },
    { id: "cr-http", name: "HTTP", filter: "http", bg: "#d6f0d6", fg: "#114a11", enabled: true },
    { id: "cr-tls", name: "TLS", filter: "tls", bg: "#e8e0f5", fg: "#2a1e4a", enabled: true },
    { id: "cr-dns", name: "DNS", filter: "dns", bg: "#d0e3f9", fg: "#102d4f", enabled: true },
    { id: "cr-icmp", name: "ICMP", filter: "icmp", bg: "#f9d6e8", fg: "#4a1c2e", enabled: true },
    { id: "cr-arp", name: "ARP", filter: "arp", bg: "#fff6c2", fg: "#5a4a00", enabled: true },
    { id: "cr-udp", name: "UDP", filter: "udp", bg: "#d6f0eb", fg: "#114a44", enabled: true },
    { id: "cr-tcp", name: "TCP", filter: "tcp", bg: "#e7e6ff", fg: "#1a1a1a", enabled: true },
    { id: "cr-broadcast", name: "Broadcast", filter: "eth.dst == ff:ff:ff:ff:ff:ff", bg: "#c2f0f5", fg: "#0a4548", enabled: true },
    { id: "cr-routing", name: "Routing", filter: "ospf || bgp", bg: "#fcd9b6", fg: "#5a2a00", enabled: true },
    { id: "cr-smb", name: "SMB", filter: "smb", bg: "#f7e1c2", fg: "#4a2a00", enabled: true },
    { id: "cr-kerberos", name: "Kerberos", filter: "kerberos", bg: "#d9c2f7", fg: "#2a004a", enabled: true },
    { id: "cr-ldap", name: "LDAP", filter: "ldap", bg: "#c2e8f7", fg: "#002a4a", enabled: true },
    { id: "cr-suspicious", name: "Suspicious", filter: "ws.suspicious", bg: "#ffe066", fg: "#5a0000", enabled: true },
  ];
}

function getDefaultInterfaces(): WsInterface[] {
  return [
    { id: "eth0", name: "eth0", description: "Local Area Connection (Intel I219-V) — 10.10.0.50/24", packetsCaptured: 0 },
    { id: "wlan0", name: "wlan0", description: "Wi-Fi (Intel AX201) — 10.10.0.51/24", packetsCaptured: 0 },
    { id: "lo", name: "lo", description: "Loopback — 127.0.0.1/8", packetsCaptured: 0 },
    { id: "tun0", name: "tun0", description: "OpenVPN tap — 172.16.0.5/24", packetsCaptured: 0 },
  ];
}

function getDefaultSavedFilters(): WsSavedFilter[] {
  return [
    { id: "sf-https", name: "HTTPS traffic", expr: 'tcp.port == 443' },
    { id: "sf-http-get", name: "HTTP GET requests", expr: 'http.request.method == "GET"' },
    { id: "sf-dns", name: "DNS traffic", expr: "dns" },
  ];
}

function getDefaultPrefs(): WsPrefs {
  return {
    columns: {
      showNo: true,
      showTime: true,
      showSrc: true,
      showDst: true,
      showProtocol: true,
      showLength: true,
      showInfo: true,
    },
    timeFormat: "seconds-since-start",
  };
}

function getDefaultProfile(): WsProfile {
  return { name: "Default" };
}

/**
 * Builds a brand-new WiresharkState: ~455 seeded packets across 17 protocol families,
 * default interfaces/coloring-rules/saved-filters/prefs/profile, and capture engine
 * fields reset to idle. No `Math.random()` / wall-clock calls — fully deterministic.
 */
export function freshWiresharkState(): WiresharkState {
  const packets = buildSeedPackets();
  const lastNo = packets.length > 0 ? packets[packets.length - 1].no : 0;

  return {
    packets,
    nextFrameNo: lastNo + 1,
    interfaces: getDefaultInterfaces(),
    activeInterfaceId: "eth0",
    captureStatus: "idle",
    displayFilter: "",
    selectedPacketNo: null,
    markedFrames: [],
    coloringRules: getDefaultColoringRules(),
    savedFilters: getDefaultSavedFilters(),
    recentFilters: [],
    prefs: getDefaultPrefs(),
    profile: getDefaultProfile(),
  };
}
