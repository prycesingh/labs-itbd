"use client";

import type { NsgResource } from "@/lib/labs/simulators/azure/nsgTypes";
import styles from "./azure-portal.module.css";

export function NsgList({
  resources,
  onOpen,
  onCreate,
  onDelete,
}: {
  resources: NsgResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Network security groups</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>
            No network security groups yet. Click Create to make your first one.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Resource group</th>
                <th>Region</th>
                <th>Inbound rules</th>
                <th>Outbound rules</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((nsg) => (
                <tr key={nsg.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(nsg.id)} className={styles.link}>
                      {nsg.name}
                    </button>
                  </td>
                  <td>{nsg.resourceGroup}</td>
                  <td>{nsg.region}</td>
                  <td>{nsg.inboundRules.length}</td>
                  <td>{nsg.outboundRules.length}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className={`${styles.actBtn} ${styles.actBtnDelete}`}
                        onClick={() => onDelete(nsg.id)}
                      >
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
