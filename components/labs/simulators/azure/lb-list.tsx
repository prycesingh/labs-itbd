"use client";

import type { LbResource } from "@/lib/labs/simulators/azure/lbTypes";
import styles from "./azure-portal.module.css";

export function LbList({
  resources,
  onOpen,
  onCreate,
  onDelete,
}: {
  resources: LbResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Load balancers</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>No load balancers yet. Click Create to make your first one.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Resource group</th>
                <th>Region</th>
                <th>SKU</th>
                <th>Type</th>
                <th>Rules</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((lb) => (
                <tr key={lb.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(lb.id)} className={styles.link}>
                      {lb.name}
                    </button>
                  </td>
                  <td>{lb.resourceGroup}</td>
                  <td>{lb.region}</td>
                  <td>{lb.sku}</td>
                  <td>{lb.lbType}</td>
                  <td>{lb.lbRules.length}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={() => onDelete(lb.id)}>
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
