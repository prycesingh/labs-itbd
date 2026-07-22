"use client";

import type { StorageResource } from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";

export function StorageList({
  resources,
  onOpen,
  onCreate,
  onDelete,
}: {
  resources: StorageResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Storage accounts</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>No storage accounts yet. Click Create to make your first one.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Resource group</th>
                <th>Region</th>
                <th>Performance</th>
                <th>Redundancy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((sa) => (
                <tr key={sa.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(sa.id)} className={styles.link}>
                      {sa.name}
                    </button>
                  </td>
                  <td>{sa.resourceGroup}</td>
                  <td>{sa.region}</td>
                  <td>{sa.performance}</td>
                  <td>{sa.redundancy}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={() => onDelete(sa.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
