"use client";

// Security Profiles nav-group pages for the Palo Alto PAN-OS WebUI simulator.
// Ported from itbd-lab/simulators/network/js/paloalto-ui.js:1612-1907
// (obj-sp-av / obj-sp-as / obj-sp-vp / obj-sp-url / obj-sp-file /
// obj-sp-wildfire / obj-sp-data / obj-spg).
//
// Source structural finding: only 5 of the 8 profile types were actually
// editable in source (AV, AS, VP, URL, Profile Groups) — File Blocking,
// WildFire Analysis, and Data Filtering were read-only stubs (a table with no
// edit modal at all), and even the editable AS/VP profiles only edited a
// single flattened `rules[0]` via plain text/select inputs (no add/remove-rule
// UI, no shared generic rule-table editor existed anywhere in source). The
// reducer (reducer.ts) intentionally gives ALL EIGHT profile/group types a
// real UPDATE_* action — treating URL Filtering's richer source affordance
// (full PAN-DB category list + Profile Groups' 7 cross-linked dropdowns) as
// the bar every profile type should meet in this port, matching the
// FortiGate-suite port's identical judgment call (security-profiles-pages.tsx
// header). This port additionally upgrades AS/VP/File/WildFire/Data from
// source's single-flattened-rule editing to a real add/remove multi-row rules
// list (each type's `rules` array is genuinely a list in types.ts, and a real
// PAN-OS admin adds more than one severity/file-type rule per profile) —
// still within the reducer's fixed set: every profile type here is editable
// via a Flyout form, but none is creatable or deletable at the profile/group
// level (no ADD/DELETE action exists for any of the 8, per reducer.ts's own
// comment that these are a fixed pre-configured set).
//
// Source's URL Filtering used a 5-way radio group per category
// (allow/alert/block/continue/override) and only persisted non-"allow"
// entries; this port uses a single NativeSelect per category (same action
// vocabulary) against `profile.categories[categoryName]`, defaulting to
// "allow" for display when no override is stored, consistent with source's
// sparse-storage intent while giving a single consistent widget instead of a
// radio group.
//
// All confirmations use `sonner` toasts; no native prompt()/alert()/confirm()
// anywhere, matching the Cisco/FortiGate-suite convention already established
// in this codebase (see network-fortigate/security-profiles-pages.tsx).

import { useState } from "react";
import { toast } from "sonner";

import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import { URL_CATEGORIES } from "@/lib/labs/simulators/network-paloalto/seedData";
import type {
  PaloAsProfile,
  PaloAvProfile,
  PaloDataProfile,
  PaloDataRule,
  PaloFileProfile,
  PaloFileRule,
  PaloProfileGroup,
  PaloSeverityRule,
  PaloState,
  PaloUrlProfile,
  PaloVpProfile,
  PaloWildfireProfile,
  PaloWildfireRule,
} from "@/lib/labs/simulators/network-paloalto/types";
import { DataTable, type DataTableColumn, Field, Flyout, NativeSelect, TabBar, Toggle } from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type PaloPageProps = { state: PaloState; dispatch: React.Dispatch<PaloAction> };

// ===================================================================
// Shared option vocabularies — ported from source's `<select>` option lists
// (paloalto-ui.js:1612-1907).
// ===================================================================

const AV_DECODER_OPTIONS = ["http", "https", "smtp", "imap", "pop3", "ftp", "smb", "ssh", "imaps", "pop3s"];
const AV_ACTION_OPTIONS = [
  { value: "default", label: "default" },
  { value: "allow", label: "allow" },
  { value: "alert", label: "alert" },
  { value: "drop", label: "drop" },
  { value: "reset-client", label: "reset-client" },
  { value: "reset-server", label: "reset-server" },
  { value: "reset-both", label: "reset-both" },
];

const SEVERITY_ACTION_OPTIONS = [
  { value: "default", label: "default" },
  { value: "allow", label: "allow" },
  { value: "alert", label: "alert" },
  { value: "drop", label: "drop" },
  { value: "reset-both", label: "reset-both" },
];

const VP_PACKET_CAPTURE_OPTIONS = [
  { value: "disable", label: "disable" },
  { value: "single-packet", label: "single-packet" },
  { value: "extended-capture", label: "extended-capture" },
];

const URL_CATEGORY_ACTION_OPTIONS = [
  { value: "allow", label: "allow" },
  { value: "alert", label: "alert" },
  { value: "block", label: "block" },
  { value: "continue", label: "continue" },
  { value: "override", label: "override" },
];

const CREDENTIAL_DETECTION_OPTIONS = [
  { value: "disabled", label: "disabled" },
  { value: "log", label: "log" },
  { value: "alert", label: "alert" },
  { value: "block", label: "block" },
  { value: "continue", label: "continue" },
];

const FILE_DIRECTION_OPTIONS = [
  { value: "both", label: "both" },
  { value: "upload", label: "upload" },
  { value: "download", label: "download" },
];

const FILE_ACTION_OPTIONS = [
  { value: "alert", label: "alert" },
  { value: "block", label: "block" },
  { value: "continue", label: "continue" },
];

const WILDFIRE_ANALYSIS_OPTIONS = [
  { value: "public-cloud", label: "public-cloud" },
  { value: "private-cloud", label: "private-cloud" },
];

const DATA_PATTERN_OPTIONS = ["credit-card", "ssn", "national-id", "custom-regex"];

function toggleListValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ===================================================================
// 1. Antivirus Profiles — source `obj-sp-av` (list, 1612-1626) + `spAvModal`
//    (edit form, 1628-1666). Decoders as chip toggles (source's
//    collectChips/bindChipToggles); Action + WildFire Action share the same
//    action vocabulary; Packet Capture as a Toggle switch.
// ===================================================================

function AvEditFlyout({ profile, onClose, dispatch }: { profile: PaloAvProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloAvProfile>(() => ({ ...profile, decoders: [...profile.decoders] }));

  function handleSave() {
    dispatch({ type: "UPDATE_AV_PROFILE", name: profile.name, patch: draft });
    toast.success(`Antivirus profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Antivirus Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Decoders">
          <div className={styles.chipGroup}>
            {AV_DECODER_OPTIONS.map((decoder) => {
              const on = draft.decoders.includes(decoder);
              return (
                <button
                  key={decoder}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, decoders: toggleListValue(prev.decoders, decoder) }))}
                >
                  {decoder}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Action">
          <NativeSelect value={draft.action} onChange={(v) => setDraft((prev) => ({ ...prev, action: v }))} options={AV_ACTION_OPTIONS} />
        </Field>
        <Field label="WildFire Action">
          <NativeSelect value={draft.wildfireAction} onChange={(v) => setDraft((prev) => ({ ...prev, wildfireAction: v }))} options={AV_ACTION_OPTIONS} />
        </Field>
        <Field label="Packet Capture">
          <Toggle checked={draft.packetCapture} onChange={(v) => setDraft((prev) => ({ ...prev, packetCapture: v }))} />
        </Field>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

export function AvProfilesPage({ state, dispatch }: PaloPageProps) {
  const [editing, setEditing] = useState<PaloAvProfile | null>(null);

  const columns: DataTableColumn<PaloAvProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "decoders", header: "Decoders", render: (p) => p.decoders.join(", ") },
    { key: "action", header: "Action", render: (p) => p.action },
    { key: "wildfireAction", header: "WildFire Action", render: (p) => p.wildfireAction },
    { key: "packetCapture", header: "Packet Capture", render: (p) => (p.packetCapture ? "Yes" : "No") },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  return (
    <div>
      <h2>Antivirus Profiles</h2>
      <DataTable columns={columns} rows={state.avProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No Antivirus profiles configured." />
      {editing ? <AvEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// Shared severity-rules editor — used by Anti-Spyware and Vulnerability
// Protection. Source only edited a single flattened `rules[0]` via plain
// text/select inputs (no add/remove-rule UI existed for either type,
// paloalto-ui.js:1669-1762); this port upgrades both to a real add/remove
// multi-row list since `rules: PaloSeverityRule[]` is genuinely a list in
// types.ts and a real PAN-OS admin adds more than one severity rule.
// ===================================================================

function SeverityRulesEditor({ rules, onChange }: { rules: PaloSeverityRule[]; onChange: (rules: PaloSeverityRule[]) => void }) {
  function updateRule(index: number, patch: Partial<PaloSeverityRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }
  function addRule() {
    onChange([...rules, { severity: "medium", action: "default" }]);
  }

  return (
    <div className={styles.fieldset}>
      <div style={{ padding: "10px 12px" }}>
        {rules.length === 0 ? <div className={styles.small}>No severity rules configured.</div> : null}
        {rules.map((rule, index) => (
          <div key={index} className={styles.flexWrap} style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input
              className={styles.input}
              style={{ maxWidth: 320 }}
              value={rule.severity}
              placeholder="critical,high,medium,low,informational"
              onChange={(e) => updateRule(index, { severity: e.target.value })}
            />
            <NativeSelect value={rule.action} onChange={(v) => updateRule(index, { action: v })} options={SEVERITY_ACTION_OPTIONS} className={styles.select} />
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => removeRule(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={addRule}>
          + Add Rule
        </button>
      </div>
    </div>
  );
}

// ===================================================================
// 2. Anti-Spyware Profiles — source `obj-sp-as` (list, 1669-1682) +
//    `spAsModal` (edit form, 1684-1716). dnsSinkhole default in source is
//    "sinkhole.paloaltonetworks.com" (matches seedData.ts).
// ===================================================================

function AsEditFlyout({ profile, onClose, dispatch }: { profile: PaloAsProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloAsProfile>(() => ({ ...profile, rules: profile.rules.map((r) => ({ ...r })) }));

  function handleSave() {
    dispatch({ type: "UPDATE_AS_PROFILE", name: profile.name, patch: draft });
    toast.success(`Anti-Spyware profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Anti-Spyware Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="DNS Sinkhole" help="Sinkhole FQDN for detected DNS queries">
          <input className={styles.input} value={draft.dnsSinkhole} onChange={(e) => setDraft((prev) => ({ ...prev, dnsSinkhole: e.target.value }))} />
        </Field>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
      <h4>Severity Rules</h4>
      <SeverityRulesEditor rules={draft.rules} onChange={(rules) => setDraft((prev) => ({ ...prev, rules }))} />
    </Flyout>
  );
}

export function AsProfilesPage({ state, dispatch }: PaloPageProps) {
  const [editing, setEditing] = useState<PaloAsProfile | null>(null);

  const columns: DataTableColumn<PaloAsProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "rules", header: "Rules", render: (p) => p.rules.length },
    { key: "dnsSinkhole", header: "DNS Sinkhole", render: (p) => p.dnsSinkhole },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  return (
    <div>
      <h2>Anti-Spyware Profiles</h2>
      <DataTable columns={columns} rows={state.asProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No Anti-Spyware profiles configured." />
      {editing ? <AsEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 3. Vulnerability Protection Profiles — source `obj-sp-vp` (list,
//    1719-1732) + `spVpModal` (edit form, 1734-1762). Same severity-rules
//    pattern as Anti-Spyware; packetCapture is a real persisted field here
//    (source's AS/AV packet-capture-adjacent selects were decorative-only,
//    but VP's `disable/single-packet/extended-capture` select maps directly
//    onto types.ts's `PaloVpProfile.packetCapture: string`).
// ===================================================================

function VpEditFlyout({ profile, onClose, dispatch }: { profile: PaloVpProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloVpProfile>(() => ({ ...profile, rules: profile.rules.map((r) => ({ ...r })) }));

  function handleSave() {
    dispatch({ type: "UPDATE_VP_PROFILE", name: profile.name, patch: draft });
    toast.success(`Vulnerability Protection profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Vulnerability Protection Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Packet Capture">
          <NativeSelect value={draft.packetCapture} onChange={(v) => setDraft((prev) => ({ ...prev, packetCapture: v }))} options={VP_PACKET_CAPTURE_OPTIONS} />
        </Field>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
      <h4>Severity Rules</h4>
      <SeverityRulesEditor rules={draft.rules} onChange={(rules) => setDraft((prev) => ({ ...prev, rules }))} />
    </Flyout>
  );
}

export function VpProfilesPage({ state, dispatch }: PaloPageProps) {
  const [editing, setEditing] = useState<PaloVpProfile | null>(null);

  const columns: DataTableColumn<PaloVpProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "rules", header: "Rules", render: (p) => p.rules.length },
    { key: "packetCapture", header: "Packet Capture", render: (p) => p.packetCapture },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  return (
    <div>
      <h2>Vulnerability Protection Profiles</h2>
      <DataTable
        columns={columns}
        rows={state.vpProfiles}
        getRowKey={(p) => p.name}
        onRowClick={setEditing}
        emptyMessage="No Vulnerability Protection profiles configured."
      />
      {editing ? <VpEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 4. URL Filtering Profiles — source `obj-sp-url` (list, 1765-1778) +
//    `spUrlModal` (edit form, 1780-1824). Source rendered a 5-way radio group
//    per PAN-DB category (allow/alert/block/continue/override) and only
//    persisted non-"allow" entries (sparse storage — allow is the implicit
//    default). This port uses one NativeSelect per category against the same
//    action vocabulary, reading `profile.categories[cat] ?? "allow"` for
//    display and writing back sparsely (deleting the key entirely when reset
//    to "allow") to preserve source's sparse-storage intent.
// ===================================================================

function UrlEditFlyout({ profile, onClose, dispatch }: { profile: PaloUrlProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloUrlProfile>(() => ({ ...profile, categories: { ...profile.categories } }));

  function setCategoryAction(category: string, action: string) {
    setDraft((prev) => {
      const categories = { ...prev.categories };
      if (action === "allow") {
        delete categories[category];
      } else {
        categories[category] = action;
      }
      return { ...prev, categories };
    });
  }

  function handleSave() {
    dispatch({ type: "UPDATE_URL_PROFILE", name: profile.name, patch: draft });
    toast.success(`URL Filtering profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit URL Filtering Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Credential Detection">
          <NativeSelect
            value={draft.credentialDetection}
            onChange={(v) => setDraft((prev) => ({ ...prev, credentialDetection: v }))}
            options={CREDENTIAL_DETECTION_OPTIONS}
          />
        </Field>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>

      <h4>URL Categories (PAN-DB)</h4>
      <div className={styles.tableWrap} style={{ maxHeight: 360, overflowY: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Site Access</th>
            </tr>
          </thead>
          <tbody>
            {URL_CATEGORIES.map((cat) => (
              <tr key={cat}>
                <td>{cat}</td>
                <td>
                  <NativeSelect value={draft.categories[cat] ?? "allow"} onChange={(v) => setCategoryAction(cat, v)} options={URL_CATEGORY_ACTION_OPTIONS} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Flyout>
  );
}

export function UrlProfilesPage({ state, dispatch }: PaloPageProps) {
  const [editing, setEditing] = useState<PaloUrlProfile | null>(null);

  const columns: DataTableColumn<PaloUrlProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "categories", header: "Category Overrides", render: (p) => Object.keys(p.categories).length },
    { key: "credentialDetection", header: "Credential Detection", render: (p) => p.credentialDetection },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  return (
    <div>
      <h2>URL Filtering Profiles</h2>
      <DataTable columns={columns} rows={state.urlProfiles} getRowKey={(p) => p.name} onRowClick={setEditing} emptyMessage="No URL Filtering profiles configured." />
      {editing ? <UrlEditFlyout profile={editing} onClose={() => setEditing(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 5 & 6. File Blocking + WildFire Analysis Profiles — source `obj-sp-file`
//    (1827-1833) and `obj-sp-wildfire` (1834-1840) were BOTH read-only stubs
//    in source (a table with no edit modal, no CRUD wiring at all). This port
//    gives both a real edit Flyout per the reducer's UPDATE_FILE_PROFILE /
//    UPDATE_WILDFIRE_PROFILE actions, upgraded from source's single-flattened
//    `rules[0]` display to a real add/remove multi-row rules list (matching
//    the Severity Rules upgrade above), combined into one tabbed page since
//    both are the same shape of rules-list profile and both share the shell's
//    "file-wildfire-profiles" page slot.
// ===================================================================

function FileRulesEditor({ rules, onChange }: { rules: PaloFileRule[]; onChange: (rules: PaloFileRule[]) => void }) {
  function updateRule(index: number, patch: Partial<PaloFileRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }
  function addRule() {
    onChange([...rules, { apps: "any", filetypes: "any", direction: "both", action: "alert" }]);
  }

  return (
    <div className={styles.fieldset}>
      <div style={{ padding: "10px 12px" }}>
        {rules.length === 0 ? <div className={styles.small}>No rules configured.</div> : null}
        {rules.map((rule, index) => (
          <div key={index} className={styles.flexWrap} style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input className={styles.input} style={{ maxWidth: 140 }} value={rule.apps} placeholder="apps" onChange={(e) => updateRule(index, { apps: e.target.value })} />
            <input
              className={styles.input}
              style={{ maxWidth: 220 }}
              value={rule.filetypes}
              placeholder="filetypes"
              onChange={(e) => updateRule(index, { filetypes: e.target.value })}
            />
            <NativeSelect value={rule.direction} onChange={(v) => updateRule(index, { direction: v })} options={FILE_DIRECTION_OPTIONS} className={styles.select} />
            <NativeSelect value={rule.action} onChange={(v) => updateRule(index, { action: v })} options={FILE_ACTION_OPTIONS} className={styles.select} />
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => removeRule(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={addRule}>
          + Add Rule
        </button>
      </div>
    </div>
  );
}

function WildfireRulesEditor({ rules, onChange }: { rules: PaloWildfireRule[]; onChange: (rules: PaloWildfireRule[]) => void }) {
  function updateRule(index: number, patch: Partial<PaloWildfireRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }
  function addRule() {
    onChange([...rules, { apps: "any", filetypes: "any", direction: "both", analysis: "public-cloud" }]);
  }

  return (
    <div className={styles.fieldset}>
      <div style={{ padding: "10px 12px" }}>
        {rules.length === 0 ? <div className={styles.small}>No rules configured.</div> : null}
        {rules.map((rule, index) => (
          <div key={index} className={styles.flexWrap} style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input className={styles.input} style={{ maxWidth: 140 }} value={rule.apps} placeholder="apps" onChange={(e) => updateRule(index, { apps: e.target.value })} />
            <input
              className={styles.input}
              style={{ maxWidth: 220 }}
              value={rule.filetypes}
              placeholder="filetypes"
              onChange={(e) => updateRule(index, { filetypes: e.target.value })}
            />
            <NativeSelect value={rule.direction} onChange={(v) => updateRule(index, { direction: v })} options={FILE_DIRECTION_OPTIONS} className={styles.select} />
            <NativeSelect value={rule.analysis} onChange={(v) => updateRule(index, { analysis: v })} options={WILDFIRE_ANALYSIS_OPTIONS} className={styles.select} />
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => removeRule(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={addRule}>
          + Add Rule
        </button>
      </div>
    </div>
  );
}

function FileEditFlyout({ profile, onClose, dispatch }: { profile: PaloFileProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloFileProfile>(() => ({ ...profile, rules: profile.rules.map((r) => ({ ...r })) }));

  function handleSave() {
    dispatch({ type: "UPDATE_FILE_PROFILE", name: profile.name, patch: draft });
    toast.success(`File Blocking profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit File Blocking Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
      <h4>Rules</h4>
      <FileRulesEditor rules={draft.rules} onChange={(rules) => setDraft((prev) => ({ ...prev, rules }))} />
    </Flyout>
  );
}

function WildfireEditFlyout({ profile, onClose, dispatch }: { profile: PaloWildfireProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloWildfireProfile>(() => ({ ...profile, rules: profile.rules.map((r) => ({ ...r })) }));

  function handleSave() {
    dispatch({ type: "UPDATE_WILDFIRE_PROFILE", name: profile.name, patch: draft });
    toast.success(`WildFire Analysis profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit WildFire Analysis Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
      <h4>Rules</h4>
      <WildfireRulesEditor rules={draft.rules} onChange={(rules) => setDraft((prev) => ({ ...prev, rules }))} />
    </Flyout>
  );
}

type FileWildfireTab = "file" | "wildfire";
const FILE_WILDFIRE_TABS: { key: FileWildfireTab; label: string }[] = [
  { key: "file", label: "File Blocking" },
  { key: "wildfire", label: "WildFire Analysis" },
];

export function FileWildfireProfilesPage({ state, dispatch }: PaloPageProps) {
  const [tab, setTab] = useState<FileWildfireTab>("file");
  const [editingFile, setEditingFile] = useState<PaloFileProfile | null>(null);
  const [editingWildfire, setEditingWildfire] = useState<PaloWildfireProfile | null>(null);

  const fileColumns: DataTableColumn<PaloFileProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "rules", header: "Rules", render: (p) => p.rules.length },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  const wildfireColumns: DataTableColumn<PaloWildfireProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "rules", header: "Rules", render: (p) => p.rules.length },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  return (
    <div>
      <h2>File Blocking &amp; WildFire Analysis Profiles</h2>
      <TabBar tabs={FILE_WILDFIRE_TABS} active={tab} onChange={(key) => setTab(key as FileWildfireTab)} />

      {tab === "file" ? (
        <>
          <h3>File Blocking Profiles</h3>
          <DataTable columns={fileColumns} rows={state.fileProfiles} getRowKey={(p) => p.name} onRowClick={setEditingFile} emptyMessage="No File Blocking profiles configured." />
          {editingFile ? <FileEditFlyout profile={editingFile} onClose={() => setEditingFile(null)} dispatch={dispatch} /> : null}
        </>
      ) : null}

      {tab === "wildfire" ? (
        <>
          <h3>WildFire Analysis Profiles</h3>
          <DataTable
            columns={wildfireColumns}
            rows={state.wildfireProfiles}
            getRowKey={(p) => p.name}
            onRowClick={setEditingWildfire}
            emptyMessage="No WildFire Analysis profiles configured."
          />
          {editingWildfire ? <WildfireEditFlyout profile={editingWildfire} onClose={() => setEditingWildfire(null)} dispatch={dispatch} /> : null}
        </>
      ) : null}
    </div>
  );
}

// ===================================================================
// 7 & 8. Data Filtering Profiles + Security Profile Groups — source
//    `obj-sp-data` (1841-1847) was also a read-only stub (same as File
//    Blocking/WildFire above); this port gives it a real edit Flyout per
//    UPDATE_DATA_PROFILE, with patterns as chip toggles (mirroring AV's
//    decoder chips) plus the same rules-list upgrade. Security Profile Groups
//    (`obj-spg`, 1850-1907) was fully editable in source via `spgModal`,
//    which built 7 `<select>`s (av/as/vp/url/file/wildfire/data) each sourced
//    live from the corresponding profile array's names plus a blank "none"
//    option — ported here as 7 NativeSelects reading from
//    state.<x>Profiles.map(p => p.name) for cross-linking. Combined into one
//    tabbed page since both share the shell's "data-profile-groups" page slot.
// ===================================================================

function DataRulesEditor({ rules, onChange }: { rules: PaloDataRule[]; onChange: (rules: PaloDataRule[]) => void }) {
  function updateRule(index: number, patch: Partial<PaloDataRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }
  function addRule() {
    onChange([...rules, { apps: "any", filetypes: "any", direction: "both", action: "alert" }]);
  }

  return (
    <div className={styles.fieldset}>
      <div style={{ padding: "10px 12px" }}>
        {rules.length === 0 ? <div className={styles.small}>No rules configured.</div> : null}
        {rules.map((rule, index) => (
          <div key={index} className={styles.flexWrap} style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input className={styles.input} style={{ maxWidth: 140 }} value={rule.apps} placeholder="apps" onChange={(e) => updateRule(index, { apps: e.target.value })} />
            <input
              className={styles.input}
              style={{ maxWidth: 220 }}
              value={rule.filetypes}
              placeholder="filetypes"
              onChange={(e) => updateRule(index, { filetypes: e.target.value })}
            />
            <NativeSelect value={rule.direction} onChange={(v) => updateRule(index, { direction: v })} options={FILE_DIRECTION_OPTIONS} className={styles.select} />
            <NativeSelect value={rule.action} onChange={(v) => updateRule(index, { action: v })} options={FILE_ACTION_OPTIONS} className={styles.select} />
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => removeRule(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={addRule}>
          + Add Rule
        </button>
      </div>
    </div>
  );
}

function DataEditFlyout({ profile, onClose, dispatch }: { profile: PaloDataProfile; onClose: () => void; dispatch: React.Dispatch<PaloAction> }) {
  const [draft, setDraft] = useState<PaloDataProfile>(() => ({
    ...profile,
    patterns: [...profile.patterns],
    rules: profile.rules.map((r) => ({ ...r })),
  }));

  function handleSave() {
    dispatch({ type: "UPDATE_DATA_PROFILE", name: profile.name, patch: draft });
    toast.success(`Data Filtering profile "${profile.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Data Filtering Profile — ${profile.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Data Patterns">
          <div className={styles.chipGroup}>
            {DATA_PATTERN_OPTIONS.map((pattern) => {
              const on = draft.patterns.includes(pattern);
              return (
                <button
                  key={pattern}
                  type="button"
                  className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                  onClick={() => setDraft((prev) => ({ ...prev, patterns: toggleListValue(prev.patterns, pattern) }))}
                >
                  {pattern}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
      <h4>Rules</h4>
      <DataRulesEditor rules={draft.rules} onChange={(rules) => setDraft((prev) => ({ ...prev, rules }))} />
    </Flyout>
  );
}

function profileNameOptions(names: string[]): { value: string; label: string }[] {
  return [{ value: "", label: "none" }, ...names.map((n) => ({ value: n, label: n }))];
}

function ProfileGroupEditFlyout({
  group,
  state,
  onClose,
  dispatch,
}: {
  group: PaloProfileGroup;
  state: PaloState;
  onClose: () => void;
  dispatch: React.Dispatch<PaloAction>;
}) {
  const [draft, setDraft] = useState<PaloProfileGroup>(group);

  function handleSave() {
    dispatch({ type: "UPDATE_PROFILE_GROUP", name: group.name, patch: draft });
    toast.success(`Security Profile Group "${group.name}" updated`);
    onClose();
  }

  return (
    <Flyout
      title={`Edit Security Profile Group — ${group.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Antivirus">
          <NativeSelect value={draft.av} onChange={(v) => setDraft((prev) => ({ ...prev, av: v }))} options={profileNameOptions(state.avProfiles.map((p) => p.name))} />
        </Field>
        <Field label="Anti-Spyware">
          <NativeSelect value={draft.as} onChange={(v) => setDraft((prev) => ({ ...prev, as: v }))} options={profileNameOptions(state.asProfiles.map((p) => p.name))} />
        </Field>
        <Field label="Vulnerability Protection">
          <NativeSelect value={draft.vp} onChange={(v) => setDraft((prev) => ({ ...prev, vp: v }))} options={profileNameOptions(state.vpProfiles.map((p) => p.name))} />
        </Field>
        <Field label="URL Filtering">
          <NativeSelect value={draft.url} onChange={(v) => setDraft((prev) => ({ ...prev, url: v }))} options={profileNameOptions(state.urlProfiles.map((p) => p.name))} />
        </Field>
        <Field label="File Blocking">
          <NativeSelect value={draft.file} onChange={(v) => setDraft((prev) => ({ ...prev, file: v }))} options={profileNameOptions(state.fileProfiles.map((p) => p.name))} />
        </Field>
        <Field label="WildFire Analysis">
          <NativeSelect
            value={draft.wildfire}
            onChange={(v) => setDraft((prev) => ({ ...prev, wildfire: v }))}
            options={profileNameOptions(state.wildfireProfiles.map((p) => p.name))}
          />
        </Field>
        <Field label="Data Filtering">
          <NativeSelect value={draft.data} onChange={(v) => setDraft((prev) => ({ ...prev, data: v }))} options={profileNameOptions(state.dataProfiles.map((p) => p.name))} />
        </Field>
        <Field label="Description">
          <input className={styles.input} value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>
      </div>
    </Flyout>
  );
}

type DataProfileGroupsTab = "data" | "groups";
const DATA_PROFILE_GROUPS_TABS: { key: DataProfileGroupsTab; label: string }[] = [
  { key: "data", label: "Data Filtering" },
  { key: "groups", label: "Security Profile Groups" },
];

export function DataProfileGroupsPage({ state, dispatch }: PaloPageProps) {
  const [tab, setTab] = useState<DataProfileGroupsTab>("data");
  const [editingData, setEditingData] = useState<PaloDataProfile | null>(null);
  const [editingGroup, setEditingGroup] = useState<PaloProfileGroup | null>(null);

  const dataColumns: DataTableColumn<PaloDataProfile>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "patterns", header: "Patterns", render: (p) => p.patterns.join(", ") },
    { key: "rules", header: "Rules", render: (p) => p.rules.length },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  const groupColumns: DataTableColumn<PaloProfileGroup>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "av", header: "Antivirus", render: (p) => p.av || "none" },
    { key: "as", header: "Anti-Spyware", render: (p) => p.as || "none" },
    { key: "vp", header: "Vulnerability Protection", render: (p) => p.vp || "none" },
    { key: "url", header: "URL Filtering", render: (p) => p.url || "none" },
    { key: "file", header: "File Blocking", render: (p) => p.file || "none" },
    { key: "wildfire", header: "WildFire Analysis", render: (p) => p.wildfire || "none" },
    { key: "data", header: "Data Filtering", render: (p) => p.data || "none" },
    { key: "description", header: "Description", render: (p) => p.description },
  ];

  return (
    <div>
      <h2>Data Filtering &amp; Security Profile Groups</h2>
      <TabBar tabs={DATA_PROFILE_GROUPS_TABS} active={tab} onChange={(key) => setTab(key as DataProfileGroupsTab)} />

      {tab === "data" ? (
        <>
          <h3>Data Filtering Profiles</h3>
          <DataTable columns={dataColumns} rows={state.dataProfiles} getRowKey={(p) => p.name} onRowClick={setEditingData} emptyMessage="No Data Filtering profiles configured." />
          {editingData ? <DataEditFlyout profile={editingData} onClose={() => setEditingData(null)} dispatch={dispatch} /> : null}
        </>
      ) : null}

      {tab === "groups" ? (
        <>
          <h3>Security Profile Groups</h3>
          <DataTable
            columns={groupColumns}
            rows={state.profileGroups}
            getRowKey={(p) => p.name}
            onRowClick={setEditingGroup}
            emptyMessage="No Security Profile Groups configured."
          />
          {editingGroup ? <ProfileGroupEditFlyout group={editingGroup} state={state} onClose={() => setEditingGroup(null)} dispatch={dispatch} /> : null}
        </>
      ) : null}
    </div>
  );
}
