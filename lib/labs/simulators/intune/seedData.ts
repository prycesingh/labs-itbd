import type {
  IntuneApp,
  IntuneAutopilotDevice,
  IntuneAutopilotProfile,
  IntuneCaPolicy,
  IntuneCompliancePolicy,
  IntuneConfigProfile,
  IntuneDevice,
  IntuneGroup,
  IntuneState,
  IntuneUser,
} from "./types";

const USERS: IntuneUser[] = [
  { id: "u1", name: "Alex Johnson", upn: "admin@cloudlab.onmicrosoft.com", department: "IT", licenses: ["Microsoft 365 E5", "Intune Plan 1"] },
  { id: "u2", name: "Priya Patel", upn: "priya@cloudlab.onmicrosoft.com", department: "Finance", licenses: ["Microsoft 365 E3"] },
  { id: "u3", name: "John Smith", upn: "john@cloudlab.onmicrosoft.com", department: "Sales", licenses: ["Microsoft 365 E3"] },
  { id: "u4", name: "Maria Garcia", upn: "maria@cloudlab.onmicrosoft.com", department: "HR", licenses: ["Microsoft 365 E3"] },
  { id: "u5", name: "Rahul Verma", upn: "rahul@cloudlab.onmicrosoft.com", department: "Engineering", licenses: ["Microsoft 365 E5"] },
  { id: "u6", name: "Sarah Johnson", upn: "sarah@cloudlab.onmicrosoft.com", department: "Marketing", licenses: ["Microsoft 365 E3"] },
  { id: "u7", name: "Liu Wei", upn: "liu@cloudlab.onmicrosoft.com", department: "Engineering", licenses: ["Microsoft 365 E5"] },
  { id: "u8", name: "Emma Brown", upn: "emma@cloudlab.onmicrosoft.com", department: "Legal", licenses: ["Microsoft 365 E3"] },
  { id: "u9", name: "Carlos Mendez", upn: "carlos@cloudlab.onmicrosoft.com", department: "Operations", licenses: ["Microsoft 365 E3"] },
  { id: "u10", name: "Anita Desai", upn: "anita@cloudlab.onmicrosoft.com", department: "Support", licenses: ["Microsoft 365 E3"] },
];

const GROUPS: IntuneGroup[] = [
  { id: "g1", name: "All Users", type: "Dynamic", members: 10, description: "Default dynamic group containing all users" },
  { id: "g2", name: "All Devices", type: "Dynamic", members: 30, description: "Default dynamic group containing all enrolled devices" },
  { id: "g3", name: "Corporate Windows", type: "Dynamic", members: 12, description: "All corporate-owned Windows devices" },
  { id: "g4", name: "Sales Team", type: "Assigned", members: 4, description: "Sales department members" },
  { id: "g5", name: "Engineering", type: "Assigned", members: 3, description: "Engineering team members" },
  { id: "g6", name: "Executive Devices", type: "Assigned", members: 5, description: "Devices issued to executives" },
  { id: "g7", name: "Autopilot Pilot", type: "Assigned", members: 8, description: "Pilot Autopilot deployment ring" },
  { id: "g8", name: "iOS Devices", type: "Dynamic", members: 6, description: "All iOS/iPadOS devices" },
  { id: "g9", name: "macOS Devices", type: "Dynamic", members: 4, description: "All macOS devices" },
  { id: "g10", name: "Android Devices", type: "Dynamic", members: 4, description: "All Android devices" },
];

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

function buildDevices(): IntuneDevice[] {
  const list: IntuneDevice[] = [];

  const win: [string, string, string, string, IntuneDevice["ownership"], IntuneDevice["joinType"], IntuneDevice["compliance"], string, number][] = [
    ["CL-LAPTOP-001", "u1", "Latitude 7440", "Dell", "Corporate", "Entra joined", "Compliant", "BitLocker On", 30],
    ["CL-LAPTOP-002", "u2", "EliteBook 840 G10", "HP", "Corporate", "Entra hybrid joined", "Compliant", "BitLocker On", 90],
    ["CL-LAPTOP-003", "u3", "ThinkPad X1 Carbon", "Lenovo", "Corporate", "Entra joined", "Not compliant", "BitLocker Off", 45],
    ["CL-LAPTOP-004", "u4", "Surface Laptop 6", "Microsoft", "Corporate", "Entra joined", "Compliant", "BitLocker On", 14],
    ["CL-LAPTOP-005", "u5", "Latitude 5540", "Dell", "Corporate", "Entra joined", "In grace period", "BitLocker On", 7],
    ["CL-DESK-001", "u6", "OptiPlex 7010", "Dell", "Corporate", "Entra hybrid joined", "Compliant", "BitLocker On", 120],
    ["CL-DESK-002", "u7", "EliteDesk 800 G9", "HP", "Corporate", "Entra hybrid joined", "Compliant", "BitLocker On", 180],
    ["CL-LAPTOP-006", "u8", "Surface Pro 10", "Microsoft", "Corporate", "Entra joined", "Compliant", "BitLocker On", 21],
    ["CL-LAPTOP-007", "u9", "XPS 15", "Dell", "Corporate", "Entra joined", "Not evaluated", "BitLocker Off", 3],
    ["CL-LAPTOP-008", "u10", "ThinkPad T14", "Lenovo", "Corporate", "Entra joined", "Compliant", "BitLocker On", 60],
    ["CL-LAPTOP-009", "u1", "Latitude 7350", "Dell", "Personal", "Entra registered", "Compliant", "BitLocker On", 50],
    ["CL-LAPTOP-010", "u3", "EliteBook 845 G11", "HP", "Corporate", "Entra joined", "Not compliant", "BitLocker Off", 10],
  ];
  win.forEach(([name, user, model, mfg, ownership, joinType, compliance, enc, enroll], i) => {
    list.push({
      id: `dev-w${i + 1}`,
      name,
      platform: "Windows",
      os: "Windows 11",
      osVersion: "10.0.22631.4317",
      manufacturer: mfg,
      model,
      serial: `CLW${10000 + i}`,
      primaryUser: user,
      ownership,
      joinType,
      managedBy: "Intune",
      compliance,
      encryption: enc,
      lastCheckIn: hoursAgo(2 + i),
      enrollmentDate: daysAgo(enroll),
      imei: "",
      wifi: `AA:BB:CC:${(10 + i).toString(16).toUpperCase()}:22:33`,
      ram: "16 GB",
      storage: "512 GB",
      cpu: "Intel Core i7",
    });
  });

  const ios: [string, string, string, IntuneDevice["ownership"], IntuneDevice["compliance"], string][] = [
    ["iPhone-Priya", "u2", "iPhone 15 Pro", "Corporate", "Compliant", "17.5.1"],
    ["iPad-Sarah", "u6", 'iPad Pro 13"', "Corporate", "Compliant", "17.5.1"],
    ["iPhone-John", "u3", "iPhone 14", "Personal", "Not compliant", "16.7.8"],
    ["iPad-Maria", "u4", "iPad Air", "Corporate", "Compliant", "17.5.1"],
    ["iPhone-Emma", "u8", "iPhone 15", "Corporate", "Compliant", "17.5.1"],
    ["iPhone-Ankit", "u1", "iPhone 15 Pro Max", "Corporate", "In grace period", "17.4.1"],
  ];
  ios.forEach(([name, user, model, ownership, compliance, osVer], j) => {
    list.push({
      id: `dev-i${j + 1}`,
      name,
      platform: model.startsWith("iPad") ? "iPadOS" : "iOS",
      os: model.startsWith("iPad") ? "iPadOS" : "iOS",
      osVersion: osVer,
      manufacturer: "Apple",
      model,
      serial: `CLI${20000 + j}`,
      primaryUser: user,
      ownership,
      joinType: "Entra registered",
      managedBy: "Intune",
      compliance,
      encryption: "Device encryption On",
      lastCheckIn: hoursAgo(3 + j),
      enrollmentDate: daysAgo(15 + j * 7),
      imei: `35${1000000000000 + j}`,
      wifi: `F0:18:98:${(j + 10).toString(16).toUpperCase()}:AA:11`,
      ram: model.includes("Pro") ? "8 GB" : "6 GB",
      storage: "256 GB",
      cpu: "Apple Silicon",
    });
  });

  const mac: [string, string, string, string, IntuneDevice["ownership"], IntuneDevice["compliance"]][] = [
    ["MBP-Liu", "u7", 'MacBook Pro 14"', "14.5", "Corporate", "Compliant"],
    ["MBP-Carlos", "u9", 'MacBook Pro 16"', "14.5", "Corporate", "Compliant"],
    ["iMac-Design", "u6", 'iMac 24"', "14.4", "Corporate", "Not compliant"],
    ["MBA-Anita", "u10", 'MacBook Air 15"', "14.5", "Personal", "Compliant"],
  ];
  mac.forEach(([name, user, model, osVer, ownership, compliance], k) => {
    list.push({
      id: `dev-m${k + 1}`,
      name,
      platform: "macOS",
      os: "macOS",
      osVersion: osVer,
      manufacturer: "Apple",
      model,
      serial: `CLM${30000 + k}`,
      primaryUser: user,
      ownership,
      joinType: "Entra joined",
      managedBy: "Intune",
      compliance,
      encryption: "FileVault On",
      lastCheckIn: hoursAgo(5 + k),
      enrollmentDate: daysAgo(30 + k * 14),
      imei: "",
      wifi: `3C:22:FB:${(k + 20).toString(16).toUpperCase()}:AB:CD`,
      ram: "16 GB",
      storage: "512 GB",
      cpu: "Apple M3",
    });
  });

  const droid: [string, string, string, string, string, IntuneDevice["ownership"], IntuneDevice["compliance"]][] = [
    ["Galaxy-Rahul", "u5", "Galaxy S24 Ultra", "Samsung", "14", "Corporate", "Compliant"],
    ["Pixel-Sarah", "u6", "Pixel 8 Pro", "Google", "14", "Corporate", "Compliant"],
    ["Galaxy-John", "u3", "Galaxy A54", "Samsung", "13", "Personal", "Not compliant"],
    ["Pixel-Emma", "u8", "Pixel 7a", "Google", "14", "Corporate", "Compliant"],
  ];
  droid.forEach(([name, user, model, mfg, osVer, ownership, compliance], a) => {
    list.push({
      id: `dev-a${a + 1}`,
      name,
      platform: "Android",
      os: "Android",
      osVersion: osVer,
      manufacturer: mfg,
      model,
      serial: `CLA${40000 + a}`,
      primaryUser: user,
      ownership,
      joinType: "Entra registered",
      managedBy: "Intune",
      compliance,
      encryption: "Device encryption On",
      lastCheckIn: hoursAgo(7 + a),
      enrollmentDate: daysAgo(20 + a * 7),
      imei: `86${200000000000 + a}`,
      wifi: `A0:CC:2B:${(a + 30).toString(16).toUpperCase()}:EF:99`,
      ram: "8 GB",
      storage: "256 GB",
      cpu: "Snapdragon 8 Gen 3",
    });
  });

  const linux: [string, string, string, string, IntuneDevice["compliance"]][] = [
    ["ubuntu-dev-01", "u5", "Generic VM", "22.04 LTS", "Compliant"],
    ["ubuntu-dev-02", "u7", "Generic VM", "22.04 LTS", "Compliant"],
    ["ubuntu-test-01", "u5", "ThinkPad T14", "24.04 LTS", "In grace period"],
    ["ubuntu-test-02", "u7", "Generic Workstation", "22.04 LTS", "Compliant"],
  ];
  linux.forEach(([name, user, model, osVer, compliance], l) => {
    list.push({
      id: `dev-l${l + 1}`,
      name,
      platform: "Linux",
      os: "Ubuntu",
      osVersion: osVer,
      manufacturer: "Generic",
      model,
      serial: `CLL${50000 + l}`,
      primaryUser: user,
      ownership: "Corporate",
      joinType: "Entra registered",
      managedBy: "Intune",
      compliance,
      encryption: "LUKS On",
      lastCheckIn: hoursAgo(9 + l),
      enrollmentDate: daysAgo(25 + l * 10),
      imei: "",
      wifi: `08:00:27:${(l + 40).toString(16).toUpperCase()}:BB:CC`,
      ram: "16 GB",
      storage: "256 GB",
      cpu: "Intel Core i5",
    });
  });

  return list;
}

function buildCompliancePolicies(): IntuneCompliancePolicy[] {
  return [
    { id: "cp1", name: "Windows 11 - Baseline Compliance", platform: "Windows 10 and later", type: "Windows 10/11 compliance policy", assigned: "g1", lastModified: "2026-04-12", settings: { bitlocker: true, secureBoot: true, minOsVersion: "10.0.22000", passwordRequired: true, minPwLength: 8, defenderAtpLevel: "Low" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }, { action: "Send email to end user", scheduleDays: 3 }] },
    { id: "cp2", name: "Windows 11 - Strict (PAW)", platform: "Windows 10 and later", type: "Windows 10/11 compliance policy", assigned: "g3", lastModified: "2026-04-20", settings: { bitlocker: true, secureBoot: true, minOsVersion: "10.0.22631", passwordRequired: true, minPwLength: 14, defenderAtpLevel: "Medium" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }, { action: "Retire noncompliant device", scheduleDays: 14 }] },
    { id: "cp3", name: "iOS - Baseline Compliance", platform: "iOS/iPadOS", type: "iOS compliance policy", assigned: "g8", lastModified: "2026-03-18", settings: { passcodeRequired: true, minPwLength: 6, blockJailbroken: true, minOsVersion: "16.0" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }] },
    { id: "cp4", name: "iOS - Strict (Executives)", platform: "iOS/iPadOS", type: "iOS compliance policy", assigned: "g6", lastModified: "2026-04-22", settings: { passcodeRequired: true, minPwLength: 8, blockJailbroken: true, minOsVersion: "17.0" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }] },
    { id: "cp5", name: "macOS - Baseline Compliance", platform: "macOS", type: "macOS compliance policy", assigned: "g9", lastModified: "2026-04-01", settings: { filevault: true, passwordRequired: true, minPwLength: 8, minOsVersion: "13.0" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }] },
    { id: "cp6", name: "macOS - Strict (Executives)", platform: "macOS", type: "macOS compliance policy", assigned: "g6", lastModified: "2026-04-25", settings: { filevault: true, passwordRequired: true, minPwLength: 12, minOsVersion: "14.0" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }] },
    { id: "cp7", name: "Android - Baseline Compliance", platform: "Android Enterprise", type: "Android compliance policy", assigned: "g10", lastModified: "2026-03-30", settings: { encryptionRequired: true, blockRooted: true, minOsVersion: "12", defenderAtpLevel: "Low" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }] },
    { id: "cp8", name: "Android - Strict (Executives)", platform: "Android Enterprise", type: "Android compliance policy", assigned: "g6", lastModified: "2026-04-28", settings: { encryptionRequired: true, blockRooted: true, minOsVersion: "13", defenderAtpLevel: "Medium" }, nonComplianceActions: [{ action: "Mark device noncompliant", scheduleDays: 0 }] },
  ];
}

function buildConfigProfiles(): IntuneConfigProfile[] {
  return [
    { id: "pr1", name: "Win11 - Endpoint Protection", platform: "Windows 10 and later", type: "Endpoint protection", status: "Assigned", assigned: "g1", lastModified: "2026-04-10", settings: { firewall: true, defenderRealtime: true } },
    { id: "pr2", name: "Win11 - Device Restrictions", platform: "Windows 10 and later", type: "Device restrictions", status: "Assigned", assigned: "g3", lastModified: "2026-04-15", settings: { blockCamera: false, blockCortana: true } },
    { id: "pr3", name: "Corp Wi-Fi (WPA2-Enterprise)", platform: "Windows 10 and later", type: "Wi-Fi", status: "Assigned", assigned: "g1", lastModified: "2026-04-08", settings: { ssid: "CorpWiFi", security: "WPA2-Enterprise" } },
    { id: "pr4", name: "VPN - Always On", platform: "Windows 10 and later", type: "VPN", status: "Assigned", assigned: "g3", lastModified: "2026-04-12", settings: { connectionType: "IKEv2", alwaysOn: true } },
    { id: "pr5", name: "Exchange Online Email Profile", platform: "iOS/iPadOS", type: "Email", status: "Assigned", assigned: "g8", lastModified: "2026-04-03", settings: { server: "outlook.office365.com" } },
    { id: "pr6", name: "SCEP - User Certificate", platform: "Windows 10 and later", type: "SCEP certificate", status: "Assigned", assigned: "g3", lastModified: "2026-03-29", settings: { keySize: 2048, validityDays: 365 } },
    { id: "pr7", name: "Win11 - Identity Protection (Hello)", platform: "Windows 10 and later", type: "Identity protection", status: "Assigned", assigned: "g1", lastModified: "2026-04-18", settings: { helloForBusiness: true, minPinLength: 6 } },
    { id: "pr8", name: "Custom OMA-URI - Disable Cortana", platform: "Windows 10 and later", type: "Custom", status: "Assigned", assigned: "g3", lastModified: "2026-02-25", settings: { omaUri: "./Vendor/MSFT/Policy/Config/Experience/AllowCortana", value: "0" } },
    { id: "pr9", name: "ADMX - Office 365 ProPlus", platform: "Windows 10 and later", type: "Administrative templates", status: "Assigned", assigned: "g1", lastModified: "2026-04-22", settings: { disableUpdates: false } },
    { id: "pr10", name: "Settings catalog - Defender baseline", platform: "Windows 10 and later", type: "Settings catalog", status: "Assigned", assigned: "g1", lastModified: "2026-04-26", settings: { tamperProtection: true } },
    { id: "pr11", name: "PAW Tier-0 Lockdown", platform: "Windows 10 and later", type: "Templates", status: "Assigned", assigned: "g3", lastModified: "2026-05-15", settings: { restrictedAdminMode: true } },
    { id: "pr12", name: "macOS - Device Restrictions", platform: "macOS", type: "Device restrictions", status: "Assigned", assigned: "g9", lastModified: "2026-04-19", settings: { blockAppStore: false } },
  ];
}

function buildApps(): IntuneApp[] {
  return [
    { id: "ap1", name: "Microsoft 365 Apps for Windows", type: "Microsoft 365 Apps (Windows)", platform: "Windows", status: "Published", version: "16.0.17628", assignments: [{ groupId: "g1", intent: "Required" }], description: "Office productivity suite" },
    { id: "ap2", name: "Microsoft 365 Apps for macOS", type: "Microsoft 365 Apps (macOS)", platform: "macOS", status: "Published", version: "16.86", assignments: [{ groupId: "g9", intent: "Required" }], description: "Office productivity suite for Mac" },
    { id: "ap3", name: "Microsoft OneDrive", type: "Microsoft 365 Apps (Windows)", platform: "Windows", status: "Published", version: "24.041.0227", assignments: [{ groupId: "g1", intent: "Required" }], description: "Cloud storage and sync" },
    { id: "ap4", name: "Microsoft Edge for Windows", type: "Microsoft Edge (Windows)", platform: "Windows", status: "Published", version: "125.0.2535", assignments: [{ groupId: "g1", intent: "Required" }], description: "Modern enterprise browser" },
    { id: "ap5", name: "Microsoft Edge for macOS", type: "Microsoft Edge (macOS)", platform: "macOS", status: "Published", version: "125.0.2535", assignments: [{ groupId: "g9", intent: "Required" }], description: "Modern enterprise browser for Mac" },
    { id: "ap6", name: "Microsoft Teams (Work)", type: "Microsoft Store app (new)", platform: "Windows", status: "Published", version: "24112.207", assignments: [{ groupId: "g1", intent: "Required" }], description: "Collaboration and meetings" },
    { id: "ap7", name: "Adobe Acrobat Reader DC", type: "Windows app (Win32)", platform: "Windows", status: "Published", version: "24.002", assignments: [{ groupId: "g1", intent: "Available" }], description: "PDF reader" },
    { id: "ap8", name: "Zoom Workplace", type: "Windows app (Win32)", platform: "Windows", status: "Published", version: "6.0.10", assignments: [{ groupId: "g1", intent: "Available" }], description: "Video conferencing" },
    { id: "ap9", name: "Salesforce Connector", type: "Windows app (Win32)", platform: "Windows", status: "Published", version: "4.38.121", assignments: [{ groupId: "g4", intent: "Required" }], description: "CRM connector for Sales-Team" },
    { id: "ap10", name: "Google Chrome Enterprise", type: "Windows app (Win32)", platform: "Windows", status: "Published", version: "125.0.6422", assignments: [{ groupId: "g1", intent: "Available" }], description: "Browser" },
    { id: "ap11", name: "Microsoft Authenticator (iOS)", type: "iOS store app", platform: "iOS", status: "Published", version: "6.8.10", assignments: [{ groupId: "g8", intent: "Required" }], description: "MFA authenticator" },
    { id: "ap12", name: "Microsoft Outlook (iOS)", type: "iOS store app", platform: "iOS", status: "Published", version: "4.2406.1", assignments: [{ groupId: "g8", intent: "Required" }], description: "Email client for iOS" },
    { id: "ap13", name: "Microsoft Teams (iOS)", type: "iOS store app", platform: "iOS", status: "Published", version: "6.5.2", assignments: [{ groupId: "g8", intent: "Required" }], description: "Teams for iOS" },
    { id: "ap14", name: "Microsoft Authenticator (Android)", type: "Managed Google Play app", platform: "Android", status: "Published", version: "6.2406.4", assignments: [{ groupId: "g10", intent: "Required" }], description: "MFA authenticator" },
    { id: "ap15", name: "Microsoft Outlook (Android)", type: "Managed Google Play app", platform: "Android", status: "Published", version: "4.2406.1", assignments: [{ groupId: "g10", intent: "Required" }], description: "Email client for Android" },
    { id: "ap16", name: "Microsoft Teams (Android)", type: "Managed Google Play app", platform: "Android", status: "Published", version: "1416/1.0", assignments: [{ groupId: "g10", intent: "Required" }], description: "Teams for Android" },
    { id: "ap17", name: "Microsoft Defender for Endpoint (macOS)", type: "Microsoft Defender for Endpoint (macOS)", platform: "macOS", status: "Published", version: "101.24052.0001", assignments: [{ groupId: "g9", intent: "Required" }], description: "Endpoint security" },
    { id: "ap18", name: "Microsoft Defender for Endpoint (Linux)", type: "Microsoft Defender for Endpoint (Linux)", platform: "Linux", status: "Published", version: "101.24052.0001", assignments: [{ groupId: "g1", intent: "Required" }], description: "Endpoint security" },
    { id: "ap19", name: "Company Portal Web Link", type: "Web link", platform: "All", status: "Published", version: "", assignments: [{ groupId: "g1", intent: "Available" }], description: "https://portal.manage.microsoft.com" },
    { id: "ap20", name: "Built-in iBooks (iOS)", type: "Built-in app", platform: "iOS", status: "Published", version: "", assignments: [{ groupId: "g8", intent: "Available" }], description: "iOS built-in Books app" },
    { id: "ap21", name: "Power BI Desktop", type: "Microsoft Store app (new)", platform: "Windows", status: "Published", version: "2.130", assignments: [{ groupId: "g4", intent: "Available" }], description: "Self-service BI (Finance)" },
    { id: "ap22", name: "Visual Studio Code", type: "Windows app (Win32)", platform: "Windows", status: "Published", version: "1.89.1", assignments: [{ groupId: "g5", intent: "Required" }], description: "Source code editor (Engineering)" },
    { id: "ap23", name: "Visual Studio Enterprise 2022", type: "Windows app (Win32)", platform: "Windows", status: "Published", version: "17.10.0", assignments: [{ groupId: "g5", intent: "Required" }], description: "IDE (Engineering)" },
    { id: "ap24", name: "Knox Service Plugin", type: "Android Enterprise system app", platform: "Android", status: "Published", version: "3.10", assignments: [{ groupId: "g10", intent: "Required" }], description: "Samsung Knox management" },
    { id: "ap25", name: "Microsoft Defender (iOS)", type: "iOS store app", platform: "iOS", status: "Published", version: "1.0.5701", assignments: [{ groupId: "g8", intent: "Required" }], description: "Mobile threat defense" },
  ];
}

function buildAutopilotDevices(): IntuneAutopilotDevice[] {
  return [
    { id: "ad1", serial: "AP-00001-DL", mfg: "Dell", model: "Latitude 7440", groupTag: "Pilot", profileStatus: "Assigned", assignedUser: "u1", dateAdded: "2025-03-01" },
    { id: "ad2", serial: "AP-00002-HP", mfg: "HP", model: "EliteBook 840", groupTag: "Pilot", profileStatus: "Assigned", assignedUser: "u2", dateAdded: "2025-03-02" },
    { id: "ad3", serial: "AP-00003-LN", mfg: "Lenovo", model: "ThinkPad X1 Carbon", groupTag: "Production", profileStatus: "Assigned", assignedUser: "u3", dateAdded: "2025-03-04" },
    { id: "ad4", serial: "AP-00004-MS", mfg: "Microsoft", model: "Surface Laptop 6", groupTag: "Executive", profileStatus: "Assigned", assignedUser: "u4", dateAdded: "2025-03-08" },
    { id: "ad5", serial: "AP-00005-DL", mfg: "Dell", model: "XPS 13", groupTag: "Engineering", profileStatus: "Not assigned", assignedUser: "", dateAdded: "2025-04-01" },
    { id: "ad6", serial: "AP-00006-HP", mfg: "HP", model: "EliteBook 845 G11", groupTag: "Production", profileStatus: "Assigned", assignedUser: "u5", dateAdded: "2025-04-12" },
    { id: "ad7", serial: "AP-00007-LN", mfg: "Lenovo", model: "ThinkPad T14", groupTag: "Engineering", profileStatus: "Assigned", assignedUser: "u7", dateAdded: "2025-04-15" },
  ];
}

function buildAutopilotProfiles(): IntuneAutopilotProfile[] {
  return [
    { id: "apr1", name: "AP - User-driven Entra-joined", mode: "User-driven", joinType: "Entra joined", assigned: "g7", skipEula: true, hideAccountOptions: true, userAccountType: "Standard", deviceNameTemplate: "CL-%RAND:5%" },
    { id: "apr2", name: "AP - Self-deploying Kiosks", mode: "Self-deploying", joinType: "Entra joined", assigned: "g7", skipEula: true, hideAccountOptions: true, userAccountType: "Standard", deviceNameTemplate: "KIOSK-%RAND:4%" },
    { id: "apr3", name: "AP - Pre-provisioning IT", mode: "Pre-provisioning", joinType: "Entra joined", assigned: "g7", skipEula: true, hideAccountOptions: false, userAccountType: "Administrator", deviceNameTemplate: "PP-%SERIAL%" },
    { id: "apr4", name: "AP - Hybrid AD-joined", mode: "User-driven", joinType: "Entra hybrid joined", assigned: "g7", skipEula: false, hideAccountOptions: false, userAccountType: "Standard", deviceNameTemplate: "CORP-%RAND:5%" },
    { id: "apr5", name: "AP - Executive devices", mode: "User-driven", joinType: "Entra joined", assigned: "g6", skipEula: true, hideAccountOptions: true, userAccountType: "Standard", deviceNameTemplate: "EXEC-%RAND:4%" },
  ];
}

function buildConditionalAccess(): IntuneCaPolicy[] {
  return [
    {
      id: "ca1", name: "CA001 - Require MFA for all users", state: "On", modified: "2025-03-20",
      users: { includeAll: true, exclude: ["BreakGlass accounts"] },
      apps: { includeAll: true, exclude: [] },
      conditions: { platforms: "Any", locations: "Any", clientApps: "Browser, Mobile and desktop" },
      grant: { block: false, requireMfa: true, requireCompliant: false, requireHybrid: false, requireAppProtection: false },
    },
    {
      id: "ca2", name: "CA002 - Block legacy authentication", state: "On", modified: "2025-03-22",
      users: { includeAll: true, exclude: ["BreakGlass accounts"] },
      apps: { includeAll: true, exclude: [] },
      conditions: { platforms: "Any", locations: "Any", clientApps: "Exchange ActiveSync, Other clients" },
      grant: { block: true, requireMfa: false, requireCompliant: false, requireHybrid: false, requireAppProtection: false },
    },
    {
      id: "ca3", name: "CA003 - Require compliant device for corporate apps", state: "On", modified: "2025-04-04",
      users: { includeAll: true, exclude: ["Guest accounts", "BreakGlass accounts"] },
      apps: { includeAll: false, include: ["Office 365", "Microsoft Intune Enrollment"], exclude: [] },
      conditions: { platforms: "iOS, Android, Windows, macOS", locations: "Any", clientApps: "Mobile and desktop" },
      grant: { block: false, requireMfa: false, requireCompliant: true, requireHybrid: false, requireAppProtection: true },
    },
  ];
}

export function freshIntuneState(): IntuneState {
  return {
    tenant: {
      name: "CloudLab Training Tenant",
      domain: "cloudlab.onmicrosoft.com",
      tenantId: "11111111-2222-3333-4444-555555555555",
      country: "United States",
      adminEmail: "admin@cloudlab.onmicrosoft.com",
    },
    users: USERS,
    groups: GROUPS,
    devices: buildDevices(),
    compliancePolicies: buildCompliancePolicies(),
    configProfiles: buildConfigProfiles(),
    apps: buildApps(),
    autopilotDevices: buildAutopilotDevices(),
    autopilotProfiles: buildAutopilotProfiles(),
    conditionalAccess: buildConditionalAccess(),
    activityLog: [],
  };
}
