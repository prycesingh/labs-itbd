import type {
  DefenderAlert,
  DefenderAntiMalwarePolicy,
  DefenderAntiPhishPolicy,
  DefenderAntiSpamPolicy,
  DefenderAsset,
  DefenderAttackStoryEvent,
  DefenderCampaign,
  DefenderConnectionFilterPolicy,
  DefenderConnector,
  DefenderCustomDetectionRule,
  DefenderDetectionSummaryCard,
  DefenderDevice,
  DefenderDiscoveredApp,
  DefenderDkimDomain,
  DefenderEmailCollab,
  DefenderEmailThreat,
  DefenderEvidence,
  DefenderHoneyToken,
  DefenderHuntingQuery,
  DefenderHuntingSchema,
  DefenderIdentity,
  DefenderIncident,
  DefenderLateralMovementPath,
  DefenderOAuthApp,
  DefenderPendingAction,
  DefenderPermUser,
  DefenderPostureFinding,
  DefenderQuarantineMessage,
  DefenderQuarantinePolicyType,
  DefenderRole,
  DefenderRoleAssignment,
  DefenderSafeAttachmentsPolicy,
  DefenderSafeLinksPolicy,
  DefenderScheduledHunt,
  DefenderSecureScore,
  DefenderSecureScoreAction,
  DefenderSensitiveAccount,
  DefenderSessionPolicy,
  DefenderState,
  DefenderSubmission,
  DefenderThreatAnalytic,
  DefenderVulnerability,
  DefenderWorkload,
  DefenderWorkloadId,
} from "./types";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Ported verbatim from itbd-lab/simulators/defender/js/defender-data.js `rng(seed)`.
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
// session), matching source behavior. Not used anywhere that requires stability
// across reloads within the same session beyond the rng-seeded fields.
function dateOffset(daysAgo: number, hoursAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  if (hoursAgo) d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

const SEVERITIES: DefenderIncident["severity"][] = ["High", "Medium", "Low", "Informational"];
const CATEGORIES = [
  "Malware",
  "Phishing",
  "Suspicious activity",
  "Credential theft",
  "Reconnaissance",
  "Initial access",
  "Lateral movement",
  "Defense evasion",
  "Persistence",
  "Execution",
  "Exfiltration",
  "Command and control",
];
const SERVICE_SOURCES = [
  "Microsoft Defender for Endpoint",
  "Microsoft Defender for Office 365",
  "Microsoft Defender for Identity",
  "Microsoft Defender for Cloud Apps",
  "Microsoft Entra ID Protection",
  "Microsoft 365 Defender",
];
const INVESTIGATION_STATES = [
  "No threats found",
  "Remediated",
  "Partially remediated",
  "Pending action",
  "Running",
  "Queued",
  "Unsupported",
];

const INCIDENT_TITLES = [
  "Multi-stage incident involving Initial access & Credential access on multiple endpoints",
  "Possible AiTM phishing campaign targeting Finance department",
  "Suspicious PowerShell execution on WIN-DC01",
  "Mass download from SharePoint by user ankit",
  "Impossible travel detected for vikram@cloudlab.in",
  "Ransomware behavior detected on FILE-SRV-01",
  "Credential dumping via LSASS access",
  "Brute force attempt on Entra ID account priya",
  "Suspicious email forwarding rule created in Outlook",
  "Anonymous IP address sign-in from rahul@cloudlab.in",
  "Malware: Trojan:Win32/Wacatac.B!ml on LAPTOP-SNEHA",
  "Phishing URL clicked by 14 users in Marketing",
  "Unusual file deletion volume detected on FILE-SRV-02",
  "Suspicious service principal sign-in from rare location",
  "Office 365 mailbox exfiltration via Graph API",
  "Pass-the-Hash attack detected on DC-01",
  "Defender Antivirus disabled on LAPTOP-AMIT",
  "Suspicious Kerberoasting activity from corp\\workstation",
  "Cloud app: Risky OAuth application granted consent",
  "Lateral movement: Remote WMI execution from compromised host",
];

const DEVICE_NAMES = [
  "WIN-DC01",
  "WIN-DC02",
  "FILE-SRV-01",
  "FILE-SRV-02",
  "APP-SRV-01",
  "SQL-PRD-01",
  "WEB-FRONT-01",
  "WEB-FRONT-02",
  "JUMPBOX-01",
  "BACKUP-SRV",
  "LAPTOP-ANKIT",
  "LAPTOP-PRIYA",
  "LAPTOP-RAHUL",
  "LAPTOP-SNEHA",
  "LAPTOP-VIKRAM",
  "LAPTOP-ROHIT",
  "LAPTOP-NEHA",
  "LAPTOP-AMIT",
  "LAPTOP-DEEPIKA",
  "LAPTOP-MANISH",
  "DESK-FIN-01",
  "DESK-HR-01",
  "DESK-SALES-01",
  "DESK-MKT-01",
  "DESK-IT-01",
  "MAC-DESIGN-01",
  "MAC-DESIGN-02",
  "KIOSK-LOBBY",
  "PRINT-SRV",
  "PROXY-01",
];

const OSES = [
  "Windows 11 Enterprise 23H2",
  "Windows 10 Pro 22H2",
  "Windows Server 2022 Datacenter",
  "Windows Server 2019 Standard",
  "macOS 14.3 Sonoma",
  "Ubuntu 22.04 LTS",
  "Windows 10 Enterprise LTSC",
];

const IDENTITY_NAMES: [string, string, string, string][] = [
  ["Alex Johnson", "ankit", "Cloud Architect / CTO", "IT"],
  ["Rohit Verma", "rohit", "Sr. Identity Admin", "IT"],
  ["Vivek Iyer", "vivek", "Network + Security Engineer", "IT"],
  ["Priya Singh", "priya", "Sr. Endpoint Admin (Intune)", "IT"],
  ["Manish Kumar", "manish", "Exchange + M365 Admin", "IT"],
  ["Sunita Joshi", "sunita", "Compliance + Purview Admin", "IT"],
  ["Naveen Reddy", "naveen", "Sentinel SOC Analyst (Tier-2)", "IT"],
  ["Jaya Krishnan", "jaya", "SOC Analyst (Tier-1)", "IT"],
  ["Arjun Mehta", "arjun", "VP Sales", "Sales"],
  ["Kiran Rao", "kiran", "Sr. Account Executive", "Sales"],
  ["Amit Trivedi", "amit", "Chief Financial Officer", "Finance"],
  ["Pooja Nair", "pooja", "Marketing Executive", "Marketing"],
  ["Suresh Reddy", "suresh", "Finance Executive", "Finance"],
  ["Kavita Bhat", "kavita", "Sales Representative", "Sales"],
  ["Manish Tiwari", "manish", "DevOps Engineer", "Information Technology"],
];

function buildAttackStory(rand: () => number): DefenderAttackStoryEvent[] {
  const templates: DefenderAttackStoryEvent[] = [
    { ts: 6, type: "Sign-in", icon: "user", title: "Risky sign-in from anonymous IP", detail: "198.51.100.34 (Tor exit node) - succeeded" },
    { ts: 5, type: "Email", icon: "mail", title: "Phishing email delivered", detail: "From: hr-admin@external-partner.co  Subject: Urgent: Update your benefits" },
    { ts: 4, type: "Link click", icon: "link", title: "Malicious URL clicked", detail: "https://hr-update[.]online/login.html" },
    { ts: 3, type: "Endpoint", icon: "pc", title: "PowerShell process spawned by Outlook", detail: "powershell.exe -enc JABjAGwAaQBlAG4AdAAgAD0A..." },
    { ts: 2, type: "Endpoint", icon: "pc", title: "LSASS access by suspicious process", detail: "rundll32.exe accessing lsass.exe via comsvcs.dll MiniDump" },
    { ts: 1, type: "Lateral", icon: "net", title: "WMI execution on remote host FILE-SRV-01", detail: "wmic /node:FILE-SRV-01 process call create cmd.exe /c whoami" },
    { ts: 0, type: "Exfiltration", icon: "cloud", title: "Large file transfer to external IP", detail: "2.4 GB to 203.0.113.42 over port 443" },
  ];
  const n = 4 + Math.floor(rand() * 3);
  return templates.slice(0, n);
}

function buildEvidence(idx: number): DefenderEvidence {
  return {
    files: [
      { name: "invoice_q4.docm", sha256: `a1b2c3d4e5f60718${idx}00aabbccddeeff`, verdict: "Malicious", firstSeen: dateOffset(2, 6) },
      { name: "svc_helper.exe", sha256: `fe0987654321${idx}cc11223344556677`, verdict: "Suspicious", firstSeen: dateOffset(1, 2) },
    ],
    processes: [
      { name: "powershell.exe", cmdLine: "powershell -nop -w hidden -enc <base64>", pid: 4812 + idx, account: "CORP\\sneha" },
      { name: "rundll32.exe", cmdLine: "rundll32 comsvcs.dll MiniDump 632 lsass.dmp", pid: 6024 + idx, account: "NT AUTHORITY\\SYSTEM" },
    ],
    ips: [
      { addr: "198.51.100.34", country: "Romania", asn: "AS9009 - M247", reputation: "Malicious" },
      { addr: "203.0.113.42", country: "Russia", asn: "AS35415 - WebToCloud", reputation: "Suspicious" },
    ],
    urls: [
      { url: "https://hr-update[.]online/login.html", verdict: "Phishing", category: "Phish" },
      { url: "https://cdn-ms-update[.]xyz/payload", verdict: "Malicious", category: "Malware" },
    ],
    mailboxes: [{ upn: "sneha@cloudlab.in", deliveryAction: "Delivered to Inbox", deliveryLocation: "Inbox" }],
  };
}

function buildIncidents(): DefenderIncident[] {
  const rand = rng(42);
  const list: DefenderIncident[] = [];
  for (let i = 0; i < 20; i++) {
    const sev = SEVERITIES[i < 6 ? 0 : i < 12 ? 1 : i < 17 ? 2 : 3];
    let st: DefenderIncident["status"] = i < 3 ? "Active" : i < 8 ? "In progress" : "Active";
    if (i >= 14) st = "Resolved";
    const cat = pick(rand, CATEGORIES);
    const src = pick(rand, SERVICE_SOURCES);
    const inv = pick(rand, INVESTIGATION_STATES);
    const categories = [cat, pick(rand, CATEGORIES)].filter((x, j, a) => a.indexOf(x) === j);
    list.push({
      id: `INC-${10000 + i}`,
      title: INCIDENT_TITLES[i] || `Suspicious activity #${i}`,
      severity: sev,
      status: st,
      categories,
      serviceSources: [src],
      investigationState: inv,
      tags: i % 3 === 0 ? ["CriticalAssets"] : i % 4 === 0 ? ["HumanOperated"] : [],
      assignedTo: i % 4 === 0 ? "admin@itbd.onmicrosoft.com" : "Unassigned",
      created: dateOffset(Math.floor(rand() * 14), Math.floor(rand() * 24)),
      lastActivity: dateOffset(Math.floor(rand() * 3), Math.floor(rand() * 24)),
      activeAlerts: Math.floor(rand() * 6) + 2,
      totalAlerts: Math.floor(rand() * 12) + 4,
      impactedDevices: Math.floor(rand() * 4) + 1,
      impactedUsers: Math.floor(rand() * 3) + 1,
      impactedMailboxes: i % 4 === 0 ? Math.floor(rand() * 3) : 0,
      mitreTactics: [
        pick(rand, [
          "Initial Access",
          "Execution",
          "Persistence",
          "Credential Access",
          "Lateral Movement",
          "Defense Evasion",
          "Exfiltration",
          "Discovery",
        ]),
      ],
      attackStory: buildAttackStory(rand),
      evidence: buildEvidence(i),
    });
  }
  return list;
}

const ALERT_TITLES = [
  "Suspicious PowerShell command line",
  "LSASS memory access by suspicious process",
  "Anomalous sign-in from unfamiliar location",
  "Malicious URL clicked",
  "Credential theft activity detected",
  "Unfamiliar sign-in properties",
  "Atypical travel",
  "Mass mailing flagged as spam",
  "Phishing email with embedded link",
  "Email reported as phishing by user",
  "Trojan!Wacatac.B!ml detected",
  "Suspicious sequence of exploration activities",
  "WMI persistence attempt",
  "Defender Antivirus signatures out of date",
  "Brute force user account attack",
  "Suspicious OAuth app consent",
  "Risky service principal sign-in",
  "Anomalous file deletion volume",
  "Suspicious SMB session enumeration",
  "NTLM relay attack",
];

function buildAlerts(incidents: DefenderIncident[]): DefenderAlert[] {
  const rand = rng(99);
  const list: DefenderAlert[] = [];
  for (let i = 0; i < 50; i++) {
    const inc = incidents[i % incidents.length];
    list.push({
      id: `ALR-${50000 + i}`,
      title: ALERT_TITLES[i % ALERT_TITLES.length],
      severity: inc.severity,
      status: i < 20 ? "New" : i < 35 ? "In progress" : "Resolved",
      category: pick(rand, CATEGORIES),
      serviceSource: inc.serviceSources[0],
      incidentId: inc.id,
      incidentTitle: inc.title,
      detectionSource: pick(rand, ["EDR", "Antivirus", "SmartScreen", "AAD Identity Protection", "MDO", "MDA"]),
      firstActivity: dateOffset(Math.floor(rand() * 5), Math.floor(rand() * 24)),
      lastActivity: dateOffset(Math.floor(rand() * 2), Math.floor(rand() * 24)),
      impactedAssets: pick(rand, DEVICE_NAMES),
      mitreTechnique: pick(rand, [
        "T1059.001 PowerShell",
        "T1003.001 LSASS Memory",
        "T1078 Valid Accounts",
        "T1566.001 Spearphishing Attachment",
        "T1021.002 SMB/Admin Shares",
      ]),
    });
  }
  return list;
}

function buildDevices(): DefenderDevice[] {
  const rand = rng(7);
  const list: DefenderDevice[] = [];
  for (let i = 0; i < 30; i++) {
    const name = DEVICE_NAMES[i % DEVICE_NAMES.length];
    let risk: DefenderDevice["riskLevel"] = i < 4 ? "High" : i < 10 ? "Medium" : i < 20 ? "Low" : "None";
    if (i === 0) risk = "Very High";
    const exposure: DefenderDevice["exposureLevel"] = i < 5 ? "High" : i < 15 ? "Medium" : "Low";
    list.push({
      id: `dev-${1000 + i}`,
      name,
      domain: name.indexOf("SRV") >= 0 || name.indexOf("DC") >= 0 ? "corp.cloudlab.local" : "cloudlab.onmicrosoft.com",
      riskLevel: risk,
      exposureLevel: exposure,
      os: pick(rand, OSES),
      healthState: i < 25 ? "Active" : i % 2 ? "Inactive" : "No sensor data",
      lastSeen: dateOffset(Math.floor(rand() * 5), Math.floor(rand() * 24)),
      onboardedOn: `2024-${String(1 + (i % 12)).padStart(2, "0")}-15`,
      tags: i % 4 === 0 ? ["Critical"] : i % 5 === 0 ? ["VIP"] : [],
      managedBy: "Intune",
      avStatus: i % 7 === 0 ? "Not reporting" : "Up to date",
      firstSeen: "2024-01-15",
      ipAddress: `10.0.${i % 6}.${10 + i}`,
      publicIp: `52.140.${i % 200}.${i + 5}`,
      loggedOnUser: pick(rand, [
        "ankit",
        "rohit",
        "vivek",
        "priya",
        "manish",
        "sunita",
        "naveen",
        "arjun",
        "kiran",
        "vikash",
        "amit",
        "lakshmi",
        "pooja",
        "karthik",
        "tara",
      ]),
      deviceType: name.indexOf("LAPTOP") >= 0 ? "Workstation" : name.indexOf("SRV") >= 0 || name.indexOf("DC") >= 0 ? "Server" : "Workstation",
      vulnerabilities: 3 + Math.floor(rand() * 25),
      missingKbs: ["KB5034441", "KB5036892", "KB5037768"].slice(0, 1 + Math.floor(rand() * 3)),
      installedSoftware: [
        { name: "Google Chrome", version: "122.0.6261.95", vendor: "Google", vulns: 2 },
        { name: "Adobe Acrobat Reader", version: "23.008.20533", vendor: "Adobe", vulns: 4 },
        { name: "Microsoft Edge", version: "125.0.2535.51", vendor: "Microsoft", vulns: 0 },
        { name: "Mozilla Firefox", version: "124.0.2", vendor: "Mozilla", vulns: 1 },
        { name: "7-Zip 22.01", version: "22.01", vendor: "Igor Pavlov", vulns: 0 },
        { name: "PuTTY", version: "0.78", vendor: "Simon Tatham", vulns: 2 },
      ],
      recommendations: [
        { title: "Update Microsoft Edge to latest version", impact: "+3.5", status: "Active" },
        { title: "Turn on Tamper protection", impact: "+5.2", status: "Active" },
        { title: "Enable BitLocker drive encryption", impact: "+4.1", status: "Completed" },
        { title: "Configure attack surface reduction rules", impact: "+6.0", status: "Active" },
      ],
    });
  }
  return list;
}

function buildIdentities(): DefenderIdentity[] {
  const list: DefenderIdentity[] = [];
  for (let i = 0; i < IDENTITY_NAMES.length; i++) {
    const [displayName, username, jobTitle, department] = IDENTITY_NAMES[i];
    const risk: DefenderIdentity["signInRisk"] = i < 2 ? "High" : i < 5 ? "Medium" : i < 9 ? "Low" : "None";
    list.push({
      id: `id-${200 + i}`,
      displayName,
      username,
      upn: `${username}@cloudlab.in`,
      jobTitle,
      department,
      signInRisk: risk,
      userRisk: risk,
      mfaRegistered: i % 4 !== 0,
      mfaMethods: i % 4 !== 0 ? ["Microsoft Authenticator", "Phone (SMS)"] : [],
      riskySignIns: i < 5 ? (i % 5) + 1 : 0,
      lastSignIn: dateOffset(i % 5, i * 2),
      lastRiskySignIn: i < 5 ? dateOffset(1, i * 3) : null,
      isSensitive: i < 3,
      privilegedRoles: i === 0 ? ["Global Administrator"] : i < 3 ? ["Security Reader"] : [],
    });
  }
  return list;
}

type ActionTuple = [string, DefenderSecureScoreAction["category"], number, DefenderSecureScoreAction["status"]];

function buildSecureScore(): DefenderSecureScore {
  const idActions: ActionTuple[] = [
    ["Require MFA for all administrators", "Identity", 10.0, "Achieved"],
    ["Enable Conditional Access for risky sign-ins", "Identity", 8.5, "Not achieved"],
    ["Block legacy authentication protocols", "Identity", 6.0, "Achieved"],
    ["Designate more than one global administrator", "Identity", 1.5, "Achieved"],
    ["Do not allow users to grant consent to unmanaged applications", "Identity", 5.0, "Not achieved"],
    ["Enable self-service password reset", "Identity", 2.0, "Achieved"],
    ["Use Privileged Identity Management for global admins", "Identity", 7.0, "Not achieved"],
    ["Enable password hash sync for on-premises Active Directory", "Identity", 3.0, "Achieved"],
    ["Require MFA for Azure management", "Identity", 8.0, "Achieved"],
    ["Enable Identity Protection user risk policy", "Identity", 6.0, "Not achieved"],
    ["Enable Identity Protection sign-in risk policy", "Identity", 6.0, "Not achieved"],
    ["Limit external collaboration to trusted partners", "Identity", 3.0, "Not achieved"],
    ["Use cloud only accounts for high-privileged roles", "Identity", 4.0, "Not achieved"],
    ["Designate emergency access accounts", "Identity", 3.0, "Risk accepted"],
    ["Restrict user app registrations", "Identity", 4.0, "Achieved"],
    ["Disable users that have inactive accounts", "Identity", 3.0, "Not achieved"],
    ["Enable Continuous Access Evaluation", "Identity", 4.0, "Achieved"],
    ["Block sign-ins from countries you do not operate from", "Identity", 5.0, "Not achieved"],
    ["Require token protection for sign-ins", "Identity", 5.0, "Not achieved"],
    ["Enable authentication context for sensitive apps", "Identity", 3.0, "Not achieved"],
  ];
  const devActions: ActionTuple[] = [
    ["Turn on Microsoft Defender Antivirus real-time protection", "Devices", 5.0, "Achieved"],
    ["Turn on cloud-delivered protection", "Devices", 4.0, "Achieved"],
    ["Turn on tamper protection", "Devices", 5.0, "Not achieved"],
    ["Enable BitLocker drive encryption on all eligible devices", "Devices", 6.0, "Not achieved"],
    ["Enable Windows Defender Application Control", "Devices", 7.0, "Not achieved"],
    ["Enable network protection", "Devices", 4.0, "Achieved"],
    ["Block all Office applications from creating child processes", "Devices", 3.0, "Not achieved"],
    ["Block executable content from email and webmail", "Devices", 3.0, "Achieved"],
    ["Block credential stealing from LSASS subsystem", "Devices", 5.0, "Not achieved"],
    ["Block JavaScript / VBScript from launching downloaded content", "Devices", 3.0, "Achieved"],
    ["Block Office apps from injecting code into other processes", "Devices", 3.0, "Achieved"],
    ["Block Win32 API calls from Office macros", "Devices", 3.0, "Not achieved"],
    ["Block persistence through WMI event subscription", "Devices", 3.0, "Not achieved"],
    ["Enable controlled folder access", "Devices", 4.0, "Not achieved"],
    ["Use Windows Hello for Business", "Devices", 3.0, "Achieved"],
    ["Update Microsoft Defender Antivirus signatures regularly", "Devices", 2.0, "Achieved"],
    ["Run a scheduled full scan weekly", "Devices", 1.0, "Achieved"],
    ["Enforce Smart App Control", "Devices", 4.0, "Not achieved"],
    ["Block Adobe Reader from creating child processes", "Devices", 2.0, "Not achieved"],
    ["Enable Windows Firewall on all profiles", "Devices", 3.0, "Achieved"],
  ];
  const appActions: ActionTuple[] = [
    ["Discover unsanctioned cloud apps in your environment", "Apps", 4.0, "Achieved"],
    ["Block access to unsanctioned cloud apps", "Apps", 5.0, "Not achieved"],
    ["Use Cloud App Security to investigate suspicious activity", "Apps", 3.0, "Achieved"],
    ["Enforce session controls for sensitive cloud apps", "Apps", 4.0, "Not achieved"],
    ["Configure DLP policies for Microsoft 365", "Apps", 4.0, "Not achieved"],
    ["Tag risky OAuth applications", "Apps", 3.0, "Achieved"],
    ["Block downloads from non-corporate apps via session policies", "Apps", 4.0, "Not achieved"],
    ["Enable malware detection in OneDrive and SharePoint", "Apps", 3.0, "Achieved"],
    ["Configure Safe Attachments for SharePoint, OneDrive, Teams", "Apps", 4.0, "Achieved"],
    ["Configure Safe Links for Office apps", "Apps", 4.0, "Achieved"],
    ["Enable user impersonation protection in anti-phishing policy", "Apps", 5.0, "Not achieved"],
    ["Enable Spoof intelligence", "Apps", 3.0, "Achieved"],
    ["Configure DMARC, DKIM, SPF for sending domains", "Apps", 4.0, "Not achieved"],
    ["Quarantine mail flagged as high-confidence phishing", "Apps", 3.0, "Achieved"],
    ["Configure anti-spam policy", "Apps", 3.0, "Achieved"],
    ["Set outbound spam policy", "Apps", 2.0, "Achieved"],
    ["Disable mail forwarding to external addresses", "Apps", 5.0, "Not achieved"],
    ["Configure Attack Simulation Training", "Apps", 2.0, "Not achieved"],
    ["Review third-party application permissions monthly", "Apps", 3.0, "Not achieved"],
    ["Enable Defender for Cloud Apps anomaly detection policies", "Apps", 4.0, "Achieved"],
  ];
  const dataActions: ActionTuple[] = [
    ["Configure sensitivity labels for sensitive content", "Data", 4.0, "Not achieved"],
    ["Configure auto-labeling policies", "Data", 4.0, "Not achieved"],
    ["Configure retention policies for Teams and Exchange", "Data", 3.0, "Achieved"],
    ["Enable Customer Lockbox", "Data", 2.0, "Not achieved"],
    ["Block external sharing of confidential documents", "Data", 4.0, "Not achieved"],
    ["Configure insider risk management policies", "Data", 4.0, "Not achieved"],
    ["Encrypt sensitive emails with Office 365 Message Encryption", "Data", 3.0, "Achieved"],
    ["Enable communication compliance policies", "Data", 3.0, "Not achieved"],
    ["Configure DLP policy for credit card numbers", "Data", 3.0, "Achieved"],
    ["Configure DLP policy for India Aadhaar / PAN", "Data", 3.0, "Not achieved"],
    ["Enable advanced eDiscovery", "Data", 2.0, "Achieved"],
    ["Audit external user access to confidential sites", "Data", 3.0, "Not achieved"],
    ["Use mailbox audit logging", "Data", 2.0, "Achieved"],
    ["Configure SharePoint anonymous link expiration", "Data", 2.0, "Achieved"],
    ["Block access to unmanaged devices for SharePoint", "Data", 4.0, "Not achieved"],
    ["Apply container labels to Teams and Microsoft 365 groups", "Data", 2.0, "Not achieved"],
    ["Configure Conditional Access for sensitive labels", "Data", 3.0, "Not achieved"],
    ["Limit guest access to specific sites only", "Data", 2.0, "Not achieved"],
    ["Enable Microsoft Purview audit log retention 1 year", "Data", 1.0, "Achieved"],
    ["Encrypt files at rest using customer-managed keys", "Data", 3.0, "Not achieved"],
  ];
  const defenderForCloud: ActionTuple[] = [
    ["Enable Microsoft Defender for Cloud Standard tier", "Microsoft Defender for Cloud", 6.0, "Achieved"],
    ["Configure auto-provisioning for the Log Analytics agent", "Microsoft Defender for Cloud", 3.0, "Achieved"],
    ["Enable Defender for Servers Plan 2", "Microsoft Defender for Cloud", 4.0, "Achieved"],
    ["Enable Defender for Storage", "Microsoft Defender for Cloud", 3.0, "Not achieved"],
    ["Enable Defender for SQL on all databases", "Microsoft Defender for Cloud", 4.0, "Not achieved"],
    ["Enable Defender for Containers", "Microsoft Defender for Cloud", 3.0, "Not achieved"],
    ["Enable Just-In-Time VM access", "Microsoft Defender for Cloud", 4.0, "Achieved"],
    ["Enable adaptive application controls on Windows VMs", "Microsoft Defender for Cloud", 3.0, "Not achieved"],
    ["Apply system updates to VMs", "Microsoft Defender for Cloud", 4.0, "Achieved"],
    ["Resolve vulnerabilities for container images in registries", "Microsoft Defender for Cloud", 3.0, "Not achieved"],
  ];

  const all = [...idActions, ...devActions, ...appActions, ...dataActions, ...defenderForCloud];
  const actions: DefenderSecureScoreAction[] = all.map(([title, category, impact, status], i) => ({
    id: `sa-${1000 + i}`,
    title,
    category,
    impact,
    status,
    userImpact: i % 3 === 0 ? "Low" : i % 5 === 0 ? "High" : "Moderate",
    implementation: i % 2 === 0 ? "Conditional Access" : "Microsoft 365 admin center",
    regression: false,
  }));

  let totalPossible = 0;
  let achieved = 0;
  actions.forEach((a) => {
    totalPossible += a.impact;
    if (a.status === "Achieved") achieved += a.impact;
  });

  return {
    actions,
    currentScore: Math.round(achieved),
    maxScore: Math.round(totalPossible),
    percentage: Math.round((achieved / totalPossible) * 100),
    history: buildScoreHistory(achieved, totalPossible),
    comparison: {
      similarOrgs: 58,
      yourOrg: Math.round((achieved / totalPossible) * 100),
    },
  };
}

// Score history uses a dedicated rng seed (distinct from other builders) so the
// 90-day trend line is stable across reloads within a session instead of using
// Math.random() (which the source used, but we deliberately deviate here to stay fully deterministic).
function buildScoreHistory(currentAchieved: number, total: number): { date: string; score: number }[] {
  const rand = rng(2026);
  const history: { date: string; score: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const delta = (rand() - 0.5) * 4;
    const pct = Math.max(40, Math.min(75, (currentAchieved / total) * 100 - i * 0.15 + delta));
    history.push({ date: d.toISOString().slice(0, 10), score: Math.round(pct) });
  }
  return history;
}

function buildEmailThreats(): DefenderEmailThreat[] {
  const rand = rng(33);
  const subjects = [
    "Urgent: Action required on your Microsoft 365 account",
    "You have a new voicemail - listen now",
    "Invoice #2026-04-1142 attached",
    "Microsoft Teams: You missed a meeting",
    "Your Office 365 password expires today",
    "DHL shipment notification - tracking required",
    "HR: Updated employee handbook 2026",
    "IT helpdesk: Mailbox quota exceeded",
    "Wire transfer instructions - CONFIDENTIAL",
    "Annual bonus statement - review attached",
    "Adobe document shared with you",
    "OneDrive: Storage limit reached",
  ];
  const senders = [
    "admin@microsft-365.com",
    "noreply@voicemail-corp.com",
    "billing@invoice-secure.online",
    "no-reply@teams-microsoft.net",
    "support@office-renewal.com",
    "dhl@dhl-tracking.info",
    "hr@employee-portal.co",
    "helpdesk@cloudIab.in",
    "finance@wire-instructions.net",
    "payroll@bonus-statement.com",
    "documents@adobe-shared.com",
    "storage@onedrive-alert.net",
  ];
  const list: DefenderEmailThreat[] = [];
  for (let i = 0; i < 12; i++) {
    const threatType: DefenderEmailThreat["threatType"] = i < 5 ? "Phish" : i < 9 ? "Malware" : "BEC";
    list.push({
      id: `em-${3000 + i}`,
      subject: subjects[i],
      sender: senders[i],
      senderIp: `192.0.2.${10 + i * 7}`,
      recipient: `${pick(rand, ["kiran", "arjun", "amit", "lakshmi", "vikash", "pooja", "karthik", "sunita", "arjun", "rahul", "priya", "rohit", "manish", "tara", "meena"])}@cloudlab.in`,
      threatType,
      deliveryAction: i < 3 ? "Delivered to Inbox" : i < 6 ? "Junk folder" : "Quarantined",
      deliveryLocation: i < 3 ? "Inbox" : i < 6 ? "Junk Email" : "Quarantine",
      detectionTech: pick(rand, ["Anti-malware", "Anti-phish", "Spoof", "URL detonation", "File detonation", "Mailbox intelligence", "Heuristics"]),
      received: dateOffset(Math.floor(rand() * 7), Math.floor(rand() * 24)),
      originalSize: `${(rand() * 2000).toFixed(0)} KB`,
      hasAttachment: i % 3 === 0,
      attachmentName: i % 3 === 0 ? `invoice_${i}.docm` : null,
      urls: i % 2 === 0 ? ["https://hr-update[.]online/login", "https://microsft-365[.]com/reset"] : [],
      primaryOverride: "None",
      authenticationResults: {
        spf: pick(rand, ["Pass", "Fail", "SoftFail"]),
        dkim: pick(rand, ["Pass", "Fail", "None"]),
        dmarc: pick(rand, ["Pass", "Fail", "None"]),
        compauth: "Fail",
      },
    });
  }
  return list;
}

function buildSubmissions(): DefenderSubmission[] {
  return [
    { id: "sub-1", type: "Email", submitter: "priya", submittedFor: "Phishing", date: dateOffset(1, 2), status: "Completed", result: "Confirmed phishing" },
    { id: "sub-2", type: "URL", submitter: "ankit", submittedFor: "Malware", date: dateOffset(2, 4), status: "In progress", result: "-" },
    { id: "sub-3", type: "File", submitter: "rohit", submittedFor: "Malware", date: dateOffset(3, 6), status: "Completed", result: "Confirmed malware" },
    { id: "sub-4", type: "Email", submitter: "tara", submittedFor: "Not phishing", date: dateOffset(4, 2), status: "Completed", result: "Not phishing" },
    { id: "sub-5", type: "Email", submitter: "amit", submittedFor: "Phishing", date: dateOffset(5, 8), status: "Completed", result: "Confirmed phishing" },
  ];
}

function buildThreatAnalytics(): DefenderThreatAnalytic[] {
  return [
    { id: "ta-1", name: "Storm-0978 (RomCom) targeting governmental orgs", severity: "High", category: "Activity profile", exposureLevel: "Medium", alertsCount: 3, impactedAssets: 2, lastUpdated: dateOffset(1) },
    { id: "ta-2", name: "Forest Blizzard (APT28) Outlook elevation of privilege", severity: "High", category: "Threat actor", exposureLevel: "High", alertsCount: 0, impactedAssets: 0, lastUpdated: dateOffset(3) },
    { id: "ta-3", name: "Akira ransomware operators", severity: "High", category: "Threat actor", exposureLevel: "High", alertsCount: 1, impactedAssets: 1, lastUpdated: dateOffset(2) },
    { id: "ta-4", name: "CVE-2024-21412 Defender SmartScreen bypass", severity: "High", category: "Vulnerability", exposureLevel: "Medium", alertsCount: 0, impactedAssets: 4, lastUpdated: dateOffset(5) },
    { id: "ta-5", name: "Volt Typhoon living-off-the-land", severity: "High", category: "Threat actor", exposureLevel: "Low", alertsCount: 0, impactedAssets: 0, lastUpdated: dateOffset(7) },
    { id: "ta-6", name: "AiTM phishing kits (EvilProxy, Tycoon)", severity: "Medium", category: "Tool/Tech", exposureLevel: "Medium", alertsCount: 2, impactedAssets: 5, lastUpdated: dateOffset(2) },
    { id: "ta-7", name: "Midnight Blizzard credential theft", severity: "High", category: "Threat actor", exposureLevel: "Medium", alertsCount: 0, impactedAssets: 0, lastUpdated: dateOffset(10) },
    { id: "ta-8", name: "LockBit 3.0 ransomware affiliates", severity: "High", category: "Threat actor", exposureLevel: "High", alertsCount: 0, impactedAssets: 0, lastUpdated: dateOffset(4) },
  ];
}

function buildVulnerabilities(): DefenderVulnerability[] {
  return [
    { id: "CVE-2024-21412", name: "Microsoft Defender SmartScreen bypass", severity: "High", cvss: 8.1, exposedDevices: 4, threatActivity: "Active", age: 90 },
    { id: "CVE-2024-30040", name: "Windows MSHTML Platform Security Feature Bypass", severity: "High", cvss: 8.8, exposedDevices: 12, threatActivity: "Active", age: 30 },
    { id: "CVE-2024-26169", name: "Windows Error Reporting elevation of privilege", severity: "Medium", cvss: 7.8, exposedDevices: 8, threatActivity: "None", age: 60 },
    { id: "CVE-2023-36884", name: "Office and Windows HTML Remote Code Execution", severity: "High", cvss: 7.5, exposedDevices: 3, threatActivity: "Active", age: 300 },
    { id: "CVE-2024-21351", name: "Windows SmartScreen Security Feature Bypass", severity: "High", cvss: 7.6, exposedDevices: 9, threatActivity: "Active", age: 100 },
    { id: "CVE-2024-29988", name: "SmartScreen Prompt Security Feature Bypass", severity: "Medium", cvss: 8.8, exposedDevices: 5, threatActivity: "None", age: 45 },
    { id: "CVE-2022-30190", name: "MS-MSDT Follina remote code execution", severity: "High", cvss: 7.8, exposedDevices: 1, threatActivity: "Patched", age: 800 },
  ];
}

function buildCampaigns(): DefenderCampaign[] {
  return [
    { id: "cmp-1", name: "AiTM phish targeting Finance dept", type: "Phish", messages: 14, users: 8, urls: 2, status: "Active", firstSeen: dateOffset(2), lastSeen: dateOffset(0, 3) },
    { id: "cmp-2", name: "Malware (Wacatac) via .docm attachments", type: "Malware", messages: 6, users: 4, urls: 1, status: "Active", firstSeen: dateOffset(3), lastSeen: dateOffset(1) },
    { id: "cmp-3", name: "BEC: Wire transfer impersonating CFO", type: "BEC", messages: 3, users: 2, urls: 0, status: "Resolved", firstSeen: dateOffset(7), lastSeen: dateOffset(5) },
  ];
}

// ===== Advanced Hunting: 25 canned queries, detections, schema, scheduled hunts =====

const HUNTING_QUERIES: DefenderHuntingQuery[] = [
  { id: "q1", name: "Successful logon after multiple failures", tactic: "Credential Access", technique: "T1110.001 — Password Guessing", kql: 'IdentityLogonEvents\n| where Timestamp > ago(24h)\n| summarize Failures = countif(ActionType == "LogonFailed"),\n            Success = countif(ActionType == "LogonSuccess"),\n            DistinctIPs = dcount(IPAddress)\n         by AccountUpn, bin(Timestamp, 10m)\n| where Failures > 5 and Success > 0\n| order by Failures desc' },
  { id: "q2", name: "PowerShell with encoded command", tactic: "Execution", technique: "T1059.001 — PowerShell", kql: 'DeviceProcessEvents\n| where Timestamp > ago(7d)\n| where FileName =~ "powershell.exe"\n| where ProcessCommandLine has_any ("-EncodedCommand", "-enc", "-e ")\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName, InitiatingProcessCommandLine\n| order by Timestamp desc' },
  { id: "q3", name: "New service installation", tactic: "Persistence", technique: "T1543.003 — Windows Service", kql: 'DeviceEvents\n| where ActionType == "ServiceInstalled"\n| where Timestamp > ago(24h)\n| project Timestamp, DeviceName, AccountName, ServiceName=tostring(parse_json(AdditionalFields).ServiceName),\n          ImagePath=tostring(parse_json(AdditionalFields).ImagePath)\n| order by Timestamp desc' },
  { id: "q4", name: "Lateral movement via WMI/PSExec", tactic: "Lateral Movement", technique: "T1021 — Remote Services", kql: 'DeviceProcessEvents\n| where Timestamp > ago(24h)\n| where FileName in~ ("psexec.exe", "wmic.exe", "wmiprvse.exe")\n   or ProcessCommandLine has_any ("Invoke-WmiMethod", "Invoke-Command", "-ComputerName")\n| where AccountDomain != "NT AUTHORITY"\n| project Timestamp, DeviceName, AccountName, FileName, ProcessCommandLine, InitiatingProcessFileName' },
  { id: "q5", name: "Email with credential phishing URL", tactic: "Initial Access", technique: "T1566.002 — Spearphishing Link", kql: 'EmailEvents\n| where Timestamp > ago(7d)\n| where ThreatTypes has "Phish"\n| join kind=inner (EmailUrlInfo | summarize Urls=make_set(Url) by NetworkMessageId) on NetworkMessageId\n| project Timestamp, SenderFromAddress, RecipientEmailAddress, Subject, DeliveryAction, ThreatTypes, Urls' },
  { id: "q6", name: "Mailbox forwarding rule (data exfil)", tactic: "Exfiltration", technique: "T1114.003 — Email Forwarding Rule", kql: 'CloudAppEvents\n| where Application == "Office 365"\n| where ActionType in ("New-InboxRule", "Set-InboxRule", "UpdateInboxRule")\n| extend Forward = tostring(parse_json(RawEventData).Parameters[?(@.Name == "ForwardTo")].Value)\n| where isnotempty(Forward)\n| where Forward !endswith "@yourcorp.com"' },
  { id: "q7", name: "Process tree from suspicious LolBin", tactic: "Defense Evasion", technique: "T1218 — System Binary Proxy Execution", kql: 'let LolBins = dynamic(["regsvr32.exe","rundll32.exe","mshta.exe","installutil.exe","wmic.exe","msbuild.exe","certutil.exe"]);\nDeviceProcessEvents\n| where Timestamp > ago(24h)\n| where FileName in~ (LolBins)\n| where InitiatingProcessFileName !in~ ("explorer.exe","cmd.exe","powershell.exe")\n   or ProcessCommandLine has_any ("http://","https://","\\\\\\\\")\n| project Timestamp, DeviceName, FileName, ProcessCommandLine, InitiatingProcessFileName, InitiatingProcessCommandLine\n| order by Timestamp desc' },
  { id: "q8", name: "Unusual data download by user", tactic: "Exfiltration", technique: "T1530 — Data from Cloud Storage", kql: 'CloudAppEvents\n| where Timestamp > ago(7d)\n| where ActionType in ("FileDownloaded","FileSyncDownloaded")\n| extend SizeMB = todouble(coalesce(parse_json(RawEventData).ObjectSize,0)) / 1048576\n| summarize TotalMB = sum(SizeMB), FileCount = count() by AccountObjectId, AccountDisplayName, bin(Timestamp, 1h)\n| where TotalMB > 1024  // > 1 GB / hour\n| order by TotalMB desc' },
  { id: "q9", name: "Group membership added to privileged group", tactic: "Privilege Escalation", technique: "T1098 — Account Manipulation", kql: 'IdentityDirectoryEvents\n| where ActionType == "Group Membership changed"\n| extend Group = tostring(TargetDeviceName)\n| where Group has_any ("Domain Admins","Enterprise Admins","Schema Admins","Account Operators")\n| project Timestamp, AccountUpn, Group, AdditionalFields' },
  { id: "q10", name: "Defender disabled / tampered", tactic: "Defense Evasion", technique: "T1562.001 — Disable Tools", kql: 'DeviceEvents\n| where ActionType in ("AntivirusDetection","AntivirusDisabled","AntivirusTamper")\n   or ActionType == "ProcessCreated" and ProcessCommandLine has_any ("Set-MpPreference -DisableRealtimeMonitoring","reg add HKLM\\\\Software\\\\Policies\\\\Microsoft\\\\Windows Defender")\n| project Timestamp, DeviceName, AccountName, ActionType, ProcessCommandLine' },
  { id: "q11", name: "Living off the Land — certutil download", tactic: "Defense Evasion / Command and Control", technique: "T1105 — Ingress Tool Transfer", kql: 'DeviceProcessEvents\n| where FileName =~ "certutil.exe"\n| where ProcessCommandLine has_any ("-urlcache", "-f http", "-split", "-decode")\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine' },
  { id: "q12", name: "Beacon-like network traffic", tactic: "Command and Control", technique: "T1071.001 — Application Layer Protocol", kql: "DeviceNetworkEvents\n| where Timestamp > ago(24h)\n| where ActionType == \"ConnectionSuccess\"\n| where RemotePort in (80,443,8080,8443,53)\n| summarize Connections = count(), IntervalSecs = avg(datetime_diff('second', Timestamp, prev(Timestamp))) by RemoteIP, RemotePort, DeviceName\n| where Connections > 20 and IntervalSecs between (50 .. 70)  // ~60s beacon\n| order by Connections desc" },
  { id: "q13", name: "Unmanaged device on the network", tactic: "Discovery / Asset Visibility", technique: "N/A", kql: 'DeviceInfo\n| where Timestamp > ago(7d)\n| where OnboardingStatus != "Onboarded"\n| where DeviceCategory == "Workstation" or DeviceCategory == "Server"\n| summarize LastSeen = max(Timestamp), arg_max(Timestamp, *) by DeviceName\n| project DeviceName, OSPlatform, MachineGroup, JoinType, LastSeen' },
  { id: "q14", name: "Sign-in from impossible travel", tactic: "Credential Access", technique: "T1078 — Valid Accounts", kql: "AADSignInEventsBeta\n| where ResultType == 0\n| serialize\n| extend PrevIP = prev(IPAddress, 1), PrevCountry = prev(Location, 1), PrevTime = prev(Timestamp, 1)\n| where Country != PrevCountry and isnotempty(PrevCountry)\n| extend TravelHours = datetime_diff('hour', Timestamp, PrevTime)\n| where TravelHours < 4  // physically impossible" },
  { id: "q15", name: "New OAuth app consent (data theft via apps)", tactic: "Initial Access", technique: "T1528 — Application Access Token", kql: 'CloudAppEvents\n| where ActionType in ("Consent to application.", "Add app role assignment to service principal.")\n| extend AppDisplayName = tostring(parse_json(RawEventData).Target[0].ID)\n| project Timestamp, AccountObjectId, AppDisplayName, ActionType' },
  { id: "q16", name: "Kerberoasting — TGS-REQ flood", tactic: "Credential Access", technique: "T1558.003 — Kerberoasting", kql: 'IdentityLogonEvents\n| where ActionType == "TGS Request"\n| where Protocol == "Kerberos"\n| summarize Tgts = count(), SPNs = dcount(TargetDeviceName) by AccountUpn, bin(Timestamp, 5m)\n| where Tgts > 20 and SPNs > 5\n| order by Tgts desc' },
  { id: "q17", name: "DCSync — replication permission abuse", tactic: "Credential Access", technique: "T1003.006 — DCSync", kql: 'IdentityDirectoryEvents\n| where ActionType == "Directory Services replication"\n| where AccountObjectId !in ("krbtgt-objectid","domain-controller-objectids")\n| project Timestamp, AccountUpn, ActionType, AdditionalFields, TargetDeviceName' },
  { id: "q18", name: "BloodHound / SharpHound enumeration", tactic: "Discovery", technique: "T1087 — Account Discovery", kql: 'DeviceProcessEvents\n| where Timestamp > ago(7d)\n| where FileName in~ ("sharphound.exe","sharphound.ps1","azurehound.exe") or ProcessCommandLine has_any ("Invoke-BloodHound","Get-DomainComputer","Get-DomainUser","-CollectionMethod all")\n| project Timestamp, DeviceName, AccountName, FileName, ProcessCommandLine, InitiatingProcessFileName' },
  { id: "q19", name: "Suspicious LSASS access (Mimikatz-style)", tactic: "Credential Access", technique: "T1003.001 — LSASS Memory", kql: 'DeviceEvents\n| where ActionType == "OpenProcessApiCall"\n| where InitiatingProcessFolderPath !startswith "C:\\\\Windows\\\\System32\\\\"\n| where AdditionalFields has "lsass"\n| project Timestamp, DeviceName, InitiatingProcessFileName, InitiatingProcessCommandLine, InitiatingProcessFolderPath' },
  { id: "q20", name: "Cobalt Strike default named-pipe", tactic: "Command and Control", technique: "T1071", kql: 'DeviceEvents\n| where ActionType == "NamedPipeEvent"\n| extend Pipe = tostring(parse_json(AdditionalFields).PipeName)\n| where Pipe matches regex @"^\\\\\\\\.\\\\pipe\\\\(MSSE-\\d+-server|postex_|status_)"\n| project Timestamp, DeviceName, InitiatingProcessFileName, Pipe' },
  { id: "q21", name: "AAD token theft / replay", tactic: "Credential Access", technique: "T1539 — Steal Web Session Cookie", kql: 'AADSignInEventsBeta\n| where ResultType == 0\n| serialize\n| where AuthenticationDetails has "Previously satisfied"\n| extend PrevDevice = prev(DeviceTrustType, 1), PrevUA = prev(UserAgent, 1)\n| where UserAgent != PrevUA and IPAddress != prev(IPAddress, 1)\n| project Timestamp, AccountUpn, IPAddress, UserAgent, AuthenticationDetails' },
  { id: "q22", name: "Persistence via scheduled task", tactic: "Persistence", technique: "T1053.005 — Scheduled Task", kql: 'DeviceProcessEvents\n| where FileName =~ "schtasks.exe"\n| where ProcessCommandLine has_any ("/create","/change") and ProcessCommandLine has "/ru" and ProcessCommandLine has_any ("SYSTEM","HighestAvailable")\n| project Timestamp, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessFileName' },
  { id: "q23", name: "Ransomware behavior — mass file rename", tactic: "Impact", technique: "T1486 — Data Encrypted for Impact", kql: 'DeviceFileEvents\n| where ActionType == "FileRenamed"\n| summarize Renames = count(), Exts = dcount(FileName) by DeviceName, InitiatingProcessFileName, bin(Timestamp, 5m)\n| where Renames > 200\n| order by Renames desc' },
  { id: "q24", name: "Suspicious child of Office", tactic: "Initial Access / Execution", technique: "T1204.002 — Malicious File", kql: 'DeviceProcessEvents\n| where InitiatingProcessFileName in~ ("winword.exe","excel.exe","powerpnt.exe","outlook.exe")\n| where FileName in~ ("cmd.exe","powershell.exe","wscript.exe","cscript.exe","mshta.exe","rundll32.exe")\n| project Timestamp, DeviceName, AccountName, InitiatingProcessFileName, FileName, ProcessCommandLine' },
  { id: "q25", name: "Mass deletion in SharePoint / OneDrive", tactic: "Impact", technique: "T1485 — Data Destruction", kql: 'CloudAppEvents\n| where ActionType in ("FileDeleted","FileDeletedFirstStageRecycleBin","FileDeletedSecondStageRecycleBin")\n| summarize Deletes = count() by AccountDisplayName, bin(Timestamp, 10m)\n| where Deletes > 100\n| order by Deletes desc' },
];

const DETECTION_SUMMARY_CARDS: DefenderDetectionSummaryCard[] = [
  { name: "High-volume mailbox download", frequency: "1 hour", period: "24 hours", threshold: "> 1 GB downloaded per user per hour", severity: "Medium", mitre: "TA0010 — Exfiltration", state: "Active" },
  { name: "Lateral movement WMI", frequency: "15 min", period: "24 hours", threshold: "> 5 distinct target hosts per source per hour", severity: "High", mitre: "T1021.006", state: "Active" },
  { name: "Service account interactive logon", frequency: "15 min", period: "7 days", threshold: "svc-* account logs on interactively", severity: "High", mitre: "T1078", state: "Active" },
  { name: "Defender real-time protection disabled", frequency: "5 min", period: "1 day", threshold: "Any device where DisableRealtimeMonitoring = $true", severity: "High", mitre: "T1562.001", state: "Active" },
];

const HUNTING_SCHEMA: DefenderHuntingSchema = {
  DeviceEvents: "General telemetry — service install, registry, AMSI, named pipes, screenshots, scheduled tasks",
  DeviceProcessEvents: "Process creation events. Columns: Timestamp, DeviceName, FileName, FolderPath, SHA256, AccountName, ProcessCommandLine, InitiatingProcess*",
  DeviceNetworkEvents: "Network connections. Columns: Timestamp, DeviceName, RemoteIP, RemotePort, LocalIP, ActionType, InitiatingProcess*",
  DeviceFileEvents: "File creation, modification, rename. Columns: Timestamp, DeviceName, FileName, FolderPath, SHA256, ActionType",
  DeviceImageLoadEvents: "DLL/EXE module loads. Columns: Timestamp, DeviceName, FileName, SHA256, InitiatingProcess*",
  DeviceRegistryEvents: "Registry changes. Columns: Timestamp, DeviceName, RegistryKey, RegistryValueName, RegistryValueData, ActionType",
  DeviceLogonEvents: "Logons on devices. Columns: Timestamp, DeviceName, AccountName, LogonType, RemoteIP",
  DeviceInfo: "Asset metadata. Columns: DeviceName, OnboardingStatus, OSPlatform, OSVersion, MachineGroup, JoinType",
  EmailEvents: "Email delivered/blocked/quarantined. Columns: NetworkMessageId, Sender, Recipient, Subject, ThreatTypes, DeliveryAction",
  EmailUrlInfo: "URLs in emails. Columns: NetworkMessageId, Url, UrlDomain",
  EmailAttachmentInfo: "Attachments in emails. Columns: NetworkMessageId, FileName, SHA256, FileType",
  EmailPostDeliveryEvents: "Post-delivery (ZAP, manual delete). Columns: NetworkMessageId, Action, Reason",
  CloudAppEvents: "Microsoft 365 + Azure activity. Columns: Timestamp, ActionType, AccountObjectId, RawEventData, IPAddress",
  IdentityLogonEvents: "Logon events from on-prem AD (MDI) + Entra ID. Columns: Timestamp, AccountUpn, LogonType, IPAddress",
  IdentityDirectoryEvents: "Directory mutations (user/group/role). Columns: Timestamp, ActionType, AccountUpn, TargetAccountUpn",
  AADSignInEventsBeta: "Entra ID sign-in logs. Columns: Timestamp, AccountUpn, ResultType, Country, IPAddress, Application",
  AlertEvidence: "All entities (file, process, IP, user, URL, registry) involved in an alert",
  AlertInfo: "Alert metadata. Columns: AlertId, Title, Severity, Category, MitreTechniques",
};

const SCHEDULED_HUNTS: DefenderScheduledHunt[] = [
  { name: "Daily admin logon report", schedule: "0 8 * * *", lastRun: "2 hours ago", lastResult: "3 logons", owner: "secops@corp" },
  { name: "Weekly LolBin survey", schedule: "0 9 * * 1", lastRun: "4 days ago", lastResult: "27 hits across 12 devices", owner: "blueteam@corp" },
  { name: "Hourly OAuth consent", schedule: "0 * * * *", lastRun: "34 min ago", lastResult: "0 new consents", owner: "identity@corp" },
];

// ===== Custom detection rules (7, ported verbatim + wizard fields added) =====

function buildCustomDetectionRules(): DefenderCustomDetectionRule[] {
  return [
    {
      id: "cdr-001",
      name: "Suspicious LSASS access by non-Microsoft process",
      severity: "High",
      status: "Active",
      frequency: "Continuous (NRT)",
      lastRun: "2 min ago",
      lastResult: "3 alerts in 24h",
      entities: "Device, File, Process",
      mitre: "T1003.001 - LSASS Memory",
      kql: 'DeviceProcessEvents\n| where InitiatingProcessFolderPath !startswith "C:\\\\Windows\\\\"\n| where InitiatingProcessFolderPath !startswith "C:\\\\Program Files\\\\Microsoft"\n| join (DeviceProcessEvents\n    | where FileName == "lsass.exe"\n) on DeviceId, ProcessId\n| project Timestamp, DeviceName, InitiatingProcessFileName, InitiatingProcessCommandLine',
      actions: ["Isolate device", "Run AV scan", "Collect investigation package"],
      alertTitle: "Suspicious LSASS access by non-Microsoft process",
      alertCategory: "CredentialAccess",
      alertDescription: "A non-Microsoft-signed process opened a handle to lsass.exe, consistent with credential-dumping tools such as Mimikatz.",
      recommendedActions: "Isolate the device, collect an investigation package, and rotate credentials for any accounts active on the host at the time of access.",
      scope: "All devices",
      deviceGroups: [],
    },
    {
      id: "cdr-002",
      name: "Excessive Entra ID risky sign-ins followed by mailbox rule creation",
      severity: "High",
      status: "Active",
      frequency: "Every hour",
      lastRun: "14 min ago",
      lastResult: "0 alerts in 24h",
      entities: "User, IP, Mailbox",
      mitre: "T1078.004 - Cloud Accounts | T1564.008 - Email Hiding Rules",
      kql: 'let riskyUsers = AADSignInEventsBeta\n  | where RiskLevelDuringSignIn in ("high", "medium")\n  | where Timestamp > ago(1h)\n  | distinct AccountUpn;\nCloudAppEvents\n| where ActionType == "New-InboxRule"\n| where AccountObjectId in (riskyUsers)\n| project Timestamp, AccountUpn, ActionType, RawEventData',
      actions: ["Mark user as compromised", "Disable Outlook web access", "Force MFA re-registration"],
      alertTitle: "Risky sign-in followed by suspicious inbox rule creation",
      alertCategory: "InitialAccess",
      alertDescription: "A user who signed in during a high/medium risk session created a new inbox rule, a common post-compromise technique to hide evidence of BEC fraud.",
      recommendedActions: "Mark the user as compromised, force MFA re-registration, and review the new inbox rule for external forwarding.",
      scope: "All devices",
      deviceGroups: [],
    },
    {
      id: "cdr-003",
      name: "Mass file rename indicator (ransomware staging)",
      severity: "High",
      status: "Active",
      frequency: "Every 15 min",
      lastRun: "6 min ago",
      lastResult: "1 alert in 24h",
      entities: "Device, User, File",
      mitre: "T1486 - Data Encrypted for Impact",
      kql: 'DeviceFileEvents\n| where ActionType == "FileRenamed"\n| where Timestamp > ago(15m)\n| summarize FileCount = dcount(FileName) by DeviceId, DeviceName, InitiatingProcessAccountName, bin(Timestamp, 5m)\n| where FileCount > 250',
      actions: ["Isolate device", "Block initiating process hash globally", "Open IR ticket (PagerDuty)"],
      alertTitle: "Mass file rename — possible ransomware staging",
      alertCategory: "Impact",
      alertDescription: "A device recorded over 250 file renames in a 5-minute window by a single process, a signature of ransomware encrypting files in bulk.",
      recommendedActions: "Immediately isolate the device, block the initiating process hash tenant-wide, and open an incident-response ticket.",
      scope: "All devices",
      deviceGroups: [],
    },
    {
      id: "cdr-004",
      name: "PowerShell with encoded command + outbound to rare TLD",
      severity: "Medium",
      status: "Active",
      frequency: "Every 30 min",
      lastRun: "11 min ago",
      lastResult: "8 alerts in 24h (mostly FPs from admins)",
      entities: "Device, Process, Network",
      mitre: "T1059.001 - PowerShell | T1027 - Obfuscated Files",
      kql: 'DeviceProcessEvents\n| where FileName == "powershell.exe"\n| where ProcessCommandLine matches regex @"-[eE](nc(odedCommand)?)?\\s+[A-Za-z0-9+/=]{30,}"\n| join (\n  DeviceNetworkEvents\n  | where RemoteUrl matches regex @"\\.(tk|ml|ga|cf|gq|xyz|top)(/|$)"\n) on DeviceId\n| project Timestamp, DeviceName, ProcessCommandLine, RemoteUrl',
      actions: ["Generate alert only"],
      alertTitle: "Encoded PowerShell with outbound connection to rare TLD",
      alertCategory: "DefenseEvasion",
      alertDescription: "A PowerShell process was launched with a base64-encoded command and subsequently connected to a domain in a rare/free TLD often used for C2 infrastructure.",
      recommendedActions: "Review the decoded command line, confirm business justification with the account owner, and block the destination domain if unapproved.",
      scope: "All devices",
      deviceGroups: [],
    },
    {
      id: "cdr-005",
      name: "Token theft - device anomaly with refresh token replay",
      severity: "High",
      status: "Active",
      frequency: "Every hour",
      lastRun: "23 min ago",
      lastResult: "0 alerts (24h)",
      entities: "User, IP, Device",
      mitre: "T1528 - Steal Application Access Token | T1550.001 - Application Access Token",
      kql: 'AADSignInEventsBeta\n| where DeviceTrustType == ""\n| where AuthenticationDetails has "primaryRefreshToken"\n| where Country != "United States"\n| join (AADSignInEventsBeta\n  | where Timestamp > ago(2h) and DeviceTrustType == "Compliant"\n  | distinct AccountUpn\n) on AccountUpn',
      actions: ["Revoke all sessions", "Mark user as compromised", "Force device re-registration"],
      alertTitle: "Refresh token replayed from untrusted device / unusual geography",
      alertCategory: "CredentialAccess",
      alertDescription: "A primary refresh token issued to a compliant, trusted device was replayed from an untrusted device or an unusual country shortly afterward — consistent with token theft (pass-the-cookie / AiTM).",
      recommendedActions: "Revoke all refresh/access tokens for the user, force re-registration of devices, and require re-authentication with MFA.",
      scope: "All devices",
      deviceGroups: [],
    },
    {
      id: "cdr-006",
      name: "Service principal credential added to high-privilege app",
      severity: "High",
      status: "Active",
      frequency: "Continuous (NRT)",
      lastRun: "40 sec ago",
      lastResult: "0 alerts (24h)",
      entities: "User, Application",
      mitre: "T1098.001 - Account Manipulation: Additional Cloud Credentials",
      kql: 'CloudAppEvents\n| where ActionType == "Add service principal credentials."\n| where RawEventData contains "GraphAPI.ReadWrite.All"\n   or RawEventData contains "Directory.ReadWrite.All"\n   or RawEventData contains "Application.ReadWrite.All"',
      actions: ["Email SOC tier-2 + IT-Sec leads", "Open incident with auto-investigation"],
      alertTitle: "New credential added to high-privilege service principal",
      alertCategory: "PrivilegeEscalation",
      alertDescription: "A new client secret or certificate was added to a service principal holding tenant-wide Graph write permissions, which could allow silent, long-lived backdoor access.",
      recommendedActions: "Verify the credential addition with the app owner, revoke it if unauthorized, and audit the application's permission grants.",
      scope: "All devices",
      deviceGroups: [],
    },
    {
      id: "cdr-007",
      name: "Unusual mailbox access pattern - mass forwarding rule creation",
      severity: "Medium",
      status: "Disabled",
      frequency: "Every 6 hours",
      lastRun: "4 hours ago",
      lastResult: "-",
      entities: "User, Mailbox",
      mitre: "T1114.003 - Email Forwarding Rule",
      kql: 'CloudAppEvents\n| where ActionType == "New-InboxRule"\n| where RawEventData contains "ForwardTo"\n  and RawEventData has_any (".ru", ".cn", "outlook.live.com", "gmail.com", "yandex")',
      actions: ["Disable rule", "Email user manager + SOC"],
      alertTitle: "Mailbox forwarding rule created to free/foreign webmail",
      alertCategory: "Exfiltration",
      alertDescription: "An inbox rule was created that forwards mail to a free or foreign webmail domain, a common BEC exfiltration and reconnaissance technique.",
      recommendedActions: "Disable the forwarding rule, notify the user's manager and SOC, and verify whether the mailbox shows other signs of compromise.",
      scope: "Specific device groups",
      deviceGroups: ["Finance workstations", "Executive workstations"],
    },
  ];
}

// ===== Endpoints: asset inventory (unmanaged/IoT/network devices) =====

function buildAssets(): DefenderAsset[] {
  return [
    { id: "ast-1", name: "PRINTER-FLR2", type: "Network device", vendor: "HP", ipAddress: "10.0.3.40", category: "Printer", onboarded: false, discoveredOn: dateOffset(21) },
    { id: "ast-2", name: "CAMERA-LOBBY", type: "IoT device", vendor: "Axis Communications", ipAddress: "10.0.5.21", category: "IoT", onboarded: false, discoveredOn: dateOffset(14) },
    { id: "ast-3", name: "ROUTER-CORE", type: "Network device", vendor: "Cisco", ipAddress: "10.0.0.1", category: "Network device", onboarded: true, discoveredOn: dateOffset(365) },
    { id: "ast-4", name: "UNMANAGED-DESK-12", type: "Unmanaged endpoint", vendor: "Dell", ipAddress: "10.0.3.62", category: "Workstation", onboarded: false, discoveredOn: dateOffset(5) },
    { id: "ast-5", name: "SWITCH-FLR3", type: "Network device", vendor: "HPE Aruba", ipAddress: "10.0.3.2", category: "Network device", onboarded: true, discoveredOn: dateOffset(180) },
    { id: "ast-6", name: "NAS-BACKUP", type: "Network device", vendor: "Synology", ipAddress: "10.0.2.50", category: "Storage", onboarded: false, discoveredOn: dateOffset(60) },
    { id: "ast-7", name: "IOT-TEMP-SENSOR-7", type: "IoT device", vendor: "Honeywell", ipAddress: "10.0.5.78", category: "IoT", onboarded: false, discoveredOn: dateOffset(30) },
    { id: "ast-8", name: "UNMANAGED-LAPTOP-3", type: "Unmanaged endpoint", vendor: "Apple", ipAddress: "10.0.3.81", category: "Workstation", onboarded: false, discoveredOn: dateOffset(2) },
  ];
}

// ===== Identities / ITDR =====

function buildPostureFindings(): DefenderPostureFinding[] {
  return [
    { id: "pa-1", area: "Identity hygiene", severity: "High", title: "Accounts with passwords set to never expire", affected: "48 users", recommendation: "Disable PasswordNeverExpires on standard accounts. Use MFA + CA to compensate. For service accounts, use gMSA where possible.", status: "Open" },
    { id: "pa-2", area: "Identity hygiene", severity: "Critical", title: "Domain Controllers running unsupported Windows Server", affected: "2 DCs (2012 R2)", recommendation: "Upgrade DC01 + DC03 to Windows Server 2022 or 2025. Out-of-support OS = no security patches for Kerberos / SAM / netlogon.", status: "Open" },
    { id: "pa-3", area: "Privileged access", severity: "Critical", title: "krbtgt password not rotated in over 180 days", affected: "1 forest", recommendation: "Use Microsoft KRBTGT reset script. Reset twice with at least 10 hours between resets. Critical mitigation against Golden Ticket persistence.", status: "Open" },
    { id: "pa-4", area: "Privileged access", severity: "High", title: "Unconstrained Kerberos delegation on non-DC servers", affected: "7 servers", recommendation: 'Remove "Trust this computer for delegation to any service" on DC, file, SQL servers. Replace with Resource-Based Constrained Delegation where needed.', status: "Open" },
    { id: "pa-5", area: "Privileged access", severity: "High", title: "Stale members of Domain Admins / Enterprise Admins", affected: "12 of 18 members", recommendation: "Remove members who have not logged in for 90+ days. Move daily-use admins to PIM eligible (JIT) instead of permanent. Target: <5 standing Domain Admins.", status: "Open" },
    { id: "pa-6", area: "Authentication", severity: "High", title: "NTLM v1 authentication still allowed", affected: "Forest-wide", recommendation: "Audit with Network Security: Restrict NTLM in audit mode for 30 days. Block NTLMv1 + Send NTLMv2 only. Track legacy apps separately for migration.", status: "In progress" },
    { id: "pa-7", area: "Authentication", severity: "Medium", title: "LDAP signing not required on domain controllers", affected: "5 of 6 DCs", recommendation: 'Set "Domain controller: LDAP server signing requirements" GPO to Require signing. Apply LDAP channel binding too. Audit clients via Event 2887 first.', status: "Open" },
    { id: "pa-8", area: "Authentication", severity: "Medium", title: "Print Spooler service running on Domain Controllers", affected: "6 DCs", recommendation: "PrintNightmare attack surface. Disable Spooler service on every DC. Block via GPO + monitor with: Get-Service Spooler.", status: "Open" },
    { id: "pa-9", area: "Lateral movement", severity: "Critical", title: "Lateral movement path exposed Tier-0 in 3 hops", affected: "1 sensitive account", recommendation: "Helpdesk-Eng has Local Admin on a Dev workstation that Domain Admin uses for daily work. Investigate the chain in Lateral Movement Paths tab.", status: "Open" },
    { id: "pa-10", area: "Lateral movement", severity: "High", title: "AdminCount=1 leftover on non-privileged accounts", affected: "42 users", recommendation: "When users are removed from Tier-0 groups, AdminCount stays 1. Inheritance is broken. Reset adminCount + restore inheritance with: Set-ADUser -Clear AdminCount.", status: "Open" },
    { id: "pa-11", area: "Network exposure", severity: "High", title: "SMBv1 still enabled on Domain Controllers", affected: "6 DCs", recommendation: "WannaCry / NotPetya attack surface. Run Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol on every DC + audit clients with Get-SmbServerConfiguration.", status: "Open" },
    { id: "pa-12", area: "Network exposure", severity: "Medium", title: "IPv6 not configured but link-local active", affected: "Most clients", recommendation: "Enable IPv6 properly or fully disable per Microsoft guidance. Don't leave link-local enabled — attacker via mitm6 can spoof DNS.", status: "Open" },
    { id: "pa-13", area: "Data exposure", severity: "High", title: "LSA secrets exposed via WDigest on legacy hosts", affected: "14 workstations", recommendation: "Apply registry setting HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest\\UseLogonCredential = 0 via GPO. Patch KB2871997 if pre-Win10.", status: "Open" },
    { id: "pa-14", area: "Data exposure", severity: "High", title: "SPNs registered on user accounts (Kerberoastable)", affected: "8 user accounts", recommendation: "Move SPN to a gMSA. If unavoidable on a user, set password complexity 25+ chars random. Monitor for TGS RC4 requests as detection.", status: "Open" },
    { id: "pa-15", area: "Detection coverage", severity: "Medium", title: "Defender for Identity sensor not on every DC", affected: "1 DC missing", recommendation: "DC03 has no sensor. Install via Defender for Identity portal. Wait 24h for baseline behaviour learning before alerts fire.", status: "Open" },
  ];
}

function buildLateralMovementPaths(): DefenderLateralMovementPath[] {
  return [
    {
      id: "lmp-1",
      target: "ITBD Technical Lab\\Domain Admins",
      riskScore: 95,
      hops: 3,
      description: "Helpdesk-Eng group has Local Admin on PC-FIN-014. Domain Admin Priya signed into PC-FIN-014 last week. Lab + creds chain.",
      path: [
        { type: "group", name: "Helpdesk-Eng", icon: "group", detail: "Has Local Admin on 142 workstations" },
        { type: "host", name: "PC-FIN-014", icon: "host", detail: "Domain Admin login 3 days ago" },
        { type: "creds", name: "Cached credentials", icon: "cred", detail: "LSASS dump exposes priya.s@cloudlab.in" },
        { type: "user", name: "priya.s@cloudlab.in", icon: "user", detail: "Member of Domain Admins (standing)" },
      ],
    },
    {
      id: "lmp-2",
      target: "ITBD Technical Lab\\Enterprise Admins",
      riskScore: 82,
      hops: 4,
      description: "SCCM service account has SeDebugPrivilege + ran on a host that had Tier-0 admin RDP. CredentialGuard not on.",
      path: [
        { type: "group", name: "IT-SCCM-Engineers", icon: "group", detail: "Indirect Local Admin via service ACL" },
        { type: "host", name: "PC-IT-021", icon: "host", detail: "SCCM agent runs as svc-sccm$" },
        { type: "creds", name: "svc-sccm$", icon: "cred", detail: "TGT cached; password rotates 365d" },
        { type: "host", name: "JUMP-SCCM-01", icon: "host", detail: "svc-sccm has remote desktop" },
        { type: "user", name: "manish.t@cloudlab.in", icon: "user", detail: "Enterprise Admin signed in 5 days ago" },
      ],
    },
    {
      id: "lmp-3",
      target: "ITBD Technical Lab\\Schema Admins",
      riskScore: 71,
      hops: 2,
      description: "Domain Admin priya.s has RBAC delegation on a build server reachable from any developer workstation.",
      path: [
        { type: "host", name: "BUILD-DEV-01", icon: "host", detail: "Open RDP to 4 developer hosts" },
        { type: "creds", name: "admin TGT", icon: "cred", detail: "Last logon 2 days ago" },
        { type: "user", name: "priya.s@cloudlab.in", icon: "user", detail: "Schema Admin member" },
      ],
    },
  ];
}

function buildSensitiveAccounts(): DefenderSensitiveAccount[] {
  return [
    { upn: "admin@itbd.net", tier: "Tier-0", role: "Global Admin", lastSignIn: "2 hr ago", mfaMethods: "FIDO2, Authenticator", riskLevel: "None" },
    { upn: "priya.s@cloudlab.in", tier: "Tier-0", role: "Domain Admin", lastSignIn: "4 hr ago", mfaMethods: "Authenticator push", riskLevel: "Medium" },
    { upn: "manish.t@cloudlab.in", tier: "Tier-0", role: "Enterprise Admin", lastSignIn: "1 day ago", mfaMethods: "Authenticator push", riskLevel: "Low" },
    { upn: "svc-adfs$@cloudlab.in", tier: "Tier-0", role: "ADFS service account", lastSignIn: "continuous", mfaMethods: "Cert-based", riskLevel: "None" },
    { upn: "svc-azure-connect$@cloudlab.in", tier: "Tier-0", role: "AAD Connect", lastSignIn: "continuous", mfaMethods: "Cert-based", riskLevel: "None" },
    { upn: "rohit@cloudlab.in", tier: "Tier-1", role: "Exchange Admin", lastSignIn: "6 hr ago", mfaMethods: "Authenticator push", riskLevel: "None" },
    { upn: "sneha@cloudlab.in", tier: "Tier-1", role: "SharePoint Admin", lastSignIn: "1 day ago", mfaMethods: "Authenticator + SMS", riskLevel: "Low" },
    { upn: "vikram@cloudlab.in", tier: "Tier-1", role: "Security Operator", lastSignIn: "2 hr ago", mfaMethods: "FIDO2", riskLevel: "None" },
    { upn: "rahul@cloudlab.in", tier: "Tier-2", role: "Helpdesk", lastSignIn: "30 min ago", mfaMethods: "SMS only", riskLevel: "Medium" },
    { upn: "anjali@cloudlab.in", tier: "Tier-2", role: "User Admin (limited)", lastSignIn: "4 hr ago", mfaMethods: "Authenticator push", riskLevel: "None" },
  ];
}

function buildHoneyTokens(): DefenderHoneyToken[] {
  return [
    { id: "honey-svc-finance", name: "svc-honey-finance", type: "User", created: "2025-11-04", triggers: 0, lastTrigger: "never", placedIn: "OU=Finance" },
    { id: "honey-backup-admin-prod", name: "backup-admin-prod", type: "User", created: "2025-09-22", triggers: 2, lastTrigger: "2026-03-14", placedIn: "OU=IT, set as Domain Admins member (decoy)" },
    { id: "honey-gold-guest-list", name: "GoldGuestList", type: "Document", created: "2025-12-01", triggers: 1, lastTrigger: "2026-02-18", placedIn: "SharePoint > Executive > Confidential" },
    { id: "honey-sap-credentials", name: "SAP-credentials.kdbx", type: "Document", created: "2026-01-15", triggers: 0, lastTrigger: "never", placedIn: "File share \\\\fs01\\IT$" },
  ];
}

// ===== Cloud Apps =====

function buildDiscoveredApps(): DefenderDiscoveredApp[] {
  return [
    { name: "Microsoft 365", cat: "Productivity", users: 1248, trafficMB: 92480, risk: 1, tag: "Sanctioned", publisherVerified: true, compliance: "SOC 2, ISO 27001, HIPAA, GDPR" },
    { name: "Salesforce", cat: "CRM", users: 184, trafficMB: 8420, risk: 2, tag: "Sanctioned", publisherVerified: true, compliance: "SOC 2, ISO 27001, GDPR" },
    { name: "ServiceNow", cat: "ITSM", users: 142, trafficMB: 4218, risk: 2, tag: "Sanctioned", publisherVerified: true, compliance: "SOC 2, FedRAMP" },
    { name: "Slack", cat: "Collaboration", users: 824, trafficMB: 12480, risk: 3, tag: "Monitored", publisherVerified: true, compliance: "SOC 2" },
    { name: "Dropbox", cat: "Cloud storage", users: 42, trafficMB: 1830, risk: 6, tag: "Monitored", publisherVerified: true, compliance: "SOC 2" },
    { name: "WeTransfer", cat: "File sharing", users: 18, trafficMB: 620, risk: 8, tag: "Unsanctioned", publisherVerified: false, compliance: "None publicly documented" },
    { name: "Google Drive", cat: "Cloud storage", users: 9, trafficMB: 340, risk: 7, tag: "Monitored", publisherVerified: true, compliance: "SOC 2, ISO 27001" },
    { name: "Box", cat: "Cloud storage", users: 3, trafficMB: 120, risk: 4, tag: "Sanctioned", publisherVerified: true, compliance: "SOC 2, FedRAMP" },
    { name: "Notion", cat: "Productivity", users: 21, trafficMB: 880, risk: 5, tag: "Monitored", publisherVerified: true, compliance: "SOC 2" },
    { name: "Telegram Web", cat: "Messaging", users: 14, trafficMB: 280, risk: 9, tag: "Unsanctioned", publisherVerified: false, compliance: "None" },
    { name: "AnyDesk", cat: "Remote access", users: 4, trafficMB: 41, risk: 9, tag: "Block", publisherVerified: true, compliance: "SOC 2" },
    { name: "Ngrok", cat: "Tunneling", users: 2, trafficMB: 18, risk: 9, tag: "Block", publisherVerified: true, compliance: "SOC 2" },
    { name: "OpenAI ChatGPT", cat: "AI", users: 218, trafficMB: 3420, risk: 6, tag: "Monitored", publisherVerified: true, compliance: "SOC 2" },
    { name: "Anthropic Claude", cat: "AI", users: 142, trafficMB: 2180, risk: 4, tag: "Sanctioned", publisherVerified: true, compliance: "SOC 2, ISO 42001" },
    { name: "Asana", cat: "Project mgmt", users: 84, trafficMB: 1820, risk: 3, tag: "Sanctioned", publisherVerified: true, compliance: "SOC 2" },
  ];
}

function buildOAuthApps(): DefenderOAuthApp[] {
  return [
    {
      id: "app-pinpoint",
      name: "Pinpoint Notes",
      publisher: "Unverified publisher (3rdpartynotes-ltd.com)",
      publisherVerified: false,
      consentType: "User consent (12 users)",
      permissions: ["Mail.ReadWrite — All mailboxes", "Mail.Send — Send mail as user", "User.Read — User profile", "Files.Read.All — All SharePoint files"],
      permissionTier: "High risk",
      consentedDate: "2026-04-22",
      firstUser: "rohit@cloudlab.in",
      risk: 9,
      verdict: "Investigate",
      note: "Permissions inconsistent with stated purpose (note-taking app should not need Mail.Send). Publisher unverified.",
    },
    {
      id: "app-calendly",
      name: "Calendly",
      publisher: "Calendly LLC (verified)",
      publisherVerified: true,
      consentType: "Admin consent (tenant-wide)",
      permissions: ["Calendars.ReadWrite", "User.Read.All", "OnlineMeetings.Read"],
      permissionTier: "Medium",
      consentedDate: "2025-12-10",
      firstUser: "admin@itbd.net (admin consent)",
      risk: 2,
      verdict: "Approved",
      note: "Standard calendaring app. Verified publisher. Permissions match purpose.",
    },
    {
      id: "app-onedrive-reporter",
      name: "OneDrive Reporter",
      publisher: "Reportr Inc (verified)",
      publisherVerified: true,
      consentType: "Admin consent",
      permissions: ["Sites.Read.All", "Files.Read.All", "AuditLog.Read.All"],
      permissionTier: "High",
      consentedDate: "2025-09-30",
      firstUser: "admin@itbd.net (admin consent)",
      risk: 3,
      verdict: "Approved",
      note: "Read-only across SharePoint + Files. Used for governance reports. Periodic review every 6 months.",
    },
    {
      id: "app-mailtrack",
      name: "MailTrack",
      publisher: "Mailtrack Solutions (verified)",
      publisherVerified: true,
      consentType: "User consent (8 users)",
      permissions: ["Mail.ReadWrite", "Mail.Send"],
      permissionTier: "High",
      consentedDate: "2026-02-14",
      firstUser: "sneha@cloudlab.in",
      risk: 7,
      verdict: "Block",
      note: "Email-tracking pixel app. User consent of Mail.ReadWrite is too permissive. Block tenant-wide and remove consent.",
    },
    {
      id: "app-zoom",
      name: "Zoom",
      publisher: "Zoom Video Communications (verified)",
      publisherVerified: true,
      consentType: "Admin consent",
      permissions: ["OnlineMeetings.ReadWrite.All", "User.Read", "Calendars.ReadWrite"],
      permissionTier: "Medium",
      consentedDate: "2025-08-12",
      firstUser: "admin@itbd.net (admin consent)",
      risk: 2,
      verdict: "Approved",
      note: "Verified publisher. Standard meeting integration. Review at next audit cycle.",
    },
    {
      id: "app-suspicious-grant",
      name: "O365 Manager Pro",
      publisher: "cloud-mgmt-365.com (unverified)",
      publisherVerified: false,
      consentType: "User consent (1 user — Anjali Mehta)",
      permissions: ["Directory.ReadWrite.All", "Mail.Send", "Files.ReadWrite.All", "offline_access"],
      permissionTier: "Critical",
      consentedDate: "2026-05-14",
      firstUser: "anjali@cloudlab.in",
      risk: 10,
      verdict: "Investigate",
      note: "*** Likely consent-phishing attack ***. Permissions far exceed any legit use. Single victim user. Imminent action: revoke consent + reset password + check inbox rules + investigate phishing email.",
    },
    {
      id: "app-slack",
      name: "Slack",
      publisher: "Slack Technologies LLC (verified)",
      publisherVerified: true,
      consentType: "Admin consent",
      permissions: ["User.Read", "Calendars.Read", "Sites.Read.All"],
      permissionTier: "Low",
      consentedDate: "2025-05-08",
      firstUser: "admin@itbd.net (admin consent)",
      risk: 1,
      verdict: "Approved",
      note: "Minimal scope. Verified publisher. Standard collab integration.",
    },
  ];
}

function buildConnectors(): DefenderConnector[] {
  return [
    { name: "Microsoft 365", status: "Connected", authMode: "OAuth admin consent", lastSync: "just now", scopes: "AuditLog.Read.All + Files.Read.All + Calendars.Read.All" },
    { name: "Salesforce", status: "Connected", authMode: "OAuth admin consent", lastSync: "2 min ago", scopes: "api + refresh_token" },
    { name: "ServiceNow", status: "Connected", authMode: "Basic + API key", lastSync: "14 min ago", scopes: "admin" },
    { name: "AWS", status: "Connected", authMode: "CloudTrail + S3", lastSync: "1 min ago", scopes: "cross-account role" },
    { name: "GCP", status: "Connected", authMode: "Cloud Audit + PubSub", lastSync: "3 min ago", scopes: "Workload Identity Federation" },
    { name: "Box", status: "Disconnected", authMode: "OAuth (token expired)", lastSync: "4 days ago", scopes: "admin" },
    { name: "GitHub Enterprise", status: "Connected", authMode: "GitHub App", lastSync: "8 min ago", scopes: "audit log + repo metadata" },
  ];
}

function buildSessionPolicies(): DefenderSessionPolicy[] {
  return [
    { id: "sp-block-download-unmanaged", name: "Block download from unmanaged devices", state: "Active", appliesTo: "Salesforce + Box + Dropbox", signals: "Device not compliant + Unmanaged", action: "Block download" },
    { id: "sp-watermark-external", name: "Watermark sensitive docs externally", state: "Active", appliesTo: "M365 + SharePoint", signals: "External user", action: "Apply watermark with UPN" },
    { id: "sp-block-ai-finance", name: "Block AI tools for finance users", state: "Report-only", appliesTo: "ChatGPT + Claude", signals: "Group: Finance", action: "Block upload + warn" },
    { id: "sp-mfa-high-value-saas", name: "MFA required for high-value SaaS", state: "Active", appliesTo: "Salesforce + ServiceNow", signals: "Risky sign-in OR new country", action: "Require MFA" },
  ];
}

// ===== Email policies =====

function buildAntiPhishPolicies(): DefenderAntiPhishPolicy[] {
  return [
    {
      name: "Office365 AntiPhish Default (Default)",
      priority: "Lowest",
      status: "On (default)",
      users: "Tenant-wide fallback",
      settings: {
        phishingThreshold: "Standard (1)",
        impersonationProtection: { userImpersonationProtection: "Off", domainImpersonationProtection: "Off", trustedSenders: 0, trustedDomains: 0 },
        mailboxIntelligence: "On",
        spoofIntelligence: "On",
        honorDmarcPolicy: "On",
        actions: {
          onUserImpersonation: "-",
          onDomainImpersonation: "-",
          onMailboxIntelligence: "Move message to recipient Junk folder",
          onSpoof: "Move message to recipient Junk folder",
          onDmarcReject: "Quarantine",
        },
      },
    },
    {
      name: "Anti-phish - Strict (executives)",
      priority: 0,
      status: "On",
      users: "Executives + Finance VPs (42 users)",
      settings: {
        phishingThreshold: "Most aggressive (4)",
        impersonationProtection: {
          userImpersonationProtection: "On",
          domainImpersonationProtection: "On",
          trustedSenders: 12,
          trustedDomains: 8,
          protectedUsers: ["ceo@contoso.com", "cfo@contoso.com", "cio@contoso.com", "... +12 VPs"],
        },
        mailboxIntelligence: "On - aggressive",
        spoofIntelligence: "On",
        honorDmarcPolicy: "On",
        actions: {
          onUserImpersonation: "Quarantine",
          onDomainImpersonation: "Quarantine",
          onMailboxIntelligence: "Quarantine",
          onSpoof: "Quarantine",
          onDmarcReject: "Quarantine",
        },
      },
    },
    {
      name: "Anti-phish - Standard (all users)",
      priority: 1,
      status: "On",
      users: "All users",
      settings: {
        phishingThreshold: "Aggressive (3)",
        impersonationProtection: {
          userImpersonationProtection: "On",
          domainImpersonationProtection: "On",
          trustedSenders: 12,
          trustedDomains: 8,
          protectedUsers: ["ceo@contoso.com", "cfo@contoso.com"],
        },
        mailboxIntelligence: "On",
        spoofIntelligence: "On",
        honorDmarcPolicy: "On",
        actions: {
          onUserImpersonation: "Move to Junk",
          onDomainImpersonation: "Quarantine",
          onMailboxIntelligence: "Move to Junk",
          onSpoof: "Move to Junk",
          onDmarcReject: "Quarantine",
        },
      },
    },
  ];
}

function buildAntiMalwarePolicies(): DefenderAntiMalwarePolicy[] {
  return [
    { name: "Default (lowest priority)", priority: "Lowest", status: "On", users: "Tenant-wide fallback", commonAttachmentFilter: "Off", zeroHourAutoPurge: "On for malware", notify: "Internal sender only" },
    { name: "Anti-malware - Standard", priority: 0, status: "On", users: "All users", commonAttachmentFilter: "On (44 file types: ace, ani, app, docm, exe, jar, msc, msh, ps1, py, ...)", zeroHourAutoPurge: "On for malware + phish", notify: "Internal + external senders + admin" },
  ];
}

const BLOCKED_FILE_EXTENSIONS = [
  "ace", "ani", "app", "apk", "appx", "arj", "asp", "aspx", "bat", "cab",
  "cer", "chm", "cmd", "com", "cpl", "crt", "der", "dll", "docm", "dot",
  "dotm", "exe", "gz", "hlp", "hta", "htm", "html", "ins", "iso", "jar",
  "jnlp", "js", "jse", "lnk", "mht", "msc", "msh", "msi", "msp", "pdb",
  "pdf (with embedded macros)", "pif", "pl", "ppam", "ppsm", "pptm", "ps1",
  "psc1", "psd1", "psm1", "py", "rar", "reg", "scr", "sct", "shs", "svg (rare)",
  "tar", "url", "vbe", "vbs", "vhd", "wim", "ws", "wsf", "xlam", "xll",
  "xlsm", "xlt", "xltm", "xnk", "zip", "7z",
];

function buildAntiSpamPolicies(): DefenderAntiSpamPolicy[] {
  const inbound1: DefenderAntiSpamPolicy = {
    kind: "Inbound",
    name: "Anti-spam inbound policy (Default)",
    priority: "Lowest",
    users: "All users",
    bulkThreshold: 7,
    spamAction: "Move to Junk",
    highConfidenceSpamAction: "Quarantine",
    phishAction: "Quarantine",
    highConfidencePhishAction: "Quarantine",
    bulkAction: "Move to Junk",
    retentionDays: 30,
  };
  const inbound2: DefenderAntiSpamPolicy = {
    kind: "Inbound",
    name: "Anti-spam inbound - Strict (Finance)",
    priority: 0,
    users: "Finance + HR (820 users)",
    bulkThreshold: 4,
    spamAction: "Quarantine",
    highConfidenceSpamAction: "Quarantine",
    phishAction: "Quarantine",
    highConfidencePhishAction: "Quarantine",
    bulkAction: "Quarantine",
    retentionDays: 30,
  };
  const outbound: DefenderAntiSpamPolicy = {
    kind: "Outbound",
    name: "Anti-spam outbound policy (Default)",
    priority: "Lowest",
    users: "All users",
    externalRecipientsPerHour: 500,
    internalRecipientsPerHour: 1000,
    totalRecipientsPerDay: 10000,
    actionOnExceeded: "Restrict the user from sending mail",
    forwardingRulesEnabled: "Automatic - System controlled",
  };
  const connFilter: DefenderConnectionFilterPolicy = {
    kind: "ConnectionFilter",
    name: "Connection filter policy (Default)",
    priority: "N/A",
    users: "N/A",
    ipAllowList: ["203.0.113.0/24 (partner SMTP)", "198.51.100.4 (vendor)"],
    ipBlockList: ["185.220.0.0/16 (TOR exit)", "91.121.87.0/24 (botnet C2 - 2024)"],
    safeListEnabled: "Off",
  };
  return [inbound1, inbound2, outbound, connFilter];
}

function buildSafeAttachmentsPolicies(): DefenderSafeAttachmentsPolicy[] {
  return [
    {
      name: "Safe Attachments - Default",
      status: "On",
      users: "Tenant-wide",
      action: "Dynamic Delivery",
      redirectOnDetection: "Off",
      redirectEmail: "-",
      includeRecipients: "All",
      description: 'Open attachments in detonation sandbox before delivery. "Dynamic Delivery" lets user read email body while attachment scans (5-7 min usually).',
    },
    {
      name: "Safe Attachments - Block on Executives",
      status: "On",
      users: "Executives + Finance VPs",
      action: "Block",
      redirectOnDetection: "On",
      redirectEmail: "soc-quarantine@contoso.com",
      includeRecipients: "Executives + Finance VPs",
      description: "Block delivery entirely if malicious; SOC reviews from quarantine.",
    },
  ];
}

function buildSafeLinksPolicies(): DefenderSafeLinksPolicy[] {
  return [
    {
      name: "Safe Links - Default",
      status: "On",
      users: "Tenant-wide",
      urlRewriting: "On",
      scanWhileUserClicks: "On (block click-through wait)",
      applyToInternalMail: "On",
      doNotRewriteForOrgRecipients: "No (rewrite everything)",
      doNotTrackUserClicks: "Off",
      doNotAllowUserClickThrough: "On (block ignore)",
      urlAllowList: "corporate-portal.contoso.com, *.partner.com",
      description: "Real-time URL detonation. Blocks user from clicking through warning page on phishing URLs.",
    },
    {
      name: "Safe Links - Strict (Executives)",
      status: "On",
      users: "Executives + Finance VPs",
      urlRewriting: "On",
      scanWhileUserClicks: "On",
      applyToInternalMail: "On",
      doNotAllowUserClickThrough: "On (no override possible)",
      urlAllowList: "(empty - no exceptions)",
      description: "No click-through bypass possible — hardest profile.",
    },
  ];
}

function buildDkimDomains(): DefenderDkimDomain[] {
  return [
    { domain: "contoso.com", enabled: true, selectorRotated: "2026-03-15", nextRotation: "2026-09-15", keyLength: "2048-bit" },
    { domain: "contoso.in", enabled: true, selectorRotated: "2026-04-22", nextRotation: "2026-10-22", keyLength: "2048-bit" },
    { domain: "newdomain.contoso.io", enabled: false, selectorRotated: "-", nextRotation: "Set up needed", keyLength: "-" },
  ];
}

function buildQuarantinePolicyTypes(): DefenderQuarantinePolicyType[] {
  return [
    { name: "AdminOnlyAccessPolicy", userPermissions: "No access (admin only)", notification: "Off" },
    { name: "DefaultFullAccessPolicy", userPermissions: "View, Release, Delete, Block sender, Allow sender", notification: "Daily digest 09:00 IST" },
    { name: "DefaultFullAccessWithNotificationPolicy", userPermissions: "View, Release request, Delete, Block sender", notification: "Daily digest + per-message instant" },
    { name: "NotificationEnabledPolicy", userPermissions: "View, Release request", notification: "Daily digest 09:00 IST" },
  ];
}

// ===== Email extras: Tenant Allow/Block List + Quarantine =====

function buildTenantAllowBlock() {
  return {
    senders: [
      { id: "t-1", value: "newsletters@vendor-trusted.com", list: "Allow" as const, reason: "Marketing partner — pre-approved", expiresOn: "2026-08-12", addedBy: "soc1@cloudlab.in", addedOn: "2026-05-12" },
      { id: "t-2", value: "paypal-secure.tk", list: "Block" as const, reason: "Confirmed phishing kit", expiresOn: "Never", addedBy: "soc2@cloudlab.in", addedOn: "2026-05-18" },
      { id: "t-3", value: "*.gambling.example", list: "Block" as const, reason: "Acceptable use policy", expiresOn: "Never", addedBy: "admin@cloudlab.in", addedOn: "2026-02-04" },
    ],
    urls: [
      { id: "u-1", value: "https://docusign-files.cloudlab.in/*", list: "Allow" as const, reason: "Internal eSign workflow", expiresOn: "Never", addedBy: "admin@cloudlab.in", addedOn: "2025-09-12" },
      { id: "u-2", value: "https://login-microsoft.tk/*", list: "Block" as const, reason: "Phishing landing — AiTM", expiresOn: "2026-08-20", addedBy: "soc1@cloudlab.in", addedOn: "2026-05-20" },
    ],
    files: [
      { id: "f-1", value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", list: "Block" as const, reason: "Wacatac.B sample SHA-256", expiresOn: "Never", addedBy: "soc2@cloudlab.in", addedOn: "2026-05-15" },
    ],
  };
}

function buildQuarantineItems(): DefenderQuarantineMessage[] {
  return [
    { id: "qm-1001", received: "2026-05-20 14:38", sender: "spoofer@contoso.tk", recipient: "cfo@cloudlab.in", subject: "URGENT: Wire transfer approval", policy: "Anti-phish — High confidence phish", reason: "High-confidence phish + domain impersonation", sizeKb: 38, status: "Pending" },
    { id: "qm-1002", received: "2026-05-20 13:18", sender: "paypall@paypal-secure.tk", recipient: "finance@cloudlab.in", subject: "Your invoice is overdue", policy: "Anti-spam — Bulk", reason: "BCL 8 (bulk complaint level high)", sizeKb: 12, status: "Pending" },
    { id: "qm-1003", received: "2026-05-19 11:08", sender: "priya.s@cloudlab.in", recipient: "all-staff@cloudlab.in", subject: "Free Friday lunch! Click here", policy: "Anti-spam — Mass mailing", reason: "Mass-mailing pattern detected", sizeKb: 24, status: "Released by admin", releasedOn: "2026-05-19 12:02" },
    { id: "qm-1004", received: "2026-05-18 18:42", sender: "finance@partner.com", recipient: "admin@itbd.net", subject: "Q2 invoices attached", policy: "Safe Attachments — detonation", reason: "Macro behaviour suspicious during detonation", sizeKb: 1842, status: "Pending" },
    { id: "qm-1005", received: "2026-05-18 09:14", sender: "newsletter@vendor.com", recipient: "marketing@cloudlab.in", subject: "Q2 product roadmap", policy: "Anti-spam — Bulk", reason: "BCL 6", sizeKb: 218, status: "Released by user", releasedOn: "2026-05-18 10:40" },
    { id: "qm-1006", received: "2026-05-17 22:18", sender: "support@cloudlab.in.tk", recipient: "hr@cloudlab.in", subject: "Re: Salary review", policy: "Anti-phish — Spoof", reason: "Domain spoof + DMARC fail", sizeKb: 18, status: "Reported to Microsoft", reportVerdict: "Phish" },
  ];
}

// ===== Email & Collaboration (rich version) =====

function buildEmailCollab(): DefenderEmailCollab {
  return {
    explorer: {
      viewMode: "All email",
      lookback: "7 days",
      stats: {
        totalEmail: 487231,
        delivered: 484120,
        junked: 1842,
        quarantined: 1247,
        blocked: 22,
        zapped: 387,
        phishCount: 87,
        malwareCount: 14,
      },
      topUrlClicks: [
        { url: "https://phishing-portal.example.bad/login.html", clicks: 12, threatType: "Phish (verdict updated post-delivery)", timeOfClickAction: "Blocked", users: ["jdoe@cloudlab.in", "mgarcia@cloudlab.in"] },
        { url: "https://malicious-update.com/setup.exe", clicks: 3, threatType: "Malware", timeOfClickAction: "Warning shown, clicked through", users: ["legacy-user@cloudlab.in"] },
      ],
      topAttachments: [
        { sender: "attacker@bad-domain.ru", fileName: "Invoice_URGENT.html", sha256: "a3f5b7c2d1e9...", verdict: "Phish", recipients: 14, action: "Delivered → ZAP-purged" },
        { sender: "newsletter@evil.com", fileName: "report.pdf", sha256: "b2c4d6e8f1b2...", verdict: "Malware (Emotet)", recipients: 3, action: "Quarantined" },
      ],
    },
    campaigns: [
      { name: "Campaign-2645382", firstSeen: "4 hours ago", lastSeen: "12 min ago", confidence: "High", threatType: "Phish", impact: "14 users targeted, 0 compromised", subject: "Re: Q1 Invoice — Action Required", subjectVariations: 8, payloadType: "Credential phish", senders: 12, ips: 4, recipients: 14, clicks: 2, attachments: 1, urls: 5, mitre: "T1566.001" },
      { name: "Campaign-2645301", firstSeen: "2 days ago", lastSeen: "6 hours ago", confidence: "High", threatType: "Malware", impact: "3 users targeted, 1 device infected", subject: "Shared document", subjectVariations: 4, payloadType: "Emotet loader", senders: 3, ips: 2, recipients: 3, clicks: 1, attachments: 2, urls: 1, mitre: "T1566.001" },
      { name: "Campaign-2644872", firstSeen: "1 week ago", lastSeen: "3 days ago", confidence: "Medium", threatType: "Spam", impact: "4,200 recipients, all junked", subject: "You've won!", subjectVariations: 47, payloadType: "Bulk spam", senders: 234, ips: 67, recipients: 4200, clicks: 0, attachments: 0, urls: 1, mitre: "-" },
    ],
    submissions: [
      { date: "4 hours ago", type: "Email", submittedBy: "jdoe@cloudlab.in", submittedAs: "Phish", reason: "User reported via Outlook button", items: 1, verdict: "Pending analysis" },
      { date: "6 hours ago", type: "Email", submittedBy: "admin@cloudlab.in (ankit)", submittedAs: "False positive", reason: "Newsletter blocked but legitimate", items: 1, verdict: "False positive confirmed — un-blocked" },
      { date: "Yesterday", type: "URL", submittedBy: "priya@cloudlab.in", submittedAs: "Phish", reason: "Suspicious link in shared Teams chat", items: 1, verdict: "Phish confirmed — URL added to block list" },
      { date: "2 days ago", type: "File", submittedBy: "mgarcia@cloudlab.in", submittedAs: "Malware", reason: "Defender alerted on download", items: 1, verdict: "Malware confirmed (Emotet) — hash added to block list" },
    ],
    simulations: [
      { name: "Q1-2026 Phishing-Credential-Harvest", status: "Completed", startDate: "2026-03-15", endDate: "2026-03-29", techniques: "Credential harvest", targeted: 4500, clicked: 423, percentClicked: 9.4, reported: 247, percentReported: 5.5, compromised: 89, trainingAssigned: 423, trainingCompleted: 401 },
      { name: "Q2-2026 Spear-Exec-Impersonation", status: "In progress", startDate: "2026-05-01", endDate: "2026-05-15", techniques: "Spear phishing → CEO impersonation", targeted: 87, clicked: 8, percentClicked: 9.2, reported: 12, percentReported: 13.8, compromised: 2, trainingAssigned: 8, trainingCompleted: 0 },
      { name: "Q4-2025 Malware-Attachment", status: "Completed", startDate: "2025-10-15", endDate: "2025-10-29", techniques: "Malware attachment", targeted: 4500, clicked: 247, percentClicked: 5.5, reported: 612, percentReported: 13.6, compromised: 14, trainingAssigned: 247, trainingCompleted: 219 },
    ],
    threatTracker: [
      { name: "CVE-2025-12345 (Exchange Server RCE)", type: "Microsoft", severity: "Critical", firstAdded: "2025-11-02", tagged: "Patch available, monitor for exploitation" },
      { name: "LockBit 4.0 ransomware", type: "Microsoft", severity: "High", firstAdded: "2026-02-10", tagged: "Active campaigns globally, monitor IoCs" },
      { name: "AS-REP roasting attempts in your tenant", type: "Custom (your tenant)", severity: "Medium", firstAdded: "2026-04-12", tagged: "auto-tagged from Sentinel hunting" },
    ],
  };
}

// ===== Permissions & roles =====

const WORKLOADS: DefenderWorkload[] = [
  { id: "xdr", label: "Defender XDR (incidents + alerts)" },
  { id: "endpoints", label: "Defender for Endpoint" },
  { id: "email", label: "Defender for Office 365" },
  { id: "identity", label: "Defender for Identity" },
  { id: "cloudapps", label: "Defender for Cloud Apps" },
  { id: "ti", label: "Threat intelligence" },
  { id: "hunting", label: "Advanced hunting" },
  { id: "autoir", label: "Automated investigation + response" },
];

const ACTION_LIBRARY: Record<DefenderWorkloadId, string[]> = {
  xdr: ["View incidents", "Manage incidents", "Approve/Reject pending actions", "Live response"],
  endpoints: ["View devices", "Isolate device", "Run AV scan", "Collect investigation package", "Restrict app execution", "Stop and quarantine file"],
  email: ["View submissions", "Release from quarantine", "Tenant Allow/Block list", "Threat policies (anti-phish, Safe Links, Safe Attachments)"],
  identity: ["View identity alerts", "Configure sensors", "Manage honey tokens"],
  cloudapps: ["View OAuth apps", "Approve / Block apps", "Session policies"],
  ti: ["View TI feeds", "Add indicators", "Bulk import indicators"],
  hunting: ["Run hunting queries", "Save shared queries", "Schedule hunting via custom detection"],
  autoir: ["View AIR investigations", "Change AIR level (Full / Semi / No automation)", "Suppress AIR"],
};

function flatActions(workloadIds: DefenderWorkloadId[]): string[] {
  const out: string[] = [];
  workloadIds.forEach((w) => ACTION_LIBRARY[w].forEach((a) => out.push(a)));
  return out;
}

const PERM_USERS: DefenderPermUser[] = [
  { id: "u-ankit", upn: "admin@itbd.net", name: "Ankit", department: "IT" },
  { id: "u-soc1", upn: "soc1@cloudlab.in", name: "SOC Tier 1 - A", department: "Security" },
  { id: "u-soc2", upn: "soc2@cloudlab.in", name: "SOC Tier 1 - B", department: "Security" },
  { id: "u-soc3", upn: "soc3@cloudlab.in", name: "SOC Tier 2 - C", department: "Security" },
  { id: "u-soc4", upn: "soc4@cloudlab.in", name: "SOC Tier 2 - D", department: "Security" },
  { id: "u-sec1", upn: "security-admin@cloudlab.in", name: "Sec Admin", department: "Security" },
  { id: "u-itadmin", upn: "itadmin@cloudlab.in", name: "IT Admin", department: "IT" },
  { id: "u-helpdesk", upn: "helpdesk@cloudlab.in", name: "Helpdesk", department: "IT" },
  { id: "u-priya", upn: "priya.s@cloudlab.in", name: "Priya S.", department: "Marketing" },
  { id: "u-rahul", upn: "rahul.k@cloudlab.in", name: "Rahul K.", department: "Finance" },
  { id: "u-meera", upn: "meera.p@cloudlab.in", name: "Meera P.", department: "HR" },
];

function buildRoles(): DefenderRole[] {
  const allWorkloadIds = WORKLOADS.map((w) => w.id);
  return [
    { id: "r-ga", name: "Global Administrator", type: "Entra", desc: "Full access to all services", workloads: allWorkloadIds, actions: flatActions(allWorkloadIds), scope: "Tenant", jit: false, builtIn: true },
    { id: "r-secadmin", name: "Security Administrator", type: "Entra", desc: "Manage security policies", workloads: ["xdr", "endpoints", "email", "identity", "cloudapps", "ti"], actions: flatActions(["xdr", "endpoints", "email", "identity", "cloudapps", "ti"]), scope: "Tenant", jit: false, builtIn: true },
    { id: "r-secop", name: "Security Operator", type: "Entra", desc: "View alerts and incidents, isolate device", workloads: ["xdr", "endpoints", "email"], actions: ["View incidents", "Manage incidents", "View devices", "Isolate device", "View submissions", "Release from quarantine", "Run hunting queries"], scope: "Tenant", jit: false, builtIn: true },
    { id: "r-secread", name: "Security Reader", type: "Entra", desc: "Read-only access to security center", workloads: ["xdr", "endpoints", "email", "identity", "cloudapps", "ti", "hunting"], actions: ["View incidents", "View devices", "View submissions", "View identity alerts", "View OAuth apps", "View TI feeds", "Run hunting queries"], scope: "Tenant", jit: false, builtIn: true },
    { id: "r-t1", name: "SOC Tier 1 Analyst", type: "Defender custom", desc: "Assign and triage incidents", workloads: ["xdr", "endpoints", "email"], actions: ["View incidents", "Manage incidents", "View devices", "View submissions", "Release from quarantine"], scope: "India devices group", jit: false, builtIn: false },
    { id: "r-t2", name: "SOC Tier 2 Investigator", type: "Defender custom", desc: "Live response, isolate devices, run hunting queries", workloads: ["xdr", "endpoints", "email", "identity", "hunting"], actions: ["View incidents", "Manage incidents", "Approve/Reject pending actions", "Live response", "View devices", "Isolate device", "Run AV scan", "Collect investigation package", "Stop and quarantine file", "View identity alerts", "Run hunting queries"], scope: "All devices", jit: true, builtIn: false },
  ];
}

function buildRoleAssignments(): DefenderRoleAssignment[] {
  return [
    { roleId: "r-ga", userId: "u-ankit", assignedOn: "2024-04-01", assignedBy: "system", jit: false, expiresOn: null },
    { roleId: "r-ga", userId: "u-itadmin", assignedOn: "2024-06-15", assignedBy: "admin@itbd.net", jit: false, expiresOn: null },
    { roleId: "r-secadmin", userId: "u-sec1", assignedOn: "2024-08-04", assignedBy: "admin@itbd.net", jit: false, expiresOn: null },
    { roleId: "r-secadmin", userId: "u-soc3", assignedOn: "2025-02-12", assignedBy: "admin@itbd.net", jit: true, expiresOn: "2026-12-31" },
    { roleId: "r-secop", userId: "u-soc1", assignedOn: "2025-03-22", assignedBy: "sec1@cloudlab.in", jit: false, expiresOn: null },
    { roleId: "r-secop", userId: "u-soc2", assignedOn: "2025-03-22", assignedBy: "sec1@cloudlab.in", jit: false, expiresOn: null },
    { roleId: "r-secread", userId: "u-helpdesk", assignedOn: "2025-06-08", assignedBy: "sec1@cloudlab.in", jit: false, expiresOn: null },
    { roleId: "r-t1", userId: "u-soc1", assignedOn: "2025-07-19", assignedBy: "sec1@cloudlab.in", jit: false, expiresOn: null },
    { roleId: "r-t1", userId: "u-soc2", assignedOn: "2025-07-19", assignedBy: "sec1@cloudlab.in", jit: false, expiresOn: null },
    { roleId: "r-t2", userId: "u-soc3", assignedOn: "2025-09-04", assignedBy: "sec1@cloudlab.in", jit: true, expiresOn: null },
    { roleId: "r-t2", userId: "u-soc4", assignedOn: "2025-09-04", assignedBy: "sec1@cloudlab.in", jit: true, expiresOn: null },
  ];
}

// ===== Action center =====
// Source (defender-portal.js renderActionCenter()) lazily seeds pendingActions/
// actionHistory on first render of the page rather than at initial state
// creation. We seed a small, realistic set up front instead (empty arrays
// otherwise leave the Action center page with nothing to demonstrate),
// referencing real device/identity names from DEVICE_NAMES/IDENTITY_NAMES so
// this reads as one coherent tenant rather than disconnected placeholder data.
function buildPendingActions(): DefenderPendingAction[] {
  return [
    { id: "AC-10241", type: "Isolate device", target: "LAPTOP-SNEHA", requestedBy: "naveen@cloudlab.in", requestedOn: dateOffset(0, 1), investigation: "INV-10237" },
    { id: "AC-10238", type: "Quarantine file", target: "invoice_q4.docm (SHA: a1b2c3d4...)", requestedBy: "jaya@cloudlab.in", requestedOn: dateOffset(0, 3), investigation: "INV-10238" },
    { id: "AC-10237", type: "Block sender", target: "hr-admin@external-partner.co", requestedBy: "naveen@cloudlab.in", requestedOn: dateOffset(0, 3), investigation: "INV-10241" },
    { id: "AC-10235", type: "Force password reset", target: "vikram@cloudlab.in", requestedBy: "jaya@cloudlab.in", requestedOn: dateOffset(0, 5), investigation: "INV-10235" },
  ];
}

// ===== Root builder =====

export function freshDefenderState(): DefenderState {
  const incidents = buildIncidents();
  const devices = buildDevices();
  const identities = buildIdentities();

  return {
    tenant: {
      name: "CloudLab Training",
      domain: "cloudlab.onmicrosoft.com",
      primaryDomain: "cloudlab.in",
      tenantId: "b1a2c3d4-1234-5678-9abc-def012345678",
    },
    incidents,
    alerts: buildAlerts(incidents),
    devices,
    identities,
    secureScore: buildSecureScore(),
    emailThreats: buildEmailThreats(),
    submissions: buildSubmissions(),
    threatAnalytics: buildThreatAnalytics(),
    vulnerabilities: buildVulnerabilities(),
    campaigns: buildCampaigns(),
    activityLog: [],

    huntingQueries: HUNTING_QUERIES,
    detectionSummaryCards: DETECTION_SUMMARY_CARDS,
    huntingSchema: HUNTING_SCHEMA,
    scheduledHunts: SCHEDULED_HUNTS,
    huntRuns: [],

    customDetectionRules: buildCustomDetectionRules(),

    assets: buildAssets(),

    postureFindings: buildPostureFindings(),
    lateralMovementPaths: buildLateralMovementPaths(),
    sensitiveAccounts: buildSensitiveAccounts(),
    honeyTokens: buildHoneyTokens(),

    discoveredApps: buildDiscoveredApps(),
    oauthApps: buildOAuthApps(),
    connectors: buildConnectors(),
    sessionPolicies: buildSessionPolicies(),

    antiPhishPolicies: buildAntiPhishPolicies(),
    antiMalwarePolicies: buildAntiMalwarePolicies(),
    blockedFileExtensions: BLOCKED_FILE_EXTENSIONS,
    antiSpamPolicies: buildAntiSpamPolicies(),
    safeAttachmentsPolicies: buildSafeAttachmentsPolicies(),
    safeLinksPolicies: buildSafeLinksPolicies(),
    dkimDomains: buildDkimDomains(),
    quarantinePolicyTypes: buildQuarantinePolicyTypes(),

    tenantAllowBlock: buildTenantAllowBlock(),
    quarantine: { items: buildQuarantineItems() },

    emailCollab: buildEmailCollab(),

    workloads: WORKLOADS,
    actionLibrary: ACTION_LIBRARY,
    permUsers: PERM_USERS,
    roles: buildRoles(),
    roleAssignments: buildRoleAssignments(),

    pendingActions: buildPendingActions(),
    actionHistory: [],

    threatAnalyticsRead: [],
    threatAnalyticsSubscriptions: [],
  };
}
