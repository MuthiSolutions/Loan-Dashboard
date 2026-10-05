// Franck Sevede's second financing (sevede-2) was disbursed: 100,000 FCFA in cash on 5 October 2026.
// Move it from the pending pipeline into the active book and record the cash going out.
//
//  - kind: pipeline_pending -> active, disbursed 5 October 2026, due 5 November 2026 (one calendar
//    month, per the signed convention). Terms unchanged: 25,000 fee, 125,000 due, 1% per day penalty.
//  - Cash: 100,000 out of the bank account (where his 130,000 first-loan repayment landed on
//    2 October, so this is recycled capital, not new money the founders put in).
//
// Idempotent: if the loan is already active the whole thing is skipped, and the cash leg is only
// inserted if it is not already there.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const NOTES = [
  "Second financing, separate from the 25 August 2026 loan (since repaid in full). 100,000 disbursed in cash on 5 October 2026, 25,000 fee, 125,000 due in one instalment on 5 November 2026.",
  "Late penalty (Article 7): 1% per day compounded daily on the outstanding balance once past the 5 November 2026 due date. This record carries 1% per day simple, the most the application can express, so any overdue figure shown understates the contract once he is more than a day late.",
  "Certificat de résidence expired 26 September 2026; an up-to-date one is to be obtained from the client.",
  "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
];

await client.connect();
try {
  await client.query("BEGIN");

  const { rows } = await client.query("SELECT kind FROM loans WHERE id = 'sevede-2' FOR UPDATE");
  if (rows.length === 0) throw new Error("loan 'sevede-2' not found");

  if (rows[0].kind === "active") {
    console.log("sevede-2 already active; nothing to do");
  } else {
    await client.query(
      `UPDATE loans
          SET kind = 'active',
              disbursed_on = '2026-10-05',
              due_on = '2026-11-05',
              status = NULL,
              notes = $1::jsonb,
              updated_at = now()
        WHERE id = 'sevede-2'`,
      [JSON.stringify(NOTES)]
    );

    const existing = await client.query(
      "SELECT 1 FROM cash_movements WHERE loan_id = 'sevede-2' AND amount = -100000 AND occurred_on = '2026-10-05'"
    );
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
         VALUES ('bank', -100000, 'Disbursed to Franck Sevede (second loan)', 'sevede-2', '2026-10-05')`
      );
      console.log("recorded -100,000 bank disbursement");
    } else {
      console.log("disbursement cash leg already present");
    }
    console.log("sevede-2 is now active (disbursed 2026-10-05, due 2026-11-05)");
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount) AS total FROM cash_movements GROUP BY account ORDER BY account"
);
console.log("cash now:", Object.fromEntries(bal.map((r) => [r.account, Number(r.total)])));

await client.end();
