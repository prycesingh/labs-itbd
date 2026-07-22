"use client";

import { useState } from "react";

import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { VnetAlertRule, VnetDdosAttack, VnetPeering, VnetResource, VnetSubnet } from "@/lib/labs/simulators/azure/vnetTypes";
import styles from "./azure-portal.module.css";
import {
  SecActivity,
  SecDiagnose,
  SecDiagram,
  SecIAM,
  SecLocks,
  SecNetworkMgr,
  SecOverview,
  SecProperties,
  SecTags,
} from "./vnet-sections-core";
import {
  SecAddressSpace,
  SecConnected,
  SecDdos,
  SecDns,
  SecFirewall,
  SecPeerings,
  SecPrivateEndpoints,
  SecServiceEndpoints,
  SecSubnets,
} from "./vnet-sections-network";
import { SecAlerts, SecDdosPlans, SecLogs, SecMetrics } from "./vnet-sections-monitoring";
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
      { id: "addressspace", label: "Address space" },
      { id: "connected", label: "Connected devices" },
      { id: "subnets", label: "Subnets" },
      { id: "ddos", label: "DDoS protection" },
      { id: "firewall", label: "Firewall" },
      { id: "peerings", label: "Peerings" },
      { id: "serviceep", label: "Service endpoints" },
      { id: "privateep", label: "Private endpoints" },
      { id: "dns", label: "DNS servers" },
      { id: "ddosplans", label: "DDoS protection plans" },
      { id: "networkmgr", label: "Network manager" },
      { id: "properties", label: "Properties" },
      { id: "locks", label: "Locks" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "diagram", label: "Diagram" },
      { id: "alerts", label: "Alerts" },
      { id: "metrics", label: "Metrics" },
      { id: "logs", label: "Logs" },
    ],
  },
] as const;

export function VnetDetailBlade({
  vnet,
  activityLog,
  connectedVms,
  nsgNames,
  otherVnetNames,
  onBack,
  onDelete,
  onAddTag,
  onDeleteTag,
  onSaveAddressSpace,
  onAddSubnet,
  onUpdateSubnet,
  onDeleteSubnet,
  onToggleSubnetEndpoint,
  onSetDdos,
  onSetDdosTier,
  onLinkDdosPlan,
  onDeployFirewall,
  onRemoveFirewall,
  onAddPeering,
  onDeletePeering,
  onSetDnsMode,
  onSaveDnsServers,
  onAddAlertRule,
  onToggleAlertRule,
  onDeleteAlertRule,
}: {
  vnet: VnetResource;
  activityLog: ActivityLogEntry[];
  connectedVms: { id: string; name: string; privateIp?: string; subnet?: string; publicIpAddress?: string | null }[];
  nsgNames: string[];
  otherVnetNames: string[];
  onBack: () => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onSaveAddressSpace: (cidrs: string[]) => void;
  onAddSubnet: () => void;
  onUpdateSubnet: (index: number, subnet: VnetSubnet) => void;
  onDeleteSubnet: (index: number) => void;
  onToggleSubnetEndpoint: (index: number, endpoint: string) => void;
  onSetDdos: (enabled: boolean) => void;
  onSetDdosTier: (tier: VnetResource["ddosTier"]) => void;
  onLinkDdosPlan: (plan: string, attackHistory: VnetDdosAttack[]) => void;
  onDeployFirewall: () => void;
  onRemoveFirewall: () => void;
  onAddPeering: (peering: { name: string; remoteVnet: string; gatewayTransit: boolean; useRemoteGateway: boolean }) => void;
  onDeletePeering: (index: number) => void;
  onSetDnsMode: (mode: "Azure-provided" | "Custom") => void;
  onSaveDnsServers: (servers: string[]) => void;
  onAddAlertRule: (rule: Omit<VnetAlertRule, "id">) => void;
  onToggleAlertRule: (index: number) => void;
  onDeleteAlertRule: (index: number) => void;
}) {
  const [section, setSection] = useState("overview");

  function renderSection() {
    switch (section) {
      case "overview":
        return (
          <SecOverview
            vnet={vnet}
            connectedDevices={connectedVms.length}
            onManageSubnets={() => setSection("subnets")}
            onEditTags={() => setSection("tags")}
          />
        );
      case "activity":
        return <SecActivity vnet={vnet} activityLog={activityLog} />;
      case "iam":
        return <SecIAM />;
      case "tags":
        return <SecTags vnet={vnet} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />;
      case "diagnose":
        return <SecDiagnose />;
      case "addressspace":
        return <SecAddressSpace vnet={vnet} onSave={onSaveAddressSpace} />;
      case "connected":
        return <SecConnected vnet={vnet} vms={connectedVms} />;
      case "subnets":
        return (
          <SecSubnets
            vnet={vnet}
            nsgs={nsgNames}
            onAdd={onAddSubnet}
            onUpdate={onUpdateSubnet}
            onDelete={onDeleteSubnet}
            onToggleEndpoint={onToggleSubnetEndpoint}
          />
        );
      case "ddos":
        return <SecDdos vnet={vnet} onSetDdos={onSetDdos} />;
      case "firewall":
        return <SecFirewall vnet={vnet} onDeploy={onDeployFirewall} onRemove={onRemoveFirewall} />;
      case "peerings":
        return <SecPeerings vnet={vnet} otherVnets={otherVnetNames} onAdd={onAddPeering} onDelete={onDeletePeering} />;
      case "serviceep":
        return <SecServiceEndpoints vnet={vnet} onManageSubnets={() => setSection("subnets")} />;
      case "privateep":
        return <SecPrivateEndpoints />;
      case "dns":
        return <SecDns vnet={vnet} onSetMode={onSetDnsMode} onSaveServers={onSaveDnsServers} />;
      case "ddosplans":
        return <SecDdosPlans vnet={vnet} onSetTier={onSetDdosTier} onLinkPlan={onLinkDdosPlan} />;
      case "networkmgr":
        return <SecNetworkMgr />;
      case "properties":
        return <SecProperties vnet={vnet} />;
      case "locks":
        return <SecLocks />;
      case "diagram":
        return <SecDiagram vnet={vnet} />;
      case "alerts":
        return <SecAlerts vnet={vnet} onAdd={onAddAlertRule} onToggle={onToggleAlertRule} onDelete={onDeleteAlertRule} />;
      case "metrics":
        return <SecMetrics />;
      case "logs":
        return <SecLogs />;
      default:
        return (
          <SecPlaceholder title="Coming soon" desc="This section is part of the simulator roadmap." />
        );
    }
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>VN</div>
        <div style={{ flex: 1 }}>
          <h1>{vnet.name}</h1>
          <p className={styles.bladeSub}>Virtual network</p>
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
