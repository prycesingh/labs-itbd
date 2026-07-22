import type { BaseResource } from "./sharedTypes";
import type { DtuTier, HardwareFamily, VcoreTier } from "./sqlData";

export type SqlFirewallRule = { name: string; startIp: string; endIp: string };

export type SqlAlertRule = {
  id: string;
  name: string;
  signal: string;
  operator: string;
  threshold: string;
  window: string;
  severity: string;
  enabled: boolean;
  fired: number;
};

export type SqlDiagSetting = {
  id: string;
  name: string;
  destination: string;
  target: string;
  logs: string;
  metrics: string;
};

export type SqlResource = BaseResource & {
  resourceType: "SqlDatabase";
  server: string;
  serverAdminLogin: string;
  serverFQDN: string;
  pricingModel: "DTU" | "vCore";
  serviceTier: string;
  computeTier: "Provisioned" | "Serverless";
  vCores: number | null;
  dtu: number | null;
  hardwareFamily: HardwareFamily["id"] | null;
  dataMaxGB: number;
  backupRedundancy: string;
  status: "Online" | "Paused";
  collation: string;
  publicAccess: boolean;
  allowAzureServices: boolean;
  firewallRules: SqlFirewallRule[];
  connectionPolicy: "Default" | "Proxy" | "Redirect";
  minTlsVersion: "1.0" | "1.1" | "1.2";
  defender: boolean;
  ledger: boolean;
  tdeOption: "Service-managed key" | "Customer-managed key";
  authMethod: string;
  useExistingData: "None" | "Backup" | "Sample";
  maintenanceWindow: string;
  workloadEnv: "Development" | "Production";
  ltrWeekly: number;
  ltrMonthly: number;
  ltrYearly: number;
  auditingEnabled: boolean;
  auditRetentionDays: number;
  alertRules: SqlAlertRule[];
  diagSettings: SqlDiagSetting[];
};

export type { DtuTier, VcoreTier, HardwareFamily };
