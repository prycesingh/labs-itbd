"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AvdSessionHost, AvdState } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import { DataTable, EmptyState, NativeSelect, PropPair, StatusBadge } from "./avd-ui";

const STATUS_OPTIONS: (AvdSessionHost["status"] | "all")[] = ["all", "Available", "Unavailable", "Shutdown", "Upgrading"];

type UserSession = {
  user: string;
  state: "Active" | "Disconnected";
  duration: string;
  clientName: string;
};

// Session rows are synthesized from the host's `sessions` / `disconnectedSessions`
// counters (there's no per-session record in AvdState) — mirrors the source
// simulator's generateFakeSessions(), seeded off the host id so it stays
// stable across re-renders instead of reshuffling on every keystroke.
function fakeSessions(host: AvdSessionHost, users: AvdState["users"]): UserSession[] {
  const upns = users.filter((u) => u.role === "AVD User").map((u) => u.upn);
  const seed = host.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  let rand = seed;
  const next = () => {
    rand = (rand * 9301 + 49297) % 233280;
    return rand / 233280;
  };
  const clientName = () => "WIN-" + Math.floor(next() * 36 ** 6).toString(36).toUpperCase().padStart(6, "0");

  const sessions: UserSession[] = [];
  const active = host.sessions || 0;
  const disconnected = host.disconnectedSessions || 0;

  for (let i = 0; i < active && i < upns.length; i++) {
    const hours = Math.floor(next() * 4) + 1;
    const minutes = Math.floor(next() * 60);
    sessions.push({ user: upns[i], state: "Active", duration: `${hours}h ${minutes}m`, clientName: clientName() });
  }
  for (let j = 0; j < disconnected && active + j < upns.length; j++) {
    sessions.push({ user: upns[active + j], state: "Disconnected", duration: "—", clientName: clientName() });
  }
  return sessions;
}

export function SessionHostsPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [poolFilter, setPoolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      state.sessionHosts.filter((h) => {
        if (poolFilter !== "all" && h.hostPool !== poolFilter) return false;
        if (statusFilter !== "all" && h.status !== statusFilter) return false;
        return true;
      }),
    [state.sessionHosts, poolFilter, statusFilter],
  );

  const selected = selectedId ? state.sessionHosts.find((h) => h.id === selectedId) ?? null : null;

  function clearFilters() {
    setPoolFilter("all");
    setStatusFilter("all");
  }

  function handleRestart(host: AvdSessionHost) {
    dispatch({ type: "UPDATE_SESSION_HOST", id: host.id, patch: { status: "Available", lastHeartbeat: new Date().toISOString() } });
    toast.success(`${host.name} restarted`);
  }

  function handleShutdown(host: AvdSessionHost) {
    dispatch({ type: "UPDATE_SESSION_HOST", id: host.id, patch: { status: "Shutdown", sessions: 0 } });
    toast.info(`${host.name} shut down`);
  }

  function handleDrainToggle(host: AvdSessionHost) {
    const drain = !host.drainMode;
    dispatch({ type: "DRAIN_SESSION_HOST", id: host.id, drain });
    toast.info(`Drain mode ${drain ? "enabled" : "disabled"} on ${host.name}`);
  }

  function handleAllowNewSessionsToggle(host: AvdSessionHost) {
    const allow = !host.allowNewSessions;
    dispatch({ type: "UPDATE_SESSION_HOST", id: host.id, patch: { allowNewSessions: allow } });
    toast.info(allow ? `New sessions allowed on ${host.name}` : `New sessions blocked on ${host.name}`);
  }

  function handleLogOffAll(host: AvdSessionHost) {
    dispatch({ type: "UPDATE_SESSION_HOST", id: host.id, patch: { sessions: 0, disconnectedSessions: 0 } });
    toast.info(`All user sessions logged off on ${host.name}`);
  }

  function handleRemove(host: AvdSessionHost) {
    if (!window.confirm(`Remove ${host.name} from its pool?`)) return;
    dispatch({ type: "REMOVE_SESSION_HOST", id: host.id });
    toast.info(`${host.name} removed`);
    setSelectedId(null);
  }

  function handleSessionAction(host: AvdSessionHost, action: "message" | "disconnect" | "signout") {
    if (action === "message") {
      toast.success("Message sent");
      return;
    }
    if (host.sessions > 0) {
      dispatch({ type: "UPDATE_SESSION_HOST", id: host.id, patch: { sessions: host.sessions - 1 } });
    } else if (host.disconnectedSessions > 0) {
      dispatch({ type: "UPDATE_SESSION_HOST", id: host.id, patch: { disconnectedSessions: host.disconnectedSessions - 1 } });
    }
    toast.info(action === "disconnect" ? "User session disconnected" : "User signed out");
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Session hosts</h1>
      <p className={styles.help} style={{ marginBottom: 20 }}>
        Cross-pool view of all registered hosts
      </p>

      <div className={styles.sectionCard}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <span className={styles.help}>Filter:</span>
          <div style={{ width: 220 }}>
            <NativeSelect value={poolFilter} onChange={setPoolFilter}>
              <option value="all">All pools</option>
              {state.hostPools.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div style={{ width: 180 }}>
            <NativeSelect value={statusFilter} onChange={(v) => setStatusFilter(v as (typeof STATUS_OPTIONS)[number])}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
                </option>
              ))}
            </NativeSelect>
          </div>
          <button type="button" className={styles.btnOutline} onClick={clearFilters}>
            Clear
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No session hosts match the filter." />
        ) : (
          <DataTable columns={["Host", "Status", "Sessions (a/d)", "Pool", "Allow new", "Agent", "OS", "Last heartbeat", ""]}>
            {filtered.map((h) => (
              <tr key={h.id}>
                <td>
                  <button type="button" className={styles.link} onClick={() => setSelectedId(h.id)}>
                    {h.name}
                  </button>
                </td>
                <td>
                  <StatusBadge status={h.status} />
                </td>
                <td>
                  {h.sessions || 0} / {h.disconnectedSessions || 0}
                </td>
                <td>{h.hostPool}</td>
                <td>
                  {h.allowNewSessions ? "Yes" : "No"}
                  {h.drainMode ? (
                    <span className={styles.badge} style={{ marginLeft: 6 }}>
                      drain
                    </span>
                  ) : null}
                </td>
                <td>{h.agentVersion}</td>
                <td>{h.os}</td>
                <td>{new Date(h.lastHeartbeat).toLocaleString()}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => setSelectedId(h.id)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <div className={styles.help} style={{ marginTop: 8 }}>
          Showing {filtered.length} of {state.sessionHosts.length}
        </div>
      </div>

      {selected ? (
        <SessionHostDetail
          host={selected}
          state={state}
          onClose={() => setSelectedId(null)}
          onRestart={handleRestart}
          onShutdown={handleShutdown}
          onDrainToggle={handleDrainToggle}
          onAllowNewSessionsToggle={handleAllowNewSessionsToggle}
          onLogOffAll={handleLogOffAll}
          onRemove={handleRemove}
          onSessionAction={handleSessionAction}
        />
      ) : null}
    </div>
  );
}

function SessionHostDetail({
  host,
  state,
  onClose,
  onRestart,
  onShutdown,
  onDrainToggle,
  onAllowNewSessionsToggle,
  onLogOffAll,
  onRemove,
  onSessionAction,
}: {
  host: AvdSessionHost;
  state: AvdState;
  onClose: () => void;
  onRestart: (host: AvdSessionHost) => void;
  onShutdown: (host: AvdSessionHost) => void;
  onDrainToggle: (host: AvdSessionHost) => void;
  onAllowNewSessionsToggle: (host: AvdSessionHost) => void;
  onLogOffAll: (host: AvdSessionHost) => void;
  onRemove: (host: AvdSessionHost) => void;
  onSessionAction: (host: AvdSessionHost, action: "message" | "disconnect" | "signout") => void;
}) {
  const sessions = useMemo(() => fakeSessions(host, state.users), [host, state.users]);

  return (
    <div className={styles.sectionCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>{host.name}</h3>
        <button type="button" className={styles.actBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginBottom: 16 }}>
        <PropPair label="Status" value={<StatusBadge status={host.status} />} />
        <PropPair label="Pool" value={host.hostPool} />
        <PropPair label="Agent version" value={host.agentVersion} />
        <PropPair label="OS" value={host.os} />
        <PropPair label="VM size" value={host.vmSize || "—"} />
        <PropPair label="Last heartbeat" value={new Date(host.lastHeartbeat).toLocaleString()} />
        <PropPair label="Drain mode" value={host.drainMode ? "On" : "Off"} />
        <PropPair label="Allow new sessions" value={host.allowNewSessions ? "Yes" : "No"} />
        {host.assignedUser ? <PropPair label="Assigned user" value={host.assignedUser} /> : null}
      </div>

      <div className={styles.sectionCard} style={{ background: "#faf9f8" }}>
        <h3>Actions</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={styles.btn} onClick={() => onDrainToggle(host)}>
            {host.drainMode ? "Take out of drain" : "Enter drain mode"}
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => onRestart(host)}>
            Restart
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => onShutdown(host)}>
            Shutdown
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => onAllowNewSessionsToggle(host)}>
            {host.allowNewSessions ? "Disallow new sessions" : "Allow new sessions"}
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => onLogOffAll(host)}>
            Log off all users
          </button>
          <button type="button" className={`${styles.btnOutline} ${styles.actBtnDelete}`} onClick={() => onRemove(host)}>
            Remove from pool
          </button>
        </div>
      </div>

      <div className={styles.sectionCard} style={{ background: "#faf9f8" }}>
        <h3>User sessions</h3>
        {sessions.length === 0 ? (
          <EmptyState message="No active sessions on this host." />
        ) : (
          <DataTable columns={["User", "State", "Duration", "Client", ""]}>
            {sessions.map((s, i) => (
              <tr key={i}>
                <td>{s.user}</td>
                <td>
                  <StatusBadge status={s.state === "Active" ? "Available" : "Shutdown"} />
                </td>
                <td>{s.duration}</td>
                <td>{s.clientName}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onSessionAction(host, "message")}>
                    Message
                  </button>{" "}
                  <button type="button" className={styles.link} onClick={() => onSessionAction(host, "disconnect")}>
                    Disconnect
                  </button>{" "}
                  <button type="button" className={styles.link} onClick={() => onSessionAction(host, "signout")}>
                    Sign out
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
