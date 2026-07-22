"use client";

// System Summary / device overview dashboard for the Cisco IOS WebUI
// simulator. Source equivalent is P['m-sysover'] (Monitor > Overview > System
// Summary, cisco-ui.js:1203-1258): device identity card, CPU gauge, memory
// gauge, environmental status, interface up/down/admin-down counts, and a
// recent-events mini log. This port keeps every one of those real stats and
// adds the Home/Overview conventions used by every other ported suite: a
// StatRow of headline numbers (derived from live counts, not fabricated) and
// a quick-links tile grid to key pages, wired through `onNavigate`.
//
// Every stat below is a genuine derived number computed from `state` at
// render time — nothing here is fabricated.

import type { CiscoState } from "@/lib/labs/simulators/network-cisco/types";
import type { CiscoPage } from "./cisco-shell";
import { DataTable, Gauge, StatRow, StatusPill, statusTone } from "./cisco-ui";
import styles from "./cisco-console.module.css";

type QuickLinkTile = { title: string; sub: string; page: CiscoPage };

// Consolidated-suite equivalent of source's per-module landing stubs —
// matches the Get-started-tiles convention every other ported suite's Home
// page uses.
const QUICK_LINK_TILES: QuickLinkTile[] = [
  { title: "Interfaces", sub: "Review link state, IP addressing, and traffic counters for every interface.", page: "interfaces" },
  { title: "Access Control Lists", sub: "Inspect ACL rules, hit counters, and interface bindings.", page: "acls" },
  { title: "Routing", sub: "Static routes, RIP, EIGRP, OSPF, and BGP configuration and neighbors.", page: "static-routes" },
  { title: "Diagnostics", sub: "Run ping and traceroute against any destination reachable from this device.", page: "ping-traceroute" },
];

// Severities that count as "active alerts" for the headline stat — mirrors
// standard syslog severity ordering (emergency=0 ... debug=7); anything at
// "error" (3) or more severe is surfaced, matching the porting brief.
const ALERTABLE_SEVERITIES = new Set(["emergency", "alert", "critical", "error"]);

export function OverviewPage({ state, onNavigate }: { state: CiscoState; onNavigate: (page: CiscoPage) => void }) {
  const d = state.device;
  const ifs = state.interfaces;

  let upCount = 0;
  let downCount = 0;
  let adminDownCount = 0;
  for (const f of ifs) {
    if (!f.adminUp) adminDownCount++;
    else if (f.lineUp) upCount++;
    else downCount++;
  }
  const loopbackCount = ifs.filter((f) => f.role === "loopback").length;

  const memPct = d.memTotal > 0 ? Math.round((d.memUsed / d.memTotal) * 100) : 0;

  const activeAlertCount = state.syslog.entries.filter((e) => ALERTABLE_SEVERITIES.has(e.severity.toLowerCase())).length;
  const activeTunnelCount = state.ipsecTunnels.filter((t) => t.state.toLowerCase() === "active").length;
  const bgpEstablishedCount = state.bgpConfig.neighbors.filter((n) => n.state.toLowerCase() === "established").length;
  const ospfFullCount = state.ospfNeighbors.filter((n) => n.state.toLowerCase() === "full").length;
  const eigrpNeighborCount = state.eigrpNeighbors.length;

  const recentSyslog = state.syslog.entries.slice(0, 10);
  const recentRoutingEvents = state.routingEvents.slice(0, 8);

  return (
    <div>
      <div className={styles.crumb}>
        {d.hostname} &nbsp;&rsaquo;&nbsp; <b>System Summary</b>
      </div>
      <h1 className={styles.pageH}>System Summary</h1>

      <StatRow
        stats={[
          { label: "Model / IOS", value: d.model, sub: `IOS XE ${d.iosVersion}`, onClick: () => onNavigate("device-info") },
          { label: "Uptime", value: d.uptime.split(",").slice(0, 2).join(","), sub: d.bootReason, onClick: () => onNavigate("device-info") },
          { label: "CPU (5 sec)", value: `${d.cpu5sec}%`, sub: `1min ${d.cpu1min}% · 5min ${d.cpu5min}%`, onClick: () => onNavigate("environment") },
          { label: "Memory used", value: `${memPct}%`, sub: `${d.memUsed.toLocaleString()} / ${d.memTotal.toLocaleString()} KB`, onClick: () => onNavigate("environment") },
          {
            label: "Interfaces",
            value: `${upCount} / ${ifs.length}`,
            sub: `${downCount} down · ${adminDownCount} admin-down`,
            onClick: () => onNavigate("interfaces"),
          },
          {
            label: "Active alerts",
            value: activeAlertCount,
            sub: activeAlertCount > 0 ? "needs attention" : "all clear",
            onClick: () => onNavigate("syslog"),
          },
          {
            label: "IPsec tunnels active",
            value: `${activeTunnelCount} / ${state.ipsecTunnels.length}`,
            onClick: () => onNavigate("ipsec-tunnels"),
          },
          {
            label: "Routing neighbors",
            value: bgpEstablishedCount + ospfFullCount + eigrpNeighborCount,
            sub: `BGP ${bgpEstablishedCount} · OSPF ${ospfFullCount} · EIGRP ${eigrpNeighborCount}`,
            onClick: () => onNavigate("bgp"),
          },
        ]}
      />

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>Device</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>Hostname</dt>
              <dd>{d.hostname}</dd>
              <dt>Model</dt>
              <dd>{d.model}</dd>
              <dt>IOS Version</dt>
              <dd>{d.iosVersion}</dd>
              <dt>Image</dt>
              <dd className={styles.mono}>{d.iosImage}</dd>
              <dt>Serial</dt>
              <dd className={styles.mono}>{d.serial}</dd>
              <dt>Uptime</dt>
              <dd>{d.uptime}</dd>
              <dt>Location</dt>
              <dd>{d.location}</dd>
              <dt>Boot Reason</dt>
              <dd>{d.bootReason}</dd>
              <dt>Config Register</dt>
              <dd className={styles.mono}>{d.configRegister}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>CPU Utilization</div>
          <div className={styles.cardBody} style={{ textAlign: "center" }}>
            <Gauge value={d.cpu5sec} color="#005073" />
            <div className={`${styles.small} ${styles.mt10}`}>5sec {d.cpu5sec}% · 1min {d.cpu1min}% · 5min {d.cpu5min}%</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Memory Utilization</div>
          <div className={styles.cardBody} style={{ textAlign: "center" }}>
            <Gauge value={memPct} color="#2e8540" />
            <div className={`${styles.small} ${styles.mt10}`}>
              Used: {d.memUsed.toLocaleString()} KB of {d.memTotal.toLocaleString()} KB
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Environmental</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>System Temp</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.tempSystem}</StatusPill>
              </dd>
              <dt>CPU Temp</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.tempCpu}</StatusPill>
              </dd>
              <dt>Fans</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.fanStatus}</StatusPill>
              </dd>
              <dt>Power Supplies</dt>
              <dd>
                <StatusPill tone={statusTone("up")}>{d.powerSupply}</StatusPill>
              </dd>
              <dt>Sys Time</dt>
              <dd>{d.systemTime}</dd>
              <dt>Timezone</dt>
              <dd>{d.timezone}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Interfaces</div>
          <div className={styles.cardBody}>
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <StatusPill tone="up">{upCount} Up</StatusPill> <StatusPill tone="down">{downCount} Down</StatusPill>{" "}
              <StatusPill tone="muted">{adminDownCount} Admin-Down</StatusPill>
            </div>
            <div className={`${styles.mt10} ${styles.small}`}>
              Total: {ifs.length} ({loopbackCount} loopbacks)
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Recent Events</div>
          <div className={styles.cardBody}>
            <div className={styles.logViewer}>
              {recentSyslog.length === 0 ? (
                <div className={styles.small}>No syslog entries.</div>
              ) : (
                recentSyslog.map((s) => (
                  <div key={s.seq} className={`ln ${s.severity.toLowerCase()}`}>
                    [{s.ts.slice(11)}] {s.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.crumb} style={{ marginTop: 4 }}>
        Quick links
      </div>
      <div className={styles.grid2}>
        {QUICK_LINK_TILES.map((tile) => (
          <div key={tile.page} className={styles.card} style={{ cursor: "pointer", marginBottom: 0 }} onClick={() => onNavigate(tile.page)}>
            <div className={styles.cardBody}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{tile.title}</div>
              <div className={styles.small}>{tile.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Recent syslog</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable
            columns={[
              { key: "ts", header: "Time", render: (e: CiscoState["syslog"]["entries"][number]) => e.ts },
              {
                key: "severity",
                header: "Severity",
                render: (e: CiscoState["syslog"]["entries"][number]) => <StatusPill tone={ALERTABLE_SEVERITIES.has(e.severity.toLowerCase()) ? "down" : "info"}>{e.severity}</StatusPill>,
              },
              { key: "facility", header: "Facility", render: (e: CiscoState["syslog"]["entries"][number]) => e.facility },
              { key: "mnemonic", header: "Mnemonic", render: (e: CiscoState["syslog"]["entries"][number]) => e.mnemonic },
              { key: "message", header: "Message", render: (e: CiscoState["syslog"]["entries"][number]) => e.message },
            ]}
            rows={recentSyslog}
            getRowKey={(e) => String(e.seq)}
            dense
            emptyMessage="No syslog entries."
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Recent routing events</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable
            columns={[
              { key: "ts", header: "Time", render: (e: CiscoState["routingEvents"][number]) => e.ts },
              { key: "proto", header: "Protocol", render: (e: CiscoState["routingEvents"][number]) => e.proto },
              { key: "event", header: "Event", render: (e: CiscoState["routingEvents"][number]) => e.event },
              { key: "detail", header: "Detail", render: (e: CiscoState["routingEvents"][number]) => e.detail },
            ]}
            rows={recentRoutingEvents}
            getRowKey={(e) => `${e.ts}-${e.proto}-${e.event}-${e.detail}`}
            dense
            emptyMessage="No routing events."
          />
        </div>
      </div>
    </div>
  );
}
