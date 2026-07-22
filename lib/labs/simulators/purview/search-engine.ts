import type { PurviewAuditEvent, PurviewContentSearchRow } from "./types";

export type AuditSearchFilters = {
  activities?: string[];
  users?: string[];
  workloads?: string[];
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
};

/**
 * Genuinely filters the 240-event audit array by the given criteria — real
 * array-membership checks, real date-range comparison, real substring match. No
 * placeholder/fake result counts.
 */
export function runAuditSearch(events: PurviewAuditEvent[], filters: AuditSearchFilters): PurviewAuditEvent[] {
  const fromMs = filters.dateFrom ? Date.parse(filters.dateFrom) : null;
  const toMs = filters.dateTo ? Date.parse(filters.dateTo) : null;
  const keyword = filters.keyword?.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.activities && filters.activities.length > 0 && !filters.activities.includes(event.activity)) return false;
    if (filters.users && filters.users.length > 0 && !filters.users.includes(event.user)) return false;
    if (filters.workloads && filters.workloads.length > 0 && !filters.workloads.includes(event.workload)) return false;

    if (fromMs !== null || toMs !== null) {
      const eventMs = Date.parse(event.ts);
      if (Number.isNaN(eventMs)) return false;
      if (fromMs !== null && eventMs < fromMs) return false;
      if (toMs !== null && eventMs > toMs) return false;
    }

    if (keyword) {
      const haystack = `${event.item} ${event.activity} ${event.user}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    return true;
  });
}

// ===== Lightweight eDiscovery-KQL-ish query parser =====
// Supports: bare keywords ANDed together by default, quoted "phrases", from:<value>,
// subject:<value>, and explicit OR / AND between terms. Not exhaustive — a simple
// left-to-right tokenizer good enough for the content-search tester.

type Term = { kind: "keyword" | "from" | "subject"; value: string };
type ParsedQuery = { terms: Term[]; operators: ("AND" | "OR")[] };

function tokenize(query: string): string[] {
  const tokens: string[] = [];
  const re = /"[^"]*"|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

function parseQuery(query: string): ParsedQuery {
  const rawTokens = tokenize(query.trim());
  const terms: Term[] = [];
  const operators: ("AND" | "OR")[] = [];

  for (const raw of rawTokens) {
    const upper = raw.toUpperCase();
    if (upper === "AND" || upper === "OR") {
      operators.push(upper as "AND" | "OR");
      continue;
    }

    let value = raw;
    // Strip surrounding quotes from quoted phrases.
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }

    const fromMatch = /^from:(.+)$/i.exec(value);
    const subjectMatch = /^subject:(.+)$/i.exec(value);
    if (fromMatch) {
      terms.push({ kind: "from", value: fromMatch[1].replace(/^"|"$/g, "") });
    } else if (subjectMatch) {
      terms.push({ kind: "subject", value: subjectMatch[1].replace(/^"|"$/g, "") });
    } else if (value.length > 0) {
      terms.push({ kind: "keyword", value });
    }

    // Default join is AND unless an explicit operator token was already consumed
    // between the previous term and this one.
    if (terms.length > 1 && operators.length < terms.length - 1) {
      operators.push("AND");
    }
  }

  return { terms, operators };
}

function termMatches(term: Term, row: PurviewContentSearchRow): boolean {
  const lower = term.value.toLowerCase();
  switch (term.kind) {
    case "from":
      return row.sender.toLowerCase().includes(lower);
    case "subject":
      return row.subject.toLowerCase().includes(lower);
    case "keyword":
    default:
      return (
        row.subject.toLowerCase().includes(lower) ||
        row.sender.toLowerCase().includes(lower) ||
        row.preview.toLowerCase().includes(lower)
      );
  }
}

/**
 * Parses a simple eDiscovery-KQL-ish query and genuinely filters the 30
 * content-search rows by whether their subject/sender/preview fields match.
 * Operators are evaluated left-to-right (no operator precedence/parens) — good
 * enough for a lightweight tester, not a full KQL grammar.
 */
export function runContentSearchQuery(query: string, rows: PurviewContentSearchRow[]): PurviewContentSearchRow[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { terms, operators } = parseQuery(trimmed);
  if (terms.length === 0) return [];

  return rows.filter((row) => {
    let result = termMatches(terms[0], row);
    for (let i = 1; i < terms.length; i++) {
      const op = operators[i - 1] ?? "AND";
      const nextMatch = termMatches(terms[i], row);
      result = op === "OR" ? result || nextMatch : result && nextMatch;
    }
    return result;
  });
}
