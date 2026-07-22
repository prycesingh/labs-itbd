"use client";

// Portal shell for the Microsoft Defender XDR simulator: topbar (search,
// notifications, help, settings, avatar) + grouped/collapsible sidebar +
// content area. Ported from itbd-lab/simulators/defender/js/defender-portal.js
// renderTopBar()/renderSidebar()/navGroup() — routing itself (the renderPage
// switch in the source) is NOT this component's job; that lives in the page
// container that owns `page` state and renders the matching page component
// into `children`. This component only owns sidebar-group expand/collapse
// UI state, matching the source's `navOpen` map.

import { useState, type ReactNode } from "react";

import styles from "./defender-console.module.css";

// ===== Page union =====
// Naming convention: kebab-case page ids, grouped by nav section prefix
// (e.g. `email-*`, `cloudapps-*`, `itdr-*`, `endpoints-*`) so page-building
// agents can grep a section at once. Every page below has exactly one slot;
// do not add ad-hoc pages outside this union — extend it here first.
export type DefenderPage =
  | "home"
  | "incidents"
  | "alerts"
  | "hunting"
  | "custom-detection"
  | "endpoints-devices"
  | "endpoints-vuln-mgmt"
  | "endpoints-asset-inventory"
  | "identities"
  | "secure-score"
  | "email-explorer"
  | "email-campaigns"
  | "email-submissions"
  | "email-attack-sim"
  | "email-threat-tracker"
  | "email-investigations"
  | "email-policies"
  | "email-tenant-allow-block"
  | "email-quarantine"
  | "email-threat-explorer"
  | "itdr-posture"
  | "itdr-lateral-movement"
  | "itdr-honeytokens"
  | "cloudapps-discovered"
  | "cloudapps-oauth"
  | "cloudapps-connectors"
  | "cloudapps-session-policies"
  | "permissions"
  | "threat-analytics"
  | "action-center"
  | "reports"
  | "settings"
  | "learning-hub"
  | "more-resources";

type NavLeaf = { page: DefenderPage; label: string };
type NavGroup = { key: string; label: string; icon: IconName; children: NavLeaf[] };
type NavEntry = { kind: "item"; page: DefenderPage; label: string; icon: IconName } | { kind: "group"; group: NavGroup } | { kind: "divider" } | { kind: "section"; label: string };

// Sidebar structure ported from defender-portal.js renderSidebar(), expanded to
// cover the full page set confirmed in the functional spec (email/cloud-apps/
// ITDR subsections are grouped, matching the source's `.df-nav-sub` pattern).
const NAV: NavEntry[] = [
  { kind: "item", page: "home", label: "Home", icon: "home" },
  {
    kind: "group",
    group: {
      key: "incidents",
      label: "Incidents & alerts",
      icon: "shield",
      children: [
        { page: "incidents", label: "Incidents" },
        { page: "alerts", label: "Alerts" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "hunting",
      label: "Hunting",
      icon: "search",
      children: [
        { page: "hunting", label: "Advanced hunting" },
        { page: "custom-detection", label: "Custom detection rules" },
      ],
    },
  },
  { kind: "item", page: "action-center", label: "Action center", icon: "flag" },
  { kind: "item", page: "threat-analytics", label: "Threat analytics", icon: "graph" },
  { kind: "item", page: "secure-score", label: "Secure score", icon: "star" },
  { kind: "item", page: "learning-hub", label: "Learning hub", icon: "book" },
  { kind: "divider" },
  { kind: "section", label: "Assets" },
  {
    kind: "group",
    group: {
      key: "endpoints",
      label: "Endpoints",
      icon: "pc",
      children: [
        { page: "endpoints-devices", label: "Device inventory" },
        { page: "endpoints-vuln-mgmt", label: "Vulnerability management" },
        { page: "endpoints-asset-inventory", label: "Asset inventory" },
      ],
    },
  },
  { kind: "item", page: "identities", label: "Identities", icon: "user" },
  {
    kind: "group",
    group: {
      key: "itdr",
      label: "ITDR posture",
      icon: "shield",
      children: [
        { page: "itdr-posture", label: "Posture" },
        { page: "itdr-lateral-movement", label: "Lateral movement paths" },
        { page: "itdr-honeytokens", label: "Honeytokens" },
      ],
    },
  },
  { kind: "divider" },
  {
    kind: "group",
    group: {
      key: "email",
      label: "Email & collaboration",
      icon: "mail",
      children: [
        { page: "email-investigations", label: "Investigations" },
        { page: "email-explorer", label: "Explorer" },
        { page: "email-threat-explorer", label: "Threat Explorer" },
        { page: "email-campaigns", label: "Campaigns" },
        { page: "email-threat-tracker", label: "Threat tracker" },
        { page: "email-submissions", label: "Submissions" },
        { page: "email-policies", label: "Policies & rules" },
        { page: "email-tenant-allow-block", label: "Tenant Allow/Block List" },
        { page: "email-quarantine", label: "Quarantine" },
        { page: "email-attack-sim", label: "Attack simulation training" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "cloudapps",
      label: "Cloud apps",
      icon: "cloud",
      children: [
        { page: "cloudapps-discovered", label: "Discovered apps" },
        { page: "cloudapps-oauth", label: "OAuth apps" },
        { page: "cloudapps-connectors", label: "Connectors" },
        { page: "cloudapps-session-policies", label: "Session policies" },
      ],
    },
  },
  { kind: "item", page: "reports", label: "Reports", icon: "chart" },
  { kind: "item", page: "permissions", label: "Permissions & roles", icon: "key" },
  { kind: "item", page: "settings", label: "Settings", icon: "gear" },
  { kind: "item", page: "more-resources", label: "More resources", icon: "more" },
];

type IconName = "home" | "shield" | "search" | "flag" | "graph" | "star" | "book" | "box" | "user" | "pc" | "mail" | "cloud" | "chart" | "key" | "gear" | "more";

function NavIcon({ name }: { name: IconName }) {
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M8 1l7 6h-2v7h-4v-4H7v4H3V7H1l7-6z" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M8 1L2 3v5c0 3.5 2.5 6.5 6 7 3.5-.5 6-3.5 6-7V3L8 1z" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M11.7 10.3a6.5 6.5 0 10-1.4 1.4l3.8 3.8a1 1 0 001.4-1.4l-3.8-3.8zm-5.2.2a5 5 0 110-10 5 5 0 010 10z" />
        </svg>
      );
    case "flag":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M3 1v14h1V9h9l-2-3 2-3H4V1H3z" />
        </svg>
      );
    case "graph":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <circle cx="3" cy="3" r="2" />
          <circle cx="13" cy="3" r="2" />
          <circle cx="8" cy="13" r="2" />
          <path stroke="currentColor" strokeWidth="1.2" fill="none" d="M3 3l10 0M3 3l5 10M13 3l-5 10" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M8 1l2.2 4.5L15 6l-3.6 3.4.9 5L8 12l-4.3 2.4.9-5L1 6l4.8-.5L8 1z" />
        </svg>
      );
    case "book":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M2 2h5a2 2 0 012 2v10a2 2 0 00-2-2H2V2zm12 0H9a2 2 0 00-2 2v10a2 2 0 012-2h5V2z" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M2 4l6-2 6 2v8l-6 2-6-2V4zm6 0L2 5.5M14 5.5L8 4M8 4v10" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <circle cx="8" cy="5" r="3" />
          <path d="M2 14c0-3 3-5 6-5s6 2 6 5" />
        </svg>
      );
    case "pc":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" width="14" height="14">
          <rect x="1" y="2" width="14" height="9" rx="1" />
          <path d="M6 14h4M8 11v3" />
        </svg>
      );
    case "mail":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" width="14" height="14">
          <rect x="1" y="3" width="14" height="10" rx="1" />
          <path d="M1 4l7 5 7-5" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M4 12a3 3 0 010-6 4 4 0 017.5-1A3 3 0 0114 11a3 3 0 01-3 1H4z" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" width="14" height="14">
          <path d="M2 14V2M2 14h12M5 11V7M8 11V4M11 11V8" />
        </svg>
      );
    case "key":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" width="14" height="14">
          <circle cx="5" cy="8" r="3" />
          <path d="M8 8h7l-2 2M11 8v3" />
        </svg>
      );
    case "gear":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" width="14" height="14">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
        </svg>
      );
    case "more":
    default:
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      );
  }
}

function groupContainsPage(group: NavGroup, page: DefenderPage): boolean {
  return group.children.some((c) => c.page === page);
}

function defaultOpenGroups(page: DefenderPage): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  for (const entry of NAV) {
    if (entry.kind === "group") {
      open[entry.group.key] = groupContainsPage(entry.group, page);
    }
  }
  return open;
}

export function DefenderShell({ page, onNavigate, children }: { page: DefenderPage; onNavigate: (p: DefenderPage) => void; children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => defaultOpenGroups(page));

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Microsoft apps">
            <svg width="18" height="18" viewBox="0 0 16 16">
              {[1, 6, 11].flatMap((x) => [1, 6, 11].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill="#fff" />))}
            </svg>
          </button>
          <span className={styles.wordmark}>
            <span className={styles.wordmarkAccent}>&#9650;</span>
            Microsoft Defender
          </span>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#c0c0c0">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search incidents, devices, users, files, URLs" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className={styles.tbRight}>
          <button type="button" className={styles.tbIconBtn} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button type="button" className={styles.tbIconBtn} title="Help">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff">
              <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" />
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
        <nav className={styles.sidebar}>
          {NAV.map((entry, i) => {
            if (entry.kind === "divider") return <div key={`div-${i}`} className={styles.navDivider} />;
            if (entry.kind === "section") return (
              <div key={`sec-${i}`} className={styles.navSection}>
                {entry.label}
              </div>
            );
            if (entry.kind === "item") {
              const active = page === entry.page;
              return (
                <div
                  key={entry.page}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                  onClick={() => onNavigate(entry.page)}
                >
                  <span className={styles.navIco}>
                    <NavIcon name={entry.icon} />
                  </span>
                  <span>{entry.label}</span>
                </div>
              );
            }
            const group = entry.group;
            const isOpen = !!openGroups[group.key];
            const anyActive = groupContainsPage(group, page);
            return (
              <div key={group.key}>
                <div
                  className={`${styles.navItem} ${anyActive ? styles.navItemActive : ""}`}
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className={styles.navIco}>
                    <NavIcon name={group.icon} />
                  </span>
                  <span>{group.label}</span>
                  <span className={`${styles.navChev} ${isOpen ? styles.navChevOpen : ""}`}>&#9656;</span>
                </div>
                <div className={`${styles.navSub} ${isOpen ? styles.navSubOpen : ""}`}>
                  {group.children.map((child) => (
                    <div
                      key={child.page}
                      className={`${styles.navItem} ${page === child.page ? styles.navItemActive : ""}`}
                      onClick={() => onNavigate(child.page)}
                    >
                      <span>{child.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
