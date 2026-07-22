import type { MerakiDevice } from "./types";

// ===== Device lifecycle state-machine engine =====
//
// This module is the "real engine" for Meraki device reboot / firmware-update
// lifecycles — the counterpart to azure-devops/pipeline-engine.ts's
// `createStageRuns`/`advanceStageRuns`. Source (meraki-security.js's "Reboot" button,
// meraki-wireless.js's AP modal "Reboot" button) faked this instantly via
// `MerakiPortal.toast('...rebooted', 'ok')` with no state transition at all. This
// engine makes it a real, persisted, tick-driven countdown on `device.pendingAction`.
//
// ---- Call pattern the UI must use ----
// 1. On "Reboot" / "Update firmware", dispatch `{ type: "START_DEVICE_REBOOT", serial }`
//    or `{ type: "START_FIRMWARE_UPDATE", serial, targetVersion }`. The reducer calls
//    `startReboot`/`startFirmwareUpdate` internally, which sets `device.status` and
//    seeds `device.pendingAction` with a tick countdown.
// 2. While `device.pendingAction` is non-null, the page should run a real wall-clock
//    timer (e.g. `setInterval(() => dispatch({ type: "ADVANCE_DEVICE_LIFECYCLE", serial }), 2000)`)
//    so the device visibly progresses tick-by-tick. Each tick calls `advanceLifecycle`
//    exactly once via the reducer.
// 3. Stop the timer once the reducer reports `device.pendingAction` is null again
//    (the action reached its terminal state) — advancing a device with no
//    `pendingAction` is a no-op but the UI should still clear its interval.

// Extend the pendingAction shape locally with an optional target firmware version,
// carried through the tick countdown for firmware updates (types.ts's pendingAction
// only declares kind/startedAt/ticksRemaining; we store the target version in a
// parallel WeakMap-free approach by stashing it on the object itself via an
// intersection type, since MerakiDevice.pendingAction is a plain object literal type
// and TS structural typing allows the extra property through call sites that know
// about it).
type PendingAction = NonNullable<MerakiDevice["pendingAction"]> & { targetFirmware?: string };

const REBOOT_TICKS = 3;
const FIRMWARE_UPDATE_TICKS = 6;

/**
 * Begins a reboot: flips the device offline-ish into a "rebooting" status and seeds a
 * tick countdown. `nowIso` is caller-supplied (engines stay pure/deterministic — no
 * `new Date()`/`Date.now()` in here).
 */
export function startReboot(device: MerakiDevice, nowIso: string): MerakiDevice {
  const pendingAction: PendingAction = { kind: "reboot", startedAt: nowIso, ticksRemaining: REBOOT_TICKS };
  return { ...device, status: "rebooting", pendingAction };
}

/**
 * Begins a firmware update: flips the device to "updating" and seeds a longer tick
 * countdown, stashing `targetVersion` on the pendingAction so `advanceLifecycle` can
 * apply it once the countdown reaches zero.
 */
export function startFirmwareUpdate(device: MerakiDevice, targetVersion: string, nowIso: string): MerakiDevice {
  const pendingAction: PendingAction = { kind: "firmware-update", startedAt: nowIso, ticksRemaining: FIRMWARE_UPDATE_TICKS, targetFirmware: targetVersion };
  return { ...device, status: "updating", pendingAction };
}

export type AdvanceLifecycleResult = { device: MerakiDevice; auditMessage: string } | null;

/**
 * THE CORE STATE-MACHINE STEP. Decrements `pendingAction.ticksRemaining`; when it
 * reaches 0, resolves the pending action:
 *  - `kind === "reboot"`: device returns to "online", uptime resets, `lastReboot` is
 *    stamped to `nowIso`, `pendingAction` is cleared.
 *  - `kind === "firmware-update"`: device returns to "online", `firmware` is set to
 *    the stashed target version, uptime resets, `lastReboot` is stamped, `pendingAction`
 *    is cleared.
 *
 * Returns `null` if the device has no `pendingAction` (nothing to advance — a no-op
 * the caller/reducer should treat as "stop polling"). Otherwise returns the updated
 * device plus a human-readable audit-log-worthy message describing what happened this
 * tick (either "N ticks remaining" or the terminal completion message).
 */
export function advanceLifecycle(device: MerakiDevice, nowIso: string): AdvanceLifecycleResult {
  const pending = device.pendingAction as PendingAction | null | undefined;
  if (!pending) return null;

  const ticksRemaining = pending.ticksRemaining - 1;

  if (ticksRemaining > 0) {
    const updated: MerakiDevice = { ...device, pendingAction: { ...pending, ticksRemaining } };
    const label = pending.kind === "reboot" ? "Reboot" : "Firmware update";
    return { device: updated, auditMessage: `${label} in progress on ${device.name} (${ticksRemaining} tick${ticksRemaining === 1 ? "" : "s"} remaining)` };
  }

  if (pending.kind === "reboot") {
    const updated: MerakiDevice = {
      ...device,
      status: "online",
      uptimeDays: 0,
      lastReboot: nowIso,
      pendingAction: null,
    };
    return { device: updated, auditMessage: `Rebooted device ${device.name}` };
  }

  // firmware-update
  const targetFirmware = pending.targetFirmware ?? device.firmwareLatest;
  const updated: MerakiDevice = {
    ...device,
    status: "online",
    firmware: targetFirmware,
    uptimeDays: 0,
    lastReboot: nowIso,
    pendingAction: null,
  };
  return { device: updated, auditMessage: `Upgraded firmware on ${device.name} to ${targetFirmware}` };
}
