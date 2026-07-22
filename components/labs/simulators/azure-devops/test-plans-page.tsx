"use client";

// Test Plans page for the Azure DevOps simulator: Plans -> Suites -> Cases
// tree navigation, a test case detail panel, a genuinely stateful multi-step
// Test Runner, and Reports. Ported from
// itbd-lab/simulators/azure-devops/js/ado-testplans.js (`renderPlans`,
// `renderSuiteDetail`, `openCase`, the Test Runner functions, and
// `renderReports`).
//
// The Test Runner is the one genuinely stateful flow here (source's
// module-level `runState = { planId, suiteId, caseIdx, stepIdx, results }`,
// ported to local `useState`): it walks the suite's cases one at a time,
// tracks a Pass/Fail/Blocked outcome per step, and on "Save & Pass/Fail/Block"
// dispatches RECORD_TEST_STEP_RESULT with the case's final outcome (a real
// reducer action, not a local-only fake) before auto-advancing to the next
// case. On the last case it closes the runner and shows a completion summary,
// matching source's `completeCase()` behavior exactly (advance if more cases
// remain, else `ADOPortal.closeModal(); ADOPortal.rerender();`).
//
// Reports keeps source's real-total/fake-history split faithfully: the five
// aggregate stat tiles (total/passed/failed/blocked+notRun/pass rate) are
// genuine `.reduce()`/`.filter()` derivations over `state.testPlans`, matching
// source's `renderReports()` — but the trend chart is source's exact
// `[62, 68, 71, 74, 78, passRate]` array (5 hardcoded historical points, only
// the final "this week" value is real), and the "failed tests by area" table
// is source's exact static 4-row reference table. This sub-phase's real-engine
// investment went into Pipelines, not Test Plans reporting, so this page
// intentionally does NOT compute a real historical trend or a real
// failures-by-area breakdown — that would be over-porting relative to source.

import { useState } from "react";
import { toast } from "sonner";

import type { AdoState, AdoTestCase, AdoTestOutcome, AdoTestPlan, AdoTestSuite } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { DataTable, EmptyState, StatRow, StatusPill, type StatusTone } from "./ado-ui";
import styles from "./ado-console.module.css";

// Source's `outcomeBadge()` — maps a test outcome onto the shared state-pill
// tone vocabulary (Passed -> done/green, Failed -> rejected/red, Blocked ->
// resolved/blue, Not Run -> new/grey).
function outcomeTone(outcome: AdoTestOutcome): StatusTone {
  if (outcome === "Passed") return "done";
  if (outcome === "Failed") return "rejected";
  if (outcome === "Blocked") return "resolved";
  return "new";
}

// Per-step run status, tracked only inside the Test Runner (not part of
// AdoTestCase — the case's persisted `outcome` is only set once via Save &
// Pass/Fail/Block). Matches source's `runState.results[caseIdx].steps[i]`
// ('Not Run' | 'Pass' | 'Fail' | 'Blocked').
type StepRunStatus = "Not Run" | "Pass" | "Fail" | "Blocked";

function stepStatusTone(status: StepRunStatus): StatusTone {
  if (status === "Pass") return "done";
  if (status === "Fail") return "rejected";
  if (status === "Blocked") return "resolved";
  return "new";
}

type CaseRunResult = { caseId: string; steps: StepRunStatus[] };

type RunState = {
  planId: string;
  suiteId: string;
  caseIdx: number;
  results: CaseRunResult[];
};

function findPlan(state: AdoState, planId: string): AdoTestPlan | undefined {
  return state.testPlans.find((p) => p.id === planId);
}
function findSuite(plan: AdoTestPlan | undefined, suiteId: string): AdoTestSuite | undefined {
  return plan?.suites.find((s) => s.id === suiteId);
}

function initialResults(suite: AdoTestSuite): CaseRunResult[] {
  return suite.cases.map((c) => ({ caseId: c.id, steps: c.steps.map(() => "Not Run" as StepRunStatus) }));
}

export function TestPlansPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const plans = state.testPlans;

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(plans[0]?.suites[0]?.id ?? null);
  const [openCase, setOpenCase] = useState<{ planId: string; suiteId: string; caseId: string } | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [runComplete, setRunComplete] = useState<{ suiteName: string; count: number } | null>(null);
  const [tab, setTab] = useState<"plans" | "reports">("plans");

  if (plans.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Test plans</div>
        <EmptyState message="No plans configured." />
      </div>
    );
  }

  const plan = findPlan(state, selectedPlanId ?? "") ?? plans[0];
  const suite = findSuite(plan, selectedSuiteId ?? "") ?? plan.suites[0];

  function selectPlan(planId: string) {
    const p = findPlan(state, planId);
    setSelectedPlanId(planId);
    setSelectedSuiteId(p?.suites[0]?.id ?? null);
  }
  function selectSuite(planId: string, suiteId: string) {
    setSelectedPlanId(planId);
    setSelectedSuiteId(suiteId);
  }

  // ----- Test Runner -----
  function startRun(planId: string, suiteId: string, startIdx: number) {
    const p = findPlan(state, planId);
    const s = findSuite(p, suiteId);
    if (!s || s.cases.length === 0) return;
    setRunState({ planId, suiteId, caseIdx: startIdx, results: initialResults(s) });
    setRunComplete(null);
  }

  function markStep(stepIdx: number, status: StepRunStatus) {
    setRunState((prev) => {
      if (!prev) return prev;
      const results = prev.results.map((r, i) => (i === prev.caseIdx ? { ...r, steps: r.steps.map((st, si) => (si === stepIdx ? status : st)) } : r));
      return { ...prev, results };
    });
  }

  function prevCase() {
    setRunState((prev) => (prev && prev.caseIdx > 0 ? { ...prev, caseIdx: prev.caseIdx - 1 } : prev));
  }

  function nextCase() {
    setRunState((prev) => {
      if (!prev) return prev;
      const p = findPlan(state, prev.planId);
      const s = findSuite(p, prev.suiteId);
      if (!s) return prev;
      return prev.caseIdx < s.cases.length - 1 ? { ...prev, caseIdx: prev.caseIdx + 1 } : prev;
    });
  }

  // Save & Pass/Fail/Block — dispatches the real RECORD_TEST_STEP_RESULT
  // action (persists the case's outcome in AdoState), matching source's
  // `completeCase(outcome)`: sets the case outcome, toasts, then auto-advances
  // to the next case or closes the runner + shows a completion summary on the
  // last case.
  function completeCase(outcome: AdoTestOutcome) {
    if (!runState) return;
    const p = findPlan(state, runState.planId);
    const s = findSuite(p, runState.suiteId);
    if (!s) return;
    const tc = s.cases[runState.caseIdx];

    dispatch({ type: "RECORD_TEST_STEP_RESULT", planId: runState.planId, suiteId: runState.suiteId, caseId: tc.id, outcome });
    toast.success(`Case ${tc.id} -> ${outcome}`);

    if (runState.caseIdx < s.cases.length - 1) {
      setRunState({ ...runState, caseIdx: runState.caseIdx + 1 });
    } else {
      setRunComplete({ suiteName: s.name, count: s.cases.length });
      setRunState(null);
    }
  }

  const runPlan = runState ? findPlan(state, runState.planId) : undefined;
  const runSuite = runState ? findSuite(runPlan, runState.suiteId) : undefined;
  const runCase = runState && runSuite ? runSuite.cases[runState.caseIdx] : undefined;
  const runResult = runState ? runState.results[runState.caseIdx] : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Test plans</div>
      <div className={styles.pageSub}>Manual test plans, suites and cases.</div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === "plans" ? styles.tabActive : ""}`} onClick={() => setTab("plans")}>
          Plans
        </button>
        <button type="button" className={`${styles.tab} ${tab === "reports" ? styles.tabActive : ""}`} onClick={() => setTab("reports")}>
          Reports
        </button>
      </div>

      {tab === "plans" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.btnPrimary} onClick={() => startRun(plan.id, suite.id, 0)}>
              Run tests
            </button>
            <button type="button" className={styles.btnSubtle} onClick={() => toast.info("New test case (sim only)")}>
              + New test case
            </button>
            <button type="button" className={styles.btnSubtle} onClick={() => toast.info("Add existing (sim only)")}>
              Add existing
            </button>
          </div>

          <div className={styles.tpGrid}>
            <div className={styles.tpTree}>
              {plans.map((p) => (
                <div key={p.id} className={`${styles.tpPlan} ${p.id === plan.id ? styles.tpPlanActive : ""}`} onClick={() => selectPlan(p.id)}>
                  <div className={styles.tpPlanName}>{p.name}</div>
                  <div className={styles.tpSuiteList}>
                    {p.suites.map((s) => (
                      <div
                        key={s.id}
                        className={`${styles.tpSuite} ${p.id === plan.id && s.id === suite.id ? styles.tpSuiteActive : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectSuite(p.id, s.id);
                        }}
                      >
                        {s.name} <span className={styles.tpCount}>({s.cases.length})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.tpDetail}>
              <div className={styles.h2} style={{ marginTop: 0 }}>
                {plan.name} &middot; {suite.name}
              </div>
              <DataTable<AdoTestCase>
                columns={[
                  { key: "id", header: "ID", render: (c) => c.id },
                  { key: "title", header: "Title", render: (c) => c.title },
                  { key: "outcome", header: "Outcome", render: (c) => <StatusPill tone={outcomeTone(c.outcome)}>{c.outcome}</StatusPill> },
                  { key: "tester", header: "Assigned tester", render: (c) => c.assignedTester },
                  { key: "steps", header: "Steps", render: (c) => c.steps.length },
                ]}
                rows={suite.cases}
                getRowKey={(c) => c.id}
                onRowClick={(c) => setOpenCase({ planId: plan.id, suiteId: suite.id, caseId: c.id })}
              />
            </div>
          </div>
        </>
      ) : (
        <ReportsTab state={state} />
      )}

      {/* ----- Test case detail modal ----- */}
      {openCase ? (
        <CaseDetailModal
          state={state}
          planId={openCase.planId}
          suiteId={openCase.suiteId}
          caseId={openCase.caseId}
          onClose={() => setOpenCase(null)}
          onRun={(planId, suiteId, caseId) => {
            const p = findPlan(state, planId);
            const s = findSuite(p, suiteId);
            const idx = s ? s.cases.findIndex((c) => c.id === caseId) : 0;
            setOpenCase(null);
            startRun(planId, suiteId, idx < 0 ? 0 : idx);
          }}
        />
      ) : null}

      {/* ----- Test runner modal ----- */}
      {runState && runSuite && runCase && runResult ? (
        <RunnerModal
          suite={runSuite}
          tc={runCase}
          caseIdx={runState.caseIdx}
          steps={runResult.steps}
          onMarkStep={markStep}
          onPrev={prevCase}
          onNext={nextCase}
          onComplete={completeCase}
          onClose={() => setRunState(null)}
        />
      ) : null}

      {/* ----- Completion summary ----- */}
      {runComplete ? (
        <div className={styles.modalMask} onMouseDown={() => setRunComplete(null)}>
          <div className={styles.modal} style={{ width: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Run complete</h2>
              <button type="button" className={styles.modalClose} onClick={() => setRunComplete(null)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>
                Finished running <strong>{runComplete.count}</strong> test case{runComplete.count === 1 ? "" : "s"} in{" "}
                <strong>{runComplete.suiteName}</strong>.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnPrimary} onClick={() => setRunComplete(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ===== Test case detail modal =====
// Ported from source's `openCase()` — shows the case's steps and current
// (persisted) outcome, with a "Run this test" shortcut into the runner.
function CaseDetailModal({
  state,
  planId,
  suiteId,
  caseId,
  onClose,
  onRun,
}: {
  state: AdoState;
  planId: string;
  suiteId: string;
  caseId: string;
  onClose: () => void;
  onRun: (planId: string, suiteId: string, caseId: string) => void;
}) {
  const plan = findPlan(state, planId);
  const suite = findSuite(plan, suiteId);
  const tc = suite?.cases.find((c) => c.id === caseId);
  if (!plan || !suite || !tc) return null;

  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={{ width: 700 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Test case {tc.id}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.h3} style={{ marginTop: 0 }}>
            {tc.title}
          </div>
          <div>
            Outcome: <StatusPill tone={outcomeTone(tc.outcome)}>{tc.outcome}</StatusPill> &middot; Assigned to: {tc.assignedTester}
          </div>
          <table className={styles.table} style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
              </tr>
            </thead>
            <tbody>
              {tc.steps.map((s, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => onRun(planId, suiteId, caseId)}>
            Run this test
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Test runner modal =====
// Ported from source's `renderRun()` — one step at a time with Pass/Fail/
// Blocked buttons per step, plus Save & Pass/Fail/Block shortcuts and Previous
// / Next case navigation, matching source's footer button set exactly (source
// also has a comment textarea + a fake "Attach screenshot" button — both are
// local-only UI polish with no persisted state in source, so the comment/
// attachment affordances are represented here via a lightweight toast on
// attach, keeping parity with source's `fakeAttachment()` which only toasts).
function RunnerModal({
  suite,
  tc,
  caseIdx,
  steps,
  onMarkStep,
  onPrev,
  onNext,
  onComplete,
  onClose,
}: {
  suite: AdoTestSuite;
  tc: AdoTestCase;
  caseIdx: number;
  steps: StepRunStatus[];
  onMarkStep: (stepIdx: number, status: StepRunStatus) => void;
  onPrev: () => void;
  onNext: () => void;
  onComplete: (outcome: AdoTestOutcome) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalMask} onMouseDown={onClose}>
      <div className={styles.modal} style={{ width: 820 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            Test run: {suite.name} &middot; case {caseIdx + 1} of {suite.cases.length}
          </h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.h3}>
            {tc.id} &middot; {tc.title}
          </div>
          <table className={styles.table} style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
                <th>Status</th>
                <th>Mark</th>
              </tr>
            </thead>
            <tbody>
              {tc.steps.map((step, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{step}</td>
                  <td>
                    <StatusPill tone={stepStatusTone(steps[i])}>{steps[i]}</StatusPill>
                  </td>
                  <td>
                    <button type="button" className={styles.btnLink} onClick={() => onMarkStep(i, "Pass")}>
                      Pass
                    </button>{" "}
                    <button type="button" className={`${styles.btnLink} ${styles.btnDanger}`} onClick={() => onMarkStep(i, "Fail")}>
                      Fail
                    </button>{" "}
                    <button type="button" className={styles.btnLink} onClick={() => onMarkStep(i, "Blocked")}>
                      Block
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.formRow}>
            <label>Attach screenshot</label>
            <div>
              <button type="button" className={styles.btnSubtle} onClick={() => toast.success("Screenshot attached (sim only)")}>
                + Attach (sim)
              </button>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnOutline} onClick={onPrev} disabled={caseIdx === 0}>
            &laquo; Previous case
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => onComplete("Passed")}>
            Save &amp; Pass
          </button>
          <button type="button" className={styles.btnDanger} onClick={() => onComplete("Failed")}>
            Save &amp; Fail
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => onComplete("Blocked")}>
            Save &amp; Block
          </button>
          <button type="button" className={styles.btnOutline} onClick={onNext} disabled={caseIdx >= suite.cases.length - 1}>
            Next case &raquo;
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Reports tab =====
// Ported from source's `renderReports()`. Aggregate stats are real, computed
// live via `.reduce()` over every case across every plan (source scopes to
// ALL plans, not a single selected plan — `plans.forEach(p => p.suites.forEach(s
// => s.cases.forEach(...)))` with no plan filter, so this matches that
// unscoped behavior). The trend array and failures-by-area table are ported
// verbatim as source's static/partially-fake content.
function ReportsTab({ state }: { state: AdoState }) {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let notRun = 0;
  for (const p of state.testPlans) {
    for (const s of p.suites) {
      for (const c of s.cases) {
        total++;
        if (c.outcome === "Passed") passed++;
        else if (c.outcome === "Failed") failed++;
        else if (c.outcome === "Blocked") blocked++;
        else notRun++;
      }
    }
  }
  const passRate = total ? Math.round((passed / total) * 100) : 0;

  // Source: `var trend = [62, 68, 71, 74, 78, passRate];` — 5 hardcoded
  // historical weeks, only the 6th ("this week") is the real live pass rate.
  const trend = [62, 68, 71, 74, 78, passRate];

  return (
    <div>
      <div className={styles.pageH1}>Progress reports</div>
      <div className={styles.pageSub}>Test execution velocity, pass rate trend and failures by area.</div>

      <StatRow
        stats={[
          { label: "Total cases", value: total, color: "#0078d4" },
          { label: "Passed", value: passed, color: "#107c10" },
          { label: "Failed", value: failed, color: "#d13438" },
          { label: "Blocked / Not run", value: blocked + notRun, color: "#605e5c" },
          { label: "Pass rate", value: `${passRate}%`, color: "#8764b8" },
        ]}
      />

      <div className={styles.h2}>Pass rate trend</div>
      <div className={styles.fakeChart}>
        <div className={styles.barRow}>
          {trend.map((v, i) => (
            <div key={i} className={styles.barCol}>
              <div className={styles.bar} style={{ height: `${v * 1.4}px`, background: "#107c10" }} />
              <div className={styles.barLabel}>W{i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.h2}>Failed tests by area</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Area</th>
              <th>Failures</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>WebApp/Frontend</td>
              <td>4</td>
            </tr>
            <tr>
              <td>WebApp/Backend</td>
              <td>2</td>
            </tr>
            <tr>
              <td>Mobile</td>
              <td>3</td>
            </tr>
            <tr>
              <td>Infrastructure</td>
              <td>1</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
