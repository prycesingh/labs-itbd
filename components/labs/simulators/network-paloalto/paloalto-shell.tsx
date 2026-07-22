"use client";

// Portal shell for the Palo Alto PAN-OS WebUI simulator: PAN-OS orange/dark
// topbar (brand chip, hostname/model/PAN-OS version, commit/save, admin
// avatar, logout) + a collapsible-group left sidebar (Dashboard / Network /
// Objects / Policies / Security Profiles / VPN / Device & Users / Monitor) +
// content area.
// Ported from itbd-lab/simulators/network/js/paloalto-ui.js NAV array
// (lines 11-174), renderTopbar() (223-257), renderShell() (259-267),
// renderRail() (269-298), navigate()/findTab()/findPageLabel().
//
// Source's real nav is genuinely TWO-level: 7 top tabs (Dashboard/ACC/
// Monitor/Policies/Objects/Network/Device), each with a flat (or
// colon-grouped, e.g. "Security Profiles: Antivirus") list of rail items —
// closer to Cisco's two-level tab+tree than FortiGate's single-level
// grouped rail. This port collapses that two-step interaction (top tab ->
// rail item) into ONE always-visible, independently-collapsible grouped
// sidebar (matching the FortiGate-suite convention for single-level grouped
// nav — see fortigate-shell.tsx header for the same judgment call), which
// reads better in a scrollable web app than source's tab-swap-then-click.
// Source's 61 raw leaf pages (Dashboard's 1 + ACC's 6 + Monitor's 22 +
// Policies' 10 + Objects' 31 + Network's 28 + Device's 45 — note some
// overlap/shared handlers, e.g. `acc-blocked` aliases `acc-threat`) are
// consolidated onto the `PaloPage` union below — the same consolidation
// judgment used for Cisco's ~70->29 and FortiGate's ~40->29 reductions.
// Thin/out-of-scope stubs are dropped: most of Monitor's report-builder and
// session-browser pages (traffic/threat/URL/WildFire/system logs already
// have dedicated pages; Block IP List, Botnet, App Scope, Reports, PDF/
// Custom Reports are out of scope for a firewall-focused simulator), most of
// Network's routing-daemon/tunnel-inspection/QoS/LLDP/SD-WAN/GRE/DHCP/DNS-
// proxy/GP-satellite/MDM/clientless-app leaves (interfaces/zones/virtual
// routers/VLANs/IPsec/GlobalProtect already have dedicated pages), most of
// Device's Setup/Troubleshooting/Software/Dynamic-Updates/Plugins/Support
// settings stubs (identity/admin/HA/certs/server-profiles/auth already have
// dedicated pages), and QoS/PBF/Tunnel-Inspection/App-Override/DoS/SD-WAN
// policy types (security/NAT/decryption/auth already have dedicated pages
// and match the 4 policy types modeled in PaloState).
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
// <PaloShell state={state} page={page} onNavigate={setPage} dispatch={dispatch}>{pageBody}</PaloShell>

import { useState, type ReactNode } from "react";

import type { PaloState } from "@/lib/labs/simulators/network-paloalto/types";
import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import styles from "./paloalto-console.module.css";

// ===== Page union =====
// This is the CONFIRMED, definitive page list — every page-building agent
// must render one of these. Consolidated from source's ~61-leaf NAV
// structure (see file header). Extend this union here first if a new page
// is ever needed — never invent an ad-hoc page id at a call site.
export type PaloPage =
  // Dashboard
  | "overview"
  // Network
  | "interfaces"
  | "zones"
  | "virtual-routers"
  | "vlans"
  // Objects
  | "addresses"
  | "services"
  | "applications"
  | "tags"
  // Policies
  | "security-policies"
  | "nat-policies"
  | "decryption-policies"
  | "auth-policies"
  // Security Profiles
  | "av-profiles"
  | "as-profiles"
  | "vp-profiles"
  | "url-profiles"
  | "file-wildfire-profiles"
  | "data-profile-groups"
  // VPN
  | "ipsec-tunnels"
  | "ike-gateways"
  | "global-protect"
  // Device / Users
  | "administrators"
  | "certificates"
  | "server-profiles"
  | "high-availability"
  | "local-users"
  | "user-groups"
  | "auth-profiles"
  // Monitor / Logs
  | "traffic-logs"
  | "threat-logs"
  | "url-logs"
  | "wildfire-submissions"
  | "system-logs";

type NavLeaf = { page: PaloPage; label: string };
type NavGroupDef = { key: string; label: string; items: NavLeaf[] };

// Sidebar groups, consolidated from source's NAV array (paloalto-ui.js
// lines 11-174) onto the `PaloPage` union above. Group order/labels mirror
// PAN-OS 11.x's real top-tab order (Dashboard, Network, Objects, Policies,
// [Objects: Security Profiles], VPN [from Network's GlobalProtect/IPsec
// leaves], Device [narrowed to identity/admin/HA/certs/server-profiles/
// auth/users], Monitor) with "Dashboard" pulled to the front as its own
// group (source's dashboard tab is the default landing page, and ACC's 6
// dashboards are folded into the Overview page's Top Applications tile per
// the task brief) and "Security Profiles" broken out from Objects into its
// own group since PAN-OS's real Objects rail visually sub-groups them under
// a "Security Profiles:" heading (source's renderRail() colon-splitting
// logic, paloalto-ui.js:277-284).
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
      { page: "virtual-routers", label: "Virtual Routers" },
      { page: "vlans", label: "VLANs" },
    ],
  },
  {
    key: "g-objects",
    label: "Objects",
    items: [
      { page: "addresses", label: "Addresses" },
      { page: "services", label: "Services" },
      { page: "applications", label: "Applications" },
      { page: "tags", label: "Tags" },
    ],
  },
  {
    key: "g-policies",
    label: "Policies",
    items: [
      { page: "security-policies", label: "Security" },
      { page: "nat-policies", label: "NAT" },
      { page: "decryption-policies", label: "Decryption" },
      { page: "auth-policies", label: "Authentication" },
    ],
  },
  {
    key: "g-security-profiles",
    label: "Security Profiles",
    items: [
      { page: "av-profiles", label: "Antivirus" },
      { page: "as-profiles", label: "Anti-Spyware" },
      { page: "vp-profiles", label: "Vulnerability Protection" },
      { page: "url-profiles", label: "URL Filtering" },
      { page: "file-wildfire-profiles", label: "File Blocking & WildFire" },
      { page: "data-profile-groups", label: "Data Filtering & Profile Groups" },
    ],
  },
  {
    key: "g-vpn",
    label: "VPN",
    items: [
      { page: "ipsec-tunnels", label: "IPSec Tunnels" },
      { page: "ike-gateways", label: "IKE Gateways" },
      { page: "global-protect", label: "GlobalProtect" },
    ],
  },
  {
    key: "g-device",
    label: "Device / Users",
    items: [
      { page: "administrators", label: "Administrators" },
      { page: "certificates", label: "Certificates" },
      { page: "server-profiles", label: "Server Profiles" },
      { page: "high-availability", label: "High Availability" },
      { page: "local-users", label: "Local User Database" },
      { page: "user-groups", label: "User Groups" },
      { page: "auth-profiles", label: "Authentication Profile" },
    ],
  },
  {
    key: "g-monitor",
    label: "Monitor",
    items: [
      { page: "traffic-logs", label: "Logs: Traffic" },
      { page: "threat-logs", label: "Logs: Threat" },
      { page: "url-logs", label: "Logs: URL Filtering" },
      { page: "wildfire-submissions", label: "Logs: WildFire Submissions" },
      { page: "system-logs", label: "Logs: System" },
    ],
  },
];

function RailLeaf({ item, page, onNavigate }: { item: NavLeaf; page: PaloPage; onNavigate: (p: PaloPage) => void }) {
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
  page: PaloPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: PaloPage) => void;
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

function findGroupLabel(page: PaloPage): string {
  return NAV.find((g) => g.items.some((it) => it.page === page))?.label ?? "";
}
function findLeafLabel(page: PaloPage): string {
  return NAV.flatMap((g) => g.items).find((it) => it.page === page)?.label ?? "";
}

export function PaloShell({
  state,
  page,
  onNavigate,
  dispatch,
  children,
}: {
  state: PaloState;
  page: PaloPage;
  onNavigate: (p: PaloPage) => void;
  dispatch: React.Dispatch<PaloAction>;
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
  // navigation. Source's Commit/Save/Logout buttons are presentational-only
  // here (no destructive action wired without an explicit reducer action to
  // call).
  void dispatch;

  const d = state.device;
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
          <div className={styles.brandLogo}>PA</div>
          <div className={styles.brandText}>
            {d.hostname}
            <small>
              {d.model} &middot; PAN-OS {d.panOS}
            </small>
          </div>
        </div>

        <div className={styles.toptabs}>
          {NAV.map((group) => (
            <button
              key={group.key}
              type="button"
              className={`${styles.toptab} ${groupLabel === group.label ? styles.toptabActive : ""}`}
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
          <button type="button" className={`${styles.iconbtn} ${styles.commit}`} title="Commit">
            Commit
            {d.pendingChanges ? <span className={styles.pendingBadge}>{d.pendingChanges}</span> : null}
          </button>
          <button type="button" className={styles.iconbtn} title="Save">
            Save
          </button>
          <div className={styles.admin}>
            <span className={styles.adminAvatar}>{(d.adminUser || "A").charAt(0).toUpperCase()}</span>
            <span>{d.adminUser}</span>
          </div>
          <button type="button" className={styles.iconbtn} title="Logout">
            Logout
          </button>
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
