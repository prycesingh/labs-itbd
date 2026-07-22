import type { BaseResource } from "./sharedTypes";

export type AppServiceSlot = { name: string; state: string; trafficPct: number };
export type ConnectionString = { name: string; value: string; type: string };

export type AppServiceResource = BaseResource & {
  resourceType: "AppService";
  status: "Running" | "Stopped";
  publish: "Code" | "Container" | "Static Web App";
  runtimeStack: string;
  operatingSystem: "Linux" | "Windows";
  appServicePlan: string;
  planTier: string;
  defaultUrl: string;
  appSettings: Record<string, string>;
  connectionStrings: ConnectionString[];
  customDomains: string[];
  corsOrigins: string[];
  publicAccess: boolean;
  appInsights: boolean;
  basicAuthEnabled: boolean;
  zoneRedundancy: boolean;
  instances: number;
  slots: AppServiceSlot[];
  continuousDeployment: boolean;
  cdProvider: string;
  cdRepo: string;
  cdBranch: string;
  vnetIntegration: string | null;
};
