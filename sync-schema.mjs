/**
 * Manual schema sync for MariaDB
 * Use this instead of drizzle-kit push when it fails
 */
import dotenv from "dotenv";
import fs from "fs";
import mysql from "mysql2/promise";
import dns from "node:dns";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.local") });

// Force IPv4 to avoid ETIMEDOUT when the host resolves to both A and AAAA.
dns.setDefaultResultOrder("ipv4first");

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) throw new Error("DATABASE_URL is not set");

const hostOverride = process.env.DATABASE_HOST_OVERRIDE?.trim();
const effectiveDatabaseUrl = (() => {
  if (!hostOverride) return rawDatabaseUrl;
  try {
    const parsed = new URL(rawDatabaseUrl);
    parsed.hostname = hostOverride;
    console.log(`🔀 Using host override: ${hostOverride}`);
    return parsed.toString();
  } catch {
    console.warn(
      "⚠️  Could not apply DATABASE_HOST_OVERRIDE; using original DATABASE_URL.",
    );
    return rawDatabaseUrl;
  }
})();

function shouldSkipError(err) {
  const skippableCodes = new Set([
    "ER_TABLE_EXISTS_ERROR",
    "ER_DUP_FIELDNAME",
    "ER_DUP_KEYNAME",
    "ER_CANT_DROP_FIELD_OR_KEY",
    "ER_FK_DUP_NAME",
    "ER_DUP_ENTRY",
    "ER_MULTIPLE_PRI_KEY",
    "ER_CANNOT_ADD_FOREIGN",
  ]);

  if (skippableCodes.has(err?.code)) return true;

  const message = String(err?.message ?? "").toLowerCase();
  return (
    message.includes("duplicate") ||
    message.includes("already exists") ||
    message.includes("foreign key constraint")
  );
}

async function syncSchema() {
  const connection = await mysql.createConnection(effectiveDatabaseUrl);

  try {
    console.log("📡 Connected to MariaDB");

    // Get latest migration file
    const migrationsDir = path.join(__dirname, "drizzle");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log("✅ No migrations found, schema is up to date");
      return;
    }

    const latestMigration = files[0];
    console.log(`📄 Latest migration: ${latestMigration}`);

    // Read SQL
    const sqlPath = path.join(migrationsDir, latestMigration);
    const sql = fs.readFileSync(sqlPath, "utf8");

    const normalizedSql = sql
      .replace(/\r\n/g, "\n")
      .replace(/-->\s*statement-breakpoint/g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    // Split by semicolon and execute each statement
    const statements = normalizedSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`🔄 Executing ${statements.length} SQL statements...`);

    for (const stmt of statements) {
      try {
        // Use text protocol so migration SQL can include PREPARE/EXECUTE statements.
        await connection.query(stmt);
        console.log("✅", stmt.substring(0, 60) + "...");
      } catch (err) {
        if (shouldSkipError(err)) {
          console.log(
            `⏭️  Skipping (${err?.code ?? "UNKNOWN"}): ${String(err?.message ?? "Already exists")}`,
          );
        } else {
          console.error(`❌ (${err?.code ?? "UNKNOWN"})`, err.message);
        }
      }
    }

    console.log("✅ Schema sync complete!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.end();
  }
}

syncSchema();
