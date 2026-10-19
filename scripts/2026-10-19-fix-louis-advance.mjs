// Correction: Louis Boah's salary advance (17 October 2026) was recorded as 200,000 but was
// actually 150,000. This adjusts that single founder-cash movement from -200,000 to -150,000,
// returning 50,000 to founder cash. Idempotent: no-op once it already reads -150,000.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const DESC = "Advance on salary — Louis Boah";
const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");

  const { rows } = await client.query(
    "SELECT id, amount::bigint AS amount, occurred_on FROM cash_movements WHERE account = 'founder' AND description = $1 ORDER BY id",
    [DESC]
  );
  console.log("Louis advance legs found:", JSON.stringify(rows));
  if (rows.length === 0) throw new Error("no Louis advance movement found; nothing to correct");
  if (rows.length > 1) throw new Error(`found ${rows.length} Louis advance legs; aborting so none is mis-adjusted`);

  const res = await client.query(
    "UPDATE cash_movements SET amount = -150000, description = 'Advance on salary — Louis Boah (150,000)' WHERE account = 'founder' AND description = $1 AND amount = -200000",
    [DESC]
  );
  console.log(res.rowCount === 1 ? "adjusted Louis advance 200,000 -> 150,000" : "no -200,000 leg to adjust (already corrected?)");

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows: bal } = await client.query(
  "SELECT account, SUM(amount)::bigint t FROM cash_movements GROUP BY account ORDER BY account"
);
let tot = 0;
console.log("cash now:");
for (const r of bal) { tot += Number(r.t); console.log(`  ${r.account.padEnd(8)} ${f(r.t).padStart(12)}`); }
console.log(`  ${"TOTAL".padEnd(8)} ${f(tot).padStart(12)}`);
await client.end();
