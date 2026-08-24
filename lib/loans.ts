import type { Loan } from "./types";

export type LoanState = "overdue" | "due-soon" | "on-track";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const DUE_SOON_WINDOW_DAYS = 7;

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntilDue(loan: Loan, asOf: Date = new Date()): number {
  const due = parseDate(loan.dueOn);
  const today = startOfDay(asOf);
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

/** Full weeks of delinquency started past the due date (0 if not yet due). */
export function weeksLate(loan: Loan, asOf: Date = new Date()): number {
  const days = daysUntilDue(loan, asOf);
  if (days >= 0) return 0;
  return Math.ceil(-days / 7);
}

/** Formula amount: totalDue plus 1%/week-started penalty since the due date, per the contract's own terms. */
export function formulaAmountDue(loan: Loan, asOf: Date = new Date()): number {
  const weeks = weeksLate(loan, asOf);
  return Math.round(loan.totalDue * (1 + loan.latePenaltyRatePerWeek * weeks));
}

/** Full value of the deal as of this date — manual pin or formula — before netting out any payments already received. This is what profit is measured against, so a partial payment doesn't make the deal look smaller than it is. */
export function grossAmountDue(loan: Loan, asOf: Date = new Date()): number {
  return loan.manualAmountOverride ?? formulaAmountDue(loan, asOf);
}

/** Outstanding balance still owed: gross amount due minus payments received so far. This is the collections figure — what to actually chase. */
export function computeAmountDue(loan: Loan, asOf: Date = new Date()): number {
  return Math.max(0, grossAmountDue(loan, asOf) - (loan.amountPaid ?? 0));
}

export function getLoanState(loan: Loan, asOf: Date = new Date()): LoanState {
  const days = daysUntilDue(loan, asOf);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_WINDOW_DAYS) return "due-soon";
  return "on-track";
}

/** What was contracted to be earned on this deal — total due at maturity minus principal disbursed, before any late penalty. */
export function contractedProfit(loan: Loan): number {
  return loan.totalDue - loan.principal;
}

/** What's actually being earned on this deal — full value (incl. accrued late penalty) minus principal. Unaffected by partial payments: profit doesn't shrink just because it hasn't all been collected yet. */
export function computeProfit(loan: Loan, asOf: Date = new Date()): number {
  return grossAmountDue(loan, asOf) - loan.principal;
}

export function portfolioTotals(loans: Loan[], asOf: Date = new Date()) {
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalContracted = loans.reduce((sum, l) => sum + l.totalDue, 0);
  const totalGrossOwed = loans.reduce((sum, l) => sum + grossAmountDue(l, asOf), 0);
  const totalCurrentlyOwed = loans.reduce((sum, l) => sum + computeAmountDue(l, asOf), 0);
  const totalProfit = totalGrossOwed - totalPrincipal;
  const overdueCount = loans.filter((l) => getLoanState(l, asOf) === "overdue").length;
  const dueSoonCount = loans.filter((l) => getLoanState(l, asOf) === "due-soon").length;
  return {
    totalPrincipal,
    totalContracted,
    totalGrossOwed,
    totalCurrentlyOwed,
    totalProfit,
    overdueCount,
    dueSoonCount,
    activeCount: loans.length,
  };
}

export function loansSortedByUrgency(loans: Loan[], asOf: Date = new Date()): Loan[] {
  return [...loans].sort((a, b) => daysUntilDue(a, asOf) - daysUntilDue(b, asOf));
}

export function formatFCFA(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} FCFA`;
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
