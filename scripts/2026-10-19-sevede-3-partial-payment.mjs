// 19 October 2026 — Franck Ismael Maycob Sevede sent 150,000 FCFA back yesterday (18 October 2026),
// against his THIRD loan (sevede-3: 150,000 lent, 200,000 due 5 November 2026).
//
// This clears all but 50,000 of the third loan (200,000 - 150,000 = 50,000 remaining). It is NOT a
// settlement: repaid_on stays NULL so the loan stays active with 50,000 still owed. His SECOND loan
// (sevede-2, 125,000 due 5 November) is untouched and remains fully outstanding.
//
// ACCOUNT: his first-loan repayment landed in the BANK (2 October), so this defaults to bank. Change
// PAID_TO to "founder" below before running if the 150,000 came in as cash on hand instead.
//
// Transactional and idempotent: re-running is a no-op once the matching cash movement exists.

import pg from "pg";
import { readFileSync } from "node:fs";

const PAID_TO = "bank"; // "bank" or "founder"

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN_ID = "sevede-3";
const PAYMENT = 150000;
const PAID_ON = "2026-10-18";
const CASH_DESC = "Franck Sevede partial repayment, third loan (150,000 FCFA, 18 October 2026)";

const HISTORY_EVENT = {
  date: PAID_ON,
  type: "partial_payment",
  description:
    "Paid 150,000 FCFA on 18 October 2026 against the third loan (200,000 due). 50,000 remains on this loan; " +
    "his second loan (125,000) is still fully outstanding. Not a settlement.",
};

const NOTE =
  "Partial payment of 150,000 FCFA received 18 October 2026 against the third loan. 50,000 remains outstanding " +
  "on it; the second loan (125,000) is unaffected and still fully owed.";

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");

  const { rows } = await client.query(
    "SELECT borrower, total_due, amount_paid, repaid_on, repayment_history FROM loans WHERE id = $1 FOR UPDATE",
    [LOAN_ID]
  );
  if (rows.length === 0) throw new Error(`loan '${LOAN_ID}' not found`);
  const loan = rows[0];
  console.log("BEFORE:", JSON.stringify({ borrower: loan.borrower, total_due: loan.total_due, amount_paid: loan.amount_paid, repaid_on: loan.repaid_on }, null, 2));
  if (loan.repaid_on !== null) throw new Error(`${LOAN_ID} is already settled; aborting`);

  const already = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND description = $2",
    [LOAN_ID, CASH_DESC]
  );
  if (already.rowCount > 0) {
    console.log("Already recorded; no changes made.");
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
    [PAID_TO, PAYMENT, CASH_DESC, LOAN_ID, PAID_ON]
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
const bal = await client.query("SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account");
console.log("CASH  :", JSON.stringify(bal.rows));
await client.end();
