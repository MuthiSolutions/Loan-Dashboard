import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(
  "ALTER TABLE loans ADD COLUMN IF NOT EXISTS late_penalty_period TEXT NOT NULL DEFAULT 'week' CHECK (late_penalty_period IN ('day', 'week'))"
);

for (const id of ["koizan", "konan"]) {
  await client.query("UPDATE loans SET late_penalty_period = 'day' WHERE id = $1", [id]);

  const { rows } = await client.query("SELECT notes FROM loans WHERE id = $1", [id]);
  const notes = rows[0].notes;
  notes.push("Late penalty applied at 1% per day past the due date, by agreement with the borrower.");
  await client.query("UPDATE loans SET notes = $1 WHERE id = $2", [JSON.stringify(notes), id]);
}

const check = await client.query(
  "SELECT id, late_penalty_rate_per_week, late_penalty_period, notes FROM loans WHERE id IN ('koizan', 'konan')"
);
console.log(JSON.stringify(check.rows, null, 2));
await client.end();
