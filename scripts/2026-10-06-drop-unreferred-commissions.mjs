import pg from "pg";
import { readFileSync } from "node:fs";

// Founder correction: analyst commissions are only owed on loans Louis and Emmanuel actually
// referred. Three loans were seeded with a 20% commission but were not brought in by the analysts
// (they came through JP's own network), so no commission is owed on them. Drop those rows.
//
//   koizan                Amoi David-Allan Koizan       28,000 payable
//   konan                 Claude Arnaud Niky Konan      12,400 payable
//   koizan-marie-andrea   Marie Andréa Koizan           10,000 payable
//
// All three were PAYABLE, and a payable commission is deliberately not a cash movement (the fee was
// held by JP, not disbursed), so deleting them does not touch any cash balance. PRAÏA stays: it was
// an analyst deal, already paid.
//
// Idempotent and transactional. Safe to re-run.

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });
await client.connect();

const UNREFERRED = ["koizan", "konan", "koizan-marie-andrea"];

try {
  await client.query("BEGIN");
  const del = await client.query("DELETE FROM commissions WHERE loan_id = ANY($1::text[])", [UNREFERRED]);
  console.log(`deleted ${del.rowCount} commission row(s) for loans not referred by the analysts`);
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
  FROM commissions c JOIN loans l ON l.id = c.loan_id ORDER BY c.status DESC, c.amount DESC
`);
console.log("\nremaining commissions");
console.log("loan                   borrower                      profit    rate   commission  status");
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
if (sums.length === 0) console.log("  (no commission rows remain)");
await client.end();
