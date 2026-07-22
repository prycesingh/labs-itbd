"use client";

import { useState } from "react";

import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type {
  StorageAlertRule,
  StorageContainer,
  StorageDefenderConfig,
  StorageFileShare,
  StorageFrontDoorProfile,
  StorageInventoryRule,
  StorageIpRule,
  StorageLifecycleRule,
  StorageObjectReplRule,
  StoragePrivateEndpoint,
  StorageQueue,
  StorageResource,
  StorageSasState,
  StorageTable,
  StorageVnetRule,
} from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";
import { SecActivity, SecDiagnose, SecIAM, SecOverview, SecTags } from "./storage-sections-core";
import { SecAccessKeys, SecCORS, SecConfiguration, SecEncryption, SecGeoReplication, SecSAS } from "./storage-sections-settings";
import { SecContainers, SecFileShares, SecQueues, SecTables } from "./storage-sections-datastorage";
import { SecDefender, SecFrontDoor, SecNetworking } from "./storage-sections-network";
import { SecAlerts, SecInsights, SecInventory, SecLifecycle, SecMetrics, SecObjectRepl } from "./storage-sections-datamgmt";

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
      { id: "accesskeys", label: "Access keys" },
      { id: "georepl", label: "Geo-replication" },
      { id: "cors", label: "CORS" },
      { id: "configuration", label: "Configuration" },
      { id: "encryption", label: "Encryption" },
      { id: "sas", label: "Shared access signature" },
    ],
  },
  {
    group: "Data storage",
    items: [
      { id: "containers", label: "Containers" },
      { id: "fileshares", label: "File shares" },
      { id: "queues", label: "Queues" },
      { id: "tables", label: "Tables" },
    ],
  },
  {
    group: "Security + networking",
    items: [
      { id: "networking", label: "Networking" },
      { id: "frontdoor", label: "Front Door and CDN" },
      { id: "defender", label: "Defender for Storage" },
    ],
  },
  {
    group: "Data management",
    items: [
      { id: "lifecycle", label: "Lifecycle management" },
      { id: "objectrepl", label: "Object replication" },
      { id: "inventory", label: "Blob inventory" },
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

export function StorageDetailBlade({
  sa,
  activityLog,
  onBack,
  onDelete,
  onAddTag,
  onDeleteTag,
  onRotateKey,
  onOpenExplorer,
  onAddContainer,
  onDeleteContainer,
  onAddFileShare,
  onDeleteFileShare,
  onAddQueue,
  onDeleteQueue,
  onAddTable,
  onDeleteTable,
  onUpdateConfig,
  onSetSas,
  onSetNetworkAccess,
  onAddVnetRule,
  onDeleteVnetRule,
  onAddIpRule,
  onDeleteIpRule,
  onAddPrivateEndpoint,
  onDeletePrivateEndpoint,
  onLinkFrontDoor,
  onPurgeFrontDoor,
  onUnlinkFrontDoor,
  onToggleDefender,
  onSetDefenderPlan,
  onAddLifecycleRule,
  onToggleLifecycleRule,
  onDeleteLifecycleRule,
  onAddObjectReplRule,
  onDeleteObjectReplRule,
  onAddInventoryRule,
  onDeleteInventoryRule,
  onAddAlertRule,
  onToggleAlertRule,
  onDeleteAlertRule,
}: {
  sa: StorageResource;
  activityLog: ActivityLogEntry[];
  onBack: () => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onRotateKey: (key: "key1" | "key2") => void;
  onOpenExplorer: () => void;
  onAddContainer: (container: StorageContainer) => void;
  onDeleteContainer: (name: string) => void;
  onAddFileShare: (share: StorageFileShare) => void;
  onDeleteFileShare: (name: string) => void;
  onAddQueue: (queue: StorageQueue) => void;
  onDeleteQueue: (name: string) => void;
  onAddTable: (table: StorageTable) => void;
  onDeleteTable: (name: string) => void;
  onUpdateConfig: (key: keyof StorageResource, value: StorageResource[keyof StorageResource]) => void;
  onSetSas: (sas: StorageSasState) => void;
  onSetNetworkAccess: (value: string) => void;
  onAddVnetRule: (rule: StorageVnetRule) => void;
  onDeleteVnetRule: (index: number) => void;
  onAddIpRule: (rule: StorageIpRule) => void;
  onDeleteIpRule: (index: number) => void;
  onAddPrivateEndpoint: (endpoint: StoragePrivateEndpoint) => void;
  onDeletePrivateEndpoint: (index: number) => void;
  onLinkFrontDoor: (profile: StorageFrontDoorProfile) => void;
  onPurgeFrontDoor: () => void;
  onUnlinkFrontDoor: () => void;
  onToggleDefender: (key: keyof StorageDefenderConfig, value: boolean) => void;
  onSetDefenderPlan: (plan: StorageDefenderConfig["plan"]) => void;
  onAddLifecycleRule: (rule: StorageLifecycleRule) => void;
  onToggleLifecycleRule: (index: number) => void;
  onDeleteLifecycleRule: (index: number) => void;
  onAddObjectReplRule: (rule: StorageObjectReplRule) => void;
  onDeleteObjectReplRule: (index: number) => void;
  onAddInventoryRule: (rule: StorageInventoryRule) => void;
  onDeleteInventoryRule: (index: number) => void;
  onAddAlertRule: (rule: Omit<StorageAlertRule, "id">) => void;
  onToggleAlertRule: (index: number) => void;
  onDeleteAlertRule: (index: number) => void;
}) {
  const [section, setSection] = useState("overview");

  function renderSection() {
    switch (section) {
      case "overview":
        return <SecOverview sa={sa} onNavigate={setSection} onEditTags={() => setSection("tags")} />;
      case "activity":
        return <SecActivity sa={sa} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags sa={sa} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "accesskeys":
        return <SecAccessKeys sa={sa} onRotate={onRotateKey} />;
      case "georepl":
        return <SecGeoReplication sa={sa} />;
      case "cors":
        return <SecCORS />;
      case "configuration":
        return <SecConfiguration sa={sa} onUpdate={onUpdateConfig} />;
      case "encryption":
        return <SecEncryption sa={sa} />;
      case "sas":
        return <SecSAS sa={sa} onChange={onSetSas} />;
      case "containers":
        return <SecContainers sa={sa} onAdd={onAddContainer} onDelete={onDeleteContainer} />;
      case "fileshares":
        return <SecFileShares sa={sa} onAdd={onAddFileShare} onDelete={onDeleteFileShare} />;
      case "queues":
        return <SecQueues sa={sa} onAdd={onAddQueue} onDelete={onDeleteQueue} />;
      case "tables":
        return <SecTables sa={sa} onAdd={onAddTable} onDelete={onDeleteTable} />;
      case "networking":
        return (
          <SecNetworking
            sa={sa}
            onSetAccess={onSetNetworkAccess}
            onAddVnetRule={onAddVnetRule}
            onDeleteVnetRule={onDeleteVnetRule}
            onAddIpRule={onAddIpRule}
            onDeleteIpRule={onDeleteIpRule}
            onAddPE={onAddPrivateEndpoint}
            onDeletePE={onDeletePrivateEndpoint}
          />
        );
      case "frontdoor":
        return <SecFrontDoor sa={sa} onLink={onLinkFrontDoor} onPurge={onPurgeFrontDoor} onUnlink={onUnlinkFrontDoor} />;
      case "defender":
        return <SecDefender sa={sa} onToggle={onToggleDefender} onSetPlan={onSetDefenderPlan} />;
      case "lifecycle":
        return <SecLifecycle sa={sa} onAdd={onAddLifecycleRule} onToggle={onToggleLifecycleRule} onDelete={onDeleteLifecycleRule} />;
      case "objectrepl":
        return <SecObjectRepl sa={sa} onAdd={onAddObjectReplRule} onDelete={onDeleteObjectReplRule} />;
      case "inventory":
        return <SecInventory sa={sa} onAdd={onAddInventoryRule} onDelete={onDeleteInventoryRule} />;
      case "insights":
        return <SecInsights />;
      case "alerts":
        return <SecAlerts sa={sa} onAdd={onAddAlertRule} onToggle={onToggleAlertRule} onDelete={onDeleteAlertRule} />;
      case "metrics":
        return <SecMetrics />;
      default:
        return <SecOverview sa={sa} onNavigate={setSection} onEditTags={() => setSection("tags")} />;
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>SA</div>
        <div style={{ flex: 1 }}>
          <h1>{sa.name}</h1>
          <p className={styles.bladeSub}>Storage account</p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={styles.actBtn} onClick={onOpenExplorer}>
            📂 Storage browser
          </button>
          <button type="button" className={styles.actBtn} onClick={() => onRotateKey("key1")}>
            ↻ Rotate key1
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
