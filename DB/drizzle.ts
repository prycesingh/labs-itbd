import * as schema from "@/DB/schema";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dns from "node:dns";

// Some managed MySQL hosts resolve to both AAAA and A records.
// Force IPv4 preference to avoid ETIMEDOUT when IPv6 is not reachable.
dns.setDefaultResultOrder("ipv4first");

declare global {
  var __dbHostOverrideLogged: boolean | undefined;
  // Cache the pool across HMR reloads so dev doesn't leak a new pool (and a new
  // batch of connections) on every hot-reload, which exhausts the DB's
  // max_user_connections limit.
  var __dbPool: import("mysql2/promise").Pool | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const databaseHostOverride = process.env.DATABASE_HOST_OVERRIDE?.trim();
const effectiveDatabaseUrl = (() => {
  if (!databaseHostOverride) return databaseUrl;

  try {
    const parsed = new URL(databaseUrl);
    parsed.hostname = databaseHostOverride;
    return parsed.toString();
  } catch {
    console.warn(
      "[db] Unable to parse DATABASE_URL for DATABASE_HOST_OVERRIDE; using original DATABASE_URL.",
    );
    return databaseUrl;
  }
})();

if (databaseHostOverride) {
  const shouldLogDbOverride =
    process.env.AUTH_DEBUG === "true" || process.env.NODE_ENV !== "production";

  if (shouldLogDbOverride && !globalThis.__dbHostOverrideLogged) {
    console.warn(
      `[db] DATABASE_HOST_OVERRIDE active. Using MySQL host: ${databaseHostOverride}`,
    );
    globalThis.__dbHostOverrideLogged = true;
  }
}

const poolConnection =
  globalThis.__dbPool ??
  mysql.createPool({
    uri: effectiveDatabaseUrl,
    // Connection pool settings to prevent ECONNRESET errors
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000, // 60 seconds
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // Automatically reconnect on connection loss
    waitForConnections: true,
  });

// Persist the pool across dev HMR reloads (no-op effect in production where the
// module is evaluated once).
if (process.env.NODE_ENV !== "production") {
  globalThis.__dbPool = poolConnection;
}

export const db = drizzle(poolConnection, {
  schema,
  mode: "default",
});
