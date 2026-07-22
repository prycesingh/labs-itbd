"use client";

import { useState } from "react";

import type { AppServiceResource, ConnectionString } from "@/lib/labs/simulators/azure/appServiceTypes";
import { isStandardOrBetter } from "@/lib/labs/simulators/azure/appServiceData";
import styles from "./azure-portal.module.css";
import { Callout } from "./wizard-fields";

export function SecDeployCenter({ app }: { app: AppServiceResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Source</h3>
      <p>Configure a source control repository to enable continuous deployment.</p>
      {app.continuousDeployment ? (
        <Callout tone="info">
          Continuous deployment is configured. Provider: <b>{app.cdProvider}</b>, repo: <b>{app.cdRepo}</b>,
          branch: <b>{app.cdBranch}</b>.
        </Callout>
      ) : (
        <Callout tone="warn">Continuous deployment is not configured.</Callout>
      )}
    </div>
  );
}

export function SecSlots({
  app,
  onAdd,
  onDelete,
}: {
  app: AppServiceResource;
  onAdd: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const canUseSlots = isStandardOrBetter(app.planTier);

  return (
    <div className={styles.sectionCard}>
      <h3>Deployment slots</h3>
      <p>
        Deployment slots allow you to deploy different versions of your app to different URLs. You can swap
        content and configuration between slots.
      </p>
      {canUseSlots ? (
        showForm ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Slot name (e.g., staging)"
              className={styles.input}
              style={{ width: 220 }}
            />
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                onAdd(name);
                setShowForm(false);
                setName("");
              }}
            >
              Add
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className={styles.btn} style={{ marginBottom: 12 }} onClick={() => setShowForm(true)}>
            + Add slot
          </button>
        )
      ) : (
        <Callout tone="warn">
          Deployment slots are only available for Standard and Premium plans. Current tier: <b>{app.planTier}</b>.
        </Callout>
      )}
      <table className={styles.table} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Traffic %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <b>{app.name}</b> (production)
            </td>
            <td>{app.status}</td>
            <td>100%</td>
            <td>—</td>
          </tr>
          {app.slots.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.state}</td>
              <td>{s.trafficPct}%</td>
              <td>
                <button type="button" className={styles.link} onClick={() => onDelete(s.name)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function maskValue(v: string) {
  if (!v) return <i>(empty)</i>;
  return (
    <>
      <span style={{ fontFamily: "Consolas, monospace" }}>••••••••</span>{" "}
      <span className={styles.link}>Show</span>
    </>
  );
}

export function SecConfiguration({
  app,
  onAddSetting,
  onDeleteSetting,
  onAddConnectionString,
  onDeleteConnectionString,
}: {
  app: AppServiceResource;
  onAddSetting: (key: string, value: string) => void;
  onDeleteSetting: (key: string) => void;
  onAddConnectionString: (cs: ConnectionString) => void;
  onDeleteConnectionString: (index: number) => void;
}) {
  const [tab, setTab] = useState<"appsettings" | "connstr" | "general">("appsettings");
  const [settingKey, setSettingKey] = useState("");
  const [settingValue, setSettingValue] = useState("");
  const [csName, setCsName] = useState("");
  const [csValue, setCsValue] = useState("");
  const [csType, setCsType] = useState("SQLAzure");

  return (
    <div className={styles.sectionCard}>
      <div style={{ display: "flex", gap: 16, borderBottom: "1px solid #edebe9", marginBottom: 16 }}>
        {(["appsettings", "connstr", "general"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "8px 0",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #0078d4" : "2px solid transparent",
              color: tab === t ? "#0078d4" : "#605e5c",
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {t === "appsettings" ? "Application settings" : t === "connstr" ? "Connection strings" : "General settings"}
          </button>
        ))}
      </div>

      {tab === "appsettings" ? (
        <>
          <h3>Application settings</h3>
          <p>Application settings are exposed as environment variables to your app. Values are encrypted at rest.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 12 }}>Name</label>
              <input value={settingKey} onChange={(e) => setSettingKey(e.target.value)} placeholder="MY_SETTING" className={styles.input} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12 }}>Value</label>
              <input value={settingValue} onChange={(e) => setSettingValue(e.target.value)} placeholder="value" className={styles.input} style={{ minWidth: 240 }} />
            </div>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!settingKey) return;
                onAddSetting(settingKey, settingValue);
                setSettingKey("");
                setSettingValue("");
              }}
            >
              + New application setting
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Object.keys(app.appSettings).length === 0 ? (
                <tr>
                  <td colSpan={3}>No application settings. Add one above.</td>
                </tr>
              ) : (
                Object.entries(app.appSettings).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{maskValue(v)}</td>
                    <td>
                      <button type="button" className={styles.link} onClick={() => onDeleteSetting(k)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      ) : tab === "connstr" ? (
        <>
          <h3>Connection strings</h3>
          <p>Connection strings are exposed to your app via the platform.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 12 }}>Name</label>
              <input value={csName} onChange={(e) => setCsName(e.target.value)} placeholder="MyDb" className={styles.input} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12 }}>Value</label>
              <input
                value={csValue}
                onChange={(e) => setCsValue(e.target.value)}
                placeholder="Server=…;Database=…;"
                className={styles.input}
                style={{ minWidth: 240 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12 }}>Type</label>
              <select value={csType} onChange={(e) => setCsType(e.target.value)} className={styles.select}>
                <option>SQLAzure</option>
                <option>SQLServer</option>
                <option>MySQL</option>
                <option>PostgreSQL</option>
                <option>Custom</option>
              </select>
            </div>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!csName) return;
                onAddConnectionString({ name: csName, value: csValue, type: csType });
                setCsName("");
                setCsValue("");
              }}
            >
              + New connection string
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {app.connectionStrings.length === 0 ? (
                <tr>
                  <td colSpan={4}>No connection strings configured.</td>
                </tr>
              ) : (
                app.connectionStrings.map((c, i) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td>{maskValue(c.value)}</td>
                    <td>{c.type}</td>
                    <td>
                      <button type="button" className={styles.link} onClick={() => onDeleteConnectionString(i)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <h3>General settings</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              ["Stack", app.runtimeStack],
              ["Platform", app.operatingSystem],
              ["FTP state", "All allowed"],
              ["HTTP version", "1.1"],
              ["Web sockets", "Off"],
              ["Always On", "On"],
              ["ARR affinity", "On"],
              ["HTTPS Only", "On"],
              ["Minimum TLS Version", "1.2"],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: "#605e5c", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 13 }}>{value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
