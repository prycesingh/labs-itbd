import type { RedundancyOption } from "./storageData";

export type StorageWizardTag = { key: string; value: string };

export type StorageWizardState = {
  resourceGroup: string;
  storageName: string;
  region: string;
  primaryService: string;
  performance: "Standard" | "Premium";
  redundancy: RedundancyOption["id"];
  secureTransfer: boolean;
  allowPublicAccessContainers: boolean;
  enableStorageKeyAccess: boolean;
  defaultEntraAuth: boolean;
  tlsVersion: string;
  hierarchicalNamespace: boolean;
  enableSftp: boolean;
  enableNfsV3: boolean;
  allowCrossTenantReplication: boolean;
  accessTier: "Hot" | "Cool";
  largeFileShares: boolean;
  networkAccess: "Enable from all networks" | "Enable from selected virtual networks and IP addresses" | "Disable public access and use private access";
  routingPreference: "Microsoft network routing" | "Internet routing";
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
  enableCustomerManagedKey: boolean;
  tags: StorageWizardTag[];
};

export function freshStorageWizardState(): StorageWizardState {
  return {
    resourceGroup: "",
    storageName: "",
    region: "(US) East US",
    primaryService: "Azure Blob Storage",
    performance: "Standard",
    redundancy: "LRS",
    secureTransfer: true,
    allowPublicAccessContainers: true,
    enableStorageKeyAccess: true,
    defaultEntraAuth: false,
    tlsVersion: "Version 1.2",
    hierarchicalNamespace: false,
    enableSftp: false,
    enableNfsV3: false,
    allowCrossTenantReplication: false,
    accessTier: "Hot",
    largeFileShares: false,
    networkAccess: "Enable from all networks",
    routingPreference: "Microsoft network routing",
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
    enableCustomerManagedKey: false,
    tags: [],
  };
}

export function validateStorageWizardState(state: StorageWizardState): string[] {
  const errors: string[] = [];
  if (!state.storageName) errors.push("Storage account name is required.");
  else if (!/^[a-z0-9]{3,24}$/.test(state.storageName)) {
    errors.push("Storage account name must be 3-24 characters and contain only lowercase letters and numbers.");
  }
  if (!state.resourceGroup) errors.push("Resource group is required. Create one on the Resource groups page.");
  if (state.enableSftp && !state.hierarchicalNamespace) errors.push("SFTP requires hierarchical namespace to be enabled.");
  if (state.enableNfsV3 && !state.hierarchicalNamespace) errors.push("NFS v3 requires hierarchical namespace to be enabled.");
  if (state.enablePointInTimeRestore && !state.enableSoftDeleteBlobs) errors.push("Point-in-time restore requires soft delete for blobs.");
  if (state.enablePointInTimeRestore && !state.enableBlobVersioning) errors.push("Point-in-time restore requires blob versioning.");
  if (state.enablePointInTimeRestore && !state.enableBlobChangeFeed) errors.push("Point-in-time restore requires blob change feed.");
  if (
    state.performance === "Premium" &&
    (state.redundancy === "GRS" || state.redundancy === "GZRS" || state.redundancy === "RA-GRS" || state.redundancy === "RA-GZRS")
  ) {
    errors.push("Premium performance does not support geo-redundant storage. Choose LRS or ZRS.");
  }
  return errors;
}
