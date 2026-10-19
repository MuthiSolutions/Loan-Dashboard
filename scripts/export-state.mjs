// Read-only snapshot of the live loan book, for mirroring into Notion accurately.
// Prints JSON: every loan (active + repaid + pipeline), all cash movements, and all commissions,
// plus computed outstanding/penalty is left to the reader. Changes nothing.
//
//   node scripts/export-state.mjs            # prints JSON to stdout
//   node scripts/export-state.mjs > state.json

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

await client.connect();
const loans = (await client.query(
  `SELECT id, kind, borrower, purpose, principal::bigint, total_due::bigint,
          disbursed_on, due_on, amount_paid::bigint, last_payment_on, repaid_on, declined_on,
          late_penalty_rate_per_week, late_penalty_period, late_penalty_switch_on, late_penalty_period_after,
          contract_ref, fees, documents, notes, repayment_history
     FROM loans ORDER BY sort_order, created_at`
)).rows;
const cash = (await client.query(
  "SELECT account, amount::bigint, description, loan_id, occurred_on FROM cash_movements ORDER BY occurred_on, id"
)).rows;
const commissions = (await client.query(
  "SELECT loan_id, beneficiaries, basis_profit::bigint, rate, amount::bigint, status, paid_on FROM commissions ORDER BY loan_id"
)).rows;
const balances = (await client.query(
  "SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account"
)).rows;

console.log(JSON.stringify({ exportedAt: new Date().toISOString(), balances, loans, cash, commissions }, null, 2));
await client.end();
