"use client";

// Logs (Log Analytics) — ported from itbd-lab/simulators/sentinel/js/sentinel-logs.js.
// Source's query execution was only partially real (regex-based summarize/top/take
// over 6 hardcoded sample tables via SAMPLE_RESULTS/shapeResult/tableFromKql). This
// port keeps the UI/UX shape (23-table catalog grouped by category, KQL editor
// textarea, Run button, results grid, saved queries, query history, time-range
// chips) but replaces the shallow regex engine entirely with the real KQL
// micro-interpreter (`runKqlQuery` over `buildSyntheticTables`) from kql-engine.ts —
// every run genuinely tokenizes/evaluates the query against an in-memory table
// store derived from the live roster (state.users/state.devices), never a canned
// result.
//
// Time-range chips are cosmetic, matching source's original behavior: source's
// `timeRange` only ever fed the auto-inserted `ago(...)` clause in `useTable()`,
// and the real engine treats any `ago(...)` predicate as a graceful time-window
// no-op (see kql-engine.ts's parseWhereClause) since the synthetic tables don't
// model a meaningful "now" cutoff. Selecting a range still changes what gets
// inserted when you click a table, it just doesn't re-filter already-run results.

import { useMemo, useState } from "react";

import type { SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import { buildSyntheticTables, runKqlQuery } from "@/lib/labs/simulators/sentinel/kql-engine";
import { DataTable, EmptyState, Field, Modal, SubTabBar, exportCsv } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

// ===== Table catalog (ported verbatim from source's TABLES, category names
// kept as source used them) =====
type CatalogTable = { name: string; category: string; rows: number; desc: string };

const TABLES: CatalogTable[] = [
  { name: "SecurityIncident", category: "Sentinel", rows: 184, desc: "All incidents created by analytics rules" },
  { name: "SecurityAlert", category: "Sentinel", rows: 1247, desc: "Raw alerts from connectors before grouping" },
  { name: "SecurityEvent", category: "Endpoint", rows: 4218904, desc: "Windows Security event log (AMA / MMA)" },
  { name: "SigninLogs", category: "Identity", rows: 1842917, desc: "Entra ID interactive sign-ins" },
  { name: "AADNonInteractiveUserSignInLogs", category: "Identity", rows: 8742116, desc: "Service-to-service token issuance" },
  { name: "AuditLogs", category: "Identity", rows: 184204, desc: "Entra ID admin + directory changes" },
  { name: "AzureActivity", category: "Cloud", rows: 312811, desc: "Azure Resource Manager control-plane" },
  { name: "AzureDiagnostics", category: "Cloud", rows: 982401, desc: "Diagnostic settings → LA (legacy)" },
  { name: "OfficeActivity", category: "M365", rows: 4218722, desc: "EXO / SPO / Teams admin + content events" },
  { name: "DeviceProcessEvents", category: "Defender", rows: 14821038, desc: "MDE process creation events" },
  { name: "DeviceNetworkEvents", category: "Defender", rows: 24018184, desc: "MDE outbound connections" },
  { name: "DeviceFileEvents", category: "Defender", rows: 18841201, desc: "MDE file create / modify / delete" },
  { name: "EmailEvents", category: "Defender", rows: 482011, desc: "Defender for Office 365 message events" },
  { name: "EmailUrlInfo", category: "Defender", rows: 1842018, desc: "URLs in email messages" },
  { name: "EmailAttachmentInfo", category: "Defender", rows: 184011, desc: "Attachments in email messages" },
  { name: "Syslog", category: "Linux", rows: 24018421, desc: "Linux Syslog via AMA / OMS agent" },
  { name: "CommonSecurityLog", category: "Network", rows: 8842018, desc: "CEF logs (Palo Alto / FortiGate / Check Point)" },
  { name: "SecurityRecommendation", category: "Defender Cloud", rows: 4218, desc: "Defender for Cloud recommendations" },
  { name: "ThreatIntelligenceIndicator", category: "TI", rows: 18402, desc: "TI feed indicators (file / IP / domain / URL)" },
  { name: "Heartbeat", category: "Agent", rows: 184201, desc: "Agent health beacon (every 1 min)" },
  { name: "Usage", category: "Workspace", rows: 18420, desc: "LA ingestion volume per table per day" },
  { name: "Update", category: "Update Mgmt", rows: 421802, desc: "Windows/Linux patch status" },
  { name: "BehaviorAnalytics", category: "UEBA", rows: 184211, desc: "UEBA-derived peer-group anomaly scores" },
];

const CATEGORY_ORDER: string[] = [];
for (const t of TABLES) {
  if (!CATEGORY_ORDER.includes(t.category)) CATEGORY_ORDER.push(t.category);
}

const TIME_RANGES = ["30m", "1h", "4h", "24h", "7d", "30d", "90d"] as const;

const DEFAULT_KQL = "SecurityIncident\n| where TimeGenerated > ago(24h)\n| summarize count() by Severity";

function fmtCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function shortenKql(kql: string): string {
  const firstLine = kql.split("\n")[0] ?? "";
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

type LeftTab = "tables" | "saved" | "history";

export function LogsPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [leftTab, setLeftTab] = useState<LeftTab>("tables");
  const [kql, setKql] = useState(DEFAULT_KQL);
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]>("24h");
  const [result, setResult] = useState<ReturnType<typeof runKqlQuery> | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Built once per roster change and reused across every runKqlQuery call —
  // this is the real, genuinely-parsing KQL micro-interpreter's data source,
  // never a canned/hardcoded result table.
  const tables = useMemo(() => buildSyntheticTables(state.users, state.devices), [state.users, state.devices]);

  function runQuery() {
    const trimmed = kql.trim();
    if (!trimmed) return;
    const runResult = runKqlQuery(trimmed, tables);
    setResult(runResult);
    dispatch({ type: "RECORD_QUERY_HISTORY", kql: trimmed, rowCount: runResult.rowCount });
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
  }

  function useTable(name: string) {
    setKql(`${name}\n| where TimeGenerated > ago(${timeRange})\n| take 50`);
  }

  function loadSaved(savedKql: string) {
    setKql(savedKql);
  }

  function loadHistoryEntry(historyKql: string) {
    setKql(historyKql);
  }

  function confirmSave() {
    const name = saveName.trim();
    if (!name) return;
    dispatch({
      type: "ADD_SAVED_QUERY",
      query: { id: `sq-${crypto.randomUUID()}`, name, kql, createdBy: "you", created: new Date().toISOString() },
    });
    setSaveDialogOpen(false);
    setSaveName("");
  }

  function handleExportCsv() {
    if (!result || result.rows.length === 0) return;
    exportCsv(
      "kql-results.csv",
      result.columns,
      result.rows.map((row) => result.columns.map((c) => row[c] ?? "")),
    );
  }

  return (
    <div>
      <div className={styles.h2}>Logs</div>
      <div className={styles.sub}>
        Run KQL queries against ingested data. Click a table on the left to start a query, or load a saved query or a past run from
        history.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, marginTop: 14, alignItems: "start" }}>
        {/* ===== Left panel: Tables / Saved / History ===== */}
        <aside className={styles.tableWrap} style={{ maxHeight: 680, overflow: "auto" }}>
          <div style={{ padding: 8 }}>
            <SubTabBar
              tabs={[
                { key: "tables", label: "Tables" },
                { key: "saved", label: "Saved" },
                { key: "history", label: "History" },
              ]}
              active={leftTab}
              onChange={(key) => setLeftTab(key as LeftTab)}
            />

            {leftTab === "tables" &&
              CATEGORY_ORDER.map((cat) => (
                <div key={cat}>
                  <div style={{ fontSize: 11, color: "#605e5c", textTransform: "uppercase", fontWeight: 600, padding: "8px 6px 4px", letterSpacing: 0.5 }}>
                    {cat}
                  </div>
                  {TABLES.filter((t) => t.category === cat).map((t) => (
                    <div
                      key={t.name}
                      onClick={() => useTable(t.name)}
                      title={t.desc}
                      style={{
                        padding: "5px 6px",
                        borderRadius: 3,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontFamily: "Consolas, Monaco, monospace", color: "#0078d4", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: 10, color: "#605e5c", flexShrink: 0 }}>{fmtCount(t.rows)}</span>
                    </div>
                  ))}
                </div>
              ))}

            {leftTab === "saved" &&
              (state.savedQueries.length === 0 ? (
                <EmptyState message="No saved queries." />
              ) : (
                state.savedQueries.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => loadSaved(q.kql)}
                    style={{ padding: "8px 6px", borderRadius: 3, cursor: "pointer", borderBottom: "1px solid #f3f2f1", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "#323130", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</div>
                      <div style={{ fontSize: 10, color: "#605e5c" }}>{q.createdBy}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "DELETE_SAVED_QUERY", id: q.id });
                      }}
                      title="Delete"
                      style={{ background: "none", border: 0, color: "#a4262c", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ))}

            {leftTab === "history" &&
              (state.queryHistory.length === 0 ? (
                <EmptyState message="No queries run yet this session." />
              ) : (
                state.queryHistory.map((h, i) => (
                  <div
                    key={`${h.ranAt}-${i}`}
                    onClick={() => loadHistoryEntry(h.kql)}
                    style={{ padding: "8px 6px", borderRadius: 3, cursor: "pointer", borderBottom: "1px solid #f3f2f1" }}
                  >
                    <div style={{ fontSize: 12.5, color: "#323130", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortenKql(h.kql)}</div>
                    <div style={{ fontSize: 10, color: "#605e5c", background: "#edebe9", padding: "1px 6px", borderRadius: 8, display: "inline-block", marginTop: 2 }}>
                      {new Date(h.ranAt).toLocaleTimeString()} · {h.rowCount} rows
                    </div>
                  </div>
                ))
              ))}
          </div>
        </aside>

        {/* ===== Right panel: toolbar, editor, results ===== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className={styles.kqlToolbar}>
            <span style={{ fontSize: 12, color: "#605e5c", marginRight: 6 }}>Time range:</span>
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.chip} ${timeRange === r ? styles.chipActive : ""}`}
                onClick={() => setTimeRange(r)}
              >
                {r}
              </button>
            ))}
            <button type="button" className={styles.btn} style={{ marginLeft: "auto" }} onClick={runQuery}>
              ▶ Run
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setSaveDialogOpen(true)}>
              Save
            </button>
            <button type="button" className={styles.btnOutline} onClick={handleExportCsv} disabled={!result || result.rows.length === 0}>
              Export CSV
            </button>
          </div>

          <textarea
            className={styles.kql}
            spellCheck={false}
            value={kql}
            onChange={(e) => setKql(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            placeholder="Write a KQL query, e.g. SigninLogs | where ResultType != 0 | summarize count() by UserPrincipalName"
          />
          <div style={{ fontSize: 11, color: "#605e5c" }}>Tip: Ctrl+Enter to run.</div>

          {/* ===== Results ===== */}
          <div style={{ marginTop: 6 }}>
            {result === null ? (
              <EmptyState message="Press Run to execute the query. Click a table on the left to start a fresh query." />
            ) : result.error && result.rows.length === 0 ? (
              <div className={styles.card} style={{ borderLeft: "3px solid #a4262c", background: "#fde7e9" }}>
                <b style={{ color: "#a4262c" }}>Query failed:</b>{" "}
                <span style={{ color: "#a4262c" }}>{result.error}</span>
                <div style={{ fontSize: 12, color: "#605e5c", marginTop: 6 }}>
                  Common causes: table name typo, missing column, unsupported KQL syntax. Click a table in the left sidebar to start a
                  fresh query.
                </div>
              </div>
            ) : (
              <>
                <div className={styles.resultsInfo}>
                  Completed in <b>{result.durationMs} ms</b> · scanned <b>{fmtCount(result.scannedRows)}</b> rows · returned{" "}
                  <b>{fmtCount(result.rowCount)}</b> rows
                  {result.table ? (
                    <>
                      {" "}
                      · table <b>{result.table}</b>
                    </>
                  ) : null}
                </div>
                {result.error ? (
                  <div className={styles.card} style={{ borderLeft: "3px solid #d97900", background: "#fff4ce", marginBottom: 10 }}>
                    <span style={{ color: "#797673" }}>{result.error}</span>
                  </div>
                ) : null}
                {result.rowCount === 0 ? (
                  <EmptyState message="Query returned 0 rows. Try a different filter or table." />
                ) : (
                  <DataTable
                    columns={result.columns.map((c) => ({
                      key: c,
                      header: c,
                      render: (row: Record<string, string | number>) => String(row[c] ?? ""),
                    }))}
                    rows={result.rows}
                    getRowKey={(row) => result.columns.map((c) => String(row[c] ?? "")).join("|")}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {saveDialogOpen ? (
        <Modal
          title="Save query"
          onClose={() => setSaveDialogOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={confirmSave} disabled={!saveName.trim()}>
                Save
              </button>
            </>
          }
        >
          <Field label="Query name">
            <input
              className={styles.input}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Failed sign-ins last 24h"
              autoFocus
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
