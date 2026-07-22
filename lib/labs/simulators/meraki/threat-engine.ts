import type { MerakiFirewallL3Rule, MerakiFirewallL7Rule, MerakiState, MerakiThreatEvent } from "./types";

// ===== Threat generation engine (flagship "make it real" engine for Meraki) =====
//
// Source's "security center" (meraki-security.js renderSecCenter()) is a fully
// hardcoded 6-row table of threats with a fixed `action` string ("Blocked" /
// "Quarantined" / "Warned" / "Logged") that bears no relationship to the firewall or
// content-filtering configuration — the numbers never change and are not derived from
// anything. This engine is the real replacement: each generated event genuinely
// cross-references the network's current L3/L7 firewall rules and content-filtering
// blocked categories to decide whether the event would actually be blocked, alerted,
// or allowed — directly analogous to Defender's hunting engine / Sentinel's KQL engine.
//
// ---- Call pattern the UI must use ----
// Dispatch `{ type: "GENERATE_THREAT_EVENT", networkId }` on an interval (e.g. every
// 8-15s) for a security-center-style page, or on-demand from a "Simulate threat"
// button. Each call produces exactly one new `MerakiThreatEvent` to prepend onto
// `state.threatEvents`.

// Deterministic seeded PRNG (Lehmer/Park-Miller LCG) — same LCG family used across
// every ported simulator's seed data and engines in this app.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

function randInt(rand: () => number, lo: number, hi: number): number {
  return Math.floor(rand() * (hi - lo + 1)) + lo;
}

// Threat-signature bank — ports/expands source's original 6-row category vocabulary
// (Snort IPS rule, AMP retrospective, HTTP exploit, C2 beacon, phishing, IoT cleartext
// credential post) into a reusable signature catalog per category, each pre-tagged
// with the L7 "type"/"value" or destination-port characteristics a firewall rule would
// need to match in order to genuinely block it.
type ThreatCategory = {
  category: string;
  signatures: string[];
  severity: MerakiThreatEvent["severity"];
  // destPort this category's traffic would use, so L3 rule matching is meaningful.
  destPort: string;
  // an L7 "application" or "application-category" value this traffic resembles, so L7
  // rule matching is meaningful.
  l7Value: string;
  l7Type: "application" | "application-category";
};

const THREAT_CATALOG: ThreatCategory[] = [
  { category: "Malware callback", signatures: ["AMP retrospective: malicious SHA256", "C&C beacon to known bad domain"], severity: "critical", destPort: "443", l7Value: "BitTorrent", l7Type: "application" },
  { category: "Port scan", signatures: ["Snort 1:41815 - TCP SYN port scan detected", "Nmap-style sequential probe"], severity: "warning", destPort: "Any", l7Type: "application-category", l7Value: "Peer-to-peer" },
  { category: "Brute force", signatures: ["Snort 1:48022 - SSH brute-force attempt", "Repeated RDP auth failures"], severity: "warning", destPort: "22,3389", l7Type: "application", l7Value: "TOR" },
  { category: "Data exfiltration attempt", signatures: ["IoT cleartext credential post", "Large outbound transfer to unknown host"], severity: "warning", destPort: "443", l7Type: "application-category", l7Value: "Online gaming" },
  { category: "Botnet C2", signatures: ["Snort 1:35021 - Suspicious .pkx download", "Beacon interval matches known botnet"], severity: "critical", destPort: "443", l7Type: "application", l7Value: "TikTok" },
  { category: "Blocked category access", signatures: ["Content filter category match", "Phishing page visit (Talos category)"], severity: "info", destPort: "80,443", l7Type: "application-category", l7Value: "Adult content" },
];

function randomPrivateIp(rand: () => number): string {
  const bases = ["10.0.10.", "10.0.20.", "10.0.30.", "10.0.40."];
  return `${pick(rand, bases)}${randInt(rand, 2, 254)}`;
}

function randomPublicIp(rand: () => number): string {
  // Plausible-looking public destination ranges (avoid RFC1918).
  const octet1 = pick(rand, [45, 91, 103, 141, 185, 198, 203]);
  return `${octet1}.${randInt(rand, 1, 254)}.${randInt(rand, 1, 254)}.${randInt(rand, 1, 254)}`;
}

/**
 * Finds an enabled L3 rule with `policy: "deny"` whose destPort matches (or is "Any")
 * the threat's characteristic destPort — a genuine cross-reference against the
 * network's firewall configuration, not a coin flip.
 */
function findMatchingL3DenyRule(threat: ThreatCategory, firewallL3: MerakiFirewallL3Rule[]): MerakiFirewallL3Rule | null {
  for (const rule of firewallL3) {
    if (!rule.enabled || rule.policy !== "deny") continue;
    if (rule.destPort === "Any" || rule.destPort === threat.destPort) return rule;
    // Partial match: rule lists multiple comma-separated ports, threat's destPort is
    // one of several comma-separated ports too — match if they share any port.
    const ruleParts = rule.destPort.split(",").map((p) => p.trim());
    const threatParts = threat.destPort.split(",").map((p) => p.trim());
    if (ruleParts.some((p) => threatParts.includes(p))) return rule;
  }
  return null;
}

function findMatchingL7DenyRule(threat: ThreatCategory, firewallL7: MerakiFirewallL7Rule[]): MerakiFirewallL7Rule | null {
  return firewallL7.find((rule) => rule.policy === "deny" && rule.type === threat.l7Type && rule.value === threat.l7Value) ?? null;
}

/**
 * THE FLAGSHIP GENERATOR. Picks a signature/category from the catalog, generates
 * plausible src/dest IPs, then genuinely cross-references the network's enabled L3/L7
 * firewall rules and content-filtering blocked categories to decide the outcome:
 *  - An enabled L3 deny rule matching the threat's destination port -> "blocked",
 *    `matchedRuleId` set to that rule's id.
 *  - Else an enabled L7 deny rule matching the threat's application/category ->
 *    "blocked", `matchedRuleId` set to that rule's id.
 *  - Else if the threat's L7 category (when it's an "application-category" threat)
 *    appears in `contentFiltering.blockedCategories` -> "blocked", `matchedRuleId` null
 *    (content filtering isn't a discrete rule id, matching source's blockedCategories
 *    list which has no per-entry id).
 *  - Else critical/warning severity threats that go unblocked are "alerted" (a human
 *    would want to know); info-severity unblocked threats are "allowed".
 */
export function generateThreatEvent(
  networkId: string,
  firewallL3: MerakiFirewallL3Rule[],
  firewallL7: MerakiFirewallL7Rule[],
  contentFiltering: MerakiState["contentFiltering"],
  seed: number,
  nowIso: string,
): MerakiThreatEvent {
  const rand = rng(seed);
  const threat = pick(rand, THREAT_CATALOG);
  const signature = pick(rand, threat.signatures);
  const srcIp = randomPrivateIp(rand);
  const destIp = randomPublicIp(rand);

  const l3Match = findMatchingL3DenyRule(threat, firewallL3);
  const l7Match = !l3Match ? findMatchingL7DenyRule(threat, firewallL7) : null;
  const contentMatch =
    !l3Match && !l7Match && threat.l7Type === "application-category" && contentFiltering.blockedCategories.includes(threat.l7Value.replace("Adult content", "Adult and Pornography"));

  let action: MerakiThreatEvent["action"];
  let matchedRuleId: string | null = null;

  if (l3Match) {
    action = "blocked";
    matchedRuleId = l3Match.id;
  } else if (l7Match) {
    action = "blocked";
    matchedRuleId = l7Match.id;
  } else if (contentMatch) {
    action = "blocked";
    matchedRuleId = null;
  } else if (threat.severity === "info") {
    action = "allowed";
  } else {
    action = "alerted";
  }

  return {
    id: `th-gen-${seed}-${Math.floor(rand() * 1e6)}`,
    ts: nowIso,
    networkId,
    severity: threat.severity,
    category: threat.category,
    signature,
    srcIp,
    destIp,
    action,
    matchedRuleId,
  };
}
