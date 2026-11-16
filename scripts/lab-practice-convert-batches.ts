/**
 * Guided Labs — convert batches to the "one batch per trainee, follows a day
 * schedule, paced by a day pointer" model (one-off, after migration 0024).
 *
 *   npx tsx scripts/lab-practice-convert-batches.ts            # dry run: report only
 *   npx tsx scripts/lab-practice-convert-batches.ts --confirm  # apply
 *   add --no-pin to either: batches just open their full days (steps 1–2
 *   write no overrides), so moving the day pointer later leaves no leftover
 *   per-trainee exceptions. Step 3 always pins — unlinking without it would
 *   drop the trainee to "first lab only" and hide work in progress.
 *
 * Everything runs in ONE transaction; the dry run does the real work and then
 * rolls back, so its report is exactly what --confirm will do. What a trainee
 * can see is preserved for every enrollment — where the new model would show
 * or hide something different, a per-trainee override is written instead.
 *
 *   1. Module batches → schedule batches. Each module gets ONE shared schedule
 *      named after it (reused if it exists; else built from "Day NN" lab
 *      titles, or one lab per day). The batch's day pointer is set to the
 *      latest day holding one of its selected labs.
 *   2. Schedule batches whose switched-on days had gaps: the pointer (set by
 *      0024 to the highest open day) would re-open the gaps, so those labs are
 *      hidden per trainee.
 *   3. Trainees found in several batches: 0024 kept ONE membership. Their
 *      other enrollments are re-linked to that batch when it covers the module
 *      (same trainer), otherwise frozen as they are (overrides) and unlinked.
 *
 * Uses DATABASE_URL from .env.local — production is the only DB, so read the
 * dry run before confirming.
 */
import dotenv from "dotenv";
import mysql, { type RowDataPacket } from "mysql2/promise";
import dns from "node:dns";
import path from "node:path";

import { planFromTitles, planPerDay, type GenLab } from "../lib/labPractice/scheduleGenerator";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dns.setDefaultResultOrder("ipv4first");
const confirm = process.argv.includes("--confirm");
const noPin = process.argv.includes("--no-pin");

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is not set");
const hostOverride = process.env.DATABASE_HOST_OVERRIDE?.trim();
const url = (() => {
  if (!hostOverride) return rawUrl;
  const u = new URL(rawUrl);
  u.hostname = hostOverride;
  return u.toString();
})();

type Row = RowDataPacket & Record<string, unknown>;
const log = (...a: unknown[]) => console.log(...a);

async function main() {
  const c = await mysql.createConnection(url);
  const q = async <T = Row>(sql: string, params: unknown[] = []) => (await c.query(sql, params))[0] as unknown as T[];
  const exec = async (sql: string, params: unknown[] = []) => (await c.query(sql, params))[0] as mysql.ResultSetHeader;

  // ── Precheck: 0024 applied? ──
  const cols = await q(`SHOW COLUMNS FROM lab_practice_batches LIKE 'current_day'`);
  const tbl = await q(`SHOW TABLES LIKE 'lab_practice_batch_members'`);
  if (!cols.length || !tbl.length) {
    console.error("Migration 0024 isn't applied yet (npm run db:push). Nothing done.");
    await c.end();
    process.exit(1);
  }

  const report = {
    moduleBatches: 0,
    schedulesCreated: 0,
    gapHides: 0,
    overrides: 0,
    /** --no-pin: per-trainee lab visibility changes accepted instead of pinned. */
    visibilityChanges: 0,
    relinked: 0,
    frozen: 0,
  };
  if (noPin) log("--no-pin: batches open their full days; no overrides for steps 1–2.\n");
  await c.beginTransaction();
  try {
    /** Active labs of a module in sequence order. */
    const moduleLabs = async (moduleId: number) =>
      q<{ id: number; title: string; sequence_no: number; module_id: number } & Row>(
        `SELECT id, title, sequence_no, module_id FROM lab_practice_labs WHERE module_id = ? AND is_active = true ORDER BY sequence_no`,
        [moduleId],
      );
    /** labId → dayNo for a schedule. */
    const dayMap = async (scheduleId: number) =>
      new Map(
        (
          await q<{ lab_id: number; day_no: number } & Row>(
            `SELECT dl.lab_id, d.day_no FROM lab_practice_schedule_day_labs dl JOIN lab_practice_schedule_days d ON d.id = dl.day_id WHERE dl.schedule_id = ?`,
            [scheduleId],
          )
        ).map((r) => [Number(r.lab_id), Number(r.day_no)]),
      );
    const overridesOf = async (enrollmentId: number) =>
      new Map(
        (
          await q<{ lab_id: number; visible: number } & Row>(
            `SELECT lab_id, visible FROM lab_practice_enrollment_lab_overrides WHERE enrollment_id = ?`,
            [enrollmentId],
          )
        ).map((r) => [Number(r.lab_id), Boolean(r.visible)]),
      );
    /** Write overrides so that `base` + overrides === `target` (existing overrides kept).
     *  `write: false` only counts the labs whose visibility would change. */
    const pin = async (
      enrollmentId: number,
      labIds: number[],
      target: (id: number) => boolean,
      base: (id: number, i: number) => boolean,
      write = true,
    ) => {
      const ov = await overridesOf(enrollmentId);
      let n = 0;
      for (const [i, labId] of labIds.entries()) {
        if (ov.has(labId)) continue;
        const want = target(labId);
        if (want === base(labId, i)) continue;
        n++;
        if (!write) continue;
        await exec(
          `INSERT INTO lab_practice_enrollment_lab_overrides (enrollment_id, lab_id, visible) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE visible = VALUES(visible)`,
          [enrollmentId, labId, want],
        );
      }
      if (write) report.overrides += n;
      return n;
    };

    // ── 1. Module batches → schedule batches ──
    const moduleBatches = await q<{ id: number; name: string; module_id: number; trainer_id: number } & Row>(
      `SELECT id, name, module_id, trainer_id FROM lab_practice_batches WHERE module_id IS NOT NULL AND schedule_id IS NULL`,
    );
    for (const b of moduleBatches) {
      const [mod] = await q<{ id: number; title: string } & Row>(`SELECT id, title FROM lab_practice_modules WHERE id = ?`, [b.module_id]);
      const labs = await moduleLabs(b.module_id);
      const scheduleName = String(mod.title).slice(0, 120);
      let [sched] = await q<{ id: number } & Row>(`SELECT id FROM lab_practice_schedules WHERE name = ?`, [scheduleName]);
      if (!sched) {
        const res = await exec(`INSERT INTO lab_practice_schedules (name, created_by) VALUES (?, ?)`, [scheduleName, b.trainer_id]);
        sched = { id: res.insertId } as typeof sched;
        const gen: GenLab[] = labs.map((l) => ({ id: l.id, moduleId: l.module_id, title: String(l.title), sequenceNo: l.sequence_no }));
        const byTitle = planFromTitles(gen, [b.module_id]);
        const plan = byTitle.unplaced.length === 0 && byTitle.days.size > 0 ? byTitle : planPerDay(gen, [b.module_id], 1);
        const maxDay = Math.max(0, ...plan.days.keys());
        const dayIds = new Map<number, number>();
        for (let no = 1; no <= maxDay; no++) {
          const r = await exec(`INSERT INTO lab_practice_schedule_days (schedule_id, day_no) VALUES (?, ?)`, [sched.id, no]);
          dayIds.set(no, r.insertId);
        }
        for (const [no, ids] of plan.days) {
          for (const [i, labId] of ids.entries()) {
            await exec(
              `INSERT INTO lab_practice_schedule_day_labs (schedule_id, day_id, lab_id, sequence_no) VALUES (?, ?, ?, ?)`,
              [sched.id, dayIds.get(no), labId, i + 1],
            );
          }
        }
        report.schedulesCreated++;
        log(`  + schedule "${scheduleName}" (${maxDay} days, ${byTitle === plan ? "from lab titles" : "one lab per day"})`);
      }
      const days = await dayMap(sched.id);
      const activeIds = labs.map((l) => Number(l.id));
      const selectedRaw = (await q<{ lab_id: number } & Row>(`SELECT lab_id FROM lab_practice_batch_labs WHERE batch_id = ?`, [b.id])).map((r) => Number(r.lab_id));
      // Old rule: the batch's selected ACTIVE labs; none → just the first active lab.
      let selected = new Set(selectedRaw.filter((id) => activeIds.includes(id)));
      if (!selected.size && activeIds.length) selected = new Set([activeIds[0]]);
      const currentDay = Math.max(0, ...[...selected].map((id) => days.get(id) ?? 0));

      const enrollments = await q<{ id: number } & Row>(`SELECT id FROM lab_practice_module_enrollments WHERE batch_id = ?`, [b.id]);
      let pinned = 0;
      for (const e of enrollments) {
        pinned += await pin(
          e.id,
          activeIds,
          (id) => selected.has(id),
          (id) => (days.get(id) ?? Infinity) <= currentDay,
          !noPin,
        );
      }
      await exec(`UPDATE lab_practice_batches SET schedule_id = ?, module_id = NULL, current_day = ? WHERE id = ?`, [sched.id, currentDay, b.id]);
      await exec(`DELETE FROM lab_practice_batch_labs WHERE batch_id = ?`, [b.id]);
      report.moduleBatches++;
      log(`  ~ module batch "${b.name}" → follows "${scheduleName}", Day ${currentDay}; ${enrollments.length} enrollments, ${
          noPin ? `${pinned} lab visibility changes (full days open, no overrides)` : `${pinned} overrides to keep what they saw`
        }`);
      report.visibilityChanges += noPin ? pinned : 0;
    }

    // ── 2. Schedule batches whose open days had gaps ──
    const scheduleBatches = await q<{ id: number; name: string; schedule_id: number; current_day: number } & Row>(
      `SELECT id, name, schedule_id, current_day FROM lab_practice_batches WHERE schedule_id IS NOT NULL AND current_day > 0`,
    );
    for (const b of scheduleBatches) {
      const toggled = (
        await q<{ day_no: number } & Row>(
          `SELECT d.day_no FROM lab_practice_batch_days bd JOIN lab_practice_schedule_days d ON d.id = bd.day_id WHERE bd.batch_id = ?`,
          [b.id],
        )
      ).map((r) => Number(r.day_no));
      if (!toggled.length) continue; // converted in step 1, or pointer set by hand
      const closed = new Set<number>();
      for (let no = 1; no <= b.current_day; no++) if (!toggled.includes(no)) closed.add(no);
      if (!closed.size) continue;
      const days = await dayMap(b.schedule_id);
      const enrollments = await q<{ id: number; module_id: number } & Row>(
        `SELECT id, module_id FROM lab_practice_module_enrollments WHERE batch_id = ?`,
        [b.id],
      );
      let pinned = 0;
      for (const e of enrollments) {
        const ids = (await moduleLabs(e.module_id)).map((l) => Number(l.id));
        const wasOpen = (id: number) => toggled.includes(days.get(id) ?? -1);
        pinned += await pin(e.id, ids, wasOpen, (id) => (days.get(id) ?? Infinity) <= b.current_day, !noPin);
      }
      if (noPin) report.visibilityChanges += pinned;
      else report.gapHides += pinned;
      log(
        `  ~ "${b.name}": days ${[...closed].join(", ")} were closed below Day ${b.current_day} — ${
          noPin ? `${pinned} labs re-open (no overrides)` : `${pinned} hide overrides`
        }`,
      );
    }

    // ── 3. Enrollments linked to a batch their trainee isn't a member of ──
    const strays = await q<
      { id: number; module_id: number; trainer_id: number; batch_id: number; trainee_id: number; member_batch: number | null } & Row
    >(
      `SELECT e.id, e.module_id, e.trainer_id, e.batch_id, e.trainee_id, m.batch_id AS member_batch
         FROM lab_practice_module_enrollments e
         LEFT JOIN lab_practice_batch_members m ON m.trainee_id = e.trainee_id
        WHERE e.batch_id IS NOT NULL AND (m.batch_id IS NULL OR m.batch_id <> e.batch_id)`,
    );
    for (const e of strays) {
      const ids = (await moduleLabs(e.module_id)).map((l) => Number(l.id));
      if (e.member_batch != null) {
        const [mb] = await q<{ trainer_id: number; schedule_id: number | null; name: string } & Row>(
          `SELECT trainer_id, schedule_id, name FROM lab_practice_batches WHERE id = ?`,
          [e.member_batch],
        );
        // Same trainer, and the member batch's schedule uses this module.
        const covers =
          mb?.schedule_id != null &&
          mb.trainer_id === e.trainer_id &&
          (
            await q(
              `SELECT 1 FROM lab_practice_schedule_day_labs dl JOIN lab_practice_labs l ON l.id = dl.lab_id WHERE dl.schedule_id = ? AND l.module_id = ? LIMIT 1`,
              [mb.schedule_id, e.module_id],
            )
          ).length > 0;
        if (covers) {
          await exec(`UPDATE lab_practice_module_enrollments SET batch_id = ? WHERE id = ?`, [e.member_batch, e.id]);
          report.relinked++;
          log(`  ~ enrollment ${e.id} (trainee ${e.trainee_id}) now paced by their batch "${mb.name}"`);
          continue;
        }
      }
      // Freeze what they see today, then unlink (back to individual pacing).
      const [old] = await q<{ schedule_id: number | null; current_day: number } & Row>(
        `SELECT schedule_id, current_day FROM lab_practice_batches WHERE id = ?`,
        [e.batch_id],
      );
      const days = old?.schedule_id != null ? await dayMap(old.schedule_id) : new Map<number, number>();
      const visibleNow = (id: number) => (days.get(id) ?? Infinity) <= (old?.current_day ?? 0);
      await pin(e.id, ids, visibleNow, (_id, i) => i === 0);
      await exec(`UPDATE lab_practice_module_enrollments SET batch_id = NULL WHERE id = ?`, [e.id]);
      report.frozen++;
      log(`  ~ enrollment ${e.id} (trainee ${e.trainee_id}) left its second batch — visibility frozen as individual overrides`);
    }

    log("\nSummary:", report);
    if (confirm) {
      await c.commit();
      log("Committed.");
    } else {
      await c.rollback();
      log("Dry run — rolled back. Re-run with --confirm to apply.");
    }
  } catch (err) {
    await c.rollback();
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
