"use client";

import type { VnetResource } from "@/lib/labs/simulators/azure/vnetTypes";
import styles from "./azure-portal.module.css";

export function VnetList({
  resources,
  onOpen,
  onCreate,
  onDelete,
}: {
  resources: VnetResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Virtual networks</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>No virtual networks yet. Click Create to make your first one.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Resource group</th>
                <th>Region</th>
                <th>Address space</th>
                <th>Subnets</th>
                <th>Peerings</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((vnet) => (
                <tr key={vnet.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(vnet.id)} className={styles.link}>
                      {vnet.name}
                    </button>
                  </td>
                  <td>{vnet.resourceGroup}</td>
                  <td>{vnet.region}</td>
                  <td>{vnet.addressSpace.join(", ")}</td>
                  <td>{vnet.subnets.length}</td>
                  <td>{vnet.peerings.length}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={() => onDelete(vnet.id)}>
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
