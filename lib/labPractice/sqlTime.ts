import { sql, type AnyColumn } from "drizzle-orm";

/*
 * Timezone-proof TIMESTAMP reads/writes for Guided Labs.
 *
 * The shared DB pool has no `timezone` option, so mysql2 parses TIMESTAMP
 * strings in the NODE process's local zone — and the dev machines (ET) and
 * the production server (likely UTC) share one database, so the same row
 * would read hours apart. UNIX_TIMESTAMP() on a TIMESTAMP column returns its
 * true UTC instant whatever the session zone, and FROM_UNIXTIME() writes one
 * back exactly. Combined with DB-clock defaults (defaultNow) instants stay
 * exact end-to-end; display converts to ET (lib/labPractice/dates.ts).
 */

/** Select expression: epoch seconds of a TIMESTAMP column (null-safe). */
export const epochOf = (col: AnyColumn) => sql<number | null>`UNIX_TIMESTAMP(${col})`;

/** Epoch seconds (as returned by epochOf) → Date. */
export const fromEpoch = (seconds: number | string) => new Date(Number(seconds) * 1000);

/** Insert/update value that stores a JS Date's exact instant. */
export const toTimestamp = (d: Date) =>
  sql`FROM_UNIXTIME(${Math.floor(d.getTime() / 1000)})` as unknown as Date;
