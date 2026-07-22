"use client";

import type { AppServiceResource } from "@/lib/labs/simulators/azure/appServiceTypes";
import styles from "./azure-portal.module.css";

export function AppServiceList({
  resources,
  onOpen,
  onCreate,
  onSetStatus,
  onDelete,
}: {
  resources: AppServiceResource[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onSetStatus: (id: string, status: "Running" | "Stopped") => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>App Services</h1>
          <p className={styles.sub}>CloudLab-Training-Sub</p>
        </div>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create
        </button>
      </div>

      <div className={styles.listBody}>
        {resources.length === 0 ? (
          <div className={styles.emptyState}>No App Services yet. Click Create to deploy your first one.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Resource group</th>
                <th>Region</th>
                <th>Plan</th>
                <th>OS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((app) => (
                <tr key={app.id}>
                  <td>
                    <button type="button" onClick={() => onOpen(app.id)} className={styles.link}>
                      {app.name}
                    </button>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${app.status === "Running" ? styles.badgeRunning : styles.badgeStopped}`}>
                      {app.status}
                    </span>
                  </td>
                  <td>{app.resourceGroup}</td>
                  <td>{app.region}</td>
                  <td>{app.appServicePlan}</td>
                  <td>{app.operatingSystem}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      {app.status === "Running" ? (
                        <button type="button" className={styles.actBtn} onClick={() => onSetStatus(app.id, "Stopped")}>
                          Stop
                        </button>
                      ) : (
                        <button type="button" className={styles.actBtn} onClick={() => onSetStatus(app.id, "Running")}>
                          Start
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.actBtn} ${styles.actBtnDelete}`}
                        onClick={() => onDelete(app.id)}
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
