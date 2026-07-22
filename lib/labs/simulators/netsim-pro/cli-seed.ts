import type {
  CiscoCliState,
  FortiCliState,
  EditPathCliState,
  LinuxCliState,
  NetSimCliState,
} from "./cli-types";

// ===================================================================
// CloudLab Inc. roster convention — same fictional continuity used across the
// other NetSim/lab ports in this app (network-cisco/network-fortigate/
// network-paloalto seedData.ts: company "CloudLab Inc.", domain "cloudlab.in",
// Mumbai HQ / Bengaluru / Hyderabad / Singapore-DR / Pune site naming). The CLI
// tab is a fully independent sandbox (separate state, separate object model),
// so only the NAMING flavor is reused here, not any actual shared data.
//
// No Math.random() / Date.now() / new Date() anywhere in this file — every
// value below is a static, deterministic literal.
// ===================================================================

function freshCiscoCliState(): CiscoCliState {
  return {
    hostname: "Router-Core-01",
    modeStack: [{ kind: "user" }],
    interfaces: [
      {
        name: "GigabitEthernet0/0",
        ip: "10.10.0.1",
        mask: "255.255.255.0",
        adminUp: true,
        lineUp: true,
        description: "Uplink to SW-CORE-MUM-01",
        vlan: null,
      },
      {
        name: "GigabitEthernet0/1",
        ip: "10.10.10.1",
        mask: "255.255.255.0",
        adminUp: true,
        lineUp: true,
        description: "Mumbai HQ LAN",
        vlan: 10,
      },
      {
        name: "GigabitEthernet0/2",
        ip: "10.10.20.1",
        mask: "255.255.255.0",
        adminUp: true,
        lineUp: true,
        description: "Engineering VLAN",
        vlan: 20,
      },
      {
        name: "Serial0/0/0",
        ip: "172.16.1.1",
        mask: "255.255.255.252",
        adminUp: true,
        lineUp: true,
        description: "WAN to ISP",
        vlan: null,
      },
      {
        name: "Loopback0",
        ip: "1.1.1.1",
        mask: "255.255.255.255",
        adminUp: true,
        lineUp: true,
        description: "Management loopback",
        vlan: null,
      },
    ],
    vlans: [
      { id: 1, name: "default" },
      { id: 10, name: "SALES" },
      { id: 20, name: "ENGINEERING" },
      { id: 99, name: "MANAGEMENT" },
    ],
    routes: [
      { dst: "0.0.0.0", mask: "0.0.0.0", nextHop: "172.16.1.2" },
      { dst: "10.20.0.0", mask: "255.255.255.0", nextHop: "10.10.0.2" },
      { dst: "10.30.0.0", mask: "255.255.255.0", nextHop: "10.10.0.2" },
    ],
    acls: [
      { aclId: "100", seq: 10, action: "deny", text: "tcp any host 172.16.1.1 eq 23" },
      { aclId: "100", seq: 20, action: "permit", text: "ip any any" },
    ],
  };
}

function freshFortiCliState(): FortiCliState {
  return {
    hostname: "FGT-EDGE-BLR-01",
    cursor: { configPath: [], editTarget: null },
    pendingEdit: null,
    interfaces: [
      { name: "port1", ip: "10.20.0.1", mask: "255.255.255.0", status: "up", alias: "internal" },
      { name: "port2", ip: "10.20.10.1", mask: "255.255.255.0", status: "up", alias: "dmz" },
      { name: "wan1", ip: "203.0.113.10", mask: "255.255.255.0", status: "up", alias: "isp-primary" },
      { name: "wan2", ip: "203.0.113.26", mask: "255.255.255.0", status: "down", alias: "isp-backup" },
    ],
    policies: [
      {
        id: 1,
        srcintf: "port1",
        dstintf: "wan1",
        srcaddr: "internal-subnet",
        dstaddr: "all",
        service: "ALL",
        action: "accept",
        status: "enable",
      },
      {
        id: 2,
        srcintf: "port2",
        dstintf: "wan1",
        srcaddr: "dmz-subnet",
        dstaddr: "all",
        service: "HTTPS",
        action: "accept",
        status: "enable",
      },
      {
        id: 3,
        srcintf: "any",
        dstintf: "any",
        srcaddr: "all",
        dstaddr: "all",
        service: "ALL",
        action: "deny",
        status: "enable",
      },
    ],
    routes: [
      { dst: "0.0.0.0/0", gateway: "203.0.113.1", device: "wan1" },
      { dst: "10.20.0.0/24", gateway: "0.0.0.0", device: "port1" },
      { dst: "10.20.10.0/24", gateway: "0.0.0.0", device: "port2" },
    ],
    addresses: [
      { name: "internal-subnet", subnet: "10.20.0.0/24" },
      { name: "dmz-subnet", subnet: "10.20.10.0/24" },
    ],
  };
}

function freshJuniperCliState(): EditPathCliState {
  return {
    hostname: "router-hyd-01",
    mode: "operational",
    editPath: [],
    pendingChanges: false,
    interfaces: [
      { name: "ge-0/0/0", unit: 0, ip: "10.30.0.1/24", adminUp: true, zone: "trust" },
      { name: "ge-0/0/1", unit: 0, ip: "10.30.10.1/24", adminUp: true, zone: "dmz" },
      { name: "ge-0/0/2", unit: 0, ip: "203.0.113.34/30", adminUp: true, zone: "untrust" },
      { name: "lo0", unit: 0, ip: "2.2.2.2/32", adminUp: true, zone: "trust" },
    ],
    zones: [
      { name: "trust", interfaces: ["ge-0/0/0", "lo0"] },
      { name: "dmz", interfaces: ["ge-0/0/1"] },
      { name: "untrust", interfaces: ["ge-0/0/2"] },
    ],
    routes: [
      { dst: "0.0.0.0/0", nextHop: "203.0.113.33" },
      { dst: "10.30.20.0/24", nextHop: "10.30.0.2" },
    ],
    securityRules: [
      {
        name: "trust-to-untrust",
        fromZone: "trust",
        toZone: "untrust",
        source: "any",
        destination: "any",
        application: "any",
        action: "permit",
      },
      {
        name: "dmz-to-untrust-web",
        fromZone: "dmz",
        toZone: "untrust",
        source: "any",
        destination: "any",
        application: "junos-https",
        action: "permit",
      },
    ],
  };
}

function freshPaloAltoCliState(): EditPathCliState {
  return {
    hostname: "PA-FW-SIN-01",
    mode: "operational",
    editPath: [],
    pendingChanges: false,
    interfaces: [
      { name: "ethernet1/1", unit: 0, ip: "10.40.0.1/24", adminUp: true, zone: "trust" },
      { name: "ethernet1/2", unit: 0, ip: "10.40.10.1/24", adminUp: true, zone: "dmz" },
      { name: "ethernet1/3", unit: 0, ip: "203.0.113.50/30", adminUp: true, zone: "untrust" },
    ],
    zones: [
      { name: "trust", interfaces: ["ethernet1/1"] },
      { name: "dmz", interfaces: ["ethernet1/2"] },
      { name: "untrust", interfaces: ["ethernet1/3"] },
    ],
    routes: [
      { dst: "0.0.0.0/0", nextHop: "203.0.113.49" },
      { dst: "10.40.20.0/24", nextHop: "10.40.0.2" },
    ],
    securityRules: [
      {
        name: "trust-to-untrust",
        fromZone: "trust",
        toZone: "untrust",
        source: "any",
        destination: "any",
        application: "any",
        action: "permit",
      },
      {
        name: "intrazone-default",
        fromZone: "trust",
        toZone: "trust",
        source: "any",
        destination: "any",
        application: "any",
        action: "permit",
      },
    ],
  };
}

function freshLinuxCliState(): LinuxCliState {
  return {
    hostname: "srv-pune-01",
    isRoot: false,
    interfaces: [
      { name: "lo", ip: "127.0.0.1/8", up: true },
      { name: "eth0", ip: "10.50.0.100/24", up: true },
      { name: "eth1", ip: "10.50.10.100/24", up: true },
    ],
    routes: [
      { dst: "default", via: "10.50.0.1", dev: "eth0" },
      { dst: "10.50.10.0/24", via: "0.0.0.0", dev: "eth1" },
    ],
    iptablesRules: [
      { chain: "INPUT", rule: "ACCEPT tcp -- 0.0.0.0/0 0.0.0.0/0 tcp dpt:22" },
      { chain: "INPUT", rule: "ACCEPT tcp -- 0.0.0.0/0 0.0.0.0/0 tcp dpt:443" },
      { chain: "INPUT", rule: "DROP all -- 0.0.0.0/0 0.0.0.0/0" },
    ],
    listeningPorts: [
      { proto: "tcp", port: 22, process: "sshd" },
      { proto: "tcp", port: 443, process: "nginx" },
      { proto: "tcp", port: 3306, process: "mysqld" },
    ],
  };
}

export function freshNetSimCliState(): NetSimCliState {
  return {
    session: { activeVendor: "cisco", history: [], commandHistory: [] },
    cisco: freshCiscoCliState(),
    fortigate: freshFortiCliState(),
    juniper: freshJuniperCliState(),
    paloalto: freshPaloAltoCliState(),
    linux: freshLinuxCliState(),
  };
}
