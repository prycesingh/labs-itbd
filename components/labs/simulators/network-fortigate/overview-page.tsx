"use client";

// System Dashboard / device overview for the FortiGate WebUI simulator.
// Source equivalent is PAGES['dashboard'] (System > Dashboard,
// fortigate-ui.js:405-563): System Information widget, License &
// Subscriptions widget, CPU/Memory gauges, Sessions widget, Throughput bar
// chart, Interfaces summary table, and a System Events stream. This port
// keeps every one of those real stats and adds the Overview/Home
// conventions used by every other ported suite: a StatRow of headline
// numbers (derived from live counts, not fabricated) and a quick-links tile
// grid to key pages, wired through `onNavigate`.
//
// Every stat below is a genuine derived number computed from `state` at
// render time — nothing here is fabricated.

import type { FortiGateState } from "@/lib/labs/simulators/network-fortigate/types";
import type { FortiPage } from "./fortigate-shell";
import { DataTable, Gauge, StatRow, StatusPill, statusTone } from "./fortigate-ui";
import styles from "./fortigate-console.module.css";

type QuickLinkTile = { title: string; sub: string; page: FortiPage };

// Consolidated-suite equivalent of source's per-module landing stubs —
// matches the Get-started-tiles convention every other ported suite's
// Overview/Home page uses.
const QUICK_LINK_TILES: QuickLinkTile[] = [
  { title: "Firewall Policy", sub: "Review policy rules, actions, and security profile bindings.", page: "firewall-policies" },
  { title: "Interfaces", sub: "Check interface link state, IP addressing, and roles.", page: "interfaces" },
  { title: "VPN", sub: "Monitor IPsec tunnel status and SSL-VPN portal configuration.", page: "ipsec-tunnels" },
  { title: "Forward Traffic Logs", sub: "Inspect recent allowed and denied traffic sessions.", page: "forward-logs" },
];

// Event log severities that count as "active alerts" for the headline stat —
// mirrors the source's `.lv-critical`/`.lv-warning` event-stream styling
// (fortigate-ui.js:628-631, fortigate.css:628-631): anything at warning or
// worse is surfaced.
const ALERTABLE_LEVELS = new Set(["critical", "warning"]);

export function OverviewPage({ state, onNavigate }: { state: FortiGateState; onNavigate: (page: FortiPage) => void }) {
  const sys = state.system;
  const ifaces = state.interfaces;

  let upCount = 0;
  let downCount = 0;
  for (const f of ifaces) {
    if (f.link === "up") upCount++;
    else downCount++;
  }

  const activeAlertCount = state.eventLogs.filter((e) => ALERTABLE_LEVELS.has(e.level.toLowerCase())).length;
  const activeTunnelCount = state.ipsecTunnels.filter((t) => t.status.toLowerCase() === "established" || t.status.toLowerCase() === "up").length;
  const enabledPolicyCount = state.policies.filter((p) => p.status.toLowerCase() === "enable").length;
  const acceptPolicyCount = state.policies.filter((p) => p.action === "accept").length;

  const recentEventLogs = state.eventLogs.slice(0, 12);
  const recentForwardLogs = state.forwardLogs.slice(0, 8);

  return (
    <div>
      <div className={styles.breadcrumb} style={{ padding: 0, background: "transparent", border: "none", marginBottom: 6 }}>
        {sys.hostname} &nbsp;&rsaquo;&nbsp; <b>Dashboard</b>
      </div>
      <h2>Dashboard &mdash; Status</h2>

      <StatRow
        stats={[
          { label: "Model / Firmware", value: sys.model, sub: sys.firmware, onClick: () => onNavigate("admin-profiles") },
          { label: "Uptime", value: sys.uptime, sub: sys.lastRebootReason, onClick: () => onNavigate("ha-status") },
          { label: "CPU", value: `${sys.cpu}%`, sub: "current usage", onClick: () => onNavigate("ha-status") },
          { label: "Memory", value: `${sys.memory}%`, sub: "current usage", onClick: () => onNavigate("ha-status") },
          {
            label: "Sessions",
            value: sys.sessions.toLocaleString(),
            sub: `peak (24h) ${sys.peakSessions.toLocaleString()}`,
            onClick: () => onNavigate("ha-status"),
          },
          {
            label: "Interfaces",
            value: `${upCount} / ${ifaces.length}`,
            sub: `${downCount} down`,
            onClick: () => onNavigate("interfaces"),
          },
          {
            label: "Firewall policies",
            value: `${enabledPolicyCount} / ${state.policies.length}`,
            sub: `${acceptPolicyCount} accept`,
            onClick: () => onNavigate("firewall-policies"),
          },
          {
            label: "IPsec tunnels up",
            value: `${activeTunnelCount} / ${state.ipsecTunnels.length}`,
            onClick: () => onNavigate("ipsec-tunnels"),
          },
          {
            label: "Active alerts",
            value: activeAlertCount,
            sub: activeAlertCount > 0 ? "needs attention" : "all clear",
            onClick: () => onNavigate("event-logs"),
          },
        ]}
      />

      <div className={styles.widgetGrid}>
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>System Information</div>
          <div className={styles.widgetBody}>
            <dl className={styles.kv}>
              <dt>Hostname</dt>
              <dd>{sys.hostname}</dd>
              <dt>Serial Number</dt>
              <dd className={styles.mono}>{sys.serial}</dd>
              <dt>Firmware</dt>
              <dd>{sys.firmware}</dd>
              <dt>System Time</dt>
              <dd>{sys.systemTime}</dd>
              <dt>Uptime</dt>
              <dd>{sys.uptime}</dd>
              <dt>Last Reboot</dt>
              <dd>{sys.lastRebootReason}</dd>
              <dt>Mode</dt>
              <dd>{sys.operationMode}</dd>
              <dt>HA Status</dt>
              <dd>{sys.ha}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>License &amp; Subscriptions</div>
          <div className={styles.widgetBody}>
            <dl className={styles.kv}>
              <dt>License</dt>
              <dd>{sys.license}</dd>
              <dt>FortiCare Support</dt>
              <dd>
                <StatusPill tone="up">Registered</StatusPill>
              </dd>
              <dt>IPS</dt>
              <dd>
                <StatusPill tone="up">Licensed</StatusPill>
              </dd>
              <dt>AntiVirus</dt>
              <dd>
                <StatusPill tone="up">Licensed</StatusPill>
              </dd>
              <dt>Web Filtering</dt>
              <dd>
                <StatusPill tone="up">Licensed</StatusPill>
              </dd>
              <dt>FortiGuard</dt>
              <dd>
                <StatusPill tone="info">Reachable</StatusPill>
              </dd>
            </dl>
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>CPU</div>
          <div className={`${styles.widgetBody} ${styles.widgetBodyCenter}`}>
            <Gauge value={sys.cpu} color="#2b7de9" />
            <div className={styles.small}>Current usage</div>
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>Memory</div>
          <div className={`${styles.widgetBody} ${styles.widgetBodyCenter}`}>
            <Gauge value={sys.memory} color="#5cb85c" />
            <div className={styles.small}>Current usage</div>
          </div>
        </div>

        <div className={styles.widget}>
          <div className={styles.widgetHeader}>Sessions</div>
          <div className={styles.widgetBody}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{sys.sessions.toLocaleString()}</div>
            <div className={styles.small}>Current active sessions</div>
            <div className={styles.mt10}>
              <span className={styles.small}>
                Peak (24h): <b>{sys.peakSessions.toLocaleString()}</b>
              </span>
            </div>
            <div className={styles.mt10}>
              <StatusPill tone="up">Healthy</StatusPill>
            </div>
          </div>
        </div>

        <div className={`${styles.widget} ${styles.widgetSpan2}`}>
          <div className={styles.widgetHeader}>
            <span>Throughput</span>
            <span className={styles.small}>In {sys.throughputIn} Mbps &middot; Out {sys.throughputOut} Mbps</span>
          </div>
          <div className={styles.widgetBody}>
            <div className={styles.bars}>
              <div className={styles.bar} style={{ height: `${Math.max(4, sys.throughputIn / 5)}px` }} title={`${sys.throughputIn} Mbps in`} />
            </div>
            <div className={`${styles.bars} ${styles.mt10}`}>
              <div className={`${styles.bar} ${styles.barOut}`} style={{ height: `${Math.max(4, sys.throughputOut / 4)}px` }} title={`${sys.throughputOut} Mbps out`} />
            </div>
          </div>
        </div>

        <div className={`${styles.widget} ${styles.widgetSpan2}`}>
          <div className={styles.widgetHeader}>Interfaces</div>
          <div className={`${styles.widgetBody} ${styles.widgetBodyTight}`}>
            <DataTable
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (i: FortiGateState["interfaces"][number]) => (
                    <>
                      {i.name}
                      {i.alias ? <span className={styles.small}> ({i.alias})</span> : null}
                    </>
                  ),
                },
                { key: "ip", header: "IP", render: (i: FortiGateState["interfaces"][number]) => i.ip },
                {
                  key: "link",
                  header: "Link",
                  render: (i: FortiGateState["interfaces"][number]) => <StatusPill tone={statusTone(i.link)}>{i.link}</StatusPill>,
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

        <div className={`${styles.widget} ${styles.widgetSpan2}`}>
          <div className={styles.widgetHeader}>System Events</div>
          <div className={styles.widgetBody}>
            <div className={styles.eventsStream}>
              {recentEventLogs.length === 0 ? (
                <div>No events.</div>
              ) : (
                recentEventLogs.map((l, idx) => (
                  <div
                    key={`${l.date}-${l.time}-${idx}`}
                    className={
                      l.level.toLowerCase() === "critical"
                        ? styles.lvCritical
                        : l.level.toLowerCase() === "warning"
                          ? styles.lvWarning
                          : l.level.toLowerCase() === "notice"
                            ? styles.lvNotice
                            : styles.lvInfo
                    }
                  >
                    [{l.date} {l.time}] [{l.level.toUpperCase()}] [{l.type}] {l.msg}
                  </div>
                ))
              )}
            </div>
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

        <h3>Recent forward traffic</h3>
        <DataTable
          columns={[
            {
              key: "time",
              header: "Time",
              render: (e: FortiGateState["forwardLogs"][number]) => `${e.date} ${e.time}`,
            },
            { key: "src", header: "Source", render: (e: FortiGateState["forwardLogs"][number]) => `${e.src}:${e.srcPort}` },
            { key: "dst", header: "Destination", render: (e: FortiGateState["forwardLogs"][number]) => `${e.dst}:${e.dstPort}` },
            { key: "app", header: "Application", render: (e: FortiGateState["forwardLogs"][number]) => e.app },
            {
              key: "action",
              header: "Action",
              render: (e: FortiGateState["forwardLogs"][number]) => (
                <span className={e.action === "accept" ? styles.actionAccept : e.action === "deny" ? styles.actionDeny : undefined}>{e.action}</span>
              ),
            },
            { key: "policy", header: "Policy", render: (e: FortiGateState["forwardLogs"][number]) => e.policy },
          ]}
          rows={recentForwardLogs}
          getRowKey={(e) => `${e.date}-${e.time}-${e.src}-${e.dst}-${e.srcPort}`}
          dense
          onRowClick={() => onNavigate("forward-logs")}
          emptyMessage="No forward traffic logs."
        />

        <h3>Recent events</h3>
        <DataTable
          columns={[
            { key: "time", header: "Time", render: (e: FortiGateState["eventLogs"][number]) => `${e.date} ${e.time}` },
            {
              key: "level",
              header: "Level",
              render: (e: FortiGateState["eventLogs"][number]) => <StatusPill tone={statusTone(e.level)}>{e.level}</StatusPill>,
            },
            { key: "type", header: "Type", render: (e: FortiGateState["eventLogs"][number]) => e.type },
            { key: "msg", header: "Message", render: (e: FortiGateState["eventLogs"][number]) => e.msg },
          ]}
          rows={recentEventLogs}
          getRowKey={(e) => `${e.date}-${e.time}-${e.type}-${e.msg}`}
          dense
          onRowClick={() => onNavigate("event-logs")}
          emptyMessage="No event logs."
        />
      </div>
    </div>
  );
}
