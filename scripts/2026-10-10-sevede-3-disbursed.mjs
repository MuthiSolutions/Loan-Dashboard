// 10 October 2026. Franck Ismael Maycob Sevede's third Muthi loan, signed and disbursed the same day.
//
// Signed convention of 10 October 2026: 150,000 released in cash, 50,000 flat interest (no file or
// urgency fee), 200,000 due in a single firm payment on 5 November 2026 — the same maturity date as his
// 5 October loan, with no extension possible. This is distinct from his 25 August and 5 October loans,
// which stand under their own conventions (Article 1: no novation).
//
// The 150,000 went out of the founder's cash on hand, as the founder stated: recycled capital already
// in the pot, not a new injection, so only the outflow is recorded.
//
// No analyst commission is booked at disbursement. Sevede is an analyst referral, but commissions here
// are booked on realised profit (at repayment): his repaid first loan carries one, his still-outstanding
// second loan does not. This third loan is likewise unrepaid, so its commission follows at repayment.
//
// Late penalty (Article 7) is 1% per day with daily compounding on the running balance. The schema
// expresses only simple daily accrual, so a note flags that overdue figures understate the contract once
// he is more than a day late — the same honesty caveat carried on his second loan.
//
// Idempotent and transactional: the loan is inserted only if its id is absent, and the disbursement cash
// leg only if that exact leg is absent.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN = {
  id: "sevede-3",
  kind: "active",
  borrower: "Franck Ismael Maycob Sevede",
  purpose: "Financement personnel",
  contact: "+225 07 77 49 11 63",
  principal: 150000,
  fees: [{ label: "Intérêts forfaitaires", amount: 50000 }],
  total_due: 200000,
  disbursed_on: "2026-10-10",
  due_on: "2026-11-05",
  late_penalty_rate_per_week: 0.01,
  late_penalty_period: "day",
  contract_ref: "Convention de prêt du 10 octobre 2026",
  profession: "Community Manager",
  employer: "AKWABET SARL",
  employment_type: "CDD",
  tenure_years: null,
  monthly_income: 250000,
  documents: [
    { label: "Fiche de proposition de financement", path: "sevede-fiche-3.pdf" },
    { label: "Convention de prêt", path: "sevede-convention-3.pdf" },
  ],
  notes: [
    "Third Muthi financing for Franck Ismael Maycob Sevede, separate from his 25 August 2026 and 5 October 2026 loans, which stand under their own conventions.",
    "150,000 released in cash on 10 October 2026; 200,000 due in a single payment on 5 November 2026, the same date as his 5 October loan. 50,000 flat cost of credit, no file or urgency fee. The due date is firm, with no extension.",
    "Late penalty (Article 7): 1% per day compounded daily on the outstanding balance once past the 5 November 2026 due date. This record carries 1% per day simple, the most the application can express, so any overdue figure shown understates the contract once he is more than a day late.",
    "Disbursed from the founder's cash on hand.",
    "Certificat de résidence expired 26 September 2026; an up-to-date one is to be obtained from the client.",
    "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to Franck Ismael Maycob Sevede (third loan)",
};

await client.connect();
try {
  await client.query("BEGIN");

  const exists = await client.query("SELECT 1 FROM loans WHERE id = $1", [LOAN.id]);
  if (exists.rowCount > 0) {
    console.log(`${LOAN.id} already present; left as is`);
  } else {
    await client.query(
      `INSERT INTO loans (
        id, kind, borrower, purpose, contact, principal, fees, total_due,
        disbursed_on, due_on, late_penalty_rate_per_week, late_penalty_period, contract_ref,
        profession, employer, employment_type, tenure_years, monthly_income, documents, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb
      )`,
      [
        LOAN.id, LOAN.kind, LOAN.borrower, LOAN.purpose, LOAN.contact, LOAN.principal,
        JSON.stringify(LOAN.fees), LOAN.total_due, LOAN.disbursed_on, LOAN.due_on,
        LOAN.late_penalty_rate_per_week, LOAN.late_penalty_period, LOAN.contract_ref,
        LOAN.profession, LOAN.employer, LOAN.employment_type, LOAN.tenure_years, LOAN.monthly_income,
        JSON.stringify(LOAN.documents), JSON.stringify(LOAN.notes),
      ]
    );
    console.log(`inserted ${LOAN.id} (150,000 disbursed 2026-10-10, 200,000 due 2026-11-05)`);
  }

  const dup = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND account = 'founder' AND amount = $2 AND occurred_on = $3",
    [LOAN.id, -LOAN.principal, LOAN.disbursed_on]
  );
  if (dup.rowCount === 0) {
    await client.query(
      `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
       VALUES ('founder', $1, $2, $3, $4)`,
      [-LOAN.principal, LOAN.disb_desc, LOAN.id, LOAN.disbursed_on]
    );
    console.log(`recorded ${(-LOAN.principal).toLocaleString("en-US")} founder disbursement for ${LOAN.id}`);
  } else {
    console.log(`disbursement cash leg for ${LOAN.id} already present`);
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

// ---- verify -----------------------------------------------------------------
const f = (n) => Number(n).toLocaleString("en-US");
const { rows: loan } = await client.query(
  `SELECT id, kind, borrower, principal::bigint p, total_due::bigint d, disbursed_on, due_on,
          late_penalty_period per FROM loans WHERE id = 'sevede-3'`
);
console.log("\nloan now:", JSON.stringify(loan[0]));

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("\ncash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);

await client.end();
