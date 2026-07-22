export type RedundancyOption = {
  id: "LRS" | "ZRS" | "GRS" | "GZRS" | "RA-GRS" | "RA-GZRS";
  name: string;
  desc: string;
};

export const REDUNDANCY: RedundancyOption[] = [
  { id: "LRS", name: "Locally-redundant storage (LRS)", desc: "Lowest cost. Three copies of your data within a single data center." },
  { id: "ZRS", name: "Zone-redundant storage (ZRS)", desc: "Three copies synchronously across availability zones in the primary region." },
  { id: "GRS", name: "Geo-redundant storage (GRS)", desc: "Six copies — three in the primary region (LRS) and three in a paired secondary region." },
  { id: "GZRS", name: "Geo-zone-redundant storage (GZRS)", desc: "ZRS in primary region plus async copy to paired secondary region." },
  { id: "RA-GRS", name: "Read-access geo-redundant storage (RA-GRS)", desc: "GRS with read access to the secondary region endpoint." },
  { id: "RA-GZRS", name: "Read-access geo-zone-redundant storage (RA-GZRS)", desc: "GZRS with read access to the secondary region endpoint." },
];

export const PRIMARY_SERVICES = ["Azure Blob Storage", "Azure Files", "Azure Tables", "Azure Queues"];

export const TLS_VERSIONS = ["Version 1.0", "Version 1.1", "Version 1.2"];

const PAIRED_REGIONS: Record<string, string> = {
  "(US) East US": "(US) West US",
  "(US) East US 2": "(US) Central US",
  "(US) West US 2": "(US) West Central US",
  "(US) West US 3": "(US) East US",
  "(US) Central US": "(US) East US 2",
  "(Europe) North Europe": "(Europe) West Europe",
  "(Europe) West Europe": "(Europe) North Europe",
  "(Europe) UK South": "(Europe) UK West",
  "(Europe) Germany West Central": "(Europe) Germany North",
  "(Asia Pacific) Southeast Asia": "(Asia Pacific) East Asia",
  "(Asia Pacific) East Asia": "(Asia Pacific) Southeast Asia",
  "(Asia Pacific) Japan East": "(Asia Pacific) Japan West",
  "(Asia Pacific) Central India": "(Asia Pacific) South India",
  "(Asia Pacific) South India": "(Asia Pacific) Central India",
  "(Asia Pacific) Australia East": "(Asia Pacific) Australia Southeast",
};

export function pairedRegionFor(region: string): string {
  return PAIRED_REGIONS[region] ?? "(US) West US";
}

export function isGeoRedundant(redundancy: string): boolean {
  return redundancy === "GRS" || redundancy === "GZRS" || redundancy === "RA-GRS" || redundancy === "RA-GZRS";
}

export function estimateMonthlyCost(args: { performance: "Standard" | "Premium"; redundancy: RedundancyOption["id"]; accessTier: "Hot" | "Cool" }): number {
  const baseGB = args.performance === "Premium" ? 0.15 : 0.018;
  const redundancyMult: Record<string, number> = { LRS: 1, ZRS: 1.25, GRS: 2, GZRS: 2.3, "RA-GRS": 2.5, "RA-GZRS": 2.9 };
  const accessTierMult = args.accessTier === "Cool" ? 0.6 : 1;
  const gb = 100;
  return baseGB * gb * (redundancyMult[args.redundancy] ?? 1) * accessTierMult;
}

export function randomKey(): string {
  let s = "";
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < 44; i++) s += alpha.charAt(Math.floor(Math.random() * alpha.length));
  return `${s}==`;
}

export function primaryEndpointsFor(name: string) {
  return {
    blob: `https://${name}.blob.core.windows.net/`,
    file: `https://${name}.file.core.windows.net/`,
    queue: `https://${name}.queue.core.windows.net/`,
    table: `https://${name}.table.core.windows.net/`,
    web: `https://${name}.z13.web.core.windows.net/`,
    dfs: `https://${name}.dfs.core.windows.net/`,
  };
}
