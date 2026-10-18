// 17 October 2026 — 200,000 FCFA paid from the founder's cash on hand as a salary advance to
// Louis Boah. This is an operating outflow, not a loan: no loan_id, no entry on the loan book.
// It simply reduces deployable founder cash.
//
// Idempotent and transactional: the movement is inserted only if an identical one is not already
// present (same account, amount, date, description).

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const MOVE = {
  account: "founder",
  amount: -200000,
  description: "Advance on salary — Louis Boah",
  occurred_on: "2026-10-17",
};

await client.connect();
try {
  await client.query("BEGIN");

  const dup = await client.query(
    "SELECT 1 FROM cash_movements WHERE account = $1 AND amount = $2 AND occurred_on = $3 AND description = $4",
    [MOVE.account, MOVE.amount, MOVE.occurred_on, MOVE.description]
  );
  if (dup.rowCount > 0) {
    console.log("Already recorded; no changes made.");
    await client.query("ROLLBACK");
  } else {
    await client.query(
      "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ($1, $2, $3, NULL, $4)",
      [MOVE.account, MOVE.amount, MOVE.description, MOVE.occurred_on]
    );
    console.log(`recorded ${MOVE.amount.toLocaleString("en-US")} ${MOVE.account}: ${MOVE.description}`);
    await client.query("COMMIT");
  }
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
