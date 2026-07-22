import type {
  CiscoBgpConfig,
  CiscoEigrpConfig,
  CiscoEigrpNeighbor,
  CiscoInterface,
  CiscoOspfConfig,
  CiscoOspfNeighbor,
  CiscoRouteResolution,
  CiscoRouteSourceKind,
  CiscoState,
  PingOutcomeKind,
  PingResult,
  TraceHop,
  TraceResult,
} from "./types";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Same simple LCG used across every ported simulator in this app — no Math.random()
// anywhere in this file. Callers pass a numeric seed (usually derived from a stable
// string key, e.g. `${dst}|${srcInterfaceName}|${nowIso}`) so a given probe is
// reproducible if replayed with the same seed, but two different probes/seeds diverge.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return Math.floor(rand() * (hi - lo + 1)) + lo;
}

// ===== IP / subnet arithmetic =====

/** Dotted-quad IPv4 -> unsigned 32-bit integer. Returns null for malformed input. */
export function ipToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return NaN;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return NaN;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** Unsigned 32-bit integer -> dotted-quad IPv4 string. */
export function intToIp(n: number): string {
  const u = n >>> 0;
  return [(u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255].join(".");
}

/** Real bitwise-AND subnet membership check — ports source's `sameSubnet` exactly. */
export function sameSubnet(ipA: string, ipB: string, mask: string): boolean {
  if (!ipA || !ipB || !mask) return false;
  const a = ipA.split(".");
  const b = ipB.split(".");
  const m = mask.split(".");
  if (a.length !== 4 || b.length !== 4 || m.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const av = parseInt(a[i], 10);
    const bv = parseInt(b[i], 10);
    const mv = parseInt(m[i], 10);
    if (Number.isNaN(av) || Number.isNaN(bv) || Number.isNaN(mv)) return false;
    if ((av & mv) !== (bv & mv)) return false;
  }
  return true;
}

/** CIDR prefix length (0-32) -> dotted-quad subnet mask, e.g. 24 -> 255.255.255.0. */
function prefixToMask(prefixLen: number): string {
  const bits = Math.max(0, Math.min(32, prefixLen));
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return intToIp(mask);
}

/**
 * Parse a "x.x.x.x/nn" CIDR string into { network, mask }. Returns null if the
 * string isn't CIDR-shaped (some seeded network strings — e.g. EIGRP's
 * `{network, wildcard}` pairs — are not CIDR strings and are handled separately by
 * their own field shape rather than through this helper).
 */
function parseCidr(cidr: string): { network: string; mask: string } | null {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!m) return null;
  const prefixLen = Number(m[2]);
  if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;
  return { network: m[1], mask: prefixToMask(prefixLen) };
}

/** Wildcard mask (EIGRP-style, e.g. 0.0.0.255) -> standard subnet mask (inverse bits). */
function wildcardToMask(wildcard: string): string {
  const parts = wildcard.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return "255.255.255.255";
  return parts.map((p) => 255 - p).join(".");
}

// ===== Directly-connected lookup =====

/**
 * Returns the interface whose configured IP+mask subnet contains `dst`, or null.
 * Mirrors source's `isOnConnectedSubnet` — only admin-up interfaces with a real IP
 * are considered (a shut interface's subnet is not "connected" for forwarding).
 */
export function isDirectlyConnected(dst: string, interfaces: CiscoInterface[]): CiscoInterface | null {
  for (const iface of interfaces) {
    if (!iface.ip || !iface.mask || !iface.adminUp) continue;
    if (sameSubnet(dst, iface.ip, iface.mask)) return iface;
  }
  return null;
}

/** Count of set bits in a dotted-quad mask — used as the longest-prefix tiebreaker. */
function maskPrefixLength(mask: string): number {
  const n = ipToInt(mask);
  if (Number.isNaN(n)) return 0;
  let count = 0;
  let v = n >>> 0;
  while (v) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
}

// ===== Route resolution — the core routing-aware engine =====

export type RouteResolutionInputs = {
  interfaces: CiscoInterface[];
  staticRoutes: CiscoState["staticRoutes"];
  ospfConfig: CiscoOspfConfig;
  ospfNeighbors: CiscoOspfNeighbor[];
  eigrpConfig: CiscoEigrpConfig;
  eigrpNeighbors: CiscoEigrpNeighbor[];
  bgpConfig: CiscoBgpConfig;
};

/**
 * Real longest-prefix-style route resolution, mirroring real router route
 * selection: directly connected > lowest administrative distance among matching
 * routes (static beats OSPF beats EIGRP beats BGP by AD, but we also check static
 * routes' own `distance` field and longest-prefix-match within static routes).
 */
export function resolveRoute(dst: string, state: RouteResolutionInputs): CiscoRouteResolution {
  const notMatched: CiscoRouteResolution = {
    matched: false,
    sourceKind: "none",
    egressInterface: null,
    nextHop: null,
    distance: null,
  };

  const dstInt = ipToInt(dst);
  if (Number.isNaN(dstInt)) return notMatched;

  // 1) Directly connected always wins — a real router forwards on-link traffic
  // via ARP, never via the routing table, regardless of what else matches.
  const connected = isDirectlyConnected(dst, state.interfaces);
  if (connected) {
    return { matched: true, sourceKind: "connected", egressInterface: connected.name, nextHop: null, distance: 0 };
  }

  // 2) Static routes: real subnet arithmetic, longest-prefix-match, then lowest
  // administrative distance as tiebreak.
  let bestStatic: { route: CiscoState["staticRoutes"][number]; prefixLen: number } | null = null;
  for (const route of state.staticRoutes) {
    if (!sameSubnet(dst, route.dst, route.mask)) continue;
    const prefixLen = maskPrefixLength(route.mask);
    if (
      !bestStatic ||
      prefixLen > bestStatic.prefixLen ||
      (prefixLen === bestStatic.prefixLen && route.distance < bestStatic.route.distance)
    ) {
      bestStatic = { route, prefixLen };
    }
  }
  if (bestStatic) {
    return {
      matched: true,
      sourceKind: "static",
      egressInterface: bestStatic.route.iface || null,
      nextHop: bestStatic.route.nextHop || null,
      distance: bestStatic.route.distance,
    };
  }

  // 3) OSPF: destination falls within one of the enabled areas' seeded network
  // strings (seed data uses CIDR-style "x.x.x.x/nn" for OSPF area networks) AND at
  // least one real neighbor adjacency exists.
  if (state.ospfConfig.enabled && state.ospfNeighbors.length > 0) {
    for (const area of state.ospfConfig.areas) {
      for (const netStr of area.networks) {
        const parsed = parseCidr(netStr);
        if (!parsed) continue;
        if (sameSubnet(dst, parsed.network, parsed.mask)) {
          const nbr = state.ospfNeighbors[0];
          return { matched: true, sourceKind: "ospf", egressInterface: nbr.iface, nextHop: nbr.neighbor, distance: 110 };
        }
      }
    }
  }

  // 4) EIGRP: seed data uses {network, wildcard} pairs (e.g. 10.10.0.0 / 0.0.0.255),
  // not CIDR strings — convert wildcard -> mask and match the same way.
  if (state.eigrpConfig.enabled && state.eigrpNeighbors.length > 0) {
    for (const net of state.eigrpConfig.networks) {
      const mask = wildcardToMask(net.wildcard);
      if (sameSubnet(dst, net.network, mask)) {
        const nbr = state.eigrpNeighbors[0];
        return { matched: true, sourceKind: "eigrp", egressInterface: nbr.iface, nextHop: nbr.neighbor, distance: 90 };
      }
    }
  }

  // 5) BGP: seed data's `bgpConfig.networks` is CIDR-style (e.g. "203.0.113.0/24")
  // AND at least one neighbor must be Established (a real BGP route isn't usable
  // over a peering session that hasn't converged).
  if (state.bgpConfig.enabled) {
    const establishedNeighbor = state.bgpConfig.neighbors.find((n) => n.state === "Established");
    if (establishedNeighbor) {
      for (const netStr of state.bgpConfig.networks) {
        const parsed = parseCidr(netStr);
        if (!parsed) continue;
        if (sameSubnet(dst, parsed.network, parsed.mask)) {
          return { matched: true, sourceKind: "bgp", egressInterface: null, nextHop: establishedNeighbor.peer, distance: 20 };
        }
      }
    }
  }

  return notMatched;
}

// ===== Ping simulation =====

/** Per-sourceKind success-rate and latency bands for the small deterministic jitter. */
const SUCCESS_RATE: Record<Exclude<CiscoRouteSourceKind, "none">, number> = {
  connected: 1, // always ok per source's real directly-connected behavior
  static: 0.98,
  ospf: 0.96,
  eigrp: 0.96,
  bgp: 0.9,
};

const LATENCY_BAND: Record<Exclude<CiscoRouteSourceKind, "none">, [number, number]> = {
  connected: [1, 4],
  static: [5, 40],
  ospf: [5, 40],
  eigrp: [5, 40],
  bgp: [20, 120],
};

const PING_PACKET_COUNT = 4;

/**
 * The main diagnostics engine. Replaces source's regex-bucketed Math.random()
 * fallback with a genuine routing-table lookup: unreachable destinations now
 * produce a real "no route to host" outcome instead of a flat random fail chance,
 * and resolved routes succeed at a high, sourceKind-appropriate rate rather than
 * rolling a wide-open dice every time.
 */
export function simulatePing(dst: string, srcInterfaceName: string | null, state: CiscoState, seed: number): PingResult {
  const rand = rng(seed);

  // 1) Source interface real admin/link state check (matches source's real
  // behavior — this was already genuine in decidePingScenario()).
  if (srcInterfaceName) {
    const src = state.interfaces.find((i) => i.name === srcInterfaceName) || null;
    if (src) {
      if (!src.adminUp) {
        return buildResult("src_admin_down", dst, srcInterfaceName, 0, 0, null);
      }
      if (src.adminUp && !src.lineUp) {
        return buildResult("src_link_down", dst, srcInterfaceName, 0, 0, null);
      }
    }
  }

  // 2) Reserved destinations.
  if (dst === "0.0.0.0" || dst === "255.255.255.255") {
    return buildResult("bad_dest", dst, srcInterfaceName, 0, PING_PACKET_COUNT, null);
  }

  // 3) Real routing-table resolution.
  const route = resolveRoute(dst, state);
  if (!route.matched) {
    return buildResult("no_route", dst, srcInterfaceName, 0, PING_PACKET_COUNT, route);
  }

  // 4) Deterministic seeded outcome for a resolved route.
  const sourceKind = route.sourceKind as Exclude<CiscoRouteSourceKind, "none">;
  const successRate = SUCCESS_RATE[sourceKind];
  let received = 0;
  for (let i = 0; i < PING_PACKET_COUNT; i++) {
    if (rand() < successRate) received++;
  }
  const lossPct = Math.round(((PING_PACKET_COUNT - received) / PING_PACKET_COUNT) * 100);
  const kind: PingOutcomeKind = received === PING_PACKET_COUNT ? "ok" : received === 0 ? "fail" : "partial";

  let minMs: number | null = null;
  let avgMs: number | null = null;
  let maxMs: number | null = null;
  if (received > 0) {
    const [lo, hi] = LATENCY_BAND[sourceKind];
    const avg = randInt(rand, lo, hi);
    minMs = Math.max(1, avg - randInt(rand, 1, Math.max(1, Math.round((hi - lo) * 0.2))));
    maxMs = avg + randInt(rand, 1, Math.max(1, Math.round((hi - lo) * 0.3)));
    avgMs = avg;
  }

  return {
    kind,
    dst,
    src: srcInterfaceName,
    sent: PING_PACKET_COUNT,
    received,
    lossPct,
    minMs,
    avgMs,
    maxMs,
    route,
  };
}

function buildResult(
  kind: PingOutcomeKind,
  dst: string,
  src: string | null,
  received: number,
  sent: number,
  route: CiscoRouteResolution | null,
): PingResult {
  const lossPct = sent > 0 ? Math.round(((sent - received) / sent) * 100) : 100;
  return { kind, dst, src, sent, received, lossPct, minMs: null, avgMs: null, maxMs: null, route };
}

// ===== Traceroute simulation =====

/** Plausible hop-count band per sourceKind (connected is always exactly 1 hop). */
const HOP_COUNT_BAND: Record<Exclude<CiscoRouteSourceKind, "none">, [number, number]> = {
  connected: [1, 1],
  static: [2, 3],
  ospf: [2, 4],
  eigrp: [2, 4],
  bgp: [4, 8],
};

/**
 * Builds a real hop chain from the resolved route rather than source's fully
 * random black-hole/arrival logic. Hop 1 is the egress interface's own IP (or, for
 * directly-connected destinations, a single hop showing dst itself). Subsequent
 * hops are synthesized deterministically along a plausible path length for the
 * resolved sourceKind, with increasing RTT. The last hop is `dst` itself when the
 * route resolves (reached: true); an unresolved route produces a short chain of
 * timed-out hops with no address progression (mirrors ping's "no_route" outcome).
 */
export function simulateTraceroute(dst: string, srcInterfaceName: string | null, state: CiscoState, seed: number): TraceResult {
  const rand = rng(seed);

  const route = resolveRoute(dst, state);
  if (!route.matched) {
    const hops: TraceHop[] = [];
    const timeoutHops = randInt(rand, 2, 4);
    for (let i = 1; i <= timeoutHops; i++) {
      hops.push({ hop: i, address: "*", rttMs: null, timedOut: true });
    }
    return { dst, src: srcInterfaceName, hops, reached: false };
  }

  const sourceKind = route.sourceKind as Exclude<CiscoRouteSourceKind, "none">;

  // Directly connected: single hop showing the destination itself.
  if (sourceKind === "connected") {
    const rttMs = randInt(rand, 1, 4);
    return {
      dst,
      src: srcInterfaceName,
      hops: [{ hop: 1, address: dst, rttMs, timedOut: false }],
      reached: true,
    };
  }

  const [lo, hi] = HOP_COUNT_BAND[sourceKind];
  const hopCount = randInt(rand, lo, hi);
  const egressIface = route.egressInterface ? state.interfaces.find((i) => i.name === route.egressInterface) : null;
  const firstHopAddr = route.nextHop || egressIface?.ip || dst;

  const hops: TraceHop[] = [];
  let prevRtt = 0;
  for (let hopNum = 1; hopNum <= hopCount; hopNum++) {
    const isLast = hopNum === hopCount;
    const address = isLast ? dst : hopNum === 1 ? firstHopAddr : synthesizeTransitHop(rand, sourceKind, hopNum);
    // RTT increases plausibly with each hop, with small seeded jitter.
    const step = sourceKind === "bgp" ? randInt(rand, 8, 25) : randInt(rand, 2, 10);
    const rttMs = Math.max(1, prevRtt + step);
    prevRtt = rttMs;
    hops.push({ hop: hopNum, address, rttMs, timedOut: false });
  }

  return { dst, src: srcInterfaceName, hops, reached: true };
}

/** Deterministic filler IP for an intermediate (non-first, non-last) transit hop. */
function synthesizeTransitHop(rand: () => number, sourceKind: Exclude<CiscoRouteSourceKind, "none">, hopNum: number): string {
  if (sourceKind === "bgp") {
    // Simulate internet transit through a couple of plausible provider blocks.
    return hopNum % 2 === 0 ? `72.14.${randInt(rand, 200, 250)}.${randInt(rand, 1, 254)}` : `142.250.${randInt(rand, 1, 254)}.${randInt(rand, 1, 254)}`;
  }
  // Internal routed hop — stay within the private space used by the seeded topology.
  return `10.10.${randInt(rand, 1, 254)}.${randInt(rand, 1, 254)}`;
}
