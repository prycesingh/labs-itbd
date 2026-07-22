import type { BaseResource } from "./sharedTypes";
import type { RedundancyOption } from "./storageData";

export type StorageContainer = { name: string; publicAccess: "Private" | "Blob" | "Container"; lastModified: string; leaseStatus: string };
export type StorageFileShare = { name: string; quotaGiB: number; tier: "TransactionOptimized" | "Hot" | "Cool" | "Premium"; protocol: "SMB" | "NFS"; created: string };
export type StorageQueue = { name: string; url: string; messageCount: number };
export type StorageTable = { name: string; url: string };

export type StorageVnetRule = { vnet: string; subnet: string; range: string; endpointStatus: string };
export type StorageIpRule = { cidr: string; label: string };
export type StoragePrivateEndpoint = { name: string; vnet: string; subnet: string; targetSubResource: string; status: string };

export type StorageLifecycleRule = { name: string; blobType: string; scope: string; transitions: string; enabled: boolean };
export type StorageObjectReplRule = { name: string; srcContainer: string; dstAccount: string; dstContainer: string; copyScope: string; status: string };
export type StorageInventoryRule = { name: string; dest: string; format: "Csv" | "Parquet"; frequency: "Daily" | "Weekly"; fields: string };
export type StorageAlertRule = { id: string; name: string; signal: string; operator: string; threshold: string; window: string; severity: string; enabled: boolean };

export type StorageFrontDoorProfile = { profile: string; endpoint: string; sku: string; waf: string; caching: string };
export type StorageDefenderConfig = { enabled: boolean; plan: "On-upload" | "Per-transaction"; sensitiveDataDiscovery: boolean; malwareScanning: boolean };

export type StorageSasState = {
  svcBlob: boolean;
  svcFile: boolean;
  svcQueue: boolean;
  svcTable: boolean;
  rtService: boolean;
  rtContainer: boolean;
  rtObject: boolean;
  pRead: boolean;
  pWrite: boolean;
  pDelete: boolean;
  pList: boolean;
  pAdd: boolean;
  pCreate: boolean;
  pUpdate: boolean;
  pProcess: boolean;
  start: string;
  expiry: string;
  allowedIp: string;
  protocol: "HTTPS only" | "HTTPS and HTTP";
  signingKey: "key1" | "key2";
};

export function freshSasState(): StorageSasState {
  return {
    svcBlob: true,
    svcFile: false,
    svcQueue: false,
    svcTable: false,
    rtService: false,
    rtContainer: true,
    rtObject: true,
    pRead: true,
    pWrite: false,
    pDelete: false,
    pList: true,
    pAdd: false,
    pCreate: false,
    pUpdate: false,
    pProcess: false,
    start: "",
    expiry: "",
    allowedIp: "",
    protocol: "HTTPS only",
    signingKey: "key1",
  };
}

export type StorageResource = BaseResource & {
  resourceType: "StorageAccount";
  performance: "Standard" | "Premium";
  redundancy: RedundancyOption["id"];
  primaryService: string;
  secureTransfer: boolean;
  tlsVersion: string;
  hierarchicalNamespace: boolean;
  accessTier: "Hot" | "Cool";
  networkAccess: string;
  routingPreference: string;
  allowBlobPublicAccess: boolean;
  enableStorageKeyAccess: boolean;
  defaultEntraAuth: boolean;
  enableSftp: boolean;
  enableNfsV3: boolean;
  allowCrossTenantReplication: boolean;
  largeFileShares: boolean;
  enablePointInTimeRestore: boolean;
  pointInTimeRestoreDays: number;
  enableSoftDeleteBlobs: boolean;
  softDeleteBlobsDays: number;
  enableSoftDeleteContainers: boolean;
  softDeleteContainersDays: number;
  enableSoftDeleteFileShares: boolean;
  softDeleteFileSharesDays: number;
  enableBlobVersioning: boolean;
  enableBlobChangeFeed: boolean;
  enableVersionLevelImmutability: boolean;
  encryptionKey: "Microsoft-managed key" | "Customer-managed key";
  primaryEndpoints: { blob: string; file: string; queue: string; table: string; web: string; dfs: string };
  key1: string;
  key2: string;
  containers: StorageContainer[];
  fileShares: StorageFileShare[];
  queues: StorageQueue[];
  tables: StorageTable[];
  networkVnets: StorageVnetRule[];
  networkIps: StorageIpRule[];
  privateEndpoints: StoragePrivateEndpoint[];
  lifecycleRules: StorageLifecycleRule[];
  objectReplRules: StorageObjectReplRule[];
  inventoryRules: StorageInventoryRule[];
  alertRules: StorageAlertRule[];
  frontDoorProfile: StorageFrontDoorProfile | null;
  defenderForStorage: StorageDefenderConfig;
  sas: StorageSasState;
  status: "Succeeded";
};
