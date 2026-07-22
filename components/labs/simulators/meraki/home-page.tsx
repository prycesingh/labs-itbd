"use client";

// Home / Organization overview dashboard for the Meraki simulator. Closest
// source equivalent is renderOrg('org-overview') (meraki-portal.js:487-505):
// stat tiles for networks/devices/clients/license, plus a networks table.
// This port also adds a "Get started"/quick-links tile grid (linking via
// onNavigate to Clients, Devices, Topology, Alerts — matching the
// Get-started-tiles convention every other ported suite's Home page uses)
// and a recent-activity table sourced from `state.auditLog`.
//
// Every stat below is a genuine derived number computed from `state` at
// render time — nothing here is fabricated. Alerts count reads
// `state.alerts.active.length` directly per the porting brief; clients
// online is computed for the CURRENT network only (matching source's
// per-network client/device fields on `MerakiNetwork`), while devices/
// networks totals are org-wide (matching source's org-overview tiles which
// are already org-wide sums).

import type { MerakiState } from "@/lib/labs/simulators/meraki/types";
import type { MerakiPage } from "./meraki-shell";
import { DataTable, StatRow, StatusPill, statusTone } from "./meraki-ui";
import styles from "./meraki-console.module.css";

type QuickLinkTile = { title: string; sub: string; page: MerakiPage };

// Ported from the porting brief's "quick-links tile grid" requirement,
// matching the Get-started-tiles convention (source has no dedicated
// Home/Overview page beyond org-overview, so these tiles are the
// consolidated-suite equivalent of source's per-module landing stubs).
const QUICK_LINK_TILES: QuickLinkTile[] = [
  { title: "Clients", sub: "See every device connected to this network, usage, and signal.", page: "nw-clients" },
  { title: "Devices", sub: "Appliances, switches, and access points deployed in this network.", page: "nw-devices" },
  { title: "Topology", sub: "Visualize how devices in this network are physically connected.", page: "nw-topology" },
  { title: "Alerts", sub: "Review active critical, warning, and informational alerts.", page: "nw-alerts" },
];

export function HomePage({ state, onNavigate }: { state: MerakiState; onNavigate: (page: MerakiPage) => void }) {
  const currentNetwork = state.networks.find((n) => n.id === state.currentNetworkId);

  const networkCount = state.networks.length;
  const totalDevices = state.devices.length;
  const onlineDevices = state.devices.filter((d) => d.status === "online").length;
  const clientsOnlineCurrentNetwork = currentNetwork?.clientsOnline ?? 0;
  const activeAlertsCount = state.alerts.active.length;

  const recentActivity = state.auditLog.slice(0, 10);

  return (
    <div>
      <div className={styles.crumb}>
        {state.org.name} &nbsp;&rsaquo;&nbsp; <b>Overview</b>
      </div>
      <h1 className={styles.pageH}>Organization overview</h1>
      <div className={styles.pageSub}>
        {currentNetwork ? currentNetwork.name : "No network selected"} &middot; {state.org.licensing}
      </div>

      <StatRow
        stats={[
          { label: "Networks", value: networkCount, sub: "across regions", onClick: () => onNavigate("org-overview") },
          { label: "Devices", value: totalDevices, sub: `${onlineDevices} online`, onClick: () => onNavigate("nw-devices") },
          {
            label: "Clients online",
            value: clientsOnlineCurrentNetwork,
            sub: currentNetwork ? `in ${currentNetwork.name}` : undefined,
            onClick: () => onNavigate("nw-clients"),
          },
          { label: "Active alerts", value: activeAlertsCount, sub: activeAlertsCount > 0 ? "needs attention" : "all clear", onClick: () => onNavigate("nw-alerts") },
          { label: "License", value: state.org.licenseStatus, sub: `Expires ${state.org.licenseExpiry}`, onClick: () => onNavigate("org-license") },
        ]}
      />

      <div className={styles.sectionTitle}>Get started</div>
      <div className={styles.grid2}>
        {QUICK_LINK_TILES.map((tile) => (
          <div key={tile.page} className={styles.card} style={{ cursor: "pointer", marginBottom: 0 }} onClick={() => onNavigate(tile.page)}>
            <div className={styles.cardB}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{tile.title}</div>
              <div className={styles.small}>{tile.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Networks</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "name", header: "Network", render: (n: MerakiState["networks"][number]) => n.name },
              { key: "products", header: "Products", render: (n: MerakiState["networks"][number]) => n.productTypes.join(", ") },
              { key: "devices", header: "Devices online", render: (n: MerakiState["networks"][number]) => `${n.devicesOnline} / ${n.devicesTotal}` },
              { key: "clients", header: "Clients online", render: (n: MerakiState["networks"][number]) => `${n.clientsOnline} / ${n.clientsTotal}` },
              {
                key: "status",
                header: "Status",
                render: (n: MerakiState["networks"][number]) => <StatusPill tone={statusTone(n.status)}>{n.status}</StatusPill>,
              },
            ]}
            rows={state.networks}
            getRowKey={(n) => n.id}
            dense
            emptyMessage="No networks in this organization."
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Recent admin activity</div>
        <div className={`${styles.cardB} ${styles.cardBDense}`}>
          <DataTable
            columns={[
              { key: "ts", header: "Time", render: (a: MerakiState["auditLog"][number]) => a.ts },
              { key: "admin", header: "Admin", render: (a: MerakiState["auditLog"][number]) => a.admin },
              { key: "action", header: "Action", render: (a: MerakiState["auditLog"][number]) => a.action },
              { key: "page", header: "Page", render: (a: MerakiState["auditLog"][number]) => a.page },
            ]}
            rows={recentActivity}
            getRowKey={(a) => a.id}
            dense
            emptyMessage="No admin activity yet."
          />
        </div>
      </div>
    </div>
  );
}
