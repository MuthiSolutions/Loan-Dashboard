// 23 October 2026 — new loan disbursed to Sekou Toure (id `sekou-toure`).
//
//   principal 150,000 FCFA; cost of credit 50,000 = 25% interest (37,500) + 12,500 dossier fee;
//   total due 200,000 FCFA in a single payment on 23 November 2026 (1 month).
//   Late penalty: Muthi standard 1% per day once past the due date.
//   Disbursed in cash from the office box (founder cash on hand).
//
// New client, inserted straight into the active book, with the standard accruing 20% analyst
// commission (10,000 on the 50,000 profit), matching the other open loans.
//
// NOTE: borrower recorded as "Sekou Toure" — replace with his full legal name from the fiche if
// it differs. Fee split assumed identical to Toure Alhassane's; edit FEES below if his differs.
//
// Idempotent and transactional: loan, cash leg and commission are each inserted only if absent.
// Run:  node scripts/2026-10-23-sekou-toure-disbursed.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const DISBURSED_FROM = "founder"; // the office box

const LOAN = {
  id: "sekou-toure",
  kind: "active",
  borrower: "Sekou Toure",
  purpose: "Financement personnel",
  principal: 150000,
  fees: [
    { label: "Intérêts (25%)", amount: 37500 },
    { label: "Frais de dossier", amount: 12500 },
  ],
  total_due: 200000,
  disbursed_on: "2026-10-23",
  due_on: "2026-11-23",
  late_penalty_rate_per_week: 0.01,
  late_penalty_period: "day",
  contract_ref: "Fiche de proposition de financement du 23 octobre 2026",
  documents: [],
  notes: [
    "New client.",
    "150,000 FCFA disbursed 23 October 2026; 200,000 due in a single payment on 23 November 2026 (1 month). Cost of credit 50,000: 25% interest (37,500) plus a 12,500 dossier fee.",
    "Late penalty: 1% per day past the 23 November 2026 due date.",
    "Disbursed in cash from the office box.",
    "Identity particulars are kept in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to Sekou Toure",
};

const COMMISSION = {
  beneficiaries: "Louis and Emmanuel (Muthi analysts)",
  basis_profit: 50000, // total_due - principal
  rate: 0.2,
  amount: 10000,
  status: "accruing",
};

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");

  // 1. loan
  const exists = await client.query("SELECT 1 FROM loans WHERE id = $1", [LOAN.id]);
  if (exists.rowCount > 0) {
    console.log(`${LOAN.id} already present; left as is`);
  } else {
    await client.query(
      `INSERT INTO loans (
        id, kind, borrower, purpose, principal, fees, total_due,
        disbursed_on, due_on, late_penalty_rate_per_week, late_penalty_period, contract_ref,
        documents, notes
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)`,
      [
        LOAN.id, LOAN.kind, LOAN.borrower, LOAN.purpose, LOAN.principal,
        JSON.stringify(LOAN.fees), LOAN.total_due, LOAN.disbursed_on, LOAN.due_on,
        LOAN.late_penalty_rate_per_week, LOAN.late_penalty_period, LOAN.contract_ref,
        JSON.stringify(LOAN.documents), JSON.stringify(LOAN.notes),
      ]
    );
    console.log(`inserted ${LOAN.id} (150,000 disbursed 2026-10-23, 200,000 due 2026-11-23)`);
  }

  // 2. disbursement cash leg (office box outflow)
  const dup = await client.query(
    "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND amount = $2 AND occurred_on = $3",
    [LOAN.id, -LOAN.principal, LOAN.disbursed_on]
  );
  if (dup.rowCount === 0) {
    await client.query(
      "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ($1,$2,$3,$4,$5)",
      [DISBURSED_FROM, -LOAN.principal, LOAN.disb_desc, LOAN.id, LOAN.disbursed_on]
    );
    console.log(`recorded -${f(LOAN.principal)} ${DISBURSED_FROM} (office box) disbursement for ${LOAN.id}`);
  } else {
    console.log(`disbursement cash leg for ${LOAN.id} already present`);
  }

  // 3. accruing analyst commission
  const cdup = await client.query("SELECT 1 FROM commissions WHERE loan_id = $1", [LOAN.id]);
  if (cdup.rowCount === 0) {
    await client.query(
      "INSERT INTO commissions (loan_id, beneficiaries, basis_profit, rate, amount, status, notes) VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb)",
      [LOAN.id, COMMISSION.beneficiaries, COMMISSION.basis_profit, COMMISSION.rate, COMMISSION.amount, COMMISSION.status]
    );
    console.log(`recorded ${COMMISSION.status} commission ${f(COMMISSION.amount)} for ${LOAN.id}`);
  } else {
    console.log(`commission for ${LOAN.id} already present`);
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows: loan } = await client.query(
  "SELECT id, borrower, principal::bigint p, total_due::bigint d, disbursed_on, due_on, late_penalty_period per FROM loans WHERE id = 'sekou-toure'"
);
console.log("\nloan now:", JSON.stringify(loan[0]));
const { rows: bal } = await client.query("SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account");
let tot = 0;
console.log("cash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${(r.account === "founder" ? "office box" : r.account).padEnd(10)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(10)} ${f(tot).padStart(12)}`);
await client.end();
