// 21 October 2026 — Add penalty_switch_base column to loans table
//
// Problem: manual_amount_override is a static pin (bypasses compounding entirely).
// We were using it as a "compound from this base" but the code doesn't do that.
// Result: dashboard showed -122,000 FCFA profit and 0 still owed for Ane JP.
//
// Fix: add penalty_switch_base (bigint) — the gross amount owed at the point of
// the cadence switch. formulaAmountDue computes phase2 by compounding ON TOP of
// this value rather than on totalDue.
//
// For Ane JP:
//   penalty_switch_base = 228,000   (amount owed and communicated on 15 Oct)
//   late_penalty_switch_on = 2026-10-15
//   manual_amount_override = NULL   (clear the wrong static pin)
//
// Idempotent — safe to re-run.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");

const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });
await client.connect();

// ── 1. Add column if missing ──────────────────────────────────────────────────
const { rows: cols } = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'loans' AND column_name = 'penalty_switch_base'
`);

if (cols.length === 0) {
  await client.query(`ALTER TABLE loans ADD COLUMN penalty_switch_base bigint`);
  console.log("✓ Column penalty_switch_base added");
} else {
  console.log("✓ Column penalty_switch_base already exists");
}

// ── 2. Set Ane JP values ──────────────────────────────────────────────────────
await client.query("BEGIN");

await client.query(`
  UPDATE loans SET
    penalty_switch_base    = 228000,
    manual_amount_override = NULL,
    late_penalty_switch_on    = '2026-10-15',
    late_penalty_period_after = 'day'
  WHERE id = 'ane-jean-philippe'
`);

await client.query("COMMIT");

// ── 3. Verify ────────────────────────────────────────────────────────────────
const { rows } = await client.query(`
  SELECT
    manual_amount_override,
    penalty_switch_base,
    late_penalty_switch_on,
    late_penalty_period_after
  FROM loans WHERE id = 'ane-jean-philippe'
`);
const r = rows[0];

console.log("\n── ANE JP AFTER MIGRATION ──");
console.log(`  manual_amount_override:   ${r.manual_amount_override ?? "null (✓ cleared)"}`);
console.log(`  penalty_switch_base:      ${r.penalty_switch_base}`);
console.log(`  late_penalty_switch_on:   ${r.late_penalty_switch_on?.toISOString?.()?.slice(0, 10)}`);
console.log(`  late_penalty_period_after:${r.late_penalty_period_after}`);

// Preview expected calculation
const base   = 228_000;
const rate   = 0.01;
const days   = 6; // Oct 15 → Oct 21
const today  = Math.round(base * Math.pow(1 + rate, days));
console.log(`\n── EXPECTED DASHBOARD OUTPUT (21 Oct) ──`);
console.log(`  grossAmountDue = penalty_switch_base × 1.01^${days} = ${today.toLocaleString()} FCFA`);
console.log(`  amountPaid     = 200,000 FCFA`);
console.log(`  stillOwed      = ${(today - 200_000).toLocaleString()} FCFA`);
console.log(`  profit         = ${(today - 150_000).toLocaleString()} FCFA`);

await client.end();
