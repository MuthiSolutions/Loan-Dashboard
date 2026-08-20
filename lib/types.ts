export interface LoanFee {
  label: string;
  amount: number;
}

export interface DocumentLink {
  label: string;
  /** Filename under /public/documents/ — served through the same login gate as the rest of the dashboard. */
  path: string;
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
  /** Loan to a Muthi associate/insider rather than an outside client — flagged for governance visibility. */
  relatedParty?: boolean;
  /** Pins "currently owed" to a manually confirmed figure instead of the date-driven formula (e.g. agreed directly with the debtor). Remove to resume automatic accrual. */
  manualAmountOverride?: number;
  /** A hard cutoff communicated to the debtor beyond the original dueOn — e.g. a final grace extension. Penalty still accrues from dueOn; this just marks the last-chance date. */
  finalDeadline?: string; // ISO date
  documents?: DocumentLink[];
  notes?: string[];
}

export interface TermPipelineLoan {
  kind: "term";
  id: string;
  label: string;
  contact?: string;
  principal: number;
  termMonths: number;
  deferralMonths: number;
  fees: LoanFee[];
  status: string;
  documents?: DocumentLink[];
  notes?: string[];
}

export interface PendingPipelineLoan {
  kind: "pending";
  id: string;
  borrower: string;
  purpose: string;
  /** What the client originally asked for, if different from what's currently approved. */
  requestedAmount?: number;
  principal: number;
  fees: LoanFee[];
  totalDue: number;
  status: string;
  documents?: DocumentLink[];
  notes?: string[];
}

export type PipelineEntry = TermPipelineLoan | PendingPipelineLoan;

export interface CashPosition {
  inBank: number;
  heldByFounder: number;
  heldByFounderNote: string;
  notes?: string[];
}
