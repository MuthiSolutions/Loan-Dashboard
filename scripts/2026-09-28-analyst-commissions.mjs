import pg from "pg";
import { readFileSync } from "node:fs";

// Analyst commissions for Louis and Emmanuel.
//
// Policy set by the founder on 28 September 2026: 20% of profit on every loan.
// PRAÏA was settled separately at a flat 300,000 and is already paid.
//
// PRAÏA: the 300,000 was taken out of the final 680,000 payment received on
// 9 September. So of that 680,000, the analysts took 300,000 and 380,000 went to
// JP. The ledger currently records the whole 680,000 as an inflow to the founder
// and no outflow, which overstates the founder balance by 300,000. This script
// adds the missing outflow rather than shrinking the inflow, so the borrower's
// 6,680,000 of payments still reconciles with loans.amount_paid and the
// commission shows as the expense it is.
//
// The other three profitable loans: the fee portion of each repayment went
// straight to JP (founder +50,000 for Marie Andréa on 23 Sept, +62,000 for Konan
// on 24 Sept, +140,000 for David Allan on 28 Sept, 252,000 in total). JP pays the
// analysts back afterwards, so those commissions are PAYABLE and the cash to
// settle them is already sitting in the founder balance.
//
// Commission crystallises on profit actually COLLECTED, not contracted. The three
// live loans (Ane, Sevede, Marie Andréa cycle 1) have collected nothing yet, so
// they get no row. Their accruing entitlement is computed on the fly rather than
// stored, because late penalties move it every day.
//
// Ouattara-Boni earned zero profit (interest-free related-party loan, fees
// waived) so there is nothing to pay and no row is written.
//
// Idempotent and transactional. Safe to re-run.

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });
await client.connect();

const BENEFICIARIES = "Louis and Emmanuel (Muthi analysts)";
const JP_HOLDS_IT =
  "The fee portion of this repayment went straight to JP, so the cash to settle this commission is already in the founder balance. JP pays the analysts back.";

const ROWS = [
  {
    loanId: "praia",
    basisProfit: 1680000,
    rate: null,
    amount: 300000,
    status: "paid",
    paidOn: "2026-09-09",
    notes: [
      "Flat 300,000 as agreed for the PRAÏA deal, not the standard 20%. It works out at 17.9% of the 1,680,000 profit collected; 20% would have been 336,000.",
      "Taken out of the final 680,000 payment received on 9 September: 300,000 to the analysts, 380,000 to JP.",
    ],
  },
  { loanId: "koizan", basisProfit: 140000, rate: 0.2, amount: 28000, status: "payable", paidOn: null, notes: [JP_HOLDS_IT] },
  { loanId: "konan", basisProfit: 62000, rate: 0.2, amount: 12400, status: "payable", paidOn: null, notes: [JP_HOLDS_IT] },
  { loanId: "koizan-marie-andrea", basisProfit: 50000, rate: 0.2, amount: 10000, status: "payable", paidOn: null, notes: [JP_HOLDS_IT] },
];

const PRAIA_COMMISSION_DESCRIPTION =
  "PRAÏA analyst commission paid to Louis and Emmanuel, deducted from the final 680,000 payment";

try {
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE IF NOT EXISTS commissions (
      id            SERIAL PRIMARY KEY,
      loan_id       TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      beneficiaries TEXT NOT NULL,
      basis_profit  BIGINT NOT NULL,
      rate          NUMERIC,
      amount        BIGINT NOT NULL,
      status        TEXT NOT NULL,
      paid_on       DATE,
      notes         JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`DO $$ BEGIN
    ALTER TABLE commissions ADD CONSTRAINT commissions_status_check CHECK (status IN ('payable','paid'));
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await client.query(`DO $$ BEGIN
    ALTER TABLE commissions ADD CONSTRAINT commissions_loan_unique UNIQUE (loan_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

  for (const r of ROWS) {
    await client.query(
      `INSERT INTO commissions (loan_id, beneficiaries, basis_profit, rate, amount, status, paid_on, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (loan_id) DO UPDATE SET
         beneficiaries = EXCLUDED.beneficiaries, basis_profit = EXCLUDED.basis_profit,
         rate = EXCLUDED.rate, amount = EXCLUDED.amount, status = EXCLUDED.status,
         paid_on = EXCLUDED.paid_on, notes = EXCLUDED.notes, updated_at = now()`,
      [r.loanId, BENEFICIARIES, r.basisProfit, r.rate, r.amount, r.status, r.paidOn, JSON.stringify(r.notes)]
    );
  }

  // The missing outflow. Guarded so a re-run cannot double-deduct.
  const ins = await client.query(
    `INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on)
     SELECT 'founder', -300000, $1, 'praia', '2026-09-09'
     WHERE NOT EXISTS (
       SELECT 1 FROM cash_movements
       WHERE account = 'founder' AND amount = -300000 AND loan_id = 'praia' AND occurred_on = '2026-09-09'
     )`,
    [PRAIA_COMMISSION_DESCRIPTION]
  );
  console.log(ins.rowCount === 1 ? "PRAÏA commission outflow recorded" : "PRAÏA commission outflow already present, left alone");

  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("rolled back:", err.message);
  process.exitCode = 1;
}

// ---- verify -----------------------------------------------------------------
const f = (n) => Number(n).toLocaleString("en-US");
const { rows } = await client.query(`
  SELECT c.loan_id, l.borrower, c.basis_profit::bigint bp, c.rate, c.amount::bigint amt, c.status, c.paid_on
  FROM commissions c JOIN loans l ON l.id = c.loan_id ORDER BY c.amount DESC
`);
console.log("\nloan                   borrower                      profit    rate   commission  status");
for (const r of rows) {
  console.log(
    `${r.loan_id.padEnd(22)} ${String(r.borrower).slice(0, 28).padEnd(29)} ${f(r.bp).padStart(9)}  ${
      r.rate === null ? " flat" : (Number(r.rate) * 100).toFixed(0).padStart(3) + "%"
    }  ${f(r.amt).padStart(10)}  ${r.status}${r.paid_on ? " " + new Date(r.paid_on).toISOString().slice(0, 10) : ""}`
  );
}
const { rows: sums } = await client.query(
  "SELECT status, SUM(amount)::bigint total, COUNT(*)::int n FROM commissions GROUP BY status ORDER BY status"
);
console.log("");
for (const s of sums) console.log(`  ${s.status.padEnd(8)} ${f(s.total).padStart(9)}  (${s.n} loan${s.n > 1 ? "s" : ""})`);

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint b FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("\ncash after the correction");
for (const r of bal) {
  tot += Number(r.b);
  console.log(`  ${r.account.padEnd(9)} ${f(r.b).padStart(10)}`);
}
console.log(`  ${"TOTAL".padEnd(9)} ${f(tot).padStart(10)}`);
await client.end();
