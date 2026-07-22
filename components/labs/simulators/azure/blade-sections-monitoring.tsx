"use client";

import { useMemo, useState } from "react";

import type { VmAlertRule, VmResource } from "@/lib/labs/simulators/azure/types";
import styles from "./azure-portal.module.css";

function Bars({ heights }: { heights: number[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 128,
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
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#0078d4" }}>{value}</div>
    </div>
  );
}

export function SecInsights() {
  const heights = useMemo(() => [42, 67, 55, 71, 48, 62, 39, 51], []);
  return (
    <div className={styles.sectionCard}>
      <h3>VM Insights</h3>
      <p>Detailed performance metrics and dependency mapping for your VM.</p>
      <Bars heights={heights} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
        <MiniMetric label="CPU" value="23%" />
        <MiniMetric label="Memory" value="4.2 GiB" />
        <MiniMetric label="Disk IOPS" value="142" />
        <MiniMetric label="Network" value="8.4 MB/s" />
      </div>
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
          <option>Percentage CPU</option>
          <option>Network In</option>
          <option>Network Out</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Avg</option>
          <option>Min</option>
          <option>Max</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Last 24 hours</option>
          <option>Last hour</option>
          <option>Last 7 days</option>
        </select>
      </div>
      <Bars heights={heights} />
    </div>
  );
}

export function SecAlerts({
  vm,
  onAdd,
  onToggle,
  onDelete,
}: {
  vm: VmResource;
  onAdd: (rule: VmAlertRule) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [signal, setSignal] = useState("Percentage CPU");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("80");
  const [window, setWindow] = useState("10m");
  const [severity, setSeverity] = useState("Sev2");

  return (
    <div className={styles.sectionCard}>
      <h3>Alert rules</h3>
      {showForm ? (
        <div
          style={{
            border: "1px solid #edebe9",
            borderRadius: 2,
            padding: 12,
            marginBottom: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alert rule name"
            className={styles.input}
            style={{ gridColumn: "1 / -1" }}
          />
          <input
            value={signal}
            onChange={(e) => setSignal(e.target.value)}
            placeholder="Signal"
            className={styles.input}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className={styles.input}
              style={{ width: 60 }}
            />
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={styles.input}
            />
          </div>
          <input
            value={window}
            onChange={(e) => setWindow(e.target.value)}
            placeholder="Window (10m)"
            className={styles.input}
          />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={styles.select}>
            <option>Sev0</option>
            <option>Sev1</option>
            <option>Sev2</option>
            <option>Sev3</option>
            <option>Sev4</option>
          </select>
          <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                onAdd({ name, signal, operator, threshold, window, severity, enabled: true, fired: 0 });
                setShowForm(false);
                setName("");
              }}
            >
              Create
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
          + Create alert rule
        </button>
      )}
      {vm.alertRules.length === 0 ? (
        <p>No alert rules configured.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Condition</th>
              <th>Severity</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vm.alertRules.map((a, i) => (
              <tr key={i}>
                <td>{a.name}</td>
                <td>
                  {a.signal} {a.operator} {a.threshold}
                </td>
                <td>{a.severity}</td>
                <td>
                  <span className={`${styles.badge} ${a.enabled ? styles.badgeRunning : styles.badgeOutline}`}>
                    {a.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={styles.link} onClick={() => onToggle(i)}>
                      {a.enabled ? "Disable" : "Enable"}
                    </button>
                    <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
