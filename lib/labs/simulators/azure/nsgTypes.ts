import type { BaseResource } from "./sharedTypes";

export type NsgRuleSourceDest = "Any" | "IP Addresses" | "Service Tag" | "Application security group" | "My IP address" | "VirtualNetwork";

export type NsgRule = {
  id: string;
  priority: number;
  name: string;
  description: string;
  direction: "Inbound" | "Outbound";
  action: "Allow" | "Deny";
  protocol: string;
  sourcePortRanges: string;
  source: NsgRuleSourceDest;
  sourceAddresses: string;
  sourceServiceTag: string;
  destPortRanges: string;
  dest: NsgRuleSourceDest;
  destAddresses: string;
  destServiceTag: string;
  service: string;
};

export type NsgResource = BaseResource & {
  resourceType: "NetworkSecurityGroup";
  inboundRules: NsgRule[];
  outboundRules: NsgRule[];
  associatedSubnets: string[];
  associatedNICs: string[];
  lastModified: string;
};

export function newRuleDraft(direction: "Inbound" | "Outbound", existing: NsgRule[]): NsgRule {
  const used = new Set(existing.map((r) => r.priority));
  let priority = 100;
  while (used.has(priority)) priority += 10;

  return {
    id: crypto.randomUUID(),
    priority,
    name: "",
    description: "",
    direction,
    action: "Allow",
    protocol: "TCP",
    sourcePortRanges: "*",
    source: "Any",
    sourceAddresses: "",
    sourceServiceTag: "VirtualNetwork",
    destPortRanges: "",
    dest: "Any",
    destAddresses: "",
    destServiceTag: "VirtualNetwork",
    service: "Custom",
  };
}
