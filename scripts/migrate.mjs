// One-off: creates the schema (if missing) and seeds it with the current loan book.
// Run with: node scripts/migrate.mjs   (DATABASE_URL must be set in the environment)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(__dirname, "..", "lib", "schema.sql"), "utf8");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const loans = [
  {
    id: "koizan",
    kind: "active",
    borrower: "Amoi David-Allan Koizan",
    purpose: "Emergency medical financing (hospitalization)",
    contact: "+225 05 85 91 61 94",
    principal: 300_000,
    fees: [
      { label: "Financing fee (25%)", amount: 75_000 },
      { label: "Rapid mobilization fee", amount: 25_000 },
    ],
    totalDue: 400_000,
    disbursedOn: "2026-08-18",
    dueOn: "2026-09-18",
    latePenaltyRatePerWeek: 0.01,
    contractRef: "Convention de Prêt, 18 août 2026",
    documents: [
      { label: "Fiche de financement", path: "koizan-amoi-fiche.pdf" },
      { label: "Convention de prêt", path: "koizan-amoi-convention.pdf" },
      { label: "Reconnaissance de dette", path: "koizan-amoi-reconnaissance.pdf" },
    ],
  },
  {
    id: "konan",
    kind: "active",
    borrower: "Claude Arnaud Niky Konan",
    purpose: "Urgent payment financing",
    contact: "+225 07 69 25 25 25",
    principal: 150_000,
    fees: [
      { label: "Financing fee (25%)", amount: 37_500 },
      { label: "Rapid mobilization fee", amount: 12_500 },
    ],
    totalDue: 200_000,
    disbursedOn: "2026-08-18",
    dueOn: "2026-09-18",
    latePenaltyRatePerWeek: 0.01,
    contractRef: "Convention de Prêt, 19 août 2026",
    documents: [
      { label: "Fiche de financement", path: "konan-fiche.pdf" },
      { label: "Convention de prêt", path: "konan-convention.pdf" },
      { label: "Reconnaissance de dette", path: "konan-reconnaissance.pdf" },
    ],
  },
  {
    id: "praia",
    kind: "active",
    borrower: "Yann-Samuel Kouassi Wazy Oloufoumi-Séry — projet PRAÏA",
    purpose: "Event financing",
    contact: "yoloufoumisery@gmail.com",
    principal: 5_000_000,
    fees: [{ label: "Interest (25% flat)", amount: 1_250_000 }],
    totalDue: 6_250_000,
    disbursedOn: "2026-07-02",
    dueOn: "2026-08-08",
    latePenaltyRatePerWeek: 0.01,
    contractRef: "Convention de Prêt, 2 juillet 2026",
    finalDeadline: "2026-08-23",
    documents: [
      { label: "Convention de prêt", path: "praia-convention.docx" },
      { label: "Reconnaissance de dette", path: "praia-reconnaissance.docx" },
    ],
    notes: ["Debtor granted a final extension to 23 Aug 2026, confirmed by email — no further extensions past this date."],
  },
  {
    id: "ouattara-boni",
    kind: "active",
    borrower: "Emmanuel Paul-Allan Ouattara-Boni",
    purpose: "Personal financing",
    contact: "+225 07 12 38 14 80",
    principal: 150_000,
    fees: [
      { label: "Financing fee (25%)", amount: 37_500 },
      { label: "Management fee", amount: 12_500 },
    ],
    totalDue: 200_000,
    disbursedOn: "2026-08-19",
    dueOn: "2026-09-19",
    latePenaltyRatePerWeek: 0.01,
    contractRef: "Fiche de Proposition de Financement, 19 août 2026",
    relatedParty: true,
    documents: [{ label: "Fiche de financement", path: "ouattara-boni-fiche.pdf" }],
    notes: ["Related-party loan — extended to a Muthi associate, on the same terms as third-party clients."],
  },
  {
    id: "pipeline-koffi",
    kind: "pipeline_term",
    borrower: "Léocadie Koffi — Kaelle Market & Services",
    contact: "koffi_leo@yahoo.fr",
    principal: 5_000_000,
    termMonths: 36,
    deferralMonths: 2,
    fees: [
      { label: "Financing fee (15%)", amount: 750_000 },
      { label: "Management fee", amount: 500_000 },
    ],
    status: "Counter-proposal received — awaiting sign-off",
    documents: [{ label: "Fiche de financement (original terms, 18 août)", path: "kaelle-koffi-fiche.pdf" }],
    notes: [
      "Originally approved 18 Aug 2026 at ~36% flat over 3 years: 200,000/month over 34 payments (after a 2-month deferral), 1,800,000 total financing cost, 6,800,000 total repayment. The normal 200,000 gestion fee was waived on that version.",
      "Koffi has since countered at 15% on the 5,000,000 principal (750,000) plus a flat 500,000 management fee — 1,250,000 total, 6,250,000 repayment if signed on these terms. Figures below reflect this counter-proposal, not the original approval.",
      "Monthly payment amount not yet confirmed on the new terms — the figure below spreads principal + fees evenly over the 36-month term for reference only.",
      "Still missing before disbursement: employer attestation/payslips, CNI, signed reconnaissance de dette, and her choice of monthly collection method (bank transfer / invoice / Mobile Money).",
    ],
  },
  {
    id: "koizan-marie-andrea",
    kind: "pipeline_pending",
    borrower: "Marie Andréa Koizan",
    purpose: "Personal financing",
    requestedAmount: 300_000,
    principal: 150_000,
    fees: [
      { label: "Financing fee (20%)", amount: 30_000 },
      { label: "Management fee", amount: 12_500 },
    ],
    totalDue: 192_500,
    status: "Awaiting CNI before disbursement — no date set yet",
    documents: [{ label: "Fiche de financement", path: "koizan-marie-andrea-fiche.pdf" }],
    notes: [
      "Client requested 300,000; only 150,000 approved at this stage pending a complete dossier. The remaining 150,000 may be revisited once regularized.",
    ],
  },
];

const cashPosition = {
  inBank: 100_000,
  heldByFounder: 300_000,
  heldByFounderNote: "Temporarily held by the founder, owed back to the company",
  notes: [
    "Reduced from 250,000 after the 150,000 disbursed to Emmanuel Ouattara-Boni on 19 Aug 2026 — update this figure by hand whenever a new disbursement goes out or a repayment comes in.",
  ],
};

async function main() {
  console.log("Applying schema...");
  await pool.query(schema);

  console.log("Seeding loans...");
  let order = 0;
  for (const loan of loans) {
    order += 1;
    await pool.query(
      `INSERT INTO loans (
        id, kind, borrower, purpose, contact, principal, fees, total_due,
        disbursed_on, due_on, late_penalty_rate_per_week, contract_ref,
        related_party, manual_amount_override, final_deadline, requested_amount, term_months,
        deferral_months, status, documents, notes, sort_order
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        loan.id,
        loan.kind,
        loan.borrower,
        loan.purpose ?? null,
        loan.contact ?? null,
        loan.principal,
        JSON.stringify(loan.fees ?? []),
        loan.totalDue ?? null,
        loan.disbursedOn ?? null,
        loan.dueOn ?? null,
        loan.latePenaltyRatePerWeek ?? 0.01,
        loan.contractRef ?? null,
        loan.relatedParty ?? false,
        loan.manualAmountOverride ?? null,
        loan.finalDeadline ?? null,
        loan.requestedAmount ?? null,
        loan.termMonths ?? null,
        loan.deferralMonths ?? null,
        loan.status ?? null,
        JSON.stringify(loan.documents ?? []),
        JSON.stringify(loan.notes ?? []),
        order,
      ]
    );
  }

  console.log("Seeding cash position...");
  await pool.query(
    `INSERT INTO cash_position (id, in_bank, held_by_founder, held_by_founder_note, notes)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [cashPosition.inBank, cashPosition.heldByFounder, cashPosition.heldByFounderNote, JSON.stringify(cashPosition.notes)]
  );

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
