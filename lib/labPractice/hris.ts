
import { and, eq, max, notInArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labPracticeEmployees } from "@/DB/labPracticeSchema";

/**
 * HRIS (ITBD Workforce) client + employee cache sync.
 *
 *   GET {HRIS_API_URL}   header: x-api-key: {HRIS_API_KEY}
 *
 * The response shape is normalised defensively (array, or { data | employees
 * | results: [] }, with snake/camel field aliases) because the public endpoint
 * is not versioned. If NOTHING parses we throw with the top-level keys we saw,
 * so a shape change surfaces as a clear admin error instead of a silent wipe.
 *
 * Safety: employees missing from the HRIS are DEACTIVATED (never deleted —
 * enrollments reference them), and a response that would deactivate more
 * than half of the currently-active cache is rejected as a probable partial
 * or broken response.
 */

const DEFAULT_HRIS_URL =
  "https://workforce.itbd.net/api/public/hackware/employees";

/** Lazy re-sync threshold used by identity lookups on a cache miss. */
export const HRIS_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export type HrisEmployee = { empId: string; fullName: string; email: string };

export class HrisError extends Error {}

type Raw = Record<string, unknown>;

function pickString(row: Raw, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

/** False only when the record explicitly says the employee is not active. */
function isActiveRecord(row: Raw): boolean {
  for (const key of ["is_active", "isActive", "active"]) {
    if (key in row) {
      const v = row[key];
      return v === true || v === 1 || v === "1" || v === "true";
    }
  }
  const status = pickString(row, ["status", "employment_status", "employmentStatus"]);
  if (status) return !/inactive|terminated|resigned|separated|left|exit/i.test(status);
  return true;
}

function extractRows(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  if (payload && typeof payload === "object") {
    const obj = payload as Raw;
    for (const key of ["data", "employees", "results", "items"]) {
      const inner = obj[key];
      if (Array.isArray(inner)) return inner as Raw[];
      // e.g. { data: { employees: [] } }
      if (inner && typeof inner === "object") {
        const nested = extractRows(inner);
        if (nested.length) return nested;
      }
    }
  }
  return [];
}

export function normalizeHrisPayload(payload: unknown): HrisEmployee[] {
  const rows = extractRows(payload);
  const seenEmp = new Set<string>();
  const seenEmail = new Set<string>();
  const out: HrisEmployee[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object" || !isActiveRecord(row)) continue;

    const empId = pickString(row, [
      "emp_id", "empId", "employee_id", "employeeId", "employee_code",
      "employeeCode", "emp_code", "empCode", "code", "id",
    ]);
    const email = pickString(row, [
      "email", "work_email", "workEmail", "official_email", "officialEmail",
      "company_email", "companyEmail",
    ])?.toLowerCase();
    let fullName = pickString(row, [
      "full_name", "fullName", "name", "employee_name", "employeeName", "display_name",
    ]);
    if (!fullName) {
      const first = pickString(row, ["first_name", "firstName"]);
      const last = pickString(row, ["last_name", "lastName"]);
      fullName = [first, last].filter(Boolean).join(" ") || null;
    }

    if (!empId || !email || !fullName) continue;
    // Duplicate emp_id/email in the feed would violate our unique indexes;
    // keep the first occurrence.
    if (seenEmp.has(empId) || seenEmail.has(email)) continue;
    seenEmp.add(empId);
    seenEmail.add(email);

    out.push({
      empId: empId.slice(0, 20),
      fullName: fullName.slice(0, 150),
      email: email.slice(0, 255),
    });
  }

  if (rows.length > 0 && out.length === 0) {
    const sample = Object.keys(rows[0] ?? {}).join(", ");
    throw new HrisError(
      `HRIS returned ${rows.length} records but none had an employee id, name and email. Fields seen: ${sample}`,
    );
  }
  if (rows.length === 0) {
    const keys =
      payload && typeof payload === "object" ? Object.keys(payload as Raw).join(", ") : typeof payload;
    throw new HrisError(`HRIS response contained no employee list. Top-level: ${keys}`);
  }

  return out;
}

export async function fetchHrisEmployees(): Promise<HrisEmployee[]> {
  const apiKey = process.env.HRIS_API_KEY?.trim();
  if (!apiKey) throw new HrisError("HRIS_API_KEY is not set.");
  const url = process.env.HRIS_API_URL?.trim() || DEFAULT_HRIS_URL;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-key": apiKey, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new HrisError(`Could not reach HRIS: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new HrisError(`HRIS responded ${res.status} ${res.statusText}`);
  }

  const payload = await res.json().catch(() => {
    throw new HrisError("HRIS response was not valid JSON.");
  });
  return normalizeHrisPayload(payload);
}

export type SyncResult = { fetched: number; upserted: number; deactivated: number };

export async function syncEmployees(): Promise<SyncResult> {
  const employees = await fetchHrisEmployees();

  const [{ activeCount }] = await db
    .select({ activeCount: sql<number>`count(*)` })
    .from(labPracticeEmployees)
    .where(eq(labPracticeEmployees.isActive, true));

  if (Number(activeCount) >= 10 && employees.length < Number(activeCount) / 2) {
    throw new HrisError(
      `HRIS returned ${employees.length} employees but ${activeCount} are active locally — refusing to deactivate more than half. Check the HRIS feed.`,
    );
  }

  const now = new Date();
  // Chunk to keep each statement well under max_allowed_packet.
  for (let i = 0; i < employees.length; i += 200) {
    const chunk = employees.slice(i, i + 200);
    await db
      .insert(labPracticeEmployees)
      .values(chunk.map((e) => ({ ...e, isActive: true, syncedAt: now })))
      .onDuplicateKeyUpdate({
        set: {
          fullName: sql`values(${labPracticeEmployees.fullName})`,
          email: sql`values(${labPracticeEmployees.email})`,
          isActive: true,
          syncedAt: now,
        },
      });
  }

  const ids = employees.map((e) => e.empId);
  const deactivated = await db
    .update(labPracticeEmployees)
    .set({ isActive: false, syncedAt: now })
    .where(
      and(
        eq(labPracticeEmployees.isActive, true),
        ids.length ? notInArray(labPracticeEmployees.empId, ids) : undefined,
      ),
    );

  return {
    fetched: employees.length,
    upserted: employees.length,
    deactivated: deactivated[0].affectedRows ?? 0,
  };
}

/** Most recent sync time across the cache, or null if never synced. */
export async function lastSyncedAt(): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(labPracticeEmployees.syncedAt) })
    .from(labPracticeEmployees);
  return row?.at ?? null;
}

/** Sync only if the cache is older than HRIS_STALE_AFTER_MS. Never throws —
 *  a failed lazy sync just leaves the existing cache in place. */
export async function syncIfStale(): Promise<boolean> {
  try {
    const last = await lastSyncedAt();
    if (last && Date.now() - last.getTime() < HRIS_STALE_AFTER_MS) return false;
    await syncEmployees();
    return true;
  } catch (err) {
    console.warn("[lab-practice] lazy HRIS sync failed:", (err as Error).message);
    return false;
  }
}
