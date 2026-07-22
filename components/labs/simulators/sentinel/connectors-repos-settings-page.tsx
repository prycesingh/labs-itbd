"use client";

// Data connectors + Repositories + Workspace manager (MSSP) + Settings —
// ported from itbd-lab/simulators/sentinel/js/sentinel-portal.js
// renderDataConnectors()/CONNECTOR_GUIDES/openConnectorSetup(),
// renderRepositories()/connectRepo()/syncRepo()/disconnectRepo()/editRepoBranch(),
// renderWorkspaceMgr(), and renderSettings()/renderSettingsPricing()/
// renderSettingsWorkspace()/renderSettingsAudit()/renderSettingsDetails().
//
// State mutations go through the real sentinelReducer (TOGGLE_CONNECTOR,
// ADD_REPO, SYNC_REPO, DISCONNECT_REPO, UPDATE_WORKSPACE_SETTINGS) — none of
// these components hold parallel local copies of persisted data. SYNC_REPO's
// `deployedRules` bump is fully deterministic inside the reducer (see
// reducer.ts); the brief `setTimeout` here is a pure loading-affordance delay,
// not a data mutation (source faked the mutation itself with Math.random(),
// which the reducer intentionally does not carry forward).

import { useMemo, useState, type Dispatch } from "react";
import { toast } from "sonner";

import type { SentinelConnector, SentinelRepo, SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Modal,
  NativeSelect,
  StatRow,
  StatusPill,
  SubTabBar,
  statusTone,
  type DataTableColumn,
} from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/* =========================================================================
 * 1. DATA CONNECTORS
 * ========================================================================= */

// Ported verbatim (per connector `kind`) from source's CONNECTOR_GUIDES —
// real prereq/step/verify-KQL/notes reference content, not placeholder copy.
type ConnectorGuide = { preReqs: string[]; steps: string[]; verifyKql: string; notes: string; tables: string[] };

const CONNECTOR_GUIDES: Record<string, ConnectorGuide> = {
  AzureActivityLog: {
    preReqs: ["Sentinel-enabled Log Analytics workspace", "Subscription Owner or Contributor at the subscription scope"],
    steps: [
      'In Sentinel → Data connectors → search "Azure Activity"',
      "Click Open connector page",
      "In the right pane, click Launch Azure Policy Assignment Wizard",
      "Pick the Management Group or Subscription scope to onboard",
      "Save the policy assignment — Activity logs flow to AzureActivity table in ~10 minutes",
      "Verify with: AzureActivity | take 10",
    ],
    verifyKql: "AzureActivity | summarize count() by CategoryValue | sort by count_ desc",
    notes: "Best-practice: scope at Management Group so new subscriptions auto-onboard. Costs ~0 for activity logs (control-plane only).",
    tables: ["AzureActivity"],
  },
  AzureActiveDirectory: {
    preReqs: ["Entra ID P1 or P2 license (for SigninLogs ingestion)", "Global Admin or Security Administrator role on the tenant"],
    steps: [
      "Open the Azure Active Directory connector",
      "Under Configuration, tick the log categories you want: SigninLogs, AuditLogs, NonInteractiveUserSignInLogs, ServicePrincipalSignInLogs, ProvisioningLogs, ADFSSignInLogs, RiskyUsers",
      "Click Apply changes — this creates a Diagnostic Setting on the tenant",
      "Tables populate in ~15 minutes",
      "Enable the bundled analytics rules + workbooks",
    ],
    verifyKql: "SigninLogs | take 10 | project TimeGenerated, UserPrincipalName, ResultType, IPAddress, AppDisplayName",
    notes: "Ingestion cost can be heavy — NonInteractiveSigninLogs is the largest. Use Basic Logs / DCR transformations to drop noise.",
    tables: ["SigninLogs", "AuditLogs", "AADNonInteractiveUserSignInLogs", "AADServicePrincipalSignInLogs", "AADProvisioningLogs", "ADFSSignInLogs"],
  },
  AzureActiveDirectoryIdentityProtection: {
    preReqs: ["Entra ID P2 license", "Security Administrator on the tenant"],
    steps: [
      "Open the Microsoft Entra ID Protection connector",
      "Click Connect — pulls risky users + risky sign-ins as SecurityAlert rows",
      'Optional: enable the "Sign-in risk detected" + "User risk detected" analytics rules',
    ],
    verifyKql: 'SecurityAlert | where ProviderName == "IPC" | take 10',
    notes: "Risky sign-in scoring uses Microsoft's ML — do not re-implement these detections in custom rules.",
    tables: ["SecurityAlert"],
  },
  AzureSecurityCenter: {
    preReqs: ["Microsoft Defender for Cloud — at least one plan enabled on subscription", "Security Admin on the subscription"],
    steps: [
      "Open the Microsoft Defender for Cloud connector",
      "Tick each Subscription you want to forward alerts from",
      'Click Apply changes — alerts appear as SecurityAlert with ProductName == "Azure Security Center"',
      'Optional: enable "Create incidents from MS Defender for Cloud alerts" analytics rule',
    ],
    verifyKql: 'SecurityAlert | where ProductName has "Defender for Cloud" | take 10',
    notes: "Defender for Cloud has its own incident view in the portal too — Sentinel is the merged SOC view.",
    tables: ["SecurityAlert"],
  },
  MicrosoftThreatProtection: {
    preReqs: ["Microsoft Defender XDR license (M365 E5 / SecurityE5 / standalone)", "Global Admin or Security Admin"],
    steps: [
      "Open the Microsoft Defender XDR connector",
      "Click Connect Incidents & Alerts — incidents from MDE, MDI, MDO, MCAS arrive in Sentinel",
      "Toggle Raw event tables ON if you want the device telemetry (DeviceProcessEvents, DeviceNetworkEvents, etc.) — adds cost",
      "Disable the equivalent Microsoft 365 Defender connector if previously enabled (deprecated)",
    ],
    verifyKql: 'SecurityIncident | where ProviderName == "Microsoft 365 Defender" | take 10',
    notes: "XDR connector replaces the legacy MDE / MDO / MDI / MCAS individual connectors. Bi-directional sync of incidents.",
    tables: ["SecurityIncident", "SecurityAlert", "DeviceProcessEvents", "DeviceNetworkEvents", "EmailEvents", "EmailAttachmentInfo", "EmailUrlInfo", "UrlClickEvents"],
  },
  Office365: {
    preReqs: ["Microsoft 365 E3/E5/Business Premium tenant", "Global Admin to authorize first time"],
    steps: [
      "Open the Office 365 connector",
      "Tick Exchange, SharePoint, Teams sources you want",
      "Click Apply changes and consent to the OAuth permission request",
      "Wait 15 min for first events in OfficeActivity",
    ],
    verifyKql: "OfficeActivity | summarize count() by RecordType, Operation | sort by count_ desc",
    notes: "Free of charge for ingestion under the M365 commitment — most useful free connector in Sentinel.",
    tables: ["OfficeActivity"],
  },
  ThreatIntelligence: {
    preReqs: ["TI provider with TAXII server URL + collection ID + API key, OR direct upload of STIX 2.0 indicators"],
    steps: [
      "Open the Threat Intelligence — TAXII connector (or Platforms / Upload Indicators API)",
      "Click Configure",
      "Enter Friendly name, API root URL, Collection ID, Username, Password",
      "Click Add — Sentinel begins polling every hour",
      "Verify in Threat intelligence blade — indicators appear with the source name",
    ],
    verifyKql: 'ThreatIntelligenceIndicator | where SourceSystem == "<your-source>" | take 10',
    notes: "Common free feeds: AlienVault OTX, abuse.ch URLhaus, CrowdStrike FalconX (premium). Custom: upload via Sentinel API.",
    tables: ["ThreatIntelligenceIndicator"],
  },
  AmazonWebServicesCloudTrail: {
    preReqs: ["AWS account with CloudTrail enabled", "Permission to create IAM role + OIDC provider in AWS"],
    steps: [
      "Open the Amazon Web Services S3 connector (or CloudTrail legacy)",
      "Run the Microsoft-provided CloudFormation template to create the IAM role with OIDC trust",
      "Note the generated Role ARN",
      "In Sentinel, paste the Role ARN, S3 bucket name, SQS URL",
      "Pick log type: CloudTrail / GuardDuty / VPC Flow / AWS WAF",
      "Click Add connection — logs ingest within 15 minutes",
    ],
    verifyKql: "AWSCloudTrail | take 10 | project TimeGenerated, EventName, UserIdentityType, AWSRegion",
    notes: "OIDC trust replaces long-lived access keys — recommended pattern since 2023. Use one role per data source.",
    tables: ["AWSCloudTrail", "AWSGuardDuty", "AWSVPCFlow", "AWSWAF"],
  },
  GCP: {
    preReqs: ["GCP project with required APIs (PubSub, IAM, Cloud Audit)", "GCP Owner or IAM Admin"],
    steps: [
      "Open the Google Cloud Platform IAM connector",
      "In GCP, run Microsoft-provided Terraform / gcloud script to:",
      "Create Service Account",
      "Create Workload Identity Pool + Provider (federation to Entra)",
      "Grant roles/logging.viewer + PubSub permissions",
      "Set up a Cloud Logging sink to PubSub topic",
      "Paste GCP Project ID, Workload Identity Pool ID, Provider ID, Service Account email into Sentinel",
      "Click Add connection — IAM + audit logs ingest within ~10 minutes",
    ],
    verifyKql: "GCPAuditLogs | take 10 | project TimeGenerated, MethodName, ProjectId, PrincipalEmail",
    notes: "GCP connector uses Workload Identity Federation — no GCP service-account keys are stored.",
    tables: ["GCPAuditLogs"],
  },
  CEF: {
    preReqs: ["A Linux VM (Ubuntu 18.04+/CentOS 7+/RHEL 7+) reachable from your CEF appliances", "Sudo on that VM"],
    steps: [
      "Open the Common Event Format (CEF) connector",
      "Copy the install command shown: sudo wget -O cef_installer.py https://raw.githubusercontent.com/Azure/Azure-Sentinel/master/DataConnectors/CEF/cef_installer.py && sudo python cef_installer.py [WorkspaceID] [WorkspaceKey]",
      "On the Linux forwarder VM, run that command — installs OMS Agent + rsyslog config",
      "Configure your CEF sender (Palo Alto, Cisco ASA, F5, Imperva, Symantec, Forcepoint, etc.) to send to UDP 514 on the forwarder",
      "Verify with tail -f /var/log/messages on the forwarder",
      "CEF events arrive as CommonSecurityLog rows in ~5 minutes",
    ],
    verifyKql: "CommonSecurityLog | summarize count() by DeviceVendor, DeviceProduct",
    notes: "AMA (Azure Monitor Agent) is replacing OMS Agent in 2024+. Use the AMA-based \"CEF via AMA\" connector for new deployments.",
    tables: ["CommonSecurityLog"],
  },
  DNS: {
    preReqs: ["Windows DNS servers with DNS analytical logs enabled", "AMA installed on each DNS server"],
    steps: [
      "Open the Windows DNS Events via AMA connector",
      "Click Create data collection rule",
      "Pick the Sentinel workspace as destination",
      "Pick the DNS servers (must have AMA already installed)",
      "Choose log categories: DnsServer (queries), DnsServerAuditLog (zone changes)",
      "Click Create — events land in DnsEvents table",
    ],
    verifyKql: 'DnsEvents | where ResultCode == 3 or QueryType !in ("A","AAAA","PTR") | take 10',
    notes: "DNS analytical logging on Windows can be high-volume — use DCR transformations to drop low-value queries (NXDOMAIN bots, AAAA when no IPv6).",
    tables: ["DnsEvents"],
  },
  Syslog: {
    preReqs: ["Linux server with syslog daemon (rsyslog / syslog-ng)", "AMA installed"],
    steps: [
      "Open the Syslog via AMA connector",
      "Create a Data Collection Rule (DCR)",
      "Select the Linux VMs as resources",
      "Pick facilities (auth, daemon, syslog, etc.) and minimum severity",
      "Click Create",
      "Events flow to Syslog table within 5 min",
    ],
    verifyKql: "Syslog | summarize count() by Facility, SeverityLevel",
    notes: "Syslog via AMA is the modern path; OMS Agent (MMA) retires Aug 2024. Migrate to AMA-based connector now.",
    tables: ["Syslog"],
  },
};

function ConnectorSetupModal({ connector, dispatch, onClose }: { connector: SentinelConnector; dispatch: Dispatch<SentinelAction>; onClose: () => void }) {
  const guide: ConnectorGuide = CONNECTOR_GUIDES[connector.kind] ?? { preReqs: [], steps: [], verifyKql: "", notes: "", tables: connector.dataTypes };
  const isConnected = connector.status === "Connected";

  return (
    <Modal title={`${connector.name} · ${connector.provider}`} onClose={onClose} width="760px">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, color: "#605e5c", textTransform: "uppercase", letterSpacing: 0.5 }}>Records last 24 h</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{connector.recordsLast24h ? formatNum(connector.recordsLast24h) : "0"}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#605e5c", textTransform: "uppercase", letterSpacing: 0.5 }}>Last ingest</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{connector.lastIngest}</div>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <StatusPill tone={statusTone(connector.status)}>{connector.status}</StatusPill>
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong>Tables populated:</strong>
        <br />
        {guide.tables.map((t) => (
          <code key={t} style={{ background: "#f3f2f1", padding: "2px 6px", borderRadius: 2, fontSize: 11, marginRight: 4, display: "inline-block", marginTop: 4 }}>
            {t}
          </code>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong>Prerequisites</strong>
        <ul style={{ margin: "6px 0 0 18px", lineHeight: 1.7 }}>
          {guide.preReqs.length ? guide.preReqs.map((p, i) => <li key={i}>{p}</li>) : <li><em>(none — managed connector)</em></li>}
        </ul>
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong>Setup steps</strong>
        <ol style={{ margin: "6px 0 0 18px", lineHeight: 1.7 }}>
          {guide.steps.length ? guide.steps.map((s, i) => <li key={i}>{s}</li>) : <li><em>(no manual steps — auto-connected)</em></li>}
        </ol>
      </div>

      {guide.verifyKql ? (
        <div style={{ marginBottom: 14 }}>
          <strong>Verify with KQL</strong>
          <pre className={styles.kql} style={{ minHeight: "auto", fontSize: 12, marginTop: 6 }}>
            {guide.verifyKql}
          </pre>
        </div>
      ) : null}

      {guide.notes ? (
        <div style={{ background: "#deecf9", padding: "10px 14px", borderLeft: "3px solid #0078d4", fontSize: 13, marginBottom: 14 }}>
          <strong>Note:</strong> {guide.notes}
        </div>
      ) : null}

      <div className={styles.modalFooter} style={{ margin: "0 -18px -18px", padding: "12px 18px" }}>
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => {
            toast.info("Testing connector reachability…");
            setTimeout(() => toast.success("Connector reachable. Last successful ingest: just now."), 1200);
          }}
        >
          Test connection
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            dispatch({ type: "TOGGLE_CONNECTOR", id: connector.id });
            toast[isConnected ? "info" : "success"](`${connector.name} ${isConnected ? "disconnected" : "connected — events ingesting"}`);
          }}
        >
          {isConnected ? "Disconnect" : "Connect"}
        </button>
        <button type="button" className={styles.btn} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

export function DataConnectorsPage({ state, dispatch }: { state: SentinelState; dispatch: Dispatch<SentinelAction> }) {
  const [openConnectorId, setOpenConnectorId] = useState<string | null>(null);
  const openConnector = state.connectors.find((c) => c.id === openConnectorId) ?? null;

  const connectedCount = state.connectors.filter((c) => c.status === "Connected").length;

  const columns: DataTableColumn<SentinelConnector>[] = [
    { key: "name", header: "Connector", render: (c) => <span className={styles.rowLink}>{c.name}</span> },
    { key: "provider", header: "Provider", render: (c) => c.provider },
    { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
    { key: "dataTypes", header: "Data types", render: (c) => c.dataTypes.join(", ") },
    { key: "recordsLast24h", header: "Records 24h", render: (c) => (c.recordsLast24h ? formatNum(c.recordsLast24h) : "-") },
    { key: "lastIngest", header: "Last ingest", render: (c) => c.lastIngest },
    {
      key: "actions",
      header: "Actions",
      render: (c) => (
        <button
          type="button"
          className={styles.btnOutline}
          onClick={(e) => {
            e.stopPropagation();
            const wasConnected = c.status === "Connected";
            dispatch({ type: "TOGGLE_CONNECTOR", id: c.id });
            toast[wasConnected ? "info" : "success"](`${c.name} ${wasConnected ? "disconnected" : "connected — events ingesting"}`);
          }}
        >
          {c.status === "Connected" ? "Disconnect" : "Connect"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.h2}>Data connectors</div>
      <div className={styles.sub}>Ingest data from Microsoft and 3rd-party services into Sentinel. Click any connector for setup instructions.</div>

      <StatRow
        stats={[
          { label: "Connected", value: connectedCount },
          { label: "Available", value: state.connectors.length - connectedCount },
          { label: "Total connectors", value: state.connectors.length },
        ]}
      />

      <DataTable columns={columns} rows={state.connectors} getRowKey={(c) => c.id} onRowClick={(c) => setOpenConnectorId(c.id)} />

      {openConnector ? <ConnectorSetupModal connector={openConnector} dispatch={dispatch} onClose={() => setOpenConnectorId(null)} /> : null}
    </div>
  );
}

/* =========================================================================
 * 2. REPOSITORIES
 * ========================================================================= */

function ConnectRepoModal({ dispatch, onClose }: { dispatch: Dispatch<SentinelAction>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<"GitHub" | "Azure DevOps">("GitHub");
  const [org, setOrg] = useState("cloudlab-inc");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [folder, setFolder] = useState("/");

  const canSubmit = name.trim().length > 0 && org.trim().length > 0 && repo.trim().length > 0 && branch.trim().length > 0;

  function submit() {
    if (!canSubmit) {
      toast.error("Name, org, repo and branch are required.");
      return;
    }
    const newRepo: SentinelRepo = {
      id: "repo-" + crypto.randomUUID(),
      name: name.trim(),
      source,
      org: org.trim(),
      repo: repo.trim(),
      branch: branch.trim(),
      folder: folder.trim() || "/",
      deployedRules: 0,
      status: "Connected",
      lastSync: new Date().toISOString(),
    };
    dispatch({ type: "ADD_REPO", repo: newRepo });
    toast.success("Repository connected. First sync queued.");
    onClose();
  }

  return (
    <Modal title="Connect repository" onClose={onClose} width="560px">
      <Field label="Display name in Sentinel">
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="cloudlab-sentinel-content" />
      </Field>
      <Field label="Source">
        <NativeSelect
          value={source}
          onChange={(v) => setSource(v as "GitHub" | "Azure DevOps")}
          options={[
            { value: "GitHub", label: "GitHub" },
            { value: "Azure DevOps", label: "Azure DevOps" },
          ]}
        />
      </Field>
      <Field label={source === "GitHub" ? "GitHub organization" : "Azure DevOps organization"}>
        <input className={styles.input} value={org} onChange={(e) => setOrg(e.target.value)} />
      </Field>
      <Field label="Repository name">
        <input className={styles.input} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="sentinel-content" />
      </Field>
      <Field label="Branch">
        <input className={styles.input} value={branch} onChange={(e) => setBranch(e.target.value)} />
      </Field>
      <Field label="Content folder (relative to repo root)" help="e.g. detections/ or /">
        <input className={styles.input} value={folder} onChange={(e) => setFolder(e.target.value)} />
      </Field>

      <div className={styles.modalFooter} style={{ margin: "18px -18px -18px", padding: "12px 18px" }}>
        <button type="button" className={styles.btnOutline} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.btn} onClick={submit}>
          Connect repository
        </button>
      </div>
    </Modal>
  );
}

export function RepositoriesPage({ state, dispatch }: { state: SentinelState; dispatch: Dispatch<SentinelAction> }) {
  const [showConnect, setShowConnect] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  function handleSync(repo: SentinelRepo) {
    setSyncingId(repo.id);
    toast.info(`Pulling latest from ${repo.org}/${repo.repo}@${repo.branch}…`);
    // Brief UX-only delay before the real dispatch — no data mutation happens
    // here; SYNC_REPO in the reducer deterministically bumps deployedRules.
    setTimeout(() => {
      dispatch({ type: "SYNC_REPO", id: repo.id });
      setSyncingId(null);
      toast.success(`Sync complete for ${repo.name}.`);
    }, 900);
  }

  function handleDisconnect(repo: SentinelRepo) {
    dispatch({ type: "DISCONNECT_REPO", id: repo.id });
    toast.success("Repository disconnected.");
  }

  const columns: DataTableColumn<SentinelRepo>[] = [
    { key: "name", header: "Name", render: (r) => <b>{r.name}</b> },
    { key: "source", header: "Source", render: (r) => r.source },
    { key: "orgRepo", header: "Org/Repo", render: (r) => <code>{r.org}/{r.repo}</code> },
    { key: "branch", header: "Branch", render: (r) => <code>{r.branch}</code> },
    { key: "folder", header: "Folder", render: (r) => <code>{r.folder}</code> },
    { key: "deployedRules", header: "Deployed rules", render: (r) => r.deployedRules },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
    { key: "lastSync", header: "Last sync", render: (r) => new Date(r.lastSync).toLocaleString() },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.btnOutline} disabled={syncingId === r.id} onClick={() => handleSync(r)}>
            {syncingId === r.id ? "Syncing…" : "Sync now"}
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => handleDisconnect(r)} style={{ color: "#a4262c" }}>
            Disconnect
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.h2}>Repositories</div>
      <div className={styles.sub}>
        Connect GitHub or Azure DevOps repos to deploy Sentinel content as code (analytics rules, workbooks, playbooks, hunting queries, watchlists). Sentinel
        watches the configured branch and auto-deploys on push via GitHub Actions / Azure Pipelines.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0" }}>
        <div>
          <b>{state.repos.length} connected</b>
        </div>
        <button type="button" className={styles.btn} onClick={() => setShowConnect(true)}>
          + Connect repository
        </button>
      </div>

      <DataTable columns={columns} rows={state.repos} getRowKey={(r) => r.id} emptyMessage="No repositories connected." />

      <div style={{ marginTop: 14, background: "#deecf9", padding: "12px 16px", borderLeft: "3px solid #0078d4", fontSize: 13 }}>
        <b>How it works (GitHub):</b> Sentinel creates a GitHub App installation on your repo with read-only access to a folder. On push to <code>main</code>,
        a GitHub Actions workflow (auto-generated) validates the YAML schema for each rule/workbook/playbook, then calls the Sentinel REST API to deploy.
        Conflict resolution: <i>Source = source of truth</i>. UI-edited content is overwritten on the next sync.
      </div>
      <div style={{ marginTop: 10, background: "#fff4ce", padding: "12px 16px", borderLeft: "3px solid #876900", fontSize: 13 }}>
        <b>Best practice:</b> separate repo per workspace (dev/test/prod). Use a Pull Request workflow + branch protection on main. Run schema validation in CI
        before merge. Tag releases for rollback (<code>v2026.5.1</code>). Never edit deployed content in the UI — fork the source repo instead.
      </div>

      {showConnect ? <ConnectRepoModal dispatch={dispatch} onClose={() => setShowConnect(false)} /> : null}
    </div>
  );
}

/* =========================================================================
 * 3. WORKSPACE MANAGER (MSSP) — static reference content, matching source
 * ========================================================================= */

type MsspCustomer = {
  name: string;
  sub: string;
  region: string;
  tenant: string;
  content: string;
  sync: string;
  alerts24h: number;
  ingest: string;
  cost: string;
};

const MSSP_CUSTOMERS: MsspCustomer[] = [
  { name: "cloudlab-sentinel-ws (central)", sub: "CloudLab-MSSP-Sub", region: "Central India", tenant: "cloudlab.onmicrosoft.com", content: "v2.4.0", sync: "Central", alerts24h: 12, ingest: "142 GB/day", cost: "$10,200/mo" },
  { name: "customer-acme-retail-ws", sub: "ACME-Sentinel-Sub", region: "East US 2", tenant: "acmeretail.onmicrosoft.com", content: "v2.4.0", sync: "Healthy 14:42", alerts24h: 247, ingest: "420 GB/day", cost: "$28,400/mo" },
  { name: "customer-fincorp-bank-ws", sub: "FinCorp-Sec-Sub", region: "Central India", tenant: "fincorp.onmicrosoft.com", content: "v2.4.0", sync: "Healthy 14:38", alerts24h: 184, ingest: "380 GB/day", cost: "$25,200/mo" },
  { name: "customer-medplus-pharma-ws", sub: "MedPlus-Sec-Sub", region: "Central India", tenant: "medpluspharma.onmicrosoft.com", content: "v2.4.0", sync: "Healthy 14:40", alerts24h: 87, ingest: "180 GB/day", cost: "$12,400/mo" },
  { name: "customer-techstart-saas-ws", sub: "TechStart-Sub", region: "East US 2", tenant: "techstart.onmicrosoft.com", content: "v2.3.8 (1 minor behind)", sync: "Healthy 14:30", alerts24h: 42, ingest: "85 GB/day", cost: "$6,800/mo" },
  { name: "customer-cloudgov-public-ws", sub: "CloudGov-Sec-Sub", region: "India Central", tenant: "cloudgov.onmicrosoft.com", content: "v2.4.0", sync: "Failing (10 hrs)", alerts24h: 18, ingest: "40 GB/day", cost: "$3,200/mo" },
];

type MsspContentPack = { name: string; items: number; lastPushed: string; status: string; includes: string };

const MSSP_CONTENT_PACKS: MsspContentPack[] = [
  { name: "CloudLab-Baseline-Rules", items: 47, lastPushed: "2 days ago", status: "Synced to 5/6 customers", includes: "47 analytics rules + 12 workbooks + 8 playbook templates" },
  { name: "CloudLab-RetailIndustry-Pack", items: 18, lastPushed: "1 week ago", status: "Synced to acme + medplus", includes: "18 retail-specific detections (POS, PCI, checkout fraud)" },
  { name: "CloudLab-Banking-Pack", items: 24, lastPushed: "5 days ago", status: "Synced to fincorp", includes: "24 BFSI detections (SWIFT, ACH, internal fraud)" },
  { name: "CloudLab-Healthcare-Pack", items: 14, lastPushed: "3 days ago", status: "Synced to medplus", includes: "14 healthcare detections (HIPAA breaches, PHI access patterns)" },
];

export function WorkspaceManagerPage() {
  return (
    <div>
      <div className={styles.h2}>Workspace manager (MSSP)</div>
      <div className={styles.sub}>Manage 6 customer Sentinel workspaces centrally. Push rules + workbooks + playbooks from this central workspace.</div>

      <StatRow
        stats={[
          { label: "Managed customers", value: "6" },
          { label: "Total alerts 24h", value: "590" },
          { label: "Daily ingest", value: "1.25 TB" },
          { label: "Customer billing /mo", value: "$86k" },
          { label: "Sync healthy", value: "5/6" },
        ]}
      />

      <h3 className={styles.h3}>Managed workspaces</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Customer tenant</th>
              <th>Region</th>
              <th>Content version</th>
              <th>Sync</th>
              <th>Alerts 24h</th>
              <th>Daily ingest</th>
              <th>Monthly cost</th>
            </tr>
          </thead>
          <tbody>
            {MSSP_CUSTOMERS.map((c) => (
              <tr key={c.name}>
                <td>
                  <b style={{ color: "#0078d4" }}>{c.name}</b>
                  <br />
                  <span style={{ fontSize: 11, color: "#605e5c" }}>{c.sub}</span>
                </td>
                <td style={{ fontSize: 11 }}>
                  <code>{c.tenant}</code>
                </td>
                <td>{c.region}</td>
                <td>
                  <span style={{ color: c.content.includes("behind") ? "#d83b01" : "#107c10" }}>{c.content}</span>
                </td>
                <td>
                  <StatusPill tone={c.sync.startsWith("Failing") ? "err" : "ok"}>{c.sync}</StatusPill>
                </td>
                <td style={{ textAlign: "right" }}>{c.alerts24h}</td>
                <td style={{ fontSize: 11 }}>{c.ingest}</td>
                <td style={{ fontSize: 11, color: "#107c10", fontWeight: 600 }}>{c.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Onboarding isn't wired up in this simulator yet.")}>
          + Onboard customer workspace
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Push isn't wired up in this simulator yet.")}>
          Push content to all
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Health check isn't wired up in this simulator yet.")}>
          Health check all
        </button>
      </div>

      <h3 className={styles.h3} style={{ marginTop: 24 }}>
        Content packs (centrally managed)
      </h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Pack name</th>
              <th>Items</th>
              <th>Last pushed</th>
              <th>Sync status</th>
              <th>Includes</th>
            </tr>
          </thead>
          <tbody>
            {MSSP_CONTENT_PACKS.map((p) => (
              <tr key={p.name}>
                <td>
                  <b>{p.name}</b>
                </td>
                <td style={{ textAlign: "right" }}>{p.items}</td>
                <td>{p.lastPushed}</td>
                <td>{p.status}</td>
                <td style={{ fontSize: 11, color: "#605e5c" }}>{p.includes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Pack creation isn't wired up in this simulator yet.")}>
          + Create new pack
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Import isn't wired up in this simulator yet.")}>
          Import from Content Hub
        </button>
      </div>

      <h3 className={styles.h3} style={{ marginTop: 24 }}>
        Delegation model
      </h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td style={{ width: "30%", background: "#faf9f8", fontWeight: 600 }}>Lighthouse delegation</td>
              <td>Configured. Customer accepts via offer page. Central engineers see customer workspace in own tenant context.</td>
            </tr>
            <tr>
              <td style={{ background: "#faf9f8", fontWeight: 600 }}>RBAC scopes per customer</td>
              <td>
                Tier-1 analysts: <code>Sentinel Reader</code>. Tier-2 + IR: <code>Sentinel Contributor</code>. Pack push: <code>Sentinel Author</code>.
              </td>
            </tr>
            <tr>
              <td style={{ background: "#faf9f8", fontWeight: 600 }}>Token replay protection</td>
              <td>Conditional Access on the MSSP tenant: Require compliant device + Authentication Strengths &quot;Phishing-resistant MFA&quot;.</td>
            </tr>
            <tr>
              <td style={{ background: "#faf9f8", fontWeight: 600 }}>Customer isolation</td>
              <td>Each customer workspace is in its own subscription. No cross-customer read.</td>
            </tr>
            <tr>
              <td style={{ background: "#faf9f8", fontWeight: 600 }}>Audit trail</td>
              <td>
                All Lighthouse actions logged to <code>AzureActivity</code> in the customer tenant AND <code>LighthouseManagedResources</code> in the MSSP
                tenant.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: "#deecf9", padding: "12px 16px", borderLeft: "3px solid #0078d4", marginTop: 14, fontSize: 12 }}>
        <b>How content distribution works:</b> Author content in the central workspace → Workspace Manager pushes to customer workspaces via ARM API →
        customers see new rules with the same names + IDs. Tuning per customer (thresholds, exclusions) lives in <i>customer</i> workspace; the rule template
        lives <i>centrally</i>. Rule conflict resolution: customer-side tuning wins if it diverges, else inherits central.
      </div>
      <div style={{ background: "#fff4ce", padding: "12px 16px", borderLeft: "3px solid #ffaa44", marginTop: 10, fontSize: 12 }}>
        <b>Common MSSP gotchas:</b> 1) Customer ingestion cost overrun (set per-customer daily caps + budget alerts). 2) Content version drift (some
        customers reject pushes — track who is behind). 3) Lighthouse offer revoked accidentally by customer → loss of management. Set up an email alert
        when delegations are removed.
      </div>
    </div>
  );
}

/* =========================================================================
 * 4. SETTINGS
 * ========================================================================= */

type PricingTier = { id: string; label: string; pricePerGB: number; commitmentGB: number; description: string };

// Ported verbatim from source's renderSettingsPricing() tiers list.
const PRICING_TIERS: PricingTier[] = [
  { id: "PerGB", label: "Pay-as-you-go (per GB)", pricePerGB: 2.76, commitmentGB: 0, description: "Standard rate for low/variable ingest." },
  { id: "Commit100", label: "100 GB / day commitment", pricePerGB: 2.21, commitmentGB: 100, description: "20% saving vs PAYG. Best for >50 GB/day." },
  { id: "Commit200", label: "200 GB / day commitment", pricePerGB: 1.93, commitmentGB: 200, description: "30% saving. Best for medium SOC." },
  { id: "Commit500", label: "500 GB / day commitment", pricePerGB: 1.66, commitmentGB: 500, description: "40% saving. Best for >200 GB/day." },
  { id: "Commit1000", label: "1 TB / day commitment", pricePerGB: 1.5, commitmentGB: 1000, description: "45% saving. Enterprise / MSSP." },
  { id: "Commit5000", label: "5 TB / day commitment", pricePerGB: 1.38, commitmentGB: 5000, description: "50% saving. Large enterprise." },
];

const RETENTION_TABLES = ["SecurityEvent", "SigninLogs", "OfficeActivity", "AzureActivity", "DeviceProcessEvents"];
const RETENTION_DAY_OPTIONS = [4, 30, 90, 180, 270, 365, 540, 730];

function SettingsPricingTab({ state, dispatch }: { state: SentinelState; dispatch: Dispatch<SentinelAction> }) {
  const ws = state.workspace;
  const currentTierId = ws.pricingTier || "PerGB";
  const tier = PRICING_TIERS.find((t) => t.id === currentTierId) ?? PRICING_TIERS[0];
  const estimatedDailyGB = ws.estimatedDailyGB || 42;

  // Real cost simulator — exact formula from source's renderSettingsPricing():
  // commitment tiers bill max(estimated, commitment) * 30 * pricePerGB; PAYG
  // (commitmentGB === 0) bills estimated * 30 * pricePerGB.
  const monthlyCost = useMemo(() => {
    if (tier.commitmentGB > 0) {
      return Math.max(estimatedDailyGB, tier.commitmentGB) * 30 * tier.pricePerGB;
    }
    return estimatedDailyGB * 30 * tier.pricePerGB;
  }, [estimatedDailyGB, tier]);

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Commitment tier</div>
        <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 10 }}>
          Reserved capacity gets a discount. If you exceed the daily commitment, overage is billed at the same rate. Switching tiers takes 31 days to take
          effect.
        </div>
        {PRICING_TIERS.map((t) => {
          const on = t.id === currentTierId;
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 10,
                border: `1px solid ${on ? "#0078d4" : "#edebe9"}`,
                borderRadius: 6,
                marginBottom: 8,
                background: on ? "#f3f9ff" : "#fff",
                cursor: "pointer",
              }}
              onClick={() => {
                dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { pricingTier: t.id } });
                toast.success(`Pricing tier set to ${t.id} — takes effect on next billing cycle`);
              }}
            >
              <input type="radio" name="snPricing" checked={on} onChange={() => {}} style={{ marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <b>{t.label}</b> · <code>${t.pricePerGB.toFixed(2)}</code> / GB
                <br />
                <span style={{ fontSize: 12, color: "#605e5c" }}>{t.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>Cost simulator</div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>
            Estimated daily ingest (GB):{" "}
            <input
              type="number"
              min={1}
              max={10000}
              value={estimatedDailyGB}
              className={styles.input}
              style={{ width: 100, display: "inline-block" }}
              onChange={(e) => dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { estimatedDailyGB: parseInt(e.target.value, 10) || 0 } })}
            />
          </label>
          <span style={{ fontSize: 13, color: "#605e5c" }}>
            <b>Estimated monthly cost:</b>{" "}
            <span style={{ color: "#0078d4", fontSize: 18, fontWeight: 600 }}>${Math.round(monthlyCost).toLocaleString()}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SettingsWorkspaceTab({ state, dispatch }: { state: SentinelState; dispatch: Dispatch<SentinelAction> }) {
  const ws = state.workspace;

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Data retention</div>
        <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 10 }}>
          First 90 days are free. Days 91-730 are billed per GB-month. Long-term archive (730+ days) requires Archive tier.
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>
            Workspace default:{" "}
            <input
              type="range"
              min={30}
              max={730}
              step={30}
              value={ws.retentionDays}
              onChange={(e) => dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { retentionDays: parseInt(e.target.value, 10) || 90 } })}
            />
          </label>
          <span style={{ fontSize: 18, color: "#0078d4", fontWeight: 600 }}>{ws.retentionDays} days</span>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>Daily ingestion cap</div>
        <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 10 }}>
          Ingestion stops once the daily cap is hit (UTC). The cap protects against runaway logs. Resets each day.
        </div>
        <label style={{ fontSize: 13 }}>
          Daily cap (GB):{" "}
          <input
            type="number"
            min={0}
            max={10000}
            value={ws.dailyCapGB}
            className={styles.input}
            style={{ width: 120, display: "inline-block", marginRight: 10 }}
            onChange={(e) => dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { dailyCapGB: parseFloat(e.target.value) || 0 } })}
          />
        </label>
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => {
            dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { dailyCapGB: 0 } });
            toast.success("Daily cap removed");
          }}
        >
          Remove cap
        </button>
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>Per-table retention overrides</div>
        <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 10 }}>
          Override the workspace default for specific tables. Useful when you need long retention for AzureActivity but short for DeviceProcessEvents.
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Table</th>
              <th>Retention</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_TABLES.map((t) => {
              const override = ws.tableRetention[t];
              return (
                <tr key={t}>
                  <td>
                    <code>{t}</code>
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={override != null ? String(override) : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const nextTableRetention = { ...ws.tableRetention };
                        if (raw) {
                          nextTableRetention[t] = parseInt(raw, 10);
                        } else {
                          delete nextTableRetention[t];
                        }
                        dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { tableRetention: nextTableRetention } });
                        toast.success(`Retention for ${t}${raw ? ` set to ${raw} days` : " reverted to workspace default"}`);
                      }}
                    >
                      <option value="">Use workspace default ({ws.retentionDays} days)</option>
                      {RETENTION_DAY_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d} days
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsAuditTab({ state, dispatch }: { state: SentinelState; dispatch: Dispatch<SentinelAction> }) {
  const ws = state.workspace;
  const recentEntries = state.activityLog.slice(0, 5);

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Auditing</div>
        <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 10 }}>Who ran which KQL query, who changed which rule.</div>
        <div style={{ marginBottom: 6 }}>
          <Checkbox
            label="LAQueryLogs — ingest a row per KQL query into the LAQueryLogs table"
            checked={ws.audit.queryLogs}
            onChange={(checked) => {
              dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { audit: { ...ws.audit, queryLogs: checked } } });
              toast.success("Audit setting updated");
            }}
          />
        </div>
        <div>
          <Checkbox
            label="SentinelHealth — ingest per-data-source health metrics + connector failures"
            checked={ws.audit.health}
            onChange={(checked) => {
              dispatch({ type: "UPDATE_WORKSPACE_SETTINGS", patch: { audit: { ...ws.audit, health: checked } } });
              toast.success("Audit setting updated");
            }}
          />
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>Recent audit log</div>
        {recentEntries.length === 0 ? (
          <EmptyState message="No audit entries yet." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((a, i) => (
                <tr key={i}>
                  <td>{a.timestamp}</td>
                  <td>{a.actor}</td>
                  <td>{a.action}</td>
                  <td>{a.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PropPair({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ width: 200, color: "#605e5c" }}>{label}</td>
      <td>{value}</td>
    </tr>
  );
}

function SettingsDetailsTab({ state }: { state: SentinelState }) {
  const ws = state.workspace;
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Workspace details</div>
      <table className={styles.table}>
        <tbody>
          <PropPair label="Workspace name" value={ws.name} />
          <PropPair label="Subscription" value={ws.subscription} />
          <PropPair label="Resource group" value={ws.resourceGroup} />
          <PropPair label="Region" value={ws.region} />
          <PropPair label="Created on" value={ws.created} />
          <PropPair label="Tenant name" value={ws.tenantName} />
          <PropPair label="Tenant ID" value={ws.tenantId} />
        </tbody>
      </table>
    </div>
  );
}

type SettingsTab = "pricing" | "workspace" | "audit" | "details";

export function SettingsPage({ state, dispatch }: { state: SentinelState; dispatch: Dispatch<SentinelAction> }) {
  const [tab, setTab] = useState<SettingsTab>("pricing");

  return (
    <div>
      <div className={styles.h2}>Settings</div>
      <SubTabBar
        tabs={[
          { key: "pricing", label: "Pricing" },
          { key: "workspace", label: "Workspace settings" },
          { key: "audit", label: "Auditing & health" },
          { key: "details", label: "Workspace details" },
        ]}
        active={tab}
        onChange={(key) => setTab(key as SettingsTab)}
      />

      {tab === "pricing" ? <SettingsPricingTab state={state} dispatch={dispatch} /> : null}
      {tab === "workspace" ? <SettingsWorkspaceTab state={state} dispatch={dispatch} /> : null}
      {tab === "audit" ? <SettingsAuditTab state={state} dispatch={dispatch} /> : null}
      {tab === "details" ? <SettingsDetailsTab state={state} /> : null}
    </div>
  );
}
