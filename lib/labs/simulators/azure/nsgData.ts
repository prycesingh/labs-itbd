/**
 * Static reference data for the NSG simulator — mirrors real Azure NSG
 * defaults (well-known services, service tags, protocols, default rules).
 * Authored fixture data; no per-user variation, no DB-editability needed.
 */

export type NsgService = { name: string; port: string; protocol: string };

export const NSG_SERVICES: NsgService[] = [
  { name: "Custom", port: "", protocol: "Any" },
  { name: "DNS", port: "53", protocol: "Any" },
  { name: "FTP", port: "21", protocol: "TCP" },
  { name: "HTTP", port: "80", protocol: "TCP" },
  { name: "HTTPS", port: "443", protocol: "TCP" },
  { name: "IMAP", port: "143", protocol: "TCP" },
  { name: "IMAPS", port: "993", protocol: "TCP" },
  { name: "LDAP", port: "389", protocol: "TCP" },
  { name: "LDAPS", port: "636", protocol: "TCP" },
  { name: "MS-SQL", port: "1433", protocol: "TCP" },
  { name: "NTP", port: "123", protocol: "UDP" },
  { name: "POP3", port: "110", protocol: "TCP" },
  { name: "POP3S", port: "995", protocol: "TCP" },
  { name: "RDP", port: "3389", protocol: "TCP" },
  { name: "SMB", port: "445", protocol: "TCP" },
  { name: "SMTP", port: "25", protocol: "TCP" },
  { name: "SMTPS", port: "587", protocol: "TCP" },
  { name: "SNMP", port: "161", protocol: "UDP" },
  { name: "SSH", port: "22", protocol: "TCP" },
  { name: "Telnet", port: "23", protocol: "TCP" },
  { name: "WINRM", port: "5985", protocol: "TCP" },
  { name: "WinRMS", port: "5986", protocol: "TCP" },
];

export const NSG_SERVICE_TAGS = [
  "VirtualNetwork",
  "AzureLoadBalancer",
  "Internet",
  "Storage",
  "Sql",
  "AzureCloud",
  "AzureCosmosDB",
  "AzureContainerRegistry",
  "AzureKeyVault",
  "AzureMonitor",
  "AzureActiveDirectory",
  "AzureBackup",
  "AppService",
  "ApiManagement",
  "EventHub",
  "ServiceBus",
  "AzureTrafficManager",
];

export const NSG_PROTOCOLS = ["Any", "TCP", "UDP", "ICMP", "ESP", "AH"];

export const NSG_SOURCE_OPTIONS = ["Any", "IP Addresses", "Service Tag", "Application security group", "My IP address"];
export const NSG_DEST_OPTIONS = ["Any", "IP Addresses", "Service Tag", "Application security group", "VirtualNetwork"];

export type NsgDefaultRule = {
  priority: number;
  name: string;
  port: string;
  protocol: string;
  source: string;
  dest: string;
  action: "Allow" | "Deny";
  direction: "Inbound" | "Outbound";
};

export const NSG_DEFAULT_RULES: NsgDefaultRule[] = [
  { priority: 65000, name: "AllowVnetInBound", source: "VirtualNetwork", dest: "VirtualNetwork", port: "Any", protocol: "Any", action: "Allow", direction: "Inbound" },
  { priority: 65001, name: "AllowAzureLoadBalancerInBound", source: "AzureLoadBalancer", dest: "Any", port: "Any", protocol: "Any", action: "Allow", direction: "Inbound" },
  { priority: 65500, name: "DenyAllInBound", source: "Any", dest: "Any", port: "Any", protocol: "Any", action: "Deny", direction: "Inbound" },
  { priority: 65000, name: "AllowVnetOutBound", source: "VirtualNetwork", dest: "VirtualNetwork", port: "Any", protocol: "Any", action: "Allow", direction: "Outbound" },
  { priority: 65001, name: "AllowInternetOutBound", source: "Any", dest: "Internet", port: "Any", protocol: "Any", action: "Allow", direction: "Outbound" },
  { priority: 65500, name: "DenyAllOutBound", source: "Any", dest: "Any", port: "Any", protocol: "Any", action: "Deny", direction: "Outbound" },
];

export function validateCidrList(str: string): boolean {
  if (!str) return false;
  if (str.trim() === "*") return true;
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  const cidrRe = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/;
  for (const part of parts) {
    const m = part.match(cidrRe);
    if (!m) return false;
    for (let j = 1; j <= 4; j++) {
      const oct = parseInt(m[j], 10);
      if (isNaN(oct) || oct < 0 || oct > 255) return false;
    }
    if (m[6] !== undefined) {
      const mask = parseInt(m[6], 10);
      if (isNaN(mask) || mask < 0 || mask > 32) return false;
    }
  }
  return true;
}

export function validatePortRanges(str: string): boolean {
  if (!str) return false;
  if (str.trim() === "*") return true;
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 0 || n > 65535) return false;
    } else if (/^\d+-\d+$/.test(part)) {
      const range = part.split("-").map((n) => parseInt(n, 10));
      if (range[0] < 0 || range[1] > 65535 || range[0] > range[1]) return false;
    } else {
      return false;
    }
  }
  return true;
}
