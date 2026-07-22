"use client";

// Home/Overview dashboard for the Azure DevOps simulator. Ported from
// itbd-lab/simulators/azure-devops/js/ado-portal.js renderHome() — live stat
// tiles (active bugs, active stories, open PRs, pipeline pass rate), a tile
// grid linking to the 5 solution areas (Boards/Repos/Pipelines/Test
// Plans/Artifacts), and a recent-activity table.
//
// Every stat below is a genuine derived number computed from `state` at
// render time (`.filter()`/`.reduce()`), matching source's live-data
// convention — nothing here is a hardcoded placeholder. Source's
// `renderHome()` does NOT scope work items / PRs / pipeline runs by project
// (it reads `s.workItems`, `s.repos`, `s.pipelineRuns` directly with no
// project filter — AdoState is single-project-shaped in the source data
// model even though `AdoWorkItem`/`AdoRepo` carry incidental `iteration`/
// `project` fields), so this port preserves that: all counts are across the
// full seeded state, not filtered to `state.currentProject`. Two additional
// genuine stats beyond source's four (repos count, test pass-rate) are added
// per the porting brief, both real derived numbers from `state.repos` /
// `state.testPlans`.

import type { AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoPage } from "./ado-shell";
import { DataTable, StatRow } from "./ado-ui";
import styles from "./ado-console.module.css";

type SolutionTile = { title: string; desc: string; page: AdoPage };

// The 5 solution areas, in source quickTile() order (renderHome()).
const SOLUTION_TILES: SolutionTile[] = [
  { title: "Boards", desc: "Track work with backlogs, sprints and Kanban boards", page: "work-items" },
  { title: "Repos", desc: "Get the code via clone or set up branch policies", page: "repos-files" },
  { title: "Pipelines", desc: "Set up Build and Release pipelines for CI/CD", page: "pipelines-list" },
  { title: "Test Plans", desc: "Author, execute and chart test progress", page: "test-plans" },
  { title: "Artifacts", desc: "Create, host and share packages with your team", page: "artifacts" },
];

function passRate(runs: AdoState["pipelineRuns"]): number {
  if (runs.length === 0) return 0;
  const succeeded = runs.filter((r) => r.status === "Succeeded").length;
  return Math.round((succeeded / runs.length) * 100);
}

function testPassRate(testPlans: AdoState["testPlans"]): number {
  const allCases = testPlans.flatMap((p) => p.suites.flatMap((s) => s.cases));
  if (allCases.length === 0) return 0;
  const passed = allCases.filter((c) => c.outcome === "Passed").length;
  return Math.round((passed / allCases.length) * 100);
}

export function OverviewPage({ state, onNavigate }: { state: AdoState; onNavigate: (page: AdoPage) => void }) {
  const project = state.projects.find((p) => p.id === state.currentProject);

  const activeBugs = state.workItems.filter((w) => w.type === "Bug" && w.state !== "Closed" && w.state !== "Resolved").length;
  const activeStories = state.workItems.filter((w) => w.type === "User Story" && w.state === "Active").length;

  const openPRs = state.repos.reduce((total, r) => total + r.pullRequests.filter((p) => p.status === "Active").length, 0);

  const pipelinePassRate = passRate(state.pipelineRuns);
  const reposCount = state.repos.length;
  const testPassPct = testPassRate(state.testPlans);

  const recentActivity = state.activityLog.slice(0, 8);

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>{project?.name ?? "Overview"}</div>
      <div className={styles.pageSub}>
        {project ? `${project.description} · ${project.process} process · created ${project.created}` : ""}
      </div>

      <StatRow
        stats={[
          { label: "Active bugs", value: activeBugs, color: "#d13438", onClick: () => onNavigate("work-items") },
          { label: "Active stories", value: activeStories, color: "#0078d4", onClick: () => onNavigate("work-items") },
          { label: "Open PRs", value: openPRs, color: "#107c10", onClick: () => onNavigate("repos-pull-requests") },
          { label: "Pipeline pass rate", value: `${pipelinePassRate}%`, color: "#8764b8", onClick: () => onNavigate("pipelines-list") },
          { label: "Repos", value: reposCount, color: "#0078d4", onClick: () => onNavigate("repos-files") },
          { label: "Test pass rate", value: `${testPassPct}%`, color: "#107c10", onClick: () => onNavigate("test-plans") },
        ]}
      />

      <div className={styles.h2}>Get started</div>
      <div className={styles.tileGrid}>
        {SOLUTION_TILES.map((tile) => (
          <div key={tile.page} className={styles.tile} onClick={() => onNavigate(tile.page)}>
            <div className={styles.tileTitle}>{tile.title}</div>
            <div className={styles.tileDesc}>{tile.desc}</div>
          </div>
        ))}
      </div>

      <div className={styles.h2}>Recent activity</div>
      {recentActivity.length === 0 ? (
        <div className={styles.empty}>No recent activity yet.</div>
      ) : (
        <DataTable<AdoState["activityLog"][number]>
          columns={[
            { key: "when", header: "When", render: (a) => a.when },
            { key: "actor", header: "Actor", render: (a) => a.actor },
            { key: "action", header: "Action", render: (a) => a.action },
            { key: "target", header: "Target", render: (a) => a.target },
          ]}
          rows={recentActivity}
          getRowKey={(a) => `${a.when}-${a.actor}-${a.action}-${a.target}`}
        />
      )}
    </div>
  );
}
