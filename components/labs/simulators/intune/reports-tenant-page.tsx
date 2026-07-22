"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { IntuneState } from "@/lib/labs/simulators/intune/types";
import DefaultButton from "@/components/app_componentes/customButtons";
import { Pill, StatRow } from "./intune-ui";
import styles from "./intune-console.module.css";

const TABS = ["Reports", "Endpoint Analytics", "Connectors and tokens", "Roles and RBAC", "Tenant details"] as const;
type Tab = (typeof TABS)[number];

const REPORTS = [
  { name: "Endpoint analytics", desc: "Startup boot time, app reliability, OS performance scores across the fleet.", category: "Operations" },
  { name: "Device compliance", desc: "Devices vs assigned compliance policies with drill-down by reason.", category: "Compliance" },
  { name: "Device configuration", desc: "Configuration profile success/error per device.", category: "Compliance" },
  { name: "Group Policy migration readiness", desc: "On-prem GPO to Intune Settings Catalog migration assessment.", category: "Migration" },
  { name: "Microsoft Defender", desc: "AV signature freshness, threat detections, ASR rule hits per device.", category: "Security" },
  { name: "Cloud-attached devices", desc: "ConfigMgr clients tenant-attached for cloud visibility.", category: "Co-management" },
  { name: "Device inventory", desc: "Hardware, OS and installed app inventory across the fleet.", category: "Operations" },
  { name: "Endpoint security", desc: "Security baseline conformance, EDR onboarding status, encryption and firewall.", category: "Security" },
  { name: "Apps install status", desc: "App deployment success/failure across users and devices.", category: "Apps" },
  { name: "Service health", desc: "Intune service incidents, advisories, planned maintenance.", category: "Operations" },
  { name: "Audit logs", desc: "Admin actions: who created, modified or deleted what and when.", category: "Audit" },
  { name: "Account health", desc: "Apple MDM push, VPP, ADE token and Android Enterprise connector status.", category: "Operations" },
];

const EPA_CATEGORIES = [
  { name: "Startup performance", score: 82, baseline: 74 },
  { name: "Application reliability", score: 88, baseline: 78 },
  { name: "Resource performance", score: 71, baseline: 70 },
  { name: "Work from anywhere", score: 68, baseline: 72 },
];

const CONNECTORS: { name: string; status: "Healthy" | "Warning"; expires: string; desc: string }[] = [
  { name: "Apple MDM Push certificate", status: "Healthy", expires: "2026-11-22", desc: "Required for iOS/macOS enrollment; renew annually." },
  { name: "Apple VPP token", status: "Healthy", expires: "2026-09-14", desc: "Deploys paid and free App Store apps." },
  { name: "Apple ADE / ABM token", status: "Healthy", expires: "2026-10-08", desc: "Automated Device Enrollment via Apple Business Manager." },
  { name: "Android Enterprise", status: "Healthy", expires: "N/A (auto-renews)", desc: "Managed Google Play account for AE deployment." },
  { name: "Microsoft Defender for Endpoint", status: "Healthy", expires: "N/A", desc: "MDE to Intune device-risk score sync." },
  { name: "Certificate connector (NDES)", status: "Warning", expires: "N/A", desc: "On-prem CA issues SCEP certs to managed devices; last check-in 6 hours ago." },
];

const ROLES = [
  { name: "Application Manager", desc: "Manage apps and app protection policies. Cannot manage devices.", members: 12 },
  { name: "Endpoint Security Manager", desc: "Manage Defender baselines, encryption, ASR and EDR. Cannot manage apps.", members: 4 },
  { name: "Help Desk Operator", desc: "Reset PINs, run remote actions on non-admin devices.", members: 24 },
  { name: "Policy and Profile Manager", desc: "Create and edit compliance and configuration policies. Cannot assign roles.", members: 8 },
  { name: "Read Only Operator", desc: "View-only access for auditors and monitoring.", members: 18 },
  { name: "School Administrator", desc: "Manage Windows for Education and Take a Test profiles.", members: 3 },
];

export function ReportsTenantPage({ state }: { state: IntuneState }) {
  const [tab, setTab] = useState<Tab>("Reports");

  return (
    <div>
      <h1 className={styles.pageH1}>Reports and tenant administration</h1>
      <p className={styles.pageSub}>Report catalog, Endpoint Analytics, connectors and tokens, RBAC roles and tenant details.</p>

      <div className={styles.subtabs}>
        {TABS.map((t) => (
          <button key={t} type="button" className={`${styles.subtab} ${tab === t ? styles.subtabActive : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Reports" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Report</th>
                <th>Description</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {REPORTS.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className={styles.muted}>{r.desc}</td>
                  <td>{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Endpoint Analytics" && (
        <>
          <StatRow stats={[{ label: "Endpoint analytics score", value: 78 }, { label: "Microsoft baseline", value: 74 }, { label: "Industry peer average", value: 76 }]} />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Your score</th>
                  <th>Microsoft baseline</th>
                </tr>
              </thead>
              <tbody>
                {EPA_CATEGORIES.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.score}</td>
                    <td>{c.baseline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "Connectors and tokens" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Connector / token</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {CONNECTORS.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>
                    <Pill tone={c.status === "Healthy" ? "ok" : "warn"}>{c.status}</Pill>
                  </td>
                  <td>{c.expires}</td>
                  <td className={styles.muted}>{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Roles and RBAC" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className={styles.muted}>{r.desc}</td>
                  <td>{r.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Tenant details" && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td className={styles.muted}>Tenant name</td>
                  <td>{state.tenant.name}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Domain</td>
                  <td>{state.tenant.domain}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Tenant ID</td>
                  <td>{state.tenant.tenantId}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Country / region</td>
                  <td>{state.tenant.country}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Admin email</td>
                  <td>{state.tenant.adminEmail}</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Enrolled devices</td>
                  <td>{state.devices.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14 }}>
            <DefaultButton onClick={() => toast.success("Simulator data reset (demo only).")}>Reset simulator data</DefaultButton>
          </div>
        </>
      )}
    </div>
  );
}
