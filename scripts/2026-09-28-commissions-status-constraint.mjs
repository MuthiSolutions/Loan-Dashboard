import pg from "pg";
import { readFileSync } from "node:fs";

// The commissions table was created by 2026-09-28-analyst-commissions.mjs before its
// definition landed in lib/schema.sql, and that definition constrains status to
// ('paid', 'payable'). A fresh database built from schema.sql would therefore have the
// check and the live one would not, which is exactly the drift that lets a typo like
// 'Payable' through months later and quietly drops a row out of both totals on the
// dashboard. This brings the live table up to the schema.
//
// Idempotent: the constraint is dropped by name before being added.

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

await client.connect();
try {
  await client.query("BEGIN");

  // Fail loudly rather than silently refusing to add the constraint if data already violates it.
  const { rows: bad } = await client.query(
    "SELECT id, status FROM commissions WHERE status NOT IN ('paid', 'payable')"
  );
  if (bad.length > 0) {
    throw new Error(`commissions rows with an unexpected status: ${JSON.stringify(bad)}`);
  }

  await client.query("ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check");
  await client.query(
    "ALTER TABLE commissions ADD CONSTRAINT commissions_status_check CHECK (status IN ('paid', 'payable'))"
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid = 'commissions'::regclass AND contype = 'c'`
);
for (const r of rows) console.log(`${r.conname}: ${r.def}`);

await client.end();
