import type { VmDataDisk } from "./types";

export type VmWizardTag = { key: string; value: string };

export type VmWizardState = {
  resourceGroup: string;
  vmName: string;
  region: string;
  availabilityOptions: string;
  securityType: string;
  image: string;
  vmArchitecture: "x64" | "ARM64";
  runWithSpot: boolean;
  size: string;
  authType: "SSH public key" | "Password";
  username: string;
  password: string;
  sshKeyName: string;
  inboundPorts: "None" | "Allow selected ports";
  selectedPorts: string[];
  licenseType: string;
  osDiskType: string;
  deleteOsDiskWithVm: boolean;
  encryptionType: string;
  useEphemeralOsDisk: boolean;
  dataDisks: VmDataDisk[];
  virtualNetwork: string;
  subnet: string;
  publicIp: string;
  nicNsg: "None" | "Basic" | "Advanced";
  deletePublicIpWithVm: boolean;
  acceleratedNetworking: boolean;
  loadBalancing: string;
  enableSystemIdentity: boolean;
  enableEntraLogin: boolean;
  enableAutoShutdown: boolean;
  autoShutdownTime: string;
  autoShutdownTz: string;
  enableBackup: boolean;
  patchOrchestration: string;
  bootDiagnostics: string;
  osGuestDiagnostics: boolean;
  enableAlerts: boolean;
  enableInsights: boolean;
  healthMonitoring: boolean;
  customData: string;
  userData: string;
  tags: VmWizardTag[];
};

export function freshWizardState(): VmWizardState {
  return {
    resourceGroup: "",
    vmName: "",
    region: "(US) East US",
    availabilityOptions: "No infrastructure redundancy required",
    securityType: "Trusted launch virtual machines",
    image: "ubuntu-22-04",
    vmArchitecture: "x64",
    runWithSpot: false,
    size: "Standard_D2s_v5",
    authType: "SSH public key",
    username: "azureuser",
    password: "",
    sshKeyName: "",
    inboundPorts: "Allow selected ports",
    selectedPorts: ["SSH (22)"],
    licenseType: "Other",
    osDiskType: "Premium_LRS",
    deleteOsDiskWithVm: true,
    encryptionType: "Encryption at-rest with a platform-managed key",
    useEphemeralOsDisk: false,
    dataDisks: [],
    virtualNetwork: "(new) vnet-default",
    subnet: "(new) default (10.0.0.0/24)",
    publicIp: "(new) auto-generated",
    nicNsg: "Basic",
    deletePublicIpWithVm: true,
    acceleratedNetworking: true,
    loadBalancing: "None",
    enableSystemIdentity: false,
    enableEntraLogin: false,
    enableAutoShutdown: false,
    autoShutdownTime: "19:00",
    autoShutdownTz: "(UTC) Coordinated Universal Time",
    enableBackup: false,
    patchOrchestration: "Image default",
    bootDiagnostics: "Enable with managed storage account",
    osGuestDiagnostics: false,
    enableAlerts: false,
    enableInsights: false,
    healthMonitoring: false,
    customData: "",
    userData: "",
    tags: [],
  };
}

export function validateWizardState(state: VmWizardState): string[] {
  const errors: string[] = [];
  if (!state.vmName) errors.push("Virtual machine name is required.");
  else if (!/^[a-zA-Z0-9-]{1,64}$/.test(state.vmName)) {
    errors.push("VM name must be 1-64 alphanumeric or hyphen characters.");
  }
  if (!state.resourceGroup) errors.push("Resource group is required.");
  if (!state.username) errors.push("Administrator username is required.");
  if (state.authType === "Password" && state.password.length < 12) {
    errors.push("Password must be at least 12 characters.");
  }
  if (state.authType === "SSH public key" && !state.sshKeyName) {
    errors.push("SSH key pair name is required.");
  }
  return errors;
}
