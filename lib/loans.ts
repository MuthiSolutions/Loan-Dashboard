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

/** Full weeks of delinquency started past the due date (0 if not yet due). General lateness measure — independent of any one loan's own penalty period, e.g. used by credit scoring. */
export function weeksLate(loan: Loan, asOf: Date = new Date()): number {
  const days = daysUntilDue(loan, asOf);
  if (days >= 0) return 0;
  return Math.ceil(-days / 7);
}

/** Full days of delinquency past the due date (0 if not yet due). */
export function daysLate(loan: Loan, asOf: Date = new Date()): number {
  const days = daysUntilDue(loan, asOf);
  return Math.max(0, -days);
}

/** How many penalty periods (days or weeks, per this loan's own latePenaltyPeriod) have started since the due date. */
export function periodsLate(loan: Loan, asOf: Date = new Date()): number {
  return loan.latePenaltyPeriod === "day" ? daysLate(loan, asOf) : weeksLate(loan, asOf);
}

/** Penalty periods started in [start, end) at a given cadence: whole days, or whole started weeks. Zero if end is not after start. */
function unitsBetween(start: Date, end: Date, period: "day" | "week"): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  const days = Math.round(ms / MS_PER_DAY);
  return period === "day" ? days : Math.ceil(days / 7);
}

export interface PenaltyBreakdown {
  /** Total rate-units to multiply by latePenaltyRatePerWeek. */
  total: number;
  /** Units accrued before the cadence switch (at latePenaltyPeriod). */
  phase1Units: number;
  /** Units accrued after the cadence switch (at latePenaltyPeriodAfter). */
  phase2Units: number;
  /** True when a mid-life cadence switch applies to this loan. */
  switched: boolean;
}

/**
 * How many rate-units of late penalty have accrued, honouring an optional mid-life cadence switch.
 *
 * Without a switch this is just periodsLate(). With one, the first phase (due date to the switch
 * date) accrues at latePenaltyPeriod and the second phase (switch date to asOf) at
 * latePenaltyPeriodAfter. Jean Philippe is the first such loan: one weekly grace week locked at
 * 1 unit, then 1% per day from 2 October — so a flat flip to daily would wrongly charge the grace
 * week at seven daily units instead of one weekly unit.
 */
export function penaltyBreakdown(loan: Loan, asOf: Date = new Date()): PenaltyBreakdown {
  const due = parseDate(loan.dueOn);
  const today = startOfDay(asOf);
  if (today <= due) return { total: 0, phase1Units: 0, phase2Units: 0, switched: false };

  if (!loan.latePenaltySwitchOn || !loan.latePenaltyPeriodAfter) {
    const total = periodsLate(loan, asOf);
    return { total, phase1Units: total, phase2Units: 0, switched: false };
  }

  const switchOn = parseDate(loan.latePenaltySwitchOn);
  const phase1End = today < switchOn ? today : switchOn;
  const phase1Units = unitsBetween(due, phase1End, loan.latePenaltyPeriod);
  const phase2Units = today > switchOn ? unitsBetween(switchOn, today, loan.latePenaltyPeriodAfter) : 0;
  return { total: phase1Units + phase2Units, phase1Units, phase2Units, switched: true };
}

/**
 * Formula amount: totalDue plus the late penalty accrued per this loan's own cadence (including any
 * mid-life switch) since the due date.
 *
 * The penalty is simple within each cadence phase, but a phase that follows a cadence switch accrues
 * on the balance the earlier phase left behind, not on the original total due — so the phases
 * multiply rather than their units simply adding. Jean Philippe's one weekly grace week lifts the
 * base from 200,000 to 202,000, and the 1% per day from 2 October is charged on that 202,000
 * (2,020/day), not on the original 200,000. Without a switch, phase2Units is 0 and this reduces to
 * the plain totalDue * (1 + rate * units).
 */
export function formulaAmountDue(loan: Loan, asOf: Date = new Date()): number {
  const { phase1Units, phase2Units } = penaltyBreakdown(loan, asOf);
  const rate = loan.latePenaltyRatePerWeek;
  const afterPhase1 = loan.totalDue * (1 + rate * phase1Units);
  return Math.round(afterPhase1 * (1 + rate * phase2Units));
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

/**
 * Own money the founders deposited as working capital, agreed and frozen at 28 September 2026.
 * See CLAUDE.md, "Capital: new money versus recycled money".
 *
 * This is deliberately NOT gross principal deployed, which was 6,450,000 on the same date.
 * Marie Andréa Koizan's renewable cycle 1 re-lent the 300,000 she had just repaid, so it is
 * recycled money rather than new money the founders had to find. Raise this constant only when
 * they actually put fresh cash in, and record the date and amount in the commit message.
 */
export const WORKING_CAPITAL_DEPOSITED = 6_150_000;

/**
 * Which loan this is in a borrower's own sequence: their first is #1, their next #2.
 * Marie Andréa Koizan is the first borrower with more than one, and without this there
 * was no way to tell her two cards apart on the page.
 *
 * Pass EVERY loan, active and repaid, or the numbering is wrong. Ordered by disbursement
 * date, falling back to the due date, then the id so the result is stable.
 *
 * Borrowers are still matched on the exact name string, the same way the credit score
 * counts repeat business. A borrower entity is the real fix for both.
 */
export function loanNumbersByBorrower(loans: Loan[]): Map<string, { number: number; totalForBorrower: number }> {
  const byBorrower = new Map<string, Loan[]>();
  for (const loan of loans) {
    const list = byBorrower.get(loan.borrower) ?? [];
    list.push(loan);
    byBorrower.set(loan.borrower, list);
  }

  const result = new Map<string, { number: number; totalForBorrower: number }>();
  for (const [, list] of byBorrower) {
    const ordered = [...list].sort((a, b) =>
      (a.disbursedOn ?? a.dueOn ?? "").localeCompare(b.disbursedOn ?? b.dueOn ?? "") || a.id.localeCompare(b.id)
    );
    ordered.forEach((loan, i) => result.set(loan.id, { number: i + 1, totalForBorrower: ordered.length }));
  }
  return result;
}

/** What was contracted to be earned on this deal — total due at maturity minus principal disbursed, before any late penalty. */
export function contractedProfit(loan: Loan): number {
  return loan.totalDue - loan.principal;
}

/** What's actually being earned on this deal — full value (incl. accrued late penalty) minus principal. Unaffected by partial payments: profit doesn't shrink just because it hasn't all been collected yet. */
export function computeProfit(loan: Loan, asOf: Date = new Date()): number {
  return grossAmountDue(loan, asOf) - loan.principal;
}

/**
 * A loan on the 12-month revolving facility: its contract reference or purpose names the renewable
 * line. Mirrors is_revolving_loan() in scripts/build-loan-book-xlsx.py so the dashboard's Loan Book
 * view and the exported workbook agree on who is enrolled.
 */
export function isRevolvingLoan(loan: Pick<Loan, "contractRef" | "purpose">): boolean {
  const cr = (loan.contractRef ?? "").toLowerCase();
  const pu = (loan.purpose ?? "").toLowerCase();
  return cr.includes("renouvelable") || cr.includes("revolving") || pu.includes("renewable") || pu.includes("revolving");
}

/** Borrowers enrolled on the revolving facility — enrolment is borrower-level: if any one of a borrower's loans is on the line, they are on it. */
export function revolvingBorrowers(loans: Loan[]): Set<string> {
  const enrolled = new Set<string>();
  for (const loan of loans) if (isRevolvingLoan(loan)) enrolled.add(loan.borrower);
  return enrolled;
}

/**
 * Loans that re-lend capital a borrower has already handed back: a later-disbursed loan of a borrower
 * who has an earlier, repaid loan (the revolving facility, or simply a repeat loan taken after the
 * first came back). Their principal is the same money going out again, so it must not be counted as
 * new capital a second time. Mirrors recycled_ids in scripts/build-loan-book-xlsx.py.
 *
 * Pass EVERY loan, active and repaid, or an early repaid cycle won't be seen.
 */
export function recycledLoanIds(loans: Loan[]): Set<string> {
  const byBorrower = new Map<string, Loan[]>();
  for (const loan of loans) {
    const list = byBorrower.get(loan.borrower) ?? [];
    list.push(loan);
    byBorrower.set(loan.borrower, list);
  }
  const recycled = new Set<string>();
  for (const [, list] of byBorrower) {
    const ordered = [...list].sort(
      (a, b) => (a.disbursedOn ?? a.dueOn ?? "").localeCompare(b.disbursedOn ?? b.dueOn ?? "") || a.id.localeCompare(b.id)
    );
    ordered.forEach((loan, i) => {
      if (ordered.slice(0, i).some((earlier) => earlier.repaidOn)) recycled.add(loan.id);
    });
  }
  return recycled;
}

export function portfolioTotals(loans: Loan[], asOf: Date = new Date()) {
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalContracted = loans.reduce((sum, l) => sum + l.totalDue, 0);
  const totalGrossOwed = loans.reduce((sum, l) => sum + grossAmountDue(l, asOf), 0);
  const totalCurrentlyOwed = loans.reduce((sum, l) => sum + computeAmountDue(l, asOf), 0);
  const totalProfit = totalGrossOwed - totalPrincipal;
  // Principal still genuinely exposed: original principal minus whatever's already been paid
  // back on that loan. totalPrincipal (above) stays the gross, original figure since totalProfit
  // is measured against it — this is a separate, payments-aware view for the "at risk" card.
  const netPrincipalAtRisk = loans.reduce((sum, l) => sum + Math.max(0, l.principal - (l.amountPaid ?? 0)), 0);
  const overdueCount = loans.filter((l) => getLoanState(l, asOf) === "overdue").length;
  const dueSoonCount = loans.filter((l) => getLoanState(l, asOf) === "due-soon").length;
  return {
    totalPrincipal,
    netPrincipalAtRisk,
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
