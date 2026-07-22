"use client";

// Microsoft Secure Score — ported from itbd-lab/simulators/defender/js/defender-secure-score.js.
// Ring/donut hero (SVG stroke-dasharray, matches source's r=72/circumference math),
// 90-day trend (rendered as bars, matching the source's `.df-trend-bars` div-bar
// approach — real data from state.secureScore.history, no chart library needed),
// comparison stat row, per-category progress bars (achieved-impact/total-impact %,
// computed live from state.secureScore.actions exactly like source's categoryBars()),
// and a filterable actions list wired to the reducer's genuine point-sum recalc
// engine via UPDATE_SECURE_SCORE_ACTION.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderSecureScoreAction, DefenderState } from "@/lib/labs/simulators/defender/types";
import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import { DataTable, NativeSelect, StatusPill, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

const CATEGORIES: DefenderSecureScoreAction["category"][] = ["Identity", "Devices", "Apps", "Data", "Microsoft Defender for Cloud"];
const STATUSES: DefenderSecureScoreAction["status"][] = ["Not achieved", "Achieved", "Risk accepted"];

type CategoryFilter = "all" | DefenderSecureScoreAction["category"];
type StatusFilter = "all" | DefenderSecureScoreAction["status"];

// Ring geometry — mirrors source hero(): r=72, dasharray = filled-arc + full circumference.
const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function statusTone(status: DefenderSecureScoreAction["status"]): "ok" | "warn" | "muted" {
  if (status === "Achieved") return "ok";
  if (status === "Risk accepted") return "muted";
  return "warn";
}

// Sort order matches source's actionsList(): Not achieved first, then Risk
// accepted, then Achieved; ties broken by impact descending.
const STATUS_SORT_WEIGHT: Record<DefenderSecureScoreAction["status"], number> = {
  "Not achieved": 0,
  "Risk accepted": 1,
  Achieved: 2,
};

export function SecureScorePage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const ss = state.secureScore;

  const achievedCount = ss.actions.filter((a) => a.status === "Achieved").length;
  const notAchievedCount = ss.actions.filter((a) => a.status === "Not achieved").length;
  const riskAcceptedCount = ss.actions.filter((a) => a.status === "Risk accepted").length;

  const filledArc = (ss.percentage / 100) * RING_CIRCUMFERENCE;

  const firstHistory = ss.history[0];
  const lastHistory = ss.history[ss.history.length - 1];

  // Per-category progress: real derived math over state.secureScore.actions,
  // matching source's categoryBars() (sum impact, sum achieved impact, round %).
  const categoryStats = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const actions = ss.actions.filter((a) => a.category === cat);
      let achieved = 0;
      let total = 0;
      actions.forEach((a) => {
        total += a.impact;
        if (a.status === "Achieved") achieved += a.impact;
      });
      const pct = total === 0 ? 0 : Math.round((achieved / total) * 100);
      return { category: cat, achieved, total, pct };
    });
  }, [ss.actions]);

  const filteredActions = useMemo(() => {
    const filtered = ss.actions.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const w = STATUS_SORT_WEIGHT[a.status] - STATUS_SORT_WEIGHT[b.status];
      if (w !== 0) return w;
      return b.impact - a.impact;
    });
  }, [ss.actions, categoryFilter, statusFilter]);

  function handleStatusChange(action: DefenderSecureScoreAction, status: DefenderSecureScoreAction["status"]) {
    dispatch({ type: "UPDATE_SECURE_SCORE_ACTION", id: action.id, patch: { status } });
    toast.success(`"${action.title}" set to ${status}`);
  }

  const columns: DataTableColumn<DefenderSecureScoreAction>[] = [
    { key: "title", header: "Action", render: (a) => <span className={styles.rowLink}>{a.title}</span> },
    { key: "category", header: "Category", render: (a) => a.category },
    { key: "impact", header: "Points", render: (a) => <span style={{ color: "#107c10", fontWeight: 600 }}>+{a.impact.toFixed(1)}</span> },
    { key: "userImpact", header: "User impact", render: (a) => a.userImpact },
    { key: "implementation", header: "Implementation", render: (a) => a.implementation },
    { key: "status", header: "Status", render: (a) => <StatusPill tone={statusTone(a.status)}>{a.status}</StatusPill> },
    {
      key: "action",
      header: "Set status",
      render: (a) => (
        <NativeSelect
          value={a.status}
          onChange={(value) => handleStatusChange(a, value as DefenderSecureScoreAction["status"])}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a> <span>/</span> Microsoft Secure Score
      </div>
      <div className={styles.pageH1}>Microsoft Secure Score</div>
      <div className={styles.pageSub}>Improve your security posture by completing the recommended actions below.</div>

      {/* ===== Hero: ring + summary stats ===== */}
      <div className={styles.scoreHero}>
        <div className={styles.scoreRing}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={RING_RADIUS} stroke="#edebe9" strokeWidth="14" fill="none" />
            <circle
              cx="80"
              cy="80"
              r={RING_RADIUS}
              stroke="#107c10"
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${filledArc} ${RING_CIRCUMFERENCE}`}
            />
          </svg>
          <div className={styles.scoreRingText}>
            <div className={styles.scoreRingPct}>{ss.percentage}%</div>
            <div className={styles.scoreRingSub}>
              {ss.currentScore} of {ss.maxScore} pts
            </div>
          </div>
        </div>
        <div className={styles.scoreMeta}>
          <div className={styles.scoreMetaH}>Your secure score</div>
          <div className={styles.scoreMetaSub}>
            You scored {ss.currentScore} out of {ss.maxScore} possible points. Improvement actions are ranked below to help you
            increase your score.
          </div>
          <div className={styles.scoreMetaStats}>
            <div>
              <div className={styles.scoreMetaStatV}>{achievedCount}</div>
              <div className={styles.scoreMetaStatL}>Achieved actions</div>
            </div>
            <div>
              <div className={styles.scoreMetaStatV}>{notAchievedCount}</div>
              <div className={styles.scoreMetaStatL}>Not achieved</div>
            </div>
            <div>
              <div className={styles.scoreMetaStatV}>{riskAcceptedCount}</div>
              <div className={styles.scoreMetaStatL}>Risk accepted</div>
            </div>
            <div>
              <div className={styles.scoreMetaStatV}>{ss.actions.length}</div>
              <div className={styles.scoreMetaStatL}>Total actions</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 90-day trend ===== */}
      <div className={styles.trendChart}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div className={styles.cardTitle} style={{ margin: 0 }}>
            Secure score trend - last 90 days
          </div>
          <div style={{ fontSize: 12, color: "#605e5c" }}>
            {firstHistory?.date} to {lastHistory?.date}
          </div>
        </div>
        <div className={styles.trendBars}>
          {ss.history.map((h) => (
            <div
              key={h.date}
              className={styles.trendBar}
              style={{ height: `${Math.max(2, (h.score / 100) * 100)}%` }}
              title={`${h.date}: ${h.score}%`}
            />
          ))}
        </div>
        <div className={styles.trendAxis}>
          <span>{firstHistory?.date}</span>
          <span>{lastHistory?.date}</span>
        </div>
      </div>

      {/* ===== Category progress bars ===== */}
      <div className={styles.h2}>By category</div>
      {categoryStats.map((c) => (
        <div key={c.category} className={styles.catBar}>
          <div className={styles.catBarLabel}>
            <span>{c.category}</span>
            <span>
              {Math.round(c.achieved)} / {Math.round(c.total)} pts &middot; {c.pct}%
            </span>
          </div>
          <div className={styles.catBarBg}>
            <div className={styles.catBarFill} style={{ width: `${c.pct}%` }} />
          </div>
        </div>
      ))}

      {/* ===== Comparison ===== */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Comparison</div>
        <div className={styles.row}>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c" }}>Your score</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{ss.percentage}%</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c" }}>Similar organizations</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{ss.comparison.similarOrgs}%</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c" }}>Industry average</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>54%</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#605e5c" }}>All Microsoft 365 tenants</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>49%</div>
          </div>
        </div>
      </div>

      {/* ===== Filterable actions list ===== */}
      <div className={styles.h2}>Recommended actions ({filteredActions.length})</div>
      <div className={styles.filterRow}>
        <button type="button" className={`${styles.chip} ${categoryFilter === "all" ? styles.chipActive : ""}`} onClick={() => setCategoryFilter("all")}>
          Category: any
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} type="button" className={`${styles.chip} ${categoryFilter === cat ? styles.chipActive : ""}`} onClick={() => setCategoryFilter(cat)}>
            {cat}
          </button>
        ))}
        <button type="button" className={`${styles.chip} ${statusFilter === "all" ? styles.chipActive : ""}`} onClick={() => setStatusFilter("all")}>
          Status: any
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ""}`} onClick={() => setStatusFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filteredActions} getRowKey={(a) => a.id} emptyMessage="No actions match the current filters." />
    </div>
  );
}
