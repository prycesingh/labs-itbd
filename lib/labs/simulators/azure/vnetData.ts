export const SERVICE_ENDPOINTS = [
  "Microsoft.AzureActiveDirectory",
  "Microsoft.AzureCosmosDB",
  "Microsoft.ContainerRegistry",
  "Microsoft.EventHub",
  "Microsoft.KeyVault",
  "Microsoft.ServiceBus",
  "Microsoft.Sql",
  "Microsoft.Storage",
  "Microsoft.Web",
];

export const DELEGATIONS = [
  "",
  "Microsoft.ContainerInstance/containerGroups",
  "Microsoft.Web/serverFarms",
  "Microsoft.DBforPostgreSQL/flexibleServers",
  "Microsoft.DBforMySQL/flexibleServers",
  "Microsoft.Sql/managedInstances",
  "Microsoft.NetApp/volumes",
  "Microsoft.HardwareSecurityModules/dedicatedHSMs",
  "Microsoft.Logic/integrationServiceEnvironments",
  "Microsoft.ApiManagement/service",
  "Microsoft.ServiceFabricMesh/networks",
];

export const BASTION_COST: Record<"Basic" | "Standard", number> = { Basic: 138.62, Standard: 219.0 };
export const FIREWALL_COST: Record<"Basic" | "Standard" | "Premium", number> = {
  Basic: 295.2,
  Standard: 912.5,
  Premium: 1825.0,
};
export const DDOS_COST = 2944.0;

export function validCidr(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(value);
}

export function availableIps(cidr: string): string {
  const m = cidr.match(/\/(\d+)$/);
  if (!m) return "—";
  const bits = parseInt(m[1], 10);
  if (bits < 0 || bits > 32) return "—";
  const total = Math.pow(2, 32 - bits);
  return Math.max(0, total - 5).toLocaleString();
}

export function totalAddressSpaceIps(spaces: string[]): number {
  let total = 0;
  spaces.forEach((a) => {
    const m = a.match(/\/(\d+)$/);
    if (m) {
      const bits = parseInt(m[1], 10);
      if (bits >= 0 && bits <= 32) total += Math.pow(2, 32 - bits);
    }
  });
  return total;
}
