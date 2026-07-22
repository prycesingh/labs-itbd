"use client";

// Portal shell for the FortiGate WebUI simulator: FortiGate-red/dark topbar
// (brand chip, hostname/model, admin avatar, logout) + a collapsible-group
// left sidebar (Dashboard / Network / Policy & Objects / Security Profiles /
// VPN / User & Authentication / System / Log & Report) + content area.
// Ported from itbd-lab/simulators/network/js/fortigate-ui.js
// renderTopbar()/renderShell()/renderRail()/navigate() (NAV array, lines
// 12-125; renderTopbar 182-214; renderShell 216-224; renderRail 226-247;
// navigate 260-275).
//
// Source's nav is genuinely single-level for content purposes: 9 top tabs
// (System/Network/Policy & Objects/Security Profiles/VPN/User &
// Authentication/WiFi & Switch Controller/Log & Report/Monitor) each with a
// flat list of rail items — unlike Cisco's two-level tab+tree structure,
// FortiOS's top tabs *are* the sidebar groups (clicking a top tab swaps the
// whole left rail to that tab's flat item list). This port collapses that
// two-step interaction (top tab -> rail item) into ONE always-visible,
// independently-collapsible grouped sidebar (matching the Meraki/Purview/
// Sentinel-suite convention for single-level grouped nav), which reads
// better in a scrollable web app than source's tab-swap-then-click. Source's
// ~40 raw leaf pages (System's 16 + Network's 12 + Policy's 16 + Security's
// 11 + VPN's 7 + User's 10 + WiFi's 5 + Log's 10 + Monitor's 7, with heavy
// overlap/thin-stub pages like Packet Capture, RIP/OSPF/BGP routing daemons,
// SD-WAN, Security Fabric, Certificates, FortiTokens, WiFi/Switch Controller)
// are consolidated onto the `FortiPage` union below — the same
// consolidation judgment used for Cisco's ~70->29 and Meraki's 72->37
// reductions. WiFi & Switch Controller and most Monitor-only stub pages
// (routing/DHCP/login-user monitors) are dropped as out-of-scope for a
// firewall-focused simulator; their real substance (interfaces, policies,
// VPN, logs) already has a dedicated page.
//
// Built as a NORMAL React container: `children` is swapped by the parent via
// state-driven conditional rendering (the parent owns a `page` state
// variable and renders the matching page component as `children`), and this
// shell only ever reads props / local `useState` for which sidebar groups
// are expanded. It never touches the DOM manually — source's
// innerHTML-based renderRail()/renderTopbar() has no equivalent here; the
// content area is just `{children}`.
//
// Prop shape: page-building / wiring agents render
// <FortiShell state={state} page={page} onNavigate={setPage} dispatch={dispatch}>{pageBody}</FortiShell>

import { useState, type ReactNode } from "react";

import type { FortiGateState } from "@/lib/labs/simulators/network-fortigate/types";
import type { FortiAction } from "@/lib/labs/simulators/network-fortigate/reducer";
import styles from "./fortigate-console.module.css";

// ===== Page union =====
// This is the CONFIRMED, definitive page list — every page-building agent
// must render one of these. Consolidated from source's ~40-leaf NAV
// structure (see file header). Extend this union here first if a new page
// is ever needed — never invent an ad-hoc page id at a call site.
export type FortiPage =
  // Dashboard
  | "overview"
  // Network
  | "interfaces"
  | "zones"
  | "static-routes"
  | "policy-routes"
  | "dhcp"
  // Policy & Objects
  | "firewall-policies"
  | "addresses"
  | "services"
  | "schedules"
  | "vips"
  | "ip-pools"
  // Security Profiles
  | "av-profiles"
  | "web-filter-profiles"
  | "ips-profiles"
  | "app-control-profiles"
  | "ssl-profiles"
  | "dns-filter-profiles"
  | "other-profiles"
  // VPN
  | "ipsec-tunnels"
  | "ssl-vpn"
  // User & Authentication
  | "local-users"
  | "user-groups"
  | "ldap-radius"
  // System
  | "administrators"
  | "admin-profiles"
  | "ha-status"
  // Log & Report
  | "forward-logs"
  | "event-logs";

type NavLeaf = { page: FortiPage; label: string };
type NavGroupDef = { key: string; label: string; items: NavLeaf[] };

// Sidebar groups, consolidated from source's NAV array (fortigate-ui.js
// lines 12-125) onto the `FortiPage` union above. Group order/labels mirror
// FortiOS 7.4's real top-tab order (System, Network, Policy & Objects,
// Security Profiles, VPN, User & Authentication, Log & Report) with
// "Dashboard" pulled to the front as its own group (source's
// system > dashboard is the default landing page) and "System" narrowed to
// its identity/admin/HA leaves (source's DNS/FortiGuard/Certificates/
// Security Fabric/Replacement Messages/Feature Visibility/Advanced are
// thin settings stubs out of scope for this simulator).
const NAV: NavGroupDef[] = [
  {
    key: "g-dashboard",
    label: "Dashboard",
    items: [{ page: "overview", label: "Overview" }],
  },
  {
    key: "g-network",
    label: "Network",
    items: [
      { page: "interfaces", label: "Interfaces" },
      { page: "zones", label: "Zones" },
      { page: "static-routes", label: "Static Routes" },
      { page: "policy-routes", label: "Policy Routes" },
      { page: "dhcp", label: "DHCP Servers" },
    ],
  },
  {
    key: "g-policy",
    label: "Policy & Objects",
    items: [
      { page: "firewall-policies", label: "Firewall Policy" },
      { page: "addresses", label: "Addresses" },
      { page: "services", label: "Services" },
      { page: "schedules", label: "Schedules" },
      { page: "vips", label: "Virtual IPs" },
      { page: "ip-pools", label: "IP Pools" },
    ],
  },
  {
    key: "g-security",
    label: "Security Profiles",
    items: [
      { page: "av-profiles", label: "AntiVirus" },
      { page: "web-filter-profiles", label: "Web Filter" },
      { page: "ips-profiles", label: "Intrusion Prevention" },
      { page: "app-control-profiles", label: "Application Control" },
      { page: "ssl-profiles", label: "SSL/SSH Inspection" },
      { page: "dns-filter-profiles", label: "DNS Filter" },
      { page: "other-profiles", label: "File Filter, DLP & WAF" },
    ],
  },
  {
    key: "g-vpn",
    label: "VPN",
    items: [
      { page: "ipsec-tunnels", label: "IPsec Tunnels" },
      { page: "ssl-vpn", label: "SSL-VPN" },
    ],
  },
  {
    key: "g-user",
    label: "User & Authentication",
    items: [
      { page: "local-users", label: "User Definition" },
      { page: "user-groups", label: "User Groups" },
      { page: "ldap-radius", label: "LDAP & RADIUS Servers" },
    ],
  },
  {
    key: "g-system",
    label: "System",
    items: [
      { page: "administrators", label: "Administrators" },
      { page: "admin-profiles", label: "Admin Profiles" },
      { page: "ha-status", label: "HA Status" },
    ],
  },
  {
    key: "g-log",
    label: "Log & Report",
    items: [
      { page: "forward-logs", label: "Forward Traffic" },
      { page: "event-logs", label: "Events" },
    ],
  },
];

function RailLeaf({ item, page, onNavigate }: { item: NavLeaf; page: FortiPage; onNavigate: (p: FortiPage) => void }) {
  const active = page === item.page;
  return (
    <button type="button" className={`${styles.railItem} ${active ? styles.railItemActive : ""}`} onClick={() => onNavigate(item.page)}>
      <span className={styles.railIcon}>&#9656;</span>
      <span>{item.label}</span>
    </button>
  );
}

function RailGroup({
  group,
  page,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: NavGroupDef;
  page: FortiPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: FortiPage) => void;
}) {
  return (
    <div className={styles.railGroup}>
      <button type="button" className={styles.railGroupHead} onClick={onToggle} aria-expanded={expanded}>
        <span className={`${styles.railCaret} ${expanded ? styles.railCaretExpanded : ""}`}>&#9656;</span>
        <span>{group.label}</span>
      </button>
      <div className={`${styles.railGroupItems} ${expanded ? styles.railGroupItemsExpanded : ""}`}>
        {group.items.map((item) => (
          <RailLeaf key={item.page} item={item} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function findGroupLabel(page: FortiPage): string {
  return NAV.find((g) => g.items.some((it) => it.page === page))?.label ?? "";
}
function findLeafLabel(page: FortiPage): string {
  return NAV.flatMap((g) => g.items).find((it) => it.page === page)?.label ?? "";
}

export function FortiShell({
  state,
  page,
  onNavigate,
  dispatch,
  children,
}: {
  state: FortiGateState;
  page: FortiPage;
  onNavigate: (p: FortiPage) => void;
  dispatch: React.Dispatch<FortiAction>;
  children: ReactNode;
}) {
  // Local expand/collapse state for the collapsible rail groups, keyed by
  // group key — default expanded if the group contains the current page,
  // matching source's "tab swap shows only that tab's items" behavior
  // adapted to an always-visible grouped sidebar (see file header): every
  // group containing the current page starts expanded, plus the Dashboard
  // group, so there's always sensible context visible on first load.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // `dispatch` is accepted so page-building agents have a single consistent
  // shell prop shape; the shell itself has no state-mutating controls beyond
  // navigation. Source's logout/reset buttons are presentational-only here
  // (no destructive action wired without an explicit reducer action to call).
  void dispatch;

  const sys = state.system;
  const isGroupExpanded = (group: NavGroupDef) => {
    if (group.key in collapsed) return !collapsed[group.key];
    return group.items.some((it) => it.page === page) || group.key === "g-dashboard";
  };

  const groupLabel = findGroupLabel(page);
  const leafLabel = findLeafLabel(page);

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>FG</div>
          <div className={styles.brandText}>
            {sys.hostname}
            <small>{sys.model}</small>
          </div>
        </div>

        <div className={styles.tabs}>
          {NAV.map((group) => (
            <button
              key={group.key}
              type="button"
              className={`${styles.tab} ${groupLabel === group.label ? styles.tabActive : ""}`}
              onClick={() => {
                const first = group.items[0];
                if (first) onNavigate(first.page);
              }}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className={styles.topbarRight}>
          <button type="button" className={styles.iconbtn} title="Help">
            ?
          </button>
          <button type="button" className={styles.iconbtn} title="Notifications">
            &#9873;
          </button>
          <div className={styles.admin}>
            <span className={styles.adminAvatar}>{(sys.adminUser || "A").charAt(0).toUpperCase()}</span>
            <span>{sys.adminUser}</span>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={styles.rail}>
          {NAV.map((group) => (
            <RailGroup
              key={group.key}
              group={group}
              page={page}
              expanded={isGroupExpanded(group)}
              onToggle={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isGroupExpanded(group) }))}
              onNavigate={onNavigate}
            />
          ))}
        </aside>

        <section className={styles.main}>
          <div className={styles.breadcrumb}>
            {groupLabel} &nbsp;&rsaquo;&nbsp; <b>{leafLabel}</b>
          </div>
          <div className={styles.page}>{children}</div>
        </section>
      </div>
    </div>
  );
}
