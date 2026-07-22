"use client";

import { type ReactNode, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import styles from "./azure-portal.module.css";

export type AzurePage =
  | "virtual-machines"
  | "resource-groups"
  | "network-security-groups"
  | "app-services"
  | "load-balancers"
  | "virtual-networks"
  | "sql-databases"
  | "storage-accounts"
  | "labs";

const FAVORITES: { page: AzurePage | null; label: string; icon: string; color: string }[] = [
  { page: "virtual-machines", label: "Virtual machines", icon: "VM", color: "#0078d4" },
  { page: "app-services", label: "App Services", icon: "AS", color: "#3999c6" },
  { page: "sql-databases", label: "SQL databases", icon: "DB", color: "#0078d4" },
  { page: "storage-accounts", label: "Storage accounts", icon: "SA", color: "#008272" },
  { page: "virtual-networks", label: "Virtual networks", icon: "VN", color: "#59b4d9" },
  { page: "network-security-groups", label: "Network security groups", icon: "NS", color: "#0078d4" },
  { page: "load-balancers", label: "Load balancers", icon: "LB", color: "#54aef0" },
  { page: null, label: "Key vaults", icon: "KV", color: "#0078d4" },
  { page: null, label: "Defender for Cloud", icon: "DC", color: "#a4262c" },
  { page: null, label: "Network Watcher", icon: "NW", color: "#0891b2" },
];

const IDENTITY: { label: string; icon: string; color: string }[] = [
  { label: "Microsoft Entra ID", icon: "ID", color: "#0078d4" },
  { label: "Privileged Identity Mgmt", icon: "PIM", color: "#5c2df5" },
  { label: "Subscriptions", icon: "S", color: "#e8a33d" },
];

const MONITORING: { label: string; icon: string; color: string }[] = [
  { label: "Monitor", icon: "M", color: "#0078d4" },
  { label: "Activity log", icon: "AL", color: "#3999c6" },
  { label: "Cost analysis", icon: "$", color: "#107c10" },
];

function NotImplementedItem({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <button
      type="button"
      className={styles.bladeItem}
      style={{ display: "flex", alignItems: "center", gap: 10 }}
      onClick={() => toast.info(`${label} isn't in this simulator yet.`)}
    >
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
      {label}
    </button>
  );
}

export function AzurePortalShell({
  page,
  breadcrumb,
  onNavigate,
  children,
}: {
  page: AzurePage | null;
  breadcrumb: { label: string; onClick?: () => void }[];
  onNavigate: (page: AzurePage) => void;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={styles.portalShell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.topbarIconBtn}
            title="Toggle sidebar"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <span className={styles.portalText}>Microsoft Azure</span>
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
              animate={{ width: 250, minWidth: 250, opacity: 1 }}
              exit={{ width: 0, minWidth: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
            <div className={styles.sidebarNav} style={{ width: 250 }}>
              <button
                type="button"
                className={`${styles.bladeItem} ${page === null ? styles.bladeItemActive : ""}`}
                onClick={() => onNavigate("resource-groups")}
              >
                🏠 Home
              </button>
              <button
                type="button"
                className={`${styles.bladeItem} ${page === "labs" ? styles.bladeItemActive : ""}`}
                onClick={() => onNavigate("labs")}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 2,
                    background: "#7719aa",
                    color: "#fff",
                    fontSize: 8,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  L
                </span>
                Labs
              </button>
              <button
                type="button"
                className={`${styles.bladeItem} ${page === "resource-groups" ? styles.bladeItemActive : ""}`}
                onClick={() => onNavigate("resource-groups")}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 2,
                    background: "#3999c6",
                    color: "#fff",
                    fontSize: 8,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  RG
                </span>
                Resource groups
              </button>

              <div className={styles.bladeHeading}>Favorites</div>
              {FAVORITES.map((item) =>
                item.page ? (
                  <button
                    key={item.label}
                    type="button"
                    className={`${styles.bladeItem} ${page === item.page ? styles.bladeItemActive : ""}`}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                    onClick={() => onNavigate(item.page as AzurePage)}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 2,
                        background: item.color,
                        color: "#fff",
                        fontSize: 8,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ) : (
                  <NotImplementedItem key={item.label} label={item.label} icon={item.icon} color={item.color} />
                ),
              )}

              <div className={styles.bladeHeading}>Identity</div>
              {IDENTITY.map((item) => (
                <NotImplementedItem key={item.label} {...item} />
              ))}

              <div className={styles.bladeHeading}>Monitoring</div>
              {MONITORING.map((item) => (
                <NotImplementedItem key={item.label} {...item} />
              ))}
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
