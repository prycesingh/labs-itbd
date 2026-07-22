"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { LbResource } from "@/lib/labs/simulators/azure/lbTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({ lb, onEditTags }: { lb: LbResource; onEditTags: () => void }) {
  const fe = lb.frontendConfigs[0];
  const feLabel = lb.lbType === "Public" ? fe?.publicIpName ?? "(pending public IP)" : `${fe?.vnet ?? "—"} / ${fe?.subnet ?? "—"}`;
  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={lb.resourceGroup} />
          <PropPair label="Status" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>Succeeded</span>} />
          <PropPair label="Location" value={lb.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="SKU" value={lb.sku} />
          <PropPair label="Tier" value={lb.tier} />
          <PropPair label="Type" value={lb.lbType} />
          <PropPair label="Frontend IP" value={feLabel} />
          <PropPair label="Backend pools" value={lb.backendPools.length} />
          <PropPair label="Health probes" value={lb.healthProbes.length} />
          <PropPair label="Load balancing rules" value={lb.lbRules.length} />
          <PropPair label="Inbound NAT rules" value={lb.natRules.length} />
          <PropPair label="Outbound rules" value={lb.outboundRules.length} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(lb.tags).length === 0 ? (
          <p>No tags.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(lb.tags).map(([k, v]) => (
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

export function SecActivity({ lb, activityLog }: { lb: LbResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === lb.name).slice(0, 20);
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
      <p style={{ fontWeight: 600 }}>Built-in roles for Load Balancer:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Network Contributor — Manage networks, including load balancers.</li>
        <li>Contributor — Full management access except permissions.</li>
        <li>Reader — View resources, but not make changes.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  lb,
  onAddTag,
  onDeleteTag,
}: {
  lb: LbResource;
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
          {Object.keys(lb.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add one below.</td>
            </tr>
          ) : (
            Object.entries(lb.tags).map(([k, v]) => (
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
      <p>Common issues: backend instances unhealthy, traffic not flowing, SNAT port exhaustion, probe failures.</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>Backend instances showing as unhealthy</li>
        <li>Connectivity issues to a backend VM</li>
        <li>SNAT port exhaustion</li>
        <li>Load balancing rule misconfiguration</li>
      </ul>
    </div>
  );
}

export function SecProperties({ lb }: { lb: LbResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair label="Name" value={lb.name} />
        <PropPair
          label="Resource ID"
          value={`/subscriptions/${SUBSCRIPTION.id}/resourceGroups/${lb.resourceGroup}/providers/Microsoft.Network/loadBalancers/${lb.name}`}
        />
        <PropPair label="Resource group" value={lb.resourceGroup} />
        <PropPair label="Location" value={lb.region} />
        <PropPair label="Subscription" value={SUBSCRIPTION.name} />
        <PropPair label="SKU" value={lb.sku} />
        <PropPair label="Tier" value={lb.tier} />
        <PropPair label="Type" value={lb.lbType} />
        <PropPair label="Created on" value={new Date(lb.createdAt).toISOString()} />
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
      <p style={{ marginTop: 12 }}>No locks defined.</p>
    </div>
  );
}

export function SecCrossRegion({ lb }: { lb: LbResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Cross-region load balancer</h3>
      <p>A cross-region load balancer (Global tier) distributes traffic across multiple Azure regions.</p>
      {lb.tier === "Global" ? (
        <p style={{ color: "#0078d4" }}>This is a Global tier load balancer. Add regional load balancers as backends.</p>
      ) : (
        <p style={{ color: "#8a4a00" }}>This is a Regional tier load balancer. Cross-region requires Global tier on a Standard SKU LB.</p>
      )}
    </div>
  );
}

export function SecInsights({ lb }: { lb: LbResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Load Balancer Insights</h3>
      <p>Get a dashboard view of metrics and health for this load balancer.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
        <MiniMetric label="Data path availability" value="100%" />
        <MiniMetric label="Health probe status" value={`${lb.healthProbes.length} probes`} />
        <MiniMetric label="SYN packets" value="4.2k/s" />
        <MiniMetric label="Used SNAT ports" value="128" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#0078d4" }}>{value}</div>
    </div>
  );
}
