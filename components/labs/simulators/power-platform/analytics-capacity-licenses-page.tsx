"use client";

// Analytics / Capacity / Licenses pages for the Power Platform Admin Center
// simulator. Ported from itbd-lab/simulators/powerplatform/js/pp-analytics.js
// (274 lines):
//
// - `AnalyticsPage` covers the single "analytics" PpPage (see pp-shell.tsx)
//   with an in-page SubTabBar across the 4 sub-dashboards source splits into
//   renderApps()/renderFlows()/renderDataverse()/renderCopilot(): Power Apps
//   (top-5 by sharedCount + Canvas/Model-driven breakdown, both real
//   `.sort()`/`.filter()` over `state.apps`), Power Automate (top-5 by real
//   computed fail-rate + On/Off/Suspended breakdown over `state.flows`),
//   Dataverse (per-environment Dataverse-enabled % + database usage, real,
//   from `state.environments`), and Copilot Studio — which source's own
//   renderCopilot() hardcodes as static reference numbers (1,248 sessions,
//   72% deflection, etc. and a fixed 4-row topics table) with ZERO
//   computation over state; that section is ported here verbatim as static
//   content for the same reason, not recomputed.
//
// - `CapacityPage` ports renderCapacity()/gauge(): 5 real gauges (database/
//   file/log GB, AI Builder credits, flow runs) plus the per-Dataverse-
//   environment breakdown table, both computed live from `state.capacity`/
//   `state.environments`. Source's `_addCapacity()` used two chained
//   `prompt()` calls (bucket key, then amount) — ported here as a single
//   `Modal` form (bucket `NativeSelect` + GB `input`) dispatching the
//   already-built `ADD_CAPACITY` action, plus a second small Modal for AI
//   Builder credits dispatching `ADD_AI_CREDITS` (source's `_addCapacity`
//   technically also accepted "aiBuilder"/"flowRuns" as free-text keys, but
//   the real `ADD_CAPACITY` reducer case only widens `database`/`file`/`log`
//   totalGB buckets — see reducer.ts — so AI Builder credits gets its own
//   dedicated action/button per the porting brief rather than stretching
//   ADD_CAPACITY to a bucket shape it doesn't support).
//
// - `LicensesPage` ports renderLicenses(): a `DataTable` of `state.licenses`
//   (assigned/purchased, % bar, available), with source's `_purchase()`
//   numbered-prompt flow replaced by a `Modal` form (sku `NativeSelect` +
//   count `input`) dispatching the already-built `PURCHASE_LICENSE` action.
//   Source's `renderAuditTable()` call at the bottom of renderLicenses() is
//   intentionally NOT ported here — the shared tenant audit log has its own
//   home elsewhere in this port (Home dashboard's "Recent admin activity" —
//   see overview-page.tsx) and duplicating it under Licenses would just be
//   the same `state.auditLog` rendered twice with no new information.
//
// No native prompt()/alert()/confirm() anywhere — all confirmations route
// through Modal + toast (sonner), per house convention (see
// azure-devops/environments-library-page.tsx for the sibling idiom this
// follows).

import { useState } from "react";
import { toast } from "sonner";

import type { PpState } from "@/lib/labs/simulators/power-platform/types";
import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import type { PpApp, PpEnvironment, PpFlow, PpLicense } from "@/lib/labs/simulators/power-platform/types";
import { DataTable, Field, NativeSelect, StatRow, SubTabBar, type DataTableColumn } from "./pp-ui";
import styles from "./pp-console.module.css";

// ===================================================================
// Analytics
// ===================================================================

type AnalyticsTab = "apps" | "flows" | "dataverse" | "copilot";

const ANALYTICS_TABS: { key: AnalyticsTab; label: string }[] = [
  { key: "apps", label: "Power Apps" },
  { key: "flows", label: "Power Automate" },
  { key: "dataverse", label: "Dataverse" },
  { key: "copilot", label: "Copilot Studio" },
];

// ----- Power Apps sub-dashboard -----
// Ported from source's renderApps(): canvas/model-driven/shared counts (all
// real `.filter()` over state.apps) + top-5 apps by sharedCount (real
// `.slice().sort()`).
function AppsAnalytics({ state }: { state: PpState }) {
  const apps = state.apps;
  const canvasCount = apps.filter((a) => a.type === "Canvas").length;
  const modelCount = apps.filter((a) => a.type === "Model-driven").length;
  const sharedCount = apps.filter((a) => a.sharedCount > 0).length;
  const topShared = apps.slice().sort((a, b) => b.sharedCount - a.sharedCount).slice(0, 5);

  const columns: DataTableColumn<PpApp>[] = [
    { key: "name", header: "App", render: (a) => <strong>{a.name}</strong> },
    { key: "type", header: "Type", render: (a) => a.type },
    { key: "sharedCount", header: "Shared with", render: (a) => a.sharedCount },
    { key: "owner", header: "Owner", render: (a) => a.owner },
  ];

  return (
    <div>
      <div className={styles.h2}>Analytics · Power Apps</div>
      <div className={styles.pageSub}>Usage and adoption across canvas and model-driven apps.</div>

      <StatRow
        stats={[
          { label: "Total apps", value: apps.length },
          { label: "Canvas apps", value: canvasCount },
          { label: "Model-driven apps", value: modelCount },
          { label: "Apps shared", value: sharedCount },
        ]}
      />

      <div className={styles.h3}>Top apps by sharing</div>
      <DataTable columns={columns} rows={topShared} getRowKey={(a) => a.id} emptyMessage="No apps yet." />
    </div>
  );
}

// ----- Power Automate sub-dashboard -----
// Ported from source's renderFlows(): on/off, lifetime runs, tenant-wide
// fail-rate (all real `.reduce()`/`.filter()`), and top-5 flows by real
// per-flow fail-rate (`failed/total`, sorted descending).
function FlowsAnalytics({ state }: { state: PpState }) {
  const flows = state.flows;
  const onCount = flows.filter((f) => f.status === "On").length;
  const offCount = flows.filter((f) => f.status === "Off").length;
  const suspendedCount = flows.filter((f) => f.status === "Suspended").length;
  const totalRuns = flows.reduce((sum, f) => sum + f.total, 0);
  const totalFailed = flows.reduce((sum, f) => sum + f.failed, 0);
  const failRate = totalRuns ? ((totalFailed / totalRuns) * 100).toFixed(2) : "0";

  const topFailing = flows
    .slice()
    .sort((a, b) => {
      const rateA = a.total ? a.failed / a.total : 0;
      const rateB = b.total ? b.failed / b.total : 0;
      return rateB - rateA;
    })
    .slice(0, 5);

  const columns: DataTableColumn<PpFlow>[] = [
    { key: "name", header: "Flow", render: (f) => <strong>{f.name}</strong> },
    { key: "ratio", header: "Failed / total", render: (f) => `${f.failed} / ${f.total}` },
    { key: "rate", header: "Fail rate", render: (f) => `${(f.total ? (f.failed / f.total) * 100 : 0).toFixed(2)}%` },
    { key: "owner", header: "Owner", render: (f) => f.owner },
  ];

  return (
    <div>
      <div className={styles.h2}>Analytics · Power Automate</div>
      <div className={styles.pageSub}>Run volume, failure rate, top-error flows.</div>

      <StatRow
        stats={[
          { label: "Total flows", value: flows.length },
          { label: "Active", value: onCount },
          { label: "Disabled", value: offCount },
          { label: "Suspended", value: suspendedCount },
          { label: "Lifetime runs", value: totalRuns.toLocaleString() },
          { label: "Failure rate", value: `${failRate}%` },
        ]}
      />

      <div className={styles.h3}>Top failing flows</div>
      <DataTable columns={columns} rows={topFailing} getRowKey={(f) => f.id} emptyMessage="No flows yet." />
    </div>
  );
}

// ----- Dataverse sub-dashboard -----
// Ported from source's renderDataverse(): per-Dataverse-enabled-environment
// usage table + tenant totals, all real, computed from state.environments
// (databaseSizeMB / capacityGB).
function DataverseAnalytics({ state }: { state: PpState }) {
  const envs = state.environments.filter((e) => e.dataverseEnabled);
  const totalDbMB = envs.reduce((sum, e) => sum + (e.databaseSizeMB || 0), 0);
  const totalCapGB = envs.reduce((sum, e) => sum + (e.capacityGB || 0), 0);
  const enabledPct = state.environments.length ? Math.round((envs.length / state.environments.length) * 100) : 0;

  const columns: DataTableColumn<PpEnvironment>[] = [
    { key: "name", header: "Environment", render: (e) => <strong>{e.name}</strong> },
    { key: "version", header: "Version", render: (e) => e.dataverseVersion },
    { key: "used", header: "Used", render: (e) => `${(e.databaseSizeMB / 1024).toFixed(2)} GB` },
    { key: "capacity", header: "Capacity", render: (e) => `${e.capacityGB} GB` },
    {
      key: "pct",
      header: "% used",
      render: (e) => `${e.capacityGB ? ((e.databaseSizeMB / (e.capacityGB * 1024)) * 100).toFixed(0) : 0}%`,
    },
  ];

  return (
    <div>
      <div className={styles.h2}>Analytics · Dataverse</div>
      <div className={styles.pageSub}>Database, file and log storage per environment.</div>

      <StatRow
        stats={[
          { label: "Dataverse environments", value: envs.length },
          { label: "Dataverse enabled", value: `${enabledPct}%` },
          { label: "Used storage", value: `${(totalDbMB / 1024).toFixed(1)} GB` },
          { label: "Total capacity", value: `${totalCapGB} GB` },
        ]}
      />

      <div className={styles.h3}>Per environment</div>
      <DataTable columns={columns} rows={envs} getRowKey={(e) => e.id} emptyMessage="No Dataverse-enabled environments." />
    </div>
  );
}

// ----- Copilot Studio sub-dashboard -----
// Ported verbatim from source's renderCopilot() — the ONE analytics section
// that is 100% hardcoded static reference numbers in source (no
// `.reduce()`/`.sort()`/state math at all), kept that way here per the
// porting brief: illustrative content, not a real computation.
const COPILOT_TOPICS: { topic: string; triggered: number; resolved: number; avgDuration: string }[] = [
  { topic: "Reset Wi-Fi password", triggered: 312, resolved: 289, avgDuration: "1m 12s" },
  { topic: "How do I file leave?", triggered: 248, resolved: 235, avgDuration: "54s" },
  { topic: "Where do I find payslips?", triggered: 196, resolved: 192, avgDuration: "40s" },
  { topic: "Book a meeting room", triggered: 175, resolved: 140, avgDuration: "2m 02s" },
];

function CopilotAnalytics() {
  return (
    <div>
      <div className={styles.h2}>Analytics · Copilot Studio</div>
      <div className={styles.pageSub}>Chat sessions, deflection rate and top topics across tenant copilots.</div>

      <StatRow
        stats={[
          { label: "Sessions (last 30 days)", value: "1,248" },
          { label: "Deflection rate", value: "72%" },
          { label: "Avg CSAT", value: "4.4 / 5" },
          { label: "Published copilots", value: 3 },
        ]}
      />

      <div className={styles.h3}>Top topics</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Triggered</th>
              <th>Resolved</th>
              <th>Avg duration</th>
            </tr>
          </thead>
          <tbody>
            {COPILOT_TOPICS.map((row) => (
              <tr key={row.topic}>
                <td>{row.topic}</td>
                <td>{row.triggered}</td>
                <td>{row.resolved}</td>
                <td>{row.avgDuration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsPage({ state }: { state: PpState }) {
  const [tab, setTab] = useState<AnalyticsTab>("apps");

  return (
    <div>
      <div className={styles.pageH1}>Analytics</div>
      <div className={styles.pageSub}>Usage, reliability and storage analytics across the tenant.</div>

      <SubTabBar tabs={ANALYTICS_TABS} active={tab} onChange={(key) => setTab(key as AnalyticsTab)} />

      {tab === "apps" ? <AppsAnalytics state={state} /> : null}
      {tab === "flows" ? <FlowsAnalytics state={state} /> : null}
      {tab === "dataverse" ? <DataverseAnalytics state={state} /> : null}
      {tab === "copilot" ? <CopilotAnalytics /> : null}
    </div>
  );
}

// ===================================================================
// Capacity
// ===================================================================

type CapacityBucketKey = "database" | "file" | "log";

const CAPACITY_BUCKET_OPTIONS: { value: CapacityBucketKey; label: string }[] = [
  { value: "database", label: "Database" },
  { value: "file", label: "File" },
  { value: "log", label: "Log" },
];

function gaugeBarClass(pct: number): string {
  if (pct > 85) return styles.barHigh;
  if (pct > 65) return styles.barMed;
  return "";
}

// Single gauge tile, matching source's gauge(title, used, total, unit) —
// used/total number pair, a % bar (colored by threshold), and a "% used"
// caption underneath.
function Gauge({ title, used, total, unit }: { title: string; used: number; total: number; unit: string }) {
  const pct = total ? Math.round((used / total) * 100) : 0;
  return (
    <div className={styles.gauge}>
      <div className={styles.gtitle}>{title}</div>
      <div>
        <span className={styles.gval}>{used.toLocaleString()}</span>
        <span className={styles.gunit}>
          / {total.toLocaleString()}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className={`${styles.bar} ${gaugeBarClass(pct)}`}>
        <div className="fill" style={{ height: "100%", width: `${pct}%`, background: "currentColor" }} />
      </div>
      <div className={styles.muted} style={{ fontSize: 12, marginTop: 4 }}>
        {pct}% used
      </div>
    </div>
  );
}

// "+ Add capacity" modal form — replaces source's chained
// `_addCapacity()` prompt() calls (capacity type, then amount) with a
// single Modal (bucket NativeSelect + GB input), dispatching the real
// ADD_CAPACITY action.
function AddCapacityModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<PpAction> }) {
  const [bucket, setBucket] = useState<CapacityBucketKey>("database");
  const [gb, setGb] = useState("50");

  function handleSubmit() {
    const amount = Number.parseFloat(gb);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount of GB greater than 0.");
      return;
    }
    dispatch({ type: "ADD_CAPACITY", bucket, gb: amount });
    toast.success(`${bucket} capacity increased by ${amount} GB`);
    onClose();
  }

  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={{ width: "480px" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add capacity</h2>
          <button type="button" className={styles.flyoutClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <Field label="Capacity type">
            <NativeSelect value={bucket} onChange={(value) => setBucket(value as CapacityBucketKey)} options={CAPACITY_BUCKET_OPTIONS} />
          </Field>
          <Field label="Add how much (GB)">
            <input className={styles.input} type="number" min={0} step="0.1" value={gb} onChange={(e) => setGb(e.target.value)} />
          </Field>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Add capacity
          </button>
        </div>
      </div>
    </div>
  );
}

// "+ Add AI Builder credits" modal form — AI Builder credits are a distinct
// bucket shape (`PpCreditBucket.totalCredits`, not a GB bucket), so this uses
// the dedicated ADD_AI_CREDITS action rather than overloading ADD_CAPACITY.
function AddAiCreditsModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<PpAction> }) {
  const [credits, setCredits] = useState("100");

  function handleSubmit() {
    const amount = Number.parseFloat(credits);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid number of credits greater than 0.");
      return;
    }
    dispatch({ type: "ADD_AI_CREDITS", credits: amount });
    toast.success(`AI Builder credits increased by ${amount}`);
    onClose();
  }

  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={{ width: "440px" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add AI Builder credits</h2>
          <button type="button" className={styles.flyoutClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <Field label="Credits to add">
            <input className={styles.input} type="number" min={0} step="1" value={credits} onChange={(e) => setCredits(e.target.value)} />
          </Field>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Add credits
          </button>
        </div>
      </div>
    </div>
  );
}

export function CapacityPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [addingCapacity, setAddingCapacity] = useState(false);
  const [addingCredits, setAddingCredits] = useState(false);

  const c = state.capacity;
  const envRows = state.environments.filter((e) => e.dataverseEnabled);

  const envColumns: DataTableColumn<PpEnvironment>[] = [
    { key: "name", header: "Environment", render: (e) => <strong>{e.name}</strong> },
    { key: "used", header: "Used / Capacity", render: (e) => `${(e.databaseSizeMB / 1024).toFixed(2)} / ${e.capacityGB} GB` },
    {
      key: "bar",
      header: "",
      width: "200px",
      render: (e) => {
        const pct = e.capacityGB ? Math.round((e.databaseSizeMB / (e.capacityGB * 1024)) * 100) : 0;
        return (
          <div className={`${styles.bar} ${gaugeBarClass(pct)}`}>
            <div style={{ height: "100%", width: `${pct}%`, background: "currentColor" }} />
          </div>
        );
      },
    },
    {
      key: "pct",
      header: "% used",
      render: (e) => `${e.capacityGB ? Math.round((e.databaseSizeMB / (e.capacityGB * 1024)) * 100) : 0}%`,
    },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Capacity</div>
      <div className={styles.pageSub}>Tenant-wide storage and AI Builder consumption.</div>

      <div className={styles.cardGrid}>
        <Gauge title="Database" used={c.database.usedGB} total={c.database.totalGB} unit="GB" />
        <Gauge title="File" used={c.file.usedGB} total={c.file.totalGB} unit="GB" />
        <Gauge title="Log" used={c.log.usedGB} total={c.log.totalGB} unit="GB" />
        <Gauge title="AI Builder credits" used={c.aiBuilder.usedCredits} total={c.aiBuilder.totalCredits} unit="" />
        <Gauge title="Flow runs (this month)" used={c.flowRuns.used} total={c.flowRuns.total} unit="" />
      </div>

      <div className={styles.h2}>Per environment</div>
      <DataTable columns={envColumns} rows={envRows} getRowKey={(e) => e.id} emptyMessage="No Dataverse-enabled environments." />

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button type="button" className={styles.btn} onClick={() => setAddingCapacity(true)}>
          + Add capacity
        </button>
        <button type="button" className={styles.btnOutline} onClick={() => setAddingCredits(true)}>
          + Add AI Builder credits
        </button>
      </div>

      {addingCapacity ? <AddCapacityModal onClose={() => setAddingCapacity(false)} dispatch={dispatch} /> : null}
      {addingCredits ? <AddAiCreditsModal onClose={() => setAddingCredits(false)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// Licenses
// ===================================================================

function licensePillClass(pct: number): string {
  if (pct > 90) return styles.barHigh;
  if (pct > 75) return styles.barMed;
  return "";
}

// "+ Purchase licenses" modal form — replaces source's `_purchase()`
// numbered-prompt flow (pick a license by index, then enter a seat count)
// with a single Modal (sku NativeSelect populated from state.licenses +
// count input), dispatching the real PURCHASE_LICENSE action.
function PurchaseLicenseModal({
  licenses,
  onClose,
  dispatch,
}: {
  licenses: PpLicense[];
  onClose: () => void;
  dispatch: React.Dispatch<PpAction>;
}) {
  const [sku, setSku] = useState(licenses[0]?.sku ?? "");
  const [count, setCount] = useState("10");

  function handleSubmit() {
    const license = licenses.find((l) => l.sku === sku);
    if (!license) {
      toast.error("Choose a license to purchase.");
      return;
    }
    const qty = Number.parseInt(count, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid number of seats greater than 0.");
      return;
    }
    dispatch({ type: "PURCHASE_LICENSE", sku, count: qty });
    toast.success(`${qty} x ${license.name} purchased`);
    onClose();
  }

  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={{ width: "480px" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Purchase licenses</h2>
          <button type="button" className={styles.flyoutClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <Field label="License">
            <NativeSelect
              value={sku}
              onChange={setSku}
              options={licenses.map((l) => ({ value: l.sku, label: `${l.name} (${l.sku})` }))}
            />
          </Field>
          <Field label="Seats to add">
            <input className={styles.input} type="number" min={1} step="1" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Purchase
          </button>
        </div>
      </div>
    </div>
  );
}

export function LicensesPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [purchasing, setPurchasing] = useState(false);

  const columns: DataTableColumn<PpLicense>[] = [
    {
      key: "name",
      header: "License",
      render: (l) => (
        <>
          <strong>{l.name}</strong>
          <br />
          <span className={styles.muted} style={{ fontSize: 12 }}>
            {l.sku}
          </span>
        </>
      ),
    },
    { key: "ratio", header: "Assigned / Purchased", render: (l) => `${l.assigned} / ${l.purchased}` },
    {
      key: "bar",
      header: "",
      width: "200px",
      render: (l) => {
        const pct = l.purchased ? Math.round((l.assigned / l.purchased) * 100) : 0;
        return (
          <div className={`${styles.bar} ${licensePillClass(pct)}`}>
            <div style={{ height: "100%", width: `${pct}%`, background: "currentColor" }} />
          </div>
        );
      },
    },
    {
      key: "pct",
      header: "% used",
      render: (l) => `${l.purchased ? Math.round((l.assigned / l.purchased) * 100) : 0}%`,
    },
    { key: "available", header: "Available", render: (l) => `${l.purchased - l.assigned} available` },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Licenses</div>
      <div className={styles.pageSub}>Per-user and per-app/flow plan assignments.</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setPurchasing(true)}>
          + Purchase
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Refreshing license report")}>
          Refresh
        </button>
      </div>

      <DataTable columns={columns} rows={state.licenses} getRowKey={(l) => l.sku} emptyMessage="No licenses configured." />

      {purchasing ? <PurchaseLicenseModal licenses={state.licenses} onClose={() => setPurchasing(false)} dispatch={dispatch} /> : null}
    </div>
  );
}
