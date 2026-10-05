// Ane Jean Philippe Ane ("JP") was granted one week after his 25 September due date to repay at
// the weekly 1% penalty. That grace week ended Friday 2 October 2026. From 2 October the penalty
// moves to 1% per DAY.
//
// The honest way to record this is a two-phase penalty, not a flat flip to daily:
//   - Phase 1 (25 Sep -> 2 Oct): weekly 1%. That is one started week = 1 unit = 2,000, now locked.
//   - Phase 2 (2 Oct -> as of):  daily 1% on the total due (2,000 per day).
//
// A flat flip to daily would charge the grace week at seven daily units (14,000) instead of the
// one weekly unit (2,000) that was actually agreed, overstating his debt by 12,000. So this adds a
// penalty-cadence switch to the data model instead.
//
// This script:
//   1. Adds late_penalty_switch_on / late_penalty_period_after columns to the live loans table
//      (the canonical definition is in lib/schema.sql).
//   2. Sets the switch on ane-jean-philippe to 2 October 2026 -> daily.
//   3. Records a note documenting the arrangement.
//
// Transactional and idempotent: the ALTERs use IF NOT EXISTS, and the note is only appended once.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const NOTE =
  "Granted one week after the 25 September 2026 due date to repay at the weekly 1% penalty. That " +
  "grace week ended Friday 2 October 2026; from 2 October the late penalty moves to 1% per day on " +
  "the total due (2,000 FCFA/day). The one grace week is locked at 2,000 (one weekly 1%), and daily " +
  "accrual runs from 2 October onward.";

await client.connect();
try {
  await client.query("BEGIN");

  await client.query("ALTER TABLE loans ADD COLUMN IF NOT EXISTS late_penalty_switch_on DATE");
  await client.query("ALTER TABLE loans ADD COLUMN IF NOT EXISTS late_penalty_period_after TEXT");
  await client.query("ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_late_penalty_period_after_check");
  await client.query(
    "ALTER TABLE loans ADD CONSTRAINT loans_late_penalty_period_after_check " +
      "CHECK (late_penalty_period_after IN ('day', 'week'))"
  );

  const { rows } = await client.query(
    "SELECT late_penalty_period, repaid_on FROM loans WHERE id = 'ane-jean-philippe' FOR UPDATE"
  );
  if (rows.length === 0) throw new Error("loan 'ane-jean-philippe' not found");
  if (rows[0].repaid_on !== null) throw new Error("ane-jean-philippe is already settled; not changing penalty terms");

  await client.query(
    `UPDATE loans
        SET late_penalty_switch_on = '2026-10-02',
            late_penalty_period_after = 'day',
            notes = CASE
              WHEN notes @> $1::jsonb THEN notes
              ELSE notes || $1::jsonb
            END,
            updated_at = now()
      WHERE id = 'ane-jean-philippe'`,
    [JSON.stringify([NOTE])]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query(
  `SELECT total_due, late_penalty_rate_per_week, late_penalty_period,
          late_penalty_switch_on, late_penalty_period_after, due_on
     FROM loans WHERE id = 'ane-jean-philippe'`
);
const l = rows[0];
console.log("ane-jean-philippe penalty terms:");
console.log(`  due ${new Date(l.due_on).toISOString().slice(0, 10)}, total due ${l.total_due}`);
console.log(`  phase 1: ${Number(l.late_penalty_rate_per_week) * 100}% per ${l.late_penalty_period}`);
console.log(
  `  switch:  ${new Date(l.late_penalty_switch_on).toISOString().slice(0, 10)} -> ` +
    `${Number(l.late_penalty_rate_per_week) * 100}% per ${l.late_penalty_period_after}`
);

await client.end();
