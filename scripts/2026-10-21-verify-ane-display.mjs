// READ-ONLY verification for Ane Jean Philippe's dashboard display.
// No writes. Confirms the DB anchor is in place and previews what the CORRECTED
// formula (lib/loans.ts) will show, so you can sanity-check before/after deploy.
//
//   outstanding at switch = penalty_switch_base - amount_paid   (228,000 - 200,000 = 28,000)
//   still owed today      = outstanding * 1.01 ^ (days since switch)
//   gross today           = amount_paid + still owed
//   profit                = gross - principal
//
// Run:  node scripts/2026-10-21-verify-ane-display.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

// Mirror lib/db.ts: return DATE columns as plain 'YYYY-MM-DD' strings, not JS Date
// objects. Without this a standalone script gets Date objects and the math breaks.
pg.types.setTypeParser(1082, (val) => val);

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN_ID = "ane-jean-philippe";
const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";

await client.connect();
const { rows } = await client.query(
  `SELECT borrower, principal, total_due, amount_paid, due_on,
          late_penalty_rate_per_week, late_penalty_period,
          late_penalty_switch_on, late_penalty_period_after,
          penalty_switch_base, manual_amount_override
     FROM loans WHERE id = $1`,
  [LOAN_ID]
);
await client.end();

if (rows.length === 0) throw new Error(`loan '${LOAN_ID}' not found`);
const l = rows[0];

console.log("DB ROW:");
console.log(JSON.stringify(l, null, 2));

const principal = Number(l.principal);
const paid = Number(l.amount_paid ?? 0);
const base = l.penalty_switch_base === null ? null : Number(l.penalty_switch_base);
const rate = Number(l.late_penalty_rate_per_week);

// Days since the cadence switch (daily cadence after the switch).
const switchOn = new Date(`${l.late_penalty_switch_on}T00:00:00`);
const today = new Date();
const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const phase2Units = Math.max(0, Math.round((startOfToday - switchOn) / 86400000));

console.log("\n--- CHECKS ---");
console.log("manual_amount_override is cleared:", l.manual_amount_override === null ? "YES ✓" : `NO ✗ (= ${l.manual_amount_override})`);
console.log("penalty_switch_base set:", base === 228000 ? "228,000 ✓" : `${base} (expected 228,000)`);
console.log("switch cadence after:", l.late_penalty_period_after, l.late_penalty_period_after === "day" ? "✓" : "(expected day)");
console.log("days since switch (phase2Units):", phase2Units);

if (base == null) {
  console.log("\nNo anchor set — formula would fall back to totalDue two-phase.");
} else {
  const outstandingAtSwitch = Math.max(0, base - paid);
  const stillOwed = Math.round(outstandingAtSwitch * Math.pow(1 + rate, phase2Units));
  const gross = paid + stillOwed;
  const profit = gross - principal;

  console.log("\n--- CORRECTED FORMULA PREVIEW (what the dashboard will show) ---");
  console.log("outstanding at switch :", fmt(outstandingAtSwitch), `(${fmt(base)} - ${fmt(paid)})`);
  console.log(`compounding           : ${fmt(outstandingAtSwitch)} × 1.01^${phase2Units}`);
  console.log("STILL OWED            :", fmt(stillOwed));
  console.log("GROSS (total due)     :", fmt(gross));
  console.log("RECEIVED              :", fmt(paid));
  console.log("PROFIT                :", fmt(profit));
}
