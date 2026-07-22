import { defaultBootDiag, type VmResource } from "./types";
import type { RgResource } from "./rgTypes";
import type { NsgResource, NsgRule } from "./nsgTypes";
import type { VnetResource } from "./vnetTypes";
import type { AppServiceResource } from "./appServiceTypes";
import type { SqlResource } from "./sqlTypes";
import type { StorageResource } from "./storageTypes";
import type { LbResource } from "./lbTypes";
import { primaryEndpointsFor, randomKey } from "./storageData";
import { freshSasState } from "./storageTypes";

const NOW = "2026-07-08T00:00:00.000Z";

function base(id: string, name: string, resourceGroup: string, region = "(US) East US") {
  return { id, name, resourceGroup, region, tags: {}, createdAt: NOW, estimatedCost: 0 };
}

export function labRg(id: string, name: string, region = "(US) East US"): RgResource {
  return { ...base(id, name, name, region), resourceType: "ResourceGroup", status: "Succeeded" };
}

export function labVm(id: string, name: string, resourceGroup: string, overrides: Partial<VmResource> = {}): VmResource {
  const vm: VmResource = {
    ...base(id, name, resourceGroup),
    resourceType: "VirtualMachine",
    status: "Running",
    os: "Linux",
    osImage: "Ubuntu Server 22.04 LTS",
    size: "Standard_B2s",
    vcpus: 2,
    ram: 4,
    username: "azureuser",
    authType: "SSH public key",
    virtualNetwork: `vnet-${resourceGroup}`,
    subnet: "default",
    publicIp: "None",
    privateIp: "10.0.0.4",
    publicIpAddress: null,
    nicNsg: "None",
    inboundPorts: [],
    osDiskType: "Premium SSD",
    dataDisks: [],
    enableAutoShutdown: false,
    autoShutdownTime: "19:00",
    enableBackup: false,
    extensions: [],
    bootDiag: defaultBootDiag(),
    restorePoints: [],
    asr: { enabled: false },
    alertRules: [],
    policyCompliance: [],
  };
  return { ...vm, ...overrides };
}

export function labNsgRule(overrides: Partial<NsgRule> & { id: string; direction: "Inbound" | "Outbound" }): NsgRule {
  return {
    priority: 100,
    name: "Rule",
    description: "",
    action: "Allow",
    protocol: "TCP",
    sourcePortRanges: "*",
    source: "Any",
    sourceAddresses: "*",
    sourceServiceTag: "VirtualNetwork",
    destPortRanges: "*",
    dest: "Any",
    destAddresses: "*",
    destServiceTag: "VirtualNetwork",
    service: "Custom",
    ...overrides,
  };
}

export function labNsg(
  id: string,
  name: string,
  resourceGroup: string,
  inboundRules: NsgRule[] = [],
  outboundRules: NsgRule[] = [],
): NsgResource {
  return {
    ...base(id, name, resourceGroup),
    resourceType: "NetworkSecurityGroup",
    inboundRules,
    outboundRules,
    associatedSubnets: [],
    associatedNICs: [],
    lastModified: NOW,
  };
}

export function labVnet(id: string, name: string, resourceGroup: string, overrides: Partial<VnetResource> = {}): VnetResource {
  const vnet: VnetResource = {
    ...base(id, name, resourceGroup),
    resourceType: "VirtualNetwork",
    addressSpace: ["10.10.0.0/16"],
    subnets: [
      {
        id: `${id}-subnet-default`,
        name: "default",
        addressRange: "10.10.0.0/24",
        defaultOutbound: false,
        natGateway: "",
        nsg: "",
        routeTable: "",
        delegation: "",
        serviceEndpoints: [],
        privateEndpointPolicies: "Disabled",
      },
    ],
    dnsServers: "Azure-provided",
    customDnsServers: [],
    peerings: [],
    ddosProtection: false,
    ddosPlan: null,
    ddosTier: "Basic (free)",
    bastionEnabled: false,
    bastionTier: null,
    firewallEnabled: false,
    firewallTier: null,
    alertRules: [],
    ddosAttackHistory: [],
    status: "Succeeded",
  };
  return { ...vnet, ...overrides };
}

export function labAppService(id: string, name: string, resourceGroup: string, overrides: Partial<AppServiceResource> = {}): AppServiceResource {
  const app: AppServiceResource = {
    ...base(id, name, resourceGroup),
    resourceType: "AppService",
    status: "Running",
    publish: "Code",
    runtimeStack: ".NET 8",
    operatingSystem: "Linux",
    appServicePlan: `plan-${name}`,
    planTier: "Basic (B1)",
    defaultUrl: `https://${name}.azurewebsites.net`,
    appSettings: {},
    connectionStrings: [],
    customDomains: [],
    corsOrigins: [],
    publicAccess: true,
    appInsights: false,
    basicAuthEnabled: true,
    zoneRedundancy: false,
    instances: 1,
    slots: [],
    continuousDeployment: false,
    cdProvider: "GitHub",
    cdRepo: "",
    cdBranch: "main",
    vnetIntegration: null,
  };
  return { ...app, ...overrides };
}

export function labSql(id: string, name: string, resourceGroup: string, overrides: Partial<SqlResource> = {}): SqlResource {
  const sql: SqlResource = {
    ...base(id, name, resourceGroup),
    resourceType: "SqlDatabase",
    server: `srv-${name}`,
    serverAdminLogin: "sqladmin",
    serverFQDN: `srv-${name}.database.windows.net`,
    pricingModel: "vCore",
    serviceTier: "General Purpose",
    computeTier: "Provisioned",
    vCores: 2,
    dtu: null,
    hardwareFamily: "Gen5",
    dataMaxGB: 32,
    backupRedundancy: "Locally-redundant backup storage (LRS)",
    status: "Online",
    collation: "SQL_Latin1_General_CP1_CI_AS",
    publicAccess: true,
    allowAzureServices: true,
    firewallRules: [],
    connectionPolicy: "Default",
    minTlsVersion: "1.0",
    defender: false,
    ledger: false,
    tdeOption: "Service-managed key",
    authMethod: "Use SQL authentication",
    useExistingData: "None",
    maintenanceWindow: "System default",
    workloadEnv: "Development",
    ltrWeekly: 0,
    ltrMonthly: 0,
    ltrYearly: 0,
    auditingEnabled: false,
    auditRetentionDays: 90,
    alertRules: [],
    diagSettings: [],
  };
  return { ...sql, ...overrides };
}

export function labStorage(id: string, name: string, resourceGroup: string, overrides: Partial<StorageResource> = {}): StorageResource {
  const sa: StorageResource = {
    ...base(id, name, resourceGroup),
    resourceType: "StorageAccount",
    performance: "Standard",
    redundancy: "LRS",
    primaryService: "Azure Blob Storage",
    secureTransfer: true,
    tlsVersion: "Version 1.2",
    hierarchicalNamespace: false,
    accessTier: "Hot",
    networkAccess: "Enable from all networks",
    routingPreference: "Microsoft network routing",
    allowBlobPublicAccess: true,
    enableStorageKeyAccess: true,
    defaultEntraAuth: false,
    enableSftp: false,
    enableNfsV3: false,
    allowCrossTenantReplication: false,
    largeFileShares: false,
    enablePointInTimeRestore: false,
    pointInTimeRestoreDays: 7,
    enableSoftDeleteBlobs: true,
    softDeleteBlobsDays: 7,
    enableSoftDeleteContainers: true,
    softDeleteContainersDays: 7,
    enableSoftDeleteFileShares: true,
    softDeleteFileSharesDays: 7,
    enableBlobVersioning: false,
    enableBlobChangeFeed: false,
    enableVersionLevelImmutability: false,
    encryptionKey: "Microsoft-managed key",
    primaryEndpoints: primaryEndpointsFor(name),
    key1: `fake-base64-key-${randomKey()}`,
    key2: `fake-base64-key-${randomKey()}`,
    containers: [],
    fileShares: [],
    queues: [],
    tables: [],
    networkVnets: [],
    networkIps: [],
    privateEndpoints: [],
    lifecycleRules: [],
    objectReplRules: [],
    inventoryRules: [],
    alertRules: [],
    frontDoorProfile: null,
    defenderForStorage: { enabled: false, plan: "On-upload", sensitiveDataDiscovery: false, malwareScanning: false },
    sas: freshSasState(),
    status: "Succeeded",
  };
  return { ...sa, ...overrides };
}

export function labLb(id: string, name: string, resourceGroup: string, overrides: Partial<LbResource> = {}): LbResource {
  const lb: LbResource = {
    ...base(id, name, resourceGroup),
    resourceType: "LoadBalancer",
    sku: "Standard",
    tier: "Regional",
    lbType: "Public",
    frontendConfigs: [],
    backendPools: [],
    healthProbes: [],
    lbRules: [],
    natRules: [],
    outboundRules: [],
  };
  return { ...lb, ...overrides };
}
