// 7 October 2026. Two cash events:
//
//  1. Internal transfer: 80,000 moved from the bank account to the founder's cash on hand.
//     Recorded as two legs sharing a transfer_id so the dashboard shows one "bank -> founder" line.
//
//  2. Claude Arnaud Niky Konan's second loan (konan-2) is disbursed: 200,000 released in cash,
//     275,000 due in one instalment one month later (7 November 2026) — a 75,000 cost of credit.
//     He had requested 250,000; 200,000 was agreed. The pending request moves into the active book
//     and the 200,000 goes out of the founder's cash on hand.
//
// His first Muthi loan was repaid in full, so this is recycled capital (the dashboard tags it
// "re-lent" automatically and does not count the principal as new money twice). No analyst
// commission: his loans came through JP's network, not an analyst referral.
//
// Idempotent and transactional: the transfer is inserted only if its transfer_id is absent, the
// loan is converted only if it is not already active, and the disbursement leg only if absent.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const TRANSFER_ID = "transfer-2026-10-07-bank-to-founder";
const FEES = [{ label: "Coût du crédit", amount: 75000 }];
const NOTES = [
  "200,000 disbursed in cash on 7 October 2026. 275,000 due in one instalment on 7 November 2026, a 75,000 cost of credit. He had requested 250,000; 200,000 was agreed.",
  "Late penalty: 1% per day on the outstanding balance once past the 7 November 2026 due date. This record carries it as simple daily, the most the application can express, so any overdue figure shown understates the real position once he is more than a day late.",
  "Repeat borrower: his first Muthi loan was repaid in full, so this re-lends capital already returned rather than new money the founders put in.",
];

await client.connect();
try {
  await client.query("BEGIN");

  // 1. Bank -> founder transfer, 80,000.
  const xfer = await client.query("SELECT 1 FROM cash_movements WHERE transfer_id = $1", [TRANSFER_ID]);
  if (xfer.rowCount === 0) {
    await client.query(
      `INSERT INTO cash_movements (account, amount, description, transfer_id, occurred_on) VALUES
         ('bank',    -80000, 'Cash moved from bank to founder', $1, '2026-10-07'),
         ('founder',  80000, 'Cash moved from bank to founder', $1, '2026-10-07')`,
      [TRANSFER_ID]
    );
    console.log("recorded 80,000 bank -> founder transfer");
  } else {
    console.log("transfer already present, left alone");
  }

  // 2. Convert konan-2 pending request -> active disbursed loan.
  const { rows } = await client.query("SELECT kind FROM loans WHERE id = 'konan-2' FOR UPDATE");
  if (rows.length === 0) throw new Error("loan 'konan-2' not found");

  if (rows[0].kind === "active") {
    console.log("konan-2 already active; terms left as they are");
  } else {
    await client.query(
      `UPDATE loans
          SET kind = 'active',
              principal = 200000,
              fees = $1::jsonb,
              total_due = 275000,
              disbursed_on = '2026-10-07',
              due_on = '2026-11-07',
              status = NULL,
              notes = $2::jsonb,
              updated_at = now()
        WHERE id = 'konan-2'`,
      [JSON.stringify(FEES), JSON.stringify(NOTES)]
    );
    console.log("konan-2 is now active (200,000 disbursed 2026-10-07, 275,000 due 2026-11-07)");
  }

  // 3. The 200,000 disbursement out of the founder's cash on hand.
  const disb = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = 'konan-2' AND amount = -200000 AND occurred_on = '2026-10-07'"
  );
  if (disb.rowCount === 0) {
    await client.query(
      `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
       VALUES ('founder', -200000, 'Disbursed to Claude Arnaud Niky Konan (second loan)', 'konan-2', '2026-10-07')`
    );
    console.log("recorded -200,000 founder disbursement");
  } else {
    console.log("disbursement cash leg already present");
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

// ---- verify -----------------------------------------------------------------
const f = (n) => Number(n).toLocaleString("en-US");
const { rows: loan } = await client.query(
  "SELECT kind, principal::bigint p, total_due::bigint d, disbursed_on, due_on, late_penalty_rate_per_week rate, late_penalty_period per FROM loans WHERE id = 'konan-2'"
);
console.log("\nkonan-2:", loan[0]);
const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("\ncash now");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(10)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(10)}`);

await client.end();
