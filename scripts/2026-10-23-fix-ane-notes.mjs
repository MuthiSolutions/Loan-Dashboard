// Ane Jean Philippe Ane (ane-jean-philippe): repair the notes that crash /loan-book.
//
// The 2026-10-21 penalty-fix script (v1) appended a note as a JSON OBJECT {text: "..."}
// instead of a plain string. React cannot render an object, so Ane's loan card threw
// "Objects are not valid as a React child" and took the whole /loan-book page down
// (the "Full detail, loan by loan" cards are rendered server-side with the page).
// The v2 script appended a second note as a string, but worded as a changelog
// ("CORRECTION ... manual_amount_override = 28000"), which breaks the plain-notes rule
// and is no longer accurate.
//
// This script:
//   1. Removes both of those notes from ane-jean-philippe.
//   2. Adds one plain, self-contained note stating the current position.
//   3. Safety sweep: converts any non-string note on ANY loan into plain text, so no
//      other loan can crash the page the same way (reports what it touched).
//
// Transactional and idempotent: re-running changes nothing once applied.
// Run:  node scripts/2026-10-23-fix-ane-notes.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

const envLine = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) throw new Error(".env.local has no DATABASE_URL line");
const client = new pg.Client({ connectionString: envLine.slice("DATABASE_URL=".length).trim() });

const LOAN_ID = "ane-jean-philippe";
const CLEAN_NOTE =
  "On 15 October 2026 the balance agreed with the borrower was 228,000 FCFA. He paid 200,000 FCFA " +
  "that day; the remaining 28,000 FCFA accrues a 1% penalty per day, compounded daily, until it is settled.";

const isV1Note = (n) =>
  typeof n === "string" ? n.startsWith("15 October 2026: 200,000 FCFA received") : true; // any non-string = the broken v1 object
const isV2Note = (n) => typeof n === "string" && n.startsWith("21 Oct 2026 CORRECTION");
const toText = (n) => (typeof n === "string" ? n : n && typeof n.text === "string" ? n.text : JSON.stringify(n));

await client.connect();
try {
  await client.query("BEGIN");

  // --- 1 + 2: Ane ---
  const { rows } = await client.query("SELECT notes FROM loans WHERE id = $1 FOR UPDATE", [LOAN_ID]);
  if (rows.length === 0) throw new Error(`loan '${LOAN_ID}' not found`);
  const before = rows[0].notes || [];
  console.log(`BEFORE (${before.length} notes):`);
  before.forEach((n, i) => console.log(`  [${i}] ${typeof n === "string" ? "string" : "OBJECT"}: ${toText(n).slice(0, 110)}…`));

  const kept = before.filter((n) => !isV1Note(n) && !isV2Note(n));
  if (!kept.includes(CLEAN_NOTE)) kept.push(CLEAN_NOTE);
  await client.query("UPDATE loans SET notes = $1::jsonb, updated_at = now() WHERE id = $2", [JSON.stringify(kept), LOAN_ID]);

  // --- 3: safety sweep across every loan ---
  const all = await client.query("SELECT id, notes FROM loans FOR UPDATE");
  let swept = 0;
  for (const r of all.rows) {
    const notes = Array.isArray(r.notes) ? r.notes : [];
    if (notes.some((n) => typeof n !== "string")) {
      await client.query("UPDATE loans SET notes = $1::jsonb, updated_at = now() WHERE id = $2", [JSON.stringify(notes.map(toText)), r.id]);
      console.log(`  swept non-string notes on ${r.id}`);
      swept++;
    }
  }

  await client.query("COMMIT");

  const after = (await client.query("SELECT notes FROM loans WHERE id = $1", [LOAN_ID])).rows[0].notes;
  console.log(`\nAFTER (${after.length} notes, all plain text):`);
  after.forEach((n, i) => console.log(`  [${i}] ${typeof n === "string" ? "string" : "OBJECT"}: ${toText(n).slice(0, 110)}…`));
  console.log(`\nSafety sweep: ${swept} other loan(s) had non-string notes.`);
  console.log("✓ Done. Refresh /loan-book — no deploy needed.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  await client.end();
}
