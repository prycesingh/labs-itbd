"use client";

// Portal shell for the Azure DevOps simulator: dark blue-to-navy topbar
// gradient (org switcher pill, project switcher pill, search, marketplace,
// help, notifications, settings, avatar) + collapsible grouped sidebar
// (project header, flat "Overview" item, then 5 collapsible nav groups —
// Boards/Repos/Pipelines/Test Plans/Artifacts — plus Project settings below
// a divider) + content area. Ported from
// itbd-lab/simulators/azure-devops/js/ado-portal.js renderTopBar()/
// renderSidebar()/navItem()/navGroup().
//
// Built as a NORMAL React container: `children` is swapped by the parent via
// state-driven conditional rendering (the parent owns a `page` state variable
// and renders the matching page component as `children`), and this shell only
// ever reads props / local `useState` for which nav groups are expanded. It
// never touches the DOM manually (no `document.getElementById`,
// `innerHTML`/`outerHTML` mutation) — source's `renderSidebarOnly()`/
// `renderShell()` DOM-replacement approach has no equivalent here; the
// content area is just `{children}`.
//
// Prop shape: page-building / wiring agents render
// <AdoShell state={state} page={page} onNavigate={setPage}>{pageBody}</AdoShell>
// — the shell owns none of `state`; Overview/other pages read it directly.
//
// The org/project switcher is cosmetic-dropdown-only per source (switching
// there triggers a full shell rebuild via `renderShell()` + `navigate('home')`).
// Here it's a lightweight <select> pair that dispatches `SWITCH_ORG` /
// `SWITCH_PROJECT` on change and calls `onNavigate("overview")` to match
// source's "switching always returns you to Home" behavior — no separate
// switcher modal is built (source's switcher modal is pure org/project
// listing with no other behavior, so the inline <select> is a strict
// simplification, not a scope cut).

import { useState, type ReactNode } from "react";

import type { AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import styles from "./ado-console.module.css";

// ===== Page union =====
// Naming convention: kebab-case page ids. This is the CONFIRMED full set of
// pages this simulator will eventually have — every page-building agent must
// render one of these; extend this union here first if a new page is ever
// needed, never invent an ad-hoc page id at a call site.
//
// Note: "pipelines-new-wizard" is NOT included as its own page. Per source
// (`ADOPipelines.renderList` + an in-page "New pipeline" modal/wizard), the
// new-pipeline flow is a MODAL launched from `pipelines-list`, not a
// standalone routed page — the pipelines-list page-building agent should
// open it via the shared `Modal` primitive from ado-ui.tsx, not via
// `onNavigate`.
export type AdoPage =
  | "overview"
  | "work-items"
  | "boards-sprints"
  | "boards-backlog"
  | "boards-queries"
  | "boards-delivery-plans"
  | "repos-files"
  | "repos-commits"
  | "repos-branches"
  | "repos-tags"
  | "repos-pushes"
  | "repos-pull-requests"
  | "pipelines-list"
  | "pipelines-yaml-editor"
  | "environments-library"
  | "test-plans"
  | "artifacts"
  | "project-settings";

type NavLeaf = { page: AdoPage; label: string };

const TOP_NAV: NavLeaf[] = [{ page: "overview", label: "Overview" }];

// The 5 collapsible nav groups, in source sidebar order
// (`navGroup('boards', ...)`, `navGroup('repos', ...)`, etc).
const BOARDS_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "boards",
  label: "Boards",
  items: [
    { page: "work-items", label: "Work items" },
    { page: "boards-sprints", label: "Sprints" },
    { page: "boards-backlog", label: "Backlogs" },
    { page: "boards-queries", label: "Queries" },
    { page: "boards-delivery-plans", label: "Delivery Plans" },
  ],
};

const REPOS_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "repos",
  label: "Repos",
  items: [
    { page: "repos-files", label: "Files" },
    { page: "repos-commits", label: "Commits" },
    { page: "repos-branches", label: "Branches" },
    { page: "repos-tags", label: "Tags" },
    { page: "repos-pushes", label: "Pushes" },
    { page: "repos-pull-requests", label: "Pull requests" },
  ],
};

const PIPELINES_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "pipelines",
  label: "Pipelines",
  items: [
    { page: "pipelines-list", label: "Pipelines" },
    { page: "pipelines-yaml-editor", label: "YAML editor" },
    { page: "environments-library", label: "Environments & Library" },
  ],
};

const TEST_PLANS_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "testplans",
  label: "Test Plans",
  items: [{ page: "test-plans", label: "Test plans" }],
};

const ARTIFACTS_GROUP: { key: string; label: string; items: NavLeaf[] } = {
  key: "artifacts",
  label: "Artifacts",
  items: [{ page: "artifacts", label: "Artifacts" }],
};

const NAV_GROUPS = [BOARDS_GROUP, REPOS_GROUP, PIPELINES_GROUP, TEST_PLANS_GROUP, ARTIFACTS_GROUP];

const BOTTOM_NAV: NavLeaf[] = [{ page: "project-settings", label: "Project settings" }];

function NavItem({ item, page, onNavigate }: { item: NavLeaf; page: AdoPage; onNavigate: (p: AdoPage) => void }) {
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
  page: AdoPage;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (p: AdoPage) => void;
}) {
  const headerActive = items.some((i) => i.page === page);
  return (
    <>
      <button
        type="button"
        className={`${styles.navItem} ${headerActive ? styles.navItemActiveParent : ""}`}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`}>&#9656;</span>
      </button>
      <div className={`${styles.navSub} ${expanded ? styles.navSubOpen : ""}`}>
        {items.map((item) => (
          <NavItem key={item.page} item={item} page={page} onNavigate={onNavigate} />
        ))}
      </div>
    </>
  );
}

export function AdoShell({
  state,
  page,
  onNavigate,
  dispatch,
  children,
}: {
  state: AdoState;
  page: AdoPage;
  onNavigate: (p: AdoPage) => void;
  /**
   * Optional — wires the org/project switcher <select>s to real
   * SWITCH_ORG/SWITCH_PROJECT reducer actions. Per spec this is a "your call"
   * item: source's switcher is cosmetic-dropdown-only, so AdoShell works
   * fine without it (the selects just won't do anything on change). Pass the
   * page component's `dispatch` from `useReducer(adoReducer, ...)` to make
   * switching orgs/projects actually update `AdoState`.
   */
  dispatch?: (action: AdoAction) => void;
  children: ReactNode;
}) {
  // Local expand/collapse state for the 5 collapsible nav groups, matching
  // source's `navOpen = { boards: true, repos: true, pipelines: true,
  // testplans: false, artifacts: false }` — default-expand whichever group
  // contains the current page so navigating directly to e.g.
  // "test-plans" doesn't hide the active item under a collapsed group.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { boards: true, repos: true, pipelines: true, testplans: false, artifacts: false };
    for (const group of NAV_GROUPS) {
      if (group.items.some((i) => i.page === page)) initial[group.key] = true;
    }
    return initial;
  });

  const org = state.orgs.find((o) => o.id === state.currentOrg);
  const project = state.projects.find((p) => p.id === state.currentProject);
  const orgsInScope = state.orgs;
  const projectsInScope = state.projects.filter((p) => p.org === state.currentOrg);

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Azure DevOps">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z"
                fill="#fff"
              />
            </svg>
          </button>
          <span className={styles.wordmark}>Azure DevOps</span>
          <span className={styles.tbSep} />
          <select
            className={styles.tbPill}
            value={state.currentOrg}
            onChange={(e) => {
              dispatch?.({ type: "SWITCH_ORG", orgId: e.target.value });
              onNavigate("overview");
            }}
            title="Switch organization"
          >
            {orgsInScope.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <span className={styles.tbSlash}>/</span>
          <select
            className={styles.tbPill}
            value={state.currentProject}
            onChange={(e) => {
              dispatch?.({ type: "SWITCH_PROJECT", projectId: e.target.value });
              onNavigate("overview");
            }}
            title="Switch project"
          >
            {projectsInScope.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#c8c8c8">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search code, work items, wiki..." />
          </div>
        </div>
        <div className={styles.tbRight}>
          <button type="button" className={styles.tbIconBtn} title="Marketplace">
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path d="M3 4h14v2H3V4zm0 4h14v8H3V8zm2 2v4h10v-4H5z" fill="#fff" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Help">
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path
                d="M10 2a8 8 0 100 16 8 8 0 000-16zm.93 12.412h-1.86V12.55h1.86v1.862zm1.439-5.156c-.526.498-1.198.97-1.198 1.84v.482H9.413v-.65c0-1.078.65-1.66 1.21-2.155.464-.41.798-.706.798-1.246 0-.567-.402-.97-.97-.97-.567 0-.97.403-.97.97H7.673c0-1.366 1.118-2.484 2.484-2.484 1.367 0 2.485 1.118 2.485 2.484 0 .813-.408 1.305-.913 1.729z"
                fill="#fff"
              />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path d="M10 2a4 4 0 00-4 4v3.5L4 12h12l-2-2.5V6a4 4 0 00-4-4zm-2 12a2 2 0 104 0H8z" fill="#fff" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Settings" onClick={() => onNavigate("project-settings")}>
            <svg width="16" height="16" viewBox="0 0 20 20">
              <path
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                fill="#fff"
              />
            </svg>
          </button>
          <div className={styles.tbAvatar} title="admin@itbd.net">
            A
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <nav className={styles.sidebar}>
          <div className={styles.sideProj}>
            <div className={styles.sideProjIcon}>{(project?.name ?? "?").charAt(0).toUpperCase()}</div>
            <div className={styles.sideProjText}>{project?.name ?? "-"}</div>
          </div>

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
