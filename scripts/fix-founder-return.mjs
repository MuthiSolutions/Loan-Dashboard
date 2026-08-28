import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(
  "UPDATE cash_movements SET description = $1 WHERE id = 8",
  ["Returned to the bank by the founder, out of funds he was holding"]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, occurred_on) VALUES ($1, $2, $3, $4)",
  ["founder", -300000, "Returned to the bank — the original opening balance he was holding", "2026-08-28"]
);
await client.query(
  "INSERT INTO cash_movements (account, amount, description, occurred_on) VALUES ($1, $2, $3, $4)",
  ["founder", -150000, "Returned to the bank — part of the PRAÏA cash he was holding", "2026-08-28"]
);

const { rows } = await client.query("SELECT account, SUM(amount) AS total FROM cash_movements GROUP BY account");
console.log(rows);
await client.end();
