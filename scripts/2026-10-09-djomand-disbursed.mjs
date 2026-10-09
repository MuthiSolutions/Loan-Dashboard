// 9 October 2026, recording a loan disbursed on 7 October 2026 (back-dated entry).
//
// Alexandra Augustine Asset Djomand — a new client, trading in cosmetics and perfumery under the
// enseigne BAL & CO. Professional financing: 1,000,000 released in cash, 20% flat fee = 200,000,
// so 1,200,000 due in a single payment within 7 calendar days of release — by 14 October 2026.
// Late penalty (Article 7): 1% per day, daily compounding, once past the due date.
//
// She is a brand-new borrower with no prior pipeline entry, so this inserts her straight into the
// active book. The 1,000,000 went out in cash from the founder's cash on hand (the convention's
// "en espèces, en main propre"); it deploys cash already in the pot, so it is recycled capital, not
// a new injection, and only the outflow is recorded. No analyst commission: a walk-in new client,
// not an analyst referral.
//
// Idempotent and transactional: the loan is inserted only if its id is absent, and the disbursement
// cash leg only if that exact leg is absent.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN = {
  id: "djomand",
  kind: "active",
  borrower: "Alexandra Augustine Asset Djomand — BAL & CO",
  purpose: "Financement professionnel (BAL & CO — cosmétiques & parfumerie)",
  contact: "+225 01 01 58 58 34",
  principal: 1000000,
  fees: [{ label: "Frais de financement (20%)", amount: 200000 }],
  total_due: 1200000,
  disbursed_on: "2026-10-07",
  due_on: "2026-10-14",
  late_penalty_rate_per_week: 0.01,
  late_penalty_period: "day",
  contract_ref: "Convention de prêt du 7 octobre 2026",
  profession: "Entrepreneure",
  employer: "BAL & CO",
  employment_type: "Self-employed",
  tenure_years: 3,
  documents: [
    { label: "Convention de prêt", path: "djomand-convention.pdf" },
    { label: "Fiche de financement", path: "djomand-fiche.pdf" },
  ],
  notes: [
    "New client. Professional financing for her cosmetics and perfumery business, BAL & CO (RCCM CI-ABJ-03-2023-A10-01342, registered April 2023).",
    "1,000,000 released in cash on 7 October 2026; 1,200,000 due in a single payment within 7 days — by 14 October 2026. 200,000 cost of credit at 20% flat.",
    "Late penalty (Article 7): 1% per day compounded daily on the outstanding balance once past the 14 October 2026 due date.",
    "Disbursed from the founder's cash on hand, not the bank.",
    "No real-estate guarantee; she pledges her business income to repayment.",
    "Documents on file: CNI, RCCM declaration, fiscal existence declaration. Certificate of residence and full home address still to be provided.",
    "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to Alexandra Augustine Asset Djomand (BAL & CO)",
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
        profession, employer, employment_type, tenure_years, documents, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb
      )`,
      [
        LOAN.id, LOAN.kind, LOAN.borrower, LOAN.purpose, LOAN.contact, LOAN.principal,
        JSON.stringify(LOAN.fees), LOAN.total_due, LOAN.disbursed_on, LOAN.due_on,
        LOAN.late_penalty_rate_per_week, LOAN.late_penalty_period, LOAN.contract_ref,
        LOAN.profession, LOAN.employer, LOAN.employment_type, LOAN.tenure_years,
        JSON.stringify(LOAN.documents), JSON.stringify(LOAN.notes),
      ]
    );
    console.log(`inserted ${LOAN.id} (1,000,000 disbursed 2026-10-07, 1,200,000 due 2026-10-14)`);
  }

  const dup = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND amount = $2 AND occurred_on = $3",
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
          late_penalty_period per FROM loans WHERE id = 'djomand'`
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
