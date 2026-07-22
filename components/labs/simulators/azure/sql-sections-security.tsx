"use client";

import type { SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";

export function SecAuditing({
  sql,
  onToggle,
  onSetRetention,
}: {
  sql: SqlResource;
  onToggle: (enabled: boolean) => void;
  onSetRetention: (days: number) => void;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Auditing</h3>
      <p>SQL auditing tracks database events and writes them to an audit log in your Azure storage account, Log Analytics, or Event Hub.</p>
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={sql.auditingEnabled} onChange={(e) => onToggle(e.target.checked)} />
        Enable Azure SQL auditing
      </label>
      {sql.auditingEnabled ? (
        <>
          <div className={styles.sliderRow} style={{ marginTop: 14 }}>
            <span>Retention (days)</span>
            <input type="range" min={0} max={3285} value={sql.auditRetentionDays} onChange={(e) => onSetRetention(parseInt(e.target.value, 10))} />
            <span className="val">{sql.auditRetentionDays} days</span>
          </div>
          <p className={styles.help}>0 means unlimited retention.</p>
        </>
      ) : null}
    </div>
  );
}

export function SecDefender({ sql, onToggle }: { sql: SqlResource; onToggle: () => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Microsoft Defender for SQL</h3>
      <p>Detect anomalous activities and potential vulnerabilities, including SQL injection, brute-force access, and data exfiltration.</p>
      <p>
        <b>Status:</b>{" "}
        <span className={`${styles.badge} ${sql.defender ? styles.badgeRunning : styles.badgeOutline}`}>{sql.defender ? "Enabled" : "Not enabled"}</span>
      </p>
      <button type="button" className={styles.btn} onClick={onToggle}>
        {sql.defender ? "Disable Defender" : "Enable Defender (free trial)"}
      </button>
    </div>
  );
}

export function SecTde({ sql, onSetTde }: { sql: SqlResource; onSetTde: (option: SqlResource["tdeOption"]) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Transparent data encryption</h3>
      <p>TDE encrypts the storage of an entire database by using a symmetric key called the Database Encryption Key.</p>
      <p>
        <b>Status:</b> <span className={`${styles.badge} ${styles.badgeRunning}`}>On</span>
      </p>
      <p style={{ marginTop: 10 }}>
        <b>Key:</b> {sql.tdeOption}
      </p>
      <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8, marginTop: 12 }}>
        <label className={styles.radioOption}>
          <input type="radio" name="tdeKey" checked={sql.tdeOption === "Service-managed key"} onChange={() => onSetTde("Service-managed key")} />
          Service-managed key
        </label>
        <label className={styles.radioOption}>
          <input type="radio" name="tdeKey" checked={sql.tdeOption === "Customer-managed key"} onChange={() => onSetTde("Customer-managed key")} />
          Customer-managed key (Key Vault)
        </label>
      </div>
    </div>
  );
}

export function SecLedger({ sql }: { sql: SqlResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Ledger</h3>
      <p>Ledger provides tamper-evidence using cryptographic hashes. Once a row is written, any subsequent modification is detectable.</p>
      <p>
        <b>Status:</b> <span className={`${styles.badge} ${sql.ledger ? styles.badgeRunning : styles.badgeOutline}`}>{sql.ledger ? "Enabled" : "Disabled"}</span>
      </p>
      {sql.ledger ? (
        <p className={styles.help} style={{ marginTop: 12 }}>Ledger cannot be disabled once a database is created with it enabled.</p>
      ) : (
        <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
          Enable
        </button>
      )}
    </div>
  );
}

export function SecDynamicMask() {
  return (
    <div className={styles.sectionCard}>
      <h3>Dynamic Data Masking</h3>
      <p>Limits sensitive data exposure by masking it to non-privileged users.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Schema</th>
            <th>Table</th>
            <th>Column</th>
            <th>Masking function</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4}>No masking rules configured.</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        + Add mask
      </button>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

export function SecClassify() {
  return (
    <div className={styles.sectionCard}>
      <h3>Data Discovery &amp; Classification</h3>
      <p>Discover, classify, label, and report sensitive data in your database.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
        <MiniMetric label="Classified columns" value="0" color="#0078d4" />
        <MiniMetric label="Recommendations" value="14" color="#107c10" />
        <MiniMetric label="Tables scanned" value="0" color="#7719aa" />
      </div>
      <button type="button" className={styles.btn} style={{ marginTop: 14 }}>
        Run discovery scan
      </button>
    </div>
  );
}

export function SecAlwaysEncrypted() {
  return (
    <div className={styles.sectionCard}>
      <h3>Always Encrypted</h3>
      <p>Always Encrypted ensures sensitive data, such as credit card numbers, is never exposed in plaintext on the database server.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Key store</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3}>No keys configured.</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        + Configure Always Encrypted keys
      </button>
    </div>
  );
}
