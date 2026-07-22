"use client";

import { useState } from "react";

import { DTU_TIERS, VCORE_TIERS } from "@/lib/labs/simulators/azure/sqlData";
import type { SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";
import { Field } from "./wizard-fields";

export function SecCompute({ sql, onChangeTier }: { sql: SqlResource; onChangeTier: (model: "DTU" | "vCore", tierId: string) => void }) {
  const isDtu = sql.pricingModel === "DTU";
  return (
    <div className={styles.sectionCard}>
      <h3>Compute + storage — current: {sql.serviceTier}</h3>
      <p>Click a tier to re-tier the database. Re-tiering is online and the database remains available.</p>
      <table className={styles.table}>
        <thead>
          {isDtu ? (
            <tr>
              <th>Tier</th>
              <th>Max DTU</th>
              <th>Max storage</th>
              <th>Cost</th>
            </tr>
          ) : (
            <tr>
              <th>Tier</th>
              <th>Description</th>
              <th>Estimated cost</th>
            </tr>
          )}
        </thead>
        <tbody>
          {isDtu
            ? DTU_TIERS.map((t) => (
                <tr key={t.id} onClick={() => onChangeTier("DTU", t.id)} style={{ cursor: "pointer", background: sql.serviceTier === t.id ? "#f3f9fd" : undefined }}>
                  <td>{t.label}</td>
                  <td>{t.dtu} DTU</td>
                  <td>up to {t.maxGB} GB</td>
                  <td>${t.cost.toFixed(2)}/mo</td>
                </tr>
              ))
            : VCORE_TIERS.map((t) => {
                const estCost = t.baseCost * (sql.vCores ?? 2) * 730;
                return (
                  <tr key={t.id} onClick={() => onChangeTier("vCore", t.id)} style={{ cursor: "pointer", background: sql.serviceTier === t.label ? "#f3f9fd" : undefined }}>
                    <td>{t.label}</td>
                    <td>{t.desc}</td>
                    <td>
                      ~${estCost.toFixed(2)}/mo ({sql.vCores ?? 2} vCore)
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: 13 }}>
        <b>Data max size:</b> {sql.dataMaxGB} GB &nbsp; <b>Backup redundancy:</b> {sql.backupRedundancy}
      </p>
    </div>
  );
}

const CONN_TABS = [
  { id: "ADO.NET" },
  { id: "JDBC" },
  { id: "ODBC" },
  { id: "PHP" },
  { id: "Python" },
] as const;

export function SecConnStrings({ sql }: { sql: SqlResource }) {
  const [active, setActive] = useState<(typeof CONN_TABS)[number]["id"]>("ADO.NET");
  const srv = sql.serverFQDN;
  const db = sql.name;
  const user = sql.serverAdminLogin;

  const strings: Record<(typeof CONN_TABS)[number]["id"], string> = {
    "ADO.NET": `Server=tcp:${srv},1433;Initial Catalog=${db};Persist Security Info=False;User ID=${user};Password={your_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`,
    JDBC: `jdbc:sqlserver://${srv}:1433;database=${db};user=${user}@${sql.server};password={your_password};encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30;`,
    ODBC: `Driver={ODBC Driver 18 for SQL Server};Server=tcp:${srv},1433;Database=${db};Uid=${user};Pwd={your_password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;`,
    PHP: `$conn = new PDO("sqlsrv:server = tcp:${srv},1433; Database = ${db}", "${user}", "{your_password}");`,
    Python: `import pyodbc\nconn = pyodbc.connect(\n  "Driver={ODBC Driver 18 for SQL Server};"\n  "Server=tcp:${srv},1433;"\n  "Database=${db};"\n  "Uid=${user};Pwd={your_password};"\n  "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"\n)`,
  };

  return (
    <div className={styles.sectionCard}>
      <h3>Connection strings</h3>
      <div className={styles.connTabs}>
        {CONN_TABS.map((t) => (
          <div key={t.id} className={`${styles.connTab} ${active === t.id ? styles.connTabActive : ""}`} onClick={() => setActive(t.id)}>
            {t.id === "Python" ? "Python (pyodbc)" : t.id}
          </div>
        ))}
      </div>
      <div className={styles.connString}>{strings[active]}</div>
      <p className={styles.help} style={{ marginTop: 12 }}>
        Replace <b>{"{your_password}"}</b> with the actual password configured for the server admin login.
      </p>
    </div>
  );
}

export function SecGeoReplication() {
  const regions = [
    { name: "East US", status: "Primary", primary: true },
    { name: "West Europe", status: "No replica", primary: false },
    { name: "Southeast Asia", status: "No replica", primary: false },
    { name: "Australia East", status: "No replica", primary: false },
    { name: "Japan East", status: "No replica", primary: false },
  ];
  return (
    <div className={styles.sectionCard}>
      <h3>Geo-Replication</h3>
      <p>Configure readable secondary replicas in different regions for disaster recovery and load balancing.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, padding: 14, background: "#faf9f8", border: "1px solid #edebe9", marginTop: 10 }}>
        {regions.map((r) => (
          <div key={r.name} style={{ textAlign: "center" }}>
            <b>{r.name}</b>
            <br />
            <span className={`${styles.badge} ${r.primary ? styles.badgeRunning : styles.badgeOutline}`}>{r.status}</span>
          </div>
        ))}
      </div>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        + Add replica
      </button>
    </div>
  );
}

export function SecFailoverGroups() {
  return (
    <div className={styles.sectionCard}>
      <h3>Failover groups</h3>
      <p>A failover group is a named group of databases that fail over together to a secondary server in another region.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Primary server</th>
            <th>Secondary server</th>
            <th>Read/write listener</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4}>No failover groups configured.</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        + Add failover group
      </button>
    </div>
  );
}

export function SecBackups({
  sql,
  onSaveLtr,
}: {
  sql: SqlResource;
  onSaveLtr: (weekly: number, monthly: number, yearly: number) => void;
}) {
  const [weekly, setWeekly] = useState(sql.ltrWeekly);
  const [monthly, setMonthly] = useState(sql.ltrMonthly);
  const [yearly, setYearly] = useState(sql.ltrYearly);
  const earliestRestore = new Date(Date.now() - 7 * 86400000);

  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Backups</h3>
        <p style={{ marginTop: 12 }}>
          Azure SQL automatically takes a full backup every week, differential backups every 12-24 hours, and transaction log backups every 5-10 minutes.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Database</th>
              <th>Earliest restore point</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{sql.name}</td>
              <td>{earliestRestore.toLocaleString()}</td>
              <td>
                <button type="button" className={styles.btnOutline}>
                  Restore
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={styles.sectionCard}>
        <h3>Long-term retention policy</h3>
        <p>Keep backups for years to meet compliance requirements.</p>
        <div className={styles.sliderRow}>
          <span>Weekly retention (weeks)</span>
          <input type="range" min={0} max={520} value={weekly} onChange={(e) => setWeekly(parseInt(e.target.value, 10))} />
          <span className="val">{weekly} weeks</span>
        </div>
        <div className={styles.sliderRow}>
          <span>Monthly retention (months)</span>
          <input type="range" min={0} max={120} value={monthly} onChange={(e) => setMonthly(parseInt(e.target.value, 10))} />
          <span className="val">{monthly} months</span>
        </div>
        <div className={styles.sliderRow}>
          <span>Yearly retention (years)</span>
          <input type="range" min={0} max={10} value={yearly} onChange={(e) => setYearly(parseInt(e.target.value, 10))} />
          <span className="val">{yearly} years</span>
        </div>
        <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => onSaveLtr(weekly, monthly, yearly)}>
          Apply
        </button>
      </div>
    </>
  );
}

export function SecExport({ sql }: { sql: SqlResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Export database</h3>
      <p>Export the database to a BACPAC file stored in an Azure Storage account.</p>
      <Field label="Storage account">
        <select className={styles.select}>
          <option>(select a storage account)</option>
        </select>
      </Field>
      <Field label="Authentication type">
        <select className={styles.select}>
          <option>SQL Server authentication</option>
          <option>Microsoft Entra ID</option>
        </select>
      </Field>
      <Field label="Login">
        <input defaultValue={sql.serverAdminLogin} className={styles.input} />
      </Field>
      <Field label="Password">
        <input type="password" placeholder="Enter password" className={styles.input} />
      </Field>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        OK
      </button>
    </div>
  );
}

export function SecImportHistory() {
  return (
    <div className={styles.sectionCard}>
      <h3>Import / Export history</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Started</th>
            <th>Completed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4}>No import/export operations in the last 30 days.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
