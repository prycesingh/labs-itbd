"use client";

// Incidents & Alerts — ported from defender-incidents.js (renderList / renderAlerts /
// openDetail / tabBody / manageStatus / manageAssign). Two top-level pages share this
// file because the source module (DefenderIncidents IIFE) owns both:
//   - IncidentsPage: filterable incident list + a 6-tab detail Flyout (Attack story,
//     Alerts, Assets, Investigations, Evidence and Response, Summary).
//   - AlertsPage: flat read-only alerts table (source's renderAlerts()).
// Manage actions (status change / assign) dispatch UPDATE_INCIDENT against the shared
// reducer, matching source's DefenderData.updateIncident() + manageStatus()/manageAssign().

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderIncident, DefenderState } from "@/lib/labs/simulators/defender/types";
import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import {
  DataTable,
  EmptyState,
  Flyout,
  NativeSelect,
  SeverityBadge,
  StatusPill,
  SubTabBar,
  statusTone,
  type DataTableColumn,
} from "./defender-ui";
import styles from "./defender-console.module.css";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)} sec ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
}

const SEVERITY_FILTERS = ["all", "High", "Medium", "Low", "Informational"] as const;
const STATUS_FILTERS = ["all", "Active", "In progress", "Resolved"] as const;

const INCIDENT_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "In progress", label: "In progress" },
  { value: "Resolved", label: "Resolved" },
];

const DETAIL_TABS = [
  { key: "attack-story", label: "Attack story" },
  { key: "alerts", label: "Alerts" },
  { key: "assets", label: "Assets" },
  { key: "investigations", label: "Investigations" },
  { key: "evidence", label: "Evidence and Response" },
  { key: "summary", label: "Summary" },
] as const;

type DetailTabKey = (typeof DETAIL_TABS)[number]["key"];

// ===================== INCIDENTS =====================

export function IncidentsPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_FILTERS)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return state.incidents.filter((i) => {
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      return true;
    });
  }, [state.incidents, severityFilter, statusFilter]);

  const selected = selectedId ? state.incidents.find((i) => i.id === selectedId) ?? null : null;

  const columns: DataTableColumn<DefenderIncident>[] = [
    { key: "severity", header: "Severity", render: (i) => <SeverityBadge severity={i.severity} /> },
    {
      key: "incident",
      header: "Incident",
      render: (i) => (
        <span>
          <span className={styles.rowLink}>{i.title}</span>
          <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>{i.id}</div>
        </span>
      ),
    },
    { key: "status", header: "Status", render: (i) => <StatusPill tone={statusTone(i.status)}>{i.status}</StatusPill> },
    {
      key: "tags",
      header: "Tags",
      render: (i) => (
        <>
          {i.tags.map((t) => (
            <span key={t} className={`${styles.pill} ${styles.pillTag}`}>
              {t}
            </span>
          ))}
        </>
      ),
    },
    { key: "activeAlerts", header: "Active alerts", render: (i) => `${i.activeAlerts} / ${i.totalAlerts}` },
    { key: "investigationState", header: "Investigation state", render: (i) => i.investigationState },
    { key: "serviceSources", header: "Service sources", render: (i) => i.serviceSources[0] ?? "" },
    { key: "lastActivity", header: "Last activity", render: (i) => timeAgo(i.lastActivity) },
  ];

  function setSeverity(v: (typeof SEVERITY_FILTERS)[number]) {
    setSeverityFilter(v);
  }
  function setStatus(v: (typeof STATUS_FILTERS)[number]) {
    setStatusFilter(v);
  }

  function handleStatusChange(incident: DefenderIncident, status: string) {
    dispatch({ type: "UPDATE_INCIDENT", id: incident.id, patch: { status: status as DefenderIncident["status"] } });
    toast.success(`Incident ${incident.id} set to ${status}`);
  }

  function handleAssignToMe(incident: DefenderIncident) {
    dispatch({ type: "UPDATE_INCIDENT", id: incident.id, patch: { assignedTo: "admin@itbd.onmicrosoft.com" } });
    toast.success("Incident assigned to you");
  }

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>/</span>
        <a>Incidents &amp; alerts</a>
        <span>/</span>
        <a>Incidents</a>
      </div>
      <div className={styles.pageH1}>Incidents</div>
      <div className={styles.pageSub}>Investigate cases that combine related alerts across Defender workloads.</div>

      <div className={styles.filterRow}>
        {SEVERITY_FILTERS.map((v) => (
          <button key={v} type="button" className={`${styles.chip} ${severityFilter === v ? styles.chipActive : ""}`} onClick={() => setSeverity(v)}>
            {v === "all" ? "Severity: any" : v}
          </button>
        ))}
        {STATUS_FILTERS.map((v) => (
          <button key={v} type="button" className={`${styles.chip} ${statusFilter === v ? styles.chipActive : ""}`} onClick={() => setStatus(v)}>
            {v === "all" ? "Status: any" : v}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filtered} getRowKey={(i) => i.id} onRowClick={(i) => setSelectedId(i.id)} emptyMessage="No incidents match the current filter." />

      {selected ? (
        <IncidentDetailFlyout
          incident={selected}
          state={state}
          onClose={() => setSelectedId(null)}
          onStatusChange={(status) => handleStatusChange(selected, status)}
          onAssignToMe={() => handleAssignToMe(selected)}
          onCommentChange={(comment) => dispatch({ type: "UPDATE_INCIDENT", id: selected.id, patch: { comment } })}
        />
      ) : null}
    </div>
  );
}

// ===================== DETAIL FLYOUT =====================

function IncidentDetailFlyout({
  incident,
  state,
  onClose,
  onStatusChange,
  onAssignToMe,
  onCommentChange,
}: {
  incident: DefenderIncident;
  state: DefenderState;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onAssignToMe: () => void;
  onCommentChange: (comment: string) => void;
}) {
  const [tab, setTab] = useState<DetailTabKey>("attack-story");

  const tabs = DETAIL_TABS.map((t) => ({ key: t.key, label: t.key === "alerts" ? `${t.label} (${incident.totalAlerts})` : t.label }));

  function handleResolve() {
    onStatusChange("Resolved");
    onClose();
  }

  return (
    <Flyout
      title={incident.title}
      subtitle={`Incident ${incident.id}`}
      onClose={onClose}
      tabs={<SubTabBar tabs={tabs} active={tab} onChange={(k) => setTab(k as DetailTabKey)} />}
      footer={
        <>
          <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={onAssignToMe}>
            Assign to me
          </button>
          <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => onStatusChange("In progress")}>
            Set in progress
          </button>
          <button type="button" className={styles.btn} onClick={handleResolve}>
            Resolve incident
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12, marginBottom: 16 }}>
        <div>
          <div style={{ color: "#605e5c" }}>Severity</div>
          <SeverityBadge severity={incident.severity} />
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Status</div>
          <NativeSelect value={incident.status} onChange={onStatusChange} options={INCIDENT_STATUS_OPTIONS} />
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Assigned to</div>
          <strong>{incident.assignedTo}</strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Active alerts</div>
          <strong>
            {incident.activeAlerts} of {incident.totalAlerts}
          </strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Impacted</div>
          <strong>
            {incident.impactedDevices} devices, {incident.impactedUsers} users
          </strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Created</div>
          <strong>{timeAgo(incident.created)}</strong>
        </div>
      </div>

      {tab === "attack-story" ? <AttackStoryTab incident={incident} /> : null}
      {tab === "alerts" ? <AlertsTab incident={incident} state={state} /> : null}
      {tab === "assets" ? <AssetsTab incident={incident} state={state} /> : null}
      {tab === "investigations" ? <InvestigationsTab incident={incident} /> : null}
      {tab === "evidence" ? <EvidenceTab incident={incident} /> : null}
      {tab === "summary" ? <SummaryTab incident={incident} onCommentChange={onCommentChange} /> : null}
    </Flyout>
  );
}

// ----- Attack story -----

function AttackStoryTab({ incident }: { incident: DefenderIncident }) {
  const events = [...incident.attackStory].sort((a, b) => a.ts - b.ts);

  return (
    <div className={styles.attackLayout}>
      <div>
        <div className={styles.h3}>Attack story timeline</div>
        <div className={styles.pageSub}>Chronological view of how the attack unfolded across endpoints, email and identity.</div>
        {events.length === 0 ? (
          <EmptyState message="No attack story events recorded for this incident." />
        ) : (
          <div className={styles.timeline}>
            {events.map((ev, idx) => {
              const sevClass =
                incident.severity === "High" ? styles.tlItemSevHigh : incident.severity === "Medium" ? styles.tlItemSevMedium : incident.severity === "Low" ? styles.tlItemSevLow : "";
              const time = new Date(Date.now() - ev.ts * 3600000);
              const hh = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
              return (
                <div key={`${ev.ts}-${idx}`} className={`${styles.tlItem} ${sevClass}`}>
                  <div className={styles.tlTime}>
                    {hh} &middot; {ev.ts}h ago
                    <span className={styles.tlType}>{ev.type}</span>
                  </div>
                  <div className={styles.tlTitle}>{ev.title}</div>
                  <div className={styles.tlDetail}>{ev.detail}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>MITRE ATT&amp;CK</div>
          <div>
            {incident.mitreTactics.map((m) => (
              <span key={m} className={styles.mitreChip}>
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Categories</div>
          <div>
            {incident.categories.map((c) => (
              <div key={c} style={{ margin: "2px 0" }}>
                {c}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Recommended actions</div>
          <ol style={{ paddingLeft: 18, fontSize: 12.5, color: "#424242" }}>
            <li>Isolate impacted devices</li>
            <li>Reset credentials for impacted users</li>
            <li>Block malicious URLs in tenant indicators</li>
            <li>Run a full antivirus scan</li>
            <li>Review email transport rules for tampering</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ----- Alerts (per-incident) -----

function AlertsTab({ incident, state }: { incident: DefenderIncident; state: DefenderState }) {
  const alerts = state.alerts.filter((a) => a.incidentId === incident.id);

  if (!alerts.length) {
    return <EmptyState message="No alerts linked to this incident." />;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Title</th>
            <th>Status</th>
            <th>Category</th>
            <th>Detection</th>
            <th>MITRE technique</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td>
                <SeverityBadge severity={a.severity} />
              </td>
              <td className={styles.rowLink}>{a.title}</td>
              <td>
                <StatusPill tone={statusTone(a.status)}>{a.status}</StatusPill>
              </td>
              <td>{a.category}</td>
              <td>{a.detectionSource}</td>
              <td>{a.mitreTechnique || "-"}</td>
              <td>{timeAgo(a.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----- Assets -----

function AssetsTab({ incident, state }: { incident: DefenderIncident; state: DefenderState }) {
  const devices = state.devices.slice(0, incident.impactedDevices);
  const users = state.identities.slice(0, incident.impactedUsers);
  const mailboxes = state.identities.slice(0, incident.impactedMailboxes);

  return (
    <div className={styles.evidenceGrid}>
      <div className={styles.evidenceBlock}>
        <h4>Devices ({incident.impactedDevices})</h4>
        {incident.impactedDevices <= 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: "#605e5c" }}>None</div>
        ) : (
          devices.map((d, idx) => (
            <div key={d.id ?? idx} className={styles.evidenceRow}>
              <strong>{d.name}</strong>
              <div>Risk: {d.riskLevel} &middot; {d.healthState}</div>
            </div>
          ))
        )}
      </div>
      <div className={styles.evidenceBlock}>
        <h4>Users ({incident.impactedUsers})</h4>
        {incident.impactedUsers <= 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: "#605e5c" }}>None</div>
        ) : (
          users.map((u, idx) => (
            <div key={u.id ?? idx} className={styles.evidenceRow}>
              <strong>{u.upn}</strong>
              <div>Sign-in risk: {u.signInRisk}</div>
            </div>
          ))
        )}
      </div>
      <div className={styles.evidenceBlock}>
        <h4>Mailboxes ({incident.impactedMailboxes})</h4>
        {incident.impactedMailboxes <= 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: "#605e5c" }}>None</div>
        ) : (
          mailboxes.map((m, idx) => (
            <div key={m.id ?? idx} className={styles.evidenceRow}>
              <strong>{m.upn}</strong>
              <div>Mailbox: Compromised</div>
            </div>
          ))
        )}
      </div>
      <div className={styles.evidenceBlock}>
        <h4>Apps</h4>
        <div className={styles.evidenceRow}>
          <strong>Microsoft 365 (Office)</strong>
          <div>Risk: Medium</div>
        </div>
        <div className={styles.evidenceRow}>
          <strong>Microsoft Entra ID</strong>
          <div>Risk: Low</div>
        </div>
      </div>
    </div>
  );
}

// ----- Investigations -----

function InvestigationsTab({ incident }: { incident: DefenderIncident }) {
  const numericId = parseInt(incident.id.replace("INC-", ""), 10) || 0;

  return (
    <div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Investigation name</th>
              <th>Status</th>
              <th>Detection source</th>
              <th>Entities</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>INV-{numericId + 200}</td>
              <td className={styles.rowLink}>Auto investigation: {incident.title.slice(0, 60)}...</td>
              <td>
                <span className={styles.pill}>{incident.investigationState}</span>
              </td>
              <td>EDR</td>
              <td>{incident.impactedDevices + incident.impactedUsers} entities</td>
              <td>{timeAgo(incident.created)}</td>
            </tr>
            <tr>
              <td>INV-{numericId + 201}</td>
              <td className={styles.rowLink}>Mailbox forensics</td>
              <td>
                <span className={`${styles.pill} ${styles.pillWarn}`}>Pending action</span>
              </td>
              <td>MDO</td>
              <td>2 mailboxes</td>
              <td>{timeAgo(incident.created)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={styles.h3} style={{ marginTop: 16 }}>
        Pending actions
      </div>
      <div className={styles.card} style={{ marginTop: 6 }}>
        <div style={{ fontSize: 13, color: "#424242" }}>2 actions awaiting your approval:</div>
        <ul style={{ paddingLeft: 20, fontSize: 13, marginTop: 6 }}>
          <li>Soft delete malicious email from 3 mailboxes</li>
          <li>Isolate device LAPTOP-SNEHA</li>
        </ul>
      </div>
    </div>
  );
}

// ----- Evidence and Response -----

function EvidenceTab({ incident }: { incident: DefenderIncident }) {
  const e = incident.evidence;

  const hasAny = e.files.length || e.processes.length || e.ips.length || e.urls.length || e.mailboxes.length;
  if (!hasAny) {
    return <EmptyState message="No evidence collected for this incident." />;
  }

  return (
    <div className={styles.evidenceGrid}>
      {e.files.length ? (
        <div className={styles.evidenceBlock}>
          <h4>Files ({e.files.length})</h4>
          {e.files.map((f) => (
            <div key={f.sha256} className={styles.evidenceRow}>
              <strong>{f.name}</strong>
              <div style={{ fontFamily: "Consolas, monospace", fontSize: 11, color: "#605e5c" }}>SHA256: {f.sha256}</div>
              <div>
                Verdict: <StatusPill tone={f.verdict === "Malicious" ? "err" : "warn"}>{f.verdict}</StatusPill>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {e.processes.length ? (
        <div className={styles.evidenceBlock}>
          <h4>Processes ({e.processes.length})</h4>
          {e.processes.map((p) => (
            <div key={p.pid} className={styles.evidenceRow}>
              <strong>
                {p.name} (pid {p.pid})
              </strong>
              <div style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{p.cmdLine}</div>
              <div>Account: {p.account}</div>
            </div>
          ))}
        </div>
      ) : null}
      {e.ips.length ? (
        <div className={styles.evidenceBlock}>
          <h4>IP addresses ({e.ips.length})</h4>
          {e.ips.map((i) => (
            <div key={i.addr} className={styles.evidenceRow}>
              <strong>{i.addr}</strong>
              <div>
                {i.country} &middot; {i.asn}
              </div>
              <div>
                Reputation: <StatusPill tone={i.reputation === "Malicious" ? "err" : "warn"}>{i.reputation}</StatusPill>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {e.urls.length ? (
        <div className={styles.evidenceBlock}>
          <h4>URLs ({e.urls.length})</h4>
          {e.urls.map((u) => (
            <div key={u.url} className={styles.evidenceRow}>
              <strong>{u.url}</strong>
              <div>
                Verdict: <StatusPill tone="err">{u.verdict}</StatusPill>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {e.mailboxes.length ? (
        <div className={styles.evidenceBlock}>
          <h4>Mailboxes ({e.mailboxes.length})</h4>
          {e.mailboxes.map((m) => (
            <div key={m.upn} className={styles.evidenceRow}>
              <strong>{m.upn}</strong>
              <div>{m.deliveryAction}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ----- Summary -----
// NOTE: the comment textarea dispatches UPDATE_INCIDENT (patch { comment }) on every
// keystroke so it persists on the shared incident record, matching the reducer's
// generic patch-merge semantics — the source's version was ephemeral (never wired to
// DefenderData), but persisting is the more useful behavior in this port and the
// reducer already supports it for free.
function SummaryTab({ incident, onCommentChange }: { incident: DefenderIncident; onCommentChange: (comment: string) => void }) {
  const summary = `${incident.title}. This incident contains ${incident.totalAlerts} alerts spanning ${incident.categories.join(", ")}. ${incident.impactedDevices} devices and ${incident.impactedUsers} users were affected. The investigation is currently ${incident.investigationState.toLowerCase()}.`;

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Incident summary</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#424242" }}>{summary}</p>
        <div style={{ marginTop: 10, fontSize: 12, color: "#605e5c" }}>
          First activity: {new Date(incident.created).toLocaleString()}
          <br />
          Last activity: {new Date(incident.lastActivity).toLocaleString()}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Comments &amp; history</div>
        <div style={{ fontSize: 12, color: "#605e5c" }}>
          {incident.comment ? "Investigation notes:" : "No comments yet. Use the comment box to record investigation notes."}
        </div>
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder="Add a comment..."
          style={{ marginTop: 8 }}
          value={incident.comment ?? ""}
          onChange={(e) => onCommentChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// ===================== ALERTS (flat list page) =====================

type AlertRow = DefenderState["alerts"][number];

export function AlertsPage({ state }: { state: DefenderState }) {
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_FILTERS)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");

  const filtered = useMemo(() => {
    return state.alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [state.alerts, severityFilter, statusFilter]);

  const columns: DataTableColumn<AlertRow>[] = [
    { key: "severity", header: "Severity", render: (a) => <SeverityBadge severity={a.severity} /> },
    {
      key: "alert",
      header: "Alert",
      render: (a) => (
        <span>
          <span className={styles.rowLink}>{a.title}</span>
          <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>{a.id}</div>
        </span>
      ),
    },
    { key: "status", header: "Status", render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status}</StatusPill> },
    { key: "category", header: "Category", render: (a) => a.category },
    { key: "serviceSource", header: "Service", render: (a) => a.serviceSource },
    { key: "detectionSource", header: "Detection", render: (a) => a.detectionSource },
    {
      key: "incident",
      header: "Incident",
      render: (a) => (
        <span>
          <span className={styles.rowLink}>{a.incidentTitle}</span>
          <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>{a.incidentId}</div>
        </span>
      ),
    },
    { key: "mitreTechnique", header: "MITRE technique", render: (a) => a.mitreTechnique || "-" },
    { key: "impactedAssets", header: "Impacted assets", render: (a) => a.impactedAssets },
    { key: "firstActivity", header: "First activity", render: (a) => timeAgo(a.firstActivity) },
    { key: "lastActivity", header: "Last activity", render: (a) => timeAgo(a.lastActivity) },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>/</span>
        <a>Incidents &amp; alerts</a>
        <span>/</span>
        <a>Alerts</a>
      </div>
      <div className={styles.pageH1}>Alerts</div>
      <div className={styles.pageSub}>Individual detections fed from Defender workloads. Related alerts roll up into incidents.</div>

      <div className={styles.filterRow}>
        {SEVERITY_FILTERS.map((v) => (
          <button key={v} type="button" className={`${styles.chip} ${severityFilter === v ? styles.chipActive : ""}`} onClick={() => setSeverityFilter(v)}>
            {v === "all" ? "Severity: any" : v}
          </button>
        ))}
        {STATUS_FILTERS.map((v) => (
          <button key={v} type="button" className={`${styles.chip} ${statusFilter === v ? styles.chipActive : ""}`} onClick={() => setStatusFilter(v)}>
            {v === "all" ? "Status: any" : v}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filtered} getRowKey={(a) => a.id} emptyMessage="No alerts match the current filter." />
    </div>
  );
}
