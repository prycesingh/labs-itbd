/**
 * Static reference data for the Azure VM simulator — mirrors real Azure
 * portal defaults (image catalog, size catalog, disk types, regions). This
 * is authored fixture data that ships with the feature; it has no per-user
 * variation and doesn't need to be database-editable.
 */

export type VmImage = {
  id: string;
  name: string;
  publisher: string;
  os: "Linux" | "Windows";
};

export const VM_IMAGES: VmImage[] = [
  { id: "ubuntu-22-04", name: "Ubuntu Server 22.04 LTS - x64 Gen2", publisher: "Canonical", os: "Linux" },
  { id: "ubuntu-20-04", name: "Ubuntu Server 20.04 LTS - x64 Gen2", publisher: "Canonical", os: "Linux" },
  { id: "win2022", name: "Windows Server 2022 Datacenter: Azure Edition", publisher: "Microsoft", os: "Windows" },
  { id: "win2019", name: "Windows Server 2019 Datacenter", publisher: "Microsoft", os: "Windows" },
  { id: "rhel9", name: "Red Hat Enterprise Linux 9.3", publisher: "Red Hat", os: "Linux" },
  { id: "debian12", name: 'Debian 12 "Bookworm"', publisher: "Debian", os: "Linux" },
  { id: "win11-ent", name: "Windows 11 Enterprise, version 23H2", publisher: "Microsoft", os: "Windows" },
  { id: "sqlsvr", name: "SQL Server 2022 Enterprise on Windows 2022", publisher: "Microsoft", os: "Windows" },
];

export type VmSize = {
  name: string;
  family: string;
  vcpus: number;
  ram: number;
  tempStorage: number;
  cost: number;
  iops: number;
};

export const VM_SIZES: VmSize[] = [
  { name: "Standard_B1s", family: "General purpose", vcpus: 1, ram: 1, tempStorage: 4, cost: 7.59, iops: 320 },
  { name: "Standard_B2s", family: "General purpose", vcpus: 2, ram: 4, tempStorage: 8, cost: 30.37, iops: 1280 },
  { name: "Standard_B2ms", family: "General purpose", vcpus: 2, ram: 8, tempStorage: 16, cost: 60.74, iops: 1920 },
  { name: "Standard_D2s_v5", family: "General purpose", vcpus: 2, ram: 8, tempStorage: 75, cost: 70.08, iops: 3750 },
  { name: "Standard_D4s_v5", family: "General purpose", vcpus: 4, ram: 16, tempStorage: 150, cost: 140.16, iops: 6400 },
  { name: "Standard_D8s_v5", family: "General purpose", vcpus: 8, ram: 32, tempStorage: 300, cost: 280.32, iops: 12800 },
  { name: "Standard_E2s_v5", family: "Memory optimized", vcpus: 2, ram: 16, tempStorage: 75, cost: 91.98, iops: 3750 },
  { name: "Standard_E4s_v5", family: "Memory optimized", vcpus: 4, ram: 32, tempStorage: 150, cost: 183.96, iops: 6400 },
  { name: "Standard_F2s_v2", family: "Compute optimized", vcpus: 2, ram: 4, tempStorage: 16, cost: 61.61, iops: 4000 },
  { name: "Standard_F4s_v2", family: "Compute optimized", vcpus: 4, ram: 8, tempStorage: 32, cost: 123.22, iops: 8000 },
];

export type DiskType = { id: string; label: string; desc: string };

export const DISK_TYPES: DiskType[] = [
  { id: "Premium_LRS", label: "Premium SSD (locally-redundant storage)", desc: "Best for production and performance-sensitive workloads" },
  { id: "StandardSSD_LRS", label: "Standard SSD (locally-redundant storage)", desc: "Best for web servers, lightly used enterprise apps and dev/test" },
  { id: "Standard_LRS", label: "Standard HDD (locally-redundant storage)", desc: "Best for backup, non-critical, infrequent access" },
];

export const REGIONS = [
  "(US) East US",
  "(US) East US 2",
  "(US) West US 2",
  "(US) West US 3",
  "(US) Central US",
  "(Asia Pacific) Southeast Asia",
  "(Asia Pacific) East Asia",
  "(Asia Pacific) Japan East",
  "(Asia Pacific) Central India",
  "(Asia Pacific) South India",
  "(Asia Pacific) Australia East",
  "(Europe) North Europe",
  "(Europe) West Europe",
  "(Europe) UK South",
  "(Europe) Germany West Central",
];

export const INBOUND_PORT_OPTIONS = ["HTTP (80)", "HTTPS (443)", "SSH (22)", "RDP (3389)"];

export const EXTENSION_CATALOG = [
  { name: "AzureMonitorWindowsAgent", publisher: "Microsoft.Azure.Monitor", version: "1.32" },
  { name: "AzureMonitorLinuxAgent", publisher: "Microsoft.Azure.Monitor", version: "1.34" },
  { name: "MDE.Windows", publisher: "Microsoft.Azure.AzureDefenderForServers", version: "1.0" },
  { name: "MDE.Linux", publisher: "Microsoft.Azure.AzureDefenderForServers", version: "1.0" },
  { name: "NetworkWatcherAgentWindows", publisher: "Microsoft.Azure.NetworkWatcher", version: "1.4" },
  { name: "NetworkWatcherAgentLinux", publisher: "Microsoft.Azure.NetworkWatcher", version: "1.4" },
  { name: "CustomScriptExtension", publisher: "Microsoft.Compute", version: "1.10" },
  { name: "CustomScript", publisher: "Microsoft.Azure.Extensions", version: "2.1" },
  { name: "AzureDiskEncryption", publisher: "Microsoft.Azure.Security", version: "2.2" },
  { name: "DSC", publisher: "Microsoft.PowerShell", version: "2.83" },
  { name: "IaaSAntimalware", publisher: "Microsoft.Azure.Security", version: "1.5" },
  { name: "VMAccessAgent", publisher: "Microsoft.Compute", version: "2.4" },
];

export const RUN_COMMANDS = [
  { id: "RunPowerShellScript", os: "Windows" as const, name: "RunPowerShellScript", desc: "Executes a PowerShell script" },
  { id: "RunShellScript", os: "Linux" as const, name: "RunShellScript", desc: "Executes a Bash/Shell script" },
  { id: "EnableRemotePS", os: "Windows" as const, name: "EnableRemotePS", desc: "Configure WinRM for remote PowerShell" },
  { id: "IPConfig", os: "Windows" as const, name: "IPConfig", desc: "Displays detailed network configuration" },
  { id: "ifconfig", os: "Linux" as const, name: "ifconfig", desc: "Displays network configuration" },
  { id: "systemctl-status", os: "Linux" as const, name: "systemctl status", desc: "Check service status" },
];

export const DEFAULT_POLICY_COMPLIANCE = [
  { name: "Allowed virtual machine size SKUs", category: "Compute", compliance: "Compliant" as const, scope: "Management group: cloudlab-corp" },
  { name: "Audit VMs without disk encryption", category: "Security", compliance: "Non-compliant" as const, scope: "Subscription" },
  { name: "Configure Defender for Cloud agents", category: "Security", compliance: "Compliant" as const, scope: "Subscription" },
  { name: "Enforce VM backup policy", category: "Backup", compliance: "Compliant" as const, scope: "Subscription" },
  { name: "Block public IP on VMs", category: "Networking", compliance: "Compliant" as const, scope: "Resource group" },
  { name: "Tag inheritance from RG", category: "Tags", compliance: "Compliant" as const, scope: "Subscription" },
];

export const SUBSCRIPTION = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "CloudLab-Training-Sub",
};
