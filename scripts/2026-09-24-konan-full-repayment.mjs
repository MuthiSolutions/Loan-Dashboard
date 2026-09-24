import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

// Konan (Claude Arnaud): 200,000 due on 18 September, 1% per day late penalty by agreement.
// Paid in full on 24 September, 6 days late: 200,000 + 6 × 2,000 = 212,000.
// Received as 150,000 to the bank and 62,000 held by founder.
const { rows } = await client.query("SELECT repayment_history, notes FROM loans WHERE id = 'konan'");
const history = rows[0].repayment_history || [];
history.push({
  date: "2026-09-24",
  type: "full_payment",
  description:
    "Paid the full 212,000 FCFA: 200,000 due plus 12,000 late penalty (6 days at 1% per day), 6 days after the 18 September due date.",
});

const notes = [
  ...(rows[0].notes || []),
  "Settled in full at 212,000 FCFA on 24 September, 6 days after the 18 September due date, including a 12,000 FCFA late penalty (6 days × 1%).",
];

await client.query(
  "UPDATE loans SET amount_paid = $1, last_payment_on = $2, repaid_on = $3, repayment_history = $4, notes = $5 WHERE id = $6",
  [212000, "2026-09-24", "2026-09-24", JSON.stringify(history), JSON.stringify(notes), "konan"]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('bank', 150000, 'Claude Arnaud Konan loan repaid in full (bank portion)', 'konan', '2026-09-24')"
);
await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('founder', 62000, 'Claude Arnaud Konan loan repaid in full (founder portion)', 'konan', '2026-09-24')"
);

const check = await client.query("SELECT amount_paid, last_payment_on, repaid_on, notes, repayment_history FROM loans WHERE id = 'konan'");
console.log(JSON.stringify(check.rows[0], null, 2));
const bal = await client.query("SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account");
console.log(JSON.stringify(bal.rows));
await client.end();
