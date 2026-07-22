"use client";

import { useState } from "react";

import { REDUNDANCY, isGeoRedundant, pairedRegionFor, randomKey } from "@/lib/labs/simulators/azure/storageData";
import type { StorageResource, StorageSasState } from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";
import { Field, NativeSelect, PropPair } from "./wizard-fields";

export function SecAccessKeys({ sa, onRotate }: { sa: StorageResource; onRotate: (key: "key1" | "key2") => void }) {
  const blobHost = sa.primaryEndpoints.blob.replace("https://", "").replace(/\/$/, "");
  const cs1 = `DefaultEndpointsProtocol=https;AccountName=${sa.name};AccountKey=${sa.key1};EndpointSuffix=core.windows.net`;
  const cs2 = `DefaultEndpointsProtocol=https;AccountName=${sa.name};AccountKey=${sa.key2};EndpointSuffix=core.windows.net`;
  return (
    <div className={styles.sectionCard}>
      <h3>Access keys</h3>
      <p>
        Use access keys to authenticate your applications when making requests to this Azure storage account. Store your access keys securely — for example, using Azure Key
        Vault — and don&apos;t share them. We recommend regenerating your access keys regularly.
      </p>
      <p style={{ background: "#f3f9fd", border: "1px solid #d0e7f5", borderRadius: 2, padding: "8px 12px", fontSize: 13 }}>
        <b>Storage account name:</b> {sa.name} &nbsp; <b>Blob endpoint:</b> {blobHost}
      </p>
      <h4 style={{ marginTop: 16 }}>key1</h4>
      <div className={styles.keyRow}>
        <span className={styles.keyName}>Key</span>
        <code>{sa.key1}</code>
        <button type="button" className={styles.btnOutline} onClick={() => onRotate("key1")}>
          Rotate
        </button>
      </div>
      <div className={styles.keyRow}>
        <span className={styles.keyName}>CS</span>
        <code style={{ background: "#1e1e1e", color: "#d4d4d4" }}>{cs1}</code>
      </div>
      <h4 style={{ marginTop: 16 }}>key2</h4>
      <div className={styles.keyRow}>
        <span className={styles.keyName}>Key</span>
        <code>{sa.key2}</code>
        <button type="button" className={styles.btnOutline} onClick={() => onRotate("key2")}>
          Rotate
        </button>
      </div>
      <div className={styles.keyRow}>
        <span className={styles.keyName}>CS</span>
        <code style={{ background: "#1e1e1e", color: "#d4d4d4" }}>{cs2}</code>
      </div>
      <p className={styles.help} style={{ marginTop: 12 }}>
        CS = Connection string. Rotating keys takes effect immediately. Be sure to update any applications that depend on the rotated key.
      </p>
    </div>
  );
}

export function SecGeoReplication({ sa }: { sa: StorageResource }) {
  if (!isGeoRedundant(sa.redundancy)) {
    return (
      <div className={styles.sectionCard}>
        <h3>Geo-replication</h3>
        <p>This storage account is configured with {sa.redundancy} and is not geo-replicated. Change replication settings to enable geo-replication.</p>
      </div>
    );
  }
  const paired = pairedRegionFor(sa.region);
  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Geo-replication status</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Primary location" value={sa.region} />
          <PropPair label="Primary status" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>Available</span>} />
          <PropPair label="Secondary location" value={paired} />
          <PropPair label="Secondary status" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>Available</span>} />
          <PropPair label="Replication" value={REDUNDANCY.find((r) => r.id === sa.redundancy)?.name} />
          <PropPair label="Last sync time" value={new Date(Date.now() - 2 * 60000).toLocaleString()} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Failover</h3>
        <p>If the primary region becomes unavailable, you can fail over to the secondary region. After failover, the secondary region becomes the new primary.</p>
        <button type="button" className={styles.btnOutline}>
          Prepare for failover
        </button>
      </div>
    </>
  );
}

const CORS_TABS = ["Blob service", "File service", "Queue service", "Table service"];

export function SecCORS() {
  const [active, setActive] = useState(CORS_TABS[0]);
  return (
    <div className={styles.sectionCard}>
      <h3>CORS — {active}</h3>
      <p>Cross-Origin Resource Sharing (CORS) allows scripts running on web pages hosted on different domains to access resources in your storage account.</p>
      <div className={styles.connTabs}>
        {CORS_TABS.map((t) => (
          <div key={t} className={`${styles.connTab} ${active === t ? styles.connTabActive : ""}`} onClick={() => setActive(t)}>
            {t}
          </div>
        ))}
      </div>
      <table className={styles.table} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Allowed origins</th>
            <th>Allowed methods</th>
            <th>Allowed headers</th>
            <th>Exposed headers</th>
            <th>Max age (s)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5}>No CORS rules defined. Click + Add CORS rule below.</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className={styles.link} style={{ marginTop: 8 }}>
        + Add CORS rule
      </button>
    </div>
  );
}

export function SecConfiguration({
  sa,
  onUpdate,
}: {
  sa: StorageResource;
  onUpdate: (key: keyof StorageResource, value: StorageResource[keyof StorageResource]) => void;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Configuration</h3>
      <p>Manage account-level settings for this storage account.</p>
      <Field label="Account kind">
        <b>StorageV2 (general purpose v2)</b>
      </Field>
      <Field label="Performance">
        <b>{sa.performance}</b>
      </Field>
      <Field label="Replication">
        <NativeSelect value={sa.redundancy} onChange={(v) => onUpdate("redundancy", v as StorageResource["redundancy"])}>
          {REDUNDANCY.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Default access tier (blobs)">
        <div className={styles.radioRow}>
          <label className={styles.radioOption}>
            <input type="radio" name="cfgAccessTier" checked={sa.accessTier === "Hot"} onChange={() => onUpdate("accessTier", "Hot")} />
            Hot
          </label>
          <label className={styles.radioOption}>
            <input type="radio" name="cfgAccessTier" checked={sa.accessTier === "Cool"} onChange={() => onUpdate("accessTier", "Cool")} />
            Cool
          </label>
        </div>
      </Field>
      <Field label="Allow blob anonymous access">
        <div className={styles.radioRow}>
          <label className={styles.radioOption}>
            <input type="radio" name="cfgAnonymous" checked={sa.allowBlobPublicAccess} onChange={() => onUpdate("allowBlobPublicAccess", true)} />
            Enabled
          </label>
          <label className={styles.radioOption}>
            <input type="radio" name="cfgAnonymous" checked={!sa.allowBlobPublicAccess} onChange={() => onUpdate("allowBlobPublicAccess", false)} />
            Disabled
          </label>
        </div>
      </Field>
      <Field label="Minimum TLS version">
        <NativeSelect value={sa.tlsVersion} onChange={(v) => onUpdate("tlsVersion", v)}>
          <option>Version 1.0</option>
          <option>Version 1.1</option>
          <option>Version 1.2</option>
        </NativeSelect>
      </Field>
      <Field label="Blob soft delete retention (days)">
        <input
          type="number"
          min={1}
          max={365}
          value={sa.softDeleteBlobsDays}
          onChange={(e) => onUpdate("softDeleteBlobsDays", parseInt(e.target.value, 10) || 7)}
          className={styles.input}
          style={{ width: 120 }}
        />
      </Field>
    </div>
  );
}

export function SecEncryption({ sa }: { sa: StorageResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Encryption</h3>
      <p>
        All data written to Azure Storage is automatically encrypted at rest using Storage Service Encryption. You can rely on Microsoft-managed keys for the encryption of
        your storage account, or you can manage encryption with your own keys.
      </p>
      <Field label="Encryption type">
        <div className={styles.radioRow}>
          <label className={styles.radioOption}>
            <input type="radio" name="encType" checked={sa.encryptionKey !== "Customer-managed key"} readOnly />
            Microsoft-managed keys (MMK)
          </label>
          <label className={styles.radioOption}>
            <input type="radio" name="encType" checked={sa.encryptionKey === "Customer-managed key"} readOnly />
            Customer-managed keys (CMK)
          </label>
        </div>
      </Field>
      <p style={{ background: "#f3f9fd", border: "1px solid #d0e7f5", borderRadius: 2, padding: "8px 12px", fontSize: 13 }}>
        Encryption scopes let you manage encryption with a key that is scoped to a container or an individual blob.
      </p>
      <h4>Encryption scopes</h4>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
            <th>Key type</th>
            <th>Last modified</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4}>No encryption scopes.</td>
          </tr>
        </tbody>
      </table>
      <button type="button" className={styles.link} style={{ marginTop: 8 }}>
        + Add
      </button>
    </div>
  );
}

function buildSasUrl(sa: StorageResource, sas: StorageSasState) {
  let ss = "";
  if (sas.svcBlob) ss += "b";
  if (sas.svcQueue) ss += "q";
  if (sas.svcTable) ss += "t";
  if (sas.svcFile) ss += "f";
  let srt = "";
  if (sas.rtService) srt += "s";
  if (sas.rtContainer) srt += "c";
  if (sas.rtObject) srt += "o";
  let sp = "";
  if (sas.pRead) sp += "r";
  if (sas.pAdd) sp += "a";
  if (sas.pCreate) sp += "c";
  if (sas.pWrite) sp += "w";
  if (sas.pDelete) sp += "d";
  if (sas.pList) sp += "l";
  if (sas.pUpdate) sp += "u";
  if (sas.pProcess) sp += "p";
  const se = `${sas.expiry || ""}:00Z`;
  const st = `${sas.start || ""}:00Z`;
  const spr = sas.protocol === "HTTPS only" ? "https" : "https,http";
  const sip = sas.allowedIp ? `&sip=${encodeURIComponent(sas.allowedIp)}` : "";
  const sig = `${randomKey().slice(0, 44).replace(/=+$/, "")}%3D`;
  const token = `sv=2022-11-02&ss=${ss}&srt=${srt}&sp=${sp}&se=${se}&st=${st}&spr=${spr}${sip}&sig=${sig}`;
  const url = `${sa.primaryEndpoints.blob}?${token}`;
  return { token, url };
}

export function SecSAS({ sa, onChange }: { sa: StorageResource; onChange: (sas: StorageSasState) => void }) {
  const sas = sa.sas;
  const startD = sas.start || new Date().toISOString().slice(0, 16);
  const expiryD = sas.expiry || new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const { token, url } = buildSasUrl(sa, sas);

  function set<K extends keyof StorageSasState>(key: K, value: StorageSasState[K]) {
    onChange({ ...sas, [key]: value });
  }

  function checkbox(label: string, key: keyof StorageSasState) {
    return (
      <label key={key} className={styles.checkboxRow}>
        <input type="checkbox" checked={sas[key] as boolean} onChange={(e) => set(key, e.target.checked as StorageSasState[typeof key])} />
        {label}
      </label>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Shared access signature</h3>
      <p>A shared access signature (SAS) is a URI that grants restricted access rights to your storage account.</p>

      <Field label="Allowed services">
        <div className={styles.sasGrid}>
          {checkbox("Blob", "svcBlob")}
          {checkbox("File", "svcFile")}
          {checkbox("Queue", "svcQueue")}
          {checkbox("Table", "svcTable")}
        </div>
      </Field>

      <Field label="Allowed resource types">
        <div className={styles.sasGrid}>
          {checkbox("Service", "rtService")}
          {checkbox("Container", "rtContainer")}
          {checkbox("Object", "rtObject")}
        </div>
      </Field>

      <Field label="Allowed permissions">
        <div className={styles.sasGrid}>
          {checkbox("Read", "pRead")}
          {checkbox("Write", "pWrite")}
          {checkbox("Delete", "pDelete")}
          {checkbox("List", "pList")}
          {checkbox("Add", "pAdd")}
          {checkbox("Create", "pCreate")}
          {checkbox("Update", "pUpdate")}
          {checkbox("Process", "pProcess")}
        </div>
      </Field>

      <Field label="Start and expiry date/time">
        <div style={{ display: "flex", gap: 12 }}>
          <input type="datetime-local" value={startD} onChange={(e) => set("start", e.target.value)} className={styles.input} />
          <input type="datetime-local" value={expiryD} onChange={(e) => set("expiry", e.target.value)} className={styles.input} />
        </div>
      </Field>

      <Field label="Allowed IP addresses">
        <input
          placeholder="e.g., 168.1.5.65 or 168.1.5.65-168.1.5.70"
          value={sas.allowedIp}
          onChange={(e) => set("allowedIp", e.target.value)}
          className={styles.input}
        />
      </Field>

      <Field label="Allowed protocols">
        <div className={styles.radioRow}>
          <label className={styles.radioOption}>
            <input type="radio" name="sasProto" checked={sas.protocol === "HTTPS only"} onChange={() => set("protocol", "HTTPS only")} />
            HTTPS only
          </label>
          <label className={styles.radioOption}>
            <input type="radio" name="sasProto" checked={sas.protocol === "HTTPS and HTTP"} onChange={() => set("protocol", "HTTPS and HTTP")} />
            HTTPS and HTTP
          </label>
        </div>
      </Field>

      <Field label="Signing key">
        <NativeSelect value={sas.signingKey} onChange={(v) => set("signingKey", v as "key1" | "key2")}>
          <option value="key1">key1</option>
          <option value="key2">key2</option>
        </NativeSelect>
      </Field>

      <button type="button" className={styles.btn}>
        Generate SAS and connection string
      </button>

      <div style={{ marginTop: 16 }}>
        <b>SAS token</b>
        <div className={styles.sasOutput}>?{token}</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <b>Blob service SAS URL</b>
        <div className={styles.sasOutput}>{url}</div>
      </div>
    </div>
  );
}
