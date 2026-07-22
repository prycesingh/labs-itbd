"use client";

import { useState } from "react";

import type { SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import styles from "./azure-portal.module.css";

function runQuery(sql: SqlResource, query: string): string {
  const q = query.trim();
  const upper = q.toUpperCase();

  if (upper.startsWith("SELECT @@VERSION")) {
    return "(1 row)\n\nMicrosoft SQL Azure (RTM) - 12.0.2000.8\n\tFeb 14 2026 04:12:18\n\tCopyright (C) 2026 Microsoft Corporation";
  }
  if (upper.startsWith("SELECT NAME FROM SYS.DATABASES")) {
    return `name\n----\nmaster\n${sql.name}\n\n(2 rows affected)`;
  }
  if (upper.startsWith("SELECT")) {
    return "Query executed.\n(0 rows returned)";
  }
  if (upper.startsWith("INSERT") || upper.startsWith("UPDATE") || upper.startsWith("DELETE")) {
    return `Query executed.\n(${Math.floor(Math.random() * 5 + 1)} rows affected)`;
  }
  if (upper.startsWith("CREATE TABLE")) {
    return "Commands completed successfully.";
  }
  if (q === "") {
    return "Error: query is empty.";
  }
  return "Query executed. (0 rows returned)";
}

export function SecQueryEditor({ sql }: { sql: SqlResource }) {
  const [query, setQuery] = useState("SELECT @@VERSION");
  const [result, setResult] = useState("Results will appear here.");

  return (
    <div className={styles.sectionCard}>
      <h3>Query editor (preview) — {sql.name}</h3>
      <p style={{ background: "#f3f9fd", border: "1px solid #d0e7f5", borderRadius: 2, padding: "8px 12px", fontSize: 13 }}>
        You are connected as <b>{sql.serverAdminLogin}</b> to <code>{sql.serverFQDN}</code> / <b>{sql.name}</b>
      </p>
      <div className={styles.queryEditor}>
        <textarea spellCheck={false} placeholder="-- Try: SELECT @@VERSION" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className={styles.queryToolbar}>
          <button type="button" className={styles.btn} onClick={() => setResult(runQuery(sql, query))}>
            ▶ Run
          </button>
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => {
              setQuery("");
              setResult("Results will appear here.");
            }}
          >
            Clear
          </button>
          <span className={styles.help}>
            Tip: Try <code>SELECT name FROM sys.databases</code>
          </span>
        </div>
        <div className={styles.queryResult}>{result}</div>
      </div>
    </div>
  );
}
