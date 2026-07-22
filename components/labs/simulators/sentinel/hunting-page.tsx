"use client";

// Hunting — ported from itbd-lab/simulators/sentinel/js/sentinel-hunting.js
// (SentinelHunting IIFE: queries gallery/detail, bookmarks, live stream).
//
// Key upgrade over source: source's runQuery() just toasted the query's
// static seeded `results` number, and sampleResultsHtml() only had canned
// result tables for 8 of the 20 hunting queries (the rest fell through to a
// "Click Run query to see results" placeholder with nothing behind it). This
// port instead calls the real KQL micro-interpreter (kql-engine.ts) against a
// synthetic-but-real in-memory dataset built from the same seeded users/
// devices used across the rest of the simulator — so all 20 queries return
// genuine, non-random, actually-computed rows/columns/rowCount every time
// "Run query" is clicked, with zero Math.random()/fabricated counts.
//
// Live stream tab stays static reference content — source's 3 "running"
// streams have no real polling/ingestion pipeline behind them there either,
// and building one is out of scope for this simulator (no realistic "real"
// backing exists without live log ingestion), so it's kept as illustrative
// UI only, matching source's illustrative intent.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import { buildSyntheticTables, runKqlQuery } from "@/lib/labs/simulators/sentinel/kql-engine";
import type { SentinelKqlResult } from "@/lib/labs/simulators/sentinel/types";
import { DataTable, EmptyState, Field, Modal, StatRow, StatusPill, SubTabBar } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

type HuntingTab = "queries" | "bookmarks" | "livestream";

const HUNTING_TABS: { key: HuntingTab; label: string }[] = [
  { key: "queries", label: "Queries" },
  { key: "bookmarks", label: "Bookmarks" },
  { key: "livestream", label: "Live stream" },
];

// Static reference content — matches source's liveStreamHtml() illustrative
// 3-stream table (name/query/started/events/status). No real polling: this
// simulator has no live log-ingestion pipeline to genuinely back it.
const LIVE_STREAMS: { name: string; query: string; started: string; events: number; status: string }[] = [
  { name: "Live: anonymous IP sign-ins", query: 'SigninLogs | where IpAddress in (TIIPs)', started: "14 min ago", events: 0, status: "Running" },
  { name: "Live: PowerShell encoded", query: 'DeviceProcessEvents | where ProcessCommandLine has "-enc"', started: "1 hour ago", events: 3, status: "Running" },
  { name: "Live: high-risk sign-ins", query: 'SigninLogs | where RiskLevel == "high"', started: "2 hours ago", events: 2, status: "Running" },
];

export function HuntingPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [tab, setTab] = useState<HuntingTab>("queries");
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [result, setResult] = useState<SentinelKqlResult | null>(null);
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [bmName, setBmName] = useState("");
  const [bmTags, setBmTags] = useState("");
  const [bmNotes, setBmNotes] = useState("");

  // Built once per (users, devices) change and reused across every "Run
  // query" click — this is the real synthetic dataset the KQL engine
  // executes against, not canned per-query sample tables.
  const tables = useMemo(() => buildSyntheticTables(state.users, state.devices), [state.users, state.devices]);

  const selectedQuery = selectedQueryId ? state.huntingQueries.find((q) => q.id === selectedQueryId) ?? null : null;

  function openQuery(id: string) {
    setSelectedQueryId(id);
    setResult(null);
  }

  function backToGallery() {
    setSelectedQueryId(null);
    setResult(null);
  }

  function runQuery() {
    if (!selectedQuery) return;
    const res = runKqlQuery(selectedQuery.query, tables);
    setResult(res);
    dispatch({ type: "RECORD_QUERY_HISTORY", kql: selectedQuery.query, rowCount: res.rowCount });
    if (res.error && res.rowCount === 0 && res.scannedRows === 0) {
      toast.error(`Query failed - ${res.error}`);
    } else {
      toast.success(`Query executed - ${res.rowCount} results returned`);
    }
  }

  function openBookmarkModal() {
    if (!selectedQuery) return;
    setBmName(`Bookmark from ${selectedQuery.name}`);
    setBmTags("hunting");
    setBmNotes(`Captured from hunting query: ${selectedQuery.name}`);
    setBookmarkModalOpen(true);
  }

  function saveBookmark() {
    if (!selectedQuery) return;
    dispatch({
      type: "ADD_BOOKMARK",
      bookmark: {
        id: `bm-${crypto.randomUUID()}`,
        name: bmName.trim() || `Bookmark from ${selectedQuery.name}`,
        created: "just now",
        createdBy: "ankit",
        tags: bmTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: bmNotes,
      },
    });
    setBookmarkModalOpen(false);
    toast.success("Bookmark added");
  }

  return (
    <div>
      <SubTabBar
        tabs={HUNTING_TABS}
        active={tab}
        onChange={(key) => {
          setTab(key as HuntingTab);
          setSelectedQueryId(null);
          setResult(null);
        }}
      />

      {tab === "queries" ? (
        selectedQuery ? (
          <QueryDetail
            query={selectedQuery}
            result={result}
            onBack={backToGallery}
            onRun={runQuery}
            onBookmark={openBookmarkModal}
          />
        ) : (
          <QueryGallery state={state} onOpenQuery={openQuery} />
        )
      ) : null}

      {tab === "bookmarks" ? <BookmarksTable state={state} /> : null}

      {tab === "livestream" ? <LiveStreamTab /> : null}

      {bookmarkModalOpen ? (
        <Modal title="Add bookmark" onClose={() => setBookmarkModalOpen(false)} width="480px" footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setBookmarkModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className={styles.btn} onClick={saveBookmark}>
              Save bookmark
            </button>
          </>
        }>
          <Field label="Name">
            <input className={styles.input} value={bmName} onChange={(e) => setBmName(e.target.value)} />
          </Field>
          <Field label="Tags" help="Comma-separated">
            <input className={styles.input} value={bmTags} onChange={(e) => setBmTags(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className={styles.textarea} rows={4} value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

function QueryGallery({
  state,
  onOpenQuery,
}: {
  state: SentinelState;
  onOpenQuery: (id: string) => void;
}) {
  const tacticsCovered = useMemo(() => {
    const set = new Set<string>();
    for (const q of state.huntingQueries) for (const t of q.tactics) set.add(t);
    return set.size;
  }, [state.huntingQueries]);

  return (
    <div>
      <StatRow
        stats={[
          { label: "Hunting queries", value: state.huntingQueries.length },
          { label: "Bookmarks", value: state.bookmarks.length },
          { label: "Tactics covered", value: tacticsCovered },
          { label: "Query runs logged", value: state.queryHistory.length },
        ]}
      />
      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            render: (q) => (
              <div>
                <div className={styles.rowLink}>{q.name}</div>
                <div style={{ fontSize: 11, color: "#605e5c" }}>{q.description}</div>
              </div>
            ),
          },
          {
            key: "tactics",
            header: "Tactics",
            render: (q) => (
              <>
                {q.tactics.map((t) => (
                  <span key={t} className={styles.mitre}>
                    {t}
                  </span>
                ))}
              </>
            ),
          },
          { key: "dataSources", header: "Data sources", render: (q) => q.dataSources.join(", ") },
          { key: "createdBy", header: "Created by", render: (q) => q.createdBy },
        ]}
        rows={state.huntingQueries}
        getRowKey={(q) => q.id}
        onRowClick={(q) => onOpenQuery(q.id)}
        emptyMessage="No hunting queries."
      />
    </div>
  );
}

function QueryDetail({
  query,
  result,
  onBack,
  onRun,
  onBookmark,
}: {
  query: SentinelState["huntingQueries"][number];
  result: SentinelKqlResult | null;
  onBack: () => void;
  onRun: () => void;
  onBookmark: () => void;
}) {
  return (
    <div>
      <button type="button" className={styles.btnOutline} style={{ marginBottom: 10 }} onClick={onBack}>
        &larr; Back to queries
      </button>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className={styles.cardTitle}>{query.name}</div>
            <div style={{ fontSize: 13, color: "#605e5c" }}>{query.description}</div>
          </div>
          <div style={{ fontSize: 11, color: "#605e5c" }}>
            Created by {query.createdBy} &middot; {query.provider}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12 }}>
          <div>
            <strong>Tactics:</strong>{" "}
            {query.tactics.map((t) => (
              <span key={t} className={styles.mitre}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Techniques:</strong>{" "}
            {query.techniques.map((t) => (
              <span key={t} className={styles.mitre}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Data sources:</strong> {query.dataSources.join(", ")}
          </div>
        </div>
      </div>

      <div className={styles.h3}>Query</div>
      <textarea className={styles.kql} readOnly value={query.query} rows={10} />
      <div className={styles.kqlToolbar}>
        <button type="button" className={styles.btn} onClick={onRun}>
          Run query
        </button>
        <button type="button" className={styles.btnOutline} onClick={() => toast.info("Save as analytic rule isn't wired up in this simulator yet.")}>
          Save as analytic rule
        </button>
        <button type="button" className={styles.btnOutline} onClick={onBookmark}>
          Add bookmark
        </button>
      </div>

      {result ? <ResultPanel result={result} /> : <EmptyState message='Click "Run query" to see results.' />}
    </div>
  );
}

function ResultPanel({ result }: { result: SentinelKqlResult }) {
  return (
    <div>
      <div className={styles.resultsInfo}>
        Showing {result.rowCount} results from {result.scannedRows} rows scanned in {result.table ?? "unknown table"} ({result.durationMs} ms).
        {result.error ? ` ${result.error}` : ""}
      </div>
      <DataTable
        columns={result.columns.map((col) => ({
          key: col,
          header: col,
          render: (row: Record<string, string | number>) => String(row[col] ?? ""),
        }))}
        rows={result.rows}
        getRowKey={(row) => JSON.stringify(row)}
        emptyMessage="No results for this query."
      />
    </div>
  );
}

function BookmarksTable({ state }: { state: SentinelState }) {
  if (state.bookmarks.length === 0) {
    return <EmptyState message='No bookmarks yet. From a hunting query result, click "Add bookmark" to capture suspicious rows.' />;
  }
  return (
    <DataTable
      columns={[
        { key: "name", header: "Bookmark", render: (b) => <span className={styles.rowLink}>{b.name}</span> },
        { key: "createdBy", header: "Created by", render: (b) => b.createdBy },
        {
          key: "tags",
          header: "Tags",
          render: (b) => (
            <>
              {(b.tags || []).map((t) => (
                <span key={t} className={styles.pill}>
                  {t}
                </span>
              ))}
            </>
          ),
        },
        { key: "notes", header: "Notes", render: (b) => b.notes },
        { key: "created", header: "Created", render: (b) => b.created },
      ]}
      rows={state.bookmarks}
      getRowKey={(b) => b.id}
    />
  );
}

function LiveStreamTab() {
  return (
    <div>
      <div className={styles.livestream}>
        <span className={styles.livestreamPulse} />
        Live stream is running. Sentinel is monitoring incoming events in real time.
      </div>
      <div className={styles.h3}>Active live streams</div>
      <DataTable
        columns={[
          { key: "name", header: "Name", render: (s) => <span className={styles.rowLink}>{s.name}</span> },
          {
            key: "query",
            header: "Query",
            render: (s) => <span style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{s.query}</span>,
          },
          { key: "started", header: "Started", render: (s) => s.started },
          { key: "events", header: "Events", render: (s) => s.events },
          { key: "status", header: "Status", render: (s) => <StatusPill tone="ok">{s.status}</StatusPill> },
        ]}
        rows={LIVE_STREAMS}
        getRowKey={(s) => s.name}
      />
    </div>
  );
}
