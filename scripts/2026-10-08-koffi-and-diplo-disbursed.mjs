// 8 October 2026. Two loans signed and disbursed the same day, both in cash out of the founder's
// own cash on hand (not the bank). Each was already on the books as a pipeline entry with
// provisional figures; the signed conventions supersede those, so the entries move into the active
// book with their final terms and the founder cash outflows are recorded.
//
//  1. pipeline-koffi -> active. Léocadie Koffi's earlier plan (a 5,000,000 renewable line / term
//     loan) is annulled by the new convention of 8 October 2026 (Article 1). The real loan is
//     500,000 released, 20% flat = 100,000 cost of credit, 600,000 due over two monthly
//     instalments of 300,000 (8 November and 8 December 2026).
//
//  2. yann-samuel-aunt -> active. The referral from Yann-Samuel (the PRAÏA borrower) is his aunt,
//     Noussiratou Pereira, épouse Diplo. Agreed at 3,000,000 (not the 5,000,000 first floated),
//     20% flat = 600,000 cost of credit, 3,600,000 due over three monthly instalments of
//     1,200,000 (8 November 2026, 8 December 2026, 8 January 2027).
//
// Both conventions carry a 1% per day, daily-compounding late penalty per instalment (Article 7).
// The schema models one maturity date per loan, so due_on is set to each loan's final instalment
// date and a note flags that the single-date formula cannot express the per-instalment penalty.
//
// Cash: the founder held 6,712,000 in cash on hand. Disbursing 500,000 + 3,000,000 = 3,500,000 from
// it is recycled capital already in the pot, not a new injection, so only the two outflows are
// recorded. Idempotent and transactional: each row is converted only if not already active, and
// each disbursement leg is inserted only if absent.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const KOFFI = {
  id: "pipeline-koffi",
  principal: 500000,
  fees: [{ label: "Intérêts (20%)", amount: 100000 }],
  total_due: 600000,
  disbursed_on: "2026-10-08",
  due_on: "2026-12-08",
  contract_ref: "Convention de prêt du 8 octobre 2026",
  purpose: "Financement personnel (Kaelle Market & Services)",
  documents: [
    { label: "Convention de prêt (8 oct 2026)", path: "kaelle-koffi-convention-2.pdf" },
    { label: "Fiche de financement", path: "kaelle-koffi-fiche-2.pdf" },
  ],
  notes: [
    "Convention signed 8 October 2026, replacing the 5,000,000 renewable credit line / term loan proposed earlier in October 2026, which no longer has effect (Article 1). 500,000 released in cash on 8 October 2026; 600,000 due — 100,000 cost of credit at 20% flat, no file fee.",
    "Repayable in two instalments of 300,000: 8 November 2026 and 8 December 2026.",
    "Late penalty (Article 7): 1% per day compounded daily on an overdue instalment, each instalment independent. The dashboard models a single maturity date (8 December 2026), so it cannot show the per-instalment penalty on a missed first instalment — any overdue figure before the final date understates the real position.",
    "Disbursed from the founder's cash on hand, not the bank.",
    "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to Léocadie Koffi",
};

const DIPLO = {
  id: "yann-samuel-aunt",
  borrower: "Noussiratou Pereira, épouse Diplo",
  principal: 3000000,
  fees: [{ label: "Intérêts (20%)", amount: 600000 }],
  total_due: 3600000,
  disbursed_on: "2026-10-08",
  due_on: "2027-01-08",
  contract_ref: "Convention de prêt du 8 octobre 2026",
  purpose: "Financement de commerce (salons Eyram Coiffure)",
  contact: "+225 01 02 48 48 44",
  profession: "Commerçante",
  employer: "Eyram Coiffure (Riviera 3) & Eyram Coiffure 2 (Djorobité 2), Cocody",
  employment_type: "Self-employed",
  tenure_years: 23,
  documents: [
    { label: "Convention de prêt", path: "pereira-diplo-convention.pdf" },
    { label: "Fiche de financement", path: "pereira-diplo-fiche.pdf" },
  ],
  notes: [
    "Referral from Yann-Samuel (the PRAÏA borrower) — his aunt. Convention signed 8 October 2026.",
    "3,000,000 released in cash on 8 October 2026; 3,600,000 due — 600,000 cost of credit at 20% flat, no file fee. Agreed at 3,000,000, down from the 5,000,000 first floated.",
    "Repayable in three instalments of 1,200,000: 8 November 2026, 8 December 2026 and 8 January 2027.",
    "Late penalty (Article 7): 1% per day compounded daily on an overdue instalment, each instalment independent. The dashboard models a single maturity date (8 January 2027), so it cannot show the per-instalment penalty on a missed earlier instalment — any overdue figure before the final date understates the real position.",
    "Commerçante since 2003: two Cocody hair salons, Eyram Coiffure (Riviera 3) and Eyram Coiffure 2 (Djorobité 2); RCCM CI-ABJ-03-A-2153. No real-estate guarantee; she pledges her trading income to repayment.",
    "Disbursed from the founder's cash on hand, not the bank.",
    "Documents on file: CNI, RCCM declaration, 2026 taxpayer cards for both salons and payment receipts. Certificate of residence still to be provided.",
    "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to Noussiratou Pereira, épouse Diplo",
};

await client.connect();
try {
  await client.query("BEGIN");

  // 1. Léocadie Koffi: pipeline_term -> active with the signed 500,000 / 600,000, 2-month terms.
  const koffi = await client.query("SELECT kind FROM loans WHERE id = $1 FOR UPDATE", [KOFFI.id]);
  if (koffi.rowCount === 0) throw new Error(`loan '${KOFFI.id}' not found`);
  if (koffi.rows[0].kind === "active") {
    console.log(`${KOFFI.id} already active; terms left as they are`);
  } else {
    await client.query(
      `UPDATE loans SET
          kind = 'active',
          declined_on = NULL,
          principal = $2,
          fees = $3::jsonb,
          total_due = $4,
          disbursed_on = $5,
          due_on = $6,
          term_months = NULL,
          deferral_months = NULL,
          late_penalty_rate_per_week = 0.01,
          late_penalty_period = 'day',
          contract_ref = $7,
          purpose = $8,
          status = NULL,
          documents = $9::jsonb,
          notes = $10::jsonb,
          updated_at = now()
        WHERE id = $1`,
      [KOFFI.id, KOFFI.principal, JSON.stringify(KOFFI.fees), KOFFI.total_due,
       KOFFI.disbursed_on, KOFFI.due_on, KOFFI.contract_ref, KOFFI.purpose,
       JSON.stringify(KOFFI.documents), JSON.stringify(KOFFI.notes)]
    );
    console.log(`${KOFFI.id} is now active (500,000 disbursed 2026-10-08, 600,000 due 2026-12-08)`);
  }

  // 2. Noussiratou Pereira (Diplo): pipeline_pending -> active with the signed 3,000,000 / 3,600,000 terms.
  const diplo = await client.query("SELECT kind FROM loans WHERE id = $1 FOR UPDATE", [DIPLO.id]);
  if (diplo.rowCount === 0) throw new Error(`loan '${DIPLO.id}' not found`);
  if (diplo.rows[0].kind === "active") {
    console.log(`${DIPLO.id} already active; terms left as they are`);
  } else {
    await client.query(
      `UPDATE loans SET
          kind = 'active',
          declined_on = NULL,
          borrower = $2,
          principal = $3,
          fees = $4::jsonb,
          total_due = $5,
          disbursed_on = $6,
          due_on = $7,
          requested_amount = NULL,
          late_penalty_rate_per_week = 0.01,
          late_penalty_period = 'day',
          contract_ref = $8,
          purpose = $9,
          contact = $10,
          profession = $11,
          employer = $12,
          employment_type = $13,
          tenure_years = $14,
          status = NULL,
          documents = $15::jsonb,
          notes = $16::jsonb,
          updated_at = now()
        WHERE id = $1`,
      [DIPLO.id, DIPLO.borrower, DIPLO.principal, JSON.stringify(DIPLO.fees), DIPLO.total_due,
       DIPLO.disbursed_on, DIPLO.due_on, DIPLO.contract_ref, DIPLO.purpose, DIPLO.contact,
       DIPLO.profession, DIPLO.employer, DIPLO.employment_type, DIPLO.tenure_years,
       JSON.stringify(DIPLO.documents), JSON.stringify(DIPLO.notes)]
    );
    console.log(`${DIPLO.id} is now active (3,000,000 disbursed 2026-10-08, 3,600,000 due 2027-01-08)`);
  }

  // 3. Founder cash outflows for the two disbursements (recycled capital already in the pot).
  for (const L of [KOFFI, DIPLO]) {
    const amount = -L.principal;
    const dup = await client.query(
      "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND amount = $2 AND occurred_on = $3",
      [L.id, amount, L.disbursed_on]
    );
    if (dup.rowCount === 0) {
      await client.query(
        `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
         VALUES ('founder', $1, $2, $3, $4)`,
        [amount, L.disb_desc, L.id, L.disbursed_on]
      );
      console.log(`recorded ${amount.toLocaleString("en-US")} founder disbursement for ${L.id}`);
    } else {
      console.log(`disbursement cash leg for ${L.id} already present`);
    }
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

// ---- verify -----------------------------------------------------------------
const f = (n) => Number(n).toLocaleString("en-US");
const { rows: loans } = await client.query(
  `SELECT id, kind, borrower, principal::bigint p, total_due::bigint d, disbursed_on, due_on,
          late_penalty_period per FROM loans WHERE id IN ('pipeline-koffi','yann-samuel-aunt') ORDER BY id`
);
console.log("\nloans now:");
for (const r of loans) console.log(" ", r.id, "|", r.kind, "|", f(r.p), "/", f(r.d),
  "| disb", String(r.disbursed_on).slice(0,10), "| due", String(r.due_on).slice(0,10), "|", r.borrower);

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("\ncash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);

await client.end();
