import { getActiveLoans, getPipelineEntries } from "@/lib/repo";
import { computeAmountDue, getLoanState, weeksLate } from "@/lib/loans";
import { computeCreditScore, type ScoringInput } from "@/lib/creditScore";
import { BorrowerCard } from "@/components/BorrowerCard";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function BorrowersPage() {
  const asOf = new Date();
  const [loans, pipeline] = await Promise.all([getActiveLoans(), getPipelineEntries()]);

  const activeEntries = loans.map((loan) => {
    const amountDue = computeAmountDue(loan, asOf);
    const input: ScoringInput = {
      ...loan,
      amountDue,
      documentsCount: loan.documents?.length ?? 0,
      repaymentState: getLoanState(loan, asOf),
      weeksLate: weeksLate(loan, asOf),
    };
    return {
      id: loan.id,
      name: loan.borrower,
      subtitle: loan.purpose,
      contact: loan.contact,
      amountLabel: "Currently owed",
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
      subtitle: entry.kind === "term" ? "Pipeline — term negotiation" : entry.purpose,
      contact: entry.kind === "term" ? entry.contact : undefined,
      amountLabel: "If disbursed",
      amount: amountDue,
      score: computeCreditScore(input),
    };
  });

  const entries = [...activeEntries, ...pipelineEntries];

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/borrowers" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="eyebrow text-[11px]">Borrower profiles</p>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Credit scoring — prototype</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--slate-soft)]">
            An early, fully transparent scoring exercise built from what we already have on file — employment, income,
            documentation, and repayment behavior. The weights below are a first guess, not a finalized credit
            policy — every point traces back to a stated reason so it's easy to argue with.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {entries.map((e) => (
            <BorrowerCard key={e.id} {...e} />
          ))}
        </div>
      </main>
    </div>
  );
}
