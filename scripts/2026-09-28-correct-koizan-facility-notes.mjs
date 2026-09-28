import pg from "pg";
import { readFileSync } from "node:fs";

// Corrections to the earlier script run today
// (2026-09-28-koizan-settlement-and-facility-relaunch.mjs).
//
// 1. RETRACTION. That script wrote a note claiming the signed convention states
//    identity particulars found nowhere in her file. That claim was wrong. The
//    canonical loan book at Projects/Muthi-Docs/04-Loan-Book/Borrowers/
//    KOIZAN-Marie-Andrea holds Fiche_Financement_KOIZAN_Marie_Andrea.pdf, which
//    records her full names, nationality, date and place of birth, CNI number
//    with issue and expiry dates, NNI and address, and lists the CNI under
//    "Fournie". The scanned card is at KYC/CNI KOIZAN.pdf. Every particular in
//    the signed convention is corroborated. The copies of her fiche in this
//    repo's public/documents are an earlier variant that still shows
//    "À renseigner", which is what misled the check.
//
// 2. sort_order. The earlier script took MAX(sort_order) + 1 across all loans.
//    pipeline-koffi holds 100, so this active loan was given 101. Active loans
//    belong in the 1 to 8 band and pipeline rows in 100 and above.
//
// 3. updated_at. The table has no trigger, so the settlement UPDATE left
//    loans.koizan stamped 20 August.
//
// Idempotent and wrapped in a transaction.

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });
await client.connect();

const CORRECTED_IDENTITY_NOTE =
  "Identity verified on file. The canonical loan book (Muthi-Docs, 04-Loan-Book/Borrowers/KOIZAN-Marie-Andrea) holds her financing sheet listing the Carte Nationale d'Identité as \"Fournie\", with her full names, nationality, date and place of birth, CNI number CI003056257 issued 28/01/2022 and valid to 28/01/2032, NNI and address. The scanned card is filed under KYC. The identity block of the signed convention matches it. Note that the copies of her fiche in this repository's public/documents are an earlier variant showing \"À renseigner\" and should not be read as the current state of the file.";

const STALE_PREFIX = "The signed convention states a nationality";

try {
  await client.query("BEGIN");

  // ---- 1. Replace the retracted note on the facility row -------------------
  const { rows } = await client.query(
    "SELECT notes, sort_order FROM loans WHERE id = 'koizan-marie-andrea-2'"
  );
  if (rows.length === 0) throw new Error("koizan-marie-andrea-2 not found");

  const notes = rows[0].notes || [];
  const kept = notes.filter((n) => !String(n).startsWith(STALE_PREFIX));
  const removed = notes.length - kept.length;
  if (!kept.some((n) => String(n).startsWith("Identity verified on file"))) {
    kept.push(CORRECTED_IDENTITY_NOTE);
  }

  // ---- 2. Re-band sort_order among active loans ----------------------------
  const { rows: sortRows } = await client.query(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM loans WHERE kind = 'active' AND sort_order < 100"
  );
  const newSort = sortRows[0].n;

  await client.query(
    "UPDATE loans SET notes = $1, sort_order = $2, updated_at = now() WHERE id = $3",
    [JSON.stringify(kept), newSort, "koizan-marie-andrea-2"]
  );

  // ---- 3. Refresh the stale timestamp on David Allan's settled row ---------
  await client.query(
    "UPDATE loans SET updated_at = now() WHERE id = 'koizan' AND updated_at < '2026-09-28'"
  );

  await client.query("COMMIT");
  console.log(`retracted notes removed: ${removed}`);
  console.log(`sort_order: ${rows[0].sort_order} -> ${newSort}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("rolled back:", err.message);
  process.exitCode = 1;
}

// ---- verify ---------------------------------------------------------------
const check = await client.query(
  "SELECT id, sort_order, updated_at, notes FROM loans WHERE id IN ('koizan','koizan-marie-andrea-2') ORDER BY id"
);
for (const r of check.rows) {
  console.log(`\n--- ${r.id} (sort_order ${r.sort_order}, updated ${String(r.updated_at).slice(0, 24)}) ---`);
  for (const n of r.notes || []) console.log("  •", String(n).slice(0, 150));
}
const bal = await client.query(
  "SELECT account, SUM(amount)::bigint AS balance FROM cash_movements GROUP BY account ORDER BY account"
);
console.log("\nbalances (must be unchanged):", JSON.stringify(bal.rows));
await client.end();
