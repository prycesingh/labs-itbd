"use client";

import type { RgResource } from "@/lib/labs/simulators/azure/rgTypes";
import styles from "./azure-portal.module.css";

export function RgList({
  resources,
  onOpen,
  onCreate,
  onDelete,
}: {
  resources: RgResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Resource groups</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>
            No resource groups yet. Click Create to make your first one.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Region</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((rg) => (
                <tr key={rg.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(rg.id)} className={styles.link}>
                      {rg.name}
                    </button>
                  </td>
                  <td>{rg.region}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={() => onDelete(rg.id)}>
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
