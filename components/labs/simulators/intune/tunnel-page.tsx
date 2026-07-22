"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Modal, FormGroup, Pill, StatRow } from "./intune-ui";
import styles from "./intune-console.module.css";

const TABS = ["Overview", "Sites", "Servers", "Server configurations", "Health monitoring", "Audit logs"] as const;
type Tab = (typeof TABS)[number];

type Site = { name: string; region: string; serverCount: number };
type ServerStatus = "Running" | "Restarting..." | "Stopped";
type Server = { name: string; site: string; status: ServerStatus; version: string };
type ServerConfig = { name: string; description: string; assignedSites: number };

const INITIAL_SITES: Site[] = [
  { name: "HQ-Tunnel-Site", region: "US / East", serverCount: 2 },
  { name: "Branch-EU-Site", region: "EU / Ireland", serverCount: 2 },
  { name: "DR-Site", region: "APAC / Singapore", serverCount: 1 },
];

const INITIAL_SERVERS: Server[] = [
  { name: "TUN-SRV-01", site: "HQ-Tunnel-Site", status: "Running", version: "1.2.4" },
  { name: "TUN-SRV-02", site: "HQ-Tunnel-Site", status: "Running", version: "1.2.4" },
  { name: "TUN-SRV-03", site: "Branch-EU-Site", status: "Running", version: "1.2.3" },
  { name: "TUN-SRV-04", site: "Branch-EU-Site", status: "Stopped", version: "1.2.3" },
  { name: "TUN-SRV-05", site: "DR-Site", status: "Running", version: "1.2.4" },
];

const INITIAL_CONFIGS: ServerConfig[] = [
  { name: "CL-Tunnel-Corp-AllSites", description: "Split-tunnel, corp ranges only, TCP+UDP on 443", assignedSites: 2 },
  { name: "CL-Tunnel-Full-Tunnel", description: "Full tunnel via corp proxy, TCP+UDP on 443", assignedSites: 1 },
];

const AUDIT_LOG = [
  "2026-04-10 09:15 — Server TUN-SRV-03 restarted by admin@cloudlab.onmicrosoft.com",
  "2026-04-09 16:42 — Server configuration CL-Tunnel-Corp-AllSites updated by itadmin@cloudlab.onmicrosoft.com",
  "2026-04-08 11:03 — Site Branch-EU-Site added by admin@cloudlab.onmicrosoft.com",
  "2026-04-06 08:27 — Docker image upgraded on TUN-SRV-01 by admin@cloudlab.onmicrosoft.com",
  "2026-04-02 14:55 — Server TUN-SRV-05 added to DR-Site by itadmin@cloudlab.onmicrosoft.com",
];

export function TunnelPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [sites, setSites] = useState<Site[]>(INITIAL_SITES);
  const [servers, setServers] = useState<Server[]>(INITIAL_SERVERS);
  const [configs, setConfigs] = useState<ServerConfig[]>(INITIAL_CONFIGS);

  const [showAddSite, setShowAddSite] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteRegion, setSiteRegion] = useState("");

  const [showAddConfig, setShowAddConfig] = useState(false);
  const [configName, setConfigName] = useState("");
  const [configDesc, setConfigDesc] = useState("");

  const serversRunning = servers.filter((s) => s.status === "Running").length;

  function addSite() {
    if (!siteName.trim() || !siteRegion.trim()) return;
    setSites((prev) => [...prev, { name: siteName.trim(), region: siteRegion.trim(), serverCount: 0 }]);
    setShowAddSite(false);
    setSiteName("");
    setSiteRegion("");
    toast.success("Site added.");
  }

  function addConfig() {
    if (!configName.trim()) return;
    setConfigs((prev) => [...prev, { name: configName.trim(), description: configDesc.trim(), assignedSites: 0 }]);
    setShowAddConfig(false);
    setConfigName("");
    setConfigDesc("");
    toast.success("Server configuration created.");
  }

  function restartServer(name: string) {
    setServers((prev) => prev.map((s) => (s.name === name ? { ...s, status: "Restarting..." } : s)));
    setTimeout(() => {
      setServers((prev) => prev.map((s) => (s.name === name ? { ...s, status: "Running" } : s)));
      toast.success(`${name} restarted successfully.`);
    }, 1500);
  }

  function upgradeServer(name: string) {
    toast.info(`Upgrading Docker image on ${name}...`);
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Microsoft Tunnel Gateway</h1>
      <p className={styles.pageSub}>Per-app + per-device VPN gateway for iOS / Android / Windows / Linux managed devices.</p>

      <div className={styles.subtabs}>
        {TABS.map((t) => (
          <button key={t} type="button" className={`${styles.subtab} ${tab === t ? styles.subtabActive : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div>
          <StatRow
            stats={[
              { label: "Sites", value: sites.length },
              { label: "Servers", value: servers.length },
              { label: "Server configurations", value: configs.length },
              { label: "Servers running", value: serversRunning },
            ]}
          />
          <div className={styles.card}>
            <div className={styles.cardTitle}>Health summary</div>
            <p className={styles.muted}>
              {serversRunning} of {servers.length} tunnel servers currently reporting Running. Servers report health metrics to Intune every 60 seconds.
            </p>
          </div>
        </div>
      )}

      {tab === "Sites" && (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setShowAddSite(true)}>
              + Add site
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Region</th>
                  <th>Server count</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.region}</td>
                    <td>{s.serverCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "Servers" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Site</th>
                <th>Status</th>
                <th>Version</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.site}</td>
                  <td>
                    <Pill tone={s.status === "Running" ? "ok" : s.status === "Restarting..." ? "warn" : "err"}>{s.status}</Pill>
                  </td>
                  <td>{s.version}</td>
                  <td>
                    <button type="button" className={styles.tbBtn} disabled={s.status === "Restarting..."} onClick={() => restartServer(s.name)}>
                      Restart
                    </button>
                    <button type="button" className={styles.tbBtn} onClick={() => upgradeServer(s.name)}>
                      Upgrade Docker image
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Server configurations" && (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setShowAddConfig(true)}>
              + Add configuration
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Assigned sites</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.description}</td>
                    <td>{c.assignedSites}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "Health monitoring" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            All tunnel servers reporting healthy <Pill tone="ok">Healthy</Pill>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td className={styles.muted}>Average latency</td>
                  <td>24ms</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Active connections</td>
                  <td>142</td>
                </tr>
                <tr>
                  <td className={styles.muted}>Docker image version drift</td>
                  <td>1 server pending upgrade</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Audit logs" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              {AUDIT_LOG.map((line) => (
                <tr key={line}>
                  <td>{line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddSite && (
        <Modal
          title="Add site"
          onClose={() => setShowAddSite(false)}
          footer={
            <>
              <button type="button" className={styles.tbBtn} onClick={() => setShowAddSite(false)}>
                Cancel
              </button>
              <button type="button" className={styles.tbBtn} onClick={addSite}>
                Add
              </button>
            </>
          }
        >
          <FormGroup label="Name">
            <input className={styles.input} value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g., CloudLab-APAC-Singapore" />
          </FormGroup>
          <FormGroup label="Region">
            <input className={styles.input} value={siteRegion} onChange={(e) => setSiteRegion(e.target.value)} placeholder="e.g., APAC / Singapore" />
          </FormGroup>
        </Modal>
      )}

      {showAddConfig && (
        <Modal
          title="Add configuration"
          onClose={() => setShowAddConfig(false)}
          footer={
            <>
              <button type="button" className={styles.tbBtn} onClick={() => setShowAddConfig(false)}>
                Cancel
              </button>
              <button type="button" className={styles.tbBtn} onClick={addConfig}>
                Create
              </button>
            </>
          }
        >
          <FormGroup label="Name">
            <input className={styles.input} value={configName} onChange={(e) => setConfigName(e.target.value)} placeholder="e.g., CL-Tunnel-NewConfig" />
          </FormGroup>
          <FormGroup label="Description">
            <input className={styles.input} value={configDesc} onChange={(e) => setConfigDesc(e.target.value)} placeholder="Split-tunnel, corp ranges only" />
          </FormGroup>
        </Modal>
      )}
    </div>
  );
}
