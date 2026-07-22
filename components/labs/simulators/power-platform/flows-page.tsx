"use client";

// Power Automate flows page for the Power Platform Admin Center simulator.
// Ported from itbd-lab/simulators/powerplatform/js/pp-flows.js — inventory
// table (name/status/trigger/last run/owner/fail rate/enabled toggle), a
// detail flyout with Designer/Run history/Connections/Analytics/Settings
// tabs, and a templates-gallery "+ Create flow" modal.
//
// This port's flyout tabs are Details / Run history / Connectors /
// Owners-Sharing / Analytics (per the porting brief), and the Designer /
// Create-flow-templates-gallery / Settings sections of source are OUT OF
// SCOPE here (a sibling agent's concern, or omitted — this page only covers
// the list, filters, detail flyout and CSV export).
//
// THE KEY DEPARTURE FROM SOURCE: source's "Run now" doesn't actually exist
// as its own action (flyRuns() only *synthesizes* 30 fake historical rows on
// every render) and its resubmit/cancel buttons are just toasts with no
// state change. This port instead dispatches `START_FLOW_RUN` (which seeds a
// real "Running" `PpFlowRun` with real per-step tracking via
// `deriveRunSteps`) and then, while that run is being viewed and its
// `status === "Running"`, runs a real `setInterval` that dispatches
// `ADVANCE_FLOW_RUN` every 2.5s — matching the exact pattern used by
// azure-devops/pipelines-list-page.tsx's `RunDetailModal` — so the run
// genuinely progresses step-by-step over real wall-clock time with a live
// "Running" UI, and "Cancel run" genuinely dispatches `CANCEL_FLOW_RUN`
// rather than just toasting.
//
// BUG FIX (not replicated): source's `exportCsv()` reads `f.environment`, a
// field that has never existed on `PpFlow` (the real field is `envId`). This
// port resolves the environment NAME from `envId` via the environments list
// for the CSV column instead.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import type { PpFlow, PpFlowRun, PpFlowType, PpFlowStatus, PpState } from "@/lib/labs/simulators/power-platform/types";
import { DataTable, EmptyState, Flyout, NativeSelect, StatRow, StatusPill, TabBar, exportCsv, statusTone } from "./pp-ui";
import styles from "./pp-console.module.css";

// How often a "Running" run advances one step, matching the flow-run-engine
// module doc's suggested ~2-3s real-time cadence and the azure-devops
// RunDetailModal's identical ADVANCE_INTERVAL_MS constant.
const ADVANCE_INTERVAL_MS = 2500;

type FlowTypeFilter = PpFlowType | "All";
type FlowStatusFilter = PpFlowStatus | "All";

function resolveEnvironmentName(envId: string, state: PpState): string {
  const env = state.environments.find((e) => e.id === envId);
  return env ? env.name : envId;
}

function resolveConnectorName(connectorId: string, state: PpState): string {
  const c = state.connectors.find((x) => x.id === connectorId);
  return c ? c.name : connectorId;
}

function runStepIcon(status: PpFlowRun["steps"][number]["status"]): string {
  if (status === "Succeeded") return "✓";
  if (status === "Failed") return "✕";
  if (status === "Skipped") return "―";
  if (status === "Running") return "●";
  return "•"; // Pending
}

function runStepTone(status: PpFlowRun["steps"][number]["status"]): Parameters<typeof StatusPill>[0]["tone"] {
  if (status === "Succeeded") return "default";
  if (status === "Failed") return "err";
  if (status === "Skipped") return "muted";
  if (status === "Running") return "info";
  return "muted"; // Pending
}

function sortRunsNewestFirst(runs: PpFlowRun[]): PpFlowRun[] {
  return [...runs].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
}

// ===== Flyout tabs =====

const FLYOUT_TABS = [
  { key: "details", label: "Details" },
  { key: "runs", label: "Run history" },
  { key: "connectors", label: "Connectors" },
  { key: "sharing", label: "Owners/Sharing" },
  { key: "analytics", label: "Analytics" },
];

function DetailsTab({ flow, state }: { flow: PpFlow; state: PpState }) {
  return (
    <div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Name</div>
        <div>{flow.name}</div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Type</div>
        <div>{flow.type}</div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Trigger</div>
        <div>{flow.trigger}</div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Owner</div>
        <div>{flow.owner}</div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Environment</div>
        <div>{resolveEnvironmentName(flow.envId, state)}</div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Status</div>
        <div>
          <StatusPill tone={statusTone(flow.status)}>{flow.status}</StatusPill>
        </div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Last run</div>
        <div>{flow.lastRun ? new Date(flow.lastRun).toLocaleString() : "Never"}</div>
      </div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Connectors</div>
        <div>{flow.connectors.length === 0 ? "None" : flow.connectors.map((cid) => resolveConnectorName(cid, state)).join(", ")}</div>
      </div>
      {flow.dlpFlagged ? (
        <div className={styles.reviewGrid}>
          <div className="lbl">DLP</div>
          <div>
            <StatusPill tone="err">Flagged</StatusPill> {flow.dlpFlagReason ? <span className={styles.muted}>{flow.dlpFlagReason}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RunHistoryTab({
  flow,
  state,
  activeRun,
  onCancel,
}: {
  flow: PpFlow;
  state: PpState;
  activeRun: PpFlowRun | null;
  onCancel: (runId: string) => void;
}) {
  const runs = useMemo(() => sortRunsNewestFirst(state.flowRuns.filter((r) => r.flowId === flow.id)), [state.flowRuns, flow.id]);

  return (
    <div>
      <div className={styles.muted} style={{ marginBottom: 8 }}>
        All runs for this flow, newest first. Click <strong>Run now</strong> below to start a new live run.
      </div>
      {runs.length === 0 ? (
        <EmptyState message="No runs yet for this flow." />
      ) : (
        <DataTable<PpFlowRun>
          columns={[
            { key: "id", header: "Run", render: (r) => r.id },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusPill tone={runStatusToneForFlowRun(r.status)}>{r.status}</StatusPill>,
            },
            { key: "start", header: "Started", render: (r) => new Date(r.start).toLocaleString() },
            { key: "duration", header: "Duration", render: (r) => (r.durationSec != null ? `${r.durationSec}s` : "-") },
            { key: "output", header: "Output", render: (r) => r.output || "-" },
          ]}
          rows={runs}
          getRowKey={(r) => r.id}
          emptyMessage="No runs yet."
        />
      )}

      {activeRun ? (
        <div className={styles.card} style={{ marginTop: 14 }}>
          <div className={styles.cardTitle}>
            Live run &middot; {activeRun.id} &middot; <StatusPill tone={runStatusToneForFlowRun(activeRun.status)}>{activeRun.status}</StatusPill>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {activeRun.steps.map((step, i) => (
              <div
                key={`${step.name}-${i}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderBottom: "1px solid #f3f2f1" }}
              >
                <span
                  style={{ width: 18, textAlign: "center", animation: step.status === "Running" ? "ppFlowPulse 1s ease-in-out infinite" : undefined }}
                >
                  {runStepIcon(step.status)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{step.name}</div>
                  <div className={styles.muted} style={{ fontSize: 11 }}>
                    {step.connectorId ? resolveConnectorName(step.connectorId, state) : "Trigger"}
                  </div>
                </div>
                <StatusPill tone={runStepTone(step.status)}>{step.status}</StatusPill>
                {step.durationSec != null ? <span className={styles.muted}>{step.durationSec}s</span> : null}
              </div>
            ))}
          </div>
          {activeRun.status === "Running" ? (
            <div style={{ marginTop: 10 }}>
              <button type="button" className={styles.btnDanger} onClick={() => onCancel(activeRun.id)}>
                Cancel run
              </button>
            </div>
          ) : null}
          <style>{`
            @keyframes ppFlowPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.35; }
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}

function runStatusToneForFlowRun(status: PpFlowRun["status"]): Parameters<typeof StatusPill>[0]["tone"] {
  if (status === "Succeeded") return "default";
  if (status === "Failed") return "err";
  if (status === "Cancelled") return "muted";
  return "info"; // Running
}

function ConnectorsTab({ flow, state }: { flow: PpFlow; state: PpState }) {
  if (flow.connectors.length === 0) return <EmptyState message="No connections registered." />;
  return (
    <DataTable<string>
      columns={[
        { key: "name", header: "Connector", render: (cid) => resolveConnectorName(cid, state) },
        {
          key: "publisher",
          header: "Publisher",
          render: (cid) => state.connectors.find((c) => c.id === cid)?.publisher ?? "-",
        },
        {
          key: "tier",
          header: "Tier",
          render: (cid) => {
            const c = state.connectors.find((x) => x.id === cid);
            return c?.premium ? <StatusPill tone="warn">Premium</StatusPill> : <StatusPill tone="muted">Standard</StatusPill>;
          },
        },
        { key: "connectedAs", header: "Connected as", render: () => flow.owner },
      ]}
      rows={flow.connectors}
      getRowKey={(cid) => cid}
      emptyMessage="No connections registered."
    />
  );
}

function SharingTab({ flow }: { flow: PpFlow }) {
  return (
    <div>
      <div className={styles.reviewGrid}>
        <div className="lbl">Owner</div>
        <div>{flow.owner}</div>
      </div>
      <div className={styles.muted} style={{ marginTop: 10 }}>
        Only the owner can run, edit or share this flow. Co-owners and run-only users are not tracked separately for this flow in CloudLab.
      </div>
    </div>
  );
}

function AnalyticsTab({ flow }: { flow: PpFlow }) {
  // Source's flyAnalytics() is itself just 4 real counters plus a "sparkline
  // placeholder" with no real time-series data — matching that fidelity
  // level here: a real StatRow off the flow's own total/success/failed
  // counters, no fabricated day-by-day series.
  const failRate = flow.total > 0 ? ((flow.failed / flow.total) * 100).toFixed(2) : "0";
  const successRate = flow.total > 0 ? ((flow.success / flow.total) * 100).toFixed(2) : "0";
  return (
    <div>
      <StatRow
        stats={[
          { label: "Total runs (lifetime)", value: flow.total },
          { label: "Successful", value: flow.success, color: "#107c10" },
          { label: "Failed", value: flow.failed, color: "#d83b01" },
          { label: "Success rate", value: `${successRate}%` },
          { label: "Failure rate", value: `${failRate}%` },
        ]}
      />
      <div className={styles.card}>
        <div className={styles.cardTitle}>Run outcome breakdown</div>
        <div className={styles.bar} aria-label={`${successRate}% success`}>
          <div className={styles.fill} style={{ width: `${successRate}%` }} />
        </div>
        <div className={styles.muted} style={{ fontSize: 12 }}>
          {flow.success} succeeded / {flow.failed} failed out of {flow.total} total runs.
        </div>
      </div>
    </div>
  );
}

// ===== Flyout =====

function FlowFlyout({
  flow,
  state,
  dispatch,
  onClose,
}: {
  flow: PpFlow;
  state: PpState;
  dispatch: React.Dispatch<PpAction>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>("details");

  // Track the run this flyout itself started, so the live progress panel and
  // its interval only concern a run initiated from here (not just "most
  // recent run in state", which could be a stale/historical one).
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const activeRun = activeRunId ? state.flowRuns.find((r) => r.id === activeRunId) ?? null : null;

  // Always re-read the latest flow from state (dispatches mutate `state.flows`
  // via TOGGLE_FLOW_STATUS/ADVANCE_FLOW_RUN's terminal-status counters), so
  // the flyout reflects fresh counts rather than the initial snapshot.
  const liveFlow = state.flows.find((f) => f.id === flow.id) ?? flow;

  function clearRunInterval(runId: string) {
    const interval = intervalsRef.current.get(runId);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(runId);
    }
  }

  // Advance the active run on a real wall-clock timer while it is "Running",
  // matching azure-devops/pipelines-list-page.tsx's RunDetailModal pattern
  // exactly: dispatch ADVANCE_FLOW_RUN every ADVANCE_INTERVAL_MS, clear the
  // interval once the run reaches a terminal status.
  useEffect(() => {
    if (!activeRun || activeRun.status !== "Running") return;
    const runId = activeRun.id;
    if (intervalsRef.current.has(runId)) return;
    const interval = setInterval(() => {
      dispatch({ type: "ADVANCE_FLOW_RUN", runId });
    }, ADVANCE_INTERVAL_MS);
    intervalsRef.current.set(runId, interval);
    return () => clearRunInterval(runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.id, activeRun?.status, dispatch]);

  // Toast once the tracked run reaches a terminal state, tracked via local
  // state so it fires exactly once per transition (not on every re-render).
  const [announcedStatus, setAnnouncedStatus] = useState<PpFlowRun["status"] | null>(null);
  useEffect(() => {
    if (!activeRun) return;
    if (activeRun.status === announcedStatus) return;
    if (activeRun.status === "Succeeded") {
      toast.success(`Run ${activeRun.id} succeeded`, { description: liveFlow.name });
      setAnnouncedStatus(activeRun.status);
    } else if (activeRun.status === "Failed") {
      toast.error(`Run ${activeRun.id} failed`, { description: liveFlow.name });
      setAnnouncedStatus(activeRun.status);
    } else if (activeRun.status === "Cancelled") {
      setAnnouncedStatus(activeRun.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.status]);

  // Clean up ALL tracked intervals on unmount (e.g. flyout closed while a run
  // is still "Running") so no zombie timer keeps dispatching after this
  // component is gone.
  useEffect(() => {
    const intervals = intervalsRef.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
    };
  }, []);

  function handleRunNow() {
    dispatch({ type: "START_FLOW_RUN", flowId: liveFlow.id });
    toast.success(`Run started for ${liveFlow.name}`);
    setTab("runs");
    // The new run's id is reducer-generated (genId("run")), so pick it up on
    // the next render: it will be the newest "Running" row for this flow.
  }

  function handleCancel(runId: string) {
    dispatch({ type: "CANCEL_FLOW_RUN", runId });
    clearRunInterval(runId);
    toast.info(`Cancelled run ${runId}`);
  }

  function handleToggleStatus() {
    dispatch({ type: "TOGGLE_FLOW_STATUS", id: liveFlow.id });
    toast.success(`Flow ${liveFlow.name} is now ${liveFlow.status === "On" ? "Off" : "On"}`);
  }

  // Once a run is started, adopt its id as the tracked "activeRunId" so the
  // live panel + interval pick it up — done via effect on flowRuns length
  // rather than reading dispatch's return value (the reducer has no return
  // channel back to the caller).
  useEffect(() => {
    if (activeRunId) return;
    const newestRun = sortRunsNewestFirst(state.flowRuns.filter((r) => r.flowId === liveFlow.id))[0];
    if (newestRun && newestRun.status === "Running") {
      setActiveRunId(newestRun.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flowRuns.length]);

  let body: React.ReactNode;
  switch (tab) {
    case "details":
      body = <DetailsTab flow={liveFlow} state={state} />;
      break;
    case "runs":
      body = <RunHistoryTab flow={liveFlow} state={state} activeRun={activeRun} onCancel={handleCancel} />;
      break;
    case "connectors":
      body = <ConnectorsTab flow={liveFlow} state={state} />;
      break;
    case "sharing":
      body = <SharingTab flow={liveFlow} />;
      break;
    case "analytics":
      body = <AnalyticsTab flow={liveFlow} />;
      break;
    default:
      body = null;
  }

  return (
    <Flyout
      title={liveFlow.name}
      subtitle={
        <>
          {liveFlow.type} flow &middot; {resolveEnvironmentName(liveFlow.envId, state)} &middot; {liveFlow.owner} &middot;{" "}
          <StatusPill tone={statusTone(liveFlow.status)}>{liveFlow.status}</StatusPill>
        </>
      }
      onClose={onClose}
      tabs={<TabBar tabs={FLYOUT_TABS} active={tab} onChange={setTab} />}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btnOutline} onClick={handleToggleStatus}>
            {liveFlow.status === "On" ? "Turn off" : "Turn on"}
          </button>
          {activeRun && activeRun.status === "Running" ? (
            <button type="button" className={styles.btnDanger} onClick={() => handleCancel(activeRun.id)}>
              Cancel run
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={handleRunNow}>
              Run now
            </button>
          )}
        </>
      }
    >
      {body}
    </Flyout>
  );
}

// ===== Page =====

export function FlowsPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [envFilter, setEnvFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<FlowTypeFilter>("All");
  const [statusFilter, setStatusFilter] = useState<FlowStatusFilter>("All");
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  const selectedFlow = selectedFlowId ? state.flows.find((f) => f.id === selectedFlowId) ?? null : null;

  const filteredFlows = useMemo(() => {
    return state.flows.filter((f) => {
      if (envFilter !== "All" && f.envId !== envFilter) return false;
      if (typeFilter !== "All" && f.type !== typeFilter) return false;
      if (statusFilter !== "All" && f.status !== statusFilter) return false;
      return true;
    });
  }, [state.flows, envFilter, typeFilter, statusFilter]);

  function handleToggleStatus(flow: PpFlow) {
    dispatch({ type: "TOGGLE_FLOW_STATUS", id: flow.id });
    toast.success(`Flow ${flow.name} is now ${flow.status === "On" ? "Off" : "On"}`);
  }

  function handleExport() {
    // Bug fix vs. source: source's exportCsv() reads `f.environment`, a field
    // that doesn't exist on PpFlow — resolves to `undefined` for every row in
    // the original. The real field is `envId`; resolve it to the environment
    // NAME for a human-readable CSV column.
    exportCsv(
      "powerautomate-flows.csv",
      ["Name", "Type", "Owner", "Environment", "Status", "Total", "Success", "Failed"],
      filteredFlows.map((f) => [f.name, f.type, f.owner, resolveEnvironmentName(f.envId, state), f.status, f.total, f.success, f.failed]),
    );
    toast.success(`Exported ${filteredFlows.length} flows to CSV`);
  }

  return (
    <div>
      <div className={styles.pageH1}>Power Automate</div>
      <div className={styles.pageSub}>Every cloud and desktop flow in the tenant.</div>

      <div className={styles.filterRow}>
        <NativeSelect
          value={envFilter}
          onChange={setEnvFilter}
          options={[{ value: "All", label: "All environments" }, ...state.environments.map((e) => ({ value: e.id, label: e.name }))]}
        />
        <NativeSelect
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as FlowTypeFilter)}
          options={[
            { value: "All", label: "All types" },
            { value: "Cloud", label: "Cloud" },
            { value: "Desktop", label: "Desktop" },
          ]}
        />
        <NativeSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as FlowStatusFilter)}
          options={[
            { value: "All", label: "All statuses" },
            { value: "On", label: "On" },
            { value: "Off", label: "Off" },
            { value: "Suspended", label: "Suspended" },
          ]}
        />
        <span className={styles.spacer} />
        <button type="button" className={styles.btnOutline} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      {filteredFlows.length === 0 ? (
        <EmptyState message="No flows match your filter." />
      ) : (
        <DataTable<PpFlow>
          columns={[
            { key: "name", header: "Name", render: (f) => f.name },
            { key: "type", header: "Type", render: (f) => f.type },
            { key: "owner", header: "Owner", render: (f) => f.owner },
            { key: "environment", header: "Environment", render: (f) => resolveEnvironmentName(f.envId, state) },
            { key: "status", header: "Status", render: (f) => <StatusPill tone={statusTone(f.status)}>{f.status}</StatusPill> },
            {
              key: "ratio",
              header: "Success / total",
              render: (f) => (
                <>
                  {f.success} / {f.total}
                  {f.dlpFlagged ? (
                    <>
                      {" "}
                      <StatusPill tone="err">DLP</StatusPill>
                    </>
                  ) : null}
                </>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (f) => (
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(f);
                  }}
                >
                  {f.status === "On" ? "Turn off" : "Turn on"}
                </button>
              ),
            },
          ]}
          rows={filteredFlows}
          getRowKey={(f) => f.id}
          onRowClick={(f) => setSelectedFlowId(f.id)}
          emptyMessage="No flows match your filter."
        />
      )}

      {selectedFlow ? <FlowFlyout flow={selectedFlow} state={state} dispatch={dispatch} onClose={() => setSelectedFlowId(null)} /> : null}
    </div>
  );
}
