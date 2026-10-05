// Founder correction: Léocadie Koffi actually earns about 1,000,000 FCFA a month, not the 200,000
// "revenu salarié déclaré" written on the convention. Set her income to the real figure and drop the
// affordability note, which was based on the understated convention figure and no longer holds.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const OLD_NOTE =
  "The 325,000 monthly instalment exceeds her declared salary of 200,000 (CDI at ICAP Global Health, 17 years); repayment relies on income from her Kaelle Market & Services trading.";

await client.connect();
try {
  const res = await client.query(
    `UPDATE loans
        SET monthly_income = 1000000,
            notes = notes - $1::text,
            updated_at = now()
      WHERE id = 'pipeline-koffi'`,
    [OLD_NOTE]
  );
  if (res.rowCount === 0) throw new Error("loan 'pipeline-koffi' not found");
} finally {
  // no-op
}

const { rows } = await client.query(
  "SELECT monthly_income, notes FROM loans WHERE id = 'pipeline-koffi'"
);
console.log("monthly_income:", rows[0].monthly_income);
console.log("notes:");
for (const n of rows[0].notes) console.log("  -", n);
await client.end();
