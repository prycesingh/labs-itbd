"use client";

// Five mostly-static/reference pages for the Microsoft Purview
// compliance-portal simulator. Ported from
// itbd-lab/simulators/purview/js/purview-portal.js:
//   - renderDataEstateInsights() (~line 454)
//   - renderDataQuality()        (~line 498)
//   - renderInfoBarriers()       (~line 395)
//   - renderRoles()              (~line 426) + openAdminUnits()/openAdaptiveScopes() (~line 652/668)
//   - renderSettings()           (~line 546)
//
// All five source pages build content from hardcoded literals (not
// PurviewData.state), so these ports keep that: reference tables/tiles with
// the exact sample values from source, no derived-from-state math. Wizard/
// create actions that were `alert()`/`prompt()` chains in source (the Data
// Quality "Create quality rule" button, Admin units "+ Add admin unit", the
// Roles page's two modals, Settings "Reset simulator data") are ported as
// `sonner` toast previews per the porting brief — no real mutation happens
// at this static-reference layer.

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { PurviewState } from "@/lib/labs/simulators/purview/types";
import { DataTable, EmptyState, Modal, StatTile, TabBar } from "./purview-ui";
import styles from "./purview-console.module.css";

// =====================================================================
// Data Estate Insights
// =====================================================================
// Source (Round 68 comment): "new Purview GA pillar" — an executive rollup
// over the Data Map scan/classification/label engines. Source's numbers are
// hardcoded reference figures, not derived from PurviewData.state (the
// simulator's actual dataSources/scanJobs seed data is much smaller than
// these headline counts — this page is deliberately a "board-ready slide"
// stand-in, same as source). Kept as static reference content to match.

type SensitiveDistributionRow = {
  classification: string;
  total: string;
  withinLabel: string;
  unprotected: string;
  topSource: string;
};

const SENSITIVE_DISTRIBUTION: SensitiveDistributionRow[] = [
  { classification: "Credit card", total: "184,218", withinLabel: "178,418 (96.8%)", unprotected: "5,800", topSource: "Finance/SharePoint" },
  { classification: "Aadhaar (India)", total: "421,801", withinLabel: "418,914 (99.3%)", unprotected: "2,887", topSource: "HR/SharePoint" },
  { classification: "PAN (India)", total: "518,418", withinLabel: "514,218 (99.2%)", unprotected: "4,200", topSource: "HR + Finance" },
  { classification: "US SSN", total: "1,418", withinLabel: "1,402 (98.9%)", unprotected: "16", topSource: "SharePoint legacy" },
  { classification: "UK NINO", total: "418", withinLabel: "412 (98.6%)", unprotected: "6", topSource: "SharePoint legacy" },
  { classification: "Health record (PHI)", total: "14,218", withinLabel: "14,200 (99.9%)", unprotected: "18", topSource: "OneDrive (Medical BU)" },
  { classification: "Source code (proprietary)", total: "184,218", withinLabel: "184,000 (99.9%)", unprotected: "218", topSource: "SharePoint + GitHub" },
];

type RiskHotSpotRow = { issue: string; source: string; items: string; owner: string; action: ReactNode };

const RISK_HOT_SPOTS: RiskHotSpotRow[] = [
  {
    issue: "Unprotected PAN in shared site",
    source: "SP: Marketing-2026",
    items: "184",
    owner: "meera.p@cloudlab.in",
    action: (
      <>
        Apply <i>Confidential — Finance</i> label + restrict to FinanceTeam group
      </>
    ),
  },
  {
    issue: "Aadhaar shared externally",
    source: "OneDrive: rahul.k@cloudlab.in",
    items: "2",
    owner: "HR-lead",
    action: "Revoke external sharing, notify employee, Insider Risk policy",
  },
  {
    issue: "Health records in inactive account",
    source: "OneDrive: drsmith (terminated)",
    items: "418",
    owner: "Compliance",
    action: "Apply retention hold, transfer ownership, then close mailbox",
  },
  {
    issue: "Stale Highly Confidential files (no access > 365d)",
    source: "SP: Legal-archive",
    items: "1,847",
    owner: "Legal counsel",
    action: "Apply retention label, move to archive site, audit access",
  },
  {
    issue: "Sensitive files in personal OneDrive",
    source: "OneDrive (8 users)",
    items: "418",
    owner: "Various",
    action: "Force migration to SharePoint via Sensitivity-based DLP policy",
  },
];

type HealthMetricRow = { metric: string; detail: string; status: "OK" | "Below target"; target?: string };

const HEALTH_METRICS: HealthMetricRow[] = [
  { metric: "Data Map scan freshness", detail: "P50 = 3 hours · P95 = 14 hours · P99 = 2 days", status: "OK" },
  { metric: "Classification accuracy", detail: "96.8% (sampled validation)", status: "OK" },
  { metric: "Label coverage", detail: "847,212 of 1,065,630 sensitive items (79.5%)", status: "Below target", target: "90%" },
  { metric: "Owner assignment", detail: "64% of assets have a named business owner", status: "Below target", target: "80%" },
];

export function DataEstateInsightsPage({ state }: { state: PurviewState }) {
  // Source's headline tiles are fixed reference figures (an executive
  // "board-ready slide" over a data estate far larger than this simulator's
  // seeded dataSources/scanJobs). The two counts genuinely available from
  // live state — registered data sources and scan jobs — are surfaced as a
  // small "in this simulator" footnote rather than invented into the
  // headline numbers, so the port stays honest about what's real vs. static.
  const registeredSources = state.dataSources.length;
  const scanJobs = state.scanJobs.length;

  return (
    <div>
      <div className={styles.pageH1}>Data Estate Insights</div>
      <div className={styles.pageSub}>
        Executive-level view of your data estate — what data exists, where it lives, who uses it, and where the risk concentrations are. Built on
        top of the Data Map scan + classification + label engines.
      </div>

      <div className={styles.statRow}>
        <StatTile label="Assets scanned" value="4,218,924" />
        <StatTile label="With sensitivity label" value="847,212" />
        <StatTile label="Unclassified" value="218,418" />
        <StatTile label="Owners assigned" value="64%" />
        <StatTile label="Risk hot-spots" value="14" />
      </div>

      <div className={styles.h3}>Sensitive data distribution</div>
      <DataTable<SensitiveDistributionRow>
        columns={[
          { key: "classification", header: "Classification", render: (r) => r.classification },
          { key: "total", header: "Total occurrences", render: (r) => r.total },
          { key: "withinLabel", header: "Within sensitivity label", render: (r) => r.withinLabel },
          { key: "unprotected", header: "Unprotected (no label)", render: (r) => r.unprotected },
          { key: "topSource", header: "Top source", render: (r) => r.topSource },
        ]}
        rows={SENSITIVE_DISTRIBUTION}
        getRowKey={(r) => r.classification}
      />

      <div className={styles.h3}>Top risk hot-spots (last 30 days)</div>
      <DataTable<RiskHotSpotRow>
        columns={[
          { key: "issue", header: "Issue", render: (r) => r.issue },
          { key: "source", header: "Source", render: (r) => r.source },
          { key: "items", header: "Items", render: (r) => r.items },
          { key: "owner", header: "Owner", render: (r) => r.owner },
          { key: "action", header: "Recommended action", render: (r) => r.action },
        ]}
        rows={RISK_HOT_SPOTS}
        getRowKey={(r) => r.issue}
      />

      <div className={styles.h3}>Health metrics</div>
      <DataTable<HealthMetricRow>
        columns={[
          { key: "metric", header: "Metric", render: (r) => <b>{r.metric}</b> },
          { key: "detail", header: "Detail", render: (r) => r.detail },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <span className={`${styles.pill} ${r.status === "OK" ? "" : styles.pillWarn}`}>
                {r.status === "OK" ? "OK" : `Below target (${r.target})`}
              </span>
            ),
          },
        ]}
        rows={HEALTH_METRICS}
        getRowKey={(r) => r.metric}
      />

      <div className={styles.card} style={{ marginTop: 14, borderLeft: "3px solid #0078d4", background: "#deecf9" }}>
        <b>Audience:</b> Data estate insights is for the CISO / DPO / Chief Data Officer. Run monthly. Use it to set quarterly OKRs around label
        coverage + owner assignment. Connect to Power BI via the Data Estate Insights connector for board-ready slides.
      </div>

      <div className={styles.small} style={{ marginTop: 10 }}>
        In this simulator: {registeredSources} data source{registeredSources === 1 ? "" : "s"} registered, {scanJobs} scan job{scanJobs === 1 ? "" : "s"} configured under Data Map.
      </div>
    </div>
  );
}

// =====================================================================
// Data Quality
// =====================================================================
// Source (Round 68 comment): "new Purview GA pillar — replaces Microsoft
// Purview Insider Risk Mgmt Data Quality preview". Fully static reference
// content in source (no PurviewData.state backing) — ported as-is. The
// "Create quality rule" button was a chained `alert()` wizard preview in
// source; ported to a single descriptive toast, matching the porting brief.

type QualityCategoryRow = { category: string; rules: number; passRate: string; example: string };

const QUALITY_CATEGORIES: QualityCategoryRow[] = [
  { category: "Completeness", rules: 42, passRate: "94%", example: "customer.email is not null on > 99.5% of rows" },
  { category: "Uniqueness", rules: 18, passRate: "99%", example: "customer_id has no duplicates within source table" },
  { category: "Validity", rules: 34, passRate: "91%", example: "order.amount > 0 AND order.amount < 1,000,000" },
  { category: "Consistency", rules: 28, passRate: "88%", example: "customer.country in ('IN', 'US', 'UK', 'DE', 'JP', 'SG', 'AU')" },
  { category: "Timeliness", rules: 14, passRate: "92%", example: "Sales fact table loads within 4 hours of source EOD" },
  { category: "Accuracy", rules: 11, passRate: "83%", example: "customer.email matches /^[^@]+@[^@]+\\.[^@]+$/" },
];

type FailingRuleRow = { id: string; rule: string; asset: string; owner: string; failure: string; trend: string };

const FAILING_RULES: FailingRuleRow[] = [
  {
    id: "r1",
    rule: "customer.email not null",
    asset: "dv.sales.customer",
    owner: "data-eng@cloudlab.in",
    failure: "2.1% nulls (above 0.5% threshold)",
    trend: "↑ since 2026-05-18 deploy",
  },
  {
    id: "r2",
    rule: "order.amount valid range",
    asset: "dv.sales.order",
    owner: "data-eng@cloudlab.in",
    failure: "14 rows with amount = -1 (test data leak)",
    trend: "New today",
  },
  {
    id: "r3",
    rule: "customer_id unique",
    asset: "dv.crm.contact",
    owner: "crm-team@cloudlab.in",
    failure: "4 duplicates after CRM sync",
    trend: "Spiked today",
  },
  {
    id: "r4",
    rule: "sales.country in [allowed]",
    asset: "dv.sales.order",
    owner: "data-eng@cloudlab.in",
    failure: '"USA" found (expected "US")',
    trend: "Repeat offender",
  },
];

type DomainScoreRow = { domain: string; owner: string; score: number; lastRefresh: string };

const DOMAIN_SCORES: DomainScoreRow[] = [
  { domain: "Customer", owner: "crm-team@cloudlab.in", score: 94, lastRefresh: "2 hours ago" },
  { domain: "Sales", owner: "data-eng@cloudlab.in", score: 87, lastRefresh: "4 hours ago" },
  { domain: "Finance", owner: "finance-data@cloudlab.in", score: 96, lastRefresh: "6 hours ago" },
  { domain: "HR", owner: "hr-data@cloudlab.in", score: 82, lastRefresh: "12 hours ago" },
  { domain: "Marketing", owner: "marketing-ops@cloudlab.in", score: 71, lastRefresh: "1 day ago" },
];

function domainScoreColor(score: number): string {
  if (score >= 90) return "#0e700e";
  if (score >= 80) return "#876900";
  return "#a4262c";
}

export function DataQualityPage() {
  return (
    <div>
      <div className={styles.pageH1}>Data Quality</div>
      <div className={styles.pageSub}>
        Define rules + scorecards for data quality across Dataverse, ADLS, Synapse, Fabric. Detect anomalies (null spikes, schema drift,
        distribution shift). Notify owners + create remediation tickets.
      </div>

      <div className={styles.statRow}>
        <StatTile label="Active rules" value="147" />
        <StatTile label="Domains monitored" value="14" />
        <StatTile label="Overall quality score" value="87%" />
        <StatTile label="Failing rules (24h)" value="12" />
        <StatTile label="Pending remediation" value="38" />
      </div>

      <div className={styles.h3}>Quality rules — by category</div>
      <DataTable<QualityCategoryRow>
        columns={[
          { key: "category", header: "Category", render: (r) => <b>{r.category}</b> },
          { key: "rules", header: "Rules", render: (r) => r.rules },
          { key: "passRate", header: "Pass rate (30d)", render: (r) => r.passRate },
          { key: "example", header: "Example check", render: (r) => r.example },
        ]}
        rows={QUALITY_CATEGORIES}
        getRowKey={(r) => r.category}
      />

      <div className={styles.h3}>Top failing rules (last 24h)</div>
      <DataTable<FailingRuleRow>
        columns={[
          { key: "rule", header: "Rule", render: (r) => r.rule },
          { key: "asset", header: "Asset", render: (r) => r.asset },
          { key: "owner", header: "Owner", render: (r) => r.owner },
          { key: "failure", header: "Failure", render: (r) => r.failure },
          { key: "trend", header: "Trend", render: (r) => r.trend },
          {
            key: "action",
            header: "Action",
            render: (r) => (
              <button
                type="button"
                className={styles.btnSubtle}
                onClick={() => toast.info(`Ticket created for "${r.rule}" — assigned to ${r.owner}.`)}
              >
                Create ticket
              </button>
            ),
          },
        ]}
        rows={FAILING_RULES}
        getRowKey={(r) => r.id}
      />

      <div className={styles.h3}>Domains + their quality score</div>
      <DataTable<DomainScoreRow>
        columns={[
          { key: "domain", header: "Domain", render: (r) => r.domain },
          { key: "owner", header: "Owner", render: (r) => r.owner },
          { key: "score", header: "Score", render: (r) => <b style={{ color: domainScoreColor(r.score) }}>{r.score}%</b> },
          { key: "lastRefresh", header: "Last refresh", render: (r) => r.lastRefresh },
        ]}
        rows={DOMAIN_SCORES}
        getRowKey={(r) => r.domain}
      />

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className={styles.btn}
          onClick={() =>
            toast.info(
              "Create quality rule: pick domain → pick asset (Dataverse table / ADLS path / Synapse SQL) → pick category (Completeness/Uniqueness/Validity/Consistency/Timeliness/Accuracy) → define check (KQL / regex / range) → threshold + alert recipients → activate.",
            )
          }
        >
          + Create quality rule
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Information Barriers
// =====================================================================
// Source's renderInfoBarriers() is literally just a page header + one
// empty-state sentence — no policies, no table, nothing wired. Kept exactly
// that minimal here per the porting brief (a short explainer, not overbuilt).

export function InformationBarriersPage() {
  return (
    <div>
      <div className={styles.pageH1}>Information barriers</div>
      <div className={styles.pageSub}>Restrict communications between specific groups of users.</div>
      <EmptyState message="No information barrier policies configured. Click “Create segment” in real Purview to define user segments first." />
      <div className={styles.small} style={{ marginTop: 10 }}>
        In real Purview, information barriers prevent members of one segment (e.g. Traders) from communicating or collaborating in Teams/OneDrive/
        SharePoint with members of a conflicting segment (e.g. Research) — used to satisfy regulatory conflict-of-interest requirements.
      </div>
    </div>
  );
}

// =====================================================================
// Roles & scopes
// =====================================================================
// Source's renderRoles() is a static role-group table plus a tab bar where
// "Admin units" / "Adaptive scopes" open source's openAdminUnits()/
// openAdaptiveScopes() reference-only modals (~line 652/668) — NOT the real
// interactive DLM Adaptive Scopes feature (`dlm-adaptive-scopes` page,
// PurviewState.adaptiveScopes) another agent builds elsewhere. This page's
// "Adaptive scopes" tab is deliberately a separate, non-interactive
// documentation view with its own different sample rows, matching source.

type RoleGroupRow = { name: string; description: string; members: string };

const ROLE_GROUPS: RoleGroupRow[] = [
  { name: "Compliance Administrator", description: "Full management of compliance features", members: "admin@itbd.net" },
  { name: "Compliance Data Administrator", description: "Manage settings for device, data protection", members: "compliance.admin@cloudlab.in" },
  { name: "eDiscovery Manager", description: "Create cases, place holds, run searches", members: "legal.admin@cloudlab.in" },
  { name: "eDiscovery Administrator", description: "Manage all cases and roles", members: "legal.admin@cloudlab.in" },
  { name: "Records Management", description: "Manage retention labels and file plan", members: "records.admin@cloudlab.in" },
  { name: "Insider Risk Management", description: "Manage insider risk policies and alerts", members: "ciso@cloudlab.in" },
  { name: "Reviewer", description: "Review eDiscovery items in Premium", members: "reviewer@cloudlab.in" },
  { name: "Communication Compliance Analyst", description: "Review communication compliance alerts", members: "hr.compliance@cloudlab.in" },
];

type AdminUnitRow = { name: string; members: string; restricted: string; admins: string; created: string };

const ADMIN_UNITS: AdminUnitRow[] = [
  { name: "AU-Finance", members: "184 users + 8 groups", restricted: "Yes", admins: "5 reviewers (Helpdesk-Finance)", created: "2024-04-12" },
  { name: "AU-HR", members: "62 users + 4 groups", restricted: "Yes (sensitive)", admins: "3 reviewers (HR-Compliance)", created: "2024-08-22" },
  { name: "AU-Sales-India", members: "148 users + 6 groups", restricted: "No", admins: "4 reviewers (Sales-IT)", created: "2025-01-04" },
  { name: "AU-Executives", members: "14 users", restricted: "Yes (sensitive)", admins: "2 reviewers (Exec-IT)", created: "2025-03-18" },
];

// Reference-only sample rows for this Roles-page modal — distinct from
// PurviewState.adaptiveScopes (the real interactive DLM Adaptive Scopes
// feature built elsewhere). Do not merge these two data sets.
type RolesAdaptiveScopeRow = { name: string; type: string; filter: string; matching: string; usedBy: string };

const ROLES_PAGE_ADAPTIVE_SCOPES: RolesAdaptiveScopeRow[] = [
  { name: "All India users", type: "Users", filter: 'country eq "IN"', matching: "1,248 users", usedBy: "Retention: 8 years (DPDP Act)" },
  { name: "All Finance dept", type: "Users", filter: 'department eq "Finance"', matching: "184 users", usedBy: "DLP: PCI / SOX, Retention: 7 years" },
  { name: "All Executive C-level", type: "Users", filter: 'jobTitle startswith "Chief"', matching: "8 users", usedBy: "Legal hold, Sensitivity required" },
  { name: "Finance shared mailboxes", type: "Mailboxes", filter: 'customAttribute1 eq "Finance"', matching: "14 mailboxes", usedBy: "Retention: 7 years" },
  {
    name: "Project sites — confidential",
    type: "Sites",
    filter: 'siteSensitivityLabel eq "Confidential"',
    matching: "42 sites",
    usedBy: "Retention: 5 years, DLP scan",
  },
];

type RolesTab = "role-groups" | "admin-units" | "adaptive-scopes";

export function RolesScopesPage() {
  // Source used two separate modals opened from tab-styled buttons
  // (`openAdminUnits()`/`openAdaptiveScopes()`), while "Role groups" itself
  // was the always-visible base page (not a modal). Reproduced as a TabBar
  // where the non-base tabs open a reference Modal, closing back to
  // "Role groups" — preserves source's modal-only treatment for the other
  // two views without inventing a fourth always-on page state.
  const [tab, setTab] = useState<RolesTab>("role-groups");

  return (
    <div>
      <div className={styles.pageH1}>Roles &amp; scopes</div>
      <div className={styles.pageSub}>Permissions for Microsoft Purview compliance features.</div>

      <TabBar
        tabs={[
          { key: "role-groups", label: "Role groups" },
          { key: "admin-units", label: "Admin units" },
          { key: "adaptive-scopes", label: "Adaptive scopes" },
        ]}
        active={tab}
        onChange={(key) => setTab(key as RolesTab)}
      />

      <DataTable<RoleGroupRow>
        columns={[
          { key: "name", header: "Role group", render: (r) => <span className={styles.rowLink}>{r.name}</span> },
          { key: "description", header: "Description", render: (r) => r.description },
          { key: "members", header: "Members", render: (r) => r.members },
        ]}
        rows={ROLE_GROUPS}
        getRowKey={(r) => r.name}
      />

      {tab === "admin-units" ? (
        <Modal title="Admin units (Entra ID)" onClose={() => setTab("role-groups")} width="760px">
          <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
            Restricted-administration scopes. Each unit groups users + groups; admins assigned to the unit can only act on that subset.
          </p>
          <DataTable<AdminUnitRow>
            columns={[
              { key: "name", header: "Name", render: (r) => <strong>{r.name}</strong> },
              { key: "members", header: "Members", render: (r) => r.members },
              { key: "restricted", header: "Restricted", render: (r) => r.restricted },
              { key: "admins", header: "Admins assigned", render: (r) => r.admins },
              { key: "created", header: "Created", render: (r) => r.created },
            ]}
            rows={ADMIN_UNITS}
            getRowKey={(r) => r.name}
          />
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 10 }}
            onClick={() => toast.info("+ Add admin unit wizard — opens Entra blade")}
          >
            + Add admin unit
          </button>
          <div className={styles.card} style={{ marginTop: 12, background: "#fff4ce", borderLeft: "3px solid #b8860b", padding: "10px 14px" }}>
            <strong>Restricted admin units</strong> prevent even Global Admins from acting on members unless explicitly delegated.
          </div>
        </Modal>
      ) : null}

      {tab === "adaptive-scopes" ? (
        <Modal title="Adaptive scopes" onClose={() => setTab("role-groups")} width="820px">
          <p style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
            Dynamically-evaluated target sets for retention policies + DLP based on Entra attributes (department, country, jobTitle, manager).
          </p>
          <DataTable<RolesAdaptiveScopeRow>
            columns={[
              { key: "name", header: "Name", render: (r) => <strong>{r.name}</strong> },
              { key: "type", header: "Type", render: (r) => r.type },
              { key: "filter", header: "Filter", render: (r) => r.filter },
              { key: "matching", header: "Currently matching", render: (r) => r.matching },
              { key: "usedBy", header: "Used by", render: (r) => r.usedBy },
            ]}
            rows={ROLES_PAGE_ADAPTIVE_SCOPES}
            getRowKey={(r) => r.name}
          />
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 10 }}
            onClick={() => toast.info("+ Add adaptive scope wizard")}
          >
            + Add adaptive scope
          </button>
          <div className={styles.card} style={{ marginTop: 12, background: "#deecf9", borderLeft: "3px solid #0078d4", padding: "10px 14px" }}>
            Adaptive scopes are re-evaluated daily. When attributes change, retention / DLP automatically applies to new matches and lifts from
            non-matches.
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// =====================================================================
// Settings
// =====================================================================
// Source's renderSettings() is a card grid of tenant-level setting
// categories (each just navigates back to 'settings' in source — i.e. inert
// placeholders) plus a "Reset simulator data" diagnostic button that called
// PurviewData.reset() + location.reload(). This simulator's container has no
// equivalent wired reset entry point at this porting layer (no sibling
// simulator exposes one from within a page component either — reset, where
// it exists at all, lives at the top-level simulator container/launcher,
// outside these page components' reach) — so this stays a toast-confirmed
// no-op that tells the admin where a real reset would need to be wired.

type SettingTile = { title: string; sub: string };

const SETTINGS_TILES: SettingTile[] = [
  { title: "Default tenant settings", sub: "Defaults that apply across compliance solutions" },
  { title: "Encryption (Azure RMS)", sub: "Configure Azure Information Protection key management" },
  { title: "Audit retention", sub: "Set how long audit logs are kept" },
  { title: "Auto-classification", sub: "Configure auto-classification engine" },
];

export function SettingsPage() {
  return (
    <div>
      <div className={styles.pageH1}>Settings</div>
      <div className={styles.pageSub}>Configure Purview-wide settings.</div>

      <div className={styles.cardGrid}>
        {SETTINGS_TILES.map((tile) => (
          <div
            key={tile.title}
            className={styles.tile}
            onClick={() => toast.info(`${tile.title} — reference view only in this simulator.`)}
          >
            <div className={styles.tileTitle}>{tile.title}</div>
            <div className={styles.tileSub}>{tile.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.h2}>Diagnostic</div>
      <div className={styles.card}>
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() =>
            toast.warning("Reset simulator data isn't wired at the Settings page level.", {
              description: "Use the simulator launcher's reset/restart action to clear local changes and reseed this environment.",
            })
          }
        >
          Reset simulator data
        </button>
      </div>
    </div>
  );
}
