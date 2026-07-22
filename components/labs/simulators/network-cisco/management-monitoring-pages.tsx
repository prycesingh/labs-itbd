"use client";

// Management / Monitoring page group for the Cisco IOS WebUI simulator.
// Ports source's (itbd-lab/simulators/network/js/cisco-ui.js) Additional
// Tasks > Router Access (`P['a-router-acc']`, line 1115-1130), Additional
// Tasks > File System Management (`P['a-files']`, line 1184-1194), Unified
// Communications > Voice (`P['uc-voice']`, line 1029-1037), Wireless > Radio
// Settings + AP/SSID Configuration (`P['wl-radio']`/`P['wl-ap']`, line
// 1075-1096), Monitor > Logging > Syslog Buffer (`P['m-syslog']`, line
// 1473-1501, plus `CU._clearSyslog`, line 3041-3048), Monitor > Firewall
// Status (`P['m-fwstatus']`, line 1379-1395 — dashboard summary portion
// only, the connection-table sample rows are a fabricated live-demo table
// not real seeded state so are intentionally NOT ported), Monitor > Traffic
// Status / Top Talkers (`P['m-traffic']`, line 1443-1454), Monitor > Logging
// > AAA Logs (`P['m-aaalogs']`, line 1524-1536), and Monitor > Logging >
// Routing Events (`P['m-rtevents']`, line 1537-1548).
//
// All nine pages here are read-only summaries/tables over real seeded
// CiscoState — per the porting brief, no new reducer actions are invented
// for HTTPS/SSH/Telnet/VTY, files, voice, wireless, top-talkers,
// firewall-stats, AAA-events, or routing-events (source itself never wired a
// save handler for most of these either — `a-router-acc`'s "Apply" button is
// just a toast in source, no `CiscoData.save()` call). The one exception is
// syslog: source's real `CU._clearSyslog()` (confirm() + splice + save +
// toast) maps 1:1 onto the reducer's existing `CLEAR_SYSLOG` action, wired
// here with a `sonner` toast instead of `confirm()`/inline toast.

import { useMemo, useState } from "react";

import type { CiscoState, CiscoSyslogEntry } from "@/lib/labs/simulators/network-cisco/types";
import type { CiscoAction } from "@/lib/labs/simulators/network-cisco/reducer";
import { toast } from "sonner";
import { DataTable, StatRow, StatusPill, statusTone, exportCsv, type DataTableColumn } from "./cisco-ui";
import styles from "./cisco-console.module.css";

type PageDispatchProps = { state: CiscoState; dispatch: React.Dispatch<CiscoAction> };

// Human-readable byte formatter — ports source's `H.fmtBytes()` helper
// (cisco-ui.js line 167-172) exactly: <1024 B raw, <1MB in KB (1 decimal),
// <1GB in MB (2 decimals), else GB (2 decimals). Not exposed on the shared
// cisco-ui.tsx primitives suite (grepped: no fmtBytes/fmtRate there), so it's
// reproduced locally here for FilesPage.
function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(2)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

// ===================================================================
// 1. HttpsSshPage — Configure > Additional Tasks > Router Access
// (source P['a-router-acc']). Read-only summary of management-plane access:
// HTTP/HTTPS server, SSH, Telnet (shown disabled/warning-toned since
// disabled-by-default IS the secure state — matches source's own comment
// "(insecure - disabled by default)"), and VTY line config.
// ===================================================================
export function HttpsSshPage({ state }: { state: CiscoState }) {
  const h = state.httpsServer;
  const s = state.sshConfig;
  const t = state.telnetConfig;
  const v = state.vtyLines;

  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Additional Tasks &nbsp;&rsaquo;&nbsp; <b>HTTPS / SSH / Telnet</b>
      </div>
      <h1 className={styles.pageH}>Router Access</h1>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>HTTP / HTTPS Server</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>HTTP Server</dt>
              <dd>
                <StatusPill tone={h.http ? "up" : "muted"}>{h.http ? "enabled" : "disabled"}</StatusPill>
              </dd>
              <dt>HTTPS Server</dt>
              <dd>
                <StatusPill tone={h.https ? "up" : "muted"}>{h.https ? "enabled" : "disabled"}</StatusPill>
              </dd>
              <dt>HTTP Port</dt>
              <dd>{h.port}</dd>
              <dt>SSL Port</dt>
              <dd>{h.sslPort}</dd>
              <dt>AAA Authentication List</dt>
              <dd className={styles.mono}>{h.aaaAuthList}</dd>
              <dt>Access-Class</dt>
              <dd className={styles.mono}>{h.acl || "--"}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>SSH</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>SSH Server</dt>
              <dd>
                <StatusPill tone={s.enabled ? "up" : "muted"}>{s.enabled ? "enabled" : "disabled"}</StatusPill>
              </dd>
              <dt>Version</dt>
              <dd>SSHv{s.version}</dd>
              <dt>Crypto Key Size</dt>
              <dd>{s.cryptoKeyBits} bits</dd>
              <dt>Timeout</dt>
              <dd>{s.timeout}s</dd>
              <dt>Auth Retries</dt>
              <dd>{s.retries}</dd>
              <dt>Access-Class</dt>
              <dd className={styles.mono}>{s.acl || "--"}</dd>
            </dl>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Telnet</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>Telnet Server</dt>
              <dd>
                {/* Disabled telnet is the secure default — warn-toned when it
                    is ever enabled, muted (not "down"/red) when disabled since
                    disabled is the desired state, not a fault. */}
                <StatusPill tone={t.enabled ? "warn" : "muted"}>{t.enabled ? "enabled" : "disabled"}</StatusPill>
              </dd>
            </dl>
            <div className={styles.small}>Telnet is insecure and disabled by default on this device.</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>VTY Lines</div>
          <div className={styles.cardBody}>
            <dl className={styles.kv}>
              <dt>Line Range</dt>
              <dd>vty {v.range}</dd>
              <dt>Transport Input</dt>
              <dd className={styles.mono}>{v.transport}</dd>
              <dt>Exec Timeout</dt>
              <dd>{v.execTimeout}</dd>
              <dt>Access-Class (in)</dt>
              <dd className={styles.mono}>{v.accessClass || "--"}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 2. SyslogPage — Monitor > Logging > Syslog Buffer (source P['m-syslog'] +
// CU._clearSyslog). Buffer/console/monitor/trap levels + trap servers, full
// entries table (newest first — source's array is already unshift-ordered
// newest-first via seedSyslog()/appendSyslog(), so no extra sort needed),
// optional local severity filter, Clear + CSV export.
// ===================================================================
const SEVERITY_ORDER = ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"];

function severityTone(sev: string): "down" | "warn" | "info" | "muted" {
  const s = sev.toLowerCase();
  if (s === "emergency" || s === "alert" || s === "critical" || s === "error") return "down";
  if (s === "warning") return "warn";
  if (s === "notice" || s === "info") return "info";
  return "muted";
}

export function SyslogPage({ state, dispatch }: PageDispatchProps) {
  const { syslog } = state;
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const availableSeverities = useMemo(() => {
    const set = new Set(syslog.entries.map((e) => e.severity.toLowerCase()));
    return SEVERITY_ORDER.filter((s) => set.has(s));
  }, [syslog.entries]);

  const filteredEntries = useMemo(
    () => (severityFilter === "all" ? syslog.entries : syslog.entries.filter((e) => e.severity.toLowerCase() === severityFilter)),
    [syslog.entries, severityFilter],
  );

  const handleClear = () => {
    dispatch({ type: "CLEAR_SYSLOG" });
    toast.success("Logging buffer cleared");
  };

  const handleExport = () => {
    exportCsv(
      "syslog-buffer.csv",
      ["Timestamp", "Severity", "Facility", "Mnemonic", "Message"],
      filteredEntries.map((e) => [e.ts, e.severity, e.facility, e.mnemonic, e.message]),
    );
    toast.success("Syslog buffer exported");
  };

  const columns: DataTableColumn<CiscoSyslogEntry>[] = [
    { key: "ts", header: "Timestamp", render: (e) => <span className={styles.mono}>{e.ts}</span> },
    { key: "severity", header: "Severity", render: (e) => <StatusPill tone={severityTone(e.severity)}>{e.severity}</StatusPill> },
    { key: "facility", header: "Facility", render: (e) => e.facility },
    { key: "mnemonic", header: "Mnemonic", render: (e) => e.mnemonic },
    { key: "message", header: "Message", render: (e) => e.message },
  ];

  return (
    <div>
      <div className={styles.crumb}>
        Monitor &nbsp;&rsaquo;&nbsp; Logging &nbsp;&rsaquo;&nbsp; <b>Syslog Buffer</b>
      </div>
      <h1 className={styles.pageH}>Syslog Buffer (logging buffered)</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Logging Levels</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Buffer Size</dt>
            <dd>{syslog.bufferSize.toLocaleString()} bytes</dd>
            <dt>Buffer Level</dt>
            <dd>{syslog.bufferLevel}</dd>
            <dt>Console Level</dt>
            <dd>{syslog.consoleLevel}</dd>
            <dt>Monitor Level</dt>
            <dd>{syslog.monitorLevel}</dd>
            <dt>Trap Level</dt>
            <dd>{syslog.trapLevel}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Logging Hosts</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable
            columns={[
              { key: "host", header: "Host", render: (r: CiscoState["syslog"]["servers"][number]) => <span className={styles.mono}>{r.host}</span> },
              { key: "vrf", header: "VRF", render: (r: CiscoState["syslog"]["servers"][number]) => r.vrf || "--" },
              { key: "source", header: "Source Interface", render: (r: CiscoState["syslog"]["servers"][number]) => r.source },
            ]}
            rows={syslog.servers}
            getRowKey={(r) => r.host}
            dense
            emptyMessage="No logging hosts configured."
          />
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.small}>
          {filteredEntries.length} of {syslog.entries.length} entries
        </span>
        {availableSeverities.length > 0 ? (
          <select
            className={styles.select}
            style={{ width: 160 }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">All severities</option>
            {availableSeverities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
        <div className={styles.toolbarSpacer} />
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleClear}>
          Clear Logging
        </button>
      </div>

      <DataTable columns={columns} rows={filteredEntries} getRowKey={(e) => String(e.seq)} emptyMessage="No syslog entries." />
    </div>
  );
}

// ===================================================================
// 3. FilesPage — Configure/Maintenance > Additional Tasks > File System
// Management (source P['a-files']). Read-only directory listing of
// flash: files.
// ===================================================================
export function FilesPage({ state }: { state: CiscoState }) {
  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Additional Tasks &nbsp;&rsaquo;&nbsp; <b>File System Management</b>
      </div>
      <h1 className={styles.pageH}>File System Management</h1>
      <div className={`${styles.small} ${styles.mb10}`}>
        Directory of <span className={styles.mono}>flash:</span>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name", render: (f: CiscoState["files"][number]) => <span className={styles.mono}>{f.name}</span> },
          { key: "size", header: "Size", render: (f: CiscoState["files"][number]) => fmtBytes(f.size) },
          { key: "type", header: "Type", render: (f: CiscoState["files"][number]) => f.type },
          { key: "date", header: "Modified", render: (f: CiscoState["files"][number]) => f.date },
        ]}
        rows={state.files}
        getRowKey={(f) => f.name}
        emptyMessage="No files found on flash:."
      />
    </div>
  );
}

// ===================================================================
// 4. VoicePage — Configure > Unified Communications > Voice (source
// P['uc-voice']). Read-only voice gateway summary.
// ===================================================================
export function VoicePage({ state }: { state: CiscoState }) {
  const v = state.voiceConfig;
  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Unified Communications &nbsp;&rsaquo;&nbsp; <b>Voice & Telephony</b>
      </div>
      <h1 className={styles.pageH}>Voice</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Voice Gateway</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Call Manager</dt>
            <dd>{v.callManager}</dd>
            <dt>Dial-Peers</dt>
            <dd>{v.dialPeers}</dd>
            <dt>Registered Phones</dt>
            <dd>{v.phones}</dd>
            <dt>Gateway</dt>
            <dd>
              <StatusPill tone={statusTone(v.gateway)}>{v.gateway}</StatusPill>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 5. WirelessPage — Configure > Wireless > Radio, AP & SSID Configuration
// (source P['wl-radio'] + P['wl-ap'], consolidated onto one page matching
// the CiscoShell nav's single "wireless" leaf). Read-only radios + SSIDs.
// ===================================================================
export function WirelessPage({ state }: { state: CiscoState }) {
  const w = state.wirelessConfig;
  return (
    <div>
      <div className={styles.crumb}>
        Configure &nbsp;&rsaquo;&nbsp; Wireless &nbsp;&rsaquo;&nbsp; <b>Radio, AP & SSID Configuration</b>
      </div>
      <h1 className={styles.pageH}>Wireless</h1>

      <div className={`${styles.small} ${styles.mb10}`}>
        Country: <b>{w.country}</b>
      </div>

      <h3>Radio Settings</h3>
      <DataTable
        columns={[
          { key: "id", header: "Radio", render: (r: CiscoState["wirelessConfig"]["radios"][number]) => `Radio ${r.id}` },
          { key: "band", header: "Band", render: (r: CiscoState["wirelessConfig"]["radios"][number]) => r.band },
          { key: "channel", header: "Channel", render: (r: CiscoState["wirelessConfig"]["radios"][number]) => `Ch ${r.channel}` },
          { key: "power", header: "Tx Power", render: (r: CiscoState["wirelessConfig"]["radios"][number]) => `${r.power} dBm` },
          {
            key: "status",
            header: "Status",
            render: (r: CiscoState["wirelessConfig"]["radios"][number]) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill>,
          },
        ]}
        rows={w.radios}
        getRowKey={(r) => String(r.id)}
        emptyMessage="No radios configured."
      />

      <h3>AP / SSID Configuration</h3>
      <DataTable
        columns={[
          { key: "name", header: "SSID", render: (s: CiscoState["wirelessConfig"]["ssids"][number]) => s.name },
          { key: "vlan", header: "VLAN", render: (s: CiscoState["wirelessConfig"]["ssids"][number]) => s.vlan },
          { key: "security", header: "Security", render: (s: CiscoState["wirelessConfig"]["ssids"][number]) => s.security },
          { key: "clients", header: "Clients", render: (s: CiscoState["wirelessConfig"]["ssids"][number]) => s.clients },
        ]}
        rows={w.ssids}
        getRowKey={(s) => s.name}
        emptyMessage="No SSIDs configured."
      />
    </div>
  );
}

// ===================================================================
// 6. TopTalkersPage — Monitor > Traffic > Traffic Status / Top Talkers
// (source P['m-traffic']). Read-only top-talkers table. Source rendered an
// inline `%`-width colored bar per row (`t.pct * 4`px) alongside the percent
// text — reproduced here as a lightweight inline bar (layout-only inline
// style, per cisco-ui.tsx's "minor one-off style={{}} for computed
// bar/gauge/sparkline fills" convention) since DataTableColumn has no
// dedicated bar-cell primitive.
// ===================================================================
export function TopTalkersPage({ state }: { state: CiscoState }) {
  return (
    <div>
      <div className={styles.crumb}>
        Monitor &nbsp;&rsaquo;&nbsp; Traffic &nbsp;&rsaquo;&nbsp; <b>Traffic Status / Top Talkers</b>
      </div>
      <h1 className={styles.pageH}>Traffic Status / Top Talkers</h1>

      <DataTable
        columns={[
          { key: "src", header: "Source", render: (t: CiscoState["topTalkers"][number]) => <span className={styles.mono}>{t.src}</span> },
          { key: "app", header: "Application", render: (t: CiscoState["topTalkers"][number]) => t.app },
          { key: "pkts", header: "Packets", render: (t: CiscoState["topTalkers"][number]) => t.pkts.toLocaleString() },
          { key: "bytes", header: "Bytes", render: (t: CiscoState["topTalkers"][number]) => t.bytes },
          {
            key: "pct",
            header: "% of WAN",
            render: (t: CiscoState["topTalkers"][number]) => (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ background: "#005073", height: 10, width: t.pct * 4, borderRadius: 2 }} />
                <span>{t.pct}%</span>
              </div>
            ),
          },
        ]}
        rows={state.topTalkers}
        getRowKey={(t) => t.src}
        emptyMessage="No traffic samples available."
      />
    </div>
  );
}

// ===================================================================
// 7. FirewallStatsPage — Monitor > Security > Firewall Status (source
// P['m-fwstatus'] — the real seeded-summary portion only; source's
// "Connection Table (sample)" below it is generated on the fly from a
// pure `i => 10.10.0.(45+i)` formula with no backing state field, so per the
// porting brief's "render as real read-only views over real seeded state"
// constraint it is intentionally NOT reproduced here).
// ===================================================================
export function FirewallStatsPage({ state }: { state: CiscoState }) {
  const fw = state.firewallStats;
  return (
    <div>
      <div className={styles.crumb}>
        Monitor &nbsp;&rsaquo;&nbsp; Security &nbsp;&rsaquo;&nbsp; <b>Firewall Status</b>
      </div>
      <h1 className={styles.pageH}>Firewall Status</h1>

      <StatRow
        stats={[
          { label: "Active Sessions", value: fw.activeSessions.toLocaleString() },
          { label: "Half-Open", value: fw.halfOpen.toLocaleString() },
          { label: "Dropped Packets (24h)", value: fw.droppedPkts.toLocaleString() },
        ]}
      />

      <div className={styles.card}>
        <div className={styles.cardHeader}>Inspect Engine</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Active Sessions</dt>
            <dd>
              <b>{fw.activeSessions.toLocaleString()}</b>
            </dd>
            <dt>Half-Open</dt>
            <dd>{fw.halfOpen.toLocaleString()}</dd>
            <dt>Drops (24h)</dt>
            <dd>{fw.droppedPkts.toLocaleString()}</dd>
            <dt>Policy</dt>
            <dd className={styles.mono}>{fw.policy}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 8. AaaEventsPage — Monitor > Logging > AAA Logs (source P['m-aaalogs']).
// Read-only AAA authentication event log, newest first (source's
// seedAaaEvents() is already newest-first via increasing offsetMs per
// index), with CSV export.
// ===================================================================
export function AaaEventsPage({ state }: { state: CiscoState }) {
  const handleExport = () => {
    exportCsv(
      "aaa-logs.csv",
      ["Timestamp", "User", "Source", "Method", "Server", "Result", "Reason"],
      state.aaaEvents.map((e) => [e.ts, e.user, e.source, e.method, e.server, e.result, e.reason]),
    );
    toast.success("AAA logs exported");
  };

  return (
    <div>
      <div className={styles.crumb}>
        Monitor &nbsp;&rsaquo;&nbsp; Logging &nbsp;&rsaquo;&nbsp; <b>AAA Logs</b>
      </div>
      <h1 className={styles.pageH}>AAA Logs</h1>

      <div className={styles.toolbar}>
        <span className={styles.small}>{state.aaaEvents.length} events</span>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      <DataTable
        columns={[
          { key: "ts", header: "Timestamp", render: (e: CiscoState["aaaEvents"][number]) => <span className={styles.mono}>{e.ts}</span> },
          { key: "user", header: "User", render: (e: CiscoState["aaaEvents"][number]) => e.user },
          { key: "source", header: "Source", render: (e: CiscoState["aaaEvents"][number]) => <span className={styles.mono}>{e.source}</span> },
          { key: "method", header: "Method", render: (e: CiscoState["aaaEvents"][number]) => e.method },
          { key: "server", header: "Server", render: (e: CiscoState["aaaEvents"][number]) => e.server },
          {
            key: "result",
            header: "Result",
            render: (e: CiscoState["aaaEvents"][number]) => <StatusPill tone={e.result === "FAILED" ? "down" : "up"}>{e.result}</StatusPill>,
          },
          { key: "reason", header: "Reason", render: (e: CiscoState["aaaEvents"][number]) => e.reason },
        ]}
        rows={state.aaaEvents}
        getRowKey={(e) => `${e.ts}-${e.user}-${e.source}`}
        emptyMessage="No AAA events recorded."
      />
    </div>
  );
}

// ===================================================================
// 9. RoutingEventsPage — Monitor > Logging > Routing Events (source
// P['m-rtevents']). Read-only routing protocol event log, newest first
// (source's seedRoutingEvents() is already newest-first), with CSV export.
// ===================================================================
export function RoutingEventsPage({ state }: { state: CiscoState }) {
  const handleExport = () => {
    exportCsv(
      "routing-events.csv",
      ["Timestamp", "Protocol", "Event", "Detail"],
      state.routingEvents.map((e) => [e.ts, e.proto, e.event, e.detail]),
    );
    toast.success("Routing events exported");
  };

  return (
    <div>
      <div className={styles.crumb}>
        Monitor &nbsp;&rsaquo;&nbsp; Logging &nbsp;&rsaquo;&nbsp; <b>Routing Events</b>
      </div>
      <h1 className={styles.pageH}>Routing Events</h1>

      <div className={styles.toolbar}>
        <span className={styles.small}>{state.routingEvents.length} events</span>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      <DataTable
        columns={[
          { key: "ts", header: "Timestamp", render: (e: CiscoState["routingEvents"][number]) => <span className={styles.mono}>{e.ts}</span> },
          { key: "proto", header: "Protocol", render: (e: CiscoState["routingEvents"][number]) => e.proto },
          {
            key: "event",
            header: "Event",
            render: (e: CiscoState["routingEvents"][number]) => {
              const tone = e.event.includes("FAIL") ? "down" : e.event === "ADJCHANGE" || e.event === "ADJCHG" || e.event === "NBRCHANGE" ? "info" : "warn";
              return <StatusPill tone={tone}>{e.event}</StatusPill>;
            },
          },
          { key: "detail", header: "Detail", render: (e: CiscoState["routingEvents"][number]) => e.detail },
        ]}
        rows={state.routingEvents}
        getRowKey={(e) => `${e.ts}-${e.proto}-${e.event}-${e.detail}`}
        emptyMessage="No routing events recorded."
      />
    </div>
  );
}
