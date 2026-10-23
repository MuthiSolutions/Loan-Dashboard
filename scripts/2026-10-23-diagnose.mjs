// READ-ONLY diagnostic. No writes.
// Dumps every loan row (all fields), cash movements by account, and commissions,
// and flags anything that could crash the loan-book render (bad fees/documents/
// notes shape, missing due_on/total_due on an active loan, bad dates).
//
// Run:  node scripts/2026-10-23-diagnose.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

// Mirror lib/db.ts: DATE columns as 'YYYY-MM-DD' strings.
pg.types.setTypeParser(1082, (v) => v);

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";

await client.connect();

// --- LOANS ---
const { rows: loans } = await client.query("SELECT * FROM loans ORDER BY kind, sort_order, created_at");
console.log(`\n===== LOANS (${loans.length}) =====`);
for (const l of loans) {
  console.log(`\n--- ${l.id}  [${l.kind}]  ${l.borrower}`);
  console.log(`  principal=${l.principal}  total_due=${l.total_due}  amount_paid=${l.amount_paid}  repaid_on=${l.repaid_on}`);
  console.log(`  disbursed_on=${l.disbursed_on}  due_on=${l.due_on}`);
  console.log(`  late: rate=${l.late_penalty_rate_per_week} period=${l.late_penalty_period} switch_on=${l.late_penalty_switch_on} after=${l.late_penalty_period_after} penalty_switch_base=${l.penalty_switch_base}`);
  console.log(`  manual_override=${l.manual_amount_override}`);
  const shape = (name, v) => {
    const ok = Array.isArray(v);
    console.log(`  ${name}: ${ok ? "array(" + v.length + ")" : "NOT ARRAY -> " + JSON.stringify(v)}`);
  };
  shape("fees", l.fees);
  shape("documents", l.documents);
  shape("notes", l.notes);
  shape("repayment_history", l.repayment_history);
}

// --- FLAGS ---
console.log(`\n===== POTENTIAL CRASH FLAGS =====`);
let flags = 0;
for (const l of loans) {
  const problems = [];
  if (!Array.isArray(l.fees)) problems.push("fees not array");
  if (!Array.isArray(l.documents)) problems.push("documents not array");
  if (!Array.isArray(l.notes)) problems.push("notes not array");
  if (!Array.isArray(l.repayment_history)) problems.push("repayment_history not array");
  if (l.kind === "active") {
    if (l.due_on == null) problems.push("active loan with NULL due_on");
    if (l.total_due == null) problems.push("active loan with NULL total_due");
  }
  if (l.late_penalty_switch_on && !l.late_penalty_period_after) problems.push("switch_on set but period_after NULL");
  if (problems.length) { flags++; console.log(`  ⚠ ${l.id}: ${problems.join("; ")}`); }
}
if (!flags) console.log("  none — no obvious data cause for a render crash");

// --- CASH ---
const { rows: bal } = await client.query("SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account");
console.log(`\n===== CASH BALANCES =====`);
for (const b of bal) console.log(`  ${b.account}: ${fmt(Number(b.balance))}`);
const { rows: recent } = await client.query("SELECT id, account, amount, description, occurred_on, transfer_id FROM cash_movements ORDER BY occurred_on DESC, id DESC LIMIT 12");
console.log(`\n  recent movements:`);
for (const m of recent) console.log(`   #${m.id} ${m.occurred_on} ${m.account} ${fmt(Number(m.amount))}  ${m.description}${m.transfer_id ? "  (transfer " + m.transfer_id + ")" : ""}`);

// --- COMMISSIONS ---
const { rows: comm } = await client.query("SELECT loan_id, beneficiaries, basis_profit, amount, status FROM commissions ORDER BY status DESC, loan_id");
console.log(`\n===== COMMISSIONS (${comm.length}) =====`);
for (const c of comm) console.log(`  ${c.loan_id}: ${fmt(Number(c.amount))} ${c.status} (basis ${fmt(Number(c.basis_profit))}) — ${c.beneficiaries}`);

await client.end();
console.log("\n(done — read-only, nothing changed)");
