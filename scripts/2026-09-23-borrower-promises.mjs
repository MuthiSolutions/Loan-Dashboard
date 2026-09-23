import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

// Sevede: due 25 Sept, has announced he can't pay until the end of the month. An announced delay,
// not yet a broken promise — that becomes one only if the end of the month passes unpaid.
// Koizan Amoi (David Allan): already past his 18 Sept due date, now says he'll pay on the 25th.
// Konan: still unpaid, but no dated promise on record to log — his overdue status is already live.
const promises = [
  { id: "sevede", description: "Said he will not be able to pay until the end of the month." },
  { id: "koizan", description: "Said he will pay on 25 September." },
];

for (const { id, description } of promises) {
  const { rows } = await client.query("SELECT repayment_history FROM loans WHERE id = $1", [id]);
  const history = rows[0].repayment_history || [];
  history.push({ date: "2026-09-23", type: "promise", description });
  await client.query("UPDATE loans SET repayment_history = $1 WHERE id = $2", [JSON.stringify(history), id]);
}

const check = await client.query("SELECT id, repayment_history FROM loans WHERE id IN ('sevede', 'koizan')");
console.log(JSON.stringify(check.rows, null, 2));
await client.end();
