"use client";

import type { SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";

export function SqlList({
  resources,
  onOpen,
  onCreate,
  onDelete,
}: {
  resources: SqlResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>SQL databases</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>No SQL databases yet. Click Create to make your first one.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Resource group</th>
                <th>Server</th>
                <th>Region</th>
                <th>Pricing tier</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((sql) => (
                <tr key={sql.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(sql.id)} className={styles.link}>
                      {sql.name}
                    </button>
                  </td>
                  <td>{sql.resourceGroup}</td>
                  <td>{sql.server}</td>
                  <td>{sql.region}</td>
                  <td>{sql.serviceTier}</td>
                  <td>
                    <span className={`${styles.badge} ${sql.status === "Online" ? styles.badgeRunning : styles.badgeOutline}`}>{sql.status}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={() => onDelete(sql.id)}>
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
