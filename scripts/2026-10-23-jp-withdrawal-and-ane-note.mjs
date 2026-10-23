// Two live changes, in one transaction:
//
//  1. JP withdrawal: JP Bénie (Associé-Gérant) took 1,000,000 FCFA of company cash from the
//     office box for personal use. Recorded as a 1,000,000 outflow on the office-box
//     ('founder') account. It also leaves the lending pool, so WORKING_CAPITAL_DEPOSITED drops
//     from 9,538,000 to 8,538,000 — but that constant lives in lib/loans.ts and ships with the
//     next code push; this script only records the cash movement.
//
//  2. Ane Jean Philippe: remove the now-outdated note about the penalty running on 202,000 from
//     2 October (it contradicts the current 228,000-from-15-October position).
//
// Transactional and idempotent: re-running changes nothing once applied.
// Run:  node scripts/2026-10-23-jp-withdrawal-and-ane-note.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

// --- JP withdrawal ---
const WITHDRAWAL = 1000000;
const ACCOUNT = "founder"; // the office box
const WHEN = "2026-10-23"; // <-- change here if it was sent on a different day
const DESC = "JP Bénie (Associé-Gérant) withdrew 1,000,000 FCFA of company cash from the office box for personal use";

// --- Ane note removal ---
const ANE_ID = "ane-jean-philippe";
const isOldDailyNote = (n) =>
  typeof n === "string" &&
  n.includes("From 2 October 2026 the late penalty is 1% per day charged on that 202,000");

const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";

await client.connect();
try {
  await client.query("BEGIN");

  // 1. JP withdrawal (idempotent on description)
  const existing = await client.query("SELECT 1 FROM cash_movements WHERE description = $1", [DESC]);
  if (existing.rowCount > 0) {
    console.log("JP withdrawal already recorded — leaving it.");
  } else {
    await client.query(
      "INSERT INTO cash_movements (account, amount, description, occurred_on) VALUES ($1, $2, $3, $4)",
      [ACCOUNT, -WITHDRAWAL, DESC, WHEN]
    );
    console.log(`JP withdrawal recorded: ${fmt(-WITHDRAWAL)} on the office box, ${WHEN}.`);
  }

  // 2. Ane note removal
  const { rows } = await client.query("SELECT notes FROM loans WHERE id = $1 FOR UPDATE", [ANE_ID]);
  if (rows.length === 0) throw new Error(`loan '${ANE_ID}' not found`);
  const notes = rows[0].notes || [];
  const kept = notes.filter((n) => !isOldDailyNote(n));
  if (kept.length === notes.length) {
    console.log("Ane: the old 202,000/2-Oct note is not present (already removed).");
  } else {
    await client.query("UPDATE loans SET notes = $1::jsonb, updated_at = now() WHERE id = $2", [JSON.stringify(kept), ANE_ID]);
    console.log(`Ane: removed the outdated 202,000/2-Oct note (${notes.length} -> ${kept.length} notes).`);
  }

  await client.query("COMMIT");

  // report balances
  const bal = await client.query("SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account");
  console.log("\nCash balances now:");
  for (const b of bal.rows) console.log(`  ${b.account === "founder" ? "office box" : b.account}: ${fmt(Number(b.balance))}`);
  console.log("\nAne notes now:");
  for (const n of kept) console.log(`  - ${String(n).slice(0, 100)}…`);
  console.log("\n✓ Done. (Working capital 9,538,000 -> 8,538,000 ships with the next code push.)");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await client.end();
}
