// 21 October 2026 — Set correct penalty base for Ane Jean Philippe after partial payment
//
// Timeline (authoritative):
//   Aug 25:  Disbursed 150,000 FCFA. Total due = 200,000 (37,500 interest + 12,500 fee).
//   Sep 25:  Due date. No payment.
//   Oct 2:   Grace week ends. Daily penalty starts. Base = 202,000.
//   Oct 15:  Amount communicated to borrower = 228,000 FCFA (agreed field figure).
//             Payment of 200,000 FCFA received.
//             Net remaining = 228,000 − 200,000 = 28,000 FCFA.
//   Oct 16+: 1%/day compound on 28,000 only.
//
// This script: sets manual_amount_override = 28000, late_penalty_switch_on = 2026-10-15
// Idempotent — exits cleanly if already set.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");

const client = new pg.Client({
  connectionString: envLine.slice("DATABASE_URL=".length).trim(),
});

const f = (x) => Math.round(Number(x)).toLocaleString("en-US");

await client.connect();

// ── Calculation (using communicated field figure) ─────────────────────────────
const owedAtOct15  = 228_000;  // figure communicated to borrower on Oct 15
const paid         = 200_000;
const netRemaining = owedAtOct15 - paid;  // 28,000

const today      = new Date("2026-10-21");
const switchDate = new Date("2026-10-15");
const daysOnNet  = Math.floor((today - switchDate) / 86_400_000);
const totalOwedToday = Math.round(netRemaining * Math.pow(1.01, daysOnNet));

console.log("\n── PENALTY MATH (CORRECTED) ──");
console.log(`  total owed communicated Oct 15:  ${f(owedAtOct15)} FCFA`);
console.log(`  payment received Oct 15:         ${f(paid)} FCFA`);
console.log(`  net remaining (new base):        ${f(netRemaining)} FCFA`);
console.log(`  days Oct 15 → Oct 21:            ${daysOnNet}`);
console.log(`  28,000 × 1.01^${daysOnNet}:               ${f(totalOwedToday)} FCFA`);
console.log(`  TOTAL OWED TODAY (21 Oct):       ${f(totalOwedToday)} FCFA`);

// ── Check current state ───────────────────────────────────────────────────────
const { rows } = await client.query(`
  SELECT manual_amount_override, late_penalty_switch_on, notes
  FROM loans WHERE id = 'ane-jean-philippe'
`);
const loan = rows[0];
const currentOverride = loan.manual_amount_override;
const currentSwitch   = loan.late_penalty_switch_on?.toISOString?.()?.slice(0, 10);

console.log(`\n── CURRENT DB STATE ──`);
console.log(`  manual_amount_override:  ${currentOverride ?? "null"}`);
console.log(`  late_penalty_switch_on:  ${currentSwitch ?? "null"}`);

if (Number(currentOverride) === netRemaining && currentSwitch === "2026-10-15") {
  console.log("\n✓ Already correct — nothing to change.");
  await client.end();
  process.exit(0);
}

// ── Apply fix ─────────────────────────────────────────────────────────────────
await client.query("BEGIN");

await client.query(`
  UPDATE loans SET
    manual_amount_override    = $1,
    late_penalty_switch_on    = '2026-10-15',
    late_penalty_period_after = 'day'
  WHERE id = 'ane-jean-philippe'
`, [netRemaining]);

// Append note as a string to the jsonb array
const noteText = `21 Oct 2026 CORRECTION: Amount communicated to Ane JP on 15 Oct was 228,000 FCFA (agreed field figure). Payment 200,000 FCFA received. Net remaining = 28,000 FCFA. Daily 1% runs on 28,000 from 15 Oct onward. manual_amount_override = 28000; late_penalty_switch_on = 2026-10-15. Total owed as of 21 Oct: ${f(totalOwedToday)} FCFA.`;

await client.query(`
  UPDATE loans
  SET notes = COALESCE(notes, '[]'::jsonb) || to_jsonb($1::text)
  WHERE id = 'ane-jean-philippe'
`, [noteText]);

await client.query("COMMIT");

console.log("\n✓ DONE:");
console.log(`  manual_amount_override  → ${f(netRemaining)}`);
console.log(`  late_penalty_switch_on  → 2026-10-15`);
console.log(`  note appended`);
console.log(`\n  Dashboard will now compound 1%/day on ${f(netRemaining)} FCFA from 15 Oct.`);
console.log(`  Today (21 Oct, day 6): ${f(totalOwedToday)} FCFA owed.`);

await client.end();
