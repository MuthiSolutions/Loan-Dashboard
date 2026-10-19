// 19 October 2026 — accrue analyst commissions (Louis + Emmanuel, 20% of profit) for referred loans
// that don't yet carry one. All booked PAYABLE: the loans aren't repaid, so no money has reached the
// analysts and no cash movement is created (a payable commission stays out of the cash balances).
//
// Basis is the contracted profit (total due - principal) as a placeholder; per house rule the fee is
// finally computed on REALISED profit (including penalties collected) at repayment, so these true up
// then. PRAÏA already carries its 300,000 commission (paid) and is not touched here. Sevede's first
// loan already carries its 6,000 payable; this adds his second and third.
//
// Idempotent: a loan that already has any commission row is skipped.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const BENEF = "Louis and Emmanuel (Muthi analysts)";
const NOTE = "Accrued 19 October 2026 on contracted profit; trues up to realised profit (incl. penalties collected) at repayment.";
const COMMS = [
  { loan_id: "ane-jean-philippe", basis_profit: 50000, amount: 10000 },
  { loan_id: "sevede-2", basis_profit: 25000, amount: 5000 },
  { loan_id: "sevede-3", basis_profit: 50000, amount: 10000 },
  { loan_id: "yann-samuel-aunt", basis_profit: 600000, amount: 120000 },
];

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");
  for (const c of COMMS) {
    const exists = await client.query("SELECT 1 FROM commissions WHERE loan_id = $1", [c.loan_id]);
    if (exists.rowCount > 0) {
      console.log(`skip (already has a commission): ${c.loan_id}`);
      continue;
    }
    await client.query(
      "INSERT INTO commissions (loan_id, beneficiaries, basis_profit, rate, amount, status, notes) VALUES ($1, $2, $3, 0.2, $4, 'payable', $5::jsonb)",
      [c.loan_id, BENEF, c.basis_profit, c.amount, JSON.stringify([NOTE])]
    );
    console.log(`added payable commission ${f(c.amount)} on ${c.loan_id} (basis ${f(c.basis_profit)})`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query(
  "SELECT loan_id, amount::bigint AS amount, status FROM commissions ORDER BY status DESC, loan_id"
);
console.log("\nall commissions:");
let payable = 0, paid = 0;
for (const r of rows) {
  console.log(`  ${r.loan_id.padEnd(20)} ${f(r.amount).padStart(9)}  ${r.status}`);
  if (r.status === "payable") payable += Number(r.amount); else paid += Number(r.amount);
}
console.log(`  payable total: ${f(payable)}  |  paid total: ${f(paid)}`);
await client.end();
