import type { M365AcceptedDomain, M365Domain, M365Group, M365License, M365State, M365User } from "./types";

const ACCEPTED_DOMAINS: M365AcceptedDomain[] = [
  { name: "cloudlab.onmicrosoft.com", type: "Authoritative", isDefault: true },
  { name: "cloudlab.in", type: "Authoritative", isDefault: false },
];

const ROLES = [
  "User",
  "Global administrator",
  "Global reader",
  "User administrator",
  "Helpdesk administrator",
  "Exchange administrator",
  "SharePoint administrator",
  "Teams administrator",
  "License administrator",
  "Billing administrator",
  "Service support administrator",
  "Reports reader",
  "Compliance administrator",
  "Security administrator",
];

const LICENSE_CATALOG: { sku: string; name: string; purchased: number; monthly: number }[] = [
  { sku: "M365_BUSINESS_BASIC", name: "Microsoft 365 Business Basic", purchased: 25, monthly: 6.0 },
  { sku: "M365_BUSINESS_STANDARD", name: "Microsoft 365 Business Standard", purchased: 50, monthly: 12.5 },
  { sku: "M365_E3", name: "Microsoft 365 E3", purchased: 60, monthly: 36.0 },
  { sku: "M365_E5", name: "Microsoft 365 E5", purchased: 30, monthly: 57.0 },
  { sku: "ENTRA_ID_P1", name: "Microsoft Entra ID P1", purchased: 50, monthly: 6.0 },
  { sku: "ENTRA_ID_P2", name: "Microsoft Entra ID P2", purchased: 10, monthly: 9.0 },
  { sku: "POWER_BI_PRO", name: "Power BI Pro", purchased: 25, monthly: 10.0 },
  { sku: "VS_ENTERPRISE", name: "Visual Studio Enterprise", purchased: 8, monthly: 250.0 },
  { sku: "VS_PRO", name: "Visual Studio Professional", purchased: 12, monthly: 45.0 },
  { sku: "VISIO_P2", name: "Visio Plan 2", purchased: 8, monthly: 15.0 },
  { sku: "MDE_P2", name: "Defender for Endpoint P2", purchased: 247, monthly: 5.2 },
  { sku: "INTUNE_P2", name: "Microsoft Intune P2 add-on", purchased: 5, monthly: 4.0 },
];

const SAMPLE_USERS: [string, string, string, string, string, string | null, boolean, boolean, string[]][] = [
  ["Alex Johnson", "ankit", "IT Manager", "Information Technology", "Bengaluru", null, true, true, ["M365_E3", "POWER_BI_PRO"]],
  ["Priya Patel", "priya", "HR Director", "Human Resources", "Mumbai", null, true, true, ["M365_BUSINESS_STANDARD"]],
  ["Rahul Verma", "rahul", "Sales Manager", "Sales", "Delhi", "priya", true, true, ["M365_BUSINESS_STANDARD"]],
  ["Sneha Iyer", "sneha", "Marketing Lead", "Marketing", "Bengaluru", "priya", true, false, ["M365_BUSINESS_BASIC"]],
  ["Vikram Singh", "vikram", "Finance Manager", "Finance", "Mumbai", null, true, true, ["M365_E3"]],
  ["Anjali Mehta", "anjali", "Sales Executive", "Sales", "Pune", "rahul", true, true, ["M365_BUSINESS_STANDARD"]],
  ["Rohit Kapoor", "rohit", "Software Engineer", "Information Technology", "Bengaluru", "ankit", true, true, ["M365_E3"]],
  ["Neha Joshi", "neha", "HR Executive", "Human Resources", "Mumbai", "priya", true, true, ["M365_BUSINESS_STANDARD"]],
  ["Karan Malhotra", "karan", "Operations Manager", "Operations", "Delhi", null, true, false, ["M365_BUSINESS_BASIC"]],
  ["Deepika Rao", "deepika", "Senior Developer", "Information Technology", "Bengaluru", "ankit", true, true, ["M365_E3", "POWER_BI_PRO"]],
  ["Amit Khanna", "amit", "Project Manager", "Information Technology", "Hyderabad", "ankit", true, true, ["M365_BUSINESS_STANDARD"]],
  ["Pooja Nair", "pooja", "Marketing Executive", "Marketing", "Bengaluru", "sneha", true, false, ["M365_BUSINESS_BASIC"]],
  ["Suresh Reddy", "suresh", "Finance Executive", "Finance", "Hyderabad", "vikram", true, true, ["M365_BUSINESS_BASIC"]],
  ["Kavita Bhat", "kavita", "Sales Representative", "Sales", "Chennai", "rahul", true, false, ["M365_BUSINESS_BASIC"]],
  ["Manish Tiwari", "manish", "DevOps Engineer", "Information Technology", "Bengaluru", "ankit", true, true, ["M365_E3"]],
  ["Sunita Pillai", "sunita", "HR Specialist", "Human Resources", "Mumbai", "priya", true, true, ["M365_BUSINESS_BASIC"]],
  ["Arjun Desai", "arjun", "Sales Executive", "Sales", "Ahmedabad", "rahul", true, false, ["M365_BUSINESS_STANDARD"]],
  ["Meera Shah", "meera", "Marketing Specialist", "Marketing", "Pune", "sneha", true, true, ["M365_BUSINESS_STANDARD"]],
  ["Vivek Agarwal", "vivek", "IT Support", "Information Technology", "Bengaluru", "ankit", true, false, ["M365_BUSINESS_BASIC"]],
  ["Ritu Saxena", "ritu", "Compliance Officer", "Legal", "Delhi", null, false, false, []],
];

function buildUsers(): M365User[] {
  return SAMPLE_USERS.map((row, idx) => {
    const [displayName, username, jobTitle, department, city, manager, accountEnabled, mfaEnabled, licenses] = row;
    return {
      id: `u-${1000 + idx}`,
      displayName,
      firstName: displayName.split(" ")[0],
      lastName: displayName.split(" ").slice(1).join(" "),
      username,
      domain: "cloudlab.onmicrosoft.com",
      upn: `${username}@cloudlab.onmicrosoft.com`,
      jobTitle,
      department,
      officeLocation: city,
      manager,
      accountEnabled,
      mfaEnabled,
      licenses: [...licenses],
      roles: username === "ankit" ? ["Global administrator"] : ["User"],
      createdDate: "2024-01-15",
      lastSignIn: idx % 5 === 0 ? "Never" : `2026-05-${String(10 + (idx % 4)).padStart(2, "0")}`,
      signInBlocked: !accountEnabled,
      mobile: `+91-${9000000000 + idx}`,
      businessPhone: "",
      streetAddress: "",
      city,
      state: "",
      postalCode: "",
      country: "India",
      usageLocation: "IN",
      aboutMe: "",
    };
  });
}

function buildGroups(): M365Group[] {
  const allUsernames = SAMPLE_USERS.map((u) => u[1]);
  return [
    { id: "g-001", name: "Marketing-Team", email: "marketing-team@cloudlab.onmicrosoft.com", type: "Microsoft 365", privacy: "Private", source: "Cloud", membership: "Assigned", description: "Marketing department team", owners: ["sneha"], members: ["sneha", "pooja", "meera"] },
    { id: "g-002", name: "Sales-Team", email: "sales-team@cloudlab.onmicrosoft.com", type: "Microsoft 365", privacy: "Private", source: "Cloud", membership: "Assigned", description: "Sales department team", owners: ["rahul"], members: ["rahul", "anjali", "kavita", "arjun"] },
    { id: "g-003", name: "IT-Department", email: "it-department@cloudlab.onmicrosoft.com", type: "Microsoft 365", privacy: "Private", source: "Cloud", membership: "Assigned", description: "IT department collaboration", owners: ["ankit"], members: ["ankit", "rohit", "deepika", "manish", "vivek", "amit"] },
    { id: "g-004", name: "all-staff", email: "all-staff@cloudlab.onmicrosoft.com", type: "Distribution", privacy: "Public", source: "Cloud", membership: "Assigned", description: "All employees distribution", owners: ["ankit"], members: allUsernames },
    { id: "g-005", name: "leadership", email: "leadership@cloudlab.onmicrosoft.com", type: "Distribution", privacy: "Private", source: "Cloud", membership: "Assigned", description: "Leadership distribution list", owners: ["ankit"], members: ["ankit", "priya", "vikram", "karan"] },
    { id: "g-006", name: "SG-VPNAccess", email: "", type: "Security", privacy: "Private", source: "Cloud", membership: "Assigned", description: "Users allowed VPN connection", owners: ["ankit"], members: ["ankit", "rohit", "manish", "deepika", "amit"] },
    { id: "g-007", name: "SG-AdminWorkstations", email: "", type: "Security", privacy: "Private", source: "Cloud", membership: "Dynamic", description: "Privileged access workstations", owners: ["ankit"], members: ["ankit"] },
    { id: "g-008", name: "MailSec-Finance", email: "finance-secure@cloudlab.onmicrosoft.com", type: "Mail-enabled security", privacy: "Private", source: "Cloud", membership: "Assigned", description: "Finance secure mail group", owners: ["vikram"], members: ["vikram", "suresh"] },
  ];
}

function buildLicenses(): M365License[] {
  return LICENSE_CATALOG.map((l) => ({
    sku: l.sku,
    name: l.name,
    purchased: l.purchased,
    monthly: l.monthly,
    status: "Active",
    purchaseDate: "2024-04-01",
    renewalDate: "2026-04-01",
    billingCycle: "Annual",
    renewalMode: "Auto-renew",
  }));
}

function buildDomains(): M365Domain[] {
  return ACCEPTED_DOMAINS.map((d) => ({
    name: d.name,
    type: d.type,
    isDefault: d.isDefault,
    status: "Healthy",
    verified: true,
    purpose: { email: true, sharepoint: d.isDefault, teams: d.isDefault, defenderId: d.isDefault, intuneMdm: false },
    dnsManagement: d.isDefault ? "Managed by Microsoft" : "Unmanaged",
    registrar: d.isDefault ? "Microsoft" : "GoDaddy",
    addedOn: "2024-01-10",
    verificationTxt: `MS=ms${Math.floor(10000000 + Math.random() * 89999999)}`,
  }));
}

export function freshM365State(): M365State {
  const users = buildUsers();
  const usernames = SAMPLE_USERS.map((u) => u[1]);

  return {
    tenant: {
      name: "CloudLab Inc.",
      domain: "cloudlabinc.onmicrosoft.com",
      tenantId: "7c8f4b91-2e6a-4d8b-91c7-a14e3f8b5d92",
      directoryName: "CloudLab Inc.",
      createdOn: "2018-04-10",
      region: "India",
      language: "English",
    },
    acceptedDomains: ACCEPTED_DOMAINS.map((d) => ({ ...d })),
    roles: [...ROLES],
    users,
    groups: buildGroups(),
    licenses: buildLicenses(),
    sharedMailboxes: [
      { id: "sm-1", alias: "helpdesk", email: "helpdesk@cloudlab.onmicrosoft.com", displayName: "IT Helpdesk", members: ["ankit", "rohit", "vivek"], quotaGB: 50, usedGB: 4.2 },
      { id: "sm-2", alias: "info", email: "info@cloudlab.onmicrosoft.com", displayName: "Info Mailbox", members: ["priya", "sunita"], quotaGB: 50, usedGB: 1.1 },
      { id: "sm-3", alias: "support", email: "support@cloudlab.onmicrosoft.com", displayName: "Support", members: ["rohit", "vivek", "manish"], quotaGB: 50, usedGB: 8.6 },
    ],
    exchange: {
      acceptedDomains: ACCEPTED_DOMAINS.map((d) => ({ ...d })),
      distributionGroups: [
        { name: "all-staff", email: "all-staff@cloudlab.onmicrosoft.com", members: 20, type: "Distribution", hiddenFromGAL: false },
        { name: "leadership", email: "leadership@cloudlab.onmicrosoft.com", members: 4, type: "Distribution", hiddenFromGAL: false },
        { name: "announcements", email: "announcements@cloudlab.onmicrosoft.com", members: 20, type: "Distribution", hiddenFromGAL: false },
        { name: "sales-dl", email: "sales-dl@cloudlab.onmicrosoft.com", members: 4, type: "Distribution", hiddenFromGAL: false },
        { name: "it-dl", email: "it-dl@cloudlab.onmicrosoft.com", members: 6, type: "Distribution", hiddenFromGAL: true },
      ],
      transportRules: [
        { id: "tr-1", name: "Block executable attachments", priority: 0, enabled: true, conditions: "Attachment extension matches .exe;.bat;.scr;.js;.ps1", action: "Reject with NDR" },
        { id: "tr-2", name: "External email — warning banner", priority: 1, enabled: true, conditions: "Sender is external", action: "Prepend warning + safety tip" },
        { id: "tr-3", name: "Encrypt Finance-Team emails", priority: 2, enabled: true, conditions: "Recipient is in Finance-Team", action: "Apply Microsoft Purview Message Encryption" },
        { id: "tr-4", name: "Block external auto-forwarding", priority: 3, enabled: true, conditions: "Sender is internal AND ForwardedToExternal", action: "Reject + Generate incident report to security" },
        { id: "tr-5", name: "Tag Executives outbound for DLP", priority: 4, enabled: true, conditions: "Sender in Executives group", action: "Set X-Header X-CL-Exec=true (used by Purview DLP)" },
        { id: "tr-6", name: "Sales-Team — partner email allow-list", priority: 5, enabled: true, conditions: "Sender in Sales-Team AND Recipient in partners.json", action: "Bypass safety attachments + force TLS" },
        { id: "tr-7", name: "Engineering-Team — exempt from EOP MIME blocker", priority: 6, enabled: true, conditions: "Sender in Engineering-Team", action: "Allow attachments containing build artifacts (zip/tar.gz)" },
      ],
      connectors: [
        { name: "Inbound from on-premises", type: "Inbound", fromTo: "Your org email server -> Office 365", enabled: true, tls: "Required" },
        { name: "Outbound to partner", type: "Outbound", fromTo: "Office 365 -> Partner organization", enabled: true, tls: "Required" },
      ],
      remoteDomains: [{ name: "Default", domain: "*", allowAutoReply: true, allowOOF: true }],
      mailboxes: SAMPLE_USERS.map((row, idx) => ({
        user: row[1],
        email: `${row[1]}@cloudlab.onmicrosoft.com`,
        displayName: row[0],
        type: "User mailbox" as const,
        sizeMB: Math.round(120 + Math.random() * 4800),
        quotaGB: 50,
        archive: idx % 5 === 0,
        forwarding: "",
        litigationHold: false,
      })),
    },
    sharepointSites: [
      { id: "sp-1", name: "Communications", url: "https://cloudlab.sharepoint.com/sites/communications", template: "Communication site", owner: "ankit", members: 20, storageGB: 2.1, quotaGB: 25, lastActivity: "2026-05-12", sensitivity: "General", sharing: "Anyone" },
      { id: "sp-2", name: "IT", url: "https://cloudlab.sharepoint.com/sites/it", template: "Team site", owner: "ankit", members: 6, storageGB: 6.7, quotaGB: 25, lastActivity: "2026-05-13", sensitivity: "Confidential", sharing: "OnlyPeopleInYourOrg" },
      { id: "sp-3", name: "Marketing", url: "https://cloudlab.sharepoint.com/sites/marketing", template: "Team site", owner: "sneha", members: 3, storageGB: 1.4, quotaGB: 25, lastActivity: "2026-05-11", sensitivity: "General", sharing: "NewAndExistingGuests" },
      { id: "sp-4", name: "HR", url: "https://cloudlab.sharepoint.com/sites/hr", template: "Team site", owner: "priya", members: 4, storageGB: 0.8, quotaGB: 25, lastActivity: "2026-05-10", sensitivity: "Highly Confidential", sharing: "Disabled" },
      { id: "sp-5", name: "Sales", url: "https://cloudlab.sharepoint.com/sites/sales", template: "Team site", owner: "rahul", members: 5, storageGB: 3.2, quotaGB: 25, lastActivity: "2026-05-13", sensitivity: "Confidential", sharing: "ExistingGuests" },
    ],
    sharepointSettings: {
      defaultSharing: "NewAndExistingGuests",
      guestLinkExpiry: 30,
      requireSignInAfter: 14,
      defaultStorageGB: 25,
      allowAnonymousFiles: false,
      allowAnonymousFolders: false,
      siteCreationEnabled: true,
    },
    teams: [
      { id: "t-1", name: "IT Department", privacy: "Private", owners: ["ankit"], members: 6, channels: ["General", "Helpdesk", "Projects", "Infrastructure"], description: "IT collaboration", archived: false, classification: "Internal" },
      { id: "t-2", name: "Marketing", privacy: "Private", owners: ["sneha"], members: 3, channels: ["General", "Campaigns", "Content", "Analytics"], description: "Marketing team", archived: false, classification: "Internal" },
      { id: "t-3", name: "Sales", privacy: "Private", owners: ["rahul"], members: 5, channels: ["General", "Pipeline", "Customers"], description: "Sales team", archived: false, classification: "Internal" },
      { id: "t-4", name: "Leadership", privacy: "Private", owners: ["ankit", "priya", "vikram"], members: 4, channels: ["General", "Strategy"], description: "Leadership", archived: false, classification: "Confidential" },
      { id: "t-5", name: "Company All-Hands", privacy: "Org-wide", owners: ["ankit"], members: 20, channels: ["General", "Announcements", "Town Hall"], description: "All staff team", archived: false, classification: "Internal" },
    ],
    teamsPolicies: [
      { name: "Global (Org-wide default)", type: "Default", allowMeetingChat: true, allowPrivateChannels: true, allowGuestAccess: true, allowExternalAccess: true },
      { name: "Restricted-Interns", type: "Custom", allowMeetingChat: true, allowPrivateChannels: false, allowGuestAccess: false, allowExternalAccess: false },
    ],
    teamsMeetingPolicies: [
      { name: "Global", type: "Default", allowAnonymousJoin: true, allowCloudRecording: true, allowTranscription: true, whoCanPresent: "Everyone", autoAdmittedUsers: "EveryoneInCompany" },
      { name: "Secure-Meetings", type: "Custom", allowAnonymousJoin: false, allowCloudRecording: true, allowTranscription: false, whoCanPresent: "OrganizerOnly", autoAdmittedUsers: "OrganizerOnly" },
    ],
    teamsOrgSettings: {
      emailIntegration: true,
      allowAppsInTeams: true,
      allowExternalApps: false,
      allowSideloading: false,
      tagsManagedBy: "Team owners",
      cloudStorageProviders: ["OneDrive", "SharePoint", "GoogleDrive"],
      allowSkypeFallback: false,
      allowOrgWideTeams: true,
      translation: true,
    },
    deletedUsers: [],
    deletedSites: [],
    activityLog: [],
    domains: buildDomains(),
    security: {
      conditionalAccessPolicies: [
        { name: "Require MFA for admins", state: "On", users: "Directory roles: all admin roles", apps: "All cloud apps", conditions: "Any location", grant: "Require multi-factor authentication", session: "Standard" },
        { name: "Block legacy authentication", state: "On", users: "All users", apps: "All cloud apps", conditions: "Client apps: legacy auth clients", grant: "Block access", session: "Standard" },
        { name: "Require compliant device", state: "On", users: "All users", apps: "Office 365", conditions: "Any location", grant: "Require device to be marked as compliant", session: "Standard" },
        { name: "PAW for Tier-0 admins", state: "On", users: "Global administrators", apps: "Azure management", conditions: "Device: Tier-0 PAW filter", grant: "Require compliant device", session: "Sign-in frequency: 4 hours" },
        { name: "Block access from unsupported countries", state: "On", users: "All users", apps: "All cloud apps", conditions: "Location: not India, US, UK", grant: "Block access", session: "Standard" },
        { name: "Risky sign-in requires MFA", state: "On", users: "All users", apps: "All cloud apps", conditions: "Sign-in risk: Medium and above", grant: "Require multi-factor authentication", session: "Standard" },
        { name: "Block risky users", state: "On", users: "All users", apps: "All cloud apps", conditions: "User risk: High", grant: "Block access", session: "Standard" },
        { name: "Executives — stronger authentication", state: "On", users: "Executives group", apps: "All cloud apps", conditions: "Any location", grant: "Require multi-factor authentication + compliant device", session: "Sign-in frequency: 1 hour" },
        { name: "B2B guest verification", state: "On", users: "Guest or external users", apps: "All cloud apps", conditions: "Any location", grant: "Require multi-factor authentication", session: "Standard" },
        { name: "Block non-compliant mobile", state: "On", users: "All users", apps: "Exchange Online, Teams", conditions: "Device platform: iOS, Android", grant: "Require app protection policy", session: "Standard" },
        { name: "Engineering devtools — report only", state: "Report-only", users: "Engineering-Team", apps: "Azure DevOps", conditions: "Any location", grant: "Require multi-factor authentication", session: "Standard" },
      ],
      namedLocations: [
        { name: "HQ - Bengaluru", kind: "IP range", value: "203.0.113.0/24", trusted: true },
        { name: "Branch - Mumbai", kind: "IP range", value: "198.51.100.0/24", trusted: true },
        { name: "Branch - Delhi", kind: "IP range", value: "192.0.2.0/24", trusted: true },
        { name: "Allowed countries", kind: "Country", value: "India, United States, United Kingdom", trusted: true },
        { name: "Blocked - high risk regions", kind: "Country", value: "Various", trusted: false },
        { name: "VPN egress", kind: "IP range", value: "203.0.113.128/25", trusted: true },
      ],
      secureScore: { current: 62, max: 100 },
      secureScoreCategories: [
        { category: "Identity", current: 28, max: 40 },
        { category: "Data", current: 10, max: 20 },
        { category: "Device", current: 14, max: 25 },
        { category: "Apps", current: 10, max: 15 },
      ],
    },
    officeDeploy: {
      deploymentName: "CloudLab Standard Deployment",
      updateChannel: "Monthly Enterprise",
      architecture: "64-bit",
      migrateArch: true,
      products: ["Microsoft 365 Apps for enterprise"],
      excludedApps: ["Publisher", "Bing", "Skype for Business"],
      languages: ["English (United States)"],
      installOptions: { silent: true, forceUpgrade: false, removeMsi: true },
      updateSettings: { autoUpdate: true },
      source: "CDN",
      orgName: "CloudLab Inc.",
    },
  };
}

export function usernamesOf(state: M365State): string[] {
  return state.users.map((u) => u.username);
}
