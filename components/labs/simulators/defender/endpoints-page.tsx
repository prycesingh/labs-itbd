"use client";

// Endpoints: device inventory + 7-tab device detail flyout, vulnerability
// management, and asset inventory — ported from
// itbd-lab/simulators/defender/js/defender-endpoints.js
// (renderDevices/deviceHtml/deviceTabBody/renderVulnMgmt/renderAssetInventory).
//
// Three independent page exports (matching the three DefenderPage slots
// `endpoints-devices` / `endpoints-vuln-mgmt` / `endpoints-asset-inventory`):
//   - EndpointsDevicesPage — read-only device inventory + 7-tab detail blade.
//     Row action buttons (scan/collect/isolate) are toast-only, matching
//     source's runAction() which never mutates device state.
//   - VulnMgmtPage — read-only. Stat tiles are genuine derived numbers via
//     .reduce()/.filter() over state.vulnerabilities, matching source.
//   - AssetInventoryPage — real CRUD via the reducer's ONBOARD_ASSET /
//     OFFBOARD_ASSET / CLASSIFY_ASSET actions.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderAsset, DefenderDevice, DefenderState } from "@/lib/labs/simulators/defender/types";
import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import { DataTable, EmptyState, Field, Flyout, Modal, NativeSelect, SeverityBadge, StatRow, StatusPill, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)} sec ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
}

// Maps source's df-risk (red/orange/yellow/grey) onto SeverityBadge — the
// shared component keys severity classes by the same High/Medium/Low(/
// Informational) vocabulary; "Very High"/"None" fall back to the nearest tone.
function RiskBadge({ risk }: { risk: string }) {
  const severity = risk === "Very High" ? "High" : risk === "None" ? "Informational" : risk;
  return <SeverityBadge severity={severity} />;
}

function healthTone(health: DefenderDevice["healthState"]): "ok" | "warn" | "muted" {
  if (health === "Active") return "ok";
  if (health === "Inactive") return "warn";
  return "muted";
}

// ===================== DEVICE INVENTORY + DETAIL =====================

type RiskFilter = "all" | DefenderDevice["riskLevel"];
type ExposureFilter = "all" | DefenderDevice["exposureLevel"];

const RISK_FILTERS: RiskFilter[] = ["all", "Very High", "High", "Medium", "Low", "None"];
const EXPOSURE_FILTERS: ExposureFilter[] = ["all", "High", "Medium", "Low"];

type DeviceTab = "overview" | "alerts" | "timeline" | "recommendations" | "software" | "vulnerabilities" | "missing-kbs";

const DEVICE_TABS: { key: DeviceTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "alerts", label: "Alerts" },
  { key: "timeline", label: "Timeline" },
  { key: "recommendations", label: "Security recommendations" },
  { key: "software", label: "Software inventory" },
  { key: "vulnerabilities", label: "Discovered vulnerabilities" },
  { key: "missing-kbs", label: "Missing KBs" },
];

// Synthesized timeline events — source hardcodes a fixed illustrative process/
// network/file/registry/logon sequence per device (not derived from real
// per-device fields beyond loggedOnUser), so this is ported verbatim rather
// than invented fresh.
function buildTimelineEvents(d: DefenderDevice): { ts: string; type: string; title: string; meta: string }[] {
  return [
    { ts: "11:42:18", type: "Process", title: "powershell.exe spawned by outlook.exe", meta: `user: ${d.loggedOnUser}` },
    { ts: "11:42:20", type: "Network", title: "Connection to 198.51.100.34:443", meta: "process: powershell.exe" },
    { ts: "11:42:25", type: "File", title: "File created: %TEMP%\\helper.exe", meta: "sha256: a1b2...ff" },
    { ts: "11:42:32", type: "Registry", title: "Run key created: HKCU\\...\\Run\\Helper", meta: "value: C:\\Users\\Public\\helper.exe" },
    { ts: "11:43:01", type: "Process", title: "rundll32.exe accessed lsass.exe memory", meta: "CommandLine: rundll32 comsvcs.dll MiniDump 632 lsass.dmp" },
    { ts: "11:45:14", type: "Network", title: "DNS query to cdn-ms-update[.]xyz", meta: "protocol: DNS" },
    { ts: "11:46:50", type: "Process", title: 'cmd.exe /c net group "Domain Admins" /domain', meta: "discovery" },
    { ts: "11:47:12", type: "Logon", title: "Type 3 (Network) logon to FILE-SRV-01", meta: `user: ${d.loggedOnUser}` },
  ];
}

type ActionKind = "scan" | "collect" | "isolate";
const ACTION_LABELS: Record<ActionKind, string> = {
  scan: "Antivirus scan",
  collect: "Investigation package",
  isolate: "Device isolation",
};

export function EndpointsDevicesPage({ state }: { state: DefenderState }) {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [exposureFilter, setExposureFilter] = useState<ExposureFilter>("all");
  const [selected, setSelected] = useState<DefenderDevice | null>(null);
  const [deviceTab, setDeviceTab] = useState<DeviceTab>("overview");

  const devices = state.devices;

  const filtered = useMemo(
    () =>
      devices.filter((d) => {
        if (riskFilter !== "all" && d.riskLevel !== riskFilter) return false;
        if (exposureFilter !== "all" && d.exposureLevel !== exposureFilter) return false;
        return true;
      }),
    [devices, riskFilter, exposureFilter]
  );

  function openDevice(d: DefenderDevice) {
    setSelected(d);
    setDeviceTab("overview");
  }

  function runAction(kind: ActionKind) {
    if (!selected) return;
    toast.success(`${ACTION_LABELS[kind]} submitted on ${selected.name} (Action center)`);
  }

  const columns: DataTableColumn<DefenderDevice>[] = [
    { key: "name", header: "Name", render: (d) => <span className={styles.rowLink}>{d.name}</span> },
    { key: "domain", header: "Domain", render: (d) => d.domain },
    { key: "riskLevel", header: "Risk level", render: (d) => <RiskBadge risk={d.riskLevel} /> },
    { key: "exposureLevel", header: "Exposure level", render: (d) => <RiskBadge risk={d.exposureLevel} /> },
    { key: "os", header: "OS", render: (d) => d.os },
    { key: "healthState", header: "Health state", render: (d) => <StatusPill tone={healthTone(d.healthState)}>{d.healthState}</StatusPill> },
    { key: "deviceType", header: "Device type", render: (d) => d.deviceType },
    { key: "lastSeen", header: "Last seen", render: (d) => timeAgo(d.lastSeen) },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>/</span>
        <a>Endpoints</a>
        <span>/</span>
        <a>Device inventory</a>
      </div>
      <div className={styles.pageH1}>Device inventory</div>
      <div className={styles.pageSub}>All devices reporting to Microsoft Defender for Endpoint.</div>

      <div className={styles.filterRow}>
        {RISK_FILTERS.map((r) => (
          <button key={r} type="button" className={`${styles.chip} ${riskFilter === r ? styles.chipActive : ""}`} onClick={() => setRiskFilter(r)}>
            {r === "all" ? "Risk: any" : r}
          </button>
        ))}
        {EXPOSURE_FILTERS.map((r) => (
          <button key={`exp-${r}`} type="button" className={`${styles.chip} ${exposureFilter === r ? styles.chipActive : ""}`} onClick={() => setExposureFilter(r)}>
            {r === "all" ? "Exposure: any" : r}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filtered} getRowKey={(d) => d.id} onRowClick={openDevice} emptyMessage="No devices match the filter." />

      {selected ? (
        <Flyout
          title={selected.name}
          subtitle="Device"
          onClose={() => setSelected(null)}
          tabs={DEVICE_TABS.map((t) => (
            <button key={t.key} type="button" className={`${styles.tab} ${deviceTab === t.key ? styles.tabActive : ""}`} onClick={() => setDeviceTab(t.key)}>
              {t.label}
            </button>
          ))}
          footer={
            <>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => runAction("scan")}>
                Run antivirus scan
              </button>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => runAction("collect")}>
                Collect investigation package
              </button>
              <button type="button" className={styles.btn} onClick={() => runAction("isolate")}>
                Isolate device
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12, marginBottom: 18 }}>
            <div>
              <div style={{ color: "#605e5c" }}>Risk level</div>
              <RiskBadge risk={selected.riskLevel} />
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Exposure</div>
              <RiskBadge risk={selected.exposureLevel} />
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>OS</div>
              {selected.os}
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Health</div>
              <strong>{selected.healthState}</strong>
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Last seen</div>
              {timeAgo(selected.lastSeen)}
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Logged on user</div>
              {selected.loggedOnUser}
            </div>
          </div>

          <DeviceTabBody device={selected} tab={deviceTab} state={state} />
        </Flyout>
      ) : null}
    </div>
  );
}

function DeviceTabBody({ device, tab, state }: { device: DefenderDevice; tab: DeviceTab; state: DefenderState }) {
  switch (tab) {
    case "overview":
      return <DeviceOverviewTab device={device} />;
    case "alerts":
      return <DeviceAlertsTab device={device} state={state} />;
    case "timeline":
      return <DeviceTimelineTab device={device} />;
    case "recommendations":
      return <DeviceRecommendationsTab device={device} />;
    case "software":
      return <DeviceSoftwareTab device={device} />;
    case "vulnerabilities":
      return <DeviceVulnerabilitiesTab device={device} state={state} />;
    case "missing-kbs":
      return <DeviceMissingKbsTab device={device} />;
    default:
      return null;
  }
}

function DeviceOverviewTab({ device: d }: { device: DefenderDevice }) {
  return (
    <>
      <div className={styles.row}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Device summary</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div>
              <span style={{ color: "#605e5c" }}>Domain:</span> {d.domain}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>OS:</span> {d.os}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Device type:</span> {d.deviceType}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Managed by:</span> {d.managedBy}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>IP address:</span> {d.ipAddress}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Public IP:</span> {d.publicIp}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>First seen:</span> {d.firstSeen}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Onboarded:</span> {d.onboardedOn}
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Security posture</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div>
              <span style={{ color: "#605e5c" }}>Antivirus:</span> {d.avStatus}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Vulnerabilities:</span> {d.vulnerabilities}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Missing KBs:</span> {d.missingKbs.length}
            </div>
            <div>
              <span style={{ color: "#605e5c" }}>Tags:</span> {d.tags.join(", ") || "(none)"}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Logged on users (last 7 days)</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Login type</th>
                <th>First seen</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{d.loggedOnUser}@cloudlab.in</td>
                <td>Interactive</td>
                <td>3 days ago</td>
                <td>{timeAgo(d.lastSeen)}</td>
              </tr>
              <tr>
                <td>admin@itbd.net</td>
                <td>Remote</td>
                <td>6 days ago</td>
                <td>2 days ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function DeviceAlertsTab({ device, state }: { device: DefenderDevice; state: DefenderState }) {
  const alerts = state.alerts.filter((a) => a.impactedAssets === device.name).slice(0, 8);
  if (alerts.length === 0) {
    return <EmptyState message="No alerts on this device in the last 30 days. See the Alerts page for tenant-wide alert activity." />;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Title</th>
            <th>Status</th>
            <th>Category</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td>
                <SeverityBadge severity={a.severity} />
              </td>
              <td className={styles.rowLink}>{a.title}</td>
              <td>{a.status}</td>
              <td>{a.category}</td>
              <td>{timeAgo(a.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceTimelineTab({ device }: { device: DefenderDevice }) {
  const events = buildTimelineEvents(device);
  return (
    <>
      <div className={styles.pageSub}>Process, file, network, registry and logon events on this device.</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Description</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 12, color: "#605e5c" }}>{e.ts}</td>
                <td>
                  <span className={`${styles.pill} ${styles.pillInfo}`}>{e.type}</span>
                </td>
                <td>{e.title}</td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 11, color: "#605e5c" }}>{e.meta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DeviceRecommendationsTab({ device }: { device: DefenderDevice }) {
  if (device.recommendations.length === 0) {
    return <EmptyState message="No security recommendations for this device." />;
  }
  return (
    <>
      <div className={styles.pageSub}>Configuration changes that would improve this device&apos;s posture.</div>
      <div style={{ background: "#fff", border: "1px solid #edebe9", borderRadius: 4 }}>
        {device.recommendations.map((r, i) => (
          <div key={i} className={`${styles.recRow} ${r.status === "Completed" ? styles.recRowAchieved : ""}`}>
            <div className={styles.recIcon}>{r.status === "Completed" ? "✓" : "!"}</div>
            <div>{r.title}</div>
            <div style={{ color: "#107c10", fontWeight: 600 }}>{r.impact}</div>
            <div>
              <span className={`${styles.pill} ${r.status === "Completed" ? "" : styles.pillWarn}`}>{r.status}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function DeviceSoftwareTab({ device }: { device: DefenderDevice }) {
  if (device.installedSoftware.length === 0) {
    return <EmptyState message="No software inventory collected for this device." />;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Software</th>
            <th>Vendor</th>
            <th>Version</th>
            <th>Vulnerabilities</th>
          </tr>
        </thead>
        <tbody>
          {device.installedSoftware.map((s, i) => (
            <tr key={i}>
              <td className={styles.rowLink}>{s.name}</td>
              <td>{s.vendor}</td>
              <td>{s.version}</td>
              <td>{s.vulns > 0 ? <span className={`${styles.pill} ${styles.pillWarn}`}>{s.vulns}</span> : <span className={styles.pill}>0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceVulnerabilitiesTab({ device, state }: { device: DefenderDevice; state: DefenderState }) {
  const vulns = state.vulnerabilities.slice(0, Math.min(device.vulnerabilities, 7));
  return (
    <>
      <div className={styles.pageSub}>
        This device has <strong>{device.vulnerabilities}</strong> discovered vulnerabilities. See{" "}
        <a onClick={(e) => e.preventDefault()}>Vulnerability management</a> for the full tenant-wide CVE list.
      </div>
      {vulns.length === 0 ? (
        <EmptyState message="No vulnerabilities discovered on this device." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>CVE</th>
                <th>Description</th>
                <th>Severity</th>
                <th>CVSS</th>
                <th>Threat activity</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {vulns.map((v) => (
                <tr key={v.id}>
                  <td className={styles.rowLink}>{v.id}</td>
                  <td>{v.name}</td>
                  <td>
                    <SeverityBadge severity={v.severity} />
                  </td>
                  <td>{v.cvss}</td>
                  <td>{v.threatActivity}</td>
                  <td>{v.age} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function DeviceMissingKbsTab({ device }: { device: DefenderDevice }) {
  if (device.missingKbs.length === 0) {
    return <EmptyState message="No missing KBs detected." />;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>KB</th>
            <th>Category</th>
            <th>Release</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {device.missingKbs.map((kb) => (
            <tr key={kb}>
              <td>{kb}</td>
              <td>Security update</td>
              <td>April 2026</td>
              <td>
                <span className={`${styles.pill} ${styles.pillWarn}`}>Missing</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===================== VULNERABILITY MANAGEMENT =====================

export function VulnMgmtPage({ state }: { state: DefenderState }) {
  const v = state.vulnerabilities;

  // ----- Real derived stats via .reduce()/.filter(), matching source -----
  const totalExposed = v.reduce((acc, x) => acc + x.exposedDevices, 0);
  const active = v.filter((x) => x.threatActivity === "Active").length;

  const columns: DataTableColumn<(typeof v)[number]>[] = [
    { key: "id", header: "CVE", render: (x) => <span className={styles.rowLink}>{x.id}</span> },
    { key: "name", header: "Description", render: (x) => x.name },
    { key: "severity", header: "Severity", render: (x) => <SeverityBadge severity={x.severity} /> },
    { key: "cvss", header: "CVSS", render: (x) => x.cvss },
    { key: "exposedDevices", header: "Exposed devices", render: (x) => x.exposedDevices },
    { key: "threatActivity", header: "Threat activity", render: (x) => x.threatActivity },
    { key: "age", header: "Age", render: (x) => `${x.age} days` },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>/</span>
        <a>Endpoints</a>
        <span>/</span>
        <a>Vulnerability management</a>
      </div>
      <div className={styles.pageH1}>Vulnerability management</div>
      <div className={styles.pageSub}>Discover, prioritize and remediate vulnerabilities on your endpoints.</div>

      <StatRow
        stats={[
          { label: "Total CVEs", value: v.length },
          { label: "With active exploits", value: active },
          { label: "Exposed devices", value: totalExposed },
          { label: "Exposure score", value: 42 },
        ]}
      />

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${styles.tabActive}`}>
          Vulnerabilities
        </button>
        <button type="button" className={styles.tab}>
          Software inventory
        </button>
        <button type="button" className={styles.tab}>
          Weaknesses
        </button>
        <button type="button" className={styles.tab}>
          Recommendations
        </button>
      </div>

      <DataTable columns={columns} rows={v} getRowKey={(x) => x.id} emptyMessage="No vulnerabilities found." />
    </div>
  );
}

// ===================== ASSET INVENTORY =====================

const CLASSIFICATION_OPTIONS = ["Workstation", "Server", "Printer", "IoT", "IoT sensor", "Network device", "Storage", "Mobile", "Smart TV / Display", "OT / ICS"];

function assetTypeCounts(assets: DefenderAsset[]) {
  const unmanaged = assets.filter((a) => !a.onboarded).length;
  const iot = assets.filter((a) => a.type === "IoT device").length;
  const network = assets.filter((a) => a.type === "Network device").length;
  return { unmanaged, iot, network };
}

export function AssetInventoryPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [selected, setSelected] = useState<DefenderAsset | null>(null);
  const [onboardTarget, setOnboardTarget] = useState<DefenderAsset | null>(null);
  const [classifyTarget, setClassifyTarget] = useState<DefenderAsset | null>(null);
  const [tag, setTag] = useState("");
  const [classification, setClassification] = useState("");

  const assets = state.assets;
  const { unmanaged, iot, network } = assetTypeCounts(assets);

  function openOnboard(asset: DefenderAsset) {
    setTag("");
    setOnboardTarget(asset);
  }

  function confirmOnboard() {
    if (!onboardTarget) return;
    dispatch({ type: "ONBOARD_ASSET", id: onboardTarget.id, tag: tag || undefined });
    toast.success(`Onboarding package pushed to ${onboardTarget.name}${tag ? ` (tag: ${tag})` : ""} — telemetry will start within 10 minutes.`);
    setOnboardTarget(null);
    setSelected(null);
  }

  function offboardAsset(asset: DefenderAsset) {
    if (!confirm(`Offboard ${asset.name}? Telemetry collection will stop within ~7 days. Historical data is retained per workspace retention.`)) return;
    dispatch({ type: "OFFBOARD_ASSET", id: asset.id });
    toast.success(`Offboarding queued for ${asset.name}`);
    setSelected(null);
  }

  function openClassify(asset: DefenderAsset) {
    setClassification(asset.classification || CLASSIFICATION_OPTIONS[0]);
    setClassifyTarget(asset);
  }

  function confirmClassify() {
    if (!classifyTarget) return;
    dispatch({ type: "CLASSIFY_ASSET", id: classifyTarget.id, classification });
    toast.success(`Reclassified as ${classification}`);
    setClassifyTarget(null);
  }

  const columns: DataTableColumn<DefenderAsset>[] = [
    {
      key: "name",
      header: "Asset",
      render: (a) => (
        <>
          <span className={styles.rowLink}>{a.name}</span>
          {!a.onboarded ? (
            <span className={`${styles.pill} ${styles.pillWarn}`} style={{ marginLeft: 6 }}>
              Unmanaged
            </span>
          ) : null}
        </>
      ),
    },
    { key: "type", header: "Type", render: (a) => a.type },
    { key: "vendor", header: "Vendor", render: (a) => a.vendor },
    { key: "ipAddress", header: "IP address", render: (a) => <code>{a.ipAddress}</code> },
    { key: "category", header: "Category", render: (a) => a.category },
    { key: "classification", header: "Classification", render: (a) => a.classification || "-" },
    { key: "discoveredOn", header: "Discovered", render: (a) => timeAgo(a.discoveredOn) },
    {
      key: "onboarded",
      header: "Status",
      render: (a) => (a.onboarded ? <StatusPill tone="ok">Onboarded</StatusPill> : <StatusPill tone="warn">Unmanaged</StatusPill>),
    },
    {
      key: "actions",
      header: "Actions",
      render: (a) => (
        <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {a.onboarded ? (
            <button type="button" className={styles.btnSubtle} onClick={() => offboardAsset(a)}>
              Offboard
            </button>
          ) : (
            <button type="button" className={styles.btnSubtle} onClick={() => openOnboard(a)}>
              Onboard
            </button>
          )}
          <button type="button" className={styles.btnSubtle} onClick={() => openClassify(a)}>
            Classify
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>/</span>
        <a>Endpoints</a>
        <span>/</span>
        <a>Asset inventory</a>
      </div>
      <div className={styles.pageH1}>Asset inventory</div>
      <div className={styles.pageSub}>Network discovery of devices, users, IPs, and unmanaged systems. Click any row for the full asset fingerprint.</div>

      <StatRow
        stats={[
          { label: "Managed devices", value: state.devices.length },
          { label: "Unmanaged endpoints", value: unmanaged },
          { label: "Network devices", value: network },
          { label: "IoT devices", value: iot },
        ]}
      />

      <DataTable columns={columns} rows={assets} getRowKey={(a) => a.id} onRowClick={(a) => setSelected(a)} emptyMessage="No assets discovered." />

      <div className={styles.tip} style={{ marginTop: 14 }}>
        <strong>Onboarding tip:</strong> For Windows workstations onboard via Intune MDM (auto-deploys MDE.Windows extension). For Linux + macOS use the
        universal onboarding script. For network devices use Network discovery via authenticated SNMPv3.
      </div>

      {selected ? (
        <Flyout
          title={selected.name}
          subtitle={
            <>
              {selected.type} &middot; {selected.vendor} &middot; Discovered {timeAgo(selected.discoveredOn)}
            </>
          }
          onClose={() => setSelected(null)}
          footer={
            <>
              {selected.onboarded ? (
                <button type="button" className={styles.btn} onClick={() => offboardAsset(selected)}>
                  Offboard
                </button>
              ) : (
                <button type="button" className={styles.btnPrimary} onClick={() => openOnboard(selected)}>
                  Onboard device
                </button>
              )}
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => openClassify(selected)}>
                Reclassify
              </button>
              <button
                type="button"
                className={`${styles.btnOutline} ${styles.btn}`}
                onClick={() => toast.success("Network isolation applied via Defender for IoT firewall — outbound limited to RFC1918.")}
              >
                Apply network isolation
              </button>
            </>
          }
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td style={{ color: "#605e5c", width: 180 }}>IP address</td>
                  <td>
                    <code>{selected.ipAddress}</code>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Vendor</td>
                  <td>{selected.vendor}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Type</td>
                  <td>{selected.type}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Category</td>
                  <td>{selected.category}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Discovered on</td>
                  <td>{timeAgo(selected.discoveredOn)}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Classification</td>
                  <td>{selected.classification || "-"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Onboarded</td>
                  <td>{selected.onboarded ? <StatusPill tone="ok">Yes</StatusPill> : <StatusPill tone="warn">No</StatusPill>}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.h3}>Recommendation</div>
          <div className={styles.tip}>{assetRecommendation(selected)}</div>
        </Flyout>
      ) : null}

      {onboardTarget ? (
        <Modal
          title={`Onboard ${onboardTarget.name}`}
          width="600px"
          onClose={() => setOnboardTarget(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setOnboardTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmOnboard}>
                Push onboarding package
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, marginBottom: 14 }}>
            Onboarding adds this device to Defender for Endpoint and starts collecting telemetry (process events, network events, file events).
          </p>
          <Field label="Recommended method">
            <div style={{ fontSize: 13 }}>{onboardMethod(onboardTarget)}</div>
          </Field>
          <Field label="Estimated time">
            <div style={{ fontSize: 13 }}>2-10 minutes (depending on method)</div>
          </Field>
          <Field label="Tag" help="Optional label to help identify this asset later, e.g. corporate, BYOD, lab.">
            <input className={styles.input} type="text" placeholder="e.g. corporate, BYOD, lab" value={tag} onChange={(e) => setTag(e.target.value)} />
          </Field>
        </Modal>
      ) : null}

      {classifyTarget ? (
        <Modal
          title={`Reclassify ${classifyTarget.name}`}
          onClose={() => setClassifyTarget(null)}
          footer={
            <>
              <button type="button" className={styles.btn} onClick={() => setClassifyTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmClassify}>
                Save classification
              </button>
            </>
          }
        >
          <Field label="Classification">
            <NativeSelect value={classification} onChange={setClassification} options={CLASSIFICATION_OPTIONS.map((o) => ({ value: o, label: o }))} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

function onboardMethod(asset: DefenderAsset): string {
  if (asset.category === "Workstation") return "Intune (recommended) / Manual MSI / Group Policy script";
  if (asset.type === "Network device") return "Network discovery via authenticated SNMPv3";
  if (asset.type === "IoT device") return "Defender for IoT sensor on local subnet";
  return "Universal onboarding package";
}

function assetRecommendation(asset: DefenderAsset): string {
  if (asset.type === "IoT device") return "Network-segmented IoT — no MDE agent needed. Apply NSG-equivalent firewall rule to restrict outbound.";
  if (asset.type === "Network device") return "Use Defender for IoT or Network Sensor for traffic visibility. Push SNMPv3 read-only creds.";
  if (asset.category === "Workstation") return "Onboard now — push MDE via Intune (corporate), or manual install (BYOD). Critical for EDR coverage.";
  return "Storage — restrict SMB access via NPS/RADIUS, audit access via diagnostic logs.";
}
