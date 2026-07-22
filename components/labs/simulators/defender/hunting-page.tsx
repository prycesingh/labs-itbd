"use client";

// Advanced Hunting — ported from itbd-lab/simulators/defender/js/defender-hunting.js
// renderQueries()/renderDetections()/renderSchema()/renderScheduled(). Source
// faked "Run query" results with Math.random() row counts; this port uses the
// REAL query engine (lib/labs/simulators/defender/hunting-engine.ts, invoked
// via the RUN_HUNTING_QUERY reducer action) so rowCount/columns/rows always
// reflect a genuine filtered slice of DefenderState — never a random number.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import type { DefenderHuntingQuery, DefenderHuntRun, DefenderState } from "@/lib/labs/simulators/defender/types";
import { DataTable, EmptyState, SeverityBadge, SubTabBar, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

type Section = "queries" | "detections" | "schema" | "scheduled";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "queries", label: "Pre-built queries" },
  { key: "detections", label: "Custom detections" },
  { key: "schema", label: "Schema reference" },
  { key: "scheduled", label: "Scheduled hunts" },
];

export function HuntingPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [section, setSection] = useState<Section>("queries");
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a> / <a>Hunting</a>
      </div>
      <div className={styles.pageH1}>Advanced Hunting</div>
      <div className={styles.pageSub}>
        Query the unified XDR schema across endpoint, email, identity, and cloud signals using Kusto Query Language
        (KQL).
      </div>

      <SubTabBar tabs={SECTIONS} active={section} onChange={(key) => setSection(key as Section)} />

      <div style={{ marginTop: 14 }}>
        {section === "queries" ? (
          <QueriesTab state={state} dispatch={dispatch} selectedQueryId={selectedQueryId} onSelectQuery={setSelectedQueryId} />
        ) : null}
        {section === "detections" ? <DetectionsTab state={state} /> : null}
        {section === "schema" ? <SchemaTab state={state} /> : null}
        {section === "scheduled" ? <ScheduledTab state={state} /> : null}
      </div>
    </div>
  );
}

// ===== Queries tab =====

function QueriesTab({
  state,
  dispatch,
  selectedQueryId,
  onSelectQuery,
}: {
  state: DefenderState;
  dispatch: React.Dispatch<DefenderAction>;
  selectedQueryId: string | null;
  onSelectQuery: (id: string) => void;
}) {
  const query = state.huntingQueries.find((q) => q.id === selectedQueryId) ?? null;

  // Group queries by tactic, matching source's renderQueries() grouping.
  const byTactic = new Map<string, DefenderHuntingQuery[]>();
  for (const q of state.huntingQueries) {
    const list = byTactic.get(q.tactic) ?? [];
    list.push(q);
    byTactic.set(q.tactic, list);
  }

  // Latest run for the selected query — huntRuns is newest-first (reducer
  // unshifts each new run), so the first match is the latest.
  const latestRun: DefenderHuntRun | null = query ? state.huntRuns.find((r) => r.queryId === query.id) ?? null : null;

  // Toast the real row count once the reducer's new run lands in state (the
  // reducer — not this component — calls runHuntingQuery; we only observe
  // the resulting `huntRuns` head to report its genuine rowCount).
  const lastToastedRunRef = useRef<DefenderHuntRun | null>(null);
  useEffect(() => {
    const head = state.huntRuns[0];
    if (head && head !== lastToastedRunRef.current) {
      lastToastedRunRef.current = head;
      const ranQuery = state.huntingQueries.find((q) => q.id === head.queryId);
      toast.success(`Query completed — ${head.rowCount} result${head.rowCount === 1 ? "" : "s"}`, {
        description: ranQuery?.name,
      });
    }
  }, [state.huntRuns, state.huntingQueries]);

  function handleRun() {
    if (!query) return;
    dispatch({ type: "RUN_HUNTING_QUERY", query });
  }

  const resultColumns: DataTableColumn<Record<string, string>>[] = latestRun
    ? latestRun.columns.map((col) => ({ key: col, header: col, render: (row) => row[col] ?? "" }))
    : [];

  return (
    <div className={styles.bladeShell}>
      <div className={styles.bladeNav}>
        <div className={styles.bladeNavSection}>Query library ({state.huntingQueries.length})</div>
        {Array.from(byTactic.entries()).map(([tactic, queries]) => (
          <div key={tactic}>
            <div className={styles.bladeNavSection}>{tactic}</div>
            {queries.map((q) => (
              <div
                key={q.id}
                className={`${styles.bladeNavItem} ${selectedQueryId === q.id ? styles.bladeNavItemActive : ""}`}
                onClick={() => onSelectQuery(q.id)}
              >
                <div>{q.name}</div>
                <div style={{ fontSize: 11, color: "#605e5c" }}>{q.technique}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.bladeContent}>
        {!query ? (
          <EmptyState message="Select a query from the left to view its KQL." />
        ) : (
          <>
            <div className={styles.cardTitle}>{query.name}</div>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 10 }}>
              <b>{query.tactic}</b> &middot; {query.technique}
            </div>
            <textarea className={styles.textarea} readOnly rows={10} value={query.kql} style={{ fontFamily: "Consolas, 'Cascadia Code', monospace", fontSize: 12 }} />
            <div style={{ marginTop: 12 }}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleRun}>
                &#9658; Run query
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              {latestRun ? (
                <>
                  <div style={{ fontSize: 13, color: "#107c10", fontWeight: 600, marginBottom: 8 }}>
                    Query completed &mdash; {latestRun.rowCount} result{latestRun.rowCount === 1 ? "" : "s"} &middot;{" "}
                    {new Date(latestRun.ranAt).toLocaleString()}
                  </div>
                  <DataTable
                    columns={resultColumns}
                    rows={latestRun.rows}
                    getRowKey={(row) => JSON.stringify(row)}
                    emptyMessage="Query ran successfully with 0 matching rows."
                  />
                </>
              ) : (
                <div className={styles.tip}>Run the query to see live results pulled from the current tenant state.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== Detections tab =====

function DetectionsTab({ state }: { state: DefenderState }) {
  return (
    <div>
      <div className={styles.cardTitle}>Custom detection rules ({state.detectionSummaryCards.length})</div>
      <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 14 }}>
        Saved KQL queries that run on schedule and auto-create alerts. Group results by entities, suppress
        duplicates, trigger automated response.
      </div>
      <div className={styles.tileGrid}>
        {state.detectionSummaryCards.map((d) => (
          <div key={d.name} className={styles.card}>
            <div className={styles.cardTitle}>{d.name}</div>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 8 }}>{d.threshold}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "#605e5c" }}>
              <span>
                <b>Frequency:</b> {d.frequency}
              </span>
              <span>
                <b>Period:</b> {d.period}
              </span>
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <SeverityBadge severity={d.severity} />
              <span className={styles.mitreChip}>{d.mitre}</span>
              <span className={styles.pill}>{d.state}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Schema tab =====

function SchemaTab({ state }: { state: DefenderState }) {
  const entries = Object.entries(state.huntingSchema);
  const columns: DataTableColumn<[string, string]>[] = [
    { key: "table", header: "Table", width: "220px", render: ([table]) => <code style={{ fontWeight: 700, color: "#115ea3" }}>{table}</code> },
    { key: "description", header: "Description", render: ([, description]) => <span style={{ fontSize: 12 }}>{description}</span> },
  ];

  return (
    <div>
      <div className={styles.cardTitle}>Advanced Hunting schema (unified XDR)</div>
      <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 14 }}>
        All telemetry tables. Use <code>getschema</code> in a query to see all columns and types, e.g.{" "}
        <code>DeviceEvents | getschema</code>.
      </div>
      <DataTable columns={columns} rows={entries} getRowKey={([table]) => table} emptyMessage="No schema tables." />
    </div>
  );
}

// ===== Scheduled tab =====

function ScheduledTab({ state }: { state: DefenderState }) {
  type Row = DefenderState["scheduledHunts"][number];
  const columns: DataTableColumn<Row>[] = [
    { key: "name", header: "Name", render: (h) => <b>{h.name}</b> },
    { key: "schedule", header: "Schedule", render: (h) => <code>{h.schedule}</code> },
    { key: "lastRun", header: "Last run", render: (h) => h.lastRun },
    { key: "lastResult", header: "Last result", render: (h) => h.lastResult },
    { key: "owner", header: "Owner", render: (h) => h.owner },
  ];

  return (
    <div>
      <div className={styles.cardTitle}>Scheduled hunts</div>
      <div style={{ fontSize: 13, color: "#605e5c", marginBottom: 14 }}>
        Saved queries run on a cron schedule. Results emailed or stored.
      </div>
      <DataTable columns={columns} rows={state.scheduledHunts} getRowKey={(h) => h.name} emptyMessage="No scheduled hunts." />
    </div>
  );
}
