// 17 October 2026 — new loan disbursed to Toure Alhassane Yves-Roland (id `toure-alhassane`).
//
// Per his Fiche de Proposition de Financement dated 17 October 2026:
//   principal 150,000 FCFA; cost of credit 50,000 = 25% interest (37,500) + 12,500 dossier fee;
//   total due 200,000 FCFA in a single payment on 17 November 2026 (1 month).
//   Late penalty: Muthi standard 1% per day once past the due date.
//
// New client, no prior pipeline entry, so inserted straight into the active book.
//
// ASSUMPTION (edit the constant below before running if wrong): the 150,000 went out in cash from
// the FOUNDER's cash on hand (the convention's "en espèces, en main propre", as with the Djomand
// loan). Set DISBURSED_FROM to "bank" if it left the bank account instead.
//
// Idempotent and transactional: the loan is inserted only if absent, the cash leg only if absent.

import pg from "pg";
import { readFileSync } from "node:fs";

const DISBURSED_FROM = "founder"; // "founder" (cash on hand) or "bank"

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN = {
  id: "toure-alhassane",
  kind: "active",
  borrower: "Toure Alhassane Yves-Roland",
  purpose: "Financement personnel",
  principal: 150000,
  fees: [
    { label: "Intérêts (25%)", amount: 37500 },
    { label: "Frais de dossier", amount: 12500 },
  ],
  total_due: 200000,
  disbursed_on: "2026-10-17",
  due_on: "2026-11-17",
  late_penalty_rate_per_week: 0.01,
  late_penalty_period: "day",
  contract_ref: "Fiche de proposition de financement du 17 octobre 2026",
  profession: "Transitaire",
  employer: "Chambre de Commerce et d'Industrie de Côte d'Ivoire (CCI-CI)",
  employment_type: "CDD",
  documents: [{ label: "Fiche de proposition de financement", path: "toure-alhassane-fiche.pdf" }],
  notes: [
    "New client. Freight forwarder (transitaire), employed at the Chambre de Commerce et d'Industrie de Côte d'Ivoire (CCI-CI) on a fixed-term contract (CDD).",
    "150,000 FCFA disbursed 17 October 2026; 200,000 due in a single payment on 17 November 2026 (1 month). Cost of credit 50,000: 25% interest (37,500) plus a 12,500 dossier fee.",
    "Late penalty: 1% per day past the 17 November 2026 due date.",
    "Disbursed from the founder's cash on hand.",
    "Income not yet documented: no payslip produced and the CDD pay clause not communicated. As the contract is fixed-term, confirm the employment period covers the 17 November 2026 due date.",
    "Documents on file: passport (valid to 22 December 2027) and the CCI-CI fixed-term contract. To provide: CNI recto/verso (for the NNI and issue dates), certificate of residence, and proof of income (payslip).",
    "Identity particulars are kept in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to Toure Alhassane Yves-Roland",
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
        id, kind, borrower, purpose, principal, fees, total_due,
        disbursed_on, due_on, late_penalty_rate_per_week, late_penalty_period, contract_ref,
        profession, employer, employment_type, documents, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb
      )`,
      [
        LOAN.id, LOAN.kind, LOAN.borrower, LOAN.purpose, LOAN.principal,
        JSON.stringify(LOAN.fees), LOAN.total_due, LOAN.disbursed_on, LOAN.due_on,
        LOAN.late_penalty_rate_per_week, LOAN.late_penalty_period, LOAN.contract_ref,
        LOAN.profession, LOAN.employer, LOAN.employment_type,
        JSON.stringify(LOAN.documents), JSON.stringify(LOAN.notes),
      ]
    );
    console.log(`inserted ${LOAN.id} (150,000 disbursed 2026-10-17, 200,000 due 2026-11-17)`);
  }

  const dup = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND amount = $2 AND occurred_on = $3",
    [LOAN.id, -LOAN.principal, LOAN.disbursed_on]
  );
  if (dup.rowCount === 0) {
    await client.query(
      "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ($1, $2, $3, $4, $5)",
      [DISBURSED_FROM, -LOAN.principal, LOAN.disb_desc, LOAN.id, LOAN.disbursed_on]
    );
    console.log(`recorded -${LOAN.principal.toLocaleString("en-US")} ${DISBURSED_FROM} disbursement for ${LOAN.id}`);
  } else {
    console.log(`disbursement cash leg for ${LOAN.id} already present`);
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const f = (x) => Number(x).toLocaleString("en-US");
const { rows: loan } = await client.query(
  "SELECT id, borrower, principal::bigint p, total_due::bigint d, disbursed_on, due_on, late_penalty_period per FROM loans WHERE id = 'toure-alhassane'"
);
console.log("\nloan now:", JSON.stringify(loan[0]));
const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("cash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);
await client.end();
