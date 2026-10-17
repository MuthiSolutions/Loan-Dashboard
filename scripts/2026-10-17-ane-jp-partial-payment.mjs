// Ane Jean Philippe Ane ("JP"), loan id `ane-jean-philippe`.
// Partial repayment of 200,000 FCFA received Thursday 15 October 2026, to the BANK.
//
// This is NOT a settlement: repaid_on is deliberately left NULL so the loan stays on the
// active book. The remainder is still owed, and because the dashboard computes the penalty
// live off total_due and the days elapsed (see lib/loans.ts), the 1% per day late penalty
// keeps accruing on its own — outstanding = grossAmountDue(today) - amount_paid, and
// grossAmountDue keeps growing at ~2,020/day. We therefore do NOT touch the penalty config.
//
// Records:
//   1. amount_paid += 200,000 and last_payment_on = 2026-10-15 (repaid_on untouched).
//   2. A dated partial_payment event in repayment_history (feeds the credit score).
//   3. A +200,000 cash inflow on the BANK account, tagged to this loan, dated 15 October.
//
// Transactional and idempotent: re-running is a no-op once the matching cash movement exists.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN_ID = "ane-jean-philippe";
const PAYMENT = 200000;
const PAID_ON = "2026-10-15"; // Thursday
const CASH_ACCOUNT = "bank";
const CASH_DESC = "Ane Jean Philippe partial repayment (200,000 FCFA, 15 October 2026)";

const HISTORY_EVENT = {
  date: PAID_ON,
  type: "partial_payment",
  description:
    "Paid 200,000 FCFA on 15 October 2026 to the bank, against the balance. Not a settlement: " +
    "the remainder is still owed and the 1% per day late penalty continues to accrue on the total due.",
};

const NOTE =
  "Partial payment of 200,000 FCFA received 15 October 2026 (to the bank). The loan remains open: " +
  "the remainder is still payable and the 1% per day penalty keeps accruing until it is settled.";

await client.connect();
try {
  await client.query("BEGIN");

  const { rows } = await client.query(
    "SELECT borrower, total_due, amount_paid, last_payment_on, repaid_on, repayment_history FROM loans WHERE id = $1 FOR UPDATE",
    [LOAN_ID]
  );
  if (rows.length === 0) throw new Error(`loan '${LOAN_ID}' not found`);
  const loan = rows[0];
  console.log("BEFORE:", JSON.stringify(
    { borrower: loan.borrower, total_due: loan.total_due, amount_paid: loan.amount_paid, last_payment_on: loan.last_payment_on, repaid_on: loan.repaid_on },
    null, 2
  ));
  if (loan.repaid_on !== null) throw new Error(`${LOAN_ID} is already marked settled (repaid_on set); aborting`);

  const already = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND description = $2",
    [LOAN_ID, CASH_DESC]
  );
  if (already.rowCount > 0) {
    console.log("Already recorded (matching cash movement exists). No changes made.");
    await client.query("ROLLBACK");
    await client.end();
    process.exit(0);
  }

  const history = loan.repayment_history || [];
  history.push(HISTORY_EVENT);

  await client.query(
    `UPDATE loans
        SET amount_paid = COALESCE(amount_paid, 0) + $1,
            last_payment_on = $2,
            repayment_history = $3,
            notes = CASE WHEN notes @> $4::jsonb THEN notes ELSE notes || $4::jsonb END,
            updated_at = now()
      WHERE id = $5`,
    [PAYMENT, PAID_ON, JSON.stringify(history), JSON.stringify([NOTE]), LOAN_ID]
  );

  await client.query(
    "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ($1, $2, $3, $4, $5)",
    [CASH_ACCOUNT, PAYMENT, CASH_DESC, LOAN_ID, PAID_ON]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const after = await client.query(
  "SELECT amount_paid, last_payment_on, repaid_on FROM loans WHERE id = $1",
  [LOAN_ID]
);
console.log("AFTER :", JSON.stringify(after.rows[0], null, 2));
const bal = await client.query(
  "SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account"
);
console.log("CASH  :", JSON.stringify(bal.rows));
await client.end();
