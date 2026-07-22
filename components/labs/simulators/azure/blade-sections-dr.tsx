"use client";

import { useState } from "react";

import type { VmResource, VmRestorePoint } from "@/lib/labs/simulators/azure/types";
import styles from "./azure-portal.module.css";
import { Callout } from "./wizard-fields";

export function SecRestorePoints({
  vm,
  onCreate,
  onDelete,
}: {
  vm: VmResource;
  onCreate: (restorePoint: VmRestorePoint) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(`rp-${vm.name}-${new Date().toISOString().slice(0, 10)}`);
  const [includeDataDisks, setIncludeDataDisks] = useState(true);
  const [notes, setNotes] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Restore points</h3>
      <p>
        Application-consistent snapshots of OS and data disks. Faster than a Recovery Services Vault for
        ad-hoc rollback.
      </p>
      {showForm ? (
        <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 12, marginBottom: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Restore point name"
            className={styles.input}
            style={{ marginBottom: 8 }}
          />
          <label className={styles.checkboxRow} style={{ marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={includeDataDisks}
              onChange={(e) => setIncludeDataDisks(e.target.checked)}
            />
            Include data disks
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className={styles.input}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                onCreate({
                  name,
                  created: new Date().toISOString().slice(0, 16).replace("T", " "),
                  includeDataDisks,
                  notes,
                });
                setShowForm(false);
                setNotes("");
              }}
            >
              Create
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
          + Create restore point
        </button>
      )}
      {vm.restorePoints.length === 0 ? (
        <p>No restore points yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th>Data disks</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vm.restorePoints.map((p, i) => (
              <tr key={i}>
                <td>{p.name}</td>
                <td>{p.created}</td>
                <td>{p.includeDataDisks ? "Yes" : "No"}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SecAsr({
  vm,
  onEnable,
  onDisable,
}: {
  vm: VmResource;
  onEnable: (targetRegion: string, policy: string) => void;
  onDisable: () => void;
}) {
  const asr = vm.asr;

  if (!asr.enabled) {
    return (
      <div className={styles.sectionCard}>
        <h3>Disaster recovery (Azure Site Recovery)</h3>
        <p>
          Replicate this VM to a secondary region for disaster recovery. RPO typically 30 sec, RTO
          typically 1-15 min.
        </p>
        <button
          type="button"
          className={styles.btn}
          onClick={() => onEnable(vm.region.includes("East") ? "(US) West US 2" : "(US) East US 2", "24h-retention")}
        >
          Enable replication
        </button>
        <div style={{ marginTop: 12 }}>
          <Callout tone="info">
            <b>Costs:</b> ~$25/month per protected VM plus storage for replica disks.
          </Callout>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Disaster recovery — Replicating</h3>
      <p>
        Status: <span className={`${styles.badge} ${styles.badgeRunning}`}>Protected</span>
      </p>
      <p>Source region: {vm.region}</p>
      <p>Target region: {asr.targetRegion}</p>
      <p>Replication policy: {asr.policy}</p>
      <button type="button" className={styles.btnOutline} style={{ marginTop: 12 }} onClick={onDisable}>
        Disable replication
      </button>
    </div>
  );
}
