"use client";

import { useState } from "react";
import { toast } from "sonner";

import styles from "./intune-console.module.css";

export type IntunePage =
  | "home"
  | "devices-all"
  | "compliance-policies"
  | "config-profiles"
  | "apps-all"
  | "conditional-access"
  | "autopilot"
  | "endpoint-security"
  | "app-protection"
  | "update-rings"
  | "reports-tenant"
  | "tunnel"
  | "users"
  | "groups"
  | "tenant-admin";

const SIDEBAR_ITEMS: { page: IntunePage; label: string }[] = [
  { page: "home", label: "Home" },
  { page: "devices-all", label: "Devices" },
  { page: "compliance-policies", label: "Compliance policies" },
  { page: "config-profiles", label: "Configuration profiles" },
  { page: "apps-all", label: "Apps" },
  { page: "endpoint-security", label: "Endpoint security" },
  { page: "conditional-access", label: "Conditional Access" },
  { page: "autopilot", label: "Windows Autopilot" },
  { page: "reports-tenant", label: "Reports" },
  { page: "users", label: "Users" },
  { page: "groups", label: "Groups" },
  { page: "tenant-admin", label: "Tenant administration" },
];

export function IntuneShell({ current, onNavigate, children }: { current: IntunePage; onNavigate: (page: IntunePage) => void; children: React.ReactNode }) {
  const [query, setQuery] = useState("");

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.tbLeft}>
          <button type="button" className={styles.tbIconBtn} title="Microsoft apps">
            <svg width="18" height="18" viewBox="0 0 16 16">
              {[1, 6, 11].flatMap((x) => [1, 6, 11].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill="#fff" />))}
            </svg>
          </button>
          <span className={styles.wordmark}>Microsoft Intune admin center</span>
        </div>
        <div className={styles.tbCenter}>
          <div className={styles.tbSearch}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#c8c8c8">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z" />
            </svg>
            <input type="text" placeholder="Search devices, apps, users" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className={styles.tbRight}>
          <button type="button" className={styles.tbIconBtn} title="Help" onClick={() => toast.info("This is a training simulator modeled on endpoint.microsoft.com.")}>
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
          {SIDEBAR_ITEMS.map((item) => (
            <div key={item.page} className={`${styles.navItem} ${current === item.page ? styles.navItemActive : ""}`} onClick={() => onNavigate(item.page)}>
              <span>{item.label}</span>
            </div>
          ))}
          <div className={styles.navDivider} />
          <div className={styles.navSection}>Reference</div>
          <div className={`${styles.navItem} ${current === "app-protection" ? styles.navItemActive : ""}`} onClick={() => onNavigate("app-protection")}>
            <span>App protection (MAM)</span>
          </div>
          <div className={`${styles.navItem} ${current === "update-rings" ? styles.navItemActive : ""}`} onClick={() => onNavigate("update-rings")}>
            <span>Windows Update rings</span>
          </div>
          <div className={`${styles.navItem} ${current === "tunnel" ? styles.navItemActive : ""}`} onClick={() => onNavigate("tunnel")}>
            <span>Microsoft Tunnel</span>
          </div>
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
