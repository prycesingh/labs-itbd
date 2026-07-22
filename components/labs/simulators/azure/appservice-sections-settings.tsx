"use client";

import { useState } from "react";

import type { AppServiceResource } from "@/lib/labs/simulators/azure/appServiceTypes";
import { isStandardOrBetter } from "@/lib/labs/simulators/azure/appServiceData";
import styles from "./azure-portal.module.css";
import { Callout, PropPair } from "./wizard-fields";

function maskValue(v: string) {
  if (!v) return <i>(empty)</i>;
  return (
    <>
      <span style={{ fontFamily: "Consolas, monospace" }}>••••••••</span>{" "}
      <span className={styles.link}>Show</span>
    </>
  );
}

export function SecEnvVars({
  app,
  onAdd,
  onDelete,
}: {
  app: AppServiceResource;
  onAdd: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Environment variables</h3>
      <p>Application settings and connection strings are exposed as environment variables to your application code.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 12 }}>Name</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="MY_VAR" className={styles.input} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12 }}>Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" className={styles.input} style={{ minWidth: 240 }} />
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!key) return;
            onAdd(key, value);
            setKey("");
            setValue("");
          }}
        >
          + Add variable
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
              <td colSpan={3}>No environment variables. Add one above.</td>
            </tr>
          ) : (
            Object.entries(app.appSettings).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{maskValue(v)}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(k)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SecAuth() {
  const providers = ["Microsoft", "Facebook", "Google", "Twitter", "Apple", "OpenID Connect"];
  return (
    <div className={styles.sectionCard}>
      <h3>Authentication</h3>
      <p>Configure an identity provider so your users can sign in to your application without writing any code.</p>
      <Callout tone="info">App Service authentication (Easy Auth) is currently not configured. Anonymous requests are allowed.</Callout>
      <table className={styles.table} style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Identity provider</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p}>
              <td>
                <b>{p}</b>
              </td>
              <td>
                <span className={`${styles.badge} ${styles.badgeStopped}`}>Not configured</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecAppInsights({ app, onToggle }: { app: AppServiceResource; onToggle: (enabled: boolean) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Application Insights</h3>
      {app.appInsights ? (
        <>
          <Callout tone="info">Application Insights is enabled. Telemetry is being collected.</Callout>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
            <PropPair label="Resource name" value={`${app.name}-insights`} />
            <PropPair label="Sampling" value="100%" />
            <PropPair label="Profiler" value="On" />
          </div>
          <button type="button" className={styles.btnOutline} style={{ marginTop: 12 }} onClick={() => onToggle(false)}>
            Disable
          </button>
        </>
      ) : (
        <>
          <p>Application Insights is not enabled. Enable it for performance monitoring, exception tracking, and live metrics.</p>
          <button type="button" className={styles.btn} onClick={() => onToggle(true)}>
            Turn on Application Insights
          </button>
        </>
      )}
    </div>
  );
}

export function SecIdentity() {
  return (
    <div className={styles.sectionCard}>
      <h3>System assigned managed identity</h3>
      <p>An identity is created in Microsoft Entra ID tied to this App Service. The identity is deleted when the App Service is deleted.</p>
      <p style={{ marginTop: 12 }}>
        <b>Status:</b> <span className={`${styles.badge} ${styles.badgeStopped}`}>Off</span>
      </p>
    </div>
  );
}

export function SecBackups({ app }: { app: AppServiceResource }) {
  const canBackup = isStandardOrBetter(app.planTier);
  return (
    <div className={styles.sectionCard}>
      <h3>Backups</h3>
      {canBackup ? (
        <>
          <p>Schedule periodic backups of your app content, configuration, and connected databases.</p>
          <button type="button" className={styles.btn}>
            Configure backup
          </button>
        </>
      ) : (
        <Callout tone="warn">
          Backups are only available for Standard and Premium plans. Current tier: <b>{app.planTier}</b>.
        </Callout>
      )}
    </div>
  );
}

export function SecCustomDomains({
  app,
  onAdd,
  onDelete,
}: {
  app: AppServiceResource;
  onAdd: (domain: string) => void;
  onDelete: (domain: string) => void;
}) {
  const [domain, setDomain] = useState("");
  return (
    <div className={styles.sectionCard}>
      <h3>Custom domains</h3>
      <p>
        Default domain: <b>{app.name}.azurewebsites.net</b>
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="www.example.com"
          className={styles.input}
          style={{ width: 260 }}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!domain) return;
            onAdd(domain);
            setDomain("");
          }}
        >
          + Add custom domain
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Domain</th>
            <th>SSL state</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {app.customDomains.length === 0 ? (
            <tr>
              <td colSpan={3}>No custom domains configured.</td>
            </tr>
          ) : (
            app.customDomains.map((d) => (
              <tr key={d}>
                <td>{d}</td>
                <td>
                  <span className={`${styles.badge} ${styles.badgeRunning}`}>Verified</span>
                </td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(d)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SecTLS({ app }: { app: AppServiceResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>TLS/SSL Bindings</h3>
      <p>Bind a certificate to a hostname to enable HTTPS for that hostname.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 12 }}>
        <PropPair label="HTTPS Only" value={<span className={`${styles.badge} ${styles.badgeRunning}`}>On</span>} />
        <PropPair label="Minimum TLS Version" value="1.2" />
        <PropPair label="Incoming client certificates" value="Ignore" />
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Hostname</th>
            <th>SSL state</th>
            <th>SSL type</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{app.name}.azurewebsites.net</td>
            <td>
              <span className={`${styles.badge} ${styles.badgeRunning}`}>Secure (managed)</span>
            </td>
            <td>App Service Managed Certificate</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SecNetworking({ app }: { app: AppServiceResource }) {
  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Inbound traffic configuration</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <PropPair label="Public network access" value={app.publicAccess ? "Enabled (All networks)" : "Disabled"} />
          <PropPair label="Access restrictions" value="0 rules configured" />
          <PropPair label="Private endpoints" value="0 configured" />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Outbound traffic configuration</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <PropPair label="VNet integration" value={app.vnetIntegration ?? "Not configured"} />
          <PropPair label="Hybrid connections" value="0 configured" />
          <PropPair label="Outbound IP addresses" value="20.62.144.10, 20.62.144.11, 20.62.144.12" />
        </div>
      </div>
    </>
  );
}
