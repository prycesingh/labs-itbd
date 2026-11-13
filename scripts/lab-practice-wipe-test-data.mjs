/**
 * Guided Labs — wipe TEST trainee data (one-off).
 *
 * Deletes every enrollment and everything hanging off it:
 *   step completion files (rows + photo files on THIS machine's disk),
 *   step completions, rejections, practice sessions, per-trainee lab
 *   overrides, batch lab selections, batches, enrollments.
 *
 * NEVER touches curriculum (modules / labs / tasks / steps), the HRIS employee
 * cache or trainer identities.
 *
 *   node scripts/lab-practice-wipe-test-data.mjs            # dry run: counts only
 *   node scripts/lab-practice-wipe-test-data.mjs --confirm  # actually delete
 *
 * Uses DATABASE_URL from .env.local (production is the only DB — read the dry
 * run before confirming). Photos uploaded on another host (e.g. the deployed
 * server) aren't on this disk; they're reported as "not found here" and must
 * be removed there (they're under <UPLOADS_ROOT>/lab-practice/).
 */
import dotenv from "dotenv";
import fs from "fs/promises";
import mysql from "mysql2/promise";
import dns from "node:dns";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dns.setDefaultResultOrder("ipv4first");

const confirm = process.argv.includes("--confirm");

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is not set");
const hostOverride = process.env.DATABASE_HOST_OVERRIDE?.trim();
const url = (() => {
  if (!hostOverride) return rawUrl;
  const u = new URL(rawUrl);
  u.hostname = hostOverride;
  return u.toString();
})();

// Same resolution as lib/uploads.ts getStorageRoot().
const uploadsRoot = process.env.UPLOADS_ROOT
  ? path.resolve(process.env.UPLOADS_ROOT)
  : path.resolve(root, "..", "uploads-storage");

// Child → parent order (FKs are mostly `restrict`).
const TABLES = [
  "lab_practice_step_completion_files",
  "lab_practice_step_completions",
  "lab_practice_step_rejections",
  "lab_practice_practice_sessions",
  "lab_practice_enrollment_lab_overrides",
  "lab_practice_batch_labs",
  // Enrollments reference batches (SET NULL) — clear the link, then delete both.
  "lab_practice_module_enrollments",
  "lab_practice_batches",
];
const KEEP = ["lab_practice_modules", "lab_practice_labs", "lab_practice_tasks", "lab_practice_steps"];

async function count(conn, table) {
  try {
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    return Number(rows[0].n);
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE") return null; // e.g. migration 0022 not applied yet
    throw err;
  }
}

async function main() {
  const conn = await mysql.createConnection(url);
  try {
    console.log(confirm ? "⚠️  DELETE MODE" : "🔎 DRY RUN (pass --confirm to delete)");
    const counts = {};
    for (const t of TABLES) counts[t] = await count(conn, t);
    console.table(counts);
    const keepBefore = {};
    for (const t of KEEP) keepBefore[t] = await count(conn, t);
    console.log("Kept (curriculum):", keepBefore);

    const [fileRows] = await conn.query("SELECT `file_path` FROM `lab_practice_step_completion_files`");
    const filePaths = fileRows.map((r) => r.file_path);
    console.log(`Photo files referenced: ${filePaths.length} (uploads root: ${uploadsRoot})`);

    if (!confirm) return;

    await conn.beginTransaction();
    try {
      if (counts.lab_practice_module_enrollments !== null && counts.lab_practice_batches !== null) {
        await conn.query("UPDATE `lab_practice_module_enrollments` SET `batch_id` = NULL");
      }
      for (const t of TABLES) {
        if (counts[t] === null) continue;
        const [res] = await conn.query(`DELETE FROM \`${t}\``);
        console.log(`🗑️  ${t}: ${res.affectedRows} rows`);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    let removed = 0;
    let missing = 0;
    for (const id of filePaths) {
      const parts = String(id)
        .split(/[/\\]+/g)
        .filter((s) => s && s !== ".." && s !== ".");
      const abs = path.join(uploadsRoot, ...parts);
      if (!abs.startsWith(uploadsRoot)) continue;
      try {
        await fs.unlink(abs);
        removed++;
      } catch (err) {
        if (err?.code === "ENOENT") missing++;
        else console.warn("Could not delete", abs, err?.message);
      }
    }
    console.log(`📷 Photo files deleted: ${removed}, not found here: ${missing}`);

    const keepAfter = {};
    for (const t of KEEP) keepAfter[t] = await count(conn, t);
    const unchanged = KEEP.every((t) => keepAfter[t] === keepBefore[t]);
    console.log(unchanged ? "✅ Curriculum unchanged." : "❌ Curriculum counts changed!", keepAfter);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("❌", err?.message ?? err);
  process.exitCode = 1;
});
