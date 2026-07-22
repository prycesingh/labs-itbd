import type { MerakiClient, MerakiDevice } from "./types";

// ===== Client roam state-machine engine =====
//
// Source has no concept of clients moving between APs at all — `connectedTo` is a
// frozen string assigned once at seed time (meraki-data.js buildSeed()'s client loop).
// This engine makes wireless clients genuinely roam: cycling through
// "stable" -> occasionally "roaming" -> "reconnecting" -> back to "stable" with a new
// `connectedTo`/`signal`, and occasionally "disconnecting" -> offline -> later
// reconnecting. Roam target selection is real: it weights candidate APs by their
// current channel utilization (lower util = more attractive), not arbitrary.
//
// ---- Call pattern the UI must use ----
// Dispatch `{ type: "ADVANCE_CLIENT_ROAM", clientId }` on an interval (e.g. every
// 3-5s) for wireless clients being actively observed, same tick-based convention as
// the other three engines in this simulator. Each call performs exactly one state
// transition — it does not schedule anything itself.

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

// Transition probabilities, evaluated from "stable" each tick.
const ROAM_START_CHANCE = 0.12;
const DISCONNECT_CHANCE = 0.03;

/**
 * Picks a roam target AP from the pool of wireless APs in the client's network
 * (excluding the client's current AP), weighted toward APs with lower combined
 * channel utilization (channelUtil24 + channelUtil5) — a genuinely load-aware choice,
 * not an arbitrary pick. Falls back to the original AP if no alternatives exist.
 */
function pickRoamTarget(client: MerakiClient, aps: MerakiDevice[], seed: number): MerakiDevice | null {
  const candidates = aps.filter((ap) => ap.type === "wireless" && ap.networkId === client.networkId && ap.serial !== client.connectedTo);
  if (!candidates.length) return null;

  // Weight = inverse of (utilization + 1) so lower-utilization APs get proportionally
  // larger weight buckets in the cumulative-weight roll below.
  const weights = candidates.map((ap) => 1 / ((ap.channelUtil24 ?? 0) + (ap.channelUtil5 ?? 0) + 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const rand = rng(seed);
  const roll = rand() * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (roll <= cumulative) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * THE CORE STATE-MACHINE STEP. Advances a wireless client's roam state by exactly one
 * tick:
 *  - "stable": small seeded chance to start "disconnecting"; otherwise small seeded
 *    chance to start "roaming" (target AP chosen now, held for the transition);
 *    otherwise stays "stable".
 *  - "roaming": moves to "reconnecting" (association in progress on the new AP).
 *  - "reconnecting": completes the roam — `connectedTo` becomes the new AP's serial,
 *    `signal` is recalculated (stronger signal on a less-utilized AP, weaker on a
 *    busier one), state returns to "stable".
 *  - "disconnecting": client goes `status: "offline"`, state moves to "stable" (so a
 *    later tick can naturally re-attempt a reconnect via the normal stable-state
 *    roll — mirrors real Wi-Fi client behavior of periodic reassociation attempts).
 *
 * No-op (returns the client unchanged) for wired clients or clients with no AP to
 * roam onto.
 */
export function advanceClientRoam(client: MerakiClient, aps: MerakiDevice[], seed: number, nowIso: string): MerakiClient {
  if (client.connectivity !== "Wireless") return client;

  const rand = rng(seed);
  const state = client.roamState ?? "stable";

  if (state === "roaming") {
    return { ...client, roamState: "reconnecting", roamTicksRemaining: 0 };
  }

  if (state === "reconnecting") {
    const target = pickRoamTarget(client, aps, seed + 1);
    if (!target) return { ...client, roamState: "stable" };
    const util = (target.channelUtil24 ?? 0) + (target.channelUtil5 ?? 0);
    // Stronger (less negative) signal on a less-utilized AP; weaker on a busier one.
    const signal = -1 * Math.round(35 + util * 0.6 + rand() * 8);
    return {
      ...client,
      connectedTo: target.serial,
      ssid: client.ssid,
      signal,
      status: "online",
      lastSeen: nowIso,
      roamState: "stable",
    };
  }

  if (state === "disconnecting") {
    return { ...client, status: "offline", roamState: "stable", lastSeen: nowIso };
  }

  // state === "stable"
  if (client.status === "offline") {
    // Give an offline client a chance to reconnect on this tick.
    const reconnectRoll = rand();
    if (reconnectRoll < 0.3) {
      return { ...client, roamState: "reconnecting" };
    }
    return client;
  }

  const disconnectRoll = rand();
  if (disconnectRoll < DISCONNECT_CHANCE) {
    return { ...client, roamState: "disconnecting" };
  }

  const roamRoll = rand();
  if (roamRoll < ROAM_START_CHANCE) {
    return { ...client, roamState: "roaming" };
  }

  return client;
}
