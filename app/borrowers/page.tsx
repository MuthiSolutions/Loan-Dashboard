import { getAllBorrowerLoans, getAllPipelineEntriesEverConsidered } from "@/lib/repo";
import { computeAmountDue, daysLate, getLoanState, loanNumbersByBorrower, weeksLate } from "@/lib/loans";
import { computeCreditScore, type ScoringInput } from "@/lib/creditScore";
import { BorrowerCard } from "@/components/BorrowerCard";
import { Header } from "@/components/Header";
import { ScoringRubric } from "@/components/ScoringRubric";

export const dynamic = "force-dynamic";

export default async function BorrowersPage() {
  const asOf = new Date();
  const [loans, pipeline] = await Promise.all([getAllBorrowerLoans(), getAllPipelineEntriesEverConsidered()]);

  // A borrower is still just a name on each loan row, so repeat behavior is grouped by exact name
  // for now. Marie Andréa Koizan is the first borrower with two rows: her repaid August loan and
  // cycle 1 of her renewable facility. Both read her one repaid loan, so Track record stays 0 until
  // she completes a second. Two cards therefore carry her name with different grades, and nothing on
  // the page says they are the same person. A borrower entity is the real fix.
  const repaidCountByBorrower = new Map<string, number>();
  for (const loan of loans) {
    if (loan.repaidOn !== undefined) {
      repaidCountByBorrower.set(loan.borrower, (repaidCountByBorrower.get(loan.borrower) ?? 0) + 1);
    }
  }

  // The earliest-disbursed loan per borrower is their first. Only that one can earn the
  // early-repayment floor.
  const firstLoanIdByBorrower = new Map<string, string>();
  for (const loan of [...loans].sort((a, b) => (a.disbursedOn ?? a.dueOn).localeCompare(b.disbursedOn ?? b.dueOn))) {
    if (!firstLoanIdByBorrower.has(loan.borrower)) firstLoanIdByBorrower.set(loan.borrower, loan.id);
  }

  // Numbering runs over every loan a borrower has ever had, so Marie Andréa's renewable
  // cycle reads as her second loan instead of another first. Pipeline entries get no number:
  // nothing has been disbursed, so they are not yet part of anyone's sequence.
  const loanNumbers = loanNumbersByBorrower(loans);

  const activeEntries = loans.map((loan) => {
    const repaid = loan.repaidOn !== undefined;
    // For a repaid loan, score against what was actually collected, not a formula that would
    // keep accruing penalty past a due date that no longer matters.
    const amountDue = repaid ? loan.amountPaid ?? loan.totalDue : computeAmountDue(loan, asOf);
    const input: ScoringInput = {
      ...loan,
      amountDue,
      documentsCount: loan.documents?.length ?? 0,
      repaymentState: repaid ? "repaid" : getLoanState(loan, asOf),
      weeksLate: weeksLate(loan, asOf),
      daysLate: daysLate(loan, asOf),
      repaidEarly: repaid && loan.repaidOn! < loan.dueOn,
      isFirstLoan: firstLoanIdByBorrower.get(loan.borrower) === loan.id,
      repaidLoanCount: repaidCountByBorrower.get(loan.borrower) ?? 0,
    };
    return {
      id: loan.id,
      name: loan.borrower,
      subtitle: loan.purpose,
      contact: loan.contact,
      amountLabel: repaid ? "Repaid in full" : "Currently owed",
      amount: amountDue,
      score: computeCreditScore(input),
      repaymentHistory: loan.repaymentHistory,
      loanNumber: loanNumbers.get(loan.id)?.number,
    };
  });

  const pipelineEntries = pipeline.map((entry) => {
    const feesTotal = entry.fees.reduce((sum, f) => sum + f.amount, 0);
    const amountDue = entry.kind === "term" ? entry.principal + feesTotal : entry.totalDue;
    const input: ScoringInput = {
      ...entry,
      amountDue,
      documentsCount: entry.documents?.length ?? 0,
      repaymentState: "not-yet-disbursed",
    };
    return {
      id: entry.id,
      name: entry.kind === "term" ? entry.label : entry.borrower,
      subtitle: entry.kind === "term" ? entry.status || "Pipeline — term negotiation" : entry.purpose,
      contact: entry.kind === "term" ? entry.contact : undefined,
      amountLabel: "If disbursed",
      amount: amountDue,
      score: computeCreditScore(input),
    };
  });

  const entries = [...activeEntries, ...pipelineEntries].sort(
    (a, b) => b.score.total - a.score.total || a.name.localeCompare(b.name)
  );

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/borrowers" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="eyebrow text-[11px]">Borrower profiles</p>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Credit scoring</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--slate-soft)]">
            Every borrower Muthi has engaged with — disbursed, repaid, or a pipeline deal that didn't go
            through — kept here for the broadest possible base to score and analyze against, independent of
            what's currently active on the main dashboard. Every point traces back to a stated reason; the
            rubric below shows exactly how a score is built.
          </p>
        </div>

        <ScoringRubric />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {entries.map((e) => (
            <BorrowerCard key={e.id} {...e} />
          ))}
        </div>
      </main>
    </div>
  );
}
