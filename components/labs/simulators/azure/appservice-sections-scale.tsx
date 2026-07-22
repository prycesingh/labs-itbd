"use client";

import { APP_SERVICE_TIERS } from "@/lib/labs/simulators/azure/appServiceData";
import type { AppServiceResource } from "@/lib/labs/simulators/azure/appServiceTypes";
import styles from "./azure-portal.module.css";
import { Callout } from "./wizard-fields";

export function SecScaleUp({ app, onChangeTier }: { app: AppServiceResource; onChangeTier: (tierId: string) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Scale up (App Service plan) — current: {app.planTier}</h3>
      <p>Click a pricing tier to apply it. Your App Service plan and all apps it hosts will be moved to the selected tier.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Family</th>
            <th>Cores</th>
            <th>RAM</th>
            <th>Storage</th>
            <th>Cost</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {APP_SERVICE_TIERS.map((t) => (
            <tr
              key={t.id}
              onClick={() => onChangeTier(t.id)}
              style={{ cursor: "pointer", background: t.id === app.planTier ? "#deecf9" : undefined }}
            >
              <td>
                {t.id === app.planTier ? <span style={{ color: "#107c10", fontWeight: 600 }}>✓ </span> : null}
                {t.label}
              </td>
              <td>{t.tier}</td>
              <td>{t.cores}</td>
              <td>{t.ram}</td>
              <td>{t.storage}</td>
              <td>${t.cost.toFixed(2)}/mo</td>
              <td>{t.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        <Callout tone="info">
          Some features (deployment slots, backups, auto-scale, zone redundancy) require Standard or Premium
          tiers.
        </Callout>
      </div>
    </div>
  );
}

export function SecScaleOut({
  app,
  onSetInstances,
}: {
  app: AppServiceResource;
  onSetInstances: (instances: number, log: boolean) => void;
}) {
  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Manual scale</h3>
        <p>Manually adjust the number of instances running your app.</p>
        <label style={{ display: "block", marginBottom: 8 }}>
          Instance count: <b>{app.instances}</b>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={app.instances}
          onChange={(e) => onSetInstances(parseInt(e.target.value, 10), false)}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#605e5c" }}>
          <span>1</span>
          <span>10</span>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Auto-scale rules</h3>
        <p>Automatically scale the number of instances based on demand using metrics such as CPU percentage.</p>
        <Callout tone="info">No auto-scale rules configured.</Callout>
      </div>
    </>
  );
}
