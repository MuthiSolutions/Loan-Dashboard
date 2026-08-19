import { cashPosition, pipeline } from "@/data/loans";
import { formatFCFA, loansSortedByUrgency, portfolioTotals } from "@/lib/loans";
import { CashPanel } from "@/components/CashPanel";
import { Header } from "@/components/Header";
import { LoanCard } from "@/components/LoanCard";
import { PipelinePanel } from "@/components/PipelinePanel";
import { SummaryCard } from "@/components/SummaryCard";
import { Timeline } from "@/components/Timeline";

// Penalties accrue by the day, so this page must be computed per-request, not cached at build time.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const asOf = new Date();
  const loans = loansSortedByUrgency(asOf);
  const totals = portfolioTotals(asOf);
  const totalDeployable = cashPosition.inBank + cashPosition.heldByFounder;

  const attentionLabel =
    totals.overdueCount > 0
      ? `${totals.overdueCount} overdue`
      : totals.dueSoonCount > 0
      ? `${totals.dueSoonCount} due within 7 days`
      : "None";

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <CashPanel cash={cashPosition} />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Deployable cash" value={formatFCFA(totalDeployable)} sub="Bank + pending founder return" tone="azure" />
          <SummaryCard label="Principal deployed" value={formatFCFA(totals.totalPrincipal)} sub={`${totals.activeCount} active loans`} />
          <SummaryCard
            label="Currently owed to Muthi"
            value={formatFCFA(totals.totalCurrentlyOwed)}
            sub="Live, incl. accrued late penalties"
            tone={totals.overdueCount > 0 ? "danger" : "default"}
          />
          <SummaryCard
            label="Needs attention"
            value={attentionLabel}
            sub="Overdue or due within 7 days"
            tone={totals.overdueCount > 0 ? "danger" : totals.dueSoonCount > 0 ? "default" : "ok"}
          />
        </section>

        <section>
          <p className="eyebrow mb-3 text-[11px]">Loan book</p>
          <div className="space-y-4">
            {loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Timeline loans={loans} />
          <div>
            <p className="eyebrow mb-3 text-[11px]">Pipeline</p>
            <PipelinePanel loans={pipeline} />
          </div>
        </section>

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential loan terms and borrower information. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}
