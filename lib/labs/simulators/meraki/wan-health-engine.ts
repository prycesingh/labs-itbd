import type { MerakiAlert, MerakiDevice, MerakiWanHealthSample, MerakiWanLink } from "./types";

// ===== WAN health sampling engine =====
//
// This module is the "real engine" behind source's frozen, hardcoded WAN loss/latency/
// jitter numbers (meraki-security.js renderApplianceStatus(), meraki-network.js
// renderHealth() WAN uplinks table, meraki-insight.js renderWanHealth()'s
// `fakeTrend()` which used `Math.random()` purely for on-the-fly chart cosmetics and
// never persisted anything). Here, each call to `sampleWanHealth` genuinely advances
// the device's live WAN link numbers with small seeded drift and appends a durable
// `MerakiWanHealthSample` history entry — including real failover behavior when a link
// degrades past a threshold.
//
// ---- Call pattern the UI must use ----
// Dispatch `{ type: "SAMPLE_WAN_HEALTH", serial }` on an interval (e.g. every 5-10s)
// for networks/pages that show live WAN health, similar to the other tick-driven
// engines in this simulator. Each call is a single sampling step — it does not
// schedule anything itself.

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

const FAILOVER_LOSS_THRESHOLD = 15; // percent

function driftLink(link: MerakiWanLink, seed: number): MerakiWanLink {
  const rand = rng(seed);
  // Small, believable deltas — not wild swings. Loss/jitter tend to hover near their
  // current value with occasional small excursions; latency drifts a few ms.
  const lossDelta = (rand() - 0.5) * 0.6;
  const latencyDelta = (rand() - 0.5) * 3;
  const jitterDelta = (rand() - 0.5) * 0.5;

  const nextLoss = Math.max(0, Math.round((link.loss + lossDelta) * 10) / 10);
  const nextLatency = Math.max(1, Math.round(link.latency + latencyDelta));
  const nextJitter = Math.max(0, Math.round((link.jitter + jitterDelta) * 10) / 10);

  return { ...link, loss: nextLoss, latency: nextLatency, jitter: nextJitter };
}

export type SampleWanHealthResult = {
  updatedDevice: MerakiDevice;
  samples: MerakiWanHealthSample[];
  failoverAlert: MerakiAlert | null;
};

/**
 * Samples both WAN links (wan1 always; wan2 if present) on an appliance device,
 * applying seeded jitter/drift to loss/latency/jitter. If wan1's loss crosses
 * `FAILOVER_LOSS_THRESHOLD` while a healthy wan2 exists (not already failed), flips
 * wan1 to "failed" and wan2 to "active" and returns a critical `failoverAlert`.
 * Conversely, if wan1 was previously failed but wan2 is healthy and stable, this
 * function does not automatically fail back — that mirrors real MX behavior (failback
 * requires the primary to recover past the threshold on a subsequent sample, handled
 * naturally by the drift-then-recheck loop below since we always re-evaluate wan1's
 * current numbers each call).
 */
export function sampleWanHealth(device: MerakiDevice, seed: number, nowIso: string): SampleWanHealthResult {
  const samples: MerakiWanHealthSample[] = [];
  let failoverAlert: MerakiAlert | null = null;

  if (!device.wan1) {
    return { updatedDevice: device, samples, failoverAlert };
  }

  let wan1 = driftLink(device.wan1, seed * 2 + 1);
  let wan2 = device.wan2 ? driftLink(device.wan2, seed * 2 + 2) : undefined;

  const wan2Healthy = wan2 && wan2.status !== "failed" && wan2.loss < FAILOVER_LOSS_THRESHOLD;

  if (wan1.status !== "failed" && wan1.loss > FAILOVER_LOSS_THRESHOLD && wan2 && wan2Healthy) {
    wan1 = { ...wan1, status: "failed" };
    wan2 = { ...wan2, status: "active" };
    failoverAlert = {
      id: `al-failover-${device.serial}-${seed}`,
      ts: nowIso,
      severity: "critical",
      source: device.name,
      networkId: device.networkId,
      message: `Failed over to ${wan2.isp} (WAN2) — WAN1 (${device.wan1.isp}) loss reached ${wan1.loss}%`,
    };
  }

  samples.push({
    ts: nowIso,
    networkId: device.networkId,
    serial: device.serial,
    link: "wan1",
    loss: wan1.loss,
    latency: wan1.latency,
    jitter: wan1.jitter,
    failoverTriggered: failoverAlert !== null,
  });
  if (wan2) {
    samples.push({
      ts: nowIso,
      networkId: device.networkId,
      serial: device.serial,
      link: "wan2",
      loss: wan2.loss,
      latency: wan2.latency,
      jitter: wan2.jitter,
      failoverTriggered: failoverAlert !== null,
    });
  }

  const updatedDevice: MerakiDevice = { ...device, wan1, wan2 };
  return { updatedDevice, samples, failoverAlert };
}
