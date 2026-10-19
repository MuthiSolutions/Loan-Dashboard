// 19 October 2026 — October salaries paid from the founder's cash on hand (operating outflows,
// no loan_id). Bank holds only ~200,000 right now, so these come out of founder cash.
//
//   - JP Bénie (founder / Associé-Gérant), own salary: 550,000
//   - Emmanuel Ouattara-Boni (DAF): 200,000
//   - Roxane Akossan Davila (associate / assistant): 100,000
//
// Transactional and idempotent: each movement is inserted only if an identical one (account, amount,
// date, description) is not already present.

import pg from "pg";
import { readFileSync } from "node:fs";

const PAYROLL_FROM = "founder"; // bank only holds ~200k; salaries come from founder cash

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const OCCURRED_ON = "2026-10-19";
const MOVES = [
  { amount: -550000, description: "Salary — JP Bénie (founder / Associé-Gérant), October 2026" },
  { amount: -200000, description: "Salary — Emmanuel Ouattara-Boni (DAF), October 2026" },
  { amount: -100000, description: "Salary — Roxane Akossan Davila (associate), October 2026" },
];

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");
  for (const m of MOVES) {
    const dup = await client.query(
      "SELECT 1 FROM cash_movements WHERE account = $1 AND amount = $2 AND occurred_on = $3 AND description = $4",
      [PAYROLL_FROM, m.amount, OCCURRED_ON, m.description]
    );
    if (dup.rowCount > 0) {
      console.log(`skip (already present): ${m.description}`);
      continue;
    }
    await client.query(
      "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ($1, $2, $3, NULL, $4)",
      [PAYROLL_FROM, m.amount, m.description, OCCURRED_ON]
    );
    console.log(`recorded ${f(m.amount)} ${PAYROLL_FROM}: ${m.description}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("cash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);
await client.end();
