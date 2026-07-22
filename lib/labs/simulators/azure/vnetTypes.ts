import type { BaseResource } from "./sharedTypes";

export type VnetSubnet = {
  id: string;
  name: string;
  addressRange: string;
  defaultOutbound: boolean;
  natGateway: string;
  nsg: string;
  routeTable: string;
  delegation: string;
  serviceEndpoints: string[];
  privateEndpointPolicies: "Disabled" | "Network security groups" | "Route tables";
};

export type VnetPeering = {
  id: string;
  name: string;
  remoteVnet: string;
  state: "Connected" | "Disconnected";
  gatewayTransit: boolean;
  useRemoteGateway: boolean;
  createdAt: string;
};

export type VnetAlertRule = {
  id: string;
  name: string;
  signal: string;
  operator: string;
  threshold: string;
  window: string;
  severity: string;
  enabled: boolean;
};

export type VnetDdosAttack = {
  when: string;
  ip: string;
  vector: string;
  peakPps: string;
  action: string;
};

export type VnetResource = BaseResource & {
  resourceType: "VirtualNetwork";
  addressSpace: string[];
  subnets: VnetSubnet[];
  dnsServers: "Azure-provided" | "Custom";
  customDnsServers: string[];
  peerings: VnetPeering[];
  ddosProtection: boolean;
  ddosPlan: string | null;
  ddosTier: "Basic (free)" | "IP Protection" | "Network Protection";
  bastionEnabled: boolean;
  bastionTier: "Basic" | "Standard" | null;
  firewallEnabled: boolean;
  firewallTier: "Basic" | "Standard" | "Premium" | null;
  alertRules: VnetAlertRule[];
  ddosAttackHistory: VnetDdosAttack[];
  status: "Succeeded";
};

export function freshSubnet(index: number): VnetSubnet {
  return {
    id: crypto.randomUUID(),
    name: index === 0 ? "default" : `subnet-${index + 1}`,
    addressRange: `10.0.${index}.0/24`,
    defaultOutbound: false,
    natGateway: "",
    nsg: "",
    routeTable: "",
    delegation: "",
    serviceEndpoints: [],
    privateEndpointPolicies: "Disabled",
  };
}
