/**
 * Guided Labs time handling — everything is US Eastern Time.
 *
 * Every company machine's clock is set to ET, so "today" and every displayed
 * time is ET regardless of where the server runs (the production server may
 * be on UTC). Client-safe: no server imports.
 *
 * - Practice dates are plain calendar dates ("YYYY-MM-DD") in ET — only the
 *   date matters. The browser sends today's ET date; the server accepts ET
 *   today, or ET yesterday as a grace for a request that crosses midnight.
 * - Timestamps (step completed, rejected, …) are true instants; they are only
 *   converted to ET when formatted for display.
 */

export const APP_TIME_ZONE = "America/New_York";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// en-CA formats dates as YYYY-MM-DD.
const etDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in ET as YYYY-MM-DD (server or browser). */
export function etIsoDate(d = new Date()): string {
  return etDateFmt.format(d);
}

/** Kept for existing callers — the "local" date is the ET date. */
export const localIsoDate = etIsoDate;

export function isValidPracticeDate(value: unknown, now = new Date()): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const ts = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ts)) return false;
  // Reject impossible dates like 2026-02-31 (Date.parse rolls them over).
  if (new Date(ts).toISOString().slice(0, 10) !== value) return false;
  const today = etIsoDate(now);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  return value === today || value === yesterday;
}

const etDateTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short", // "EST" / "EDT"
});

/** "Nov 6, 2026, 2:15 PM EST" — an ISO instant shown in ET. */
export function formatEt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : etDateTimeFmt.format(d);
}

/** "Nov 6, 2026" for a plain YYYY-MM-DD calendar date (no TZ shift). */
export function formatPlainDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(d);
}
