// Backfill from David-Allan Koizan's own fiche de financement (koizan-amoi-fiche.pdf), which already
// records his profession and tenure — they were just missing from the loan record. His employer
// (LOXEA Côte d'Ivoire, CDI since 11 August 2025) and income (1,004,784) are already on file.
//
// Nothing invented: everything here is read straight off his fiche.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

await client.connect();
try {
  const res = await client.query(
    `UPDATE loans
        SET profession = COALESCE(profession, 'Commercial'),
            tenure_years = COALESCE(tenure_years, 1),
            updated_at = now()
      WHERE id = 'koizan'`
  );
  if (res.rowCount === 0) throw new Error("loan 'koizan' not found");
} finally {
  // no-op
}

const { rows } = await client.query(
  "SELECT profession, employer, employment_type, monthly_income, tenure_years FROM loans WHERE id = 'koizan'"
);
console.log("koizan (David-Allan):", rows[0]);
await client.end();
