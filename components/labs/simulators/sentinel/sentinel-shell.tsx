"use client";

// Portal shell for the Microsoft Sentinel simulator: Azure-blue topbar
// (Microsoft apps grid, hamburger, "Microsoft Azure" wordmark, search,
// Copilot/Cloud Shell/notifications/settings, avatar) + Sentinel blade header
// (breadcrumb "Home > Microsoft Sentinel > {workspace}", title, command bar
// with Create/Refresh/Export/Tutorial/Settings/Feedback) + grouped blade-nav
// (General / Threat management / Content management / Configuration, always
// fully expanded per source — sentinel.css has no collapse affordance) +
// content area. Ported from
// itbd-lab/simulators/sentinel/js/sentinel-portal.js
// renderTopBar()/renderBladeHeader()/renderBladeNav().
//
// Prop shape: this shell takes the full `state: SentinelState` (not just a
// workspace name string) so the breadcrumb/title can read the live workspace
// name directly and so future command-bar affordances (e.g. Export driven by
// real state) have state available without a prop-shape change. Page-building
// / wiring agents: render <SentinelShell state={state} page={page}
// onNavigate={setPage}>{pageBody}</SentinelShell> — the shell owns none of
// `state`, it only reads `state.workspace.name` for the breadcrumb/title.

import { type ReactNode } from "react";
import { toast } from "sonner";

import type { SentinelState } from "@/lib/labs/simulators/sentinel/types";
import styles from "./sentinel-console.module.css";

// ===== Page union =====
// Naming convention: kebab-case page ids, matching the source page keys used
// in sentinel-portal.js's renderPage() switch (so wiring against the ported
// per-page logic stays a 1:1 name match). Every page below has exactly one
// slot; do not add ad-hoc pages outside this union — extend it here first.
export type SentinelPage =
  | "overview"
  | "logs"
  | "incidents"
  | "hunting"
  | "rules"
  | "playbooks"
  | "automation-rules"
  | "workbooks"
  | "ueba"
  | "mitre"
  | "notebooks"
  | "watchlists"
  | "threat-intel"
  | "content-hub"
  | "kql-playground"
  | "data-connectors"
  | "repositories"
  | "workspace-manager"
  | "settings";

type NavItem = { page: SentinelPage; label: string };
type NavSection = { label: string; items: NavItem[] };

// Grouped blade nav ported from renderBladeNav() — General / Threat
// management / Content management / Configuration, matching source section
// order and grouping. (Source also lists a few pages this port's confirmed
// union doesn't carry as separate slots — e.g. "News & guides", "Search",
// "Community" — those are out of scope per the functional spec's confirmed
// page set and are intentionally omitted here.)
const NAV: NavSection[] = [
  {
    label: "General",
    items: [
      { page: "overview", label: "Overview" },
      { page: "logs", label: "Logs" },
      { page: "kql-playground", label: "KQL Playground (beginner)" },
    ],
  },
  {
    label: "Threat management",
    items: [
      { page: "incidents", label: "Incidents" },
      { page: "workbooks", label: "Workbooks" },
      { page: "hunting", label: "Hunting" },
      { page: "notebooks", label: "Notebooks" },
      { page: "ueba", label: "Entity behavior" },
      { page: "threat-intel", label: "Threat intelligence" },
      { page: "mitre", label: "MITRE ATT&CK" },
    ],
  },
  {
    label: "Content management",
    items: [
      { page: "content-hub", label: "Content hub" },
      { page: "repositories", label: "Repositories" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { page: "workspace-manager", label: "Workspace manager" },
      { page: "data-connectors", label: "Data connectors" },
      { page: "rules", label: "Analytics" },
      { page: "watchlists", label: "Watchlist" },
      { page: "automation-rules", label: "Automation" },
      { page: "settings", label: "Settings" },
    ],
  },
];

function NavDotIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" width="12" height="12">
      <circle cx="6" cy="6" r="3" />
    </svg>
  );
}

export function SentinelShell({
  state,
  page,
  onNavigate,
  children,
}: {
  state: SentinelState;
  page: SentinelPage;
  onNavigate: (p: SentinelPage) => void;
  children: ReactNode;
}) {
  const workspaceName = state.workspace.name;

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Microsoft apps">
            <svg width="16" height="16" viewBox="0 0 16 16">
              {[1, 6, 11].flatMap((x) => [1, 6, 11].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill="#fff" />))}
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Menu">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#fff">
              <rect x="1" y="3" width="14" height="1.5" />
              <rect x="1" y="7.25" width="14" height="1.5" />
              <rect x="1" y="11.5" width="14" height="1.5" />
            </svg>
          </button>
          <span className={styles.tbWordmark}>Microsoft Azure</span>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg className={styles.tbSearchIc} width="14" height="14" viewBox="0 0 16 16" fill="#605e5c">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search resources, services, and docs (G+/)" />
          </div>
        </div>
        <div className={styles.tbRight}>
          <button type="button" className={styles.tbIconBtn} title="Copilot" onClick={() => toast.info("Copilot isn't in this simulator yet.")}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4v4l3 2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Cloud Shell" onClick={() => toast.info("Cloud Shell isn't in this simulator yet.")}>
            <span style={{ fontFamily: "Consolas, monospace", color: "#fff", fontSize: 13 }}>&gt;_</span>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Notifications" onClick={() => toast.info("No new notifications.")}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Settings" onClick={() => onNavigate("settings")}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
          <div className={styles.tbAvatar} title="admin@itbd.onmicrosoft.com">
            AS
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div className={styles.bladeHeader}>
            <div className={styles.bc}>
              <a>Home</a> &gt; <a>Microsoft Sentinel</a> &gt; <a>{workspaceName}</a>
            </div>
            <div className={styles.bladeTitle}>
              <div className={styles.wsIcon}>MS</div>
              <h1>Microsoft Sentinel</h1>
              <span className={styles.bladeTitleSub}>| {workspaceName}</span>
            </div>
            <div className={styles.bladeToolbar}>
              <button type="button" className={styles.tbBtn} onClick={() => toast.success("Workbook saved")}>
                <span className={styles.tbBtnIco}>+</span>Create
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => toast.info("Refreshed")}>
                <span className={styles.tbBtnIco}>&#10227;</span>Refresh
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => toast.info("Export isn't wired up in this simulator yet.")}>
                <span className={styles.tbBtnIco}>&#9660;</span>Export
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => toast.info("Tutorial isn't wired up in this simulator yet.")}>
                <span className={styles.tbBtnIco}>?</span>Tutorial
              </button>
              <div className={styles.tbSep} />
              <button type="button" className={styles.tbBtn} onClick={() => onNavigate("settings")}>
                <span className={styles.tbBtnIco}>&#9881;</span>Settings
              </button>
              <button type="button" className={styles.tbBtn} onClick={() => toast.info("Thanks for the feedback!")}>
                <span className={styles.tbBtnIco}>&#9432;</span>Feedback
              </button>
            </div>
          </div>

          <div className={styles.shell}>
            <nav className={styles.bladenav}>
              {NAV.map((section) => (
                <div key={section.label}>
                  <div className={styles.navSection}>{section.label}</div>
                  {section.items.map((item) => (
                    <a
                      key={item.page}
                      className={`${styles.navItem} ${page === item.page ? styles.navItemActive : ""}`}
                      onClick={() => onNavigate(item.page)}
                    >
                      <span className={styles.navIco}>
                        <NavDotIcon />
                      </span>
                      <span>{item.label}</span>
                    </a>
                  ))}
                </div>
              ))}
            </nav>

            <main className={styles.content}>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
