"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import { availableIps } from "@/lib/labs/simulators/azure/vnetData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { VnetResource } from "@/lib/labs/simulators/azure/vnetTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({
  vnet,
  connectedDevices,
  onManageSubnets,
  onEditTags,
}: {
  vnet: VnetResource;
  connectedDevices: number;
  onManageSubnets: () => void;
  onEditTags: () => void;
}) {
  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={vnet.resourceGroup} />
          <PropPair label="Location" value={vnet.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="Subscription ID" value={SUBSCRIPTION.id} />
          <PropPair label="Address space" value={vnet.addressSpace.join(", ")} />
          <PropPair
            label="DNS servers"
            value={vnet.dnsServers === "Custom" ? `Custom (${vnet.customDnsServers.join(", ")})` : "Azure-provided"}
          />
          <PropPair label="Connected devices" value={connectedDevices} />
          <PropPair label="Peerings" value={vnet.peerings.length} />
          <PropPair
            label="DDoS protection"
            value={
              <span className={`${styles.badge} ${vnet.ddosProtection ? styles.badgeRunning : styles.badgeOutline}`}>
                {vnet.ddosProtection ? "Enabled" : "Disabled"}
              </span>
            }
          />
          <PropPair label="Provisioning state" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>{vnet.status}</span>} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Subnets</h3>
        {vnet.subnets.length === 0 ? (
          <p>No subnets.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>IPv4 range</th>
                <th>Available IPs</th>
                <th>Delegated to</th>
              </tr>
            </thead>
            <tbody>
              {vnet.subnets.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button type="button" className={styles.link} onClick={onManageSubnets}>
                      {s.name}
                    </button>
                  </td>
                  <td>{s.addressRange}</td>
                  <td>{availableIps(s.addressRange)}</td>
                  <td>{s.delegation || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" className={styles.link} style={{ marginTop: 8 }} onClick={onManageSubnets}>
          Manage subnets &gt;
        </button>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(vnet.tags).length === 0 ? (
          <p>
            No tags.{" "}
            <button type="button" className={styles.link} onClick={onEditTags}>
              Click here to add tags.
            </button>
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(vnet.tags).map(([k, v]) => (
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

export function SecActivity({ vnet, activityLog }: { vnet: VnetResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === vnet.name).slice(0, 20);
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
      <p style={{ fontWeight: 600 }}>Built-in roles available for Virtual Networks:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Network Contributor — Lets you manage networks, but not access them.</li>
        <li>Virtual Network Contributor — Lets you manage virtual networks, but not VMs.</li>
        <li>Reader — View resources, but not make changes.</li>
        <li>Owner — Full access including the ability to delegate access.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  vnet,
  onAddTag,
  onDeleteTag,
}: {
  vnet: VnetResource;
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
          {Object.keys(vnet.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add a tag below.</td>
            </tr>
          ) : (
            Object.entries(vnet.tags).map(([k, v]) => (
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
      <p>Common scenarios for virtual networks:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>Connectivity issues between subnets</li>
        <li>Cannot reach a peered network</li>
        <li>Virtual network gateway issues</li>
        <li>DNS resolution failures</li>
        <li>NSG rules blocking traffic</li>
      </ul>
    </div>
  );
}

export function SecProperties({ vnet }: { vnet: VnetResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair label="Name" value={vnet.name} />
        <PropPair
          label="Resource ID"
          value={`/subscriptions/${SUBSCRIPTION.id}/resourceGroups/${vnet.resourceGroup}/providers/Microsoft.Network/virtualNetworks/${vnet.name}`}
        />
        <PropPair label="Resource group" value={vnet.resourceGroup} />
        <PropPair label="Location" value={vnet.region} />
        <PropPair label="Subscription" value={SUBSCRIPTION.name} />
        <PropPair label="Subscription ID" value={SUBSCRIPTION.id} />
        <PropPair label="Provisioning state" value={vnet.status} />
        <PropPair label="Address space" value={vnet.addressSpace.join(", ")} />
        <PropPair label="Subnets" value={vnet.subnets.length} />
        <PropPair label="Peerings" value={vnet.peerings.length} />
        <PropPair label="Created on" value={new Date(vnet.createdAt).toISOString()} />
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
      <p style={{ marginTop: 12 }}>No locks defined for this virtual network.</p>
    </div>
  );
}

export function SecNetworkMgr() {
  return (
    <div className={styles.sectionCard}>
      <h3>Network manager</h3>
      <p style={{ color: "#0078d4" }}>
        Azure Virtual Network Manager (preview) — Group, configure, deploy, and manage virtual networks across regions
        and subscriptions.
      </p>
      <p>This virtual network is not currently managed by any Azure Virtual Network Manager instance.</p>
      <button type="button" className={styles.btnOutline}>
        Associate with network manager
      </button>
    </div>
  );
}

export function SecDiagram({ vnet }: { vnet: VnetResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Topology / Diagram</h3>
      <p>A visual representation of resources in this virtual network.</p>
      <div style={{ border: "2px dashed #8a8886", padding: 24, borderRadius: 4, background: "#faf9f8" }}>
        <div style={{ textAlign: "center", fontWeight: 600, marginBottom: 16 }}>
          {vnet.name} &nbsp;|&nbsp; {vnet.addressSpace.join(", ")}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {vnet.subnets.length === 0 ? (
            <p>No subnets.</p>
          ) : (
            vnet.subnets.map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid #0078d4",
                  background: "#deecf9",
                  padding: "12px 16px",
                  borderRadius: 4,
                  minWidth: 160,
                  textAlign: "center",
                }}
              >
                <b>{s.name}</b>
                <br />
                <span style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>{s.addressRange}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
