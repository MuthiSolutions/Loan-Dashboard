import { getActiveLoans, getCashPosition, getPipelineEntries, getRepaidLoans } from "@/lib/repo";
import { formatFCFA, loansSortedByUrgency, portfolioTotals } from "@/lib/loans";
import { CashPanel } from "@/components/CashPanel";
import { ClosedLoanCard } from "@/components/ClosedLoanCard";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Header } from "@/components/Header";
import { LoanCard } from "@/components/LoanCard";
import { PipelinePanel } from "@/components/PipelinePanel";
import { SummaryCard } from "@/components/SummaryCard";

// Penalties accrue by the day and the loan book is DB-backed, so this page
// must be computed per-request, not cached at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const asOf = new Date();
  const [activeLoans, pipeline, cashPosition, repaidLoans] = await Promise.all([
    getActiveLoans(),
    getPipelineEntries(),
    getCashPosition(),
    getRepaidLoans(),
  ]);

  const loans = loansSortedByUrgency(activeLoans, asOf);
  const totals = portfolioTotals(activeLoans, asOf);
  const totalDeployable = cashPosition.inBank + cashPosition.heldByFounder;

  const attentionLabel =
    totals.overdueCount > 0
      ? `${totals.overdueCount} overdue`
      : totals.dueSoonCount > 0
      ? `${totals.dueSoonCount} due within 7 days`
      : "None";

  const attentionSub =
    totals.overdueCount > 0
      ? `${totals.overdueCount} loan${totals.overdueCount > 1 ? "s" : ""} past due date`
      : totals.dueSoonCount > 0
      ? "Due within the next 7 days"
      : "All loans on track";

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/" />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <CashPanel cash={cashPosition} />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard
            label="Cash on hand"
            value={formatFCFA(totalDeployable)}
            sub={`${formatFCFA(cashPosition.inBank)} bank + ${formatFCFA(cashPosition.heldByFounder)} with founder`}
            tone="azure"
          />
          <SummaryCard
            label="Principal at risk"
            value={formatFCFA(totals.totalPrincipal)}
            sub={`${totals.activeCount} active loans, not yet repaid`}
          />
          <SummaryCard
            label="Total outstanding"
            value={formatFCFA(totals.totalCurrentlyOwed)}
            sub="Principal + fees + penalties, net of payments received"
            tone={totals.overdueCount > 0 ? "danger" : "default"}
          />
          <SummaryCard
            label="Expected profit"
            value={formatFCFA(totals.totalProfit)}
            sub="Already counted inside Total outstanding"
            tone="ok"
          />
          <SummaryCard
            label="Needs attention"
            value={attentionLabel}
            sub={attentionSub}
            tone={totals.overdueCount > 0 ? "danger" : totals.dueSoonCount > 0 ? "default" : "ok"}
          />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-[11px]">Loan book</p>
            <a
              href="/loans/new"
              className="rounded-full bg-[var(--azure-deep)] px-4 py-1.5 text-xs font-semibold text-[var(--paper)] transition hover:opacity-90"
            >
              + Add a deal
            </a>
          </div>
          <div className="space-y-4">
            {loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </section>

        <CollapsibleSection title={<p className="eyebrow text-[11px]">Pipeline</p>} defaultOpen>
          <PipelinePanel loans={pipeline} />
        </CollapsibleSection>

        {repaidLoans.length > 0 && (
          <CollapsibleSection
            title={
              <p className="eyebrow text-[11px]">
                Closed loans <span className="text-[var(--slate-soft)] normal-case tracking-normal">({repaidLoans.length})</span>
              </p>
            }
            defaultOpen={false}
          >
            <div className="space-y-4">
              {repaidLoans.map((loan) => (
                <ClosedLoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential loan terms and borrower information. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}
