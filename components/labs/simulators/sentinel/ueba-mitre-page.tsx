"use client";

// UEBA entity risk + MITRE ATT&CK coverage heatmap + Notebooks gallery —
// ported from itbd-lab/simulators/sentinel/js/sentinel-ueba-mitre.js
// (uebaView() / entityDetailView() / mitreView() / notebooksView()).
//
// Two deliberate improvements over source, both called out per the port spec:
//   1. Entity risk is REAL persisted state (`state.entityRisks`), not the
//      disconnected `ENTITIES` array source hardcoded outside SentinelData.
//      "Mark as compromised" / "Mark as safe" in source's entity-detail view
//      rendered as plain <button> elements with NO onclick handler at all —
//      dead clicks. Here both dispatch UPDATE_ENTITY_RISK for a genuine state
//      mutation (compromised -> riskScore 100 + an appended insight noting the
//      manual flag; safe -> riskScore 5).
//   2. MITRE coverage (`ourCoverage` / `alertsLast30d`) is REAL, computed from
//      `state.rules` via computeMitreCoverage() in reducer.ts — not source's
//      hand-picked static MITRE_TACTICS numbers. Only the per-tactic
//      `techniques` reference count (real MITRE ATT&CK Enterprise taxonomy)
//      is static, matching MITRE_TACTIC_TECHNIQUE_COUNTS in seedData.ts.
//
// Notebooks are pure reference (no execution backend exists, matching
// source's Azure ML-compute-only notebooks gallery) — "Open" actions are
// toast-only.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SentinelEntityRisk, SentinelMitreTactic, SentinelNotebook, SentinelState } from "@/lib/labs/simulators/sentinel/types";
import { type SentinelAction, computeMitreCoverage } from "@/lib/labs/simulators/sentinel/reducer";
import { DataTable, type DataTableColumn, EmptyState, Flyout, StatRow } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

// ===================== Shared bits =====================

function ago(iso: string): string {
  if (iso === "just now") return iso;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function riskTone(score: number): "err" | "warn" | "ok" {
  if (score >= 70) return "err";
  if (score >= 40) return "warn";
  return "ok";
}

function riskLevel(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

// Compact inline risk-score bar, reusing the .barRow* primitives (same visual
// language as the MITRE coverage bar below) rather than inventing a new class.
function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? "#a4262c" : score >= 40 ? "#b8860b" : "#107c10";
  return (
    <span className={styles.barRow} style={{ margin: 0 }}>
      <span className={styles.barRowBar} style={{ width: 90 }}>
        <span className={styles.barRowFill} style={{ width: `${score}%`, background: color }} />
      </span>
      <span className={styles.barRowVal} style={{ width: "auto", fontWeight: 600 }}>
        {score}
      </span>
    </span>
  );
}

// ===================== UEBA entity behavior =====================

function EntityDetailFlyout({ entity, dispatch, onClose }: { entity: SentinelEntityRisk; dispatch: React.Dispatch<SentinelAction>; onClose: () => void }) {
  // Genuinely wired — source's "Mark as compromised"/"Mark as safe" buttons
  // in entity-detail had no onclick handler at all (dead clicks). These
  // dispatch real UPDATE_ENTITY_RISK state mutations.
  function markCompromised() {
    dispatch({
      type: "UPDATE_ENTITY_RISK",
      id: entity.id,
      patch: {
        riskScore: 100,
        insights: [...entity.insights, "Manually flagged as compromised by SOC analyst"],
      },
    });
    toast.success(`${entity.name} marked as compromised`);
    onClose();
  }

  function markSafe() {
    dispatch({
      type: "UPDATE_ENTITY_RISK",
      id: entity.id,
      patch: {
        riskScore: 5,
        insights: [...entity.insights, "Manually reviewed and cleared by SOC analyst"],
      },
    });
    toast.success(`${entity.name} marked as safe`);
    onClose();
  }

  return (
    <Flyout
      title={entity.name}
      subtitle={`${entity.type} · Risk score ${entity.riskScore} / 100 · ${riskLevel(entity.riskScore)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={markSafe}>
            Mark as safe
          </button>
          <button type="button" className={styles.btn} onClick={markCompromised}>
            Mark as compromised
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #e1dfdd" }}>
        <div>
          <div style={{ color: "#605e5c" }}>Risk score</div>
          <RiskBar score={entity.riskScore} />
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Type</div>
          <strong>{entity.type}</strong>
        </div>
        <div>
          <div style={{ color: "#605e5c" }}>Last activity</div>
          <strong>{ago(entity.lastActivity)}</strong>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Baseline</div>
        <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.6 }}>{entity.baseline}</div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Behavioral anomalies / insights</div>
        {entity.insights.length === 0 ? (
          <div style={{ fontSize: 12, color: "#605e5c" }}>No insights recorded.</div>
        ) : (
          entity.insights.map((insight, i) => (
            <div key={i} style={{ fontSize: 12, color: "#424242", padding: "6px 0", borderTop: i > 0 ? "1px solid #f3f2f1" : undefined }}>
              {insight}
            </div>
          ))
        )}
      </div>
    </Flyout>
  );
}

export function UebaPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (state.entityRisks.find((e) => e.id === selectedId) ?? null) : null;

  const usersAtRisk = state.entityRisks.filter((e) => e.type === "User").length;
  const hostsAtRisk = state.entityRisks.filter((e) => e.type === "Host").length;
  const highRisk = state.entityRisks.filter((e) => e.riskScore >= 70).length;

  const columns: DataTableColumn<SentinelEntityRisk>[] = [
    {
      key: "name",
      header: "Entity",
      render: (e) => <span className={styles.rowLink}>{e.name}</span>,
    },
    { key: "type", header: "Type", render: (e) => <span className={styles.pill}>{e.type}</span> },
    { key: "riskScore", header: "Risk score", render: (e) => <RiskBar score={e.riskScore} /> },
    {
      key: "level",
      header: "Level",
      render: (e) => (
        <span className={`${styles.pill} ${riskTone(e.riskScore) === "err" ? styles.pillErr : riskTone(e.riskScore) === "warn" ? styles.pillWarn : styles.pillSuccess}`}>
          {riskLevel(e.riskScore)}
        </span>
      ),
    },
    { key: "insights", header: "Insights", render: (e) => e.insights.length },
    { key: "lastActivity", header: "Last activity", render: (e) => ago(e.lastActivity) },
  ];

  return (
    <div>
      <StatRow
        stats={[
          { label: "Risky entities (24h)", value: state.entityRisks.length },
          { label: "High risk (70+)", value: highRisk },
          { label: "Users at risk", value: usersAtRisk },
          { label: "Hosts at risk", value: hostsAtRisk },
        ]}
      />

      <div className={styles.h2}>Top risky entities</div>
      {state.entityRisks.length === 0 ? (
        <EmptyState message="No risky entities detected." />
      ) : (
        <DataTable columns={columns} rows={state.entityRisks} getRowKey={(e) => e.id} onRowClick={(e) => setSelectedId(e.id)} />
      )}

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>UEBA scoring inputs</div>
        <div style={{ fontSize: 13, color: "#424242" }}>
          Sign-in anomalies (rare ASN, atypical travel, device, app, OS), mailbox activity (rule creation, forward, bulk delete), file activity (mass download,
          rename, encrypt), process anomalies (LSASS, encoded PS), threat-intel matches. Score normalized to 0-100; 70+ triggers automated investigation.
        </div>
      </div>

      {selected ? <EntityDetailFlyout entity={selected} dispatch={dispatch} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

// ===================== MITRE ATT&CK coverage =====================

// Merges the static per-tactic technique-count reference (state.mitreTactics,
// seeded from MITRE_TACTIC_TECHNIQUE_COUNTS) with the REAL computed
// ourCoverage/alertsLast30d from computeMitreCoverage(state.rules) — never
// the static seeded zeros. Matched by tactic name.
function mergeTacticCoverage(staticTactics: SentinelMitreTactic[], computed: SentinelMitreTactic[]): SentinelMitreTactic[] {
  const computedByTactic = new Map(computed.map((c) => [c.tactic, c]));
  return staticTactics.map((t) => {
    const live = computedByTactic.get(t.tactic);
    return {
      tactic: t.tactic,
      techniques: t.techniques,
      ourCoverage: live?.ourCoverage ?? 0,
      alertsLast30d: live?.alertsLast30d ?? 0,
    };
  });
}

function heatColor(pct: number): string {
  if (pct >= 75) return "#107c10";
  if (pct >= 50) return "#b8860b";
  if (pct >= 25) return "#d83b01";
  return "#a4262c";
}

export function MitrePage({ state }: { state: SentinelState }) {
  // Real, computed from live rules — not static seed data.
  const computed = useMemo(() => computeMitreCoverage(state.rules), [state.rules]);
  const tactics = useMemo(() => mergeTacticCoverage(state.mitreTactics, computed), [state.mitreTactics, computed]);

  const totalTechniques = tactics.reduce((s, t) => s + t.techniques, 0);
  const totalCoverage = tactics.reduce((s, t) => s + t.ourCoverage, 0);
  const totalAlerts = tactics.reduce((s, t) => s + t.alertsLast30d, 0);
  const coveragePct = totalTechniques > 0 ? Math.round((totalCoverage / totalTechniques) * 100) : 0;

  const columns: DataTableColumn<SentinelMitreTactic>[] = [
    { key: "tactic", header: "Tactic", render: (t) => <strong>{t.tactic}</strong> },
    { key: "techniques", header: "Techniques", render: (t) => t.techniques },
    { key: "covered", header: "Covered", render: (t) => t.ourCoverage },
    {
      key: "coverage",
      header: "Coverage %",
      render: (t) => {
        const pct = t.techniques > 0 ? Math.round((t.ourCoverage / t.techniques) * 100) : 0;
        return (
          <span className={styles.barRow} style={{ margin: 0 }}>
            <span className={styles.barRowBar} style={{ width: 90 }}>
              <span className={styles.barRowFill} style={{ width: `${pct}%`, background: heatColor(pct) }} />
            </span>
            <span className={styles.barRowVal} style={{ width: "auto", fontWeight: 600 }}>
              {pct}%
            </span>
          </span>
        );
      },
    },
    { key: "alerts", header: "Alerts (30d)", render: (t) => t.alertsLast30d },
  ];

  return (
    <div>
      <StatRow
        stats={[
          { label: "Tactics", value: tactics.length },
          { label: "Techniques (enterprise)", value: totalTechniques },
          { label: "Covered by Sentinel rules", value: totalCoverage },
          { label: "Coverage %", value: `${coveragePct}%` },
          { label: "Alerts (last 30d)", value: totalAlerts },
        ]}
      />

      <div className={styles.h2}>Coverage heatmap by tactic</div>
      <div className={styles.tileGrid}>
        {tactics.map((t) => {
          const pct = t.techniques > 0 ? Math.round((t.ourCoverage / t.techniques) * 100) : 0;
          return (
            <div key={t.tactic} className={styles.tile} style={{ background: heatColor(pct), cursor: "default" }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{t.tactic}</div>
              <div style={{ color: "#fff", fontSize: 12, marginTop: 4 }}>
                {t.ourCoverage} / {t.techniques} ({pct}%)
              </div>
              <div style={{ color: "#fff", fontSize: 11, marginTop: 2, opacity: 0.9 }}>{t.alertsLast30d} alerts (30d)</div>
            </div>
          );
        })}
      </div>

      <div className={styles.h2}>Tactic-by-tactic detail</div>
      <DataTable columns={columns} rows={tactics} getRowKey={(t) => t.tactic} />

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>Coverage strategy</div>
        <div style={{ fontSize: 13, color: "#424242" }}>
          Target 75%+ coverage on tactics frequent in your industry. Financial services prioritizes Initial Access, Credential Access, Exfiltration.
          Healthcare prioritizes Discovery + Impact (ransomware). Coverage above is computed live from enabled analytics rules mapped to each tactic.
        </div>
      </div>
    </div>
  );
}

// ===================== Notebooks gallery =====================

export function NotebooksPage({ state }: { state: SentinelState }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 12 }}>
        Pre-built Jupyter notebooks for investigation and hunting. Run on Sentinel-integrated Azure ML compute.
      </div>

      {state.notebooks.length === 0 ? (
        <EmptyState message="No notebooks available." />
      ) : (
        <div className={styles.tileGrid}>
          {state.notebooks.map((nb: SentinelNotebook) => (
            <div key={nb.id} className={styles.tile} style={{ cursor: "default" }}>
              <div className={styles.tileTitle}>{nb.name}</div>
              <div className={styles.tileSub}>{nb.provider}</div>
              <div style={{ fontSize: 12, color: "#424242", marginTop: 8, lineHeight: 1.5 }}>{nb.description}</div>
              <div className={styles.tileFoot} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Last run: {ago(nb.lastRun)}</span>
                <button
                  type="button"
                  className={styles.btnOutline}
                  style={{ padding: "3px 10px", fontSize: 11 }}
                  onClick={() => toast.info(`${nb.name} isn't wired to Azure ML compute in this simulator yet.`)}
                >
                  Open in Azure ML
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.cardTitle}>msticpy</div>
        <div style={{ fontSize: 13, color: "#424242" }}>
          msticpy (Microsoft Threat Intelligence Python) is the SDK powering all Sentinel notebooks. Install via <code>pip install msticpy[azure]</code>.
          Provides KQL provider, threat-intel lookup, entity extraction, GeoIP, anomaly detection — saves 80% boilerplate vs raw azure-monitor-query.
        </div>
      </div>
    </div>
  );
}
