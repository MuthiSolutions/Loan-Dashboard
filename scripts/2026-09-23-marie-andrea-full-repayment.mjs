import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

const { rows } = await client.query("SELECT repayment_history FROM loans WHERE id = 'koizan-marie-andrea'");
const history = rows[0].repayment_history || [];
history.push({
  date: "2026-09-23",
  type: "full_payment",
  description: "Paid the full 350,000 FCFA, ahead of the 28 September due date.",
});

await client.query(
  "UPDATE loans SET amount_paid = $1, last_payment_on = $2, repaid_on = $3, repayment_history = $4, notes = $5 WHERE id = $6",
  [
    350000,
    "2026-09-23",
    "2026-09-23",
    JSON.stringify(history),
    JSON.stringify(["Settled in full at 350,000 FCFA, paid ahead of the 28 September due date."]),
    "koizan-marie-andrea",
  ]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('bank', 300000, 'Marie Andréa Koizan loan repaid in full (bank portion)', 'koizan-marie-andrea', '2026-09-23')"
);
await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('founder', 50000, 'Marie Andréa Koizan loan repaid in full (founder portion)', 'koizan-marie-andrea', '2026-09-23')"
);

const check = await client.query("SELECT amount_paid, repaid_on, notes FROM loans WHERE id = 'koizan-marie-andrea'");
console.log(JSON.stringify(check.rows[0], null, 2));
await client.end();
