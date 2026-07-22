import type { BaseResource } from "./sharedTypes";

export type VmStatus = "Running" | "Stopped";

export type VmDataDisk = { name: string; sizeGiB: number; type: string };

export type VmExtension = {
  name: string;
  publisher: string;
  version: string;
  autoUpgrade: boolean;
  state: "Provisioning succeeded" | "Disabled";
};

export type VmRestorePoint = {
  name: string;
  created: string;
  includeDataDisks: boolean;
  notes: string;
};

export type VmAsrState =
  | { enabled: false }
  | { enabled: true; targetRegion: string; policy: string };

export type VmAlertRule = {
  name: string;
  signal: string;
  operator: string;
  threshold: string;
  window: string;
  severity: string;
  enabled: boolean;
  fired: number;
};

export type VmPolicyCompliance = {
  name: string;
  category: string;
  compliance: "Compliant" | "Non-compliant";
  scope: string;
};

export type VmBootDiag = {
  enabled: boolean;
  storage: string;
  screenshot: string;
  serialLog: string;
};

export type VmResource = BaseResource & {
  resourceType: "VirtualMachine";
  status: VmStatus;
  os: "Linux" | "Windows";
  osImage: string;
  size: string;
  vcpus: number;
  ram: number;
  username: string;
  authType: "SSH public key" | "Password";
  virtualNetwork: string;
  subnet: string;
  publicIp: string;
  privateIp: string;
  publicIpAddress: string | null;
  nicNsg: "None" | "Basic" | "Advanced";
  inboundPorts: string[];
  osDiskType: string;
  dataDisks: VmDataDisk[];
  enableAutoShutdown: boolean;
  autoShutdownTime: string;
  enableBackup: boolean;
  extensions: VmExtension[];
  bootDiag: VmBootDiag;
  restorePoints: VmRestorePoint[];
  asr: VmAsrState;
  alertRules: VmAlertRule[];
  policyCompliance: VmPolicyCompliance[];
};

export function defaultBootDiag(): VmBootDiag {
  return { enabled: true, storage: "Managed", screenshot: "Available", serialLog: "Available" };
}
