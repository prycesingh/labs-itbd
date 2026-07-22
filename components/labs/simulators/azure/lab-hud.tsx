"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { AzureSimState } from "@/lib/labs/simulators/azure/azureState";
import { formatLabTime, type LabScenario } from "@/lib/labs/simulators/azure/labScenarios";
import styles from "./azure-portal.module.css";

export function LabHud({
  scenario,
  state,
  startTime,
  hintsUsed,
  onHint,
  onCheck,
  onFinish,
  onExit,
}: {
  scenario: LabScenario;
  state: AzureSimState;
  startTime: number;
  hintsUsed: number;
  onHint: () => void;
  onCheck: () => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTime) / 1000));
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const results = scenario.objectives.map((o) => ({ ...o, done: o.check(state) }));
  const completed = results.filter((o) => o.done).length;
  const total = results.length;
  const allDone = completed === total;
  const hintsLeft = scenario.hints.length - hintsUsed;

  return (
    <motion.div
      layout
      className={`${styles.labHud} ${minimized ? styles.labHudMinimized : ""}`}
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {minimized ? (
          <motion.div key="minimized" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <button type="button" className={styles.labHudMinimizedBtn} onClick={() => setMinimized(false)}>
              <span>▲</span>
              <b>{scenario.title}</b>
              <span className={styles.labHudMinimizedProgress}>
                {completed}/{total} &middot; {formatLabTime(elapsed)}
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className={styles.labHudHead}>
              <div>
                <b>{scenario.title}</b>
                <div className={styles.labHudSub}>
                  {scenario.difficulty} &middot; {formatLabTime(elapsed)}
                </div>
              </div>
              <div className={styles.labHudHeadActions}>
                <button type="button" className={styles.labHudMinimize} onClick={() => setMinimized(true)} aria-label="Minimize">
                  ▼
                </button>
                <button
                  type="button"
                  className={styles.labHudExit}
                  onClick={() => {
                    if (confirm("Exit this lab? Your timer and hint count will be lost — you can restart it later from the catalog.")) onExit();
                  }}
                  aria-label="Exit lab"
                >
                  ×
                </button>
              </div>
            </div>
            <div className={styles.labHudBody}>
              <div className={styles.labHudProgress}>
                <motion.div className="bar" animate={{ width: `${total === 0 ? 0 : (completed * 100) / total}%` }} transition={{ duration: 0.3, ease: "easeOut" }} />
              </div>
              <div className={styles.labHudProgressText}>
                {completed} / {total} objectives complete
              </div>
              <ul className={styles.labHudObjs}>
                {results.map((o) => (
                  <li key={o.id} className={o.done ? "done" : ""}>
                    <span className={styles.labObjMarker}>{o.done ? "✓" : "○"}</span> {o.description}
                  </li>
                ))}
              </ul>
              <div className={styles.labHudActions}>
                <button type="button" className={styles.btnOutline} onClick={onHint} disabled={hintsLeft <= 0}>
                  Hint ({hintsLeft} left)
                </button>
                <button type="button" className={styles.btn} onClick={onCheck}>
                  Check
                </button>
              </div>
              <AnimatePresence>
                {allDone ? (
                  <motion.div
                    className={styles.labHudDone}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <b>All objectives complete!</b>{" "}
                    <button type="button" className={styles.btn} onClick={onFinish}>
                      Finish
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
