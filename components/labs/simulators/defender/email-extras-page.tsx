"use client";

// Email extras — ported from itbd-lab/simulators/defender/js/defender-email-extras.js
// (renderTAB / renderQuarantine / renderExplorer). Considered the best-realized
// CRUD surface in the source suite: Tenant Allow/Block List is real CRUD over
// senders/urls/files, Quarantine has a genuine release/report flow (including
// the "Release + allow sender" cross-feature side effect that also creates a
// Tenant Allow/Block entry — implemented in defenderReducer's
// RELEASE_QUARANTINE_MESSAGE case), and Threat Explorer is a filterable set of
// canned pivot-view result tables (illustrative reference data in source, same
// as here — unlike Advanced Hunting, which is a real query engine).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderCannedResultTable, DefenderState, DefenderTabEntry } from "@/lib/labs/simulators/defender/types";
import type { DefenderAction, DefenderTabList } from "@/lib/labs/simulators/defender/reducer";
import { Checkbox, DataTable, EmptyState, Field, Modal, NativeSelect, SubTabBar, type DataTableColumn } from "./defender-ui";
import { StatusPill, statusTone } from "./defender-ui";
import styles from "./defender-console.module.css";

// ===================================================================
// 1) Tenant Allow/Block List
// ===================================================================

const TAB_TABS: { key: DefenderTabList; label: string }[] = [
  { key: "senders", label: "Senders + domains" },
  { key: "urls", label: "URLs" },
  { key: "files", label: "Files (hashes)" },
];

const TAB_VALUE_LABEL: Record<DefenderTabList, string> = {
  senders: "Sender / domain",
  urls: "URL",
  files: "SHA-256",
};

const TAB_VALUE_PLACEHOLDER: Record<DefenderTabList, string> = {
  senders: "e.g. newsletters@vendor.com or *.example.com",
  urls: "e.g. https://host/path or https://host/*",
  files: "e.g. SHA-256 hash",
};

function newTabEntryId(list: DefenderTabList): string {
  return `${list[0]}-${Date.now().toString(36)}`;
}

function emptyTabDraft(list: "Allow" | "Block"): { value: string; list: "Allow" | "Block"; reason: string; expiresOn: string } {
  return {
    value: "",
    list,
    reason: list === "Allow" ? "Business-approved exception" : "Confirmed malicious",
    expiresOn: list === "Allow" ? new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) : "Never",
  };
}

export function TenantAllowBlockPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [tabView, setTabView] = useState<DefenderTabList>("senders");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(emptyTabDraft("Allow"));
  const [deleteTarget, setDeleteTarget] = useState<DefenderTabEntry | null>(null);

  const list = state.tenantAllowBlock[tabView];

  function openAdd() {
    setDraft(emptyTabDraft("Allow"));
    setAddOpen(true);
  }

  function saveAdd() {
    if (!draft.value.trim()) {
      toast.error(`${TAB_VALUE_LABEL[tabView]} is required.`);
      return;
    }
    if (!draft.reason.trim()) {
      toast.error("Reason is required (audit trail).");
      return;
    }
    const entry: DefenderTabEntry = {
      id: newTabEntryId(tabView),
      value: draft.value.trim(),
      list: draft.list,
      reason: draft.reason.trim(),
      expiresOn: draft.expiresOn.trim() || "Never",
      addedBy: "admin@itbd.net",
      addedOn: new Date().toISOString().slice(0, 10),
    };
    dispatch({ type: "ADD_TAB_ENTRY", list: tabView, entry });
    toast.success(`Added ${entry.list} for ${entry.value}`);
    setAddOpen(false);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    // deleteTarget may belong to a different sub-tab than the one currently
    // selected — always resolve which list it actually lives in.
    const owningList: DefenderTabList =
      state.tenantAllowBlock.senders.some((e) => e.id === deleteTarget.id)
        ? "senders"
        : state.tenantAllowBlock.urls.some((e) => e.id === deleteTarget.id)
          ? "urls"
          : "files";
    dispatch({ type: "DELETE_TAB_ENTRY", list: owningList, id: deleteTarget.id });
    toast.success("Entry removed.");
    setDeleteTarget(null);
  }

  const columns: DataTableColumn<DefenderTabEntry>[] = [
    {
      key: "value",
      header: TAB_VALUE_LABEL[tabView],
      render: (e) => <code style={{ fontFamily: "Consolas, monospace", fontSize: 12, wordBreak: "break-all" }}>{e.value}</code>,
    },
    { key: "list", header: "List", render: (e) => <StatusPill tone={e.list === "Allow" ? "ok" : "err"}>{e.list}</StatusPill> },
    { key: "reason", header: "Reason", render: (e) => <span style={{ fontSize: 12 }}>{e.reason}</span> },
    { key: "expiresOn", header: "Expires", render: (e) => <span style={{ fontSize: 12 }}>{e.expiresOn}</span> },
    {
      key: "added",
      header: "Added by / on",
      render: (e) => (
        <span style={{ fontSize: 11, color: "var(--df-muted, #605e5c)" }}>
          {e.addedBy}
          <br />
          {e.addedOn}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (e) => (
        <button
          type="button"
          className={styles.btnSubtle}
          onClick={(ev) => {
            ev.stopPropagation();
            setDeleteTarget(e);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <span>Home</span>
        <span>&gt;</span>
        <span>Email + collab</span>
        <span>&gt;</span>
        <span>Tenant Allow / Block List</span>
      </div>
      <div className={styles.pageH1}>Tenant Allow / Block List</div>
      <div className={styles.pageSub}>
        Tenant-wide allow + block rules for senders, URLs, and file hashes. Allow entries override anti-phish + anti-spam verdicts; Block entries reject
        messages outright. Use sparingly — Defender ML is more accurate at scale.
      </div>

      <SubTabBar tabs={TAB_TABS.map((t) => ({ key: t.key, label: `${t.label} (${state.tenantAllowBlock[t.key].length})` }))} active={tabView} onChange={(k) => setTabView(k as DefenderTabList)} />

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button type="button" className={styles.btnPrimary} onClick={openAdd}>
          + Add entry
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState message="No entries." />
      ) : (
        <DataTable columns={columns} rows={list} getRowKey={(e) => e.id} emptyMessage="No entries." />
      )}

      <div className={styles.tip}>
        <strong>Expiry hint:</strong> Auto-expire incident-driven blocks after 30-90 days. Standing blocks for known-bad domains can be Never-expire. Allows
        always need expiry — review quarterly so they don&apos;t turn into a backdoor.
      </div>

      {addOpen ? (
        <Modal title={`Add ${TAB_VALUE_LABEL[tabView]} entry`} onClose={() => setAddOpen(false)} width="480px" footer={
          <>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="button" className={styles.btnPrimary} onClick={saveAdd}>
              Add entry
            </button>
          </>
        }>
          <Field label={TAB_VALUE_LABEL[tabView]}>
            <input
              className={styles.input}
              value={draft.value}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
              placeholder={TAB_VALUE_PLACEHOLDER[tabView]}
            />
          </Field>
          <Field label="List">
            <NativeSelect
              value={draft.list}
              onChange={(value) =>
                setDraft((d) => ({
                  ...d,
                  list: value as "Allow" | "Block",
                  reason: value === "Allow" ? "Business-approved exception" : "Confirmed malicious",
                  expiresOn: value === "Allow" ? new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) : "Never",
                }))
              }
              options={[
                { value: "Allow", label: "Allow — override Defender verdict" },
                { value: "Block", label: "Block — reject outright" },
              ]}
            />
          </Field>
          <Field label="Reason" help="Audit-required.">
            <input className={styles.input} value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} />
          </Field>
          <Field label="Expires on" help='YYYY-MM-DD or "Never".'>
            <input className={styles.input} value={draft.expiresOn} onChange={(e) => setDraft((d) => ({ ...d, expiresOn: e.target.value }))} />
          </Field>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Remove entry?" onClose={() => setDeleteTarget(null)} width="420px" footer={
          <>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className={styles.btn} onClick={confirmDelete}>
              Remove
            </button>
          </>
        }>
          Remove <code>{deleteTarget.value}</code> from the {deleteTarget.list} list? This action can&apos;t be undone.
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// 2) Quarantine
// ===================================================================

type QFilter = "pending" | "released" | "reported" | "all";

const REPORT_VERDICTS: { value: NonNullable<DefenderState["quarantine"]["items"][number]["reportVerdict"]>; label: string }[] = [
  { value: "False positive", label: "False positive (should not have been quarantined)" },
  { value: "Phish", label: "Confirmed phish" },
  { value: "Spam", label: "Confirmed spam" },
  { value: "Malware", label: "Confirmed malware" },
  { value: "Other", label: "Other" },
];

export function QuarantinePage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [qFilter, setQFilter] = useState<QFilter>("pending");
  const [releaseTarget, setReleaseTarget] = useState<DefenderState["quarantine"]["items"][number] | null>(null);
  const [allowSenderChecked, setAllowSenderChecked] = useState(false);
  const [reportTarget, setReportTarget] = useState<DefenderState["quarantine"]["items"][number] | null>(null);
  const [verdict, setVerdict] = useState<NonNullable<DefenderState["quarantine"]["items"][number]["reportVerdict"]>>("False positive");

  const items = state.quarantine.items;

  const counts = useMemo(
    () => ({
      pending: items.filter((x) => x.status === "Pending").length,
      released: items.filter((x) => x.status.startsWith("Released")).length,
      reported: items.filter((x) => x.status === "Reported to Microsoft").length,
      all: items.length,
    }),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((x) => {
        if (qFilter === "pending") return x.status === "Pending";
        if (qFilter === "released") return x.status.startsWith("Released");
        if (qFilter === "reported") return x.status === "Reported to Microsoft";
        return true;
      }),
    [items, qFilter],
  );

  function openRelease(msg: DefenderState["quarantine"]["items"][number]) {
    setAllowSenderChecked(false);
    setReleaseTarget(msg);
  }

  function confirmRelease() {
    if (!releaseTarget) return;
    dispatch({ type: "RELEASE_QUARANTINE_MESSAGE", id: releaseTarget.id, allowSender: allowSenderChecked });
    toast.success(
      `Message released to ${releaseTarget.recipient}${
        allowSenderChecked ? ` — sender ${releaseTarget.sender} was also added to the Tenant Allow/Block List (Allow, 90-day expiry)` : ""
      }`,
    );
    setReleaseTarget(null);
  }

  function openReport(msg: DefenderState["quarantine"]["items"][number]) {
    setVerdict("False positive");
    setReportTarget(msg);
  }

  function confirmReport() {
    if (!reportTarget) return;
    dispatch({ type: "REPORT_QUARANTINE_MESSAGE", id: reportTarget.id, verdict });
    toast.success(`Reported to Microsoft as ${verdict} — feeds into Defender ML retraining.`);
    setReportTarget(null);
  }

  const columns: DataTableColumn<DefenderState["quarantine"]["items"][number]>[] = [
    { key: "id", header: "Msg ID", render: (q) => <strong>{q.id}</strong> },
    { key: "received", header: "Received", render: (q) => <span style={{ fontSize: 12 }}>{q.received}</span> },
    { key: "sender", header: "Sender", render: (q) => <code style={{ fontSize: 12 }}>{q.sender}</code> },
    { key: "recipient", header: "Recipient", render: (q) => <code style={{ fontSize: 12 }}>{q.recipient}</code> },
    {
      key: "subject",
      header: "Subject",
      render: (q) => (
        <span style={{ fontSize: 12, display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {q.subject}
        </span>
      ),
    },
    {
      key: "policy",
      header: "Policy / reason",
      render: (q) => (
        <span style={{ fontSize: 11, color: "var(--df-muted, #605e5c)" }}>
          {q.policy}
          <br />
          {q.reason}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (q) => <StatusPill tone={statusTone(q.status)}>{q.status}</StatusPill> },
    {
      key: "actions",
      header: "Actions",
      render: (q) =>
        q.status === "Pending" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={styles.btnSubtle} onClick={() => openRelease(q)}>
              Release
            </button>
            <button type="button" className={styles.btnSubtle} onClick={() => openReport(q)}>
              Report
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "var(--df-muted, #605e5c)" }}>
            {q.status === "Released by admin" && q.releasedOn ? `Released ${q.releasedOn}` : q.reportVerdict ? `Verdict: ${q.reportVerdict}` : "-"}
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <span>Home</span>
        <span>&gt;</span>
        <span>Email + collab</span>
        <span>&gt;</span>
        <span>Quarantine</span>
      </div>
      <div className={styles.pageH1}>Quarantine</div>
      <div className={styles.pageSub}>
        Messages held by Defender for Office 365 due to policy match. Admins can release (deliver to inbox), submit as false positive, or report-and-allow
        the sender.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        {(
          [
            ["pending", "Pending review", counts.pending],
            ["released", "Released", counts.released],
            ["reported", "Reported", counts.reported],
            ["all", "All", counts.all],
          ] as [QFilter, string, number][]
        ).map(([key, label, count]) => (
          <StatusPill key={key} tone={qFilter === key ? "info" : "muted"}>
            <button
              type="button"
              onClick={() => setQFilter(key)}
              style={{ background: "none", border: 0, color: "inherit", font: "inherit", cursor: "pointer", padding: 0 }}
            >
              {label} ({count})
            </button>
          </StatusPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No quarantined messages match." />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(q) => q.id} emptyMessage="No quarantined messages match." />
      )}

      <div className={styles.tip}>
        <strong>SLA reminder:</strong> Quarantine retains messages 30 days (configurable up to 90). Admin-released messages bypass anti-phish + anti-spam
        for the recipient but still go through anti-malware. Always investigate the sender domain before &quot;Release + allow sender&quot; — that
        promote-to-Allow-List is a common backdoor.
      </div>

      {releaseTarget ? (
        <Modal
          title="Release quarantined message"
          onClose={() => setReleaseTarget(null)}
          width="480px"
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setReleaseTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmRelease}>
                Release message
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Release message <strong>{releaseTarget.id}</strong> to <code>{releaseTarget.recipient}</code>&apos;s inbox?
          </p>
          <Checkbox
            label={`Also allow this sender (${releaseTarget.sender})`}
            checked={allowSenderChecked}
            onChange={setAllowSenderChecked}
          />
          {allowSenderChecked ? (
            <div className={styles.tip} style={{ marginTop: 10 }}>
              <strong>This also creates a Tenant Allow/Block List entry:</strong> {releaseTarget.sender} will be added to the Senders + domains Allow list
              for 90 days, bypassing Defender for ALL future messages from this sender. Confirm only if you have verified the sender is legitimate.
            </div>
          ) : null}
        </Modal>
      ) : null}

      {reportTarget ? (
        <Modal
          title="Report to Microsoft"
          onClose={() => setReportTarget(null)}
          width="460px"
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setReportTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmReport}>
                Submit report
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Report message <strong>{reportTarget.id}</strong> to Microsoft as:
          </p>
          <Field label="Verdict">
            <NativeSelect
              value={verdict}
              onChange={(value) => setVerdict(value as NonNullable<DefenderState["quarantine"]["items"][number]["reportVerdict"]>)}
              options={REPORT_VERDICTS}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// 3) Threat Explorer
// ===================================================================
//
// NOTE for the page-wiring step: Threat Explorer has no dedicated slot in
// DefenderShell's `DefenderPage` union (only "email-tenant-allow-block" and
// "email-quarantine" exist for this file's other two pages). Source treats
// Threat Explorer's results as illustrative canned reference tables (unlike
// Advanced Hunting's real query engine), so this component is exported
// standalone here for a later step to mount — it may naturally belong
// alongside "email-explorer" from the Email & Collaboration cluster, or get
// its own page id (e.g. "email-threat-explorer") added to the union.

type ExplorerType = "all-email" | "phish" | "malware" | "spam" | "submissions" | "content-malware" | "urls";
type ExplorerView = "top-senders" | "top-recipients" | "top-urls" | "detection-tech" | "delivery-action" | "country";
type ExplorerRange = "24h" | "7d" | "30d" | "90d";

const EXPLORER_TYPE_OPTIONS: { value: ExplorerType; label: string }[] = [
  { value: "all-email", label: "all-email" },
  { value: "phish", label: "phish" },
  { value: "malware", label: "malware" },
  { value: "spam", label: "spam" },
  { value: "submissions", label: "submissions" },
  { value: "content-malware", label: "content-malware" },
  { value: "urls", label: "urls" },
];

const EXPLORER_VIEW_OPTIONS: { value: ExplorerView; label: string }[] = [
  { value: "top-senders", label: "Top senders" },
  { value: "top-recipients", label: "Top recipients" },
  { value: "top-urls", label: "Top URLs" },
  { value: "detection-tech", label: "Detection technology" },
  { value: "delivery-action", label: "Delivery action" },
  { value: "country", label: "Sender country" },
];

const EXPLORER_RANGE_OPTIONS: { value: ExplorerRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days (P2)" },
];

// Canned pivot-view result tables — ported verbatim from source's
// explorerResults(). These are illustrative reference data, not derived from
// DefenderState (source itself treats Threat Explorer results as cosmetic,
// distinct from Advanced Hunting's now-real query engine).
const EXPLORER_TABLES: Record<ExplorerView, DefenderCannedResultTable> = {
  "top-senders": {
    headers: ["Sender", "Messages", "Phish hits", "Malware hits", "Recipients reached"],
    rows: [
      ["paypal-secure.tk", "142", "142", "0", "24"],
      ["microsoft-account-team.com", "89", "89", "0", "78"],
      ["support@cloudlab.in.tk", "47", "47", "0", "18"],
      ["invoice@vendor.com", "218", "0", "12", "4"],
      ["hr-notifications@cloudlab.in", "24", "0", "0", "247"],
    ],
  },
  "top-recipients": {
    headers: ["Recipient", "Phish targeted", "Malware targeted", "Delivered to inbox", "Quarantined"],
    rows: [
      ["admin@itbd.net", "18", "4", "8", "14"],
      ["cfo@cloudlab.in", "24", "2", "6", "20"],
      ["hr@cloudlab.in", "12", "0", "4", "8"],
      ["finance@cloudlab.in", "38", "8", "12", "34"],
      ["support@cloudlab.in", "11", "0", "11", "0"],
    ],
  },
  "top-urls": {
    headers: ["URL", "Click count", "Detection", "Action"],
    rows: [
      ["https://login-microsoft.tk/auth", "4", "Phishing kit (AiTM)", "Blocked at click (Safe Links)"],
      ["https://docusign-files.com/sign/abc", "12", "Legitimate", "Allowed"],
      ["https://paypal-secure.tk/reset", "8", "Phishing kit", "Blocked at click"],
      ["https://login.microsoft.com/oauth", "218", "Legitimate", "Allowed"],
      ["https://drive.google.com/file/...", "47", "Legitimate (mass-share)", "Allowed"],
    ],
  },
  "detection-tech": {
    headers: ["Detection technology", "Messages caught", "False positive rate", "Action"],
    rows: [
      ["Mailbox intelligence", "420", "0.4%", "Quarantine or Junk"],
      ["Domain impersonation", "184", "0.8%", "Quarantine"],
      ["User impersonation", "67", "0.2%", "Quarantine"],
      ["Spoof intelligence", "218", "1.2%", "Junk"],
      ["Safe Links (URL detonation)", "142", "0.1%", "Block at click"],
      ["Safe Attachments (sandbox)", "38", "0.0%", "Quarantine"],
      ["Standard ML classifier", "1,847", "2.1%", "SCL-based"],
    ],
  },
  "delivery-action": {
    headers: ["Delivery action", "Messages", "% of total"],
    rows: [
      ["Delivered to inbox", "128,418", "94.2%"],
      ["Delivered to Junk", "4,218", "3.1%"],
      ["Quarantined", "2,418", "1.8%"],
      ["Blocked (rejected at SMTP)", "1,184", "0.9%"],
      ["Replaced (link/attachment)", "24", "0.0%"],
    ],
  },
  country: {
    headers: ["Sender country", "Phish + malware messages"],
    rows: [
      ["United States (US)", "847"],
      ["India (IN)", "218"],
      ["Russia (RU)", "142"],
      ["Nigeria (NG)", "184"],
      ["China (CN)", "124"],
      ["Anonymous IP / Tor", "38"],
    ],
  },
};

type ExplorerFilter = { type: ExplorerType; view: ExplorerView; range: ExplorerRange; q: string };

function CannedTable({ table }: { table: DefenderCannedResultTable }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {table.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ThreatExplorerPage({ state: _state }: { state: DefenderState }) {
  const [filter, setFilter] = useState<ExplorerFilter>({ type: "all-email", view: "top-senders", range: "7d", q: "" });

  function patchFilter(patch: Partial<ExplorerFilter>) {
    setFilter((f) => ({ ...f, ...patch }));
  }

  function runQuery() {
    toast.success(`Query executed — showing ${filter.range} for ${filter.type}`);
  }

  function exportCsvResults() {
    toast.success("Threat Explorer results exported. CSV downloaded.");
  }

  function saveQuery() {
    const name = window.prompt("Save query as:");
    if (name) toast.success(`Saved as "${name}"`);
  }

  function createCustomDetection() {
    toast.info("Opening Custom detection rule wizard with this query pre-filled…");
  }

  const table = EXPLORER_TABLES[filter.view];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <span>Home</span>
        <span>&gt;</span>
        <span>Email + collab</span>
        <span>&gt;</span>
        <span>Threat Explorer</span>
      </div>
      <div className={styles.pageH1}>Threat Explorer (Defender for Office 365 P2)</div>
      <div className={styles.pageSub}>
        Deep filter + pivot view across email + Teams + SharePoint events. Equivalent of Sentinel hunting for the O365 estate. Slice by sender / recipient /
        URL / subject / detection technology / delivery action.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, margin: "14px 0" }}>
        <Field label="Threat type">
          <NativeSelect value={filter.type} onChange={(value) => patchFilter({ type: value as ExplorerType })} options={EXPLORER_TYPE_OPTIONS} />
        </Field>
        <Field label="Pivot view">
          <NativeSelect value={filter.view} onChange={(value) => patchFilter({ view: value as ExplorerView })} options={EXPLORER_VIEW_OPTIONS} />
        </Field>
        <Field label="Time range">
          <NativeSelect value={filter.range} onChange={(value) => patchFilter({ range: value as ExplorerRange })} options={EXPLORER_RANGE_OPTIONS} />
        </Field>
        <Field label="Filter expression">
          <input
            className={styles.input}
            style={{ fontFamily: "Consolas, monospace" }}
            placeholder="sender:contoso.tk -recipient:cfo@"
            value={filter.q}
            onChange={(e) => patchFilter({ q: e.target.value })}
          />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button type="button" className={styles.btnPrimary} onClick={runQuery}>
          Run query
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={exportCsvResults}>
          Export results (CSV)
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={saveQuery}>
          Save query
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={createCustomDetection}>
          Create custom detection from query
        </button>
      </div>

      <CannedTable table={table} />
    </div>
  );
}
