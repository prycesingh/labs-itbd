"use client";

// VPN + User & Authentication nav-group pages for the FortiGate WebUI
// simulator. Ported from itbd-lab/simulators/network/js/fortigate-ui.js:
//   - PAGES['ipsec-tunnels']    (lines 1446-1463) + tunnelModal() (1516-1547) -> IpsecTunnelsPage
//   - PAGES['sslvpn-settings']  (lines 1549-1574)                             -> SslVpnPage (settings half)
//   - PAGES['sslvpn-portals']   (lines 1576-1582)                             -> SslVpnPage (portals half)
//   - PAGES['user-defs']        (lines 1587-1593)                            -> LocalUsersPage
//   - PAGES['user-groups']      (lines 1594-1600)                            -> UserGroupsPage
//   - PAGES['ldap']             (lines 1601-1607)                            -> LdapRadiusPage (LDAP tab)
//   - PAGES['radius']           (lines 1608-1614)                            -> LdapRadiusPage (RADIUS tab)
//
// IPsec tunnels, SSL-VPN settings/portals, local users, and user groups all
// have real reducer actions (ADD/UPDATE/DELETE, keyed by `name`), so those
// four families get genuine add/edit/delete flows here — matching the
// Cisco-suite `vpn-services-pages.tsx` AddDhcpPoolModal/EditDhcpPoolModal/
// DeleteDhcpPoolModal convention (Modal for forms/confirms, Flyout reserved
// for the one page — IPsec tunnels — that needs a large two-section
// Phase 1 / Phase 2 detail view). LDAP and RADIUS servers have NO backing
// reducer actions (see reducer.ts's Users section — only localUsers/
// userGroups get ADD/UPDATE/DELETE), so LdapRadiusPage is rendered as a
// real read-only view over real seeded state, per the porting brief — no
// action is invented for them.

import { useState } from "react";
import { toast } from "sonner";

import type { FortiAction } from "@/lib/labs/simulators/network-fortigate/reducer";
import type {
  FortiGateState,
  FortiIpsecTunnel,
  FortiLocalUser,
  FortiSslVpnPortal,
  FortiUserGroup,
} from "@/lib/labs/simulators/network-fortigate/types";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Flyout,
  Modal,
  StatusPill,
  statusTone,
  TabBar,
  Toggle,
} from "./fortigate-ui";
import styles from "./fortigate-console.module.css";

type FortiPageProps = { state: FortiGateState; dispatch: React.Dispatch<FortiAction> };

// ===================================================================
// 1. VPN > IPsec Tunnels — source PAGES['ipsec-tunnels'] + tunnelModal()
// ===================================================================

function emptyIpsecTunnelDraft(): FortiIpsecTunnel {
  return {
    name: "",
    remoteGw: "",
    auth: "PSK",
    ike: "IKEv2",
    phase1: { encryption: "AES256", hash: "SHA256", dh: "14", lifetime: 28800 },
    phase2: { encryption: "AES256", hash: "SHA256", pfs: true, lifetime: 3600 },
    localSubnet: "",
    remoteSubnet: "",
    status: "down",
    uptime: "0d 0h",
    bytesIn: "0 B",
    bytesOut: "0 B",
  };
}

function IpsecTunnelForm({
  draft,
  onChange,
  nameDisabled,
}: {
  draft: FortiIpsecTunnel;
  onChange: (patch: Partial<FortiIpsecTunnel>) => void;
  nameDisabled?: boolean;
}) {
  return (
    <>
      <div className={styles.fieldset}>
        <legend>General</legend>
        <div className={styles.form}>
          <Field label="Name" required>
            <input
              className={styles.input}
              value={draft.name}
              disabled={nameDisabled}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="VPN-to-Branch2"
            />
          </Field>
          <Field label="Remote Gateway" required>
            <input className={styles.input} value={draft.remoteGw} onChange={(e) => onChange({ remoteGw: e.target.value })} placeholder="198.51.100.1" />
          </Field>
          <Field label="Auth Method">
            <select className={styles.select} value={draft.auth} onChange={(e) => onChange({ auth: e.target.value })}>
              <option>PSK</option>
              <option>Certificate</option>
            </select>
          </Field>
          <Field label="IKE Version">
            <select className={styles.select} value={draft.ike} onChange={(e) => onChange({ ike: e.target.value })}>
              <option>IKEv2</option>
              <option>IKEv1</option>
            </select>
          </Field>
        </div>
      </div>

      <div className={styles.fieldset}>
        <legend>Phase 1</legend>
        <div className={styles.form}>
          <Field label="Encryption">
            <input
              className={styles.input}
              value={draft.phase1.encryption}
              onChange={(e) => onChange({ phase1: { ...draft.phase1, encryption: e.target.value } })}
            />
          </Field>
          <Field label="Hash">
            <input
              className={styles.input}
              value={draft.phase1.hash}
              onChange={(e) => onChange({ phase1: { ...draft.phase1, hash: e.target.value } })}
            />
          </Field>
          <Field label="DH Group">
            <input
              className={styles.input}
              value={draft.phase1.dh}
              onChange={(e) => onChange({ phase1: { ...draft.phase1, dh: e.target.value } })}
            />
          </Field>
          <Field label="Lifetime" help="seconds">
            <input
              className={styles.input}
              type="number"
              value={draft.phase1.lifetime}
              onChange={(e) => onChange({ phase1: { ...draft.phase1, lifetime: Number(e.target.value) } })}
            />
          </Field>
        </div>
      </div>

      <div className={styles.fieldset}>
        <legend>Phase 2</legend>
        <div className={styles.form}>
          <Field label="Encryption">
            <input
              className={styles.input}
              value={draft.phase2.encryption}
              onChange={(e) => onChange({ phase2: { ...draft.phase2, encryption: e.target.value } })}
            />
          </Field>
          <Field label="Hash">
            <input
              className={styles.input}
              value={draft.phase2.hash}
              onChange={(e) => onChange({ phase2: { ...draft.phase2, hash: e.target.value } })}
            />
          </Field>
          <Field label="Perfect Forward Secrecy">
            <Toggle checked={draft.phase2.pfs} onChange={(checked) => onChange({ phase2: { ...draft.phase2, pfs: checked } })} />
          </Field>
          <Field label="Lifetime" help="seconds">
            <input
              className={styles.input}
              type="number"
              value={draft.phase2.lifetime}
              onChange={(e) => onChange({ phase2: { ...draft.phase2, lifetime: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Local Subnet">
            <input className={styles.input} value={draft.localSubnet} onChange={(e) => onChange({ localSubnet: e.target.value })} placeholder="10.1.0.0/24" />
          </Field>
          <Field label="Remote Subnet">
            <input className={styles.input} value={draft.remoteSubnet} onChange={(e) => onChange({ remoteSubnet: e.target.value })} placeholder="10.50.0.0/16" />
          </Field>
        </div>
      </div>
    </>
  );
}

function AddIpsecTunnelModal({
  existingNames,
  onClose,
  dispatch,
}: {
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiIpsecTunnel>(emptyIpsecTunnelDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter a tunnel name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`A tunnel named "${name}" already exists`);
      return;
    }
    if (!draft.remoteGw.trim()) {
      toast.error("Remote gateway is required");
      return;
    }
    dispatch({ type: "ADD_IPSEC_TUNNEL", tunnel: { ...draft, name } });
    toast.success(`Tunnel "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="Create New IPsec Tunnel"
      onClose={onClose}
      width="640px"
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create Tunnel
          </button>
        </>
      }
    >
      <IpsecTunnelForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function DeleteIpsecTunnelModal({
  tunnel,
  onClose,
  dispatch,
}: {
  tunnel: FortiIpsecTunnel;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_IPSEC_TUNNEL", name: tunnel.name });
    toast.success(`Tunnel "${tunnel.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete IPsec Tunnel"
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
        Delete IPsec tunnel <b>{tunnel.name}</b> ({tunnel.remoteGw})? This cannot be undone.
      </p>
    </Modal>
  );
}

function IpsecTunnelDetailFlyout({
  tunnel,
  onClose,
  dispatch,
}: {
  tunnel: FortiIpsecTunnel;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiIpsecTunnel>(tunnel);

  function handleSave() {
    if (!draft.remoteGw.trim()) {
      toast.error("Remote gateway is required");
      return;
    }
    dispatch({ type: "UPDATE_IPSEC_TUNNEL", name: tunnel.name, patch: draft });
    toast.success(`Tunnel "${tunnel.name}" saved`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit IPsec Tunnel - ${tunnel.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Save
          </button>
        </>
      }
    >
      <div className={styles.small} style={{ marginBottom: 10 }}>
        Status <StatusPill tone={statusTone(tunnel.status)}>{tunnel.status}</StatusPill> &middot; Uptime {tunnel.uptime} &middot; In {tunnel.bytesIn} / Out{" "}
        {tunnel.bytesOut}
      </div>
      <IpsecTunnelForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} nameDisabled />
    </Flyout>
  );
}

export function IpsecTunnelsPage({ state, dispatch }: FortiPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailTarget, setDetailTarget] = useState<FortiIpsecTunnel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FortiIpsecTunnel | null>(null);

  const columns: DataTableColumn<FortiIpsecTunnel>[] = [
    { key: "name", header: "Name", render: (t) => <b>{t.name}</b> },
    { key: "remoteGw", header: "Remote Gateway", render: (t) => <span className={styles.mono}>{t.remoteGw}</span> },
    { key: "authIke", header: "Auth/IKE", render: (t) => `${t.auth} / ${t.ike}` },
    { key: "status", header: "Status", render: (t) => <StatusPill tone={statusTone(t.status)}>{t.status}</StatusPill> },
    { key: "uptime", header: "Uptime", render: (t) => t.uptime },
    {
      key: "bandwidth",
      header: "Bandwidth",
      render: (t) => (
        <span className={styles.small}>
          In: {t.bytesIn}
          <br />
          Out: {t.bytesOut}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <button
          type="button"
          className={`${styles.btnSm} ${styles.btnDanger}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(t);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <h2>IPsec Tunnels</h2>

      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAddModal(true)}>
          + Add tunnel
        </button>
        <div className={styles.grow} />
      </div>

      <DataTable columns={columns} rows={state.ipsecTunnels} getRowKey={(t) => t.name} onRowClick={(t) => setDetailTarget(t)} emptyMessage="No IPsec tunnels configured." />

      {showAddModal ? (
        <AddIpsecTunnelModal existingNames={state.ipsecTunnels.map((t) => t.name)} onClose={() => setShowAddModal(false)} dispatch={dispatch} />
      ) : null}
      {detailTarget ? <IpsecTunnelDetailFlyout tunnel={detailTarget} onClose={() => setDetailTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteIpsecTunnelModal tunnel={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 2. VPN > SSL-VPN — source PAGES['sslvpn-settings'] + PAGES['sslvpn-portals']
// ===================================================================

function emptySslVpnPortalDraft(): FortiSslVpnPortal {
  return { name: "", webMode: true, tunnelMode: true, splitTunnel: true, dnsServer: "", userGroups: "", comment: "" };
}

function SslVpnPortalForm({
  draft,
  onChange,
  nameDisabled,
}: {
  draft: FortiSslVpnPortal;
  onChange: (patch: Partial<FortiSslVpnPortal>) => void;
  nameDisabled?: boolean;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} disabled={nameDisabled} onChange={(e) => onChange({ name: e.target.value })} placeholder="web-only" />
      </Field>
      <Field label="Web Mode">
        <Toggle checked={draft.webMode} onChange={(checked) => onChange({ webMode: checked })} />
      </Field>
      <Field label="Tunnel Mode">
        <Toggle checked={draft.tunnelMode} onChange={(checked) => onChange({ tunnelMode: checked })} />
      </Field>
      <Field label="Split Tunnel">
        <Toggle checked={draft.splitTunnel} onChange={(checked) => onChange({ splitTunnel: checked })} />
      </Field>
      <Field label="DNS Server" help="Optional">
        <input className={styles.input} value={draft.dnsServer ?? ""} onChange={(e) => onChange({ dnsServer: e.target.value })} placeholder="10.1.0.1" />
      </Field>
      <Field label="User Groups">
        <input className={styles.input} value={draft.userGroups} onChange={(e) => onChange({ userGroups: e.target.value })} placeholder="VPN-Users" />
      </Field>
      <Field label="Comments">
        <input className={styles.input} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} />
      </Field>
    </div>
  );
}

function AddSslVpnPortalModal({
  existingNames,
  onClose,
  dispatch,
}: {
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiSslVpnPortal>(emptySslVpnPortalDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter a portal name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`A portal named "${name}" already exists`);
      return;
    }
    dispatch({ type: "ADD_SSL_VPN_PORTAL", portal: { ...draft, name } });
    toast.success(`Portal "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="Create New SSL-VPN Portal"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create
          </button>
        </>
      }
    >
      <SslVpnPortalForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditSslVpnPortalModal({
  portal,
  onClose,
  dispatch,
}: {
  portal: FortiSslVpnPortal;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiSslVpnPortal>(portal);

  function handleSubmit() {
    dispatch({ type: "UPDATE_SSL_VPN_PORTAL", name: portal.name, patch: draft });
    toast.success(`Portal "${portal.name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit SSL-VPN Portal - ${portal.name}`}
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
      <SslVpnPortalForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} nameDisabled />
    </Modal>
  );
}

function DeleteSslVpnPortalModal({
  portal,
  onClose,
  dispatch,
}: {
  portal: FortiSslVpnPortal;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_SSL_VPN_PORTAL", name: portal.name });
    toast.success(`Portal "${portal.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete SSL-VPN Portal"
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
        Delete SSL-VPN portal <b>{portal.name}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

function SslVpnSettingsSection({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.sslVpnSettings);

  function startEdit() {
    setDraft(state.sslVpnSettings);
    setEditing(true);
  }

  function handleSave() {
    if (!draft.listenInterface.trim()) {
      toast.error("Listen interface is required");
      return;
    }
    dispatch({ type: "UPDATE_SSL_VPN_SETTINGS", patch: draft });
    toast.success("SSL-VPN settings saved");
    setEditing(false);
  }

  const s = state.sslVpnSettings;

  return (
    <div className={styles.fieldset}>
      <legend>Connection Settings</legend>
      {editing ? (
        <>
          <div className={styles.form}>
            <Field label="Listen on Interface(s)">
              <input
                className={styles.input}
                value={draft.listenInterface}
                onChange={(e) => setDraft((prev) => ({ ...prev, listenInterface: e.target.value }))}
              />
            </Field>
            <Field label="Listen on Port">
              <input
                className={styles.input}
                type="number"
                value={draft.listenPort}
                onChange={(e) => setDraft((prev) => ({ ...prev, listenPort: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Idle Logout" help="seconds">
              <input
                className={styles.input}
                type="number"
                value={draft.idleTimeout}
                onChange={(e) => setDraft((prev) => ({ ...prev, idleTimeout: Number(e.target.value) }))}
              />
            </Field>
            <Field label="TLS Version">
              <input className={styles.input} value={draft.tlsVersion} onChange={(e) => setDraft((prev) => ({ ...prev, tlsVersion: e.target.value }))} />
            </Field>
            <Field label="Server Certificate">
              <input className={styles.input} value={draft.serverCert} onChange={(e) => setDraft((prev) => ({ ...prev, serverCert: e.target.value }))} />
            </Field>
            <Field label="Tunnel IP Pool">
              <input
                className={styles.input}
                value={draft.tunnelIpPool}
                onChange={(e) => setDraft((prev) => ({ ...prev, tunnelIpPool: e.target.value }))}
              />
            </Field>
          </div>
          <div className={`${styles.flex} ${styles.gap8} ${styles.mt10}`}>
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
            <dt>Listen Interface(s)</dt>
            <dd>{s.listenInterface}</dd>
            <dt>Listen Port</dt>
            <dd>{s.listenPort}</dd>
            <dt>Idle Logout</dt>
            <dd>{s.idleTimeout} seconds</dd>
            <dt>TLS Version</dt>
            <dd>{s.tlsVersion}</dd>
            <dt>Server Certificate</dt>
            <dd>{s.serverCert}</dd>
            <dt>Tunnel IP Pool</dt>
            <dd>{s.tunnelIpPool}</dd>
          </dl>
          <div className={styles.mt10}>
            <button type="button" className={styles.btn} onClick={startEdit}>
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SslVpnPage({ state, dispatch }: FortiPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FortiSslVpnPortal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FortiSslVpnPortal | null>(null);

  const portalColumns: DataTableColumn<FortiSslVpnPortal>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "webMode", header: "Web Mode", render: (p) => (p.webMode ? <StatusPill tone="up">Yes</StatusPill> : <StatusPill tone="muted">No</StatusPill>) },
    {
      key: "tunnelMode",
      header: "Tunnel Mode",
      render: (p) => (p.tunnelMode ? <StatusPill tone="up">Yes</StatusPill> : <StatusPill tone="muted">No</StatusPill>),
    },
    {
      key: "splitTunnel",
      header: "Split Tunnel",
      render: (p) => (p.splitTunnel ? <StatusPill tone="up">Yes</StatusPill> : <StatusPill tone="muted">No</StatusPill>),
    },
    { key: "dnsServer", header: "DNS Server", render: (p) => p.dnsServer || <span className={styles.small}>&mdash;</span> },
    { key: "userGroups", header: "Groups", render: (p) => p.userGroups },
    { key: "comment", header: "Comments", render: (p) => p.comment },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className={styles.flex}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget(p);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(p);
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const vpnUserColumns: DataTableColumn<FortiGateState["vpnUsers"][number]>[] = [
    { key: "upn", header: "User Principal Name", render: (u) => <span className={styles.mono}>{u.upn}</span> },
    { key: "displayName", header: "Display Name", render: (u) => u.displayName },
    { key: "group", header: "Assigned Group", render: (u) => u.group },
  ];

  return (
    <div>
      <h2>SSL-VPN Settings</h2>

      <SslVpnSettingsSection state={state} dispatch={dispatch} />

      <div className={styles.mt14}>
        <h3>SSL-VPN Portals</h3>
        <div className={styles.toolbar}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAddModal(true)}>
            + Add portal
          </button>
          <div className={styles.grow} />
        </div>
        <DataTable columns={portalColumns} rows={state.sslVpnPortals} getRowKey={(p) => p.name} emptyMessage="No SSL-VPN portals configured." />
      </div>

      <div className={styles.mt14}>
        <h3>SSL-VPN Roster (reference)</h3>
        <div className={styles.small} style={{ marginBottom: 8 }}>
          CloudLab users provisioned for remote access via SSL-VPN — cross-reference against local users/groups above. Read-only.
        </div>
        <DataTable columns={vpnUserColumns} rows={state.vpnUsers} getRowKey={(u) => u.upn} emptyMessage="No SSL-VPN roster entries." />
      </div>

      {showAddModal ? (
        <AddSslVpnPortalModal existingNames={state.sslVpnPortals.map((p) => p.name)} onClose={() => setShowAddModal(false)} dispatch={dispatch} />
      ) : null}
      {editTarget ? <EditSslVpnPortalModal portal={editTarget} onClose={() => setEditTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteSslVpnPortalModal portal={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 3. User & Authentication > User Definition — source PAGES['user-defs']
// ===================================================================

function emptyLocalUserDraft(): FortiLocalUser {
  return { name: "", enabled: true, twoFactor: "Disabled", email: "", group: "", comment: "" };
}

function LocalUserForm({
  draft,
  onChange,
  nameDisabled,
}: {
  draft: FortiLocalUser;
  onChange: (patch: Partial<FortiLocalUser>) => void;
  nameDisabled?: boolean;
}) {
  return (
    <div className={styles.form}>
      <Field label="User Name" required>
        <input className={styles.input} value={draft.name} disabled={nameDisabled} onChange={(e) => onChange({ name: e.target.value })} placeholder="jdoe" />
      </Field>
      <Field label="Enabled">
        <Toggle checked={draft.enabled} onChange={(checked) => onChange({ enabled: checked })} />
      </Field>
      <Field label="Two-Factor">
        <select className={styles.select} value={draft.twoFactor} onChange={(e) => onChange({ twoFactor: e.target.value })}>
          <option>Disabled</option>
          <option>FortiToken</option>
          <option>Email</option>
          <option>SMS</option>
        </select>
      </Field>
      <Field label="Email">
        <input className={styles.input} value={draft.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="jdoe@cloudlab.local" />
      </Field>
      <Field label="User Group">
        <input className={styles.input} value={draft.group} onChange={(e) => onChange({ group: e.target.value })} placeholder="VPN-Users" />
      </Field>
      <Field label="Comments">
        <input className={styles.input} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} />
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
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiLocalUser>(emptyLocalUserDraft());

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
      title="Create New User"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create
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
  user: FortiLocalUser;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiLocalUser>(user);

  function handleSubmit() {
    dispatch({ type: "UPDATE_LOCAL_USER", name: user.name, patch: draft });
    toast.success(`User "${user.name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit User - ${user.name}`}
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
  user: FortiLocalUser;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_LOCAL_USER", name: user.name });
    toast.success(`User "${user.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete User"
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

export function LocalUsersPage({ state, dispatch }: FortiPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FortiLocalUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FortiLocalUser | null>(null);

  const columns: DataTableColumn<FortiLocalUser>[] = [
    { key: "name", header: "User Name", render: (u) => <b>{u.name}</b> },
    {
      key: "enabled",
      header: "Status",
      render: (u) => (u.enabled ? <StatusPill tone="up">enabled</StatusPill> : <StatusPill tone="muted">disabled</StatusPill>),
    },
    { key: "twoFactor", header: "Two-Factor", render: (u) => u.twoFactor },
    { key: "email", header: "Email", render: (u) => u.email },
    { key: "group", header: "User Group", render: (u) => u.group },
    { key: "comment", header: "Comments", render: (u) => u.comment },
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
      <h2>User Definition</h2>

      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAddModal(true)}>
          + Add user
        </button>
        <div className={styles.grow} />
      </div>

      <DataTable columns={columns} rows={state.localUsers} getRowKey={(u) => u.name} emptyMessage="No local users configured." />

      {showAddModal ? (
        <AddLocalUserModal existingNames={state.localUsers.map((u) => u.name)} onClose={() => setShowAddModal(false)} dispatch={dispatch} />
      ) : null}
      {editTarget ? <EditLocalUserModal user={editTarget} onClose={() => setEditTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteLocalUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 4. User & Authentication > User Groups — source PAGES['user-groups']
// ===================================================================

function emptyUserGroupDraft(): FortiUserGroup {
  return { name: "", type: "Firewall", members: "", comment: "" };
}

function UserGroupForm({
  draft,
  onChange,
  nameDisabled,
}: {
  draft: FortiUserGroup;
  onChange: (patch: Partial<FortiUserGroup>) => void;
  nameDisabled?: boolean;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} disabled={nameDisabled} onChange={(e) => onChange({ name: e.target.value })} placeholder="Contractors" />
      </Field>
      <Field label="Type">
        <select className={styles.select} value={draft.type} onChange={(e) => onChange({ type: e.target.value as FortiUserGroup["type"] })}>
          <option value="Firewall">Firewall</option>
          <option value="Guest">Guest</option>
        </select>
      </Field>
      <Field label="Members" help="Comma-separated user names">
        <input className={styles.input} value={draft.members} onChange={(e) => onChange({ members: e.target.value })} placeholder="admin, ankit" />
      </Field>
      <Field label="Comments">
        <input className={styles.input} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} />
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
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiUserGroup>(emptyUserGroupDraft());

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
      title="Create New User Group"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}>
            Create
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
  group: FortiUserGroup;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiUserGroup>(group);

  function handleSubmit() {
    dispatch({ type: "UPDATE_USER_GROUP", name: group.name, patch: draft });
    toast.success(`Group "${group.name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit User Group - ${group.name}`}
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
  group: FortiUserGroup;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_USER_GROUP", name: group.name });
    toast.success(`Group "${group.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete User Group"
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

export function UserGroupsPage({ state, dispatch }: FortiPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FortiUserGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FortiUserGroup | null>(null);

  const columns: DataTableColumn<FortiUserGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "type", header: "Type", render: (g) => g.type },
    { key: "members", header: "Members", render: (g) => g.members || <span className={styles.small}>&mdash;</span> },
    { key: "comment", header: "Comments", render: (g) => g.comment },
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
      <h2>User Groups</h2>

      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAddModal(true)}>
          + Add group
        </button>
        <div className={styles.grow} />
      </div>

      <DataTable columns={columns} rows={state.userGroups} getRowKey={(g) => g.name} emptyMessage="No user groups configured." />

      {showAddModal ? (
        <AddUserGroupModal existingNames={state.userGroups.map((g) => g.name)} onClose={() => setShowAddModal(false)} dispatch={dispatch} />
      ) : null}
      {editTarget ? <EditUserGroupModal group={editTarget} onClose={() => setEditTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteUserGroupModal group={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 5. User & Authentication > LDAP & RADIUS Servers — source PAGES['ldap'] +
// PAGES['radius']. Neither family has a reducer action (see reducer.ts —
// only localUsers/userGroups get ADD/UPDATE/DELETE among the User section),
// so this page is read-only, matching the Cisco-suite convention of
// rendering families with no real save call-site as live views over real
// seeded state rather than inventing mutation actions.
// ===================================================================

const LDAP_RADIUS_TABS = [
  { key: "ldap", label: "LDAP Servers" },
  { key: "radius", label: "RADIUS Servers" },
] as const;

type LdapRadiusTabKey = (typeof LDAP_RADIUS_TABS)[number]["key"];

export function LdapRadiusPage({ state }: { state: FortiGateState }) {
  const [tab, setTab] = useState<LdapRadiusTabKey>("ldap");

  const ldapColumns: DataTableColumn<FortiGateState["ldapServers"][number]>[] = [
    { key: "name", header: "Name", render: (l) => <b>{l.name}</b> },
    { key: "server", header: "Server", render: (l) => <span className={styles.mono}>{`${l.server}:${l.port}`}</span> },
    { key: "baseDn", header: "Base DN", render: (l) => <span className={styles.mono}>{l.baseDn}</span> },
    { key: "bindDn", header: "Bind DN", render: (l) => <span className={styles.mono}>{l.bindDn}</span> },
    { key: "secure", header: "Secure", render: (l) => <StatusPill tone={l.secure && l.secure !== "None" ? "up" : "muted"}>{l.secure}</StatusPill> },
    { key: "comment", header: "Comments", render: (l) => l.comment },
  ];

  const radiusColumns: DataTableColumn<FortiGateState["radiusServers"][number]>[] = [
    { key: "name", header: "Name", render: (r) => <b>{r.name}</b> },
    { key: "server", header: "Server", render: (r) => <span className={styles.mono}>{`${r.server}:${r.port}`}</span> },
    { key: "secret", header: "Secret", render: () => <span className={styles.mono}>&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</span> },
    { key: "auth", header: "Auth Method", render: (r) => r.auth },
    { key: "comment", header: "Comments", render: (r) => r.comment },
  ];

  return (
    <div>
      <h2>LDAP &amp; RADIUS Servers</h2>
      <TabBar tabs={[...LDAP_RADIUS_TABS]} active={tab} onChange={(key) => setTab(key as LdapRadiusTabKey)} />

      {tab === "ldap" ? (
        state.ldapServers.length === 0 ? (
          <EmptyState message="No LDAP servers configured." />
        ) : (
          <DataTable columns={ldapColumns} rows={state.ldapServers} getRowKey={(l) => l.name} emptyMessage="No LDAP servers configured." />
        )
      ) : state.radiusServers.length === 0 ? (
        <EmptyState message="No RADIUS servers configured." />
      ) : (
        <DataTable columns={radiusColumns} rows={state.radiusServers} getRowKey={(r) => r.name} emptyMessage="No RADIUS servers configured." />
      )}

      <div className={styles.small} style={{ marginTop: 10 }}>
        LDAP and RADIUS server records are read-only in this simulator — source never wired a save call-site for either family, and no reducer
        action exists to mutate them.
      </div>
    </div>
  );
}
