"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({ sql, onOpenConnStrings, onEditTags }: { sql: SqlResource; onOpenConnStrings: () => void; onEditTags: () => void }) {
  const [driver, setDriver] = useState("");
  const tier = sql.pricingModel === "DTU" ? `${sql.serviceTier} (${sql.dtu ?? 0} DTU)` : `${sql.serviceTier} (${sql.vCores ?? 0} vCore, ${sql.computeTier})`;
  const preview = driver ? connectionPreview(sql, driver) : null;

  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={sql.resourceGroup} />
          <PropPair label="Status" value={<span className={`${styles.badge} ${sql.status === "Online" ? styles.badgeRunning : styles.badgeOutline}`}>{sql.status}</span>} />
          <PropPair label="Location" value={sql.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="Subscription ID" value={SUBSCRIPTION.id} />
          <PropPair label="Server name" value={sql.server} />
          <PropPair label="Server FQDN" value={sql.serverFQDN} />
          <PropPair label="Server admin login" value={sql.serverAdminLogin} />
          <PropPair label="Pricing tier" value={tier} />
          <PropPair label="Service tier" value={sql.serviceTier} />
          <PropPair label="Data max size" value={`${sql.dataMaxGB} GB`} />
          <PropPair label="Backup redundancy" value={sql.backupRedundancy} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Connection strings</h3>
        <p>
          <button type="button" className={styles.link} onClick={onOpenConnStrings}>
            Show database connection strings
          </button>
        </p>
        <select className={styles.select} style={{ width: 240 }} value={driver} onChange={(e) => setDriver(e.target.value)}>
          <option value="">Select a driver to preview…</option>
          <option value="ADO.NET">ADO.NET</option>
          <option value="JDBC">JDBC</option>
          <option value="ODBC">ODBC</option>
          <option value="PHP">PHP</option>
          <option value="Python">Python (pyodbc)</option>
        </select>
        {preview ? <div className={styles.connString} style={{ marginTop: 8 }}>{preview}</div> : null}
      </div>
      <div className={styles.sectionCard}>
        <h3>Properties</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Collation" value={sql.collation} />
          <PropPair label="Connection policy" value={sql.connectionPolicy} />
          <PropPair label="Min TLS version" value={sql.minTlsVersion} />
          <PropPair label="Public network access" value={sql.publicAccess ? "Enabled" : "Disabled"} />
          <PropPair label="Created on" value={new Date(sql.createdAt).toLocaleString()} />
          <PropPair label="Estimated cost" value={`$${sql.estimatedCost.toFixed(2)}/month`} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(sql.tags).length === 0 ? (
          <p>
            No tags.{" "}
            <button type="button" className={styles.link} onClick={onEditTags}>
              Click here to add tags.
            </button>
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(sql.tags).map(([k, v]) => (
              <span key={k} className={`${styles.badge} ${styles.badgeOutline}`}>
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function connectionPreview(sql: SqlResource, driver: string): string {
  const srv = sql.serverFQDN;
  const db = sql.name;
  const user = sql.serverAdminLogin;
  if (driver === "ADO.NET") return `Server=tcp:${srv},1433;Database=${db};User ID=${user};Password={your_password};Encrypt=True;`;
  if (driver === "JDBC") return `jdbc:sqlserver://${srv}:1433;database=${db};user=${user};password={your_password};encrypt=true;`;
  if (driver === "ODBC") return `Driver={ODBC Driver 18 for SQL Server};Server=tcp:${srv},1433;Database=${db};Uid=${user};Pwd={your_password};`;
  if (driver === "PHP") return `$conn = new PDO("sqlsrv:server=tcp:${srv},1433; Database=${db}", "${user}", "{your_password}");`;
  return `pyodbc.connect("Driver={ODBC Driver 18 for SQL Server};Server=tcp:${srv},1433;Database=${db};Uid=${user};Pwd={your_password};")`;
}

export function SecActivity({ sql, activityLog }: { sql: SqlResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === sql.name).slice(0, 20);
  return (
    <div className={styles.sectionCard}>
      <h3>Activity log</h3>
      {logs.length === 0 ? (
        <p>No activity for this resource.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Operation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.operation}</td>
                <td>
                  <span className={`${styles.badge} ${l.status === "Succeeded" ? styles.badgeRunning : styles.badgeOutline}`}>{l.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SecIAM() {
  return (
    <div className={styles.sectionCard}>
      <h3>Access control (IAM)</h3>
      <p style={{ fontWeight: 600 }}>Built-in roles available for SQL Database:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>SQL DB Contributor — Manage SQL databases, but not access to them.</li>
        <li>SQL Server Contributor — Manage SQL servers and databases, but not access.</li>
        <li>SQL Security Manager — Manage the security-related policies of SQL servers and databases.</li>
        <li>Reader — View resources, but not make changes.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  sql,
  onAddTag,
  onDeleteTag,
}: {
  sql: SqlResource;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Tags</h3>
      <table className={styles.table} style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Object.keys(sql.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add a tag below.</td>
            </tr>
          ) : (
            Object.entries(sql.tags).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDeleteTag(k)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Name" className={styles.input} style={{ width: 160 }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={styles.input} style={{ width: 160 }} />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!key) return;
            onAddTag(key, value);
            setKey("");
            setValue("");
          }}
        >
          Add tag
        </button>
      </div>
    </div>
  );
}

export function SecDiagnose() {
  return (
    <div className={styles.sectionCard}>
      <h3>Diagnose and solve problems</h3>
      <p>Common issues: connectivity, performance, query throttling, blocking, deadlocks.</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>Database connectivity errors</li>
        <li>Performance issues</li>
        <li>Resource limit (DTU/vCore) errors</li>
        <li>Backup and restore issues</li>
      </ul>
    </div>
  );
}

export function SecQuickStart({ sql, onOpenQueryEditor, onOpenConnStrings }: { sql: SqlResource; onOpenQueryEditor: () => void; onOpenConnStrings: () => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Quick start</h3>
      <ol style={{ lineHeight: 1.8, paddingLeft: 20 }}>
        <li>Set the server-level firewall to allow your current client IP.</li>
        <li>
          Connect via <b>Query editor</b> (in this portal) or <b>SQL Server Management Studio (SSMS)</b> using server <code>{sql.serverFQDN}</code>.
        </li>
        <li>
          Run the sample query: <code>SELECT @@VERSION</code> to verify connectivity.
        </li>
        <li>Create your first table and load data via the Query editor or BCP / SSIS / Data Factory.</li>
        <li>
          Configure <b>Backups</b> retention and verify <b>Geo-Replication</b> for production workloads.
        </li>
      </ol>
      <div style={{ marginTop: 12 }}>
        <button type="button" className={styles.btn} onClick={onOpenQueryEditor}>
          Open Query editor
        </button>{" "}
        <button type="button" className={styles.btnOutline} onClick={onOpenConnStrings}>
          Show connection strings
        </button>
      </div>
    </div>
  );
}

export function SecProperties({ sql, subscriptionId }: { sql: SqlResource; subscriptionId: string }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair label="Name" value={sql.name} />
        <PropPair label="Resource ID" value={`/subscriptions/${subscriptionId}/resourceGroups/${sql.resourceGroup}/providers/Microsoft.Sql/servers/${sql.server}/databases/${sql.name}`} />
        <PropPair label="Resource group" value={sql.resourceGroup} />
        <PropPair label="Location" value={sql.region} />
        <PropPair label="Subscription" value={SUBSCRIPTION.name} />
        <PropPair label="Subscription ID" value={subscriptionId} />
        <PropPair label="Provisioning state" value="Succeeded" />
        <PropPair label="Server FQDN" value={sql.serverFQDN} />
        <PropPair label="Created on" value={new Date(sql.createdAt).toISOString()} />
      </div>
    </div>
  );
}

export function SecLocks() {
  return (
    <div className={styles.sectionCard}>
      <h3>Locks</h3>
      <p>Locks prevent other users from accidentally deleting or modifying critical resources.</p>
      <button type="button" className={styles.btn}>
        + Add
      </button>
      <p style={{ marginTop: 12 }}>No locks defined for this database.</p>
    </div>
  );
}
