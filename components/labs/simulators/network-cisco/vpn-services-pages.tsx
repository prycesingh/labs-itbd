"use client";

// VPN + Services nav-group pages for the Cisco IOS WebUI simulator. Ported
// from itbd-lab/simulators/network/js/cisco-ui.js:
//   - P['sec-vpn-ipsec']  (lines 885-902)  -> IpsecTunnelsPage
//   - P['sec-vpn-ssl']    (lines 904-917)  -> SslVpnPage
//   - P['rt-dhcp']        (line 755)       -> DhcpPage
//   - P['a-snmp']         (lines 1153-1166) -> SnmpPage
//   - P['a-ntp']          (lines 1141-1152) -> NtpPage
//   - P['qos-wizard'] / P['qos-policy'] (lines 990-1013) -> QosPage
//
// Source's IPsec/SSL-VPN/SNMP/NTP/QoS pages are all read-only tables/cards
// over `CiscoData.state` — none of them have a real save/mutate call-site
// (the only source button on sec-vpn-ipsec, "Create IPsec Tunnel", calls
// `CiscoUI._addIpsec()` which is decorative — it only pushes a toast, never
// mutates `CiscoData.state.ipsecTunnels` or calls `CiscoData.save()`). Per the
// porting brief, no new reducer actions are invented for those families —
// they're rendered as real, live views over real seeded state instead of
// wiring a fake button. DHCP pools are the one family with real reducer
// support (ADD_DHCP_POOL/UPDATE_DHCP_POOL/DELETE_DHCP_POOL), so DhcpPage gets
// a genuine add/edit/delete flow, matching the Meraki-suite
// AddAdminModal/DeleteAdminModal convention (network-wide-pages.tsx).

import { useState } from "react";
import { toast } from "sonner";

import type { CiscoAction } from "@/lib/labs/simulators/network-cisco/reducer";
import type { CiscoDhcpPool, CiscoState } from "@/lib/labs/simulators/network-cisco/types";
import { DataTable, type DataTableColumn, Field, Modal, StatusPill, statusTone } from "./cisco-ui";
import styles from "./cisco-console.module.css";

type CiscoPageProps = { state: CiscoState; dispatch: React.Dispatch<CiscoAction> };

// ===================================================================
// 1. VPN - IPsec — source P['sec-vpn-ipsec']
// ===================================================================

export function IpsecTunnelsPage({ state }: { state: CiscoState }) {
  const columns: DataTableColumn<CiscoState["ipsecTunnels"][number]>[] = [
    { key: "name", header: "Tunnel", render: (t) => <b>{t.name}</b> },
    { key: "peer", header: "Peer", render: (t) => <span className={styles.mono}>{t.peer}</span> },
    { key: "authIke", header: "Auth / IKE", render: (t) => `${t.auth} / ${t.ike}` },
    { key: "crypto", header: "Crypto", render: (t) => `${t.enc} · ${t.hash} · DH-${t.dh}` },
    {
      key: "nets",
      header: "Local ↔ Remote",
      render: (t) => (
        <span className={styles.mono}>
          {t.localNet} &#8596; {t.remoteNet}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (t) => <StatusPill tone={statusTone(t.state.split("-")[0] ?? t.state)}>{t.state}</StatusPill>,
    },
    { key: "pkts", header: "Packets", render: (t) => t.pkts.toLocaleString() },
    { key: "kBytes", header: "kBytes", render: (t) => t.kBytes.toLocaleString() },
    { key: "uptime", header: "Uptime", render: (t) => t.uptime },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>VPN - IPsec</h1>
      <div className={styles.card}>
        <div className={styles.cardHeader}>IPsec Tunnels</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.ipsecTunnels} getRowKey={(t) => t.name} emptyMessage="No IPsec tunnels configured." />
        </div>
      </div>
      <div className={styles.small}>
        Tunnel state, crypto parameters, and counters are read-only in this simulator — source's own &quot;Create IPsec Tunnel&quot; button
        never mutated tunnel state either.
      </div>
    </div>
  );
}

// ===================================================================
// 2. VPN - SSL — source P['sec-vpn-ssl']
// ===================================================================

export function SslVpnPage({ state }: { state: CiscoState }) {
  const columns: DataTableColumn<CiscoState["sslVpn"]["gateways"][number]>[] = [
    { key: "name", header: "Gateway", render: (g) => <b>{g.name}</b> },
    { key: "listenIf", header: "Listen Interface", render: (g) => <span className={styles.mono}>{g.listenIf}</span> },
    { key: "port", header: "TCP Port", render: (g) => g.port },
    { key: "idle", header: "Idle Timeout", render: (g) => `${g.idle} s` },
    { key: "cert", header: "Certificate", render: (g) => g.cert },
    { key: "activeSessions", header: "Active Sessions", render: (g) => g.activeSessions.toLocaleString() },
    { key: "peakSessions", header: "Peak (24h)", render: (g) => g.peakSessions.toLocaleString() },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>VPN - SSL</h1>
      <div className={styles.card}>
        <div className={styles.cardHeader}>SSL VPN Gateways</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.sslVpn.gateways} getRowKey={(g) => g.name} emptyMessage="No SSL VPN gateways configured." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 3. DHCP — source P['rt-dhcp'] (pools) + real bindings table
// ===================================================================

const DHCP_LEASE_DAY_OPTIONS = [1, 3, 7, 14, 30];

function emptyDhcpPoolDraft(): CiscoDhcpPool {
  return {
    name: "",
    network: "",
    mask: "255.255.255.0",
    gateway: "",
    dns: "",
    excluded: "",
    leaseDays: 7,
    domain: "",
    active: 0,
    free: 0,
    options: [],
  };
}

function DhcpPoolForm({
  draft,
  onChange,
}: {
  draft: CiscoDhcpPool;
  onChange: (patch: Partial<CiscoDhcpPool>) => void;
}) {
  return (
    <div className={styles.form}>
      <Field label="Pool name">
        <input className={styles.input} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="LAN-POOL" />
      </Field>
      <Field label="Network">
        <input className={styles.input} value={draft.network} onChange={(e) => onChange({ network: e.target.value })} placeholder="10.10.0.0" />
      </Field>
      <Field label="Subnet mask">
        <input className={styles.input} value={draft.mask} onChange={(e) => onChange({ mask: e.target.value })} placeholder="255.255.255.0" />
      </Field>
      <Field label="Default gateway">
        <input className={styles.input} value={draft.gateway} onChange={(e) => onChange({ gateway: e.target.value })} placeholder="10.10.0.1" />
      </Field>
      <Field label="DNS servers" help="Comma-separated">
        <input className={styles.input} value={draft.dns} onChange={(e) => onChange({ dns: e.target.value })} placeholder="10.10.0.2,8.8.8.8" />
      </Field>
      <Field label="Excluded range">
        <input
          className={styles.input}
          value={draft.excluded}
          onChange={(e) => onChange({ excluded: e.target.value })}
          placeholder="10.10.0.1-10.10.0.9"
        />
      </Field>
      <Field label="Lease duration">
        <select
          className={styles.select}
          value={String(draft.leaseDays)}
          onChange={(e) => onChange({ leaseDays: Number(e.target.value) })}
        >
          {DHCP_LEASE_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} day{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Domain name">
        <input className={styles.input} value={draft.domain} onChange={(e) => onChange({ domain: e.target.value })} placeholder="cloudlab.local" />
      </Field>
    </div>
  );
}

function AddDhcpPoolModal({
  existingNames,
  onClose,
  dispatch,
}: {
  existingNames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [draft, setDraft] = useState<CiscoDhcpPool>(emptyDhcpPoolDraft());

  function handleSubmit() {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Enter a pool name");
      return;
    }
    if (existingNames.includes(name)) {
      toast.error(`A DHCP pool named "${name}" already exists`);
      return;
    }
    if (!draft.network.trim() || !draft.gateway.trim()) {
      toast.error("Network and default gateway are required");
      return;
    }
    dispatch({ type: "ADD_DHCP_POOL", pool: { ...draft, name } });
    toast.success(`DHCP pool "${name}" created`);
    onClose();
  }

  return (
    <Modal
      title="Add DHCP pool"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Create pool
          </button>
        </>
      }
    >
      <DhcpPoolForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditDhcpPoolModal({
  pool,
  onClose,
  dispatch,
}: {
  pool: CiscoDhcpPool;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [draft, setDraft] = useState<CiscoDhcpPool>(pool);

  function handleSubmit() {
    if (!draft.network.trim() || !draft.gateway.trim()) {
      toast.error("Network and default gateway are required");
      return;
    }
    dispatch({ type: "UPDATE_DHCP_POOL", name: pool.name, patch: draft });
    toast.success(`DHCP pool "${pool.name}" updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit DHCP pool – ${pool.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Save changes
          </button>
        </>
      }
    >
      <DhcpPoolForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function DeleteDhcpPoolModal({
  pool,
  onClose,
  dispatch,
}: {
  pool: CiscoDhcpPool;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_DHCP_POOL", name: pool.name });
    toast.success(`DHCP pool "${pool.name}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete DHCP pool"
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
        Delete DHCP pool <b>{pool.name}</b> ({pool.network} {pool.mask})? Active leases from this pool will no longer renew. This cannot be
        undone.
      </p>
    </Modal>
  );
}

export function DhcpPage({ state, dispatch }: CiscoPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CiscoDhcpPool | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CiscoDhcpPool | null>(null);

  const poolColumns: DataTableColumn<CiscoDhcpPool>[] = [
    { key: "name", header: "Pool", render: (p) => <b>{p.name}</b> },
    {
      key: "network",
      header: "Network",
      render: (p) => (
        <span className={styles.mono}>
          {p.network} {p.mask}
        </span>
      ),
    },
    { key: "gateway", header: "Gateway", render: (p) => <span className={styles.mono}>{p.gateway}</span> },
    { key: "dns", header: "DNS", render: (p) => <span className={styles.mono}>{p.dns}</span> },
    { key: "excluded", header: "Excluded range", render: (p) => <span className={styles.mono}>{p.excluded}</span> },
    { key: "leaseDays", header: "Lease", render: (p) => `${p.leaseDays} day${p.leaseDays === 1 ? "" : "s"}` },
    { key: "domain", header: "Domain", render: (p) => p.domain },
    {
      key: "usage",
      header: "Active / Free",
      render: (p) => (
        <>
          <StatusPill tone="up">{p.active} active</StatusPill> <StatusPill tone="muted">{p.free} free</StatusPill>
        </>
      ),
    },
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

  const bindingColumns: DataTableColumn<CiscoState["dhcpBindings"][number]>[] = [
    { key: "ip", header: "IP Address", render: (b) => <span className={styles.mono}>{b.ip}</span> },
    { key: "mac", header: "MAC Address", render: (b) => <span className={styles.mono}>{b.mac}</span> },
    { key: "lease", header: "Lease Expiration", render: (b) => b.lease },
    { key: "type", header: "Type", render: (b) => b.type },
    { key: "hostname", header: "Hostname", render: (b) => b.hostname },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>DHCP Pools</h1>

      <div className={styles.toolbar}>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={styles.btn} onClick={() => setShowAddModal(true)}>
          + Add pool
        </button>
      </div>

      <div className={styles.card}>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={poolColumns} rows={state.dhcpPools} getRowKey={(p) => p.name} emptyMessage="No DHCP pools configured." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Address Bindings</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable
            columns={bindingColumns}
            rows={state.dhcpBindings}
            getRowKey={(b) => b.ip}
            emptyMessage="No active DHCP bindings."
          />
        </div>
      </div>

      {showAddModal ? (
        <AddDhcpPoolModal existingNames={state.dhcpPools.map((p) => p.name)} onClose={() => setShowAddModal(false)} dispatch={dispatch} />
      ) : null}
      {editTarget ? <EditDhcpPoolModal pool={editTarget} onClose={() => setEditTarget(null)} dispatch={dispatch} /> : null}
      {deleteTarget ? <DeleteDhcpPoolModal pool={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 4. SNMP — source P['a-snmp']
// ===================================================================

export function SnmpPage({ state }: { state: CiscoState }) {
  const sn = state.snmp;

  // Community strings are less sensitive than passwords/keys (source itself
  // rendered them in plain text, cisco-ui.js:1156) but this is still a
  // secret used for read/write device access, so read-only (RO) communities
  // are shown in full while read-write (RW) communities — which grant config
  // changes if leaked — are masked, matching the "don't show secrets that
  // grant mutation" convention used elsewhere in this port (e.g. AAA/TACACS
  // keys, VTP/EIGRP/OSPF auth keys are always masked in seedData).
  const communityColumns: DataTableColumn<CiscoState["snmp"]["communities"][number]>[] = [
    {
      key: "string",
      header: "Community",
      render: (c) => <span className={styles.mono}>{c.access === "RW" ? "••••" : c.string}</span>,
    },
    { key: "access", header: "Access", render: (c) => <StatusPill tone={c.access === "RW" ? "warn" : "info"}>{c.access}</StatusPill> },
    { key: "acl", header: "ACL", render: (c) => c.acl },
  ];

  const trapColumns: DataTableColumn<CiscoState["snmp"]["trapHosts"][number]>[] = [
    { key: "host", header: "Host", render: (h) => <span className={styles.mono}>{h.host}</span> },
    { key: "community", header: "Community", render: (h) => h.community },
    { key: "version", header: "Version", render: (h) => h.version },
    { key: "traps", header: "Traps", render: (h) => h.traps.join(", ") },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>SNMP</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Communities</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={communityColumns} rows={sn.communities} getRowKey={(c) => c.string} emptyMessage="No SNMP communities configured." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Trap Hosts</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={trapColumns} rows={sn.trapHosts} getRowKey={(h) => h.host} emptyMessage="No trap hosts configured." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Agent Identity</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Contact</dt>
            <dd>{sn.contact}</dd>
            <dt>Location</dt>
            <dd>{sn.location}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 5. NTP / SNTP — source P['a-ntp']
// ===================================================================

export function NtpPage({ state }: { state: CiscoState }) {
  const columns: DataTableColumn<CiscoState["ntpAssociations"][number]>[] = [
    {
      key: "server",
      header: "Server",
      render: (n) => (
        <span className={styles.mono}>
          {n.sync ? "*" : ""}
          {n.server}
        </span>
      ),
    },
    { key: "stratum", header: "St", render: (n) => n.stratum },
    { key: "when", header: "When", render: (n) => n.when },
    { key: "poll", header: "Poll", render: (n) => n.poll },
    { key: "reach", header: "Reach", render: (n) => n.reach },
    { key: "delay", header: "Delay", render: (n) => n.delay },
    { key: "offset", header: "Offset", render: (n) => n.offset },
    { key: "disp", header: "Disp", render: (n) => n.disp },
    {
      key: "sync",
      header: "Sync",
      render: (n) => (n.sync ? <StatusPill tone="up">synchronized</StatusPill> : <StatusPill tone="muted">candidate</StatusPill>),
    },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>NTP / SNTP</h1>
      <div className={styles.card}>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.ntpAssociations} getRowKey={(n) => n.server} emptyMessage="No NTP associations configured." />
        </div>
      </div>
      <div className={styles.small}>* = synchronized peer (show ntp associations)</div>
    </div>
  );
}

// ===================================================================
// 6. QoS — source P['qos-wizard'] + P['qos-policy']
// ===================================================================

export function QosPage({ state }: { state: CiscoState }) {
  const qos = state.qos;

  const classMapColumns: DataTableColumn<CiscoState["qos"]["classMaps"][number]>[] = [
    { key: "name", header: "Class-Map", render: (c) => c.name },
    { key: "match", header: "Match", render: (c) => <span className={styles.mono}>{c.match}</span> },
    { key: "hits", header: "Hits", render: (c) => c.hits.toLocaleString() },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Quality of Service</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Auto-QoS Wizard</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Wizard applied</dt>
            <dd>
              {qos.wizardApplied ? (
                <StatusPill tone="up">Applied</StatusPill>
              ) : (
                <StatusPill tone="muted">Not applied</StatusPill>
              )}
            </dd>
          </dl>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Generated Class-Maps</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={classMapColumns} rows={qos.classMaps} getRowKey={(c) => c.name} emptyMessage="No class-maps configured." />
        </div>
      </div>

      {qos.policyMaps.map((pm) => {
        const columns: DataTableColumn<(typeof pm.classes)[number]>[] = [
          { key: "class", header: "Class", render: (c) => c.class },
          { key: "bw", header: "Bandwidth", render: (c) => c.bw || "-" },
          { key: "shape", header: "Shape", render: (c) => c.shape || "-" },
          { key: "queue", header: "Queue", render: (c) => c.queue },
          { key: "drop", header: "Drops", render: (c) => c.drop.toLocaleString() },
        ];
        return (
          <div className={styles.card} key={pm.name}>
            <div className={styles.cardHeader}>
              Policy-Map {pm.name} &middot; applied {pm.applied}
            </div>
            <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
              <DataTable columns={columns} rows={pm.classes} getRowKey={(c) => c.class} emptyMessage="No classes in this policy-map." />
            </div>
          </div>
        );
      })}
    </div>
  );
}
