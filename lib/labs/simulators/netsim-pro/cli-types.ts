export type CliVendorId = "cisco" | "fortigate" | "paloalto" | "juniper" | "linux";

// ===== Cisco-style linear mode stack =====

export type CiscoCliModeFrame =
  | { kind: "user" }
  | { kind: "enable" }
  | { kind: "config" }
  | { kind: "config-if"; iface: string }
  | { kind: "config-router"; proto: string; id: string }
  | { kind: "config-line"; line: string }
  | { kind: "config-acl"; aclId: string };

export type CiscoCliInterface = {
  name: string;
  ip: string;
  mask: string;
  adminUp: boolean;
  lineUp: boolean;
  description: string;
  vlan: number | null;
};

export type CiscoCliVlan = { id: number; name: string };
export type CiscoCliRoute = { dst: string; mask: string; nextHop: string };
export type CiscoCliAclRule = { aclId: string; seq: number; action: "permit" | "deny"; text: string };

export type CiscoCliState = {
  hostname: string;
  modeStack: CiscoCliModeFrame[];
  interfaces: CiscoCliInterface[];
  vlans: CiscoCliVlan[];
  routes: CiscoCliRoute[];
  acls: CiscoCliAclRule[];
};

// ===== FortiGate-style config/edit object-cursor =====

export type FortiCliCursor = { configPath: string[]; editTarget: string | null };

export type FortiCliInterface = { name: string; ip: string; mask: string; status: "up" | "down"; alias: string };
export type FortiCliPolicy = {
  id: number;
  srcintf: string;
  dstintf: string;
  srcaddr: string;
  dstaddr: string;
  service: string;
  action: "accept" | "deny";
  status: "enable" | "disable";
};
export type FortiCliRoute = { dst: string; gateway: string; device: string };
export type FortiCliAddress = { name: string; subnet: string };

export type FortiCliState = {
  hostname: string;
  cursor: FortiCliCursor;
  pendingEdit: Record<string, unknown> | null;
  interfaces: FortiCliInterface[];
  policies: FortiCliPolicy[];
  routes: FortiCliRoute[];
  addresses: FortiCliAddress[];
};

// ===== Juniper / Palo Alto shared edit-path + commit model =====

export type EditPathCliInterface = { name: string; unit: number; ip: string; adminUp: boolean; zone: string };
export type EditPathCliZone = { name: string; interfaces: string[] };
export type EditPathCliRoute = { dst: string; nextHop: string };
export type EditPathCliSecurityRule = {
  name: string;
  fromZone: string;
  toZone: string;
  source: string;
  destination: string;
  application: string;
  action: "permit" | "deny";
};

export type EditPathCliState = {
  hostname: string;
  // Minimal necessary addition (per the cli-engine-editpath.ts build): tracks
  // whether the session has entered configuration mode via `configure`, since
  // `editPath` alone can't distinguish "operational mode" from "configuration
  // mode with editPath cleared via `top`". Mirrors the same distinction real
  // JunOS/PAN-OS make between the `>` and `#` prompt families.
  mode: "operational" | "configuration";
  editPath: string[];
  pendingChanges: boolean;
  interfaces: EditPathCliInterface[];
  zones: EditPathCliZone[];
  routes: EditPathCliRoute[];
  securityRules: EditPathCliSecurityRule[];
};

export type JuniperCliState = EditPathCliState;
export type PaloAltoCliState = EditPathCliState;

// ===== Linux flat state =====

export type LinuxCliInterface = { name: string; ip: string; up: boolean };
export type LinuxCliRoute = { dst: string; via: string; dev: string };
export type LinuxCliIptablesRule = { chain: "INPUT" | "OUTPUT" | "FORWARD"; rule: string };
export type LinuxCliListeningPort = { proto: "tcp" | "udp"; port: number; process: string };

export type LinuxCliState = {
  hostname: string;
  isRoot: boolean;
  interfaces: LinuxCliInterface[];
  routes: LinuxCliRoute[];
  iptablesRules: LinuxCliIptablesRule[];
  listeningPorts: LinuxCliListeningPort[];
};

// ===== Terminal session (shared across vendors) =====

export type CliHistoryEntry = { prompt: string; command: string; output: string[] };

export type CliSessionState = {
  activeVendor: CliVendorId;
  history: CliHistoryEntry[];
  commandHistory: string[];
};

// ===== Root CLI state =====

export type NetSimCliState = {
  session: CliSessionState;
  cisco: CiscoCliState;
  fortigate: FortiCliState;
  juniper: JuniperCliState;
  paloalto: PaloAltoCliState;
  linux: LinuxCliState;
};
