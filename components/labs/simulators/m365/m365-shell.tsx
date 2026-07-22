"use client";

import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import styles from "./m365-console.module.css";

export type M365Page =
  | "home"
  | "users-active"
  | "users-deleted"
  | "groups-active"
  | "groups-shared-mailbox"
  | "licenses"
  | "domains"
  | "setup"
  | "reports"
  | "roles"
  | "security"
  | "exchange"
  | "sharepoint"
  | "teams"
  | "apps-deploy";

const SIDEBAR_GROUPS: { key: string; label: string; children: { page: M365Page; label: string }[] }[] = [
  {
    key: "users",
    label: "Users",
    children: [
      { page: "users-active", label: "Active users" },
      { page: "users-deleted", label: "Deleted users" },
    ],
  },
  {
    key: "teamsGroups",
    label: "Teams & groups",
    children: [
      { page: "groups-active", label: "Active teams & groups" },
      { page: "groups-shared-mailbox", label: "Shared mailboxes" },
    ],
  },
  {
    key: "billing",
    label: "Billing",
    children: [{ page: "licenses", label: "Licenses" }],
  },
];

const STANDALONE_ITEMS: { page: M365Page; label: string }[] = [
  { page: "domains", label: "Domains" },
  { page: "setup", label: "Setup" },
  { page: "reports", label: "Reports" },
  { page: "roles", label: "Roles & admins" },
  { page: "security", label: "Security & Identity" },
];

const ADMIN_CENTER_ITEMS: { page: M365Page; label: string }[] = [
  { page: "exchange", label: "Exchange" },
  { page: "sharepoint", label: "SharePoint" },
  { page: "teams", label: "Teams" },
  { page: "apps-deploy", label: "Apps deployment" },
];

const EXTERNAL_ITEMS = ["Defender", "Compliance", "Endpoint Manager", "Entra ID"];

export function M365Shell({ current, onNavigate, children }: { current: M365Page; onNavigate: (page: M365Page) => void; children: ReactNode }) {
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>({ users: true, teamsGroups: true, billing: false });

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Microsoft apps">
            <svg width="18" height="18" viewBox="0 0 16 16">
              {[1, 6, 11].flatMap((x) => [1, 6, 11].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill="#fff" />))}
            </svg>
          </button>
          <span className={styles.wordmark}>Microsoft 365 admin center</span>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#c8c8c8">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search for users, groups, settings or tasks" />
          </div>
        </div>
        <div className={styles.tbRight}>
          <button type="button" className={styles.tbIconBtn} title="Help" onClick={() => toast.info("This is a training simulator modeled on admin.microsoft.com.")}>
            ?
          </button>
          <button type="button" className={styles.tbIconBtn} title="Settings" onClick={() => toast.info("Settings aren't wired up in this simulator.")}>
            ⚙
          </button>
          <div className={styles.tbAvatar} title="admin@cloudlab.onmicrosoft.com">
            A
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <nav className={styles.sidebar}>
          <div className={`${styles.navItem} ${current === "home" ? styles.navItemActive : ""}`} onClick={() => onNavigate("home")}>
            <span>Home</span>
          </div>

          {SIDEBAR_GROUPS.map((group) => {
            const open = !!navOpen[group.key];
            const active = group.children.some((c) => c.page === current);
            return (
              <div key={group.key}>
                <div
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                  onClick={() => setNavOpen((n) => ({ ...n, [group.key]: !n[group.key] }))}
                >
                  <span>{group.label}</span>
                  <span className={`${styles.navChev} ${open ? styles.navChevOpen : ""}`}>▶</span>
                </div>
                {open ? (
                  <div className={styles.navSub}>
                    {group.children.map((c) => (
                      <div key={c.page} className={`${styles.navItem} ${current === c.page ? styles.navItemActive : ""}`} onClick={() => onNavigate(c.page)}>
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {STANDALONE_ITEMS.map((item) => (
            <div key={item.page} className={`${styles.navItem} ${current === item.page ? styles.navItemActive : ""}`} onClick={() => onNavigate(item.page)}>
              <span>{item.label}</span>
            </div>
          ))}

          <div className={styles.navDivider} />
          <div className={styles.navSection}>Admin centers</div>
          {ADMIN_CENTER_ITEMS.map((item) => (
            <div key={item.page} className={`${styles.navItem} ${current === item.page ? styles.navItemActive : ""}`} onClick={() => onNavigate(item.page)}>
              <span>{item.label}</span>
            </div>
          ))}
          {EXTERNAL_ITEMS.map((label) => (
            <div key={label} className={styles.navItem} onClick={() => toast.info(`${label} admin center opens in new window in real M365 — sim only.`)}>
              <span>{label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#605e5c" }}>↗</span>
            </div>
          ))}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
