import type { BorrowerProfile, RepaymentEvent } from "./types";

export interface ScoreFactor {
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export type Grade = "A" | "B+" | "B" | "C";

export interface CreditScore {
  total: number;
  maxTotal: number;
  grade: Grade;
  factors: ScoreFactor[];
  /** Set when the early-repayment floor lifted the total — so the B is traceable to a stated reason, not a mystery. */
  floorNote?: string;
  /** Set when the cap held the total down — no borrower is treated as risk-free. */
  capNote?: string;
}

export type RepaymentState = "overdue" | "due-soon" | "on-track" | "not-yet-disbursed" | "repaid";

export interface ScoringInput extends BorrowerProfile {
  /** What the score is measured against — the amount actually owed, not just principal. */
  amountDue: number;
  documentsCount: number;
  repaymentState: RepaymentState;
  /** Used for the point deduction below — calibrated in weeks regardless of any one loan's own penalty period. */
  weeksLate?: number;
  /** Used only for the "Overdue, X days late" label, which is clearer than weeks and matches how the loan card itself shows lateness. */
  daysLate?: number;
  /** Logged promises, payments, and broken commitments — the actual behavioral record, not just a lateness count. */
  repaymentHistory?: RepaymentEvent[];
  /** The loan was settled in full before its due date. */
  repaidEarly?: boolean;
  /** This is the borrower's first loan with Muthi. The early-repayment floor only applies here — on later loans the file has to earn its score, so a borrower can't slip once or twice and then reset to a B by repaying one loan early. */
  isFirstLoan?: boolean;
  /** How many loans this borrower has repaid in full with Muthi. Only a repeat borrower (2+) earns Track record points — the route into an A. */
  repaidLoanCount?: number;
}

/** Guaranteed minimum for a first-time borrower who repaid ahead of their due date. */
const EARLY_REPAYMENT_FLOOR = 80;
/** No one is 100% in this game: the top of the scale is deliberately unreachable. */
const SCORE_CAP = 95;

/**
 * A fully transparent scoring model — every point is traceable to a stated reason.
 *
 * Two structural rules encode the house view of risk. The six profile-and-behavior factors
 * sum to 84 at most, so a single perfect loan tops out as a B (80–84); the 16-point Track
 * record factor only opens for a repeat borrower, which is the only route to a B+ (85–90) or
 * an A (91+). And the total is capped at 95, so no borrower is ever treated as risk-free.
 *
 * "Not documented" is neutral (half credit) throughout, never a zero — not knowing something
 * about a borrower is not the same as knowing it's bad.
 */
export function computeCreditScore(input: ScoringInput): CreditScore {
  const factors: ScoreFactor[] = [];

  const employmentPoints =
    input.employmentType === "CDI"
      ? 20
      : input.employmentType === "CDD"
      ? 10
      : input.employmentType === "Self-employed"
      ? 6
      : input.employmentType === "Informal"
      ? 3
      : 10;
  factors.push({
    label: "Employment stability",
    points: employmentPoints,
    maxPoints: 20,
    detail: input.employmentType ? `${input.employmentType}${input.employer ? ` — ${input.employer}` : ""}` : "Not documented",
  });

  const incomeRatio = input.monthlyIncome && input.amountDue > 0 ? input.monthlyIncome / input.amountDue : null;
  const incomePoints =
    input.monthlyIncome === undefined
      ? 8
      : input.amountDue <= 0
      ? 15
      : incomeRatio! >= 5
      ? 15
      : incomeRatio! >= 3
      ? 11
      : incomeRatio! >= 1.5
      ? 6
      : incomeRatio! >= 1
      ? 3
      : 0;
  factors.push({
    label: "Income coverage",
    points: incomePoints,
    maxPoints: 15,
    detail: incomeRatio !== null ? `Monthly income covers ${incomeRatio.toFixed(1)}× the amount owed` : "Income not declared",
  });

  const repaymentPoints =
    input.repaymentState === "repaid" || input.repaymentState === "on-track"
      ? 18
      : input.repaymentState === "due-soon"
      ? 14
      : input.repaymentState === "not-yet-disbursed"
      ? 11
      : Math.max(0, 18 - (input.weeksLate ?? 1) * 6);
  factors.push({
    label: "Repayment timing",
    points: repaymentPoints,
    maxPoints: 18,
    detail:
      input.repaymentState === "repaid"
        ? "Fully repaid"
        : input.repaymentState === "not-yet-disbursed"
        ? "No repayment history yet — pipeline deal"
        : input.repaymentState === "overdue"
        ? `Overdue, ${input.daysLate ?? 0} day${input.daysLate === 1 ? "" : "s"} late`
        : input.repaymentState === "due-soon"
        ? "On track, due soon"
        : "On track",
  });

  const history = input.repaymentHistory ?? [];
  const brokenPromises = history.filter((e) => e.type === "broken_promise").length;
  const hasPayment = history.some((e) => e.type === "partial_payment" || e.type === "full_payment");
  const reliabilityPoints =
    history.length === 0 ? 15 : Math.max(0, Math.min(15, 15 - brokenPromises * 5 + (hasPayment ? 5 : 0)));
  factors.push({
    label: "Payment reliability",
    points: reliabilityPoints,
    maxPoints: 15,
    detail:
      history.length === 0
        ? "No commitments made or broken yet"
        : `${brokenPromises} broken promise${brokenPromises === 1 ? "" : "s"}, ${
            hasPayment ? "has made payment toward the debt" : "no payment made yet"
          }, stayed in contact`,
  });

  const docPoints = input.documentsCount >= 2 ? 8 : input.documentsCount === 1 ? 4 : 0;
  factors.push({
    label: "Documentation on file",
    points: docPoints,
    maxPoints: 8,
    detail: `${input.documentsCount} document${input.documentsCount === 1 ? "" : "s"} on file`,
  });

  const tenurePoints =
    input.tenureYears === undefined
      ? 4
      : input.tenureYears >= 5
      ? 8
      : input.tenureYears >= 2
      ? 6
      : input.tenureYears >= 1
      ? 3
      : 2;
  factors.push({
    label: "Job / business tenure",
    points: tenurePoints,
    maxPoints: 8,
    detail: input.tenureYears !== undefined ? `${input.tenureYears} year${input.tenureYears === 1 ? "" : "s"}` : "Not documented",
  });

  const repaidLoans = input.repaidLoanCount ?? 0;
  const trackRecordPoints = repaidLoans >= 2 ? 16 : 0;
  factors.push({
    label: "Track record",
    points: trackRecordPoints,
    maxPoints: 16,
    detail:
      repaidLoans >= 2
        ? `${repaidLoans} loans repaid in full with Muthi — a proven repeat borrower`
        : repaidLoans === 1
        ? "One loan repaid — a second would prove the pattern"
        : "First loan with Muthi — no repeat history yet",
  });

  let total = factors.reduce((sum, f) => sum + f.points, 0);
  const maxTotal = factors.reduce((sum, f) => sum + f.maxPoints, 0);

  let floorNote: string | undefined;
  if (input.repaidEarly && input.isFirstLoan && total < EARLY_REPAYMENT_FLOOR) {
    floorNote = `First loan repaid ahead of the due date — held at a minimum of ${EARLY_REPAYMENT_FLOOR} (a B) regardless of the factor total.`;
    total = EARLY_REPAYMENT_FLOOR;
  }

  let capNote: string | undefined;
  if (total > SCORE_CAP) {
    capNote = `Capped at ${SCORE_CAP} — no borrower is treated as risk-free.`;
    total = SCORE_CAP;
  }

  const grade: Grade = total >= 91 ? "A" : total >= 85 ? "B+" : total >= 80 ? "B" : "C";

  return { total, maxTotal, grade, factors, floorNote, capNote };
}
