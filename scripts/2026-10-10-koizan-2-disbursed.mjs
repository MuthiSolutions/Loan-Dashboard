// 10 October 2026, recording a loan disbursed on 7 October 2026 (back-dated entry).
//
// David-Allan Koizan's second Muthi loan. His first (300,000 released, 400,000 due, 18 August 2026)
// was repaid in full on 28 September 2026; this is a fresh, separate financing on the same terms:
// 300,000 released in cash, 25% flat financing fee (75,000) plus a 25,000 fast-mobilisation fee, so
// 400,000 due in a single payment one calendar month later, by 7 November 2026.
//
// Only the financing-proposal fiche of 7 October 2026 is on file so far (no signed convention or
// reconnaissance de dette yet); the founder confirmed the money went out, so it is recorded as active.
// The 300,000 was funded 200,000 from the bank and 100,000 from the founder's cash on hand (two outflow
// legs): recycled capital already in Muthi's accounts, not a new injection. No analyst commission — his
// loans are not analyst referrals (his first carries none).
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
  id: "koizan-2",
  kind: "active",
  borrower: "Amoi David-Allan Koizan",
  purpose: "Financement personnel",
  contact: "+225 05 85 91 61 94",
  principal: 300000,
  fees: [
    { label: "Financing fee (25%)", amount: 75000 },
    { label: "Rapid mobilization fee", amount: 25000 },
  ],
  total_due: 400000,
  disbursed_on: "2026-10-07",
  due_on: "2026-11-07",
  late_penalty_rate_per_week: 0.01,
  late_penalty_period: "day",
  contract_ref: "Fiche de proposition de financement, 7 octobre 2026",
  profession: "Commercial",
  employer: "LOXEA Côte d'Ivoire",
  employment_type: "CDI",
  tenure_years: 1,
  monthly_income: 1004784,
  documents: [
    { label: "Fiche de proposition de financement", path: "koizan-amoi-fiche-2.pdf" },
  ],
  notes: [
    "David-Allan Koizan's second Muthi financing, separate from his earlier loan which he repaid in full on 28 September 2026.",
    "300,000 released in cash on 7 October 2026; 400,000 due in a single payment one month later, by 7 November 2026. 100,000 cost of credit: a 75,000 financing fee at 25% flat plus a 25,000 fast-mobilisation fee.",
    "Late penalty 1% per day on the outstanding balance once past the 7 November 2026 due date, the daily rate agreed on his first Muthi loan.",
    "Disbursed as 200,000 from the bank and 100,000 from the founder's cash on hand.",
    "On file so far: the financing-proposal fiche of 7 October 2026, with the CNI and the LOXEA Côte d'Ivoire CDI contract referenced. No signed convention or reconnaissance de dette on file yet; certificate of residence and full home address still to be provided.",
    "Identity verified against the national identity document on file; the particulars stay in Muthi's loan book and are not reproduced here.",
  ],
  disb_desc: "Disbursed to David-Allan Koizan (second loan)",
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
    console.log(`inserted ${LOAN.id} (300,000 disbursed 2026-10-07, 400,000 due 2026-11-07)`);
  }

  // Two outflow legs for the single disbursement: 200,000 from the bank, 100,000 from the founder.
  // Not an internal transfer (no transfer_id) — both are money leaving Muthi's accounts to the borrower.
  const LEGS = [
    { account: "bank", amount: -200000 },
    { account: "founder", amount: -100000 },
  ];
  const legSum = LEGS.reduce((s, l) => s + l.amount, 0);
  if (legSum !== -LOAN.principal) {
    throw new Error(`cash legs sum ${legSum} does not match -principal ${-LOAN.principal}`);
  }
  for (const leg of LEGS) {
    const dup = await client.query(
      "SELECT 1 FROM cash_movements WHERE loan_id = $1 AND account = $2 AND amount = $3 AND occurred_on = $4",
      [LOAN.id, leg.account, leg.amount, LOAN.disbursed_on]
    );
    if (dup.rowCount === 0) {
      await client.query(
        `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
         VALUES ($1, $2, $3, $4, $5)`,
        [leg.account, leg.amount, LOAN.disb_desc, LOAN.id, LOAN.disbursed_on]
      );
      console.log(`recorded ${leg.amount.toLocaleString("en-US")} ${leg.account} disbursement for ${LOAN.id}`);
    } else {
      console.log(`${leg.account} disbursement leg for ${LOAN.id} already present`);
    }
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
          late_penalty_period per FROM loans WHERE id = 'koizan-2'`
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
