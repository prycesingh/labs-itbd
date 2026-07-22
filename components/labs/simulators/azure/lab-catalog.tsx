"use client";

import { LAB_SCENARIOS, difficultyColor, formatLabTime, type LabDifficulty } from "@/lib/labs/simulators/azure/labScenarios";
import type { LabScores } from "@/lib/labs/simulators/azure/labScores";
import styles from "./azure-portal.module.css";

const GROUPS: LabDifficulty[] = ["Beginner", "Intermediate", "Advanced"];

export function LabCatalog({ scores, onStart }: { scores: LabScores; onStart: (id: string) => void }) {
  return (
    <div className={styles.root}>
      <div className={styles.listHeader}>
        <div>
          <h1>Hands-on Labs</h1>
          <p className={styles.sub}>Break/fix scenarios to practice real-world skills</p>
        </div>
      </div>
      <div className={styles.listBody}>
        <p style={{ color: "#605e5c", marginBottom: 16 }}>
          Each lab seeds your simulator with a real-world environment. Diagnose the issue, complete the objectives, and beat your best score.
        </p>
        {GROUPS.map((group) => {
          const scenarios = LAB_SCENARIOS.filter((s) => s.difficulty === group);
          return (
            <div key={group}>
              <h3 style={{ fontSize: 14, color: "#323130", margin: "20px 0 10px", paddingBottom: 6, borderBottom: `2px solid ${difficultyColor(group)}` }}>
                {group} <span style={{ fontWeight: 400, color: "#605e5c", fontSize: 12 }}>({scenarios.length} labs)</span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {scenarios.map((s) => {
                  const best = scores[s.id];
                  return (
                    <div
                      key={s.id}
                      style={{ border: "1px solid #edebe9", borderRadius: 2, padding: 14, cursor: "pointer", background: "#fff" }}
                      onClick={() => onStart(s.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ background: difficultyColor(s.difficulty), color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>
                          {s.difficulty}
                        </span>
                        <span style={{ fontSize: 12, color: "#605e5c" }}>{s.estimatedMin} min</span>
                      </div>
                      <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>{s.title}</h4>
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#605e5c" }}>{s.description}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {s.tags.map((t) => (
                          <span key={t} className={`${styles.badge} ${styles.badgeOutline}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                      {best ? (
                        <p style={{ marginTop: 8, fontSize: 12, color: "#107c10" }}>
                          <b>Best score:</b> {best.score} &middot; <b>Time:</b> {formatLabTime(best.timeSec)}
                        </p>
                      ) : (
                        <p style={{ marginTop: 8, fontSize: 12, color: "#605e5c" }}>Not attempted yet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
