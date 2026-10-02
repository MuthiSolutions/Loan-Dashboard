// Franck Ismael Maycob Sevede settled in cash on 2 October 2026, paid straight to the bank.
//
//   principal          100,000
//   total due          125,000  (contracted, 25% financing fee)
//   due                25 September 2026
//   days late          7, which is one started week at 1% on the total due
//   penalty by rule      1,250
//   owed by rule       126,250
//   actually received  130,000
//
// He paid 3,750 above what the rule produces. That difference is recorded as received,
// not invented away: the loan shows 130,000 collected and 30,000 of realised profit.
// Whether the 3,750 was a rounded settlement or an overpayment to hand back is a question
// for the founder; nothing here assumes one or the other.
//
// He had promised on 23 September to pay by the end of the month and did not, so the
// broken promise is logged before the settlement. It costs him points on Payment
// reliability, which is the behaviour the credit model is meant to capture.
//
// Transactional and idempotent: every write is guarded, so a re-run changes nothing.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const PAID = 130000;
const PAID_ON = "2026-10-02";

await client.connect();
try {
  await client.query("BEGIN");

  const { rows: before } = await client.query(
    "SELECT principal, total_due, amount_paid, repaid_on FROM loans WHERE id = 'sevede' FOR UPDATE"
  );
  if (before.length === 0) throw new Error("loan 'sevede' not found");
  if (before[0].repaid_on !== null) throw new Error(`already settled on ${before[0].repaid_on}`);

  const principal = Number(before[0].principal);
  const profit = PAID - principal;

  // Cash in. External money, so transfer_id stays null and loan_id is set.
  await client.query(
    `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
     SELECT 'bank', $1, $2, 'sevede', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM cash_movements
         WHERE account = 'bank' AND amount = $1 AND loan_id = 'sevede' AND occurred_on = $3)`,
    [PAID, "Franck Ismael Maycob Sevede loan settled in cash, paid straight to the bank", PAID_ON]
  );

  await client.query(
    `UPDATE loans
        SET amount_paid = $1,
            last_payment_on = $2,
            repaid_on = $2,
            repayment_history = repayment_history
              || $3::jsonb
              || $4::jsonb,
            notes = notes || $5::jsonb,
            updated_at = now()
      WHERE id = 'sevede'`,
    [
      PAID,
      PAID_ON,
      JSON.stringify([
        {
          date: "2026-09-30",
          type: "broken_promise",
          description:
            "Did not pay by the end of the month as promised on 23 September. Settled two days later.",
        },
      ]),
      JSON.stringify([
        {
          date: PAID_ON,
          type: "full_payment",
          description:
            "Paid 130,000 FCFA in cash, straight to the bank, 7 days after the 25 September due date. " +
            "The contract rule gives 126,250 (125,000 due plus 1,250 for one started week at 1%), so 3,750 more than the rule.",
        },
      ]),
      JSON.stringify([
        "Settled in cash at 130,000 FCFA on 2 October 2026, 7 days after the 25 September due date. " +
          "That is 3,750 above the 126,250 the late-penalty rule produces; the excess is recorded as received, " +
          "pending confirmation of whether it was a rounded settlement or an overpayment to return.",
      ]),
    ]
  );

  // Analyst fee, 20% of realised profit, per CLAUDE.md. Payable, not paid: unlike the
  // loans whose fees were advanced to JP, this cash is sitting in Muthi's own bank
  // account and nothing has gone out to the analysts yet.
  await client.query(
    `INSERT INTO commissions (loan_id, beneficiaries, basis_profit, rate, amount, status, notes)
     SELECT 'sevede', $1, $2, 0.2, $3, 'payable', $4::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM commissions WHERE loan_id = 'sevede')`,
    [
      "Louis and Emmanuel (Muthi analysts)",
      profit,
      Math.round(profit * 0.2),
      JSON.stringify([
        "Collected in cash to the bank, so unlike the other payable commissions this one is not " +
          "sitting with JP. The money is in Muthi's bank account and has not yet been paid out.",
      ]),
    ]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows: loan } = await client.query(
  "SELECT principal, total_due, amount_paid, repaid_on FROM loans WHERE id = 'sevede'"
);
const { rows: cash } = await client.query(
  "SELECT account, SUM(amount) AS total FROM cash_movements GROUP BY account ORDER BY account"
);
const { rows: comm } = await client.query(
  "SELECT basis_profit, amount, status FROM commissions WHERE loan_id = 'sevede'"
);

const l = loan[0];
console.log(`sevede: principal ${l.principal}, contracted ${l.total_due}, collected ${l.amount_paid}`);
console.log(`        repaid ${new Date(l.repaid_on).toISOString().slice(0, 10)}, realised profit ${Number(l.amount_paid) - Number(l.principal)}`);
console.log(`commission: ${comm[0].amount} (20% of ${comm[0].basis_profit}), ${comm[0].status}`);
console.log(`cash: ${cash.map((r) => `${r.account} ${r.total}`).join(", ")}, total ${cash.reduce((s, r) => s + Number(r.total), 0)}`);

await client.end();
