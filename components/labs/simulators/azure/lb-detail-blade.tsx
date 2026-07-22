"use client";

import { useState } from "react";

import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { LbBackendTarget, LbHealthProbe, LbNatRule, LbOutboundRule, LbResource, LbRule } from "@/lib/labs/simulators/azure/lbTypes";
import styles from "./azure-portal.module.css";
import { SecActivity, SecCrossRegion, SecDiagnose, SecIAM, SecInsights, SecLocks, SecOverview, SecProperties, SecTags } from "./lb-sections-core";
import { SecBackend, SecFrontend, SecLBRules, SecNATRules, SecOutboundRules, SecProbes } from "./lb-sections-crud";
import { SecMetrics } from "./lb-sections-metrics";
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
    group: "Settings",
    items: [
      { id: "frontend", label: "Frontend IP configuration" },
      { id: "backend", label: "Backend pools" },
      { id: "probes", label: "Health probes" },
      { id: "lbrules", label: "Load balancing rules" },
      { id: "natrules", label: "Inbound NAT rules" },
      { id: "outboundrules", label: "Outbound rules" },
      { id: "crossregion", label: "Cross-region load balancer" },
      { id: "insights", label: "Insights" },
      { id: "properties", label: "Properties" },
      { id: "locks", label: "Locks" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "alerts", label: "Alerts" },
      { id: "metrics", label: "Metrics" },
      { id: "logs", label: "Logs" },
      { id: "diagsettings", label: "Diagnostic settings" },
    ],
  },
  {
    group: "Help",
    items: [
      { id: "resourcehealth", label: "Resource health" },
      { id: "support", label: "New support request" },
    ],
  },
] as const;

export function LbDetailBlade({
  lb,
  activityLog,
  vms,
  onBack,
  onDelete,
  onAddTag,
  onDeleteTag,
  onAddFrontend,
  onDeleteFrontend,
  onAddBackendPool,
  onDeleteBackendPool,
  onAddPoolTarget,
  onDeletePoolTarget,
  onAddProbe,
  onDeleteProbe,
  onAddLbRule,
  onDeleteLbRule,
  onAddNatRule,
  onDeleteNatRule,
  onAddOutboundRule,
  onDeleteOutboundRule,
}: {
  lb: LbResource;
  activityLog: ActivityLogEntry[];
  vms: { id: string; name: string; privateIp: string; os: string }[];
  onBack: () => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onAddFrontend: () => void;
  onDeleteFrontend: (index: number) => void;
  onAddBackendPool: () => void;
  onDeleteBackendPool: (index: number) => void;
  onAddPoolTarget: (poolIndex: number, target: LbBackendTarget) => void;
  onDeletePoolTarget: (poolIndex: number, targetIndex: number) => void;
  onAddProbe: (probe: Omit<LbHealthProbe, "id">) => void;
  onDeleteProbe: (index: number) => void;
  onAddLbRule: (rule: Omit<LbRule, "id">) => void;
  onDeleteLbRule: (index: number) => void;
  onAddNatRule: (rule: Omit<LbNatRule, "id">) => void;
  onDeleteNatRule: (index: number) => void;
  onAddOutboundRule: (rule: Omit<LbOutboundRule, "id">) => void;
  onDeleteOutboundRule: (index: number) => void;
}) {
  const [section, setSection] = useState("overview");

  function renderSection() {
    switch (section) {
      case "overview":
        return <SecOverview lb={lb} onEditTags={() => setSection("tags")} />;
      case "activity":
        return <SecActivity lb={lb} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags lb={lb} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "frontend":
        return <SecFrontend lb={lb} onAdd={onAddFrontend} onDelete={onDeleteFrontend} />;
      case "backend":
        return (
          <SecBackend
            lb={lb}
            vms={vms}
            onAdd={onAddBackendPool}
            onDelete={onDeleteBackendPool}
            onAddTarget={onAddPoolTarget}
            onDeleteTarget={onDeletePoolTarget}
          />
        );
      case "probes":
        return <SecProbes lb={lb} onAdd={onAddProbe} onDelete={onDeleteProbe} />;
      case "lbrules":
        return <SecLBRules lb={lb} onAdd={onAddLbRule} onDelete={onDeleteLbRule} />;
      case "natrules":
        return <SecNATRules lb={lb} onAdd={onAddNatRule} onDelete={onDeleteNatRule} />;
      case "outboundrules":
        return <SecOutboundRules lb={lb} onAdd={onAddOutboundRule} onDelete={onDeleteOutboundRule} />;
      case "crossregion":
        return <SecCrossRegion lb={lb} />;
      case "insights":
        return <SecInsights lb={lb} />;
      case "properties":
        return <SecProperties lb={lb} />;
      case "locks":
        return <SecLocks />;
      case "alerts":
        return <SecPlaceholder title="Alerts" desc="Set up alert rules based on metrics, activity logs, or service health." />;
      case "metrics":
        return <SecMetrics />;
      case "logs":
        return <SecPlaceholder title="Logs" desc="Query logs using Kusto Query Language (KQL) in Log Analytics." />;
      case "diagsettings":
        return <SecPlaceholder title="Diagnostic settings" desc="Configure diagnostic settings to stream metrics and logs to Log Analytics, Event Hubs, or a storage account." />;
      case "resourcehealth":
        return <SecPlaceholder title="Resource health" desc="Track current and historical resource health." />;
      case "support":
        return <SecPlaceholder title="New support request" desc="Create a new support request to Microsoft." />;
      default:
        return <SecOverview lb={lb} onEditTags={() => setSection("tags")} />;
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>LB</div>
        <div style={{ flex: 1 }}>
          <h1>{lb.name}</h1>
          <p className={styles.bladeSub}>Load balancer</p>
        </div>
        <div className={styles.bladeActions}>
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
