"use client";

// Pipelines list + run history + run detail for the Azure DevOps simulator.
// Ported from itbd-lab/simulators/azure-devops/js/ado-pipelines.js
// `renderList()` / `renderRunsTab()` / `renderRunDetail()` / `renderSummary()`
// / `stageStatus()` / `runPipeline()` / `rerunRun()` — the YAML editor and New
// Pipeline wizard sections of that file are OUT OF SCOPE here (a sibling
// agent owns those).
//
// THE KEY DEPARTURE FROM SOURCE: source's `runPipeline()` synchronously
// unshifts a hardcoded `{ status: 'Succeeded', duration: '5m 12s' }` run —
// fake, instant, no progression. This port instead dispatches
// `START_PIPELINE_RUN` (which seeds real "Pending"/"Running" `stageRuns` via
// the pipeline-engine) and then, while a run is being viewed and its
// `status === "Running"`, runs a real `setInterval` that dispatches
// `ADVANCE_PIPELINE_RUN` every 2.5s — so the run genuinely progresses
// stage-by-stage over real wall-clock time with a live "Running" UI, matching
// the module-level doc comment in `pipeline-engine.ts`.
//
// Layout choice ("your call" per the porting brief): list and run history are
// both plain in-page sections (no per-pipeline drill-in page/tab — this port
// skips source's separate Branches/Settings pipeline-detail tabs, out of
// scope), and the run detail (the flagship live stage timeline) opens in a
// `Modal`, matching source's single-centered-modal convention (`renderRunDetail`
// opens via `ADOPortal.openModal`).

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { AdoPipeline, AdoPipelineRun, AdoRunStage, AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { DataTable, Modal, StatusPill, type StatusTone } from "./ado-ui";
import styles from "./ado-console.module.css";

const ADMIN_EMAIL = "admin@itbd.onmicrosoft.com";

// How often the "Running" run detail advances one stage-step, matching the
// pipeline-engine module doc's suggested 2-4s (mid-range) real-time cadence.
const ADVANCE_INTERVAL_MS = 2500;

// Maps a pipeline run / stage status onto the shared `StatusPill` tone
// vocabulary. Distinct from `statusTone()` in ado-ui.tsx (which is a generic
// string-sniffing mapper) because "Pending"/"Skipped" need a muted look that
// generic mapper doesn't produce for those exact words.
function runStatusTone(status: AdoPipelineRun["status"]): StatusTone {
  if (status === "Succeeded") return "done";
  if (status === "Failed") return "rejected";
  if (status === "Canceled") return "default";
  return "active"; // Running
}

function stageTone(status: AdoRunStage["status"]): StatusTone {
  if (status === "Succeeded") return "done";
  if (status === "Failed") return "rejected";
  if (status === "Canceled" || status === "Skipped") return "default";
  if (status === "Running") return "active";
  return "new"; // Pending
}

// Distinct visual per stage — matches source's `stage-step ok/fail/cancel`
// left-border treatment; "Running" gets the `active`-tone pill and a small
// pulsing dot (no source class for this since source's runs were instant),
// "Pending"/"Skipped" fall back to the plain `stageStep` card with a muted pill.
function stageStepClass(status: AdoRunStage["status"]): string {
  if (status === "Succeeded") return styles.stageStepOk;
  if (status === "Failed") return styles.stageStepFail;
  if (status === "Canceled" || status === "Skipped") return styles.stageStepCancel;
  return "";
}

function stageIcon(status: AdoRunStage["status"]): string {
  if (status === "Succeeded") return "✓"; // check
  if (status === "Failed") return "✕"; // x
  if (status === "Canceled" || status === "Skipped") return "―"; // dash
  if (status === "Running") return "●"; // filled dot (pulses via inline animation below)
  return "•"; // pending bullet
}

function shortCommit(commit: string): string {
  return commit.slice(0, 8);
}

function findLastRun(runs: AdoPipelineRun[], pipelineId: string): AdoPipelineRun | undefined {
  const matches = runs.filter((r) => r.pipeline === pipelineId);
  if (!matches.length) return undefined;
  // Sort by `when` (ISO-ish date string) descending, tie-broken by runNumber
  // descending — mirrors source's `runsForPipeline()[0]` (runs are stored
  // newest-first already, but we don't rely on array order here since
  // START_PIPELINE_RUN unshifts new runs while seed data is also
  // newest-first per pipeline, and the two orders should never be assumed
  // to interleave correctly without an explicit sort).
  return [...matches].sort((a, b) => {
    if (a.when !== b.when) return a.when < b.when ? 1 : -1;
    return b.runNumber - a.runNumber;
  })[0];
}

function defaultBranchFor(pipeline: AdoPipeline): string {
  // AdoPipeline has no explicit "default branch" field of its own — pipelines
  // trigger off their repo's default branch, which is always "main" across
  // every seeded repo (see seedData.ts REPO_DEFS). Falling back to "main"
  // keeps this real rather than guessing at a field that doesn't exist.
  return "main";
}

// ===== Run detail modal (the flagship live feature) =====

function RunDetailModal({
  run,
  pipeline,
  dispatch,
  onClose,
}: {
  run: AdoPipelineRun;
  pipeline: AdoPipeline | undefined;
  dispatch: React.Dispatch<AdoAction>;
  onClose: () => void;
}) {
  const isRunning = run.status === "Running";

  // Real wall-clock timer: while this run is "Running", advance it one
  // stage-step every ADVANCE_INTERVAL_MS. Re-subscribes whenever run.status
  // changes (effect dependency includes `run.status`), and always clears the
  // interval on unmount / status change so no zombie interval keeps
  // dispatching after the run reaches a terminal state.
  useEffect(() => {
    if (!isRunning) return;
    const runId = run.id;
    const interval = setInterval(() => {
      dispatch({ type: "ADVANCE_PIPELINE_RUN", runId });
    }, ADVANCE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, run.status, dispatch]);

  // Toast once the run reaches a terminal state (Succeeded/Failed) — tracked
  // via a ref-less "previous status" comparison using state so the toast
  // fires exactly once per transition, not on every re-render.
  const [announcedStatus, setAnnouncedStatus] = useState<AdoPipelineRun["status"] | null>(null);
  useEffect(() => {
    if (run.status === announcedStatus) return;
    if (run.status === "Succeeded") {
      toast.success(`Run #${run.runNumber} succeeded`, { description: pipeline?.name });
      setAnnouncedStatus(run.status);
    } else if (run.status === "Failed") {
      toast.error(`Run #${run.runNumber} failed`, { description: pipeline?.name });
      setAnnouncedStatus(run.status);
    } else if (run.status === "Canceled") {
      setAnnouncedStatus(run.status);
    }
  }, [run.status, run.runNumber, pipeline?.name, announcedStatus]);

  return (
    <Modal
      title={`Run #${run.runNumber} · ${pipeline ? pipeline.name : run.pipeline}`}
      width="820px"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          {isRunning ? (
            <button
              type="button"
              className={styles.btnDanger}
              style={{ marginLeft: 6 }}
              onClick={() => {
                dispatch({ type: "CANCEL_PIPELINE_RUN", runId: run.id });
                toast.info(`Canceling run #${run.runNumber}`);
              }}
            >
              Cancel run
            </button>
          ) : null}
        </>
      }
    >
      <div className={styles.runH}>
        <div>
          <StatusPill tone={runStatusTone(run.status)}>{run.status}</StatusPill> &middot; {run.duration} &middot; {run.when}
        </div>
        <div>
          <code className={styles.branchTag}>{run.branch}</code> &middot; <code className={styles.hash}>{shortCommit(run.commit)}</code> &middot;{" "}
          {run.triggeredBy} ({run.reason})
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Stages</div>
        <div className={styles.stageTimeline}>
          {run.stageRuns.map((stage) => (
            <div key={stage.name} className={`${styles.stageStep} ${stageStepClass(stage.status)}`}>
              <div className={styles.ssDot} style={stage.status === "Running" ? { animation: "adoPulse 1s ease-in-out infinite" } : undefined}>
                {stageIcon(stage.status)}
              </div>
              <div className={styles.ssName}>{stage.name}</div>
              <div className={styles.ssStatus}>
                <StatusPill tone={stageTone(stage.status)}>{stage.status}</StatusPill>
                {stage.durationSec != null ? ` · ${stage.durationSec}s` : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Local keyframes for the Running-stage pulse — no such animation
          exists in ado-console.module.css yet (source's runs were instant,
          so it never needed one), scoped here since it is only used by this
          live indicator. */}
      <style>{`
        @keyframes adoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </Modal>
  );
}

// ===== Page =====

export function PipelinesListPage({
  state,
  dispatch,
  onNewPipeline,
}: {
  state: AdoState;
  dispatch: React.Dispatch<AdoAction>;
  onNewPipeline?: () => void;
}) {
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [historyPipelineId, setHistoryPipelineId] = useState<string | null>(null);

  // Always look up the LATEST run/pipeline objects from `state` (never hold a
  // stale copy in local state) so the modal re-renders with fresh data on
  // every dispatch, including the ADVANCE_PIPELINE_RUN ticks from the timer.
  const viewingRun = viewingRunId ? state.pipelineRuns.find((r) => r.id === viewingRunId) : undefined;
  const viewingPipeline = viewingRun ? state.pipelines.find((p) => p.id === viewingRun.pipeline) : undefined;

  const historyPipeline = historyPipelineId ? state.pipelines.find((p) => p.id === historyPipelineId) : undefined;
  const historyRuns = useMemo(
    () =>
      historyPipelineId
        ? state.pipelineRuns
            .filter((r) => r.pipeline === historyPipelineId)
            .sort((a, b) => b.runNumber - a.runNumber)
        : [],
    [state.pipelineRuns, historyPipelineId],
  );

  function handleRunPipeline(pipeline: AdoPipeline) {
    dispatch({
      type: "START_PIPELINE_RUN",
      pipelineId: pipeline.id,
      branch: defaultBranchFor(pipeline),
      triggeredBy: ADMIN_EMAIL,
      reason: "Manual run",
    });
    toast.success(`Run queued for ${pipeline.name}`, { description: `Branch ${defaultBranchFor(pipeline)}` });
    // The new run's id is reducer-generated (genId("run")) so it isn't known
    // synchronously here — the "Last run" cell in the table picks it up on
    // the next render via `findLastRun`, and clicking it opens the live
    // RunDetailModal where the real stage-by-stage progression is visible.
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Pipelines</div>
      <div className={styles.pageSub}>CI/CD pipelines for the project.</div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => (onNewPipeline ? onNewPipeline() : toast.info("Use the New Pipeline wizard from Pipelines settings"))}
        >
          + New pipeline
        </button>
        <button type="button" className={styles.btnSubtle} onClick={() => setHistoryPipelineId(null)}>
          Refresh
        </button>
      </div>

      <DataTable<AdoPipeline>
        columns={[
          { key: "name", header: "Name", render: (p) => p.name },
          { key: "folder", header: "Folder", render: (p) => p.folder ?? "\\" },
          { key: "repo", header: "Repo", render: (p) => <code className={styles.codeInline}>{p.repo}</code> },
          {
            key: "status",
            header: "Last run",
            render: (p) => {
              const last = findLastRun(state.pipelineRuns, p.id);
              return last ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingRunId(last.id);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <StatusPill tone={runStatusTone(last.status)}>{last.status}</StatusPill> #{last.runNumber}
                </span>
              ) : (
                "-"
              );
            },
          },
          {
            key: "branch",
            header: "Branch",
            render: (p) => {
              const last = findLastRun(state.pipelineRuns, p.id);
              return last ? <code className={styles.branchTag}>{last.branch}</code> : "-";
            },
          },
          {
            key: "duration",
            header: "Duration",
            render: (p) => {
              const last = findLastRun(state.pipelineRuns, p.id);
              return last ? last.duration : "-";
            },
          },
          {
            key: "when",
            header: "When",
            render: (p) => {
              const last = findLastRun(state.pipelineRuns, p.id);
              return last ? last.when : "-";
            },
          },
          {
            key: "actions",
            header: "",
            render: (p) => (
              <button
                type="button"
                className={styles.btnOutline}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunPipeline(p);
                }}
              >
                Run pipeline
              </button>
            ),
          },
        ]}
        rows={state.pipelines}
        getRowKey={(p) => p.id}
        onRowClick={(p) => setHistoryPipelineId(p.id)}
        emptyMessage="No pipelines yet."
      />

      {historyPipeline ? (
        <Modal title={`Run history · ${historyPipeline.name}`} width="880px" onClose={() => setHistoryPipelineId(null)}>
          <DataTable<AdoPipelineRun>
            columns={[
              { key: "run", header: "Run", render: (r) => `#${r.runNumber}` },
              { key: "status", header: "Status", render: (r) => <StatusPill tone={runStatusTone(r.status)}>{r.status}</StatusPill> },
              { key: "branch", header: "Branch", render: (r) => <code className={styles.branchTag}>{r.branch}</code> },
              { key: "commit", header: "Commit", render: (r) => <code className={styles.hash}>{shortCommit(r.commit)}</code> },
              { key: "triggeredBy", header: "Triggered by", render: (r) => r.triggeredBy },
              { key: "duration", header: "Duration", render: (r) => r.duration },
              { key: "when", header: "When", render: (r) => r.when },
            ]}
            rows={historyRuns}
            getRowKey={(r) => r.id}
            onRowClick={(r) => setViewingRunId(r.id)}
            emptyMessage="No runs yet for this pipeline."
          />
        </Modal>
      ) : null}

      {viewingRun ? (
        <RunDetailModal run={viewingRun} pipeline={viewingPipeline} dispatch={dispatch} onClose={() => setViewingRunId(null)} />
      ) : null}
    </div>
  );
}
