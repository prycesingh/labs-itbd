"use client";

// Home dashboard for the Power Platform Admin Center simulator. Ported from
// itbd-lab/simulators/powerplatform/js/pp-portal.js renderHome() — live stat
// tiles (environments, Power Apps, active flows fraction, DLP policies,
// Dataverse capacity used %, AI Builder credits used %), a "Get started"
// tile grid + a "Resources" tile grid linking to the main pages, and a
// recent admin-activity table from `state.auditLog`.
//
// Every stat below is a genuine derived number computed from `state` at
// render time — nothing here is a hardcoded placeholder. Two additional
// genuine stats beyond source's four capacity/count stats are folded in per
// the porting brief: Dataverse-enabled environment % (derived from
// `environments`) and a DLP-flagged apps/flows count (derived from the real
// `dlpFlagged` fields the DLP engine already computed on seed and on every
// policy/app/flow mutation), giving the dashboard genuine DLP-conflict
// visibility that source's four-stat row didn't surface on Home.

import type { PpState } from "@/lib/labs/simulators/power-platform/types";
import type { PpPage } from "./pp-shell";
import { DataTable, StatRow } from "./pp-ui";
import styles from "./pp-console.module.css";

type GetStartedTile = { title: string; sub: string; page: PpPage };

// Ported from source's renderHome() tile() calls, in source order.
const GET_STARTED_TILES: GetStartedTile[] = [
  { title: "Create an environment", sub: "Provision a new Production, Sandbox, Trial or Developer environment.", page: "environments" },
  { title: "Create a data policy", sub: "Restrict which connectors can share data with each other.", page: "dlp-policies" },
  { title: "Review Power Apps", sub: "See every app in the tenant, sharing scope and connectors used.", page: "apps" },
  { title: "Review Power Automate flows", sub: "Inspect flow status, last run, failure rate.", page: "flows" },
];

const RESOURCES_TILES: GetStartedTile[] = [
  { title: "Capacity", sub: "Storage gauges and per-environment breakdown.", page: "capacity" },
  { title: "Licenses", sub: "Per-user and per-app/flow plan assignments.", page: "licenses" },
  { title: "Power Pages sites", sub: "Public-facing low-code websites built on Dataverse.", page: "power-pages-sites" },
  { title: "Copilot Studio", sub: "Tenant-wide chat assistants and topics.", page: "copilot-studio" },
];

export function OverviewPage({ state, onNavigate }: { state: PpState; onNavigate: (page: PpPage) => void }) {
  const envCount = state.environments.length;
  const appCount = state.apps.length;

  const flowsOn = state.flows.filter((f) => f.status === "On").length;
  const activeFlowsLabel = `${flowsOn} / ${state.flows.length}`;

  const policyCount = state.policies.length;

  const dataverseEnabledPct = envCount === 0 ? 0 : Math.round((state.environments.filter((e) => e.dataverseEnabled).length / envCount) * 100);

  const aiBuilderPct =
    state.capacity.aiBuilder.totalCredits === 0
      ? 0
      : Math.round((state.capacity.aiBuilder.usedCredits / state.capacity.aiBuilder.totalCredits) * 100);

  const dlpFlaggedCount = state.apps.filter((a) => a.dlpFlagged).length + state.flows.filter((f) => f.dlpFlagged).length;

  const recentActivity = state.auditLog.slice(0, 8);

  return (
    <div>
      <div className={styles.pageH1}>Power Platform admin center</div>
      <div className={styles.pageSub}>
        {state.tenant.name} &middot; {state.tenant.domain} &middot; {state.tenant.region}
      </div>

      <StatRow
        stats={[
          { label: "Environments", value: envCount, color: "#742774", onClick: () => onNavigate("environments") },
          { label: "Power Apps", value: appCount, color: "#742774", onClick: () => onNavigate("apps") },
          { label: "Active flows", value: activeFlowsLabel, color: "#107c10", onClick: () => onNavigate("flows") },
          { label: "DLP policies", value: policyCount, color: "#742774", onClick: () => onNavigate("dlp-policies") },
          { label: "Dataverse enabled", value: `${dataverseEnabledPct}%`, color: "#0078d4", onClick: () => onNavigate("environments") },
          { label: "AI Builder credits used", value: `${aiBuilderPct}%`, color: "#ffaa44", onClick: () => onNavigate("capacity") },
          { label: "DLP-flagged apps/flows", value: dlpFlaggedCount, color: dlpFlaggedCount > 0 ? "#d83b01" : "#107c10", onClick: () => onNavigate("dlp-policies") },
        ]}
      />

      <div className={styles.h2}>Get started</div>
      <div className={styles.cardGrid}>
        {GET_STARTED_TILES.map((tile) => (
          <div key={tile.page} className={styles.tile} onClick={() => onNavigate(tile.page)}>
            <div className={styles.tileTitle}>{tile.title}</div>
            <div className={styles.tileSub}>{tile.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.h2}>Resources</div>
      <div className={styles.cardGrid}>
        {RESOURCES_TILES.map((tile) => (
          <div key={tile.page} className={styles.tile} onClick={() => onNavigate(tile.page)}>
            <div className={styles.tileTitle}>{tile.title}</div>
            <div className={styles.tileSub}>{tile.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.h2}>Recent admin activity</div>
      {recentActivity.length === 0 ? (
        <div className={styles.empty}>No admin activity yet.</div>
      ) : (
        <DataTable<PpState["auditLog"][number]>
          columns={[
            { key: "ts", header: "Time", render: (a) => new Date(a.ts).toLocaleString() },
            { key: "actor", header: "Actor", render: (a) => a.actor },
            { key: "action", header: "Action", render: (a) => a.action },
            { key: "target", header: "Target", render: (a) => a.target },
            {
              key: "status",
              header: "Status",
              render: (a) => <span className={`${styles.pill} ${a.status === "Failed" ? styles.pillErr : ""}`}>{a.status}</span>,
            },
          ]}
          rows={recentActivity}
          getRowKey={(a) => `${a.ts}-${a.actor}-${a.action}-${a.target}`}
        />
      )}
    </div>
  );
}
