import { pool } from "./db";
import type {
  BorrowerProfile,
  CashAccount,
  CashMovement,
  CashPosition,
  DocumentLink,
  Loan,
  LoanFee,
  PipelineEntry,
  RepaymentEvent,
} from "./types";

interface LoanRow {
  id: string;
  kind: "active" | "pipeline_term" | "pipeline_pending";
  borrower: string;
  purpose: string | null;
  contact: string | null;
  principal: string;
  fees: LoanFee[];
  total_due: string | null;
  disbursed_on: string | null;
  due_on: string | null;
  late_penalty_rate_per_week: string;
  contract_ref: string | null;
  related_party: boolean;
  manual_amount_override: string | null;
  final_deadline: string | null;
  amount_paid: string | null;
  last_payment_on: string | null;
  repaid_on: string | null;
  requested_amount: string | null;
  term_months: number | null;
  deferral_months: number | null;
  status: string | null;
  documents: DocumentLink[];
  notes: string[];
  repayment_history: RepaymentEvent[];
  profession: string | null;
  employer: string | null;
  employment_type: BorrowerProfile["employmentType"] | null;
  monthly_income: string | null;
  tenure_years: string | null;
}

function n(value: string | null): number | undefined {
  return value === null ? undefined : Number(value);
}

function borrowerProfile(row: LoanRow): BorrowerProfile {
  return {
    profession: row.profession ?? undefined,
    employer: row.employer ?? undefined,
    employmentType: row.employment_type ?? undefined,
    monthlyIncome: n(row.monthly_income),
    tenureYears: n(row.tenure_years),
  };
}

function rowToLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    borrower: row.borrower,
    purpose: row.purpose ?? "",
    contact: row.contact ?? undefined,
    principal: Number(row.principal),
    fees: row.fees,
    totalDue: Number(row.total_due),
    disbursedOn: row.disbursed_on ?? undefined,
    dueOn: row.due_on!,
    latePenaltyRatePerWeek: Number(row.late_penalty_rate_per_week),
    contractRef: row.contract_ref ?? "",
    relatedParty: row.related_party || undefined,
    manualAmountOverride: n(row.manual_amount_override),
    finalDeadline: row.final_deadline ?? undefined,
    amountPaid: n(row.amount_paid),
    lastPaymentOn: row.last_payment_on ?? undefined,
    repaidOn: row.repaid_on ?? undefined,
    repaymentHistory: row.repayment_history.length > 0 ? row.repayment_history : undefined,
    documents: row.documents.length > 0 ? row.documents : undefined,
    notes: row.notes.length > 0 ? row.notes : undefined,
    ...borrowerProfile(row),
  };
}

function rowToPipelineEntry(row: LoanRow): PipelineEntry {
  const shared = {
    id: row.id,
    principal: Number(row.principal),
    fees: row.fees,
    status: row.status ?? "",
    documents: row.documents.length > 0 ? row.documents : undefined,
    notes: row.notes.length > 0 ? row.notes : undefined,
    ...borrowerProfile(row),
  };

  if (row.kind === "pipeline_term") {
    return {
      ...shared,
      kind: "term",
      label: row.borrower,
      contact: row.contact ?? undefined,
      termMonths: row.term_months ?? 0,
      deferralMonths: row.deferral_months ?? 0,
    };
  }

  return {
    ...shared,
    kind: "pending",
    borrower: row.borrower,
    purpose: row.purpose ?? "",
    requestedAmount: n(row.requested_amount),
    totalDue: Number(row.total_due),
  };
}

export async function getActiveLoans(): Promise<Loan[]> {
  const { rows } = await pool.query<LoanRow>(
    "SELECT * FROM loans WHERE kind = 'active' AND repaid_on IS NULL ORDER BY sort_order, created_at"
  );
  return rows.map(rowToLoan);
}

/** Loans that have been fully settled — kept for history, excluded from the active book/portfolio totals. */
export async function getRepaidLoans(): Promise<Loan[]> {
  const { rows } = await pool.query<LoanRow>(
    "SELECT * FROM loans WHERE kind = 'active' AND repaid_on IS NOT NULL ORDER BY repaid_on DESC"
  );
  return rows.map(rowToLoan);
}

export async function getPipelineEntries(): Promise<PipelineEntry[]> {
  const { rows } = await pool.query<LoanRow>(
    "SELECT * FROM loans WHERE kind IN ('pipeline_term', 'pipeline_pending') ORDER BY sort_order, created_at"
  );
  return rows.map(rowToPipelineEntry);
}

interface CashMovementRow {
  id: number;
  account: CashAccount;
  amount: string;
  description: string;
  loan_id: string | null;
  transfer_id: string | null;
  occurred_on: string;
}

function rowToMovement(row: CashMovementRow): CashMovement {
  return {
    id: row.id,
    account: row.account,
    amount: Number(row.amount),
    description: row.description,
    loanId: row.loan_id ?? undefined,
    transferId: row.transfer_id ?? undefined,
    occurredOn: row.occurred_on,
  };
}

/** Balances are a live sum over cash_movements, not a hand-maintained figure — see lib/schema.sql. */
export async function getCashPosition(): Promise<CashPosition> {
  const [totals, recent] = await Promise.all([
    pool.query<{ account: CashAccount; total: string }>("SELECT account, SUM(amount) AS total FROM cash_movements GROUP BY account"),
    pool.query<CashMovementRow>("SELECT * FROM cash_movements ORDER BY occurred_on DESC, id DESC LIMIT 10"),
  ]);

  const byAccount = Object.fromEntries(totals.rows.map((r) => [r.account, Number(r.total)]));

  return {
    inBank: byAccount.bank ?? 0,
    heldByFounder: byAccount.founder ?? 0,
    movements: recent.rows.map(rowToMovement),
  };
}

export interface NewCashMovementInput {
  account: CashAccount;
  amount: number;
  description: string;
  loanId?: string;
  occurredOn: string;
}

export async function recordCashMovement(input: NewCashMovementInput): Promise<void> {
  await pool.query(
    "INSERT INTO cash_movements (account, amount, description, loan_id, occurred_on) VALUES ($1, $2, $3, $4, $5)",
    [input.account, input.amount, input.description, input.loanId ?? null, input.occurredOn]
  );
}

export interface NewLoanInput {
  id: string;
  kind: "active" | "pipeline_term" | "pipeline_pending";
  borrower: string;
  purpose?: string;
  contact?: string;
  principal: number;
  fees: LoanFee[];
  totalDue?: number;
  disbursedOn?: string;
  dueOn?: string;
  latePenaltyRatePerWeek?: number;
  contractRef?: string;
  relatedParty?: boolean;
  requestedAmount?: number;
  termMonths?: number;
  deferralMonths?: number;
  status?: string;
  notes?: string[];
}

export async function insertLoan(input: NewLoanInput): Promise<void> {
  await pool.query(
    `INSERT INTO loans (
      id, kind, borrower, purpose, contact, principal, fees, total_due,
      disbursed_on, due_on, late_penalty_rate_per_week, contract_ref,
      related_party, requested_amount, term_months, deferral_months, status, notes
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )`,
    [
      input.id,
      input.kind,
      input.borrower,
      input.purpose ?? null,
      input.contact ?? null,
      input.principal,
      JSON.stringify(input.fees),
      input.totalDue ?? null,
      input.disbursedOn ?? null,
      input.dueOn ?? null,
      input.latePenaltyRatePerWeek ?? 0.01,
      input.contractRef ?? null,
      input.relatedParty ?? false,
      input.requestedAmount ?? null,
      input.termMonths ?? null,
      input.deferralMonths ?? null,
      input.status ?? null,
      JSON.stringify(input.notes ?? []),
    ]
  );
}
