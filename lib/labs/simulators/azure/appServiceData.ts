/**
 * Static reference data for the App Service simulator — mirrors real Azure
 * App Service defaults (runtime stacks, pricing tiers). Authored fixture
 * data; no per-user variation.
 */

export const APP_SERVICE_STACKS = [
  ".NET 8",
  ".NET 6",
  "Node 20 LTS",
  "Node 18 LTS",
  "Python 3.12",
  "Python 3.11",
  "Java 17",
  "Java 11",
  "PHP 8.3",
  "Ruby 3.2",
];

export type AppServicePlanOption = { name: string; cores: string; ram: string; cost: string };

export const APP_SERVICE_PLANS: AppServicePlanOption[] = [
  { name: "Free (F1)", cores: "Shared", ram: "1 GB", cost: "Free" },
  { name: "Basic (B1)", cores: "1", ram: "1.75 GB", cost: "$13.14/mo" },
  { name: "Standard (S1)", cores: "1", ram: "1.75 GB", cost: "$69.35/mo" },
  { name: "Premium (P1v3)", cores: "2", ram: "8 GB", cost: "$138.70/mo" },
];

export type AppServiceTier = {
  id: string;
  tier: string;
  label: string;
  cores: string;
  ram: string;
  storage: string;
  cost: number;
  note: string;
};

export const APP_SERVICE_TIERS: AppServiceTier[] = [
  { id: "F1", tier: "Free", label: "F1: Free", cores: "Shared", ram: "1 GB", storage: "1 GB", cost: 0, note: "Try for free, 60 min/day compute" },
  { id: "B1", tier: "Basic", label: "B1: Basic", cores: "1", ram: "1.75 GB", storage: "10 GB", cost: 13.14, note: "Dev/Test workloads, no auto-scale" },
  { id: "S1", tier: "Standard", label: "S1: Standard", cores: "1", ram: "1.75 GB", storage: "50 GB", cost: 69.35, note: "Production workloads, auto-scale, slots" },
  { id: "P1v3", tier: "PremiumV3", label: "P1v3: Premium", cores: "2", ram: "8 GB", storage: "250 GB", cost: 138.7, note: "Enhanced performance, faster processors" },
  { id: "P2v3", tier: "PremiumV3", label: "P2v3: Premium", cores: "4", ram: "16 GB", storage: "250 GB", cost: 277.4, note: "More resources for production workloads" },
  { id: "P3v3", tier: "PremiumV3", label: "P3v3: Premium", cores: "8", ram: "32 GB", storage: "250 GB", cost: 554.8, note: "Highest performance Premium tier" },
];

export const APP_INSIGHTS_COST = 2.3;

export function isStandardOrBetter(planTier: string): boolean {
  return planTier === "S1" || planTier === "P1v3" || planTier === "P2v3" || planTier === "P3v3";
}

export function parsePlanCost(costStr: string): number {
  if (!costStr || costStr === "Free") return 0;
  const m = costStr.match(/\$([0-9.]+)/);
  return m ? parseFloat(m[1]) : 0;
}
