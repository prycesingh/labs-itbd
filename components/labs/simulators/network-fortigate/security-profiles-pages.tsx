"use client";

// Security Profiles nav-group pages for the FortiGate WebUI simulator. Ported
// from itbd-lab/simulators/network/js/fortigate-ui.js:
//   - PAGES['av']         (1223-1237) + avModal          (1239-1294) -> AvProfilesPage
//   - PAGES['webfilter']  (1299-1311) + webFilterModal    (1313-1381) -> WebFilterProfilesPage
//   - PAGES['ips']        (1387-1393)                                -> IpsProfilesPage
//   - PAGES['appctrl']    (1395-1401)                                -> AppControlProfilesPage
//   - PAGES['ssl-insp']   (1403-1409)                                -> SslProfilesPage
//   - PAGES['dns-filter'] (1411-1417)                                -> DnsFilterProfilesPage
//   - PAGES['file-filter'](1419-1425) + PAGES['dlp'] (1427-1433) +
//     PAGES['waf']        (1435-1441)                                -> OtherProfilesPage (tabbed)
//
// Source renders AV and Web Filter as full CRUD-lite forms (create/edit via
// a centered modal, chip toggles for AV protocols, a full FortiGuard
// category tree for Web Filter overrides) while the remaining seven profile
// types (IPS/App Control/SSL Inspection/DNS Filter/File Filter/DLP/WAF) are
// rendered as read-only-style lists with no edit affordance at all
// (fortigate-ui.js:1384-1441 comment: "read-only-style lists with hint of
// fields"). The reducer (reducer.ts) intentionally gives ALL nine profile
// types a real UPDATE_* action — treating AV/Web-Filter's richer source
// affordance as the bar every profile type should meet in this port, while
// staying within the reducer's fixed set: every profile type here is
// editable via a Flyout form, but none is creatable or deletable (no ADD/
// DELETE action exists for any of the nine, per reducer.ts's own comment
// that only the three most commonly edited types even needed full actions
// — this port simply extends "editable" uniformly across all nine without
// inventing add/remove).
//
// All confirmations use `sonner` toasts; no native prompt()/alert()/confirm()
// anywhere, matching the Cisco/Meraki-suite convention already established
// in this codebase (see network-cisco/security-pages.tsx).

import { useState } from "react";
import { toast } from "sonner";

import type { FortiAction } from "@/lib/labs/simulators/network-fortigate/reducer";
import { WEB_CATEGORIES } from "@/lib/labs/simulators/network-fortigate/seedData";
import type {
  FortiAppControlProfile,
  FortiAvProfile,
  FortiDlpProfile,
  FortiDnsFilterProfile,
  FortiFileFilterProfile,
  FortiGateState,
  FortiIpsProfile,
  FortiSslProfile,
  FortiWafProfile,
  FortiWebFilterProfile,
} from "@/lib/labs/simulators/network-fortigate/types";
import { DataTable, type DataTableColumn, Field, Flyout, NativeSelect, TabBar, Toggle } from "./fortigate-ui";
import styles from "./fortigate-console.module.css";

type FortiPageProps = { state: FortiGateState; dispatch: React.Dispatch<FortiAction> };

// ===================================================================
// 1. AntiVirus Profiles — source PAGES['av'] (list) + avModal (edit form).
// ===================================================================

const AV_PROTOCOL_OPTIONS = ["HTTP", "HTTPS", "SMTP", "POP3", "IMAP", "FTP", "CIFS", "SSH", "MAPI"];
const AV_INSPECTION_MODE_OPTIONS: { value: FortiAvProfile["inspectionMode"]; label: string }[] = [
  { value: "flow-based", label: "Flow-based" },
  { value: "proxy-based", label: "Proxy-based" },
];

function toggleListValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function AvEditFlyout({ profile, onClose, dispatch }: { profile: FortiAvProfile; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiAvProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_AV_PROFILE", name: profile.name, patch: draft });
    toast.success(`AntiVirus profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit AntiVirus Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Inspection Mode">
          <NativeSelect
            value={draft.inspectionMode}
            onChange={(v) => setDraft((prev) => ({ ...prev, inspectionMode: v as FortiAvProfile["inspectionMode"] }))}
            options={AV_INSPECTION_MODE_OPTIONS}
          />
        </Field>
        <Field label="Protocols to inspect">
          <div className={styles.chipGroup}>
            {AV_PROTOCOL_OPTIONS.map((proto) => {
              const on = draft.protocols.includes(proto);
              return (
                <button
                  key={proto}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, protocols: toggleListValue(prev.protocols, proto) }))}
                >
                  {proto}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>

      <div className={styles.fieldset}>
        <div className={styles.form}>
          <Field label="Treat Windows executables as viruses">
            <Toggle checked={draft.treatWinExeAsVirus} onChange={(v) => setDraft((prev) => ({ ...prev, treatWinExeAsVirus: v }))} />
          </Field>
          <Field label="Scan archive contents">
            <Toggle checked={draft.scanArchives} onChange={(v) => setDraft((prev) => ({ ...prev, scanArchives: v }))} />
          </Field>
          <Field label="Send files to FortiSandbox">
            <Toggle checked={draft.sandbox} onChange={(v) => setDraft((prev) => ({ ...prev, sandbox: v }))} />
          </Field>
          <Field label="Quarantine infected files">
            <Toggle checked={draft.quarantine} onChange={(v) => setDraft((prev) => ({ ...prev, quarantine: v }))} />
          </Field>
        </div>
      </div>
    </Flyout>
  );
}

export function AvProfilesPage({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState<FortiAvProfile | null>(null);

  const columns: DataTableColumn<FortiAvProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "mode", header: "Inspection", render: (p) => p.inspectionMode },
    { key: "protocols", header: "Protocols", render: (p) => p.protocols.join(", ") },
    { key: "sandbox", header: "FortiSandbox", render: (p) => (p.sandbox ? "Yes" : "No") },
    { key: "quarantine", header: "Quarantine", render: (p) => (p.quarantine ? "Yes" : "No") },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>AntiVirus Profiles</h2>
      <DataTable columns={columns} rows={state.avProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No AntiVirus profiles configured." />
      {editing ? <AvEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 2. Web Filter Profiles — source PAGES['webfilter'] (list) + webFilterModal
//    (category-tree edit form). WEB_CATEGORIES drives the override editor.
// ===================================================================

const WEB_FILTER_MODE_OPTIONS: { value: FortiWebFilterProfile["mode"]; label: string }[] = [
  { value: "flow-based", label: "Flow-based" },
  { value: "proxy-based", label: "Proxy-based" },
];

const CATEGORY_ACTION_OPTIONS = [
  { value: "monitor", label: "Monitor" },
  { value: "allow", label: "Allow" },
  { value: "block", label: "Block" },
];

function WebFilterEditFlyout({
  profile,
  onClose,
  dispatch,
}: {
  profile: FortiWebFilterProfile;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiWebFilterProfile>(() => ({
    ...profile,
    overrides: { ...profile.overrides },
    blockedSites: profile.blockedSites ? [...profile.blockedSites] : undefined,
  }));
  const [blockedSitesText, setBlockedSitesText] = useState<string>((profile.blockedSites ?? []).join("\n"));

  function setCategoryAction(category: string, action: string) {
    setDraft((prev) => {
      const overrides = { ...prev.overrides };
      if (action === "monitor") {
        delete overrides[category];
      } else {
        overrides[category] = action;
      }
      return { ...prev, overrides };
    });
  }

  function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const blockedSites = blockedSitesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    dispatch({
      type: "UPDATE_WEB_FILTER_PROFILE",
      name: profile.name,
      patch: { mode: draft.mode, overrides: draft.overrides, blockedSites: blockedSites.length ? blockedSites : undefined, comment: draft.comment },
    });
    toast.success(`Web filter profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Web Filter — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Inspection Mode">
          <NativeSelect
            value={draft.mode}
            onChange={(v) => setDraft((prev) => ({ ...prev, mode: v as FortiWebFilterProfile["mode"] }))}
            options={WEB_FILTER_MODE_OPTIONS}
          />
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>

      <h4>FortiGuard Category-Based Filter</h4>
      <div className={styles.catTree}>
        {WEB_CATEGORIES.map((group) => (
          <div key={group.group} className={styles.catGroup}>
            <div className={styles.catGroupHead}>
              <span>{group.group}</span>
              <span className={styles.small}>{group.items.length} categories</span>
            </div>
            {group.items.map((item) => {
              const current = draft.overrides[item] ?? "monitor";
              return (
                <div key={item} className={styles.catItem}>
                  <span>{item}</span>
                  <div className={styles.catActions}>
                    <NativeSelect value={current} onChange={(v) => setCategoryAction(item, v)} options={CATEGORY_ACTION_OPTIONS} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.fieldset}>
        <div className={styles.form}>
          <Field label="Blocked sites" help="One hostname per line">
            <textarea className={styles.textarea} value={blockedSitesText} onChange={(e) => setBlockedSitesText(e.target.value)} />
          </Field>
        </div>
      </div>
    </Flyout>
  );
}

export function WebFilterProfilesPage({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState<FortiWebFilterProfile | null>(null);

  const columns: DataTableColumn<FortiWebFilterProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "mode", header: "Inspection", render: (p) => p.mode },
    { key: "overrides", header: "Category Overrides", render: (p) => Object.keys(p.overrides).length },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>Web Filter Profiles</h2>
      <DataTable columns={columns} rows={state.webFilterProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No Web Filter profiles configured." />
      {editing ? <WebFilterEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 3. Intrusion Prevention Profiles — source PAGES['ips'] (read-only list in
//    source; this port gives it a real edit Flyout per the reducer's
//    UPDATE_IPS_PROFILE action).
// ===================================================================

const IPS_ACTION_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "monitor", label: "Monitor" },
  { value: "reset", label: "Reset" },
];
const IPS_LOGGING_OPTIONS = [
  { value: "all", label: "All" },
  { value: "attacks", label: "Attacks only" },
  { value: "disable", label: "Disable" },
];
const IPS_SENSOR_OPTIONS = ["Critical", "High", "Medium", "Low", "Information"];

function IpsEditFlyout({ profile, onClose, dispatch }: { profile: FortiIpsProfile; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiIpsProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_IPS_PROFILE", name: profile.name, patch: draft });
    toast.success(`IPS profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit IPS Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Severity Filter (sensors)">
          <div className={styles.chipGroup}>
            {IPS_SENSOR_OPTIONS.map((sensor) => {
              const on = draft.sensors.includes(sensor);
              return (
                <button
                  key={sensor}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, sensors: toggleListValue(prev.sensors, sensor) }))}
                >
                  {sensor}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Default Action">
          <NativeSelect value={draft.action} onChange={(v) => setDraft((prev) => ({ ...prev, action: v }))} options={IPS_ACTION_OPTIONS} />
        </Field>
        <Field label="Logging">
          <NativeSelect value={draft.logging} onChange={(v) => setDraft((prev) => ({ ...prev, logging: v }))} options={IPS_LOGGING_OPTIONS} />
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

export function IpsProfilesPage({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState<FortiIpsProfile | null>(null);

  const columns: DataTableColumn<FortiIpsProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "sensors", header: "Severity Filter", render: (p) => p.sensors.join(", ") },
    { key: "action", header: "Default Action", render: (p) => p.action },
    { key: "logging", header: "Logging", render: (p) => p.logging },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>Intrusion Prevention Profiles</h2>
      <DataTable columns={columns} rows={state.ipsProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No IPS profiles configured." />
      {editing ? <IpsEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 4. Application Control Profiles — source PAGES['appctrl'] (read-only list;
//    this port adds a real edit Flyout per UPDATE_APP_CONTROL_PROFILE).
// ===================================================================

const APP_CONTROL_BLOCK_OPTIONS = ["Botnet", "Proxy", "Netflix", "YouTube", "Spotify", "Twitch", "TikTok", "Facebook", "BitTorrent"];
const SCHEDULE_OPTIONS = [
  { value: "", label: "(none — always)" },
  { value: "always", label: "always" },
  { value: "work-hours", label: "work-hours" },
  { value: "after-hours", label: "after-hours" },
  { value: "maintenance-window", label: "maintenance-window" },
];

function AppControlEditFlyout({
  profile,
  onClose,
  dispatch,
}: {
  profile: FortiAppControlProfile;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiAppControlProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_APP_CONTROL_PROFILE", name: profile.name, patch: { ...draft, schedule: draft.schedule || undefined } });
    toast.success(`Application Control profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Application Control Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Blocked Applications">
          <div className={styles.chipGroup}>
            {APP_CONTROL_BLOCK_OPTIONS.map((app) => {
              const on = draft.blocks.includes(app);
              return (
                <button
                  key={app}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, blocks: toggleListValue(prev.blocks, app) }))}
                >
                  {app}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Schedule">
          <NativeSelect value={draft.schedule ?? ""} onChange={(v) => setDraft((prev) => ({ ...prev, schedule: v || undefined }))} options={SCHEDULE_OPTIONS} />
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

export function AppControlProfilesPage({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState<FortiAppControlProfile | null>(null);

  const columns: DataTableColumn<FortiAppControlProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "blocks", header: "Blocked Applications", render: (p) => p.blocks.join(", ") },
    { key: "schedule", header: "Schedule", render: (p) => p.schedule ?? "always" },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>Application Control Profiles</h2>
      <DataTable
        columns={columns}
        rows={state.appControlProfiles}
        getRowKey={(p) => p.name}
        onRowClick={setEditing}
        emptyMessage="No Application Control profiles configured."
      />
      {editing ? <AppControlEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 5. SSL/SSH Inspection Profiles — source PAGES['ssl-insp'] (read-only list;
//    this port adds a real edit Flyout per UPDATE_SSL_PROFILE).
// ===================================================================

const SSL_MODE_OPTIONS = [
  { value: "certificate-inspection", label: "Certificate Inspection" },
  { value: "full-ssl-inspection", label: "Full SSL Inspection" },
  { value: "no-inspection", label: "No Inspection" },
];

function SslEditFlyout({ profile, onClose, dispatch }: { profile: FortiSslProfile; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiSslProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_SSL_PROFILE", name: profile.name, patch: draft });
    toast.success(`SSL Inspection profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit SSL/SSH Inspection Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Mode">
          <NativeSelect value={draft.mode} onChange={(v) => setDraft((prev) => ({ ...prev, mode: v }))} options={SSL_MODE_OPTIONS} />
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

export function SslProfilesPage({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState<FortiSslProfile | null>(null);

  const columns: DataTableColumn<FortiSslProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "mode", header: "Mode", render: (p) => p.mode },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>SSL/SSH Inspection Profiles</h2>
      <DataTable columns={columns} rows={state.sslProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No SSL Inspection profiles configured." />
      {editing ? <SslEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 6. DNS Filter Profiles — source PAGES['dns-filter'] (read-only list; this
//    port adds a real edit Flyout per UPDATE_DNS_FILTER_PROFILE).
// ===================================================================

const DNS_BLOCKED_CATEGORY_OPTIONS = ["Adult", "Gambling", "Drug Abuse", "Malicious", "Phishing", "Proxy Avoidance", "Social Networking"];

function DnsFilterEditFlyout({
  profile,
  onClose,
  dispatch,
}: {
  profile: FortiDnsFilterProfile;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiDnsFilterProfile>(() => ({ ...profile, blockedCats: profile.blockedCats ? [...profile.blockedCats] : undefined }));

  function handleSave() {
    dispatch({ type: "UPDATE_DNS_FILTER_PROFILE", name: profile.name, patch: draft });
    toast.success(`DNS Filter profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit DNS Filter Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="FortiGuard DNS Filter">
          <Toggle checked={draft.fortiguard} onChange={(v) => setDraft((prev) => ({ ...prev, fortiguard: v }))} />
        </Field>
        <Field label="External IP" help="e.g. 208.91.112.220">
          <input className={styles.input} value={draft.externalIp} onChange={(e) => setDraft((prev) => ({ ...prev, externalIp: e.target.value }))} />
        </Field>
        <Field label="Enforce Safe Search">
          <Toggle checked={draft.safeSearch} onChange={(v) => setDraft((prev) => ({ ...prev, safeSearch: v }))} />
        </Field>
        <Field label="Blocked Categories">
          <div className={styles.chipGroup}>
            {DNS_BLOCKED_CATEGORY_OPTIONS.map((cat) => {
              const on = (draft.blockedCats ?? []).includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, blockedCats: toggleListValue(prev.blockedCats ?? [], cat) }))}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

export function DnsFilterProfilesPage({ state, dispatch }: FortiPageProps) {
  const [editing, setEditing] = useState<FortiDnsFilterProfile | null>(null);

  const columns: DataTableColumn<FortiDnsFilterProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "fortiguard", header: "FortiGuard DNS", render: (p) => (p.fortiguard ? "Yes" : "No") },
    { key: "externalIp", header: "External IP", render: (p) => p.externalIp },
    { key: "safeSearch", header: "Safe Search", render: (p) => (p.safeSearch ? "On" : "Off") },
    { key: "blockedCats", header: "Blocked Categories", render: (p) => (p.blockedCats ?? []).join(", ") },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>DNS Filter Profiles</h2>
      <DataTable columns={columns} rows={state.dnsFilterProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No DNS Filter profiles configured." />
      {editing ? <DnsFilterEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 7. Other Profiles — File Filter / DLP / WAF, combined into one tabbed page
//    since each is thinner/less commonly used. Source: PAGES['file-filter']
//    (1419-1425), PAGES['dlp'] (1427-1433), PAGES['waf'] (1435-1441) — all
//    read-only lists; this port adds real edit Flyouts per
//    UPDATE_FILE_FILTER_PROFILE/UPDATE_DLP_PROFILE/UPDATE_WAF_PROFILE.
// ===================================================================

const FILE_FILTER_TYPE_OPTIONS = ["exe", "bat", "cmd", "ps1", "scr", "vbs", "js", "zip", "rar", "dll", "msi"];
const DLP_SENSOR_OPTIONS = ["Credit-Card", "SSN", "Source-Code", "PCI-DSS", "HIPAA"];
const DLP_ACTION_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "log-only", label: "Log Only" },
  { value: "quarantine", label: "Quarantine" },
];
const WAF_SIGNATURE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "high-medium", label: "High & Medium" },
  { value: "high", label: "High only" },
  { value: "disable", label: "Disable" },
];

function FileFilterEditFlyout({
  profile,
  onClose,
  dispatch,
}: {
  profile: FortiFileFilterProfile;
  onClose: () => void;
  dispatch: React.Dispatch<FortiAction>;
}) {
  const [draft, setDraft] = useState<FortiFileFilterProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_FILE_FILTER_PROFILE", name: profile.name, patch: draft });
    toast.success(`File Filter profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit File Filter Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Blocked Extensions">
          <div className={styles.chipGroup}>
            {FILE_FILTER_TYPE_OPTIONS.map((ext) => {
              const on = draft.blockTypes.includes(ext);
              return (
                <button
                  key={ext}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, blockTypes: toggleListValue(prev.blockTypes, ext) }))}
                >
                  {ext}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

function DlpEditFlyout({ profile, onClose, dispatch }: { profile: FortiDlpProfile; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiDlpProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_DLP_PROFILE", name: profile.name, patch: draft });
    toast.success(`DLP profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit DLP Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Sensors">
          <div className={styles.chipGroup}>
            {DLP_SENSOR_OPTIONS.map((sensor) => {
              const on = draft.sensors.includes(sensor);
              return (
                <button
                  key={sensor}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, sensors: toggleListValue(prev.sensors, sensor) }))}
                >
                  {sensor}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Action">
          <NativeSelect value={draft.action} onChange={(v) => setDraft((prev) => ({ ...prev, action: v }))} options={DLP_ACTION_OPTIONS} />
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

function WafEditFlyout({ profile, onClose, dispatch }: { profile: FortiWafProfile; onClose: () => void; dispatch: React.Dispatch<FortiAction> }) {
  const [draft, setDraft] = useState<FortiWafProfile>(profile);

  function handleSave() {
    dispatch({ type: "UPDATE_WAF_PROFILE", name: profile.name, patch: draft });
    toast.success(`WAF profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit WAF Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Apply
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Signatures">
          <NativeSelect value={draft.signatures} onChange={(v) => setDraft((prev) => ({ ...prev, signatures: v }))} options={WAF_SIGNATURE_OPTIONS} />
        </Field>
        <Field label="Extended Signatures">
          <Toggle checked={draft.extended} onChange={(v) => setDraft((prev) => ({ ...prev, extended: v }))} />
        </Field>
        <Field label="Comments">
          <input className={styles.input} value={draft.comment} onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

type OtherProfilesTab = "file-filter" | "dlp" | "waf";

const OTHER_PROFILES_TABS: { key: OtherProfilesTab; label: string }[] = [
  { key: "file-filter", label: "File Filter" },
  { key: "dlp", label: "DLP" },
  { key: "waf", label: "WAF" },
];

export function OtherProfilesPage({ state, dispatch }: FortiPageProps) {
  const [tab, setTab] = useState<OtherProfilesTab>("file-filter");
  const [editingFileFilter, setEditingFileFilter] = useState<FortiFileFilterProfile | null>(null);
  const [editingDlp, setEditingDlp] = useState<FortiDlpProfile | null>(null);
  const [editingWaf, setEditingWaf] = useState<FortiWafProfile | null>(null);

  const fileFilterColumns: DataTableColumn<FortiFileFilterProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "blockTypes", header: "Blocked Extensions", render: (p) => p.blockTypes.join(", ") },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  const dlpColumns: DataTableColumn<FortiDlpProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "sensors", header: "Sensors", render: (p) => p.sensors.join(", ") },
    { key: "action", header: "Action", render: (p) => p.action },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  const wafColumns: DataTableColumn<FortiWafProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "signatures", header: "Signatures", render: (p) => p.signatures },
    { key: "extended", header: "Extended Signatures", render: (p) => (p.extended ? "Yes" : "No") },
    { key: "comment", header: "Comments", render: (p) => p.comment },
  ];

  return (
    <div>
      <h2>File Filter, DLP &amp; WAF Profiles</h2>
      <TabBar tabs={OTHER_PROFILES_TABS} active={tab} onChange={(key) => setTab(key as OtherProfilesTab)} />

      {tab === "file-filter" ? (
        <>
          <h3>File Filter Profiles</h3>
          <DataTable
            columns={fileFilterColumns}
            rows={state.fileFilterProfiles}
            getRowKey={(p) => p.name}
            onRowClick={setEditingFileFilter}
            emptyMessage="No File Filter profiles configured."
          />
          {editingFileFilter ? (
            <FileFilterEditFlyout profile={editingFileFilter} onClose={() => setEditingFileFilter(null)} dispatch={dispatch} />
          ) : null}
        </>
      ) : null}

      {tab === "dlp" ? (
        <>
          <h3>Data Loss Prevention Profiles</h3>
          <DataTable columns={dlpColumns} rows={state.dlpProfiles} getRowKey={(p) => p.name} onRowClick={setEditingDlp} emptyMessage="No DLP profiles configured." />
          {editingDlp ? <DlpEditFlyout profile={editingDlp} onClose={() => setEditingDlp(null)} dispatch={dispatch} /> : null}
        </>
      ) : null}

      {tab === "waf" ? (
        <>
          <h3>Web Application Firewall Profiles</h3>
          <DataTable columns={wafColumns} rows={state.wafProfiles} getRowKey={(p) => p.name} onRowClick={setEditingWaf} emptyMessage="No WAF profiles configured." />
          {editingWaf ? <WafEditFlyout profile={editingWaf} onClose={() => setEditingWaf(null)} dispatch={dispatch} /> : null}
        </>
      ) : null}
    </div>
  );
}
