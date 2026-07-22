"use client";

import { type ReactNode, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import styles from "./avd-console.module.css";

export type AvdPage =
  | "home"
  | "host-pools"
  | "session-hosts"
  | "application-groups"
  | "workspaces"
  | "scaling-plans"
  | "msix-packages"
  | "personal-desktops"
  | "fslogix"
  | "rdp-properties"
  | "image-builder"
  | "update-plans"
  | "private-link"
  | "insights"
  | "users";

type NavItem = { page: AvdPage; label: string; icon: string; color: string };

const MANAGE: NavItem[] = [
  { page: "host-pools", label: "Host pools", icon: "HP", color: "#0078d4" },
  { page: "application-groups", label: "Application groups", icon: "AG", color: "#3999c6" },
  { page: "workspaces", label: "Workspaces", icon: "WS", color: "#008272" },
];

const CROSS_POOL: NavItem[] = [
  { page: "session-hosts", label: "Session hosts", icon: "SH", color: "#59b4d9" },
  { page: "personal-desktops", label: "Personal desktops", icon: "PD", color: "#8764b8" },
  { page: "scaling-plans", label: "Scaling plans", icon: "SP", color: "#107c10" },
  { page: "msix-packages", label: "MSIX packages / App attach", icon: "MX", color: "#ca5010" },
];

const MONITORING: NavItem[] = [{ page: "insights", label: "Insights", icon: "IN", color: "#0078d4" }];

const ADVANCED: NavItem[] = [
  { page: "rdp-properties", label: "RDP Properties & networking", icon: "RD", color: "#5c2df5" },
  { page: "image-builder", label: "Image builder", icon: "IB", color: "#e8a33d" },
  { page: "update-plans", label: "Update plans", icon: "UP", color: "#0891b2" },
  { page: "private-link", label: "Private Link", icon: "PL", color: "#a4262c" },
];

const PROFILES: NavItem[] = [{ page: "fslogix", label: "FSLogix profile containers", icon: "FX", color: "#00b7c3" }];

const USERS: NavItem[] = [{ page: "users", label: "Users", icon: "U", color: "#3999c6" }];

function NavIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 2,
        background: color,
        color: "#fff",
        fontSize: 8,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
}

function NavGroup({ heading, items, page, onNavigate }: { heading: string; items: NavItem[]; page: AvdPage; onNavigate: (p: AvdPage) => void }) {
  return (
    <>
      <div className={styles.bladeHeading}>{heading}</div>
      {items.map((item) => (
        <button
          key={item.page}
          type="button"
          className={`${styles.bladeItem} ${page === item.page ? styles.bladeItemActive : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
          onClick={() => onNavigate(item.page)}
        >
          <NavIcon icon={item.icon} color={item.color} />
          {item.label}
        </button>
      ))}
    </>
  );
}

export function AvdShell({
  page,
  breadcrumb,
  onNavigate,
  children,
}: {
  page: AvdPage;
  breadcrumb: { label: string; onClick?: () => void }[];
  onNavigate: (page: AvdPage) => void;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={styles.portalShell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button type="button" className={styles.topbarIconBtn} title="Toggle sidebar" onClick={() => setSidebarOpen((v) => !v)}>
            ☰
          </button>
          <span className={styles.portalText}>Azure Virtual Desktop</span>
        </div>
        <div className={styles.topbarSearch}>
          <input type="text" placeholder="Search resources, services, and docs (G+/)" />
        </div>
        <div className={styles.topbarRight}>
          <button type="button" className={styles.topbarIconBtn} title="Notifications">
            🔔
          </button>
          <button type="button" className={styles.topbarIconBtn} title="Settings">
            ⚙
          </button>
          <div className={styles.userAvatar}>U</div>
        </div>
      </header>

      <div className={styles.portalMain}>
        <AnimatePresence initial={false}>
          {sidebarOpen ? (
            <motion.nav
              className={styles.portalSidebar}
              style={{ overflow: "hidden" }}
              initial={{ width: 0, minWidth: 0, opacity: 0 }}
              animate={{ width: 260, minWidth: 260, opacity: 1 }}
              exit={{ width: 0, minWidth: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className={styles.sidebarNav} style={{ width: 260, overflowY: "auto" }}>
                <button
                  type="button"
                  className={`${styles.bladeItem} ${page === "home" ? styles.bladeItemActive : ""}`}
                  onClick={() => onNavigate("home")}
                >
                  🏠 Overview
                </button>

                <NavGroup heading="Manage" items={MANAGE} page={page} onNavigate={onNavigate} />
                <NavGroup heading="Cross-pool" items={CROSS_POOL} page={page} onNavigate={onNavigate} />
                <NavGroup heading="Monitoring" items={MONITORING} page={page} onNavigate={onNavigate} />
                <NavGroup heading="Advanced" items={ADVANCED} page={page} onNavigate={onNavigate} />
                <NavGroup heading="Profiles (FSLogix)" items={PROFILES} page={page} onNavigate={onNavigate} />
                <NavGroup heading="Users" items={USERS} page={page} onNavigate={onNavigate} />
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>

        <div className={styles.portalContent}>
          <div className={styles.breadcrumb}>
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {i > 0 ? <span className={styles.breadcrumbSep}>&gt;</span> : null}
                {b.onClick ? (
                  <button type="button" className={styles.breadcrumbLink} onClick={b.onClick}>
                    {b.label}
                  </button>
                ) : (
                  <span>{b.label}</span>
                )}
              </span>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
