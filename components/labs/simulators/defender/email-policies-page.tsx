"use client";

// Threat policies (Email & collaboration) — ported from
// itbd-lab/simulators/defender/js/defender-email-policies.js. Source renders
// 9 sub-blades (Overview, Anti-phish, Anti-malware, Anti-spam, Safe
// Attachments, Safe Links, Tenant Allow/Block summary, DKIM, Quarantine
// policy types) with policies held in non-persisted module-local arrays and
// mutated via `prompt()`. Per this sub-phase's scope decision, all policy
// CRUD here is real and persisted through the reducer (ADD_/UPDATE_/DELETE_
// actions added alongside this page), replacing source's throwaway arrays.
//
// Tenant Allow/Block is intentionally summary-only in this section (counts
// via StatTile) — the full entry-level list/CRUD lives on the dedicated
// "email-tenant-allow-block" page owned by a different agent. Quarantine
// *policy types* are read-only reference data here, matching source (no
// create/edit/delete UI in the real product for these 4 built-in types).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DefenderAntiMalwarePolicy,
  DefenderAntiPhishPolicy,
  DefenderAntiSpamInbound,
  DefenderAntiSpamOutbound,
  DefenderAntiSpamPolicy,
  DefenderConnectionFilterPolicy,
  DefenderSafeAttachmentsPolicy,
  DefenderSafeLinksPolicy,
  DefenderState,
} from "@/lib/labs/simulators/defender/types";
import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Modal,
  NativeSelect,
  StatRow,
  SubTabBar,
  type DataTableColumn,
} from "./defender-ui";
import styles from "./defender-console.module.css";

type Section =
  | "overview"
  | "anti-phish"
  | "anti-malware"
  | "anti-spam"
  | "safe-attach"
  | "safe-links"
  | "tabl"
  | "dkim"
  | "quarantine";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "anti-phish", label: "Anti-phishing" },
  { key: "anti-malware", label: "Anti-malware" },
  { key: "anti-spam", label: "Anti-spam" },
  { key: "safe-attach", label: "Safe Attachments" },
  { key: "safe-links", label: "Safe Links" },
  { key: "tabl", label: "Tenant Allow/Block" },
  { key: "dkim", label: "DKIM" },
  { key: "quarantine", label: "Quarantine policies" },
];

export function EmailPoliciesPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [section, setSection] = useState<Section>("overview");

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Email &amp; collaboration</a> <span>&gt;</span> Policies &amp; rules
      </div>
      <div className={styles.pageH1}>Threat policies</div>
      <div className={styles.pageSub}>Policies and rules that protect email and collaboration content from threats.</div>

      <SubTabBar tabs={SECTIONS} active={section} onChange={(key) => setSection(key as Section)} />

      {section === "overview" ? <OverviewSection state={state} onNavigate={setSection} /> : null}
      {section === "anti-phish" ? <AntiPhishSection state={state} dispatch={dispatch} /> : null}
      {section === "anti-malware" ? <AntiMalwareSection state={state} dispatch={dispatch} /> : null}
      {section === "anti-spam" ? <AntiSpamSection state={state} dispatch={dispatch} /> : null}
      {section === "safe-attach" ? <SafeAttachmentsSection state={state} dispatch={dispatch} /> : null}
      {section === "safe-links" ? <SafeLinksSection state={state} dispatch={dispatch} /> : null}
      {section === "tabl" ? <TablSummarySection state={state} /> : null}
      {section === "dkim" ? <DkimSection state={state} dispatch={dispatch} /> : null}
      {section === "quarantine" ? <QuarantineTypesSection state={state} /> : null}
    </div>
  );
}

// ===== Overview =====
function OverviewSection({ state, onNavigate }: { state: DefenderState; onNavigate: (section: Section) => void }) {
  const tablTotal =
    state.tenantAllowBlock.senders.length + state.tenantAllowBlock.urls.length + state.tenantAllowBlock.files.length;

  const tiles: { key: Section; title: string; count: string; sub: string }[] = [
    { key: "anti-phish", title: "Anti-phishing", count: `${state.antiPhishPolicies.length} policies`, sub: "Impersonation, mailbox intelligence, spoof, DMARC" },
    { key: "anti-malware", title: "Anti-malware", count: `${state.antiMalwarePolicies.length} policies`, sub: `${state.blockedFileExtensions.length} blocked extensions + zero-hour auto-purge` },
    { key: "anti-spam", title: "Anti-spam", count: `${state.antiSpamPolicies.length} policies`, sub: "Inbound + outbound + connection filter" },
    { key: "safe-attach", title: "Safe Attachments", count: `${state.safeAttachmentsPolicies.length} policies`, sub: "Sandbox detonation, Dynamic Delivery" },
    { key: "safe-links", title: "Safe Links", count: `${state.safeLinksPolicies.length} policies`, sub: "Real-time URL rewriting + click-through block" },
    { key: "tabl", title: "Tenant Allow/Block", count: `${tablTotal} entries`, sub: "Senders, URLs, and file-hash overrides" },
    { key: "dkim", title: "DKIM", count: `${state.dkimDomains.length} domains`, sub: "2048-bit keys, auto rotation" },
    { key: "quarantine", title: "Quarantine policies", count: `${state.quarantinePolicyTypes.length} policies`, sub: "End-user release permissions" },
  ];

  return (
    <div>
      <div className={styles.pageSub}>9 policy categories. Each policy assigned by priority — lower number wins. Default catch-all at the bottom.</div>
      <div className={styles.tileGrid}>
        {tiles.map((t) => (
          <div key={t.key} className={styles.tile} onClick={() => onNavigate(t.key)}>
            <div className={styles.tileTitle}>{t.title}</div>
            <div style={{ fontSize: 20, color: "#242424", margin: "4px 0" }}>{t.count}</div>
            <div className={styles.tileSub}>{t.sub}</div>
          </div>
        ))}
      </div>
      <div className={styles.tip} style={{ marginTop: 14 }}>
        <strong>Architect order of operations:</strong> Connection filter &rarr; IP allow/block first. Then Anti-malware (highest blocking severity).
        Then Anti-spam &rarr; Quarantine. Then Anti-phish + Safe Attachments + Safe Links in parallel. Always have a <strong>Strict policy</strong> for
        tier-0 (executives, finance) and a <strong>Standard policy</strong> for everyone.
      </div>
    </div>
  );
}

// ===== Shared bits =====
function kv(label: string, value: string) {
  return (
    <div key={label}>
      <span style={{ color: "#605e5c" }}>{label}:</span> <strong>{value || "—"}</strong>
    </div>
  );
}

function policyCardHeader(name: string, priority: string | number, users: string, status?: string) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <div>
        <strong style={{ color: "#d83b01" }}>{name}</strong>
        <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>
          Priority: {priority} &middot; Users: {users}
        </div>
      </div>
      {status ? (
        <span
          style={{
            background: status.startsWith("On") ? "#dff6dd" : "#fde7e9",
            color: status.startsWith("On") ? "#0e700e" : "#a4262c",
            padding: "2px 10px",
            borderRadius: 8,
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}

function ConfirmDeleteModal({ title, itemName, onCancel, onConfirm }: { title: string; itemName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className={styles.modalMask} onMouseDown={onCancel}>
      <div className={styles.modal} style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
        </div>
        <div className={styles.modalBody}>
          Are you sure you want to delete <strong>{itemName}</strong>? This action can&apos;t be undone.
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Anti-phish =====
function emptyAntiPhishPolicy(): DefenderAntiPhishPolicy {
  return {
    name: "",
    priority: 0,
    status: "On",
    users: "All users",
    settings: {
      phishingThreshold: "Standard (1)",
      impersonationProtection: { userImpersonationProtection: "Off", domainImpersonationProtection: "Off", trustedSenders: 0, trustedDomains: 0 },
      mailboxIntelligence: "On",
      spoofIntelligence: "On",
      honorDmarcPolicy: "On",
      actions: {
        onUserImpersonation: "Move to Junk",
        onDomainImpersonation: "Move to Junk",
        onMailboxIntelligence: "Move to Junk",
        onSpoof: "Move to Junk",
        onDmarcReject: "Quarantine",
      },
    },
  };
}

function AntiPhishSection({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [editing, setEditing] = useState<DefenderAntiPhishPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DefenderAntiPhishPolicy>(emptyAntiPhishPolicy());
  const [deleteTarget, setDeleteTarget] = useState<DefenderAntiPhishPolicy | null>(null);

  function openCreate() {
    setDraft(emptyAntiPhishPolicy());
    setCreating(true);
  }
  function openEdit(p: DefenderAntiPhishPolicy) {
    setDraft(JSON.parse(JSON.stringify(p)));
    setEditing(p);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
  }
  function save() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    if (editing) {
      dispatch({ type: "UPDATE_ANTI_PHISH_POLICY", name: editing.name, patch: draft });
      toast.success(`Anti-phish policy "${draft.name}" updated.`);
    } else {
      if (state.antiPhishPolicies.some((p) => p.name === draft.name)) {
        toast.error("A policy with that name already exists.");
        return;
      }
      dispatch({ type: "ADD_ANTI_PHISH_POLICY", policy: draft });
      toast.success(`Anti-phish policy "${draft.name}" created.`);
    }
    closeModal();
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_ANTI_PHISH_POLICY", name: deleteTarget.name });
    toast.success(`Anti-phish policy "${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className={styles.pageSub} style={{ margin: 0 }}>
          Detects impersonation of users/domains, mailbox-intelligence anomalies, spoof attempts, and DMARC-rejected mail.
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Create policy
        </button>
      </div>

      {state.antiPhishPolicies.length === 0 ? (
        <EmptyState message="No anti-phishing policies yet." />
      ) : (
        state.antiPhishPolicies.map((p) => {
          const s = p.settings;
          return (
            <div key={p.name} className={styles.card}>
              {policyCardHeader(p.name, p.priority, p.users, p.status)}
              <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
                {kv("Phishing threshold", s.phishingThreshold)}
                {kv("Mailbox intelligence", s.mailboxIntelligence)}
                {kv("Spoof intelligence", s.spoofIntelligence)}
                {kv("Honor DMARC reject", s.honorDmarcPolicy)}
              </div>
              <div className={styles.h3} style={{ color: "#d83b01" }}>
                Impersonation protection
              </div>
              <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
                {kv("User impersonation", s.impersonationProtection.userImpersonationProtection)}
                {kv("Domain impersonation", s.impersonationProtection.domainImpersonationProtection)}
                {kv("Trusted senders", String(s.impersonationProtection.trustedSenders))}
                {kv("Trusted domains", String(s.impersonationProtection.trustedDomains))}
                {s.impersonationProtection.protectedUsers ? kv("Protected users", s.impersonationProtection.protectedUsers.join(", ")) : null}
              </div>
              <div className={styles.h3} style={{ color: "#d83b01" }}>
                Actions when detected
              </div>
              <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
                {kv("On user impersonation", s.actions.onUserImpersonation)}
                {kv("On domain impersonation", s.actions.onDomainImpersonation)}
                {kv("On mailbox intelligence", s.actions.onMailboxIntelligence)}
                {kv("On spoof", s.actions.onSpoof)}
                {kv("On DMARC reject", s.actions.onDmarcReject)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => openEdit(p)}>
                  Edit
                </button>
                <button type="button" className={styles.btnSubtle} onClick={() => setDeleteTarget(p)}>
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}

      {creating || editing ? (
        <Modal title={editing ? `Edit anti-phish policy: ${editing.name}` : "Create anti-phish policy"} onClose={closeModal} width="640px"
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={save}>
                {editing ? "Save" : "Create policy"}
              </button>
            </>
          }
        >
          <Field label="Policy name">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!!editing} />
          </Field>
          <div className={styles.row}>
            <Field label="Apply to (users / group / domain)">
              <input className={styles.input} value={draft.users} onChange={(e) => setDraft({ ...draft, users: e.target.value })} />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={draft.status}
                onChange={(v) => setDraft({ ...draft, status: v as DefenderAntiPhishPolicy["status"] })}
                options={[
                  { value: "On", label: "On" },
                  { value: "On (default)", label: "On (default)" },
                ]}
              />
            </Field>
          </div>
          <Field label="Phishing threshold">
            <NativeSelect
              value={draft.settings.phishingThreshold}
              onChange={(v) => setDraft({ ...draft, settings: { ...draft.settings, phishingThreshold: v } })}
              options={[
                { value: "Standard (1)", label: "Standard (1)" },
                { value: "Aggressive (3)", label: "Aggressive (3)" },
                { value: "Most aggressive (4)", label: "Most aggressive (4)" },
              ]}
            />
          </Field>
          <div className={styles.row}>
            <Field label="User impersonation protection">
              <NativeSelect
                value={draft.settings.impersonationProtection.userImpersonationProtection}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    settings: { ...draft.settings, impersonationProtection: { ...draft.settings.impersonationProtection, userImpersonationProtection: v as "On" | "Off" } },
                  })
                }
                options={[
                  { value: "On", label: "On" },
                  { value: "Off", label: "Off" },
                ]}
              />
            </Field>
            <Field label="Domain impersonation protection">
              <NativeSelect
                value={draft.settings.impersonationProtection.domainImpersonationProtection}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    settings: { ...draft.settings, impersonationProtection: { ...draft.settings.impersonationProtection, domainImpersonationProtection: v as "On" | "Off" } },
                  })
                }
                options={[
                  { value: "On", label: "On" },
                  { value: "Off", label: "Off" },
                ]}
              />
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="Mailbox intelligence">
              <input className={styles.input} value={draft.settings.mailboxIntelligence} onChange={(e) => setDraft({ ...draft, settings: { ...draft.settings, mailboxIntelligence: e.target.value } })} />
            </Field>
            <Field label="Spoof intelligence">
              <input className={styles.input} value={draft.settings.spoofIntelligence} onChange={(e) => setDraft({ ...draft, settings: { ...draft.settings, spoofIntelligence: e.target.value } })} />
            </Field>
          </div>
          <Field label="On DMARC reject action">
            <input className={styles.input} value={draft.settings.actions.onDmarcReject} onChange={(e) => setDraft({ ...draft, settings: { ...draft.settings, actions: { ...draft.settings.actions, onDmarcReject: e.target.value } } })} />
          </Field>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteModal title="Delete anti-phish policy?" itemName={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      ) : null}
    </div>
  );
}

// ===== Anti-malware =====
function emptyAntiMalwarePolicy(): DefenderAntiMalwarePolicy {
  return {
    name: "",
    priority: 0,
    status: "On",
    users: "All users",
    commonAttachmentFilter: "On (44 default extensions)",
    zeroHourAutoPurge: "On for malware + phish",
    notify: "Internal sender + admin",
  };
}

function AntiMalwareSection({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [editing, setEditing] = useState<DefenderAntiMalwarePolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DefenderAntiMalwarePolicy>(emptyAntiMalwarePolicy());
  const [deleteTarget, setDeleteTarget] = useState<DefenderAntiMalwarePolicy | null>(null);

  function openCreate() {
    setDraft(emptyAntiMalwarePolicy());
    setCreating(true);
  }
  function openEdit(p: DefenderAntiMalwarePolicy) {
    setDraft({ ...p });
    setEditing(p);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
  }
  function save() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    if (editing) {
      dispatch({ type: "UPDATE_ANTI_MALWARE_POLICY", name: editing.name, patch: draft });
      toast.success(`Anti-malware policy "${draft.name}" updated.`);
    } else {
      if (state.antiMalwarePolicies.some((p) => p.name === draft.name)) {
        toast.error("A policy with that name already exists.");
        return;
      }
      dispatch({ type: "ADD_ANTI_MALWARE_POLICY", policy: draft });
      toast.success(`Anti-malware policy "${draft.name}" created.`);
    }
    closeModal();
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_ANTI_MALWARE_POLICY", name: deleteTarget.name });
    toast.success(`Anti-malware policy "${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className={styles.pageSub} style={{ margin: 0 }}>
          Scans for malware in attachments. Common Attachment Filter blocks risky file extensions at the gateway, before detonation.
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Create policy
        </button>
      </div>

      {state.antiMalwarePolicies.length === 0 ? (
        <EmptyState message="No anti-malware policies yet." />
      ) : (
        state.antiMalwarePolicies.map((p) => (
          <div key={p.name} className={styles.card}>
            {policyCardHeader(p.name, p.priority, p.users, p.status)}
            <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
              {kv("Common attachment filter", p.commonAttachmentFilter)}
              {kv("Zero-hour auto-purge (ZAP)", p.zeroHourAutoPurge)}
              {kv("Notify on detection", p.notify)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => openEdit(p)}>
                Edit
              </button>
              <button type="button" className={styles.btnSubtle} onClick={() => setDeleteTarget(p)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <div className={styles.h3}>Blocked file extensions (Common Attachment Filter)</div>
      <div className={styles.card} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {state.blockedFileExtensions.map((ext) => (
          <span key={ext} style={{ background: "#fde7e9", color: "#a4262c", padding: "3px 8px", borderRadius: 3, fontFamily: "Consolas, monospace", fontSize: 11 }}>
            .{ext}
          </span>
        ))}
      </div>

      {creating || editing ? (
        <Modal title={editing ? `Edit anti-malware policy: ${editing.name}` : "Create anti-malware policy"} onClose={closeModal}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={save}>
                {editing ? "Save" : "Create policy"}
              </button>
            </>
          }
        >
          <Field label="Policy name">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!!editing} />
          </Field>
          <Field label="Apply to (users / group / domain)">
            <input className={styles.input} value={draft.users} onChange={(e) => setDraft({ ...draft, users: e.target.value })} />
          </Field>
          <Field label="Common attachment filter">
            <input className={styles.input} value={draft.commonAttachmentFilter} onChange={(e) => setDraft({ ...draft, commonAttachmentFilter: e.target.value })} />
          </Field>
          <Field label="Zero-hour auto-purge (ZAP)">
            <input className={styles.input} value={draft.zeroHourAutoPurge} onChange={(e) => setDraft({ ...draft, zeroHourAutoPurge: e.target.value })} />
          </Field>
          <Field label="Notify on detection">
            <input className={styles.input} value={draft.notify} onChange={(e) => setDraft({ ...draft, notify: e.target.value })} />
          </Field>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteModal title="Delete anti-malware policy?" itemName={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      ) : null}
    </div>
  );
}

// ===== Anti-spam (discriminated union) =====
function emptyInbound(): DefenderAntiSpamInbound {
  return {
    kind: "Inbound",
    name: "",
    priority: 0,
    users: "All users",
    bulkThreshold: 7,
    spamAction: "Move to Junk",
    highConfidenceSpamAction: "Quarantine",
    phishAction: "Quarantine",
    highConfidencePhishAction: "Quarantine",
    bulkAction: "Move to Junk",
    retentionDays: 30,
  };
}
function emptyOutbound(): DefenderAntiSpamOutbound {
  return {
    kind: "Outbound",
    name: "",
    priority: 0,
    users: "All users",
    externalRecipientsPerHour: 500,
    internalRecipientsPerHour: 1000,
    totalRecipientsPerDay: 10000,
    actionOnExceeded: "Restrict the user from sending mail",
    forwardingRulesEnabled: "Automatic - System controlled",
  };
}
function emptyConnectionFilter(): DefenderConnectionFilterPolicy {
  return {
    kind: "ConnectionFilter",
    name: "",
    priority: "N/A",
    users: "N/A",
    ipAllowList: [],
    ipBlockList: [],
    safeListEnabled: "Off",
  };
}

function antiSpamCardBody(p: DefenderAntiSpamPolicy) {
  if (p.kind === "Inbound") {
    return (
      <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
        {kv("Bulk complaint level threshold", `${p.bulkThreshold} / 9`)}
        {kv("Spam action", p.spamAction)}
        {kv("High-confidence spam action", p.highConfidenceSpamAction)}
        {kv("Phish action", p.phishAction)}
        {kv("High-confidence phish action", p.highConfidencePhishAction)}
        {kv("Bulk action", p.bulkAction)}
        {kv("Quarantine retention", `${p.retentionDays} days`)}
      </div>
    );
  }
  if (p.kind === "Outbound") {
    return (
      <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
        {kv("External recipients / hour", String(p.externalRecipientsPerHour))}
        {kv("Internal recipients / hour", String(p.internalRecipientsPerHour))}
        {kv("Total recipients / day", String(p.totalRecipientsPerDay))}
        {kv("Action on exceeded", p.actionOnExceeded)}
        {kv("Auto-forwarding", p.forwardingRulesEnabled)}
      </div>
    );
  }
  return (
    <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
      {kv("IP allow list", p.ipAllowList.join(", ") || "(empty)")}
      {kv("IP block list", p.ipBlockList.join(", ") || "(empty)")}
      {kv("Safe List enabled", p.safeListEnabled)}
    </div>
  );
}

function AntiSpamSection({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [editing, setEditing] = useState<DefenderAntiSpamPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DefenderAntiSpamPolicy>(emptyInbound());
  const [deleteTarget, setDeleteTarget] = useState<DefenderAntiSpamPolicy | null>(null);

  function openCreate() {
    setDraft(emptyInbound());
    setCreating(true);
  }
  function openEdit(p: DefenderAntiSpamPolicy) {
    setDraft(JSON.parse(JSON.stringify(p)));
    setEditing(p);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
  }
  function changeKind(kind: DefenderAntiSpamPolicy["kind"]) {
    if (kind === "Inbound") setDraft({ ...emptyInbound(), name: draft.name });
    else if (kind === "Outbound") setDraft({ ...emptyOutbound(), name: draft.name });
    else setDraft({ ...emptyConnectionFilter(), name: draft.name });
  }
  function save() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    if (editing) {
      dispatch({ type: "UPDATE_ANTI_SPAM_POLICY", name: editing.name, patch: draft });
      toast.success(`Anti-spam policy "${draft.name}" updated.`);
    } else {
      if (state.antiSpamPolicies.some((p) => p.name === draft.name)) {
        toast.error("A policy with that name already exists.");
        return;
      }
      dispatch({ type: "ADD_ANTI_SPAM_POLICY", policy: draft });
      toast.success(`Anti-spam policy "${draft.name}" created.`);
    }
    closeModal();
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_ANTI_SPAM_POLICY", name: deleteTarget.name });
    toast.success(`Anti-spam policy "${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className={styles.pageSub} style={{ margin: 0 }}>
          Inbound, outbound, and connection filter policies for spam/junk control.
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Create policy
        </button>
      </div>

      {state.antiSpamPolicies.length === 0 ? (
        <EmptyState message="No anti-spam policies yet." />
      ) : (
        state.antiSpamPolicies.map((p) => (
          <div key={p.name} className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <strong style={{ color: "#0078d4" }}>{p.name}</strong>
                <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>
                  Type: {p.kind} &middot; Priority: {p.priority} &middot; Users: {p.users}
                </div>
              </div>
            </div>
            {antiSpamCardBody(p)}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => openEdit(p)}>
                Edit
              </button>
              <button type="button" className={styles.btnSubtle} onClick={() => setDeleteTarget(p)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <div className={styles.tip}>
        <strong>Bulk Complaint Level (BCL):</strong> 0=No bulk, 1-3=Few complaints, 4-9=Many complaints. Default threshold 7 = block legitimate
        newsletters. Set 4 for Finance/HR to aggressively quarantine.
      </div>

      {creating || editing ? (
        <Modal title={editing ? `Edit anti-spam policy: ${editing.name}` : "Create anti-spam policy"} onClose={closeModal} width="640px"
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={save}>
                {editing ? "Save" : "Create policy"}
              </button>
            </>
          }
        >
          <Field label="Policy name">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value } as DefenderAntiSpamPolicy)} disabled={!!editing} />
          </Field>
          <Field label="Kind" help="Inbound, outbound, and connection filter policies have different fields.">
            <NativeSelect
              value={draft.kind}
              onChange={(v) => changeKind(v as DefenderAntiSpamPolicy["kind"])}
              disabled={!!editing}
              options={[
                { value: "Inbound", label: "Inbound" },
                { value: "Outbound", label: "Outbound" },
                { value: "ConnectionFilter", label: "Connection filter" },
              ]}
            />
          </Field>

          {draft.kind !== "ConnectionFilter" ? (
            <Field label="Apply to (users / group / domain)">
              <input className={styles.input} value={draft.users} onChange={(e) => setDraft({ ...draft, users: e.target.value } as DefenderAntiSpamPolicy)} />
            </Field>
          ) : null}

          {draft.kind === "Inbound" ? (
            <>
              <Field label="Bulk complaint level threshold (0-9)">
                <input
                  type="number"
                  min={0}
                  max={9}
                  className={styles.input}
                  value={draft.bulkThreshold}
                  onChange={(e) => setDraft({ ...draft, bulkThreshold: Number(e.target.value) })}
                />
              </Field>
              <div className={styles.row}>
                <Field label="Spam action">
                  <input className={styles.input} value={draft.spamAction} onChange={(e) => setDraft({ ...draft, spamAction: e.target.value })} />
                </Field>
                <Field label="High-confidence spam action">
                  <input className={styles.input} value={draft.highConfidenceSpamAction} onChange={(e) => setDraft({ ...draft, highConfidenceSpamAction: e.target.value })} />
                </Field>
              </div>
              <div className={styles.row}>
                <Field label="Phish action">
                  <input className={styles.input} value={draft.phishAction} onChange={(e) => setDraft({ ...draft, phishAction: e.target.value })} />
                </Field>
                <Field label="High-confidence phish action">
                  <input className={styles.input} value={draft.highConfidencePhishAction} onChange={(e) => setDraft({ ...draft, highConfidencePhishAction: e.target.value })} />
                </Field>
              </div>
              <div className={styles.row}>
                <Field label="Bulk action">
                  <input className={styles.input} value={draft.bulkAction} onChange={(e) => setDraft({ ...draft, bulkAction: e.target.value })} />
                </Field>
                <Field label="Quarantine retention (days)">
                  <input type="number" min={1} max={30} className={styles.input} value={draft.retentionDays} onChange={(e) => setDraft({ ...draft, retentionDays: Number(e.target.value) })} />
                </Field>
              </div>
            </>
          ) : null}

          {draft.kind === "Outbound" ? (
            <>
              <div className={styles.row}>
                <Field label="External recipients / hour">
                  <input type="number" className={styles.input} value={draft.externalRecipientsPerHour} onChange={(e) => setDraft({ ...draft, externalRecipientsPerHour: Number(e.target.value) })} />
                </Field>
                <Field label="Internal recipients / hour">
                  <input type="number" className={styles.input} value={draft.internalRecipientsPerHour} onChange={(e) => setDraft({ ...draft, internalRecipientsPerHour: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Total recipients / day">
                <input type="number" className={styles.input} value={draft.totalRecipientsPerDay} onChange={(e) => setDraft({ ...draft, totalRecipientsPerDay: Number(e.target.value) })} />
              </Field>
              <Field label="Action on exceeded">
                <input className={styles.input} value={draft.actionOnExceeded} onChange={(e) => setDraft({ ...draft, actionOnExceeded: e.target.value })} />
              </Field>
              <Field label="Auto-forwarding">
                <input className={styles.input} value={draft.forwardingRulesEnabled} onChange={(e) => setDraft({ ...draft, forwardingRulesEnabled: e.target.value })} />
              </Field>
            </>
          ) : null}

          {draft.kind === "ConnectionFilter" ? (
            <>
              <Field label="IP allow list" help="Comma-separated IPs/CIDRs.">
                <input
                  className={styles.input}
                  value={draft.ipAllowList.join(", ")}
                  onChange={(e) => setDraft({ ...draft, ipAllowList: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </Field>
              <Field label="IP block list" help="Comma-separated IPs/CIDRs.">
                <input
                  className={styles.input}
                  value={draft.ipBlockList.join(", ")}
                  onChange={(e) => setDraft({ ...draft, ipBlockList: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </Field>
              <Field label="Safe List enabled">
                <NativeSelect
                  value={draft.safeListEnabled}
                  onChange={(v) => setDraft({ ...draft, safeListEnabled: v as "On" | "Off" })}
                  options={[
                    { value: "On", label: "On" },
                    { value: "Off", label: "Off" },
                  ]}
                />
              </Field>
            </>
          ) : null}
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteModal title="Delete anti-spam policy?" itemName={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      ) : null}
    </div>
  );
}

// ===== Safe Attachments =====
function emptySafeAttachmentsPolicy(): DefenderSafeAttachmentsPolicy {
  return {
    name: "",
    status: "On",
    users: "All users",
    action: "Dynamic Delivery",
    redirectOnDetection: "Off",
    redirectEmail: "-",
    includeRecipients: "All users",
    description: "Custom Safe Attachments policy",
  };
}

function SafeAttachmentsSection({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [editing, setEditing] = useState<DefenderSafeAttachmentsPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DefenderSafeAttachmentsPolicy>(emptySafeAttachmentsPolicy());
  const [deleteTarget, setDeleteTarget] = useState<DefenderSafeAttachmentsPolicy | null>(null);

  function openCreate() {
    setDraft(emptySafeAttachmentsPolicy());
    setCreating(true);
  }
  function openEdit(p: DefenderSafeAttachmentsPolicy) {
    setDraft({ ...p });
    setEditing(p);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
  }
  function save() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    if (editing) {
      dispatch({ type: "UPDATE_SAFE_ATTACHMENTS_POLICY", name: editing.name, patch: draft });
      toast.success(`Safe Attachments policy "${draft.name}" updated.`);
    } else {
      if (state.safeAttachmentsPolicies.some((p) => p.name === draft.name)) {
        toast.error("A policy with that name already exists.");
        return;
      }
      dispatch({ type: "ADD_SAFE_ATTACHMENTS_POLICY", policy: draft });
      toast.success(`Safe Attachments policy "${draft.name}" created.`);
    }
    closeModal();
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_SAFE_ATTACHMENTS_POLICY", name: deleteTarget.name });
    toast.success(`Safe Attachments policy "${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className={styles.pageSub} style={{ margin: 0 }}>
          Detonates attachments in a sandbox to detect zero-day malware before delivery.
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Create policy
        </button>
      </div>

      {state.safeAttachmentsPolicies.length === 0 ? (
        <EmptyState message="No Safe Attachments policies yet." />
      ) : (
        state.safeAttachmentsPolicies.map((p) => (
          <div key={p.name} className={styles.card}>
            {policyCardHeader(p.name, "-", p.users, p.status)}
            <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
              {kv("Detection action", p.action)}
              {kv("Redirect on detection", p.redirectOnDetection)}
              {kv("Redirect address", p.redirectEmail)}
              {kv("Apply to recipients", p.includeRecipients)}
            </div>
            <p style={{ fontSize: 12, color: "#242424", marginTop: 8 }}>{p.description}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => openEdit(p)}>
                Edit
              </button>
              <button type="button" className={styles.btnSubtle} onClick={() => setDeleteTarget(p)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <div className={styles.tip}>
        <strong>Dynamic Delivery</strong> ships the email body immediately, replaces attachment with a placeholder, and swaps in the real file once
        scan completes (typical 5-7 min). Users complain less than with Block action.
      </div>

      {creating || editing ? (
        <Modal title={editing ? `Edit Safe Attachments policy: ${editing.name}` : "Create Safe Attachments policy"} onClose={closeModal}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={save}>
                {editing ? "Save" : "Create policy"}
              </button>
            </>
          }
        >
          <Field label="Policy name">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!!editing} />
          </Field>
          <Field label="Apply to (users / group / domain)">
            <input className={styles.input} value={draft.users} onChange={(e) => setDraft({ ...draft, users: e.target.value })} />
          </Field>
          <Field label="Detection action">
            <NativeSelect
              value={draft.action}
              onChange={(v) => setDraft({ ...draft, action: v as DefenderSafeAttachmentsPolicy["action"] })}
              options={[
                { value: "Dynamic Delivery", label: "Dynamic Delivery" },
                { value: "Block", label: "Block" },
              ]}
            />
          </Field>
          <div className={styles.row}>
            <Field label="Redirect on detection">
              <NativeSelect
                value={draft.redirectOnDetection}
                onChange={(v) => setDraft({ ...draft, redirectOnDetection: v as "On" | "Off" })}
                options={[
                  { value: "On", label: "On" },
                  { value: "Off", label: "Off" },
                ]}
              />
            </Field>
            <Field label="Redirect address">
              <input className={styles.input} value={draft.redirectEmail} onChange={(e) => setDraft({ ...draft, redirectEmail: e.target.value })} />
            </Field>
          </div>
          <Field label="Apply to recipients">
            <input className={styles.input} value={draft.includeRecipients} onChange={(e) => setDraft({ ...draft, includeRecipients: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className={styles.textarea} style={{ height: 70 }} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteModal title="Delete Safe Attachments policy?" itemName={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      ) : null}
    </div>
  );
}

// ===== Safe Links =====
function emptySafeLinksPolicy(): DefenderSafeLinksPolicy {
  return {
    name: "",
    status: "On",
    users: "All users",
    urlRewriting: "On",
    scanWhileUserClicks: "On",
    applyToInternalMail: "On",
    doNotAllowUserClickThrough: "On",
    urlAllowList: "(empty)",
    description: "Custom Safe Links policy",
  };
}

function SafeLinksSection({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [editing, setEditing] = useState<DefenderSafeLinksPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DefenderSafeLinksPolicy>(emptySafeLinksPolicy());
  const [deleteTarget, setDeleteTarget] = useState<DefenderSafeLinksPolicy | null>(null);

  function openCreate() {
    setDraft(emptySafeLinksPolicy());
    setCreating(true);
  }
  function openEdit(p: DefenderSafeLinksPolicy) {
    setDraft({ ...p });
    setEditing(p);
  }
  function closeModal() {
    setCreating(false);
    setEditing(null);
  }
  function save() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    if (editing) {
      dispatch({ type: "UPDATE_SAFE_LINKS_POLICY", name: editing.name, patch: draft });
      toast.success(`Safe Links policy "${draft.name}" updated.`);
    } else {
      if (state.safeLinksPolicies.some((p) => p.name === draft.name)) {
        toast.error("A policy with that name already exists.");
        return;
      }
      dispatch({ type: "ADD_SAFE_LINKS_POLICY", policy: draft });
      toast.success(`Safe Links policy "${draft.name}" created.`);
    }
    closeModal();
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_SAFE_LINKS_POLICY", name: deleteTarget.name });
    toast.success(`Safe Links policy "${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className={styles.pageSub} style={{ margin: 0 }}>
          Rewrites URLs in email and Office documents through a safe-links proxy. Re-checks URL at click time for time-of-click protection.
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Create policy
        </button>
      </div>

      {state.safeLinksPolicies.length === 0 ? (
        <EmptyState message="No Safe Links policies yet." />
      ) : (
        state.safeLinksPolicies.map((p) => (
          <div key={p.name} className={styles.card}>
            {policyCardHeader(p.name, "-", p.users, p.status)}
            <div className={styles.row} style={{ gap: 8, fontSize: 12 }}>
              {kv("URL rewriting", p.urlRewriting)}
              {kv("Scan while user clicks", p.scanWhileUserClicks)}
              {kv("Apply to internal mail", p.applyToInternalMail)}
              {kv("Block click-through bypass", p.doNotAllowUserClickThrough)}
              {kv("URL allow list", p.urlAllowList)}
            </div>
            <p style={{ fontSize: 12, color: "#242424", marginTop: 8 }}>{p.description}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => openEdit(p)}>
                Edit
              </button>
              <button type="button" className={styles.btnSubtle} onClick={() => setDeleteTarget(p)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {creating || editing ? (
        <Modal title={editing ? `Edit Safe Links policy: ${editing.name}` : "Create Safe Links policy"} onClose={closeModal}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={save}>
                {editing ? "Save" : "Create policy"}
              </button>
            </>
          }
        >
          <Field label="Policy name">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!!editing} />
          </Field>
          <Field label="Apply to (users / group / domain)">
            <input className={styles.input} value={draft.users} onChange={(e) => setDraft({ ...draft, users: e.target.value })} />
          </Field>
          <div className={styles.row}>
            <Field label="Scan while user clicks">
              <input className={styles.input} value={draft.scanWhileUserClicks} onChange={(e) => setDraft({ ...draft, scanWhileUserClicks: e.target.value })} />
            </Field>
            <Field label="Apply to internal mail">
              <NativeSelect
                value={draft.applyToInternalMail}
                onChange={() => setDraft({ ...draft, applyToInternalMail: "On" })}
                options={[{ value: "On", label: "On" }]}
              />
            </Field>
          </div>
          <Field label="Block click-through bypass">
            <input className={styles.input} value={draft.doNotAllowUserClickThrough} onChange={(e) => setDraft({ ...draft, doNotAllowUserClickThrough: e.target.value })} />
          </Field>
          <Field label="URL allow list">
            <input className={styles.input} value={draft.urlAllowList} onChange={(e) => setDraft({ ...draft, urlAllowList: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className={styles.textarea} style={{ height: 70 }} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteModal title="Delete Safe Links policy?" itemName={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      ) : null}
    </div>
  );
}

// ===== Tenant Allow/Block (summary only — full CRUD lives on a dedicated page) =====
function TablSummarySection({ state }: { state: DefenderState }) {
  const { senders, urls, files } = state.tenantAllowBlock;
  const allowCount = (list: { list: "Allow" | "Block" }[]) => list.filter((e) => e.list === "Allow").length;
  const blockCount = (list: { list: "Allow" | "Block" }[]) => list.filter((e) => e.list === "Block").length;

  return (
    <div>
      <div className={styles.pageSub}>
        Tenant-wide Allow/Block Lists override all policies. Use for known good/bad senders, domains, URLs, and file hashes. Full entry management
        lives on the dedicated Tenant Allow/Block List page.
      </div>
      <StatRow
        stats={[
          { label: "Sender allow entries", value: allowCount(senders) },
          { label: "Sender block entries", value: blockCount(senders) },
          { label: "URL allow entries", value: allowCount(urls) },
          { label: "URL block entries", value: blockCount(urls) },
          { label: "File hash block entries", value: blockCount(files) },
        ]}
      />
      <div className={styles.tip}>
        <strong>Expiry policy:</strong> Allow entries auto-expire after 30 days (extendable). Block entries can be permanent. Check expiring entries
        weekly — re-allow legitimate vendors before they fail.
      </div>
    </div>
  );
}

// ===== DKIM =====
function DkimSection({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const columns: DataTableColumn<DefenderState["dkimDomains"][number]>[] = useMemo(
    () => [
      { key: "domain", header: "Domain", render: (d) => <strong>{d.domain}</strong> },
      {
        key: "enabled",
        header: "Enabled",
        render: (d) => (
          <Checkbox
            label={d.enabled ? "Enabled" : "Disabled"}
            checked={d.enabled}
            onChange={(checked) => dispatch({ type: "UPDATE_DKIM_DOMAIN", domain: d.domain, patch: { enabled: checked } })}
          />
        ),
      },
      { key: "selectorRotated", header: "Last selector rotation", render: (d) => d.selectorRotated },
      { key: "nextRotation", header: "Next rotation", render: (d) => d.nextRotation },
      { key: "keyLength", header: "Key length", render: (d) => d.keyLength },
    ],
    [dispatch],
  );

  return (
    <div>
      <div className={styles.pageSub}>DKIM signs outbound mail with your domain key. Pair with SPF + DMARC for full email auth.</div>
      <DataTable columns={columns} rows={state.dkimDomains} getRowKey={(d) => d.domain} emptyMessage="No domains configured." />
      <div className={styles.tip}>
        <strong>Required DNS records</strong> (for each accepted domain):
        <br />
        <code>selector1._domainkey.contoso.com CNAME selector1-contoso-com._domainkey.contoso.onmicrosoft.com</code>
        <br />
        <code>selector2._domainkey.contoso.com CNAME selector2-contoso-com._domainkey.contoso.onmicrosoft.com</code>
        <br />
        <br />
        Microsoft rotates selectors automatically every 6 months. Pair with SPF: <code>v=spf1 include:spf.protection.outlook.com -all</code> and
        DMARC: <code>v=DMARC1; p=reject; rua=mailto:dmarc@contoso.com</code>.
      </div>
    </div>
  );
}

// ===== Quarantine policy types (read-only reference) =====
function QuarantineTypesSection({ state }: { state: DefenderState }) {
  const columns: DataTableColumn<DefenderState["quarantinePolicyTypes"][number]>[] = [
    { key: "name", header: "Policy", render: (q) => <strong>{q.name}</strong> },
    { key: "userPermissions", header: "User permissions", render: (q) => <span style={{ fontSize: 12 }}>{q.userPermissions}</span> },
    { key: "notification", header: "End-user notification", render: (q) => q.notification },
  ];

  return (
    <div>
      <div className={styles.pageSub}>Quarantine policies control what end users can do with messages parked in quarantine.</div>
      <DataTable columns={columns} rows={state.quarantinePolicyTypes} getRowKey={(q) => q.name} emptyMessage="No quarantine policy types." />
      <div className={styles.tip}>
        <strong>Architect tip:</strong> Default = full access for low-confidence quarantines (spam, bulk). Admin-only for high-risk (high-confidence
        phish, malware) — users should NOT be able to release a known-malicious payload back into their inbox.
      </div>
    </div>
  );
}
