"use client";

// NetSim Pro — Troubleshoot, Scenarios, and Reference tabs. Ported from
// itbd-lab/simulators/network's js/troubleshoot.js, js/scenarios.js, and
// js/reference.js (data already extracted into content.ts).
//
// ===== Interaction mapping =====
//
// Troubleshoot (js/troubleshoot.js):
// - toggleTsFlow(id)        -> dispatch(SET_TROUBLESHOOT_STEP) with
//                              stepIndex: 0 to open/start a flow, or
//                              stepIndex: null to close/collapse it.
//                              state.troubleshootSteps[flow.id] (undefined or
//                              null) means collapsed.
// - renderTsStep(id, idx)   -> derived render of flow.steps[currentStepIndex]
//                              from state.troubleshootSteps[flow.id] — no
//                              imperative DOM writes needed.
// - tsAnswer(id, idx, ans)  -> look up step.yes/step.no: a number dispatches
//                              SET_TROUBLESHOOT_STEP with that index; a
//                              string is a terminal recommendation, rendered
//                              directly (no dispatch) with a "Start Over"
//                              button that dispatches stepIndex: 0.
//
// Scenarios (js/scenarios.js):
// - toggleScenario(id)      -> local component useState (source's ephemeral
//                              body show/hide has no persisted-progress
//                              equivalent, matching task guidance).
// - completeScenario(id)    -> dispatch(TOGGLE_SCENARIO_DONE) with
//                              scenarioId: scenario.id AS-IS (already
//                              "sc_"-prefixed in content.ts, e.g. "sc_ping") +
//                              notify() toast, matching source's
//                              "Scenario completed! 🎉" / "Scenario reset"
//                              messages (source's own re-prefixing via
//                              'sc_' + sc.id was the bug being fixed here —
//                              sc.id must NOT be re-prefixed).
//
// Reference (js/reference.js):
// - toggleRef(id)           -> local component useState tracking which
//                              card ids are expanded (purely ephemeral, no
//                              reducer/progress — source has zero completion
//                              concept for Reference).

import { useState } from "react";

import type { NetSimState } from "@/lib/labs/simulators/netsim-pro/types";
import type { NetSimAction } from "@/lib/labs/simulators/netsim-pro/reducer";
import type { AdvancedScenario, AdvancedScenarioVendor, Scenario, ScenarioTier } from "@/lib/labs/simulators/netsim-pro/types";
import { ADVANCED_SCENARIOS, TROUBLESHOOT_FLOWS, SCENARIOS, REFERENCE_CARDS } from "@/lib/labs/simulators/netsim-pro/content";
import { Badge, Card, GhostButton, PrimaryButton, notify } from "./netsim-ui";
import styles from "./netsim-console.module.css";

// ============================================================================
// Troubleshoot
// ============================================================================

function levelBadgeTone(level: "Beginner" | "Intermediate" | "Advanced"): "green" | "blue" | "yellow" {
  return level === "Beginner" ? "green" : level === "Intermediate" ? "blue" : "yellow";
}

export function TroubleshootTab({ state, dispatch }: { state: NetSimState; dispatch: React.Dispatch<NetSimAction> }) {
  // Terminal recommendation text is derived state, not stored in the
  // reducer (SET_TROUBLESHOOT_STEP only tracks number|null step indices).
  // We track "last answer resolved to a string" locally, keyed by flow id,
  // since the reducer's stepIndex can't represent a terminal string result.
  const [recommendations, setRecommendations] = useState<Record<string, string | undefined>>({});

  const handleAnswer = (flowId: string, stepIdx: number, answer: "yes" | "no") => {
    const flow = TROUBLESHOOT_FLOWS.find((f) => f.id === flowId);
    if (!flow) return;
    const step = flow.steps[stepIdx];
    if (!step) return;
    const result = answer === "yes" ? step.yes : step.no;

    if (typeof result === "number") {
      setRecommendations((prev) => ({ ...prev, [flowId]: undefined }));
      dispatch({ type: "SET_TROUBLESHOOT_STEP", flowId, stepIndex: result });
    } else {
      setRecommendations((prev) => ({ ...prev, [flowId]: result }));
    }
  };

  const handleRestart = (flowId: string) => {
    setRecommendations((prev) => ({ ...prev, [flowId]: undefined }));
    dispatch({ type: "SET_TROUBLESHOOT_STEP", flowId, stepIndex: 0 });
  };

  return (
    <div>
      <h2 className={styles.sectionTitle}>🔧 Troubleshooting Flowcharts</h2>
      <p className={styles.sectionSubtitle}>Interactive step-by-step guides to diagnose common network issues</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {TROUBLESHOOT_FLOWS.map((flow) => {
          const currentStepIndex = state.troubleshootSteps[flow.id];
          const isOpen = currentStepIndex !== null && currentStepIndex !== undefined;
          const recommendation = recommendations[flow.id];

          return (
            <Card key={flow.id} className={undefined}>
              <div
                className={styles.accordionHeader}
                onClick={() =>
                  isOpen
                    ? dispatch({ type: "SET_TROUBLESHOOT_STEP", flowId: flow.id, stepIndex: null })
                    : dispatch({ type: "SET_TROUBLESHOOT_STEP", flowId: flow.id, stepIndex: 0 })
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      background: "var(--glass-bg)",
                    }}
                  >
                    {flow.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{flow.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {flow.steps.length} steps &middot; {flow.level}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge tone={levelBadgeTone(flow.level)}>{flow.level}</Badge>
                  <span className={`${styles.accordionCaret} ${isOpen ? styles.accordionCaretOpen : ""}`}>
                    &#9656;
                  </span>
                </div>
              </div>

              {isOpen ? (
                <div className={styles.accordionBody}>
                  {recommendation ? (
                    <Card variant="glass" className={undefined}>
                      <div style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 14, marginLeft: -6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>
                          💡 Recommendation
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{recommendation}</div>
                        <div style={{ marginTop: 12 }}>
                          <GhostButton small onClick={() => handleRestart(flow.id)}>
                            🔄 Start Over
                          </GhostButton>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    (() => {
                      const stepIdx = currentStepIndex ?? 0;
                      const step = flow.steps[stepIdx];
                      if (!step) return null;
                      return (
                        <Card variant="inset" className={undefined}>
                          <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, marginBottom: 8 }}>
                            Step {stepIdx + 1} of {flow.steps.length}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{step.q}</div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <PrimaryButton small onClick={() => handleAnswer(flow.id, stepIdx, "yes")}>
                              ✅ Yes
                            </PrimaryButton>
                            <GhostButton small onClick={() => handleAnswer(flow.id, stepIdx, "no")}>
                              ❌ No
                            </GhostButton>
                          </div>
                        </Card>
                      );
                    })()
                  )}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Scenarios
// ============================================================================

const TIER_DEFS: { tier: ScenarioTier; icon: string; label: string; badgeTone: "green" | "blue" | "yellow" }[] = [
  { tier: "beginner", icon: "\u{1F7E2}", label: "Beginner", badgeTone: "green" },
  { tier: "intermediate", icon: "\u{1F535}", label: "Intermediate", badgeTone: "blue" },
  { tier: "advanced", icon: "\u{1F7E1}", label: "Advanced", badgeTone: "yellow" },
];

function ScenarioCard({
  scenario,
  done,
  expanded,
  onToggle,
  onComplete,
}: {
  scenario: Scenario;
  done: boolean;
  expanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
}) {
  return (
    <div style={done ? { borderLeft: "3px solid #10b981", borderRadius: 16 } : undefined}>
      <Card clickable onClick={onToggle} className={undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{scenario.title}</div>
          <Badge tone={done ? "green" : "purple"}>{done ? "✅ Done" : `${scenario.points} pts`}</Badge>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>{scenario.desc}</div>

        {expanded ? (
          <div
            style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>Tasks:</div>
            {scenario.tasks.map((task, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 0",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    background: "var(--glass-bg)",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {task}
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <PrimaryButton small onClick={onComplete}>
                {done ? "↩️ Reset" : "✅ Mark Complete"}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function ScenariosTab({ state, dispatch }: { state: NetSimState; dispatch: React.Dispatch<NetSimAction> }) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleComplete = (scenario: Scenario) => {
    const current = state.progress.scenarios[scenario.id] ?? false;
    // scenario.id is used AS-IS (already "sc_"-prefixed, e.g. "sc_ping") —
    // do NOT re-prefix with another "sc_" here.
    dispatch({ type: "TOGGLE_SCENARIO_DONE", scenarioId: scenario.id });
    notify(current ? "Scenario reset" : "Scenario completed! \u{1F389}", current ? "info" : "success");
  };

  return (
    <div>
      <h2 className={styles.sectionTitle}>{"\u{1F3AF}"} Network Scenarios</h2>
      <p className={styles.sectionSubtitle}>
        Real-world challenges to test your skills &mdash; complete tasks to earn points
      </p>

      {TIER_DEFS.map((tierDef) => {
        const scenarios = SCENARIOS.filter((s) => s.tier === tierDef.tier);
        return (
          <div key={tierDef.tier} style={{ marginBottom: 28 }}>
            <Card variant="holo" className={undefined}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                  {tierDef.icon} {tierDef.label} Scenarios
                </h3>
                <Badge tone={tierDef.badgeTone}>{scenarios.length} scenarios</Badge>
              </div>
            </Card>
            <div className={styles.grid2} style={{ marginTop: 16 }}>
              {scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  done={state.progress.scenarios[scenario.id] === true}
                  expanded={expandedIds[scenario.id] ?? false}
                  onToggle={() => toggleExpanded(scenario.id)}
                  onComplete={() => handleComplete(scenario)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Reference
// ============================================================================

const ADVANCED_SCENARIO_VENDOR_ORDER: AdvancedScenarioVendor[] = ["Cisco", "FortiGate", "Palo Alto", "Juniper"];

function AdvancedScenarioRow({ scenario }: { scenario: AdvancedScenario }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        margin: "8px 0",
        border: "1px solid var(--glass-border)",
        borderRadius: 6,
        padding: 10,
        background: "var(--card-bg, rgba(255,255,255,0.02))",
      }}
    >
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
      >
        <Badge tone="purple">{scenario.category}</Badge>
        <span>{scenario.name}</span>
        <span style={{ marginLeft: "auto" }}>{open ? "▾" : "▸"}</span>
      </div>
      {open ? (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <p style={{ color: "var(--text-secondary)" }}>{scenario.description}</p>
          <h4 style={{ marginTop: 10, marginBottom: 4 }}>Use case</h4>
          <p style={{ color: "var(--text-secondary)" }}>{scenario.useCase}</p>
          <h4 style={{ marginTop: 10, marginBottom: 4 }}>Configuration</h4>
          <pre
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              padding: 10,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "Consolas, monospace",
              overflowX: "auto",
              lineHeight: 1.5,
              whiteSpace: "pre",
            }}
          >
            {scenario.config}
          </pre>
          <h4 style={{ marginTop: 10, marginBottom: 4 }}>Verification</h4>
          <pre
            style={{
              background: "#0e0e0e",
              color: "#22c55e",
              padding: 10,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "Consolas, monospace",
              lineHeight: 1.5,
              whiteSpace: "pre",
            }}
          >
            {scenario.verify}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function AdvancedScenariosSection() {
  const byVendor = ADVANCED_SCENARIO_VENDOR_ORDER.map((vendor) => ({
    vendor,
    items: ADVANCED_SCENARIOS.filter((s) => s.vendor === vendor),
  })).filter((g) => g.items.length > 0);

  return (
    <Card className={undefined}>
      <div style={{ padding: "4px 0" }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{"\u{1F3D7}️"}</span>
          Enterprise Advanced Scenarios
        </div>
        <p className={styles.sectionSubtitle} style={{ marginTop: 4 }}>
          Vendor deep-dives with real config + verify commands.
        </p>
        {byVendor.map((group) => (
          <div key={group.vendor} style={{ marginTop: 20 }}>
            <h3
              style={{
                marginBottom: 6,
                paddingBottom: 6,
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              {group.vendor} ({group.items.length})
            </h3>
            {group.items.map((scenario) => (
              <AdvancedScenarioRow key={scenario.id} scenario={scenario} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ReferenceTab({ state }: { state: NetSimState }) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <h2 className={styles.sectionTitle}>{"\u{1F4D6}"} Command Reference</h2>
      <p className={styles.sectionSubtitle}>Quick-reference cheat sheets for all supported vendors</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AdvancedScenariosSection />
        {REFERENCE_CARDS.map((ref) => {
          const expanded = expandedIds[ref.id] ?? false;
          return (
            <Card key={ref.id} className={undefined}>
              <div className={styles.accordionHeader} onClick={() => toggleExpanded(ref.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 24 }}>{ref.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{ref.title}</div>
                </div>
                <span className={`${styles.accordionCaret} ${expanded ? styles.accordionCaretOpen : ""}`}>
                  &#9656;
                </span>
              </div>

              {expanded ? (
                <div className={styles.accordionBody}>
                  {ref.categories.map((cat) => (
                    <div key={cat.cat} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>
                        {cat.cat}
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <tbody>
                            {cat.cmds.map((c) => (
                              <tr key={c.cmd}>
                                <td
                                  style={{
                                    padding: "6px 8px",
                                    borderBottom: "1px solid var(--glass-border)",
                                    fontFamily: "monospace",
                                    color: "#10b981",
                                    width: "45%",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {c.cmd}
                                </td>
                                <td
                                  style={{
                                    padding: "6px 8px",
                                    borderBottom: "1px solid var(--glass-border)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {c.desc}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
