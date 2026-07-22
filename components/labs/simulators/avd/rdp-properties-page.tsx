"use client";

import { useMemo, useState } from "react";

import type { AvdState } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import { Callout, SubTabBar } from "./avd-ui";

// ─── RDP PROPERTY GROUPS (host-pool advanced "RDP properties" tab) ──
// Ported verbatim from itbd-lab/simulators/avd/js/avd-rdp-properties.js (RDP_GROUPS).
type RdpPropType = "i" | "s";
type RdpPropDef = { key: string; type: RdpPropType; def: string; tip: string };
type RdpGroup = { id: string; label: string; props: RdpPropDef[] };

const RDP_GROUPS: RdpGroup[] = [
  {
    id: "connection",
    label: "Connection information",
    props: [
      { key: "targetisaadjoined", type: "i", def: "0", tip: "Set to 1 for Entra-joined session hosts." },
      { key: "enablerdsaadauth", type: "i", def: "0", tip: "Use Microsoft Entra ID for SSO sign-in (Win11 22H2+)." },
      { key: "targetcredentialsource", type: "i", def: "4", tip: "0=No creds prompt | 4=Smart card | 5=Web Account." },
      { key: "gatewayhostname", type: "s", def: "", tip: "Leave empty unless using a custom gateway." },
      { key: "use redirection server name", type: "i", def: "1", tip: "Stick to broker-issued FQDN for connection." },
      { key: "alternate shell", type: "s", def: "", tip: "Optional kiosk shell, e.g. ms-rd:subscribe." },
    ],
  },
  {
    id: "session-behavior",
    label: "Session behavior",
    props: [
      { key: "autoreconnection enabled", type: "i", def: "1", tip: "Reconnects automatically after a brief network drop." },
      { key: "bandwidthautodetect", type: "i", def: "1", tip: "RDP probes bandwidth and adjusts codec." },
      { key: "networkautodetect", type: "i", def: "1", tip: "Probe latency, used by adaptive graphics." },
      { key: "compression", type: "i", def: "1", tip: "Bulk compression — keep on unless RDP Shortpath in use." },
      { key: "videoplaybackmode", type: "i", def: "1", tip: "1 enables AVC444 hardware video stream." },
    ],
  },
  {
    id: "device-redirection",
    label: "Device redirection",
    props: [
      { key: "audiocapturemode", type: "i", def: "0", tip: "0=Disabled, 1=Capture mic from local PC." },
      { key: "audiomode", type: "i", def: "0", tip: "0=Play on local | 1=Play on remote | 2=Don't play." },
      { key: "camerastoredirect", type: "s", def: "*", tip: "Wildcard redirects all cameras. Use {GUID} list for specific devices." },
      { key: "devicestoredirect", type: "s", def: "*", tip: "PnP device passthrough (smart cards, USB sticks)." },
      { key: "drivestoredirect", type: "s", def: "*", tip: 'Mount local drives. "" disables. Risk: data exfil.' },
      { key: "redirectprinters", type: "i", def: "1", tip: "EasyPrint and locally installed printers." },
      { key: "redirectclipboard", type: "i", def: "1", tip: "Bi-directional clipboard. Often disabled in regulated workloads." },
      { key: "redirectsmartcards", type: "i", def: "1", tip: "Smart-card auth + signing inside session." },
      { key: "redirectwebauthn", type: "i", def: "1", tip: "FIDO2 keys forwarded for Entra sign-in inside session." },
      { key: "usbdevicestoredirect", type: "s", def: "", tip: "High-perf USB redirection. Specify VID:PID:CLS or *." },
    ],
  },
  {
    id: "display",
    label: "Display settings",
    props: [
      { key: "use multimon", type: "i", def: "1", tip: "Span across all local monitors." },
      { key: "selectedmonitors", type: "s", def: "0,1", tip: "Comma list of monitor indexes. Use Get-MstscMonitor." },
      { key: "maximizetocurrentdisplays", type: "i", def: "1", tip: "Dynamic resolution as monitors are added or removed." },
      { key: "singlemoninwindowedmode", type: "i", def: "0", tip: "Show single mon when windowed (RemoteApp use)." },
      { key: "dynamic resolution", type: "i", def: "1", tip: "Resolution follows local DPI scaling." },
      { key: "desktopscalefactor", type: "i", def: "0", tip: "0 = inherit local DPI. Otherwise 100 / 125 / 150 / 175 / 200." },
      { key: "screen mode id", type: "i", def: "2", tip: "1=Windowed | 2=Fullscreen." },
      { key: "smart sizing", type: "i", def: "1", tip: "Scale RDP window to fit local size." },
    ],
  },
];

// ─── SHORTPATH transports ──────────────────────────────────────────
const SHORTPATH: Record<"managed" | "public", { name: string; desc: string; ports: string; firewall: string; cmd: string }> = {
  managed: {
    name: "Managed networks (UDP 3390)",
    desc: "Direct UDP from client to session host. Lowest latency but requires line-of-sight to host VM.",
    ports: "Inbound UDP 3390 on session-host NSG",
    firewall: "Open outbound UDP 3390 from client to session host private IP.",
    cmd: 'Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Terminal Services" -Name fUseUdpPortRedirector -Value 1',
  },
  public: {
    name: "Public networks (STUN/TURN)",
    desc: "UDP hole-punching via STUN. Falls back to relay (TURN) when symmetric NAT is detected. Default for AVD agent 2023+.",
    ports: "Outbound UDP 3478 + ephemeral UDP > 1024 on client and host",
    firewall: "Allow client-side UDP 3478 (STUN). Allow relay UDP 50000-50019 in restrictive networks.",
    cmd: 'Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Terminal Server Client" -Name fClientDisableUDP -Value 0',
  },
};

// ─── BANDWIDTH PROFILES (codec + redirection per scenario) ─────────
const BANDWIDTH: { profile: string; vcpu: string; ram: string; bw: string; codec: string; notes: string }[] = [
  { profile: "Knowledge worker", vcpu: "4 vCPU", ram: "16 GB", bw: "0.5 - 1.5 Mbps", codec: "AVC444 hardware where GPU", notes: "Office, Teams optimized, Edge." },
  { profile: "Power user", vcpu: "8 vCPU", ram: "32 GB", bw: "1.5 - 5 Mbps", codec: "AVC444 + multimedia redirection", notes: "Visual Studio, Photoshop light." },
  { profile: "Designer / CAD", vcpu: "8 vCPU", ram: "32 GB", bw: "5 - 20 Mbps", codec: "NV-series GPU AVC444 + GPU-P partitioning", notes: "AutoCAD, Revit, Solidworks." },
  { profile: "Light task worker", vcpu: "2 vCPU", ram: "8 GB", bw: "0.2 - 0.5 Mbps", codec: "Default H.264 progressive", notes: "Call center, kiosk." },
];

const PER_MONITOR_BW: { display: string; idle: string; office: string; typing: string; video: string }[] = [
  { display: "1080p @ 60 Hz", idle: "50 Kbps", office: "0.5 Mbps", typing: "2 Mbps", video: "10 Mbps" },
  { display: "1440p @ 60 Hz", idle: "80 Kbps", office: "0.9 Mbps", typing: "3.5 Mbps", video: "15 Mbps" },
  { display: "4K @ 30 Hz", idle: "0.2 Mbps", office: "2.5 Mbps", typing: "8 Mbps", video: "30 Mbps" },
];

// ─── PRIVATE LINK (private endpoint) topology ─────────────────────
const PRIVATE_LINK: { resource: string; subResource: string; desc: string }[] = [
  { resource: "Workspace - feed", subResource: "feed", desc: "User subscribes via Remote Desktop client → reaches workspace feed over private endpoint." },
  { resource: "Workspace - global", subResource: "global", desc: "Single-region global endpoint for initial discovery. One per tenant." },
  { resource: "Host pool - connection", subResource: "connection", desc: "RDP control + data plane traffic to broker stays inside vNet." },
];

// ─── TROUBLESHOOT playbook ──────────────────────────────────────────
const TROUBLESHOOT: { sym: string; cause: string; fix: string }[] = [
  { sym: "Slow logon (>60s) at FSLogix mount", cause: "CONTAINER VHD size grew past 30 GB / Azure Files throughput tier too small", fix: "Resize VHD, move to Premium Azure Files or ANF, raise SMB multichannel." },
  { sym: "Black screen on Teams join", cause: "GPU not exposed to session host", fix: "Move to NV-series, install MSI GPU partitioning driver, set ENABLE_NV_REDIRECT in registry." },
  { sym: "RDP disconnects 4-7 minutes after idle", cause: "KeepAlive interval mismatch with corporate firewall TCP idle timeout (240 s)", fix: "Set keepalive_enabled:i:1 and reduce idle timeout in NetScaler to 360 s." },
  { sym: "Clipboard works one-way only", cause: "Client redirectclipboard=1 but host group policy disables it", fix: 'Set Computer Config > Admin Templates > Win Comps > RDS > Connections: "Do not allow clipboard redirection" = Disabled.' },
  { sym: "STUN allocation fails (Public Shortpath off)", cause: "Symmetric NAT or outbound UDP 3478 blocked", fix: "Open UDP 3478 in client firewall, verify with Test-NetConnection -ComputerName 20.202.0.0 -Port 3478." },
  { sym: "Camera redirection misses Logitech webcam", cause: "Driver not exposing standard PnP class", fix: "Use camerastoredirect:s:{27FB4D04-2E64-4396-9D45-22D9E70B0B7B}; reinstall Logitech firmware." },
];

const SUB_TABS = [
  { id: "rdp-properties", label: "RDP property bag" },
  { id: "shortpath", label: "RDP Shortpath" },
  { id: "bandwidth", label: "Bandwidth profiles" },
  { id: "private-link", label: "Private Link" },
  { id: "troubleshoot", label: "Troubleshoot" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["id"];

// key:type:value; parser/serializer for the customRdpProperty blob, matching
// the semicolon-delimited format Azure delivers in the .rdp file to clients.
function parseRdpString(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!str) return out;
  str.split(";").forEach((part) => {
    const m = part.trim().match(/^([^:]+):([is]):(.*)$/);
    if (m) out[m[1]] = m[3];
  });
  return out;
}

function serializeDraft(draft: Record<string, string>): string {
  const pieces: string[] = [];
  RDP_GROUPS.forEach((g) => {
    g.props.forEach((p) => {
      if (draft[p.key] !== undefined && draft[p.key] !== "") {
        pieces.push(`${p.key}:${p.type}:${draft[p.key]}`);
      }
    });
  });
  return pieces.join(";");
}

function draftWithDefaults(raw: string): Record<string, string> {
  const draft = parseRdpString(raw);
  RDP_GROUPS.forEach((g) => {
    g.props.forEach((p) => {
      if (draft[p.key] === undefined) draft[p.key] = p.def;
    });
  });
  return draft;
}

function powershellExample(poolName: string, resourceGroup: string, propValue: string): string {
  const value = propValue || "audiocapturemode:i:1;camerastoredirect:s:*;redirectwebauthn:i:1";
  return `Update-AzWvdHostPool -ResourceGroupName ${resourceGroup} -Name ${poolName} \\\n  -CustomRdpProperty "${value}"`;
}

export function RdpPropertiesPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [subTab, setSubTab] = useState<SubTab>("rdp-properties");

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>RDP Properties &amp; Networking</h1>
      <p className={styles.help} style={{ marginBottom: 16 }}>
        Property bag reference, Shortpath transports, bandwidth profiles, Private Link.
      </p>

      <SubTabBar tabs={SUB_TABS as unknown as { id: string; label: string }[]} active={subTab} onChange={(id) => setSubTab(id as SubTab)} />

      {subTab === "rdp-properties" ? <RdpPropertyBagTab state={state} dispatch={dispatch} /> : null}
      {subTab === "shortpath" ? <ShortpathTab /> : null}
      {subTab === "bandwidth" ? <BandwidthTab /> : null}
      {subTab === "private-link" ? <PrivateLinkTab /> : null}
      {subTab === "troubleshoot" ? <TroubleshootTab /> : null}
    </div>
  );
}

// ───────────────────────── RDP property bag (live editor) ─────────────────────────

function RdpPropertyBagTab({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const pools = state.hostPools;
  const [selectedPoolId, setSelectedPoolId] = useState<string>(pools[0]?.id ?? "");
  const pool = pools.find((p) => p.id === selectedPoolId) ?? pools[0] ?? null;

  const [draft, setDraft] = useState<Record<string, string>>(() => draftWithDefaults(pool?.customRdpProperty ?? ""));

  // Re-load the draft whenever the selected pool changes.
  const [loadedForPoolId, setLoadedForPoolId] = useState<string>(pool?.id ?? "");
  if (pool && pool.id !== loadedForPoolId) {
    setDraft(draftWithDefaults(pool.customRdpProperty ?? ""));
    setLoadedForPoolId(pool.id);
  }

  if (pools.length === 0) {
    return (
      <div style={{ marginTop: 16 }}>
        <Callout tone="warn">Create a host pool first to edit RDP properties.</Callout>
      </div>
    );
  }
  if (!pool) return null;

  const preview = serializeDraft(draft);

  function setVal(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function resetToDefaults() {
    const next: Record<string, string> = {};
    RDP_GROUPS.forEach((g) => g.props.forEach((p) => (next[p.key] = p.def)));
    setDraft(next);
  }

  function applyToPool() {
    if (!pool) return;
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { customRdpProperty: preview } });
  }

  return (
    <div className={styles.sectionCard} style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: "#605e5c", display: "flex", alignItems: "center", gap: 6 }}>
          Editing for host pool:
          <select
            className={styles.select}
            style={{ width: "auto", height: "auto", padding: "6px 8px" }}
            value={pool.id}
            onChange={(e) => setSelectedPoolId(e.target.value)}
          >
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.btnOutline} onClick={resetToDefaults}>
          Reset to defaults
        </button>
        <button type="button" className={styles.btn} onClick={applyToPool}>
          Apply to pool
        </button>
      </div>

      <p style={{ margin: "0 0 16px", color: "#605e5c", fontSize: 13 }}>
        Each property below maps directly to a key in the <code>.rdp</code> file delivered to clients. Edits stay in
        this draft until you click <b>Apply to pool</b>.
      </p>

      {RDP_GROUPS.map((g) => (
        <div key={g.id} style={{ marginBottom: 8 }}>
          <h3 style={{ margin: "24px 0 8px", fontSize: 13, fontWeight: 600, color: "#323130" }}>{g.label}</h3>
          <table className={styles.table} style={{ marginBottom: 8 }}>
            <thead>
              <tr>
                <th style={{ width: "24%" }}>Key</th>
                <th style={{ width: "10%" }}>Type</th>
                <th style={{ width: "20%" }}>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {g.props.map((p) => {
                const cur = draft[p.key] ?? p.def;
                const isDefault = String(cur) === String(p.def);
                return (
                  <tr key={p.key}>
                    <td style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>
                      {p.key}
                      {isDefault ? null : <span style={{ color: "#0078d4", fontSize: 10 }}> (modified)</span>}
                    </td>
                    <td>{p.type === "i" ? "int" : "string"}</td>
                    <td>
                      <input
                        type={p.type === "i" ? "number" : "text"}
                        value={cur}
                        onChange={(e) => setVal(p.key, e.target.value)}
                        style={{
                          width: p.type === "i" ? 90 : 200,
                          padding: "3px 6px",
                          border: "1px solid #c8c6c4",
                          borderRadius: 2,
                          fontFamily: "Consolas, monospace",
                          fontSize: 12,
                        }}
                      />{" "}
                      <span style={{ color: "#a19f9d", fontSize: 10, fontFamily: "Consolas, monospace" }}>
                        (default {p.def === "" ? '""' : p.def})
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#605e5c" }}>{p.tip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <h3 style={{ margin: "24px 0 8px", fontSize: 13 }}>Generated customRdpProperty string</h3>
      <div
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "14px 18px",
          borderRadius: 4,
          fontFamily: "Consolas, monospace",
          fontSize: 11.5,
          lineHeight: 1.6,
          wordBreak: "break-all",
          maxHeight: 120,
          overflow: "auto",
        }}
      >
        {preview || <i>(empty — using all defaults)</i>}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#605e5c" }}>
        <b>Current pool value:</b> <code style={{ fontSize: 11 }}>{pool.customRdpProperty || "(none — defaults)"}</code>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "14px 18px",
          borderRadius: 4,
          fontFamily: "Consolas, monospace",
          fontSize: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        <div style={{ color: "#9cdcfe", marginBottom: 6 }}># Equivalent PowerShell for this pool</div>
        {powershellExample(pool.name, pool.resourceGroup || "rg-avd-prod", preview)}
      </div>
    </div>
  );
}

// ───────────────────────── RDP Shortpath ─────────────────────────

function ShortpathTab() {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: "#605e5c", marginBottom: 18 }}>
        RDP Shortpath replaces the broker-relayed TCP 443 reverse-connect with a direct UDP transport. Two flavours:
      </p>

      {(["managed", "public"] as const).map((k) => {
        const s = SHORTPATH[k];
        return (
          <div key={k} className={styles.sectionCard}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>{s.name}</h3>
            <p style={{ margin: "0 0 10px", color: "#605e5c" }}>{s.desc}</p>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td style={{ width: "28%", fontWeight: 600 }}>Required ports</td>
                  <td>{s.ports}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Firewall guidance</td>
                  <td>{s.firewall}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Enable command</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{s.cmd}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      <Callout tone="warn">
        <strong>Architect tip:</strong> Public Shortpath is enabled by default on AVD agent 1.0.5388+ but the client
        must be Windows Desktop client v1.2.3317+. Verify with <code>klist -li 0x3e7</code> +{" "}
        <code>Get-NetUDPEndpoint -OwningProcess (Get-Process mstsc).Id</code>.
      </Callout>
    </div>
  );
}

// ───────────────────────── Bandwidth profiles ─────────────────────────

function BandwidthTab() {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: "#605e5c", marginBottom: 18 }}>
        Right-sized session-host SKU + RDP codec per persona. Add 30% headroom for Teams optimization media stream.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Profile</th>
            <th>vCPU</th>
            <th>RAM</th>
            <th>Bandwidth</th>
            <th>Codec</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {BANDWIDTH.map((b) => (
            <tr key={b.profile}>
              <td>
                <strong>{b.profile}</strong>
              </td>
              <td>{b.vcpu}</td>
              <td>{b.ram}</td>
              <td>{b.bw}</td>
              <td>{b.codec}</td>
              <td>{b.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: "24px 0 8px", fontSize: 13 }}>Per-monitor bandwidth budget</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Display</th>
            <th>Idle</th>
            <th>Office</th>
            <th>Typing</th>
            <th>Video</th>
          </tr>
        </thead>
        <tbody>
          {PER_MONITOR_BW.map((r) => (
            <tr key={r.display}>
              <td>{r.display}</td>
              <td>{r.idle}</td>
              <td>{r.office}</td>
              <td>{r.typing}</td>
              <td>{r.video}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────── Private Link (pointer-style; full console is a separate page) ─────────────────────────

function PrivateLinkTab() {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: "#605e5c", marginBottom: 18 }}>
        AVD Private Link removes all public DNS lookups. Three sub-resource types must be deployed in the right
        order.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Sub-resource</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {PRIVATE_LINK.map((p) => (
            <tr key={p.subResource}>
              <td>
                <strong>{p.resource}</strong>
              </td>
              <td>
                <code>{p.subResource}</code>
              </td>
              <td>{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: "24px 0 8px", fontSize: 13 }}>Required Private DNS zones</h3>
      <ul style={{ fontFamily: "Consolas, monospace", fontSize: 12, color: "#323130", lineHeight: 1.7 }}>
        <li>privatelink.wvd.microsoft.com</li>
        <li>privatelink-global.wvd.microsoft.com</li>
      </ul>

      <Callout tone="info">
        <strong>Order of operations:</strong> Create the <code>global</code> sub-resource first (tenant-wide
        singleton). Then create per-workspace <code>feed</code> endpoints. Finally per-host-pool{" "}
        <code>connection</code> endpoints. Reverse this when deleting.
      </Callout>

      <p style={{ marginTop: 12, fontSize: 12, color: "#605e5c" }}>
        For the full Private Link admin console — endpoint provisioning, DNS zone linking, and connection status —
        see the dedicated <strong>Private Link</strong> page.
      </p>
    </div>
  );
}

// ───────────────────────── Troubleshoot ─────────────────────────

function TroubleshootTab() {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: "#605e5c", marginBottom: 18 }}>Common Tier-3 escalation playbook entries.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Symptom</th>
            <th>Root cause</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          {TROUBLESHOOT.map((t) => (
            <tr key={t.sym}>
              <td>
                <strong>{t.sym}</strong>
              </td>
              <td>{t.cause}</td>
              <td>{t.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
