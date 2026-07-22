"use client";

import { useState } from "react";

import type { VmAlertRule, VmExtension, VmResource, VmRestorePoint } from "@/lib/labs/simulators/azure/types";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import styles from "./azure-portal.module.css";
import {
  SecActivity,
  SecDiagnose,
  SecIAM,
  SecLocks,
  SecOverview,
  SecProperties,
  SecTags,
} from "./blade-sections-core";
import { SecAsr, SecRestorePoints } from "./blade-sections-dr";
import { SecAlerts, SecInsights, SecMetrics } from "./blade-sections-monitoring";
import {
  SecAutoShutdown,
  SecBackup,
  SecBootDiag,
  SecExtensions,
  SecPolicies,
  SecResetPassword,
  SecRunCommand,
  SecUpdates,
} from "./blade-sections-operations";
import { SecConnect, SecDisks, SecIdentity, SecNetworking, SecSize } from "./blade-sections-settings";

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
    group: "Settings",
    items: [
      { id: "networking", label: "Networking" },
      { id: "connect", label: "Connect" },
      { id: "disks", label: "Disks" },
      { id: "size", label: "Size" },
      { id: "identity", label: "Identity" },
      { id: "properties", label: "Properties" },
      { id: "locks", label: "Locks" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "extensions", label: "Extensions + applications" },
      { id: "bootdiag", label: "Boot diagnostics" },
      { id: "autoshutdown", label: "Auto-shutdown" },
      { id: "backup", label: "Backup" },
      { id: "restorepoints", label: "Restore points" },
      { id: "asr", label: "Disaster recovery (ASR)" },
      { id: "updates", label: "Updates" },
      { id: "runcommand", label: "Run command" },
      { id: "resetpw", label: "Reset password" },
      { id: "policies", label: "Policies" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "insights", label: "Insights" },
      { id: "alerts", label: "Alerts" },
      { id: "metrics", label: "Metrics" },
    ],
  },
] as const;

export function VmDetailBlade({
  vm,
  activityLog,
  onBack,
  onSetStatus,
  onDelete,
  onResize,
  onAddTag,
  onDeleteTag,
  onAddExtension,
  onToggleExtension,
  onDeleteExtension,
  onToggleBootDiag,
  onAddRestorePoint,
  onDeleteRestorePoint,
  onEnableAsr,
  onDisableAsr,
  onAddAlertRule,
  onToggleAlertRule,
  onDeleteAlertRule,
}: {
  vm: VmResource;
  activityLog: ActivityLogEntry[];
  onBack: () => void;
  onSetStatus: (status: "Running" | "Stopped") => void;
  onDelete: () => void;
  onResize: (size: string) => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onAddExtension: (extension: VmExtension) => void;
  onToggleExtension: (index: number) => void;
  onDeleteExtension: (index: number) => void;
  onToggleBootDiag: (enabled: boolean) => void;
  onAddRestorePoint: (restorePoint: VmRestorePoint) => void;
  onDeleteRestorePoint: (index: number) => void;
  onEnableAsr: (targetRegion: string, policy: string) => void;
  onDisableAsr: () => void;
  onAddAlertRule: (rule: VmAlertRule) => void;
  onToggleAlertRule: (index: number) => void;
  onDeleteAlertRule: (index: number) => void;
}) {
  const [section, setSection] = useState("overview");

  function renderSection() {
    switch (section) {
      case "overview":
        return <SecOverview vm={vm} />;
      case "activity":
        return <SecActivity vm={vm} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags vm={vm} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "networking":
        return <SecNetworking vm={vm} />;
      case "connect":
        return <SecConnect vm={vm} />;
      case "disks":
        return <SecDisks vm={vm} />;
      case "size":
        return <SecSize vm={vm} onResize={onResize} />;
      case "identity":
        return <SecIdentity vm={vm} />;
      case "properties":
        return <SecProperties vm={vm} />;
      case "locks":
        return <SecLocks />;
      case "extensions":
        return (
          <SecExtensions
            vm={vm}
            onAdd={onAddExtension}
            onToggle={onToggleExtension}
            onDelete={onDeleteExtension}
          />
        );
      case "bootdiag":
        return <SecBootDiag vm={vm} onToggle={onToggleBootDiag} />;
      case "autoshutdown":
        return <SecAutoShutdown vm={vm} />;
      case "backup":
        return <SecBackup vm={vm} />;
      case "restorepoints":
        return <SecRestorePoints vm={vm} onCreate={onAddRestorePoint} onDelete={onDeleteRestorePoint} />;
      case "asr":
        return <SecAsr vm={vm} onEnable={onEnableAsr} onDisable={onDisableAsr} />;
      case "updates":
        return <SecUpdates />;
      case "runcommand":
        return <SecRunCommand vm={vm} />;
      case "resetpw":
        return <SecResetPassword />;
      case "policies":
        return <SecPolicies vm={vm} />;
      case "insights":
        return <SecInsights />;
      case "alerts":
        return (
          <SecAlerts vm={vm} onAdd={onAddAlertRule} onToggle={onToggleAlertRule} onDelete={onDeleteAlertRule} />
        );
      case "metrics":
        return <SecMetrics />;
      default:
        return <SecOverview vm={vm} />;
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>VM</div>
        <div style={{ flex: 1 }}>
          <h1>{vm.name}</h1>
          <p className={styles.bladeSub}>Virtual machine</p>
        </div>
        <div className={styles.bladeActions}>
          {vm.status === "Running" ? (
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
