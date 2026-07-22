"use client";

import { useMemo, useState } from "react";

import type { SqlAlertRule, SqlDiagSetting, SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";
import { Field, NativeSelect } from "./wizard-fields";

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function Bars({ heights, tall }: { heights: number[]; tall?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: tall ? 200 : 120,
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

export function SecPerfOverview() {
  const heights = useMemo(() => [42, 67, 55, 71, 48, 62, 39, 51], []);
  return (
    <div className={styles.sectionCard}>
      <h3>Performance overview</h3>
      <Bars heights={heights} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
        <MiniMetric label="DTU / CPU%" value="38%" color="#0078d4" />
        <MiniMetric label="Data IO%" value="12%" color="#107c10" />
        <MiniMetric label="Log IO%" value="8%" color="#d83b01" />
        <MiniMetric label="Sessions" value="14" color="#7719aa" />
      </div>
    </div>
  );
}

const QUERIES = [
  { sql: "SELECT * FROM dbo.Orders WHERE CustomerId = @p1", ms: 1240, pct: 95 },
  { sql: "INSERT INTO dbo.AuditLog (UserId, Action, Timestamp) VALUES (@p1, @p2, @p3)", ms: 820, pct: 64 },
  { sql: "UPDATE dbo.Inventory SET Quantity = Quantity - @p1 WHERE ProductId = @p2", ms: 610, pct: 47 },
  { sql: "SELECT TOP 100 ProductId, Name, Price FROM dbo.Products ORDER BY Price DESC", ms: 410, pct: 31 },
  { sql: "DELETE FROM dbo.Sessions WHERE LastSeenUtc < DATEADD(day, -30, GETUTCDATE())", ms: 280, pct: 22 },
];

export function SecQpi() {
  return (
    <div className={styles.sectionCard}>
      <h3>Query Performance Insight — Top 5 queries by avg duration (last 24h)</h3>
      {QUERIES.map((q) => (
        <div key={q.sql} className={styles.qpiBar}>
          <div className={styles.label} title={q.sql}>
            {q.sql.length > 48 ? `${q.sql.slice(0, 48)}…` : q.sql}
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${q.pct}%` }} />
          </div>
          <div className={styles.val}>{q.ms} ms</div>
        </div>
      ))}
      <p className={styles.help}>Data shown is simulated for educational purposes.</p>
    </div>
  );
}

const PERF_RECS = [
  { type: "CREATE INDEX", target: "dbo.Orders (CustomerId, OrderDate)", impact: "High" },
  { type: "DROP INDEX", target: "dbo.Orders.IX_Orders_OldCustomerId", impact: "Medium" },
  { type: "PARAMETERIZE", target: "dbo.GetReport (literal -> @param)", impact: "Low" },
];

export function SecPerfRecs() {
  return (
    <div className={styles.sectionCard}>
      <h3>Performance recommendations</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Target</th>
            <th>Impact</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {PERF_RECS.map((r) => (
            <tr key={r.target}>
              <td>{r.type}</td>
              <td>
                <code>{r.target}</code>
              </td>
              <td>
                <span className={`${styles.badge} ${styles.badgeOutline}`}>{r.impact}</span>
              </td>
              <td>
                <button type="button" className={styles.btnOutline}>
                  Apply
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecAutoTune() {
  return (
    <div className={styles.sectionCard}>
      <h3>Automatic tuning</h3>
      <p>Azure SQL automatic tuning identifies performance issues and applies fixes automatically.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Option</th>
            <th>Description</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CREATE INDEX</td>
            <td>Identify indexes that may improve performance.</td>
            <td>
              <span className={`${styles.badge} ${styles.badgeRunning}`}>On</span>
            </td>
          </tr>
          <tr>
            <td>DROP INDEX</td>
            <td>Identify unused or duplicate indexes.</td>
            <td>
              <span className={`${styles.badge} ${styles.badgeOutline}`}>Off</span>
            </td>
          </tr>
          <tr>
            <td>FORCE LAST GOOD PLAN</td>
            <td>Force last known good execution plan after regression.</td>
            <td>
              <span className={`${styles.badge} ${styles.badgeRunning}`}>On</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SecInsights() {
  const heights = useMemo(() => Array.from({ length: 12 }, () => 20 + Math.random() * 70), []);
  return (
    <div className={styles.sectionCard}>
      <h3>Insights</h3>
      <p>Get deep performance and dependency insights for your SQL database.</p>
      <Bars heights={heights} />
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
          <option>DTU percentage</option>
          <option>CPU percentage</option>
          <option>Data IO percentage</option>
          <option>Log IO percentage</option>
          <option>Storage used</option>
          <option>Successful connections</option>
          <option>Failed connections</option>
          <option>Deadlocks</option>
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
      <Bars heights={heights} tall />
    </div>
  );
}

const DEFAULT_SQL_ALERTS: Omit<SqlAlertRule, "id">[] = [
  { name: "DTU > 80% for 10 min", signal: "DTU percentage", operator: ">", threshold: "80", window: "10m", severity: "Sev2", enabled: true, fired: 6 },
  { name: "CPU > 90% for 5 min", signal: "CPU percentage", operator: ">", threshold: "90", window: "5m", severity: "Sev2", enabled: true, fired: 2 },
  { name: "Deadlocks > 5 in 1h", signal: "Deadlocks", operator: ">", threshold: "5", window: "1h", severity: "Sev3", enabled: true, fired: 0 },
  { name: "Blocked queries spike", signal: "Blocked by Firewall", operator: ">", threshold: "20", window: "5m", severity: "Sev3", enabled: false, fired: 0 },
];

export function SecAlerts({
  sql,
  onAdd,
  onToggle,
  onDelete,
}: {
  sql: SqlResource;
  onAdd: (rule: Omit<SqlAlertRule, "id">) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [signal, setSignal] = useState("DTU percentage");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("80");
  const [window, setWindow] = useState("10m");
  const [severity, setSeverity] = useState("Sev2");

  return (
    <div className={styles.sectionCard}>
      <h3>Alert rules</h3>
      <button
        type="button"
        className={styles.btn}
        style={{ marginBottom: 12 }}
        onClick={() => {
          if (sql.alertRules.length === 0) DEFAULT_SQL_ALERTS.forEach((r) => onAdd(r));
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
                <option>DTU percentage</option>
                <option>CPU percentage</option>
                <option>Data IO percentage</option>
                <option>Log IO percentage</option>
                <option>Deadlocks</option>
                <option>Storage percentage</option>
                <option>Successful connections</option>
                <option>Failed connections</option>
                <option>Blocked by Firewall</option>
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
              onAdd({ name, signal, operator, threshold, window, severity, enabled: true, fired: 0 });
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
            <th>Last 30d</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sql.alertRules.length === 0 ? (
            <tr>
              <td colSpan={7}>No alert rules defined.</td>
            </tr>
          ) : (
            sql.alertRules.map((a, i) => (
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
                <td>{a.fired} fires last 30d</td>
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
      <p className={styles.help} style={{ marginTop: 12 }}>
        <b>Common DB signals:</b> DTU%, CPU%, Data IO%, Log IO%, Deadlocks, Storage % allocated, Successful connections, Failed connections, Blocked by Firewall, Sessions percentage, Workers percentage.
      </p>
    </div>
  );
}

export function SecDiagSettings({
  sql,
  onAdd,
  onDelete,
}: {
  sql: SqlResource;
  onAdd: (setting: Omit<SqlDiagSetting, "id">) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("send-to-sentinel");
  const [destination, setDestination] = useState("Log Analytics workspace");
  const [target, setTarget] = useState("law-sentinel-prod-eastus2");
  const [logs, setLogs] = useState("allLogs");
  const [metrics, setMetrics] = useState("allMetrics");

  return (
    <div className={styles.sectionCard}>
      <h3>Diagnostic settings</h3>
      <p>Stream diagnostic logs to Log Analytics, Event Hubs, Storage, or a Partner solution.</p>
      <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
        + Add diagnostic setting
      </button>
      {showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Destination">
              <NativeSelect value={destination} onChange={setDestination}>
                <option>Log Analytics workspace</option>
                <option>Event Hub</option>
                <option>Storage account</option>
              </NativeSelect>
            </Field>
            <Field label="Target name">
              <input value={target} onChange={(e) => setTarget(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Logs">
              <input value={logs} onChange={(e) => setLogs(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Metrics">
              <input value={metrics} onChange={(e) => setMetrics(e.target.value)} className={styles.input} />
            </Field>
          </div>
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 8 }}
            onClick={() => {
              if (!name) return;
              onAdd({ name, destination, target, logs, metrics });
              setShowForm(false);
            }}
          >
            Save
          </button>
        </div>
      ) : null}
      <table className={styles.table} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Destination type</th>
            <th>Target</th>
            <th>Logs</th>
            <th>Metrics</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sql.diagSettings.length === 0 ? (
            <tr>
              <td colSpan={6}>No diagnostic settings.</td>
            </tr>
          ) : (
            sql.diagSettings.map((d, i) => (
              <tr key={d.id}>
                <td>
                  <b>{d.name}</b>
                </td>
                <td>{d.destination}</td>
                <td>{d.target}</td>
                <td>{d.logs}</td>
                <td>{d.metrics}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className={styles.help} style={{ marginTop: 12 }}>
        <b>Recommended:</b> Forward <code>SQLInsights</code> + <code>AutomaticTuning</code> + <code>QueryStoreRuntimeStatistics</code> + <code>QueryStoreWaitStatistics</code> + <code>Errors</code> + <code>DatabaseWaitStatistics</code> + <code>Timeouts</code> + <code>Blocks</code> + <code>Deadlocks</code> + <code>SQLSecurityAuditEvents</code> + <code>DevOpsOperationsAudit</code> to a central Sentinel workspace.
      </p>
    </div>
  );
}

function sqlQ(title: string, q: string) {
  return (
    <div
      key={title}
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
      <div style={{ color: "#9cdcfe", fontWeight: 600, marginBottom: 6, fontFamily: "Segoe UI, sans-serif", fontSize: 12 }}>{title}</div>
      {q}
    </div>
  );
}

export function SecLogs() {
  return (
    <div className={styles.sectionCard}>
      <h3>Logs</h3>
      <p>Run KQL queries over diagnostic logs forwarded to Log Analytics workspaces.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {sqlQ(
          "Slowest queries last 24h",
          'AzureDiagnostics\n| where Category == "QueryStoreRuntimeStatistics"\n| summarize avg_duration = avg(duration_d) by query_hash_s, query_id_d\n| top 10 by avg_duration desc',
        )}
        {sqlQ(
          "Deadlock graphs",
          'AzureDiagnostics\n| where Category == "Deadlocks"\n| project TimeGenerated, victim_resource_s, deadlock_xml_s\n| order by TimeGenerated desc',
        )}
        {sqlQ(
          "Connection failures by source IP",
          'AzureDiagnostics\n| where Category == "DevOpsOperationsAudit" and action_name_s == "ConnectionFailed"\n| summarize Failures = count() by client_ip_s, error_message_s\n| top 25 by Failures',
        )}
        {sqlQ(
          "Firewall blocks (no IP rule match)",
          'AzureDiagnostics\n| where Category == "SQLSecurityAuditEvents" and statement_s contains "FW"\n| project TimeGenerated, client_ip_s, server_principal_name_s, statement_s',
        )}
        {sqlQ(
          "DTU pressure events",
          'AzureMetrics\n| where ResourceProvider == "MICROSOFT.SQL" and MetricName == "dtu_consumption_percent"\n| where Average > 80\n| project TimeGenerated, Resource, Average',
        )}
        {sqlQ(
          "Failed logins (potential brute force)",
          'AzureDiagnostics\n| where Category == "SQLSecurityAuditEvents" and action_name_s == "FAILED_DATABASE_AUTHENTICATION_GROUP"\n| summarize Failures = count() by client_ip_s, server_principal_name_s, bin(TimeGenerated, 5m)\n| where Failures > 10',
        )}
      </div>
    </div>
  );
}
