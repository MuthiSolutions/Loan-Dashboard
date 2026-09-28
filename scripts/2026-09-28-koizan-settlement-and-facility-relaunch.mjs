import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

// ---------------------------------------------------------------------------
// 1. David Allan (Amoi David-Allan Koizan) settles in full.
//
//    400,000 was due on 18 September. His convention carries a 1% per day late
//    penalty by separate agreement. He paid on 28 September, 10 days late:
//    400,000 x (1 + 0.01 x 10) = 440,000.
//
//    He had promised on 23 September to pay on the 25th and did not, so that
//    promise is recorded as broken before the settlement event.
// ---------------------------------------------------------------------------
const davidAllan = await client.query(
  "SELECT repayment_history, notes FROM loans WHERE id = 'koizan'"
);
const daHistory = davidAllan.rows[0].repayment_history || [];
daHistory.push({
  date: "2026-09-25",
  type: "broken_promise",
  description:
    "Did not pay on 25 September as promised on 23 September. Settled three days later.",
});
daHistory.push({
  date: "2026-09-28",
  type: "full_payment",
  description:
    "Paid the full 440,000 FCFA: 400,000 due plus 40,000 late penalty (10 days at 1% per day), 10 days after the 18 September due date.",
});
const daNotes = [
  ...(davidAllan.rows[0].notes || []),
  "Settled in full at 440,000 FCFA on 28 September, 10 days after the 18 September due date, including a 40,000 FCFA late penalty (10 days at 1%). Received as 300,000 to the bank and 140,000 to the founder.",
];

await client.query(
  "UPDATE loans SET amount_paid = $1, last_payment_on = $2, repaid_on = $3, repayment_history = $4, notes = $5 WHERE id = $6",
  [440000, "2026-09-28", "2026-09-28", JSON.stringify(daHistory), JSON.stringify(daNotes), "koizan"]
);

// Externally received money, so no transfer_id: these are not two legs of an
// internal move between our own accounts, they are one inbound payment split
// across where it landed.
await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('bank', 300000, 'Amoi David-Allan Koizan loan repaid in full (bank portion)', 'koizan', '2026-09-28')"
);
await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('founder', 140000, 'Amoi David-Allan Koizan loan repaid in full (founder portion, held by Jean-Philippe)', 'koizan', '2026-09-28')"
);

// ---------------------------------------------------------------------------
// 2. Marie Andréa Koizan: first cycle of the renewable facility.
//
//    Convention de crédit renouvelable signed 25 September 2026, twelve months
//    to 25 September 2027. Ceiling 300,000 per cycle, 50,000 of fees, 350,000
//    due per cycle, repayable one calendar month after each drawdown. Article
//    5.1 releases the first drawdown at signature, so cycle 1 runs from
//    25 September to 25 October.
//
//    Article 7 of the signed convention sets the late penalty at 1% per day
//    COMPOUNDED DAILY. This application can only express a simple rate per
//    period, so the row below uses 1% per day simple. Any overdue figure the
//    dashboard shows for this loan is therefore a floor, not the contractual
//    amount. Recorded in the notes so nobody reads the screen as the debt.
// ---------------------------------------------------------------------------
const nextSort = await client.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM loans");
const sortOrder = nextSort.rows[0].n;

const facilityNotes = [
  "Cycle 1 of the renewable credit facility signed 25 September 2026 (twelve months, to 25 September 2027). Each cycle: 300,000 released, 50,000 of fees, 350,000 due one calendar month later. Repayment in full reopens the next cycle automatically unless Muthi declines it.",
  "Article 7 of the signed convention sets the late penalty at 1% per day compounded daily. This record carries 1% per day simple, which is the most the application can express, so any overdue amount shown here understates the contract once she is more than one day late.",
  "The signed convention states a nationality, a date and place of birth, a CNI number and an address for the borrower. None of those particulars appear anywhere in her file: both financing sheets on record show them as \"À renseigner\" and her identity card has never been produced. The identity block needs to be verified against her actual card and corrected by avenant.",
];

await client.query(
  `INSERT INTO loans (
     id, kind, borrower, purpose, contact, principal, fees, total_due,
     disbursed_on, due_on, late_penalty_rate_per_week, late_penalty_period,
     contract_ref, related_party, profession, notes, sort_order
   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
  [
    "koizan-marie-andrea-2",
    "active",
    "Marie Andréa Koizan",
    "Personal financing (renewable facility, cycle 1)",
    "+33 6 69 94 78 07",
    300000,
    JSON.stringify([{ label: "Financing fee", amount: 50000 }]),
    350000,
    "2026-09-25",
    "2026-10-25",
    0.01,
    "day",
    "Convention de crédit renouvelable, 25 septembre 2026",
    false,
    "Étudiante",
    JSON.stringify(facilityNotes),
    sortOrder,
  ]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('bank', -300000, 'First drawdown to Marie Andréa Koizan under the renewable facility (cycle 1)', 'koizan-marie-andrea-2', '2026-09-25')"
);

// ---------------------------------------------------------------------------
// 3. Verify
// ---------------------------------------------------------------------------
const da = await client.query(
  "SELECT id, amount_paid, last_payment_on, repaid_on, repayment_history, notes FROM loans WHERE id = 'koizan'"
);
console.log("--- David Allan ---");
console.log(JSON.stringify(da.rows[0], null, 2));

const ma = await client.query(
  "SELECT id, borrower, kind, principal, fees, total_due, disbursed_on, due_on, late_penalty_rate_per_week, late_penalty_period, contract_ref, sort_order FROM loans WHERE id = 'koizan-marie-andrea-2'"
);
console.log("\n--- Marie Andréa cycle 1 ---");
console.log(JSON.stringify(ma.rows[0], null, 2));

const bal = await client.query(
  "SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account"
);
console.log("\n--- Balances ---");
console.log(JSON.stringify(bal.rows));

await client.end();
