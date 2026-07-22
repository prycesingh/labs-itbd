import type {
  PurviewAdaptiveScope,
  PurviewAssessment,
  PurviewAuditEvent,
  PurviewAuditSavedSearch,
  PurviewAutoLabelPolicy,
  PurviewCcAlert,
  PurviewCcPolicy,
  PurviewClassificationType,
  PurviewClassifier,
  PurviewContentSearchRow,
  PurviewControl,
  PurviewDataSource,
  PurviewDispositionItem,
  PurviewDlpPolicy,
  PurviewEDiscoveryCase,
  PurviewGlossaryTerm,
  PurviewImprovementAction,
  PurviewIrmCase,
  PurviewIrmIndicator,
  PurviewIrmPolicy,
  PurviewLabelPolicy,
  PurviewRecordsPlan,
  PurviewRetentionPolicy,
  PurviewScanJob,
  PurviewSensitivityLabel,
  PurviewState,
} from "./types";
import { pseudonym } from "./irm-engine";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Ported verbatim from itbd-lab/simulators/{avd,defender,sentinel} `rng(seed)` — same
// simple LCG used across every ported simulator in this app so seed data is stable
// across reloads within a session (no Math.random()).
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Relative-to-now date offsets — computed at seed-generation time (client-side per
// session), matching source's `nowIso(offsetDays)` in purview-data.js.
function nowIso(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

// ===== Local hardcoded "CloudLab Inc." roster =====
// Source (purview-data.js) reads a shared `CloudLabInfra` module that this app
// doesn't have as a cross-simulator bridge (same situation as sentinel/defender/avd
// — each ported simulator hardcodes its own roster inline). Names below are drawn
// from BOTH the Sentinel roster (ankit/rohit/vivek/priya/naveen/jaya/sneha/vikram/
// rahul/arjun/kiran/amit/pooja/kavita/manish) AND the eDiscovery-case cast that
// purview-data.js already references directly (sunita/aarti/sandeep/karthik/
// lakshmi/preeti/ravi), so Purview's flavor text stays consistent with its sibling
// simulators while preserving every UPN the source eDiscovery seed data hardcodes.
const TENANT = {
  companyName: "CloudLab Inc.",
  publicDomain: "cloudlab.in",
  tenantId: "8f3b2a1c-9d4e-4f2a-b6c1-2e7a9d5f10ab",
};

// [upn-local, displayName, department, jobTitle, adminRole | null]
const USER_ROSTER: [string, string, string, string, string | null][] = [
  ["ankit", "Ankit Sharma", "IT", "Cloud Architect / CTO", "Global Administrator"],
  ["rohit", "Rohit Verma", "IT", "Sr. Identity Admin", "Privileged Role Administrator"],
  ["vivek", "Vivek Iyer", "IT", "Network + Security Engineer", "Compliance Administrator"],
  ["priya", "Priya Singh", "IT", "Sr. Endpoint Admin (Intune)", null],
  ["naveen", "Naveen Reddy", "IT", "Insider Risk Analyst (Tier-2)", null],
  ["jaya", "Jaya Krishnan", "IT", "Compliance Analyst (Tier-1)", null],
  ["sneha", "Sneha Patil", "Marketing", "Marketing Executive", null],
  ["vikram", "Vikram Desai", "Finance", "Finance Executive", null],
  ["rahul", "Rahul Kapoor", "Sales", "Sales Representative", null],
  ["arjun", "Arjun Mehta", "Sales", "VP Sales", null],
  ["kiran", "Kiran Rao", "Sales", "Sr. Account Executive", null],
  ["amit", "Amit Trivedi", "Finance", "Chief Financial Officer", null],
  ["pooja", "Pooja Nair", "Marketing", "Marketing Manager", null],
  ["kavita", "Kavita Bhat", "Sales", "Sales Representative", null],
  ["manish", "Manish Kumar", "IT", "Exchange + M365 Admin", "Exchange Administrator"],
  ["sunita", "Sunita Rangan", "Legal", "Chief Compliance Officer", "Compliance Data Administrator"],
  ["aarti", "Aarti Deshmukh", "HR", "HR Investigations Lead", null],
  ["sandeep", "Sandeep Joshi", "Engineering", "Staff Engineer", null],
  ["karthik", "Karthik Subramaniam", "IT", "eDiscovery Manager", "eDiscovery Manager"],
  ["lakshmi", "Lakshmi Narayan", "Finance", "Finance Controller", null],
  ["preeti", "Preeti Chawla", "Finance", "Financial Analyst", null],
  ["ravi", "Ravi Menon", "Finance", "Treasury Manager", null],
];

function buildUsers(): PurviewState["users"] {
  return USER_ROSTER.map(([id, displayName, department, jobTitle, adminRole]) => ({
    userPrincipalName: `${id}@${TENANT.publicDomain}`,
    displayName,
    department,
    jobTitle,
    adminRole,
  }));
}

// [name, owner-id, os, kind]
const DEVICE_ROSTER: [string, string, string, string][] = [
  ["LAPTOP-ANKIT", "ankit", "Windows 11 Enterprise 23H2", "Laptop"],
  ["LAPTOP-ROHIT", "rohit", "Windows 11 Enterprise 23H2", "Laptop"],
  ["LAPTOP-VIVEK", "vivek", "Windows 10 Enterprise LTSC", "Laptop"],
  ["LAPTOP-PRIYA", "priya", "Windows 11 Pro 23H2", "Laptop"],
  ["LAPTOP-NAVEEN", "naveen", "Windows 11 Enterprise 23H2", "Laptop"],
  ["LAPTOP-JAYA", "jaya", "Windows 10 Pro 22H2", "Laptop"],
  ["LAPTOP-SNEHA", "sneha", "Windows 11 Pro 23H2", "Laptop"],
  ["LAPTOP-VIKRAM", "vikram", "Windows 10 Pro 22H2", "Laptop"],
  ["LAPTOP-RAHUL", "rahul", "Windows 11 Pro 23H2", "Laptop"],
  ["LAPTOP-ARJUN", "arjun", "macOS 14.3 Sonoma", "Laptop"],
  ["LAPTOP-KIRAN", "kiran", "Windows 10 Pro 22H2", "Laptop"],
  ["LAPTOP-AMIT", "amit", "Windows 11 Enterprise 23H2", "Laptop"],
  ["LAPTOP-POOJA", "pooja", "Windows 11 Pro 23H2", "Laptop"],
  ["LAPTOP-KAVITA", "kavita", "Windows 10 Pro 22H2", "Laptop"],
  ["LAPTOP-MANISH", "manish", "Windows 11 Enterprise 23H2", "Laptop"],
  ["LAPTOP-SUNITA", "sunita", "Windows 11 Enterprise 23H2", "Laptop"],
  ["LAPTOP-SANDEEP", "sandeep", "Windows 11 Pro 23H2", "Laptop"],
];

function buildDevices(): PurviewState["devices"] {
  return DEVICE_ROSTER.map(([name, owner, os, kind]) => ({ name, owner, os, kind }));
}

// ===== Sensitivity labels (12) =====

function buildSensitivityLabels(): PurviewSensitivityLabel[] {
  return [
    { id: "lab-pub", name: "Public", order: 1, color: "#107c10", scope: "File, Email", encryption: false, marking: "None", autoLabel: false, parent: null, createdOn: nowIso(-280), description: "Information intended for public release." },
    { id: "lab-gen", name: "General", order: 2, color: "#2564cf", scope: "File, Email", encryption: false, marking: "Footer", autoLabel: false, parent: null, createdOn: nowIso(-280), description: "Default classification for routine business content." },
    { id: "lab-int", name: "Internal", order: 3, color: "#0078d4", scope: "File, Email, Groups & sites", encryption: false, marking: "Footer", autoLabel: false, parent: null, createdOn: nowIso(-275), description: "Only for employees and trusted partners." },
    { id: "lab-cAll", name: "Confidential / All Employees", order: 4, color: "#ca5010", scope: "File, Email", encryption: true, marking: "Header, Footer, Watermark", autoLabel: true, parent: "Confidential", createdOn: nowIso(-260), description: "Confidential information for all employees of cloudlab.in." },
    { id: "lab-cAny", name: "Confidential / Anyone (no protection)", order: 5, color: "#ca5010", scope: "File, Email", encryption: false, marking: "Header, Footer", autoLabel: false, parent: "Confidential", createdOn: nowIso(-260), description: "Confidential but no encryption applied. Marking only." },
    { id: "lab-hcAll", name: "Highly Confidential / All Employees", order: 6, color: "#d83b01", scope: "File, Email, Groups & sites", encryption: true, marking: "Header, Footer, Watermark", autoLabel: true, parent: "Highly Confidential", createdOn: nowIso(-260), description: "Most sensitive content for all employees, fully encrypted." },
    { id: "lab-hcSpec", name: "Highly Confidential / Specific People", order: 7, color: "#a4262c", scope: "File, Email", encryption: true, marking: "Header, Footer, Watermark", autoLabel: false, parent: "Highly Confidential", createdOn: nowIso(-260), description: "Encrypted for explicit recipients. Cannot be forwarded." },
    { id: "lab-rest", name: "Restricted", order: 8, color: "#a4262c", scope: "File, Email, Schematized data", encryption: true, marking: "Watermark", autoLabel: true, parent: null, createdOn: nowIso(-250), description: "Board-level / regulatory content. Print and copy disabled." },
    { id: "lab-pers", name: "Personal", order: 9, color: "#5c2d91", scope: "File, Email", encryption: false, marking: "None", autoLabel: false, parent: null, createdOn: nowIso(-240), description: "Personal employee content. Not for business use." },
    { id: "lab-cust", name: "Customer Data", order: 10, color: "#0078d4", scope: "File, Email, Schematized data", encryption: true, marking: "Footer, Watermark", autoLabel: true, parent: null, createdOn: nowIso(-220), description: "Information collected from or about customers (PII)." },
    { id: "lab-ip", name: "IP / Trade Secret", order: 11, color: "#5c2d91", scope: "File, Email", encryption: true, marking: "Header, Footer, Watermark", autoLabel: true, parent: null, createdOn: nowIso(-200), description: "Intellectual property, proprietary source, design or formulas." },
    { id: "lab-fin", name: "Financial Data", order: 12, color: "#107c10", scope: "File, Email, Schematized data", encryption: true, marking: "Header, Footer", autoLabel: true, parent: null, createdOn: nowIso(-200), description: "Earnings, M&A details, treasury and SOX-sensitive content." },
  ];
}

function buildLabelPolicies(): PurviewLabelPolicy[] {
  return [
    { id: "lp-all", name: "All users - sensitivity labels", publishedTo: "All users", labels: ["lab-pub", "lab-gen", "lab-int", "lab-cAll", "lab-cAny", "lab-hcAll", "lab-hcSpec"], defaultLabel: "lab-gen", requireJustification: true, mandatory: true, modified: nowIso(-30) },
    { id: "lp-fin", name: "Finance team - extended labels", publishedTo: "Finance group", labels: ["lab-pub", "lab-gen", "lab-int", "lab-cAll", "lab-hcAll", "lab-fin", "lab-rest"], defaultLabel: "lab-fin", requireJustification: true, mandatory: true, modified: nowIso(-20) },
    { id: "lp-eng", name: "Engineering - IP labels", publishedTo: "Engineering group", labels: ["lab-pub", "lab-gen", "lab-int", "lab-cAll", "lab-hcAll", "lab-ip"], defaultLabel: "lab-int", requireJustification: true, mandatory: false, modified: nowIso(-15) },
  ];
}

function buildAutoLabelPolicies(): PurviewAutoLabelPolicy[] {
  return [
    { id: "al-pii", name: "Auto-label PII as Customer Data", label: "lab-cust", locations: "SharePoint, OneDrive", condition: "SIT: SSN US (1+) OR Aadhaar (1+) OR PAN (1+)", mode: "Simulation", matches: 1840, modified: nowIso(-9) },
    { id: "al-creds", name: "Auto-label credentials as Restricted", label: "lab-rest", locations: "SharePoint, OneDrive", condition: "SIT: AWS Access Key OR Azure Subscription ID", mode: "On", matches: 22, modified: nowIso(-4) },
  ];
}

// ===== DLP (8 policies, 46 templates, 130+ SIT types) =====

function buildDlpPolicies(): PurviewDlpPolicy[] {
  return [
    {
      id: "dlp-pii", name: "PII - Outbound Block", description: "Detect and block personal data leaving the tenant.",
      locations: ["Exchange", "SharePoint", "OneDrive", "Teams chat", "Endpoint"], template: "U.S. Personally Identifiable Information (PII)",
      status: "Active", runMode: "On", lastModified: nowIso(-12), createdBy: "admin@itbd.net",
      rules: [
        { name: "High volume PII outbound", priority: 0, conditions: "Contains SSN US (10+) or DLN US (10+) shared with people outside the org", actions: "Block access, Notify user, Send incident report to admins", severity: "High" },
        { name: "Low volume PII outbound", priority: 1, conditions: "Contains SSN US (1-9)", actions: "Notify user with policy tip, Allow override with justification", severity: "Medium" },
      ],
    },
    {
      id: "dlp-pci", name: "PCI - Credit Card Restrict", description: "Protect credit card numbers across all workloads.",
      locations: ["Exchange", "SharePoint", "OneDrive", "Teams chat", "Endpoint", "Defender for Cloud Apps"], template: "PCI Data Security Standard (PCI DSS)",
      status: "Active", runMode: "On", lastModified: nowIso(-22), createdBy: "admin@itbd.net",
      rules: [
        { name: "Credit cards external", priority: 0, conditions: "Credit Card Number (1+) shared externally", actions: "Restrict access, Block egress, Incident report", severity: "High" },
        { name: "Credit cards internal mass", priority: 1, conditions: "Credit Card Number (50+) internal", actions: "Notify user, Notify owner", severity: "Medium" },
      ],
    },
    {
      id: "dlp-hipaa", name: "HIPAA - Health Info", description: "Healthcare PHI protection (ICD-10, NPI, DEA).",
      locations: ["Exchange", "SharePoint", "OneDrive", "Teams chat"], template: "U.S. Health Insurance Act (HIPAA)",
      status: "Active", runMode: "Test+notify", lastModified: nowIso(-30), createdBy: "sunita@cloudlab.in",
      rules: [
        { name: "PHI external block", priority: 0, conditions: "ICD-10 code (1+) AND patient identifier shared externally", actions: "Block external, Notify user", severity: "High" },
      ],
    },
    {
      id: "dlp-ip", name: "Corporate IP - Outbound", description: "Detect source code and design documents leaving devices.",
      locations: ["Endpoint", "OneDrive", "SharePoint"], template: "Custom",
      status: "Active", runMode: "On", lastModified: nowIso(-7), createdBy: "admin@itbd.net",
      rules: [
        { name: "Source code copy to USB", priority: 0, conditions: "Sensitive info type: Source code (10+ instances) copied to removable media", actions: "Block, Justification required, Audit", severity: "High" },
        { name: "IP file upload web", priority: 1, conditions: "Files labeled IP / Trade Secret uploaded to non-corporate cloud", actions: "Block, Notify user", severity: "High" },
      ],
    },
    {
      id: "dlp-apa", name: "Australian Privacy Act", description: "Australian PII (TFN, Medicare number).",
      locations: ["Exchange", "SharePoint", "OneDrive"], template: "Australia Personally Identifiable Information (PII) Data",
      status: "Active", runMode: "Test", lastModified: nowIso(-45), createdBy: "sunita@cloudlab.in",
      rules: [
        { name: "TFN + Medicare external", priority: 0, conditions: "Australia Tax File Number AND Medicare Account Number shared externally", actions: "Test mode - notify only", severity: "Medium" },
      ],
    },
    {
      id: "dlp-gdpr", name: "GDPR - EU PII", description: "EU personal data under GDPR.",
      locations: ["Exchange", "SharePoint", "OneDrive", "Teams chat", "Endpoint"], template: "General Data Protection Regulation (GDPR) Enhanced",
      status: "Active", runMode: "On", lastModified: nowIso(-18), createdBy: "admin@itbd.net",
      rules: [
        { name: "EU citizen data external", priority: 0, conditions: "EU Passport Number OR EU National ID (1+) external", actions: "Block, Notify DPO", severity: "High" },
      ],
    },
    {
      id: "dlp-sox", name: "SOX Financial Controls", description: "Sarbanes-Oxley financial data protection.",
      locations: ["Exchange", "SharePoint", "OneDrive", "Power BI"], template: "Sarbanes-Oxley Act (SOX)",
      status: "Active", runMode: "On", lastModified: nowIso(-60), createdBy: "amit@cloudlab.in",
      rules: [
        { name: "Pre-earnings external", priority: 0, conditions: "Files labeled Financial Data shared external 7 days before earnings", actions: "Block, Notify CFO", severity: "High" },
      ],
    },
    {
      id: "dlp-ma", name: "M&A Confidential", description: "Mergers & Acquisitions deal codename protection.",
      locations: ["Exchange", "SharePoint", "OneDrive", "Teams chat"], template: "Custom",
      status: "Active", runMode: "On", lastModified: nowIso(-5), createdBy: "ceo.office@cloudlab.in",
      rules: [
        { name: "Project codename external", priority: 0, conditions: "Keyword: Project Orion, Project Helix, Project Sirius - shared externally", actions: "Block, Notify Legal", severity: "High" },
      ],
    },
  ];
}

const DLP_TEMPLATES: string[] = [
  "U.S. Personally Identifiable Information (PII)", "U.S. Health Insurance Act (HIPAA)", "PCI Data Security Standard (PCI DSS)",
  "U.S. State Breach Notification Laws", "U.S. Patriot Act", "U.S. Gramm-Leach-Bliley Act",
  "U.S. State Social Security Number Confidentiality Laws", "Sarbanes-Oxley Act (SOX)",
  "General Data Protection Regulation (GDPR) Enhanced", "EU Debit Card Number", "EU Driver License Number",
  "EU National Identification Number", "EU Passport Number", "EU Social Security Number", "EU Tax Identification Number",
  "France Personal Data", "France Financial Data", "Germany Personally Identifiable Information (PII)",
  "Germany Financial Data", "United Kingdom Personal Data", "United Kingdom Financial Data",
  "United Kingdom Data Protection Act", "Australia Personally Identifiable Information (PII) Data",
  "Australia Health Records Act (HRIP Act)", "Australia Financial Data", "Australia Privacy Act",
  "Australia Resources Sector Regulation", "Brazil Financial Data", "Brazil Personal Data",
  "Brazil General Data Protection Law (LGPD)", "Canada Financial Data", "Canada Health Information Act",
  "Canada Personal Health Act (PHIPA) Ontario", "Canada Personal Health Information Act",
  "Canada Personally Identifiable Information (PII)", "India Financial Data",
  "India Personally Identifiable Information (PII)", "India Information Technology Act of 2000",
  "Japan Financial Data", "Japan Personally Identifiable Information (PII)", "Japan Protection of Personal Information",
  "New Zealand Personally Identifiable Information (PII)", "New Zealand Privacy Act",
  "Saudi Arabia Personally Identifiable Information (PII)", "Singapore Personally Identifiable Information (PII)",
  "Singapore Personal Data Protection Act", "South Africa Protection of Personal Information Act", "Custom",
];

const SIT_TYPES: string[] = [
  "Credit Card Number", "U.S. Bank Account Number", "U.S. Driver License Number", "U.S. Individual Taxpayer Identification Number (ITIN)",
  "U.S. Social Security Number (SSN)", "U.S. Passport Number", "U.S. DEA Number", "IP Address (v4)", "IP Address (v6)", "SWIFT Code",
  "International Banking Account Number (IBAN)", "International Classification of Diseases (ICD-9-CM)", "International Classification of Diseases (ICD-10-CM)",
  "Argentina National Identity (DNI) Number", "Australia Bank Account Number", "Australia Business Number", "Australia Company Number",
  "Australia Driver License Number", "Australia Medical Account Number", "Australia Passport Number", "Australia Tax File Number",
  "Belgium National Number", "Brazil CPF Number", "Brazil Legal Entity Number (CNPJ)", "Brazil National Identification Card (RG)",
  "Bulgaria Uniform Civil Number", "Canada Bank Account Number", "Canada Driver License Number", "Canada Health Service Number",
  "Canada Passport Number", "Canada Personal Health Identification Number (PHIN)", "Canada Social Insurance Number",
  "Chile Identity Card Number", "China Resident Identity Card (PRC) Number", "Croatia Identity Card Number", "Croatia Personal Identification (OIB) Number",
  "Cyprus Identity Card", "Cyprus Tax Identification Number", "Czech Personal Identity Number", "Denmark Personal Identification Number",
  "Drug Enforcement Agency (DEA) Number", "EU Debit Card Number", "EU Driver License Number", "EU National Identification Number",
  "EU Passport Number", "EU Social Security Number (SSN) or Equivalent ID", "EU Tax Identification Number (TIN)",
  "Estonia Personal Identification Code", "Finland National ID", "Finland Passport Number", "France Driver License Number",
  "France National ID Card (CNI)", "France Passport Number", "France Social Security Number (INSEE)", "France Tax Identification Number (numero SPI.)",
  "France Value Added Tax Number", "Germany Driver License Number", "Germany Identity Card Number", "Germany Passport Number",
  "Germany Tax Identification Number", "Germany Value Added Tax Number", "Greece National ID Card", "Hong Kong Identity Card (HKID) Number",
  "Hungary Personal Identification Number", "Hungary Tax Identification Number", "Hungary Value Added Tax Number", "India Permanent Account Number (PAN)",
  "India Unique Identification (Aadhaar) Number", "Indonesia Identity Card (KTP) Number", "Ireland Personal Public Service (PPS) Number",
  "Israel Bank Account Number", "Israel National ID", "Italy Driver License Number", "Italy Fiscal Code", "Italy Value Added Tax Number",
  "Japan Bank Account Number", "Japan Driver License Number", "Japan My Number Corporate", "Japan My Number Personal", "Japan Passport Number",
  "Japan Resident Registration Number", "Japan Social Insurance Number (SIN)", "Latvia Personal Code", "Lithuania Personal Code",
  "Luxemburg National Identification Number (Natural Persons)", "Luxemburg National Identification Number (Non-natural Persons)",
  "Malaysia Identity Card Number", "Malta Identity Card Number", "Malta Tax Identification Number", "Netherlands Citizens Service (BSN) Number",
  "Netherlands Tax Identification Number", "Netherlands Value Added Tax Number", "New Zealand Bank Account Number", "New Zealand Driver License Number",
  "New Zealand Inland Revenue Number", "New Zealand Ministry of Health Number", "New Zealand Social Welfare Number",
  "Norway Identity Number", "Philippines Unified Multi-Purpose ID Number", "Poland Identity Card", "Poland National ID (PESEL)", "Poland Passport",
  "Poland Tax Identification Number", "Portugal Citizen Card Number", "Portugal Tax Identification Number", "Romania Personal Numeric Code (CNP)",
  "Russia Passport Number (Domestic)", "Russia Passport Number (International)", "Saudi Arabia National ID", "Singapore National Registration Identity Card (NRIC)",
  "Slovakia Personal Number", "Slovenia Tax Identification Number", "Slovenia Unique Master Citizen Number", "South Africa Identification Number",
  "South Korea Resident Registration Number", "Spain DNI", "Spain Social Security Number (SSN)", "Spain Tax Identification Number",
  "Sweden National ID", "Sweden Passport Number", "Sweden Tax Identification Number", "Swiss Social Security Number AHV",
  "Taiwan National Identification Number", "Taiwan Passport Number", "Taiwan Resident Certificate (ARC/TARC)", "Thai Population Identification Code",
  "Turkish National Identification number", "U.K. Driver License Number", "U.K. Electoral Roll Number", "U.K. National Health Service Number",
  "U.K. National Insurance Number (NINO)", "U.K. Unique Taxpayer Reference Number", "Ukraine Passport Domestic", "Ukraine Passport International",
  "Source code (C, C++, Java, Python)", "Azure Subscription ID", "AWS Access Key", "GCP Service Account", "Database Connection String",
];

// ===== Retention / records management =====

function buildRetentionPolicies(): PurviewRetentionPolicy[] {
  return [
    { id: "ret-email7", name: "Email - 7 years", type: "Policy", locations: ["Exchange"], action: "Retain then delete", duration: "7 years", start: "When items were created", status: "On", modified: nowIso(-90), createdOn: nowIso(-365), regulatory: false },
    { id: "ret-sp5", name: "Files SharePoint - 5 years", type: "Policy", locations: ["SharePoint", "OneDrive"], action: "Retain then delete", duration: "5 years", start: "When items were last modified", status: "On", modified: nowIso(-60), createdOn: nowIso(-365), regulatory: false },
    { id: "ret-teams1", name: "Teams chat - 1 year", type: "Policy", locations: ["Teams chats", "Teams channel messages"], action: "Retain then delete", duration: "1 year", start: "When items were created", status: "On", modified: nowIso(-30), createdOn: nowIso(-200), regulatory: false },
    { id: "ret-rec10", name: "Records - 10 years", type: "Label", locations: ["Files"], action: "Retain as record", duration: "10 years", start: "When items were created", status: "On", modified: nowIso(-12), createdOn: nowIso(-200), regulatory: true },
    { id: "ret-tax7", name: "Tax docs - 7 years immutable", type: "Label", locations: ["Files"], action: "Retain (regulatory)", duration: "7 years", start: "When event occurs (Tax filing)", status: "On", modified: nowIso(-180), createdOn: nowIso(-365), regulatory: true },
    { id: "ret-legal", name: "Legal Hold - In effect", type: "Policy", locations: ["Exchange", "SharePoint", "OneDrive", "Teams"], action: "Preserve (legal hold)", duration: "Indefinite", start: "In-place hold", status: "On", modified: nowIso(-2), createdOn: nowIso(-60), regulatory: false },
    { id: "ret-mkt3", name: "Marketing - 3 years", type: "Policy", locations: ["SharePoint", "OneDrive"], action: "Retain then delete", duration: "3 years", start: "When items were created", status: "On", modified: nowIso(-45), createdOn: nowIso(-150), regulatory: false },
    { id: "ret-hr7", name: "HR Personnel - 7 years", type: "Label", locations: ["Files", "Email"], action: "Retain then delete", duration: "7 years", start: "After employee termination event", status: "On", modified: nowIso(-110), createdOn: nowIso(-200), regulatory: false },
    { id: "ret-board", name: "Board minutes - permanent", type: "Label", locations: ["Files"], action: "Retain (no deletion)", duration: "Forever", start: "When items were created", status: "On", modified: nowIso(-200), createdOn: nowIso(-365), regulatory: true },
    { id: "ret-contract", name: "Contracts - 10 years post expiry", type: "Label", locations: ["Files"], action: "Retain then delete", duration: "10 years", start: "When event occurs (Contract expiry)", status: "On", modified: nowIso(-20), createdOn: nowIso(-200), regulatory: true },
    { id: "ret-iso", name: "ISO 27001 evidence - 6 years", type: "Policy", locations: ["SharePoint"], action: "Retain then delete", duration: "6 years", start: "When items were created", status: "On", modified: nowIso(-50), createdOn: nowIso(-200), regulatory: true },
    { id: "ret-shortlived", name: "Short-lived chat - 30 days", type: "Policy", locations: ["Teams chats"], action: "Delete only", duration: "30 days", start: "When items were created", status: "Test", modified: nowIso(-8), createdOn: nowIso(-60), regulatory: false },
    { id: "ret-sales5", name: "Sales records - 5 years", type: "Label", locations: ["Files", "Email"], action: "Retain then delete", duration: "5 years", start: "When items were created", status: "On", modified: nowIso(-15), createdOn: nowIso(-180), regulatory: false },
    { id: "ret-research", name: "Research data - 25 years", type: "Label", locations: ["Files"], action: "Retain (regulatory)", duration: "25 years", start: "When event occurs (Study close)", status: "On", modified: nowIso(-3), createdOn: nowIso(-200), regulatory: true },
    { id: "ret-cust3", name: "Customer support - 3 years", type: "Policy", locations: ["Exchange", "Teams chats"], action: "Retain then delete", duration: "3 years", start: "When items were created", status: "On", modified: nowIso(-40), createdOn: nowIso(-150), regulatory: false },
  ];
}

function buildRecordsPlans(): PurviewRecordsPlan[] {
  return [
    { id: "rp-finance", name: "Finance retention plan", labels: 6, regulatory: true, custodian: "CFO Office" },
    { id: "rp-hr", name: "HR records plan", labels: 4, regulatory: false, custodian: "HR" },
    { id: "rp-legal", name: "Legal & contracts plan", labels: 5, regulatory: true, custodian: "Legal" },
    { id: "rp-research", name: "Research records plan", labels: 3, regulatory: true, custodian: "R&D" },
  ];
}

// Ported from purview-retention.js `getDispositionPending()` — the 3 seeded rows are
// extended to 7 realistic items referencing retention labels + the roster, per the
// task's ask for ~6-8 items (source only had 3; this widens the seed for a fuller
// disposition-review demo surface).
function buildDispositionQueue(): PurviewDispositionItem[] {
  return [
    { id: "disp-1", item: "/sites/Legal/Contract-VendorX-2017.docx", label: "Contracts - 10 years post expiry", location: "SharePoint — Legal Hub", dueOn: nowIso(12), status: "Pending" },
    { id: "disp-2", item: "/sites/Finance/2017-Tax-Filing.pdf", label: "Tax docs - 7 years immutable", location: "SharePoint — Finance Hub", dueOn: nowIso(6), status: "Pending" },
    { id: "disp-3", item: "/sites/HR/Personnel-J.Doe-Termination.docx", label: "HR Personnel - 7 years", location: "SharePoint — HR Hub", dueOn: nowIso(-3), status: "Pending" },
    { id: "disp-4", item: "/personal/lakshmi/Q1-Board-Deck-Archive.pptx", label: "Board minutes - permanent", location: "OneDrive — lakshmi@cloudlab.in", dueOn: nowIso(20), status: "Pending" },
    { id: "disp-5", item: "/sites/Research/Study-2016-CloseOut.xlsx", label: "Research data - 25 years", location: "SharePoint — R&D Hub", dueOn: nowIso(30), status: "Pending" },
    { id: "disp-6", item: "Inbox/Sales-Contract-2019-Renewal.eml", label: "Sales records - 5 years", location: "Exchange — kiran@cloudlab.in", dueOn: nowIso(-1), status: "Pending" },
    { id: "disp-7", item: "/sites/Finance/Treasury-Statements-2016.xlsx", label: "Records - 10 years", location: "SharePoint — Finance Hub", dueOn: nowIso(45), status: "Approved", reviewedBy: "sunita@cloudlab.in", reviewedOn: nowIso(-5) },
  ];
}

// Ported from purview-retention.js seeded `PurviewData.state.adaptiveScopes`.
function buildAdaptiveScopes(): PurviewAdaptiveScope[] {
  return [
    { id: "as-fin", name: "Finance department", type: "User", attribute: "Department", operator: "Equals", value: "Finance", matchedCount: 142 },
    { id: "as-hr", name: "HR mailboxes", type: "User", attribute: "CustomAttribute1", operator: "Equals", value: "HR", matchedCount: 38 },
    { id: "as-india", name: "India sites", type: "Site", attribute: "Country", operator: "Equals", value: "India", matchedCount: 24 },
    { id: "as-execs", name: "C-suite executives", type: "User", attribute: "JobTitle", operator: "Contains", value: "Chief", matchedCount: 8 },
  ];
}

// ===== eDiscovery (6 cases) =====

function buildEDiscoveryCases(): PurviewEDiscoveryCase[] {
  return [
    {
      id: "ed-lit26001", name: "Litigation-2026-001 — Project Helix", tier: "Premium", status: "Active",
      caseNumber: "LIT-2026-001", createdBy: "sunita@cloudlab.in", createdOn: nowIso(-110),
      investigators: ["sunita@cloudlab.in", "partner.auditor@deloitte.example"],
      custodians: [
        { upn: "amit@cloudlab.in", sources: ["Mailbox", "OneDrive", "Teams"], status: "On hold" },
        { upn: "lakshmi@cloudlab.in", sources: ["Mailbox", "OneDrive"], status: "On hold" },
        { upn: "preeti@cloudlab.in", sources: ["Mailbox", "Teams"], status: "On hold" },
        { upn: "ravi@cloudlab.in", sources: ["Mailbox"], status: "Released" },
      ],
      holds: [{ name: "Hold-all-finance-custodians", locations: "Custodian mailboxes + OneDrive + Teams", placed: nowIso(-100), itemCount: 18450, status: "On" }],
      searches: [
        { id: "srch-1", name: "Contract terms - Project Helix", query: '"Project Helix" AND ("contract" OR "termination" OR "termination fee")', locations: "All custodians", dateRange: "2025-06-01 to 2025-12-31", items: 412, sizeMB: 84 },
        { id: "srch-2", name: "Communications with vendor X", query: "from:vendorx.example", locations: "Mailboxes", dateRange: "2025-06-01 to 2026-03-31", items: 263, sizeMB: 22 },
      ],
      exports: [{ id: "exp-1", name: "Export-Helix-PSTs", status: "Completed", sizeMB: 84, items: 412, exportKey: "pk-LIT26001-9c3e-aa1f", exportedOn: nowIso(-30) }],
      notifications: [{ id: "n1", subject: "Legal Hold Notice - Litigation 2026-001", to: "All Finance-Team custodians", sentOn: nowIso(-100), status: "Acknowledged 4 of 4" }],
    },
    {
      id: "ed-hr26007", name: "HR-Investigation-2026-007", tier: "Standard", status: "Active",
      caseNumber: "HR-2026-007", createdBy: "aarti@cloudlab.in", createdOn: nowIso(-32),
      investigators: ["aarti@cloudlab.in", "sunita@cloudlab.in"],
      custodians: [{ upn: "sandeep@cloudlab.in", sources: ["Mailbox", "OneDrive"], status: "On hold" }],
      holds: [{ name: "HR-007 subject hold", locations: "Mailbox + OneDrive", placed: nowIso(-30), itemCount: 6132, status: "On" }],
      searches: [{ id: "srch-1", name: "HR sensitive keywords", query: '"harassment" OR "complaint" OR "grievance"', locations: "Subject mailbox", dateRange: "2025-12-01 to 2026-05-22", items: 47, sizeMB: 4 }],
      exports: [],
      notifications: [{ id: "n1", subject: "Confidential — HR Investigation Notice", to: "sandeep@cloudlab.in", sentOn: nowIso(-30), status: "Read" }],
    },
    {
      id: "ed-audq3", name: "Compliance-Audit-Q3 — SOX evidence", tier: "Standard", status: "Closing",
      caseNumber: "AUD-2026-Q3", createdBy: "sunita@cloudlab.in", createdOn: nowIso(-95),
      investigators: ["sunita@cloudlab.in", "vivek@cloudlab.in", "amit@cloudlab.in"],
      custodians: [],
      holds: [],
      searches: [{ id: "srch-1", name: "SOX controls Q3 evidence", query: 'subject:"SOX evidence Q3" OR label:"Financial Data" AND from:Finance-Team', locations: "Finance-Team mailboxes + Finance Hub SharePoint site", dateRange: "2025-07-01 to 2025-09-30", items: 1820, sizeMB: 165 }],
      exports: [{ id: "exp-1", name: "Q3-SOX-evidence", status: "Completed", sizeMB: 165, items: 1820, exportKey: "pk-AUDQ3-7b1d-2eaa", exportedOn: nowIso(-60) }],
      notifications: [],
    },
    {
      id: "ed-anti", name: "Anti-Trust-Review (Sales pricing)", tier: "Premium", status: "Active",
      caseNumber: "ANT-2026-002", createdBy: "sunita@cloudlab.in", createdOn: nowIso(-60),
      investigators: ["sunita@cloudlab.in", "partner.auditor@deloitte.example"],
      custodians: [
        { upn: "arjun@cloudlab.in", sources: ["Mailbox", "OneDrive", "Teams"], status: "On hold" },
        { upn: "rahul@cloudlab.in", sources: ["Mailbox", "Teams"], status: "On hold" },
        { upn: "kiran@cloudlab.in", sources: ["Mailbox", "Teams"], status: "On hold" },
      ],
      holds: [{ name: "Sales-Team communications hold", locations: "Mailboxes + Teams", placed: nowIso(-58), itemCount: 24812, status: "On" }],
      searches: [{ id: "srch-1", name: "Competitor mentions", query: '"competitor X" OR "pricing collusion" OR "MFN clause"', locations: "All custodians", dateRange: "2024-01-01 to 2026-04-30", items: 1142, sizeMB: 311 }],
      exports: [],
      notifications: [{ id: "n1", subject: "Legal Hold - Anti-Trust Review", to: "arjun + rahul + kiran (Sales leadership)", sentOn: nowIso(-58), status: "Acknowledged 3 of 3" }],
    },
    {
      id: "ed-internal", name: "Internal-Investigation — break-glass usage", tier: "Premium", status: "Active",
      caseNumber: "INT-2026-014", createdBy: "vivek@cloudlab.in", createdOn: nowIso(-18),
      investigators: ["vivek@cloudlab.in", "naveen@cloudlab.in"],
      custodians: [{ upn: "breakglass-01@cloudlab.in", sources: ["Mailbox (none)", "Sign-in logs", "Audit logs"], status: "On hold (logs only)" }],
      holds: [{ name: "Break-glass audit hold", locations: "Sign-in + Audit logs only", placed: nowIso(-18), itemCount: 9230, status: "On" }],
      searches: [{ id: "srch-1", name: "breakglass-01 sign-in trail", query: 'UserId == "breakglass-01@cloudlab.in"', locations: "Defender + Sign-in logs", dateRange: "2026-05-01 to 2026-05-26", items: 12, sizeMB: 1 }],
      exports: [],
      notifications: [],
    },
    {
      id: "ed-ip", name: "IP-Theft (source code)", tier: "Premium", status: "Active",
      caseNumber: "IPT-2026-003", createdBy: "vivek@cloudlab.in", createdOn: nowIso(-9),
      investigators: ["vivek@cloudlab.in", "sunita@cloudlab.in", "karthik@cloudlab.in"],
      custodians: [{ upn: "guest-deloitte-01@cloudlab.in", sources: ["Mailbox", "OneDrive", "SharePoint sites accessed"], status: "On hold" }],
      holds: [{ name: "IP-Theft hold (B2B guest)", locations: "Mailbox + OneDrive + Engineering SP access", placed: nowIso(-9), itemCount: 5604, status: "On" }],
      searches: [{ id: "srch-1", name: "Source code exfiltration attempt", query: 'extension:(cs OR py OR ts OR java OR swift) AND ("upload" OR "external") AND user:guest-deloitte-01', locations: "Subject sources + Engineering Hub SharePoint", dateRange: "2026-05-15 to 2026-05-26", items: 88, sizeMB: 14 }],
      exports: [],
      notifications: [{ id: "n1", subject: "IP-Theft Hold Notice", to: "guest-deloitte-01@cloudlab.in + sponsor sunita", sentOn: nowIso(-9), status: "Sent" }],
    },
  ];
}

// ===== Audit (240 events, deterministic timestamps via seeded PRNG) =====

const ACTIVITIES: string[] = [
  "UserLoggedIn", "UserLoginFailed", "FileAccessed", "FileDownloaded", "FileUploaded",
  "FileDeleted", "FileShared", "FilePreviewed", "FileModified", "FileCopied",
  "SiteCreated", "SiteDeleted", "SiteCollectionAdminAdded", "GroupAdded", "GroupRemoved",
  "MailboxLogin", "MailRead", "MailItemsAccessed", "Send", "SendOnBehalf",
  "AdminRoleAssigned", "AdminRoleRemoved", "DLPRuleMatch", "DLPInfo", "SearchCreated",
  "SearchExported", "CaseAdded", "HoldCreated", "HoldRemoved", "LabelApplied",
  "LabelChanged", "LabelRemoved",
];
const WORKLOADS: string[] = ["Exchange", "SharePoint", "OneDrive", "AzureActiveDirectory", "MicrosoftTeams", "SecurityComplianceCenter", "Endpoint"];

const SAMPLE_USERS: string[] = USER_ROSTER.map(([id]) => `${id}@${TENANT.publicDomain}`);

const SAMPLE_ITEMS: string[] = [
  "/sites/Finance/Earnings-Q4.xlsx", "/personal/ankit/2024-budget.pptx",
  "/sites/Legal/Contract-VendorX.docx", "/personal/ravi/source-code.zip",
  "Inbox/Confidential Project Helix.eml", "/sites/HR/Personnel-Files.docx",
  "/sites/IT/Network-Diagram.vsdx", "/personal/priya/Customer-List.xlsx",
  "Sent Items/Re: Pricing strategy.eml", "/sites/Board/Q3-Minutes.pdf",
];

// Ported from purview-data.js `buildAuditEvents()`, but source's per-event jitter
// (`Math.floor(Math.random() * 4)`) is replaced with a seeded PRNG draw so 240
// events get stable, reproducible timestamps within a session (matching the
// AVD/Defender/Sentinel seed-builder precedent — no Math.random() anywhere here).
function buildAuditEvents(): PurviewAuditEvent[] {
  const rand = rng(4242);
  const events: PurviewAuditEvent[] = [];
  const n = 240;
  for (let i = 0; i < n; i++) {
    const d = new Date();
    const jitterHours = Math.floor(rand() * 4);
    d.setHours(d.getHours() - i * 2 - jitterHours);
    const act = ACTIVITIES[i % ACTIVITIES.length];
    const u = SAMPLE_USERS[i % SAMPLE_USERS.length];
    const w = WORKLOADS[i % WORKLOADS.length];
    const item = SAMPLE_ITEMS[i % SAMPLE_ITEMS.length];
    events.push({
      id: `evt-${10000 + i}`,
      ts: d.toISOString(),
      user: u,
      activity: act,
      item,
      workload: w,
      ip: `203.0.113.${(i % 200) + 1}`,
      clientApp: i % 3 === 0 ? "Outlook" : i % 3 === 1 ? "OneDrive sync" : "Web browser",
      result: act.indexOf("Failed") !== -1 ? "Failure" : "Success",
      details: {
        correlationId: `corr-${50000 + i}`,
        sessionId: `sess-${i % 60}`,
        appId: i % 4 === 0 ? "d3590ed6-52b3-4102-aeff-aad2292ab01c" : "00000003-0000-0ff1-ce00-000000000000",
        siteUrl: w === "SharePoint" || w === "OneDrive" ? `https://cloudlab.sharepoint.com${item}` : null,
      },
    });
  }
  return events;
}

function buildAuditSavedSearches(): PurviewAuditSavedSearch[] {
  return [
    { id: "ss-1", name: "Failed sign-ins last 7 days", query: "activity=UserLoginFailed", range: "7d", createdOn: nowIso(-5) },
    { id: "ss-2", name: "eDiscovery exports last 30 days", query: "activity=SearchExported", range: "30d", createdOn: nowIso(-20) },
    { id: "ss-3", name: "External sharing - SharePoint", query: "activity=FileShared workload=SharePoint", range: "90d", createdOn: nowIso(-30) },
  ];
}

// Ported from purview-data.js `buildContentSearch()`.
function buildContentSearch(): PurviewContentSearchRow[] {
  const rows: PurviewContentSearchRow[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    rows.push({
      id: `cs-${1000 + i}`,
      subject: `Item match #${i + 1} - ${i % 2 === 0 ? "Customer data found" : "Contract clause"}`,
      sender: SAMPLE_USERS[i % SAMPLE_USERS.length],
      receivedOn: d.toISOString(),
      location: i % 2 === 0 ? "Exchange" : "SharePoint",
      sizeKB: 12 + i * 7,
      preview: `Match found for keyword "confidential" in document body. Highlighted on line ${((i * 13) % 200) + 1}.`,
    });
  }
  return rows;
}

// ===== Communication compliance (canonical: 6 policies, 6 alerts, 9 classifiers) =====
// Ported from purview-comm-compliance.js `ensure()` seed (the canonical shape per
// types.ts — the legacy 5-item `commCompliance` array from purview-data.js is
// dropped entirely, matching the task's instruction).

function buildCcPolicies(): PurviewCcPolicy[] {
  return [
    { id: "pol-1", name: "Inappropriate content - global", template: "Inappropriate content", scope: "All users (12,420)", classifiers: ["cls-threat", "cls-harass", "cls-discrim", "cls-profanity"], status: "Active", matchesLast30d: 487 },
    { id: "pol-2", name: "Sensitive info leak - Finance", template: "Sensitive information", scope: "Finance department (847)", classifiers: ["cls-pii"], status: "Active", matchesLast30d: 1428 },
    { id: "pol-3", name: "Code of conduct", template: "Custom", scope: "All users (12,420)", classifiers: ["cls-harass"], status: "Active", matchesLast30d: 92 },
    { id: "pol-4", name: "Regulated trading desk (MiFID II)", template: "Conflict of interest", scope: "Trading desk (64)", classifiers: ["cls-aml", "cls-stockmanip"], status: "Active", matchesLast30d: 218 },
    { id: "pol-5", name: "Customer abuse - support team", template: "Customer complaints", scope: "Support team (380)", classifiers: ["cls-profanity", "cls-complaints"], status: "Active", matchesLast30d: 47 },
    { id: "pol-6", name: "HR investigations", template: "Custom", scope: "HR group (52)", classifiers: [], status: "Disabled", matchesLast30d: 0 },
  ];
}

function buildCcAlerts(): PurviewCcAlert[] {
  return [
    {
      id: "A-2811", policyId: "pol-2", severity: "High", status: "New", user: "jaya@cloudlab.in",
      hits: "PAN + bank routing", detectedOn: nowIso(0), reviewer: null, notes: [],
    },
    {
      id: "A-2810", policyId: "pol-1", severity: "High", status: "In review", user: "kavita@cloudlab.in",
      hits: "Harassment classifier (0.91)", detectedOn: nowIso(0), reviewer: "aarti@cloudlab.in", notes: [],
    },
    {
      id: "A-2809", policyId: "pol-4", severity: "High", status: "Escalated", user: "ravi@cloudlab.in",
      hits: "Insider-trading classifier (0.83)", detectedOn: nowIso(0), reviewer: "sunita@cloudlab.in",
      notes: [{ id: "note-1", author: "sunita@cloudlab.in", text: "Escalated — material non-public info exposure suspected.", time: nowIso(0) }],
    },
    {
      id: "A-2808", policyId: "pol-3", severity: "Medium", status: "New", user: "sandeep@cloudlab.in",
      hits: "IP protection keywords", detectedOn: nowIso(0), reviewer: null, notes: [],
    },
    {
      id: "A-2807", policyId: "pol-5", severity: "Low", status: "Resolved", user: "priya@cloudlab.in",
      hits: "Profanity classifier (0.89)", detectedOn: nowIso(0), reviewer: "pooja@cloudlab.in",
      notes: [{ id: "note-1", author: "pooja@cloudlab.in", text: "False positive — internal joke, customer is a friend.", time: nowIso(0) }],
    },
    {
      id: "A-2806", policyId: "pol-2", severity: "High", status: "In review", user: "lakshmi@cloudlab.in",
      hits: "Revenue projection text", detectedOn: nowIso(0), reviewer: "sunita@cloudlab.in",
      notes: [{ id: "note-1", author: "sunita@cloudlab.in", text: "Sent code-of-conduct refresher to user.", time: nowIso(0) }],
    },
  ];
}

function buildClassifiers(): PurviewClassifier[] {
  return [
    { id: "cls-threat", name: "Threat", category: "Behavioral", description: "Threats of violence, theft, or property damage." },
    { id: "cls-harass", name: "Harassment", category: "Behavioral", description: "Offensive language directed at individuals or groups." },
    { id: "cls-discrim", name: "Discrimination", category: "Behavioral", description: "Discriminatory speech based on protected categories." },
    { id: "cls-profanity", name: "Profanity", category: "Behavioral", description: "Profane language." },
    { id: "cls-adult", name: "Adult / Racy / Gory", category: "Visual", description: "Adult content in images and links." },
    { id: "cls-complaints", name: "Customer complaints", category: "Support", description: "Support escalation tone." },
    { id: "cls-pii", name: "Sensitive info (PCI/PII/PHI)", category: "Data protection", description: "Built-in 200+ sensitive information types." },
    { id: "cls-aml", name: "Money laundering (financial)", category: "Regulatory", description: "MiFID II / SOX-flagged language." },
    { id: "cls-stockmanip", name: "Stock manipulation", category: "Regulatory", description: "Insider trading / front-running language." },
  ];
}

// ===== Insider risk management (canonical: 6 policies, 6 cases, indicators) =====
// Ported from purview-irm.js seed data. `pseudonym()` (imported from irm-engine.ts,
// the single source of truth for that helper) is ported faithfully from
// purview-advanced.js — the only place source implements a real deterministic
// hash-based derivation (purview-irm.js itself only hardcodes literal pseudonym
// strings in its CASES array). Re-exported here for convenience since callers of
// this module previously imported it from seedData.ts.
export { pseudonym };

function buildIrmIndicators(): PurviewIrmIndicator[] {
  return [
    // Office indicators (M365)
    { id: "i-ext-email", name: "Sending emails with attachments to recipients outside the organization", group: "Office", weight: 4 },
    { id: "i-spo-dl", name: "Downloading files from SharePoint Online to a device", group: "Office", weight: 3 },
    { id: "i-spo-share", name: "Sharing files and folders with people outside the organization", group: "Office", weight: 5 },
    { id: "i-fwd-email", name: "Forwarding emails to a personal address", group: "Office", weight: 6 },
    { id: "i-label-external", name: "Sending file with sensitivity label to external domain", group: "Office", weight: 7 },
    // Device indicators (Defender for Endpoint)
    { id: "i-usb-copy", name: "Copying files to a removable device", group: "Device", weight: 7 },
    { id: "i-print-mass", name: "Printing documents", group: "Device", weight: 3 },
    { id: "i-cloud-up", name: "Uploading files to a cloud storage service (Dropbox, personal OneDrive, Google Drive)", group: "Device", weight: 8 },
    { id: "i-browser-up", name: "Using a browser to upload files", group: "Device", weight: 4 },
    { id: "i-rename", name: "Renaming files with sensitivity-label keywords", group: "Device", weight: 6 },
    { id: "i-usb-unauth", name: "Plugging in unauthorized USB devices", group: "Device", weight: 5 },
    // Defender for Cloud Apps indicators
    { id: "i-anon-ip", name: "Login from anonymous IP (TOR)", group: "Defender for Cloud Apps", weight: 8 },
    { id: "i-imp-travel", name: "Impossible travel", group: "Defender for Cloud Apps", weight: 7 },
    { id: "i-rare-country", name: "Activity from infrequent country", group: "Defender for Cloud Apps", weight: 5 },
    { id: "i-mass-dl", name: "Mass download / mass deletion in SaaS", group: "Defender for Cloud Apps", weight: 8 },
    { id: "i-post-offboard", name: "Activity from terminated user (post-offboarding)", group: "Defender for Cloud Apps", weight: 10 },
    // Risk score boosters
    { id: "i-repeat", name: "Repeat offender history (cumulative)", group: "Risk score booster", weight: 6 },
    { id: "i-sensitivity", name: "Sensitivity-label content (Confidential / Highly Confidential)", group: "Risk score booster", weight: 5 },
    { id: "i-after-hours", name: "After-hours activity (outside 7-21 local time)", group: "Risk score booster", weight: 3 },
    { id: "i-volume", name: "Activity volume above 90th percentile of peer group", group: "Risk score booster", weight: 4 },
    { id: "i-hr-flag", name: "HR-flagged disgruntled status (HRIS integration)", group: "Risk score booster", weight: 9 },
    { id: "i-pip", name: "Recent performance review on PIP", group: "Risk score booster", weight: 6 },
  ];
}

function buildIrmPolicies(): PurviewIrmPolicy[] {
  return [
    { id: "irmp-1", name: "Data theft by departing users", template: "Data theft by departing users", priority: "Standard", usersInScope: 5, alertsLast90d: 23, status: "Active", indicatorIds: ["i-usb-copy", "i-cloud-up", "i-print-mass", "i-fwd-email", "i-post-offboard"] },
    { id: "irmp-2", name: "Data leaks", template: "Data leaks", priority: "Standard", usersInScope: 240, alertsLast90d: 41, status: "Active", indicatorIds: ["i-ext-email", "i-spo-share", "i-label-external", "i-fwd-email"] },
    { id: "irmp-3", name: "Data leaks by priority users", template: "Data leaks by priority users", priority: "Users with elevated risk", usersInScope: 28, alertsLast90d: 8, status: "Active", indicatorIds: ["i-ext-email", "i-label-external", "i-cloud-up", "i-repeat", "i-sensitivity"] },
    { id: "irmp-4", name: "Security policy violations", template: "Security policy violations", priority: "Standard", usersInScope: 12420, alertsLast90d: 12, status: "Active", indicatorIds: ["i-anon-ip", "i-usb-unauth", "i-rare-country"] },
    { id: "irmp-5", name: "Patient data misuse (HIPAA)", template: "Healthcare HIPAA", priority: "Users with elevated risk", usersInScope: 4200, alertsLast90d: 6, status: "Active", indicatorIds: ["i-mass-dl", "i-after-hours", "i-volume"] },
    { id: "irmp-6", name: "Risky AI usage", template: "Risky AI usage", priority: "Standard", usersInScope: 12420, alertsLast90d: 14, status: "Active", indicatorIds: ["i-label-external", "i-browser-up", "i-volume"] },
  ];
}

function buildIrmCases(): PurviewIrmCase[] {
  const historyFor = (opened: string, policyName: string, assignee: string, alertsLinked: number, activities: number, riskLevel: string) => [
    { id: "h-1", time: `${opened}T09:00:00.000Z`, label: `Case opened — risk score crossed threshold (${riskLevel})` },
    { id: "h-2", time: `${opened}T09:14:00.000Z`, label: `Linked ${alertsLinked} alert(s) from policy: ${policyName}` },
    { id: "h-3", time: `${opened}T09:31:00.000Z`, label: `Initial triage — confirmed activities span ${activities} events.` },
    { id: "h-4", time: `${opened}T14:22:00.000Z`, label: `Assigned to ${assignee}` },
  ];

  return [
    {
      id: "C-1042", policyId: "irmp-1", upn: "sandeep@cloudlab.in", riskScore: 32, riskLevel: "High", status: "Active",
      openedOn: "2026-05-14", realNameRevealed: false,
      triggeredIndicatorIds: ["i-usb-copy", "i-cloud-up", "i-print-mass", "i-after-hours", "i-repeat"],
      history: historyFor("2026-05-14", "Data theft by departing users", "naveen@cloudlab.in", 6, 47, "High"),
      notes: [],
    },
    {
      id: "C-1041", policyId: "irmp-2", upn: "kavita@cloudlab.in", riskScore: 22, riskLevel: "Medium", status: "Active",
      openedOn: "2026-05-13", realNameRevealed: false,
      triggeredIndicatorIds: ["i-spo-share", "i-fwd-email", "i-ext-email"],
      history: historyFor("2026-05-13", "Data leaks", "jaya@cloudlab.in", 4, 28, "Medium"),
      notes: [],
    },
    {
      id: "C-1040", policyId: "irmp-3", upn: "lakshmi@cloudlab.in", riskScore: 47, riskLevel: "Critical", status: "Escalated to investigation",
      openedOn: "2026-05-12", realNameRevealed: true,
      triggeredIndicatorIds: ["i-ext-email", "i-label-external", "i-cloud-up", "i-repeat", "i-sensitivity", "i-hr-flag", "i-anon-ip"],
      history: historyFor("2026-05-12", "Data leaks by priority users", "sunita@cloudlab.in", 12, 84, "Critical"),
      notes: [{ id: "n-1", author: "sunita@cloudlab.in", text: "Escalated to Legal + HR.", time: "2026-05-15T10:00:00.000Z" }],
    },
    {
      id: "C-1039", policyId: "irmp-4", upn: "rahul@cloudlab.in", riskScore: 13, riskLevel: "Medium", status: "Active",
      openedOn: "2026-05-11", realNameRevealed: false,
      triggeredIndicatorIds: ["i-anon-ip", "i-rare-country"],
      history: historyFor("2026-05-11", "Security policy violations", "unassigned", 3, 19, "Medium"),
      notes: [],
    },
    {
      id: "C-1038", policyId: "irmp-5", upn: "aarti@cloudlab.in", riskScore: 19, riskLevel: "Medium", status: "Active",
      openedOn: "2026-05-10", realNameRevealed: false,
      triggeredIndicatorIds: ["i-mass-dl", "i-after-hours", "i-volume"],
      history: historyFor("2026-05-10", "Patient data misuse (HIPAA)", "aarti@cloudlab.in", 5, 32, "Medium"),
      notes: [],
    },
    {
      id: "C-1037", policyId: "irmp-6", upn: "sneha@cloudlab.in", riskScore: 4, riskLevel: "Low", status: "Resolved",
      openedOn: "2026-05-08", realNameRevealed: false,
      triggeredIndicatorIds: ["i-browser-up"],
      history: historyFor("2026-05-08", "Risky AI usage", "jaya@cloudlab.in", 2, 11, "Low"),
      notes: [{ id: "n-1", author: "jaya@cloudlab.in", text: "Resolved — no action. Reviewed, benign use of AI tool.", time: "2026-05-09T11:00:00.000Z" }],
    },
  ];
}

// ===== Compliance Manager (9 assessments with real controls, 5 actions) =====
// Ported from purview-compliance-mgr.js's 9 seeded assessment templates + the
// SAMPLE_CONTROL_TITLES 12-item bank, but instead of a synthesized "done / total"
// string this generates real PurviewControl rows per assessment (id/status/points/
// owner) so computeComplianceScore (compliance-engine.ts) can sum real points
// instead of reading a hardcoded static score.

const SAMPLE_CONTROL_TITLES: string[] = [
  "Multi-factor authentication for admins",
  "Conditional Access for risky sign-ins",
  "Data loss prevention for sensitive types",
  "Sensitivity label encryption for confidential",
  "Audit log retention >= 365 days",
  "Quarterly access reviews on privileged roles",
  "Encryption at rest using FIPS 140-2 keys",
  "Encryption in transit (TLS 1.2+)",
  "Backup with off-site copy + restore test",
  "Endpoint anti-malware on all managed devices",
  "Email anti-phishing policy at Standard or Strict",
  "Vulnerability scanning + patch management",
];

const ASSIGNEES: string[] = ["Compliance team", "InfoSec", "Legal + DPO", "Finance + IT", "Audit Committee", "IT Ops", "Priya Sharma", "Aman Verma", "SecOps", "Healthcare BU", "India Legal"];

type AssessmentSeed = { id: string; name: string; template: string; category: string; totalControls: number; implementedControls: number };

// [id, name, template, category, totalControls (capped at 12 real rows per task),
//  implementedControls] — proportions mirror source's "done / total" ratios
// (e.g. ISO 27001 47/93 ≈ 51% → 6/12; NIST 218/405 ≈ 54% → 6/12, etc.)
const ASSESSMENT_SEEDS: AssessmentSeed[] = [
  { id: "asmt-1", name: "Data Protection Baseline", template: "Microsoft Data Protection Baseline", category: "Global / Industry", totalControls: 12, implementedControls: 8 },
  { id: "asmt-2", name: "ISO/IEC 27001:2022", template: "ISO 27001:2022", category: "Global / Industry", totalControls: 12, implementedControls: 6 },
  { id: "asmt-3", name: "NIST 800-53 Rev 5 (Moderate)", template: "NIST 800-53 Rev 5 Moderate", category: "United States", totalControls: 12, implementedControls: 5 },
  { id: "asmt-4", name: "GDPR — Article 32 Security", template: "EU GDPR", category: "Europe", totalControls: 12, implementedControls: 9 },
  { id: "asmt-5", name: "HIPAA / HITECH (US Healthcare)", template: "HIPAA / HITECH", category: "United States", totalControls: 12, implementedControls: 8 },
  { id: "asmt-6", name: "PCI DSS v4.0", template: "PCI DSS v4.0", category: "Industry vertical", totalControls: 12, implementedControls: 7 },
  { id: "asmt-7", name: "SOC 2 Type II (Security + Availability)", template: "SOC 2 Type II", category: "Industry vertical", totalControls: 12, implementedControls: 8 },
  { id: "asmt-8", name: "CIS Microsoft 365 Foundations v3.0", template: "CIS M365 v3.0", category: "Global / Industry", totalControls: 12, implementedControls: 10 },
  { id: "asmt-9", name: "India DPDP Act 2023", template: "India DPDP Act", category: "APAC", totalControls: 12, implementedControls: 6 },
];

function buildComplianceAssessments(): PurviewAssessment[] {
  return ASSESSMENT_SEEDS.map((seed) => {
    const controls: PurviewControl[] = [];
    for (let i = 0; i < seed.totalControls; i++) {
      const implemented = i < seed.implementedControls;
      controls.push({
        id: `${seed.id}-ctrl-${i + 1}`,
        title: SAMPLE_CONTROL_TITLES[i % SAMPLE_CONTROL_TITLES.length],
        status: implemented ? "Implemented" : i % 5 === 4 ? "Not applicable" : i % 3 === 0 ? "In progress" : "Not started",
        points: 10 + ((i * 7 + seed.totalControls) % 15), // varies 10-24 per control, deterministic per assessment
        owner: ASSIGNEES[(i + seed.id.length) % ASSIGNEES.length],
        testDate: implemented ? nowIso(-(5 + i * 3)) : null,
      });
    }
    return { id: seed.id, name: seed.name, template: seed.template, category: seed.category, controls };
  });
}

function buildComplianceActions(): PurviewImprovementAction[] {
  return [
    { id: "act-1", title: "Require MFA for all admin roles", points: 27, status: "Completed", category: "Protect", assignee: "Priya Sharma", dueOn: nowIso(-25) },
    { id: "act-2", title: "Configure Conditional Access for guest users", points: 18, status: "Completed", category: "Protect", assignee: "Aman Verma", dueOn: nowIso(-21) },
    { id: "act-3", title: "Implement DLP for credit card patterns", points: 22, status: "In progress", category: "Protect", assignee: "Finance + IT", dueOn: nowIso(7) },
    { id: "act-4", title: "Enable Insider Risk Management — data theft template", points: 24, status: "Not started", category: "Detect", assignee: undefined, dueOn: undefined },
    { id: "act-5", title: "Disable basic authentication in Exchange Online", points: 30, status: "Not started", category: "Protect", assignee: undefined, dueOn: undefined },
  ];
}

// ===== Data Map / Data Governance =====
// Ported from purview-data-map.js SOURCES / SCANS / CLASSIFICATIONS (grepped
// sections only, per the task's instruction not to read the whole 976-line file)
// plus a representative slice of GLOSSARY.

function buildDataSources(): PurviewDataSource[] {
  return [
    { id: "ds-1", name: "sql-finance-prod", kind: "Azure SQL Database", assets: 8420, classifiedAssets: 6218, sensitiveTypes: 3, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-2", name: "sql-hr-prod", kind: "Azure SQL Database", assets: 1428, classifiedAssets: 1218, sensitiveTypes: 3, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-3", name: "storage-datalake-corp", kind: "Azure Data Lake Gen2", assets: 484220, classifiedAssets: 442180, sensitiveTypes: 3, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-4", name: "storage-blob-archive", kind: "Azure Blob Storage", assets: 218400, classifiedAssets: 218400, sensitiveTypes: 1, lastScan: nowIso(-1), status: "Registered" },
    { id: "ds-5", name: "aws-redshift-marketing", kind: "Amazon Redshift", assets: 12480, classifiedAssets: 8842, sensitiveTypes: 2, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-6", name: "snowflake-sales", kind: "Snowflake", assets: 28420, classifiedAssets: 21840, sensitiveTypes: 2, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-7", name: "sap-s4hana-prod", kind: "SAP S/4HANA", assets: 142800, classifiedAssets: 84200, sensitiveTypes: 2, lastScan: nowIso(-1), status: "Registered" },
    { id: "ds-8", name: "powerbi-finance", kind: "Power BI tenant", assets: 487, classifiedAssets: 412, sensitiveTypes: 2, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-9", name: "on-prem-fileshare-hr", kind: "File share (SMB)", assets: 84200, classifiedAssets: 42180, sensitiveTypes: 2, lastScan: nowIso(-1), status: "Registered" },
    { id: "ds-10", name: "oracle-erp-legacy", kind: "Oracle Database", assets: 21840, classifiedAssets: 12480, sensitiveTypes: 2, lastScan: nowIso(-1), status: "Registered" },
    { id: "ds-11", name: "m365-sharepoint", kind: "SharePoint Online", assets: 1248220, classifiedAssets: 884420, sensitiveTypes: 3, lastScan: nowIso(0), status: "Registered" },
    { id: "ds-12", name: "gcp-bigquery-analytics", kind: "Google BigQuery", assets: 8842, classifiedAssets: 4218, sensitiveTypes: 2, lastScan: nowIso(-2), status: "Scan failed" },
  ];
}

function buildScanJobs(): PurviewScanJob[] {
  return [
    { id: "scan-1", sourceId: "ds-1", name: "sql-finance-full-weekly", schedule: "Weekly Sunday 02:00 UTC", lastRun: nowIso(0), duration: "14 min", status: "Succeeded" },
    { id: "scan-2", sourceId: "ds-1", name: "sql-finance-incremental", schedule: "Every 6 hours", lastRun: nowIso(0), duration: "3 min", status: "Succeeded" },
    { id: "scan-3", sourceId: "ds-3", name: "storage-datalake-full", schedule: "Monthly 1st Sat 02:00 UTC", lastRun: nowIso(0), duration: "4h 18m", status: "Succeeded" },
    { id: "scan-4", sourceId: "ds-3", name: "storage-datalake-delta", schedule: "Daily 02:00 UTC", lastRun: nowIso(0), duration: "42 min", status: "Succeeded" },
    { id: "scan-5", sourceId: "ds-7", name: "sap-s4hana-discovery", schedule: "Weekly Sat 22:00 UTC", lastRun: nowIso(-1), duration: "2h 42m", status: "Succeeded" },
    { id: "scan-6", sourceId: "ds-12", name: "gcp-bigquery-weekly", schedule: "Weekly Wed 02:00 UTC", lastRun: nowIso(-2), duration: "1h 18m", status: "Failed" },
  ];
}

// Representative ~26-entry slice (per task: "seed a representative ~20-30 entries
// rather than all 200+" of source's built-in classification list, plus the 4 custom
// ones source defines).
function buildClassificationTypes(): PurviewClassificationType[] {
  const builtIn: [string, string][] = [
    ["Australia Tax File Number", "Government identifiers"],
    ["Brazil CPF", "Government identifiers"],
    ["Canada Social Insurance Number", "Government identifiers"],
    ["EU passport number", "Government identifiers"],
    ["France INSEE / Social Security", "Government identifiers"],
    ["India PAN", "Government identifiers"],
    ["India Aadhaar", "Government identifiers"],
    ["UK NINO", "Government identifiers"],
    ["US Social Security Number", "Government identifiers"],
    ["Credit Card Number", "Financial"],
    ["EU debit card number", "Financial"],
    ["IBAN", "Financial"],
    ["SWIFT code", "Financial"],
    ["US Bank Account Number", "Financial"],
    ["India IFSC code", "Financial"],
    ["US ICD-9-CM Diagnostic Code", "Healthcare"],
    ["US ICD-10-CM Diagnostic Code", "Healthcare"],
    ["US DEA Number", "Healthcare"],
    ["NPI (US National Provider Identifier)", "Healthcare"],
    ["Email Address", "Identity / contact"],
    ["Phone Number (International)", "Identity / contact"],
    ["IP Address (IPv4)", "Identity / contact"],
    ["IP Address (IPv6)", "Identity / contact"],
    ["MAC Address", "Identity / contact"],
  ];
  const custom: [string, string, string][] = [
    ["Custom_PCI_Card_Vault_Token", "Custom (corp)", "^TKN-[A-Z0-9]{24}$"],
    ["Custom_Health_MRN", "Custom (corp)", "MRN-[0-9]{8}-[A-Z]{2}"],
    ["Custom_SAP_Trade_Secret", "Custom (corp)", "TS-Project-[A-Z0-9]{6}"],
    ["Custom_M&A_Codename", "Custom (corp)", "\\b(Project\\s)?(Atlas|Helios|Phoenix|Zephyr)\\b"],
  ];

  const types: PurviewClassificationType[] = builtIn.map(([name, category], i) => ({
    id: `sit-${i + 1}`,
    name,
    category,
    builtIn: true,
  }));
  custom.forEach(([name, category, pattern], i) => {
    types.push({ id: `sit-custom-${i + 1}`, name, category, builtIn: false, pattern });
  });
  return types;
}

function buildGlossaryTerms(): PurviewGlossaryTerm[] {
  return [
    { id: "gl-1", name: "ARR (Annual Recurring Revenue)", definition: "Total revenue from subscription contracts annualized; used in SaaS to express contract value. Excludes one-time fees and services revenue.", steward: "CFO office", status: "Approved", linkedAssets: 24 },
    { id: "gl-2", name: "Customer", definition: "Any organization with an active paid contract OR completed billing event in the last 12 months. Distinct from prospect, lead, or churned account.", steward: "Sales Ops", status: "Approved", linkedAssets: 142 },
    { id: "gl-3", name: "NRR (Net Revenue Retention)", definition: "Revenue from existing customers in current period / revenue from same customers in prior period — including expansion, contraction, and churn. Healthy SaaS: 110-130%.", steward: "CFO office", status: "Approved", linkedAssets: 18 },
    { id: "gl-4", name: "PII (Personally Identifiable Information)", definition: "Any data that can identify a natural person. Direct PII = name, government ID, email. Indirect PII = location + age + employer that together identify.", steward: "Legal + DPO", status: "Approved", linkedAssets: 248 },
    { id: "gl-5", name: "PHI (Protected Health Information)", definition: "HIPAA-protected health data. 18 identifiers including name, date, address, phone, fax, email, SSN, MRN. Combined with health condition = PHI.", steward: "Healthcare Compliance", status: "Approved", linkedAssets: 84 },
    { id: "gl-6", name: "Active user", definition: "A user who has performed >= 1 in-product action in the past 30 days. Excludes login-only events.", steward: "Product Analytics", status: "Approved", linkedAssets: 24 },
    { id: "gl-7", name: "GDPR Subject Access Request", definition: "A request from an EU data subject to access, correct, delete, port, or restrict processing of their personal data. Must respond within 30 days.", steward: "Legal + DPO", status: "Approved", linkedAssets: 18 },
    { id: "gl-8", name: "Customer (proposed)", definition: "Includes free-tier users who have completed onboarding and used the product at least twice. UNDER REVIEW — conflicts with Sales Ops definition.", steward: "Marketing", status: "Draft", linkedAssets: 0 },
  ];
}

/**
 * Builds a complete, fully-populated PurviewState — the fresh/seed state for the
 * Purview compliance-portal simulator. Mirrors the seed assembly in purview-data.js
 * plus the canonical shapes from purview-comm-compliance.js, purview-irm.js,
 * purview-compliance-mgr.js, purview-retention.js and purview-data-map.js (see
 * module comments above each builder for provenance). No stored/static compliance
 * score field is seeded — the UI computes it live via compliance-engine.ts.
 */
export function freshPurviewState(): PurviewState {
  return {
    tenant: {
      name: TENANT.companyName,
      domain: "cloudlab.onmicrosoft.com",
      primaryDomain: TENANT.publicDomain,
      tenantId: TENANT.tenantId,
      complianceScore: 67,
      scoreMax: 100,
    },
    sensitivityLabels: buildSensitivityLabels(),
    labelPolicies: buildLabelPolicies(),
    autoLabelingPolicies: buildAutoLabelPolicies(),
    dlpPolicies: buildDlpPolicies(),
    dlpTemplates: DLP_TEMPLATES,
    sitTypes: SIT_TYPES,
    retention: buildRetentionPolicies(),
    recordsPlans: buildRecordsPlans(),
    dispositionQueue: buildDispositionQueue(),
    adaptiveScopes: buildAdaptiveScopes(),
    ediscoveryCases: buildEDiscoveryCases(),
    auditEvents: buildAuditEvents(),
    auditSavedSearches: buildAuditSavedSearches(),
    contentSearch: buildContentSearch(),
    ccPolicies: buildCcPolicies(),
    ccAlerts: buildCcAlerts(),
    classifiers: buildClassifiers(),
    irmIndicators: buildIrmIndicators(),
    irmPolicies: buildIrmPolicies(),
    irmCases: buildIrmCases(),
    complianceAssessments: buildComplianceAssessments(),
    complianceActions: buildComplianceActions(),
    dataSources: buildDataSources(),
    scanJobs: buildScanJobs(),
    classificationTypes: buildClassificationTypes(),
    glossaryTerms: buildGlossaryTerms(),
    users: buildUsers(),
    devices: buildDevices(),
    activityLog: [],
  };
}
