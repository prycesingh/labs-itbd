import type { AvdState } from "./types";

const DEFAULT_CUSTOM_RDP =
  "audiocapturemode:i:1;\n" +
  "audiomode:i:0;\n" +
  "videoplaybackmode:i:1;\n" +
  "redirectprinters:i:1;\n" +
  "redirectclipboard:i:1;\n" +
  "redirectcomports:i:0;\n" +
  "redirectsmartcards:i:1;\n" +
  "devicestoredirect:s:*;\n" +
  "drivestoredirect:s:*;\n" +
  "usbdevicestoredirect:s:*;\n" +
  "use multimon:i:1;\n" +
  "enablerdsaadauth:i:1;\n" +
  "targetisaadjoined:i:1";

export function freshAvdState(): AvdState {
  return {
    subscription: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "CloudLab-Training-Sub",
      tenantId: "t1e2n3a4-n5t6-7890-abcd-ef1234567890",
      tenantName: "cloudlab.in",
    },
    regions: [
      "East US", "East US 2", "West US 2", "West US 3", "Central US",
      "North Europe", "West Europe", "UK South",
      "Southeast Asia", "East Asia", "Japan East", "Australia East",
      "Central India", "South India",
    ],
    resourceGroups: [
      { name: "rg-avd-prod", region: "East US" },
      { name: "rg-avd-shared", region: "East US" },
      { name: "rg-avd-network", region: "East US" },
    ],
    images: [
      { id: "win11-multi-23h2", name: "Windows 11 Enterprise multi-session, version 23H2", publisher: "MicrosoftWindowsDesktop", os: "Windows 11 multi-session" },
      { id: "win11-multi-22h2", name: "Windows 11 Enterprise multi-session, version 22H2", publisher: "MicrosoftWindowsDesktop", os: "Windows 11 multi-session" },
      { id: "win10-multi-22h2", name: "Windows 10 Enterprise multi-session, version 22H2", publisher: "MicrosoftWindowsDesktop", os: "Windows 10 multi-session" },
      { id: "win11-ent-23h2", name: "Windows 11 Enterprise, version 23H2", publisher: "MicrosoftWindowsDesktop", os: "Windows 11" },
      { id: "ws2022-dc", name: "Windows Server 2022 Datacenter", publisher: "MicrosoftWindowsServer", os: "Windows Server 2022" },
      { id: "ws2019-dc", name: "Windows Server 2019 Datacenter", publisher: "MicrosoftWindowsServer", os: "Windows Server 2019" },
      { id: "win11-m365", name: "Windows 11 multi-session + Microsoft 365 Apps, 23H2", publisher: "MicrosoftWindowsDesktop", os: "Windows 11 multi-session" },
    ],
    vmSizes: [
      { name: "Standard_D2s_v5", vcpus: 2, ram: 8, cost: 70.08 },
      { name: "Standard_D4s_v5", vcpus: 4, ram: 16, cost: 140.16 },
      { name: "Standard_D8s_v5", vcpus: 8, ram: 32, cost: 280.32 },
      { name: "Standard_D16s_v5", vcpus: 16, ram: 64, cost: 560.64 },
      { name: "Standard_E4s_v5", vcpus: 4, ram: 32, cost: 183.96 },
      { name: "Standard_E8s_v5", vcpus: 8, ram: 64, cost: 367.92 },
      { name: "Standard_NV12s_v3", vcpus: 12, ram: 112, cost: 1095.0 },
    ],
    defaultCustomRdp: DEFAULT_CUSTOM_RDP,
    hostPools: [
      {
        id: "hp-prod-pooled", name: "hp-prod-pooled", resourceGroup: "rg-avd-prod", region: "East US",
        type: "Pooled", loadBalancing: "Breadth-first", maxSessionLimit: 10, assignmentType: "",
        validationEnvironment: false, startVmOnConnect: true, preferredAppGroupType: "Desktop",
        agentVersion: "1.0.8431.2200", customRdpProperty: DEFAULT_CUSTOM_RDP,
        description: "Production pooled host pool for general office workforce.",
        scalingPlans: ["sp-business-hours"], azureStackHci: false,
        tags: { environment: "prod", costCenter: "IT-OPS" }, createdAt: "2025-01-15T09:00:00Z",
      },
      {
        id: "hp-prod-personal", name: "hp-prod-personal", resourceGroup: "rg-avd-prod", region: "East US",
        type: "Personal", loadBalancing: "", maxSessionLimit: 1, assignmentType: "Automatic",
        validationEnvironment: false, startVmOnConnect: true, preferredAppGroupType: "Desktop",
        agentVersion: "1.0.8431.2200", customRdpProperty: DEFAULT_CUSTOM_RDP,
        description: "Personal desktops for developers and engineers.",
        scalingPlans: [], azureStackHci: false,
        tags: { environment: "prod", costCenter: "ENG" }, createdAt: "2025-02-02T10:30:00Z",
      },
    ],
    sessionHosts: [
      { id: "sh-01", name: "avd-vm-prod-01.cloudlab.in", hostPool: "hp-prod-pooled", status: "Available", sessions: 4, disconnectedSessions: 1, allowNewSessions: true, agentVersion: "1.0.8431.2200", os: "Windows 11 multi-session 23H2", lastHeartbeat: "2026-05-14T08:12:00Z", drainMode: false, vmSize: "Standard_D8s_v5" },
      { id: "sh-02", name: "avd-vm-prod-02.cloudlab.in", hostPool: "hp-prod-pooled", status: "Available", sessions: 6, disconnectedSessions: 0, allowNewSessions: true, agentVersion: "1.0.8431.2200", os: "Windows 11 multi-session 23H2", lastHeartbeat: "2026-05-14T08:13:00Z", drainMode: false, vmSize: "Standard_D8s_v5" },
      { id: "sh-03", name: "avd-vm-prod-03.cloudlab.in", hostPool: "hp-prod-pooled", status: "Unavailable", sessions: 0, disconnectedSessions: 0, allowNewSessions: false, agentVersion: "1.0.8431.2200", os: "Windows 11 multi-session 23H2", lastHeartbeat: "2026-05-14T07:42:00Z", drainMode: true, vmSize: "Standard_D8s_v5" },
      { id: "sh-04", name: "avd-vm-prod-04.cloudlab.in", hostPool: "hp-prod-pooled", status: "Upgrading", sessions: 0, disconnectedSessions: 0, allowNewSessions: false, agentVersion: "1.0.8665.1400", os: "Windows 11 multi-session 23H2", lastHeartbeat: "2026-05-14T08:00:00Z", drainMode: false, vmSize: "Standard_D8s_v5" },
      { id: "sh-05", name: "avd-vm-prod-05.cloudlab.in", hostPool: "hp-prod-personal", status: "Available", sessions: 1, disconnectedSessions: 0, allowNewSessions: true, agentVersion: "1.0.8431.2200", os: "Windows 11 Enterprise 23H2", lastHeartbeat: "2026-05-14T08:12:00Z", drainMode: false, vmSize: "Standard_D4s_v5", assignedUser: "admin@cloudlab.onmicrosoft.com" },
      { id: "sh-06", name: "avd-vm-prod-06.cloudlab.in", hostPool: "hp-prod-personal", status: "Shutdown", sessions: 0, disconnectedSessions: 0, allowNewSessions: true, agentVersion: "1.0.8431.2200", os: "Windows 11 Enterprise 23H2", lastHeartbeat: "2026-05-13T22:01:00Z", drainMode: false, vmSize: "Standard_D4s_v5", assignedUser: "priya@cloudlab.onmicrosoft.com" },
    ],
    applicationGroups: [
      {
        id: "ag-dag-prod-desktop", name: "DAG-prod-desktop", type: "Desktop", hostPool: "hp-prod-pooled",
        resourceGroup: "rg-avd-prod", region: "East US", description: "Full desktop experience for office workforce.",
        workspace: "ws-prod", applications: [],
        assignments: ["Finance-Team", "HR-Team", "Operations-Team", "Marketing-Team"],
        tags: { environment: "prod" },
      },
      {
        id: "ag-rag-prod-office", name: "RAG-prod-office", type: "RemoteApp", hostPool: "hp-prod-pooled",
        resourceGroup: "rg-avd-prod", region: "East US", description: "Microsoft 365 applications published as RemoteApps.",
        workspace: "ws-prod",
        applications: [
          { name: "word", displayName: "Microsoft Word", source: "Start menu", filePath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE", iconPath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE", iconIndex: 0, description: "Word processor", showInWebFeed: true, requireCmdLine: false, cmdLineArgs: "" },
          { name: "excel", displayName: "Microsoft Excel", source: "Start menu", filePath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE", iconPath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE", iconIndex: 0, description: "Spreadsheet editor", showInWebFeed: true, requireCmdLine: false, cmdLineArgs: "" },
          { name: "powerpoint", displayName: "Microsoft PowerPoint", source: "Start menu", filePath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE", iconPath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE", iconIndex: 0, description: "Presentation editor", showInWebFeed: true, requireCmdLine: false, cmdLineArgs: "" },
          { name: "outlook", displayName: "Microsoft Outlook", source: "Start menu", filePath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE", iconPath: "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE", iconIndex: 0, description: "Email and calendar", showInWebFeed: true, requireCmdLine: false, cmdLineArgs: "" },
          { name: "teams", displayName: "Microsoft Teams", source: "File path", filePath: "C:\\Program Files\\WindowsApps\\MicrosoftTeams\\ms-teams.exe", iconPath: "C:\\Program Files\\WindowsApps\\MicrosoftTeams\\ms-teams.exe", iconIndex: 0, description: "Chat and meetings", showInWebFeed: true, requireCmdLine: false, cmdLineArgs: "" },
        ],
        assignments: ["Sales-Team", "Finance-Team", "HR-Team", "Operations-Team", "Marketing-Team", "Executives"],
        tags: { environment: "prod", purpose: "office" },
      },
      {
        id: "ag-rag-prod-legacy", name: "RAG-prod-legacy", type: "RemoteApp", hostPool: "hp-prod-pooled",
        resourceGroup: "rg-avd-prod", region: "East US", description: "Legacy line-of-business applications.",
        workspace: "ws-prod",
        applications: [
          { name: "erp", displayName: "Legacy ERP", source: "File path", filePath: "C:\\Apps\\LegacyERP\\erp.exe", iconPath: "C:\\Apps\\LegacyERP\\erp.exe", iconIndex: 0, description: "Legacy ERP client", showInWebFeed: true, requireCmdLine: false, cmdLineArgs: "" },
          { name: "crm", displayName: "Legacy CRM", source: "File path", filePath: "C:\\Apps\\LegacyCRM\\crm.exe", iconPath: "C:\\Apps\\LegacyCRM\\crm.exe", iconIndex: 0, description: "Legacy CRM client", showInWebFeed: true, requireCmdLine: true, cmdLineArgs: "--mode prod" },
          { name: "reports", displayName: "Reports Viewer", source: "File path", filePath: "C:\\Apps\\Reports\\rpt.exe", iconPath: "C:\\Apps\\Reports\\rpt.exe", iconIndex: 0, description: "Financial reports tool", showInWebFeed: false, requireCmdLine: false, cmdLineArgs: "" },
        ],
        assignments: ["Finance-Team", "Executives"],
        tags: { environment: "prod", purpose: "lob" },
      },
    ],
    workspaces: [
      {
        id: "ws-prod", name: "ws-prod", friendlyName: "CloudLab Production Workspace",
        description: "Production workspace for end users.", resourceGroup: "rg-avd-prod", region: "East US",
        applicationGroups: ["ag-dag-prod-desktop", "ag-rag-prod-office", "ag-rag-prod-legacy"],
        tags: { environment: "prod" },
      },
      {
        id: "ws-dev", name: "ws-dev", friendlyName: "CloudLab Dev Workspace",
        description: "Workspace for engineering team and validation testing.", resourceGroup: "rg-avd-shared", region: "East US",
        applicationGroups: ["ag-rag-prod-office"],
        tags: { environment: "dev" },
      },
    ],
    scalingPlans: [
      {
        id: "sp-business-hours", name: "sp-business-hours", resourceGroup: "rg-avd-shared", region: "East US",
        timeZone: "Eastern Standard Time", hostPoolType: "Pooled", exclusionTag: "no-scale",
        schedules: [
          {
            name: "Weekdays", daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            rampUp: { start: "07:00", loadBalancing: "Breadth-first", minHostsPct: 20, capacityThresholdPct: 80 },
            peak: { start: "09:00", loadBalancing: "Depth-first" },
            rampDown: { start: "18:00", loadBalancing: "Depth-first", minHostsPct: 10, capacityThresholdPct: 90, forceLogoffUsers: false, waitTimeMinutes: 30 },
            offPeak: { start: "20:00", loadBalancing: "Depth-first" },
          },
        ],
        hostPoolAssignments: ["hp-prod-pooled"],
        poolOverrides: {},
        enabled: true,
        tags: {},
      },
    ],
    msixPackages: [
      {
        id: "msix-1",
        packageName: "AdobeAcrobatReaderDC_2024.001.20643.0_neutral_~_e9ss7edx6h9j0",
        packageFamilyName: "AdobeAcrobatReaderDC_e9ss7edx6h9j0",
        displayName: "Adobe Acrobat Reader DC", displayVersion: "2024.001.20643", version: "2024.1.20643.0",
        publisher: "CN=Adobe Systems, Incorporated, O=Adobe Systems, Incorporated, L=San Jose, S=California, C=US",
        publisherDisplayName: "Adobe Systems, Incorporated",
        imagePath: "\\\\cldataststavd.file.core.windows.net\\msix\\AdobeAcrobat.vhdx",
        logoPath: "\\\\cldataststavd.file.core.windows.net\\msix\\AdobeAcrobat.vhdx\\Assets\\Logo.png",
        appVConfig: "", state: "Active",
        hostPools: ["hp-prod-pooled"], appGroups: ["ag-rag-prod-office"],
        userAssignments: ["Finance-Team", "HR-Team"],
        lastUpdated: "2026-04-10T09:00:00Z", isRegular: true, createdAt: "2026-01-05T09:00:00Z",
      },
      {
        id: "msix-2",
        packageName: "NotepadPlusPlus_8.6.2.0_x64__7pnhkfnrfz4wt",
        packageFamilyName: "NotepadPlusPlus_7pnhkfnrfz4wt",
        displayName: "Notepad++", displayVersion: "8.6.2", version: "8.6.2.0",
        publisher: "CN=Notepad++ Team, O=Notepad++ Team, C=FR",
        publisherDisplayName: "Notepad++ Team",
        imagePath: "\\\\cldataststavd.file.core.windows.net\\msix\\NotepadPP.vhdx",
        logoPath: "\\\\cldataststavd.file.core.windows.net\\msix\\NotepadPP.vhdx\\Assets\\Logo.png",
        appVConfig: "", state: "Active",
        hostPools: ["hp-prod-pooled"], appGroups: [],
        userAssignments: ["Engineering-Team"],
        lastUpdated: "2026-03-22T09:00:00Z", isRegular: false, createdAt: "2026-02-01T09:00:00Z",
      },
    ],
    fslogixConfigs: [
      {
        id: "fsl-prod-profile", name: "FSLogix - prod profile", appliesTo: "hp-prod-pooled",
        profileContainerPath: "\\\\cldataststavd.file.core.windows.net\\profiles\\%username%",
        storageAccount: "cl-data-storage",
        storageAccountResource: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-avd-prod/providers/Microsoft.Storage/storageAccounts/cldataststavd",
        azureFilesShare: "profiles", profileSizeGB: 30, profileLockCheck: true, roamingOsPrefs: false,
        odfcEnabled: true, odfcPath: "\\\\cldataststavd.file.core.windows.net\\odfc\\%username%",
        odfcIncludes: ["Outlook cache", "OneDrive sync", "Teams cache", "Edge data", "OneNote cache"],
        authMethod: "Entra Kerberos (hybrid)",
        regKeys: { outlookCacheMode: true, oneDriveSync: true, teamsCache: true, edgeData: true, oneNoteCache: true },
      },
      {
        id: "fsl-prod-personal", name: "FSLogix - personal desktop", appliesTo: "hp-prod-personal",
        profileContainerPath: "\\\\cldataststavd.file.core.windows.net\\personal\\%username%",
        storageAccount: "cl-data-storage", storageAccountResource: "", azureFilesShare: "personal",
        profileSizeGB: 50, profileLockCheck: true, roamingOsPrefs: true,
        odfcEnabled: false, odfcPath: "", odfcIncludes: [], authMethod: "",
        regKeys: { outlookCacheMode: true, oneDriveSync: true, teamsCache: false, edgeData: true, oneNoteCache: false },
      },
      {
        id: "fsl-dev-profile", name: "FSLogix - dev profile", appliesTo: "hp-prod-pooled",
        profileContainerPath: "\\\\fs02.corp.cloudlab.local\\dev$\\%username%",
        storageAccount: "", storageAccountResource: "", azureFilesShare: "",
        profileSizeGB: 30, profileLockCheck: false, roamingOsPrefs: false,
        odfcEnabled: true, odfcPath: "\\\\fs02.corp.cloudlab.local\\dev-odfc$\\%username%",
        odfcIncludes: ["Outlook cache", "Teams cache"], authMethod: "",
        regKeys: { outlookCacheMode: true, oneDriveSync: false, teamsCache: true, edgeData: false, oneNoteCache: false },
      },
      {
        id: "fsl-finance-profile", name: "FSLogix - finance team", appliesTo: "hp-prod-pooled",
        profileContainerPath: "\\\\fs01.corp.cloudlab.local\\finance$\\%username%",
        storageAccount: "", storageAccountResource: "", azureFilesShare: "",
        profileSizeGB: 60, profileLockCheck: true, roamingOsPrefs: true,
        odfcEnabled: true, odfcPath: "\\\\fs01.corp.cloudlab.local\\finance-odfc$\\%username%",
        odfcIncludes: ["Outlook cache", "OneDrive sync", "Teams cache", "Edge data"], authMethod: "",
        regKeys: { outlookCacheMode: true, oneDriveSync: true, teamsCache: true, edgeData: true, oneNoteCache: false },
      },
    ],
    imageTemplates: [
      { id: "img-tmpl-1", name: "win11-multisession-office", source: "Marketplace: win11-multi-23h2", customizations: "Install M365 Apps, FSLogix agent, custom wallpaper, remove bloatware", lastBuilt: "2026-04-01T10:00:00Z", duration: "1h 42m", status: "Succeeded", destinationGallery: "cl-avd-gallery", destinationImage: "win11-office-golden", schedule: "Weekly, Sunday 02:00", assignedHostPools: ["hp-prod-pooled"] },
      { id: "img-tmpl-2", name: "win11-dev-workstation", source: "Marketplace: win11-ent-23h2", customizations: "Install VS Code, Git, Node.js, Docker Desktop, WSL2", lastBuilt: "2026-03-15T08:00:00Z", duration: "2h 05m", status: "Succeeded", destinationGallery: "cl-avd-gallery", destinationImage: "win11-dev-golden", schedule: "Manual", assignedHostPools: ["hp-prod-personal"] },
      { id: "img-tmpl-3", name: "win11-finance-secure", source: "Custom VHD: cl-secure-base.vhd", customizations: "Apply CIS benchmark, install Finance ERP client, disable USB storage", lastBuilt: "2026-05-01T09:00:00Z", duration: "-", status: "Running", destinationGallery: "cl-avd-gallery", destinationImage: "win11-finance-golden", schedule: "Manual", assignedHostPools: [] },
    ],
    updatePlans: [
      { id: "upd-plan-1", name: "up-prod-pooled-monthly", hostPool: "hp-prod-pooled", stage: "Not started", schedule: "Monthly, 2nd Sunday 01:00", hosts: 4, status: "Not started", lastRun: "2026-04-14T01:00:00Z" },
      { id: "upd-plan-2", name: "up-prod-personal-quarterly", hostPool: "hp-prod-personal", stage: "Not started", schedule: "Quarterly", hosts: 2, status: "Completed", lastRun: "2026-02-01T01:00:00Z" },
      { id: "upd-plan-3", name: "up-dev-adhoc", hostPool: "hp-prod-pooled", stage: "Validation", schedule: "Manual", hosts: 1, status: "Running", lastRun: "2026-05-13T22:00:00Z" },
    ],
    privateEndpoints: [
      { id: "pe-1", resource: "Workspace - global feed", subResource: "global", name: "pe-avd-global", vnet: "vnet-hub-eastus", subnet: "snet-privatelink", privateDnsZone: "privatelink-global.wvd.microsoft.com", approvalStatus: "Approved" },
      { id: "pe-2", resource: "Workspace - feed (ws-prod)", subResource: "feed", name: "pe-avd-ws-prod-feed", vnet: "vnet-hub-eastus", subnet: "snet-privatelink", privateDnsZone: "privatelink.wvd.microsoft.com", approvalStatus: "Approved" },
      { id: "pe-3", resource: "Host pool hp-prod-pooled", subResource: "connection", name: "pe-avd-hp-prod-pooled-conn", vnet: "vnet-spoke-avd", subnet: "snet-avd-hosts", privateDnsZone: "privatelink.wvd.microsoft.com", approvalStatus: "Pending" },
    ],
    users: [
      { upn: "admin@cloudlab.onmicrosoft.com", displayName: "Alex Johnson", role: "AVD User", department: "IT" },
      { upn: "priya@cloudlab.onmicrosoft.com", displayName: "Priya Patel", role: "AVD User", department: "Finance" },
      { upn: "john@cloudlab.onmicrosoft.com", displayName: "John Smith", role: "AVD User", department: "Sales" },
      { upn: "maria@cloudlab.onmicrosoft.com", displayName: "Maria Garcia", role: "AVD User", department: "HR" },
      { upn: "rahul@cloudlab.onmicrosoft.com", displayName: "Rahul Verma", role: "AVD User", department: "Engineering" },
      { upn: "sarah@cloudlab.onmicrosoft.com", displayName: "Sarah Johnson", role: "AVD User", department: "Marketing" },
      { upn: "liu@cloudlab.onmicrosoft.com", displayName: "Liu Wei", role: "AVD User", department: "Engineering" },
      { upn: "emma@cloudlab.onmicrosoft.com", displayName: "Emma Brown", role: "AVD User", department: "Legal" },
      { upn: "carlos@cloudlab.onmicrosoft.com", displayName: "Carlos Mendez", role: "AVD User", department: "Operations" },
      { upn: "anita@cloudlab.onmicrosoft.com", displayName: "Anita Desai", role: "AVD User", department: "Support" },
      { upn: "sales-team@cloudlab.in", displayName: "Sales-Team", role: "Group", department: "" },
      { upn: "finance-team@cloudlab.in", displayName: "Finance-Team", role: "Group", department: "" },
      { upn: "engineering-team@cloudlab.in", displayName: "Engineering-Team", role: "Group", department: "" },
      { upn: "hr-team@cloudlab.in", displayName: "HR-Team", role: "Group", department: "" },
      { upn: "operations-team@cloudlab.in", displayName: "Operations-Team", role: "Group", department: "" },
      { upn: "marketing-team@cloudlab.in", displayName: "Marketing-Team", role: "Group", department: "" },
      { upn: "executives@cloudlab.in", displayName: "Executives", role: "Group", department: "" },
    ],
    activityLog: [
      { time: "2026-05-14T08:13:00Z", operation: "Update host pool", resource: "hp-prod-pooled", status: "Succeeded" },
      { time: "2026-05-14T07:42:00Z", operation: "Drain session host", resource: "avd-vm-prod-03", status: "Succeeded" },
      { time: "2026-05-14T07:01:00Z", operation: "Scaling plan ramp-up", resource: "sp-business-hours", status: "Succeeded" },
    ],
    scalingLog: [
      { time: "2026-05-14T07:00:00Z", pool: "hp-prod-pooled", event: "Started", reason: "Ramp-up phase started, scaling to meet 20% minimum host threshold" },
      { time: "2026-05-13T18:00:00Z", pool: "hp-prod-pooled", event: "Drained", reason: "Ramp-down phase started, draining excess hosts" },
      { time: "2026-05-13T20:00:00Z", pool: "hp-prod-pooled", event: "Stopped", reason: "Off-peak phase, host stopped after drain and 30 min wait" },
    ],
  };
}
