// 21 October 2026 — inspect Ane Jean Philippe loan state
import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();

// 1. Show loans table columns first
const { rows: cols } = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'loans'
  ORDER BY ordinal_position
`);
console.log("\n── LOANS COLUMNS ──");
for (const c of cols) console.log(`  ${c.column_name.padEnd(25)} ${c.data_type}`);

// 2. Loan row (all columns)
const { rows: loans } = await client.query(`
  SELECT * FROM loans
  WHERE id ILIKE '%ane%' OR borrower ILIKE '%ane%'
`);
console.log("\n── LOAN ROW ──");
for (const l of loans) {
  for (const [k, v] of Object.entries(l)) {
    console.log(`  ${String(k).padEnd(25)} ${v}`);
  }
}

// 3. Cash movements for this loan
const loanId = loans[0]?.id;
if (loanId) {
  const { rows: moves } = await client.query(`
    SELECT * FROM cash_movements WHERE loan_id = $1 ORDER BY date
  `, [loanId]);
  console.log("\n── CASH MOVEMENTS ──");
  if (moves.length === 0) console.log("  (none)");
  for (const m of moves) {
    for (const [k, v] of Object.entries(m)) {
      console.log(`  ${String(k).padEnd(25)} ${v}`);
    }
    console.log("  ---");
  }
}

await client.end();
