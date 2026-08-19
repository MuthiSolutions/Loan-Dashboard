// Source of truth for the loan book. Update this file when a new contract
// comes in, a loan is repaid, or terms change — the dashboard recomputes
// everything (status, accrued penalties, totals) from these facts.

export interface LoanFee {
  label: string;
  amount: number;
}

export interface Loan {
  id: string;
  borrower: string;
  purpose: string;
  contact?: string;
  principal: number;
  fees: LoanFee[];
  /** Total contractually due at maturity, before any late penalty. */
  totalDue: number;
  disbursedOn?: string; // ISO date
  dueOn: string; // ISO date
  latePenaltyRatePerWeek: number; // e.g. 0.01 = 1% per week started, on totalDue
  contractRef: string;
  notes?: string[];
}

export const loans: Loan[] = [
  {
    id: "koizan",
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
  },
  {
    id: "konan",
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
    notes: [
      "Logged verbally as a ~100k loan — the signed convention and reconnaissance de dette both state 150,000 → 200,000. Using the signed figures.",
    ],
  },
  {
    id: "praia",
    borrower: "Yann Samuel Oloufoumi-Séry — projet PRAÏA",
    purpose: "Event revenue-participation financing",
    contact: "yoloufoumisery@gmail.com",
    principal: 5_000_000,
    fees: [],
    totalDue: 6_250_000,
    dueOn: "2026-08-08",
    latePenaltyRatePerWeek: 0.01,
    contractRef: "Convention de Financement à Remboursement Participatif",
    notes: [
      "Contract formula: Principal + 5% of gross event revenue, with a floor of 7,000,000 and a cap of 9,000,000 FCFA.",
      "Currently tracked at 6,250,000 base — this is BELOW the contract's own 7,000,000 floor. Worth confirming which figure actually governs; update totalDue above once settled.",
      "Confidential per Article 10 of the financing convention.",
    ],
  },
];

export interface PipelineLoan {
  id: string;
  label: string;
  principal: number;
  termMonths: number;
  deferralMonths: number;
  monthlyPayment: number;
  status: string;
}

export const pipeline: PipelineLoan[] = [
  {
    id: "pipeline-3yr",
    label: "3-year term loan — under negotiation",
    principal: 5_000_000,
    termMonths: 36,
    deferralMonths: 2,
    monthlyPayment: 200_000,
    status: "Under negotiation — not yet signed or disbursed",
  },
];

export interface CashPosition {
  inBank: number;
  heldByFounder: number;
  heldByFounderNote: string;
}

export const cashPosition: CashPosition = {
  inBank: 250_000,
  heldByFounder: 300_000,
  heldByFounderNote: "Temporarily held by the founder, owed back to the company",
};
