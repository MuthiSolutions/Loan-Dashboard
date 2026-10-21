// 21 October 2026 — fix Ane Jean Philippe penalty base after partial payment
//
// Timeline:
//   Aug 25:  Disbursed 150,000 FCFA. Total due = 200,000 (25% flat interest).
//   Sep 25:  Due date. No payment.
//   Oct 2:   Grace week ends. Base for daily penalty = 202,000 (200k × 1.01^1 week).
//             Daily: 1%/day compound on 202,000.
//   Oct 15:  Payment of 200,000 received.
//             Amount owed at Oct 15 = 202,000 × 1.01^13 = ~228,380
//             After 200,000 payment → net remaining = ~28,380
//   Oct 16+: 1%/day compound on net remaining (~28,380) only.
//
// Fix: set manual_amount_override = net_remaining, late_penalty_switch_on = 2026-10-15
// so the dashboard calculates daily penalty on the correct base from Oct 15 onward.
//
// Idempotent: safe to re-run.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const f = (x) => Math.round(Number(x)).toLocaleString("en-US");

await client.connect();

// ── Calculation ──────────────────────────────────────────────────────────────
const graceBase   = 202_000;          // 200k × 1.01 after 1 grace week
const daysOct2to15 = 13;              // Oct 2 → Oct 15 inclusive of start
const owedAtOct15 = graceBase * Math.pow(1.01, daysOct2to15);
const paid        = 200_000;
const netRemaining = Math.round(owedAtOct15 - paid);

const today = new Date("2026-10-21");
const switchDate = new Date("2026-10-15");
const daysOnNet = Math.floor((today - switchDate) / 86_400_000); // days since Oct 15
const penaltySinceSwitch = Math.round(netRemaining * (Math.pow(1.01, daysOnNet) - 1));
const totalOwedToday = netRemaining + penaltySinceSwitch;

console.log("\n── PENALTY MATH ──");
console.log(`  grace base (after 1-week grace):   ${f(graceBase)}`);
console.log(`  days compounding Oct 2→15:         ${daysOct2to15}`);
console.log(`  total owed at Oct 15:              ${f(owedAtOct15)}`);
console.log(`  payment received Oct 15:           ${f(paid)}`);
console.log(`  net remaining Oct 15:              ${f(netRemaining)}`);
console.log(`  days since Oct 15 (to Oct 21):    ${daysOnNet}`);
console.log(`  penalty on net ${f(netRemaining)} × 1.01^${daysOnNet}: ${f(penaltySinceSwitch)}`);
console.log(`  TOTAL OWED TODAY (21 Oct):         ${f(totalOwedToday)}`);

// ── Current state ────────────────────────────────────────────────────────────
const { rows } = await client.query(`
  SELECT manual_amount_override, late_penalty_switch_on
  FROM loans WHERE id = 'ane-jean-philippe'
`);
const loan = rows[0];
const alreadySet =
  Number(loan.manual_amount_override) === netRemaining &&
  loan.late_penalty_switch_on?.toISOString?.()?.slice(0, 10) === "2026-10-15";

if (alreadySet) {
  console.log("\n✓ Already up to date — nothing to change.");
  await client.end();
  process.exit(0);
}

// ── Apply fix ────────────────────────────────────────────────────────────────
await client.query("BEGIN");

await client.query(`
  UPDATE loans SET
    manual_amount_override   = $1,
    late_penalty_switch_on   = '2026-10-15',
    late_penalty_period_after = 'day'
  WHERE id = 'ane-jean-philippe'
`, [netRemaining]);

const noteText = `15 October 2026: 200,000 FCFA received. Total owed at that date was ${f(owedAtOct15)} FCFA (202,000 grace base × 1.01^13 days). After deducting the 200,000 payment, net remaining = ${f(netRemaining)} FCFA. From 15 October onward the daily 1% compound penalty runs on ${f(netRemaining)} FCFA only. manual_amount_override set to ${netRemaining}; late_penalty_switch_on updated to 2026-10-15.`;

await client.query(`
  UPDATE loans
  SET notes = notes || $1::jsonb
  WHERE id = 'ane-jean-philippe'
`, [JSON.stringify([{ text: noteText }])]);

await client.query("COMMIT");

console.log("\n✓ Done:");
console.log(`  manual_amount_override  → ${f(netRemaining)}`);
console.log(`  late_penalty_switch_on  → 2026-10-15`);
console.log(`  note appended`);

await client.end();
