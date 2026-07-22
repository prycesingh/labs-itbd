"use client";

import { useState } from "react";

import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { AppServiceResource, ConnectionString } from "@/lib/labs/simulators/azure/appServiceTypes";
import styles from "./azure-portal.module.css";
import { SecActivity, SecDiagnose, SecIAM, SecOverview, SecTags } from "./appservice-sections-core";
import { SecCORS, SecAppServiceLogs, SecLogs, SecMetrics } from "./appservice-sections-api";
import { SecConfiguration, SecDeployCenter, SecSlots } from "./appservice-sections-deployment";
import { SecScaleOut, SecScaleUp } from "./appservice-sections-scale";
import {
  SecAppInsights,
  SecAuth,
  SecBackups,
  SecCustomDomains,
  SecEnvVars,
  SecIdentity,
  SecNetworking,
  SecTLS,
} from "./appservice-sections-settings";
import { SecPlaceholder } from "./sec-placeholder";

const SECTIONS = [
  {
    group: "",
    items: [
      { id: "overview", label: "Overview" },
      { id: "activity", label: "Activity log" },
      { id: "iam", label: "Access control (IAM)" },
      { id: "tags", label: "Tags" },
      { id: "diagnose", label: "Diagnose and solve problems" },
    ],
  },
  {
    group: "Deployment",
    items: [
      { id: "deploycenter", label: "Deployment Center" },
      { id: "slots", label: "Deployment slots" },
      { id: "configuration", label: "Configuration" },
    ],
  },
  {
    group: "Settings",
    items: [
      { id: "envvars", label: "Environment variables" },
      { id: "auth", label: "Authentication" },
      { id: "appinsights", label: "Application Insights" },
      { id: "identity", label: "Identity" },
      { id: "backups", label: "Backups" },
      { id: "customdom", label: "Custom domains" },
      { id: "tls", label: "TLS/SSL settings" },
      { id: "networking", label: "Networking" },
      { id: "scaleup", label: "Scale up (App Service plan)" },
      { id: "scaleout", label: "Scale out (App Service plan)" },
    ],
  },
  {
    group: "API",
    items: [
      { id: "apim", label: "API Management" },
      { id: "apidef", label: "API definition" },
      { id: "cors", label: "CORS" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "alerts", label: "Alerts" },
      { id: "metrics", label: "Metrics" },
      { id: "logs", label: "Logs" },
      { id: "asLogs", label: "App Service logs" },
    ],
  },
  {
    group: "Support",
    items: [
      { id: "health", label: "Resource health" },
      { id: "support", label: "New support request" },
    ],
  },
] as const;

export function AppServiceDetailBlade({
  app,
  activityLog,
  onBack,
  onSetStatus,
  onDelete,
  onAddTag,
  onDeleteTag,
  onChangeTier,
  onSetInstances,
  onAddSetting,
  onDeleteSetting,
  onAddConnectionString,
  onDeleteConnectionString,
  onAddSlot,
  onDeleteSlot,
  onAddDomain,
  onDeleteDomain,
  onAddCorsOrigin,
  onDeleteCorsOrigin,
  onToggleAppInsights,
}: {
  app: AppServiceResource;
  activityLog: ActivityLogEntry[];
  onBack: () => void;
  onSetStatus: (status: "Running" | "Stopped") => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onChangeTier: (tierId: string) => void;
  onSetInstances: (instances: number, log: boolean) => void;
  onAddSetting: (key: string, value: string) => void;
  onDeleteSetting: (key: string) => void;
  onAddConnectionString: (cs: ConnectionString) => void;
  onDeleteConnectionString: (index: number) => void;
  onAddSlot: (name: string) => void;
  onDeleteSlot: (name: string) => void;
  onAddDomain: (domain: string) => void;
  onDeleteDomain: (domain: string) => void;
  onAddCorsOrigin: (origin: string) => void;
  onDeleteCorsOrigin: (index: number) => void;
  onToggleAppInsights: (enabled: boolean) => void;
}) {
  const [section, setSection] = useState("overview");

  function renderSection() {
    switch (section) {
      case "overview":
        return <SecOverview app={app} onEditTags={() => setSection("tags")} />;
      case "activity":
        return <SecActivity app={app} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags app={app} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "deploycenter":
        return <SecDeployCenter app={app} />;
      case "slots":
        return <SecSlots app={app} onAdd={onAddSlot} onDelete={onDeleteSlot} />;
      case "configuration":
        return (
          <SecConfiguration
            app={app}
            onAddSetting={onAddSetting}
            onDeleteSetting={onDeleteSetting}
            onAddConnectionString={onAddConnectionString}
            onDeleteConnectionString={onDeleteConnectionString}
          />
        );
      case "envvars":
        return <SecEnvVars app={app} onAdd={onAddSetting} onDelete={onDeleteSetting} />;
      case "auth":
        return <SecAuth />;
      case "appinsights":
        return <SecAppInsights app={app} onToggle={onToggleAppInsights} />;
      case "identity":
        return <SecIdentity />;
      case "backups":
        return <SecBackups app={app} />;
      case "customdom":
        return <SecCustomDomains app={app} onAdd={onAddDomain} onDelete={onDeleteDomain} />;
      case "tls":
        return <SecTLS app={app} />;
      case "networking":
        return <SecNetworking app={app} />;
      case "scaleup":
        return <SecScaleUp app={app} onChangeTier={onChangeTier} />;
      case "scaleout":
        return <SecScaleOut app={app} onSetInstances={onSetInstances} />;
      case "apim":
        return <SecPlaceholder title="API Management" desc="Publish APIs to developers, partners, and employees securely." />;
      case "apidef":
        return <SecPlaceholder title="API definition" desc="Import an OpenAPI / Swagger definition for your app." />;
      case "cors":
        return <SecCORS app={app} onAdd={onAddCorsOrigin} onDelete={onDeleteCorsOrigin} />;
      case "alerts":
        return <SecPlaceholder title="Alerts" desc="Set up alert rules based on metrics, activity logs, or service health." />;
      case "metrics":
        return <SecMetrics />;
      case "logs":
        return <SecLogs />;
      case "asLogs":
        return <SecAppServiceLogs />;
      case "health":
        return <SecPlaceholder title="Resource health" desc="View the current and historical health of this App Service." />;
      case "support":
        return <SecPlaceholder title="New support request" desc="Open a Microsoft support ticket for this resource." />;
      default:
        return <SecOverview app={app} onEditTags={() => setSection("tags")} />;
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>App</div>
        <div style={{ flex: 1 }}>
          <h1>{app.name}</h1>
          <p className={styles.bladeSub}>App Service</p>
        </div>
        <div className={styles.bladeActions}>
          <a href={app.defaultUrl} target="_blank" rel="noreferrer" className={styles.actBtn}>
            ↗ Browse
          </a>
          {app.status === "Running" ? (
            <button type="button" className={styles.actBtn} onClick={() => onSetStatus("Stopped")}>
              ■ Stop
            </button>
          ) : (
            <button type="button" className={styles.actBtn} onClick={() => onSetStatus("Running")}>
              ▶ Start
            </button>
          )}
          <button type="button" className={styles.actBtn} onClick={() => onSetStatus("Running")}>
            ↻ Restart
          </button>
          <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={onDelete}>
            🗑 Delete
          </button>
        </div>
      </div>

      <div className={styles.bladeFrame}>
        <aside className={styles.bladeNav}>
          {SECTIONS.map((grp) => (
            <div key={grp.group || "root"}>
              {grp.group ? <div className={styles.bladeHeading}>{grp.group}</div> : null}
              {grp.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`${styles.bladeItem} ${section === item.id ? styles.bladeItemActive : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main className={styles.bladeMain}>{renderSection()}</main>
      </div>
    </div>
  );
}
