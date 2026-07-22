"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import { REDUNDANCY } from "@/lib/labs/simulators/azure/storageData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { StorageResource } from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({
  sa,
  onNavigate,
  onEditTags,
}: {
  sa: StorageResource;
  onNavigate: (section: string) => void;
  onEditTags: () => void;
}) {
  const redundancyName = REDUNDANCY.find((r) => r.id === sa.redundancy)?.name ?? sa.redundancy;
  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={sa.resourceGroup} />
          <PropPair label="Status" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>{sa.status}</span>} />
          <PropPair label="Location" value={sa.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="Subscription ID" value={SUBSCRIPTION.id} />
          <PropPair label="Performance / Access tier" value={`${sa.performance} / ${sa.accessTier}`} />
          <PropPair label="Replication" value={redundancyName} />
          <PropPair label="Primary service" value={sa.primaryService} />
          <PropPair label="Hierarchical namespace" value={sa.hierarchicalNamespace ? "Enabled" : "Disabled"} />
          <PropPair label="Created on" value={new Date(sa.createdAt).toLocaleString()} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Primary endpoints</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <PropPair label="Blob service" value={sa.primaryEndpoints.blob} />
          <PropPair label="File service" value={sa.primaryEndpoints.file} />
          <PropPair label="Queue service" value={sa.primaryEndpoints.queue} />
          <PropPair label="Table service" value={sa.primaryEndpoints.table} />
          <PropPair label="Web (static)" value={sa.primaryEndpoints.web} />
          <PropPair label="Data Lake (dfs)" value={sa.primaryEndpoints.dfs} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Get started</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Tile label="Containers" sub={`${sa.containers.length} container(s)`} onClick={() => onNavigate("containers")} />
          <Tile label="File shares" sub={`${sa.fileShares.length} share(s)`} onClick={() => onNavigate("fileshares")} />
          <Tile label="Queues" sub={`${sa.queues.length} queue(s)`} onClick={() => onNavigate("queues")} />
          <Tile label="Tables" sub={`${sa.tables.length} table(s)`} onClick={() => onNavigate("tables")} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Properties</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Secure transfer required" value={sa.secureTransfer ? "Enabled" : "Disabled"} />
          <PropPair label="Minimum TLS version" value={sa.tlsVersion} />
          <PropPair label="Blob public access" value={sa.allowBlobPublicAccess ? "Enabled" : "Disabled"} />
          <PropPair label="Storage account key access" value={sa.enableStorageKeyAccess ? "Enabled" : "Disabled"} />
          <PropPair label="Network access" value={sa.networkAccess} />
          <PropPair label="Encryption" value={sa.encryptionKey} />
          <PropPair label="Estimated cost" value={`$${sa.estimatedCost.toFixed(2)}/month`} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(sa.tags).length === 0 ? (
          <p>
            No tags.{" "}
            <button type="button" className={styles.link} onClick={onEditTags}>
              Click here to add tags.
            </button>
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(sa.tags).map(([k, v]) => (
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

function Tile({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 12, cursor: "pointer" }} onClick={onClick}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#0078d4" }}>{sub}</div>
    </div>
  );
}

export function SecActivity({ sa, activityLog }: { sa: StorageResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === sa.name).slice(0, 20);
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
      <p style={{ fontWeight: 600 }}>Built-in roles available for Storage:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Storage Blob Data Owner — Full access to blob data and POSIX ACL management.</li>
        <li>Storage Blob Data Contributor — Read, write, delete blob data.</li>
        <li>Storage Blob Data Reader — Read blob data.</li>
        <li>Storage Account Contributor — Manage storage accounts.</li>
        <li>Storage Account Key Operator Service Role — List and regenerate storage account access keys.</li>
        <li>Storage Queue Data Contributor — Read, write, delete and peek queue data.</li>
        <li>Storage File Data SMB Share Contributor — Read, write, delete on Azure file share over SMB.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  sa,
  onAddTag,
  onDeleteTag,
}: {
  sa: StorageResource;
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
          {Object.keys(sa.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add a tag below.</td>
            </tr>
          ) : (
            Object.entries(sa.tags).map(([k, v]) => (
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
      <p>Common storage account issues: connectivity, key authentication failures, throttling, throughput limits.</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>Cannot connect to the storage account</li>
        <li>Storage account requests are being throttled</li>
        <li>Public access to a blob is not working</li>
        <li>CORS errors when accessing blob data</li>
        <li>Storage account name is unavailable</li>
      </ul>
    </div>
  );
}
