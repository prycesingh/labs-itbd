"use client";

import { useState } from "react";

import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { ActivityLogEntry } from "@/lib/labs/simulators/azure/sharedTypes";
import type { AppServiceResource } from "@/lib/labs/simulators/azure/appServiceTypes";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecOverview({ app, onEditTags }: { app: AppServiceResource; onEditTags: () => void }) {
  return (
    <>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Resource group" value={app.resourceGroup} />
          <PropPair
            label="Status"
            value={<span className={`${styles.badge} ${app.status === "Running" ? styles.badgeRunning : styles.badgeStopped}`}>{app.status}</span>}
          />
          <PropPair label="Location" value={app.region} />
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair
            label="URL"
            value={
              <a className={styles.link} href={app.defaultUrl} target="_blank" rel="noreferrer">
                {app.defaultUrl}
              </a>
            }
          />
          <PropPair label="Default domain" value={`${app.name}.azurewebsites.net`} />
          <PropPair label="App Service Plan" value={app.appServicePlan} />
          <PropPair label="Operating System" value={app.operatingSystem} />
          <PropPair label="Runtime" value={app.runtimeStack} />
          <PropPair label="Health Check status" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>Healthy</span>} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Properties</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Publish mode" value={app.publish} />
          <PropPair label="Tier" value={app.planTier} />
          <PropPair label="Public access" value={app.publicAccess ? "Enabled" : "Disabled"} />
          <PropPair label="Basic authentication" value={app.basicAuthEnabled ? "Enabled" : "Disabled"} />
          <PropPair label="Application Insights" value={app.appInsights ? "Enabled" : "Disabled"} />
          <PropPair label="Instances" value={app.instances} />
          <PropPair label="Created on" value={new Date(app.createdAt).toLocaleString()} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(app.tags).length === 0 ? (
          <p>No tags.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(app.tags).map(([k, v]) => (
              <span key={k} className={`${styles.badge} ${styles.badgeOutline}`}>
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function SecActivity({ app, activityLog }: { app: AppServiceResource; activityLog: ActivityLogEntry[] }) {
  const logs = activityLog.filter((l) => l.resource === app.name).slice(0, 20);
  return (
    <div className={styles.sectionCard}>
      <h3>Activity log</h3>
      {logs.length === 0 ? (
        <p>No activity for this resource.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Operation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.operation}</td>
                <td>
                  <span className={`${styles.badge} ${l.status === "Succeeded" ? styles.badgeRunning : styles.badgeOutline}`}>
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SecIAM() {
  return (
    <div className={styles.sectionCard}>
      <h3>Access control (IAM)</h3>
      <p style={{ fontWeight: 600 }}>Built-in roles available for App Service:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Website Contributor — manage websites but not the web plans they connect to.</li>
        <li>Web Plan Contributor — manage web plans but not the websites they host.</li>
        <li>Contributor — full access to manage all resources, but not assign roles.</li>
        <li>Reader — view resources, but not make changes.</li>
      </ul>
    </div>
  );
}

export function SecTags({
  app,
  onAddTag,
  onDeleteTag,
}: {
  app: AppServiceResource;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Tags</h3>
      <table className={styles.table} style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Object.keys(app.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add one below.</td>
            </tr>
          ) : (
            Object.entries(app.tags).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDeleteTag(k)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Name" className={styles.input} style={{ width: 160 }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={styles.input} style={{ width: 160 }} />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!key) return;
            onAddTag(key, value);
            setKey("");
            setValue("");
          }}
        >
          Add tag
        </button>
      </div>
    </div>
  );
}

export function SecDiagnose() {
  return (
    <div className={styles.sectionCard}>
      <h3>Diagnose and solve problems</h3>
      <p>Identify common issues and find recommended solutions for your web app.</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#0078d4", lineHeight: 1.8 }}>
        <li>Availability and performance</li>
        <li>Configuration and management</li>
        <li>SSL and domains</li>
        <li>Best practices</li>
        <li>Risk assessments</li>
      </ul>
    </div>
  );
}
