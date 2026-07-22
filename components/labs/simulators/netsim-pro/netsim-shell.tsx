"use client";

// Portal shell for the NetSim Pro learning-platform simulator: dark
// neumorphic sidebar (7 nav items, one per NetSimTab, each with its own
// accent color + glow) + blurred header showing the active tab name in the
// rotating holographic gradient + content area. Ported from
// itbd-lab/simulators/network/index.html's `.sidebar`/`.header` markup
// (lines 609-666) and its `data-tab`/`data-accent`/`data-accent-glow`
// nav-item convention.
//
// Source drives the active accent by writing `--accent`/`--accent-glow`
// directly onto <html style="..."> per tab (index.html:3) and toggling
// `.nav-item.active` via a global `NetSim.switchTab()`. Here the shell reads
// `state.activeTab`, derives the matching accent pair, and sets them as an
// inline `style` on its own `.root` wrapper (CSS custom properties cascade
// to every descendant exactly like the source's document-level approach,
// without touching global document state) — so `var(--accent)` inside
// netsim-console.module.css (nav active indicator, btn-primary, progress
// rings, etc.) always reflects the current tab.
//
// CLI (the 7th tab) is now a real, fully-wired nav item (sub-phase 4m-v),
// same as every other tab — clicking it dispatches SET_ACTIVE_TAB normally.

import { type ReactNode } from "react";

import type { NetSimState, NetSimTab } from "@/lib/labs/simulators/netsim-pro/types";
import type { NetSimAction } from "@/lib/labs/simulators/netsim-pro/reducer";
import { ToastContainer } from "./netsim-ui";
import styles from "./netsim-console.module.css";

type NavItemDef = {
  tab: NetSimTab;
  label: string;
  icon: string;
  accent: string;
  accentGlow: string;
  disabled?: boolean;
};

// The 7-item nav, in source sidebar order (index.html:610-648). Accent hex
// values are the exact ones specified in the task / present in source's
// `data-accent`/`data-accent-glow` attributes.
const NAV_ITEMS: NavItemDef[] = [
  { tab: "dashboard", label: "Dashboard", icon: "\u{1F3E0}", accent: "#6366f1", accentGlow: "rgba(99,102,241,0.3)" },
  { tab: "learn", label: "Learn", icon: "\u{1F4DA}", accent: "#10b981", accentGlow: "rgba(16,185,129,0.3)" },
  { tab: "topology", label: "Topology Builder", icon: "\u{1F5A7}", accent: "#06b6d4", accentGlow: "rgba(6,182,212,0.3)" },
  { tab: "troubleshoot", label: "Troubleshooting", icon: "\u{1F527}", accent: "#f59e0b", accentGlow: "rgba(245,158,11,0.3)" },
  { tab: "cli", label: "CLI Simulator", icon: "\u{1F4BB}", accent: "#ef4444", accentGlow: "rgba(239,68,68,0.3)" },
  { tab: "scenarios", label: "Scenarios", icon: "\u{1F3AF}", accent: "#8b5cf6", accentGlow: "rgba(139,92,246,0.3)" },
  { tab: "reference", label: "Reference", icon: "\u{1F4D6}", accent: "#ec4899", accentGlow: "rgba(236,72,153,0.3)" },
];

const TAB_LABELS: Record<NetSimTab, string> = {
  dashboard: "Dashboard",
  learn: "Learn",
  topology: "Topology Builder",
  troubleshoot: "Troubleshooting",
  cli: "CLI Simulator",
  scenarios: "Scenarios",
  reference: "Reference",
};

function NavItem({ item, active, onClick }: { item: NavItemDef; active: boolean; onClick: () => void }) {
  const classes = [styles.navItem, active ? styles.navItemActive : "", item.disabled ? styles.navItemDisabled : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      onClick={item.disabled ? undefined : onClick}
      data-tooltip={item.disabled ? "Coming soon" : undefined}
      aria-disabled={item.disabled}
    >
      <span className={styles.navIcon}>{item.icon}</span>
      <span className={styles.navLabel}>{item.label}</span>
    </button>
  );
}

export function NetSimShell({
  state,
  dispatch,
  children,
}: {
  state: NetSimState;
  dispatch: React.Dispatch<NetSimAction>;
  children: ReactNode;
}) {
  const active = NAV_ITEMS.find((n) => n.tab === state.activeTab) ?? NAV_ITEMS[0];

  const handleNavigate = (tab: NetSimTab) => {
    dispatch({ type: "SET_ACTIVE_TAB", tab });
  };

  return (
    <div
      className={styles.root}
      style={
        {
          "--accent": active.accent,
          "--accent-glow": active.accentGlow,
        } as React.CSSProperties
      }
    >
      <div className={styles.bgGrid} />

      <nav className={styles.sidebar}>
        <div className={styles.sidebarLogo} data-tooltip="NetSim Pro">
          NS
        </div>
        <div className={styles.sidebarNav}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.tab} item={item} active={state.activeTab === item.tab} onClick={() => handleNavigate(item.tab)} />
          ))}
        </div>
      </nav>

      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span>&#9889;</span>
          <span className={styles.tabName}>{TAB_LABELS[state.activeTab]}</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.headerBtn}>{active.icon}</div>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.tabContent}>{children}</div>
      </main>

      <ToastContainer />
    </div>
  );
}
