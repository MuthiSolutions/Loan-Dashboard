// A new pending disbursement: a referral from Yann-Samuel (the PRAÏA borrower) — his aunt. She wants
// 5,000,000 for 3 months at 20% flat interest, so 6,000,000 to repay, and needs the funds this week,
// before Thursday 8 October 2026.
//
// Terms are agreed verbally but nothing is signed yet and her name is not on file, so this goes in as
// a pending request (kind = 'pipeline_pending') with the figures that are known. Paper it and capture
// her identity before disbursing.

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const ROW = {
  id: "yann-samuel-aunt",
  kind: "pipeline_pending",
  borrower: "Yann-Samuel's aunt (referral)",
  purpose: "Personal financing (referral from Yann-Samuel)",
  principal: 5000000,
  fees: [{ label: "Intérêts (20%)", amount: 1000000 }],
  total_due: 6000000,
  requested_amount: 5000000,
  status: "Referral — needs funds before Thu 8 Oct",
  notes: [
    "Referral from Yann-Samuel, the PRAÏA borrower: his aunt. 5,000,000 for 3 months at 20% flat interest — 6,000,000 to repay. She needs the funds this week, before Thursday 8 October 2026.",
    "No signed contract yet and her name is not on file; to be papered and her identity captured before disbursement.",
  ],
};

await client.connect();
try {
  await client.query("BEGIN");
  const exists = await client.query("SELECT 1 FROM loans WHERE id = $1", [ROW.id]);
  if (exists.rowCount > 0) {
    console.log(`skip ${ROW.id} (already present)`);
  } else {
    await client.query(
      `INSERT INTO loans (id, kind, borrower, purpose, principal, fees, total_due, requested_amount, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)`,
      [ROW.id, ROW.kind, ROW.borrower, ROW.purpose, ROW.principal, JSON.stringify(ROW.fees),
       ROW.total_due, ROW.requested_amount, ROW.status, JSON.stringify(ROW.notes)]
    );
    console.log(`inserted ${ROW.id}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const { rows } = await client.query(
  "SELECT id, kind, status, principal, total_due FROM loans WHERE id = 'yann-samuel-aunt'"
);
console.log("entry:", rows[0]);
await client.end();
