"use client";

import { useMemo, useState } from "react";

import type { VnetAlertRule, VnetDdosAttack, VnetResource } from "@/lib/labs/simulators/azure/vnetTypes";
import styles from "./azure-portal.module.css";
import { Field, NativeSelect } from "./wizard-fields";

const DEFAULT_PROTECTED_IPS = [
  { ip: "20.42.18.142", resource: "pip-app-gw-prod" },
  { ip: "20.42.18.156", resource: "pip-front-door" },
  { ip: "52.246.142.18", resource: "pip-vpn-gw-prod" },
];

const DEFAULT_ATTACK_HISTORY: VnetDdosAttack[] = [
  { when: "2026-05-12 04:18", ip: "20.42.18.142", vector: "SYN flood", peakPps: "2,140,000", action: "Auto-mitigated" },
  { when: "2026-04-22 19:42", ip: "20.42.18.156", vector: "DNS amplification", peakPps: "420,000", action: "Auto-mitigated" },
];

export function SecDdosPlans({
  vnet,
  onSetTier,
  onLinkPlan,
}: {
  vnet: VnetResource;
  onSetTier: (tier: VnetResource["ddosTier"]) => void;
  onLinkPlan: (plan: string, attackHistory: VnetDdosAttack[]) => void;
}) {
  const [planName, setPlanName] = useState("cl-ddos-plan-prod");
  const protectedIps = vnet.ddosTier !== "Basic (free)"
    ? DEFAULT_PROTECTED_IPS.map((p) => ({ ...p, plan: vnet.ddosPlan || "cl-ddos-plan" }))
    : [];
  const attacks = vnet.ddosAttackHistory;

  return (
    <div className={styles.sectionCard}>
      <h3>DDoS protection plans</h3>
      <p>
        Public-internet-facing resources receive Azure DDoS <b>Network Protection</b> automatically. Subscribe to{" "}
        <b>IP Protection</b> for L3/L4 + analytics, alert + post-attack mitigation report.
      </p>
      <Field label="Tier">
        <NativeSelect value={vnet.ddosTier} onChange={(v) => onSetTier(v as VnetResource["ddosTier"])}>
          <option>Basic (free)</option>
          <option>IP Protection</option>
          <option>Network Protection</option>
        </NativeSelect>
      </Field>
      {vnet.ddosTier !== "Basic (free)" ? (
        vnet.ddosPlan ? (
          <p style={{ fontSize: 13 }}>
            <b>DDoS Protection plan:</b> {vnet.ddosPlan}
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input value={planName} onChange={(e) => setPlanName(e.target.value)} className={styles.input} style={{ width: 220 }} />
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => onLinkPlan(planName, attacks.length > 0 ? attacks : DEFAULT_ATTACK_HISTORY)}
            >
              + Create / Link plan
            </button>
          </div>
        )
      ) : null}

      <h4 style={{ margin: "14px 0 8px", fontSize: 13 }}>Protected Public IPs</h4>
      <table className={styles.table} style={{ marginBottom: 14 }}>
        <thead>
          <tr>
            <th>IP</th>
            <th>Resource</th>
            <th>Plan</th>
          </tr>
        </thead>
        <tbody>
          {protectedIps.length === 0 ? (
            <tr>
              <td colSpan={3}>No Public IPs in this VNet have DDoS Protection beyond the platform Basic tier.</td>
            </tr>
          ) : (
            protectedIps.map((p) => (
              <tr key={p.ip}>
                <td style={{ fontFamily: "Consolas, monospace" }}>{p.ip}</td>
                <td>{p.resource}</td>
                <td>{p.plan}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h4 style={{ margin: "14px 0 8px", fontSize: 13 }}>Attack history (30 days)</h4>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Target IP</th>
            <th>Vector</th>
            <th>Peak</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {attacks.length === 0 ? (
            <tr>
              <td colSpan={5}>No attacks detected in the last 30 days.</td>
            </tr>
          ) : (
            attacks.map((a, i) => (
              <tr key={i}>
                <td>{a.when}</td>
                <td style={{ fontFamily: "Consolas, monospace" }}>{a.ip}</td>
                <td>{a.vector}</td>
                <td>{a.peakPps} pps</td>
                <td>{a.action}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className={styles.help} style={{ marginTop: 12 }}>
        <b>IP Protection</b> ~$199 per Public IP / month. <b>Network Protection</b> ~$2944 / month per organisation up
        to 100 IPs, unmetered data scrubbing.
      </p>
    </div>
  );
}

const DEFAULT_ALERT_RULES: Omit<VnetAlertRule, "id">[] = [
  { name: "High inbound traffic", signal: "Bytes Received Rate", operator: ">", threshold: "5 Gbps", window: "5m", severity: "Sev2", enabled: true },
  { name: "Peering disconnected", signal: "Peering State", operator: "=", threshold: "Disconnected", window: "1m", severity: "Sev1", enabled: true },
];

export function SecAlerts({
  vnet,
  onAdd,
  onToggle,
  onDelete,
}: {
  vnet: VnetResource;
  onAdd: (rule: Omit<VnetAlertRule, "id">) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [signal, setSignal] = useState("Bytes Received Rate");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("5 Gbps");
  const [window, setWindow] = useState("5m");
  const [severity, setSeverity] = useState("Sev2");

  const rules = vnet.alertRules;

  return (
    <div className={styles.sectionCard}>
      <h3>Alert rules</h3>
      <button
        type="button"
        className={styles.btn}
        style={{ marginBottom: 12 }}
        onClick={() => {
          if (rules.length === 0) {
            DEFAULT_ALERT_RULES.forEach((r) => onAdd(r));
          }
          setShowForm(true);
        }}
      >
        + Create alert rule
      </button>
      {showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Signal">
              <NativeSelect value={signal} onChange={setSignal}>
                <option>Bytes Received Rate</option>
                <option>Bytes Sent Rate</option>
                <option>Peering State</option>
                <option>Inbound Flow Count</option>
              </NativeSelect>
            </Field>
            <Field label="Operator">
              <NativeSelect value={operator} onChange={setOperator}>
                <option>&gt;</option>
                <option>&lt;</option>
                <option>&gt;=</option>
                <option>&lt;=</option>
              </NativeSelect>
            </Field>
            <Field label="Threshold">
              <input value={threshold} onChange={(e) => setThreshold(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Window">
              <input value={window} onChange={(e) => setWindow(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Severity">
              <NativeSelect value={severity} onChange={setSeverity}>
                <option>Sev0</option>
                <option>Sev1</option>
                <option>Sev2</option>
                <option>Sev3</option>
                <option>Sev4</option>
              </NativeSelect>
            </Field>
          </div>
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 8 }}
            onClick={() => {
              if (!name) return;
              onAdd({ name, signal, operator, threshold, window, severity, enabled: true });
              setName("");
              setShowForm(false);
            }}
          >
            Create
          </button>
        </div>
      ) : null}
      <table className={styles.table} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Signal</th>
            <th>Condition</th>
            <th>Window</th>
            <th>Severity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr>
              <td colSpan={6}>No alert rules defined.</td>
            </tr>
          ) : (
            rules.map((a, i) => (
              <tr key={a.id}>
                <td>
                  <b>{a.name}</b>
                </td>
                <td>{a.signal}</td>
                <td>
                  {a.operator} {a.threshold}
                </td>
                <td>{a.window}</td>
                <td>{a.severity}</td>
                <td>
                  {a.enabled ? (
                    <span className={`${styles.badge} ${styles.badgeRunning}`}>Enabled</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeOutline}`}>Disabled</span>
                  )}{" "}
                  <button type="button" className={styles.link} onClick={() => onToggle(i)}>
                    {a.enabled ? "Disable" : "Enable"}
                  </button>{" "}
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SecMetrics() {
  const heights = useMemo(() => Array.from({ length: 24 }, () => 20 + Math.random() * 70), []);
  return (
    <div className={styles.sectionCard}>
      <h3>Metrics</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Bytes In DDoS</option>
          <option>Bytes Out DDoS</option>
          <option>Ping Mesh Average Roundtrip</option>
          <option>If Under DDoS Attack</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Avg</option>
          <option>Min</option>
          <option>Max</option>
          <option>Sum</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Last 24 hours</option>
          <option>Last hour</option>
          <option>Last 7 days</option>
        </select>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          height: 200,
          border: "1px solid #edebe9",
          borderRadius: 2,
          background: "#faf9f8",
          padding: 8,
        }}
      >
        {heights.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: "#0078d4", borderRadius: "2px 2px 0 0" }} />
        ))}
      </div>
    </div>
  );
}

function queryText(q: string): string {
  return q;
}

export function SecLogs() {
  const queries = [
    {
      title: "Top talkers (last 1h)",
      q: 'AzureNetworkAnalytics_CL\n| where TimeGenerated > ago(1h) and SubType_s == "FlowLog"\n| summarize Bytes = sum(InboundBytes_d + OutboundBytes_d) by SrcIP_s, DestIP_s\n| top 20 by Bytes',
    },
    {
      title: "Denied flows by NSG",
      q: 'AzureDiagnostics\n| where Category == "NetworkSecurityGroupRuleCounter"\n| where Status_s == "D" and InitiatorIp_s != ""\n| summarize Hits = count() by Rule_s, NSG_s, SrcIp_s, DstPort_s\n| top 30 by Hits',
    },
    {
      title: "Peering state changes",
      q: 'AzureActivity\n| where OperationNameValue contains "virtualNetworkPeerings"\n| project TimeGenerated, ActivityStatusValue, Caller, Resource',
    },
    {
      title: "Top blocked apps (Azure FW)",
      q: 'AZFWApplicationRule\n| where TimeGenerated > ago(24h) and Action == "Deny"\n| summarize Count = count() by SourceIp, TargetUrl, Fqdn\n| top 20 by Count',
    },
  ];
  return (
    <div className={styles.sectionCard}>
      <h3>Logs</h3>
      <p>Run KQL queries against this VNet&apos;s diagnostic logs forwarded to a Log Analytics workspace.</p>
      <h4 style={{ margin: "14px 0 6px", fontSize: 13 }}>Starter queries</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {queries.map((q) => (
          <div
            key={q.title}
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              borderRadius: 4,
              padding: "10px 12px",
              fontFamily: "Consolas, monospace",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              lineHeight: 1.55,
            }}
          >
            <div style={{ color: "#9cdcfe", fontWeight: 600, marginBottom: 6, fontFamily: "Segoe UI, sans-serif", fontSize: 12 }}>
              {q.title}
            </div>
            {queryText(q.q)}
          </div>
        ))}
      </div>
      <p className={styles.help} style={{ marginTop: 12 }}>
        <b>Prerequisite:</b> Forward NSG flow logs + AzureDiagnostics to Log Analytics via Diagnostic Settings +
        Traffic Analytics workspace.
      </p>
    </div>
  );
}
