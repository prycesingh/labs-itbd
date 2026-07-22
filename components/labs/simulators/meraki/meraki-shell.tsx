"use client";

// Portal shell for the Cisco Meraki dashboard simulator: dark navy topbar
// (Meraki wordmark/logo mark, org name, network switcher, search, help,
// notifications, settings, admin avatar) + grouped/collapsible sidebar (8
// nav groups, 5 of which are gated by the current network's `productTypes`)
// + content area. Ported from
// itbd-lab/simulators/meraki/js/meraki-portal.js renderTopbar()/
// renderShell()/renderRail()/navigate()/networkHas() (NAV array, lines
// 14-103).
//
// Built as a NORMAL React container: `children` is swapped by the parent via
// state-driven conditional rendering (the parent owns a `page` state
// variable and renders the matching page component as `children`), and this
// shell only ever reads props / local `useState` for which nav groups are
// expanded. It never touches the DOM manually — source's innerHTML-based
// renderRail()/renderTopbar() has no equivalent here; the content area is
// just `{children}`.
//
// Prop shape: page-building / wiring agents render
// <MerakiShell state={state} page={page} onNavigate={setPage} dispatch={dispatch} onNetworkChange={...}>{pageBody}</MerakiShell>

import { useState, type ReactNode } from "react";

import type { MerakiState } from "@/lib/labs/simulators/meraki/types";
import type { MerakiAction } from "@/lib/labs/simulators/meraki/reducer";
import styles from "./meraki-console.module.css";

// ===== Page union =====
// Naming convention: kebab-case page ids, prefixed by nav-group short code
// (nw- / sec- / sw- / wl- / cam- / sensor- / insight- / org-). This is the
// CONFIRMED, definitive page list — every page-building agent must render
// one of these. Consolidated from source's 72-leaf-page NAV structure: many
// source leaves were thin static stubs (e.g. nw-grouppol, nw-adddev,
// nw-floor, nw-netflow, nw-auth, nw-webhooks under Network-wide; sd-insight,
// sd-autovpn, sd-dhcp, sd-cvpn, sd-ad, sd-access, sd-splash, sd-concentr
// under Security & SD-WAN; sw-stacks, sw-schedules, sw-policies, sw-power
// under Switch; wl-blesettings, wl-radio, wl-mesh, wl-outdoor under
// Wireless) that should be tabs/sections WITHIN one page component rather
// than separate routed pages. Extend this union here first if a new page is
// ever needed — never invent an ad-hoc page id at a call site.
export type MerakiPage =
  // Network-wide
  | "nw-overview"
  | "nw-clients"
  | "nw-devices"
  | "nw-topology"
  | "nw-traffic-analytics"
  | "nw-health"
  | "nw-alerts"
  | "nw-general"
  | "nw-admins"
  | "nw-templates"
  // Security & SD-WAN (only shown when current network has "appliance")
  | "sec-appliance-status"
  | "sec-center"
  | "sec-vpn-status"
  | "sec-addressing-vlans"
  | "sec-nat"
  | "sec-site-to-site-vpn"
  | "sec-routing"
  | "sec-firewall"
  | "sec-content-filtering"
  | "sec-sdwan"
  // Switch (only shown when current network has "switch")
  | "sw-switches"
  | "sw-ports"
  | "sw-routing-dhcp"
  | "sw-acl"
  // Wireless (only shown when current network has "wireless")
  | "wl-access-points"
  | "wl-ssids"
  | "wl-air-marshal"
  | "wl-bluetooth"
  // Cameras (only shown when current network has "camera")
  | "cam-cameras"
  // Sensors (only shown when current network has "sensor")
  | "sensor-sensors"
  // Insight (always shown)
  | "insight-web-apps"
  | "insight-wan-health"
  | "insight-applications"
  // Organization (always shown)
  | "org-overview"
  | "org-inventory"
  | "org-license"
  | "org-audit-log";

type NavLeaf = { page: MerakiPage; label: string };
type NavGroupDef = { key: string; label: string; requires: "appliance" | "switch" | "wireless" | "camera" | "sensor" | "any"; items: NavLeaf[] };

// The 8 nav groups, in source sidebar order (NAV array, meraki-portal.js
// lines 14-103). `requires` mirrors source's per-group `requires` field,
// consumed by `networkHas()` below.
const NAV_GROUPS: NavGroupDef[] = [
  {
    key: "network-wide",
    label: "Network-wide",
    requires: "any",
    items: [
      { page: "nw-overview", label: "Overview" },
      { page: "nw-clients", label: "Clients" },
      { page: "nw-devices", label: "Devices" },
      { page: "nw-topology", label: "Topology" },
      { page: "nw-traffic-analytics", label: "Traffic analytics" },
      { page: "nw-health", label: "Health" },
      { page: "nw-alerts", label: "Alerts" },
      { page: "nw-general", label: "General" },
      { page: "nw-admins", label: "Administrators" },
      { page: "nw-templates", label: "Network templates" },
    ],
  },
  {
    key: "security-sdwan",
    label: "Security & SD-WAN",
    requires: "appliance",
    items: [
      { page: "sec-appliance-status", label: "Appliance status" },
      { page: "sec-center", label: "Security center" },
      { page: "sec-vpn-status", label: "VPN status" },
      { page: "sec-addressing-vlans", label: "Addressing & VLANs" },
      { page: "sec-nat", label: "NAT" },
      { page: "sec-site-to-site-vpn", label: "Site-to-site VPN" },
      { page: "sec-routing", label: "Routing" },
      { page: "sec-firewall", label: "Firewall" },
      { page: "sec-content-filtering", label: "Content filtering" },
      { page: "sec-sdwan", label: "SD-WAN & traffic shaping" },
    ],
  },
  {
    key: "switch",
    label: "Switch",
    requires: "switch",
    items: [
      { page: "sw-switches", label: "Switches" },
      { page: "sw-ports", label: "Switch ports" },
      { page: "sw-routing-dhcp", label: "Routing & DHCP" },
      { page: "sw-acl", label: "ACL" },
    ],
  },
  {
    key: "wireless",
    label: "Wireless",
    requires: "wireless",
    items: [
      { page: "wl-access-points", label: "Access points" },
      { page: "wl-ssids", label: "SSIDs" },
      { page: "wl-air-marshal", label: "Air Marshal" },
      { page: "wl-bluetooth", label: "Bluetooth clients" },
    ],
  },
  {
    key: "cameras",
    label: "Cameras",
    requires: "camera",
    items: [{ page: "cam-cameras", label: "Cameras" }],
  },
  {
    key: "sensors",
    label: "Sensors",
    requires: "sensor",
    items: [{ page: "sensor-sensors", label: "Sensors" }],
  },
  {
    key: "insight",
    label: "Insight",
    requires: "any",
    items: [
      { page: "insight-web-apps", label: "Web app health" },
      { page: "insight-wan-health", label: "WAN health" },
      { page: "insight-applications", label: "Application" },
    ],
  },
  {
    key: "organization",
    label: "Organization",
    requires: "any",
    items: [
      { page: "org-overview", label: "Overview" },
      { page: "org-inventory", label: "Inventory" },
      { page: "org-license", label: "License info" },
      { page: "org-audit-log", label: "Audit log" },
    ],
  },
];

// Mirrors source's networkHas(network, requires) (meraki-portal.js:154-159):
// "any" is always visible; otherwise the group is only shown when the
// current network's productTypes includes the required product type.
function networkHas(network: MerakiState["networks"][number] | undefined, requires: NavGroupDef["requires"]): boolean {
  if (requires === "any") return true;
  return !!network?.productTypes.includes(requires);
}

function RailItem({ item, page, onNavigate }: { item: NavLeaf; page: MerakiPage; onNavigate: (p: MerakiPage) => void }) {
  const active = page === item.page;
  return (
    <button type="button" className={`${styles.railItem} ${active ? styles.railItemActive : ""}`} onClick={() => onNavigate(item.page)}>
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
  page: MerakiPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: MerakiPage) => void;
}) {
  return (
    <div className={styles.railGroup}>
      <button type="button" className={styles.railGrpHead} onClick={onToggle} aria-expanded={expanded}>
        <span>{group.label}</span>
        <span className={styles.grpCaret}>{expanded ? "▾" : "▸"}</span>
      </button>
      <div className={`${styles.railItems} ${expanded ? "" : styles.railItemsCollapsed}`}>
        {group.items.map((item) => (
          <RailItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function MerakiShell({
  state,
  page,
  onNavigate,
  dispatch,
  onNetworkChange,
  children,
}: {
  state: MerakiState;
  page: MerakiPage;
  onNavigate: (p: MerakiPage) => void;
  dispatch: React.Dispatch<MerakiAction>;
  // The reducer's exact network-switch action shape isn't confirmed yet (the
  // data-layer agent owns reducer.ts concurrently), so the shell exposes a
  // plain callback prop instead of dispatching directly. The final
  // simulator container / page-wiring agent wires this to the real
  // dispatch (e.g. `onNetworkChange={(id) => dispatch({ type: "SET_CURRENT_NETWORK", networkId: id })}`).
  onNetworkChange?: (networkId: string) => void;
  children: ReactNode;
}) {
  const currentNetwork = state.networks.find((n) => n.id === state.currentNetworkId);

  // Local expand/collapse state for the collapsible nav groups — default
  // expanded if the group contains the current page, matching source's
  // per-group `mer-rail-items collapsed` toggle persisted in
  // `MerakiData.state.ui.railCollapsed` (meraki-portal.js:299,319). Groups
  // not containing the current page default to expanded too (source's rail
  // starts fully expanded until an admin collapses a group), so only track
  // explicit collapses.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // `dispatch` is accepted so page-building agents have a single consistent
  // shell prop shape and can lift it for pages that need it; the shell
  // itself has no state-mutating controls beyond navigation and the
  // network switcher (handled via `onNetworkChange`).
  void dispatch;

  const visibleGroups = NAV_GROUPS.filter((g) => networkHas(currentNetwork, g.requires));

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>M</span>
          <span>Meraki</span>
        </div>

        <select className={styles.topSel} title="Organization" value={state.org.id} disabled>
          <option value={state.org.id}>{state.org.name}</option>
        </select>

        <select
          className={styles.topSel}
          title="Network"
          value={state.currentNetworkId}
          onChange={(e) => onNetworkChange?.(e.target.value)}
        >
          {state.networks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        <input className={styles.topSearch} placeholder="Search dashboard (clients, devices, settings)..." />

        <div className={styles.topSpacer} />

        <div className={styles.topRight}>
          <button type="button" className={styles.topIcon} title="Documentation">
            ?
          </button>
          <button type="button" className={styles.topIcon} title="Notifications">
            &#9873;
          </button>
          <button type="button" className={styles.topIcon} title="API access">
            &#9881;
          </button>
          <div className={styles.admin}>
            <span className={styles.adminAvatar}>A</span>
            <span>{state.org.admin}</span>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={styles.rail}>
          {visibleGroups.map((group) => (
            <RailGroup
              key={group.key}
              group={group}
              page={page}
              expanded={!collapsed[group.key]}
              onToggle={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
              onNavigate={onNavigate}
            />
          ))}
        </aside>

        <section className={styles.main}>{children}</section>
      </div>
    </div>
  );
}
