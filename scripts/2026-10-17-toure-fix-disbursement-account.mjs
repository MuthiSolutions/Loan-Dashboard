// Correction: the Toure Alhassane disbursement (150,000 on 2026-10-17) was first recorded against
// the FOUNDER cash account; it actually left the BANK. This moves that single cash leg founder -> bank.
// The loan record itself is unaffected. Idempotent: re-running after the fix changes nothing.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

await client.connect();
try {
  await client.query("BEGIN");

  const { rows: legs } = await client.query(
    "SELECT id, account, amount, occurred_on FROM cash_movements WHERE loan_id = 'toure-alhassane' AND amount = -150000 AND occurred_on = '2026-10-17' ORDER BY id"
  );
  console.log("Toure disbursement cash legs found:", JSON.stringify(legs));
  if (legs.length > 1) throw new Error(`expected 1 disbursement leg, found ${legs.length}; aborting so nothing is double-moved`);

  const res = await client.query(
    "UPDATE cash_movements SET account = 'bank' WHERE loan_id = 'toure-alhassane' AND amount = -150000 AND occurred_on = '2026-10-17' AND account = 'founder'"
  );
  console.log(res.rowCount === 1 ? "moved the leg founder -> bank" : "no founder leg to move (already bank, or not found)");

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const f = (x) => Number(x).toLocaleString("en-US");
const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("cash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);
await client.end();
