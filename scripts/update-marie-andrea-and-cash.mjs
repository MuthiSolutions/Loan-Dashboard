import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const client = new pg.Client({ connectionString });
await client.connect();

const fees = [{ label: "Financing fee", amount: 50000 }];
const documents = [
  { path: "koizan-marie-andrea-fiche.pdf", label: "Fiche de financement (initial, 150 000)" },
  { path: "koizan-marie-andrea-fiche-2.pdf", label: "Fiche de financement (revised, 300 000)" },
];
const notes = [
  "Proposal for the full 300,000 requested, pending her signature and the outstanding CNI and address before disbursement.",
];

await client.query(
  `UPDATE loans SET
     principal = $1,
     fees = $2,
     total_due = $3,
     status = $4,
     documents = $5,
     notes = $6,
     updated_at = now()
   WHERE id = $7`,
  [
    300000,
    JSON.stringify(fees),
    350000,
    "Fiche prepared for the full amount, awaiting her signature and CNI/address before disbursement",
    JSON.stringify(documents),
    JSON.stringify(notes),
    "koizan-marie-andrea",
  ]
);

await client.query(
  "INSERT INTO cash_movements (account, amount, description, occurred_on) VALUES ($1, $2, $3, $4)",
  ["bank", 450000, "Cash contribution from Jean-Philippe", "2026-08-28"]
);

const { rows: loanRows } = await client.query("SELECT id, principal, fees, total_due, status, documents, notes FROM loans WHERE id = $1", ["koizan-marie-andrea"]);
const { rows: cashRows } = await client.query("SELECT account, SUM(amount) AS total FROM cash_movements GROUP BY account");
console.log(JSON.stringify({ loan: loanRows[0], cashByAccount: cashRows }, null, 2));

await client.end();
