"use client";

import { useState } from "react";

import type { StorageContainer, StorageFileShare, StorageQueue, StorageResource, StorageTable } from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const TABLE_NAME_RE = /^[A-Za-z][A-Za-z0-9]{2,62}$/;

export function SecContainers({
  sa,
  onAdd,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (container: StorageContainer) => void;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState<StorageContainer["publicAccess"]>("Private");
  const [error, setError] = useState("");

  function accessClass(access: StorageContainer["publicAccess"]) {
    if (access === "Blob") return styles.containerPublicBlob;
    if (access === "Container") return styles.containerPublicContainer;
    return "";
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Containers</h3>
      <p>A container organizes a set of blobs, similar to a directory in a file system.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New container name (3-63 lowercase letters/digits/hyphens)"
          className={styles.input}
          style={{ flex: 1 }}
        />
        <select value={access} onChange={(e) => setAccess(e.target.value as StorageContainer["publicAccess"])} className={styles.select} style={{ width: "auto" }}>
          <option>Private</option>
          <option>Blob</option>
          <option>Container</option>
        </select>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              setError("Container name is required.");
              return;
            }
            if (!NAME_RE.test(trimmed)) {
              setError("Container name must be 3-63 lowercase letters, digits, or hyphens.");
              return;
            }
            if (sa.containers.some((c) => c.name === trimmed)) {
              setError("A container with that name already exists.");
              return;
            }
            onAdd({ name: trimmed, publicAccess: access, lastModified: new Date().toISOString(), leaseStatus: "Unlocked" });
            setName("");
            setError("");
          }}
        >
          + Container
        </button>
      </div>
      {error ? <p style={{ color: "#a4262c", fontSize: 12, marginBottom: 8 }}>{error}</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Public access level</th>
            <th>Last modified</th>
            <th>Lease state</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.containers.length === 0 ? (
            <tr>
              <td colSpan={5}>No containers. Click + Container to create one.</td>
            </tr>
          ) : (
            sa.containers.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td>
                  <span className={`${styles.containerPublic} ${accessClass(c.publicAccess)}`}>{c.publicAccess}</span>
                </td>
                <td>{new Date(c.lastModified).toLocaleString()}</td>
                <td>{c.leaseStatus}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(c.name)}>
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

export function SecFileShares({
  sa,
  onAdd,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (share: StorageFileShare) => void;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("1024");
  const [tier, setTier] = useState<StorageFileShare["tier"]>("TransactionOptimized");
  const [protocol, setProtocol] = useState<StorageFileShare["protocol"]>("SMB");
  const [error, setError] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>File shares</h3>
      <p>File shares offer fully managed file shares in the cloud, accessible via SMB and NFS protocols.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Share name (3-63 lowercase letters/digits/hyphens)" className={styles.input} style={{ flex: 1, minWidth: 200 }} />
        <input value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="Quota GiB" className={styles.input} style={{ width: 120 }} />
        <select value={tier} onChange={(e) => setTier(e.target.value as StorageFileShare["tier"])} className={styles.select} style={{ width: "auto" }}>
          <option>TransactionOptimized</option>
          <option>Hot</option>
          <option>Cool</option>
          <option>Premium</option>
        </select>
        <select value={protocol} onChange={(e) => setProtocol(e.target.value as StorageFileShare["protocol"])} className={styles.select} style={{ width: "auto" }}>
          <option>SMB</option>
          <option>NFS</option>
        </select>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              setError("Share name is required.");
              return;
            }
            if (!NAME_RE.test(trimmed)) {
              setError("Share name must be 3-63 lowercase letters, digits, or hyphens.");
              return;
            }
            if (sa.fileShares.some((s) => s.name === trimmed)) {
              setError("Share already exists.");
              return;
            }
            onAdd({ name: trimmed, quotaGiB: parseInt(quota, 10) || 1024, tier, protocol, created: new Date().toISOString().substring(0, 10) });
            setName("");
            setError("");
          }}
        >
          + File share
        </button>
      </div>
      {error ? <p style={{ color: "#a4262c", fontSize: 12, marginBottom: 8 }}>{error}</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Quota</th>
            <th>Protocol</th>
            <th>Tier</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.fileShares.length === 0 ? (
            <tr>
              <td colSpan={6}>No file shares. Click + File share to create one.</td>
            </tr>
          ) : (
            sa.fileShares.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.quotaGiB} GiB</td>
                <td>{s.protocol}</td>
                <td>{s.tier}</td>
                <td>{s.created}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(s.name)}>
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

export function SecQueues({
  sa,
  onAdd,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (queue: StorageQueue) => void;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Queues</h3>
      <p>Use queues to store large numbers of messages for asynchronous processing.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Queue name (3-63 lowercase letters/digits/hyphens)" className={styles.input} style={{ flex: 1 }} />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              setError("Queue name is required.");
              return;
            }
            if (!NAME_RE.test(trimmed)) {
              setError("Queue name must be 3-63 lowercase letters, digits, or hyphens.");
              return;
            }
            if (sa.queues.some((q) => q.name === trimmed)) {
              setError("Queue exists.");
              return;
            }
            onAdd({ name: trimmed, url: `${sa.primaryEndpoints.queue}${trimmed}`, messageCount: 0 });
            setName("");
            setError("");
          }}
        >
          + Queue
        </button>
      </div>
      {error ? <p style={{ color: "#a4262c", fontSize: 12, marginBottom: 8 }}>{error}</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>URL</th>
            <th>Message count</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.queues.length === 0 ? (
            <tr>
              <td colSpan={4}>No queues.</td>
            </tr>
          ) : (
            sa.queues.map((q) => (
              <tr key={q.name}>
                <td>{q.name}</td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{q.url}</td>
                <td>{q.messageCount}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(q.name)}>
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

export function SecTables({
  sa,
  onAdd,
  onDelete,
}: {
  sa: StorageResource;
  onAdd: (table: StorageTable) => void;
  onDelete: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Tables</h3>
      <p>Store structured NoSQL data using key/attribute storage with a schemaless design.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Table name (3-63 letters and digits, starts with letter)" className={styles.input} style={{ flex: 1 }} />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              setError("Table name is required.");
              return;
            }
            if (!TABLE_NAME_RE.test(trimmed)) {
              setError("Table name must start with a letter, 3-63 letters/digits.");
              return;
            }
            if (sa.tables.some((t) => t.name === trimmed)) {
              setError("Table exists.");
              return;
            }
            onAdd({ name: trimmed, url: `${sa.primaryEndpoints.table}${trimmed}` });
            setName("");
            setError("");
          }}
        >
          + Table
        </button>
      </div>
      {error ? <p style={{ color: "#a4262c", fontSize: 12, marginBottom: 8 }}>{error}</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>URL</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sa.tables.length === 0 ? (
            <tr>
              <td colSpan={3}>No tables.</td>
            </tr>
          ) : (
            sa.tables.map((t) => (
              <tr key={t.name}>
                <td>{t.name}</td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{t.url}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(t.name)}>
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
