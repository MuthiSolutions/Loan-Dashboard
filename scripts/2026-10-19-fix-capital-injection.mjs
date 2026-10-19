// Correction: the founder capital injection (17 October 2026) was sized to bring founder cash to
// 6,200,000 while Louis's advance was still mis-recorded at 200,000. After Louis was corrected to
// 150,000 (+50,000 back to founder), the recorded injection of 4,438,000 overstated the true
// injection by 50,000. The real fresh capital needed to reach 6,200,000 (with Louis at 150,000) is
// 4,388,000. This trims that single movement by 50,000, landing founder cash at the intended figure.
// Idempotent: no-op once it already reads 4,388,000.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const DESC = "Capital contribution from founder";
const f = (x) => Number(x).toLocaleString("en-US");

await client.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    "SELECT id, amount::bigint AS amount FROM cash_movements WHERE account = 'founder' AND description = $1 ORDER BY id",
    [DESC]
  );
  console.log("injection legs found:", JSON.stringify(rows));
  if (rows.length === 0) throw new Error("capital injection movement not found");
  if (rows.length > 1) throw new Error(`found ${rows.length} injection legs; aborting`);

  const res = await client.query(
    "UPDATE cash_movements SET amount = 4388000, description = 'Capital contribution from founder (4,388,000 to bring founder cash to 6,200,000)' WHERE account = 'founder' AND description = $1 AND amount = 4438000",
    [DESC]
  );
  console.log(res.rowCount === 1 ? "trimmed injection 4,438,000 -> 4,388,000" : "no 4,438,000 injection to trim (already corrected?)");
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
