export type AppServiceWizardTag = { key: string; value: string };

export type AppServiceWizardState = {
  resourceGroup: string;
  appName: string;
  publish: "Code" | "Container" | "Static Web App";
  runtimeStack: string;
  operatingSystem: "Linux" | "Windows";
  region: string;
  linuxPlan: string;
  windowsPlan: string;
  planTier: string;
  zoneRedundancy: boolean;
  continuousDeployment: "Disable" | "Enable";
  cdProvider: "GitHub" | "Azure DevOps" | "Bitbucket";
  cdOrg: string;
  cdRepo: string;
  cdBranch: string;
  basicAuth: "Enable" | "Disable";
  publicAccess: "On" | "Off";
  networkInjection: "Off" | "Virtual network";
  vnet: string;
  subnet: string;
  outboundVnetIntegration: boolean;
  enableAppInsights: "Yes" | "No";
  appInsightsRegion: string;
  appInsightsWorkspace: string;
  tags: AppServiceWizardTag[];
};

export function freshAppServiceWizardState(): AppServiceWizardState {
  return {
    resourceGroup: "",
    appName: "",
    publish: "Code",
    runtimeStack: "Node 20 LTS",
    operatingSystem: "Linux",
    region: "(US) East US",
    linuxPlan: "Basic (B1)",
    windowsPlan: "Basic (B1)",
    planTier: "B1",
    zoneRedundancy: false,
    continuousDeployment: "Disable",
    cdProvider: "GitHub",
    cdOrg: "",
    cdRepo: "",
    cdBranch: "main",
    basicAuth: "Enable",
    publicAccess: "On",
    networkInjection: "Off",
    vnet: "",
    subnet: "",
    outboundVnetIntegration: false,
    enableAppInsights: "Yes",
    appInsightsRegion: "(US) East US",
    appInsightsWorkspace: "DefaultWorkspace",
    tags: [],
  };
}

export function validateAppServiceWizardState(state: AppServiceWizardState): string[] {
  const errors: string[] = [];
  if (!state.appName) errors.push("App name is required.");
  else if (!/^[a-z0-9-]{2,60}$/.test(state.appName)) {
    errors.push("App name must be 2-60 characters of lowercase letters, digits, or hyphens.");
  }
  if (!state.resourceGroup) errors.push("Resource group is required. Create one on the Resource groups page.");
  if (state.networkInjection === "Virtual network" && !state.vnet) {
    errors.push("Select a virtual network or disable network injection.");
  }
  return errors;
}
