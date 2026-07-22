import type {
  LbBackendPool,
  LbFrontendConfig,
  LbHealthProbe,
  LbNatRule,
  LbOutboundRule,
  LbRule,
} from "./lbTypes";

export type LbWizardTag = { key: string; value: string };

export type LbWizardState = {
  resourceGroup: string;
  lbName: string;
  region: string;
  sku: "Standard" | "Basic";
  tier: "Regional" | "Global";
  lbType: "Public" | "Internal";
  frontendConfigs: LbFrontendConfig[];
  backendPools: LbBackendPool[];
  healthProbes: LbHealthProbe[];
  lbRules: LbRule[];
  natRules: LbNatRule[];
  outboundRules: LbOutboundRule[];
  tags: LbWizardTag[];
  inboundSubTab: "lbrules" | "natrules";
};

export function freshLbWizardState(): LbWizardState {
  return {
    resourceGroup: "",
    lbName: "",
    region: "(US) East US",
    sku: "Standard",
    tier: "Regional",
    lbType: "Public",
    frontendConfigs: [],
    backendPools: [],
    healthProbes: [],
    lbRules: [],
    natRules: [],
    outboundRules: [],
    tags: [],
    inboundSubTab: "lbrules",
  };
}

export function freshFrontendConfig(state: LbWizardState): LbFrontendConfig {
  const idx = state.frontendConfigs.length + 1;
  const base: LbFrontendConfig = {
    id: crypto.randomUUID(),
    name: `LoadBalancerFrontEnd${idx === 1 ? "" : idx}`,
    ipVersion: "IPv4",
  };
  if (state.lbType === "Public") {
    base.publicIpSource = "Create new";
    base.publicIpName = `pip-${state.lbName || "lb"}`;
    base.publicIpSku = state.sku;
    base.assignment = "Static";
    base.routingPreference = "Microsoft network";
    base.dnsLabel = "";
  } else {
    base.vnet = "";
    base.subnet = "default (10.0.0.0/24)";
    base.assignment = "Dynamic";
    base.privateIp = "";
  }
  return base;
}

export function freshBackendPool(state: LbWizardState): LbBackendPool {
  const idx = state.backendPools.length + 1;
  return { id: crypto.randomUUID(), name: `backendPool${idx}`, vnet: "", config: "NIC", targets: [] };
}

export function freshHealthProbe(state: LbWizardState): LbHealthProbe {
  const idx = state.healthProbes.length + 1;
  return { id: crypto.randomUUID(), name: `probe${idx}`, protocol: "TCP", port: 80, path: "/", interval: 5, unhealthyThreshold: 2 };
}

export function freshLbRule(state: LbWizardState): LbRule {
  const idx = state.lbRules.length + 1;
  return {
    id: crypto.randomUUID(),
    name: `lbrule${idx}`,
    ipVersion: "IPv4",
    frontendIp: state.frontendConfigs[0]?.name ?? "",
    backendPool: state.backendPools[0]?.name ?? "",
    protocol: "TCP",
    frontendPort: 80,
    backendPort: 80,
    healthProbe: state.healthProbes[0]?.name ?? "",
    sessionPersistence: "None",
    idleTimeout: 4,
    tcpReset: false,
    floatingIp: false,
    useForSnat: false,
  };
}

export function freshNatRule(state: LbWizardState): LbNatRule {
  const idx = state.natRules.length + 1;
  return {
    id: crypto.randomUUID(),
    name: `natrule${idx}`,
    frontendIp: state.frontendConfigs[0]?.name ?? "",
    portRange: "50000-50099",
    backendPool: state.backendPools[0]?.name ?? "",
    backendPort: 3389,
    idleTimeout: 4,
    tcpReset: false,
  };
}

export function freshOutboundRule(state: LbWizardState): LbOutboundRule {
  const idx = state.outboundRules.length + 1;
  return {
    id: crypto.randomUUID(),
    name: `outrule${idx}`,
    ipVersion: "IPv4",
    frontendIp: state.frontendConfigs[0]?.name ?? "",
    protocol: "All",
    backendPool: state.backendPools[0]?.name ?? "",
    idleTimeout: 4,
    tcpReset: false,
  };
}

export function portConflict(rule: LbRule, rules: LbRule[]): string | null {
  if (!rule.frontendIp || !rule.frontendPort) return null;
  const other = rules.find(
    (x) => x.id !== rule.id && x.frontendIp === rule.frontendIp && x.frontendPort === rule.frontendPort && x.protocol === rule.protocol,
  );
  return other ? other.name : null;
}

export function validateLbWizardState(state: LbWizardState): string[] {
  const errors: string[] = [];
  if (!state.lbName) errors.push("Load balancer name is required.");
  else if (!/^[a-zA-Z0-9-]{1,80}$/.test(state.lbName)) errors.push("Name must be 1-80 alphanumeric or hyphen characters.");
  if (!state.resourceGroup) errors.push("Resource group is required.");
  if (state.frontendConfigs.length === 0) errors.push("At least one frontend IP configuration is required.");
  state.lbRules.forEach((r) => {
    if (!r.frontendIp) errors.push(`Load balancing rule "${r.name}" has no frontend IP.`);
    if (!r.backendPool) errors.push(`Load balancing rule "${r.name}" has no backend pool.`);
    if (!r.healthProbe) errors.push(`Load balancing rule "${r.name}" has no health probe.`);
  });
  return errors;
}
