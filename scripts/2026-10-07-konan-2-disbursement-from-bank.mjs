// Correction: Claude Arnaud's 200,000 second-loan disbursement on 7 October 2026 went out of the
// bank account, not the founder's cash. Re-point that one cash-movement leg from 'founder' to
// 'bank'. The 80,000 bank -> founder transfer and all loan terms are unchanged.
//
// Idempotent: only the founder-side disbursement leg is moved, and only if it is still there.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

await client.connect();
try {
  const res = await client.query(
    `UPDATE cash_movements
        SET account = 'bank'
      WHERE loan_id = 'konan-2' AND amount = -200000 AND occurred_on = '2026-10-07' AND account = 'founder'`
  );
  if (res.rowCount === 1) console.log("moved the 200,000 disbursement from founder to bank");
  else console.log("nothing to change (already on bank, or leg not found)");
} finally {
  // single statement
}

const f = (n) => Number(n).toLocaleString("en-US");
const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("\ncash now");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(10)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(10)}`);
await client.end();
