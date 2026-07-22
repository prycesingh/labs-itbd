"use client";

import type { NsgResource } from "@/lib/labs/simulators/azure/nsgTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecNICs({ nsg, onDissociate }: { nsg: NsgResource; onDissociate: (nic: string) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Network interfaces</h3>
      <p>This network security group is associated with the following network interfaces.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Resource group</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {nsg.associatedNICs.length === 0 ? (
            <tr>
              <td colSpan={3}>No network interfaces are associated with this NSG.</td>
            </tr>
          ) : (
            nsg.associatedNICs.map((n) => (
              <tr key={n}>
                <td>{n}</td>
                <td>{nsg.resourceGroup}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDissociate(n)}>
                    Dissociate
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

export function SecSubnets({ nsg, onDissociate }: { nsg: NsgResource; onDissociate: (subnet: string) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Subnets</h3>
      <p>This network security group is associated with the following subnets.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Virtual network</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {nsg.associatedSubnets.length === 0 ? (
            <tr>
              <td colSpan={3}>No subnets are associated with this NSG.</td>
            </tr>
          ) : (
            nsg.associatedSubnets.map((s) => (
              <tr key={s}>
                <td>{s}</td>
                <td>{nsg.resourceGroup}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDissociate(s)}>
                    Dissociate
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

export function SecLogs({ nsg }: { nsg: NsgResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Logs</h3>
      <p>Query NSG rule counter and event logs using Log Analytics.</p>
      <div
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: 12,
          borderRadius: 2,
          fontFamily: "Consolas, monospace",
          fontSize: 13,
          marginTop: 8,
        }}
      >
        AzureNetworkAnalytics_CL
        <br />
        | where SubType_s == &quot;FlowLog&quot;
        <br />
        | where NSGList_s contains &quot;{nsg.name}&quot;
        <br />| summarize count() by NSGRule_s, FlowStatus_s
      </div>
    </div>
  );
}

export function SecFlowLogs() {
  return (
    <div className={styles.sectionCard}>
      <h3>NSG flow logs</h3>
      <p>NSG flow logs allow you to log information about IP traffic flowing through this network security group.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <PropPair label="Flow log status" value={<span className={`${styles.badge} ${styles.badgeStopped}`}>Disabled</span>} />
        <PropPair label="Flow log version" value="Version 2" />
        <PropPair label="Storage account" value="(none)" />
        <PropPair label="Retention (days)" value={0} />
      </div>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        Enable flow logs
      </button>
    </div>
  );
}
