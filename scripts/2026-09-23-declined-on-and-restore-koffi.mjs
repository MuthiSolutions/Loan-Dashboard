import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

await client.query("ALTER TABLE loans ADD COLUMN IF NOT EXISTS declined_on DATE");

// Restore Leocadie's pipeline record (previously hard-deleted) with declined_on set, so she's
// excluded from the live dashboard Pipeline but still counts on the Borrowers page.
await client.query(
  `INSERT INTO loans (
    id, kind, borrower, contact, principal, fees, status, declined_on, documents, notes, sort_order
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT (id) DO UPDATE SET declined_on = EXCLUDED.declined_on, status = EXCLUDED.status`,
  [
    "pipeline-koffi",
    "pipeline_term",
    "Léocadie Koffi — Kaelle Market & Services",
    "koffi_leo@yahoo.fr",
    5000000,
    JSON.stringify([
      { label: "Financing fee (15%)", amount: 750000 },
      { label: "Management fee", amount: 500000 },
    ]),
    "Declined — not proceeding",
    "2026-09-23",
    JSON.stringify([{ path: "kaelle-koffi-fiche.pdf", label: "Fiche de financement (original terms, 18 août)" }]),
    JSON.stringify([
      "Originally approved 18 Aug 2026 at ~36% flat over 3 years: 200,000/month over 34 payments (after a 2-month deferral), 1,800,000 total financing cost, 6,800,000 total repayment. The normal 200,000 gestion fee was waived on that version.",
      "Countered at 15% on the 5,000,000 principal (750,000) plus a flat 500,000 management fee — 1,250,000 total, 6,250,000 repayment if signed on these terms.",
      "Not proceeding.",
    ]),
    100,
  ]
);

const check = await client.query("SELECT id, kind, borrower, status, declined_on FROM loans WHERE id = 'pipeline-koffi'");
console.log(JSON.stringify(check.rows, null, 2));
await client.end();
