"use client";

// Insight and Organization nav-group pages for the Cisco Meraki dashboard
// simulator. Ported from:
//   - itbd-lab/simulators/meraki/js/meraki-insight.js renderWebApps()/
//     renderWanHealth()/renderAppPerf() (renderPaths()/"Network paths" is
//     intentionally NOT ported — it isn't part of this brief's page list and
//     has no corresponding entry in meraki-shell.tsx's MerakiPage union).
//   - itbd-lab/simulators/meraki/js/meraki-portal.js renderOrg() (lines
//     485-574): 'org-overview', 'org-inventory', 'org-license', 'org-audit'.
//     ('org-syncsts' Configuration sync, 'org-confsw' Configure switches,
//     'org-adaptive' Adaptive policy, 'org-mdm' Systems Manager, and
//     'org-settings' Organization settings have no entry in meraki-shell.tsx's
//     MerakiPage union either, so — matching the brief's exact page list —
//     they are not rendered as separate routed pages here.)
//
// All Insight pages are read-only dashboards, matching source (source's
// sparkline trend columns were synthesized client-side via fakeTrend()/
// Math.random() at render time with no persisted backing data — that
// decorative jitter is dropped here in favor of the real, stable
// healthPct/latencyMs/goodputMbps/lossPct/usageMB numbers already in state).
//
// Inventory's "Assign to network" action is the one genuine mutation in this
// file, ported from source's `_assignDevice(serial)` (meraki-portal.js:518)
// which read a corresponding <select> and called MerakiData.save() to move
// the item from `state.inventory` into `state.devices` — reproduced here via
// the reducer's ASSIGN_DEVICE_TO_NETWORK action.

import { useState } from "react";
import { toast } from "sonner";

import type { MerakiAction } from "@/lib/labs/simulators/meraki/reducer";
import type { MerakiState } from "@/lib/labs/simulators/meraki/types";
import { DataTable, NativeSelect, StatRow, StatusPill, exportCsv, statusTone } from "./meraki-ui";
import styles from "./meraki-console.module.css";

// ===================================================================
// INSIGHT — Web app health
// ===================================================================

export function InsightWebAppsPage({ state }: { state: MerakiState }) {
  const apps = state.insight.webApps;

  return (
    <div>
      <h1 className={styles.pageH}>Web app health</h1>
      <div className={styles.help}>
        Meraki Insight probes the top SaaS apps over each WAN uplink, measuring response time and availability.
      </div>
      <div className={styles.card}>
        <div className={styles.cardH}>Monitored web applications</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "name", header: "Application", render: (a) => a.name },
              { key: "health", header: "Availability (24h)", render: (a) => `${a.healthPct.toFixed(2)}%` },
              { key: "latency", header: "Avg response time", render: (a) => `${a.latencyMs} ms` },
            ]}
            rows={apps}
            getRowKey={(a) => a.name}
            dense
            emptyMessage="No monitored web applications."
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// INSIGHT — WAN health (org-level rollup, distinct from the per-appliance
// WAN link view under Security & SD-WAN)
// ===================================================================

export function InsightWanHealthPage({ state }: { state: MerakiState }) {
  const rows = state.insight.wanHealth;

  function networkName(networkId: string): string {
    return state.networks.find((n) => n.id === networkId)?.name ?? networkId;
  }

  return (
    <div>
      <h1 className={styles.pageH}>WAN health</h1>
      <div className={styles.help}>
        Organization-level rollup of WAN goodput and loss per network. For per-appliance uplink detail (loss,
        latency, jitter, attributed MX vs. ISP issues), see Security &amp; SD-WAN &rsaquo; Appliance status.
      </div>
      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "network", header: "Network", render: (w) => networkName(w.networkId) },
              { key: "goodput", header: "Goodput", render: (w) => `${w.goodputMbps} Mbps` },
              { key: "loss", header: "Loss", render: (w) => `${w.lossPct}%` },
            ]}
            rows={rows}
            getRowKey={(w) => w.networkId}
            dense
            emptyMessage="No WAN health data."
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// INSIGHT — Application performance
// ===================================================================

export function InsightApplicationsPage({ state }: { state: MerakiState }) {
  const apps = state.insight.applications;

  return (
    <div>
      <h1 className={styles.pageH}>Application performance</h1>
      <div className={styles.card}>
        <div className={styles.cardH}>Real-user metrics (per application)</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "name", header: "Application", render: (a) => a.name },
              { key: "category", header: "Category", render: (a) => a.category },
              { key: "usage", header: "Usage (24h)", render: (a) => `${a.usageMB} MB` },
            ]}
            rows={apps}
            getRowKey={(a) => a.name}
            dense
            emptyMessage="No application performance data."
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// ORGANIZATION — Overview
// ===================================================================

export function OrgOverviewPage({ state }: { state: MerakiState }) {
  const totalNetworks = state.networks.length;
  const totalDevices = state.devices.length;
  const onlineDevices = state.devices.filter((d) => d.status === "online").length;

  return (
    <div>
      <h1 className={styles.pageH}>Organization overview</h1>

      <StatRow
        stats={[
          { label: "Organization", value: state.org.name, sub: state.org.url },
          { label: "Networks", value: totalNetworks, sub: state.org.regions.join(", ") },
          { label: "Devices", value: totalDevices, sub: `${onlineDevices} online` },
          { label: "License", value: state.org.licenseStatus, sub: `Expires ${state.org.licenseExpiry}` },
        ]}
      />

      <div className={styles.card}>
        <div className={styles.cardH}>Organization details</div>
        <div className={styles.cardB}>
          <dl className={styles.kv}>
            <dt>Admin</dt>
            <dd>{state.org.admin}</dd>
            <dt>Time zone</dt>
            <dd>{state.org.tz}</dd>
            <dt>Licensing model</dt>
            <dd>{state.org.licensing}</dd>
            <dt>License status</dt>
            <dd>
              <StatusPill tone={statusTone(state.org.licenseStatus)}>{state.org.licenseStatus}</StatusPill>
            </dd>
            <dt>License expiry</dt>
            <dd>{state.org.licenseExpiry}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Networks</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "name", header: "Network", render: (n) => n.name },
              { key: "products", header: "Products", render: (n) => n.productTypes.join(", ") },
              { key: "devices", header: "Devices online", render: (n) => `${n.devicesOnline} / ${n.devicesTotal}` },
              { key: "clients", header: "Clients online", render: (n) => `${n.clientsOnline} / ${n.clientsTotal}` },
              {
                key: "status",
                header: "Status",
                render: (n) => <StatusPill tone={statusTone(n.status)}>{n.status}</StatusPill>,
              },
            ]}
            rows={state.networks}
            getRowKey={(n) => n.id}
            dense
            emptyMessage="No networks in this organization."
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// ORGANIZATION — Inventory (real mutation: assign to network)
// ===================================================================

function InventoryAssignRow({
  serial,
  networks,
  onAssign,
}: {
  serial: string;
  networks: MerakiState["networks"];
  onAssign: (serial: string, networkId: string) => void;
}) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");

  return (
    <div className={styles.flex}>
      <NativeSelect
        value={networkId}
        onChange={setNetworkId}
        options={networks.map((n) => ({ value: n.id, label: n.name }))}
      />
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSm}`}
        disabled={!networkId}
        onClick={() => onAssign(serial, networkId)}
      >
        Assign to network
      </button>
    </div>
  );
}

export function OrgInventoryPage({ state, dispatch }: { state: MerakiState; dispatch: React.Dispatch<MerakiAction> }) {
  const owned = state.devices;
  const unclaimed = state.inventory;

  function assignDevice(serial: string, networkId: string) {
    const network = state.networks.find((n) => n.id === networkId);
    dispatch({ type: "ASSIGN_DEVICE_TO_NETWORK", serial, networkId });
    toast.success(`Device ${serial} assigned to ${network?.name ?? networkId}`);
  }

  return (
    <div>
      <h1 className={styles.pageH}>Inventory</h1>

      <div className={styles.card}>
        <div className={styles.cardH}>Claimed &amp; deployed</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "name", header: "Name", render: (d) => d.name },
              { key: "model", header: "Model", render: (d) => d.model },
              { key: "serial", header: "Serial", render: (d) => <span className={styles.mono}>{d.serial}</span> },
              { key: "network", header: "Network", render: (d) => state.networks.find((n) => n.id === d.networkId)?.name ?? d.networkId },
              { key: "firmware", header: "Firmware", render: (d) => d.firmware },
              {
                key: "status",
                header: "Status",
                render: (d) => <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill>,
              },
            ]}
            rows={owned}
            getRowKey={(d) => d.serial}
            dense
            emptyMessage="No devices claimed yet."
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Claimed but unassigned</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "model", header: "Model", render: (i) => i.model },
              { key: "serial", header: "Serial", render: (i) => <span className={styles.mono}>{i.serial}</span> },
              { key: "type", header: "Type", render: (i) => i.type },
              { key: "claimed", header: "Claimed", render: (i) => <span className={styles.small}>{i.claimedOn}</span> },
              {
                key: "assign",
                header: "",
                render: (i) => <InventoryAssignRow serial={i.serial} networks={state.networks} onAssign={assignDevice} />,
              },
            ]}
            rows={unclaimed}
            getRowKey={(i) => i.serial}
            dense
            emptyMessage="All claimed devices are assigned."
          />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// ORGANIZATION — License info
// ===================================================================

export function OrgLicensePage({ state }: { state: MerakiState }) {
  return (
    <div>
      <h1 className={styles.pageH}>License info</h1>
      <div className={styles.card}>
        <div className={styles.cardH}>License summary</div>
        <div className={styles.cardB}>
          <dl className={styles.kv}>
            <dt>Licensing model</dt>
            <dd>{state.org.licensing}</dd>
            <dt>Status</dt>
            <dd>
              <StatusPill tone={statusTone(state.org.licenseStatus)}>{state.org.licenseStatus}</StatusPill>
            </dd>
            <dt>Expires</dt>
            <dd>{state.org.licenseExpiry}</dd>
            <dt>Licensed devices</dt>
            <dd>{state.devices.length}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// ORGANIZATION — Audit log
// ===================================================================

export function OrgAuditLogPage({ state }: { state: MerakiState }) {
  const sorted = [...state.auditLog].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  function handleExport() {
    exportCsv(
      "meraki-audit-log.csv",
      ["Time", "Admin", "Action", "Page"],
      sorted.map((a) => [a.ts, a.admin, a.action, a.page]),
    );
  }

  return (
    <div>
      <h1 className={styles.pageH}>Audit log</h1>
      <div className={styles.help}>Showing all {sorted.length} events, newest first.</div>

      <div className={styles.actbar}>
        <div />
        <div className={styles.actbarRight}>
          <button type="button" className={styles.btn} onClick={handleExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "ts", header: "Time", render: (a) => <span className={styles.mono}>{a.ts}</span> },
              { key: "admin", header: "Admin", render: (a) => a.admin },
              { key: "action", header: "Action", render: (a) => a.action },
              { key: "page", header: "Page", render: (a) => a.page },
            ]}
            rows={sorted}
            getRowKey={(a) => a.id}
            dense
            emptyMessage="No audit log entries."
          />
        </div>
      </div>
    </div>
  );
}
