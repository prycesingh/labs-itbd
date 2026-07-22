import type { BaseResource } from "./sharedTypes";

export type LbFrontendConfig = {
  id: string;
  name: string;
  ipVersion: "IPv4" | "IPv6";
  // Public
  publicIpSource?: string;
  publicIpName?: string;
  publicIpSku?: string;
  assignment?: string;
  routingPreference?: string;
  dnsLabel?: string;
  // Internal
  vnet?: string;
  subnet?: string;
  privateIp?: string;
};

export type LbBackendTarget = { vmId?: string; vmName?: string; privateIp?: string; os?: string; ip?: string; name?: string };

export type LbBackendPool = {
  id: string;
  name: string;
  vnet: string;
  config: "NIC" | "IP Address";
  targets: LbBackendTarget[];
};

export type LbHealthProbe = {
  id: string;
  name: string;
  protocol: "TCP" | "HTTP" | "HTTPS";
  port: number;
  path: string;
  interval: number;
  unhealthyThreshold: number;
};

export type LbRule = {
  id: string;
  name: string;
  ipVersion: "IPv4" | "IPv6";
  frontendIp: string;
  backendPool: string;
  protocol: "TCP" | "UDP";
  frontendPort: number;
  backendPort: number;
  healthProbe: string;
  sessionPersistence: string;
  idleTimeout: number;
  tcpReset: boolean;
  floatingIp: boolean;
  useForSnat?: boolean;
};

export type LbNatRule = {
  id: string;
  name: string;
  frontendIp: string;
  portRange: string;
  backendPool: string;
  backendPort: number;
  idleTimeout: number;
  tcpReset: boolean;
};

export type LbOutboundRule = {
  id: string;
  name: string;
  ipVersion: "IPv4" | "IPv6";
  frontendIp: string;
  protocol: "All" | "TCP" | "UDP";
  backendPool: string;
  idleTimeout: number;
  tcpReset: boolean;
};

export type LbResource = BaseResource & {
  resourceType: "LoadBalancer";
  sku: "Standard" | "Basic";
  tier: "Regional" | "Global";
  lbType: "Public" | "Internal";
  frontendConfigs: LbFrontendConfig[];
  backendPools: LbBackendPool[];
  healthProbes: LbHealthProbe[];
  lbRules: LbRule[];
  natRules: LbNatRule[];
  outboundRules: LbOutboundRule[];
};
