"use client";

import { useState } from "react";

import { DISK_TYPES, SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { VmResource } from "@/lib/labs/simulators/azure/types";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({ vm }: { vm: VmResource }) {
  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={vm.resourceGroup} />
          <PropPair
            label="Status"
            value={
              <span className={`${styles.badge} ${vm.status === "Running" ? styles.badgeRunning : styles.badgeStopped}`}>
                {vm.status}
              </span>
            }
          />
          <PropPair label="Location" value={vm.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="Computer name" value={vm.name} />
          <PropPair label="Operating system" value={vm.osImage} />
          <PropPair label="Size" value={`${vm.size} (${vm.vcpus} vcpus, ${vm.ram} GiB memory)`} />
          <PropPair label="Public IP address" value={vm.publicIpAddress} />
          <PropPair label="Private IP address" value={vm.privateIp} />
          <PropPair label="Virtual network/subnet" value={`${vm.virtualNetwork} / ${vm.subnet}`} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Properties</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Username" value={vm.username} />
          <PropPair label="Authentication" value={vm.authType} />
          <PropPair label="OS disk type" value={DISK_TYPES.find((d) => d.id === vm.osDiskType)?.label} />
          <PropPair label="Data disks" value={vm.dataDisks.length} />
          <PropPair label="Created on" value={new Date(vm.createdAt).toLocaleString()} />
          <PropPair label="Estimated cost" value={`$${vm.estimatedCost.toFixed(2)}/month`} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Tags</h3>
        {Object.keys(vm.tags).length === 0 ? (
          <p>No tags.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(vm.tags).map(([k, v]) => (
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

export function SecActivity({ vm, activityLog }: { vm: VmResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === vm.name).slice(0, 20);
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
      <p style={{ fontWeight: 600 }}>Built-in roles available for VM:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Virtual Machine Contributor — manage VMs but not access them.</li>
        <li>Virtual Machine Administrator Login — view and log in as administrator.</li>
        <li>Virtual Machine User Login — view and log in as a regular user.</li>
        <li>Reader — view resources, but not make changes.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  vm,
  onAddTag,
  onDeleteTag,
}: {
  vm: VmResource;
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
          {Object.keys(vm.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add one below.</td>
            </tr>
          ) : (
            Object.entries(vm.tags).map(([k, v]) => (
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
      <p>Common issues: VM not starting, network connectivity, disk performance, RDP/SSH access.</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>VM is not running</li>
        <li>Cannot connect via RDP/SSH</li>
        <li>Performance issues</li>
        <li>Disk and snapshot questions</li>
      </ul>
    </div>
  );
}

export function SecProperties({ vm }: { vm: VmResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair label="Name" value={vm.name} />
        <PropPair
          label="Resource ID"
          value={`/subscriptions/${SUBSCRIPTION.id}/resourceGroups/${vm.resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vm.name}`}
        />
        <PropPair label="Resource group" value={vm.resourceGroup} />
        <PropPair label="Location" value={vm.region} />
        <PropPair label="Subscription" value={SUBSCRIPTION.name} />
        <PropPair label="Provisioning state" value="Succeeded" />
        <PropPair label="Created on" value={new Date(vm.createdAt).toISOString()} />
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
      <p style={{ marginTop: 12 }}>No locks defined for this VM.</p>
    </div>
  );
}
