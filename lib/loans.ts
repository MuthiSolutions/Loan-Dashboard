import { loans, type Loan } from "@/data/loans";

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

/** Live amount currently owed, including any accrued late penalty. */
export function computeAmountDue(loan: Loan, asOf: Date = new Date()): number {
  const weeks = weeksLate(loan, asOf);
  return Math.round(loan.totalDue * (1 + loan.latePenaltyRatePerWeek * weeks));
}

export function getLoanState(loan: Loan, asOf: Date = new Date()): LoanState {
  const days = daysUntilDue(loan, asOf);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_WINDOW_DAYS) return "due-soon";
  return "on-track";
}

export function portfolioTotals(asOf: Date = new Date()) {
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalContracted = loans.reduce((sum, l) => sum + l.totalDue, 0);
  const totalCurrentlyOwed = loans.reduce((sum, l) => sum + computeAmountDue(l, asOf), 0);
  const overdueCount = loans.filter((l) => getLoanState(l, asOf) === "overdue").length;
  const dueSoonCount = loans.filter((l) => getLoanState(l, asOf) === "due-soon").length;
  return {
    totalPrincipal,
    totalContracted,
    totalCurrentlyOwed,
    overdueCount,
    dueSoonCount,
    activeCount: loans.length,
  };
}

export function loansSortedByUrgency(asOf: Date = new Date()): Loan[] {
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
