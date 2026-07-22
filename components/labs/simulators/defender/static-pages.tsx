"use client";

// Static/reference pages for the Microsoft Defender XDR simulator: Reports,
// Settings, Learning hub (+ Trials / Partner catalog / Tutorials), and More
// resources. Ported from itbd-lab/simulators/defender/js/defender-portal.js
// renderReports() / renderSettings* () / renderLearningHub()/renderTrials()/
// renderPartnerCatalog()/renderTutorials() / renderMoreResources(). All of
// these are pure marketing-tile or read-only-reference content in the source
// — report/resource tiles just toast "opens in the real Defender portal",
// and Settings toggles/selects (`settingsToggle()` in source) are cosmetic
// only with no persisted effect. That is intentional fidelity to the source,
// not a gap: nothing here should write to DefenderState.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Checkbox, NativeSelect, SubTabBar } from "./defender-ui";
import styles from "./defender-console.module.css";

// ============================================================================
// Reports
// ============================================================================

type ReportTile = { title: string; description: string };

const GENERAL_REPORTS: ReportTile[] = [
  { title: "Security report", description: "Overall security posture trend across incidents, devices and identities" },
  { title: "Threat protection status", description: "Stopped, delivered and reported message volumes over time" },
];

const ENDPOINT_REPORTS: ReportTile[] = [
  { title: "Device health report", description: "Antivirus, sensor and firewall health across onboarded devices" },
  { title: "Device compliance trend", description: "Compliant vs. non-compliant device counts over the last 30 days" },
  { title: "Web protection", description: "Web threats blocked by category and top blocked domains" },
  { title: "Vulnerable devices report", description: "Devices with high-severity CVEs and available security updates" },
];

const EMAIL_REPORTS: ReportTile[] = [
  { title: "Email & collaboration report", description: "Mail flow volume, threats detected and user submissions" },
  { title: "User reported messages", description: "Volume and verdicts of messages reported by end users" },
  { title: "Spoof detections", description: "Spoofed senders detected via anti-phishing and DMARC policies" },
];

const IDENTITY_REPORTS: ReportTile[] = [
  { title: "Identity report", description: "Risky sign-ins, MFA registration and privileged account activity" },
  { title: "Sensor health report", description: "Directory sensor coverage and health across domain controllers" },
];

function ReportGroup({ heading, tiles }: { heading: string; tiles: ReportTile[] }) {
  return (
    <>
      <div className={styles.h2}>{heading}</div>
      <div className={styles.tileGrid}>
        {tiles.map((r) => (
          <div key={r.title} className={styles.tile} onClick={() => toast.info(`${r.title} opens in the real Defender portal.`)}>
            <div className={styles.tileTitle}>{r.title}</div>
            <div className={styles.tileSub}>{r.description}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ReportsPage() {
  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>Reports</span>
      </div>
      <div className={styles.pageH1}>Reports</div>
      <div className={styles.pageSub}>Review trends across your security posture, endpoints, email and identities.</div>

      <ReportGroup heading="General" tiles={GENERAL_REPORTS} />
      <ReportGroup heading="Endpoints" tiles={ENDPOINT_REPORTS} />
      <ReportGroup heading="Email & collaboration" tiles={EMAIL_REPORTS} />
      <ReportGroup heading="Identities" tiles={IDENTITY_REPORTS} />
    </div>
  );
}

// ============================================================================
// Settings
// ============================================================================

type ToggleRow = { id: string; label: string; hint?: string; defaultOn: boolean };
type SelectRow = { id: string; label: string; hint?: string; options: { value: string; label: string }[]; defaultValue: string };

function ToggleField({ row }: { row: ToggleRow }) {
  const [checked, setChecked] = useState(row.defaultOn);
  return (
    <Checkbox
      label={row.label}
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        toast.info(`${row.label}: ${next ? "On" : "Off"}${row.hint ? ` — ${row.hint}` : ""}`);
      }}
    />
  );
}

function SelectField({ row }: { row: SelectRow }) {
  const [value, setValue] = useState(row.defaultValue);
  return (
    <Field label={row.label} help={row.hint}>
      <NativeSelect
        value={value}
        onChange={(next) => {
          setValue(next);
          const opt = row.options.find((o) => o.value === next);
          toast.info(`${row.label} set to ${opt?.label ?? next}`);
        }}
        options={row.options}
      />
    </Field>
  );
}

// Small local Field wrapper (label + control), matching defender-ui's Field
// but kept adjacent to SelectField for readability — same styles.formGroup.
function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>
      {children}
      {help ? <div className={styles.formHelp}>{help}</div> : null}
    </div>
  );
}

type SettingsCard = { title: string; toggles?: ToggleRow[]; selects?: SelectRow[]; note?: string };
type SettingsBlade = { key: string; label: string; cards: SettingsCard[] };

const SETTINGS_BLADES: SettingsBlade[] = [
  {
    key: "xdr",
    label: "Microsoft Defender XDR",
    cards: [
      {
        title: "Email notifications",
        toggles: [
          { id: "notif-incident", label: "Incident notifications", defaultOn: true, hint: "Email is sent when a new incident is created or significantly updated" },
          { id: "notif-alert", label: "Alert notifications", defaultOn: true, hint: "Email per matching alert, filtered by severity" },
          { id: "notif-role", label: "Role-based recipients", defaultOn: true, hint: "Send to Security Reader / Operator / Admin role members" },
        ],
      },
      {
        title: "Auto-investigation level",
        selects: [
          {
            id: "auto-device",
            label: "Device automation level",
            defaultValue: "full",
            options: [
              { value: "full", label: "Full — remediate automatically" },
              { value: "semi-1", label: "Semi — require approval for non-temp folders" },
              { value: "semi-2", label: "Semi — require approval for any remediation" },
              { value: "none", label: "No automated response" },
            ],
          },
          {
            id: "auto-email",
            label: "Email automation level",
            defaultValue: "quarantine",
            options: [
              { value: "soft-delete", label: "Soft delete" },
              { value: "move-junk", label: "Move to junk" },
              { value: "quarantine", label: "Quarantine" },
              { value: "none", label: "No automated response" },
            ],
          },
        ],
      },
      { title: "Streaming API connectors", note: "EventHub, Storage Account and the Sentinel data connector are Connected. Managed from Cloud apps > Connectors." },
      { title: "Alert tuning & suppression rules", note: "Suppression rules (e.g. \"Suppress IT scanner test\") reduce noise from known-benign detections. Manage rules from an alert's context menu." },
    ],
  },
  {
    key: "endpoints",
    label: "Endpoints",
    cards: [
      { title: "Onboarding", note: "Onboard devices via Group Policy, Intune, Microsoft Configuration Manager, VDI script or a local onboarding script." },
      {
        title: "Attack Surface Reduction rules",
        note: "6 ASR rules configured, e.g. \"Block Office child processes\" and \"Block credential stealing from LSASS\" — most in Block mode, a few in Audit.",
      },
      { title: "AV exclusions", note: "Folder and process exclusions are tracked with a reason and an owner for periodic review." },
      {
        title: "Network protection & web threat protection",
        toggles: [
          { id: "ep-network-protection", label: "Network protection: Block mode", defaultOn: true, hint: "Blocks outbound connections to known malicious domains and IPs" },
          { id: "ep-web-threat", label: "Web threat protection", defaultOn: true, hint: "Blocks access to phishing and malware hosting sites" },
          { id: "ep-tamper", label: "Tamper protection", defaultOn: true, hint: "Prevents disabling of Defender services or settings — even by a local admin" },
        ],
      },
    ],
  },
  {
    key: "email",
    label: "Email & collaboration",
    cards: [
      { title: "Tenant Allow/Block List, Quarantine & Threat Explorer", note: "Manage protected senders/domains, quarantined messages and explorer views from their dedicated pages under Email & collaboration." },
      {
        title: "Anti-phish settings",
        selects: [
          {
            id: "email-phish-threshold",
            label: "Phishing email threshold",
            defaultValue: "2",
            options: [
              { value: "1", label: "1 — Standard" },
              { value: "2", label: "2 — Aggressive" },
              { value: "3", label: "3 — More aggressive" },
              { value: "4", label: "4 — Most aggressive" },
            ],
          },
          {
            id: "email-impersonation",
            label: "Impersonation protection",
            defaultValue: "quarantine",
            options: [
              { value: "quarantine", label: "Quarantine the message" },
              { value: "move-junk", label: "Move to Junk Email folder" },
              { value: "redirect", label: "Redirect the message" },
              { value: "none", label: "Take no action" },
            ],
          },
          {
            id: "email-mailbox-intel",
            label: "Mailbox intelligence",
            defaultValue: "enabled",
            options: [
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Disabled" },
            ],
          },
        ],
      },
      {
        title: "Safe Links & Safe Attachments",
        toggles: [
          { id: "email-safelinks", label: "Safe Links rewriting", defaultOn: true, hint: "Rewrites URLs in email so they're checked at time of click" },
          { id: "email-safeattach", label: "Safe Attachments dynamic delivery", defaultOn: true, hint: "Delivers the message body while attachments are detonated" },
          { id: "email-safeattach-internal", label: "Internal email Safe Attachments scanning", defaultOn: false, hint: "Off by default — scans attachments sent between internal mailboxes" },
        ],
      },
    ],
  },
  {
    key: "cloudapps",
    label: "Cloud apps",
    cards: [
      { title: "Connected apps", note: "Microsoft 365, Salesforce, ServiceNow, AWS and GCP are connected; Box is currently disconnected." },
      { title: "App tags", note: "Apps are grouped as Sanctioned, Unsanctioned, Monitored or a custom \"PII-storing\" tag with an associated risk level." },
      { title: "OAuth app policies", note: "One app (\"Pinpoint Notes\", unverified publisher) is flagged for Investigate — review from Cloud apps > OAuth apps." },
    ],
  },
  {
    key: "identities",
    label: "Identities",
    cards: [
      { title: "Sensors", note: "Directory sensors on dc01, dc02, adfs and the Entra cloud sensor are all reporting Healthy." },
      { title: "Directory service accounts (gMSA)", note: "Group Managed Service Accounts used by identity sensors for directory reads." },
      { title: "Sensitive accounts & honey tokens", note: "Domain Admins and Tier-0 Admins are marked sensitive; honey token accounts (e.g. svc-honey-finance) trigger an alert on any use." },
    ],
  },
  {
    key: "ti",
    label: "Threat intelligence",
    cards: [
      { title: "TI feeds", note: "Microsoft Threat Intelligence, Mandiant, AlienVault OTX, Abuse.ch Feodo Tracker and a CloudLab-Internal-TI feed are enabled." },
      { title: "Custom indicators (IoCs)", note: "File hash, IP, domain, URL and certificate indicators are managed as a single custom IOC list." },
      { title: "Threat analytics & campaigns", note: "Tracked campaigns include Storm-1234, FAKEUPDATES/TA569 and Volt Typhoon — see Threat analytics for detail." },
    ],
  },
];

function SettingsCardView({ card }: { card: SettingsCard }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{card.title}</div>
      {card.toggles?.map((row) => <ToggleField key={row.id} row={row} />)}
      {card.selects?.map((row) => <SelectField key={row.id} row={row} />)}
      {card.note ? <div className={styles.formHelp}>{card.note}</div> : null}
    </div>
  );
}

export function SettingsPage() {
  const [active, setActive] = useState(SETTINGS_BLADES[0].key);
  const blade = SETTINGS_BLADES.find((b) => b.key === active) ?? SETTINGS_BLADES[0];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>Settings</span>
      </div>
      <div className={styles.pageH1}>Settings</div>
      <div className={styles.pageSub}>Configure Microsoft Defender XDR, Endpoints, Email &amp; collaboration, Cloud apps, Identities and Threat intelligence.</div>

      <SubTabBar tabs={SETTINGS_BLADES.map((b) => ({ key: b.key, label: b.label }))} active={active} onChange={setActive} />

      <div style={{ marginTop: 16 }}>
        {blade.cards.map((card) => (
          <SettingsCardView key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Learning hub (+ Trials / Partner catalog / Tutorials)
// ============================================================================

const LEARNING_MODULES: ReportTile[] = [
  { title: "Get started with Microsoft Defender XDR", description: "Free Microsoft Learn module - 2 hours" },
  { title: "Hunt for threats with KQL", description: "Hands-on labs - 3 hours" },
  { title: "Investigate an incident end-to-end", description: "Guided walkthrough" },
  { title: "Configure attack surface reduction", description: "Best practice playbook" },
  { title: "SC-200 SOC Analyst certification prep", description: "Exam prep + practice questions" },
];

const TRIALS: ReportTile[] = [
  { title: "Microsoft Defender for Endpoint P2", description: "Full EDR, automated investigation and threat & vulnerability management" },
  { title: "Microsoft Defender for Identity", description: "Detect identity-based attacks across on-prem Active Directory" },
  { title: "Microsoft Defender for Office 365 P2", description: "Attack simulation training, automated investigation and response for email" },
  { title: "Microsoft Defender for Cloud Apps", description: "Discover shadow IT and control access with a cloud access security broker" },
];

const PARTNER_CATALOG: ReportTile[] = [
  { title: "CrowdStrike Falcon", description: "Microsoft Intelligent Security Association (MISA) partner — endpoint protection" },
  { title: "Palo Alto Cortex XSOAR", description: "MISA partner — security orchestration, automation and response" },
  { title: "Splunk", description: "MISA partner — SIEM and observability" },
  { title: "ServiceNow", description: "MISA partner — security incident response workflows" },
  { title: "Recorded Future", description: "MISA partner — threat intelligence enrichment" },
  { title: "Tenable Nessus", description: "MISA partner — vulnerability assessment" },
];

const TUTORIALS: ReportTile[] = [
  { title: "Run a simulated attack", description: "Walk through Attack simulation training end-to-end" },
  { title: "Investigate a phishing alert", description: "Step-by-step triage of a phishing alert into an incident" },
  { title: "Block a malicious URL", description: "Add a URL indicator and confirm it's blocked tenant-wide" },
  { title: "Isolate and remediate a device", description: "Contain a compromised device and verify remediation" },
];

function LearningGroup({ heading, tiles }: { heading: string; tiles: ReportTile[] }) {
  return (
    <>
      <div className={styles.h2}>{heading}</div>
      <div className={styles.tileGrid}>
        {tiles.map((t) => (
          <div key={t.title} className={styles.tile} onClick={() => toast.info(`${t.title} opens in the real Defender portal / Microsoft Learn.`)}>
            <div className={styles.tileTitle}>{t.title}</div>
            <div className={styles.tileSub}>{t.description}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function LearningHubPage() {
  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>Learning hub</span>
      </div>
      <div className={styles.pageH1}>Learning hub</div>
      <div className={styles.pageSub}>Training, trial add-ons, partner integrations and guided tutorials for Microsoft Defender XDR.</div>

      <LearningGroup heading="Learning hub" tiles={LEARNING_MODULES} />
      <LearningGroup heading="Trials" tiles={TRIALS} />
      <LearningGroup heading="Partner catalog" tiles={PARTNER_CATALOG} />
      <LearningGroup heading="Tutorials" tiles={TUTORIALS} />
    </div>
  );
}

// ============================================================================
// More resources
// ============================================================================

type ResourceLink = { title: string; description: string; href: string };
type ResourceTile = { title: string; description: string; links?: ResourceLink[]; comingSoon?: boolean };

const RESOURCE_TILES: ResourceTile[] = [
  {
    title: "Microsoft Purview compliance portal",
    description: "DLP, eDiscovery, retention",
    comingSoon: true,
  },
  {
    title: "Microsoft Sentinel",
    description: "Cloud-native SIEM (Azure portal)",
    links: [
      { title: "Sentinel overview", description: "Open Microsoft Sentinel in the Azure portal simulator", href: "/dashboard/labs/simulators/azure-vm" },
    ],
  },
  {
    title: "Microsoft Intune admin center",
    description: "Device management",
    links: [
      { title: "Intune admin center", description: "Onboarding, compliance, configuration and app management", href: "/dashboard/labs/simulators/intune" },
    ],
  },
  {
    title: "Microsoft Entra admin center",
    description: "Identity & access management",
    links: [
      { title: "Entra admin center", description: "Open Microsoft Entra ID in the Azure portal simulator", href: "/dashboard/labs/simulators/azure-vm" },
    ],
  },
];

const OTHER_SIMULATORS: ResourceLink[] = [
  { title: "Azure Virtual Desktop", description: "Session hosts, host pools and app groups", href: "/dashboard/labs/simulators/avd" },
  { title: "Active Directory", description: "Domain controllers, OUs and group policy", href: "/dashboard/labs/simulators/adds" },
  { title: "Microsoft 365 admin center", description: "Users, licenses and service health", href: "/dashboard/labs/simulators/m365" },
  { title: "Windows Server", description: "Server manager, roles and features", href: "/dashboard/labs/simulators/winserver" },
];

function ResourceCard({ tile }: { tile: ResourceTile }) {
  if (tile.comingSoon) {
    return (
      <div
        className={styles.tile}
        style={{ opacity: 0.6, cursor: "not-allowed" }}
        onClick={() => toast.info("This simulator isn't built yet. Coming in a future update.")}
      >
        <div className={styles.tileTitle}>{tile.title}</div>
        <div className={styles.tileSub}>{tile.description} &mdash; coming in a future update</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        {tile.title} <span style={{ fontWeight: 400, color: "#605e5c", fontSize: 12 }}>&middot; {tile.description}</span>
      </div>
      {tile.links?.map((link) => (
        <Link key={link.href + link.title} href={link.href} className={styles.tile} style={{ display: "block", marginBottom: 8, textDecoration: "none" }}>
          <div className={styles.tileTitle}>{link.title}</div>
          <div className={styles.tileSub}>{link.description}</div>
        </Link>
      ))}
    </div>
  );
}

export function MoreResourcesPage({ onExternalNote }: { onExternalNote?: () => void }) {
  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>More resources</span>
      </div>
      <div className={styles.pageH1}>More resources</div>
      <div className={styles.pageSub}>Jump to related Microsoft admin centers and simulators in this lab.</div>

      <div className={styles.tileGrid}>
        {RESOURCE_TILES.map((tile) => (
          <ResourceCard key={tile.title} tile={tile} />
        ))}
      </div>

      <div className={styles.h2}>Other simulators in this lab</div>
      <div className={styles.tileGrid}>
        {OTHER_SIMULATORS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={styles.tile}
            style={{ display: "block", textDecoration: "none" }}
            onClick={() => onExternalNote?.()}
          >
            <div className={styles.tileTitle}>{link.title}</div>
            <div className={styles.tileSub}>{link.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
