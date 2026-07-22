"use client";

// Email & Collaboration — Defender for Office 365 (rich version), ported from
// itbd-lab/simulators/defender/js/defender-email-collab.js. This file is the
// richer, actually-shipped source for these six sections (the older
// defender-email.js versions of the same sections are dead code, always
// shadowed in source — not ported here). Six page components, one per tab in
// source's renderEmailCollab (`explorer` / `campaigns` / `submissions` /
// `attack-sim` / `threat-tracker` / `investigations`); DefenderShell/the page
// container owns tab routing via DefenderPage, so each component below is a
// standalone page body, not a tab switcher. All read-only against
// `state.emailCollab` — source has no persisted mutations for this cluster
// (Explorer's view-mode/lookback selects are local, ephemeral UI filters in
// source, not state writes, so they are omitted here rather than faked).

import type { DefenderState } from "@/lib/labs/simulators/defender/types";
import { DataTable, EmptyState, SeverityBadge, StatRow, StatusPill, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

type Explorer = DefenderState["emailCollab"]["explorer"];
type UrlClick = Explorer["topUrlClicks"][number];
type Attachment = Explorer["topAttachments"][number];
type Campaign = DefenderState["emailCollab"]["campaigns"][number];
type Submission = DefenderState["emailCollab"]["submissions"][number];
type Simulation = DefenderState["emailCollab"]["simulations"][number];
type ThreatItem = DefenderState["emailCollab"]["threatTracker"][number];

// ===== 1. Threat Explorer =====
export function EmailExplorerPage({ state }: { state: DefenderState }) {
  const { stats, topUrlClicks, topAttachments } = state.emailCollab.explorer;

  const urlColumns: DataTableColumn<UrlClick>[] = [
    { key: "url", header: "URL", render: (u) => <code style={{ fontSize: 11, color: "#a4262c" }}>{u.url}</code> },
    { key: "clicks", header: "Clicks", render: (u) => u.clicks },
    { key: "threatType", header: "Threat type", render: (u) => u.threatType },
    { key: "action", header: "Time-of-click action", render: (u) => u.timeOfClickAction },
    { key: "users", header: "Users", render: (u) => u.users.join(", ") },
  ];

  const attachmentColumns: DataTableColumn<Attachment>[] = [
    { key: "sender", header: "Sender", render: (a) => <code style={{ fontSize: 11 }}>{a.sender}</code> },
    { key: "fileName", header: "File name", render: (a) => a.fileName },
    { key: "sha256", header: "SHA256", render: (a) => <code style={{ fontSize: 10 }}>{a.sha256}</code> },
    { key: "verdict", header: "Verdict", render: (a) => <StatusPill tone="err">{a.verdict}</StatusPill> },
    { key: "recipients", header: "Recipients", render: (a) => a.recipients },
    { key: "action", header: "Action", render: (a) => a.action },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>/</span> Explorer
      </div>
      <div className={styles.pageH1}>Email &amp; Collaboration — Defender for Office 365</div>
      <div className={styles.pageSub}>
        Hunt phish/malware/BEC across Exchange, Teams, SharePoint, OneDrive. Auto-investigation + response (AIR) included with P2.
      </div>

      <div className={styles.h3}>Threat Explorer (real-time)</div>
      <StatRow
        stats={[
          { label: "Total email", value: stats.totalEmail.toLocaleString() },
          { label: "Delivered", value: stats.delivered.toLocaleString() },
          { label: "Junked", value: stats.junked },
          { label: "Quarantined", value: stats.quarantined },
          { label: "Blocked", value: stats.blocked },
          { label: "ZAP-purged", value: stats.zapped },
          { label: "Phish", value: stats.phishCount },
          { label: "Malware", value: stats.malwareCount },
        ]}
      />

      <div className={styles.h2}>Top URL clicks (last 7 days)</div>
      <DataTable columns={urlColumns} rows={topUrlClicks} getRowKey={(u) => u.url} emptyMessage="No URL clicks recorded." />

      <div className={styles.h2}>Top malicious attachments</div>
      <DataTable columns={attachmentColumns} rows={topAttachments} getRowKey={(a) => a.sha256} emptyMessage="No malicious attachments recorded." />

      <div className={styles.h2}>Actions you can take from Explorer</div>
      <ul style={{ fontSize: 13, color: "#605e5c", lineHeight: 1.7 }}>
        <li>
          <b>Bulk actions on selected messages</b>: Move to Junk / Delete / Soft delete / Hard delete (from all mailboxes via ZAP-style)
        </li>
        <li>
          <b>Add sender to block list</b> (tenant block list — applies to all users)
        </li>
        <li>
          <b>Submit to Microsoft for analysis</b> (improves Microsoft&rsquo;s ML for whole world)
        </li>
        <li>
          <b>Trigger investigation</b> — AIR auto-investigates: who else got the email, did anyone click, is endpoint compromised, did user enter credentials?
        </li>
      </ul>
    </div>
  );
}

// ===== 2. Campaigns =====
export function EmailCampaignsPage({ state }: { state: DefenderState }) {
  const { campaigns } = state.emailCollab;

  const columns: DataTableColumn<Campaign>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (c) => (
        <>
          <span className={styles.rowLink}>{c.name}</span>
          <br />
          <span style={{ fontSize: 11, color: "#605e5c" }}>{c.subject}</span>
        </>
      ),
    },
    { key: "firstSeen", header: "First seen", render: (c) => c.firstSeen },
    { key: "lastSeen", header: "Last seen", render: (c) => c.lastSeen },
    { key: "confidence", header: "Confidence", render: (c) => <StatusPill tone={c.confidence === "High" ? "ok" : "warn"}>{c.confidence}</StatusPill> },
    { key: "threatType", header: "Threat type", render: (c) => <SeverityBadge severity={c.threatType === "Spam" ? "Low" : c.threatType === "Malware" ? "High" : "Medium"} /> },
    { key: "impact", header: "Impact", render: (c) => c.impact },
    { key: "senders", header: "Senders", render: (c) => c.senders },
    { key: "ips", header: "IPs", render: (c) => c.ips },
    { key: "recipients", header: "Recipients", render: (c) => c.recipients.toLocaleString() },
    { key: "clicks", header: "Clicks", render: (c) => c.clicks },
    { key: "attachments", header: "Attachments", render: (c) => c.attachments },
    { key: "urls", header: "URLs", render: (c) => c.urls },
    { key: "mitre", header: "MITRE", render: (c) => (c.mitre === "-" ? c.mitre : <span className={styles.mitreChip}>{c.mitre}</span>) },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>/</span> Campaigns
      </div>
      <div className={styles.pageH1}>Campaigns ({campaigns.length})</div>
      <div className={styles.pageSub}>
        Microsoft groups related emails into &ldquo;campaigns&rdquo; using ML — same subject patterns, sender infrastructure, payload type. Helps you respond to a
        phishing wave in one click.
      </div>

      <DataTable columns={columns} rows={campaigns} getRowKey={(c) => c.name} emptyMessage="No campaigns detected." />

      <div className={styles.h2}>Campaign actions</div>
      <ul style={{ fontSize: 13, color: "#605e5c", lineHeight: 1.7 }}>
        <li>Bulk-quarantine all delivered messages in this campaign</li>
        <li>Block all sender IPs at Connection Filter</li>
        <li>Add all subject patterns to transport rule deny list</li>
        <li>Trigger AIR (Auto-Investigation + Response) — investigates each recipient mailbox</li>
        <li>Open in Threat Hunting — pivots to advanced KQL</li>
      </ul>
    </div>
  );
}

// ===== 3. Submissions =====
function submissionVerdictTone(verdict: string): "ok" | "warn" {
  return verdict.includes("Pending") ? "warn" : "ok";
}

export function EmailSubmissionsPage({ state }: { state: DefenderState }) {
  const { submissions } = state.emailCollab;

  const columns: DataTableColumn<Submission>[] = [
    { key: "date", header: "Submitted", render: (s) => s.date },
    { key: "type", header: "Type", render: (s) => s.type },
    { key: "submittedBy", header: "Submitted by", render: (s) => s.submittedBy },
    { key: "submittedAs", header: "Submitted as", render: (s) => s.submittedAs },
    { key: "reason", header: "Reason", render: (s) => <span style={{ fontSize: 12 }}>{s.reason}</span> },
    { key: "items", header: "Items", render: (s) => s.items },
    { key: "verdict", header: "Verdict", render: (s) => <StatusPill tone={submissionVerdictTone(s.verdict)}>{s.verdict}</StatusPill> },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>/</span> Submissions
      </div>
      <div className={styles.pageH1}>Submissions ({submissions.length})</div>
      <div className={styles.pageSub}>
        User-reported phish (via Outlook &ldquo;Report message&rdquo; button) or admin submissions. Microsoft analyzes within 24-48 hours.
      </div>

      <DataTable columns={columns} rows={submissions} getRowKey={(s) => `${s.date}-${s.submittedBy}-${s.type}`} emptyMessage="No submissions yet." />

      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 12 }}>
        + New submission
      </button>

      <div className={styles.h2}>Why submissions matter</div>
      <ul style={{ fontSize: 13, color: "#605e5c", lineHeight: 1.7 }}>
        <li>Trains Microsoft&rsquo;s global ML — your reported phish protects all other tenants</li>
        <li>If confirmed Phish/Malware: Microsoft adds to global block list within 24-48h</li>
        <li>Enable the &ldquo;Report message / Report phish&rdquo; button in Outlook via Org &rarr; Outlook add-ins</li>
        <li>Users earn engagement points in attack simulation training when they report</li>
      </ul>
    </div>
  );
}

// ===== 4. Attack Simulation Training =====
// Source renders click-rate/training-completion as plain numbers; this port
// adds the catBar (secure-score-style) progress-bar visualization the task
// calls out, reusing the existing catBar* classes rather than inventing new
// CSS, matching the "use only existing classes" constraint.
function ProgressBar({ label, right, pct }: { label: string; right: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={styles.catBar}>
      <div className={styles.catBarLabel}>
        <span>{label}</span>
        <span>{right}</span>
      </div>
      <div className={styles.catBarBg}>
        <div className={styles.catBarFill} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

const SIM_TECHNIQUES: { technique: string; tests: string; difficulty: string }[] = [
  { technique: "Credential harvest (T1566.001)", tests: "Phish login page → captures typed credentials (in safe sandbox)", difficulty: "Easy" },
  { technique: "Malware attachment (T1204.002)", tests: 'Email with "invoice.exe" → checks if user opens', difficulty: "Easy" },
  { technique: "Link in attachment (T1204.001)", tests: "PDF with embedded malicious link", difficulty: "Medium" },
  { technique: "Link to malware (T1204.001)", tests: "Email with link → downloads payload", difficulty: "Medium" },
  { technique: "Drive-by URL (T1189)", tests: "Link to web page that drops payload via browser exploit", difficulty: "Hard" },
  { technique: "OAuth consent grant (T1528)", tests: "Phish OAuth grant to malicious app — bypasses MFA", difficulty: "Hard" },
];

export function EmailAttackSimPage({ state }: { state: DefenderState }) {
  const { simulations } = state.emailCollab;

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>/</span> Attack simulation training
      </div>
      <div className={styles.pageH1}>Attack Simulation Training ({simulations.length})</div>
      <div className={styles.pageSub}>
        Phish your own users (in a safe way) to identify training gaps. Microsoft&rsquo;s payload library based on real-world campaigns.
      </div>

      {simulations.length === 0 ? (
        <EmptyState message="No simulations launched yet." />
      ) : (
        simulations.map((sim: Simulation) => {
          const trainingPct = sim.trainingAssigned === 0 ? 0 : Math.round((sim.trainingCompleted / sim.trainingAssigned) * 100);
          return (
            <div key={sim.name} className={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div className={styles.cardTitle}>{sim.name}</div>
                  <div style={{ fontSize: 12, color: "#605e5c" }}>
                    {sim.startDate} &rarr; {sim.endDate} &middot; {sim.techniques}
                  </div>
                </div>
                <StatusPill tone={sim.status === "Completed" ? "ok" : "warn"}>{sim.status}</StatusPill>
              </div>

              <StatRow
                stats={[
                  { label: "Targeted", value: sim.targeted.toLocaleString() },
                  { label: "Clicked", value: sim.clicked },
                  { label: "Reported", value: sim.reported },
                  { label: "Compromised", value: sim.compromised },
                ]}
              />

              <ProgressBar label="Click rate" right={`${sim.clicked} / ${sim.targeted.toLocaleString()} · ${sim.percentClicked}%`} pct={sim.percentClicked} />
              <ProgressBar label="Reported rate" right={`${sim.reported} · ${sim.percentReported}%`} pct={sim.percentReported} />
              <ProgressBar label="Training completed" right={`${sim.trainingCompleted} / ${sim.trainingAssigned} · ${trainingPct}%`} pct={trainingPct} />
            </div>
          );
        })
      )}

      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 12 }}>
        + Launch simulation
      </button>

      <div className={styles.h2}>Available techniques (MITRE-mapped)</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Technique</th>
              <th>What it tests</th>
              <th>Difficulty</th>
            </tr>
          </thead>
          <tbody>
            {SIM_TECHNIQUES.map((t) => (
              <tr key={t.technique}>
                <td>{t.technique}</td>
                <td style={{ fontSize: 12 }}>{t.tests}</td>
                <td>{t.difficulty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.h2}>Auto-assigned training</div>
      <div style={{ fontSize: 13, color: "#605e5c" }}>
        When user clicks the phish: assign Microsoft Learn module + quiz. Manager notified. Track completion in this dashboard.
      </div>
    </div>
  );
}

// ===== 5. Threat Tracker =====
function threatSeverityBadge(severity: ThreatItem["severity"]) {
  return <SeverityBadge severity={severity} />;
}

export function EmailThreatTrackerPage({ state }: { state: DefenderState }) {
  const { threatTracker } = state.emailCollab;

  const columns: DataTableColumn<ThreatItem>[] = [
    { key: "name", header: "Name", render: (t) => <span className={styles.rowLink}>{t.name}</span> },
    { key: "type", header: "Type", render: (t) => t.type },
    { key: "severity", header: "Severity", render: (t) => threatSeverityBadge(t.severity) },
    { key: "firstAdded", header: "First added", render: (t) => t.firstAdded },
    { key: "tagged", header: "Notes", render: (t) => <span style={{ fontSize: 12, color: "#605e5c" }}>{t.tagged}</span> },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>/</span> Threat tracker
      </div>
      <div className={styles.pageH1}>Threat Tracker ({threatTracker.length})</div>
      <div className={styles.pageSub}>Track active threats relevant to your tenant. Microsoft adds + you tag custom.</div>

      <DataTable columns={columns} rows={threatTracker} getRowKey={(t) => t.name} emptyMessage="No tracked threats." />
    </div>
  );
}

// ===== 6. Investigations (AIR) =====
// Source renders this tab as static hardcoded HTML (not stored in state) —
// ported as static reference content here, matching that convention exactly.
type AirInvestigation = {
  id: string;
  triggeredBy: string;
  severity: "High" | "Medium";
  status: string;
  pendingActions: string;
  autoActions: string;
};

const AIR_INVESTIGATIONS: AirInvestigation[] = [
  { id: "INV-2026-04127", triggeredBy: "Phish campaign 2645382", severity: "High", status: "Awaiting approval", pendingActions: "Quarantine 14 messages, block 4 IPs", autoActions: "Notified users (14), opened tickets" },
  { id: "INV-2026-04108", triggeredBy: "Malware in attachment", severity: "High", status: "Completed", pendingActions: "None", autoActions: "Quarantined 3 messages, isolated 1 device, force-reset 1 user password" },
  { id: "INV-2026-04062", triggeredBy: "Compromised user (Risky Sign-in)", severity: "High", status: "Completed", pendingActions: "None", autoActions: "Disabled user, revoked sessions, reset password, opened HR ticket" },
];

const AIR_PLAYBOOK_STEPS: { title: string; detail: string }[] = [
  { title: "Alert ingestion", detail: "high-confidence alert triggers investigation" },
  { title: "Evidence gathering", detail: "collect: email metadata, attachment hashes, URLs, sender IPs, recipient mailbox state, device endpoints, user identity context" },
  { title: "ML scoring", detail: "Microsoft's ML scores threat 0-100 across multiple dimensions" },
  { title: "Playbook recommendations", detail: 'auto-suggest actions (or auto-execute if "Auto remediate" enabled)' },
  { title: "Admin review", detail: "analyst sees timeline + can approve/reject each action" },
  { title: "Action execution", detail: "quarantine, ZAP, isolate device, disable user, etc." },
  { title: "Resolution + lessons", detail: "close investigation, document for next time" },
];

export function EmailInvestigationsPage() {
  const columns: DataTableColumn<AirInvestigation>[] = [
    { key: "id", header: "Investigation ID", render: (i) => <span className={styles.rowLink}>{i.id}</span> },
    { key: "triggeredBy", header: "Triggered by", render: (i) => i.triggeredBy },
    { key: "severity", header: "Severity", render: (i) => <SeverityBadge severity={i.severity} /> },
    { key: "status", header: "Status", render: (i) => <StatusPill tone={i.status === "Completed" ? "ok" : "warn"}>{i.status}</StatusPill> },
    { key: "pendingActions", header: "Pending actions", render: (i) => i.pendingActions },
    { key: "autoActions", header: "Auto-actions taken", render: (i) => <span style={{ fontSize: 12 }}>{i.autoActions}</span> },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>/</span> Investigations (AIR)
      </div>
      <div className={styles.pageH1}>Auto-Investigation &amp; Response (AIR)</div>
      <div className={styles.pageSub}>
        Defender for Office 365 P2 feature. When a high-fidelity alert fires, AIR auto-runs a playbook: collect evidence, analyze with ML, recommend or execute
        remediation.
      </div>

      <DataTable columns={columns} rows={AIR_INVESTIGATIONS} getRowKey={(i) => i.id} emptyMessage="No investigations." />

      <div className={styles.h2}>AIR playbook steps (per investigation)</div>
      <ol style={{ fontSize: 13, color: "#605e5c", lineHeight: 1.7 }}>
        {AIR_PLAYBOOK_STEPS.map((step) => (
          <li key={step.title}>
            <b>{step.title}</b> — {step.detail}
          </li>
        ))}
      </ol>
    </div>
  );
}
