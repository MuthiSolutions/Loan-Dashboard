// 17 October 2026 — the founder brought in fresh capital. This records a founder-account capital
// contribution sized to bring the founder cash balance to exactly 6,200,000 FCFA.
//
// It reads the current founder balance live and inserts the difference, so it doesn't depend on a
// hand-entered starting figure. New money (a fresh injection), not recycled lending capital.
//
// Idempotent: if founder cash is already 6,200,000 it does nothing. Refuses to run if the current
// balance already exceeds the target (that would mean recording a negative "capital" movement —
// surfaced for you to check rather than guessed).

import pg from "pg";
import { readFileSync } from "node:fs";

const TARGET_FOUNDER = 6200000;
const OCCURRED_ON = "2026-10-17";
const DESC = "Capital contribution from founder";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");

  const { rows } = await client.query(
    "SELECT COALESCE(SUM(amount), 0)::bigint AS bal FROM cash_movements WHERE account = 'founder'"
  );
  const current = Number(rows[0].bal);
  const delta = TARGET_FOUNDER - current;
  console.log(`founder cash before: ${f(current)}`);
  console.log(`target:              ${f(TARGET_FOUNDER)}`);
  console.log(`injection to record: ${f(delta)}`);

  if (delta === 0) {
    console.log("already at target; nothing to record.");
    await client.query("ROLLBACK");
  } else if (delta < 0) {
    throw new Error(
      `founder cash (${f(current)}) already exceeds the 6,200,000 target by ${f(-delta)}; ` +
      "aborting rather than recording a negative capital movement. Re-check the figure."
    );
  } else {
    await client.query(
      "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ('founder', $1, $2, NULL, $3)",
      [delta, DESC, OCCURRED_ON]
    );
    console.log(`recorded +${f(delta)} founder capital contribution.`);
    await client.query("COMMIT");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("\ncash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);
await client.end();
