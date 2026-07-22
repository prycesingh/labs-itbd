"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365DistributionGroup, M365Mailbox, M365State, M365TransportRule } from "@/lib/labs/simulators/m365/types";
import { Flyout, FormGroup, Modal, Pill, UsageBar, WizStep } from "./m365-ui";
import styles from "./m365-console.module.css";

type Tab = "recipients" | "mailflow" | "trace" | "protection";
type RecipientsSub = "mailboxes" | "groups";
type MailflowSub = "rules" | "domains" | "connectors" | "remote";
type MailboxFlyoutTab = "general" | "features" | "addresses";

type TraceStatus = "Delivered" | "Quarantined" | "Rejected";

type TraceStep = {
  label: string;
  status: "pass" | "fail" | "skip";
  detail: string;
};

type TracedMessage = {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  status: TraceStatus;
  time: string;
  sizeKb: number;
  steps: TraceStep[];
};

const CONDITION_OPTIONS = [
  "Sender is external",
  "Recipient is in Finance-Team",
  "Attachment extension matches .exe;.bat;.scr;.js;.ps1",
  "Subject contains specific words",
  "Message size is greater than 10 MB",
  "Sender is internal AND ForwardedToExternal",
];

const ACTION_OPTIONS = [
  "Reject with NDR",
  "Prepend warning banner",
  "Apply Microsoft Purview Message Encryption",
  "Redirect to recipient",
  "Block message and notify sender",
  "Set X-Header for downstream DLP",
];

function buildCleanTrace(sender: string, recipient: string, subject: string): TraceStep[] {
  return [
    { label: "Receive", status: "pass", detail: "Received over TLS 1.3 from a recognized sending host." },
    { label: "SPF", status: "pass", detail: "PASS — sending IP authorized by the domain's SPF record." },
    { label: "DKIM", status: "pass", detail: "PASS — signature valid, selector1, alignment=relaxed." },
    { label: "DMARC", status: "pass", detail: "PASS — aligned via SPF and DKIM." },
    { label: "Spam scan", status: "pass", detail: "SCL=1 (not spam). Bulk complaint level low." },
    { label: "Anti-phish", status: "pass", detail: "No impersonation or spoof-intelligence match." },
    { label: "Safe Links", status: "pass", detail: "URLs scanned, no threats found; links wrapped." },
    { label: "Transport rule", status: "pass", detail: "External warning banner rule matched and applied." },
    { label: "Routing", status: "pass", detail: `Routed to mailbox database for ${recipient}.` },
    { label: "Delivered", status: "pass", detail: `Delivered to inbox. Subject: "${subject}".` },
  ];
}

function buildPhishTrace(sender: string): TraceStep[] {
  return [
    { label: "Receive", status: "pass", detail: `Received from ${sender.split("@")[1] ?? "unknown host"} over opportunistic TLS, no PTR record.` },
    { label: "SPF", status: "fail", detail: "FAIL — sending IP not authorized for the claimed domain." },
    { label: "DKIM", status: "fail", detail: "NONE — no DKIM signature present." },
    { label: "DMARC", status: "fail", detail: "FAIL — p=quarantine; SPF and DKIM both failed alignment." },
    { label: "Spam scan", status: "skip", detail: "Skipped — message already flagged by anti-phish." },
    { label: "Anti-phish", status: "fail", detail: "HIGH CONFIDENCE PHISH — domain impersonation + spoofed display name." },
    { label: "Safe Links", status: "skip", detail: "Skipped — message quarantined before link scan." },
    { label: "Transport rule", status: "skip", detail: "Skipped — quarantine action took precedence." },
    { label: "Routing", status: "skip", detail: "Skipped — not routed to a mailbox." },
    { label: "Quarantined", status: "fail", detail: "Moved to quarantine. Notification sent to security team; admin release only." },
  ];
}

function buildRejectedTrace(): TraceStep[] {
  return [
    { label: "Receive", status: "pass", detail: "Received over TLS 1.2 from an external mail server." },
    { label: "SPF", status: "pass", detail: "PASS — sending IP authorized." },
    { label: "DKIM", status: "pass", detail: "PASS — signature valid." },
    { label: "DMARC", status: "pass", detail: "PASS — aligned." },
    { label: "Spam scan", status: "pass", detail: "SCL=0 (clean)." },
    { label: "Anti-phish", status: "pass", detail: "No impersonation signals." },
    { label: "Safe Links", status: "skip", detail: "Skipped — no URLs in message body." },
    { label: "Transport rule", status: "fail", detail: "Rule \"Block executable attachments\" matched .exe attachment. Action: Reject with NDR." },
    { label: "Routing", status: "skip", detail: "Skipped — message rejected before routing." },
    { label: "Rejected", status: "fail", detail: "SMTP 5.7.1 — message rejected, NDR returned to sender." },
  ];
}

function buildSpamTrace(): TraceStep[] {
  return [
    { label: "Receive", status: "pass", detail: "Received over opportunistic TLS, no reverse DNS." },
    { label: "SPF", status: "fail", detail: "SOFTFAIL — sender domain SPF record ends in ~all." },
    { label: "DKIM", status: "skip", detail: "Skipped — no signature to validate." },
    { label: "DMARC", status: "fail", detail: "FAIL — softfail plus missing DKIM." },
    { label: "Spam scan", status: "fail", detail: "SCL=6 (likely spam). Bulk complaint level 8." },
    { label: "Anti-phish", status: "pass", detail: "No impersonation match, but spam verdict already applied." },
    { label: "Safe Links", status: "pass", detail: "1 of 3 URLs flagged on detonation; message still routed to Junk." },
    { label: "Transport rule", status: "skip", detail: "No transport rule matched." },
    { label: "Routing", status: "pass", detail: "Routed to mailbox database." },
    { label: "Delivered", status: "pass", detail: "Delivered to Junk Email folder per anti-spam policy (BCL ≥ 7)." },
  ];
}

function seedTracedMessages(state: M365State): TracedMessage[] {
  const users = state.users;
  const u = (i: number) => users[i % users.length];
  const domain = state.tenant.domain;

  const rows: { sender: string; recipient: string; subject: string; status: TraceStatus; time: string; sizeKb: number; steps: TraceStep[] }[] = [
    {
      sender: u(0).upn,
      recipient: u(1).upn,
      subject: "Q3 roadmap review",
      status: "Delivered",
      time: "09:14:02",
      sizeKb: 142,
      steps: buildCleanTrace(u(0).upn, u(1).upn, "Q3 roadmap review"),
    },
    {
      sender: `invoice@partner-billing.com`,
      recipient: u(4).upn,
      subject: "Invoice #INV-88213 due",
      status: "Delivered",
      time: "09:02:41",
      sizeKb: 312,
      steps: buildCleanTrace("invoice@partner-billing.com", u(4).upn, "Invoice #INV-88213 due"),
    },
    {
      sender: `ceo-urgent@${state.tenant.domain.split(".")[0]}-secure.tk`,
      recipient: u(4).upn,
      subject: "URGENT: wire transfer approval needed",
      status: "Quarantined",
      time: "08:51:19",
      sizeKb: 38,
      steps: buildPhishTrace(`ceo-urgent@${state.tenant.domain.split(".")[0]}-secure.tk`),
    },
    {
      sender: u(6).upn,
      recipient: "external.vendor@partner.com",
      subject: "Build artifacts for release 4.2",
      status: "Rejected",
      time: "08:40:55",
      sizeKb: 4820,
      steps: buildRejectedTrace(),
    },
    {
      sender: "newsletter@bulk-marketing.net",
      recipient: u(2).upn,
      subject: "You've won a gift card!",
      status: "Delivered",
      time: "08:22:07",
      sizeKb: 12,
      steps: buildSpamTrace(),
    },
    {
      sender: u(3).upn,
      recipient: u(5).upn,
      subject: "Weekly status notes",
      status: "Delivered",
      time: "08:05:44",
      sizeKb: 24,
      steps: buildCleanTrace(u(3).upn, u(5).upn, "Weekly status notes"),
    },
    {
      sender: `support@login-verify-${domain.split(".")[0]}.ru`,
      recipient: u(7).upn,
      subject: "Your account will be suspended",
      status: "Quarantined",
      time: "07:48:30",
      sizeKb: 18,
      steps: buildPhishTrace(`support@login-verify-${domain.split(".")[0]}.ru`),
    },
    {
      sender: u(8).upn,
      recipient: "all-staff@" + domain,
      subject: "Town hall recording attached",
      status: "Delivered",
      time: "07:30:12",
      sizeKb: 920,
      steps: buildCleanTrace(u(8).upn, "all-staff@" + domain, "Town hall recording attached"),
    },
  ];

  return rows.map((r, i) => ({ id: `trace-${1000 + i}`, ...r }));
}

function traceStatusTone(status: TraceStatus): "ok" | "err" | "warn" {
  if (status === "Delivered") return "ok";
  if (status === "Quarantined") return "warn";
  return "err";
}

function dnsRecordsFor(domainName: string) {
  const short = domainName.split(".")[0];
  return {
    spf: `v=spf1 include:spf.protection.outlook.com -all`,
    dkimSelector1: `selector1-${short}._domainkey.${domainName} CNAME selector1-${short}-${domainName.replace(/\./g, "-")}._domainkey.cloudlab.onmicrosoft.com`,
    dkimSelector2: `selector2-${short}._domainkey.${domainName} CNAME selector2-${short}-${domainName.replace(/\./g, "-")}._domainkey.cloudlab.onmicrosoft.com`,
    dmarc: `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@${domainName}; fo=1`,
  };
}

export function ExchangePage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [tab, setTab] = useState<Tab>("recipients");
  const [recipientsSub, setRecipientsSub] = useState<RecipientsSub>("mailboxes");
  const [mailflowSub, setMailflowSub] = useState<MailflowSub>("rules");

  const [openMailboxUser, setOpenMailboxUser] = useState<string | null>(null);
  const [mailboxFlyoutTab, setMailboxFlyoutTab] = useState<MailboxFlyoutTab>("general");

  const [groupWizardOpen, setGroupWizardOpen] = useState(false);
  const [groupWizStep, setGroupWizStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState("");
  const [groupAlias, setGroupAlias] = useState("");
  const [groupType, setGroupType] = useState<M365DistributionGroup["type"]>("Distribution");
  const [groupHidden, setGroupHidden] = useState(false);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleCondition, setRuleCondition] = useState(CONDITION_OPTIONS[0]);
  const [ruleAction, setRuleAction] = useState(ACTION_OPTIONS[0]);
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  const [traceStatusFilter, setTraceStatusFilter] = useState<"" | TraceStatus>("");
  const [traceFrom, setTraceFrom] = useState("");
  const [traceTo, setTraceTo] = useState("");
  const [openTraceId, setOpenTraceId] = useState<string | null>(null);

  const tracedMessages = useMemo(() => seedTracedMessages(state), [state]);

  const openMailbox = openMailboxUser ? state.exchange.mailboxes.find((m) => m.user === openMailboxUser) ?? null : null;
  const editingRule = editingRuleId ? state.exchange.transportRules.find((r) => r.id === editingRuleId) ?? null : null;
  const openTrace = openTraceId ? tracedMessages.find((t) => t.id === openTraceId) ?? null : null;

  const filteredTraces = tracedMessages.filter((t) => {
    if (traceStatusFilter && t.status !== traceStatusFilter) return false;
    if (traceFrom && t.time < traceFrom) return false;
    if (traceTo && t.time > traceTo) return false;
    return true;
  });

  function openMailboxFlyout(user: string) {
    setOpenMailboxUser(user);
    setMailboxFlyoutTab("general");
  }

  function saveMailboxPatch(patch: Partial<M365Mailbox>) {
    if (!openMailboxUser) return;
    dispatch({ type: "UPDATE_MAILBOX", user: openMailboxUser, patch });
  }

  function openNewRule() {
    setEditingRuleId(null);
    setRuleName("");
    setRuleCondition(CONDITION_OPTIONS[0]);
    setRuleAction(ACTION_OPTIONS[0]);
    setRuleEnabled(true);
    setRuleModalOpen(true);
  }

  function openEditRule(rule: M365TransportRule) {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleCondition(rule.conditions);
    setRuleAction(rule.action);
    setRuleEnabled(rule.enabled);
    setRuleModalOpen(true);
  }

  function saveRule() {
    if (!ruleName.trim()) {
      toast.warning("Rule name is required.");
      return;
    }
    if (editingRuleId) {
      dispatch({ type: "UPDATE_TRANSPORT_RULE", id: editingRuleId, patch: { name: ruleName.trim(), conditions: ruleCondition, action: ruleAction, enabled: ruleEnabled } });
      toast.success("Rule updated.");
    } else {
      const priority = state.exchange.transportRules.length ? Math.max(...state.exchange.transportRules.map((r) => r.priority)) + 1 : 0;
      dispatch({
        type: "ADD_TRANSPORT_RULE",
        rule: { id: `tr-${Date.now()}`, name: ruleName.trim(), priority, enabled: ruleEnabled, conditions: ruleCondition, action: ruleAction },
      });
      toast.success("Rule created.");
    }
    setRuleModalOpen(false);
  }

  function toggleRule(rule: M365TransportRule) {
    dispatch({ type: "UPDATE_TRANSPORT_RULE", id: rule.id, patch: { enabled: !rule.enabled } });
  }

  function confirmDeleteRule() {
    if (!deleteRuleId) return;
    dispatch({ type: "DELETE_TRANSPORT_RULE", id: deleteRuleId });
    toast.success("Rule deleted.");
    setDeleteRuleId(null);
  }

  function openGroupWizard() {
    setGroupName("");
    setGroupAlias("");
    setGroupType("Distribution");
    setGroupHidden(false);
    setGroupWizStep(1);
    setGroupWizardOpen(true);
  }

  function commitGroupWizard() {
    if (!groupName.trim() || !groupAlias.trim()) {
      toast.warning("Name and alias are required.");
      return;
    }
    const email = `${groupAlias.trim()}@${state.tenant.domain}`;
    dispatch({ type: "ADD_DISTRIBUTION_GROUP", group: { name: groupName.trim(), email, members: 0, type: groupType, hiddenFromGAL: groupHidden } });
    toast.success(`Group "${groupName.trim()}" created.`);
    setGroupWizardOpen(false);
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Exchange admin center</h1>
      <p className={styles.pageSub}>Manage mailboxes, mail flow, message trace and message hygiene.</p>

      <div className={styles.subtabs}>
        {(["recipients", "mailflow", "trace", "protection"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.subtab} ${tab === t ? styles.subtabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "recipients" ? "Recipients" : t === "mailflow" ? "Mail flow" : t === "trace" ? "Message trace" : "Protection"}
          </button>
        ))}
      </div>

      {tab === "recipients" ? (
        <div>
          <div className={styles.subtabs}>
            <button type="button" className={`${styles.subtab} ${recipientsSub === "mailboxes" ? styles.subtabActive : ""}`} onClick={() => setRecipientsSub("mailboxes")}>
              Mailboxes
            </button>
            <button type="button" className={`${styles.subtab} ${recipientsSub === "groups" ? styles.subtabActive : ""}`} onClick={() => setRecipientsSub("groups")}>
              Distribution groups
            </button>
          </div>

          {recipientsSub === "mailboxes" ? (
            <div>
              <div className={styles.toolbar}>
                <span className={styles.muted}>{state.exchange.mailboxes.length} mailbox(es)</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Display name</th>
                      <th>Email</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Archive</th>
                      <th>Litigation hold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.exchange.mailboxes.map((m) => (
                      <tr key={m.user} onClick={() => openMailboxFlyout(m.user)}>
                        <td>
                          <span className={styles.rowLink}>{m.displayName}</span>
                        </td>
                        <td>{m.email}</td>
                        <td>{m.type}</td>
                        <td>
                          <UsageBar used={Number((m.sizeMB / 1024).toFixed(2))} total={m.quotaGB} />
                        </td>
                        <td>{m.archive ? <Pill tone="ok">On</Pill> : <Pill tone="muted">Off</Pill>}</td>
                        <td>{m.litigationHold ? <Pill tone="info">On</Pill> : <Pill tone="muted">Off</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.toolbar}>
                <button type="button" className={styles.tbBtn} onClick={openGroupWizard}>
                  + Add a group
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Type</th>
                      <th>Members</th>
                      <th>GAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.exchange.distributionGroups.map((g) => (
                      <tr key={g.name}>
                        <td>{g.name}</td>
                        <td>{g.email}</td>
                        <td>{g.type}</td>
                        <td>{g.members}</td>
                        <td>{g.hiddenFromGAL ? <Pill tone="warn">Hidden</Pill> : <Pill tone="ok">Visible</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "mailflow" ? (
        <div>
          <div className={styles.subtabs}>
            <button type="button" className={`${styles.subtab} ${mailflowSub === "rules" ? styles.subtabActive : ""}`} onClick={() => setMailflowSub("rules")}>
              Rules
            </button>
            <button type="button" className={`${styles.subtab} ${mailflowSub === "domains" ? styles.subtabActive : ""}`} onClick={() => setMailflowSub("domains")}>
              Accepted domains
            </button>
            <button type="button" className={`${styles.subtab} ${mailflowSub === "connectors" ? styles.subtabActive : ""}`} onClick={() => setMailflowSub("connectors")}>
              Connectors
            </button>
            <button type="button" className={`${styles.subtab} ${mailflowSub === "remote" ? styles.subtabActive : ""}`} onClick={() => setMailflowSub("remote")}>
              Remote domains
            </button>
          </div>

          {mailflowSub === "rules" ? (
            <div>
              <div className={styles.toolbar}>
                <button type="button" className={styles.tbBtn} onClick={openNewRule}>
                  + Add a rule
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Name</th>
                      <th>Conditions</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.exchange.transportRules.length ? (
                      [...state.exchange.transportRules]
                        .sort((a, b) => a.priority - b.priority)
                        .map((r) => (
                          <tr key={r.id}>
                            <td>{r.priority}</td>
                            <td>
                              <span className={styles.rowLink} onClick={() => openEditRule(r)}>
                                {r.name}
                              </span>
                            </td>
                            <td>{r.conditions}</td>
                            <td>{r.action}</td>
                            <td>{r.enabled ? <Pill tone="ok">Enabled</Pill> : <Pill tone="muted">Disabled</Pill>}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button type="button" className={styles.btnSubtle} onClick={() => toggleRule(r)}>
                                {r.enabled ? "Disable" : "Enable"}
                              </button>{" "}
                              <button type="button" className={styles.btnSubtle} onClick={() => setDeleteRuleId(r.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={6} className={styles.center}>
                          No transport rules.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {mailflowSub === "domains" ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  {state.exchange.acceptedDomains.map((d) => (
                    <tr key={d.name}>
                      <td>
                        {d.name} {d.isDefault ? <Pill tone="info">Default</Pill> : null}
                      </td>
                      <td>{d.type}</td>
                      <td>{d.isDefault ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {mailflowSub === "connectors" ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th>TLS</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.exchange.connectors.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.type}</td>
                      <td>{c.fromTo}</td>
                      <td>{c.tls}</td>
                      <td>{c.enabled ? <Pill tone="ok">Enabled</Pill> : <Pill tone="muted">Disabled</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {mailflowSub === "remote" ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Allow auto-reply</th>
                    <th>Allow OOF</th>
                  </tr>
                </thead>
                <tbody>
                  {state.exchange.remoteDomains.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.domain}</td>
                      <td>{r.allowAutoReply ? "Yes" : "No"}</td>
                      <td>{r.allowOOF ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "trace" ? (
        <div>
          <div className={styles.filterRow}>
            {(["", "Delivered", "Quarantined", "Rejected"] as ("" | TraceStatus)[]).map((s) => (
              <button
                key={s || "all"}
                type="button"
                className={`${styles.filterChip} ${traceStatusFilter === s ? styles.filterChipActive : ""}`}
                onClick={() => setTraceStatusFilter(s)}
              >
                {s || "All statuses"}
              </button>
            ))}
            <input
              className={styles.input}
              style={{ width: 130 }}
              type="text"
              placeholder="From HH:MM:SS"
              value={traceFrom}
              onChange={(e) => setTraceFrom(e.target.value)}
            />
            <input
              className={styles.input}
              style={{ width: 130 }}
              type="text"
              placeholder="To HH:MM:SS"
              value={traceTo}
              onChange={(e) => setTraceTo(e.target.value)}
            />
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Sender</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredTraces.length ? (
                  filteredTraces.map((t) => (
                    <tr key={t.id} onClick={() => setOpenTraceId(t.id)}>
                      <td className={styles.nowrap}>{t.time}</td>
                      <td>{t.sender}</td>
                      <td>{t.recipient}</td>
                      <td>
                        <span className={styles.rowLink}>{t.subject}</span>
                      </td>
                      <td>
                        <Pill tone={traceStatusTone(t.status)}>{t.status}</Pill>
                      </td>
                      <td>{t.sizeKb} KB</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.center}>
                      No messages match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "protection" ? (
        <div>
          <div className={styles.h3}>Email authentication (SPF / DKIM / DMARC)</div>
          {state.exchange.acceptedDomains.map((d) => {
            const recs = dnsRecordsFor(d.name);
            return (
              <div key={d.name} className={styles.card}>
                <div className={styles.cardTitle}>{d.name}</div>
                <div className={styles.reviewGrid}>
                  <div className="lbl">SPF (TXT @)</div>
                  <div>
                    <code>{recs.spf}</code>
                  </div>
                  <div className="lbl">DKIM selector1 (CNAME)</div>
                  <div>
                    <code>{recs.dkimSelector1}</code>
                  </div>
                  <div className="lbl">DKIM selector2 (CNAME)</div>
                  <div>
                    <code>{recs.dkimSelector2}</code>
                  </div>
                  <div className="lbl">DMARC (TXT _dmarc)</div>
                  <div>
                    <code>{recs.dmarc}</code>
                  </div>
                </div>
              </div>
            );
          })}

          <div className={styles.h3}>Anti-spam policies</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Applies to</th>
                  <th>Bulk complaint level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Default inbound</td>
                  <td>All users</td>
                  <td>7</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
                <tr>
                  <td>Strict — Executives</td>
                  <td>Executives group</td>
                  <td>4</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
                <tr>
                  <td>Default outbound</td>
                  <td>All users</td>
                  <td>—</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.h3}>Anti-phish policies</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Applies to</th>
                  <th>Mailbox intelligence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Default anti-phishing policy</td>
                  <td>All users</td>
                  <td>On</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
                <tr>
                  <td>Strict — Executives</td>
                  <td>Executives group</td>
                  <td>On</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.h3}>Safe Attachments / Safe Links</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Type</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Default policy</td>
                  <td>Safe Attachments</td>
                  <td>Dynamic delivery — sandbox in parallel</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
                <tr>
                  <td>Default policy</td>
                  <td>Safe Links</td>
                  <td>Rewrite URLs, track clicks, time-of-click protection</td>
                  <td>
                    <Pill tone="ok">Enabled</Pill>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {openMailbox ? (
        <Flyout
          title={openMailbox.displayName}
          onClose={() => setOpenMailboxUser(null)}
          tabs={
            <>
              {(["general", "features", "addresses"] as MailboxFlyoutTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.tab} ${mailboxFlyoutTab === t ? styles.tabActive : ""}`}
                  onClick={() => setMailboxFlyoutTab(t)}
                >
                  {t === "general" ? "General" : t === "features" ? "Mailbox features" : "Email addresses"}
                </button>
              ))}
            </>
          }
          footer={
            <button type="button" className={styles.btn} onClick={() => setOpenMailboxUser(null)}>
              Close
            </button>
          }
        >
          {mailboxFlyoutTab === "general" ? (
            <div className={styles.reviewGrid}>
              <div className="lbl">Display name</div>
              <div>{openMailbox.displayName}</div>
              <div className="lbl">Email</div>
              <div>{openMailbox.email}</div>
              <div className="lbl">Type</div>
              <div>{openMailbox.type}</div>
              <div className="lbl">Size</div>
              <div>
                {(openMailbox.sizeMB / 1024).toFixed(2)} GB / {openMailbox.quotaGB} GB
              </div>
            </div>
          ) : null}

          {mailboxFlyoutTab === "features" ? (
            <div>
              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={openMailbox.archive}
                  onChange={(e) => saveMailboxPatch({ archive: e.target.checked })}
                />
                Online archive enabled
              </div>
              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={openMailbox.litigationHold}
                  onChange={(e) => saveMailboxPatch({ litigationHold: e.target.checked })}
                />
                Litigation hold
              </div>
              <FormGroup label="Forwarding address" help="Leave blank to disable forwarding.">
                <input
                  className={styles.input}
                  type="text"
                  placeholder="user@otherdomain.com"
                  defaultValue={openMailbox.forwarding}
                  onBlur={(e) => saveMailboxPatch({ forwarding: e.target.value })}
                />
              </FormGroup>
            </div>
          ) : null}

          {mailboxFlyoutTab === "addresses" ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Type</th>
                    <th>Primary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{openMailbox.email}</td>
                    <td>SMTP</td>
                    <td>Yes</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </Flyout>
      ) : null}

      {groupWizardOpen ? (
        <Modal
          title="New group"
          onClose={() => setGroupWizardOpen(false)}
          width="600px"
          steps={
            <>
              <WizStep label="Identity & type" active={groupWizStep === 1} done={groupWizStep > 1} />
              <WizStep label="Mail flow & review" active={groupWizStep === 2} done={false} />
            </>
          }
          footer={
            groupWizStep === 1 ? (
              <>
                <button type="button" className={styles.btnOutline} onClick={() => setGroupWizardOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.btn} onClick={() => setGroupWizStep(2)}>
                  Next
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.btnOutline} onClick={() => setGroupWizStep(1)}>
                  Back
                </button>
                <button type="button" className={styles.btn} onClick={commitGroupWizard}>
                  Create
                </button>
              </>
            )
          }
        >
          {groupWizStep === 1 ? (
            <div>
              <FormGroup label="Display name *">
                <input className={styles.input} type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              </FormGroup>
              <FormGroup label="Alias *" help={`Email will be alias@${state.tenant.domain}`}>
                <input className={styles.input} type="text" value={groupAlias} onChange={(e) => setGroupAlias(e.target.value)} />
              </FormGroup>
              <FormGroup label="Group type">
                <select className={styles.select} value={groupType} onChange={(e) => setGroupType(e.target.value as M365DistributionGroup["type"])}>
                  <option value="Distribution">Distribution</option>
                  <option value="MailSecurity">Mail-enabled security</option>
                  <option value="DynamicDistribution">Dynamic distribution</option>
                </select>
              </FormGroup>
            </div>
          ) : (
            <div>
              <div className={styles.checkboxRow}>
                <input type="checkbox" checked={groupHidden} onChange={(e) => setGroupHidden(e.target.checked)} />
                Hide from Global Address List (GAL)
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Name</div>
                <div>{groupName || "(unset)"}</div>
                <div className="lbl">Email</div>
                <div>
                  {groupAlias || "(unset)"}@{state.tenant.domain}
                </div>
                <div className="lbl">Type</div>
                <div>{groupType}</div>
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      {ruleModalOpen ? (
        <Modal
          title={editingRule ? "Edit rule" : "New transport rule"}
          onClose={() => setRuleModalOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setRuleModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={saveRule}>
                Save
              </button>
            </>
          }
        >
          <FormGroup label="Name *">
            <input className={styles.input} type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
          </FormGroup>
          <FormGroup label="Apply if (conditions)">
            <select className={styles.select} value={ruleCondition} onChange={(e) => setRuleCondition(e.target.value)}>
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormGroup>
          <FormGroup label="Do the following (action)">
            <select className={styles.select} value={ruleAction} onChange={(e) => setRuleAction(e.target.value)}>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </FormGroup>
          <div className={styles.checkboxRow}>
            <input type="checkbox" checked={ruleEnabled} onChange={(e) => setRuleEnabled(e.target.checked)} />
            Rule is enabled
          </div>
        </Modal>
      ) : null}

      {deleteRuleId ? (
        <Modal
          title="Delete transport rule?"
          onClose={() => setDeleteRuleId(null)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setDeleteRuleId(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnDanger} onClick={confirmDeleteRule}>
                Delete
              </button>
            </>
          }
        >
          <p>This action cannot be undone.</p>
        </Modal>
      ) : null}

      {openTrace ? (
        <Modal title="Message trace detail" onClose={() => setOpenTraceId(null)} width="880px" footer={<button type="button" className={styles.btn} onClick={() => setOpenTraceId(null)}>Close</button>}>
          <div className={styles.reviewGrid}>
            <div className="lbl">Sender</div>
            <div>{openTrace.sender}</div>
            <div className="lbl">Recipient</div>
            <div>{openTrace.recipient}</div>
            <div className="lbl">Subject</div>
            <div>{openTrace.subject}</div>
            <div className="lbl">Time</div>
            <div>{openTrace.time}</div>
            <div className="lbl">Size</div>
            <div>{openTrace.sizeKb} KB</div>
            <div className="lbl">Status</div>
            <div>
              <Pill tone={traceStatusTone(openTrace.status)}>{openTrace.status}</Pill>
            </div>
          </div>

          <div className={styles.h3}>Delivery timeline</div>
          <div className={styles.traceTimeline}>
            {openTrace.steps.map((step, i) => (
              <div key={step.label} className={styles.traceStep}>
                <div className={styles.traceStepLine}>
                  {i > 0 ? <div className={styles.traceStepTrack} /> : <div style={{ flex: 1 }} />}
                  <div
                    className={`${styles.traceStepDot} ${step.status === "fail" ? styles.traceStepDotFail : step.status === "skip" ? styles.traceStepDotSkip : ""}`}
                  />
                  {i < openTrace.steps.length - 1 ? <div className={styles.traceStepTrack} /> : <div style={{ flex: 1 }} />}
                </div>
                <div className={styles.traceStepLabel}>{step.label}</div>
                <div className={styles.traceStepDesc}>{step.detail}</div>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
