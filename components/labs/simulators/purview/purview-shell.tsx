"use client";

// Portal shell for the Microsoft Purview compliance-portal simulator:
// near-black topbar (Microsoft apps grid, wordmark, search, help, settings,
// avatar) + white grouped sidebar (top-level items plus two COLLAPSIBLE
// sub-groups — "Data lifecycle management" and "eDiscovery" — matching
// source's `.pv-nav-sub`/chevron expand pattern) + content area. Ported from
// itbd-lab/simulators/purview/js/purview-portal.js renderTopBar()/
// renderSidebar()/navItemGroup().
//
// Built as a NORMAL React container: `children` is swapped by the parent via
// state-driven conditional rendering (the parent owns a `page` state variable
// and renders the matching page component as `children`), and this shell only
// ever reads props / local `useState` for which nav groups are expanded. It
// never touches the DOM manually (no `document.getElementById`,
// `innerHTML`/`outerHTML` mutation) — which is what structurally rules out
// source's critical bug where clicking "Audit" destroyed the whole shell
// (source's router called a page module's `render()` with no arguments and
// manually replaced `document.getElementById('pvContent')` — actually
// `.pp-content`, a selector that doesn't exist at all — via `outerHTML`).
// Here the content area is just `{children}`, so there is no DOM-mutation
// path for any page to break.
//
// Prop shape: page-building / wiring agents render
// <PurviewShell state={state} page={page} onNavigate={setPage}>{pageBody}</PurviewShell>
// — the shell owns none of `state`; Home/other pages read it directly.

import { useState, type ReactNode } from "react";

import type { PurviewState } from "@/lib/labs/simulators/purview/types";
import styles from "./purview-console.module.css";

// ===== Page union =====
// Naming convention: kebab-case page ids. This is the CONFIRMED full set of
// pages this simulator will eventually have (per the porting plan) — every
// page-building agent must render one of these; extend this union here first
// if a new page is ever needed, never invent an ad-hoc page id at a call site.
export type PurviewPage =
  | "home"
  | "audit"
  | "data-map"
  | "data-estate-insights"
  | "data-quality"
  | "comm-compliance"
  | "compliance-manager"
  | "dlm-policies"
  | "dlm-labels"
  | "dlm-adaptive-scopes"
  | "records-management"
  | "dlp"
  | "ediscovery-standard"
  | "ediscovery-premium"
  | "information-barriers"
  | "information-protection"
  | "insider-risk"
  | "roles-scopes"
  | "settings";

type NavLeaf = { page: PurviewPage; label: string };

// Top-level (ungrouped) nav items, in source sidebar order, minus the two
// collapsible sub-groups (rendered separately below) and minus "Search" /
// "dataMap" sub-legacy-tab variants that source itself folds into single
// pages here (data-map, dlp, etc. are each one page — sub-tab navigation
// within a page is that page component's own concern via local useState).
const TOP_NAV: NavLeaf[] = [{ page: "home", label: "Home" }];

const SOLUTIONS_NAV: NavLeaf[] = [
  { page: "audit", label: "Audit" },
  { page: "data-map", label: "Data Map (Data Governance)" },
  { page: "data-estate-insights", label: "Data Estate Insights" },
  { page: "data-quality", label: "Data Quality" },
  { page: "comm-compliance", label: "Communication compliance" },
  { page: "compliance-manager", label: "Compliance Manager" },
];

// "Data lifecycle management" collapsible sub-group (source key: `dlm`).
const DLM_GROUP: { label: string; items: NavLeaf[] } = {
  label: "Data lifecycle management",
  items: [
    { page: "dlm-policies", label: "Policies" },
    { page: "dlm-labels", label: "Labels" },
    { page: "dlm-adaptive-scopes", label: "Adaptive scopes" },
    { page: "records-management", label: "Records management" },
  ],
};

const AFTER_DLM_NAV: NavLeaf[] = [{ page: "dlp", label: "Data loss prevention" }];

// "eDiscovery" collapsible sub-group (source key: `ediscovery`).
const EDISCOVERY_GROUP: { label: string; items: NavLeaf[] } = {
  label: "eDiscovery",
  items: [
    { page: "ediscovery-standard", label: "Standard" },
    { page: "ediscovery-premium", label: "Premium" },
  ],
};

const AFTER_EDISCOVERY_NAV: NavLeaf[] = [
  { page: "information-barriers", label: "Information barriers" },
  { page: "information-protection", label: "Information protection" },
  { page: "insider-risk", label: "Insider risk management" },
];

const BOTTOM_NAV: NavLeaf[] = [
  { page: "roles-scopes", label: "Roles & scopes" },
  { page: "settings", label: "Settings" },
];

function NavItem({ item, page, onNavigate, sub = false }: { item: NavLeaf; page: PurviewPage; onNavigate: (p: PurviewPage) => void; sub?: boolean }) {
  const active = page === item.page;
  return (
    <button
      type="button"
      className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
      onClick={() => onNavigate(item.page)}
      style={sub ? { paddingLeft: 36, fontSize: 13, borderLeft: 0 } : undefined}
    >
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
  page: PurviewPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: PurviewPage) => void;
}) {
  const headerActive = items.some((i) => i.page === page);
  return (
    <>
      <button type="button" className={`${styles.navItem} ${headerActive ? styles.navItemActive : ""}`} onClick={onToggle}>
        <span>{label}</span>
        <span className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`}>&#9656;</span>
      </button>
      <div className={`${styles.navSub} ${expanded ? styles.navSubOpen : ""}`}>
        {items.map((item) => (
          <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} sub />
        ))}
      </div>
    </>
  );
}

export function PurviewShell({
  state,
  page,
  onNavigate,
  children,
}: {
  state: PurviewState;
  page: PurviewPage;
  onNavigate: (p: PurviewPage) => void;
  children: ReactNode;
}) {
  const dlmContainsPage = DLM_GROUP.items.some((i) => i.page === page);
  const ediscoveryContainsPage = EDISCOVERY_GROUP.items.some((i) => i.page === page);

  // Local expand/collapse state for the two collapsible sub-groups, matching
  // source's `navOpen = { dlm: false, ediscovery: false }` — default-expand
  // whichever group contains the current page (source only ever defaulted
  // both closed; this is a small UX improvement so navigating directly to a
  // DLM/eDiscovery sub-page doesn't hide the active item).
  const [dlmOpen, setDlmOpen] = useState(dlmContainsPage);
  const [ediscoveryOpen, setEdiscoveryOpen] = useState(ediscoveryContainsPage);

  const initials = state.tenant.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Microsoft apps">
            <svg width="18" height="18" viewBox="0 0 16 16">
              {[1, 6, 11].flatMap((x) => [1, 6, 11].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill="#fff" />))}
            </svg>
          </button>
          <span className={styles.wordmark}>Microsoft Purview</span>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#c8c8c8">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search policies, labels, cases or activities" />
          </div>
        </div>
        <div className={styles.tbRight}>
          <button type="button" className={styles.tbIconBtn} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Settings" onClick={() => onNavigate("settings")}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
          <div className={styles.tbAvatar} title={state.tenant.name}>
            {initials || "A"}
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <nav className={styles.sidebar}>
          {TOP_NAV.map((item) => (
            <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
          ))}
          <div className={styles.navSection}>Solutions</div>
          {SOLUTIONS_NAV.map((item) => (
            <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
          ))}
          <NavGroup
            label={DLM_GROUP.label}
            items={DLM_GROUP.items}
            page={page}
            expanded={dlmOpen}
            onToggle={() => setDlmOpen((v) => !v)}
            onNavigate={onNavigate}
          />
          {AFTER_DLM_NAV.map((item) => (
            <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
          ))}
          <NavGroup
            label={EDISCOVERY_GROUP.label}
            items={EDISCOVERY_GROUP.items}
            page={page}
            expanded={ediscoveryOpen}
            onToggle={() => setEdiscoveryOpen((v) => !v)}
            onNavigate={onNavigate}
          />
          {AFTER_EDISCOVERY_NAV.map((item) => (
            <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
          ))}
          <div className={styles.navDivider} />
          {BOTTOM_NAV.map((item) => (
            <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
          ))}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
