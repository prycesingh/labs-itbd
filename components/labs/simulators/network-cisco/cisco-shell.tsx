"use client";

// Portal shell for the Cisco IOS WebUI simulator: Cisco-blue topbar
// (device logo, hostname/model/IOS version, top-level Configure / Monitor /
// Troubleshoot / Maintenance tabs, uptime, admin avatar) + a sub-bar
// (breadcrumb + Save Configuration) + a collapsible left tree sidebar scoped
// to the active top tab + content area. Ported from
// itbd-lab/simulators/network/js/cisco-ui.js renderTopbar()/renderSubbar()/
// renderShell()/renderRail()/navigate() (NAV object + TABS_ORDER, lines
// 11-144, 230-339).
//
// Source's nav is genuinely two-level: 4 top tabs (Configure/Monitor/
// Troubleshoot/Maintenance), each with its own set of collapsible tree
// groups containing ~70 total leaf pages. Many of those leaves are thin
// static sub-sections (e.g. Configure > Additional Tasks' 8 leaves, or
// Monitor > Overview's 2 leaves) that read far better as TABS within one
// consolidated page component than as separate routed pages — the same
// consolidation judgment used for Meraki's 72->37 page reduction. This port
// keeps source's 4-tab / grouped-tree shape (so the simulator still *feels*
// like the real CCP Express / IOS XE Web UI) while routing to the
// `CiscoPage` union below, which is intentionally smaller than source's raw
// leaf count.
//
// Built as a NORMAL React container: `children` is swapped by the parent via
// state-driven conditional rendering (the parent owns a `page` state
// variable and renders the matching page component as `children`), and this
// shell only ever reads props / local `useState` for which tab is active and
// which tree groups are expanded. It never touches the DOM manually —
// source's innerHTML-based renderRail()/renderTopbar() has no equivalent
// here; the content area is just `{children}`.
//
// Prop shape: page-building / wiring agents render
// <CiscoShell state={state} page={page} onNavigate={setPage} dispatch={dispatch}>{pageBody}</CiscoShell>

import { useState, type ReactNode } from "react";

import type { CiscoState } from "@/lib/labs/simulators/network-cisco/types";
import type { CiscoAction } from "@/lib/labs/simulators/network-cisco/reducer";
import styles from "./cisco-console.module.css";

// ===== Page union =====
// This is the CONFIRMED, definitive page list — every page-building agent
// must render one of these. Consolidated from source's ~70-leaf NAV
// structure (see file header). Extend this union here first if a new page is
// ever needed — never invent an ad-hoc page id at a call site.
export type CiscoPage =
  // Overview / Device
  | "overview"
  | "device-info"
  | "environment"
  // Interfaces
  | "interfaces"
  | "etherchannel"
  // Switching
  | "vlans"
  | "vtp"
  | "spanning-tree"
  // Routing
  | "static-routes"
  | "rip"
  | "eigrp"
  | "ospf"
  | "bgp"
  // Security
  | "acls"
  | "nat"
  | "aaa"
  | "local-users"
  | "certificates"
  | "ips"
  // VPN
  | "ipsec-tunnels"
  | "ssl-vpn"
  // Services
  | "dhcp"
  | "snmp"
  | "ntp"
  | "qos"
  // Management
  | "https-ssh"
  | "syslog"
  | "files"
  // Diagnostics
  | "ping-traceroute"
  | "diag-history"
  // Voice & Wireless
  | "voice"
  | "wireless"
  // Monitoring
  | "top-talkers"
  | "firewall-stats"
  | "aaa-events"
  | "routing-events";

// ===== Top-level tabs (source's TABS_ORDER) =====
export type CiscoTab = "configure" | "monitor" | "troubleshoot" | "maintenance";

const TAB_LABELS: Record<CiscoTab, string> = {
  configure: "Configure",
  monitor: "Monitor",
  troubleshoot: "Troubleshoot",
  maintenance: "Maintenance",
};
const TABS_ORDER: CiscoTab[] = ["configure", "monitor", "troubleshoot", "maintenance"];

type NavLeaf = { page: CiscoPage; label: string };
type NavGroupDef = { key: string; label: string; items: NavLeaf[] };

// Nav groups per top tab, matching source's NAV object shape (cisco-ui.js
// lines 11-136) with leaves consolidated onto the `CiscoPage` union above
// (e.g. source's 8 separate "Additional Tasks" leaves collapse onto
// device-info/environment/https-ssh/ntp/snmp/local-users/files — those
// become tabs WITHIN those page components rather than separate routes).
const NAV: Record<CiscoTab, NavGroupDef[]> = {
  configure: [
    {
      key: "g-iface",
      label: "Interface Management",
      items: [
        { page: "interfaces", label: "Interfaces and Connections" },
        { page: "etherchannel", label: "Trunks, EtherChannel & Bridges" },
        { page: "vlans", label: "VLAN" },
      ],
    },
    {
      key: "g-router",
      label: "Router",
      items: [
        { page: "static-routes", label: "Static Routing" },
        { page: "rip", label: "RIP" },
        { page: "eigrp", label: "EIGRP" },
        { page: "ospf", label: "OSPF" },
        { page: "bgp", label: "BGP" },
        { page: "dhcp", label: "DHCP Pools" },
        { page: "nat", label: "NAT" },
      ],
    },
    {
      key: "g-sec",
      label: "Security",
      items: [
        { page: "acls", label: "Access Control Lists" },
        { page: "ipsec-tunnels", label: "VPN - IPsec" },
        { page: "ssl-vpn", label: "VPN - SSL" },
        { page: "ips", label: "Intrusion Prevention" },
        { page: "aaa", label: "AAA" },
        { page: "certificates", label: "Public Key Infrastructure" },
      ],
    },
    {
      key: "g-qos",
      label: "Quality of Service",
      items: [{ page: "qos", label: "QoS Wizard & Policy" }],
    },
    {
      key: "g-uc",
      label: "Unified Communications",
      items: [{ page: "voice", label: "Voice & Telephony" }],
    },
    {
      key: "g-sw",
      label: "Switching",
      items: [
        { page: "vtp", label: "VTP" },
        { page: "spanning-tree", label: "Spanning Tree" },
      ],
    },
    {
      key: "g-wl",
      label: "Wireless",
      items: [{ page: "wireless", label: "Radio, AP & SSID Configuration" }],
    },
    {
      key: "g-addl",
      label: "Additional Tasks",
      items: [
        { page: "device-info", label: "Router Properties & Access" },
        { page: "https-ssh", label: "HTTPS / SSH / Telnet" },
        { page: "ntp", label: "NTP / SNMP" },
        { page: "local-users", label: "Router User Accounts" },
        { page: "files", label: "File System Management" },
      ],
    },
  ],
  monitor: [
    {
      key: "mg-over",
      label: "Overview",
      items: [{ page: "overview", label: "System Summary" }],
    },
    {
      key: "mg-ifc",
      label: "Interface",
      items: [{ page: "interfaces", label: "Interface Status & Traffic" }],
    },
    {
      key: "mg-sec",
      label: "Security",
      items: [
        { page: "firewall-stats", label: "Firewall Status" },
        { page: "ipsec-tunnels", label: "VPN Status" },
        { page: "ips", label: "IPS Status" },
      ],
    },
    {
      key: "mg-traf",
      label: "Traffic",
      items: [
        { page: "top-talkers", label: "Traffic Status / Top Talkers" },
        { page: "nat", label: "NAT Status" },
        { page: "qos", label: "QoS Status" },
      ],
    },
    {
      key: "mg-log",
      label: "Logging",
      items: [
        { page: "syslog", label: "Syslog Buffer" },
        { page: "aaa-events", label: "AAA Logs" },
        { page: "routing-events", label: "Routing Events" },
      ],
    },
  ],
  troubleshoot: [
    {
      key: "tg-conn",
      label: "Connectivity",
      items: [{ page: "ping-traceroute", label: "Ping & Traceroute" }],
    },
    {
      key: "tg-rt",
      label: "Routing",
      items: [
        { page: "eigrp", label: "EIGRP Diagnostics" },
        { page: "ospf", label: "OSPF Diagnostics" },
        { page: "bgp", label: "BGP Diagnostics" },
      ],
    },
    {
      key: "tg-sec",
      label: "Security",
      items: [
        { page: "acls", label: "ACL Hits Analyzer" },
        { page: "aaa-events", label: "AAA Diagnostics" },
      ],
    },
    {
      key: "tg-sys",
      label: "System",
      items: [{ page: "diag-history", label: "Diagnostic History" }],
    },
  ],
  maintenance: [
    {
      key: "xg-files",
      label: "File Management",
      items: [{ page: "files", label: "Flash Files & Copy Running-Config" }],
    },
  ],
};

// Given a page, find which top tab "owns" it (a page may appear under
// multiple tabs in source, e.g. Interfaces under both Configure and Monitor —
// this returns the first/primary tab for default-tab selection when
// navigating directly to a page).
function tabForPage(page: CiscoPage): CiscoTab {
  for (const tab of TABS_ORDER) {
    for (const group of NAV[tab]) {
      if (group.items.some((it) => it.page === page)) return tab;
    }
  }
  return "monitor";
}

function TreeLeaf({ item, page, onNavigate }: { item: NavLeaf; page: CiscoPage; onNavigate: (p: CiscoPage) => void }) {
  const active = page === item.page;
  return (
    <button type="button" className={`${styles.treeLeaf} ${active ? styles.treeLeafActive : ""}`} onClick={() => onNavigate(item.page)}>
      {item.label}
    </button>
  );
}

function TreeNode({
  group,
  page,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: NavGroupDef;
  page: CiscoPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: CiscoPage) => void;
}) {
  return (
    <div className={styles.treeNode}>
      <button type="button" className={styles.treeHead} onClick={onToggle} aria-expanded={expanded}>
        <span className={`${styles.caret} ${expanded ? styles.caretExpanded : ""}`}>&#9656;</span>
        <span>{group.label}</span>
      </button>
      <div className={`${styles.treeChildren} ${expanded ? styles.treeChildrenExpanded : ""}`}>
        {group.items.map((item) => (
          <TreeLeaf key={item.page} item={item} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function CiscoShell({
  state,
  page,
  onNavigate,
  dispatch,
  children,
}: {
  state: CiscoState;
  page: CiscoPage;
  onNavigate: (p: CiscoPage) => void;
  dispatch: React.Dispatch<CiscoAction>;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<CiscoTab>(() => tabForPage(page));

  // Local expand/collapse state for the collapsible tree groups, keyed by
  // group key — default expanded if the group contains the current page,
  // matching source's per-group `expanded[groupId]` map defaulted to "first
  // group of each tab expanded" (cisco-ui.js:221-223), extended here so ANY
  // group containing the current page starts expanded (better UX when
  // navigating directly to a deep page).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // `dispatch` is accepted so page-building agents have a single consistent
  // shell prop shape; the shell itself has no state-mutating controls beyond
  // navigation and "Save Configuration" (a no-op toast in source — left to
  // the page-wiring agent to hook up to a real action if one exists).
  void dispatch;

  const d = state.device;
  const groups = NAV[activeTab];
  const isGroupExpanded = (group: NavGroupDef) => {
    if (group.key in collapsed) return !collapsed[group.key];
    return group.items.some((it) => it.page === page) || group === groups[0];
  };

  const handleTabClick = (tab: CiscoTab) => {
    setActiveTab(tab);
    const firstPage = NAV[tab][0]?.items[0]?.page;
    if (firstPage) onNavigate(firstPage);
  };

  const handleNavigate = (p: CiscoPage) => {
    onNavigate(p);
  };

  const activeGroupLabel = groups.find((g) => g.items.some((it) => it.page === page))?.label ?? "";
  const activeLeafLabel = groups.flatMap((g) => g.items).find((it) => it.page === page)?.label ?? "";

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <svg viewBox="0 0 60 30" width={26} height={18} aria-hidden="true">
              <g fill="#fff">
                <rect x="2" y="10" width="3" height="10" rx="1" />
                <rect x="8" y="6" width="3" height="18" rx="1" />
                <rect x="14" y="2" width="3" height="26" rx="1" />
                <rect x="20" y="6" width="3" height="18" rx="1" />
                <rect x="26" y="10" width="3" height="10" rx="1" />
                <rect x="34" y="10" width="3" height="10" rx="1" />
                <rect x="40" y="6" width="3" height="18" rx="1" />
                <rect x="46" y="2" width="3" height="26" rx="1" />
                <rect x="52" y="6" width="3" height="18" rx="1" />
              </g>
            </svg>
          </div>
          <div className={styles.brandText}>
            <span className="hn">{d.hostname}</span>
            <span className="mo">
              {d.model} &middot; IOS XE {d.iosVersion}
            </span>
          </div>
        </div>

        <div className={styles.tabs}>
          {TABS_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => handleTabClick(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className={styles.topbarRight}>
          <div className={styles.uptime}>
            Uptime
            <b>{d.uptime.split(",").slice(0, 2).join(",")}</b>
          </div>
          <button type="button" className={styles.iconbtn} title="Notifications">
            &#9873;
          </button>
          <button type="button" className={styles.iconbtn} title="Help">
            ?
          </button>
          <div className={styles.admin}>
            <span className={styles.avatar}>{(d.adminUser || "A").charAt(0).toUpperCase()}</span>
            <span>
              {d.adminUser} (priv {d.privilegeLevel})
            </span>
          </div>
        </div>
      </header>

      <div className={styles.subbar}>
        <span>Cisco IOS Web UI</span>
        <span className={styles.subbarSep}>&rsaquo;</span>
        <b>{activeGroupLabel || TAB_LABELS[activeTab]}</b>
        <span className={styles.subbarSep}>&rsaquo;</span>
        <b>{activeLeafLabel}</b>
        <button type="button" className={styles.savecfg}>
          Save Configuration
        </button>
      </div>

      <div className={styles.shell}>
        <aside className={styles.rail}>
          <div className={styles.railTitle}>{TAB_LABELS[activeTab]}</div>
          {groups.map((group) => (
            <TreeNode
              key={group.key}
              group={group}
              page={page}
              expanded={isGroupExpanded(group)}
              onToggle={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isGroupExpanded(group) }))}
              onNavigate={handleNavigate}
            />
          ))}
        </aside>

        <section className={styles.main}>{children}</section>
      </div>
    </div>
  );
}
