"use client";

// Device & Users + Monitor/Logs page group for the Palo Alto PAN-OS WebUI
// simulator. Ports source's (itbd-lab/simulators/network/js/paloalto-ui.js)
// Device extension — PAGES['dev-admins'] (2747-2754), PAGES['dev-cert']
// (2756-2763), the `serverProfilePage()` factory (2765-2789, narrowed to the
// 5 sub-types modeled in `PaloServerProfiles`: SNMP/Syslog/Email/RADIUS/
// LDAP — source's TACACS+/Kerberos/SAML/MFA/HTTP/Netflow/SCP variants have no
// backing state field and are out of scope), PAGES['dev-ha'] (2734-2745),
// PAGES['dev-authprof']/PAGES['dev-authseq']/PAGES['dev-localdb-users']/
// PAGES['dev-localdb-grps'] (3077-3112) — plus the Monitor extension's
// PAGES['mon-traffic']/renderTrafficLogs() (2490-2562), PAGES['mon-threat']
// (2565-2582), PAGES['mon-url'] (2585-2599), PAGES['mon-wildfire']
// (2602-2620), and PAGES['mon-system'] (2623-2630).
//
// Administrators / Local Users / User Groups / HA config all have real
// mutation actions in reducer.ts (ADD/UPDATE/DELETE_ADMINISTRATOR,
// ADD/UPDATE/DELETE_LOCAL_USER, ADD/UPDATE/DELETE_USER_GROUP,
// UPDATE_HA_CONFIG), so those pages get genuine add/edit/delete/save flows —
// matching the FortiGate-suite `system-logs-pages.tsx`
// AddAdministratorModal/DeleteAdministratorModal and `vpn-users-pages.tsx`
// AddLocalUserModal/EditLocalUserModal/DeleteLocalUserModal/
// AddUserGroupModal/EditUserGroupModal/DeleteUserGroupModal convention
// exactly. Certificates, Server Profiles (all 5 sub-types), Authentication
// Profiles, and Authentication Sequence have NO backing reducer actions (see
// reducer.ts's "Device: administrators / HA" section and Users section — only
// administrators/localUsers/userGroups/highAvailability get real mutation
// actions), so those render as real read-only views over real seeded state,
// matching the FortiGate-suite `LdapRadiusPage` convention — no action is
// invented for them.
//
// Traffic/Threat/URL/System logs get "Clear logs" (CLEAR_TRAFFIC_LOGS/
// CLEAR_THREAT_LOGS/CLEAR_URL_LOGS/CLEAR_SYSTEM_LOGS) and CSV export, matching
// the FortiGate-suite `ForwardLogsPage`/`EventLogsPage` convention exactly.
// WildFire submissions has no clear action in the reducer (see reducer.ts's
// Logs section) so it stays export-only, read-only. All four log pages
// render newest-first — source's `appendTrafficLog()` already unshifts, and
// seedData.ts's other log generators are seeded in newest-first order, so no
// extra client-side sort is needed. All confirmations use `sonner` toasts;
// deletes are confirmed via a Modal (never window.confirm/prompt/alert).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PaloAdministrator,
  PaloEmailServer,
  PaloHighAvailability,
  PaloLdapServer,
  PaloLocalUser,
  PaloRadiusServer,
  PaloSnmpServer,
  PaloState,
  PaloSyslogServer,
  PaloSystemLogEntry,
  PaloThreatLogEntry,
  PaloTrafficLogEntry,
  PaloUrlLogEntry,
  PaloUserGroup,
  PaloWildfireEntry,
} from "@/lib/labs/simulators/network-paloalto/types";
import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Modal,
  NativeSelect,
  StatusPill,
  statusTone,
  TabBar,
  Toggle,
  exportCsv,
} from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type PagePropsRW = { state: PaloState; dispatch: React.Dispatch<PaloAction> };

// ===================================================================
// 1. AdministratorsPage — Device > Administrators (source PAGES['dev-admins'],
// lines 2747-2754). Real DataTable over `state.administrators` + "+ Add
// administrator" Modal (ADD_ADMINISTRATOR) + per-row delete confirm Modal
// (DELETE_ADMINISTRATOR).
// ===================================================================

const ADMIN_ROLE_OPTIONS = [
  { value: "superuser", label: "superuser" },
  { value: "deviceadmin", label: "deviceadmin" },
  { value: "audit-admin", label: "audit-admin" },
  { value: "vsysadmin", label: "vsysadmin" },
];

const ADMIN_AUTH_OPTIONS = [
  { value: "Local", label: "Local" },
  { value: "LDAP", label: "LDAP" },
  { value: "RADIUS", label: "RADIUS" },
];

function emptyAdministratorDraft(): PaloAdministrator {
  return { name: "", role: "deviceadmin", auth: "Local", publicKey: "no", client: "web/CLI" };
}

function AddAdministratorModal({
  existingNames,
  onClose,
  dispatch,
}: {
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloAdministrator>(emptyAdministratorDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter an administrator name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`An administrator named "${name}" already exists`);
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
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create administrator
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Name" required>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="netops"
          />
        </Field>
        <Field label="Role">
          <NativeSelect value={draft.role} onChange={(value) => setDraft((prev) => ({ ...prev, role: value }))} options={ADMIN_ROLE_OPTIONS} />
        </Field>
        <Field label="Authentication">
          <NativeSelect value={draft.auth} onChange={(value) => setDraft((prev) => ({ ...prev, auth: value }))} options={ADMIN_AUTH_OPTIONS} />
        </Field>
        <Field label="Public Key" help="Whether an SSH public key is configured for this admin">
          <NativeSelect
            value={draft.publicKey}
            onChange={(value) => setDraft((prev) => ({ ...prev, publicKey: value }))}
            options={[
              { value: "no", label: "no" },
              { value: "yes", label: "yes" },
            ]}
          />
        </Field>
        <Field label="Client">
          <input
            className={styles.input}
            value={draft.client}
            onChange={(e) => setDraft((prev) => ({ ...prev, client: e.target.value }))}
            placeholder="web/CLI"
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
  administrator: PaloAdministrator;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
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
        Delete administrator <b>{administrator.name}</b> (role {administrator.role})? This cannot be undone.
      </p>
    </Modal>
  );
}

export function AdministratorsPage({ state, dispatch }: PagePropsRW) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaloAdministrator | null>(null);

  const columns: DataTableColumn<PaloAdministrator>[] = [
    { key: "name", header: "Name", render: (a) => <b>{a.name}</b> },
    { key: "role", header: "Role", render: (a) => a.role },
    { key: "auth", header: "Authentication", render: (a) => a.auth },
    { key: "publicKey", header: "Public Key", render: (a) => a.publicKey },
    { key: "client", header: "Client", render: (a) => a.client },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <button
          type="button"
          className={`${styles.btnSm} ${styles.btnDanger}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(a);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <h2>Administrators</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add administrator
        </button>
        <div className={styles.grow} />
      </div>

      <DataTable columns={columns} rows={state.administrators} getRowKey={(a) => a.name} emptyMessage="No administrators configured." />

      {showAdd ? (
        <AddAdministratorModal existingNames={state.administrators.map((a) => a.name)} onClose={() => setShowAdd(false)} dispatch={dispatch} />
      ) : null}
      {deleteTarget ? <DeleteAdministratorModal administrator={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 2. CertificatesPage — Device > Certificate Management > Certificates
// (source PAGES['dev-cert'], lines 2756-2763). Read-only DataTable — no
// backing reducer action exists for certificates.
// ===================================================================

export function CertificatesPage({ state }: { state: PaloState }) {
  const columns: DataTableColumn<PaloState["certificates"][number]>[] = [
    { key: "name", header: "Name", render: (c) => <b>{c.name}</b> },
    { key: "cn", header: "Common Name", render: (c) => <span className={styles.mono}>{c.cn}</span> },
    { key: "issuer", header: "Issuer", render: (c) => c.issuer },
    { key: "notAfter", header: "Expires", render: (c) => c.notAfter },
    { key: "usage", header: "Usage", render: (c) => c.usage },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusPill tone={statusTone(c.status === "valid" ? "up" : "down")}>{c.status}</StatusPill>,
    },
  ];

  return (
    <div>
      <h2>Certificate Management &mdash; Certificates</h2>
      <p className={styles.small}>Read-only view — no create/import/export action is wired for this simulator.</p>
      <DataTable columns={columns} rows={state.certificates} getRowKey={(c) => c.name} emptyMessage="No certificates configured." />
    </div>
  );
}

// ===================================================================
// 3. ServerProfilesPage — Device > Server Profiles (source's
// `serverProfilePage()` factory, lines 2765-2789), narrowed to the 5
// sub-types modeled in `PaloServerProfiles`: SNMP Trap / Syslog / Email /
// RADIUS / LDAP. `TabBar` switches between sub-arrays; each renders its own
// small read-only DataTable — no backing reducer action exists for any
// server-profile sub-type.
// ===================================================================

const SERVER_PROFILE_TABS = [
  { key: "snmp", label: "SNMP Trap" },
  { key: "syslog", label: "Syslog" },
  { key: "email", label: "Email" },
  { key: "radius", label: "RADIUS" },
  { key: "ldap", label: "LDAP" },
] as const;

type ServerProfileTabKey = (typeof SERVER_PROFILE_TABS)[number]["key"];

export function ServerProfilesPage({ state }: { state: PaloState }) {
  const [tab, setTab] = useState<ServerProfileTabKey>("snmp");

  const snmpColumns: DataTableColumn<PaloSnmpServer>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "server", header: "Server", render: (s) => <span className={styles.mono}>{s.server}</span> },
    { key: "version", header: "Version", render: (s) => s.version },
    { key: "community", header: "Community", render: () => <span className={styles.mono}>&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</span> },
  ];

  const syslogColumns: DataTableColumn<PaloSyslogServer>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "server", header: "Server", render: (s) => <span className={styles.mono}>{s.server}</span> },
    { key: "transport", header: "Transport", render: (s) => s.transport },
    { key: "port", header: "Port", render: (s) => s.port },
    { key: "format", header: "Format", render: (s) => s.format },
  ];

  const emailColumns: DataTableColumn<PaloEmailServer>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "server", header: "SMTP Server", render: (s) => <span className={styles.mono}>{s.server}</span> },
    { key: "from", header: "From", render: (s) => s.from },
    { key: "to", header: "To", render: (s) => s.to },
  ];

  const radiusColumns: DataTableColumn<PaloRadiusServer>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "server", header: "Server", render: (s) => <span className={styles.mono}>{s.server}</span> },
    { key: "port", header: "Port", render: (s) => s.port },
    { key: "secret", header: "Secret", render: () => <span className={styles.mono}>&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</span> },
  ];

  const ldapColumns: DataTableColumn<PaloLdapServer>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "server", header: "Server", render: (s) => <span className={styles.mono}>{s.server}</span> },
    { key: "port", header: "Port", render: (s) => s.port },
    { key: "baseDn", header: "Base DN", render: (s) => <span className={styles.mono}>{s.baseDn}</span> },
    { key: "bindDn", header: "Bind DN", render: (s) => <span className={styles.mono}>{s.bindDn}</span> },
    { key: "ssl", header: "SSL", render: (s) => <StatusPill tone={s.ssl ? "up" : "muted"}>{s.ssl ? "yes" : "no"}</StatusPill> },
  ];

  return (
    <div>
      <h2>Server Profiles</h2>
      <p className={styles.small}>Read-only view — no create/edit action is wired for any server-profile sub-type in this simulator.</p>
      <TabBar tabs={[...SERVER_PROFILE_TABS]} active={tab} onChange={(key) => setTab(key as ServerProfileTabKey)} />

      {tab === "snmp" ? (
        <DataTable columns={snmpColumns} rows={state.serverProfiles.snmp} getRowKey={(s) => s.name} emptyMessage="No SNMP Trap profiles configured." />
      ) : null}
      {tab === "syslog" ? (
        <DataTable columns={syslogColumns} rows={state.serverProfiles.syslog} getRowKey={(s) => s.name} emptyMessage="No Syslog profiles configured." />
      ) : null}
      {tab === "email" ? (
        <DataTable columns={emailColumns} rows={state.serverProfiles.email} getRowKey={(s) => s.name} emptyMessage="No Email profiles configured." />
      ) : null}
      {tab === "radius" ? (
        <DataTable columns={radiusColumns} rows={state.serverProfiles.radius} getRowKey={(s) => s.name} emptyMessage="No RADIUS profiles configured." />
      ) : null}
      {tab === "ldap" ? (
        <DataTable columns={ldapColumns} rows={state.serverProfiles.ldap} getRowKey={(s) => s.name} emptyMessage="No LDAP profiles configured." />
      ) : null}
    </div>
  );
}

// ===================================================================
// 4. HighAvailabilityPage — Device > High Availability (source
// PAGES['dev-ha'], lines 2734-2745). `state.highAvailability` display + edit
// form dispatching UPDATE_HA_CONFIG (the only singleton-object patch action
// in this group).
// ===================================================================

const HA_MODE_OPTIONS = [
  { value: "active/passive", label: "Active/Passive" },
  { value: "active/active", label: "Active/Active" },
];

export function HighAvailabilityPage({ state, dispatch }: PagePropsRW) {
  const h = state.highAvailability;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PaloHighAvailability>(h);

  function startEdit() {
    setDraft(h);
    setEditing(true);
  }

  function handleSave() {
    if (draft.enabled && !draft.peerIp.trim()) {
      toast.error("Peer HA1 IP is required when HA is enabled");
      return;
    }
    dispatch({ type: "UPDATE_HA_CONFIG", patch: draft });
    toast.success("High Availability configuration saved");
    setEditing(false);
  }

  return (
    <div>
      <h2>High Availability</h2>

      <div className={styles.fieldset}>
        <legend>Setup</legend>
        {editing ? (
          <>
            <div className={styles.form}>
              <Field label="Enable HA">
                <Toggle checked={draft.enabled} onChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))} />
              </Field>
              <Field label="Mode">
                <NativeSelect value={draft.mode} onChange={(value) => setDraft((prev) => ({ ...prev, mode: value }))} options={HA_MODE_OPTIONS} />
              </Field>
              <Field label="Peer HA1 IP" help="HA1 control-link IP of the peer firewall">
                <input
                  className={styles.input}
                  value={draft.peerIp}
                  onChange={(e) => setDraft((prev) => ({ ...prev, peerIp: e.target.value }))}
                  placeholder="10.1.0.2"
                />
              </Field>
              <Field label="Device Priority" help="Lower value wins active/primary election">
                <input
                  className={styles.input}
                  type="number"
                  value={draft.priority}
                  onChange={(e) => setDraft((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Preemptive">
                <Toggle checked={draft.preempt} onChange={(checked) => setDraft((prev) => ({ ...prev, preempt: checked }))} />
              </Field>
            </div>
            <div className={`${styles.flex} ${styles.gap8} ${styles.mt12}`}>
              <button type="button" className={styles.btn} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <dl className={styles.kv}>
              <dt>Enable HA</dt>
              <dd>
                <StatusPill tone={h.enabled ? "up" : "muted"}>{h.enabled ? "enabled" : "disabled"}</StatusPill>
              </dd>
              <dt>Mode</dt>
              <dd>{h.mode}</dd>
              <dt>Peer HA1 IP</dt>
              <dd>{h.peerIp || <span className={styles.small}>&mdash;</span>}</dd>
              <dt>Device Priority</dt>
              <dd>{h.priority}</dd>
              <dt>Preemptive</dt>
              <dd>
                <StatusPill tone={h.preempt ? "up" : "muted"}>{h.preempt ? "yes" : "no"}</StatusPill>
              </dd>
            </dl>
            <div className={styles.mt12}>
              <button type="button" className={styles.btn} onClick={startEdit}>
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// 5. LocalUsersPage — Device > Local User Database: Users (source
// PAGES['dev-localdb-users'], lines 3096-3104). Real DataTable over
// `state.localUsers` + "+ Add user" Modal (ADD_LOCAL_USER) + per-row edit
// Modal (UPDATE_LOCAL_USER) + delete confirm Modal (DELETE_LOCAL_USER).
// ===================================================================

function emptyLocalUserDraft(): PaloLocalUser {
  return { name: "", pwdSet: false, disabled: false, group: "" };
}

function LocalUserForm({
  draft,
  onChange,
  nameDisabled,
}: {
  draft: PaloLocalUser;
  onChange: (patch: Partial<PaloLocalUser>) => void;
  nameDisabled?: boolean;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input
          className={styles.input}
          value={draft.name}
          disabled={nameDisabled}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="gp-user-2"
        />
      </Field>
      <Field label="Password set">
        <Toggle checked={draft.pwdSet} onChange={(checked) => onChange({ pwdSet: checked })} />
      </Field>
      <Field label="Disabled">
        <Toggle checked={draft.disabled} onChange={(checked) => onChange({ disabled: checked })} />
      </Field>
      <Field label="Group">
        <input className={styles.input} value={draft.group} onChange={(e) => onChange({ group: e.target.value })} placeholder="GP-Users" />
      </Field>
    </div>
  );
}

function AddLocalUserModal({
  existingNames,
  onClose,
  dispatch,
}: {
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloLocalUser>(emptyLocalUserDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter a user name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`A user named "${name}" already exists`);
      return;
    }
    dispatch({ type: "ADD_LOCAL_USER", user: { ...draft, name } });
    toast.success(`User "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create user
          </button>
        </>
      }
    >
      <LocalUserForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditLocalUserModal({
  user,
  onClose,
  dispatch,
}: {
  user: PaloLocalUser;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloLocalUser>(user);

  function handleSubmit() {
    dispatch({ type: "UPDATE_LOCAL_USER", name: user.name, patch: draft });
    toast.success(`User "${user.name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit user - ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Save
          </button>
        </>
      }
    >
      <LocalUserForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} nameDisabled />
    </Modal>
  );
}

function DeleteLocalUserModal({
  user,
  onClose,
  dispatch,
}: {
  user: PaloLocalUser;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_LOCAL_USER", name: user.name });
    toast.success(`User "${user.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete user"
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
        Delete local user <b>{user.name}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

export function LocalUsersPage({ state, dispatch }: PagePropsRW) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<PaloLocalUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaloLocalUser | null>(null);

  const columns: DataTableColumn<PaloLocalUser>[] = [
    { key: "name", header: "Name", render: (u) => <b>{u.name}</b> },
    {
      key: "pwdSet",
      header: "Password Set",
      render: (u) => <StatusPill tone={u.pwdSet ? "up" : "muted"}>{u.pwdSet ? "yes" : "no"}</StatusPill>,
    },
    {
      key: "disabled",
      header: "Status",
      render: (u) => <StatusPill tone={u.disabled ? "down" : "up"}>{u.disabled ? "disabled" : "enabled"}</StatusPill>,
    },
    { key: "group", header: "Group", render: (u) => u.group },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <div className={styles.flex}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget(u);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(u);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Local User Database &mdash; Users</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add user
        </button>
        <div className={styles.grow} />
      </div>

      <DataTable columns={columns} rows={state.localUsers} getRowKey={(u) => u.name} emptyMessage="No local users configured." />

      {showAdd ? <AddLocalUserModal existingNames={state.localUsers.map((u) => u.name)} onClose={() => setShowAdd(false)} dispatch={dispatch} /> : null}
      {editTarget ? <EditLocalUserModal user={editTarget} onClose={() => setEditTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteLocalUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 6. UserGroupsPage — Device > Local User Database: User Groups (source
// PAGES['dev-localdb-grps'], lines 3105-3112). Real DataTable over
// `state.userGroups` + "+ Add group" Modal (ADD_USER_GROUP) + per-row edit
// Modal (UPDATE_USER_GROUP) + delete confirm Modal (DELETE_USER_GROUP).
// ===================================================================

function emptyUserGroupDraft(): PaloUserGroup {
  return { name: "", members: "" };
}

function UserGroupForm({
  draft,
  onChange,
  nameDisabled,
}: {
  draft: PaloUserGroup;
  onChange: (patch: Partial<PaloUserGroup>) => void;
  nameDisabled?: boolean;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input
          className={styles.input}
          value={draft.name}
          disabled={nameDisabled}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Contractors"
        />
      </Field>
      <Field label="Members" help="Comma-separated local user names">
        <input className={styles.input} value={draft.members} onChange={(e) => onChange({ members: e.target.value })} placeholder="admin, auditor" />
      </Field>
    </div>
  );
}

function AddUserGroupModal({
  existingNames,
  onClose,
  dispatch,
}: {
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloUserGroup>(emptyUserGroupDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter a group name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`A group named "${name}" already exists`);
      return;
    }
    dispatch({ type: "ADD_USER_GROUP", group: { ...draft, name } });
    toast.success(`Group "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="Add group"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create group
          </button>
        </>
      }
    >
      <UserGroupForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditUserGroupModal({
  group,
  onClose,
  dispatch,
}: {
  group: PaloUserGroup;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloUserGroup>(group);

  function handleSubmit() {
    dispatch({ type: "UPDATE_USER_GROUP", name: group.name, patch: draft });
    toast.success(`Group "${group.name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit group - ${group.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Save
          </button>
        </>
      }
    >
      <UserGroupForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} nameDisabled />
    </Modal>
  );
}

function DeleteUserGroupModal({
  group,
  onClose,
  dispatch,
}: {
  group: PaloUserGroup;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_USER_GROUP", name: group.name });
    toast.success(`Group "${group.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete group"
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
        Delete user group <b>{group.name}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

export function UserGroupsPage({ state, dispatch }: PagePropsRW) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<PaloUserGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaloUserGroup | null>(null);

  const columns: DataTableColumn<PaloUserGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "members", header: "Members", render: (g) => g.members || <span className={styles.small}>&mdash;</span> },
    {
      key: "actions",
      header: "",
      render: (g) => (
        <div className={styles.flex}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget(g);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(g);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Local User Database &mdash; User Groups</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add group
        </button>
        <div className={styles.grow} />
      </div>

      <DataTable columns={columns} rows={state.userGroups} getRowKey={(g) => g.name} emptyMessage="No user groups configured." />

      {showAdd ? <AddUserGroupModal existingNames={state.userGroups.map((g) => g.name)} onClose={() => setShowAdd(false)} dispatch={dispatch} /> : null}
      {editTarget ? <EditUserGroupModal group={editTarget} onClose={() => setEditTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteUserGroupModal group={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 7. AuthProfilesPage — Device > Authentication Profile / Authentication
// Sequence (source PAGES['dev-authprof']/PAGES['dev-authseq'], lines
// 3077-3095). `TabBar` switches between `state.authProfiles` and
// `state.authSequence`; both read-only — no backing reducer action exists
// for either family.
// ===================================================================

const AUTH_TABS = [
  { key: "profiles", label: "Authentication Profiles" },
  { key: "sequence", label: "Authentication Sequence" },
] as const;

type AuthTabKey = (typeof AUTH_TABS)[number]["key"];

export function AuthProfilesPage({ state }: { state: PaloState }) {
  const [tab, setTab] = useState<AuthTabKey>("profiles");

  const profileColumns: DataTableColumn<PaloState["authProfiles"][number]>[] = [
    { key: "name", header: "Name", render: (a) => <b>{a.name}</b> },
    { key: "method", header: "Method", render: (a) => a.method },
    { key: "userDomain", header: "User Domain", render: (a) => a.userDomain || <span className={styles.small}>&mdash;</span> },
    { key: "allowList", header: "Allow List", render: (a) => a.allowList },
    { key: "factors", header: "Factors", render: (a) => a.factors.join(", ") },
    { key: "description", header: "Description", render: (a) => a.description },
  ];

  const sequenceColumns: DataTableColumn<PaloState["authSequence"][number]>[] = [
    { key: "name", header: "Name", render: (a) => <b>{a.name}</b> },
    { key: "profiles", header: "Order", render: (a) => a.profiles.join(" → ") },
    { key: "description", header: "Description", render: (a) => a.description },
  ];

  return (
    <div>
      <h2>Device &mdash; Authentication Profile</h2>
      <p className={styles.small}>Read-only view — no create/edit action is wired for authentication profiles or sequences in this simulator.</p>
      <TabBar tabs={[...AUTH_TABS]} active={tab} onChange={(key) => setTab(key as AuthTabKey)} />

      {tab === "profiles" ? (
        state.authProfiles.length === 0 ? (
          <EmptyState message="No authentication profiles configured." />
        ) : (
          <DataTable columns={profileColumns} rows={state.authProfiles} getRowKey={(a) => a.name} emptyMessage="No authentication profiles configured." />
        )
      ) : state.authSequence.length === 0 ? (
        <EmptyState message="No authentication sequences configured." />
      ) : (
        <DataTable columns={sequenceColumns} rows={state.authSequence} getRowKey={(a) => a.name} emptyMessage="No authentication sequences configured." />
      )}
    </div>
  );
}

// ===================================================================
// 8. TrafficLogsPage — Monitor > Logs: Traffic (source PAGES['mon-traffic']/
// renderTrafficLogs(), lines 2490-2562). Full DataTable over
// `state.trafficLogs`, newest first (source's `appendTrafficLog()` already
// unshifts new entries to the front, matching the reducer's
// `APPEND_TRAFFIC_LOG`, so the array is already newest-first — no extra sort
// needed), with a local text/action filter, "Clear logs" (CLEAR_TRAFFIC_LOGS),
// and CSV export.
// ===================================================================

const TRAFFIC_ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "allow", label: "allow" },
  { value: "deny", label: "deny" },
  { value: "drop", label: "drop" },
];

export function TrafficLogsPage({ state, dispatch }: PagePropsRW) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.trafficLogs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (!term) return true;
      return (
        l.src.toLowerCase().includes(term) ||
        l.dst.toLowerCase().includes(term) ||
        l.app.toLowerCase().includes(term) ||
        l.rule.toLowerCase().includes(term)
      );
    });
  }, [state.trafficLogs, actionFilter, search]);

  function handleClear() {
    dispatch({ type: "CLEAR_TRAFFIC_LOGS" });
    toast.success("Traffic log cleared");
  }

  function handleExport() {
    exportCsv(
      "traffic-log.csv",
      [
        "Receive Time",
        "From Zone",
        "To Zone",
        "Source",
        "Destination",
        "Source Port",
        "Destination Port",
        "Protocol",
        "Application",
        "Rule",
        "Action",
        "Severity",
        "Bytes",
        "Packets",
      ],
      filteredLogs.map((l) => [
        l.time,
        l.srcZone,
        l.dstZone,
        l.src,
        l.dst,
        l.srcPort,
        l.dstPort,
        l.proto,
        l.app,
        l.rule,
        l.action,
        l.severity,
        l.bytes,
        l.packets,
      ]),
    );
    toast.success("Traffic log exported");
  }

  const columns: DataTableColumn<PaloTrafficLogEntry>[] = [
    { key: "time", header: "Receive Time", render: (l) => <span className={styles.mono}>{l.time}</span> },
    { key: "zones", header: "From/To Zone", render: (l) => `${l.srcZone} → ${l.dstZone}` },
    { key: "src", header: "Source", render: (l) => <span className={styles.mono}>{l.src}</span> },
    { key: "dst", header: "Destination", render: (l) => <span className={styles.mono}>{l.dst}</span> },
    { key: "srcPort", header: "Src Port", render: (l) => l.srcPort },
    { key: "dstPort", header: "Dst Port", render: (l) => l.dstPort },
    { key: "proto", header: "Protocol", render: (l) => l.proto },
    { key: "app", header: "Application", render: (l) => l.app },
    { key: "rule", header: "Rule", render: (l) => l.rule },
    { key: "action", header: "Action", render: (l) => <StatusPill tone={statusTone(l.action)}>{l.action}</StatusPill> },
    { key: "severity", header: "Severity", render: (l) => l.severity },
    { key: "bytes", header: "Bytes", render: (l) => l.bytes.toLocaleString() },
    { key: "packets", header: "Packets", render: (l) => l.packets },
  ];

  return (
    <div>
      <h2>
        Logs &mdash; Traffic <StatusPill tone="up">LIVE</StatusPill>
      </h2>

      <div className={styles.toolbar}>
        <NativeSelect value={actionFilter} onChange={setActionFilter} options={TRAFFIC_ACTION_OPTIONS} />
        <input className={styles.search} placeholder="Filter traffic..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className={styles.grow} />
        <span className={`${styles.small} ${styles.mono}`}>
          {filteredLogs.length} of {state.trafficLogs.length} entries
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
        getRowKey={(l) => `${l.time}-${l.src}-${l.dst}-${l.srcPort}-${l.dstPort}-${l.bytes}`}
        emptyMessage="No traffic logs."
      />
    </div>
  );
}

// ===================================================================
// 9. ThreatLogsPage — Monitor > Logs: Threat (source PAGES['mon-threat'],
// lines 2565-2582). Full DataTable over `state.threatLogs`, newest first
// (seedData.ts's `seedThreatLogs()` generates in newest-first order), "Clear
// logs" (CLEAR_THREAT_LOGS), CSV export.
// ===================================================================

export function ThreatLogsPage({ state, dispatch }: PagePropsRW) {
  function handleClear() {
    dispatch({ type: "CLEAR_THREAT_LOGS" });
    toast.success("Threat log cleared");
  }

  function handleExport() {
    exportCsv(
      "threat-log.csv",
      ["Receive Time", "Type", "Severity", "Name/ID", "Source", "Destination", "Application", "Action", "Rule"],
      state.threatLogs.map((l) => [l.time, l.type, l.severity, l.name, l.src, l.dst, l.app, l.action, l.rule]),
    );
    toast.success("Threat log exported");
  }

  const columns: DataTableColumn<PaloThreatLogEntry>[] = [
    { key: "time", header: "Receive Time", render: (l) => <span className={styles.mono}>{l.time}</span> },
    { key: "type", header: "Type", render: (l) => l.type },
    { key: "severity", header: "Severity", render: (l) => <StatusPill tone={statusTone(l.severity)}>{l.severity}</StatusPill> },
    { key: "name", header: "Name/ID", render: (l) => l.name },
    { key: "src", header: "Source", render: (l) => <span className={styles.mono}>{l.src}</span> },
    { key: "dst", header: "Destination", render: (l) => <span className={styles.mono}>{l.dst}</span> },
    { key: "app", header: "Application", render: (l) => l.app },
    { key: "action", header: "Action", render: (l) => <StatusPill tone={statusTone(l.action)}>{l.action}</StatusPill> },
    { key: "rule", header: "Rule", render: (l) => l.rule },
  ];

  return (
    <div>
      <h2>Logs &mdash; Threat</h2>

      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <span className={styles.small}>{state.threatLogs.length} entries</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleClear}>
          Clear logs
        </button>
      </div>

      <DataTable columns={columns} rows={state.threatLogs} getRowKey={(l) => `${l.time}-${l.name}-${l.src}-${l.dst}`} emptyMessage="No threat logs." />
    </div>
  );
}

// ===================================================================
// 10. UrlLogsPage — Monitor > Logs: URL Filtering (source PAGES['mon-url'],
// lines 2585-2599). Full DataTable over `state.urlLogs`, newest first
// (seedData.ts's `seedUrlLogs()` generates in newest-first order), "Clear
// logs" (CLEAR_URL_LOGS), CSV export.
// ===================================================================

export function UrlLogsPage({ state, dispatch }: PagePropsRW) {
  function handleClear() {
    dispatch({ type: "CLEAR_URL_LOGS" });
    toast.success("URL Filtering log cleared");
  }

  function handleExport() {
    exportCsv(
      "url-filtering-log.csv",
      ["Receive Time", "Source", "URL", "Category", "Action", "Rule"],
      state.urlLogs.map((l) => [l.time, l.src, l.url, l.cat, l.action, l.rule]),
    );
    toast.success("URL Filtering log exported");
  }

  const columns: DataTableColumn<PaloUrlLogEntry>[] = [
    { key: "time", header: "Receive Time", render: (l) => <span className={styles.mono}>{l.time}</span> },
    { key: "url", header: "URL", render: (l) => l.url },
    { key: "cat", header: "Category", render: (l) => l.cat },
    { key: "action", header: "Action", render: (l) => <StatusPill tone={statusTone(l.action)}>{l.action}</StatusPill> },
    { key: "src", header: "Source", render: (l) => <span className={styles.mono}>{l.src}</span> },
    { key: "rule", header: "Rule", render: (l) => l.rule },
  ];

  return (
    <div>
      <h2>Logs &mdash; URL Filtering</h2>

      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <span className={styles.small}>{state.urlLogs.length} entries</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleClear}>
          Clear logs
        </button>
      </div>

      <DataTable columns={columns} rows={state.urlLogs} getRowKey={(l) => `${l.time}-${l.src}-${l.url}`} emptyMessage="No URL Filtering logs." />
    </div>
  );
}

// ===================================================================
// 11. WildfireSubmissionsPage — Monitor > Logs: WildFire Submissions (source
// PAGES['mon-wildfire'], lines 2602-2620). Full DataTable over
// `state.wildfireSubmissions`, newest first (seedData.ts's
// `seedWildfire()` generates in newest-first order), CSV export. Read-only —
// the reducer's Logs section has no CLEAR_WILDFIRE_SUBMISSIONS action
// (see reducer.ts), so no clear button is rendered per the porting brief.
// ===================================================================

const WILDFIRE_VERDICT_TONE: Record<string, "up" | "warn" | "down"> = {
  benign: "up",
  grayware: "warn",
  malware: "down",
  phishing: "down",
};

export function WildfireSubmissionsPage({ state }: { state: PaloState }) {
  function handleExport() {
    exportCsv(
      "wildfire-submissions.csv",
      ["Receive Time", "File", "SHA-256", "Size", "Source", "Destination", "Application", "Verdict", "Action"],
      state.wildfireSubmissions.map((l) => [l.time, l.file, l.sha256, l.size, l.src, l.dst, l.app, l.verdict, l.action]),
    );
    toast.success("WildFire submissions exported");
  }

  const columns: DataTableColumn<PaloWildfireEntry>[] = [
    { key: "time", header: "Receive Time", render: (l) => <span className={styles.mono}>{l.time}</span> },
    { key: "file", header: "File", render: (l) => l.file },
    {
      key: "sha256",
      header: "SHA-256",
      render: (l) => (
        <span className={`${styles.mono} ${styles.small}`} title={l.sha256}>
          {l.sha256.slice(0, 16)}...
        </span>
      ),
    },
    { key: "size", header: "Size", render: (l) => l.size },
    { key: "src", header: "Source", render: (l) => <span className={styles.mono}>{l.src}</span> },
    { key: "dst", header: "Destination", render: (l) => <span className={styles.mono}>{l.dst}</span> },
    { key: "app", header: "Application", render: (l) => l.app },
    {
      key: "verdict",
      header: "Verdict",
      render: (l) => <StatusPill tone={WILDFIRE_VERDICT_TONE[l.verdict.toLowerCase()] ?? "muted"}>{l.verdict}</StatusPill>,
    },
    { key: "action", header: "Action", render: (l) => <StatusPill tone={statusTone(l.action)}>{l.action}</StatusPill> },
  ];

  return (
    <div>
      <h2>Logs &mdash; WildFire Submissions</h2>

      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <span className={styles.small}>{state.wildfireSubmissions.length} entries</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={state.wildfireSubmissions}
        getRowKey={(l) => `${l.time}-${l.file}-${l.sha256}`}
        emptyMessage="No WildFire submissions."
      />
    </div>
  );
}

// ===================================================================
// 12. SystemLogsPage — Monitor > Logs: System (source PAGES['mon-system'],
// lines 2623-2630). Full DataTable over `state.systemLogs`, newest first
// (seedData.ts's `seedSystemLogs()` generates in newest-first order),
// "Clear logs" (CLEAR_SYSTEM_LOGS), CSV export.
// ===================================================================

export function SystemLogsPage({ state, dispatch }: PagePropsRW) {
  function handleClear() {
    dispatch({ type: "CLEAR_SYSTEM_LOGS" });
    toast.success("System log cleared");
  }

  function handleExport() {
    exportCsv("system-log.csv", ["Receive Time", "Severity", "Subtype", "Description"], state.systemLogs.map((l) => [l.time, l.severity, l.subtype, l.msg]));
    toast.success("System log exported");
  }

  const columns: DataTableColumn<PaloSystemLogEntry>[] = [
    { key: "time", header: "Receive Time", render: (l) => <span className={styles.mono}>{l.time}</span> },
    { key: "severity", header: "Severity", render: (l) => <StatusPill tone={statusTone(l.severity)}>{l.severity}</StatusPill> },
    { key: "subtype", header: "Subtype", render: (l) => l.subtype },
    { key: "msg", header: "Description", render: (l) => l.msg },
  ];

  return (
    <div>
      <h2>Logs &mdash; System</h2>

      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <span className={styles.small}>{state.systemLogs.length} entries</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleClear}>
          Clear logs
        </button>
      </div>

      <DataTable columns={columns} rows={state.systemLogs} getRowKey={(l) => `${l.time}-${l.subtype}-${l.msg}`} emptyMessage="No system logs." />
    </div>
  );
}
