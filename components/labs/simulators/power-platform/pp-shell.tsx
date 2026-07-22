"use client";

// Portal shell for the Power Platform Admin Center simulator: thin near-black
// topbar (Microsoft-apps waffle, wordmark, search, tenant name + region,
// help, settings, avatar) + grouped/collapsible sidebar (flat Home item,
// then Manage/Policies/Analytics/Resources/Settings sections) + content
// area. Ported from itbd-lab/simulators/powerplatform/js/pp-portal.js
// renderTopBar()/renderSidebar()/navItem()/navItemGroup().
//
// Built as a NORMAL React container: `children` is swapped by the parent via
// state-driven conditional rendering (the parent owns a `page` state
// variable and renders the matching page component as `children`), and this
// shell only ever reads props / local `useState` for which nav groups are
// expanded. It never touches the DOM manually — source's
// `renderSidebarOnly()`/`renderShell()` DOM-replacement approach has no
// equivalent here; the content area is just `{children}`.
//
// Prop shape: page-building / wiring agents render
// <PpShell state={state} page={page} onNavigate={setPage} dispatch={dispatch}>{pageBody}</PpShell>

import { useState, type ReactNode } from "react";

import type { PpState } from "@/lib/labs/simulators/power-platform/types";
import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import styles from "./pp-console.module.css";

// ===== Page union =====
// Naming convention: kebab-case page ids. This is the CONFIRMED full set of
// pages this simulator will eventually have — every page-building agent must
// render one of these; extend this union here first if a new page is ever
// needed, never invent an ad-hoc page id at a call site.
//
// Note: "analytics" is a SINGLE page covering the 4 sub-dashboards
// (Power Apps / Power Automate / Dataverse / Copilot Studio analytics) that
// source splits across `analytics-apps`/`analytics-flows`/`analytics-dv`/
// `analytics-copilot` — the analytics page-building agent should render its
// own in-page tab switcher (via <TabBar/>/<SubTabBar/> from pp-ui.tsx)
// across those 4 sub-views rather than getting 4 separate routed pages.
export type PpPage =
  | "overview"
  | "environments"
  | "apps"
  | "flows"
  | "dlp-policies"
  | "analytics"
  | "capacity"
  | "licenses"
  | "power-pages-sites"
  | "power-bi-workspaces"
  | "copilot-studio"
  | "tenant-isolation"
  | "customer-lockbox"
  | "customer-managed-key"
  | "settings";

type NavLeaf = { page: PpPage; label: string };

const TOP_NAV: NavLeaf[] = [{ page: "overview", label: "Home" }];

// The 5 collapsible nav sections, in source sidebar order (renderSidebar()):
// Manage / Policies / Analytics / Resources / Settings.
const MANAGE_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "manage",
  label: "Manage",
  items: [
    { page: "environments", label: "Environments" },
    { page: "apps", label: "Power Apps" },
    { page: "flows", label: "Power Automate" },
    { page: "power-pages-sites", label: "Power Pages sites" },
    { page: "power-bi-workspaces", label: "Power BI workspaces" },
    { page: "copilot-studio", label: "Copilot Studio" },
  ],
};

const POLICIES_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "policies",
  label: "Policies",
  items: [
    { page: "dlp-policies", label: "Data policies" },
    { page: "tenant-isolation", label: "Tenant isolation" },
    { page: "customer-lockbox", label: "Customer Lockbox" },
    { page: "customer-managed-key", label: "Customer-managed key" },
  ],
};

const ANALYTICS_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "analytics",
  label: "Analytics",
  items: [{ page: "analytics", label: "Analytics" }],
};

const RESOURCES_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "resources",
  label: "Resources",
  items: [
    { page: "capacity", label: "Capacity" },
    { page: "licenses", label: "Licenses" },
  ],
};

const SETTINGS_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "settings",
  label: "Settings",
  items: [{ page: "settings", label: "All settings" }],
};

const NAV_GROUPS = [MANAGE_GROUP, POLICIES_GROUP, ANALYTICS_GROUP, RESOURCES_GROUP, SETTINGS_GROUP];

function NavItem({ item, page, onNavigate }: { item: NavLeaf; page: PpPage; onNavigate: (p: PpPage) => void }) {
  const active = page === item.page;
  return (
    <button type="button" className={`${styles.navItem} ${active ? styles.navItemActive : ""}`} onClick={() => onNavigate(item.page)}>
      <span>{item.label}</span>
    </button>
  );
}

function NavGroup({
  label,
  items,
  page,
  expanded,
  onToggle,
  onNavigate,
}: {
  label: string;
  items: NavLeaf[];
  page: PpPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: PpPage) => void;
}) {
  return (
    <>
      <div className={styles.navSection}>{label}</div>
      {items.length > 1 ? (
        <button type="button" className={styles.navItem} onClick={onToggle} aria-expanded={expanded}>
          <span>{expanded ? "Collapse" : "Expand"}</span>
          <span className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`}>&#9656;</span>
        </button>
      ) : null}
      <div className={items.length > 1 ? `${styles.navSub} ${expanded ? styles.navSubOpen : ""}` : ""}>
        {items.map((item) => (
          <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </>
  );
}

export function PpShell({
  state,
  page,
  onNavigate,
  dispatch,
  children,
}: {
  state: PpState;
  page: PpPage;
  onNavigate: (p: PpPage) => void;
  dispatch?: (action: PpAction) => void;
  children: ReactNode;
}) {
  // Local expand/collapse state for the collapsible nav groups, matching
  // source's `navOpen = { manage: true, policies: true, analytics: true,
  // resources: true, settings: false }` — default-expand whichever group
  // contains the current page so navigating directly to e.g.
  // "customer-managed-key" doesn't hide the active item under a collapsed
  // group.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { manage: true, policies: true, analytics: true, resources: true, settings: false };
    for (const group of NAV_GROUPS) {
      if (group.items.some((i) => i.page === page)) initial[group.key] = true;
    }
    return initial;
  });

  // `dispatch` is currently unused by the shell itself (source's topbar/
  // sidebar have no state-mutating controls beyond navigation), but is
  // accepted so page-building agents have a single consistent shell prop
  // shape and can lift it for pages that need it. Silence unused-var lint
  // without eslint-disable by referencing it in a no-op-safe way via default.
  void dispatch;

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Microsoft apps">
            <svg width="18" height="18" viewBox="0 0 16 16">
              <rect x="1" y="1" width="4" height="4" fill="#fff" />
              <rect x="6" y="1" width="4" height="4" fill="#fff" />
              <rect x="11" y="1" width="4" height="4" fill="#fff" />
              <rect x="1" y="6" width="4" height="4" fill="#fff" />
              <rect x="6" y="6" width="4" height="4" fill="#fff" />
              <rect x="11" y="6" width="4" height="4" fill="#fff" />
              <rect x="1" y="11" width="4" height="4" fill="#fff" />
              <rect x="6" y="11" width="4" height="4" fill="#fff" />
              <rect x="11" y="11" width="4" height="4" fill="#fff" />
            </svg>
          </button>
          <span className={styles.wordmark}>
            Power Platform<span className={styles.accent}>|</span>admin center
          </span>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#c8c8c8">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search environments, apps, flows, policies" />
          </div>
        </div>
        <div className={styles.tbRight}>
          <span className={styles.tbEnv}>
            {state.tenant.name} &middot; {state.tenant.region}
          </span>
          <button type="button" className={styles.tbIconBtn} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path d="M10 2a4 4 0 00-4 4v3.5L4 12h12l-2-2.5V6a4 4 0 00-4-4zm-2 12a2 2 0 104 0H8z" fill="#fff" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Help">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Settings" onClick={() => onNavigate("settings")}>
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                fill="#fff"
              />
            </svg>
          </button>
          <div className={styles.tbAvatar} title={state.tenant.name}>
            A
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <nav className={styles.sidebar}>
          {TOP_NAV.map((item) => (
            <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
          ))}

          {NAV_GROUPS.map((group) => (
            <NavGroup
              key={group.key}
              label={group.label}
              items={group.items}
              page={page}
              expanded={!!expanded[group.key]}
              onToggle={() => setExpanded((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
