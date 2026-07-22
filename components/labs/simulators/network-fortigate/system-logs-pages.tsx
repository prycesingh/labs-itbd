"use client";

// System / Log & Report page group for the FortiGate WebUI simulator. Ports
// source's (itbd-lab/simulators/network/js/fortigate-ui.js) System >
// Administrators (`PAGES['administrators']`, line 571-587), System > Admin
// Profiles (`PAGES['admin-profiles']`, line 589-603), System > HA (top-tab
// nav entry, line 25 — source never wired a dedicated `PAGES['ha']` renderer,
// so this port surfaces the real `state.system.ha` value plus surrounding
// system-identity fields as a read-only status page instead of inventing a
// full HA cluster/config model no seed data backs), Log & Report > Forward
// Traffic (`PAGES['fwd-traffic']`/`renderFwdLogs()`, line ~1618-1661 — the
// live-tail interval that appends synthetic entries every 3s is intentionally
// NOT ported, matching the reducer's `APPEND_FORWARD_LOG` comment that it
// exists for a real log-producing call site, not a demo timer), and Log &
// Report > Events (`PAGES['event-logs']`, line 1690-1696).
//
// Administrators is the one page here with real mutation actions
// (ADD_ADMINISTRATOR / DELETE_ADMINISTRATOR already exist in the reducer);
// Admin Profiles and HA Status are read-only views over real seeded state
// per the porting brief (no reducer actions exist for either, and none are
// invented here). Forward/Event logs get "Clear logs" (CLEAR_FORWARD_LOGS /
// CLEAR_EVENT_LOGS) and CSV export, matching the Cisco-suite
// SyslogPage/`management-monitoring-pages.tsx` convention for log pages.
// All confirmations use `sonner` toasts; deletes are confirmed via a Modal
// (never window.confirm/prompt/alert).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { FortiGateState, FortiAdministrator, FortiEventLogEntry, FortiForwardLogEntry } from "@/lib/labs/simulators/network-fortigate/types";
import type { FortiAction } from "@/lib/labs/simulators/network-fortigate/reducer";
import {
  DataTable,
  type DataTableColumn,
  Field,
  Modal,
  NativeSelect,
  StatRow,
  StatTile,
  StatusPill,
  statusTone,
  exportCsv,
} from "./fortigate-ui";
import styles from "./fortigate-console.module.css";

type PageDispatchProps = { state: FortiGateState; dispatch: React.Dispatch<FortiAction> };

// ===================================================================
// 1. AdministratorsPage — System > Administrators (source
// PAGES['administrators']). Real DataTable over `state.administrators` +
// "+ Add administrator" Modal (ADD_ADMINISTRATOR) + per-row delete confirm
// Modal (DELETE_ADMINISTRATOR), matching the Cisco-suite
// AddLocalUserModal/DeleteLocalUserModal convention exactly.
// ===================================================================

const ADMIN_TYPE_OPTIONS = [
  { value: "Local", label: "Local" },
  { value: "LDAP", label: "LDAP" },
];

const TWO_FACTOR_OPTIONS = [
  { value: "Disabled", label: "Disabled" },
  { value: "FortiToken", label: "FortiToken" },
  { value: "Email", label: "Email" },
];

function emptyAdministratorDraft(): FortiAdministrator {
  return { name: "", profile: "", type: "Local", trustedHosts: "0.0.0.0/0", twoFactor: "Disabled" };
}

function AddAdministratorModal({
  adminProfiles,
  existingNames,
  onClose,
  dispatch,
}: {
  adminProfiles: FortiGateState["adminProfiles"];
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiAdministrator>(() => ({
    ...emptyAdministratorDraft(),
    profile: adminProfiles[0]?.name ?? "",
  }));

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter a user name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`Administrator "${name}" already exists`);
      return;
    }
    if (!draft.profile) {
      toast.error("Select an admin profile");
      return;
    }
    dispatch({ type: "ADD_ADMINISTRATOR", administrator: { ...draft, name } });
    toast.success(`Administrator "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="Add administrator"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Create administrator
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="User name" required>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="netops"
          />
        </Field>
        <Field label="Admin profile" required>
          <NativeSelect
            value={draft.profile}
            onChange={(value) => setDraft((prev) => ({ ...prev, profile: value }))}
            options={adminProfiles.map((p) => ({ value: p.name, label: p.name }))}
          />
        </Field>
        <Field label="Type">
          <NativeSelect
            value={draft.type}
            onChange={(value) => setDraft((prev) => ({ ...prev, type: value }))}
            options={ADMIN_TYPE_OPTIONS}
          />
        </Field>
        <Field label="Trusted hosts" help="CIDR restricting where this admin may log in from">
          <input
            className={styles.input}
            value={draft.trustedHosts}
            onChange={(e) => setDraft((prev) => ({ ...prev, trustedHosts: e.target.value }))}
            placeholder="0.0.0.0/0"
          />
        </Field>
        <Field label="Two-factor authentication">
          <NativeSelect
            value={draft.twoFactor}
            onChange={(value) => setDraft((prev) => ({ ...prev, twoFactor: value }))}
            options={TWO_FACTOR_OPTIONS}
          />
        </Field>
      </div>
    </Modal>
  );
}

function DeleteAdministratorModal({
  administrator,
  onClose,
  dispatch,
}: {
  administrator: FortiAdministrator;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_ADMINISTRATOR", name: administrator.name });
    toast.success(`Administrator "${administrator.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete administrator"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Delete
          </button>
        </>
      }
    >
      <p>
        Delete administrator <b>{administrator.name}</b> (profile {administrator.profile})? This cannot be undone.
      </p>
    </Modal>
  );
}

export function AdministratorsPage({ state, dispatch }: PageDispatchProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FortiAdministrator | null>(null);

  const columns: DataTableColumn<FortiAdministrator>[] = [
    { key: "name", header: "User Name", render: (a) => <b>{a.name}</b> },
    { key: "profile", header: "Profile", render: (a) => a.profile },
    { key: "type", header: "Type", render: (a) => a.type },
    { key: "trustedHosts", header: "Trusted Hosts", render: (a) => <span className={styles.mono}>{a.trustedHosts}</span> },
    {
      key: "twoFactor",
      header: "Two-Factor",
      render: (a) => <StatusPill tone={a.twoFactor === "Disabled" ? "muted" : "up"}>{a.twoFactor}</StatusPill>,
    },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteTarget(a)}>
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <h2>Administrators</h2>
      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add administrator
        </button>
      </div>
      <DataTable columns={columns} rows={state.administrators} getRowKey={(a) => a.name} emptyMessage="No administrators configured." />

      {showAdd ? (
        <AddAdministratorModal
          adminProfiles={state.adminProfiles}
          existingNames={state.administrators.map((a) => a.name)}
          onClose={() => setShowAdd(false)}
          dispatch={dispatch}
        />
      ) : null}
      {deleteTarget ? <DeleteAdministratorModal administrator={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 2. AdminProfilesPage — System > Admin Profiles (source
// PAGES['admin-profiles']). Read-only DataTable over `state.adminProfiles` —
// no backing reducer action exists (source itself never wired a save
// handler for this page either; its "Create New" toolbar button is inert),
// so this stays a real read-only view rather than inventing mutation state.
// ===================================================================

export function AdminProfilesPage({ state }: { state: FortiGateState }) {
  const columns: DataTableColumn<FortiGateState["adminProfiles"][number]>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "scope", header: "Scope", render: (p) => p.scope },
    { key: "permissions", header: "Permissions", render: (p) => p.permissions },
  ];

  return (
    <div>
      <h2>Admin Profiles</h2>
      <p className={styles.small}>
        Admin profiles define the administrative access scope granted to each administrator account. This is a read-only view — no
        create/edit action is wired for this simulator.
      </p>
      <DataTable columns={columns} rows={state.adminProfiles} getRowKey={(p) => p.name} emptyMessage="No admin profiles configured." />
    </div>
  );
}

// ===================================================================
// 3. HaStatusPage — System > HA (source's NAV includes an 'ha' top-tab
// entry, fortigate-ui.js line 25, but no `PAGES['ha']` renderer was ever
// wired — real FortiGate HA configuration (cluster mode, heartbeat
// interfaces, priority, override) is deep enough that no HA-specific state
// model was built for this port; see types.ts's `FortiSystem.ha` — a single
// status string). This page surfaces that real field plus the surrounding
// system-identity fields (hostname/serial/model/firmware/uptime/mode) via
// StatTile/StatRow + a details widget, as a genuine read-only status summary
// rather than fabricating cluster members that don't exist in state.
// ===================================================================

export function HaStatusPage({ state }: { state: FortiGateState }) {
  const sys = state.system;
  const isStandalone = sys.ha.toLowerCase() === "standalone";

  return (
    <div>
      <h2>HA Status</h2>

      <StatRow
        stats={[
          { label: "HA Mode", value: sys.ha },
          { label: "Hostname", value: sys.hostname },
          { label: "Model", value: sys.model },
          { label: "Uptime", value: sys.uptime, sub: sys.lastRebootReason },
        ]}
      />

      <div className={styles.widgetGrid}>
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>Cluster Status</div>
          <div className={styles.widgetBody}>
            <dl className={styles.kv}>
              <dt>HA Mode</dt>
              <dd>
                <StatusPill tone={isStandalone ? "muted" : "up"}>{sys.ha}</StatusPill>
              </dd>
              <dt>Operation Mode</dt>
              <dd>{sys.operationMode}</dd>
              <dt>Group Members</dt>
              <dd>{isStandalone ? "1 (this device only)" : "--"}</dd>
            </dl>
            {isStandalone ? (
              <p className={styles.hint}>
                This device is running standalone — no HA cluster is configured. Configuring HA groups a primary and one or more
                secondary FortiGate units for failover.
              </p>
            ) : null}
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>System Identity</div>
          <div className={styles.widgetBody}>
            <dl className={styles.kv}>
              <dt>Hostname</dt>
              <dd>{sys.hostname}</dd>
              <dt>Serial Number</dt>
              <dd className={styles.mono}>{sys.serial}</dd>
              <dt>Model</dt>
              <dd>{sys.model}</dd>
              <dt>Firmware</dt>
              <dd>{sys.firmware}</dd>
              <dt>System Time</dt>
              <dd>{sys.systemTime}</dd>
              <dt>Uptime</dt>
              <dd>{sys.uptime}</dd>
              <dt>Last Reboot</dt>
              <dd>{sys.lastRebootReason}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 4. ForwardLogsPage — Log & Report > Forward Traffic (source
// PAGES['fwd-traffic']/renderFwdLogs(), line ~1618-1661). Full DataTable over
// `state.forwardLogs`, newest first (source's `appendForwardLog` already
// unshifts new entries to the front, matching the reducer's
// `APPEND_FORWARD_LOG`, so the array is already newest-first — no extra sort
// needed), with a local text/action filter (source's `.fgt-search` input +
// `_filterTable` — reproduced here as real React state instead of DOM text
// filtering), "Clear logs" (CLEAR_FORWARD_LOGS), and CSV export.
// ===================================================================

const FORWARD_ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "accept", label: "accept" },
  { value: "deny", label: "deny" },
  { value: "start", label: "start" },
  { value: "close", label: "close" },
  { value: "dns", label: "dns" },
];

export function ForwardLogsPage({ state, dispatch }: PageDispatchProps) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.forwardLogs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (!term) return true;
      return (
        l.src.toLowerCase().includes(term) ||
        l.dst.toLowerCase().includes(term) ||
        l.app.toLowerCase().includes(term) ||
        l.policy.toLowerCase().includes(term)
      );
    });
  }, [state.forwardLogs, actionFilter, search]);

  function handleClear() {
    dispatch({ type: "CLEAR_FORWARD_LOGS" });
    toast.success("Forward traffic log cleared");
  }

  function handleExport() {
    exportCsv(
      "forward-traffic-log.csv",
      ["Date", "Time", "Source", "Source Port", "Destination", "Dest. Port", "Proto", "Application", "Action", "Policy", "Sent", "Received"],
      filteredLogs.map((l) => [l.date, l.time, l.src, l.srcPort, l.dst, l.dstPort, l.proto, l.app, l.action, l.policy, l.sent, l.received]),
    );
    toast.success("Forward traffic log exported");
  }

  const columns: DataTableColumn<FortiForwardLogEntry>[] = [
    { key: "time", header: "Date/Time", render: (l) => <span className={styles.mono}>{l.date} {l.time}</span> },
    { key: "src", header: "Source", render: (l) => <span className={styles.mono}>{l.src}</span> },
    { key: "srcPort", header: "Source Port", render: (l) => l.srcPort },
    { key: "dst", header: "Destination", render: (l) => <span className={styles.mono}>{l.dst}</span> },
    { key: "dstPort", header: "Dest. Port", render: (l) => l.dstPort },
    { key: "proto", header: "Proto", render: (l) => l.proto },
    { key: "app", header: "Application", render: (l) => l.app },
    { key: "action", header: "Action", render: (l) => <StatusPill tone={statusTone(l.action)}>{l.action}</StatusPill> },
    { key: "policy", header: "Policy", render: (l) => l.policy },
    { key: "sent", header: "Sent", render: (l) => l.sent },
    { key: "received", header: "Received", render: (l) => l.received },
  ];

  return (
    <div>
      <h2>
        Forward Traffic Log <StatusPill tone="up">LIVE</StatusPill>
      </h2>

      <div className={styles.toolbar}>
        <NativeSelect value={actionFilter} onChange={setActionFilter} options={FORWARD_ACTION_OPTIONS} style={{ width: 160 }} />
        <input
          className={styles.search}
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.grow} />
        <span className={`${styles.small} ${styles.mono}`}>
          {filteredLogs.length} of {state.forwardLogs.length} entries
        </span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleClear}>
          Clear logs
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={filteredLogs}
        getRowKey={(l) => `${l.date}-${l.time}-${l.src}-${l.dst}-${l.srcPort}-${l.dstPort}`}
        emptyMessage="No forward traffic logs."
      />
    </div>
  );
}

// ===================================================================
// 5. EventLogsPage — Log & Report > Events (source PAGES['event-logs'],
// line 1690-1696). Full DataTable over `state.eventLogs`, newest first
// (source's seeded array is already newest-first per seedData.ts's
// `seedEventLogs()` index-driven timestamps), "Clear logs"
// (CLEAR_EVENT_LOGS), and CSV export.
// ===================================================================

export function EventLogsPage({ state, dispatch }: PageDispatchProps) {
  function handleClear() {
    dispatch({ type: "CLEAR_EVENT_LOGS" });
    toast.success("Event log cleared");
  }

  function handleExport() {
    exportCsv(
      "event-log.csv",
      ["Date", "Time", "Type", "Level", "Message"],
      state.eventLogs.map((e) => [e.date, e.time, e.type, e.level, e.msg]),
    );
    toast.success("Event log exported");
  }

  const columns: DataTableColumn<FortiEventLogEntry>[] = [
    { key: "time", header: "Date/Time", render: (e) => <span className={styles.mono}>{e.date} {e.time}</span> },
    { key: "type", header: "Type", render: (e) => e.type },
    { key: "level", header: "Level", render: (e) => <StatusPill tone={statusTone(e.level)}>{e.level}</StatusPill> },
    { key: "msg", header: "Message", render: (e) => e.msg },
  ];

  return (
    <div>
      <h2>Event Logs</h2>

      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <span className={styles.small}>{state.eventLogs.length} entries</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleClear}>
          Clear logs
        </button>
      </div>

      <DataTable columns={columns} rows={state.eventLogs} getRowKey={(e) => `${e.date}-${e.time}-${e.type}-${e.msg}`} emptyMessage="No event logs." />
    </div>
  );
}
