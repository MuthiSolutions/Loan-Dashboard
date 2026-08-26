import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const connectionString = envLine.slice("DATABASE_URL=".length).trim();

const history = [
  {
    date: "2026-08-08",
    type: "promise",
    description:
      "Explained the delay (event revenue not yet collected, bank holiday) and committed to organizing a bank settlement within the coming days.",
  },
  {
    date: "2026-08-10",
    type: "promise",
    description: "Reaffirmed to Muthi's other stakeholder that the commitment would be honored in short order.",
  },
  {
    date: "2026-08-15",
    type: "promise",
    description:
      "Proposed, via the team, a settlement date of Sunday 23 August. Muthi flagged this as the last extension it would grant.",
  },
  {
    date: "2026-08-20",
    type: "broken_promise",
    description: "No payment had arrived by the promised date. Stakeholder demanded full payment that week, with no further extensions accepted.",
  },
  {
    date: "2026-08-22",
    type: "partial_payment",
    description:
      "4,000,000 FCFA received from co-founder Kellyan, leaving about 2,437,500 FCFA outstanding. Borrower committed to settling the remainder on Monday 24 August.",
  },
  {
    date: "2026-08-24",
    type: "broken_promise",
    description: "The promised Monday settlement of the remaining balance did not happen.",
  },
  {
    date: "2026-08-24",
    type: "promise",
    description: "New commitment made to clear the remaining balance before the end of the week.",
  },
];

const client = new pg.Client({ connectionString });
await client.connect();
await client.query("UPDATE loans SET repayment_history = $1 WHERE id = $2", [JSON.stringify(history), "praia"]);
const { rows } = await client.query("SELECT id, repayment_history FROM loans WHERE id = $1", ["praia"]);
console.log(JSON.stringify(rows, null, 2));
await client.end();
