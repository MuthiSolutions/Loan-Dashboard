// 19 October 2026 — fix commission status lifecycle rule
//
// Rule correction: commissions should be 'accruing' while the loan is still open,
// 'payable' only once the loan is fully repaid (repaid_on IS NOT NULL),
// 'paid' once the analysts have actually received the cash.
//
// This script:
//   1. Adds 'accruing' to the commissions.status CHECK constraint
//   2. Flips all open-loan commissions from 'payable' → 'accruing'
//   3. Reports the final table state
//
// Idempotent: safe to re-run.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");

  // 1. Drop the old CHECK constraint and add a new one that includes 'accruing'
  //    PostgreSQL doesn't let you ALTER a CHECK in-place; drop + add.
  //    We find the constraint name dynamically to avoid hard-coding it.
  const { rows: constraints } = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'commissions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  `);

  for (const c of constraints) {
    await client.query(`ALTER TABLE commissions DROP CONSTRAINT "${c.conname}"`);
    console.log(`dropped constraint: ${c.conname}`);
  }

  await client.query(`
    ALTER TABLE commissions
    ADD CONSTRAINT commissions_status_check
    CHECK (status IN ('accruing', 'payable', 'paid'))
  `);
  console.log("added new status check: accruing | payable | paid");

  // 2. Flip open-loan commissions payable → accruing
  //    A loan is open when loans.repaid_on IS NULL
  const { rowCount } = await client.query(`
    UPDATE commissions c
    SET status = 'accruing'
    FROM loans l
    WHERE c.loan_id = l.id
      AND l.repaid_on IS NULL
      AND c.status = 'payable'
  `);
  console.log(`flipped ${rowCount} commission(s) payable → accruing`);

  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
}

// 3. Report
const { rows } = await client.query(`
  SELECT c.loan_id, c.amount::bigint AS amount, c.status, l.repaid_on
  FROM commissions c
  JOIN loans l ON l.id = c.loan_id
  ORDER BY c.status, c.loan_id
`);

console.log("\nall commissions:");
let accruing = 0, payable = 0, paid = 0;
for (const r of rows) {
  const repaid = r.repaid_on ? r.repaid_on.toISOString().slice(0,10) : "open";
  console.log(`  ${r.loan_id.padEnd(22)} ${f(r.amount).padStart(9)}  ${r.status.padEnd(9)}  loan:${repaid}`);
  if (r.status === "accruing") accruing += Number(r.amount);
  else if (r.status === "payable") payable += Number(r.amount);
  else paid += Number(r.amount);
}
console.log(`\n  accruing: ${f(accruing)}  |  payable: ${f(payable)}  |  paid: ${f(paid)}`);

await client.end();
