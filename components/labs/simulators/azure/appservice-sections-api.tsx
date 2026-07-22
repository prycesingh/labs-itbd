"use client";

import { useMemo, useState } from "react";

import type { AppServiceResource } from "@/lib/labs/simulators/azure/appServiceTypes";
import styles from "./azure-portal.module.css";

function Bars({ heights }: { heights: number[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 160,
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

export function SecCORS({
  app,
  onAdd,
  onDelete,
}: {
  app: AppServiceResource;
  onAdd: (origin: string) => void;
  onDelete: (index: number) => void;
}) {
  const [origin, setOrigin] = useState("");
  return (
    <div className={styles.sectionCard}>
      <h3>CORS — Cross-Origin Resource Sharing</h3>
      <p>Specify the allowed origin domains that can make cross-origin calls to your app.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="https://example.com or *"
          className={styles.input}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!origin) return;
            onAdd(origin);
            setOrigin("");
          }}
        >
          + Add origin
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Allowed origin</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {app.corsOrigins.length === 0 ? (
            <tr>
              <td colSpan={2}>No CORS origins configured. All origins are blocked.</td>
            </tr>
          ) : (
            app.corsOrigins.map((o, i) => (
              <tr key={i}>
                <td>{o}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Remove
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
          <option>Requests</option>
          <option>Http 4xx</option>
          <option>Http 5xx</option>
          <option>Average Response Time</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Avg</option>
          <option>Min</option>
          <option>Max</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Last 24 hours</option>
          <option>Last hour</option>
        </select>
      </div>
      <Bars heights={heights} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
        <MiniMetric label="Requests" value="1.2k" />
        <MiniMetric label="Avg response" value="184 ms" />
        <MiniMetric label="5xx errors" value="0" />
        <MiniMetric label="CPU time" value="12 s" />
      </div>
    </div>
  );
}

export function SecLogs() {
  return (
    <div className={styles.sectionCard}>
      <h3>Logs (Kusto / KQL)</h3>
      <p>Query Application Insights and App Service logs using Kusto Query Language.</p>
      <div style={{ background: "#1e1e1e", color: "#d4d4d4", padding: 12, borderRadius: 2, fontFamily: "Consolas, monospace", fontSize: 13 }}>
        AppRequests
        <br />
        | where TimeGenerated &gt; ago(1h)
        <br />
        | summarize Requests = count() by bin(TimeGenerated, 5m)
        <br />| render timechart
      </div>
    </div>
  );
}

export function SecAppServiceLogs() {
  return (
    <div className={styles.sectionCard}>
      <h3>App Service logs</h3>
      <p>Configure runtime logging for your application.</p>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
          Application logging (Filesystem)
        </label>
        <select className={styles.select} style={{ width: 160 }}>
          <option>Off</option>
          <option>On</option>
        </select>
      </div>
      <div>
        <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Web server logging</label>
        <select className={styles.select} style={{ width: 160 }}>
          <option>Off</option>
          <option>Storage</option>
          <option>File System</option>
        </select>
      </div>
    </div>
  );
}
