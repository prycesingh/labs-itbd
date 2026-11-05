/**
 * Practice dates are plain calendar dates ("YYYY-MM-DD") — only the date
 * matters, never the time. The trainee's browser sends its LOCAL date so a
 * session lands on the day they actually practiced regardless of server
 * timezone. To stop back/forward-dating, the server only accepts a date
 * within ±1 day of its own UTC date (covers every real timezone offset).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

export function isValidPracticeDate(value: unknown, now = new Date()): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const ts = utcMidnight(value);
  if (Number.isNaN(ts)) return false;
  // Reject impossible dates like 2026-02-31 (Date.parse rolls them over).
  if (new Date(ts).toISOString().slice(0, 10) !== value) return false;
  const today = utcMidnight(now.toISOString().slice(0, 10));
  return Math.abs(ts - today) <= DAY_MS;
}

/** Browser-side: the user's local calendar date as YYYY-MM-DD. */
export function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
