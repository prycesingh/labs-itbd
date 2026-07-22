"use client";

// Home dashboard for the Microsoft Purview compliance-portal simulator.
// Ported from itbd-lab/simulators/purview/js/purview-portal.js renderHome() —
// live stat tiles (compliance score, open eDiscovery cases, DLP+audit events
// today, insider risk alerts, sensitivity labels, retention policies), a tile
// grid linking to the 8 solution areas, and a recent-activity table.
//
// Every stat below is a genuine derived number computed from `state` at
// render time (`.filter()`/`.reduce()`/the real compliance-engine), matching
// source's live-data convention for this dashboard — nothing here is a
// hardcoded placeholder. The one exception to a literal 1:1 port is the
// compliance score: source read a static `tenant.complianceScore` (67%)
// wired up by nothing; this port instead calls `computeComplianceScore()`
// over the real seeded assessments/actions so the number moves with state.

import type { PurviewState } from "@/lib/labs/simulators/purview/types";
import { computeComplianceScore } from "@/lib/labs/simulators/purview/compliance-engine";
import type { PurviewPage } from "./purview-shell";
import { DataTable, StatRow } from "./purview-ui";
import styles from "./purview-console.module.css";

type SolutionTile = { title: string; sub: string; page: PurviewPage };

// The 8 solution areas, in source tileCard() order (renderHome()).
const SOLUTION_TILES: SolutionTile[] = [
  { title: "Information protection", sub: "Discover, classify and protect sensitive data", page: "information-protection" },
  { title: "Data loss prevention", sub: "Detect risky sharing of sensitive info", page: "dlp" },
  { title: "Data lifecycle management", sub: "Retention policies for Microsoft 365 content", page: "dlm-policies" },
  { title: "Records management", sub: "File plans, disposition and regulatory records", page: "records-management" },
  { title: "eDiscovery", sub: "Legal hold, search, review and export", page: "ediscovery-standard" },
  { title: "Audit", sub: "Search across user and admin activities", page: "audit" },
  { title: "Communication compliance", sub: "Detect inappropriate or sensitive messaging", page: "comm-compliance" },
  { title: "Insider risk management", sub: "Detect and act on insider risk", page: "insider-risk" },
];

type ActivityRow = PurviewState["activityLog"][number];

export function HomePage({ state, onNavigate }: { state: PurviewState; onNavigate: (page: PurviewPage) => void }) {
  const score = computeComplianceScore(state.complianceAssessments, state.complianceActions);

  const openCases = state.ediscoveryCases.filter((c) => c.status === "Active").length;

  const today = new Date().toDateString();
  const auditEventsToday = state.auditEvents.filter((e) => new Date(e.ts).toDateString() === today).length;
  const dlpActive = state.dlpPolicies.filter((p) => p.runMode === "On").length;

  const insiderCases = state.irmCases.filter((c) => c.status === "Active" || c.status === "Escalated to investigation").length;

  const labelPolicyCount = state.labelPolicies.length;
  const retentionCount = state.retention.length;

  const remainingActions = state.complianceActions.filter((a) => a.status !== "Completed").length;

  const recentActivity = state.activityLog.slice(0, 8);

  return (
    <div>
      <div className={styles.pageH1}>Microsoft Purview</div>
      <div className={styles.pageSub}>
        {state.tenant.name} &middot; {state.tenant.primaryDomain}
      </div>

      <StatRow
        stats={[
          {
            label: "Compliance Manager score",
            value: `${score.percentage}%`,
            sub: `${remainingActions} / ${state.complianceActions.length} actions remaining`,
            onClick: () => onNavigate("compliance-manager"),
          },
          {
            label: "Open eDiscovery cases",
            value: openCases,
            sub: "Across Standard + Premium",
            onClick: () => onNavigate("ediscovery-standard"),
          },
          {
            label: "DLP & Audit events today",
            value: auditEventsToday,
            sub: `${dlpActive} policies on`,
            onClick: () => onNavigate("audit"),
          },
          {
            label: "Insider risk alerts",
            value: insiderCases,
            sub: `Across ${state.irmPolicies.length} policies`,
            onClick: () => onNavigate("insider-risk"),
          },
          {
            label: "Sensitivity labels",
            value: state.sensitivityLabels.length,
            sub: `${labelPolicyCount} label policies published`,
            onClick: () => onNavigate("information-protection"),
          },
          {
            label: "Retention policies & labels",
            value: retentionCount,
            onClick: () => onNavigate("dlm-policies"),
          },
        ]}
      />

      <div className={styles.h2}>Solutions</div>
      <div className={styles.cardGrid}>
        {SOLUTION_TILES.map((tile) => (
          <div key={tile.page} className={styles.tile} onClick={() => onNavigate(tile.page)}>
            <div className={styles.tileTitle}>{tile.title}</div>
            <div className={styles.tileSub}>{tile.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.h2}>Recent activity</div>
      <DataTable<ActivityRow>
        columns={[
          { key: "time", header: "Time", render: (a) => new Date(a.timestamp).toLocaleString() },
          { key: "actor", header: "User", render: (a) => a.actor },
          { key: "action", header: "Activity", render: (a) => a.action },
          { key: "target", header: "Item", render: (a) => a.target },
          {
            key: "status",
            header: "Status",
            render: (a) => <span className={`${styles.pill} ${a.status === "Succeeded" ? "" : styles.pillErr}`}>{a.status}</span>,
          },
        ]}
        rows={recentActivity}
        getRowKey={(a) => `${a.timestamp}-${a.action}-${a.target}`}
        emptyMessage="No recent activity."
      />
    </div>
  );
}
