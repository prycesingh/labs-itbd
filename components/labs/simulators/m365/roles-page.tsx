"use client";

import { useState } from "react";

import type { M365State } from "@/lib/labs/simulators/m365/types";
import { Pill, StatRow } from "./m365-ui";
import styles from "./m365-console.module.css";

type RolesTab = "admin-roles" | "pim" | "custom" | "org-settings" | "recommendations";

const TABS: { id: RolesTab; label: string }[] = [
  { id: "admin-roles", label: "Admin roles" },
  { id: "pim", label: "PIM eligibility" },
  { id: "custom", label: "Custom roles" },
  { id: "org-settings", label: "Org settings" },
  { id: "recommendations", label: "Recommendations" },
];

type RoleRisk = "Tier-0" | "Tier-1" | "Tier-2" | "Low";

const ROLE_META: Record<string, { users: number; risk: RoleRisk; description: string }> = {
  "User": { users: 812, risk: "Low", description: "Standard end-user account. No admin center access." },
  "Global administrator": { users: 4, risk: "Tier-0", description: "Full access to all admin features. Use sparingly — pair with PIM and break-glass." },
  "Global reader": { users: 12, risk: "Low", description: "Read-only counterpart to Global Admin. Safe default for auditors." },
  "User administrator": { users: 8, risk: "Tier-2", description: "Create and manage users, groups, and licenses. Cannot change admin role assignments." },
  "Helpdesk administrator": { users: 24, risk: "Tier-2", description: "Reset passwords for non-admin users; force re-sign-in." },
  "Exchange administrator": { users: 5, risk: "Tier-1", description: "Manage Exchange Online: mailboxes, mail flow, anti-spam." },
  "SharePoint administrator": { users: 4, risk: "Tier-2", description: "Manage SharePoint Online and OneDrive." },
  "Teams administrator": { users: 4, risk: "Tier-2", description: "Manage Microsoft Teams: voice, meetings, lifecycle." },
  "License administrator": { users: 2, risk: "Tier-2", description: "Assign and remove licenses to and from users." },
  "Billing administrator": { users: 3, risk: "Tier-2", description: "Manage purchases, subscriptions, and support tickets." },
  "Service support administrator": { users: 8, risk: "Tier-2", description: "Open and manage Microsoft support tickets, view service health." },
  "Reports reader": { users: 14, risk: "Low", description: "View usage and adoption reports." },
  "Compliance administrator": { users: 4, risk: "Tier-1", description: "Manage Purview: DLP, eDiscovery, Audit, IRM." },
  "Security administrator": { users: 6, risk: "Tier-1", description: "Manage all security-related features: Defender, Conditional Access, Identity Protection." },
};

function riskTone(risk: RoleRisk): "err" | "warn" | "info" | "muted" {
  if (risk === "Tier-0") return "err";
  if (risk === "Tier-1") return "warn";
  if (risk === "Tier-2") return "info";
  return "muted";
}

const PIM_ROWS: { user: string; role: string; state: "Eligible" | "Permanent" | "Active"; justification: string; remaining: string }[] = [
  { user: "admin@itbd.net", role: "Global administrator", state: "Eligible", justification: "—", remaining: "Eligible only — activate when needed" },
  { user: "rohit@cloudlab.in", role: "Privileged role administrator", state: "Eligible", justification: "—", remaining: "Eligible only — 2-approver workflow" },
  { user: "breakglass-01@cloudlab.in", role: "Global administrator", state: "Permanent", justification: "Break-glass account, always active", remaining: "No expiry (CA-exempt)" },
  { user: "breakglass-02@cloudlab.in", role: "Global administrator", state: "Permanent", justification: "Break-glass account, always active", remaining: "No expiry (CA-exempt)" },
  { user: "vivek@cloudlab.in", role: "Security administrator", state: "Active", justification: "SOC investigation INC-10042 (AiTM phishing)", remaining: "2h 18m remaining" },
  { user: "priya@cloudlab.in", role: "Intune administrator", state: "Eligible", justification: "—", remaining: "Eligible only — activate" },
  { user: "manish@cloudlab.in", role: "Exchange administrator", state: "Active", justification: "Ticket TKT-INC-887 (transport rule rollout)", remaining: "6h 42m remaining" },
  { user: "sunita@cloudlab.in", role: "Compliance administrator", state: "Eligible", justification: "—", remaining: "Eligible only — audit response" },
  { user: "aslam@cloudlab.in", role: "Helpdesk administrator", state: "Active", justification: "Shift 09:00–17:00 IST", remaining: "3h 18m remaining" },
];

function pimTone(state: string): "ok" | "info" | "warn" {
  if (state === "Active") return "ok";
  if (state === "Permanent") return "warn";
  return "info";
}

const CUSTOM_ROLES: { name: string; permission: string; scope: string }[] = [
  { name: "Manufacturing App Owner", permission: "microsoft.directory/applications/credentials/update", scope: "Specific app" },
  { name: "BYOD Helpdesk (limited)", permission: "microsoft.directory/users/password/update", scope: "Specific Administrative Unit" },
];

const ORG_SETTINGS: { category: string; rows: { name: string; setting: string; value: string; note: string }[] }[] = [
  {
    category: "Services",
    rows: [
      { name: "Modern authentication", setting: "Enable modern auth for Exchange Online", value: "Enabled", note: "Required — legacy auth is blocked tenant-wide." },
      { name: "Microsoft Forms", setting: "External response sharing", value: "Block sharing outside org", note: "Mitigates PII leakage via shared forms." },
      { name: "Microsoft Bookings", setting: "Availability tenant-wide", value: "Disabled tenant-wide", note: "Re-enable per business unit only, on request." },
      { name: "Office on the web", setting: "External editing", value: "Allow", note: "Reviewed quarterly against sharing policy." },
    ],
  },
  {
    category: "Security & privacy",
    rows: [
      { name: "Password expiration policy", setting: "Days until passwords expire", value: "Never (modern auth + MFA)", note: "NIST 800-63B aligned; rotation harms security here." },
      { name: "Customer Lockbox", setting: "Require approval for Microsoft engineer access", value: "On (4 approvers)", note: "Requires E5 or equivalent licensing." },
      { name: "Sharing", setting: "Guest sharing in Microsoft 365 groups", value: "Allow with verification code", note: "Pair with B2B trust settings before widening." },
    ],
  },
  {
    category: "Organization profile",
    rows: [
      { name: "Data location", setting: "Primary Microsoft 365 data location", value: "India", note: "Geo-aware tenant; DR pair maintained in Singapore." },
      { name: "Release preferences", setting: "Targeted release", value: "Selected users (IT pilots)", note: "Keeps preview features off the general population." },
      { name: "Sender ID banner", setting: "External sender warning banner", value: "Show on emails from outside org", note: "Baseline phishing defense." },
    ],
  },
];

const RECOMMENDATIONS: { severity: "Critical" | "Warning" | "Info" | "Done"; text: string }[] = [
  { severity: "Critical", text: "4 Global Administrators assigned — at the upper edge of Microsoft's recommended range. Move non-break-glass holders to Privileged Role Administrator." },
  { severity: "Warning", text: "Review Application Administrator role holders — this role can add credentials to any app, including high-privilege Graph apps." },
  { severity: "Warning", text: "12 Global Readers have not been reviewed this quarter — several may no longer need standing read access." },
  { severity: "Info", text: "Enable PIM for all remaining Tier-1 roles so activations require justification and time-bound expiry." },
  { severity: "Done", text: "Break-glass accounts (2) are excluded from all Conditional Access policies — verified." },
];

function recTone(severity: string): "err" | "warn" | "info" | "ok" {
  if (severity === "Critical") return "err";
  if (severity === "Warning") return "warn";
  if (severity === "Done") return "ok";
  return "info";
}

export function RolesPage({ state }: { state: M365State }) {
  const [tab, setTab] = useState<RolesTab>("admin-roles");

  const totalAssigned = state.roles.reduce((sum, r) => sum + (ROLE_META[r]?.users ?? 1), 0);
  const tier0Count = state.roles.reduce((sum, r) => sum + (ROLE_META[r]?.risk === "Tier-0" ? ROLE_META[r].users : 0), 0);

  return (
    <div>
      <h1 className={styles.pageH1}>Roles &amp; admins</h1>
      <p className={styles.pageSub}>Manage who can do what in your Microsoft 365 tenant.</p>

      <div className={styles.subtabs}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`${styles.subtab} ${tab === t.id ? styles.subtabActive : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "admin-roles" ? (
        <div>
          <StatRow
            stats={[
              { label: "Total assigned", value: totalAssigned },
              { label: "Tier-0 admins", value: tier0Count },
              { label: "Built-in roles in use", value: state.roles.length },
              { label: "Custom roles", value: CUSTOM_ROLES.length },
            ]}
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Tier</th>
                  <th>Users</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {state.roles.map((r) => {
                  const meta = ROLE_META[r] ?? { users: 1, risk: "Tier-2" as RoleRisk, description: "Built-in Microsoft 365 admin role." };
                  return (
                    <tr key={r}>
                      <td>
                        <strong>{r}</strong>
                      </td>
                      <td>
                        <Pill tone={riskTone(meta.risk)}>{meta.risk}</Pill>
                      </td>
                      <td>{meta.users}</td>
                      <td className={styles.muted}>{meta.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "pim" ? (
        <div>
          <p className={styles.muted}>Privileged Identity Management — eligible (must activate) vs. permanent vs. active right now.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Justification / activated for</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {PIM_ROWS.map((p) => (
                  <tr key={`${p.user}-${p.role}`}>
                    <td>
                      <strong>{p.user}</strong>
                    </td>
                    <td>{p.role}</td>
                    <td>
                      <Pill tone={pimTone(p.state)}>{p.state}</Pill>
                    </td>
                    <td className={styles.muted}>{p.justification}</td>
                    <td className={styles.muted}>{p.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.card} style={{ marginTop: 14, borderLeft: "3px solid #2564cf" }}>
            <div className={styles.cardTitle}>Break-glass emergency access</div>
            <p className={styles.muted}>
              Keep 2 break-glass Global Administrator accounts permanent (FIDO2 keys only, excluded from Conditional Access). All other Tier-0 assignments
              should be Eligible with a 1-hour activation maximum, MFA, and approval from a second Tier-0 admin.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "custom" ? (
        <div>
          <p className={styles.muted}>Custom roles for fine-grained permissions on apps, devices, users, and groups.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Custom role</th>
                  <th>Permission</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {CUSTOM_ROLES.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td className={styles.muted}>{c.permission}</td>
                    <td>{c.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "org-settings" ? (
        <div>
          {ORG_SETTINGS.map((group) => (
            <div key={group.category}>
              <div className={styles.h3}>{group.category}</div>
              <div className={styles.tableWrap} style={{ marginBottom: 14 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Service / area</th>
                      <th>Setting</th>
                      <th>Current value</th>
                      <th>Architect note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <strong>{row.name}</strong>
                        </td>
                        <td>{row.setting}</td>
                        <td>{row.value}</td>
                        <td className={styles.muted}>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "recommendations" ? (
        <div>
          <p className={styles.muted}>Role hygiene recommendations based on current assignments.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {RECOMMENDATIONS.map((rec, i) => (
              <div key={i} className={styles.card} style={{ display: "flex", gap: 14, marginBottom: 0 }}>
                <div style={{ width: 70, flexShrink: 0 }}>
                  <Pill tone={recTone(rec.severity)}>{rec.severity}</Pill>
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{rec.text}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
