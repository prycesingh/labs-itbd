"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { SqlAlertRule, SqlDiagSetting, SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";
import { SecActivity, SecDiagnose, SecIAM, SecLocks, SecOverview, SecProperties, SecQuickStart, SecTags } from "./sql-sections-core";
import { SecBackups, SecCompute, SecConnStrings, SecExport, SecFailoverGroups, SecGeoReplication, SecImportHistory } from "./sql-sections-settings";
import { SecAlwaysEncrypted, SecAuditing, SecClassify, SecDefender, SecDynamicMask, SecLedger, SecTde } from "./sql-sections-security";
import { SecAlerts, SecAutoTune, SecDiagSettings, SecInsights, SecLogs, SecMetrics, SecPerfOverview, SecPerfRecs, SecQpi } from "./sql-sections-performance";
import { SecQueryEditor } from "./sql-sections-queryeditor";
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
      { id: "quickstart", label: "Quick start" },
    ],
  },
  {
    group: "Settings",
    items: [
      { id: "compute", label: "Compute + storage" },
      { id: "connstrings", label: "Connection strings" },
      { id: "georepl", label: "Geo-Replication" },
      { id: "failover", label: "Failover groups" },
      { id: "properties", label: "Properties" },
      { id: "locks", label: "Locks" },
    ],
  },
  {
    group: "Data management",
    items: [
      { id: "backups", label: "Backups" },
      { id: "export", label: "Export" },
      { id: "importhistory", label: "Import / Export history" },
    ],
  },
  {
    group: "Security",
    items: [
      { id: "auditing", label: "Auditing" },
      { id: "defender", label: "Microsoft Defender for SQL" },
      { id: "tde", label: "Transparent data encryption" },
      { id: "ledger", label: "Ledger" },
      { id: "dynamicmask", label: "Dynamic Data Masking" },
      { id: "classify", label: "Data Discovery & Classification" },
      { id: "alwaysencr", label: "Always Encrypted" },
    ],
  },
  {
    group: "Intelligent Performance",
    items: [
      { id: "perfoverview", label: "Performance overview" },
      { id: "qpi", label: "Query Performance Insight" },
      { id: "perfrecs", label: "Performance recommendations" },
      { id: "autotune", label: "Automatic tuning" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "insights", label: "Insights" },
      { id: "alerts", label: "Alerts" },
      { id: "metrics", label: "Metrics" },
      { id: "diagsettings", label: "Diagnostic settings" },
      { id: "logs", label: "Logs" },
    ],
  },
  {
    group: "Tools",
    items: [{ id: "queryeditor", label: "Query editor" }],
  },
] as const;

export function SqlDetailBlade({
  sql,
  activityLog,
  onBack,
  onDelete,
  onAddTag,
  onDeleteTag,
  onChangeTier,
  onSaveLtr,
  onToggleAudit,
  onSetAuditRetention,
  onToggleDefender,
  onSetTde,
  onAddAlertRule,
  onToggleAlertRule,
  onDeleteAlertRule,
  onAddDiagSetting,
  onDeleteDiagSetting,
}: {
  sql: SqlResource;
  activityLog: ActivityLogEntry[];
  onBack: () => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onChangeTier: (model: "DTU" | "vCore", tierId: string) => void;
  onSaveLtr: (weekly: number, monthly: number, yearly: number) => void;
  onToggleAudit: (enabled: boolean) => void;
  onSetAuditRetention: (days: number) => void;
  onToggleDefender: () => void;
  onSetTde: (option: SqlResource["tdeOption"]) => void;
  onAddAlertRule: (rule: Omit<SqlAlertRule, "id">) => void;
  onToggleAlertRule: (index: number) => void;
  onDeleteAlertRule: (index: number) => void;
  onAddDiagSetting: (setting: Omit<SqlDiagSetting, "id">) => void;
  onDeleteDiagSetting: (index: number) => void;
}) {
  const [section, setSection] = useState("overview");

  function renderSection() {
    switch (section) {
      case "overview":
        return <SecOverview sql={sql} onOpenConnStrings={() => setSection("connstrings")} onEditTags={() => setSection("tags")} />;
      case "activity":
        return <SecActivity sql={sql} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags sql={sql} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "quickstart":
        return <SecQuickStart sql={sql} onOpenQueryEditor={() => setSection("queryeditor")} onOpenConnStrings={() => setSection("connstrings")} />;
      case "compute":
        return <SecCompute sql={sql} onChangeTier={onChangeTier} />;
      case "connstrings":
        return <SecConnStrings sql={sql} />;
      case "georepl":
        return <SecGeoReplication />;
      case "failover":
        return <SecFailoverGroups />;
      case "properties":
        return <SecProperties sql={sql} subscriptionId={SUBSCRIPTION.id} />;
      case "locks":
        return <SecLocks />;
      case "backups":
        return <SecBackups sql={sql} onSaveLtr={onSaveLtr} />;
      case "export":
        return <SecExport sql={sql} />;
      case "importhistory":
        return <SecImportHistory />;
      case "auditing":
        return <SecAuditing sql={sql} onToggle={onToggleAudit} onSetRetention={onSetAuditRetention} />;
      case "defender":
        return <SecDefender sql={sql} onToggle={onToggleDefender} />;
      case "tde":
        return <SecTde sql={sql} onSetTde={onSetTde} />;
      case "ledger":
        return <SecLedger sql={sql} />;
      case "dynamicmask":
        return <SecDynamicMask />;
      case "classify":
        return <SecClassify />;
      case "alwaysencr":
        return <SecAlwaysEncrypted />;
      case "perfoverview":
        return <SecPerfOverview />;
      case "qpi":
        return <SecQpi />;
      case "perfrecs":
        return <SecPerfRecs />;
      case "autotune":
        return <SecAutoTune />;
      case "insights":
        return <SecInsights />;
      case "alerts":
        return <SecAlerts sql={sql} onAdd={onAddAlertRule} onToggle={onToggleAlertRule} onDelete={onDeleteAlertRule} />;
      case "metrics":
        return <SecMetrics />;
      case "diagsettings":
        return <SecDiagSettings sql={sql} onAdd={onAddDiagSetting} onDelete={onDeleteDiagSetting} />;
      case "logs":
        return <SecLogs />;
      case "queryeditor":
        return <SecQueryEditor sql={sql} />;
      default:
        return <SecPlaceholder title="Coming soon" desc="This section is part of the simulator roadmap." />;
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>DB</div>
        <div style={{ flex: 1 }}>
          <h1>{sql.name}</h1>
          <p className={styles.bladeSub}>SQL database ({sql.server})</p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={styles.actBtn} onClick={() => setSection("queryeditor")}>
            ▶ Query editor
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
