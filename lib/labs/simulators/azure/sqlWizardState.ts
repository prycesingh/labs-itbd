import { passwordIsComplex } from "./sqlData";
import type { SqlFirewallRule } from "./sqlTypes";

export type SqlWizardTag = { key: string; value: string };

export type SqlWizardState = {
  resourceGroup: string;
  databaseName: string;
  serverChoice: "new" | "existing";
  serverName: string;
  serverLocation: string;
  authMethod: "Use SQL authentication" | "Use Microsoft Entra-only authentication" | "Use both SQL and Microsoft Entra authentication";
  serverAdminLogin: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  existingServer: string;
  useElasticPool: "No" | "Yes";
  elasticPoolName: string;
  elasticPoolTier: string;
  workloadEnv: "Development" | "Production";
  pricingModel: "DTU" | "vCore";
  dtuTier: "Basic" | "Standard" | "Premium";
  dtuValue: number;
  dtuMaxGB: number;
  vcoreTier: "GeneralPurpose" | "BusinessCritical" | "Hyperscale" | "Serverless";
  computeTier: "Provisioned" | "Serverless";
  hardwareFamily: "Gen5" | "StandardGen6" | "PremiumGen6" | "PremiumGen6M";
  vCores: number;
  dataMaxGB: number;
  backupRedundancy: string;
  networkConnectivity: "Public endpoint" | "Private endpoint" | "No access";
  addClientIp: boolean;
  allowAzureServices: boolean;
  firewallRules: SqlFirewallRule[];
  connectionPolicy: "Default" | "Proxy" | "Redirect";
  minTlsVersion: "1.0" | "1.1" | "1.2";
  defenderForSql: "Start free trial" | "Not now";
  enableLedger: boolean;
  tdeOption: "Service-managed key" | "Customer-managed key";
  useExistingData: "None" | "Backup" | "Sample";
  collation: string;
  maintenanceWindow: string;
  tags: SqlWizardTag[];
};

export function freshSqlWizardState(): SqlWizardState {
  return {
    resourceGroup: "",
    databaseName: "",
    serverChoice: "new",
    serverName: "",
    serverLocation: "(US) East US",
    authMethod: "Use SQL authentication",
    serverAdminLogin: "sqladmin",
    adminPassword: "",
    adminPasswordConfirm: "",
    existingServer: "",
    useElasticPool: "No",
    elasticPoolName: "",
    elasticPoolTier: "Standard",
    workloadEnv: "Development",
    pricingModel: "vCore",
    dtuTier: "Standard",
    dtuValue: 10,
    dtuMaxGB: 250,
    vcoreTier: "GeneralPurpose",
    computeTier: "Provisioned",
    hardwareFamily: "Gen5",
    vCores: 2,
    dataMaxGB: 32,
    backupRedundancy: "Geo-redundant backup storage (GRS)",
    networkConnectivity: "Public endpoint",
    addClientIp: true,
    allowAzureServices: false,
    firewallRules: [],
    connectionPolicy: "Default",
    minTlsVersion: "1.2",
    defenderForSql: "Not now",
    enableLedger: false,
    tdeOption: "Service-managed key",
    useExistingData: "None",
    collation: "SQL_Latin1_General_CP1_CI_AS",
    maintenanceWindow: "System default",
    tags: [],
  };
}

export function validateSqlWizardState(state: SqlWizardState, existingServerNames: string[]): string[] {
  const errors: string[] = [];
  if (!state.databaseName) errors.push("Database name is required.");
  else if (!/^[a-zA-Z0-9\-_]{1,128}$/.test(state.databaseName)) {
    errors.push("Database name must be 1-128 alphanumeric, hyphen, or underscore characters.");
  }
  if (!state.resourceGroup) errors.push("Resource group is required. Create one on the Resource groups page.");
  if (state.serverChoice === "new") {
    if (!state.serverName) errors.push("Server name is required.");
    else if (!/^[a-z0-9-]{3,63}$/.test(state.serverName)) errors.push("Server name must be 3-63 lower-case letters, digits, or hyphens.");
    if (state.authMethod === "Use SQL authentication" || state.authMethod === "Use both SQL and Microsoft Entra authentication") {
      if (!state.serverAdminLogin) errors.push("Server admin login is required.");
      if (!state.adminPassword) errors.push("Admin password is required.");
      else if (!passwordIsComplex(state.adminPassword)) {
        errors.push("Password must be at least 8 characters and contain upper case, lower case, and a digit.");
      }
      if (state.adminPassword !== state.adminPasswordConfirm) errors.push("Password and confirm password do not match.");
    }
  } else if (!state.existingServer) {
    errors.push("Select an existing server.");
  } else if (!existingServerNames.includes(state.existingServer)) {
    errors.push("Select a valid existing server.");
  }
  return errors;
}
