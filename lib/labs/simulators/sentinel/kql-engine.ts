import type { SentinelDevice, SentinelKqlResult, SentinelUser } from "./types";

// ===== Real KQL micro-interpreter =====
//
// This is a genuine, from-scratch tiny KQL interpreter — not random/canned data.
// It tokenizes a KQL string into a table reference followed by pipe (`|`) stages,
// then evaluates each supported stage against an in-memory synthetic table store
// built once by buildSyntheticTables() and reused across calls (via useMemo by
// callers). Unsupported stages are skipped gracefully (never thrown) so every real
// seeded KQL string (hunting queries, rule snippets, saved queries) runs to
// completion — see the module-level smoke test performed during development.

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) — same pattern used
// across every simulator's seedData.ts in this app. No Math.random()/Date.now(). =====
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

type Row = Record<string, string | number>;
type TableStore = Record<string, Row[]>;

const LOCATIONS = ["India", "United States", "United Kingdom", "Germany", "Singapore", "Russia", "Romania", "Brazil", "Nigeria", "Vietnam"];
const RESULT_TYPES = [0, 0, 0, 0, 0, 50053, 50126, 50056, 50074, 53003];
const EVENT_IDS = [4624, 4625, 4625, 4625, 4768, 4672, 4720, 4732, 4662];
const AZURE_OPERATIONS = [
  "Add member to role",
  "Update application",
  "Add owner to service principal",
  "Create policy assignment",
  "Delete resource group",
  "Update conditional access policy",
];
const OFFICE_OPERATIONS = ["New-InboxRule", "Set-InboxRule", "FileDownloaded", "FileAccessed", "MailItemsAccessed", "UserLoggedIn"];
const PROCESS_NAMES = ["powershell.exe", "cmd.exe", "rundll32.exe", "certutil.exe", "wmic.exe", "explorer.exe", "outlook.exe", "winword.exe"];
const DNS_QUERY_NAMES = [
  "www.microsoft.com",
  "login.microsoftonline.com",
  "graph.microsoft.com",
  "kq7xz19fplaa2f.badc2domain.net",
  "update-service.cloudlab.in",
  "xj4k9plm2qz.dgadomain.biz",
  "cdn.cloudflare.com",
];
const CSL_DEVICE_VENDORS = ["Palo Alto Networks", "Fortinet", "Cisco", "Check Point"];

// A pool of malicious/unknown IPs to mix with roster-consistent internal traffic.
const EXTERNAL_IPS = ["198.51.100.34", "203.0.113.42", "203.0.113.99", "192.0.2.15", "185.220.101.45", "45.146.164.110"];

function buildIso(rand: () => number, maxDaysAgo: number): string {
  const d = new Date(2026, 5, 20, 12, 0, 0); // fixed anchor date — deterministic, not "now"
  d.setDate(d.getDate() - Math.floor(rand() * maxDaysAgo));
  d.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), Math.floor(rand() * 60));
  return d.toISOString();
}

/**
 * Builds a synthetic in-memory dataset for the 8 most-referenced tables across the
 * seeded hunting queries / rule KQL / saved queries. Deterministic (seeded PRNG),
 * derived from the same roster (users/devices) used across the rest of the
 * simulator so names are consistent (e.g. sign-in rows reference real seeded UPNs).
 * Callers should build this once (e.g. in a useMemo) and reuse it across runKqlQuery calls.
 */
export function buildSyntheticTables(users: SentinelUser[], devices: SentinelDevice[]): TableStore {
  const upns = users.length ? users.map((u) => u.userPrincipalName) : ["ankit@cloudlab.in", "priya@cloudlab.in"];
  const deviceNames = devices.length ? devices.map((d) => d.name) : ["LAPTOP-ANKIT", "LAPTOP-PRIYA"];
  const ipFor = (rand: () => number, i: number): string => (i % 6 === 0 ? pick(rand, EXTERNAL_IPS) : `10.10.${i % 8}.${20 + (i % 200)}`);

  // ----- SigninLogs -----
  const signinRand = rng(101);
  const SigninLogs: Row[] = Array.from({ length: 60 }, (_, i) => {
    const resultType = pick(signinRand, RESULT_TYPES);
    return {
      TimeGenerated: buildIso(signinRand, 30),
      UserPrincipalName: pick(signinRand, upns),
      ResultType: resultType,
      IPAddress: ipFor(signinRand, i),
      Location: pick(signinRand, LOCATIONS),
      AppDisplayName: pick(signinRand, ["Office 365", "Azure Portal", "Microsoft Teams", "Power BI"]),
    };
  });

  // ----- SecurityEvent -----
  const secRand = rng(202);
  const SecurityEvent: Row[] = Array.from({ length: 70 }, (_, i) => ({
    TimeGenerated: buildIso(secRand, 14),
    EventID: pick(secRand, EVENT_IDS),
    Account: pick(secRand, upns),
    IpAddress: ipFor(secRand, i),
    Computer: pick(secRand, deviceNames),
    PreAuthType: secRand() < 0.15 ? 0 : 2,
    AccountType: "User",
  }));

  // ----- AzureActivity -----
  const azRand = rng(303);
  const AzureActivity: Row[] = Array.from({ length: 50 }, (_, i) => ({
    TimeGenerated: buildIso(azRand, 30),
    Caller: pick(azRand, upns),
    OperationNameValue: pick(azRand, AZURE_OPERATIONS),
    ActivityStatusValue: pick(azRand, ["Success", "Success", "Success", "Failure"]),
    ResourceGroup: "rg-security",
    Level: i % 10 === 0 ? "Critical" : "Informational",
  }));

  // ----- OfficeActivity -----
  const ofRand = rng(404);
  const OfficeActivity: Row[] = Array.from({ length: 55 }, () => ({
    TimeGenerated: buildIso(ofRand, 14),
    UserId: pick(ofRand, upns),
    Operation: pick(ofRand, OFFICE_OPERATIONS),
    ClientIP: pick(ofRand, EXTERNAL_IPS.concat(["10.10.0.5", "10.10.1.9"])),
    ResultStatus: "Succeeded",
  }));

  // ----- DeviceProcessEvents -----
  const dpRand = rng(505);
  const DeviceProcessEvents: Row[] = Array.from({ length: 65 }, (_, i) => ({
    Timestamp: buildIso(dpRand, 7),
    DeviceName: pick(dpRand, deviceNames),
    AccountName: pick(dpRand, upns).split("@")[0],
    FileName: pick(dpRand, PROCESS_NAMES),
    ProcessCommandLine:
      i % 8 === 0 ? `${pick(dpRand, PROCESS_NAMES)} -enc JABjAGwAaQBlAG4AdAAgAD0A` : `${pick(dpRand, PROCESS_NAMES)} /c whoami`,
    InitiatingProcessFileName: pick(dpRand, PROCESS_NAMES),
    FolderPath: i % 5 === 0 ? "C:\\Users\\Public\\payload.exe" : "C:\\Windows\\System32\\cmd.exe",
  }));

  // ----- AuditLogs -----
  const auRand = rng(606);
  const AuditLogs: Row[] = Array.from({ length: 40 }, () => ({
    TimeGenerated: buildIso(auRand, 30),
    OperationName: pick(auRand, ["Add member to role", "Add owner to service principal", "Update user", "Add service principal"]),
    InitiatedBy: pick(auRand, upns),
    Result: "success",
  }));

  // ----- DnsEvents -----
  const dnsRand = rng(707);
  const DnsEvents: Row[] = Array.from({ length: 80 }, (_, i) => ({
    TimeGenerated: buildIso(dnsRand, 7),
    Name: pick(dnsRand, DNS_QUERY_NAMES),
    ClientIP: ipFor(dnsRand, i),
    Computer: pick(dnsRand, deviceNames),
  }));

  // ----- CommonSecurityLog -----
  const cslRand = rng(808);
  const CommonSecurityLog: Row[] = Array.from({ length: 45 }, (_, i) => ({
    TimeGenerated: buildIso(cslRand, 14),
    DeviceVendor: pick(cslRand, CSL_DEVICE_VENDORS),
    SourceUserName: pick(cslRand, upns),
    DestinationHostName: i % 9 === 0 ? "dropbox.com" : "internal-service.cloudlab.in",
    SentBytes: Math.floor(cslRand() * 200000000),
    SourceIP: ipFor(cslRand, i),
  }));

  return {
    SigninLogs,
    SecurityEvent,
    AzureActivity,
    OfficeActivity,
    DeviceProcessEvents,
    AuditLogs,
    DnsEvents,
    CommonSecurityLog,
  };
}

// ===== Parser =====

type WhereClause = { col: string; op: string; value: string | number; raw: string };
type Stage =
  | { kind: "where"; clauses: WhereClause[] }
  | { kind: "project"; columns: string[] }
  | { kind: "extend"; column: string; expr: string }
  | { kind: "summarize-count-by"; groupBy: string[] }
  | { kind: "summarize-agg-by"; alias: string; fn: "sum" | "avg" | "dcount"; arg: string; groupBy: string[] }
  | { kind: "top"; n: number; by: string; direction: "asc" | "desc" }
  | { kind: "take"; n: number }
  | { kind: "order-by"; by: string; direction: "asc" | "desc" }
  | { kind: "unsupported"; text: string };

const COMPARATORS = ["==", "!=", ">=", "<=", ">", "<"];

function stripComments(line: string): string {
  // Strip trailing "// comment" — but not inside string literals. Good enough for
  // our seeded queries (comments always trail after real tokens, never mid-string).
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  return line.slice(0, idx);
}

function parseWhereClause(text: string): WhereClause | null {
  const t = text.trim();

  // ago(...) time-window filters (e.g. "TimeGenerated > ago(7d)") are accepted
  // syntactically but don't reduce rows — our synthetic tables don't model a
  // meaningful "now" cutoff relationship, so this is a graceful no-op filter.
  if (/\bago\s*\(/i.test(t)) return null;

  for (const op of ["contains", "has_any", "has", "startswith", "endswith", "!="].concat(COMPARATORS)) {
    // has_any (...) — special-cased list membership, treat as unsupported-but-safe (no-op)
    if (op === "has_any") continue;
    const idx = t.indexOf(` ${op} `);
    if (idx === -1) continue;
    const col = t.slice(0, idx).trim();
    let rawValue = t.slice(idx + op.length + 2).trim();
    // Strip surrounding quotes.
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      rawValue = rawValue.slice(1, -1);
    }
    const numeric = Number(rawValue);
    const value: string | number = rawValue !== "" && !Number.isNaN(numeric) ? numeric : rawValue;
    return { col, op, value, raw: t };
  }
  return null;
}

function parseStage(rawStage: string): Stage {
  const stage = stripComments(rawStage).trim();
  const firstSpace = stage.indexOf(" ");
  const keyword = (firstSpace === -1 ? stage : stage.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : stage.slice(firstSpace + 1).trim();

  if (keyword === "where") {
    // Split multiple ANDed predicates joined by " and " (case-insensitive), which
    // is how our seeded queries combine conditions within one where stage.
    const parts = rest.split(/\s+and\s+/i);
    const clauses = parts.map(parseWhereClause).filter((c): c is WhereClause => c !== null);
    return { kind: "where", clauses };
  }

  if (keyword === "project") {
    const columns = rest
      .split(",")
      .map((c) => c.trim())
      .map((c) => (c.includes("=") ? c.split("=")[0].trim() : c))
      .filter(Boolean);
    return { kind: "project", columns };
  }

  if (keyword === "extend") {
    const eq = rest.indexOf("=");
    if (eq === -1) return { kind: "unsupported", text: stage };
    const column = rest.slice(0, eq).trim();
    const expr = rest.slice(eq + 1).trim();
    return { kind: "extend", column, expr };
  }

  if (keyword === "summarize") {
    // summarize count() by col[, col2]
    const countMatch = rest.match(/^count\(\)\s*by\s+(.+)$/i);
    if (countMatch) {
      const groupBy = countMatch[1].split(",").map((c) => c.trim());
      return { kind: "summarize-count-by", groupBy };
    }
    // summarize alias=sum(col) by col2   /  avg(...)  /  dcount(...)
    const aggMatch = rest.match(/^(\w+)\s*=\s*(sum|avg|dcount)\((\w+)\)\s*by\s+(.+)$/i);
    if (aggMatch) {
      const [, alias, fnRaw, arg, byRaw] = aggMatch;
      const fn = fnRaw.toLowerCase() as "sum" | "avg" | "dcount";
      const groupBy = byRaw.split(",").map((c) => c.trim());
      return { kind: "summarize-agg-by", alias, fn, arg, groupBy };
    }
    return { kind: "unsupported", text: stage };
  }

  if (keyword === "top") {
    const m = rest.match(/^(\d+)\s+by\s+(\w+)(?:\s+(asc|desc))?$/i);
    if (m) {
      const [, nStr, by, dir] = m;
      return { kind: "top", n: Number(nStr), by, direction: (dir?.toLowerCase() as "asc" | "desc") ?? "desc" };
    }
    return { kind: "unsupported", text: stage };
  }

  if (keyword === "take" || keyword === "limit") {
    const n = Number(rest.trim());
    if (!Number.isNaN(n)) return { kind: "take", n };
    return { kind: "unsupported", text: stage };
  }

  if (keyword === "order" || keyword === "sort") {
    // "order by col asc|desc" / "sort by col asc|desc"
    const byRest = rest.replace(/^by\s+/i, "");
    const m = byRest.match(/^(\w+)(?:\s+(asc|desc))?$/i);
    if (m) {
      const [, by, dir] = m;
      return { kind: "order-by", by, direction: (dir?.toLowerCase() as "asc" | "desc") ?? "asc" };
    }
    return { kind: "unsupported", text: stage };
  }

  return { kind: "unsupported", text: stage };
}

function compareValues(rowValue: string | number | undefined, clause: WhereClause): boolean {
  if (rowValue === undefined) return false;
  const { op, value } = clause;

  if (op === "contains") return String(rowValue).toLowerCase().includes(String(value).toLowerCase());
  if (op === "has") {
    return String(rowValue)
      .toLowerCase()
      .split(/\s+/)
      .some((tok) => tok === String(value).toLowerCase());
  }
  if (op === "startswith") return String(rowValue).toLowerCase().startsWith(String(value).toLowerCase());
  if (op === "endswith") return String(rowValue).toLowerCase().endsWith(String(value).toLowerCase());

  // Numeric comparisons when both sides are numeric; otherwise string comparison.
  const bothNumeric = typeof rowValue === "number" && typeof value === "number";
  if (op === "==") return bothNumeric ? rowValue === value : String(rowValue) === String(value);
  if (op === "!=") return bothNumeric ? rowValue !== value : String(rowValue) !== String(value);
  if (bothNumeric) {
    if (op === ">") return rowValue > value;
    if (op === "<") return rowValue < value;
    if (op === ">=") return rowValue >= value;
    if (op === "<=") return rowValue <= value;
  }
  return false;
}

function applyStage(rows: Row[], stage: Stage): Row[] {
  switch (stage.kind) {
    case "where": {
      if (stage.clauses.length === 0) return rows; // e.g. only an ago(...) filter — no-op
      return rows.filter((r) => stage.clauses.every((c) => compareValues(r[c.col], c)));
    }

    case "project": {
      return rows.map((r) => {
        const projected: Row = {};
        for (const col of stage.columns) {
          if (col in r) projected[col] = r[col];
        }
        return projected;
      });
    }

    case "extend": {
      return rows.map((r) => {
        const expr = stage.expr;
        // Referencing another column by bare name.
        if (expr in r) return { ...r, [stage.column]: r[expr] };
        // Quoted string literal.
        if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
          return { ...r, [stage.column]: expr.slice(1, -1) };
        }
        // Numeric literal.
        const numeric = Number(expr);
        if (!Number.isNaN(numeric) && expr.trim() !== "") return { ...r, [stage.column]: numeric };
        // Anything else (function calls like tostring(...)) — best-effort literal string.
        return { ...r, [stage.column]: expr };
      });
    }

    case "summarize-count-by": {
      const groups = new Map<string, { keyValues: Row; count: number }>();
      for (const r of rows) {
        const keyValues: Row = {};
        for (const col of stage.groupBy) keyValues[col] = r[col] ?? "";
        const key = JSON.stringify(keyValues);
        const existing = groups.get(key);
        if (existing) existing.count += 1;
        else groups.set(key, { keyValues, count: 1 });
      }
      return Array.from(groups.values()).map((g) => ({ ...g.keyValues, count_: g.count }));
    }

    case "summarize-agg-by": {
      const groups = new Map<string, { keyValues: Row; values: number[] }>();
      for (const r of rows) {
        const keyValues: Row = {};
        for (const col of stage.groupBy) keyValues[col] = r[col] ?? "";
        const key = JSON.stringify(keyValues);
        const rawVal = r[stage.arg];
        const numVal = typeof rawVal === "number" ? rawVal : Number(rawVal);
        const existing = groups.get(key);
        if (existing) existing.values.push(Number.isNaN(numVal) ? 0 : numVal);
        else groups.set(key, { keyValues, values: [Number.isNaN(numVal) ? 0 : numVal] });
      }
      return Array.from(groups.values()).map((g) => {
        let aggValue: number;
        if (stage.fn === "sum") aggValue = g.values.reduce((a, b) => a + b, 0);
        else if (stage.fn === "avg") aggValue = g.values.reduce((a, b) => a + b, 0) / g.values.length;
        else aggValue = new Set(g.values).size; // dcount
        return { ...g.keyValues, [stage.alias]: aggValue };
      });
    }

    case "top": {
      const sorted = [...rows].sort((a, b) => {
        const av = a[stage.by];
        const bv = b[stage.by];
        if (typeof av === "number" && typeof bv === "number") return stage.direction === "asc" ? av - bv : bv - av;
        return stage.direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
      return sorted.slice(0, stage.n);
    }

    case "take":
      return rows.slice(0, stage.n);

    case "order-by": {
      return [...rows].sort((a, b) => {
        const av = a[stage.by];
        const bv = b[stage.by];
        if (typeof av === "number" && typeof bv === "number") return stage.direction === "asc" ? av - bv : bv - av;
        return stage.direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }

    case "unsupported":
      // Never throws — gracefully skip this stage and keep the pipeline going.
      return rows;

    default:
      return rows;
  }
}

/**
 * Executes a KQL string against the synthetic table store and returns a real
 * SentinelKqlResult — real columns (from the final projected/summarized shape),
 * real rows (actually filtered/summarized data), real rowCount = rows.length, and
 * an honest scannedRows (the source table's row count before any filtering).
 * durationMs is a tiny deterministic function of scannedRows (no Math.random()).
 *
 * Never throws for any syntactically-recognizable KQL: unsupported stages are
 * skipped gracefully (see `unsupported` case in applyStage) rather than causing a
 * crash. If the very first line doesn't reference a known table, returns a result
 * with an `error` message instead of throwing.
 */
export function runKqlQuery(kql: string, tables: TableStore): SentinelKqlResult {
  const lines = kql
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { kql, table: null, columns: [], rows: [], rowCount: 0, scannedRows: 0, durationMs: 5, error: "Empty query" };
  }

  // First line (up to the first pipe, if any) is the table reference.
  const firstLine = lines[0];
  const firstPipeIdx = firstLine.indexOf("|");
  const tableName = (firstPipeIdx === -1 ? firstLine : firstLine.slice(0, firstPipeIdx)).trim();
  const remainderOfFirstLine = firstPipeIdx === -1 ? "" : firstLine.slice(firstPipeIdx + 1);

  const table = tables[tableName];
  if (!table) {
    return {
      kql,
      table: tableName || null,
      columns: [],
      rows: [],
      rowCount: 0,
      scannedRows: 0,
      durationMs: 5,
      error: `Table "${tableName}" is not in the synthetic table catalog — no rows scanned.`,
    };
  }

  const scannedRows = table.length;

  // Reassemble the full pipe-stage text: remainder of first line, plus every
  // subsequent line, then split on top-level "|" characters. Our seeded queries
  // never nest pipes inside string literals in a way that would break this.
  const fullText = [remainderOfFirstLine, ...lines.slice(1)].join("\n");
  const stageTexts = fullText
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let rows: Row[] = table.map((r) => ({ ...r }));
  let sawUnsupported: string | null = null;

  for (const stageText of stageTexts) {
    let stage: Stage;
    try {
      stage = parseStage(stageText);
    } catch {
      // Defensive: a malformed stage should never crash the whole query.
      stage = { kind: "unsupported", text: stageText };
    }
    if (stage.kind === "unsupported" && sawUnsupported === null) {
      sawUnsupported = stageText.split(/\s+/)[0] ?? stageText;
    }
    try {
      rows = applyStage(rows, stage);
    } catch {
      // Defensive: never let a single stage's evaluation throw past this function.
      sawUnsupported = sawUnsupported ?? "evaluation error";
    }
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const durationMs = Math.round(scannedRows * 0.02) + 5;

  const result: SentinelKqlResult = {
    kql,
    table: tableName,
    columns,
    rows,
    rowCount: rows.length,
    scannedRows,
    durationMs,
  };
  if (sawUnsupported) {
    result.error = `Operator not supported in this simulator: "${sawUnsupported}" (stage skipped, remaining pipeline still ran).`;
  }
  return result;
}
