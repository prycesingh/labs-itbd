"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AvdAutoShutdown, AvdHostPool, AvdSessionHost, AvdState } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import { Checkbox, DataTable, EmptyState, Field, NativeSelect, PropPair, RadioInline, StatusBadge } from "./avd-ui";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const DEFAULT_AUTO_SHUTDOWN: AvdAutoShutdown = {
  enabled: false,
  disconnectThresholdMin: 60,
  idleThresholdMin: 30,
  dailyShutdownTime: "20:00",
  timezone: "America/New_York",
  notifyBefore: true,
  notifyMinutes: 15,
  notifyMessage: "This VM will shut down soon. Save your work.",
  notifyToast: true,
  notifyEmail: false,
};

// Monthly VM cost is stored in AvdState.vmSizes; the source simulator derives
// an hourly rate by dividing by the average hours in a month (730) so
// per-host "hours run this month" figures can be priced out individually.
function monthlyCost(vmSizes: AvdState["vmSizes"], vmSize: string): number {
  return vmSizes.find((s) => s.name === vmSize)?.cost ?? 0;
}

function hourlyCost(vmSizes: AvdState["vmSizes"], vmSize: string): number {
  return monthlyCost(vmSizes, vmSize) / 730;
}

// Diagnostics has no real telemetry backing it in AvdState, so hours-run and
// last-heartbeat-derived figures are synthesized deterministically from the
// host id — mirrors the source simulator's seeded det() generator so values
// stay stable across re-renders instead of reshuffling on every keystroke.
function seededHoursThisMonth(hostId: string, status: AvdSessionHost["status"]): number {
  const seed = Math.abs(hostId.split("").reduce((acc, ch) => (acc << 5) - acc + ch.charCodeAt(0), 0));
  const det = (seed * 37) % 720;
  return status === "Shutdown" ? det % 200 : det;
}

export function PersonalDesktopsPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const personalPools = useMemo(() => state.hostPools.filter((p) => p.type === "Personal"), [state.hostPools]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>(personalPools[0]?.id ?? "");

  const pool = personalPools.find((p) => p.id === selectedPoolId) ?? personalPools[0] ?? null;

  const hosts = useMemo(
    () => (pool ? state.sessionHosts.filter((h) => h.hostPool === pool.name) : []),
    [state.sessionHosts, pool],
  );

  // All hosts across every Personal-type pool, used for the cost summary and
  // to scope the diagnostics table to Personal desktops only.
  const allPersonalHosts = useMemo(() => {
    const personalPoolNames = new Set(personalPools.map((p) => p.name));
    return state.sessionHosts.filter((h) => personalPoolNames.has(h.hostPool));
  }, [state.sessionHosts, personalPools]);

  const totalMonthlyCost = useMemo(
    () => allPersonalHosts.reduce((sum, h) => sum + monthlyCost(state.vmSizes, h.vmSize), 0),
    [allPersonalHosts, state.vmSizes],
  );

  const eligibleUsers = useMemo(() => state.users.filter((u) => u.role === "AVD User"), [state.users]);

  if (personalPools.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Personal desktops</h1>
        <p className={styles.help} style={{ marginBottom: 20 }}>
          Direct user-to-host assignment, auto-shutdown and diagnostics
        </p>
        <EmptyState message="No Personal-type host pools exist. Create one from the Host pools page." />
      </div>
    );
  }

  function assignUser(hostId: string, upn: string) {
    dispatch({ type: "SET_PERSONAL_ASSIGNMENT", hostId, upn: upn || undefined });
    toast.success(upn ? `Host assigned to ${upn}` : "Host unassigned");
  }

  function unassign(host: AvdSessionHost) {
    if (!window.confirm(`Unassign ${host.assignedUser || "(no user)"} from ${host.name}?`)) return;
    dispatch({ type: "SET_PERSONAL_ASSIGNMENT", hostId: host.id, upn: undefined });
    toast.info("Host unassigned");
  }

  function setAssignmentMode(mode: AvdHostPool["assignmentType"]) {
    if (!pool) return;
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { assignmentType: mode } });
  }

  function setAutoShutdown(patch: Partial<AvdAutoShutdown>) {
    if (!pool) return;
    const current = pool.autoShutdown ?? DEFAULT_AUTO_SHUTDOWN;
    dispatch({ type: "SET_AUTO_SHUTDOWN", hostPoolId: pool.id, autoShutdown: { ...current, ...patch } });
  }

  const autoShutdown = pool?.autoShutdown ?? DEFAULT_AUTO_SHUTDOWN;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Personal desktops</h1>
      <p className={styles.help} style={{ marginBottom: 20 }}>
        Direct user-to-host assignment, auto-shutdown and diagnostics
      </p>

      <div className={styles.sectionCard}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className={styles.help}>Host pool:</span>
          <div style={{ width: 260 }}>
            <NativeSelect value={selectedPoolId} onChange={setSelectedPoolId}>
              {personalPools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          {pool ? (
            <>
              <span className={`${styles.badge} ${styles.badgeOutline}`}>{pool.type}</span>
              <span className={`${styles.badge} ${styles.badgeOutline}`}>{pool.assignmentType} assignment</span>
            </>
          ) : null}
        </div>
      </div>

      {pool ? (
        <>
          <div className={styles.sectionCard}>
            <h3>Assignment</h3>
            <Field label="Assignment mode" help="Automatic assigns the next available host on first connect. Direct requires an explicit user-host mapping.">
              <RadioInline
                name="pd-mode"
                value={pool.assignmentType}
                onChange={(v) => setAssignmentMode(v as AvdHostPool["assignmentType"])}
                choices={["Automatic", "Direct"]}
              />
            </Field>

            {hosts.length === 0 ? (
              <EmptyState message="No session hosts in this pool." />
            ) : (
              <DataTable columns={["Host", "Status", "VM size", "Monthly cost", "Assigned user", "Assign"]}>
                {hosts.map((h) => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>
                      <StatusBadge status={h.status} />
                    </td>
                    <td>{h.vmSize || "—"}</td>
                    <td>${monthlyCost(state.vmSizes, h.vmSize).toFixed(2)}</td>
                    <td>{h.assignedUser || <span className={styles.help}>Unassigned</span>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 220 }}>
                          <NativeSelect value={h.assignedUser ?? ""} onChange={(v) => assignUser(h.id, v)}>
                            <option value="">(unassigned)</option>
                            {eligibleUsers.map((u) => (
                              <option key={u.upn} value={u.upn}>
                                {u.displayName} ({u.upn})
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        {h.assignedUser ? (
                          <button type="button" className={styles.link} onClick={() => unassign(h)}>
                            Unassign
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>

          <div className={styles.sectionCard}>
            <h3>Auto-shutdown</h3>
            <p>Automatically shut down idle Personal VMs to reduce cost.</p>

            <Checkbox
              label="Enable auto-shutdown when idle"
              checked={autoShutdown.enabled}
              onChange={(checked) => setAutoShutdown({ enabled: checked })}
            />

            <h4 style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 8px" }}>Idle thresholds</h4>
            <Field label="Disconnect time threshold" help="Minutes after user disconnect before the host is shut down.">
              <input
                type="number"
                min={0}
                max={1440}
                value={autoShutdown.disconnectThresholdMin}
                onChange={(e) => setAutoShutdown({ disconnectThresholdMin: parseInt(e.target.value, 10) || 0 })}
                className={styles.input}
                style={{ width: 140 }}
              />
            </Field>
            <Field label="Idle session time" help="Minutes a connected user can be idle before a warning is issued.">
              <input
                type="number"
                min={0}
                max={1440}
                value={autoShutdown.idleThresholdMin}
                onChange={(e) => setAutoShutdown({ idleThresholdMin: parseInt(e.target.value, 10) || 0 })}
                className={styles.input}
                style={{ width: 140 }}
              />
            </Field>

            <h4 style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 8px" }}>Daily scheduled shutdown</h4>
            <Field label="Daily auto-shutdown time">
              <input
                type="time"
                value={autoShutdown.dailyShutdownTime}
                onChange={(e) => setAutoShutdown({ dailyShutdownTime: e.target.value })}
                className={styles.input}
                style={{ width: 160 }}
              />
            </Field>
            <Field label="Time zone">
              <NativeSelect value={autoShutdown.timezone} onChange={(v) => setAutoShutdown({ timezone: v })}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <h4 style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 8px" }}>Notifications</h4>
            <Checkbox
              label="Notify before shutdown"
              checked={autoShutdown.notifyBefore}
              onChange={(checked) => setAutoShutdown({ notifyBefore: checked })}
            />
            <Field label="Notification minutes before shutdown">
              <input
                type="number"
                min={1}
                max={120}
                value={autoShutdown.notifyMinutes}
                onChange={(e) => setAutoShutdown({ notifyMinutes: parseInt(e.target.value, 10) || 1 })}
                className={styles.input}
                style={{ width: 140 }}
              />
            </Field>
            <Field label="Notification message">
              <textarea
                rows={3}
                value={autoShutdown.notifyMessage}
                onChange={(e) => setAutoShutdown({ notifyMessage: e.target.value })}
                className={styles.textarea}
              />
            </Field>
            <Field label="Notification methods">
              <div style={{ display: "flex", gap: 16 }}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={autoShutdown.notifyToast}
                    onChange={(e) => setAutoShutdown({ notifyToast: e.target.checked })}
                  />
                  Toast (in-session)
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={autoShutdown.notifyEmail}
                    onChange={(e) => setAutoShutdown({ notifyEmail: e.target.checked })}
                  />
                  Email
                </label>
              </div>
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => toast.success("Auto-shutdown saved")}
              >
                Save auto-shutdown
              </button>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  const assignedCount = hosts.filter((h) => h.assignedUser).length;
                  const via: string[] = [];
                  if (autoShutdown.notifyToast) via.push("toast");
                  if (autoShutdown.notifyEmail) via.push("email");
                  if (via.length === 0) via.push("none");
                  toast.info(
                    `Test notification sent to ${assignedCount} user(s) via ${via.join(" + ")} (${autoShutdown.notifyMinutes} min lead time).`,
                  );
                }}
              >
                Send test notification
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className={styles.sectionCard}>
        <h3>Diagnostics &amp; cost</h3>
        <p>Per-host state, assigned user, hours running this month, estimated cost and total monthly cost across all Personal desktops.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginBottom: 16 }}>
          <PropPair label="Personal desktops" value={allPersonalHosts.length} />
          <PropPair label="Total estimated monthly cost" value={`$${totalMonthlyCost.toFixed(2)}`} />
        </div>

        {allPersonalHosts.length === 0 ? (
          <EmptyState message="No Personal desktops found." />
        ) : (
          <DataTable columns={["Host", "Pool", "Current state", "Last heartbeat", "Assigned user", "VM size", "Hours this month", "Estimated cost"]}>
            {allPersonalHosts.map((h) => {
              const runHours = seededHoursThisMonth(h.id, h.status);
              const cost = runHours * hourlyCost(state.vmSizes, h.vmSize);
              const stateLabel = h.status === "Shutdown" ? "Deallocated" : h.status;
              return (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>{h.hostPool}</td>
                  <td>
                    <StatusBadge status={stateLabel} />
                  </td>
                  <td>{h.lastHeartbeat ? new Date(h.lastHeartbeat).toLocaleString() : "—"}</td>
                  <td>{h.assignedUser || <span className={styles.help}>—</span>}</td>
                  <td>{h.vmSize || "—"}</td>
                  <td>{runHours} h</td>
                  <td>${cost.toFixed(2)}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}
