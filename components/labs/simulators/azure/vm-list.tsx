"use client";

import type { VmResource } from "@/lib/labs/simulators/azure/types";
import styles from "./azure-portal.module.css";

export function VmList({
  resources,
  onOpen,
  onCreate,
  onSetStatus,
  onDelete,
}: {
  resources: VmResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onSetStatus: (id: string, status: "Running" | "Stopped") => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Virtual machines</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>
            No virtual machines yet. Click Create to deploy your first one.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Resource group</th>
                <th>Region</th>
                <th>Size</th>
                <th>OS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((vm) => (
                <tr key={vm.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(vm.id)} className={styles.link}>
                      {vm.name}
                    </button>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${vm.status === "Running" ? styles.badgeRunning : styles.badgeStopped}`}>
                      {vm.status}
                    </span>
                  </td>
                  <td>{vm.resourceGroup}</td>
                  <td>{vm.region}</td>
                  <td>{vm.size}</td>
                  <td>{vm.os}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      {vm.status === "Running" ? (
                        <button
                          type="button"
                          className={styles.actBtn}
                          onClick={() => onSetStatus(vm.id, "Stopped")}
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actBtn}
                          onClick={() => onSetStatus(vm.id, "Running")}
                        >
                          Start
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.actBtn} ${styles.actBtnDelete}`}
                        onClick={() => onDelete(vm.id)}
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
