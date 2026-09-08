import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

// 150,000 taken back from the bank to the founder.
const xfer = "xfer-2026-09-08-a";
await client.query(
  "INSERT INTO cash_movements (account, amount, description, transfer_id, occurred_on) VALUES ('bank', -150000, 'Taken back by the founder', $1, '2026-09-08')",
  [xfer]
);
await client.query(
  "INSERT INTO cash_movements (account, amount, description, transfer_id, occurred_on) VALUES ('founder', 150000, 'Taken back by the founder', $1, '2026-09-08')",
  [xfer]
);

// PRAÏA: final settlement agreed at 6,680,000 total; 2,000,000 received today toward it
// (680,000 still pending, expected later the same day), collected by the founder.
const { rows } = await client.query("SELECT repayment_history FROM loans WHERE id = 'praia'");
const history = rows[0].repayment_history;
history.push({
  date: "2026-09-08",
  type: "partial_payment",
  description: "2,000,000 FCFA received from the founder; the remaining 680,000 FCFA committed for later the same day.",
});

await client.query(
  "UPDATE loans SET manual_amount_override = $1, amount_paid = $2, last_payment_on = $3, repayment_history = $4, notes = $5 WHERE id = $6",
  [
    6680000,
    6000000,
    "2026-09-08",
    JSON.stringify(history),
    JSON.stringify([
      "Final settlement agreed at 6,680,000 FCFA total (1,680,000 in fees and penalty on the 5,000,000 principal). 6,000,000 received to date, 680,000 FCFA remaining.",
    ]),
    "praia",
  ]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('founder', 2000000, 'PRAÏA settlement payment received', 'praia', '2026-09-08')"
);

const cash = await client.query("SELECT account, SUM(amount) AS total FROM cash_movements GROUP BY account");
console.log(cash.rows);
await client.end();
