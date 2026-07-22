"use client";

// VPN nav-group pages for the Palo Alto PAN-OS WebUI simulator. Ported from
// itbd-lab/simulators/network/js/paloalto-ui.js:
//   - PAGES['net-ipsec'] + tunModal() (lines 2309-2388)     -> IpsecTunnelsPage
//   - PAGES['net-np-ikegw']           (lines 2391-2398)     -> IkeGatewaysPage (gateway list)
//   - PAGES['net-np-ike']             (lines 2399-2406)     -> IkeGatewaysPage (read-only IKE crypto reference table)
//   - PAGES['net-np-gpipsec']         (lines 2407-2414)     -> IkeGatewaysPage (read-only IPSec crypto reference table)
//   - PAGES['net-gp-portals']         (lines 2417-2424)     -> GlobalProtectPage (portal section)
//   - PAGES['net-gp-gateways']        (lines 2425-2432)     -> GlobalProtectPage (gateway section)
//
// Source's IKE Gateway list page (net-np-ikegw) only ever renders a
// read-only table with a decorative "+ Add" button (no modal wired,
// paloalto-ui.js:2396) and its two crypto-profile pages (net-np-ike /
// net-np-gpipsec) are 100% read-only with decorative "+ Add" buttons and no
// backing CRUD at all. Per the task brief and reducer.ts's real action set,
// this port gives IKE gateways full Add/Edit/Delete (ADD_IKE_GATEWAY/
// UPDATE_IKE_GATEWAY/DELETE_IKE_GATEWAY all exist) but renders the two
// crypto-profile tables as genuine read-only reference views — no action
// exists for them and none is invented here.
//
// Source's GlobalProtect portal/gateway pages are also read-only tables with
// decorative "+ Add" buttons and no modal (paloalto-ui.js:2417-2432) — GP
// config in PAN-OS is typically a fixed 1-2 portal/gateway setup, matching
// reducer.ts's edit-only UPDATE_GP_PORTAL/UPDATE_GP_GATEWAY (no add/delete).
// This port makes that editable via a real per-item edit Modal.
//
// All confirmations use `sonner` toasts; deletes are confirmed via a Modal
// (never window.confirm/prompt/alert), matching the network-cisco /
// network-fortigate suite convention.

import { useState } from "react";
import { toast } from "sonner";

import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import type {
  PaloGpGateway,
  PaloGpPortal,
  PaloIkeGateway,
  PaloIpsecTunnel,
  PaloProxyId,
  PaloState,
} from "@/lib/labs/simulators/network-paloalto/types";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatusPill,
  statusTone,
} from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type PaloPageProps = { state: PaloState; dispatch: React.Dispatch<PaloAction> };

// ===================================================================
// 1. IPsec Tunnels — source PAGES['net-ipsec'] (list) + tunModal() (add/edit,
//    General + Proxy IDs tabs). This port surfaces full tunnel detail
//    (incl. proxyIds as a nested read-only DataTable) in a Flyout opened by
//    row click, matching the network-cisco AclRulesFlyout convention, plus a
//    separate "+ Add tunnel" Modal and a delete-confirm Modal.
// ===================================================================

function emptyProxyId(): PaloProxyId {
  return { name: "pi-1", local: "", remote: "", proto: "any" };
}

function emptyIpsecTunnelDraft(ikeGateways: PaloIkeGateway[]): PaloIpsecTunnel {
  return {
    name: "",
    gateway: ikeGateways[0]?.name ?? "",
    peerIp: "",
    ikeProfile: "default",
    ipsecProfile: "default",
    tunnelInterface: "tunnel.1",
    psk: "",
    proxyIds: [emptyProxyId()],
    status: "down",
    uptime: "-",
    bytesIn: "0",
    bytesOut: "0",
  };
}

function IpsecTunnelForm({
  draft,
  ikeGatewayOptions,
  ipsecCryptoOptions,
  tunnelIfaceOptions,
  onChange,
}: {
  draft: PaloIpsecTunnel;
  ikeGatewayOptions: string[];
  ipsecCryptoOptions: string[];
  tunnelIfaceOptions: string[];
  onChange: (patch: Partial<PaloIpsecTunnel>) => void;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="to-HQ" />
      </Field>
      <Field label="Tunnel Interface" required>
        <NativeSelect
          value={draft.tunnelInterface}
          onChange={(v) => onChange({ tunnelInterface: v })}
          options={tunnelIfaceOptions.map((n) => ({ value: n, label: n }))}
        />
      </Field>
      <Field label="IKE Gateway" required>
        <NativeSelect value={draft.gateway} onChange={(v) => onChange({ gateway: v })} options={ikeGatewayOptions.map((n) => ({ value: n, label: n }))} />
      </Field>
      <Field label="Peer IP">
        <input className={styles.input} value={draft.peerIp} onChange={(e) => onChange({ peerIp: e.target.value })} placeholder="198.51.100.1" />
      </Field>
      <Field label="IPSec Crypto Profile">
        <NativeSelect value={draft.ipsecProfile} onChange={(v) => onChange({ ipsecProfile: v })} options={ipsecCryptoOptions.map((n) => ({ value: n, label: n }))} />
      </Field>
      <Field label="Status">
        <NativeSelect
          value={draft.status}
          onChange={(v) => onChange({ status: v })}
          options={[
            { value: "up", label: "up" },
            { value: "down", label: "down" },
          ]}
        />
      </Field>
    </div>
  );
}

function AddIpsecTunnelModal({
  state,
  onClose,
  dispatch,
}: {
  state: PaloState;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloIpsecTunnel>(() => emptyIpsecTunnelDraft(state.ikeGateways));

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (state.ipsecTunnels.some((t) => t.name === name)) {
      toast.error(`A tunnel named "${name}" already exists`);
      return;
    }
    dispatch({ type: "ADD_IPSEC_TUNNEL", tunnel: { ...draft, name } });
    toast.success(`Tunnel "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="New IPSec Tunnel"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            Create
          </button>
        </>
      }
    >
      <IpsecTunnelForm
        draft={draft}
        ikeGatewayOptions={state.ikeGateways.map((g) => g.name)}
        ipsecCryptoOptions={state.ipsecCrypto.map((c) => c.name)}
        tunnelIfaceOptions={state.interfaces.filter((i) => i.type === "Tunnel").map((i) => i.name)}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
      />
    </Modal>
  );
}

function DeleteIpsecTunnelModal({
  tunnel,
  onClose,
  dispatch,
}: {
  tunnel: PaloIpsecTunnel;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_IPSEC_TUNNEL", name: tunnel.name });
    toast.success(`Tunnel "${tunnel.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete IPSec Tunnel"
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
        Delete tunnel <b>{tunnel.name}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

function IpsecTunnelFlyout({
  tunnel,
  state,
  onClose,
  onDelete,
  dispatch,
}: {
  tunnel: PaloIpsecTunnel;
  state: PaloState;
  onClose: () => void;
  onDelete: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloIpsecTunnel>(tunnel);

  function handleSave() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({ type: "UPDATE_IPSEC_TUNNEL", name: tunnel.name, patch: draft });
    toast.success(`Tunnel "${name}" saved`);
    onClose();
  }

  const proxyColumns: DataTableColumn<PaloProxyId>[] = [
    { key: "name", header: "Name", render: (p) => p.name },
    { key: "local", header: "Local", render: (p) => <span className={styles.mono}>{p.local}</span> },
    { key: "remote", header: "Remote", render: (p) => <span className={styles.mono}>{p.remote}</span> },
    { key: "proto", header: "Protocol", render: (p) => p.proto },
  ];

  return (
    <Flyout
      title={`IPSec Tunnel — ${tunnel.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnDanger} onClick={onDelete}>
            Delete
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSave}>
            Save
          </button>
        </>
      }
    >
      <dl className={styles.kv}>
        <dt>Status</dt>
        <dd>
          <StatusPill tone={statusTone(tunnel.status)}>{tunnel.status}</StatusPill>
        </dd>
        <dt>Uptime</dt>
        <dd>{tunnel.uptime}</dd>
        <dt>Bytes in / out</dt>
        <dd>
          {tunnel.bytesIn} / {tunnel.bytesOut}
        </dd>
      </dl>

      <h3>General</h3>
      <IpsecTunnelForm
        draft={draft}
        ikeGatewayOptions={state.ikeGateways.map((g) => g.name)}
        ipsecCryptoOptions={state.ipsecCrypto.map((c) => c.name)}
        tunnelIfaceOptions={state.interfaces.filter((i) => i.type === "Tunnel").map((i) => i.name)}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
      />

      <h3>Proxy IDs</h3>
      <DataTable columns={proxyColumns} rows={draft.proxyIds} getRowKey={(p) => p.name} emptyMessage="No proxy IDs configured." dense />
    </Flyout>
  );
}

export function IpsecTunnelsPage({ state, dispatch }: PaloPageProps) {
  const [openTunnel, setOpenTunnel] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTunnel, setDeleteTunnel] = useState<PaloIpsecTunnel | null>(null);

  const columns: DataTableColumn<PaloIpsecTunnel>[] = [
    { key: "name", header: "Name", render: (t) => <b>{t.name}</b> },
    { key: "gateway", header: "IKE Gateway", render: (t) => t.gateway },
    { key: "peerIp", header: "Peer IP", render: (t) => <span className={styles.mono}>{t.peerIp}</span> },
    { key: "profiles", header: "IKE/IPSec Crypto", render: (t) => `${t.ikeProfile} / ${t.ipsecProfile}` },
    { key: "status", header: "Status", render: (t) => <StatusPill tone={statusTone(t.status)}>{t.status}</StatusPill> },
    { key: "uptime", header: "Uptime", render: (t) => t.uptime },
    {
      key: "bytes",
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
          className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTunnel(t);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  const activeTunnel = openTunnel != null ? state.ipsecTunnels.find((t) => t.name === openTunnel) ?? null : null;

  return (
    <div>
      <h2>Network &mdash; IPSec Tunnels</h2>
      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add tunnel
        </button>
      </div>
      <DataTable
        columns={columns}
        rows={state.ipsecTunnels}
        getRowKey={(t) => t.name}
        onRowClick={(t) => setOpenTunnel(t.name)}
        emptyMessage="No IPSec tunnels configured."
      />

      {activeTunnel ? (
        <IpsecTunnelFlyout
          tunnel={activeTunnel}
          state={state}
          onClose={() => setOpenTunnel(null)}
          onDelete={() => {
            setDeleteTunnel(activeTunnel);
          }}
          dispatch={dispatch}
        />
      ) : null}
      {showAdd ? <AddIpsecTunnelModal state={state} onClose={() => setShowAdd(false)} dispatch={dispatch} /> : null}
      {deleteTunnel ? (
        <DeleteIpsecTunnelModal
          tunnel={deleteTunnel}
          onClose={() => setDeleteTunnel(null)}
          dispatch={dispatch}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 2. IKE Gateways — source PAGES['net-np-ikegw'] (list, decorative "+ Add"
//    with no modal wired) + PAGES['net-np-ike'] / PAGES['net-np-gpipsec']
//    (read-only IKE/IPSec crypto profile reference tables, also decorative
//    "+ Add" buttons with zero backing CRUD in source). This port gives the
//    gateway list real Add/Edit/Delete (reducer.ts has the actions) and
//    renders the two crypto tables as genuine read-only views — no action
//    exists for them and none is invented here.
// ===================================================================

const IKE_VERSION_OPTIONS = ["IKEv1", "IKEv2"];
const IKE_AUTH_TYPE_OPTIONS = ["pre-shared-key", "certificate"];

function emptyIkeGatewayDraft(): PaloIkeGateway {
  return {
    name: "",
    version: "IKEv2",
    peerIp: "",
    localIp: "",
    authType: "pre-shared-key",
    psk: "",
    localId: "",
    peerId: "",
    cryptoProfile: "default",
  };
}

function IkeGatewayForm({
  draft,
  cryptoOptions,
  onChange,
}: {
  draft: PaloIkeGateway;
  cryptoOptions: string[];
  onChange: (patch: Partial<PaloIkeGateway>) => void;
}) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Branch-gw" />
      </Field>
      <Field label="Version">
        <NativeSelect value={draft.version} onChange={(v) => onChange({ version: v })} options={IKE_VERSION_OPTIONS.map((v) => ({ value: v, label: v }))} />
      </Field>
      <Field label="Peer IP">
        <input className={styles.input} value={draft.peerIp} onChange={(e) => onChange({ peerIp: e.target.value })} placeholder="198.51.100.50" />
      </Field>
      <Field label="Local IP">
        <input className={styles.input} value={draft.localIp} onChange={(e) => onChange({ localIp: e.target.value })} placeholder="203.0.113.10" />
      </Field>
      <Field label="Authentication">
        <NativeSelect value={draft.authType} onChange={(v) => onChange({ authType: v })} options={IKE_AUTH_TYPE_OPTIONS.map((v) => ({ value: v, label: v }))} />
      </Field>
      <Field label="Local ID">
        <input className={styles.input} value={draft.localId} onChange={(e) => onChange({ localId: e.target.value })} placeholder="@pa-edge-blr-01.cloudlab" />
      </Field>
      <Field label="Peer ID">
        <input className={styles.input} value={draft.peerId} onChange={(e) => onChange({ peerId: e.target.value })} placeholder="@br1-fw.cloudlab" />
      </Field>
      <Field label="Crypto Profile">
        <NativeSelect value={draft.cryptoProfile} onChange={(v) => onChange({ cryptoProfile: v })} options={cryptoOptions.map((v) => ({ value: v, label: v }))} />
      </Field>
    </div>
  );
}

function AddIkeGatewayModal({
  state,
  onClose,
  dispatch,
}: {
  state: PaloState;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloIkeGateway>(emptyIkeGatewayDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (state.ikeGateways.some((g) => g.name === name)) {
      toast.error(`A gateway named "${name}" already exists`);
      return;
    }
    dispatch({ type: "ADD_IKE_GATEWAY", gateway: { ...draft, name } });
    toast.success(`IKE gateway "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="New IKE Gateway"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            Create
          </button>
        </>
      }
    >
      <IkeGatewayForm draft={draft} cryptoOptions={state.ikeCrypto.map((c) => c.name)} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditIkeGatewayModal({
  gateway,
  state,
  onClose,
  dispatch,
}: {
  gateway: PaloIkeGateway;
  state: PaloState;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloIkeGateway>(gateway);

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({ type: "UPDATE_IKE_GATEWAY", name: gateway.name, patch: draft });
    toast.success(`IKE gateway "${name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit IKE Gateway — ${gateway.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            Save
          </button>
        </>
      }
    >
      <IkeGatewayForm draft={draft} cryptoOptions={state.ikeCrypto.map((c) => c.name)} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function DeleteIkeGatewayModal({
  gateway,
  onClose,
  dispatch,
}: {
  gateway: PaloIkeGateway;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_IKE_GATEWAY", name: gateway.name });
    toast.success(`IKE gateway "${gateway.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete IKE Gateway"
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
        Delete IKE gateway <b>{gateway.name}</b>? Any IPSec tunnel still referencing it will keep the stale name. This cannot be undone.
      </p>
    </Modal>
  );
}

export function IkeGatewaysPage({ state, dispatch }: PaloPageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editGateway, setEditGateway] = useState<PaloIkeGateway | null>(null);
  const [deleteGateway, setDeleteGateway] = useState<PaloIkeGateway | null>(null);

  const columns: DataTableColumn<PaloIkeGateway>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "version", header: "Version", render: (g) => g.version },
    { key: "peerIp", header: "Peer IP", render: (g) => <span className={styles.mono}>{g.peerIp}</span> },
    { key: "localIp", header: "Local IP", render: (g) => <span className={styles.mono}>{g.localIp}</span> },
    { key: "authType", header: "Auth", render: (g) => g.authType },
    { key: "ids", header: "Local ID / Peer ID", render: (g) => `${g.localId || "-"} / ${g.peerId || "-"}` },
    { key: "cryptoProfile", header: "Crypto Profile", render: (g) => g.cryptoProfile },
    {
      key: "actions",
      header: "",
      render: (g) => (
        <div className={styles.flex} style={{ gap: 4 }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={(e) => {
              e.stopPropagation();
              setEditGateway(g);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteGateway(g);
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
      <h2>Network Profiles &mdash; IKE Gateways</h2>
      <div className={styles.toolbar}>
        <div className={styles.grow} />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add gateway
        </button>
      </div>
      <DataTable columns={columns} rows={state.ikeGateways} getRowKey={(g) => g.name} emptyMessage="No IKE gateways configured." />

      <h3>IKE Crypto Profiles</h3>
      <p className={styles.small}>Read-only reference — IKE crypto profiles are not editable from this simulator.</p>
      <DataTable<PaloState["ikeCrypto"][number]>
        columns={[
          { key: "name", header: "Name", render: (c) => <b>{c.name}</b> },
          { key: "dhGroup", header: "DH Group", render: (c) => c.dhGroup },
          { key: "auth", header: "Auth", render: (c) => c.auth },
          { key: "encryption", header: "Encryption", render: (c) => c.encryption },
          { key: "lifetime", header: "Lifetime", render: (c) => c.lifetime },
        ]}
        rows={state.ikeCrypto}
        getRowKey={(c) => c.name}
        emptyMessage="No IKE crypto profiles configured."
        dense
      />

      <h3>IPSec Crypto Profiles</h3>
      <p className={styles.small}>Read-only reference — IPSec crypto profiles are not editable from this simulator.</p>
      <DataTable<PaloState["ipsecCrypto"][number]>
        columns={[
          { key: "name", header: "Name", render: (c) => <b>{c.name}</b> },
          { key: "esp", header: "Protocol", render: (c) => (c.esp ? "ESP" : "AH") },
          { key: "dhGroup", header: "DH Group", render: (c) => c.dhGroup },
          { key: "auth", header: "Auth", render: (c) => c.auth },
          { key: "encryption", header: "Encryption", render: (c) => c.encryption },
          { key: "lifetime", header: "Lifetime", render: (c) => c.lifetime },
        ]}
        rows={state.ipsecCrypto}
        getRowKey={(c) => c.name}
        emptyMessage="No IPSec crypto profiles configured."
        dense
      />

      {showAdd ? <AddIkeGatewayModal state={state} onClose={() => setShowAdd(false)} dispatch={dispatch} /> : null}
      {editGateway ? (
        <EditIkeGatewayModal gateway={editGateway} state={state} onClose={() => setEditGateway(null)} dispatch={dispatch} />
      ) : null}
      {deleteGateway ? <DeleteIkeGatewayModal gateway={deleteGateway} onClose={() => setDeleteGateway(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 3. GlobalProtect — source PAGES['net-gp-portals'] / PAGES['net-gp-gateways']
//    (read-only tables, decorative "+ Add" buttons with zero backing CRUD in
//    source). reducer.ts only offers UPDATE_GP_PORTAL / UPDATE_GP_GATEWAY
//    (no add/delete — GP config is a fixed 1-2 portal/gateway setup), so
//    this port renders one detail card per portal/gateway with an inline
//    Edit action opening a Modal. Below both sections, a read-only reference
//    DataTable of state.vpnUsers (the canonical CloudLab roster allowed via
//    GlobalProtect) gives context on who is actually using this VPN.
// ===================================================================

function GpPortalForm({ draft, onChange }: { draft: PaloGpPortal; onChange: (patch: Partial<PaloGpPortal>) => void }) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Interface">
        <input className={styles.input} value={draft.iface} onChange={(e) => onChange({ iface: e.target.value })} placeholder="ethernet1/1" />
      </Field>
      <Field label="IP Address">
        <input className={styles.input} value={draft.ip} onChange={(e) => onChange({ ip: e.target.value })} placeholder="203.0.113.10" />
      </Field>
      <Field label="Certificate">
        <input className={styles.input} value={draft.cert} onChange={(e) => onChange({ cert: e.target.value })} placeholder="GP-Portal-Cert" />
      </Field>
      <Field label="Authentication Profile">
        <input className={styles.input} value={draft.authProfile} onChange={(e) => onChange({ authProfile: e.target.value })} placeholder="ldap-corp" />
      </Field>
      <Field label="Client Config">
        <input className={styles.input} value={draft.clientCfg} onChange={(e) => onChange({ clientCfg: e.target.value })} placeholder="default-client" />
      </Field>
      <Field label="Agent Version">
        <input className={styles.input} value={draft.agentVersion} onChange={(e) => onChange({ agentVersion: e.target.value })} placeholder="6.3.2" />
      </Field>
      <Field label="Description">
        <input className={styles.input} value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
      </Field>
    </div>
  );
}

function EditGpPortalModal({
  portal,
  onClose,
  dispatch,
}: {
  portal: PaloGpPortal;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloGpPortal>(portal);

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({ type: "UPDATE_GP_PORTAL", name: portal.name, patch: draft });
    toast.success(`Portal "${name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit GlobalProtect Portal — ${portal.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            Save
          </button>
        </>
      }
    >
      <GpPortalForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function GpGatewayForm({ draft, onChange }: { draft: PaloGpGateway; onChange: (patch: Partial<PaloGpGateway>) => void }) {
  return (
    <div className={styles.form}>
      <Field label="Name" required>
        <input className={styles.input} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Interface">
        <input className={styles.input} value={draft.iface} onChange={(e) => onChange({ iface: e.target.value })} placeholder="ethernet1/1" />
      </Field>
      <Field label="IP Address">
        <input className={styles.input} value={draft.ip} onChange={(e) => onChange({ ip: e.target.value })} placeholder="203.0.113.10" />
      </Field>
      <Field label="Certificate">
        <input className={styles.input} value={draft.cert} onChange={(e) => onChange({ cert: e.target.value })} placeholder="GP-Gateway-Cert" />
      </Field>
      <Field label="Authentication Profile">
        <input className={styles.input} value={draft.authProfile} onChange={(e) => onChange({ authProfile: e.target.value })} placeholder="ldap-corp" />
      </Field>
      <Field label="Tunnel Interface">
        <input className={styles.input} value={draft.tunnelInterface} onChange={(e) => onChange({ tunnelInterface: e.target.value })} placeholder="tunnel.3" />
      </Field>
      <Field label="IP Pool">
        <input className={styles.input} value={draft.ipPool} onChange={(e) => onChange({ ipPool: e.target.value })} placeholder="172.16.99.0/24" />
      </Field>
      <Field label="Description">
        <input className={styles.input} value={draft.description} onChange={(e) => onChange({ description: e.target.value })} />
      </Field>
    </div>
  );
}

function EditGpGatewayModal({
  gateway,
  onClose,
  dispatch,
}: {
  gateway: PaloGpGateway;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloGpGateway>(gateway);

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({ type: "UPDATE_GP_GATEWAY", name: gateway.name, patch: draft });
    toast.success(`Gateway "${name}" saved`);
    onClose();
  }

  return (
    <Modal
      title={`Edit GlobalProtect Gateway — ${gateway.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit}>
            Save
          </button>
        </>
      }
    >
      <GpGatewayForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function GpPortalCard({ portal, onEdit }: { portal: PaloGpPortal; onEdit: () => void }) {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span>{portal.name}</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className={styles.widgetBody}>
        <dl className={styles.kv}>
          <dt>Interface</dt>
          <dd>{portal.iface}</dd>
          <dt>IP Address</dt>
          <dd className={styles.mono}>{portal.ip}</dd>
          <dt>Certificate</dt>
          <dd>{portal.cert}</dd>
          <dt>Auth Profile</dt>
          <dd>{portal.authProfile}</dd>
          <dt>Client Config</dt>
          <dd>{portal.clientCfg}</dd>
          <dt>Agent Version</dt>
          <dd>{portal.agentVersion}</dd>
          <dt>Description</dt>
          <dd>{portal.description || "-"}</dd>
        </dl>
      </div>
    </div>
  );
}

function GpGatewayCard({ gateway, onEdit }: { gateway: PaloGpGateway; onEdit: () => void }) {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span>{gateway.name}</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className={styles.widgetBody}>
        <dl className={styles.kv}>
          <dt>Interface</dt>
          <dd>{gateway.iface}</dd>
          <dt>IP Address</dt>
          <dd className={styles.mono}>{gateway.ip}</dd>
          <dt>Certificate</dt>
          <dd>{gateway.cert}</dd>
          <dt>Auth Profile</dt>
          <dd>{gateway.authProfile}</dd>
          <dt>Tunnel Interface</dt>
          <dd>{gateway.tunnelInterface}</dd>
          <dt>IP Pool</dt>
          <dd className={styles.mono}>{gateway.ipPool}</dd>
          <dt>Description</dt>
          <dd>{gateway.description || "-"}</dd>
        </dl>
      </div>
    </div>
  );
}

export function GlobalProtectPage({ state, dispatch }: PaloPageProps) {
  const [editPortal, setEditPortal] = useState<PaloGpPortal | null>(null);
  const [editGateway, setEditGateway] = useState<PaloGpGateway | null>(null);

  const vpnUserColumns: DataTableColumn<PaloState["vpnUsers"][number]>[] = [
    { key: "upn", header: "UPN", render: (u) => <span className={styles.mono}>{u.upn}</span> },
    { key: "displayName", header: "Display Name", render: (u) => u.displayName },
    { key: "group", header: "Group", render: (u) => u.group },
    { key: "dept", header: "Department", render: (u) => u.dept },
  ];

  return (
    <div>
      <h2>GlobalProtect</h2>

      <h3>Portals</h3>
      {state.globalProtect.portals.length === 0 ? (
        <EmptyState message="No GlobalProtect portals configured." />
      ) : (
        <div className={styles.widgetGrid}>
          {state.globalProtect.portals.map((portal) => (
            <GpPortalCard key={portal.name} portal={portal} onEdit={() => setEditPortal(portal)} />
          ))}
        </div>
      )}

      <h3>Gateways</h3>
      {state.globalProtect.gateways.length === 0 ? (
        <EmptyState message="No GlobalProtect gateways configured." />
      ) : (
        <div className={styles.widgetGrid}>
          {state.globalProtect.gateways.map((gateway) => (
            <GpGatewayCard key={gateway.name} gateway={gateway} onEdit={() => setEditGateway(gateway)} />
          ))}
        </div>
      )}

      <h3>Allowed Users (CloudLab roster)</h3>
      <p className={styles.small}>
        Read-only reference — the canonical CloudLab user roster permitted to connect via GlobalProtect (group{" "}
        <b>{state.vpnUsers[0]?.group ?? "GP-AllowedUsers"}</b>).
      </p>
      <DataTable columns={vpnUserColumns} rows={state.vpnUsers} getRowKey={(u) => u.upn} emptyMessage="No GlobalProtect users on the roster." dense />

      {editPortal ? <EditGpPortalModal portal={editPortal} onClose={() => setEditPortal(null)} dispatch={dispatch} /> : null}
      {editGateway ? <EditGpGatewayModal gateway={editGateway} onClose={() => setEditGateway(null)} dispatch={dispatch} /> : null}
    </div>
  );
}
