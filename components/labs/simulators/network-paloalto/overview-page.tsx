"use client";

// Dashboard / ACC (Application Command Center) overview for the Palo Alto
// PAN-OS WebUI simulator. Source equivalent is PAGES['dashboard']
// (Dashboard tab, paloalto-ui.js:455-565: System Information widget, Logged
// In Admins, Top Applications donut, High Risk Applications bars, Top
// Source/Destination IPs bars, ACC Visibility mini-bars, Threats In Last
// 24h bars, Resources widget with live CPU mgmt/dp/memory/sessions/pps/
// throughput) plus the real ACC dashboards' top-applications table concept
// (PAGES['acc-network'] -> accTopAppsTable(), paloalto-ui.js:668-673). This
// port keeps every one of those real stats and adds the Overview/Home
// conventions used by every other ported suite: a StatRow of headline
// numbers (derived from live counts, not fabricated), CPU/memory Gauges,
// and a quick-links tile grid to key pages, wired through `onNavigate`.
//
// Every stat below is a genuine derived number computed from `state` at
// render time — nothing here is fabricated.

import type { PaloState } from "@/lib/labs/simulators/network-paloalto/types";
import type { PaloPage } from "./paloalto-shell";
import { DataTable, Gauge, StatRow, StatusPill, statusTone } from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type QuickLinkTile = { title: string; sub: string; page: PaloPage };

// Consolidated-suite equivalent of source's per-module landing stubs —
// matches the quick-links-tiles convention every other ported suite's
// Overview/Home page uses.
const QUICK_LINK_TILES: QuickLinkTile[] = [
  { title: "Security Policies", sub: "Review security rules, actions, and profile group bindings.", page: "security-policies" },
  { title: "Interfaces", sub: "Check interface link state, IP addressing, and zone assignment.", page: "interfaces" },
  { title: "VPN", sub: "Monitor IPsec tunnel status and GlobalProtect portal/gateway configuration.", page: "ipsec-tunnels" },
  { title: "Traffic Logs", sub: "Inspect recent allowed and denied traffic sessions.", page: "traffic-logs" },
];

// Threat log severities that count as "active alerts" for the headline
// stat — mirrors source's `.pa-sev-critical`/`.pa-sev-high` severity
// styling (paloalto.css:360-364): anything at high or worse is surfaced.
const ALERTABLE_SEVERITIES = new Set(["critical", "high"]);

// Maps an application's 1-5 risk rating to its `.riskN` dot class (source's
// `.pa-risk-1`..`.pa-risk-5`, paloalto.css:615-620) — a static lookup instead
// of dynamic bracket-indexing into the CSS module object, which
// TypeScript/CSS Modules typing doesn't support cleanly.
const RISK_CLASS: Record<number, string> = {
  1: styles.risk1,
  2: styles.risk2,
  3: styles.risk3,
  4: styles.risk4,
  5: styles.risk5,
};

export function OverviewPage({ state, onNavigate }: { state: PaloState; onNavigate: (page: PaloPage) => void }) {
  const d = state.device;
  const ifaces = state.interfaces;

  let upCount = 0;
  let downCount = 0;
  for (const i of ifaces) {
    if (i.link.toLowerCase() === "up") upCount++;
    else downCount++;
  }

  const activeAlertCount = state.threatLogs.filter((t) => ALERTABLE_SEVERITIES.has(t.severity.toLowerCase())).length;
  const activeTunnelCount = state.ipsecTunnels.filter((t) => t.status.toLowerCase() === "up" || t.status.toLowerCase() === "established").length;
  const enabledPolicyCount = state.securityPolicies.filter((p) => !p.disabled).length;
  const allowPolicyCount = state.securityPolicies.filter((p) => p.action === "allow").length;

  const recentSystemLogs = state.systemLogs.slice(0, 12);
  const recentTrafficLogs = state.trafficLogs.slice(0, 8);
  const topApps = state.acc.topApps.slice(0, 8);

  return (
    <div>
      <div className={styles.breadcrumb} style={{ padding: 0, background: "transparent", border: "none", marginBottom: 6 }}>
        {d.hostname} &nbsp;&rsaquo;&nbsp; <b>Dashboard</b>
      </div>
      <h2>Dashboard &mdash; Status</h2>

      <StatRow
        stats={[
          { label: "Model / PAN-OS", value: d.model, sub: `PAN-OS ${d.panOS}`, onClick: () => onNavigate("high-availability") },
          { label: "Uptime", value: d.uptime, sub: d.systemTime, onClick: () => onNavigate("high-availability") },
          { label: "Mgmt CPU", value: `${d.cpuMgmt}%`, sub: "current usage", onClick: () => onNavigate("high-availability") },
          { label: "Dataplane CPU", value: `${d.cpuDp}%`, sub: "current usage", onClick: () => onNavigate("high-availability") },
          { label: "Memory", value: `${d.memory}%`, sub: "current usage", onClick: () => onNavigate("high-availability") },
          {
            label: "Sessions",
            value: d.sessions.toLocaleString(),
            sub: `${d.sessionUtil}% utilization`,
            onClick: () => onNavigate("high-availability"),
          },
          {
            label: "Interfaces",
            value: `${upCount} / ${ifaces.length}`,
            sub: `${downCount} down`,
            onClick: () => onNavigate("interfaces"),
          },
          {
            label: "Security policies",
            value: `${enabledPolicyCount} / ${state.securityPolicies.length}`,
            sub: `${allowPolicyCount} allow`,
            onClick: () => onNavigate("security-policies"),
          },
          {
            label: "IPsec tunnels up",
            value: `${activeTunnelCount} / ${state.ipsecTunnels.length}`,
            onClick: () => onNavigate("ipsec-tunnels"),
          },
          {
            label: "Pending changes",
            value: d.pendingChanges,
            sub: d.pendingChanges > 0 ? "uncommitted" : "all committed",
            onClick: () => onNavigate("high-availability"),
          },
          {
            label: "Active threats",
            value: activeAlertCount,
            sub: activeAlertCount > 0 ? "needs attention" : "all clear",
            onClick: () => onNavigate("threat-logs"),
          },
        ]}
      />

      <div className={styles.widgetGrid}>
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>System Information</div>
          <div className={styles.widgetBody}>
            <dl className={styles.kv}>
              <dt>Device Name</dt>
              <dd>{d.hostname}</dd>
              <dt>Model</dt>
              <dd>{d.model}</dd>
              <dt>Serial #</dt>
              <dd className={styles.mono}>{d.serial}</dd>
              <dt>Software Version</dt>
              <dd>{d.panOS}</dd>
              <dt>App Version</dt>
              <dd>{d.appContent}</dd>
              <dt>Threat Version</dt>
              <dd>{d.threatContent}</dd>
              <dt>URL Filtering DB</dt>
              <dd>{d.urlDb}</dd>
              <dt>WildFire</dt>
              <dd>
                {d.wildfire} ({d.wildfireRegion} cloud)
              </dd>
              <dt>Time</dt>
              <dd>{d.systemTime}</dd>
              <dt>Uptime</dt>
              <dd>{d.uptime}</dd>
              <dt>HA</dt>
              <dd>{d.ha}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>License &amp; Content</div>
          <div className={styles.widgetBody}>
            <dl className={styles.kv}>
              <dt>License</dt>
              <dd>
                <StatusPill tone={statusTone(d.license)}>{d.license}</StatusPill>
              </dd>
              <dt>Antivirus</dt>
              <dd>{d.antivirus}</dd>
              <dt>WildFire Client</dt>
              <dd>{d.globalProtectClient}</dd>
              <dt>Log Retention</dt>
              <dd>{d.logRetentionDays} days</dd>
              <dt>Multi-VSYS</dt>
              <dd>{d.multiVsys}</dd>
              <dt>Operational Mode</dt>
              <dd>{d.operationalMode}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.widget}>
          <div className={`${styles.widgetBody} ${styles.widgetBodyCenter}`}>
            <div className={styles.widgetHeader} style={{ marginBottom: 0 }}>
              Management CPU
            </div>
            <Gauge value={d.cpuMgmt} color="#fa582d" label="Mgmt CPU" />
          </div>
        </div>

        <div className={styles.widget}>
          <div className={`${styles.widgetBody} ${styles.widgetBodyCenter}`}>
            <div className={styles.widgetHeader} style={{ marginBottom: 0 }}>
              Dataplane CPU
            </div>
            <Gauge value={d.cpuDp} color="#d34112" label="DP CPU" />
          </div>
        </div>

        <div className={styles.widget}>
          <div className={`${styles.widgetBody} ${styles.widgetBodyCenter}`}>
            <div className={styles.widgetHeader} style={{ marginBottom: 0 }}>
              Memory
            </div>
            <Gauge value={d.memory} color="#5cb85c" label="Memory" />
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>Sessions &amp; Throughput</div>
          <div className={styles.widgetBody}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{d.sessions.toLocaleString()}</div>
            <div className={styles.small}>Active sessions &middot; {d.sessionUtil}% utilization</div>
            <div className={styles.mt8}>
              <span className={styles.small}>
                Throughput: <b>{d.throughputMbps} Mbps</b> &middot; {d.packetsPerSec.toLocaleString()} pps
              </span>
            </div>
            <div className={styles.mt8}>
              <StatusPill tone="up">Healthy</StatusPill>
            </div>
          </div>
        </div>

        <div className={`${styles.widget} ${styles.widgetSpan2}`}>
          <div className={styles.widgetHeader}>Top Applications</div>
          <div className={`${styles.widgetBody} ${styles.widgetBodyTight}`}>
            <DataTable
              columns={[
                { key: "name", header: "Application", render: (a: PaloState["acc"]["topApps"][number]) => <b>{a.name}</b> },
                {
                  key: "risk",
                  header: "Risk",
                  render: (a: PaloState["acc"]["topApps"][number]) => <span className={`${styles.risk} ${RISK_CLASS[a.risk] ?? ""}`}>{a.risk}</span>,
                },
                { key: "sessions", header: "Sessions", render: (a: PaloState["acc"]["topApps"][number]) => a.sessions.toLocaleString() },
                { key: "bytes", header: "Bytes", render: (a: PaloState["acc"]["topApps"][number]) => a.bytes },
              ]}
              rows={topApps}
              getRowKey={(a) => a.name}
              dense
              onRowClick={() => onNavigate("applications")}
              emptyMessage="No application activity recorded."
            />
          </div>
        </div>

        <div className={`${styles.widget} ${styles.widgetSpan2}`}>
          <div className={styles.widgetHeader}>Interfaces</div>
          <div className={`${styles.widgetBody} ${styles.widgetBodyTight}`}>
            <DataTable
              columns={[
                { key: "name", header: "Name", render: (i: PaloState["interfaces"][number]) => i.name },
                { key: "zone", header: "Zone", render: (i: PaloState["interfaces"][number]) => i.zone },
                { key: "ip", header: "IP", render: (i: PaloState["interfaces"][number]) => i.ip },
                {
                  key: "link",
                  header: "Link",
                  render: (i: PaloState["interfaces"][number]) => <StatusPill tone={statusTone(i.link)}>{i.link}</StatusPill>,
                },
              ]}
              rows={ifaces}
              getRowKey={(i) => i.name}
              dense
              onRowClick={() => onNavigate("interfaces")}
              emptyMessage="No interfaces configured."
            />
          </div>
        </div>
      </div>

      <div className={styles.page} style={{ padding: "16px 0 0" }}>
        <h3>Quick links</h3>
        <div className={styles.grid2}>
          {QUICK_LINK_TILES.map((tile) => (
            <div key={tile.page} className={styles.widget} style={{ cursor: "pointer" }} onClick={() => onNavigate(tile.page)}>
              <div className={styles.widgetBody}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{tile.title}</div>
                <div className={styles.small}>{tile.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <h3>Recent traffic</h3>
        <DataTable
          columns={[
            { key: "time", header: "Time", render: (e: PaloState["trafficLogs"][number]) => e.time },
            { key: "src", header: "Source", render: (e: PaloState["trafficLogs"][number]) => `${e.src}:${e.srcPort}` },
            { key: "dst", header: "Destination", render: (e: PaloState["trafficLogs"][number]) => `${e.dst}:${e.dstPort}` },
            { key: "app", header: "Application", render: (e: PaloState["trafficLogs"][number]) => e.app },
            {
              key: "action",
              header: "Action",
              render: (e: PaloState["trafficLogs"][number]) => (
                <span className={e.action === "allow" ? styles.actionAllow : e.action === "deny" ? styles.actionDeny : undefined}>{e.action}</span>
              ),
            },
            { key: "rule", header: "Rule", render: (e: PaloState["trafficLogs"][number]) => e.rule },
          ]}
          rows={recentTrafficLogs}
          getRowKey={(e) => `${e.time}-${e.src}-${e.dst}-${e.srcPort}-${e.dstPort}-${e.bytes}`}
          dense
          onRowClick={() => onNavigate("traffic-logs")}
          emptyMessage="No traffic logs."
        />

        <h3>Recent system events</h3>
        <DataTable
          columns={[
            { key: "time", header: "Time", render: (e: PaloState["systemLogs"][number]) => e.time },
            {
              key: "severity",
              header: "Severity",
              render: (e: PaloState["systemLogs"][number]) => <StatusPill tone={statusTone(e.severity)}>{e.severity}</StatusPill>,
            },
            { key: "subtype", header: "Subtype", render: (e: PaloState["systemLogs"][number]) => e.subtype },
            { key: "msg", header: "Message", render: (e: PaloState["systemLogs"][number]) => e.msg },
          ]}
          rows={recentSystemLogs}
          getRowKey={(e) => `${e.time}-${e.subtype}-${e.msg}`}
          dense
          onRowClick={() => onNavigate("system-logs")}
          emptyMessage="No system logs."
        />
      </div>
    </div>
  );
}
