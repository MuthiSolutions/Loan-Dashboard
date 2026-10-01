// Step 1 of 2 for the Excel loan book JP asked for.
//
// Dumps the whole loan book out of Postgres as JSON so the spreadsheet builder has
// no database dependency of its own. Run this, then:
//   python scripts/build-loan-book-xlsx.py <json path> <xlsx path>
//
// Usage: node scripts/export-loan-book.mjs [output.json]

import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "loan-book-data.json";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error("DATABASE_URL not found in .env.local");

const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });
await client.connect();

// Dates come back as JS Date objects in the server's zone; force them to the plain
// ISO day the column actually holds, or everything shifts by a day.
const toPlain = (rows) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v instanceof Date ? new Date(v).toISOString().slice(0, 10) : v])
    )
  );

// Sequential, not Promise.all: a single pg Client runs one query at a time and
// overlapping calls on it are deprecated.
const loans = await client.query("SELECT * FROM loans ORDER BY kind, COALESCE(disbursed_on, due_on), id");
const cash = await client.query("SELECT * FROM cash_movements ORDER BY occurred_on, id");
const commissions = await client.query("SELECT * FROM commissions ORDER BY loan_id");

writeFileSync(
  out,
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      loans: toPlain(loans.rows),
      cashMovements: toPlain(cash.rows),
      commissions: toPlain(commissions.rows),
    },
    null,
    2
  )
);

console.log(`${out}: ${loans.rowCount} loans, ${cash.rowCount} cash movements, ${commissions.rowCount} commissions`);
await client.end();
