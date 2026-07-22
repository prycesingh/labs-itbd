"use client";

import { useState } from "react";

import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import { newRuleDraft, type NsgResource, type NsgRule } from "@/lib/labs/simulators/azure/nsgTypes";
import styles from "./azure-portal.module.css";
import { SecActivity, SecDiagnose, SecIAM, SecLocks, SecOverview, SecProperties, SecTags } from "./nsg-sections-core";
import { SecFlowLogs, SecLogs, SecNICs, SecSubnets } from "./nsg-sections-network";
import { SecRules } from "./nsg-sections-rules";
import { NsgRuleEditor } from "./nsg-rule-editor";

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
      { id: "inbound", label: "Inbound security rules" },
      { id: "outbound", label: "Outbound security rules" },
      { id: "nics", label: "Network interfaces" },
      { id: "subnets", label: "Subnets" },
      { id: "properties", label: "Properties" },
      { id: "locks", label: "Locks" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "logs", label: "Logs" },
      { id: "flowlogs", label: "NSG flow logs" },
    ],
  },
] as const;

export function NsgDetailBlade({
  nsg,
  activityLog,
  onBack,
  onDelete,
  onAddTag,
  onDeleteTag,
  onSaveRule,
  onDeleteRule,
  onDissociateNic,
  onDissociateSubnet,
}: {
  nsg: NsgResource;
  activityLog: ActivityLogEntry[];
  onBack: () => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onSaveRule: (direction: "Inbound" | "Outbound", rule: NsgRule) => void;
  onDeleteRule: (direction: "Inbound" | "Outbound", ruleId: string) => void;
  onDissociateNic: (nic: string) => void;
  onDissociateSubnet: (subnet: string) => void;
}) {
  const [section, setSection] = useState("overview");
  const [ruleEditor, setRuleEditor] = useState<{ direction: "Inbound" | "Outbound"; ruleId: string | null } | null>(
    null,
  );

  function openRuleEditor(direction: "Inbound" | "Outbound", ruleId: string | null) {
    setRuleEditor({ direction, ruleId });
  }

  function renderSection() {
    switch (section) {
      case "overview":
        return (
          <SecOverview
            nsg={nsg}
            onManageInbound={() => setSection("inbound")}
            onManageOutbound={() => setSection("outbound")}
            onEditTags={() => setSection("tags")}
          />
        );
      case "activity":
        return <SecActivity nsg={nsg} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags nsg={nsg} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "inbound":
        return (
          <SecRules
            nsg={nsg}
            direction="Inbound"
            onAdd={() => openRuleEditor("Inbound", null)}
            onEdit={(ruleId) => openRuleEditor("Inbound", ruleId)}
            onDelete={(ruleId) => onDeleteRule("Inbound", ruleId)}
          />
        );
      case "outbound":
        return (
          <SecRules
            nsg={nsg}
            direction="Outbound"
            onAdd={() => openRuleEditor("Outbound", null)}
            onEdit={(ruleId) => openRuleEditor("Outbound", ruleId)}
            onDelete={(ruleId) => onDeleteRule("Outbound", ruleId)}
          />
        );
      case "nics":
        return <SecNICs nsg={nsg} onDissociate={onDissociateNic} />;
      case "subnets":
        return <SecSubnets nsg={nsg} onDissociate={onDissociateSubnet} />;
      case "properties":
        return <SecProperties nsg={nsg} />;
      case "locks":
        return <SecLocks />;
      case "logs":
        return <SecLogs nsg={nsg} />;
      case "flowlogs":
        return <SecFlowLogs />;
      default:
        return <SecOverview nsg={nsg} onManageInbound={() => setSection("inbound")} onManageOutbound={() => setSection("outbound")} onEditTags={() => setSection("tags")} />;
    }
  }

  const existingRules = ruleEditor
    ? ruleEditor.direction === "Inbound"
      ? nsg.inboundRules
      : nsg.outboundRules
    : [];
  const editingRule = ruleEditor?.ruleId
    ? existingRules.find((r) => r.id === ruleEditor.ruleId) ?? null
    : null;

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>NSG</div>
        <div style={{ flex: 1 }}>
          <h1>{nsg.name}</h1>
          <p className={styles.bladeSub}>Network security group</p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={styles.actBtn} onClick={() => openRuleEditor("Inbound", null)}>
            + Add inbound
          </button>
          <button type="button" className={styles.actBtn} onClick={() => openRuleEditor("Outbound", null)}>
            + Add outbound
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

      {ruleEditor ? (
        <NsgRuleEditor
          direction={ruleEditor.direction}
          isEdit={Boolean(editingRule)}
          initialDraft={editingRule ?? newRuleDraft(ruleEditor.direction, existingRules)}
          existingRules={existingRules}
          onSave={(rule) => {
            onSaveRule(ruleEditor.direction, rule);
            setRuleEditor(null);
            setSection(ruleEditor.direction === "Inbound" ? "inbound" : "outbound");
          }}
          onClose={() => setRuleEditor(null)}
        />
      ) : null}
    </div>
  );
}
