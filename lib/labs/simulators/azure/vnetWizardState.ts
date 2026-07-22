import { freshSubnet, type VnetSubnet } from "./vnetTypes";
import { validCidr } from "./vnetData";

export type VnetWizardTag = { key: string; value: string };

export type VnetWizardState = {
  resourceGroup: string;
  vnetName: string;
  region: string;
  bastionEnabled: boolean;
  bastionTier: "Basic" | "Standard";
  bastionSubnet: string;
  bastionPublicIp: string;
  firewallEnabled: boolean;
  firewallTier: "Basic" | "Standard" | "Premium";
  firewallSubnet: string;
  firewallPublicIp: string;
  ddosEnabled: boolean;
  ddosPlan: string;
  addressSpaces: string[];
  subnets: VnetSubnet[];
  tags: VnetWizardTag[];
};

export function freshVnetWizardState(): VnetWizardState {
  return {
    resourceGroup: "",
    vnetName: "",
    region: "(US) East US",
    bastionEnabled: false,
    bastionTier: "Basic",
    bastionSubnet: "10.0.1.0/26",
    bastionPublicIp: "(new) bastion-pip",
    firewallEnabled: false,
    firewallTier: "Standard",
    firewallSubnet: "10.0.2.0/26",
    firewallPublicIp: "(new) firewall-pip",
    ddosEnabled: false,
    ddosPlan: "",
    addressSpaces: ["10.0.0.0/16"],
    subnets: [freshSubnet(0)],
    tags: [],
  };
}

export function validateVnetWizardState(state: VnetWizardState): string[] {
  const errors: string[] = [];
  if (!state.vnetName) errors.push("Virtual network name is required.");
  else if (!/^[a-zA-Z0-9_\-.]{2,64}$/.test(state.vnetName)) {
    errors.push("VNet name must be 2-64 characters: alphanumeric, hyphen, underscore, or period.");
  }
  if (!state.resourceGroup) errors.push("Resource group is required. Create one on the Resource groups page.");
  if (state.addressSpaces.length === 0) errors.push("At least one address space is required.");
  state.addressSpaces.forEach((a) => {
    if (!validCidr(a)) errors.push(`Address space "${a}" is not valid CIDR.`);
  });
  state.subnets.forEach((s) => {
    if (!s.name) errors.push("A subnet name is empty.");
    if (!validCidr(s.addressRange)) errors.push(`Subnet "${s.name || ""}" address range is not valid CIDR.`);
  });
  if (state.ddosEnabled && !state.ddosPlan) errors.push("Select a DDoS protection plan.");
  return errors;
}
