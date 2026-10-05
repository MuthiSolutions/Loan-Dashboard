// Correction to the Jean Philippe penalty note.
//
// The switch to daily was recorded earlier with the daily 1% charged on the original total due
// (2,000 FCFA/day). The agreed terms are: the one weekly grace week took what he owed to 202,000,
// and the 1% per day from 2 October is charged on that 202,000 (2,020 FCFA/day) — the grace week is
// folded into the daily base, not left out. lib/loans.ts (formulaAmountDue) now stacks the phases so
// the amount owed reflects this; this script only fixes the human-readable note to match.
//
// Idempotent: the old note is removed by value and the new one appended once.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const OLD =
  "Granted one week after the 25 September 2026 due date to repay at the weekly 1% penalty. That " +
  "grace week ended Friday 2 October 2026; from 2 October the late penalty moves to 1% per day on " +
  "the total due (2,000 FCFA/day). The one grace week is locked at 2,000 (one weekly 1%), and daily " +
  "accrual runs from 2 October onward.";

const NEW =
  "Granted one week after the 25 September 2026 due date to repay at the weekly 1%, which took what " +
  "he owed to 202,000. From 2 October 2026 the late penalty is 1% per day charged on that 202,000 " +
  "(2,020 FCFA a day), not on the original total due. The grace week is folded into the daily base, " +
  "and daily accrual runs from 2 October onward.";

await client.connect();
try {
  await client.query("BEGIN");

  const { rows } = await client.query(
    "SELECT repaid_on FROM loans WHERE id = 'ane-jean-philippe' FOR UPDATE"
  );
  if (rows.length === 0) throw new Error("loan 'ane-jean-philippe' not found");
  if (rows[0].repaid_on !== null) throw new Error("ane-jean-philippe is already settled; not changing penalty terms");

  await client.query(
    `UPDATE loans
        SET notes = CASE
              WHEN notes @> $1::jsonb THEN notes
              ELSE (notes - $2::text) || $1::jsonb
            END,
            updated_at = now()
      WHERE id = 'ane-jean-philippe'`,
    [JSON.stringify([NEW]), OLD]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query("SELECT notes FROM loans WHERE id = 'ane-jean-philippe'");
console.log("ane-jean-philippe notes:");
for (const n of rows[0].notes) console.log("  -", n);

await client.end();
