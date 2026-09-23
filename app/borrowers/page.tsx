import { getAllBorrowerLoans, getAllPipelineEntriesEverConsidered } from "@/lib/repo";
import { computeAmountDue, daysLate, getLoanState, weeksLate } from "@/lib/loans";
import { computeCreditScore, type ScoringInput } from "@/lib/creditScore";
import { BorrowerCard } from "@/components/BorrowerCard";
import { Header } from "@/components/Header";
import { ScoringRubric } from "@/components/ScoringRubric";

export const dynamic = "force-dynamic";

export default async function BorrowersPage() {
  const asOf = new Date();
  const [loans, pipeline] = await Promise.all([getAllBorrowerLoans(), getAllPipelineEntriesEverConsidered()]);

  // A borrower is still just a name on each loan row, so repeat behavior is grouped by exact name
  // for now. Every borrower currently has one loan, which correctly means nobody reaches an A yet.
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
