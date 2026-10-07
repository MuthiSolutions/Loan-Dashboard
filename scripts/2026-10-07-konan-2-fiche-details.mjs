// Backfill Claude Arnaud Niky Konan's second loan (konan-2) from the financing fiche dated
// 7 October 2026: his profession and contact, the itemised fees (50,000 financing fee at 25% +
// 25,000 file fee = 75,000, giving 275,000 due), the fiche as an attached document, and a tidied
// set of notes. Employer, employment type and income stay blank — the employment contract is still
// to be confirmed, so there is nothing on file. Identity particulars (CNI/NNI/DOB) live in the
// fiche and the loan book; they are not copied into the notes.
//
// Descriptive only — no change to cash, principal, total due, dates or penalty. Idempotent.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const FEES = [
  { label: "Frais de financement (25%)", amount: 50000 },
  { label: "Frais de dossier", amount: 25000 },
];
const DOCUMENTS = [{ label: "Fiche de financement (200 000)", path: "konan-fiche-2.pdf" }];
const NOTES = [
  "200,000 disbursed in cash on 7 October 2026. 275,000 due in one instalment on 7 November 2026 — a 50,000 financing fee (25%) plus a 25,000 file fee. He had requested 250,000; 200,000 was agreed.",
  "Late penalty: 1% per day on the outstanding balance once past the 7 November 2026 due date. This record carries it as simple daily, the most the application can express, so any overdue figure shown understates the real position once he is more than a day late.",
  "Repeat borrower: his first Muthi loan (18 August 2026) was repaid in full, so this re-lends capital already returned rather than new money the founders put in.",
  "Identity verified against the CNI on file; the particulars stay in Muthi's loan book and are not reproduced here. Certificat de résidence and employment contract still to be confirmed.",
];

await client.connect();
try {
  const res = await client.query(
    `UPDATE loans
        SET profession = 'Logisticien',
            contact = '+225 07 69 25 25 25',
            contract_ref = 'Fiche de financement du 7 octobre 2026',
            fees = $1::jsonb,
            documents = $2::jsonb,
            notes = $3::jsonb,
            updated_at = now()
      WHERE id = 'konan-2'`,
    [JSON.stringify(FEES), JSON.stringify(DOCUMENTS), JSON.stringify(NOTES)]
  );
  if (res.rowCount === 0) throw new Error("loan 'konan-2' not found");
  console.log("konan-2 details backfilled from the fiche");
} finally {
  // nothing to roll back; single statement
}

const { rows } = await client.query(
  "SELECT profession, contact, contract_ref, fees, documents FROM loans WHERE id = 'konan-2'"
);
console.log(rows[0]);
await client.end();
