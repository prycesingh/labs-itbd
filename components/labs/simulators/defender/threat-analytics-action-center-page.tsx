"use client";

// Threat analytics + Action center — ported from defender-portal.js
// renderThreatAnalytics()/renderThreatFlyout()/openThreat()/toggleThreatSubscribe()
// and renderActionCenter()/_approveAction()/_rejectAction(). Two independent
// page components (both routed from DefenderPage: "threat-analytics" and
// "action-center") sharing this file per the task spec.
//
// Threat analytics: 8 seeded threats, row click opens a 6-tab Flyout. The
// Analyst report and Mitigations tabs port the source's category/name string-
// matching branches verbatim (checking for "phish"/"ransomware" in the threat
// name to select different prose) — this is real branching logic on seed
// data, not fabricated content. Read/subscribed state lives in
// state.threatAnalyticsRead / state.threatAnalyticsSubscriptions (arrays of
// ids) and is toggled via the reducer's MARK_THREAT_ANALYTIC_READ /
// TOGGLE_THREAT_ANALYTIC_SUBSCRIPTION actions.
//
// Action center: Pending / History sub-tabs. Approve dispatches
// APPROVE_PENDING_ACTION directly (mirrors source's immediate execute+move).
// Reject prompts for a reason via window.prompt, matching source's
// `_rejectAction` flow exactly (cancel on null, otherwise move to history
// with the reason attached) before dispatching REJECT_PENDING_ACTION.

import { useState } from "react";
import { toast } from "sonner";

import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import type { DefenderPendingAction, DefenderState, DefenderThreatAnalytic } from "@/lib/labs/simulators/defender/types";
import { DataTable, EmptyState, Flyout, SeverityBadge, StatRow, StatusPill, SubTabBar, statusTone, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)} sec ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
}

// ============================================================================
// Threat analytics
// ============================================================================

type ThreatTab = "overview" | "analyst" | "incidents" | "assets" | "mitigations" | "queries";

const THREAT_TABS: { key: ThreatTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analyst", label: "Analyst report" },
  { key: "incidents", label: "Related incidents" },
  { key: "assets", label: "Impacted assets" },
  { key: "mitigations", label: "Mitigations" },
  { key: "queries", label: "Endpoint queries" },
];

export function ThreatAnalyticsPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<ThreatTab>("overview");

  const unread = state.threatAnalytics.filter((t) => !state.threatAnalyticsRead.includes(t.id)).length;
  const withAlerts = state.threatAnalytics.filter((t) => t.alertsCount > 0).length;
  const subscribed = state.threatAnalyticsSubscriptions.length;

  function openThreat(t: DefenderThreatAnalytic) {
    setTab("overview");
    setOpenId(t.id);
    if (!state.threatAnalyticsRead.includes(t.id)) {
      dispatch({ type: "MARK_THREAT_ANALYTIC_READ", id: t.id });
    }
  }

  const active = openId ? state.threatAnalytics.find((t) => t.id === openId) ?? null : null;

  const columns: DataTableColumn<DefenderThreatAnalytic>[] = [
    { key: "severity", header: "Severity", render: (t) => <SeverityBadge severity={t.severity} /> },
    {
      key: "name",
      header: "Threat",
      render: (t) => {
        const read = state.threatAnalyticsRead.includes(t.id);
        const sub = state.threatAnalyticsSubscriptions.includes(t.id);
        return (
          <span>
            {!read ? (
              <span
                title="Unread"
                style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#0078d4", marginRight: 6 }}
              />
            ) : null}
            <b className={styles.rowLink}>{t.name}</b>
            {sub ? (
              <span style={{ marginLeft: 6 }}>
                <StatusPill tone="info">Subscribed</StatusPill>
              </span>
            ) : null}
          </span>
        );
      },
    },
    { key: "category", header: "Type", render: (t) => t.category },
    { key: "exposureLevel", header: "Exposure", render: (t) => t.exposureLevel },
    { key: "alertsCount", header: "Active alerts", render: (t) => t.alertsCount },
    { key: "impactedAssets", header: "Impacted assets", render: (t) => t.impactedAssets },
    { key: "lastUpdated", header: "Last updated", render: (t) => timeAgo(t.lastUpdated) },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a> / <a>Threat analytics</a>
      </div>
      <div className={styles.pageH1}>Threat analytics</div>
      <div className={styles.pageSub}>
        Microsoft research on threat actors, campaigns, and CVEs affecting your environment. Click any threat for the
        full analyst report.
      </div>

      <StatRow
        stats={[
          { label: "Threats tracked", value: state.threatAnalytics.length },
          { label: "Unread", value: unread },
          { label: "With active alerts", value: withAlerts },
          { label: "Subscribed", value: subscribed },
        ]}
      />

      <DataTable columns={columns} rows={state.threatAnalytics} getRowKey={(t) => t.id} onRowClick={openThreat} emptyMessage="No threats tracked." />

      {active ? (
        <Flyout
          title={active.name}
          subtitle={
            <span>
              <SeverityBadge severity={active.severity} /> &middot; {active.category} &middot; Exposure: <b>{active.exposureLevel}</b> &middot;{" "}
              {active.alertsCount} active alert{active.alertsCount === 1 ? "" : "s"} &middot; Updated {timeAgo(active.lastUpdated)}
            </span>
          }
          onClose={() => setOpenId(null)}
          tabs={<SubTabBar tabs={THREAT_TABS} active={tab} onChange={(key) => setTab(key as ThreatTab)} />}
        >
          <ThreatActionsRow state={state} dispatch={dispatch} threat={active} />
          <ThreatTabBody tab={tab} state={state} threat={active} />
        </Flyout>
      ) : null}
    </div>
  );
}

function ThreatActionsRow({ state, dispatch, threat }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction>; threat: DefenderThreatAnalytic }) {
  const subscribed = state.threatAnalyticsSubscriptions.includes(threat.id);

  function toggleSubscribe() {
    dispatch({ type: "TOGGLE_THREAT_ANALYTIC_SUBSCRIPTION", id: threat.id });
    toast.success(subscribed ? "Unsubscribed." : "Subscribed — you will be notified by email when exposure changes.");
  }

  function exportReport() {
    toast.info("Analyst report queued — download will be available in your Microsoft 365 admin notifications.");
  }

  return (
    <div style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" className={`${styles.btn} ${subscribed ? "" : styles.btnPrimary}`} onClick={toggleSubscribe}>
        {subscribed ? "✓ Subscribed (click to unsubscribe)" : "+ Notify me when exposure changes"}
      </button>
      <button type="button" className={styles.btn} onClick={exportReport}>
        Download analyst report (PDF)
      </button>
    </div>
  );
}

function ThreatTabBody({ tab, state, threat }: { tab: ThreatTab; state: DefenderState; threat: DefenderThreatAnalytic }) {
  switch (tab) {
    case "analyst":
      return <ThreatAnalystReport threat={threat} />;
    case "incidents":
      return <ThreatRelatedIncidents state={state} threat={threat} />;
    case "assets":
      return <ThreatImpactedAssets state={state} threat={threat} />;
    case "mitigations":
      return <ThreatMitigations threat={threat} />;
    case "queries":
      return <ThreatEndpointQueries />;
    case "overview":
    default:
      return <ThreatOverview threat={threat} />;
  }
}

function ThreatOverview({ threat }: { threat: DefenderThreatAnalytic }) {
  const lead =
    threat.category === "Threat actor"
      ? "This actor uses "
      : threat.category === "Vulnerability"
        ? "This vulnerability is being exploited in "
        : "This activity profile maps to ";
  const tail = threat.alertsCount > 0 ? "active alerts in your tenant" : "tactics observed broadly across the threat landscape";
  const exposureNote =
    threat.exposureLevel === "High"
      ? "urgent attention required"
      : threat.exposureLevel === "Medium"
        ? "review mitigations within 7 days"
        : "monitor; no immediate action";

  return (
    <div>
      <h3 className={styles.h3}>Summary</h3>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        Microsoft Threat Intelligence has been tracking <b>{threat.name}</b> for the past several months. {lead}
        {tail}.
      </p>
      <div className={styles.tableWrap} style={{ marginTop: 14 }}>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td style={{ color: "#605e5c", width: 200 }}>Threat type</td>
              <td>{threat.category}</td>
            </tr>
            <tr>
              <td style={{ color: "#605e5c" }}>Severity</td>
              <td>
                <SeverityBadge severity={threat.severity} />
              </td>
            </tr>
            <tr>
              <td style={{ color: "#605e5c" }}>Exposure level</td>
              <td>
                {threat.exposureLevel} &mdash; {exposureNote}
              </td>
            </tr>
            <tr>
              <td style={{ color: "#605e5c" }}>Active alerts in your tenant</td>
              <td>
                <b>{threat.alertsCount}</b>
              </td>
            </tr>
            <tr>
              <td style={{ color: "#605e5c" }}>Impacted assets</td>
              <td>{threat.impactedAssets}</td>
            </tr>
            <tr>
              <td style={{ color: "#605e5c" }}>Last analyst update</td>
              <td>{timeAgo(threat.lastUpdated)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Port of source's threatAnalystReport(t) — branches on t.name containing
// "phish" or "ransomware" (case-insensitive) to select different TTP prose,
// falling back to a generic living-off-the-land description. Faithful port
// of the source's simple string-matching, not fabricated per-threat data.
function ThreatAnalystReport({ threat }: { threat: DefenderThreatAnalytic }) {
  const nameLower = threat.name.toLowerCase();
  const actorProse = nameLower.includes("phish")
    ? "AiTM phishing kits to bypass MFA, harvest session tokens, and pivot via OAuth consent."
    : nameLower.includes("ransomware")
      ? "spear-phishing for initial access, then RDP brute force or VPN credential abuse, followed by data exfiltration via Mega/Rclone before encryption."
      : "living-off-the-land techniques (PowerShell, WMI, certutil) to evade detection.";
  const targetProse = threat.category === "Vulnerability" ? "systems running affected versions" : "organizations across multiple sectors including government, financial services, energy, and technology";

  return (
    <div>
      <h3 className={styles.h3}>Analyst report</h3>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        {threat.name} has been observed conducting operations against {targetProse}. The threat actor leverages {actorProse}
      </p>
      <h4 style={{ marginTop: 14 }}>Observed TTPs (MITRE ATT&amp;CK)</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tactic</th>
              <th>Technique</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Initial access</td>
              <td>T1566 Phishing</td>
              <td>Targeted email with malicious attachment / URL</td>
            </tr>
            <tr>
              <td>Execution</td>
              <td>T1059.001 PowerShell</td>
              <td>Encoded base64 payloads</td>
            </tr>
            <tr>
              <td>Persistence</td>
              <td>T1547 Boot/Logon autostart</td>
              <td>Run key + scheduled task</td>
            </tr>
            <tr>
              <td>Defense Evasion</td>
              <td>T1027 Obfuscated files</td>
              <td>Custom packing, unhooking AMSI</td>
            </tr>
            <tr>
              <td>Credential Access</td>
              <td>T1003 OS Credential Dumping</td>
              <td>LSASS access</td>
            </tr>
            <tr>
              <td>Lateral Movement</td>
              <td>T1021.001 RDP / T1570 SMB</td>
              <td>RDP via stolen creds, SMB share enumeration</td>
            </tr>
            <tr>
              <td>Exfiltration</td>
              <td>T1567 Web service</td>
              <td>Mega.nz / Rclone to S3</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThreatRelatedIncidents({ state, threat }: { state: DefenderState; threat: DefenderThreatAnalytic }) {
  if (threat.alertsCount === 0) {
    return <EmptyState message="No incidents in your tenant currently match this threat. Subscribe (above) to be notified if this changes." />;
  }
  const incidents = state.incidents.slice(0, Math.min(threat.alertsCount, 3));
  if (incidents.length === 0) {
    return <EmptyState message={`${threat.alertsCount} alerts match this threat — open Incidents to investigate.`} />;
  }
  return (
    <div>
      <h3 className={styles.h3}>Incidents matching this threat</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td>
                  <span className={styles.rowLink}>{i.id}</span>
                </td>
                <td>{i.title}</td>
                <td>
                  <SeverityBadge severity={i.severity} />
                </td>
                <td>{i.status}</td>
                <td>{timeAgo(i.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThreatImpactedAssets({ state, threat }: { state: DefenderState; threat: DefenderThreatAnalytic }) {
  if (threat.impactedAssets === 0) {
    return <EmptyState message="No assets are currently exposed to this threat." />;
  }
  const devices = state.devices.slice(0, Math.min(threat.impactedAssets, 5));
  return (
    <div>
      <h3 className={styles.h3}>Impacted assets ({threat.impactedAssets})</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Device</th>
              <th>OS</th>
              <th>Last seen</th>
              <th>Risk</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td>
                  <b>{d.name}</b>
                </td>
                <td>{d.os}</td>
                <td>{timeAgo(d.lastSeen)}</td>
                <td>{d.riskLevel}</td>
                <td>
                  <button type="button" className={styles.btn}>
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Port of source's threatMitigations(t) — the recommended-patch line branches
// on category === "Vulnerability" (references "the affected CVE" directly)
// vs. everything else (generic Windows/Office/3rd-party patching guidance).
function ThreatMitigations({ threat }: { threat: DefenderThreatAnalytic }) {
  const patchTarget = threat.category === "Vulnerability" ? "the affected CVE" : "Windows + Office + relevant 3rd-party products";
  return (
    <div>
      <h3 className={styles.h3}>Recommended mitigations</h3>
      <ol style={{ margin: "6px 0 0 20px", lineHeight: 1.7, fontSize: 13 }}>
        <li>
          <b>Patch immediately</b> &mdash; apply security updates for {patchTarget}. Validate via Defender Vulnerability
          Management.
        </li>
        <li>
          <b>Reduce attack surface</b> &mdash; enable ASR rules: <i>Block all Office apps from creating child processes</i>,{" "}
          <i>Block credential stealing from LSASS</i>, <i>Block executable content from email + webmail</i>.
        </li>
        <li>
          <b>Enforce MFA + Conditional Access</b> &mdash; block legacy auth, require compliant device, enable continuous
          access evaluation (CAE).
        </li>
        <li>
          <b>Monitor identity</b> &mdash; enable risky sign-in policies, rotate <code>krbtgt</code> every 90 days, alert on
          AS-REP roasting + Kerberoasting.
        </li>
        <li>
          <b>Network segmentation</b> &mdash; restrict SMB/RDP across subnets; block outbound to known IOC domains via
          Defender for Cloud Apps.
        </li>
        <li>
          <b>Backup + recovery</b> &mdash; immutable backups, 3-2-1 rule, test restore quarterly. Air-gapped copy for
          crown-jewel data.
        </li>
        <li>
          <b>Endpoint configuration</b> &mdash; enable tamper protection, real-time scanning, cloud-delivered protection at
          &quot;Cloud high&quot; or above.
        </li>
      </ol>
    </div>
  );
}

const ENDPOINT_QUERIES: { title: string; kql: string }[] = [
  {
    title: "Find processes by parent — Office spawning shells",
    kql:
      'DeviceProcessEvents\n| where InitiatingProcessFileName in~ ("winword.exe","excel.exe","powerpnt.exe","outlook.exe")\n| where FileName in~ ("cmd.exe","powershell.exe","wscript.exe","cscript.exe","mshta.exe")\n| project Timestamp, DeviceName, InitiatingProcessFileName, FileName, ProcessCommandLine\n| top 100 by Timestamp',
  },
  {
    title: "Suspicious PowerShell — encoded commands",
    kql:
      'DeviceProcessEvents\n| where FileName == "powershell.exe"\n| where ProcessCommandLine matches regex @"(?i)\\b(?:enc|encoded|EC|frombase64string)\\b"\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine',
  },
  {
    title: "LSASS access — likely credential dumping",
    kql:
      'DeviceEvents\n| where ActionType == "OpenProcessApiCall"\n| where InitiatingProcessFileName != "lsass.exe"\n| extend tp = parse_json(AdditionalFields).TargetImageFileName\n| where tp endswith "lsass.exe"\n| project Timestamp, DeviceName, InitiatingProcessFileName',
  },
];

function ThreatEndpointQueries() {
  return (
    <div>
      <h3 className={styles.h3}>Endpoint hunting queries</h3>
      <p style={{ fontSize: 12, color: "#605e5c" }}>Run in Advanced Hunting to find evidence of this threat in your environment.</p>
      {ENDPOINT_QUERIES.map((q) => (
        <div key={q.title}>
          <h4 style={{ marginTop: 14 }}>{q.title}</h4>
          <textarea
            className={styles.textarea}
            readOnly
            rows={q.kql.split("\n").length}
            value={q.kql}
            style={{ fontFamily: "Consolas, 'Cascadia Code', monospace", fontSize: 12 }}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Action center
// ============================================================================

type ActionCenterTab = "pending" | "history";

export function ActionCenterPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [tab, setTab] = useState<ActionCenterTab>("pending");

  function approve(action: DefenderPendingAction) {
    dispatch({ type: "APPROVE_PENDING_ACTION", id: action.id });
    toast.success(`${action.type} approved + executed`);
  }

  function reject(action: DefenderPendingAction) {
    const reason = window.prompt("Reject reason:", "False positive");
    if (reason === null) return;
    dispatch({ type: "REJECT_PENDING_ACTION", id: action.id, reason });
    toast.info(`${action.type} rejected`);
  }

  const pendingColumns: DataTableColumn<DefenderPendingAction>[] = [
    { key: "type", header: "Action", render: (a) => a.type },
    { key: "target", header: "Target", render: (a) => a.target },
    { key: "investigation", header: "Investigation", render: (a) => a.investigation },
    { key: "requestedBy", header: "Requested by", render: (a) => a.requestedBy },
    { key: "requestedOn", header: "Requested", render: (a) => timeAgo(a.requestedOn) },
    {
      key: "actions",
      header: "Approve / Reject",
      render: (a) => (
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className={styles.btn} style={{ color: "#0e700e" }} onClick={() => approve(a)}>
            Approve
          </button>
          <button type="button" className={styles.btn} style={{ color: "#a4262c" }} onClick={() => reject(a)}>
            Reject
          </button>
        </span>
      ),
    },
  ];

  const historyColumns: DataTableColumn<DefenderState["actionHistory"][number]>[] = [
    { key: "type", header: "Action", render: (a) => a.type },
    { key: "target", header: "Target", render: (a) => a.target },
    { key: "status", header: "Status", render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status}</StatusPill> },
    { key: "actionedBy", header: "Actioned by", render: (a) => a.actionedBy },
    { key: "actionedOn", header: "Completed", render: (a) => timeAgo(a.actionedOn) },
    { key: "reason", header: "Reason", render: (a) => a.reason ?? "—" },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a> / <a>Action center</a>
      </div>
      <div className={styles.pageH1}>Action center</div>
      <div className={styles.pageSub}>Pending and completed remediation actions across all Defender workloads.</div>

      <SubTabBar
        tabs={[
          { key: "pending", label: `Pending (${state.pendingActions.length})` },
          { key: "history", label: `History (${state.actionHistory.length})` },
        ]}
        active={tab}
        onChange={(key) => setTab(key as ActionCenterTab)}
      />

      <div style={{ marginTop: 14 }}>
        {tab === "pending" ? (
          <DataTable columns={pendingColumns} rows={state.pendingActions} getRowKey={(a) => a.id} emptyMessage="No pending actions." />
        ) : (
          <DataTable columns={historyColumns} rows={state.actionHistory} getRowKey={(a) => a.id} emptyMessage="No history yet." />
        )}
      </div>
    </div>
  );
}
