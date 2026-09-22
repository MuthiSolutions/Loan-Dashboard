import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

const { rows } = await client.query("SELECT repayment_history FROM loans WHERE id = 'praia'");
const history = rows[0].repayment_history;
history.push({
  date: "2026-09-09",
  type: "full_payment",
  description: "Final 680,000 FCFA received, closing out the 6,680,000 FCFA settlement in full.",
});

await client.query(
  "UPDATE loans SET amount_paid = $1, last_payment_on = $2, repaid_on = $3, repayment_history = $4, notes = $5 WHERE id = $6",
  [
    6680000,
    "2026-09-09",
    "2026-09-09",
    JSON.stringify(history),
    JSON.stringify(["Settled in full at 6,680,000 FCFA total (1,680,000 in fees and penalty on the 5,000,000 principal)."]),
    "praia",
  ]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('founder', 680000, 'PRAÏA final settlement payment received', 'praia', '2026-09-09')"
);

const check = await client.query("SELECT amount_paid, repaid_on, notes FROM loans WHERE id = 'praia'");
console.log(JSON.stringify(check.rows[0], null, 2));
await client.end();
