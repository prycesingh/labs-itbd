import type {
  SentinelActivityEntry,
  SentinelAutomationRule,
  SentinelBookmark,
  SentinelConnector,
  SentinelDevice,
  SentinelEntity,
  SentinelEntityRisk,
  SentinelHuntingQuery,
  SentinelIncident,
  SentinelInstalledSolution,
  SentinelMitreTactic,
  SentinelNotebook,
  SentinelPlaybook,
  SentinelPlaybookStep,
  SentinelRepo,
  SentinelRule,
  SentinelRuleType,
  SentinelSavedQuery,
  SentinelSeverity,
  SentinelSolution,
  SentinelState,
  SentinelTiFeed,
  SentinelTiIndicator,
  SentinelUser,
  SentinelWatchlist,
  SentinelWorkbook,
  SentinelWorkspace,
} from "./types";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Ported verbatim from itbd-lab/simulators/sentinel/js/sentinel-data.js `rng(seed)`.
// Guarantees the same seed always produces the same sequence, so re-running the
// app (client-side, per session) always yields identical seed data.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// Relative-to-now date offsets — computed at seed-generation time (client-side per
// session), matching source behavior (dateOffset in sentinel-data.js).
function dateOffset(daysAgo: number, hoursAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  if (hoursAgo) d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

// ===== Local hardcoded "CloudLab Inc." roster =====
// Source (sentinel-data.js) reads a shared `CloudLabInfra` module (`.USERS` /
// `.DEVICES` / `.SITES` / `.INFRA` / `.TENANT`) that this app doesn't have as a
// cross-simulator bridge — no other ported simulator in this app wires that up
// either (each hardcodes its own roster inline, see defender/seedData.ts). So this
// file hardcodes an equivalent CloudLab Inc.-themed roster and DERIVES incidents /
// watchlists / entities from it the same computed way source derives from
// CloudLabInfra — only the data source changed, not the derivation logic.

const TENANT = {
  companyName: "CloudLab Inc.",
  publicDomain: "cloudlab.in",
  onPremDomain: "corp.cloudlab.local",
  tenantId: "8f3b2a1c-9d4e-4f2a-b6c1-2e7a9d5f10ab",
};

// [upn-local, displayName, department, title, adminRole | null]
const USER_ROSTER: [string, string, string, string, string | null][] = [
  ["ankit", "Ankit Sharma", "IT", "Cloud Architect / CTO", "Global Administrator"],
  ["rohit", "Rohit Verma", "IT", "Sr. Identity Admin", "Privileged Role Administrator"],
  ["vivek", "Vivek Iyer", "IT", "Network + Security Engineer", "Security Administrator"],
  ["priya", "Priya Singh", "IT", "Sr. Endpoint Admin (Intune)", null],
  ["naveen", "Naveen Reddy", "IT", "Sentinel SOC Analyst (Tier-2)", "Security Operator"],
  ["jaya", "Jaya Krishnan", "IT", "SOC Analyst (Tier-1)", null],
  ["sneha", "Sneha Patil", "Marketing", "Marketing Executive", null],
  ["vikram", "Vikram Desai", "Finance", "Finance Executive", null],
  ["rahul", "Rahul Kapoor", "Sales", "Sales Representative", null],
  ["arjun", "Arjun Mehta", "Sales", "VP Sales", null],
  ["kiran", "Kiran Rao", "Sales", "Sr. Account Executive", null],
  ["amit", "Amit Trivedi", "Finance", "Chief Financial Officer", null],
  ["pooja", "Pooja Nair", "Marketing", "Marketing Manager", null],
  ["kavita", "Kavita Bhat", "Sales", "Sales Representative", null],
  ["manish", "Manish Kumar", "IT", "Exchange + M365 Admin", "Exchange Administrator"],
];

function buildUsers(): SentinelUser[] {
  return USER_ROSTER.map(([id, displayName, department, title, adminRole], i) => ({
    userPrincipalName: `${id}@${TENANT.publicDomain}`,
    displayName,
    department,
    title,
    adminRole,
    sensitiveAccount: !!adminRole,
    objectId: `00000000-0000-0000-0000-${String(100000 + i).padStart(12, "0")}`,
    sid: `S-1-5-21-2839112489-3654906558-1044550619-${1100 + i}`,
    mfaEnrolled: adminRole ? true : i % 5 !== 0,
    accountEnabled: true,
  }));
}

// [name, owner-id, os]
const DEVICE_ROSTER: [string, string, string][] = [
  ["LAPTOP-ANKIT", "ankit", "Windows 11 Enterprise 23H2"],
  ["LAPTOP-ROHIT", "rohit", "Windows 11 Enterprise 23H2"],
  ["LAPTOP-VIVEK", "vivek", "Windows 10 Enterprise LTSC"],
  ["LAPTOP-PRIYA", "priya", "Windows 11 Pro 23H2"],
  ["LAPTOP-NAVEEN", "naveen", "Windows 11 Enterprise 23H2"],
  ["LAPTOP-JAYA", "jaya", "Windows 10 Pro 22H2"],
  ["LAPTOP-SNEHA", "sneha", "Windows 11 Pro 23H2"],
  ["LAPTOP-VIKRAM", "vikram", "Windows 10 Pro 22H2"],
  ["LAPTOP-RAHUL", "rahul", "Windows 11 Pro 23H2"],
  ["LAPTOP-ARJUN", "arjun", "macOS 14.3 Sonoma"],
  ["LAPTOP-KIRAN", "kiran", "Windows 10 Pro 22H2"],
  ["LAPTOP-AMIT", "amit", "Windows 11 Enterprise 23H2"],
  ["LAPTOP-POOJA", "pooja", "Windows 11 Pro 23H2"],
  ["LAPTOP-KAVITA", "kavita", "Windows 10 Pro 22H2"],
  ["LAPTOP-MANISH", "manish", "Windows 11 Enterprise 23H2"],
];

function buildDevices(): SentinelDevice[] {
  return DEVICE_ROSTER.map(([name, owner, os], i) => ({
    id: `dev-${1000 + i}`,
    name,
    owner,
    os,
  }));
}

// Equivalent of CloudLabInfra.SITES — subnets for trusted-IP watchlists.
const SITE_SUBNETS: { code: string; subnet: string }[] = [
  { code: "cl-hq-blr", subnet: "10.10.0.0/16" },
  { code: "cl-branch-mum", subnet: "10.20.0.0/16" },
  { code: "cl-branch-del", subnet: "10.30.0.0/16" },
];

// Equivalent of CloudLabInfra.INFRA — Tier-0 domain controllers + critical servers.
const DOMAIN_CONTROLLERS: { name: string; ip: string; site: string; role: string }[] = [
  { name: "DC01", ip: "10.10.0.10", site: "cl-hq-blr", role: "Primary Domain Controller (PDC emulator)" },
  { name: "DC02", ip: "10.10.0.11", site: "cl-hq-blr", role: "Backup Domain Controller" },
];
const CRITICAL_SERVERS: { name: string; ip: string; site: string; role: string }[] = [
  { name: "AADC01", ip: "10.10.0.20", site: "cl-hq-blr", role: "Microsoft Entra Connect sync server" },
  { name: "CA01", ip: "10.10.0.21", site: "cl-hq-blr", role: "Root Certificate Authority" },
  { name: "FS01", ip: "10.10.0.22", site: "cl-hq-blr", role: "File Server" },
  { name: "SQL-FIN-01", ip: "10.10.0.30", site: "cl-hq-blr", role: "Finance SQL Server" },
];

const SEVERITIES: SentinelSeverity[] = ["High", "Medium", "Low", "Informational"];
const TACTICS = [
  "Reconnaissance",
  "Resource Development",
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
];

const INCIDENT_TITLES = [
  "Multi-stage attack involving suspicious sign-in and PowerShell execution",
  "Brute force activity from anonymous IP on 5 user accounts",
  "Detected potential AS-REP roasting activity",
  "High volume of failed authentications targeting Entra ID",
  "Suspicious activity from rare country - Russia",
  "Mass file download from SharePoint by single user",
  "Anomalous Azure Activity: large number of role assignments",
  "Possible AiTM phishing toolkit usage detected",
  "New Azure AD application granted admin consent by non-admin",
  "Azure Storage account public access enabled",
  "Suspicious sign-in patterns from rare ASN",
  "Defender Antivirus signature updates failing",
  "AAD Connect sync errors threshold exceeded",
  "Possible Kerberoasting activity",
  "Suspicious service principal created and immediately used",
  "Sign-in to break-glass account detected",
  "Mailbox audit log cleared on executive account",
  "Suspicious Microsoft Graph token issued",
  "Anomalous data egress from a managed identity",
  "PIM activation outside of business hours",
  "Sentinel watchlist match - threat actor IP",
  "Defender for Cloud: SQL Injection detected",
  "Suspicious DNS tunneling from corporate network",
  "Anomalous Conditional Access policy modification",
  "Multiple incidents involving same compromised account",
];

function buildIncidents(users: SentinelUser[], devices: SentinelDevice[]): SentinelIncident[] {
  const rand = rng(123);
  const list: SentinelIncident[] = [];
  const soc = ["naveen", "jaya", "vivek", "rohit", "ankit"];

  for (let i = 0; i < 25; i++) {
    const sev = SEVERITIES[i < 7 ? 0 : i < 14 ? 1 : i < 21 ? 2 : 3];
    const st: SentinelIncident["status"] = i < 5 ? "New" : i < 16 ? "Active" : "Closed";

    // Owner from canonical SOC analysts (by roster id prefix on the UPN).
    const socId = soc[i % soc.length];
    const socUser = users.find((u) => u.userPrincipalName.startsWith(`${socId}@`));
    const owner = i % 3 === 2 ? "Unassigned" : socUser ? socUser.userPrincipalName : `naveen@${TENANT.publicDomain}`;

    const tacticCount = 1 + Math.floor(rand() * 3);
    const tactics: string[] = [];
    for (let j = 0; j < tacticCount; j++) {
      const t = pick(rand, TACTICS);
      if (tactics.indexOf(t) === -1) tactics.push(t);
    }

    // Build canonical entities — a real user + their device + an IP.
    const entities: SentinelEntity[] = [];
    if (users.length) {
      const actor = users[(i * 7 + 3) % users.length];
      if (actor) {
        entities.push({ name: actor.userPrincipalName, type: "User" });
        const actorId = actor.userPrincipalName.split("@")[0];
        const actorDevices = devices.filter((d) => d.owner === actorId);
        if (actorDevices.length) entities.push({ name: actorDevices[0].name, type: "Device" });
      }
    }
    // Mix in canonical infra entities.
    if (i % 4 === 0) entities.push({ name: `DC01.${TENANT.onPremDomain}`, type: "Host" });
    if (i % 5 === 0) entities.push({ name: `FS01.${TENANT.onPremDomain}`, type: "Host" });
    entities.push({ name: `203.0.113.${40 + i}`, type: "IP" });

    list.push({
      id: `INC-${10000 + i}`,
      title: INCIDENT_TITLES[i] || `Sentinel incident #${i}`,
      severity: sev,
      status: st,
      owner,
      tactics,
      techniques: ["T1078", "T1059.001", "T1110", "T1003.001"].slice(0, tacticCount),
      created: dateOffset(Math.floor(rand() * 14), Math.floor(rand() * 24)),
      lastModified: dateOffset(Math.floor(rand() * 3), Math.floor(rand() * 24)),
      alertsCount: 1 + Math.floor(rand() * 8),
      entitiesCount: entities.length,
      entities,
      productNames: [
        pick(rand, [
          "Microsoft Sentinel",
          "Azure AD Identity Protection",
          "Microsoft Defender XDR",
          "Microsoft Defender for Cloud Apps",
        ]),
      ],
      comments: [],
      rule: pick(rand, [
        "NRT Brute Force - Local Account",
        "AAD Risky sign-in",
        "Defender XDR Incident creation rule",
        "Anomaly: Logons from new locations",
      ]),
    });
  }
  return list;
}

type RuleSample = [string, SentinelRuleType, string, string[], boolean, SentinelSeverity];

const RULE_SAMPLES: RuleSample[] = [
  ["Microsoft Defender XDR incident creation", "Microsoft Security", "Microsoft 365 Defender", ["Multiple"], true, "High"],
  ["AAD Identity Protection - High risk user", "Microsoft Security", "Azure AD Identity Protection", ["Credential Access"], true, "High"],
  ["AAD Identity Protection - High risk sign-in", "Microsoft Security", "Azure AD Identity Protection", ["Initial Access"], true, "High"],
  ["Brute Force against AAD via Insomnia", "NRT", "Azure AD", ["Credential Access"], true, "Medium"],
  ["Sign-in to disabled account", "Scheduled", "Azure AD", ["Initial Access"], true, "Medium"],
  ["New AAD application granted privileged role", "Scheduled", "Azure AD", ["Privilege Escalation"], true, "High"],
  ["Sign-in from impossible travel", "Anomaly", "Azure AD", ["Initial Access"], true, "Medium"],
  ["Anomalous login geo", "ML Behavioral", "Azure AD", ["Initial Access"], true, "Low"],
  ["Mass downloads by a single user", "Scheduled", "Office 365", ["Exfiltration"], true, "Medium"],
  ["Mailbox audit log cleared", "Scheduled", "Office 365", ["Defense Evasion"], true, "High"],
  ["Suspicious mail forwarding rule", "Scheduled", "Office 365", ["Collection"], true, "Medium"],
  ["Office 365 audit logging disabled", "Scheduled", "Office 365", ["Defense Evasion"], true, "High"],
  ["Suspicious resource deployment", "Scheduled", "Azure Activity", ["Impact"], true, "Medium"],
  ["Suspicious role assignment in subscription", "Scheduled", "Azure Activity", ["Privilege Escalation"], true, "High"],
  ["Storage account public access enabled", "Scheduled", "Azure Activity", ["Defense Evasion"], false, "Medium"],
  ["Key Vault key/secret/cert deleted", "Scheduled", "Azure Activity", ["Impact"], true, "High"],
  ["Failed login burst by source IP", "Scheduled", "AzureAD SignInLogs", ["Credential Access"], true, "Medium"],
  ["Successful login from anonymous IP", "Scheduled", "AzureAD SignInLogs", ["Initial Access"], true, "High"],
  ["User added to privileged group", "Scheduled", "Azure AD", ["Privilege Escalation"], true, "High"],
  ["Token replay detected", "Scheduled", "Azure AD", ["Defense Evasion"], true, "High"],
  ["MFA failure spike for single user", "NRT", "Azure AD", ["Credential Access"], true, "Medium"],
  ["Defender for Cloud SQL Injection detected", "Scheduled", "Microsoft Defender for Cloud", ["Impact"], true, "High"],
  ["Defender for Cloud DNS exfiltration", "Scheduled", "Microsoft Defender for Cloud", ["Exfiltration"], true, "Medium"],
  ["Anomalous data transfer from VM", "ML Behavioral", "Defender for Cloud", ["Exfiltration"], true, "Medium"],
  ["SOC handover daily query", "Scheduled", "Custom", ["Discovery"], true, "Informational"],
  ["Tor exit node sign-in", "Scheduled", "Threat Intelligence", ["Initial Access"], true, "High"],
  ["Known malicious IP - threat intel match", "Scheduled", "Threat Intelligence", ["Initial Access"], true, "High"],
  ["Known malicious domain - threat intel", "Scheduled", "Threat Intelligence", ["Command and Control"], true, "High"],
  ["Watchlist - VIP user sign-in alerts", "Scheduled", "Custom", ["Discovery"], true, "Medium"],
  ["New service principal created", "Scheduled", "Azure AD", ["Persistence"], true, "Medium"],
  ["Suspicious PowerShell execution", "Scheduled", "Security Events", ["Execution"], true, "High"],
  ["Suspicious WMI execution", "Scheduled", "Security Events", ["Execution"], false, "Medium"],
  ["Lateral movement via PsExec", "Scheduled", "Security Events", ["Lateral Movement"], true, "High"],
  ["Suspicious DNS query - DGA", "Scheduled", "DNS", ["Command and Control"], true, "Medium"],
  ["Possible C2 traffic detected", "ML Behavioral", "CommonSecurityLog", ["Command and Control"], true, "High"],
  ["AWS root account usage", "Scheduled", "AWS CloudTrail", ["Privilege Escalation"], true, "High"],
  ["AWS IAM policy modified", "Scheduled", "AWS CloudTrail", ["Defense Evasion"], true, "Medium"],
  ["GCP service account key created", "Scheduled", "GCP", ["Persistence"], false, "Medium"],
  ["Syslog firewall blocked connection burst", "Scheduled", "Syslog", ["Reconnaissance"], true, "Low"],
  ["Linux audit: unusual root command", "Scheduled", "Syslog", ["Privilege Escalation"], true, "Medium"],
];

function buildRules(): SentinelRule[] {
  const rules: SentinelRule[] = [];
  for (let i = 0; i < RULE_SAMPLES.length; i++) {
    const [name, type, dataSource, tactics, enabled, severity] = RULE_SAMPLES[i];
    const thresholdRand = rng(i + 1);
    rules.push({
      id: `rule-${1000 + i}`,
      name,
      type,
      dataSource,
      tactics,
      enabled,
      severity,
      created: `2025-${String(1 + (i % 12)).padStart(2, "0")}-12`,
      lastModified: `2026-04-${String(1 + (i % 28)).padStart(2, "0")}`,
      version: `1.0.${i % 5}`,
      lastTriggered:
        i < 10
          ? new Date(Date.now() - i * 3600000).toISOString()
          : new Date(Date.now() - (24 + i) * 3600000).toISOString(),
      lookback: "24 hours",
      period: "1 hour",
      threshold: pick(thresholdRand, [1, 3, 5, 10]),
      groupBy: "Single alert",
      automation: i % 6 === 0 ? "Playbook: SOC-Notify-Teams" : null,
      kql:
        i % 7 === 0
          ? null
          : "SecurityEvent\n| where TimeGenerated > ago(1h)\n| where EventID == 4625\n| summarize count() by Account, IpAddress\n| where count_ > 10",
    });
  }
  return rules;
}

function buildDataConnectors(): SentinelConnector[] {
  return [
    { id: "dc-1", name: "Azure Activity", provider: "Microsoft", status: "Connected", dataTypes: ["AzureActivity"], lastIngest: "just now", recordsLast24h: 28415, kind: "AzureActivityLog" },
    { id: "dc-2", name: "Azure Active Directory", provider: "Microsoft", status: "Connected", dataTypes: ["SigninLogs", "AuditLogs", "AADProvisioningLogs"], lastIngest: "just now", recordsLast24h: 16280, kind: "AzureActiveDirectory" },
    { id: "dc-3", name: "Azure AD Identity Protection", provider: "Microsoft", status: "Connected", dataTypes: ["SecurityAlert"], lastIngest: "5 min ago", recordsLast24h: 42, kind: "AzureActiveDirectoryIdentityProtection" },
    { id: "dc-4", name: "Microsoft Defender for Cloud", provider: "Microsoft", status: "Connected", dataTypes: ["SecurityAlert"], lastIngest: "15 min ago", recordsLast24h: 18, kind: "AzureSecurityCenter" },
    { id: "dc-5", name: "Microsoft 365 Defender", provider: "Microsoft", status: "Connected", dataTypes: ["SecurityIncident", "SecurityAlert", "DeviceProcessEvents", "EmailEvents"], lastIngest: "just now", recordsLast24h: 92340, kind: "MicrosoftThreatProtection" },
    { id: "dc-6", name: "Office 365", provider: "Microsoft", status: "Connected", dataTypes: ["OfficeActivity"], lastIngest: "just now", recordsLast24h: 71280, kind: "Office365" },
    { id: "dc-7", name: "Threat Intelligence Platforms", provider: "Microsoft", status: "Connected", dataTypes: ["ThreatIntelligenceIndicator"], lastIngest: "1 hour ago", recordsLast24h: 8412, kind: "ThreatIntelligence" },
    { id: "dc-8", name: "AWS CloudTrail", provider: "Amazon", status: "Connected", dataTypes: ["AWSCloudTrail"], lastIngest: "8 min ago", recordsLast24h: 4180, kind: "AmazonWebServicesCloudTrail" },
    { id: "dc-9", name: "Google Cloud Platform IAM", provider: "Google", status: "Not connected", dataTypes: ["GCPAuditLogs"], lastIngest: "-", recordsLast24h: 0, kind: "GCP" },
    { id: "dc-10", name: "Common Event Format (CEF)", provider: "Other", status: "Connected", dataTypes: ["CommonSecurityLog"], lastIngest: "just now", recordsLast24h: 31085, kind: "CEF" },
    { id: "dc-11", name: "DNS", provider: "Microsoft", status: "Connected", dataTypes: ["DnsEvents"], lastIngest: "2 min ago", recordsLast24h: 152340, kind: "DNS" },
    { id: "dc-12", name: "Syslog", provider: "Other", status: "Connected", dataTypes: ["Syslog"], lastIngest: "just now", recordsLast24h: 22480, kind: "Syslog" },
  ];
}

type WorkbookSample = [string, string, string, string[]];

const WORKBOOK_SAMPLES: WorkbookSample[] = [
  ["Microsoft Sentinel Overview", "Microsoft", "Multiple", ["Overview", "SOC"]],
  ["Azure AD Audit Logs", "Microsoft", "AzureActiveDirectory", ["Identity"]],
  ["Identity & Access", "Microsoft", "AzureActiveDirectory", ["Identity"]],
  ["Office 365", "Microsoft", "Office365", ["Email", "Collaboration"]],
  ["MITRE ATT&CK Workbook", "Microsoft", "Multiple", ["MITRE"]],
  ["Threat Intelligence", "Microsoft", "ThreatIntelligenceIndicator", ["TI"]],
  ["Microsoft 365 Defender", "Microsoft", "M365Defender", ["XDR"]],
  ["Investigation Insights", "Microsoft", "SecurityIncident", ["Investigation"]],
  ["Linux Machines", "Microsoft", "Syslog", ["Linux"]],
  ["Windows Security Events", "Microsoft", "SecurityEvent", ["Windows"]],
  ["Azure Activity", "Microsoft", "AzureActivity", ["Azure"]],
  ["AWS Network Activity", "Microsoft", "AWSCloudTrail", ["AWS", "Network"]],
  ["DNS Monitoring", "Microsoft", "DnsEvents", ["Network", "DNS"]],
  ["Network Traffic Analytics", "Microsoft", "CommonSecurityLog", ["Network"]],
  ["VPN Anomalies", "Microsoft", "CommonSecurityLog", ["Network", "VPN"]],
  ["Defender for Cloud", "Microsoft", "SecurityAlert", ["Cloud"]],
  ["Defender for IoT", "Microsoft", "SecurityAlert", ["IoT"]],
  ["Insider Risk Management", "Microsoft", "OfficeActivity", ["Insider"]],
  ["Anomalies", "Microsoft", "Anomalies", ["ML"]],
  ["Cybersecurity Maturity Model", "Microsoft", "Multiple", ["Compliance"]],
  ["Microsoft Entra Risky Users", "Microsoft", "AzureADIdentityProtection", ["Identity"]],
  ["Conditional Access Insights", "Microsoft", "SigninLogs", ["Identity", "CA"]],
  ["Exchange Online", "Microsoft", "OfficeActivity", ["Email"]],
  ["SharePoint & OneDrive", "Microsoft", "OfficeActivity", ["Collaboration"]],
  ["Microsoft Teams", "Microsoft", "OfficeActivity", ["Collaboration"]],
  ["Zero Trust (TIC 3.0)", "Microsoft", "Multiple", ["Compliance", "Zero Trust"]],
  ["Ransomware Indicators", "Microsoft", "Multiple", ["Ransomware"]],
  ["User Entity Behavior Analytics", "Microsoft", "BehaviorAnalytics", ["UEBA"]],
  ["Watchlist Insights", "Microsoft", "Watchlist", ["SOC"]],
  ["SOC Process Framework", "Microsoft", "Multiple", ["SOC"]],
];

function buildWorkbooks(): SentinelWorkbook[] {
  return WORKBOOK_SAMPLES.map(([name, publisher, dataSource, categories], i) => ({
    id: `wb-${100 + i}`,
    name,
    publisher,
    dataSource,
    categories,
    description: `Gain insights into ${name.toLowerCase()}.`,
    installed: i < 12,
    version: `1.${i % 8}.0`,
  }));
}

function buildHuntingQueries(): SentinelHuntingQuery[] {
  return [
    {
      id: "hq-1",
      name: "Anomalous logon attempts",
      description: "Find logon attempts from new countries or unusual hours.",
      tactics: ["Initial Access"],
      techniques: ["T1078"],
      dataSources: ["SigninLogs"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        "SigninLogs\n| where TimeGenerated > ago(7d)\n| where ResultType == 0\n| extend ctry = tostring(LocationDetails.countryOrRegion)\n| summarize count() by UserPrincipalName, ctry\n| where count_ < 5",
    },
    {
      id: "hq-2",
      name: "Suspicious processes from temp folders",
      description: "Processes executing out of %TEMP% or %APPDATA% — often staging payloads.",
      tactics: ["Execution", "Persistence"],
      techniques: ["T1059", "T1547"],
      dataSources: ["SecurityEvent", "DeviceProcessEvents"],
      provider: "Microsoft",
      createdBy: "ankit",
      query:
        'DeviceProcessEvents\n| where Timestamp > ago(24h)\n| where FolderPath has_any (@"\\AppData\\Local\\Temp\\", @"\\Users\\Public\\")\n| where FileName endswith ".exe"\n| project Timestamp, DeviceName, AccountName, FolderPath, FileName, ProcessCommandLine',
    },
    {
      id: "hq-3",
      name: "Unusual data egress to non-corporate cloud",
      description: "Identifies large outbound transfers to 3rd-party cloud storage.",
      tactics: ["Exfiltration"],
      techniques: ["T1567.002"],
      dataSources: ["CommonSecurityLog"],
      provider: "Microsoft",
      createdBy: "priya",
      query:
        'CommonSecurityLog\n| where TimeGenerated > ago(7d)\n| where DestinationHostName has_any ("dropbox","wetransfer","mega.nz","anonfiles")\n| summarize bytes=sum(SentBytes) by SourceUserName\n| where bytes > 100000000',
    },
    {
      id: "hq-4",
      name: "Login from rare IP / ASN",
      description: "Detect interactive logins from ASNs that haven't been seen before in the tenant.",
      tactics: ["Initial Access"],
      techniques: ["T1078"],
      dataSources: ["SigninLogs"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        "SigninLogs\n| where TimeGenerated > ago(30d)\n| summarize first_seen=min(TimeGenerated), count_ = count() by AutonomousSystemNumber, UserPrincipalName\n| where first_seen > ago(7d) and count_ < 3",
    },
    {
      id: "hq-5",
      name: "Encoded PowerShell command lines",
      description: "Find PowerShell command lines that use -EncodedCommand to obfuscate the payload.",
      tactics: ["Execution", "Defense Evasion"],
      techniques: ["T1059.001", "T1027"],
      dataSources: ["SecurityEvent", "DeviceProcessEvents"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'DeviceProcessEvents\n| where Timestamp > ago(24h)\n| where FileName =~ "powershell.exe"\n| where ProcessCommandLine has_any ("-enc", "-EncodedCommand")\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine',
    },
    {
      id: "hq-6",
      name: "Suspicious mailbox forwarding rules",
      description: "Detect creation of rules that forward mail outside the org.",
      tactics: ["Collection", "Exfiltration"],
      techniques: ["T1114.003"],
      dataSources: ["OfficeActivity"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'OfficeActivity\n| where TimeGenerated > ago(7d)\n| where Operation in ("New-InboxRule","Set-InboxRule")\n| extend ForwardTo = tostring(parse_json(Parameters)[1].Value)\n| where ForwardTo !endswith "@cloudlab.in"\n| project TimeGenerated, UserId, Operation, ForwardTo',
    },
    {
      id: "hq-7",
      name: "Privileged role assignments",
      description: "Track adds to highly privileged Entra ID roles.",
      tactics: ["Privilege Escalation", "Persistence"],
      techniques: ["T1098.003"],
      dataSources: ["AuditLogs"],
      provider: "Microsoft",
      createdBy: "ankit",
      query:
        'AuditLogs\n| where TimeGenerated > ago(7d)\n| where OperationName == "Add member to role"\n| extend role = tostring(TargetResources[0].modifiedProperties[1].newValue)\n| where role has_any ("Global Administrator","Privileged Role Administrator","Security Administrator")',
    },
    {
      id: "hq-8",
      name: "DNS queries to known DGA-like domains",
      description: "Identifies DNS queries to long randomized hostnames typical of DGA C2 channels.",
      tactics: ["Command and Control"],
      techniques: ["T1568.002"],
      dataSources: ["DnsEvents"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'DnsEvents\n| where TimeGenerated > ago(24h)\n| extend len = strlen(Name)\n| where len > 25 and Name matches regex "[a-z0-9]{15,}\\\\."\n| summarize count() by Name, ClientIP\n| top 50 by count_',
    },
    {
      id: "hq-9",
      name: "Impossible travel within 4h",
      description: "Sign-ins from countries that would require travel >1500 km/h to traverse.",
      tactics: ["Initial Access"],
      techniques: ["T1078"],
      dataSources: ["SigninLogs"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        "SigninLogs\n| where ResultType == 0\n| sort by UserPrincipalName, TimeGenerated asc\n| extend prevCountry = prev(tostring(LocationDetails.countryOrRegion)), prevTime = prev(TimeGenerated), prevUPN = prev(UserPrincipalName)\n| where UserPrincipalName == prevUPN and tostring(LocationDetails.countryOrRegion) != prevCountry\n| extend hoursBetween = datetime_diff('hour', TimeGenerated, prevTime)\n| where hoursBetween < 4",
    },
    {
      id: "hq-10",
      name: "Mailbox forwarding rule created",
      description: "New inbox rule that forwards mail externally — common BEC indicator.",
      tactics: ["Exfiltration"],
      techniques: ["T1114.003"],
      dataSources: ["OfficeActivity"],
      provider: "Microsoft",
      createdBy: "priya",
      query:
        'OfficeActivity\n| where TimeGenerated > ago(7d)\n| where Operation in ("New-InboxRule", "Set-InboxRule")\n| extend params = parse_json(Parameters)\n| mv-expand params\n| where tostring(params.Name) == "ForwardTo" or tostring(params.Name) == "ForwardAsAttachmentTo"\n| where tostring(params.Value) !endswith "@corp.cloudlab.in"\n| project TimeGenerated, UserId, Operation, ForwardTarget = tostring(params.Value)',
    },
    {
      id: "hq-11",
      name: "Service principal added owner",
      description: "New owner added to a service principal — possible app token theft setup.",
      tactics: ["Persistence", "Privilege Escalation"],
      techniques: ["T1098.003"],
      dataSources: ["AuditLogs"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'AuditLogs\n| where TimeGenerated > ago(7d)\n| where OperationName == "Add owner to service principal"\n| extend sp = tostring(TargetResources[0].displayName)\n| extend newOwner = tostring(TargetResources[1].userPrincipalName)\n| project TimeGenerated, sp, newOwner, InitiatedBy',
    },
    {
      id: "hq-12",
      name: "AWS Console root account use",
      description: "AWS root account used after IAM users were provisioned — should be unusual.",
      tactics: ["Privilege Escalation"],
      techniques: ["T1078.004"],
      dataSources: ["AWSCloudTrail"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'AWSCloudTrail\n| where TimeGenerated > ago(7d)\n| where UserIdentityType == "Root"\n| project TimeGenerated, EventName, SourceIpAddress, AwsRegion, UserAgent',
    },
    {
      id: "hq-13",
      name: "GitHub repo accessed from rare IP",
      description: "GitHub Enterprise audit events showing repo clone from unusual location.",
      tactics: ["Collection"],
      techniques: ["T1213.003"],
      dataSources: ["GitHubAuditLog"],
      provider: "Microsoft",
      createdBy: "priya",
      query:
        'GitHubAuditLog\n| where TimeGenerated > ago(7d)\n| where action in ("git.clone","git.fetch","repository.access")\n| summarize ips=make_set(actor_ip), count=count() by actor\n| where array_length(ips) > 3',
    },
    {
      id: "hq-14",
      name: "Linux SSH brute-force then success",
      description: "Linux audit events showing many SSH failures from one IP, then a success.",
      tactics: ["Credential Access", "Initial Access"],
      techniques: ["T1110.001"],
      dataSources: ["Syslog"],
      provider: "Microsoft",
      createdBy: "ankit",
      query:
        'Syslog\n| where Facility == "authpriv"\n| where SyslogMessage has "sshd"\n| summarize fails=countif(SyslogMessage has "Failed password"), succs=countif(SyslogMessage has "Accepted") by host=Computer, src=extract("from ([\\\\d\\\\.]+)", 1, SyslogMessage)\n| where fails > 20 and succs > 0',
    },
    {
      id: "hq-15",
      name: "Suspicious Kerberos AS-REP roasting",
      description: "Domain Controller serves AS-REP without preauth — indicates kerberoasting attempt.",
      tactics: ["Credential Access"],
      techniques: ["T1558.004"],
      dataSources: ["SecurityEvent"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'SecurityEvent\n| where EventID == 4768 and PreAuthType == 0\n| where AccountType == "User"\n| summarize count() by Account, IpAddress, bin(TimeGenerated, 1h)\n| where count_ > 5',
    },
    {
      id: "hq-16",
      name: "DCSync replication request",
      description: "DRSReplicaSync (DCSync) from non-DC account = adversary dumping NTDS.dit.",
      tactics: ["Credential Access"],
      techniques: ["T1003.006"],
      dataSources: ["SecurityEvent"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'SecurityEvent\n| where EventID == 4662\n| where Properties has "1131f6aa-9c07-11d1-f79f-00c04fc2dcd2"\n| where Account !endswith "$"\n| project TimeGenerated, Account, AccessMask, Properties',
    },
    {
      id: "hq-17",
      name: "Sensitive role assignment in Entra",
      description: "Anyone given Global Admin / Privileged Role Admin / Security Admin.",
      tactics: ["Privilege Escalation"],
      techniques: ["T1098"],
      dataSources: ["AuditLogs"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'AuditLogs\n| where TimeGenerated > ago(7d)\n| where OperationName == "Add member to role"\n| extend roleName = tostring(TargetResources[0].modifiedProperties[1].newValue)\n| extend user = tostring(TargetResources[2].userPrincipalName)\n| where roleName has_any ("Global Administrator","Privileged Role Administrator","Security Administrator","Conditional Access Administrator","Application Administrator")',
    },
    {
      id: "hq-18",
      name: "Mass password spray sign-in",
      description: "Same IP attempting sign-ins against many users in short time.",
      tactics: ["Credential Access"],
      techniques: ["T1110.003"],
      dataSources: ["SigninLogs"],
      provider: "Microsoft",
      createdBy: "priya",
      query:
        "SigninLogs\n| where ResultType in (50053, 50126, 50056)\n| summarize fails = count(), distinctUsers = dcount(UserPrincipalName) by IPAddress, bin(TimeGenerated, 10m)\n| where distinctUsers > 10 and fails > 30",
    },
    {
      id: "hq-19",
      name: "Sentinel Defender disable attempts",
      description: "PowerShell/registry hits to disable Defender or Sentinel agent.",
      tactics: ["Defense Evasion"],
      techniques: ["T1562.001"],
      dataSources: ["DeviceEvents", "DeviceProcessEvents"],
      provider: "Microsoft",
      createdBy: "Microsoft",
      query:
        'DeviceProcessEvents\n| where ProcessCommandLine has_any (\n  "Set-MpPreference -DisableRealtimeMonitoring",\n  "sc stop sense",\n  "sc stop windefend",\n  "sc stop healthservice",\n  "Set-Service -StartupType Disabled HealthService"\n)\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine',
    },
    {
      id: "hq-20",
      name: "Ransomware behavior — mass file rename",
      description: "Single process renaming >100 files within 60s — likely ransomware encrypt.",
      tactics: ["Impact"],
      techniques: ["T1486"],
      dataSources: ["DeviceFileEvents"],
      provider: "Microsoft",
      createdBy: "priya",
      query:
        'DeviceFileEvents\n| where ActionType == "FileRenamed"\n| summarize renames = count() by DeviceName, InitiatingProcessFileName, bin(Timestamp, 1m)\n| where renames > 100',
    },
  ];
}

function buildBookmarks(): SentinelBookmark[] {
  return [
    { id: "bm-1", name: "Suspicious 198.51.100.34 hits", created: dateOffset(1), createdBy: "ankit", tags: ["IoC", "C2"], notes: "See incident INC-10003. Active C2." },
    { id: "bm-2", name: "sneha@cloudlab.in lateral movement", created: dateOffset(3), createdBy: "ankit", tags: ["Lateral"], notes: "Reuses cached creds on FILE-SRV-01" },
    { id: "bm-3", name: "Akira ransomware IOC matches", created: dateOffset(7), createdBy: "priya", tags: ["Ransomware"], notes: "Multiple hashes matched 1.cradle, 2.deletes" },
  ];
}

function buildPlaybooks(): SentinelPlaybook[] {
  const step = (type: SentinelPlaybookStep["type"], name: string, details: string): SentinelPlaybookStep => ({ type, name, details });
  return [
    {
      id: "pb-1",
      name: "Block-IP-AzureFirewall",
      description: "Add IP to deny list in Azure Firewall rule collection.",
      trigger: "When an incident is created",
      state: "Enabled",
      lastRun: dateOffset(0, 2),
      runsTotal: 23,
      runsSuccess: 22,
      runsFailed: 1,
      steps: [
        step("Trigger", "Microsoft Sentinel incident", "Trigger when incident is created"),
        step("Action", "Entities - Get IPs", "Returns IP entities from incident"),
        step("For each", "For each IP", "Loop over each IP entity"),
        step("Action", "Azure Firewall - Add deny rule", "POST /firewallPolicies/.../ruleCollectionGroups"),
        step("Action", "Add incident comment", "Logged blocked IPs into comment"),
        step("Action", "Add incident tag", 'Tag: "IP-Blocked-Auto"'),
        step("Action", "Update incident severity", "Lower severity to Medium after blocking"),
      ],
    },
    {
      id: "pb-2",
      name: "Disable-AAD-User-On-Compromise",
      description: "Disable Entra ID user when confirmed compromised.",
      trigger: "When an alert is triggered",
      state: "Enabled",
      lastRun: dateOffset(1),
      runsTotal: 11,
      runsSuccess: 10,
      runsFailed: 1,
      steps: [
        step("Trigger", "Microsoft Sentinel alert", "Trigger on alert with risk = high"),
        step("Action", "Entities - Get Accounts", "User entities from alert"),
        step("Condition", "Is user privileged?", "If yes -> manual approval, else proceed"),
        step("Action", "AAD - Update user", "PATCH accountEnabled=false"),
        step("Action", "AAD - Revoke sessions", "Revoke refresh tokens"),
        step("Action", "Teams - Notify SecOps", "Post to #soc channel"),
        step("Action", "Update incident", "Set status to Active"),
      ],
    },
    {
      id: "pb-3",
      name: "Notify-Teams-Channel",
      description: "Post a rich Adaptive Card to a Teams channel for any new incident.",
      trigger: "When an incident is created",
      state: "Enabled",
      lastRun: dateOffset(0),
      runsTotal: 217,
      runsSuccess: 217,
      runsFailed: 0,
      steps: [
        step("Trigger", "Microsoft Sentinel incident", "Trigger on creation"),
        step("Action", "Compose Adaptive Card", "Build JSON with severity, link, owner"),
        step("Action", "Teams - Post message", "To #soc-alerts channel"),
        step("Action", "Add comment to incident", "Adaptive card posted at <time>"),
      ],
    },
    {
      id: "pb-4",
      name: "Create-JIRA-Ticket",
      description: "Open a Jira issue for each Sentinel incident.",
      trigger: "When an incident is created",
      state: "Enabled",
      lastRun: dateOffset(0, 6),
      runsTotal: 84,
      runsSuccess: 80,
      runsFailed: 4,
      steps: [
        step("Trigger", "Microsoft Sentinel incident", "Trigger on creation"),
        step("Action", "Compose Jira payload", "project=SOC, type=Incident"),
        step("Action", "Jira - Create issue", "POST /rest/api/3/issue"),
        step("Action", "Add comment to incident", "Jira link added"),
      ],
    },
    {
      id: "pb-5",
      name: "Open-ServiceNow-Incident",
      description: "Open ServiceNow ITSM ticket and link to Sentinel incident.",
      trigger: "When an incident is created",
      state: "Disabled",
      lastRun: dateOffset(15),
      runsTotal: 6,
      runsSuccess: 5,
      runsFailed: 1,
      steps: [
        step("Trigger", "Microsoft Sentinel incident", "Trigger on creation (severity >= Medium)"),
        step("Action", "Compose ServiceNow payload", "urgency=2, impact=2"),
        step("Action", "ServiceNow - Create record", "POST /api/now/table/incident"),
        step("Action", "Add link to comment", "snow.example.com/INC0012345"),
      ],
    },
  ];
}

function buildAutomationRules(): SentinelAutomationRule[] {
  return [
    { id: "ar-1", name: "Auto-close informational, no automation", order: 1, trigger: "When incident is created — severity = Informational", action: "Change status to Closed, classification Undetermined", enabled: true },
    { id: "ar-2", name: "Assign High severity to Tier-2", order: 2, trigger: "When incident is created — severity = High", action: `Assign owner to ${TENANT.publicDomain} SOC Tier-2 group`, enabled: true },
    { id: "ar-3", name: "Notify Teams on any new incident", order: 3, trigger: "When incident is created", action: "Run playbook: Notify-Teams-Channel", enabled: true },
    { id: "ar-4", name: "Tag and suppress known-benign scanner IP", order: 4, trigger: "When incident is created — entity IP in Trusted IP ranges watchlist", action: 'Add tag "KnownScanner", change status to Closed (Benign positive)', enabled: false },
  ];
}

function buildWatchlists(users: SentinelUser[]): SentinelWatchlist[] {
  // VIP users derived from canonical adminRole holders + Executive/Finance depts.
  const vipUsers = users
    .filter((u) => u.adminRole || u.department === "Finance")
    .map((u) => ({
      upn: u.userPrincipalName,
      displayName: u.displayName,
      dept: u.department,
      role: u.adminRole ?? `VIP — ${u.title}`,
      tier: u.adminRole && (u.adminRole.startsWith("Global") || u.adminRole.startsWith("Privileged")) ? "Tier-0" : "Tier-1",
    }));

  // Trusted partners derived from canonical site subnets + Azure VNets + a B2B partner.
  const trustedPartners: Record<string, string>[] = SITE_SUBNETS.map((s) => ({
    ipRange: s.subnet,
    site: s.code,
    type: "On-prem LAN",
  }));
  trustedPartners.push({ ipRange: "10.100.0.0/16", site: "cl-prod-vnet", type: "Azure VNet (centralindia)" });
  trustedPartners.push({ ipRange: "10.140.0.0/16", site: "cl-dr-vnet", type: "Azure DR VNet (southeastasia)" });
  trustedPartners.push({ ipRange: "198.51.100.0/24", site: "partner-deloitte", type: "B2B partner — auditor (guest-deloitte-01)" });

  // High-value assets derived from canonical domain controllers + critical servers.
  const hvAssets: Record<string, string>[] = DOMAIN_CONTROLLERS.map((dc) => ({
    name: dc.name,
    ip: dc.ip,
    kind: "Domain Controller",
    tier: "Tier-0",
    site: dc.site,
    role: dc.role,
  }));
  CRITICAL_SERVERS.forEach((s) => {
    hvAssets.push({ name: s.name, ip: s.ip, kind: "Critical Server", tier: "Tier-0", site: s.site, role: s.role });
  });

  const pawEndpoints: Record<string, string>[] = [
    { name: "LAP-ANKIT-PAW", owner: "ankit" },
    { name: "LAP-ROHIT-PAW", owner: "rohit" },
    { name: "LAP-VIVEK-PAW", owner: "vivek" },
  ];
  const breakGlass: Record<string, string>[] = [
    { upn: `breakglass-01@${TENANT.publicDomain}`, role: "Global Administrator (CA-exempt)" },
    { upn: `breakglass-02@${TENANT.publicDomain}`, role: "Global Administrator (CA-exempt)" },
  ];

  return [
    { id: "wl-vip", name: "VIP Users", provider: "CloudLab roster", itemCount: vipUsers.length, lastUpdated: "just now", description: "Privileged and high-profile accounts — auto-built from canonical adminRole + Executive/Finance depts", content: vipUsers, searchKey: "upn" },
    { id: "wl-terminated", name: "Terminated employees", provider: "HR Feed (Workday)", itemCount: 22, lastUpdated: dateOffset(1), description: "Recently offboarded users (90 days) — sourced from Workday termination feed", content: [], searchKey: "upn" },
    { id: "wl-trusted", name: "Trusted IP ranges", provider: "CloudLab roster", itemCount: trustedPartners.length, lastUpdated: "just now", description: "Approved corporate LAN/VPN/Azure subnets + B2B partners", content: trustedPartners, searchKey: "ipRange" },
    { id: "wl-hv", name: "High-value assets", provider: "CloudLab roster", itemCount: hvAssets.length, lastUpdated: "just now", description: "Tier-0 critical servers — auto-built from canonical infra (DCs + Entra Connect + CAs + jump box + Finance SQL)", content: hvAssets, searchKey: "name" },
    { id: "wl-threat-ip", name: "Threat Actor IPs", provider: "OSINT (MISP feed)", itemCount: 412, lastUpdated: dateOffset(0, 6), description: "TI-curated malicious IPs", content: [], searchKey: "value" },
    { id: "wl-paw", name: "PAW endpoints", provider: "CloudLab roster", itemCount: pawEndpoints.length, lastUpdated: "just now", description: "Privileged Access Workstations — LAP-ANKIT-PAW, LAP-ROHIT-PAW, LAP-VIVEK-PAW", content: pawEndpoints, searchKey: "name" },
    { id: "wl-bg", name: "Break-glass accounts", provider: "CloudLab roster", itemCount: breakGlass.length, lastUpdated: "just now", description: "CA-exempt emergency accounts — alert on any usage", content: breakGlass, searchKey: "upn" },
  ];
}

// ===== Threat Intelligence (ported from sentinel-watchlists-ti.js seedThreatIntel) =====

function buildThreatIntel(): { indicators: SentinelTiIndicator[]; feeds: SentinelTiFeed[] } {
  const indicators: SentinelTiIndicator[] = [
    { id: "ti-1", type: "IP", value: "198.51.100.34", threatType: "C2", confidence: "High", source: "Microsoft Threat Intelligence (MDTI)", firstSeen: "2024-08-15", lastSeen: dateOffset(0, 2), tags: ["Akira", "ransomware"], active: true },
    { id: "ti-2", type: "Domain", value: "malicious-update.com", threatType: "Malware C2", confidence: "High", source: "Recorded Future", firstSeen: "2026-03-12", lastSeen: dateOffset(1), tags: ["CobaltStrike"], active: true },
    { id: "ti-3", type: "FileHash", value: "a3f5b7c2d1e93f5b7c2d1e93f5b7c2d1e9", threatType: "Malware", confidence: "High", source: "Microsoft Defender XDR", firstSeen: "2026-04-22", lastSeen: dateOffset(0, 4), tags: ["LockBit"], active: true },
    { id: "ti-4", type: "URL", value: "https://phishing-portal.example.bad", threatType: "Phishing", confidence: "High", source: "PhishTank", firstSeen: "2026-04-30", lastSeen: dateOffset(0, 6), tags: ["M365phish"], active: true },
    { id: "ti-5", type: "Email", value: "attacker@bad-domain.ru", threatType: "BEC", confidence: "Medium", source: "Anomali", firstSeen: "2026-05-08", lastSeen: dateOffset(0, 12), tags: ["BEC", "impersonation"], active: true },
    { id: "ti-6", type: "IP", value: "192.0.2.15", threatType: "Brute force", confidence: "Medium", source: "AbuseIPDB", firstSeen: "2026-05-10", lastSeen: "just now", tags: [], active: true },
    { id: "ti-7", type: "FileHash", value: "b2c4d6e8f1b2c4d6e8f1b2c4d6e8f1b2c4", threatType: "Cryptominer", confidence: "Medium", source: "VirusTotal", firstSeen: "2026-05-12", lastSeen: dateOffset(0, 0), tags: ["XMRig"], active: true },
    { id: "ti-8", type: "Domain", value: "krbgt-corp.com", threatType: "Typosquat", confidence: "Medium", source: "Microsoft Defender Threat Intelligence", firstSeen: "2026-05-14", lastSeen: dateOffset(0, 8), tags: ["M365phish"], active: true },
  ];
  const feeds: SentinelTiFeed[] = [
    { id: "feed-1", name: "Microsoft Threat Intelligence (free)", provider: "Microsoft", status: "Connected", indicatorCount: 4827, lastSync: "just now" },
    { id: "feed-2", name: "Microsoft Defender Threat Intelligence (Premium)", provider: "Microsoft", status: "Connected", indicatorCount: 1842, lastSync: "just now" },
    { id: "feed-3", name: "Recorded Future", provider: "Recorded Future", status: "Connected", indicatorCount: 247, lastSync: dateOffset(0, 1) },
    { id: "feed-4", name: "Anomali ThreatStream", provider: "Anomali", status: "Connected", indicatorCount: 189, lastSync: dateOffset(0, 1) },
    { id: "feed-5", name: "PhishTank", provider: "PhishTank", status: "Connected", indicatorCount: 32, lastSync: dateOffset(0, 2) },
    { id: "feed-6", name: "AbuseIPDB", provider: "AbuseIPDB", status: "Not connected", indicatorCount: 0, lastSync: "-" },
    { id: "feed-7", name: "Custom IoC list (CSV)", provider: "Internal", status: "Connected", indicatorCount: 47, lastSync: dateOffset(0, 1) },
  ];
  return { indicators, feeds };
}

// ===== UEBA entity risks (ported from sentinel-ueba-mitre.js ENTITIES) =====

function buildEntityRisks(): SentinelEntityRisk[] {
  return [
    {
      id: "er-1",
      name: "priya@cloudlab.in",
      type: "User",
      riskScore: 87,
      insights: [
        "Anomalous sign-in from rare ASN (AS37963 - China) — baseline: 100% sign-ins from AS9498/AS55836 (India) over 90 days",
        "Bulk download from SharePoint (4.2 GB, 218 files) outside normal hours — baseline: avg 84 MB / 9 files / day, 09:00-19:00 IST",
        "Email forwarding rule created targeting external personal address — no previous forwarding rules in 12 months",
        "Disabled MFA registration via Identity Protection bypass — never disabled before",
      ],
      baseline: "100% sign-ins from India ASN, avg 84 MB/day downloads, no prior forwarding rules",
      lastActivity: dateOffset(0, 1),
    },
    {
      id: "er-2",
      name: "svc-jenkins@cloudlab.in",
      type: "User",
      riskScore: 72,
      insights: [
        "Read Azure Key Vault secrets outside CI/CD pipeline window — baseline: CI/CD secret reads only 02:00-06:00 IST during nightly builds",
        "Created new app credential (secret) on high-priv app — service principal has not added credentials in 90 days",
        "Sign-in from non-CI/CD ASN — baseline: 100% from CI/CD service IP range",
      ],
      baseline: "CI/CD secret reads only during nightly build window, no new credentials in 90 days",
      lastActivity: dateOffset(0, 3),
    },
    {
      id: "er-3",
      name: "LAPTOP-VIKRAM",
      type: "Host",
      riskScore: 64,
      insights: [
        "Mass file rename activity (287 files in 4 min) — baseline: 8 file renames per day",
        "Connected to unknown USB mass storage (vendor: Kingston, S/N 1A2B3C4D) — device has never connected this USB before",
        "PowerShell.exe with encoded command — no previous encoded command usage on this device",
      ],
      baseline: "8 file renames/day baseline, no prior USB storage devices, no encoded PowerShell history",
      lastActivity: dateOffset(0, 1),
    },
    {
      id: "er-4",
      name: "185.220.101.45",
      type: "Host",
      riskScore: 91,
      insights: [
        "Threat-Intel match: TOR exit node + listed in MDTI feed — not seen in tenant before today",
        "12 sign-in attempts to 8 different user accounts in 4 min — likely password spray pattern",
      ],
      baseline: "IP never seen in tenant traffic before today",
      lastActivity: "just now",
    },
    {
      id: "er-5",
      name: "high-value-finance-share",
      type: "Host",
      riskScore: 58,
      insights: ["Bulk download by user not in Finance group — baseline: only Finance group members touch this resource"],
      baseline: "Access restricted to Finance group members historically",
      lastActivity: dateOffset(0, 2),
    },
  ];
}

// ===== MITRE ATT&CK — 14-tactic technique-count reference data (real taxonomy) =====
// ourCoverage/alertsLast30d are NOT hardcoded here — they're computed for real from
// state.rules by computeMitreCoverage() in reducer.ts. This array only carries the
// static "techniques per tactic" reference numbers (real MITRE ATT&CK Enterprise
// taxonomy counts), matching the shape the source hardcoded but not its fake coverage %.
export const MITRE_TACTIC_TECHNIQUE_COUNTS: { tactic: string; techniques: number }[] = [
  { tactic: "Reconnaissance", techniques: 14 },
  { tactic: "Resource Development", techniques: 8 },
  { tactic: "Initial Access", techniques: 10 },
  { tactic: "Execution", techniques: 14 },
  { tactic: "Persistence", techniques: 20 },
  { tactic: "Privilege Escalation", techniques: 14 },
  { tactic: "Defense Evasion", techniques: 43 },
  { tactic: "Credential Access", techniques: 17 },
  { tactic: "Discovery", techniques: 32 },
  { tactic: "Lateral Movement", techniques: 10 },
  { tactic: "Collection", techniques: 17 },
  { tactic: "Command and Control", techniques: 18 },
  { tactic: "Exfiltration", techniques: 10 },
  { tactic: "Impact", techniques: 14 },
];

function buildNotebooks(): SentinelNotebook[] {
  return [
    { id: "nb-1", name: "Entity-Explorer-Account.ipynb", description: "Deep-dive on a user account: sign-ins, mailbox rules, file activity, related entities. Auto-pulls last 30d from Log Analytics.", provider: "Investigation", lastRun: dateOffset(0, 1) },
    { id: "nb-2", name: "Entity-Explorer-Host.ipynb", description: "Per-host timeline: processes, network connections, file events, scheduled tasks. Pivots to other hosts the user touched.", provider: "Investigation", lastRun: dateOffset(0, 2) },
    { id: "nb-3", name: "Entity-Explorer-IP-Address.ipynb", description: "Geolocation, ASN, threat intel match, sign-ins from this IP, network connections. Visualizes attack surface.", provider: "Investigation", lastRun: dateOffset(0, 1) },
    { id: "nb-4", name: "Guided-Investigation-Process-Alerts.ipynb", description: "Step-by-step playbook for process-based alerts (LSASS access, encoded PowerShell). Builds a graph.", provider: "Investigation", lastRun: dateOffset(0, 3) },
    { id: "nb-5", name: "Anomalous-RDP-Logon-Investigation.ipynb", description: "Detect anomalous RDP from outside the org. Pairs SecurityEvent 4624 with geolocation + ML score.", provider: "Hunting", lastRun: dateOffset(0, 4) },
    { id: "nb-6", name: "Cred-Scan-on-Azure-Blob-Storage.ipynb", description: "Scan blob storage for hardcoded secrets (AWS keys, Azure SAS, GitHub tokens). Pre-built regex library.", provider: "Hunting", lastRun: dateOffset(0, 8) },
    { id: "nb-7", name: "Solorigate-IOCs.ipynb", description: "Match SolarWinds Solorigate IOCs against Log Analytics — file hashes, C2 domains, PowerShell signatures.", provider: "IR playbook", lastRun: dateOffset(30) },
    { id: "nb-8", name: "Office365-Exploration.ipynb", description: "O365 anomalies: mailbox rule creation, audit-log queries, OAuth grant abuse.", provider: "Investigation", lastRun: dateOffset(35) },
  ];
}

// ===== Content Hub solutions (ported from sentinel-content-hub.js SOLUTIONS) =====

function buildSolutions(): SentinelSolution[] {
  return [
    { id: "azureactivity", name: "Azure Activity", publisher: "Microsoft", category: "Cloud Provider", description: "Detections, workbooks and hunting queries for Azure control-plane activity.", components: { rules: 4, workbooks: 1, playbooks: 0, huntingQueries: 2 } },
    { id: "entra", name: "Microsoft Entra ID", publisher: "Microsoft", category: "Identity", description: "Identity protection detections for sign-in and audit anomalies.", components: { rules: 6, workbooks: 3, playbooks: 2, huntingQueries: 2 } },
    { id: "mdo", name: "Microsoft 365 Defender", publisher: "Microsoft", category: "XDR", description: "XDR incident correlation and endpoint detection content.", components: { rules: 3, workbooks: 1, playbooks: 1, huntingQueries: 2 } },
    { id: "mdc", name: "Microsoft Defender for Cloud", publisher: "Microsoft", category: "Cloud Posture", description: "Cloud workload protection alerts and posture workbooks.", components: { rules: 3, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
    { id: "o365", name: "Office 365", publisher: "Microsoft", category: "M365", description: "Mailbox and collaboration abuse detections.", components: { rules: 4, workbooks: 1, playbooks: 1, huntingQueries: 1 } },
    { id: "ti", name: "Threat Intelligence", publisher: "Microsoft", category: "Threat Intelligence", description: "TI indicator matching rules across sign-in, email and network logs.", components: { rules: 3, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
    { id: "aws", name: "AWS", publisher: "Microsoft", category: "Cloud Provider", description: "AWS CloudTrail and network activity detections.", components: { rules: 3, workbooks: 2, playbooks: 0, huntingQueries: 1 } },
    { id: "gcp", name: "GCP", publisher: "Microsoft", category: "Cloud Provider", description: "GCP audit log detections for IAM and Compute Engine anomalies.", components: { rules: 2, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
    { id: "ciscoasa", name: "Cisco ASA", publisher: "Cisco", category: "Network", description: "Firewall and VPN abuse detections for Cisco ASA.", components: { rules: 2, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
    { id: "palo", name: "Palo Alto Networks", publisher: "Palo Alto", category: "Network", description: "IPS and WildFire malware verdict detections.", components: { rules: 2, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
    { id: "forti", name: "Fortinet FortiGate", publisher: "Fortinet", category: "Network", description: "IPS and VPN auth-failure detections for FortiGate.", components: { rules: 2, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
    { id: "okta", name: "Okta", publisher: "Okta", category: "Identity", description: "MFA fatigue and admin-event detections for Okta SSO.", components: { rules: 2, workbooks: 1, playbooks: 0, huntingQueries: 1 } },
  ];
}

// Matches source's ensureState() hydration comment: "the first 7 were installed".
const PRE_INSTALLED_SOLUTION_IDS = ["azureactivity", "entra", "mdo", "mdc", "o365", "ti", "aws"];

function buildInstalledSolutions(solutions: SentinelSolution[]): SentinelInstalledSolution[] {
  return PRE_INSTALLED_SOLUTION_IDS.map((id) => {
    const sol = solutions.find((s) => s.id === id);
    const rulesN = sol?.components.rules ?? 0;
    const workbooksN = sol?.components.workbooks ?? 0;
    const playbooksN = sol?.components.playbooks ?? 0;
    const huntingN = sol?.components.huntingQueries ?? 0;
    return {
      id,
      version: "1.0.0",
      installedOn: "2025-08-12",
      components: {
        rules: Array.from({ length: rulesN }, (_, i) => `${sol?.name ?? id} rule ${i + 1}`),
        workbooks: Array.from({ length: workbooksN }, (_, i) => `${sol?.name ?? id} workbook ${i + 1}`),
        playbooks: Array.from({ length: playbooksN }, (_, i) => `${sol?.name ?? id} playbook ${i + 1}`),
        huntingQueries: Array.from({ length: huntingN }, (_, i) => `${sol?.name ?? id} hunt ${i + 1}`),
      },
    };
  });
}

// ===== Repositories (ported from sentinel-portal.js renderRepositories seed) =====

function buildRepos(): SentinelRepo[] {
  return [
    { id: "r-1", name: "cloudlab-sentinel-content", source: "GitHub", org: "cloudlab-inc", repo: "sentinel-content", branch: "main", folder: "detections/", deployedRules: 47, status: "Connected", lastSync: dateOffset(2) },
    { id: "r-2", name: "cloudlab-mssp-mdr", source: "Azure DevOps", org: "cloudlab", repo: "mssp-mdr-content", branch: "main", folder: "tenant-overrides/", deployedRules: 12, status: "Connected", lastSync: dateOffset(0, 6) },
    { id: "r-3", name: "cloudlab-banking-overlay", source: "GitHub", org: "cloudlab-inc", repo: "banking-overlay", branch: "release/2026.5", folder: "rules/", deployedRules: 3, status: "Sync error", lastSync: dateOffset(0, 14) },
  ];
}

// ===== Saved queries (Logs page) =====

function buildSavedQueries(): SentinelSavedQuery[] {
  return [
    {
      id: "sq-1",
      name: "Failed sign-ins last 24h",
      kql: "SigninLogs\n| where TimeGenerated > ago(24h)\n| where ResultType != 0\n| summarize count() by UserPrincipalName, ResultType\n| order by count_ desc",
      createdBy: "naveen",
      created: dateOffset(10),
    },
    {
      id: "sq-2",
      name: "Top talkers by data volume",
      kql: "CommonSecurityLog\n| where TimeGenerated > ago(24h)\n| summarize TotalBytes = sum(SentBytes) by SourceUserName\n| top 20 by TotalBytes desc",
      createdBy: "priya",
      created: dateOffset(6),
    },
  ];
}

// ===== Workspace defaults =====

function buildWorkspace(): SentinelWorkspace {
  return {
    name: "cloudlab-sentinel-ws",
    subscription: "CloudLab-Training-Sub",
    resourceGroup: "rg-security",
    region: "(Asia Pacific) Central India",
    created: "2024-04-12",
    dataRetention: "90 days",
    dailyCapReservation: "Pay-as-you-go (5 GB/day)",
    tenantName: TENANT.companyName,
    tenantId: TENANT.tenantId,
    pricingTier: "Pay-as-you-go",
    estimatedDailyGB: 5,
    retentionDays: 90,
    dailyCapGB: 10,
    tableRetention: {},
    audit: { queryLogs: true, health: true },
  };
}

/**
 * Builds a complete, fully-populated SentinelState — the fresh/seed state for the
 * Sentinel admin console simulator. Mirrors freshState() in sentinel-data.js, plus
 * the Threat Intelligence, UEBA/MITRE/Notebooks and Content Hub seed data ported
 * from the other three source files (see module comments above for provenance).
 */
export function freshSentinelState(): SentinelState {
  const users = buildUsers();
  const devices = buildDevices();
  const solutions = buildSolutions();

  return {
    workspace: buildWorkspace(),
    incidents: buildIncidents(users, devices),
    rules: buildRules(),
    connectors: buildDataConnectors(),
    workbooks: buildWorkbooks(),
    huntingQueries: buildHuntingQueries(),
    bookmarks: buildBookmarks(),
    playbooks: buildPlaybooks(),
    automationRules: buildAutomationRules(),
    watchlists: buildWatchlists(users),
    threatIntel: buildThreatIntel(),
    entityRisks: buildEntityRisks(),
    mitreTactics: MITRE_TACTIC_TECHNIQUE_COUNTS.map((t) => ({ tactic: t.tactic, techniques: t.techniques, ourCoverage: 0, alertsLast30d: 0 })),
    notebooks: buildNotebooks(),
    solutions,
    installedSolutions: buildInstalledSolutions(solutions),
    repos: buildRepos(),
    savedQueries: buildSavedQueries(),
    queryHistory: [],
    users,
    devices,
    activityLog: [] as SentinelActivityEntry[],
    pinnedWorkbooks: [] as string[],
  };
}
