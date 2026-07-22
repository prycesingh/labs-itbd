"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { NsgResource } from "@/lib/labs/simulators/azure/nsgTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({ nsg, onManageInbound, onManageOutbound, onEditTags }: {
  nsg: NsgResource;
  onManageInbound: () => void;
  onManageOutbound: () => void;
  onEditTags: () => void;
}) {
  const inCount = nsg.inboundRules.length;
  const outCount = nsg.outboundRules.length;

  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={nsg.resourceGroup} />
          <PropPair label="Location" value={nsg.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="Provisioning state" value="Succeeded" />
          <PropPair label="Custom security rules" value={`${inCount} inbound, ${outCount} outbound`} />
          <PropPair
            label="Associated with"
            value={`${nsg.associatedSubnets.length} subnets, ${nsg.associatedNICs.length} network interfaces`}
          />
          <PropPair label="Last modified" value={new Date(nsg.lastModified).toLocaleString()} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Security rules summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 12 }}>
          <PropPair label="Inbound rules (user)" value={inCount} />
          <PropPair label="Outbound rules (user)" value={outCount} />
          <PropPair label="Default inbound rules" value={3} />
          <PropPair label="Default outbound rules" value={3} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={styles.btn} onClick={onManageInbound}>
            Manage inbound rules
          </button>
          <button type="button" className={styles.btnOutline} onClick={onManageOutbound}>
            Manage outbound rules
          </button>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Associated resources</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <b>Subnets ({nsg.associatedSubnets.length})</b>
            {nsg.associatedSubnets.length === 0 ? (
              <p>Not associated with any subnet.</p>
            ) : (
              <ul style={{ paddingLeft: 20 }}>
                {nsg.associatedSubnets.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <b>Network interfaces ({nsg.associatedNICs.length})</b>
            {nsg.associatedNICs.length === 0 ? (
              <p>Not associated with any NIC.</p>
            ) : (
              <ul style={{ paddingLeft: 20 }}>
                {nsg.associatedNICs.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(nsg.tags).length === 0 ? (
          <p>No tags.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(nsg.tags).map(([k, v]) => (
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

export function SecActivity({ nsg, activityLog }: { nsg: NsgResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === nsg.name).slice(0, 20);
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
                  <span className={`${styles.badge} ${l.status === "Succeeded" ? styles.badgeRunning : styles.badgeOutline}`}>
                    {l.status}
                  </span>
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
      <p style={{ fontWeight: 600 }}>Built-in roles available for NSG:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Network Contributor — manage networks, but not access to them.</li>
        <li>Reader — View resources, but not make changes.</li>
        <li>Owner — Full access including delegation of access.</li>
        <li>Security Admin — View and edit security policies, manage NSG rules.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  nsg,
  onAddTag,
  onDeleteTag,
}: {
  nsg: NsgResource;
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
          {Object.keys(nsg.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add one below.</td>
            </tr>
          ) : (
            Object.entries(nsg.tags).map(([k, v]) => (
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
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Name"
          className={styles.input}
          style={{ width: 160 }}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          className={styles.input}
          style={{ width: 160 }}
        />
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
      <p>
        Common NSG issues: connectivity blocked, rule priority conflicts, effective security rules
        mismatch.
      </p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>Cannot connect to a VM associated with this NSG</li>
        <li>Rule is not taking effect</li>
        <li>Conflicting priorities between rules</li>
        <li>Outbound traffic is being blocked</li>
      </ul>
    </div>
  );
}

export function SecProperties({ nsg }: { nsg: NsgResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair label="Name" value={nsg.name} />
        <PropPair
          label="Resource ID"
          value={`/subscriptions/${SUBSCRIPTION.id}/resourceGroups/${nsg.resourceGroup}/providers/Microsoft.Network/networkSecurityGroups/${nsg.name}`}
        />
        <PropPair label="Resource group" value={nsg.resourceGroup} />
        <PropPair label="Location" value={nsg.region} />
        <PropPair label="Subscription" value={SUBSCRIPTION.name} />
        <PropPair label="Provisioning state" value="Succeeded" />
        <PropPair label="Created on" value={new Date(nsg.createdAt).toISOString()} />
        <PropPair label="Last modified" value={new Date(nsg.lastModified).toISOString()} />
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
      <p style={{ marginTop: 12 }}>No locks defined for this NSG.</p>
    </div>
  );
}
