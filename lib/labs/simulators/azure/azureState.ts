import type { AppServiceResource } from "./appServiceTypes";
import type { LbResource } from "./lbTypes";
import type { NsgResource } from "./nsgTypes";
import type { RgResource } from "./rgTypes";
import type { ActivityLogEntry } from "./sharedTypes";
import type { SqlResource } from "./sqlTypes";
import type { StorageResource } from "./storageTypes";
import type { VmResource } from "./types";
import type { VnetResource } from "./vnetTypes";

export type AzureResource =
  | VmResource
  | RgResource
  | NsgResource
  | AppServiceResource
  | LbResource
  | VnetResource
  | SqlResource
  | StorageResource;

export type AzureSimState = {
  resources: AzureResource[];
  activityLog: ActivityLogEntry[];
};

export function freshAzureSimState(): AzureSimState {
  return { resources: [], activityLog: [] };
}

export function vmResources(state: AzureSimState): VmResource[] {
  return state.resources.filter((r): r is VmResource => r.resourceType === "VirtualMachine");
}

export function rgResources(state: AzureSimState): RgResource[] {
  return state.resources.filter((r): r is RgResource => r.resourceType === "ResourceGroup");
}

export function nsgResources(state: AzureSimState): NsgResource[] {
  return state.resources.filter((r): r is NsgResource => r.resourceType === "NetworkSecurityGroup");
}

export function appServiceResources(state: AzureSimState): AppServiceResource[] {
  return state.resources.filter((r): r is AppServiceResource => r.resourceType === "AppService");
}

export function lbResources(state: AzureSimState): LbResource[] {
  return state.resources.filter((r): r is LbResource => r.resourceType === "LoadBalancer");
}

export function vnetResources(state: AzureSimState): VnetResource[] {
  return state.resources.filter((r): r is VnetResource => r.resourceType === "VirtualNetwork");
}

export function sqlResources(state: AzureSimState): SqlResource[] {
  return state.resources.filter((r): r is SqlResource => r.resourceType === "SqlDatabase");
}

export function storageResources(state: AzureSimState): StorageResource[] {
  return state.resources.filter((r): r is StorageResource => r.resourceType === "StorageAccount");
}

export function resourcesInGroup(state: AzureSimState, groupName: string): AzureResource[] {
  return state.resources.filter((r) => r.resourceGroup === groupName && r.resourceType !== "ResourceGroup");
}
