"use client";

import { useMemo, useState } from "react";

import type { StorageAlertRule, StorageInventoryRule, StorageLifecycleRule, StorageObjectReplRule, StorageResource } from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";
import { Field, NativeSelect } from "./wizard-fields";

export function SecLifecycle({
  sa,
  onAdd,
  onToggle,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (rule: StorageLifecycleRule) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [blobType, setBlobType] = useState("Block");
  const [scope, setScope] = useState("All");
  const [transitions, setTransitions] = useState("Cool 30d → Archive 90d → Delete 365d");

  return (
    <div className={styles.sectionCard}>
      <h3>Lifecycle management</h3>
      <p>Manage data lifecycle by automatically transitioning blobs to cooler storage tiers and deleting old data.</p>
      <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
        + Add a rule
      </button>
      {showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Rule name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Blob type">
              <NativeSelect value={blobType} onChange={setBlobType}>
                <option>Block</option>
                <option>Append</option>
                <option>Page</option>
                <option>All</option>
              </NativeSelect>
            </Field>
            <Field label="Scope">
              <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Container prefix or All" className={styles.input} />
            </Field>
            <Field label="Transitions">
              <input value={transitions} onChange={(e) => setTransitions(e.target.value)} className={styles.input} />
            </Field>
          </div>
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 8 }}
            onClick={() => {
              if (!name) return;
              onAdd({ name, blobType, scope, transitions, enabled: true });
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
            <th>Rule name</th>
            <th>Status</th>
            <th>Blob type</th>
            <th>Scope</th>
            <th>Transitions</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.lifecycleRules.length === 0 ? (
            <tr>
              <td colSpan={6}>No lifecycle management rules.</td>
            </tr>
          ) : (
            sa.lifecycleRules.map((l, i) => (
              <tr key={i}>
                <td>
                  <strong>{l.name}</strong>
                </td>
                <td>
                  {l.enabled ? (
                    <span className={`${styles.containerPublic} ${styles.containerPublicBlob}`}>Enabled</span>
                  ) : (
                    "Disabled"
                  )}
                </td>
                <td>{l.blobType}</td>
                <td>{l.scope}</td>
                <td style={{ fontSize: 11 }}>{l.transitions}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Delete
                  </button>{" "}
                  &middot;{" "}
                  <button type="button" className={styles.link} onClick={() => onToggle(i)}>
                    {l.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className={styles.help} style={{ marginTop: 12 }}>
        Example rule: <i>Move to cool tier after 30 days of last modification, then archive after 90 days, then delete after 365 days.</i>
      </p>
    </div>
  );
}

export function SecObjectRepl({
  sa,
  onAdd,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (rule: StorageObjectReplRule) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [srcContainer, setSrcContainer] = useState("images");
  const [dstAccount, setDstAccount] = useState("stcloudlabdr01");
  const [dstContainer, setDstContainer] = useState("images-replica");
  const [copyScope, setCopyScope] = useState("Newly added blobs only");

  return (
    <div className={styles.sectionCard}>
      <h3>Object replication</h3>
      <p>Asynchronously replicate block blobs between a source and destination storage account. Both accounts must have versioning + change feed enabled.</p>
      <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
        + Create replication rule
      </button>
      {showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Rule name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Source container">
              <input value={srcContainer} onChange={(e) => setSrcContainer(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Destination account">
              <input value={dstAccount} onChange={(e) => setDstAccount(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Destination container">
              <input value={dstContainer} onChange={(e) => setDstContainer(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Copy scope">
              <NativeSelect value={copyScope} onChange={setCopyScope}>
                <option>All</option>
                <option>Newly added blobs only</option>
              </NativeSelect>
            </Field>
          </div>
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 8 }}
            onClick={() => {
              if (!name) return;
              onAdd({ name, srcContainer, dstAccount, dstContainer, copyScope, status: "Active" });
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
            <th>Rule name</th>
            <th>Source container</th>
            <th>Destination</th>
            <th>Copy scope</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.objectReplRules.length === 0 ? (
            <tr>
              <td colSpan={6}>No replication rules.</td>
            </tr>
          ) : (
            sa.objectReplRules.map((o, i) => (
              <tr key={i}>
                <td>{o.name}</td>
                <td>{o.srcContainer}</td>
                <td>
                  {o.dstAccount}/{o.dstContainer}
                </td>
                <td>{o.copyScope}</td>
                <td>{o.status}</td>
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
        Latency: typically &lt; 15 min. Replication is async — writes succeed on source before being replicated. RPO is bounded by Microsoft 99.9% SLA.
      </p>
    </div>
  );
}

export function SecInventory({
  sa,
  onAdd,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (rule: StorageInventoryRule) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [dest, setDest] = useState("inventory");
  const [format, setFormat] = useState<StorageInventoryRule["format"]>("Parquet");
  const [frequency, setFrequency] = useState<StorageInventoryRule["frequency"]>("Daily");
  const [fields, setFields] = useState("Name, Creation-Time, Last-Modified, Content-Length, BlobType, AccessTier");

  return (
    <div className={styles.sectionCard}>
      <h3>Blob inventory</h3>
      <p>Generates an inventory of blobs and their properties on a daily or weekly basis. Output as CSV or Parquet to a destination container.</p>
      <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
        + Add inventory rule
      </button>
      {showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Rule name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Destination container">
              <input value={dest} onChange={(e) => setDest(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Format">
              <NativeSelect value={format} onChange={(v) => setFormat(v as StorageInventoryRule["format"])}>
                <option>Csv</option>
                <option>Parquet</option>
              </NativeSelect>
            </Field>
            <Field label="Frequency">
              <NativeSelect value={frequency} onChange={(v) => setFrequency(v as StorageInventoryRule["frequency"])}>
                <option>Daily</option>
                <option>Weekly</option>
              </NativeSelect>
            </Field>
            <Field label="Fields">
              <input value={fields} onChange={(e) => setFields(e.target.value)} className={styles.input} />
            </Field>
          </div>
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 8 }}
            onClick={() => {
              if (!name) return;
              onAdd({ name, dest, format, frequency, fields });
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
            <th>Rule name</th>
            <th>Destination container</th>
            <th>Format</th>
            <th>Frequency</th>
            <th>Fields</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.inventoryRules.length === 0 ? (
            <tr>
              <td colSpan={6}>No inventory rules.</td>
            </tr>
          ) : (
            sa.inventoryRules.map((r, i) => (
              <tr key={i}>
                <td>{r.name}</td>
                <td>{r.dest}</td>
                <td>{r.format}</td>
                <td>{r.frequency}</td>
                <td style={{ fontSize: 11 }}>{r.fields}</td>
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
        Typical fields: Name, Creation-Time, Last-Modified, Content-Length, BlobType, AccessTier, EncryptionScope, ETag.
      </p>
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

export function SecInsights() {
  const heights = useMemo(() => [42, 67, 55, 71, 48, 62, 39, 51], []);
  return (
    <div className={styles.sectionCard}>
      <h3>Insights</h3>
      <p>Monitor the performance and availability of your storage account.</p>
      <Bars heights={heights} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
        <MiniMetric label="Transactions" value="1.2K" color="#0078d4" />
        <MiniMetric label="Ingress" value="142 MB" color="#107c10" />
        <MiniMetric label="Egress" value="88 MB" color="#d83b01" />
        <MiniMetric label="Avail." value="100%" color="#7719aa" />
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
          <option>Used capacity</option>
          <option>Transactions</option>
          <option>Ingress</option>
          <option>Egress</option>
          <option>Availability</option>
          <option>Success E2E Latency</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Avg</option>
          <option>Sum</option>
          <option>Min</option>
          <option>Max</option>
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

export function SecAlerts({
  sa,
  onAdd,
  onToggle,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (rule: Omit<StorageAlertRule, "id">) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [signal, setSignal] = useState("Transactions");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("10000");
  const [window, setWindow] = useState("5m");
  const [severity, setSeverity] = useState("Sev2");

  return (
    <div className={styles.sectionCard}>
      <h3>Alert rules</h3>
      <p>Set up alert rules based on storage metrics and activity logs. Notify via email, SMS, or webhook.</p>
      <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
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
                <option>Transactions</option>
                <option>Availability</option>
                <option>UsedCapacity</option>
                <option>SuccessE2ELatency</option>
                <option>Ingress</option>
                <option>Egress</option>
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
            <Field label="Aggregation window">
              <NativeSelect value={window} onChange={setWindow}>
                <option>5m</option>
                <option>15m</option>
                <option>1h</option>
                <option>6h</option>
                <option>24h</option>
              </NativeSelect>
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
          {sa.alertRules.length === 0 ? (
            <tr>
              <td colSpan={6}>No alert rules.</td>
            </tr>
          ) : (
            sa.alertRules.map((a, i) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.name}</strong>
                </td>
                <td>{a.signal}</td>
                <td>
                  {a.operator} {a.threshold}
                </td>
                <td>{a.window}</td>
                <td>{a.severity}</td>
                <td>
                  {a.enabled ? (
                    <span className={`${styles.containerPublic} ${styles.containerPublicBlob}`}>Enabled</span>
                  ) : (
                    "Disabled"
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
        Common signals: <code>Transactions</code>, <code>Availability</code>, <code>UsedCapacity</code>, <code>SuccessE2ELatency</code>, <code>Ingress</code>, <code>Egress</code>.
      </p>
    </div>
  );
}
