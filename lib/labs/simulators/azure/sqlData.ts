export type DtuTier = { id: "Basic" | "Standard" | "Premium"; label: string; dtu: number; maxGB: number; cost: number; desc: string };
export type VcoreTier = { id: "GeneralPurpose" | "BusinessCritical" | "Hyperscale" | "Serverless"; label: string; desc: string; baseCost: number; gbCost: number };
export type HardwareFamily = { id: "Gen5" | "StandardGen6" | "PremiumGen6" | "PremiumGen6M"; label: string; desc: string };

export const DTU_TIERS: DtuTier[] = [
  { id: "Basic", label: "Basic", dtu: 5, maxGB: 2, cost: 4.99, desc: "For less demanding workloads" },
  { id: "Standard", label: "Standard", dtu: 10, maxGB: 250, cost: 15.0, desc: "For workloads with typical performance requirements" },
  { id: "Premium", label: "Premium", dtu: 125, maxGB: 500, cost: 465.0, desc: "For IO-intensive workloads" },
];

export const VCORE_TIERS: VcoreTier[] = [
  { id: "GeneralPurpose", label: "General Purpose", desc: "Balanced compute and storage options for most business workloads.", baseCost: 0.5057, gbCost: 0.115 },
  { id: "BusinessCritical", label: "Business Critical", desc: "High transaction rate and high resilience with low latency I/O.", baseCost: 1.3568, gbCost: 0.25 },
  { id: "Hyperscale", label: "Hyperscale", desc: "Highly scalable storage and read-scale tier for large OLTP/analytical DBs.", baseCost: 0.6105, gbCost: 0.1 },
  { id: "Serverless", label: "General Purpose (Serverless)", desc: "Auto-scaling compute that pauses during inactivity.", baseCost: 0.5187, gbCost: 0.115 },
];

export const HARDWARE_FAMILIES: HardwareFamily[] = [
  { id: "Gen5", label: "Standard-series (Gen5)", desc: "Default. Intel E5-2673 v4 / Intel 8272CL." },
  { id: "StandardGen6", label: "Standard-series (Gen6/DC)", desc: "Newer Intel hardware with confidential compute support." },
  { id: "PremiumGen6", label: "Premium-series", desc: "Faster Intel Ice Lake CPUs for high-perf workloads." },
  { id: "PremiumGen6M", label: "Premium-series memory optimized", desc: "High memory-to-vCore ratio." },
];

export const COLLATIONS = [
  "SQL_Latin1_General_CP1_CI_AS",
  "SQL_Latin1_General_CP1_CS_AS",
  "Latin1_General_100_CI_AS_SC_UTF8",
  "Japanese_CI_AS",
  "Chinese_PRC_CI_AS",
  "French_CI_AS",
];

export const BACKUP_REDUNDANCIES = [
  "Locally-redundant backup storage (LRS)",
  "Zone-redundant backup storage (ZRS)",
  "Geo-redundant backup storage (GRS)",
];

export function passwordIsComplex(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
}

export function estimateMonthlyCost(args: {
  pricingModel: "DTU" | "vCore";
  dtuTier: DtuTier["id"];
  dtuMaxGB: number;
  vcoreTier: VcoreTier["id"];
  vCores: number;
  dataMaxGB: number;
  backupRedundancy: string;
}): { compute: number; storage: number; backup: number; total: number } {
  let compute = 0;
  let storage = 0;
  if (args.pricingModel === "DTU") {
    const tier = DTU_TIERS.find((t) => t.id === args.dtuTier) ?? DTU_TIERS[1];
    compute = tier.cost;
    storage = Math.max(0, args.dtuMaxGB - 5) * 0.1;
  } else {
    const tier = VCORE_TIERS.find((t) => t.id === args.vcoreTier) ?? VCORE_TIERS[0];
    compute = tier.baseCost * args.vCores * 730;
    storage = tier.gbCost * args.dataMaxGB;
  }
  const totalDataGB = args.pricingModel === "DTU" ? args.dtuMaxGB : args.dataMaxGB;
  const redundancyMultiplier = args.backupRedundancy.includes("GRS") ? 0.2 : args.backupRedundancy.includes("ZRS") ? 0.125 : 0.1;
  const backup = totalDataGB * redundancyMultiplier;
  return { compute, storage, backup, total: compute + storage + backup };
}
