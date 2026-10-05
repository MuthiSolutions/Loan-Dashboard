// Léocadie Koffi's loan is back on: she signed the convention on 2 October 2026, and disbursement is
// set for 5-6 October (not yet done). The record was previously marked declined, so revive it as a
// signed, not-yet-disbursed term loan with the final terms.
//
//   5,000,000 released + 1,500,000 cost of credit = 6,500,000 due over 20 monthly instalments of
//   325,000 (first 28 December 2026, last 28 July 2028). Late penalty, Article 7: 1% per day
//   compounded daily on the overdue instalment.
//
// Stays kind = 'pipeline_term' (not disbursed), with declined_on cleared so it shows under Pending
// disbursements rather than "Considered, not funded".

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const FEES = [{ label: "Coût du crédit (intérêts et frais)", amount: 1500000 }];
const DOCS = [
  { label: "Convention de prêt", path: "kaelle-koffi-convention.pdf" },
  { label: "Fiche de financement", path: "kaelle-koffi-fiche.pdf" },
];
const NOTES = [
  "Signed convention dated 2 October 2026. 5,000,000 released, 1,500,000 cost of credit, 6,500,000 due over 20 monthly instalments of 325,000 — first due 28 December 2026, last 28 July 2028. Disbursement set for 5-6 October 2026; not yet disbursed.",
  "The 325,000 monthly instalment exceeds her declared salary of 200,000 (CDI at ICAP Global Health, 17 years); repayment relies on income from her Kaelle Market & Services trading.",
  "Late penalty (Article 7): 1% per day compounded daily on an overdue instalment; a late instalment does not change the due dates of the others.",
  "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
];

await client.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query("SELECT id FROM loans WHERE id = 'pipeline-koffi' FOR UPDATE");
  if (rows.length === 0) throw new Error("loan 'pipeline-koffi' not found");

  await client.query(
    `UPDATE loans SET
        kind = 'pipeline_term',
        declined_on = NULL,
        principal = 5000000,
        fees = $1::jsonb,
        total_due = 6500000,
        term_months = 20,
        deferral_months = 2,
        late_penalty_rate_per_week = 0.01,
        late_penalty_period = 'day',
        contract_ref = 'Convention de prêt du 2 octobre 2026',
        status = 'Signed 2 Oct — awaiting disbursement',
        profession = 'Coordonnatrice Régionale des Opérations (Projet CQUIN)',
        employer = 'CIP/ICAP (ICAP Global Health)',
        employment_type = 'CDI',
        monthly_income = 200000,
        tenure_years = 17,
        documents = $2::jsonb,
        notes = $3::jsonb,
        updated_at = now()
      WHERE id = 'pipeline-koffi'`,
    [JSON.stringify(FEES), JSON.stringify(DOCS), JSON.stringify(NOTES)]
  );
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query(
  "SELECT borrower, kind, declined_on, principal, total_due, term_months, status FROM loans WHERE id = 'pipeline-koffi'"
);
console.log("pipeline-koffi:", rows[0]);

await client.end();
