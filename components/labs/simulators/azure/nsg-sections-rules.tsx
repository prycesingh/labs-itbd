"use client";

import { NSG_DEFAULT_RULES, NSG_SERVICES } from "@/lib/labs/simulators/azure/nsgData";
import type { NsgResource, NsgRule } from "@/lib/labs/simulators/azure/nsgTypes";
import styles from "./azure-portal.module.css";

function formatPortDisplay(rule: NsgRule): string {
  if (rule.service !== "Custom") {
    const known = NSG_SERVICES.find((s) => s.name === rule.service);
    return known ? known.port : rule.service;
  }
  return rule.destPortRanges || "*";
}

function formatEndpointDisplay(rule: NsgRule, side: "source" | "dest"): string {
  const kind = side === "source" ? rule.source : rule.dest;
  if (!kind || kind === "Any") return "Any";
  if (kind === "IP Addresses") return (side === "source" ? rule.sourceAddresses : rule.destAddresses) || "-";
  if (kind === "Service Tag") return (side === "source" ? rule.sourceServiceTag : rule.destServiceTag) || "-";
  if (kind === "Application security group") return "ASG";
  if (kind === "VirtualNetwork") return "VirtualNetwork";
  if (kind === "My IP address") return "MyIP";
  return kind;
}

function ActionLabel({ action }: { action: "Allow" | "Deny" }) {
  return <span className={action === "Allow" ? styles.actionAllow : styles.actionDeny}>{action === "Allow" ? "✓ Allow" : "✕ Deny"}</span>;
}

export function SecRules({
  nsg,
  direction,
  onAdd,
  onEdit,
  onDelete,
}: {
  nsg: NsgResource;
  direction: "Inbound" | "Outbound";
  onAdd: () => void;
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
}) {
  const userRules = direction === "Inbound" ? nsg.inboundRules : nsg.outboundRules;
  const sorted = [...userRules].sort((a, b) => a.priority - b.priority);
  const defaults = NSG_DEFAULT_RULES.filter((d) => d.direction === direction);

  return (
    <div className={styles.sectionCard}>
      <h3>{direction} security rules</h3>
      <p>
        Rules are evaluated in order of priority (lowest first). The first matching rule determines if
        traffic is allowed or denied.
      </p>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btn} onClick={onAdd}>
          + Add
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Name</th>
            <th>Port</th>
            <th>Protocol</th>
            <th>Source</th>
            <th>Destination</th>
            <th>Action</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={8}>No custom {direction.toLowerCase()} rules. Click &quot;Add&quot; to create one.</td>
            </tr>
          ) : (
            sorted.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <span className={styles.priorityPill}>{rule.priority}</span>
                </td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onEdit(rule.id)}>
                    {rule.name}
                  </button>
                </td>
                <td>{formatPortDisplay(rule)}</td>
                <td>{rule.protocol || "Any"}</td>
                <td>{formatEndpointDisplay(rule, "source")}</td>
                <td>{formatEndpointDisplay(rule, "dest")}</td>
                <td>
                  <ActionLabel action={rule.action} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={styles.link} onClick={() => onEdit(rule.id)}>
                      Edit
                    </button>
                    <button type="button" className={styles.link} onClick={() => onDelete(rule.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
          <tr className={styles.ruleDefault}>
            <td colSpan={8} style={{ fontWeight: 600, background: "#edebe9" }}>
              Default rules (read-only)
            </td>
          </tr>
          {defaults.map((d) => (
            <tr key={d.name} className={styles.ruleDefault}>
              <td>
                <span className={styles.priorityPill}>{d.priority}</span>
              </td>
              <td>{d.name}</td>
              <td>{d.port}</td>
              <td>{d.protocol}</td>
              <td>{d.source}</td>
              <td>{d.dest}</td>
              <td>
                <ActionLabel action={d.action} />
              </td>
              <td>
                <i>Read-only</i>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
