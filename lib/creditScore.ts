import type { BorrowerProfile } from "./types";

export interface ScoreFactor {
  label: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export type Grade = "A" | "B" | "C" | "D";

export interface CreditScore {
  total: number;
  maxTotal: number;
  grade: Grade;
  factors: ScoreFactor[];
}

export type RepaymentState = "overdue" | "due-soon" | "on-track" | "not-yet-disbursed";

export interface ScoringInput extends BorrowerProfile {
  /** What the score is measured against — the amount actually owed, not just principal. */
  amountDue: number;
  documentsCount: number;
  repaymentState: RepaymentState;
  weeksLate?: number;
}

/**
 * A first-pass, fully transparent scoring model — every point is traceable to a stated reason.
 * Weights and thresholds are a starting guess, not a calibrated risk model. Treat as a prototype.
 */
export function computeCreditScore(input: ScoringInput): CreditScore {
  const factors: ScoreFactor[] = [];

  const employmentPoints =
    input.employmentType === "CDI"
      ? 30
      : input.employmentType === "CDD"
      ? 15
      : input.employmentType === "Self-employed"
      ? 10
      : input.employmentType === "Informal"
      ? 5
      : 0;
  factors.push({
    label: "Employment stability",
    points: employmentPoints,
    maxPoints: 30,
    detail: input.employmentType ? `${input.employmentType}${input.employer ? ` — ${input.employer}` : ""}` : "Not documented",
  });

  const incomeRatio = input.monthlyIncome && input.amountDue > 0 ? input.monthlyIncome / input.amountDue : null;
  const incomePoints =
    incomeRatio === null ? 0 : incomeRatio >= 5 ? 25 : incomeRatio >= 3 ? 18 : incomeRatio >= 1.5 ? 10 : incomeRatio >= 1 ? 5 : 0;
  factors.push({
    label: "Income coverage",
    points: incomePoints,
    maxPoints: 25,
    detail: incomeRatio !== null ? `Monthly income covers ${incomeRatio.toFixed(1)}× the amount owed` : "Income not declared",
  });

  const repaymentPoints =
    input.repaymentState === "not-yet-disbursed"
      ? 15
      : input.repaymentState === "on-track"
      ? 25
      : input.repaymentState === "due-soon"
      ? 20
      : Math.max(0, 25 - (input.weeksLate ?? 1) * 8);
  factors.push({
    label: "Repayment behavior",
    points: repaymentPoints,
    maxPoints: 25,
    detail:
      input.repaymentState === "not-yet-disbursed"
        ? "No repayment history yet — pipeline deal"
        : input.repaymentState === "overdue"
        ? `Overdue, ${input.weeksLate ?? 0} week(s) late`
        : input.repaymentState === "due-soon"
        ? "On track, due soon"
        : "On track",
  });

  const docPoints = input.documentsCount >= 2 ? 10 : input.documentsCount === 1 ? 5 : 0;
  factors.push({
    label: "Documentation on file",
    points: docPoints,
    maxPoints: 10,
    detail: `${input.documentsCount} document${input.documentsCount === 1 ? "" : "s"} on file`,
  });

  const tenurePoints =
    input.tenureYears === undefined
      ? 5
      : input.tenureYears >= 5
      ? 10
      : input.tenureYears >= 2
      ? 7
      : input.tenureYears >= 1
      ? 4
      : 2;
  factors.push({
    label: "Job / business tenure",
    points: tenurePoints,
    maxPoints: 10,
    detail: input.tenureYears !== undefined ? `${input.tenureYears} year${input.tenureYears === 1 ? "" : "s"}` : "Not documented",
  });

  const total = factors.reduce((sum, f) => sum + f.points, 0);
  const maxTotal = factors.reduce((sum, f) => sum + f.maxPoints, 0);
  const grade: Grade = total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : "D";

  return { total, maxTotal, grade, factors };
}
