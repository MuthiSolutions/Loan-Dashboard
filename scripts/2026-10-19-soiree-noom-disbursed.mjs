// 19 October 2026 — Muthi disbursed a loan for the "Dark Elegance" Halloween soirée at the Noom
// Hotel Abidjan (Boca Chica), 31 October 2026. Per the fiche de proposition de financement:
//   3,000,000 FCFA released, 1,000,000 FCFA flat interest, no dossier fee, 4,000,000 FCFA due in a
//   single payment on 7 November 2026. Late penalty: Muthi standard 1% per day once past due.
//
// Borrower: FOUR joint-and-several ("solidaire et indivisible") co-borrowers in their personal names
// under the not-yet-incorporated "B&O Media & Events" banner — Emmanuel Ouattara-Boni, Louis Boah,
// Aliou Sow, Julien Emmanuel Adom. Related-party loan: two co-borrowers (Ouattara-Boni = DAF,
// Boah = back office) are Muthi staff; lender signed by JP Bénie, Associé-Gérant.
//
// Funded from FOUNDER cash (bank holds only ~200k); recycled capital already in the pot, so only the
// outflow is recorded. Change DISBURSED_FROM if it left the bank.
//
// Idempotent and transactional: the loan is inserted only if absent, the cash leg only if absent.

import pg from "pg";
import { readFileSync } from "node:fs";

const DISBURSED_FROM = "founder"; // "founder" or "bank"

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN = {
  id: "soiree-noom",
  kind: "active",
  borrower: "Soirée Dark Elegance — co-emprunteurs solidaires (Ouattara-Boni, Boah, Sow, Adom)",
  purpose: "Financement événementiel — soirée Halloween « Dark Elegance », Noom Hotel Abidjan (31 octobre 2026)",
  principal: 3000000,
  fees: [{ label: "Intérêts forfaitaires", amount: 1000000 }],
  total_due: 4000000,
  disbursed_on: "2026-10-19",
  due_on: "2026-11-07",
  late_penalty_rate_per_week: 0.01,
  late_penalty_period: "day",
  contract_ref: "Convention de prêt — soirée Dark Elegance (échéance 7 novembre 2026)",
  related_party: true,
  documents: [{ label: "Fiche de proposition de financement", path: "soiree-dark-elegance-fiche.pdf" }],
  notes: [
    "Financing for the \"Dark Elegance\" Halloween soirée at the Noom Hotel Abidjan (Boca Chica) on 31 October 2026, run in personal names by the four co-organisers under the not-yet-incorporated \"B&O Media & Events\" banner.",
    "Four joint-and-several (solidaire et indivisible) co-borrowers: Emmanuel Paul-Allan Ouattara-Boni, Louis Boah, Aliou Sow, Julien Emmanuel Adom.",
    "3,000,000 FCFA released on 19 October 2026; 4,000,000 FCFA due in a single payment on 7 November 2026. 1,000,000 flat interest, no dossier fee.",
    "Late penalty: 1% per day past the 7 November 2026 due date.",
    "Related-party / insider loan: two of the four co-borrowers are Muthi staff (Ouattara-Boni, DAF; Boah, back office). Lender signed by JP Bénie, Associé-Gérant.",
    "Interest set at 1,000,000 flat by instruction; the credit file presented to committee on 18 October 2026 mentioned 25% (750,000, total 3,750,000). The 1,000,000 / 4,000,000 figure is the one adopted.",
    "Disbursed from the founder's cash on hand (recycled capital already in the pot, not a new injection).",
    "Co-borrower identity particulars are on the fiche in the loan book and not reproduced here; M. Sow's civil status and some contacts remain to be completed before signature.",
  ],
  disb_desc: "Disbursed for the Soirée Dark Elegance (4 co-borrowers, Noom Hotel)",
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
        related_party, documents, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb
      )`,
      [
        LOAN.id, LOAN.kind, LOAN.borrower, LOAN.purpose, LOAN.principal,
        JSON.stringify(LOAN.fees), LOAN.total_due, LOAN.disbursed_on, LOAN.due_on,
        LOAN.late_penalty_rate_per_week, LOAN.late_penalty_period, LOAN.contract_ref,
        LOAN.related_party, JSON.stringify(LOAN.documents), JSON.stringify(LOAN.notes),
      ]
    );
    console.log(`inserted ${LOAN.id} (3,000,000 disbursed 2026-10-19, 4,000,000 due 2026-11-07)`);
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
  "SELECT id, borrower, principal::bigint p, total_due::bigint d, due_on, related_party FROM loans WHERE id = 'soiree-noom'"
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
