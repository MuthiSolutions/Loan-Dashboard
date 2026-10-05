// Two pre-disbursement entries for the pipeline / "Pending disbursements" view.
//
//  1. Sevede Franck Ismael Maycob — second financing, 100,000 released + 25% fee = 125,000 due one
//     month after disbursement (5 November 2026 if funded 5 October). Contract sent; awaiting the
//     borrower's signature, then we disburse. Separate from his 25 August 2026 loan, since repaid.
//     Late penalty, Article 7: 1% per day compounded daily — recorded here, not yet accruing.
//
//  2. Claude Arnaud Niky Konan — a fresh request for 250,000. No convention issued yet; amount and
//     fees still to be agreed, so it sits as a request with terms not yet set.
//
// Both are kind = 'pipeline_pending' (pre-disbursement), distinct from the active book. Idempotent:
// each row is inserted only if its id is not already present, and nothing else is touched.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const ROWS = [
  {
    id: "sevede-2",
    kind: "pipeline_pending",
    borrower: "Franck Ismael Maycob Sevede",
    purpose: "Financement personnel (2e prêt)",
    contact: "+225 07 77 49 11 63",
    principal: 100000,
    fees: [{ label: "Frais de financement (25%)", amount: 25000 }],
    total_due: 125000,
    late_penalty_rate_per_week: 0.01,
    late_penalty_period: "day",
    contract_ref: "Convention de prêt du 5 octobre 2026",
    requested_amount: 100000,
    status: "Contract sent — awaiting signature",
    profession: "Community Manager",
    employer: "AKWABET SARL",
    employment_type: "CDD",
    monthly_income: 250000,
    documents: [
      { label: "Fiche de financement (100 000)", path: "sevede-fiche-2.pdf" },
      { label: "Convention de prêt", path: "sevede-convention-2.pdf" },
      { label: "Reconnaissance de dette", path: "sevede-reconnaissance-2.pdf" },
    ],
    notes: [
      "Second financing, separate from the 25 August 2026 loan (since repaid in full). 100,000 released, 25,000 fee, 125,000 due in one instalment one calendar month after disbursement — 5 November 2026 if funded on 5 October.",
      "Contract sent; awaiting the borrower's signature. Disburse on signature.",
      "Late penalty (Article 7): 1% per day compounded daily on the outstanding balance. Not yet accruing — not yet disbursed.",
      "Certificat de résidence expired 26 September 2026; an up-to-date one is to be obtained from the client.",
      "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
    ],
  },
  {
    id: "konan-2",
    kind: "pipeline_pending",
    borrower: "Claude Arnaud Niky Konan",
    purpose: "Financement personnel (nouvelle demande)",
    contact: null,
    principal: 250000,
    fees: [],
    total_due: null,
    late_penalty_rate_per_week: 0.01,
    late_penalty_period: "day",
    contract_ref: null,
    requested_amount: 250000,
    status: "New request — terms not yet set",
    profession: null,
    employer: null,
    employment_type: null,
    monthly_income: null,
    documents: [],
    notes: [
      "Claude Arnaud has requested a new 250,000 facility. No convention issued yet; amount and fees still to be agreed.",
      "Repaid his first Muthi loan in full — see the loan book.",
    ],
  },
];

await client.connect();
try {
  await client.query("BEGIN");
  for (const r of ROWS) {
    const exists = await client.query("SELECT 1 FROM loans WHERE id = $1", [r.id]);
    if (exists.rowCount > 0) {
      console.log(`skip ${r.id} (already present)`);
      continue;
    }
    await client.query(
      `INSERT INTO loans (
        id, kind, borrower, purpose, contact, principal, fees, total_due,
        late_penalty_rate_per_week, late_penalty_period, contract_ref, requested_amount,
        status, profession, employer, employment_type, monthly_income, documents, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb
      )`,
      [
        r.id, r.kind, r.borrower, r.purpose, r.contact, r.principal, JSON.stringify(r.fees),
        r.total_due, r.late_penalty_rate_per_week, r.late_penalty_period, r.contract_ref,
        r.requested_amount, r.status, r.profession, r.employer, r.employment_type, r.monthly_income,
        JSON.stringify(r.documents), JSON.stringify(r.notes),
      ]
    );
    console.log(`inserted ${r.id}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query(
  "SELECT id, kind, status, principal, total_due, requested_amount FROM loans WHERE id IN ('sevede-2','konan-2') ORDER BY id"
);
console.log("pending entries:");
for (const r of rows) console.log(" ", r.id, "|", r.status, "| principal", r.principal, "| due", r.total_due, "| requested", r.requested_amount);

await client.end();
