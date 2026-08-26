export interface LoanFee {
  label: string;
  amount: number;
}

export interface DocumentLink {
  label: string;
  /** Filename under /public/documents/ — served through the same login gate as the rest of the dashboard. */
  path: string;
}

/** Underwriting-relevant facts about the person, independent of any one loan's terms. Optional — most of this is still missing for most borrowers. */
export interface BorrowerProfile {
  profession?: string;
  employer?: string;
  employmentType?: "CDI" | "CDD" | "Self-employed" | "Informal" | "Other";
  monthlyIncome?: number;
  tenureYears?: number;
}

/**
 * One logged, dated event in a borrower's actual repayment conduct — a commitment made, kept, or
 * broken, or a payment received. This is the raw material for the "Payment reliability" credit
 * factor: quantifiable behavior, not just a lateness count. Sourced from real correspondence
 * (emails, calls) as it's reviewed — not automated.
 */
export interface RepaymentEvent {
  date: string; // ISO date
  type: "promise" | "partial_payment" | "full_payment" | "broken_promise";
  description: string;
}

export interface Loan extends BorrowerProfile {
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
  /** Cumulative payments received against this loan so far. Nets against the gross amount due to produce the outstanding balance. */
  amountPaid?: number;
  /** Date of the most recent payment received, for display alongside amountPaid. */
  lastPaymentOn?: string; // ISO date
  /** Set once the loan is fully settled — excludes it from the active book and portfolio totals, while keeping the record for history. */
  repaidOn?: string; // ISO date
  /** Dated log of promises, payments, and broken commitments — feeds the credit score's "Payment reliability" factor. */
  repaymentHistory?: RepaymentEvent[];
  documents?: DocumentLink[];
  notes?: string[];
}

export interface TermPipelineLoan extends BorrowerProfile {
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

export interface PendingPipelineLoan extends BorrowerProfile {
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

export type CashAccount = "bank" | "founder";

export interface CashMovement {
  id: number;
  account: CashAccount;
  /** Signed: positive = inflow, negative = outflow. */
  amount: number;
  description: string;
  loanId?: string;
  occurredOn: string; // ISO date
}

export interface CashPosition {
  /** Computed as SUM(amount) over cash_movements per account — never hand-set. */
  inBank: number;
  heldByFounder: number;
  movements: CashMovement[];
}
