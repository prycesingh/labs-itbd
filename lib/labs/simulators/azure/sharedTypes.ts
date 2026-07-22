/**
 * Shared across every Azure resource type in this simulator suite — mirrors
 * the source static site's single `AzureData.resources` flat array
 * (discriminated by `type`), so a Resource Group can list the VMs/etc.
 * inside it, and a future Storage/VNet/etc. simulator plugs into the same
 * list rather than each resource type keeping an isolated store.
 */

export type ActivityLogEntry = {
  timestamp: string;
  operation: string;
  resource: string;
  caller: string;
  status: "Succeeded" | "Failed";
};

export type BaseResource = {
  id: string;
  name: string;
  resourceGroup: string;
  region: string;
  tags: Record<string, string>;
  createdAt: string;
  estimatedCost: number;
};
