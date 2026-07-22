/**
 * This app's MariaDB host returns `json` columns as raw strings rather than
 * parsed values (mysql2 only auto-parses JSON columns on true MySQL — MariaDB
 * stores JSON as LONGTEXT under the hood). Every read of a `json().$type<T>()`
 * column must go through this to get the actual value back.
 */
export function parseJsonColumn<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}
